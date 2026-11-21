import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mockApi } = require('../build/test/miniprogram/services/mock/api.js');
const { resetState, loadState } = require('../build/test/miniprogram/services/store.js');
const { ANONYMOUS_APPEARANCE, ensureAvatar } = require('../build/test/miniprogram/shared/avatar.js');
const { resolveRigLayers } = require('../build/test/miniprogram/shared/rig.js');

function checked(result) {
  assert.equal(result.code, 'OK', JSON.stringify(result));
  return result.data;
}

test('旧角色合并字段与首发装备，保留既有穿搭，初始化可重试', () => {
  const state = resetState();
  const user = state.users.find((item) => item.id === state.currentUserId);
  const avatar = state.avatars.find((item) => item.ownerId === user.id);
  delete avatar.headShape;
  delete avatar.customized;
  delete avatar.equipped.hip_protector;
  avatar.equipped.hipProtector = 'basic_hip_protector';
  avatar.equipped.outfit = 'suit_orange';
  avatar.version = 3;
  state.inventory = state.inventory.filter((item) => item.ownerId !== user.id);
  const now = new Date().toISOString();
  assert.equal(ensureAvatar(state, user, now), true);
  assert.equal(avatar.equipped.hip_protector, 'basic_hip_protector');
  assert.ok(!('hipProtector' in avatar.equipped));
  assert.equal(avatar.equipped.outfit, 'suit_orange');
  assert.equal(avatar.customized, true);
  assert.deepEqual(state.inventory.filter((item) => item.ownerId === user.id).map((item) => item.itemDefId).sort(),
    ['basic_hip_protector', 'ski_blue']);
  assert.equal(ensureAvatar(state, user, now), false);
});

test('两个头型和四种色调分别绘制，鞋靴和叠戴配件在正背面有正确图层', () => {
  const base = { palette: 'blue', headShape: 'round', expression: 'cool',
    equipped: { headgear: 'helmet_red', goggles: 'snow_goggles', outfit: 'suit_orange',
      hip_protector: 'basic_hip_protector', boots: 'snow_boots' } };
  for (const view of ['front', 'back']) {
    const all = new Set();
    for (const palette of ['blue', 'orange', 'purple', 'mint']) {
      for (const headShape of ['round', 'soft_square']) {
        const layers = resolveRigLayers(view, { ...base, palette, headShape });
        const byId = Object.fromEntries(layers.map((layer) => [layer.id, layer]));
        all.add(byId.head.src);
        assert.match(byId.body.src, new RegExp(palette + '\\.png$'));
        assert.ok(byId.outfit.z < byId.hip_protector.z && byId.hip_protector.z < byId.boots.z);
        assert.ok(byId.head.z < byId.goggles.z && byId.goggles.z < byId.headgear.z);
        assert.equal('face' in byId, view === 'front');
      }
    }
    assert.equal(all.size, 8);
  }
  const legacy = resolveRigLayers('front', { ...base, palette: 'mint', headShape: '' }, 'chip');
  assert.match(legacy.find((layer) => layer.id === 'head').src, /round-mint\.png$/);
  assert.deepEqual(resolveRigLayers('front', base, 'chip').map((layer) => layer.id),
    ['head', 'face', 'goggles', 'headgear']);
});

test('匿名图鉴、卡片与详情使用同一套基础外观', async () => {
  resetState();
  const params = { groupId: 'grp_skate', view: 'back' };
  const detail = checked(await mockApi.story.getDetail({ ...params, storyId: 'sty_back' }));
  const atlas = checked(await mockApi.group.getAtlas(params));
  const card = atlas.stories.find((item) => item.id === 'sty_back');
  const chip = atlas.hotspots.flatMap((spot) => spot.users).find((item) => item.userId === 'anon_sty_back');
  for (const appearance of [detail.avatar, card, chip]) {
    assert.ok(appearance);
    const { headShape, palette, expression, equipped } = appearance;
    assert.deepEqual({ headShape, palette, expression, equipped }, ANONYMOUS_APPEARANCE);
  }
});

let page;
globalThis.Page = (definition) => { page = definition; };
try {
  require('../build/test/miniprogram/pages/avatar/index.js');
} finally {
  delete globalThis.Page;
}

