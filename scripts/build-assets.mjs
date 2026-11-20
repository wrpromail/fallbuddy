#!/usr/bin/env node
/**
 * 生成角色素材：
 *  1. 把 scripts/art 里的矢量图层渲染成 2x PNG（透明背景）
 *  2. 生成 miniprogram/shared/rig.generated.ts（图层裁剪框、站位、热点）
 *  3. 输出 build/review/*.png 供人工 / 视觉模型评审
 *
 * 依赖本机 Chrome（可用 CHROME_PATH 覆盖）和 Python Pillow。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { CANVAS, LAYERS, HOTSPOTS, ANCHORS, layerMap, svgFor, layerSrcPath, figureContent } from './art/rig-art.mjs';
import { tabIcon, itemIcon } from './art/icons-art.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const REVIEW = join(ROOT, 'build', 'review');
const ASSETS = join(ROOT, 'miniprogram', 'assets');
const RIG_TS = join(ROOT, 'miniprogram', 'shared', 'rig.generated.ts');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SCALE = 2;

let browser;

async function render(svg, outFile) {
  const size = svg.match(/width="(\d+)" height="(\d+)"/);
  if (!size) throw new Error('svg size missing: ' + outFile);
  mkdirSync(dirname(outFile), { recursive: true });
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: Number(size[1]), height: Number(size[2]), deviceScaleFactor: 1 });
    await page.setContent(`<style>body { margin: 0 } svg { display: block }</style>${svg}`);
    await page.screenshot({ path: outFile, omitBackground: true });
  } finally {
    await page.close();
  }
}

async function pool(tasks, limit = 4) {
  const queue = tasks.slice();
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const task = queue.shift();
      await task();
    }
  });
  await Promise.all(workers);
}

function compositeSvg(view, equipment) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width * SCALE}" height="${CANVAS.height * SCALE}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" shape-rendering="geometricPrecision">${figureContent(view, equipment)}</svg>`;
}

function sheetSvg(expressions) {
  const cols = expressions.length;
  const parts = expressions.map((expression, i) => {
    const equipment = { outfit: 'ski_blue', headgear: 'beanie_blue', hip_protector: 'basic_hip_protector', expression, goggles: null };
    return `<g transform="translate(${i * CANVAS.width},0)">${figureContent('front', equipment)}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width * cols * SCALE}" height="${CANVAS.height * SCALE}" viewBox="0 0 ${CANVAS.width * cols} ${CANVAS.height}" shape-rendering="geometricPrecision">${parts.join('')}</svg>`;
}

function buildRigData() {
  const views = { front: [], back: [] };
  for (const view of ['front', 'back']) {
    for (const layer of LAYERS.filter((l) => l.view === view).sort((a, b) => a.z - b.z)) {
      const [x, y, w, h] = layer.bbox;
      const item = { id: layer.id, z: layer.z, bbox: { x, y, w, h } };
      if (layer.slot) item.slot = layer.slot;
      if (layer.variants) {
        item.variants = Object.fromEntries(
          Object.keys(layer.variants).map((key) => [key, layerSrcPath({ layer, key })]),
        );
      } else {
        item.src = layerSrcPath({ layer, key: 'default' });
      }
      views[view].push(item);
    }
  }
  return {
    version: 'skeleton-rig-v1',
    canvas: { width: CANVAS.width, height: CANVAS.height },
    anchors: ANCHORS,
    hotspots: HOTSPOTS,
    views,
  };
}

const rigData = buildRigData();

function rigTs() {
  return `// 本文件由 scripts/build-assets.mjs 自动生成，请勿手改。
// 重新生成：npm run assets
/* eslint-disable */
export const RIG_DATA = ${JSON.stringify(rigData, null, 2)} as const;
`;
}

async function main() {
  mkdirSync(REVIEW, { recursive: true });

  const entries = [...layerMap().values()];
  const jobs = entries.map((entry) => () =>
    render(svgFor(entry, SCALE), join(ASSETS, layerSrcPath(entry).replace('/assets/', ''))),
  );

  // 道具与 tabBar 图标
  const tabKinds = ['atlas', 'avatar', 'inbox'];
  for (const kind of tabKinds) {
    for (const [state, color] of [
      ['normal', '#98A2B8'],
      ['active', '#2F6FE0'],
    ]) {
      jobs.push(() => render(tabIcon(kind, color), join(ASSETS, 'tabbar', `${kind}-${state}.png`)));
    }
  }
  const iconKinds = ['hot_cocoa', 'steel_hip_guard', 'comfort_patch', 'basic_helmet_blue', 'basic_hip_protector'];
  for (const kind of iconKinds) {
    jobs.push(() => render(itemIcon(kind), join(ASSETS, 'items', `${kind}.png`)));
  }

  await pool(jobs, 2);

  // 纯色身体图层使用带透明度的 256 色 PNG，降低小程序包体。
  const bodyFiles = entries.filter(({ layer }) => layer.id === 'body')
    .map((entry) => join(ASSETS, layerSrcPath(entry).replace('/assets/', '')));
  execFileSync('python3', ['-c', `
import sys
from PIL import Image

for file in sys.argv[1:]:
    with Image.open(file) as image:
        indexed = image.convert('RGBA').quantize(colors=256, method=Image.Quantize.FASTOCTREE)
    indexed.save(file, optimize=True)
`, ...bodyFiles], { stdio: 'inherit' });

  writeFileSync(RIG_TS, rigTs());

  // 评审用合成图
  const defaultEquip = { outfit: 'ski_blue', headgear: 'beanie_blue', hip_protector: 'basic_hip_protector', goggles: null };
  await render(compositeSvg('front', defaultEquip), join(REVIEW, 'rig-front.png'));
  await render(compositeSvg('back', defaultEquip), join(REVIEW, 'rig-back.png'));
  await render(
    compositeSvg('front', { outfit: 'suit_orange', headgear: 'helmet_red', hip_protector: 'steel_hip_guard', goggles: 'snow_goggles' }),
    join(REVIEW, 'rig-front-gear.png'),
  );
  await render(sheetSvg(['happy', 'surprised', 'awkward', 'comfort', 'cool']), join(REVIEW, 'expressions.png'));

  console.log(`rendered ${entries.length} layers + icons → ${ASSETS}`);
  console.log(`rig config → ${RIG_TS}`);
}

try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  await main();
} finally {
  await browser?.close();
}
