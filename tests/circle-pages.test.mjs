import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resetState } = require('../build/test/miniprogram/services/store.js');
const { mockApi } = require('../build/test/miniprogram/services/mock/api.js');

function mount(name) {
  let page;
  globalThis.Page = (definition) => { page = definition; };
  try {
    require(`../build/test/miniprogram/pages/${name}.js`);
  } finally {
    delete globalThis.Page;
  }
  return () => ({
    ...page,
    data: structuredClone(page.data),
    setData(patch) { Object.assign(this.data, patch); },
  });
}

const groupPage = mount('group/index');
const inboxPage = mount('inbox/index');
const settingsPage = mount('settings/index');
const tap = (dataset) => ({ currentTarget: { dataset } });
const input = (value) => ({ detail: { value } });

function setup(t) {
  const calls = {};
  globalThis.wx = {
    setNavigationBarTitle() {},
    showToast({ title }) { calls.toast = title; },
    showModal(options) { calls.modal = options; },
    navigateTo({ url }) { calls.url = url; },
    setTabBarBadge({ text }) { calls.badge = text; },
    removeTabBarBadge() { calls.badge = ''; },
    reLaunch({ url }) { calls.url = url; },
  };
  t.after(() => { delete globalThis.wx; });
  resetState();
  return calls;
}

test('圈子页事件完成建圈、生成及撤销邀请、暂停互动和切换圈子', async (t) => {
  const calls = setup(t);
  const page = groupPage();
  await page.load();
  page.onToggleCreate();
  page.onGroupName(input('周日雪友'));
  page.onJoinMode(input(false));
  await page.onCreateGroup();
  assert.equal(page.data.group.name, '周日雪友');
  assert.equal(page.data.group.joinMode, 'open');
  assert.equal(page.data.group.role, 'owner');
  await page.onCreateInvite();
  const invite = page.data.invite;
  assert.ok(invite?.sharePath.includes('inviteToken='));
  assert.equal(page.data.invites[0].id, invite.id);
  page.onRevokeInvite(tap({ id: invite.id }));
  await calls.modal.success({ confirm: true });
  assert.equal(page.data.invite, null);
  assert.deepEqual(page.data.invites, []);
  await page.onPauseInteractions(input(true));
  assert.equal(page.data.group.interactionsPaused, true);
  const local = page.data.groups.findIndex((group) => group.id === 'grp_skate');
  const load = page.load.bind(page);
  let loaded;
  page.load = () => { loaded = load(); return loaded; };
  page.onChooseGroup(input(String(local)));
  await loaded;
  assert.equal(page.data.group.id, 'grp_skate');
});

test('收件箱展开、回放、忽略及从设置取消屏蔽，未读角标随页面更新', async (t) => {
  const calls = setup(t);
  const inbox = inboxPage();
  await inbox.load();
  const first = inbox.data.groups[0];
  assert.ok(first.unreadCount > 0);
  assert.ok(calls.badge);
  await inbox.onToggleGroup(tap({ id: first.id }));
  assert.equal(inbox.data.openGroupId, first.id);
  assert.equal(inbox.data.groups[0].unreadCount, 0);
  const event = first.events[0];
  inbox.onReplay(tap({ story: event.storyId, id: event.id }));
  assert.equal(new URL(calls.url, 'https://example.test').searchParams.get('eventId'), event.id);
  inbox.onBlock(tap({ id: event.actorId, name: event.actorName }));
  await calls.modal.success({ confirm: true });
  const settings = settingsPage();
  await settings.load();
  assert.equal(settings.data.blocked[0].id, event.actorId);
  await settings.onUnblock(tap({ id: event.actorId }));
  assert.deepEqual(settings.data.blocked, []);
  await inbox.onIgnore(tap({ id: first.id }));
  assert.ok(!inbox.data.groups.some((group) => group.id === first.id));
  await inbox.onMarkAllRead();
  assert.equal(calls.badge, '');
});

test('注销入口要求确认，注销成功后清除页面并重开设置', async (t) => {
  const calls = setup(t);
  const settings = settingsPage();
  settings.data.isCloud = true;
  const remove = t.mock.method(mockApi.auth, 'deleteAccount', async () => ({ ok: true, data: { deleted: true } }));
  settings.onDeleteAccount();
  await calls.modal.success({ confirm: false });
  assert.equal(remove.mock.callCount(), 0);
  settings.onDeleteAccount();
  await calls.modal.success({ confirm: true });
  assert.equal(remove.mock.callCount(), 1);
  assert.deepEqual(remove.mock.calls[0].arguments, [{ confirm: true }]);
  assert.equal(settings.data.accountDeleted, true);
  assert.equal(calls.url, '/pages/settings/index');
});
