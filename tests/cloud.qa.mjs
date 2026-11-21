import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = '../cloudfunctions/fallbuddy/';
const { createHandler, cloudTransaction } = require(root + 'handler.cjs');
const { mockApi: api } = require(root + 'runtime/services/mock/api.js');
const store = require(root + 'runtime/services/store.js');

function expectOk(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.data;
}

function pilot(initial = {}, options = {}) {
  const legacy = {
    schemaVersion: 1, seededAt: new Date().toISOString(), users: [], avatars: [], groups: [],
    memberships: [], incidents: [], stories: [], storyUpdates: [], inventory: [], ledger: [],
    interactions: [], notifications: [], weeklyGrants: [], invites: [], operations: {}, ...initial,
  };
  const metaKey = 'fallbuddy_server_state/pilot-v1';
  let documents = new Map([[metaKey, { snapshot: JSON.stringify(legacy) }]]);
  let transactions = Promise.resolve();
  let writes = [];
  let failWrite;
  const db = {
    runTransaction(action) {
      const next = transactions.then(async () => {
        const pending = new Map(documents);
        const changed = [];
        function write(address, value) {
          if (failWrite && address === failWrite) throw new Error('Test write failed');
          if (value === undefined) pending.delete(address);
          else pending.set(address, structuredClone(value));
          changed.push(address);
        }
        await action({
          collection(name) {
            return {
              doc(id) {
                const address = name + '/' + id;
                return {
                  async get() { return { data: structuredClone(pending.get(address)) }; },
                  async set({ data }) { write(address, data); },
                  async remove() { write(address); },
                };
              },
            };
          },
        });
        documents = pending;
        writes = changed;
        // The SDK resolves with no callback result.
      });
      transactions = next.catch(() => {});
      return next;
    },
  };
  function snapshot() {
    const meta = documents.get(metaKey);
    if (meta.snapshot) return JSON.parse(meta.snapshot);
    const result = structuredClone(meta.scalars);
    for (const [table, count] of Object.entries(meta.pages)) {
      const rows = [];
      for (const { field, page, rows: json } of documents.values()) {
        if (field === table) rows[page] = JSON.parse(json);
      }
      assert.equal(rows.filter(Boolean).length, count);
      const items = rows.flat();
      result[table] = ['operations', 'blocks', 'deletedAccounts', 'ignoredInbox', 'storyDrafts', 'storyPublishes'].includes(table)
        ? Object.fromEntries(items) : items;
    }
    return result;
  }
  const handle = createHandler({
    api, store,
    appId: 'wx_test',
    ownerOpenId: 'owner',
    voiceProvider: options.voiceProvider,
    checkText: async (text) => !text.includes('拦截词'),
    transaction: cloudTransaction(db, options),
  });
  const call = (openid, domain, method, ...args) => handle({ domain, method, args }, { APPID: 'wx_test', OPENID: openid });
  return {
    handle, call, snapshot, legacy, transaction: cloudTransaction(db, options),
    meta: () => documents.get(metaKey), documents: () => new Map(documents), writes: () => writes,
    failAt(address) { failWrite = address; },
  };
}

const groupId = 'grp_pilot';
const input = {
  incident: {
    sport: 'ski_single', scenario: ['turning'], selfReportedCause: ['unknown'],
    bodyParts: ['knee_l'], impactKind: 'minor_discomfort', protectiveItems: [],
  },
  story: {
    title: '左膝着地', body: '练习换刃时摔了。', tone: 'supportive', visibility: 'groups',
    visibilityGroupIds: [groupId], allowFunnyActions: false, allowGifts: true, isAnonymous: true,
  },
};

test('云函数合同：身份来自微信上下文、入圈须审批、两位编辑者并发只能保存一个版本', async () => {
  const { handle, call, snapshot } = pilot();
  const rejected = await handle({ domain: 'auth', method: 'ensureUser', args: [], openid: 'owner' }, { APPID: 'wx_other', OPENID: 'owner' });
  assert.equal(rejected.code, 'UNAUTHORIZED');
  assert.equal((await call('owner', 'story', '__proto__')).code, 'VALIDATION_FAILED');
  const owner = expectOk(await call('owner', 'auth', 'ensureUser'));
  assert.ok(!JSON.stringify(owner).includes('openid'));
  const { token } = expectOk(await call('owner', 'group', 'createInvite', { groupId }));
  assert.equal(snapshot().invites[0].tokenHash.length, 64);
  assert.notEqual(snapshot().invites[0].tokenHash, token);
  const member = expectOk(await call('visitor', 'auth', 'ensureUser'));
  assert.equal(expectOk(await call('visitor', 'group', 'join', { inviteToken: token })).status, 'pending');
  assert.equal((await call('visitor', 'group', 'getAtlas', { groupId })).code, 'NOT_MEMBER');
  assert.equal((await call('visitor', 'group', 'reviewMember', { groupId, userId: member.user.id, approve: true })).code, 'UNAUTHORIZED');
  assert.equal(expectOk(await call('owner', 'group', 'getJoinRequests', groupId))[0].id, member.user.id);
  expectOk(await call('owner', 'group', 'reviewMember', { groupId, userId: member.user.id, approve: true }));
  assert.equal(expectOk(await call('visitor', 'group', 'listMine'))[0].id, groupId);

  const request = { input, requestId: 'cloud_publish' };
  const results = await Promise.all([
    call('owner', 'story', 'publish', request),
    call('owner', 'story', 'publish', request),
  ]);
  const { storyId, version } = expectOk(results[0]);
  assert.equal(expectOk(results[1]).storyId, storyId);
  assert.equal(snapshot().stories.length, 1);
  expectOk(await call('visitor', 'story', 'getDetail', { storyId, groupId }));

  const { items: [gift] } = expectOk(await call('visitor', 'inventory', 'claimWeekly', { requestId: 'cloud_weekly' }));
  const giftParams = { storyId, itemDefId: gift.itemDefId, requestId: 'cloud_gift_once' };
  const [sent, repeated, competing] = await Promise.all([
    call('visitor', 'inventory', 'gift', giftParams),
    call('visitor', 'inventory', 'gift', giftParams),
    call('visitor', 'inventory', 'gift', { ...giftParams, requestId: 'cloud_gift_competing' }),
  ]);
  assert.equal(expectOk(sent).eventId, expectOk(repeated).eventId);
  assert.equal(competing.code, 'INVENTORY_INSUFFICIENT');
  assert.equal(snapshot().interactions.length, 1);
  assert.equal(snapshot().inventory.find((item) => item.ownerId === owner.user.id && item.itemDefId === gift.itemDefId).quantity, 1);
  assert.deepEqual(expectOk(await call('owner', 'avatar', 'getMine')), owner.avatar);

  const edited = { ...input, incident: { ...input.incident, bodyParts: ['knee_r'] } };
  const writes = await Promise.all([
    call('owner', 'story', 'update', { storyId, version, input: edited, requestId: 'cloud_edit_a' }),
    call('owner', 'story', 'update', { storyId, version, input: edited, requestId: 'cloud_edit_b' }),
  ]);
  assert.deepEqual(writes.map((result) => result.code).sort(), ['CONFLICT', 'OK']);

  const privateStory = { ...edited, story: { ...edited.story, visibility: 'self' } };
  expectOk(await call('owner', 'story', 'update', { storyId, version: version + 1, input: privateStory, requestId: 'cloud_private' }));
  assert.equal((await call('visitor', 'story', 'getDetail', { storyId, groupId })).code, 'NOT_VISIBLE');
});

