#!/usr/bin/env node
/** 全页截图：展开滚动容器后截整页，便于评审整页布局。 */
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

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--hide-scrollbars', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 2 });
for (const screen of ['atlas', 'story', 'avatar', 'create', 'inbox', 'group']) {
  await page.goto(`${URL}?screen=${screen}&full=1`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 350));
  await page.screenshot({ path: join(OUT, `full-${screen}.png`), fullPage: true });
  console.log('full shot', screen);
}
await browser.close();
