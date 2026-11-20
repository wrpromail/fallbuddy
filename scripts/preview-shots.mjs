#!/usr/bin/env node
/** 生成文档用截图（2x，仅手机屏幕区域）。 */
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require('/opt/homebrew/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/puppeteer');
}
const ROOT = resolve(import.meta.dirname, '..');
const URL = `file://${join(ROOT, 'preview', 'index.html')}`;
const OUT = join(ROOT, 'preview', 'screens');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) rmSync(join(OUT, file), { force: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--hide-scrollbars', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 2 });

async function shot(name, screen, { full = false, after } = {}) {
  await page.goto(`${URL}?screen=${screen}${full ? '&full=1' : ''}`, { waitUntil: 'load' });
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (after) await after();
  const target = await page.$('.phone__screen');
  await target.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('shot', name);
}

await shot('atlas', 'atlas');
await shot('atlas-full', 'atlas', { full: true });
await shot('atlas-sheet', 'atlas', {
  after: async () => {
    await page.evaluate(() => {
      const hotspot = [...document.querySelectorAll('.hotspot')].find((node) => node.querySelector('.stack'));
      if (hotspot) hotspot.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
  },
});
await shot('story', 'story');
await shot('story-hug', 'story', {
  after: async () => {
    await page.evaluate(() => window.P.react('hug'));
    await new Promise((resolve) => setTimeout(resolve, 380));
  },
});
await shot('story-full', 'story', { full: true });
await shot('avatar', 'avatar');
await shot('avatar-full', 'avatar', { full: true });
await shot('create', 'create');
await shot('create-full', 'create', { full: true });
await shot('inbox', 'inbox');
await shot('group', 'group');

await browser.close();
