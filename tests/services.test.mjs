import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mockApi } = require('../build/test/miniprogram/services/mock/api.js');
const { resetState, loadState } = require('../build/test/miniprogram/services/store.js');
const { buildMockState } = require('../build/test/miniprogram/shared/mock-build.js');

function expectOk(res) {
  assert.equal(res.ok, true, JSON.stringify(res));
  return res.data;
}

function expectErr(res, code) {
  assert.equal(res.ok, false, JSON.stringify(res));
  assert.equal(res.code, code, JSON.stringify(res));
}

function myItem(itemDefId) {
  const state = loadState();
  return state.inventory.find((inv) => inv.ownerId === state.currentUserId && inv.itemDefId === itemDefId);
}

test.beforeEach(() => {
  resetState();
});

test('种子数据：6 位雪友、3 个圈子、8 条故事（含 1 条无权限故事）', () => {
  const state = buildMockState();
  assert.equal(state.users.length, 6);
  assert.equal(state.groups.length, 3);
  assert.equal(state.stories.length, 8);
  assert.equal(new Set(state.stories.map((s) => s.id)).size, 8);
  assert.equal(state.stories.find((s) => s.id === 'sty_private').visibilityGroupIds[0], 'grp_private');
});

test('图鉴：非成员无法访问私人圈子', async () => {
  const res = await mockApi.group.getAtlas({ groupId: 'grp_private' });
  expectErr(res, 'NOT_MEMBER');
});

test('故事详情：非成员即使猜到 storyId 也返回 NOT_VISIBLE', async () => {
  const res = await mockApi.story.getDetail({ storyId: 'sty_private' });
  expectErr(res, 'NOT_VISIBLE');
});

test('故事详情：同圈成员可以查看，并带时间线与互动统计', async () => {
  const detail = expectOk(await mockApi.story.getDetail({ storyId: 'sty_tailbone' }));
  assert.equal(detail.group.id, 'grp_snow');
  assert.equal(detail.updates.length, 2);
  assert.ok(detail.reactions.find((r) => r.actionId === 'hug').count >= 3);
  assert.equal(detail.author.displayName, '林小满');
});

test('图鉴：同一部位叠放多位作者，并统计故事数', async () => {
  const atlas = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_snow', view: 'back', period: 'all' }));
  const tailbone = atlas.hotspots.find((h) => h.id === 'tailbone');
  assert.equal(tailbone.count, 2);
  assert.equal(new Set(tailbone.users.map((u) => u.userId)).size, 2);
  assert.equal(atlas.group.memberCount, 5);
  assert.ok(atlas.storyCount >= 5);
});

test('互动：作者关闭搞笑动作时 spin 被拒绝', async () => {
  const res = await mockApi.interaction.react({ storyId: 'sty_knee', actionId: 'spin', requestId: 'req_spin_1' });
  expectErr(res, 'INTERACTION_DISABLED');
  const hug = await mockApi.interaction.react({ storyId: 'sty_knee', actionId: 'hug', requestId: 'req_hug_ok' });
  expectOk(hug);
});

test('互动：同一动作每天最多 3 次', async () => {
  for (let i = 0; i < 3; i += 1) {
    const res = await mockApi.interaction.react({ storyId: 'sty_tailbone', actionId: 'cheer', requestId: `req_cheer_${i}` });
    expectOk(res);
  }
  const fourth = await mockApi.interaction.react({ storyId: 'sty_tailbone', actionId: 'cheer', requestId: 'req_cheer_3' });
  expectErr(fourth, 'RATE_LIMIT');
});

test('互动：同一个 requestId 重试只产生一条事件', async () => {
  const first = expectOk(await mockApi.interaction.react({ storyId: 'sty_head', actionId: 'hug', requestId: 'req_same' }));
  const second = expectOk(await mockApi.interaction.react({ storyId: 'sty_head', actionId: 'hug', requestId: 'req_same' }));
  assert.equal(first.eventId, second.eventId);
  const state = loadState();
  assert.equal(
    state.interactions.filter((e) => e.storyId === 'sty_head' && e.actorId === state.currentUserId && e.actionId === 'hug').length,
    2,
  ); // 种子里已经有一条，本次只加一条
});

