const { randomUUID } = require('node:crypto');
const { ensureAvatar, migrateAvatarCarry } = require('./runtime/shared/avatar.js');
const { cloudTransaction } = require('./partition-store.cjs');

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
  for (const avatar of state.avatars) {
    if (migrateAvatarCarry(avatar)) dirty = true;
  }
  if (!state.pilotInitialized && state.groups.some((group) => group.id === 'grp_pilot')) {
    state.pilotInitialized = true;
    dirty = true;
  }
  if (!state.pilotInitialized && openid === ownerOpenId) {
    state.groups.push({
      id: 'grp_pilot', name: '摔友记试用圈子', ownerId: user.id, joinMode: 'approval', createdAt: now,
    });
    state.memberships.push({
      groupId: 'grp_pilot', userId: user.id, role: 'owner', status: 'active', joinedAt: now,
    });
    state.pilotInitialized = true;
    dirty = true;
  }
  return { state: { ...state, currentUserId: user.id }, dirty };
}

function textToReview(domain, method, args) {
  const input = args[0];
  if (domain === 'group' && method === 'create') return typeof input?.name === 'string' ? input.name.trim() : null;
  if (domain !== 'story') return null;
  if (method === 'appendUpdate') return typeof input?.body === 'string' ? input.body : null;
  if (method === 'publish' || method === 'update') {
    return [input?.input?.story?.title, input?.input?.story?.body, input?.input?.incident?.userSummary]
      .filter((value) => typeof value === 'string' && value.trim()).join('\n');
  }
  return null;
}

function createHandler({ api, store, transaction, checkText, appId, ownerOpenId, voiceProvider }) {
  const voice = require('./voice.cjs').createVoiceHandler({ transaction, store, provider: voiceProvider });
  return async (event, identity) => {
    const requestId = typeof event?.args?.[0]?.requestId === 'string' ? event.args[0].requestId : randomUUID();
    const reject = (code, message) => ({ ok: false, code, message, requestId });
    if (!appId || !identity?.OPENID || identity.APPID !== appId) {
      return reject('UNAUTHORIZED', '仅限微信小程序内使用');
    }
    const { domain, method, args } = event ?? {};
    if (domain === 'voice') {
      if (!Array.isArray(args) || args.length > 1 || Buffer.byteLength(JSON.stringify(args)) > 510000) return reject('VALIDATION_FAILED', '录音请求无效');
      try { return await voice(event, identity.OPENID); }
      catch { return reject('UNAVAILABLE', '暂时无法处理录音'); }
    }
    if (!Object.hasOwn(api, domain) || !Object.hasOwn(api[domain], method) || !Array.isArray(args) || args.length > 1 ||
        requestId.length > 140 || Buffer.byteLength(JSON.stringify(args)) > 12000) {
      return reject('VALIDATION_FAILED', '请求参数无效');
    }
    try {
      const text = textToReview(domain, method, args);
      let review;
      return await transaction(async (state, write) => {
        if (state.deletedAccounts?.[store.accountFingerprint(identity.OPENID)]) {
          if (domain === 'auth' && method === 'deleteAccount' && args[0]?.confirm === true) {
            return { ok: true, code: 'OK', data: { deleted: true }, requestId };
          }
          return reject('ACCOUNT_DELETED', '此账号已注销');
        }
        if (text && !await (review ??= checkText(text, identity.OPENID))) {
          return reject('CONTENT_REJECTED', '提交的内容未通过微信内容审核，请修改后重试');
        }
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

module.exports = { createHandler, cloudTransaction };
