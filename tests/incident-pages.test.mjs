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
    setData(patch, callback) { Object.assign(this.data, patch); callback?.(); },
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

function mountAccidentTest(t) {
  let modal;
  globalThis.wx = {
    showToast() {},
    pageScrollTo({ selector }) { assert.equal(selector, '#version-conflict'); },
    showModal(options) { modal = options; },
    redirectTo() {},
    navigateBack() {},
  };
  t.after(() => { delete globalThis.wx; });
  resetState();
  return () => modal;
}

async function readyForm() {
  const page = makeCreate();
  await page.load(false);
  page.onTitleInput(input('练习转弯'));
  page.onBodyInput(input('右膝先着地。'));
  page.onSelectPart({ detail: { id: 'knee_r' } });
  page.onMulti(tap({ kind: 'scenario', id: 'turning' }));
  page.onMulti(tap({ kind: 'cause', id: 'unknown' }));
  page.onToggleGroup(tap({ id: 'grp_snow' }));
  assert.equal(page.data.canSubmit, true);
  return page;
}

test('编辑冲突展示已保存的侧别、正文及可见范围，保留本页且可安全重试', async (t) => {
  mountAccidentTest(t);
  const base = await readyForm();
  const published = await mockApi.story.publish({ input: base.formInput(), requestId: 'page-conflict-base' });
  assert.equal(published.ok, true);
  const { storyId } = published.data;
  const a = makeCreate();
  const b = makeCreate();
  a.storyId = b.storyId = storyId;
  await Promise.all([a.load(false), b.load(false)]);
  a.onSelfOnly(input(true));
  a.onBodyInput(input('另一台设备已经保存。'));
  a.onSelectPart({ detail: { id: 'knee_l' } });
  await a.onSubmit();
  b.onBodyInput(input('本页还在写的修改。'));
  const getDetail = mockApi.story.getDetail;
  const read = t.mock.method(mockApi.story, 'getDetail', async () => ({ ok: false, code: 'UNAVAILABLE' }));
  await b.onSubmit();
  assert.equal(b.data.conflictStatus, 'retry');
  assert.equal(b.data.body, '本页还在写的修改。');
  assert.equal(b.data.canSubmit, false);
  read.mock.restore();
  await b.onRefreshLatest();
  assert.equal(b.data.conflictStatus, 'ready');
  assert.equal(b.data.latestFields.find(({ label }) => label === '身体部位').value, '右膝、左膝');
  assert.equal(b.data.latestFields.find(({ label }) => label === '可见范围').value, '仅自己可见');
  assert.equal(b.data.latestFields.find(({ label }) => label === '故事正文').value, '另一台设备已经保存。');
  await b.onSubmit();
  assert.equal((await getDetail({ storyId })).data.story.version, 2);
  b.onKeepEdits();
  b.onSelfOnly(input(true));
  assert.equal(b.data.body, '本页还在写的修改。');
  assert.deepEqual(b.data.bodyParts, ['knee_r']);

  const update = mockApi.story.update;
  const ids = [];
  t.mock.method(mockApi.story, 'update', async (params) => {
    ids.push(params.requestId);
    const result = await update(params);
    if (ids.length === 1) throw new Error('response lost after commit');
    return result;
  });
  await b.onSubmit();
  assert.equal(b.data.body, '本页还在写的修改。');
  await b.onSubmit();
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  const latest = (await getDetail({ storyId })).data;
  assert.equal(latest.story.version, 3);
  assert.equal(latest.story.body, '本页还在写的修改。');
  assert.equal(latest.story.visibility, 'self');
});

test('草稿重复保存可重试，冲突时可采用已存版本，已发布的草稿须先另存才可再次发布', async (t) => {
  const getModal = mountAccidentTest(t);
  const a = await readyForm();
  const save = mockApi.story.saveDraft;
  const sent = [];
  const saveMock = t.mock.method(mockApi.story, 'saveDraft', async (params) => {
    sent.push(params);
    const result = await save(params);
    if (sent.length === 1) throw new Error('response lost after commit');
    return result;
  });
  await a.saveDraft();
  await a.saveDraft();
  assert.equal(sent[0].requestId, sent[1].requestId);
  assert.equal((await mockApi.story.getDraft()).data.version, a.draft.version);
  assert.ok(!('lastRequestId' in (await mockApi.story.getDraft()).data));
  saveMock.mock.restore();
  const b = makeCreate();
  await b.load(true);
  a.onTitleInput(input('另一台已保存的标题'));
  await a.saveDraft();
  b.onTitleInput(input('本页的标题'));
  await b.saveDraft();
  assert.equal(b.data.conflictStatus, 'ready');
  assert.equal(b.data.title, '本页的标题');
  b.onUseLatest();
  getModal().success({ confirm: false });
  assert.equal(b.data.title, '本页的标题');
  b.onUseLatest();
  getModal().success({ confirm: true });
  assert.equal(b.data.title, '另一台已保存的标题');
  assert.equal(b.data.conflictStatus, '');

  await a.onSubmit();
  b.onBodyInput(input('仍留在本页的另一份草稿。'));
  await b.onSubmit();
  assert.equal(b.data.conflictStatus, 'missing');
  b.onKeepEdits();
  assert.equal(b.data.mustSaveNewDraft, true);
  assert.equal(b.data.canSubmit, false);
  assert.equal(b.data.body, '仍留在本页的另一份草稿。');
  await b.saveDraft();
  assert.equal(b.data.canSubmit, true);
  assert.ok(b.draft.version > a.draft.version);
});