test('赠礼：requestId 幂等，库存只转移一次', async () => {
  const before = myItem('comfort_patch').quantity;
  const first = expectOk(
    await mockApi.inventory.gift({
      toUserId: 'usr_lin',
      storyId: 'sty_tailbone',
      itemDefId: 'comfort_patch',
      requestId: 'req_gift_same',
    }),
  );
  const second = expectOk(
    await mockApi.inventory.gift({
      toUserId: 'usr_lin',
      storyId: 'sty_tailbone',
      itemDefId: 'comfort_patch',
      requestId: 'req_gift_same',
    }),
  );
  assert.equal(first.eventId, second.eventId);
  assert.equal(myItem('comfort_patch').quantity, before - 1);
});

test('赠礼：库存不足时拒绝，且不扣库存', async () => {
  const before = myItem('comfort_patch').quantity;
  expectOk(
    await mockApi.inventory.gift({
      toUserId: 'usr_lin',
      storyId: 'sty_tailbone',
      itemDefId: 'comfort_patch',
      requestId: 'req_gift_a',
    }),
  );
  assert.equal(myItem('comfort_patch').quantity, before - 1);
  const res = await mockApi.inventory.gift({
    toUserId: 'usr_lin',
    storyId: 'sty_tailbone',
    itemDefId: 'comfort_patch',
    requestId: 'req_gift_b',
  });
  expectErr(res, 'INVENTORY_INSUFFICIENT');
  assert.equal(myItem('comfort_patch').quantity, before - 1);
});

test('赠礼：不能送给非故事作者或不可转让道具', async () => {
  expectErr(
    await mockApi.inventory.gift({
      toUserId: 'usr_yu',
      storyId: 'sty_tailbone',
      itemDefId: 'hot_cocoa',
      requestId: 'req_gift_wrong_target',
    }),
    'VALIDATION_FAILED',
  );
  expectErr(
    await mockApi.inventory.gift({
      toUserId: 'usr_lin',
      storyId: 'sty_tailbone',
      itemDefId: 'ski_blue',
      requestId: 'req_gift_cosmetic',
    }),
    'VALIDATION_FAILED',
  );
});

test('周补给：同一周重复领取不会重复发放', async () => {
  const before = myItem('hot_cocoa').quantity;
  const first = expectOk(await mockApi.inventory.claimWeekly({ requestId: 'req_weekly_1' }));
  assert.equal(first.alreadyGranted, false);
  assert.equal(first.items.length, 2);
  const quantities = Object.fromEntries(
    first.items.map((item) => [item.itemDefId, myItem(item.itemDefId).quantity]),
  );
  const second = expectOk(await mockApi.inventory.claimWeekly({ requestId: 'req_weekly_2' }));
  assert.equal(second.alreadyGranted, true);
  for (const [itemDefId, quantity] of Object.entries(quantities)) {
    assert.equal(myItem(itemDefId).quantity, quantity);
  }
  assert.ok(typeof before === 'number');
});

test('故事发布：进入图鉴统计，撤回后移除', async () => {
  const atlasBefore = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_snow', period: 'all' }));
  const tailboneBefore = atlasBefore.hotspots.find((h) => h.id === 'tailbone').count;

  const published = expectOk(
    await mockApi.story.publish({
      requestId: 'req_pub_1',
      input: {
        incident: {
          sport: 'ski_double',
          scenario: ['turning'],
          selfReportedCause: ['edge_catch'],
          bodyParts: ['tailbone'],
          impactKind: 'near_miss',
          protectiveItems: ['hip_protector'],
          userSummary: '测试',
        },
        story: {
          title: '我的测试故事',
          body: '今天练习换刃，护臀又一次救了尾椎。',
          tone: 'humorous',
          visibilityGroupIds: ['grp_snow'],
          allowFunnyActions: true,
          allowGifts: true,
          isAnonymous: false,
        },
      },
    }),
  );

  const atlasAfter = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_snow', period: 'all' }));
  const tailboneAfter = atlasAfter.hotspots.find((h) => h.id === 'tailbone').count;
  assert.equal(tailboneAfter, tailboneBefore + 1);
  assert.ok(atlasAfter.stories.some((s) => s.id === published.storyId));

  expectOk(await mockApi.story.withdraw({ storyId: published.storyId }));
  const atlasFinal = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_snow', period: 'all' }));
  assert.equal(atlasFinal.hotspots.find((h) => h.id === 'tailbone').count, tailboneBefore);
  assert.ok(!atlasFinal.stories.some((s) => s.id === published.storyId));
});