test('真实角色页事件支持试穿、取消、领取、保存，以及保留冲突中的搭配', async () => {
  resetState();
  const state = {
    ...page, data: structuredClone(page.data),
    setData(patch) { Object.assign(this.data, patch); },
  };
  const tap = (id) => ({ currentTarget: { dataset: { id } } });
  await state.load();
  const initial = state.data.avatar;
  assert.equal(initial.customized, false);
  state.onEdit();
  state.onShape(tap('soft_square'));
  state.onPalette(tap('mint'));
  state.onSlot(tap('boots'));
  state.onTryGear(tap('snow_boots'));
  state.onPreview(tap('back'));
  assert.equal(state.data.preview.equipped.boots, 'snow_boots');
  assert.equal(state.data.view, 'back');
  state.onPreview(tap('chip'));
  assert.equal(state.data.mode, 'chip');
  await state.onSave();
  assert.match(state.data.notice, /请先领取深蓝雪靴/);
  state.onCancel();
  assert.deepEqual(state.data.preview, initial);

  state.onEdit();
  state.onShape(tap('soft_square'));
  state.onPalette(tap('mint'));
  state.onTryGear(tap('snow_boots'));
  await state.onClaimGear(tap('snow_boots'));
  assert.equal(checked(await mockApi.avatar.getMine()).equipped.boots, initial.equipped.boots);
  checked(await mockApi.avatar.updateAppearance({ appearance: { ...initial, expression: 'comfort' }, expectedVersion: initial.version }));
  await state.onSave();
  assert.match(state.data.notice, /另一台设备/);
  assert.equal(state.data.preview.equipped.boots, 'snow_boots');
  await state.onSave();
  const saved = checked(await mockApi.avatar.getMine());
  assert.equal(saved.equipped.boots, 'snow_boots');
  assert.equal(saved.headShape, 'soft_square');
  assert.equal(saved.palette, 'mint');
  assert.equal(state.data.draft, null);
});

test('收礼仅转移互动道具，接收角色的穿戴和版本保持原状', async () => {
  const state = resetState();
  const recipient = state.avatars.find((avatar) => avatar.ownerId === 'usr_ma');
  const appearance = structuredClone(recipient);
  const before = state.inventory.find((item) => item.ownerId === 'usr_ma' && item.itemDefId === 'steel_hip_guard')?.quantity ?? 0;
  checked(await mockApi.inventory.gift({ storyId: 'sty_back', itemDefId: 'steel_hip_guard', requestId: 'avatar-gift' }));
  assert.deepEqual(loadState().avatars.find((row) => row.ownerId === recipient.ownerId), appearance);
  assert.equal(loadState().inventory.find((item) => item.ownerId === 'usr_ma' && item.itemDefId === 'steel_hip_guard').quantity, before + 1);
});


let rigComponent;
globalThis.Component = (definition) => { rigComponent = definition; };
try {
  require('../build/test/miniprogram/components/avatar-rig/index.js');
} finally {
  delete globalThis.Component;
}

test('互动动作播放及静态降级均保留穿戴，结束后清理动画状态', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rig = {
    data: { view: 'front', mode: 'full', palette: 'mint', headShape: 'soft_square', expression: 'cool',
      equipped: { outfit: 'ski_blue', boots: 'snow_boots', gloves: 'gloves_frost', knee_pads: 'pads_slate', handheld: 'ski_poles' },
      reduceMotion: false },
    setData(patch) { Object.assign(this.data, patch); },
    ...rigComponent.methods,
  };
  rig.rebuild();
  assert.equal(rig.data.layers.find((layer) => layer.id === 'head').width, 46.25);
  const initialLayers = structuredClone(rig.data.layers);
  const initialArms = structuredClone(rig.data.arms);
  assert.ok(rig.data.layers.some((layer) => layer.id === 'knee_pads'));
  for (const { side, layers } of initialArms) {
    assert.ok(layers.some((layer) => layer.id === 'glove_' + side));
    assert.ok(layers.some((layer) => layer.id === 'pole_' + side && layer.handheld));
  }
  for (const [id, cls] of [['hug', 'is-hug'], ['spin', 'is-spin'], ['cheer', 'is-cheer'], ['receive_gift', 'is-gift']]) {
    rig.play(id);
    assert.equal(rig.data.cls, cls);
    assert.deepEqual(rig.data.layers, initialLayers);
    assert.deepEqual(rig.data.arms, initialArms);
    t.mock.timers.tick(1800);
    assert.equal(rig.data.cls, '');
  }
  rig.data.reduceMotion = true;
  rig.play('hug');
  assert.equal(rig.data.cls, 'is-static');
  assert.ok(rig.data.emoji);
  assert.deepEqual(rig.data.layers, initialLayers);
  assert.deepEqual(rig.data.arms, initialArms);
  rig.stop();
  rig.data.equipped.handheld = 'snowboard_dawn';
  rig.data.carryHand = '';
  rig.rebuild();
  assert.deepEqual(rig.data.arms.flatMap(({ layers }) => layers.filter((layer) => layer.handheld).map((layer) => layer.id)), ['board_left']);
});