test('云端私人草稿保存可重试，过期版本无法替换或发布新草稿', async () => {
  const { call, snapshot } = pilot();
  const args = { version: 0, input, requestId: 'draft_original' };
  const [first, retry] = await Promise.all([0, 1].map(() => call('owner', 'story', 'saveDraft', args)));
  const saved = expectOk(first);
  assert.deepEqual(expectOk(retry), saved);
  assert.equal(expectOk(await call('visitor', 'story', 'getDraft')), null);
  const changed = { ...input, story: { ...input.story, title: '从另一台设备保存' } };
  const latest = expectOk(await call('owner', 'story', 'saveDraft', {
    input: changed, version: saved.version, requestId: 'draft_changed',
  }));
  assert.equal((await call('owner', 'story', 'saveDraft', args)).code, 'CONFLICT');
  assert.equal((await call('owner', 'story', 'publish', {
    input, draftVersion: saved.version, requestId: 'draft_publish_old',
  })).code, 'CONFLICT');
  assert.equal(snapshot().stories.length, 0);
  assert.deepEqual(expectOk(await call('owner', 'story', 'getDraft')), latest);
  const publishArgs = { input: changed, draftVersion: latest.version, requestId: 'draft_publish_latest' };
  const published = expectOk(await call('owner', 'story', 'publish', publishArgs));
  assert.deepEqual(expectOk(await call('owner', 'story', 'publish', publishArgs)), published);
  assert.equal(expectOk(await call('owner', 'story', 'getDraft')), null);
  assert.equal(snapshot().stories.length, 1);
});

test('云函数合同：审核拒绝的正文不入库，举报隐藏后旧详情和互动入口拒绝访问', async () => {
  const { call, snapshot } = pilot();
  expectOk(await call('owner', 'auth', 'ensureUser'));
  const { token } = expectOk(await call('owner', 'group', 'createInvite', { groupId }));
  const { user } = expectOk(await call('reporter', 'auth', 'ensureUser'));
  expectOk(await call('reporter', 'group', 'join', { inviteToken: token }));
  expectOk(await call('owner', 'group', 'reviewMember', { groupId, userId: user.id, approve: true }));
  const flagged = { ...input, story: { ...input.story, body: '包含拦截词' } };
  const result = await call('reporter', 'story', 'publish', { input: flagged, requestId: 'moderation_reject' });
  assert.equal(result.code, 'CONTENT_REJECTED');
  assert.equal(snapshot().stories.length, 0);
  const { storyId } = expectOk(await call('reporter', 'story', 'publish', { input, requestId: 'moderation_publish' }));
  const reportInput = { storyId, groupId, reason: 'other', requestId: 'moderation_report' };
  const { reportId } = expectOk(await call('owner', 'moderation', 'reportStory', reportInput));
  assert.equal(expectOk(await call('owner', 'moderation', 'reportStory', reportInput)).reportId, reportId);
  assert.equal((await call('reporter', 'moderation', 'listReports', groupId)).code, 'UNAUTHORIZED');
  const [report] = expectOk(await call('owner', 'moderation', 'listReports', groupId));
  assert.equal(report.id, reportId);
  assert.ok(!('reporterId' in report));
  expectOk(await call('owner', 'moderation', 'resolveReport', { reportId, groupId, decision: 'hide' }));
  assert.equal((await call('owner', 'story', 'getDetail', { storyId, groupId })).code, 'NOT_VISIBLE');
  assert.equal((await call('owner', 'interaction', 'react', { storyId, actionId: 'hug', requestId: 'hidden_hug' })).code, 'NOT_VISIBLE');
  assert.equal(expectOk(await call('owner', 'group', 'getAtlas', { groupId })).storyCount, 0);
});

test('云端角色首次装备只发一次，免费外观和并发保存独立于互动道具', async () => {
  const { call, snapshot } = pilot();
  await Promise.all([call('owner', 'avatar', 'getMine'), call('owner', 'inventory', 'getMine')]);
  const avatar = expectOk(await call('owner', 'avatar', 'getMine'));
  assert.equal(avatar.customized, false);
  assert.equal(avatar.equipped.outfit, 'ski_blue');
  assert.equal(avatar.equipped.hip_protector, 'basic_hip_protector');
  assert.deepEqual(snapshot().inventory.map((item) => item.itemDefId).sort(), ['basic_hip_protector', 'ski_blue']);

  const appearance = { palette: 'mint', headShape: 'soft_square', expression: 'cool',
    equipped: { ...avatar.equipped, headgear: 'helmet_red', goggles: 'snow_goggles' } };
  const params = { appearance, expectedVersion: avatar.version };
  assert.equal((await call('owner', 'avatar', 'updateAppearance', params)).code, 'VALIDATION_FAILED');
  assert.equal((await call('owner', 'inventory', 'claimCosmetic', { itemDefId: 'steel_hip_guard' })).code, 'VALIDATION_FAILED');
  for (const itemDefId of ['helmet_red', 'snow_goggles']) {
    const claims = await Promise.all([0, 1].map(() => call('owner', 'inventory', 'claimCosmetic', { itemDefId })));
    assert.ok(claims.every((result) => expectOk(result).quantity === 1));
  }
  const results = await Promise.all([0, 1].map(() => call('owner', 'avatar', 'updateAppearance', params)));
  assert.deepEqual(results.map((result) => result.code).sort(), ['CONFLICT', 'OK']);
  const saved = expectOk(await call('owner', 'avatar', 'getMine'));
  assert.deepEqual(saved.equipped, appearance.equipped);
  assert.equal(saved.palette, 'mint');
  assert.equal(saved.headShape, 'soft_square');

  const other = expectOk(await call('other', 'avatar', 'getMine'));
  assert.notEqual(other.id, saved.id);
  assert.equal((await call('other', 'avatar', 'updateAppearance', { ...params, avatarId: saved.id })).code, 'VALIDATION_FAILED');
  assert.deepEqual(expectOk(await call('owner', 'avatar', 'getMine')), saved);
});

async function addMember(call, account = 'member', group = groupId, manager = 'owner') {
  const { token } = expectOk(await call(manager, 'group', 'createInvite', { groupId: group }));
  const joined = expectOk(await call(account, 'group', 'join', { inviteToken: token }));
  const { user } = expectOk(await call(account, 'auth', 'ensureUser'));
  if (joined.status === 'pending') {
    expectOk(await call(manager, 'group', 'reviewMember', { groupId: group, userId: user.id, approve: true }));
  }
  return user;
}

