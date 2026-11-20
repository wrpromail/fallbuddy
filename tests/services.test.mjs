import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mockApi } = require('../build/test/miniprogram/services/mock/api.js');
const { resetState, loadState, saveState } = require('../build/test/miniprogram/services/store.js');
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

/** 临时切换当前用户，用于测试“非作者/非成员”视角；结束后恢复 */
async function asUser(userId, fn) {
  const state = loadState();
  const previous = state.currentUserId;
  state.currentUserId = userId;
  saveState(state);
  try {
    return await fn();
  } finally {
    const restored = loadState();
    restored.currentUserId = previous;
    saveState(restored);
  }
}

function publishInput(overrides = {}) {
  return {
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
      visibility: 'groups',
      visibilityGroupIds: ['grp_snow'],
      allowFunnyActions: true,
      allowGifts: true,
      isAnonymous: false,
      ...overrides,
    },
  };
}

/** 与 publishInput 同底，但允许覆盖 incident 字段（用于枚举校验用例） */
function publishEnumInput(incidentOverrides = {}, storyOverrides = {}) {
  const base = publishInput();
  return {
    incident: { ...base.incident, ...incidentOverrides },
    story: { ...base.story, ...storyOverrides },
  };
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

test('匿名故事：客户端拿不到真实作者 ID / 头像 ID', async () => {
  const detail = expectOk(await mockApi.story.getDetail({ storyId: 'sty_back' }));
  assert.equal(detail.author.displayName, '匿名雪友');
  assert.equal(detail.author.id, 'anon_sty_back');
  assert.equal(detail.story.authorId, 'anon_sty_back');
  assert.equal(detail.incident.authorId, 'anon_sty_back');
  assert.equal(detail.avatar.ownerId, 'anon_sty_back');
  assert.equal(detail.avatar.id, 'avt_anon_sty_back');
  assert.equal(detail.viewerIsAuthor, false);
  const payload = JSON.stringify(detail);
  assert.ok(!payload.includes('usr_ma'), payload);
  assert.ok(!payload.includes('avt_usr_ma'), payload);

  const atlas = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_skate', period: 'all', view: 'back' }));
  const card = atlas.stories.find((story) => story.id === 'sty_back');
  assert.equal(card.authorId, 'anon_sty_back');
  const chip = atlas.hotspots.find((spot) => spot.id === 'back').users[0];
  assert.equal(chip.userId, 'anon_sty_back');
});

test('匿名故事：作者本人仍可识别并撤回', async () => {
  await asUser('usr_ma', async () => {
    const detail = expectOk(await mockApi.story.getDetail({ storyId: 'sty_back' }));
    assert.equal(detail.viewerIsAuthor, true);
    assert.equal(detail.author.isMe, true);
    const withdrawn = expectOk(await mockApi.story.withdraw({ storyId: 'sty_back' }));
    assert.equal(withdrawn.status, 'withdrawn');
  });
});

test('赠礼：不传 toUserId 时由服务端解析真实作者', async () => {
  const before = loadState().inventory.find((inv) => inv.ownerId === 'usr_ma' && inv.itemDefId === 'hot_cocoa')?.quantity ?? 0;
  const res = expectOk(
    await mockApi.inventory.gift({
      storyId: 'sty_back',
      itemDefId: 'hot_cocoa',
      requestId: 'req_gift_anon',
    }),
  );
  assert.equal(res.toUserId, 'anon_sty_back');
  const after = loadState().inventory.find((inv) => inv.ownerId === 'usr_ma' && inv.itemDefId === 'hot_cocoa')?.quantity ?? 0;
  assert.equal(after, before + 1);
});

test('仅自己可见：发布后不进图鉴，作者可读，他人 NOT_VISIBLE', async () => {
  const published = expectOk(
    await mockApi.story.publish({
      requestId: 'req_self_only',
      input: publishInput({ visibility: 'self', visibilityGroupIds: ['grp_snow'] }),
    }),
  );
  const story = loadState().stories.find((item) => item.id === published.storyId);
  assert.equal(story.visibility, 'self');
  assert.deepEqual(story.visibilityGroupIds, []);

  const atlas = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_snow', period: 'all' }));
  assert.ok(!atlas.stories.some((item) => item.id === published.storyId));

  const detail = expectOk(await mockApi.story.getDetail({ storyId: published.storyId }));
  assert.equal(detail.story.visibility, 'self');
  assert.equal(detail.group, null);
  assert.equal(detail.canInteract, false);

  await asUser('usr_lin', async () => {
    expectErr(await mockApi.story.getDetail({ storyId: published.storyId }), 'NOT_VISIBLE');
  });

  const mine = expectOk(await mockApi.story.listMine());
  assert.equal(mine.find((item) => item.id === published.storyId).visibility, 'self');
  expectOk(await mockApi.story.withdraw({ storyId: published.storyId }));
});

test('仅自己可见：普通发布仍要求至少一个圈子', async () => {
  expectErr(
    await mockApi.story.publish({
      requestId: 'req_no_visibility',
      input: publishInput({ visibility: 'groups', visibilityGroupIds: [] }),
    }),
    'VALIDATION_FAILED',
  );
});

test('互动：抱抱/转圈/鼓掌合计每天最多 3 次', async () => {
  expectOk(await mockApi.interaction.react({ storyId: 'sty_tailbone', actionId: 'hug', requestId: 'req_mix_1' }));
  expectOk(await mockApi.interaction.react({ storyId: 'sty_tailbone', actionId: 'hug', requestId: 'req_mix_2' }));
  expectOk(await mockApi.interaction.react({ storyId: 'sty_tailbone', actionId: 'cheer', requestId: 'req_mix_3' }));
  expectErr(
    await mockApi.interaction.react({ storyId: 'sty_tailbone', actionId: 'spin', requestId: 'req_mix_4' }),
    'RATE_LIMIT',
  );
});

test('图鉴：热点状态贴纸按最新故事生成，空热点为空', async () => {
  const atlas = expectOk(await mockApi.group.getAtlas({ groupId: 'grp_snow', period: 'all', view: 'back' }));
  const tailbone = atlas.hotspots.find((spot) => spot.id === 'tailbone');
  assert.equal(tailbone.sticker, '💨');
  const ankle = atlas.hotspots.find((spot) => spot.id === 'ankle_l');
  assert.equal(ankle.count, 0);
  assert.equal(ankle.sticker, '');
});

test('发布校验：服务端拒绝未知枚举值、重复项与非法类型', async () => {
  const before = loadState().stories.length;
  const badInputs = [
    publishEnumInput({ sport: 'ski_triple' }),
    publishEnumInput({ scenario: ['freefall'] }),
    publishEnumInput({ scenario: ['turning', 'turning'] }),
    publishEnumInput({ selfReportedCause: ['gravity'] }),
    publishEnumInput({ bodyParts: ['left_pinky'] }),
    publishEnumInput({ bodyParts: ['tailbone', 'tailbone'] }),
    publishEnumInput({ bodyParts: ['tailbone', 'back', 'waist', 'head'] }),
    publishEnumInput({ impactKind: 'broken_bone' }),
    publishEnumInput({ protectiveItems: ['helmet', 'cape'] }),
    publishEnumInput({}, { tone: 'sarcastic' }),
    publishEnumInput({}, { visibility: 'public' }),
    publishEnumInput({}, { allowFunnyActions: 'false' }),
  ];
  for (let i = 0; i < badInputs.length; i += 1) {
    expectErr(
      await mockApi.story.publish({ requestId: `req_enum_${i}`, input: badInputs[i] }),
      'VALIDATION_FAILED',
    );
  }
  // 被拒绝的发布不写入任何数据
  assert.equal(loadState().stories.length, before);
  assert.equal(loadState().incidents.length, 8);

  // 合法输入仍然成功，确认校验器没有误伤正常发布
  expectOk(await mockApi.story.publish({ requestId: 'req_enum_ok', input: publishEnumInput() }));
  assert.equal(loadState().stories.length, before + 1);
});

test('收件箱：全部已读覆盖未加载的分页事件', async () => {
  // 白盒构造 25 条未读（超过一页 20 条），验证「全部已读」不能只标记客户端已加载的列表
  const state = loadState();
  for (let i = 0; i < 25; i += 1) {
    const event = {
      id: `evt_page_${i}`,
      storyId: 'sty_tailbone',
      actorId: 'usr_lin',
      targetId: state.currentUserId,
      actionId: 'hug',
      animationVersion: 1,
      status: 'ok',
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
    };
    state.interactions.push(event);
    state.notifications.push({
      id: `ntf_evt_page_${i}`,
      targetId: state.currentUserId,
      eventId: event.id,
      kind: 'interaction',
      readAt: null,
      createdAt: event.createdAt,
    });
  }
  saveState(state);

  const inbox = expectOk(await mockApi.interaction.getInbox({ limit: 20 }));
  assert.equal(inbox.events.length, 20);
  assert.ok(inbox.nextCursor);
  assert.equal(inbox.unreadCount, 28); // 种子 3 条 + 新增 25 条

  const res = expectOk(await mockApi.interaction.markRead({ all: true }));
  assert.equal(res.updatedCount, 28);
  const after = expectOk(await mockApi.interaction.getInbox({ limit: 20 }));
  assert.equal(after.unreadCount, 0);

  // 空参数仍然被拒绝
  expectErr(await mockApi.interaction.markRead({}), 'VALIDATION_FAILED');
});

test('事故闭环：续写私人草稿、幂等发布、纠正侧别、追加后续、改为私人', async () => {
  const groupId = 'grp_snow';
  const draftInput = publishEnumInput({ bodyParts: ['knee_l'], scenario: [], selfReportedCause: [] }, {
    title: '', body: '', visibilityGroupIds: [],
  });
  const draft = expectOk(await mockApi.story.saveDraft({ input: draftInput, version: 0 }));
  await asUser('usr_lin', async () => {
    assert.equal(expectOk(await mockApi.story.getDraft()), null);
  });
  const resumed = expectOk(await mockApi.story.getDraft());
  assert.deepEqual(resumed.input, draftInput);

  const before = expectOk(await mockApi.group.getAtlas({ groupId })).storyCount;
  const input = publishEnumInput({ bodyParts: ['knee_l'], happenedOn: '2026-01-12', userSummary: '左膝先落地' });
  const submitted = { input, requestId: 'req_incident_flow', draftVersion: draft.version };
  const [first, retry] = await Promise.all([mockApi.story.publish(submitted), mockApi.story.publish(submitted)]);
  const { storyId, version } = expectOk(first);
  assert.deepEqual(expectOk(retry), { storyId, version });
  assert.equal(expectOk(await mockApi.story.getDraft()), null);
  const original = expectOk(await mockApi.story.getDetail({ storyId }));
  assert.equal(original.incident.happenedOn, '2026-01-12');
  assert.equal(original.incident.userSummary, '左膝先落地');
  await asUser('usr_lin', async () => {
    expectOk(await mockApi.interaction.react({ storyId, actionId: 'hug', requestId: 'req_incident_hug' }));
    expectErr(await mockApi.story.update({ storyId, version, input, requestId: 'req_forged_edit' }), 'UNAUTHORIZED');
  });

  const corrected = publishEnumInput({ ...input.incident, bodyParts: ['knee_r'], userSummary: '右膝先落地' });
  const edit = { storyId, version, input: corrected, requestId: 'req_incident_correct' };
  const revision = expectOk(await mockApi.story.update(edit));
  assert.deepEqual(expectOk(await mockApi.story.update(edit)), revision);
  expectErr(await mockApi.story.update({ ...edit, requestId: 'req_stale_incident' }), 'CONFLICT');
  for (const view of ['front', 'back']) {
    const atlas = expectOk(await mockApi.group.getAtlas({ groupId, view }));
    assert.equal(atlas.storyCount, before + 1);
    assert.ok(!atlas.hotspots.find((spot) => spot.id === 'knee_l').storyIds.includes(storyId));
    assert.ok(atlas.hotspots.find((spot) => spot.id === 'knee_r').storyIds.includes(storyId));
  }

  const followUp = { storyId, type: 'return_to_sport', body: '一周后重新上雪。', requestId: 'req_incident_followup' };
  const update = expectOk(await mockApi.story.appendUpdate(followUp));
  assert.equal(expectOk(await mockApi.story.appendUpdate(followUp)).id, update.id);
  await asUser('usr_lin', async () => {
    const detail = expectOk(await mockApi.story.getDetail({ storyId, groupId }));
    assert.equal(detail.incident.id, original.incident.id);
    assert.equal(detail.reactions.find((reaction) => reaction.actionId === 'hug').count, 1);
    assert.equal(detail.updates.length, 1);
    assert.equal(detail.updates[0].body, followUp.body);
    expectErr(await mockApi.story.withdrawUpdate({ storyId, updateId: update.id }), 'UNAUTHORIZED');
  });
  expectOk(await mockApi.story.update({
    ...edit,
    version: revision.version,
    input: { ...corrected, story: { ...corrected.story, visibility: 'self' } },
    requestId: 'req_incident_private',
  }));
  await asUser('usr_lin', async () => {
    expectErr(await mockApi.story.getDetail({ storyId, groupId }), 'NOT_VISIBLE');
    assert.equal(expectOk(await mockApi.group.getAtlas({ groupId })).storyCount, before);
  });
  expectOk(await mockApi.story.withdrawUpdate({ storyId, updateId: update.id }));
  assert.deepEqual(expectOk(await mockApi.story.getDetail({ storyId })).updates, []);
});

test('事故表单校验日期与隐私字段，旧草稿版本无法消费新草稿', async () => {
  const input = publishInput();
  const draft = expectOk(await mockApi.story.saveDraft({ input, version: 0 }));
  const second = expectOk(await mockApi.story.saveDraft({ input, version: draft.version }));
  expectErr(await mockApi.story.publish({ input, draftVersion: draft.version, requestId: 'req_old_draft' }), 'CONFLICT');
  assert.equal(expectOk(await mockApi.story.getDraft()).version, second.version);
  expectErr(await mockApi.story.publish({
    input: publishEnumInput({ happenedOn: '2026-02-31' }), requestId: 'req_bad_date',
  }), 'VALIDATION_FAILED');
  expectErr(await mockApi.story.publish({
    input: publishEnumInput({ userSummary: '手机号 13800138000' }), requestId: 'req_sensitive_summary',
  }), 'CONTENT_REJECTED');
});
