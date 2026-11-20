#!/usr/bin/env node
/** 校验 rig 图层引用的 PNG 是否存在、尺寸是否为 bbox 的 2 倍。 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RIG } = require('../build/test/miniprogram/shared/rig.js');
const { ITEM_DEFINITIONS } = require('../build/test/miniprogram/shared/items.js');

const ROOT = resolve(import.meta.dirname, '..');
const MP = join(ROOT, 'miniprogram');
const SCALE = 2;
const errors = [];

function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function check(file, expectedW, expectedH, label) {
  if (!existsSync(file)) {
    errors.push(`缺少文件：${label} → ${file.replace(ROOT + '/', '')}`);
    return;
  }
  const size = pngSize(file);
  if (!size) {
    errors.push(`不是合法 PNG：${label}`);
    return;
  }
  if (expectedW && (size.width !== expectedW || size.height !== expectedH)) {
    errors.push(`尺寸不符：${label} 期望 ${expectedW}×${expectedH}，实际 ${size.width}×${size.height}`);
  }
}

let layerCount = 0;
for (const [view, layers] of Object.entries(RIG.views)) {
  for (const layer of layers) {
    const sources = layer.variants ? Object.values(layer.variants) : [layer.src];
    for (const src of sources) {
      layerCount += 1;
      check(join(MP, src), layer.bbox.w * SCALE, layer.bbox.h * SCALE, `${view}/${layer.id}`);
    }
  }
}

for (const kind of ['atlas', 'avatar', 'inbox']) {
  for (const state of ['normal', 'active']) {
    check(join(MP, 'assets', 'tabbar', `${kind}-${state}.png`), 81, 81, `tabbar/${kind}-${state}`);
  }
}

for (const item of ITEM_DEFINITIONS) {
  if (item.category === 'cosmetic') continue;
  check(join(MP, 'assets', 'items', `${item.id}.png`), 96, 96, `item/${item.id}`);
}

if (errors.length) {
  console.error(`素材校验失败（${errors.length}）：`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}
console.log(`素材校验通过：${layerCount} 个角色图层文件 + tabBar/道具图标。`);