test('圈子可创建、撤销邀请、转让和退出，退圈只移除明确选择的受众', async () => {
  const { call, snapshot } = pilot();
  const args = { name: '周末练习', joinMode: 'approval', requestId: 'create_practice' };
  const group = expectOk(await call('owner', 'group', 'create', args));
  assert.deepEqual(expectOk(await call('owner', 'group', 'create', args)), group);
  const { id: inviteId, token } = expectOk(await call('owner', 'group', 'createInvite', { groupId: group.id }));
  const { user: member } = expectOk(await call('friend', 'auth', 'ensureUser'));
  assert.equal(expectOk(await call('friend', 'group', 'join', { inviteToken: token })).status, 'pending');
  assert.equal((await call('friend', 'group', 'revokeInvite', { groupId: group.id, inviteId })).code, 'UNAUTHORIZED');
  assert.equal((await call('friend', 'group', 'getAtlas', { groupId: group.id })).code, 'NOT_MEMBER');
  const invites = expectOk(await call('owner', 'group', 'listInvites', group.id));
  assert.equal(invites[0].id, inviteId);
  assert.ok(!JSON.stringify(invites).includes(token));
  expectOk(await call('owner', 'group', 'revokeInvite', { groupId: group.id, inviteId }));
  assert.equal((await call('late', 'group', 'join', { inviteToken: token })).code, 'NOT_FOUND');
  assert.deepEqual(expectOk(await call('owner', 'group', 'listInvites', group.id)), []);
  expectOk(await call('owner', 'group', 'reviewMember', { groupId: group.id, userId: member.id, approve: true }));
  const { id: other } = expectOk(await call('owner', 'group', 'create', {
    name: '周日练习', joinMode: 'open', requestId: 'create_second',
  }));
  await addMember(call, 'friend', other);
  assert.equal((await call('owner', 'group', 'leave', { groupId: group.id })).code, 'VALIDATION_FAILED');
  assert.equal((await call('friend', 'group', 'transferOwner', { groupId: group.id, userId: member.id })).code, 'UNAUTHORIZED');
  expectOk(await call('owner', 'group', 'transferOwner', { groupId: group.id, userId: member.id }));
  assert.equal(expectOk(await call('owner', 'group', 'listMine')).find((item) => item.id === group.id).role, 'admin');
  assert.equal(expectOk(await call('friend', 'group', 'listMine')).find((item) => item.id === group.id).role, 'owner');

  const mixed = { ...input, story: { ...input.story, visibilityGroupIds: [group.id, other] } };
  const { storyId } = expectOk(await call('owner', 'story', 'publish', { input: mixed, requestId: 'mixed-story' }));
  expectOk(await call('owner', 'story', 'appendUpdate', { storyId, body: '动作已经练顺了。', type: 'follow_up', requestId: 'mixed-update' }));
  expectOk(await call('owner', 'group', 'leave', { groupId: group.id }));
  assert.equal(expectOk(await call('friend', 'group', 'getAtlas', { groupId: group.id })).storyCount, 0);
  assert.equal(expectOk(await call('friend', 'group', 'getAtlas', { groupId: other })).storyCount, 1);
  assert.deepEqual(snapshot().storyUpdates.find((item) => item.storyId === storyId).visibilityGroupIds, [other]);

  const retained = { ...input, story: { ...input.story, visibilityGroupIds: [other], title: '选择保留' } };
  const kept = expectOk(await call('friend', 'story', 'publish', { input: retained, requestId: 'retained-story' }));
  expectOk(await call('friend', 'group', 'leave', { groupId: other, retainStories: true }));
  assert.equal((await call('friend', 'group', 'getAtlas', { groupId: other })).code, 'NOT_MEMBER');
  assert.equal(expectOk(await call('owner', 'story', 'getDetail', { storyId: kept.storyId, groupId: other })).story.title, '选择保留');
});

test('永久删除事故清理关联数据。注销阻断旧身份并保留对方已到账的礼物', async () => {
  const { call, snapshot } = pilot();
  const owner = expectOk(await call('owner', 'auth', 'ensureUser')).user;
  const member = await addMember(call);
  assert.equal((await call('owner', 'auth', 'deleteAccount', { confirm: true })).code, 'VALIDATION_FAILED');
  const { storyId, version } = expectOk(await call('member', 'story', 'publish', { input, requestId: 'to-delete' }));
  const followUpArgs = { storyId, type: 'follow_up', body: '逐渐恢复。', requestId: 'delete-update' };
  const followUp = expectOk(await call('member', 'story', 'appendUpdate', followUpArgs));
  assert.deepEqual(expectOk(await call('member', 'story', 'appendUpdate', followUpArgs)), followUp);
  expectOk(await call('owner', 'interaction', 'react', { storyId, actionId: 'hug', requestId: 'delete-hug' }));
  const { reportId } = expectOk(await call('owner', 'moderation', 'reportStory', {
    storyId, groupId, reason: 'other', requestId: 'delete-report',
  }));
  assert.equal((await call('owner', 'story', 'delete', { storyId, version })).code, 'UNAUTHORIZED');
  assert.equal((await call('member', 'story', 'delete', { storyId, version })).code, 'CONFLICT');
  const afterAppend = expectOk(await call('member', 'story', 'getDetail', { storyId }));
  assert.equal(afterAppend.story.version, version + 1);
  assert.deepEqual(afterAppend.updates.map(({ id }) => id), [followUp.id]);

  const withdrawArgs = { storyId, updateId: followUp.id };
  const withdrawn = expectOk(await call('member', 'story', 'withdrawUpdate', withdrawArgs));
  assert.deepEqual(expectOk(await call('member', 'story', 'withdrawUpdate', withdrawArgs)), withdrawn);
  assert.equal((await call('member', 'story', 'delete', { storyId, version: afterAppend.story.version })).code, 'CONFLICT');
  const latest = expectOk(await call('member', 'story', 'getDetail', { storyId }));
  assert.equal(latest.story.version, version + 2);
  assert.deepEqual(latest.updates, []);
  const id = latest.incident.id;
  expectOk(await call('member', 'story', 'delete', { storyId, version: latest.story.version }));
  assert.equal((await call('owner', 'story', 'getDetail', { storyId, groupId })).code, 'NOT_FOUND');
  assert.deepEqual(expectOk(await call('member', 'story', 'listMine')), []);
  for (const key of [id, storyId, followUp.id, reportId]) assert.ok(!JSON.stringify(snapshot()).includes(key));

  const surviving = expectOk(await call('owner', 'story', 'publish', { input, requestId: 'survive-close' }));
  const { items: [gift] } = expectOk(await call('member', 'inventory', 'claimWeekly', { requestId: 'before-close' }));
  expectOk(await call('member', 'inventory', 'gift', {
    storyId: surviving.storyId, itemDefId: gift.itemDefId, requestId: 'sent-before-close',
  }));
  expectOk(await call('member', 'story', 'saveDraft', { version: 0, input, requestId: 'personal-draft' }));
  expectOk(await call('member', 'auth', 'deleteAccount', { confirm: true }));
  expectOk(await call('member', 'auth', 'deleteAccount', { confirm: true }));
  assert.equal((await call('member', 'auth', 'ensureUser')).code, 'ACCOUNT_DELETED');
  assert.equal((await call('member', 'group', 'getAtlas', { groupId })).code, 'ACCOUNT_DELETED');
  assert.equal((await call('member', 'group', 'create', {
    name: '拦截词', joinMode: 'approval', requestId: 'closed-account-write',
  })).code, 'ACCOUNT_DELETED');
  assert.deepEqual(expectOk(await call('owner', 'interaction', 'getInboxGroups', {})).groups, []);
  const state = snapshot();
  assert.ok(!JSON.stringify(state).includes(member.id));
  assert.ok(!state.users.some((user) => user.openid === 'member'));
  assert.equal(state.inventory.find((item) => item.ownerId === owner.id && item.itemDefId === gift.itemDefId).quantity, 1);
  assert.equal(state.ledger.find((entry) => entry.toUserId === owner.id && entry.itemDefId === gift.itemDefId).fromUserId, null);
});

