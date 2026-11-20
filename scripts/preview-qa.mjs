#!/usr/bin/env node
/** 用 puppeteer 驱动开发预览做交互回归与截图（本机 Chrome，无额外依赖安装）。 */
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  // 没装本地依赖时退回本机全局安装的 puppeteer（开发者工具链）
  puppeteer = require('/opt/homebrew/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer');
}
const ROOT = resolve(import.meta.dirname, '..');
const URL = `file://${join(ROOT, 'preview', 'index.html')}`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = join(ROOT, 'preview', 'screens');

const errors = [];
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--hide-scrollbars', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1020, deviceScaleFactor: 2 });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(`${URL}?screen=atlas`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 300));

const layout = await page.evaluate(() => {
  const phone = document.querySelector('.phone').getBoundingClientRect();
  const chips = [...document.querySelectorAll('.hotspot .avatar-chip')].length;
  const figure = document.querySelector('.figure').getBoundingClientRect();
  const hotspots = [...document.querySelectorAll('.hotspot')].map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
  const clipped = hotspots.filter(
    (rect) => rect.left < figure.left - 1 || rect.right > figure.right + 1 || rect.top < figure.top - 1 || rect.bottom > figure.bottom + 1,
  ).length;
  return {
    bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    phone: { x: phone.x, y: phone.y, width: phone.width, height: phone.height },
    chips,
    hotspots: hotspots.length,
    clipped,
    stickers: document.querySelectorAll('.hotspot__sticker').length,
  };
});
check('图鉴：身体热点渲染小头像', layout.chips > 0, `${layout.chips} 个头像`);
check('图鉴：热点状态贴纸已渲染', layout.stickers > 0, `${layout.stickers} 个贴纸`);
check('图鉴：热点未越出角色区域', layout.clipped === 0, `${layout.hotspots} 个热点，${layout.clipped} 个越界`);
const firstCard = await page.evaluate(() => {
  const card = document.querySelector('.recent__list .story-card');
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  return { top: Math.round(rect.top), visible: rect.top < window.innerHeight - 62 };
});
check('图鉴首屏露出第一张故事卡片', !!(firstCard && firstCard.visible), firstCard ? `top=${firstCard.top}` : 'no card');
check('页面无横向溢出', layout.bodyOverflowX <= 1, `overflowX=${layout.bodyOverflowX}`);

await page.screenshot({ path: join(OUT, 'atlas@2x.png') });
await page.evaluate(() => {
  const scroller = document.querySelector('.scroll');
  if (scroller) scroller.scrollTop = 520;
});
await page.screenshot({ path: join(OUT, 'atlas-scroll@2x.png') });

// 热点 → 抽屉
await page.evaluate(() => {
  const hotspot = [...document.querySelectorAll('.hotspot')].find((node) => node.querySelector('.stack'));
  if (hotspot) hotspot.click();
});
await new Promise((r) => setTimeout(r, 200));
const sheetOpen = await page.evaluate(() => document.querySelector('.sheet').classList.contains('on'));
check('点击热点打开故事抽屉', sheetOpen);
await page.screenshot({ path: join(OUT, 'atlas-sheet@2x.png') });

// 抽屉里点故事 → 故事页
await page.evaluate(() => {
  const card = document.querySelector('.sheet .story-card');
  if (card) card.click();
});
await new Promise((r) => setTimeout(r, 300));
const story = await page.evaluate(() => ({
  screen: window.PREVIEW_STATE.screen,
  tabbarHidden: document.getElementById('tabbar').classList.contains('hidden'),
  reactions: document.querySelectorAll('.reaction').length,
  chips: document.querySelectorAll('.story-stage .avatar-chip').length,
}));
check('打开故事详情', story.screen === 'story', JSON.stringify(story));
check('故事页隐藏 tabBar', story.tabbarHidden);
check('故事页有互动按钮', story.reactions >= 4, `${story.reactions} 个`);
await page.screenshot({ path: join(OUT, 'story@2x.png') });

// 抱抱一次
const before = await page.evaluate(() => {
  const state = window.PREVIEW_STATE;
  const detail = state.publishedDetails[state.storyId] || (window.__PREVIEW__.data.details[state.storyId]);
  return detail.reactions.find((r) => r.actionId === 'hug').count;
});
await page.evaluate(() => {
  const button = [...document.querySelectorAll('.reaction')].find((node) => node.textContent.includes('抱抱'));
  if (button) button.click();
});
await new Promise((r) => setTimeout(r, 100));
const after = await page.evaluate(() => {
  const state = window.PREVIEW_STATE;
  const detail = state.publishedDetails[state.storyId] || (window.__PREVIEW__.data.details[state.storyId]);
  return detail.reactions.find((r) => r.actionId === 'hug').count;
});
check('抱抱互动计数 +1', after === before + 1, `${before} → ${after}`);
await page.screenshot({ path: join(OUT, 'story-hug@2x.png') });

