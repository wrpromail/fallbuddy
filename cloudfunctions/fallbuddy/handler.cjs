const { randomUUID } = require('node:crypto');
const { ensureAvatar } = require('./runtime/shared/avatar.js');

function bootstrap(state, openid, ownerOpenId) {
  let user = state.users.find((item) => item.openid === openid);
  let dirty = false;
  const now = new Date().toISOString();
  if (!user) {
    const id = 'usr_' + randomUUID();
    user = {
      id,
      openid,
      displayName: '雪友 ' + id.slice(-6),
      avatarId: 'avt_' + id,
      palette: 'blue',
      preferences: { allowFunnyActions: false, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
      createdAt: now,
    };
    state.users.push(user);
    dirty = true;
  }
  if (ensureAvatar(state, user, now)) dirty = true;
  if (!state.groups.length && openid === ownerOpenId) {
    state.groups.push({
      id: 'grp_pilot', name: '摔友记试用圈子', ownerId: user.id, joinMode: 'approval', createdAt: now,
    });
    state.memberships.push({
      groupId: 'grp_pilot', userId: user.id, role: 'owner', status: 'active', joinedAt: now,
    });
    dirty = true;
  }
  return { state: { ...state, currentUserId: user.id }, dirty };
}

function textToReview(domain, method, args) {
  const input = args[0];
  if (domain !== 'story') return null;
  if (method === 'appendUpdate') return typeof input?.body === 'string' ? input.body : null;
  if (method === 'publish' || method === 'update') {
    return [input?.input?.story?.title, input?.input?.story?.body, input?.input?.incident?.userSummary]
      .filter((value) => typeof value === 'string' && value.trim()).join('\n');
  }
  return null;
}

function createHandler({ api, store, transaction, checkText, appId, ownerOpenId }) {
  return async (event, identity) => {
    const requestId = typeof event?.args?.[0]?.requestId === 'string' ? event.args[0].requestId : randomUUID();
    const reject = (code, message) => ({ ok: false, code, message, requestId });
    if (!appId || !ownerOpenId || !identity?.OPENID || identity.APPID !== appId) {
      return reject('UNAUTHORIZED', '仅限微信小程序内使用');
    }
    const { domain, method, args } = event ?? {};
    if (!Object.hasOwn(api, domain) || !Object.hasOwn(api[domain], method) || !Array.isArray(args) || args.length > 1 ||
        requestId.length > 140 || Buffer.byteLength(JSON.stringify(args)) > 12000) {
      return reject('VALIDATION_FAILED', '请求参数无效');
    }
    try {
      const text = textToReview(domain, method, args);
      if (text && !await checkText(text, identity.OPENID)) {
        return reject('CONTENT_REJECTED', '发布的内容未通过微信内容审核，请修改后重试');
      }
      return await transaction(async (state, write) => {
        const request = bootstrap(state, identity.OPENID, ownerOpenId);
        const result = await store.withState(request, () => api[domain][method](...args));
        if (request.dirty) {
          const { currentUserId, ...snapshot } = request.state;
          await write(snapshot);
        }
        return result;
      });
    } catch (error) {
      // 不将请求正文、身份、数据库路径或第三方错误详情返回给客户端。
      console.error('FallBuddy cloud request failed', domain, method, error?.code ?? 'request_error');
      return reject('UNAVAILABLE', '服务暂不可用，请稍后重试');
    }
  };
}

function cloudTransaction(db) {
  return async (action) => {
    let committedResult;
    // wx-server-sdk 3.0.1 awaits commit and discards the callback return value.
    await db.runTransaction(async (transaction) => {
      const doc = transaction.collection('fallbuddy_server_state').doc('pilot-v1');
      const { data } = await doc.get();
      if (typeof data?.snapshot !== 'string') throw new Error('Pilot state has not been provisioned');
      committedResult = await action(JSON.parse(data.snapshot), async (state) => {
        const snapshot = JSON.stringify(state);
        if (Buffer.byteLength(snapshot) > 800_000) throw new Error('Pilot storage limit reached');
        await doc.update({ data: { snapshot } });
      });
    });
    return committedResult;
  };
}

module.exports = { createHandler, cloudTransaction };