test('消息按日期、故事和动作合并，忽略、屏蔽和停用互动在云端生效', async (t) => {
  const { call, snapshot } = pilot();
  const member = await addMember(call);
  const { storyId } = expectOk(await call('owner', 'story', 'publish', { input, requestId: 'inbox-story' }));
  const react = (actionId, requestId) => call('member', 'interaction', 'react', { storyId, groupId, actionId, requestId });
  expectOk(await react('hug', 'inbox-hug-1'));
  expectOk(await react('hug', 'inbox-hug-2'));
  expectOk(await react('cheer', 'inbox-cheer'));
  const inbox = expectOk(await call('owner', 'interaction', 'getInboxGroups', {}));
  assert.equal(inbox.unreadCount, 3);
  assert.equal(inbox.groups.length, 2);
  const hugs = inbox.groups.find((group) => group.events[0].actionId === 'hug');
  assert.equal(hugs.events.length, 2);
  assert.equal(expectOk(await call('owner', 'interaction', 'markRead', { groupKey: hugs.id })).updatedCount, 2);
  assert.equal(expectOk(await call('owner', 'interaction', 'getInboxGroups', {})).unreadCount, 1);
  assert.equal((await call('member', 'interaction', 'ignoreInboxGroup', { groupKey: hugs.id })).code, 'NOT_FOUND');
  expectOk(await call('owner', 'interaction', 'ignoreInboxGroup', { groupKey: hugs.id }));
  assert.equal(expectOk(await call('owner', 'interaction', 'getInboxGroups', {})).groups.length, 1);
  assert.equal(snapshot().interactions.length, 3);
  const next = expectOk(await call('owner', 'story', 'publish', { input, requestId: 'another-inbox-story' }));
  const send = (requestId) => call('member', 'interaction', 'react', { storyId: next.storyId, groupId, actionId: 'hug', requestId });
  expectOk(await call('owner', 'interaction', 'setBlocked', { userId: member.id, blocked: true }));
  assert.equal((await send('blocked')).code, 'INTERACTION_DISABLED');
  assert.equal((await call('member', 'story', 'getDetail', { storyId: next.storyId, groupId })).code, 'NOT_VISIBLE');
  assert.equal(expectOk(await call('owner', 'interaction', 'listBlocked')).length, 1);
  expectOk(await call('owner', 'interaction', 'setBlocked', { userId: member.id, blocked: false }));
  assert.equal((await call('member', 'group', 'setInteractionsPaused', { groupId, paused: true })).code, 'UNAUTHORIZED');
  expectOk(await call('owner', 'group', 'setInteractionsPaused', { groupId, paused: true }));
  assert.equal((await send('paused')).code, 'INTERACTION_DISABLED');
  const { items: [gift] } = expectOk(await call('member', 'inventory', 'claimWeekly', { requestId: 'paused-weekly' }));
  assert.equal((await call('member', 'inventory', 'gift', {
    groupId, storyId: next.storyId, itemDefId: gift.itemDefId, requestId: 'paused-gift',
  })).code, 'INTERACTION_DISABLED');
  expectOk(await call('member', 'story', 'getDetail', { storyId: next.storyId, groupId }));
  expectOk(await call('owner', 'group', 'setInteractionsPaused', { groupId, paused: false }));
  expectOk(await send('open-again'));
  assert.deepEqual(snapshot().interactionControls.map((item) => item.paused), [true, false]);
  t.mock.method(store, 'platformInteractionsPaused', () => true);
  assert.equal((await send('platform-paused')).code, 'INTERACTION_DISABLED');
});

test('旧云端数据原子迁移，分区扛住超旧上限读写并保留权限、库存和台账', async () => {
  const demo = pilot();
  const { call } = demo;
  const owner = expectOk(await call('owner', 'auth', 'ensureUser')).user;
  const member = await addMember(call);
  const { storyId } = expectOk(await call('owner', 'story', 'publish', { input, requestId: 'migrate-story' }));
  const privateInput = { ...input, story: { ...input.story, visibility: 'self', visibilityGroupIds: [] } };
  const hidden = expectOk(await call('owner', 'story', 'publish', { input: privateInput, requestId: 'migrate-private' }));
  const { items: [gift] } = expectOk(await call('member', 'inventory', 'claimWeekly', { requestId: 'migrate-weekly' }));
  const giftParams = { storyId, itemDefId: gift.itemDefId, requestId: 'migrate-real-gift' };
  const sent = expectOk(await call('member', 'inventory', 'gift', giftParams));
  const original = demo.snapshot();
  const oldEntry = original.ledger[0];
  const filler = Array.from({ length: 2_450 }, (_, index) => ({
    ...oldEntry,
    operationId: 'historical_operation_' + index,
    eventId: 'historical_event_' + index,
  }));
  original.ledger.push(...filler);
  assert.ok(Buffer.byteLength(JSON.stringify(original)) < 800_000);
  const destination = pilot(original);
  destination.failAt('fallbuddy_server_state/pilot-v1');
  await assert.rejects(destination.transaction(async (state) => state), /Test write failed/);
  assert.equal(destination.documents().size, 1);
  assert.deepEqual(destination.snapshot(), original);
  destination.failAt(undefined);

  assert.deepEqual(await destination.transaction(async (state) => state), original);
  assert.equal(destination.meta().layoutVersion, 2);
  assert.ok(!('snapshot' in destination.meta()));
  assert.ok(destination.meta().pages.ledger > 1);
  for (const prefix of ['stories', 'memberships', 'inventory', 'interactions']) {
    assert.ok([...destination.documents().keys()].some((key) => key.startsWith('fallbuddy_' + prefix + '/')));
  }
  assert.equal((await destination.call('member', 'story', 'getDetail', { storyId: hidden.storyId })).code, 'NOT_VISIBLE');
  expectOk(await destination.call('member', 'story', 'getDetail', { storyId, groupId }));
  assert.deepEqual(expectOk(await destination.call('member', 'inventory', 'gift', giftParams)), sent);
  assert.equal(destination.snapshot().inventory.find((item) => item.ownerId === owner.id && item.itemDefId === gift.itemDefId).quantity, 1);
  assert.equal(destination.snapshot().interactions[0].actorId, member.id);

  await destination.transaction(async (state, write) => {
    state.ledger.push(...filler.map((entry) => ({ ...entry, operationId: entry.operationId + '_later' })));
    await write(state);
  });
  assert.ok(Buffer.byteLength(JSON.stringify(destination.snapshot())) > 800_000);
  assert.ok(destination.writes().every((key) => key.startsWith('fallbuddy_inventory/ledger-') || key === 'fallbuddy_server_state/pilot-v1'));
  for (const document of destination.documents().values()) {
    if (document.rows) assert.ok(Buffer.byteLength(document.rows) <= 240_000);
  }
  expectOk(await destination.call('owner', 'story', 'delete', { storyId, version: 1 }));
  assert.ok(!destination.documents().has('fallbuddy_interactions/interactions-0'));
  assert.ok(!destination.documents().has('fallbuddy_interactions/notifications-0'));
});