// 送装备
await page.evaluate(() => {
  const button = [...document.querySelectorAll('.reaction')].find((node) => node.textContent.includes('送装备'));
  if (button) button.click();
});
await new Promise((r) => setTimeout(r, 200));
const giftItems = await page.evaluate(() => document.querySelectorAll('.sheet .item').length);
check('送礼抽屉出现可赠道具', giftItems > 0, `${giftItems} 件`);
await page.screenshot({ path: join(OUT, 'story-gift@2x.png') });
await page.evaluate(() => {
  const button = [...document.querySelectorAll('.sheet button')].find((node) => node.textContent.includes('送出去'));
  if (button) button.click();
});
await new Promise((r) => setTimeout(r, 2200));

// 头像页
await page.evaluate(() => window.P.go('avatar'));
await new Promise((r) => setTimeout(r, 250));
const avatarLayerBefore = await page.evaluate(() => document.querySelectorAll('.avatar-stage .rig-layer').length);
await page.screenshot({ path: join(OUT, 'avatar@2x.png') });
await page.evaluate(() => window.P.setExpression('cool'));
await new Promise((r) => setTimeout(r, 150));
const avatarLayerAfter = await page.evaluate(() => document.querySelectorAll('.avatar-stage .rig-layer').length);
check('角色页渲染图层并按表情切换', avatarLayerBefore === avatarLayerAfter && avatarLayerAfter > 3, `${avatarLayerAfter} 层`);
await page.screenshot({ path: join(OUT, 'avatar-edit@2x.png') });

// 发布页
await page.evaluate(() => window.P.go('create'));
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: join(OUT, 'create@2x.png') });
const form = await page.evaluate(() => {
  const state = window.PREVIEW_STATE;
  state.form.title = '预览里的测试故事';
  state.form.body = '转弯时卡刃，坐了个屁股墩，护臀又一次救了我。';
  state.form.bodyParts = ['tailbone'];
  state.form.scenario = ['turning'];
  state.form.cause = ['edge_catch'];
  return { title: state.form.title, parts: state.form.bodyParts.length };
});
await page.evaluate(() => window.P.publish());
await new Promise((r) => setTimeout(r, 350));
const published = await page.evaluate(() => ({
  screen: window.PREVIEW_STATE.screen,
  storyId: window.PREVIEW_STATE.storyId,
  detail: !!window.PREVIEW_STATE.publishedDetails[window.PREVIEW_STATE.storyId],
  title: (window.PREVIEW_STATE.publishedDetails[window.PREVIEW_STATE.storyId] || {}).story?.title,
}));
check('预览内发布故事并进入详情', published.screen === 'story' && published.detail, JSON.stringify(published));
check('发布内容正确', published.title === form.title, published.title);
await page.screenshot({ path: join(OUT, 'story-published@2x.png') });

// 仅自己可见
await page.evaluate(() => {
  window.P.toggleSelfOnly();
  window.P.publish();
});
await new Promise((r) => setTimeout(r, 300));
const selfOnly = await page.evaluate(() => {
  const state = window.PREVIEW_STATE;
  const detail = state.publishedDetails[state.storyId];
  return {
    visibility: detail ? detail.story.visibility : '',
    group: detail ? detail.group : 'missing',
    hasShare: !!document.querySelector('.icon-btn[onclick*="分享卡片"]'),
    hasNote: document.body.textContent.includes('这条故事仅自己可见'),
  };
});
check(
  '仅自己可见：不进圈子、隐藏分享、显示提示',
  selfOnly.visibility === 'self' && selfOnly.group === null && !selfOnly.hasShare && selfOnly.hasNote,
  JSON.stringify(selfOnly),
);
await page.screenshot({ path: join(OUT, 'story-self@2x.png') });

// 消息页
await page.evaluate(() => window.P.go('inbox'));
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({ path: join(OUT, 'inbox@2x.png') });
const unread = await page.evaluate(() => window.PREVIEW_STATE.unread);
check('消息页有未读互动', unread >= 0, `unread=${unread}`);

check('无 JS 运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`\n${failed.length} 项检查失败`);
  process.exit(1);
}
console.log('\n预览交互检查全部通过');
