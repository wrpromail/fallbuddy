import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = '../build/test/miniprogram/';
const { mockApi: api } = require(root + 'services/mock/api.js');
const { resetState, loadState } = require(root + 'services/store.js');
function data(res) { assert.equal(res.code, 'OK', JSON.stringify(res)); return res.data; }
const tap = (dataset) => ({ currentTarget: { dataset } });

function page(route) {
  let def;
  globalThis.Page = (definition) => { def = definition; };
  try { require(root + 'pages/' + route + '.js'); } finally { delete globalThis.Page; }
  return { ...def, data: structuredClone(def.data), setData(patch) { Object.assign(this.data, patch); } };
}

test('穿搭收藏只存自己已保存的形象，覆盖冲突保留最新，试穿和随机搭配可取消', async () => {
  resetState();
  const avatar = page('avatar/index');
  await avatar.load();
  const original = avatar.data.avatar;
  const args = { slot: 1, slotVersion: 0, avatarVersion: original.version };
  await avatar.onStoreOutfit(tap({ slot: 1 }));
  assert.equal((await api.avatar.saveOutfit(args)).code, 'CONFLICT');
  avatar.onTryOutfit(tap({ slot: 1 }));
  assert.deepEqual(avatar.data.draft.equipped, original.equipped);
  for (let i = 0; i < 12; i++) {
    avatar.onRandomOutfit();
    assert.ok(Object.values(avatar.data.draft.equipped).every((id) => !id || avatar.data.ownedIds.includes(id)));
  }
  avatar.onCancel();
  assert.deepEqual(avatar.data.preview, original);
  await avatar.onStoreOutfit(tap({ slot: 1, clear: 'yes' }));
  assert.equal(data(await api.avatar.listOutfits())[0].appearance, null);
  loadState().currentUserId = 'usr_lin';
  assert.equal(data(await api.avatar.listOutfits())[0].version, 0);
});

test('有效的互动护臀可穿戴，消耗幂等，过期后退出显示且不可再穿', async () => {
  resetState();
  const avatar = data(await api.avatar.getMine());
  const item = data(await api.inventory.getMine()).find((row) => row.itemDefId === 'steel_hip_guard');
  const appearance = { ...avatar, equipped: { ...avatar.equipped, hip_protector: item.itemDefId } };
  data(await api.avatar.updateAppearance({ expectedVersion: avatar.version, appearance }));
  const use = { itemDefId: item.itemDefId, version: item.version, requestId: 'consume-guard' };
  data(await api.inventory.consume(use));
  data(await api.inventory.consume(use));
  assert.equal(loadState().ledger.filter((row) => row.operationId === 'consume_consume-guard').length, 1);
  const stored = loadState().inventory.find((row) => row.id === item.id);
  assert.equal(stored.quantity, item.quantity - 1);
  stored.quantity = 1;
  stored.expiresAt = '2000-01-01T00:00:00Z';
  assert.equal(data(await api.avatar.getMine()).equipped.hip_protector, null);
  assert.ok(!data(await api.inventory.getMine()).some((row) => row.id === item.id));
  assert.equal((await api.avatar.updateAppearance({ expectedVersion: data(await api.avatar.getMine()).version, appearance })).code, 'VALIDATION_FAILED');
  assert.equal((await api.inventory.consume({ ...use, requestId: 'expired' })).code, 'INVENTORY_INSUFFICIENT');
});

test('圈友关闭形象展示后成员列表及详情采用基础形象，本人仍可编辑真实角色', async () => {
  resetState();
  loadState().currentUserId = 'usr_ma';
  const original = data(await api.avatar.getMine());
  data(await api.settings.update({ preferences: { hideAvatar: true } }));
  assert.deepEqual(data(await api.avatar.getMine()).equipped, original.equipped);
  loadState().currentUserId = 'usr_me';
  const shown = data(await api.story.getDetail({ storyId: 'sty_back' })).avatar;
  const member = data(await api.group.getMembers('grp_skate')).find((row) => row.userId === 'usr_ma');
  assert.ok(Object.values(shown.equipped).every((value) => value === null));
  assert.deepEqual(member.equipped, shown.equipped);
});

test('口述须经本人采用，标签逐项确认，解剖提示保留左右侧别', async () => {
  resetState();
  const form = page('incident/create');
  await form.load(false);
  const before = loadState().stories.length;
  form.onVoiceDraft({ detail: { body: '转弯时左膝先着地，当时没有戴护膝。', title: '转弯时', assisted: true } });
  assert.equal(form.data.suggestedTags.length, 3);
  assert.deepEqual(form.data.protectiveItems, []);
  form.onConfirmTag(tap({ kind: 'bodyParts', id: 'knee_l' }));
  assert.deepEqual(form.formInput().incident.bodyParts, ['knee_l']);
  assert.equal(form.formInput().incident.source, 'ai_assisted');
  assert.equal(loadState().stories.length, before);
  const { landmarkLabels } = require(root + 'shared/anatomy-landmarks.js');
  assert.match(landmarkLabels(['knee_l'], 'bones')[0], /左膝.*髌骨/);
  assert.match(landmarkLabels(['tailbone'], 'muscles')[0], /深面/);
});