test('新外观只能领取后装备，老版本角色请求保留已有装备及持板侧别', async () => {
  const { call, snapshot } = pilot();
  const baseline = expectOk(await call('owner', 'avatar', 'getMine'));
  const legacy = Object.fromEntries(['headgear', 'goggles', 'outfit', 'hip_protector', 'boots']
    .map((slot) => [slot, baseline.equipped[slot]]));
  const appearance = { ...baseline, carryHand: 'left', equipped: { ...legacy, gloves: 'gloves_frost', knee_pads: 'pads_slate',
    handheld: 'snowboard_dawn' } };
  const update = (version, look = appearance) => call('owner', 'avatar', 'updateAppearance', {
    appearance: look, expectedVersion: version,
  });
  assert.equal((await update(baseline.version)).code, 'VALIDATION_FAILED');
  for (const itemDefId of ['gloves_frost', 'pads_slate', 'snowboard_dawn', 'ski_poles']) {
    const claims = await Promise.all([0, 1].map(() => call('owner', 'inventory', 'claimCosmetic', { itemDefId })));
    assert.ok(claims.every((result) => expectOk(result).quantity === 1));
  }
  assert.equal((await update(baseline.version, { ...appearance, carryHand: 'center' })).code,
    'VALIDATION_FAILED');
  assert.equal((await update(baseline.version, { ...appearance, equipped: { ...appearance.equipped, handheld: 'pads_slate' } })).code,
    'VALIDATION_FAILED');
  const { avatar: saved } = expectOk(await update(baseline.version));
  assert.deepEqual(saved.equipped, appearance.equipped);
  const read = expectOk(await call('owner', 'avatar', 'getMine'));
  const owned = new Set(expectOk(await call('owner', 'inventory', 'getMine')).map((item) => item.itemDefId));
  assert.deepEqual(Object.values(read.equipped).filter((id) => id && !owned.has(id)), []);
  const { avatar: afterLegacy } = expectOk(await update(read.version, { ...read, palette: 'mint' }));
  assert.equal(afterLegacy.carryHand, 'left');
  assert.equal(afterLegacy.palette, 'mint');
  const { avatar: oldFormat } = expectOk(await update(afterLegacy.version, { ...baseline, expression: 'cool', equipped: legacy }));
  assert.equal(oldFormat.carryHand, 'left');
  assert.deepEqual(afterLegacy.equipped, saved.equipped);
  assert.equal(oldFormat.expression, 'cool');
  const { avatar: interim } = expectOk(await update(oldFormat.version,
    { ...baseline, equipped: { ...saved.equipped, carryHand: 'right' } }));
  assert.equal(interim.carryHand, 'right');
  assert.ok(!('carryHand' in interim.equipped));
  assert.equal(snapshot().ledger.filter((item) => item.itemDefId === 'snowboard_dawn').length, 1);

  const { storyId } = expectOk(await call('owner', 'story', 'publish', { input, requestId: 'private-outfit' }));
  await addMember(call);
  const detail = expectOk(await call('member', 'story', 'getDetail', { storyId, groupId }));
  assert.equal(detail.avatar.equipped.handheld, null);
  assert.equal(detail.avatar.equipped.gloves, null);
  assert.equal(detail.avatar.equipped.knee_pads, null);
  assert.equal(detail.avatar.carryHand, undefined);
});

test('永久删除后同一发布请求无法重建事故，旧格式仍可识别', async () => {
  const { call, snapshot } = pilot();
  const request = { input, requestId: 'weak-network-publish' };
  const published = expectOk(await call('owner', 'story', 'publish', request));
  expectOk(await call('owner', 'story', 'delete', published));
  assert.equal((await call('owner', 'story', 'publish', request)).code, 'NOT_FOUND');
  assert.equal(snapshot().stories.length, 0);
  assert.deepEqual(Object.values(snapshot().storyPublishes), [null]);
  assert.ok(!JSON.stringify(snapshot()).includes(request.requestId));

  const { storyId, version } = expectOk(await call('owner', 'story', 'publish', { ...request, requestId: 'different' }));
  const legacy = snapshot();
  const userId = legacy.users[0].id;
  delete legacy.storyPublishes;
  legacy.operations[`story.publish|${userId}|legacy-publish`] = {
    action: 'story.publish', userId, requestId: 'legacy-publish', createdAt: new Date().toISOString(),
    response: JSON.stringify({ ok: true, code: 'OK', data: { storyId, version }, requestId: 'legacy-publish' }),
  };
  const upgrade = pilot(legacy);
  expectOk(await upgrade.call('owner', 'story', 'delete', { storyId, version }));
  assert.equal((await upgrade.call('owner', 'story', 'publish', { ...request, requestId: 'legacy-publish' })).code, 'NOT_FOUND');
  assert.equal(upgrade.snapshot().stories.length, 0);
  expectOk(await upgrade.call('owner', 'auth', 'deleteAccount', { confirm: true }));
  assert.deepEqual(upgrade.snapshot().storyPublishes, {});

  legacy.operations[`story.publish|${userId}|legacy-publish`].createdAt = '2020-01-01T00:00:00.000Z';
  for (let index = 0; index < 199; index++) {
    const requestId = 'other-' + index;
    legacy.operations[`group.create|${userId}|${requestId}`] = {
      action: 'group.create', userId, requestId, createdAt: '2021-01-01T00:00:00.000Z', response: '{}',
    };
  }
  const aged = pilot(legacy);
  expectOk(await aged.call('owner', 'group', 'create', { name: '新圈子', joinMode: 'open', requestId: 'extra' }));
  assert.ok(!Object.values(aged.snapshot().operations).some((item) => item.requestId === 'legacy-publish'));
  expectOk(await aged.call('owner', 'story', 'delete', { storyId, version }));
  assert.equal((await aged.call('owner', 'story', 'publish', { ...request, requestId: 'legacy-publish' })).code, 'NOT_FOUND');
});