test('护膝贴着双膝，手套在手部上方，单板按人体侧别换位，双雪杖各自跟随手臂', () => {
  const appearance = { palette: 'blue', expression: 'happy',
    equipped: { outfit: 'ski_blue', gloves: 'gloves_frost', knee_pads: 'pads_slate', handheld: 'snowboard_dawn' } };
  for (const view of ['front', 'back']) {
    for (const carryHand of [undefined, 'left', 'right']) {
      const layers = resolveRigLayers(view, { ...appearance, carryHand });
      const props = layers.filter((layer) => layer.handheld);
      assert.equal(props.length, 1);
      const screenSide = view === 'front' ? (carryHand === 'left' ? 'right' : 'left') : carryHand ?? 'right';
      assert.equal(props[0].arm, screenSide);
      assert.match(props[0].src, new RegExp('/' + view + '/board_' + screenSide));
      for (const side of ['left', 'right']) {
        const arm = layers.find((layer) => layer.id === 'arm_' + side);
        const glove = layers.find((layer) => layer.id === 'glove_' + side);
        assert.equal(glove.arm, arm.arm);
        assert.ok(props[0].z < arm.z && arm.z < glove.z);
      }
      assert.match(layers.find((layer) => layer.id === 'knee_pads').src, new RegExp('/' + view + '/knee_pads/'));
      const chip = resolveRigLayers(view, { ...appearance, carryHand }, 'chip');
      assert.ok(chip.every((layer) => !layer.arm && !layer.handheld && layer.id !== 'knee_pads'));
    }
    const poles = resolveRigLayers(view, { ...appearance, equipped: { ...appearance.equipped, handheld: 'ski_poles' } })
      .filter((layer) => layer.handheld);
    assert.deepEqual(poles.map((layer) => layer.arm), ['left', 'right']);
  }
});

test('角色页可免费领取手套与护膝，换手持板、切换雪杖以及放下装备', async () => {
  resetState();
  const state = {
    ...page, data: structuredClone(page.data),
    setData(patch) { Object.assign(this.data, patch); },
  };
  const tap = (id) => ({ currentTarget: { dataset: { id } } });
  await state.load();
  const old = state.data.avatar;
  state.onEdit();
  state.onPreview(tap('chip'));
  for (const [slot, id] of [['gloves', 'gloves_frost'], ['knee_pads', 'pads_slate'], ['handheld', 'snowboard_dawn']]) {
    state.onSlot(tap(slot));
    assert.ok(!state.data.ownedIds.includes(id));
    state.onTryGear(tap(id));
    assert.equal(state.data.mode, 'full');
    await state.onSave();
    assert.match(state.data.notice, /请先领取/);
    await state.onClaimGear(tap(id));
  }
  state.onCarryHand(tap('left'));
  assert.equal(state.data.snowboardSelected, true);
  await state.onSave();
  const saved = checked(await mockApi.avatar.getMine());
  for (const slot of ['outfit', 'headgear', 'hip_protector', 'goggles', 'boots']) {
    assert.equal(saved.equipped[slot], old.equipped[slot]);
  }
  assert.equal(saved.carryHand, 'left');
  assert.ok(!('carryHand' in saved.equipped));
  assert.equal(saved.equipped.gloves, 'gloves_frost');
  assert.equal(saved.equipped.knee_pads, 'pads_slate');
  state.onEdit();
  state.onSlot(tap('handheld'));
  state.onTryGear(tap('ski_poles'));
  assert.equal(state.data.snowboardSelected, false);
  await state.onClaimGear(tap('ski_poles'));
  await state.onSave();
  const poles = checked(await mockApi.avatar.getMine());
  assert.equal(poles.equipped.handheld, 'ski_poles');
  assert.ok(!('carryHand' in poles));
  state.onEdit();
  state.onTryGear(tap(''));
  await state.onSave();
  assert.equal(checked(await mockApi.avatar.getMine()).equipped.handheld, null);
});