test('故事发布：标题过长、含手机号会被拒绝', async () => {
  const base = {
    incident: {
      sport: 'ski_double',
      scenario: ['turning'],
      selfReportedCause: ['edge_catch'],
      bodyParts: ['tailbone'],
      impactKind: 'near_miss',
      protectiveItems: [],
    },
    story: {
      title: '这个标题故意写得非常非常长超过二十四个字看看会不会被服务端拒绝掉',
      body: '正常正文。',
      tone: 'humorous',
      visibilityGroupIds: ['grp_snow'],
      allowFunnyActions: true,
      allowGifts: true,
      isAnonymous: false,
    },
  };
  expectErr(await mockApi.story.publish({ requestId: 'req_bad_title', input: base }), 'VALIDATION_FAILED');

  const withPhone = {
    ...base,
    story: { ...base.story, title: '正常标题', body: '有事打我电话 13800138000。' },
  };
  expectErr(await mockApi.story.publish({ requestId: 'req_phone', input: withPhone }), 'CONTENT_REJECTED');
});

test('匿名展示：图鉴与故事卡片不暴露作者昵称', async () => {
  const detail = expectOk(await mockApi.story.getDetail({ storyId: 'sty_back' }));
  assert.equal(detail.author.displayName, '匿名雪友');
  const atlas = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_skate', period: 'all', view: 'back' }));
  const card = atlas.stories.find((s) => s.id === 'sty_back');
  assert.equal(card.authorName, '匿名雪友');
  const chip = atlas.hotspots.find((h) => h.id === 'back').users[0];
  assert.equal(chip.displayName, '匿名雪友');
});

test('角色：版本号乐观锁冲突；未拥有的装备不能穿', async () => {
  const avatar = expectOk(await mockApi.avatar.getMine());
  const startVersion = avatar.version;
  const appearance = {
    palette: 'orange',
    expression: 'cool',
    equipped: {
      headgear: 'helmet_red',
      goggles: 'snow_goggles',
      outfit: 'suit_orange',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
  };
  const updated = expectOk(
    await mockApi.avatar.updateAppearance({ appearance, expectedVersion: avatar.version }),
  );
  assert.equal(updated.avatar.version, startVersion + 1);
  expectErr(
    await mockApi.avatar.updateAppearance({ appearance, expectedVersion: startVersion }),
    'CONFLICT',
  );
  const fake = {
    ...appearance,
    equipped: { ...appearance.equipped, headgear: 'golden_crown' },
  };
  expectErr(
    await mockApi.avatar.updateAppearance({ appearance: fake, expectedVersion: updated.avatar.version }),
    'VALIDATION_FAILED',
  );
});

test('收件箱：只看到发给我的互动，可以标记已读', async () => {
  const inbox = expectOk(await mockApi.interaction.getInbox({ limit: 20 }));
  assert.equal(inbox.unreadCount, 3);
  const ids = inbox.events.map((e) => e.id);
  const res = expectOk(await mockApi.interaction.markRead({ eventIds: ids }));
  assert.equal(res.updatedCount, 3);
  const after = expectOk(await mockApi.interaction.getInbox({ limit: 20 }));
  assert.equal(after.unreadCount, 0);
});

test('设置：关闭搞笑互动会同步到角色隐私', async () => {
  const prefs = expectOk(await mockApi.settings.update({ preferences: { allowFunnyActions: false } }));
  assert.equal(prefs.allowFunnyActions, false);
  const avatar = expectOk(await mockApi.avatar.getMine());
  assert.equal(avatar.privacy.allowFunnyActions, false);
});

test('邀请：非圈主不能创建邀请，圈主可以，过期/无效 token 拒绝加入', async () => {
  expectErr(await mockApi.group.createInvite({ groupId: 'grp_snow' }), 'UNAUTHORIZED');
  const invite = expectOk(await mockApi.group.createInvite({ groupId: 'grp_skate' }));
  assert.ok(invite.sharePath.includes('inviteToken='));
  expectErr(await mockApi.group.join({ inviteToken: 'inv_not_exists' }), 'NOT_FOUND');
});