test('保留的旧圈受众可以随正文更新保留或移除，失去成员身份后不能重新授权', async () => {
  const { call, snapshot } = pilot();
  await addMember(call);
  const second = expectOk(await call('member', 'group', 'create', {
    name: '周日练习圈', joinMode: 'open', requestId: 'second-audience',
  }));
  const shared = { ...input, story: { ...input.story, visibilityGroupIds: [groupId, second.id] } };
  const published = expectOk(await call('member', 'story', 'publish', { input: shared, requestId: 'kept-edit' }));
  const followUp = expectOk(await call('member', 'story', 'appendUpdate', {
    storyId: published.storyId, type: 'follow_up', body: '第一次重新练习。', requestId: 'keep-update',
  }));
  const lastCircle = expectOk(await call('member', 'story', 'publish', { input, requestId: 'last-circle' }));
  expectOk(await call('member', 'group', 'leave', { groupId, retainStories: true }));
  const author = expectOk(await call('member', 'story', 'getDetail', { storyId: published.storyId }));
  assert.deepEqual(author.retainedAudiences, [{ id: groupId, name: '摔友记试用圈子' }]);
  assert.deepEqual(author.authorAudiences, [...author.retainedAudiences, { id: second.id, name: second.name }]);
  const changed = { ...input, story: { ...input.story, body: '今天走路轻松些了。', visibilityGroupIds: [second.id] } };
  const edited = expectOk(await call('member', 'story', 'update', {
    storyId: published.storyId, version: author.story.version, input: changed, requestId: 'legacy-edit-text',
  }));
  const viewer = expectOk(await call('owner', 'story', 'getDetail', { storyId: edited.storyId, groupId }));
  assert.equal(viewer.story.body, changed.story.body);
  assert.deepEqual(viewer.updates.map(({ id }) => id), [followUp.id]);
  assert.equal(viewer.authorAudiences, undefined);
  assert.equal(viewer.retainedAudiences, undefined);
  const removal = { ...edited, input: changed, removeRetainedGroupIds: [groupId], requestId: 'remove-audience' };
  assert.equal((await call('member', 'story', 'update', {
    ...removal, removeRetainedGroupIds: ['unrelated-group'], requestId: 'bad-removal',
  })).code, 'VALIDATION_FAILED');
  assert.equal((await call('member', 'story', 'update', {
    ...removal, input: shared, requestId: 'contradictory-removal',
  })).code, 'VALIDATION_FAILED');
  const removed = expectOk(await call('member', 'story', 'update', removal));
  assert.deepEqual(expectOk(await call('member', 'story', 'update', removal)), removed);
  assert.equal((await call('owner', 'story', 'getDetail', { storyId: removed.storyId, groupId })).code, 'NOT_VISIBLE');
  assert.deepEqual(snapshot().storyUpdates.find(({ id }) => id === followUp.id).visibilityGroupIds, [second.id]);
  assert.equal((await call('member', 'story', 'update', {
    ...removed, input: shared, requestId: 'restore-audience',
  })).code, 'NOT_MEMBER');
  assert.equal((await call('member', 'story', 'publish', { input, requestId: 'new-publish' })).code, 'NOT_MEMBER');

  const noJoinedAudience = { ...changed, story: { ...changed.story, visibilityGroupIds: [] } };
  const legacy = expectOk(await call('member', 'story', 'update', {
    ...lastCircle, input: noJoinedAudience, requestId: 'legacy-no-joined-audience',
  }));
  assert.equal(expectOk(await call('owner', 'story', 'getDetail', { storyId: legacy.storyId })).story.body, changed.story.body);
  const privateInput = { ...input, story: { ...input.story, visibility: 'self', visibilityGroupIds: [] } };
  const hidden = expectOk(await call('member', 'story', 'update', { ...legacy, input: privateInput, requestId: 'remove-all' }));
  assert.equal((await call('owner', 'story', 'getDetail', { storyId: hidden.storyId })).code, 'NOT_VISIBLE');
});

test('屏蔽对双方的图鉴、详情与历史消息生效，取消后恢复且不删除事件', async () => {
  const { call, snapshot } = pilot();
  const { id: memberId } = await addMember(call);
  await addMember(call, 'other');
  const makeStory = (who) => call(who, 'story', 'publish', { input, requestId: 'block-' + who });
  const ownerStory = expectOk(await makeStory('owner'));
  const memberStory = expectOk(await makeStory('member'));
  const otherStory = expectOk(await makeStory('other'));
  const hug = expectOk(await call('member', 'interaction', 'react', {
    storyId: ownerStory.storyId, actionId: 'hug', requestId: 'before-block',
  }));
  expectOk(await call('owner', 'interaction', 'setBlocked', { userId: memberId, blocked: true }));
  const check = async (who, own) => {
    const atlas = expectOk(await call(who, 'group', 'getAtlas', { groupId }));
    const ids = [own.storyId, otherStory.storyId].sort();
    assert.deepEqual(atlas.stories.map((story) => story.id).sort(), ids);
    assert.equal(atlas.storyCount, 2);
    assert.equal(atlas.participantCount, 2);
    assert.deepEqual(atlas.hotspots.find((spot) => spot.id === 'knee_l').storyIds.sort(), ids);
    assert.equal(atlas.hottest.find((part) => part.bodyPart === 'knee_l').count, 2);
  };
  await check('owner', ownerStory);
  await check('member', memberStory);
  assert.equal(expectOk(await call('other', 'group', 'getAtlas', { groupId })).storyCount, 3);
  assert.equal((await call('owner', 'story', 'getDetail', { ...memberStory, groupId })).code, 'NOT_VISIBLE');
  assert.equal((await call('member', 'story', 'getDetail', { ...ownerStory, groupId })).code, 'NOT_VISIBLE');
  const ownerDetail = expectOk(await call('owner', 'story', 'getDetail', { ...ownerStory, replayEventId: hug.eventId }));
  assert.equal(ownerDetail.replay, undefined);
  assert.equal(ownerDetail.reactions.find((item) => item.actionId === 'hug').count, 0);
  assert.equal(expectOk(await call('owner', 'interaction', 'getInboxGroups', {})).unreadCount, 0);
  assert.equal(snapshot().interactions.length, 1);
  expectOk(await call('owner', 'interaction', 'setBlocked', { userId: memberId, blocked: false }));
  assert.equal(expectOk(await call('owner', 'group', 'getAtlas', { groupId })).storyCount, 3);
  assert.equal(expectOk(await call('owner', 'interaction', 'getInboxGroups', {})).unreadCount, 1);
});