test('旧详情里的私密后续不会跟随另一台设备自动公开，作者须重新提交', async () => {
  resetState();
  const id = 'sty_me_seat';
  const state = loadState();
  const story = state.stories.find((row) => row.id === id);
  story.visibility = 'self'; story.visibilityGroupIds = [];
  const detail = page('story/detail');
  detail.onLoad({ storyId: id });
  await detail.load();
  detail.onComposeUpdate();
  detail.onUpdateBody({ detail: { value: '这段原本写给自己' } });
  const source = data(await api.story.getDetail({ storyId: id }));
  data(await api.story.update({ storyId: id, version: source.story.version, requestId: 'expand',
    input: { incident: source.incident, story: { ...source.story, visibility: 'groups', visibilityGroupIds: ['grp_snow'] } } }));
  const initial = loadState().storyUpdates.length;
  globalThis.wx = { showToast() {} };
  try {
    await detail.onSaveUpdate();
    assert.equal(detail.data.updateBody, '这段原本写给自己');
    assert.match(detail.data.groupName, /周末雪场/);
    assert.equal(loadState().storyUpdates.length, initial);
    await detail.onSaveUpdate();
    assert.equal(loadState().storyUpdates.length, initial + 1);
  } finally { delete globalThis.wx; }
});

test('从圈子评选页发起提名并同意，成员可以投票；同款申请可在详情入口处理', async () => {
  resetState();
  loadState().currentUserId = 'usr_lin';
  const poll = page('poll/index');
  poll.onLoad({ groupId: 'grp_snow' });
  await poll.load();
  assert.ok(poll.data.owner);
  await poll.change('sty_tailbone', 'nominate');
  assert.equal(poll.data.candidates[0].pending, true);
  await poll.change('sty_tailbone', 'accept');
  loadState().currentUserId = 'usr_me';
  await poll.load();
  await poll.change('sty_tailbone', 'vote');
  assert.equal(poll.data.candidates[0].votes, 1);

  const links = page('links/index');
  links.onLoad({ groupId: 'grp_snow', storyId: 'sty_tailbone' });
  await links.load();
  const i = links.data.choices.findIndex((row) => row.id === 'sty_me_seat');
  assert.ok(i >= 0);
  globalThis.wx = { showToast() {} };
  try {
    await links.onChoose({ detail: { value: i } });
    loadState().currentUserId = 'usr_lin';
    await links.load();
    const [request] = links.data.links;
    assert.ok(request.canReview);
    await links.onDecide(tap({ id: request.id, decision: 'accept' }));
    assert.equal(links.data.links[0].status, 'accepted');
    await links.onDecide(tap({ id: request.id, decision: 'revoke' }));
    assert.deepEqual(links.data.links, []);
  } finally { delete globalThis.wx; }
});

test('原生口述组件可在离线时录制、回听、采用文字和清理临时文件', async () => {
  let def, stopped, played = false;
  let recording = false;
  const removed = [], events = [];
  globalThis.Component = (d) => { def = d; };
  require(root + 'components/voice-draft/index.js');
  delete globalThis.Component;
  const component = { ...def.methods, data: structuredClone(def.data),
    setData(patch) { Object.assign(this.data, patch); }, triggerEvent(name, value) { events.push({ name, value }); } };
  globalThis.wx = {
    getRecorderManager: () => ({
      onStop(fn) { stopped = fn; }, onError() {},
      start(opts) { recording = opts.format === 'mp3'; }, stop() { stopped({ tempFilePath: 'temp.mp3', duration: 18000, fileSize: 72000 }); },
    }),
    authorize({ success }) { success(); }, getFileSystemManager: () => ({ unlink: ({ filePath }) => removed.push(filePath) }),
    createInnerAudioContext: () => ({ play() { played = true; }, destroy() {} }),
  };
  try {
    def.lifetimes.created.call(component);
    await component.onOpen();
    assert.equal(component.data.available, false);
    component.onRecord();
    assert.equal(recording, true);
    component.onStop();
    assert.equal(component.data.hasFile, true);
    component.onPlay();
    assert.equal(played, true);
    component.onText({ detail: { value: '转弯时左膝着地' } });
    component.onApply();
    assert.equal(events[0].value.assisted, false);
    assert.equal(events[0].value.body, '转弯时左膝着地');
    assert.deepEqual(removed, ['temp.mp3']);
    assert.equal(component.data.open, false);
    def.lifetimes.detached.call(component);
  } finally { delete globalThis.wx; }
});
