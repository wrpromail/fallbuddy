#!/usr/bin/env node
/**
 * 生成浏览器开发预览：把 V0 mock 数据、rig 图层（内联 SVG）与预览脚本合成一个自包含 HTML。
 * 仅用于没有微信开发者工具时快速查看视觉与交互，不是小程序运行时。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { layerMap, layerSrcPath, svgFor } from './art/rig-art.mjs';
import { itemIcon, tabIcon } from './art/icons-art.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'preview');

const { resetState } = require('../build/test/miniprogram/services/store.js');
const { mockApi } = require('../build/test/miniprogram/services/mock/api.js');
const { RIG } = require('../build/test/miniprogram/shared/rig.js');
const { ANONYMOUS_APPEARANCE } = require('../build/test/miniprogram/shared/avatar.js');
const { ACTIONS } = require('../build/test/miniprogram/shared/actions.js');
const { ITEM_DEFINITIONS, SNOWBOARD_ID } = require('../build/test/miniprogram/shared/items.js');
const E = require('../build/test/miniprogram/shared/enums.js');

resetState();

const me = await mockApi.auth.ensureUser();
const groupsRes = await mockApi.group.listMine();
if (!me.ok || !groupsRes.ok) throw new Error('无法初始化 preview 数据');
const groups = groupsRes.data;

const atlases = {};
const details = {};
const members = {};
for (const group of groups) {
  atlases[group.id] = {};
  for (const view of ['front', 'back']) {
    const res = await mockApi.group.getAtlas({ groupId: group.id, view, period: 'all' });
    if (res.ok) atlases[group.id][view] = res.data;
  }
  const memberRes = await mockApi.group.getMembers(group.id);
  if (memberRes.ok) members[group.id] = memberRes.data;
}
for (const groupAtlases of Object.values(atlases)) {
  for (const atlas of Object.values(groupAtlases)) {
    for (const story of atlas.stories) {
      if (details[story.id]) continue;
      const res = await mockApi.story.getDetail({ storyId: story.id });
      if (res.ok) details[story.id] = res.data;
    }
  }
}

const inbox = await mockApi.interaction.getInbox({ limit: 30 });
const inboxEvents = await Promise.all((inbox.ok ? inbox.data.events : []).map(async (event) => {
  const detail = await mockApi.story.getDetail({ storyId: event.storyId, replayEventId: event.id });
  return { ...event, replay: detail.ok ? detail.data.replay : undefined };
}));
const inventory = await mockApi.inventory.getMine();
const weekly = await mockApi.inventory.getWeekly();

const labels = {
  sport: E.SPORT_LABEL,
  sportEmoji: E.SPORT_EMOJI,
  impact: E.IMPACT_LABEL,
  scenario: E.SCENARIO_LABEL,
  cause: E.CAUSE_LABEL,
  protective: E.PROTECTIVE_LABEL,
  bodyPart: E.BODY_PART_LABEL,
  tone: E.TONE_LABEL,
  update: E.UPDATE_TYPE_LABEL,
  sportList: E.SPORTS.map((id) => ({ id, label: E.SPORT_LABEL[id] })),
  sports: E.SPORTS.map((id) => ({ id, label: E.SPORT_LABEL[id], emoji: E.SPORT_EMOJI[id] })),
  scenarios: E.SCENARIOS.map((id) => ({ id, label: E.SCENARIO_LABEL[id] })),
  causes: E.CAUSES.map((id) => ({ id, label: E.CAUSE_LABEL[id] })),
  impacts: E.IMPACT_KINDS.map((id) => ({ id, label: E.IMPACT_LABEL[id] })),
  protectives: E.PROTECTIVE_ITEMS.map((id) => ({ id, label: E.PROTECTIVE_LABEL[id] })),
  bodyParts: E.BODY_PARTS.filter((id) => id !== 'other').map((id) => ({ id, label: E.BODY_PART_LABEL[id] })),
  expressions: E.EXPRESSIONS.map((id) => ({
    id,
    label: E.EXPRESSION_LABEL[id],
    emoji: { happy: '😊', surprised: '😮', awkward: '😅', comfort: '🥺', cool: '😎' }[id],
  })),
  palettes: E.PALETTES.map((id) => ({ id, color: E.PALETTE_COLOR[id] })),
};

const art = { items: {} };
for (const entry of layerMap().values()) {
  art[layerSrcPath(entry)] = svgFor(entry);
}
for (const item of ITEM_DEFINITIONS) {
  if (item.category === 'consumable') art.items[item.id] = itemIcon(item.id);
}

const tabbar = {
  atlas: { normal: tabIcon('atlas', '#98A2B8'), active: tabIcon('atlas', '#2F6FE0') },
  avatar: { normal: tabIcon('avatar', '#98A2B8'), active: tabIcon('avatar', '#2F6FE0') },
  inbox: { normal: tabIcon('inbox', '#98A2B8'), active: tabIcon('inbox', '#2F6FE0') },
};

const data = {
  me: me.data,
  groups,
  atlases,
  details,
  members,
  inbox: { events: inboxEvents, unreadCount: inbox.ok ? inbox.data.unreadCount : 0 },
  inventory: inventory.ok ? inventory.data : [],
  weekly: weekly.ok ? weekly.data : { claimed: false, items: [] },
  actions: ACTIONS,
  items: ITEM_DEFINITIONS,
  snowboardId: SNOWBOARD_ID,
  anonymousAppearance: ANONYMOUS_APPEARANCE,
  labels,
};

const css = ['scripts/preview/styles.css', 'miniprogram/components/avatar-rig/arms.wxss']
  .map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');
const js = readFileSync(join(ROOT, 'scripts/preview/app.js'), 'utf8');
const payload = JSON.stringify({ rig: RIG, art, data, tabbar }).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>摔友记 V0 · 开发预览</title>
<style>${css}</style>
</head>
<body>
  <div class="workspace">
    <div class="toolbar">
      <button data-screen="atlas" class="on">图鉴</button>
      <button data-screen="story">故事</button>
      <button data-screen="avatar">我的角色</button>
      <button data-screen="create">发布</button>
      <button data-screen="inbox">消息</button>
      <span class="tag">开发预览 · 非小程序运行时</span>
    </div>
    <div class="phone">
      <div class="phone__screen">
        <div class="statusbar">
          <span>9:41</span>
          <div class="statusbar__icons"><span></span><span></span></div>
        </div>
        <div id="app"></div>
        <div class="tabbar" id="tabbar">
          <button data-screen="atlas"><span class="icon"></span><span>图鉴</span></button>
          <button data-screen="avatar"><span class="icon"></span><span>我的角色</span></button>
          <button data-screen="inbox"><span class="icon"></span><span>消息</span></button>
        </div>
        <div class="sheet-mask"></div>
        <div class="sheet"></div>
        <div class="toast" id="toast"></div>
      </div>
    </div>
  </div>
  <script>window.__PREVIEW__ = ${payload};</script>
  <script>${js}</script>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.html'), html);
console.log(`preview → ${join(OUT_DIR, 'index.html')} (${(html.length / 1024).toFixed(0)} KB)`);