test('抱抱回放使用该事件的角色及其装备，仅接收方可回放，保留匿名外观', async () => {
  const { call, snapshot } = pilot();
  await addMember(call);
  const member = expectOk(await call('member', 'avatar', 'getMine'));
  expectOk(await call('member', 'inventory', 'claimCosmetic', { itemDefId: 'snowboard_dawn' }));
  expectOk(await call('member', 'avatar', 'updateAppearance', {
    expectedVersion: member.version,
    appearance: { ...member, palette: 'mint', equipped: { ...member.equipped, handheld: 'snowboard_dawn' }, carryHand: 'left' },
  }));
  for (const isAnonymous of [false, true]) {
    const { storyId } = expectOk(await call('owner', 'story', 'publish', {
      input: { ...input, story: { ...input.story, isAnonymous } }, requestId: 'replay-' + isAnonymous,
    }));
    const { eventId } = expectOk(await call('member', 'interaction', 'react', {
      storyId, actionId: 'hug', requestId: 'hug-' + isAnonymous,
    }));
    const params = { storyId, replayEventId: eventId };
    const replayed = expectOk(await call('owner', 'story', 'getDetail', params));
    assert.equal(replayed.author.displayName === '匿名雪友', isAnonymous);
    assert.equal(replayed.avatar.palette, 'blue');
    assert.equal(replayed.replay.actionId, 'hug');
    const actor = replayed.replay.actorAppearance;
    assert.equal(actor.palette, 'mint');
    assert.equal(actor.carryHand, 'left');
    assert.equal(actor.equipped.handheld, 'snowboard_dawn');
    assert.equal(actor.ownerId, undefined);
    assert.equal(expectOk(await call('member', 'story', 'getDetail', params)).replay, undefined);
    assert.equal(expectOk(await call('owner', 'story', 'getDetail', {
      storyId, replayEventId: 'unrelated-event',
    })).replay, undefined);
  }
  const oldState = snapshot();
  const oldAvatar = oldState.avatars.find((avatar) => avatar.id === member.id);
  oldAvatar.equipped.carryHand = oldAvatar.carryHand;
  delete oldAvatar.carryHand;
  const upgraded = pilot(oldState);
  const event = oldState.interactions[0];
  const detail = expectOk(await upgraded.call('owner', 'story', 'getDetail', { storyId: event.storyId, replayEventId: event.id }));
  assert.equal(detail.replay.actorAppearance.carryHand, 'left');
  assert.ok(!('carryHand' in detail.replay.actorAppearance.equipped));
});

test('普通用户先建圈不影响预设试用圈，注销预设圈主后不会自动建回', async () => {
  const { call, snapshot } = pilot();
  const visitorGroup = expectOk(await call('visitor', 'group', 'create', { name: '新练习圈', joinMode: 'open', requestId: 'first' }));
  await Promise.all([call('owner', 'auth', 'ensureUser'), call('owner', 'group', 'listMine')]);
  assert.deepEqual(expectOk(await call('owner', 'group', 'listMine')).map((group) => group.id), [groupId]);
  assert.deepEqual(expectOk(await call('visitor', 'group', 'listMine')).map((group) => group.id), [visitorGroup.id]);
  assert.equal(snapshot().groups.length, 2);
  expectOk(await call('owner', 'auth', 'deleteAccount', { confirm: true }));
  assert.equal((await call('owner', 'auth', 'ensureUser')).code, 'ACCOUNT_DELETED');
  assert.deepEqual(snapshot().groups.map((group) => group.id), [visitorGroup.id]);
});

async function socialCircle() {
  const db = pilot();
  const { call } = db;
  await call('owner', 'auth', 'ensureUser');
  const { token } = expectOk(await call('owner', 'group', 'createInvite', { groupId, maxUses: 10 }));
  const stories = {};
  for (const name of ['owner', 'writer', 'reader']) {
    if (name !== 'owner') {
      const { user } = expectOk(await call(name, 'auth', 'ensureUser'));
      expectOk(await call(name, 'group', 'join', { inviteToken: token }));
      expectOk(await call('owner', 'group', 'reviewMember', { groupId, userId: user.id, approve: true }));
    }
    stories[name] = expectOk(await call(name, 'story', 'publish', { requestId: 'publish',
      input: { ...input, story: { ...input.story, title: name + '的故事' } } })).storyId;
  }
  return { ...db, stories };
}

test('同款及关注按圈过滤，双方确认、退出受众、权利收回和再分享', async () => {
  const { call, stories, snapshot } = await socialCircle();
  const ids = { groupId, storyId: stories.owner, myStoryId: stories.writer, requestId: 'associate' };
  const fetchLinks = async (user) => expectOk(await call(user, 'links', 'list', ids)).links;
  assert.equal((await call('outsider', 'links', 'request', ids)).code, 'NOT_VISIBLE');
  const { id } = expectOk(await call('writer', 'links', 'request', ids));
  assert.equal(expectOk(await call('writer', 'links', 'request', ids)).id, id);
  assert.deepEqual(await fetchLinks('reader'), []);
  assert.equal(expectOk(await call('owner', 'links', 'requests'))[0].id, id);
  assert.equal((await call('writer', 'links', 'decide', { id, decision: 'accept' })).code, 'UNAUTHORIZED');
  expectOk(await call('owner', 'links', 'decide', { id, decision: 'accept' }));
  assert.equal((await fetchLinks('reader'))[0].otherId, stories.writer);
  await call('reader', 'story', 'setFollow', { ...ids, follow: true });
  const version = expectOk(await call('owner', 'story', 'getDetail', ids)).story.version;
  expectOk(await call('owner', 'story', 'appendUpdate', { ...ids, type: 'follow_up', body: '后续记录', expectedVersion: version, requestId: 'new' }));
  assert.equal(expectOk(await call('reader', 'story', 'followedUpdates'))[0].body, '后续记录');
  const hide = expectOk(await call('owner', 'story', 'update', { ...ids, version: version + 1, requestId: 'private',
    input: { ...input, story: { ...input.story, visibility: 'self', visibilityGroupIds: [] } } }));
  assert.deepEqual(expectOk(await call('reader', 'story', 'followedUpdates')), []);
  assert.equal((await call('reader', 'links', 'list', ids)).code, 'NOT_VISIBLE');
  expectOk(await call('owner', 'story', 'update', { ...ids, input, version: hide.version, requestId: 'shareagain' }));
  assert.deepEqual(await fetchLinks('reader'), []);
  assert.equal(snapshot().follows.length, 0);
});

