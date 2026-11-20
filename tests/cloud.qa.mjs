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

function pilot() {
  let snapshot = {
    schemaVersion: 1, seededAt: new Date().toISOString(), users: [], avatars: [], groups: [],
    memberships: [], incidents: [], stories: [], storyUpdates: [], inventory: [], ledger: [],
    interactions: [], notifications: [], weeklyGrants: [], invites: [], operations: {},
  };
  let transactions = Promise.resolve();
  const db = {
    runTransaction(action) {
      const next = transactions.then(async () => {
        let pending;
        await action({
          collection(name) {
            assert.equal(name, 'fallbuddy_server_state');
            return {
              doc(id) {
                assert.equal(id, 'pilot-v1');
                return {
                  async get() { return { data: { snapshot: JSON.stringify(snapshot) } }; },
                  async update({ data }) { pending = JSON.parse(data.snapshot); },
                };
              },
            };
          },
        });
        if (pending) snapshot = pending;
        // The SDK resolves with no callback result.
      });
      transactions = next.catch(() => {});
      return next;
    },
  };
  const handle = createHandler({
    api, store,
    appId: 'wx_test',
    ownerOpenId: 'owner',
    checkText: async (text) => !text.includes('拦截词'),
    transaction: cloudTransaction(db),
  });
  const call = (openid, domain, method, ...args) => handle({ domain, method, args }, { APPID: 'wx_test', OPENID: openid });
  return { handle, call, snapshot: () => snapshot };
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
