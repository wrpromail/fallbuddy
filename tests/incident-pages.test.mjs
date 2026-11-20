import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resetState } = require('../build/test/miniprogram/services/store.js');
const { mockApi } = require('../build/test/miniprogram/services/mock/api.js');

function mountPage(name) {
  let definition;
  globalThis.Page = (page) => { definition = page; };
  try {
    require(name);
  } finally {
    delete globalThis.Page;
  }
  return () => ({
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, patch); },
  });
}

const makeCreate = mountPage('../build/test/miniprogram/pages/incident/create.js');
const makeDetail = mountPage('../build/test/miniprogram/pages/story/detail.js');
const tap = (dataset) => ({ currentTarget: { dataset } });
const input = (value) => ({ detail: { value } });

test('创建页、详情页真实事件支持续写草稿、同步左右侧和后续', async () => {
  let navigated = '';
  let storage = '';
  globalThis.wx = {
    getStorageSync: () => storage,
    setStorageSync: (_key, value) => { storage = value; },
    showToast: () => {},
    redirectTo: ({ url }) => { navigated = url; },
    navigateTo: ({ url }) => { navigated = url; },
    navigateBack: () => { navigated = 'back'; },
  };
  try {
    resetState();
    const create = makeCreate();
    await create.load(false);
    assert.equal(create.data.groupChips.some((group) => group.checked), false);
    create.onSport(tap({ id: 'ski_single' }));
    create.onSelectPart({ detail: { id: 'knee_l' } });
    await create.saveDraft();
    assert.match(storage, /"bodyParts":\["knee_l"\]/);

    const resumed = makeCreate();
    await resumed.load(true);
    assert.deepEqual(resumed.data.bodyParts, ['knee_l']);
    assert.equal(resumed.data.sport, 'ski_single');
    resumed.onTitleInput(input('周末摔倒记录'));
    resumed.onBodyInput(input('练习转弯时碰到了膝。'));
    resumed.onHappenedOn(input('2026-03-01'));
    resumed.onToggleGroup(tap({ id: 'grp_snow' }));
    resumed.onMulti(tap({ kind: 'scenario', id: 'turning' }));
    resumed.onMulti(tap({ kind: 'cause', id: 'unknown' }));
    assert.equal(resumed.data.canSubmit, true);
    await resumed.onSubmit();
    const storyId = new URL(navigated, 'http://example.test').searchParams.get('storyId');
    assert.ok(storyId);

    const detail = makeDetail();
    detail.onLoad({ storyId });
    await detail.load();
    assert.ok(detail.data.canEdit);
    assert.deepEqual(detail.data.bodyPartLabels, ['左膝']);
    detail.onEditStory();
    assert.match(navigated, /\/pages\/incident\/create\?storyId=/);
    const edited = makeCreate();
    edited.storyId = storyId;
    await edited.load(false);
    edited.onSelectPart({ detail: { id: 'knee_l' } });
    edited.onSelectPart({ detail: { id: 'knee_r' } });
    await edited.onSubmit();
    assert.equal(navigated, 'back');
    await detail.load();
    assert.deepEqual(detail.data.bodyPartLabels, ['右膝']);
    detail.onComposeUpdate();
    detail.onUpdateBody(input('这一周已经恢复滑雪。'));
    await detail.onSaveUpdate();
    assert.deepEqual(detail.data.updatesView.map((update) => update.body), ['这一周已经恢复滑雪。']);
    assert.equal((await mockApi.story.getDraft()).data, null);
  } finally {
    delete globalThis.wx;
  }
});