test('评选须作者同意，每奖项一票，支持并列、关闭、退出和徽章去重', async () => {
  const { call, stories, snapshot } = await socialCircle();
  const base = { groupId, award: 'gear_save' };
  const period = expectOk(await call('reader', 'poll', 'list', base)).period;
  const change = (user, storyId, action) => call(user, 'poll', 'change', { ...base, period, storyId, action });
  assert.equal((await change('outsider', stories.owner, 'vote')).code, 'NOT_MEMBER');
  assert.equal((await change('writer', stories.writer, 'nominate')).code, 'UNAUTHORIZED');
  for (const name of ['owner', 'writer']) {
    expectOk(await change('owner', stories[name], 'nominate'));
    assert.equal((await change('reader', stories[name], 'vote')).code, 'NOT_VISIBLE');
    expectOk(await change(name, stories[name], 'accept'));
  }
  const priorPause = process.env.FALLBUDDY_DISABLE_POLLS;
  process.env.FALLBUDDY_DISABLE_POLLS = '1';
  try {
    assert.equal(expectOk(await call('reader', 'poll', 'list', base)).paused, true);
    assert.equal((await change('reader', stories.owner, 'vote')).code, 'INTERACTION_DISABLED');
  } finally {
    if (priorPause === undefined) delete process.env.FALLBUDDY_DISABLE_POLLS;
    else process.env.FALLBUDDY_DISABLE_POLLS = priorPause;
  }
  const race = await Promise.all(['owner', 'writer'].map((name) => change('reader', stories[name], 'vote')));
  assert.deepEqual(race.map((reply) => reply.code).sort(), ['CONFLICT', 'OK']);
  const winner = race[0].ok ? 'owner' : 'writer';
  expectOk(await change('reader', stories[winner], 'vote'));
  expectOk(await change('owner', stories[winner === 'writer' ? 'owner' : 'writer'], 'vote'));
  const list = expectOk(await call('reader', 'poll', 'list', base));
  assert.deepEqual(list.candidates.map((row) => [row.votes, row.rank]), [[1, 1], [1, 1]]);
  assert.equal(expectOk(await call('reader', 'poll', 'myBadge')).earned, true);
  assert.equal(snapshot().pollBadges.length, 2);
  assert.equal((await call('reader', 'poll', 'close', { ...base, period })).code, 'UNAUTHORIZED');
  expectOk(await call('owner', 'poll', 'close', { ...base, period }));
  assert.equal((await change('writer', stories.owner, 'vote')).code, 'VALIDATION_FAILED');
  expectOk(await change('writer', stories.writer, 'withdraw'));
  assert.deepEqual(expectOk(await call('reader', 'poll', 'list', base)).candidates.map((row) => row.id), [stories.owner]);
});

function recording() {
  // 16 kHz 单声道，32 kbps，每帧 36ms。
  const frame = Buffer.alloc(144);
  Buffer.from([0xff, 0xf3, 0x48, 0xc0]).copy(frame);
  return Buffer.concat(Array(420).fill(frame)).toString('base64');
}

test('语音仅在本人同意和限额内执行，取消后丢弃迟到结果，录音及正文不进数据库', async () => {
  let release;
  let started;
  const waiting = new Promise((resolve) => { started = resolve; });
  const voiceProvider = { monthlyLimit: 3, transcribe: async () => {
    started();
    await new Promise((resolve) => { release = resolve; });
    return { text: '口述原文', body: '口述', title: '' };
  } };
  const { call, snapshot } = pilot({}, { voiceProvider });
  for (const user of ['owner', 'visitor']) expectOk(await call(user, 'auth', 'ensureUser'));
  const open = (user, key) => call(user, 'voice', 'open', { requestId: key, consent: true });
  assert.equal((await call('owner', 'voice', 'open', { requestId: 'abc' })).code, 'VALIDATION_FAILED');
  const job = expectOk(await open('owner', 'abc'));
  assert.equal(expectOk(await open('owner', 'abc')).id, job.id);
  const p = { ...job, requestId: 'abc', audio: recording() };
  assert.equal((await call('visitor', 'voice', 'run', p)).code, 'CONFLICT');
  assert.equal((await call('owner', 'voice', 'run', { ...p, audio: 'bad' })).code, 'VALIDATION_FAILED');
  const processing = call('owner', 'voice', 'run', p);
  await waiting;
  assert.equal((await call('owner', 'voice', 'run', p)).code, 'CONFLICT');
  expectOk(await call('owner', 'voice', 'cancel', { requestId: 'abc' }));
  release();
  assert.equal((await processing).code, 'CONFLICT');
  voiceProvider.transcribe = async () => ({ text: '口述原文', body: '口述', title: '' });
  const next = expectOk(await open('owner', 'next'));
  assert.equal(expectOk(await call('owner', 'voice', 'run', { ...p, ...next, requestId: 'next' })).text, '口述原文');
  expectOk(await open('owner', 'third'));
  assert.equal((await open('owner', 'fourth')).code, 'BUDGET_EXCEEDED');
  assert.equal((await open('visitor', 'full')).code, 'BUDGET_EXCEEDED');
  assert.equal(snapshot().stories.length, 0);
  assert.ok(!JSON.stringify(snapshot()).includes('口述原文'));
  assert.ok(!JSON.stringify(snapshot()).includes(p.audio.slice(0, 400)));
  expectOk(await call('visitor', 'story', 'publish', { input: { ...input, story: { ...input.story, visibility: 'self', visibilityGroupIds: [] } }, requestId: 'manual' }));
  const offline = pilot();
  assert.equal(expectOk(await offline.call('owner', 'voice', 'available')).enabled, false);
});

test('真正的语音适配器限定逐字摘录，敏感转写跳过二次整理', async () => {
  const { providerFromEnv } = require(root + 'voice.cjs');
  const provider = providerFromEnv({ FALLBUDDY_VOICE_ENABLED: '1', FALLBUDDY_VOICE_TOKEN: 'test',
    FALLBUDDY_ASR_MODEL: 'asr-test', FALLBUDDY_VOICE_BASE_URL: 'https://speech.invalid/v1',
    FALLBUDDY_VOICE_MONTHLY_LIMIT: '3', FALLBUDDY_DRAFT_MODEL: 'draft-test' });
  const fetchOriginal = globalThis.fetch;
  const calls = [];
  let text = '转弯时左膝着地，当天就回家了。';
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer test');
    const payload = url.endsWith('transcriptions') ? { text } : {
      choices: [{ message: { content: JSON.stringify({ title: '左膝着地', body: '添加了一件原文没有的事。' }) } }],
    };
    return { ok: true, json: async () => payload };
  };
  try {
    const draft = await provider.transcribe(Buffer.from(recording(), 'base64'));
    assert.equal(draft.title, '左膝着地');
    assert.equal(draft.body, text);
    text = '电话是13800138000。';
    const sensitive = await provider.transcribe(Buffer.from(recording(), 'base64'));
    assert.equal(sensitive.title, '');
    assert.equal(calls.filter((url) => url.endsWith('completions')).length, 1);
  } finally { globalThis.fetch = fetchOriginal; }
});
