#!/usr/bin/env node
/** 生成带热点标记的评审图，用来核对热点坐标是否落在正确部位。 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CANVAS, HOTSPOTS, figureContent } from './art/rig-art.mjs';

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const S = 2;

function overlay(view) {
  const equip = { outfit: 'ski_blue', headgear: 'beanie_blue', hip_protector: 'basic_hip_protector', goggles: null };
  const marks = HOTSPOTS[view]
    .map(
      (h) =>
        `<circle cx="${h.x}" cy="${h.y}" r="${h.r}" fill="#FF3B30" fill-opacity="0.16" stroke="#FF3B30" stroke-width="2"/>` +
        `<text x="${h.x}" y="${h.y + 4}" font-size="12" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" fill="#B30000">${h.id}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width * S}" height="${CANVAS.height * S}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">
    <rect width="${CANVAS.width}" height="${CANVAS.height}" fill="#F2F6FF"/>
    ${figureContent(view, equip)}${marks}</svg>`;
  const svgFile = join(ROOT, 'build', `debug-${view}.svg`);
  mkdirSync(join(ROOT, 'build'), { recursive: true });
  writeFileSync(svgFile, svg);
  return run(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--user-data-dir=/tmp/fb-debug-${view}-${Date.now()}`,
    '--force-device-scale-factor=1', '--default-background-color=00000000',
    `--window-size=${CANVAS.width * S},${CANVAS.height * S}`,
    `--screenshot=${join(ROOT, 'build', 'review', `hotspots-${view}.png`)}`,
    `file://${svgFile}`,
  ]);
}

await Promise.all([overlay('front'), overlay('back')]);
console.log('debug overlays → build/review/hotspots-*.png');
