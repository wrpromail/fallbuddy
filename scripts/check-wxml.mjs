#!/usr/bin/env node
/**
 * 无开发者工具时的 WXML 静态检查：
 *  - 标签配对 / 自闭合
 *  - {{ }} 表达式语法（用 Function 编译，不执行）
 *  - bind/catch 事件处理函数是否存在于同目录 .ts
 *  - wx:for 是否带 wx:key
 *  - 自定义组件是否在 app.json 或页面 json 中声明
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MP = join(ROOT, 'miniprogram');
const app = JSON.parse(readFileSync(join(MP, 'app.json'), 'utf8'));
const globalComponents = new Set(Object.keys(app.usingComponents || {}));
const errors = [];
const warnings = [];

const VOID_TAGS = new Set(['input', 'image', 'switch', 'icon', 'progress', 'slider', 'checkbox', 'radio', 'textarea']);
const BUILTIN_HYPHEN = new Set([
  'scroll-view',
  'cover-view',
  'cover-image',
  'rich-text',
  'web-view',
  'movable-area',
  'movable-view',
  'picker-view',
  'picker-view-column',
  'swiper-item',
  'functional-page-navigator',
  'match-media',
  'page-container',
  'share-element',
  'root-portal',
  'page-meta',
  'navigation-bar',
  'keyboard-accessory',
  'grid-view',
  'list-view',
  'sticky-header',
  'sticky-section',
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.wxml')) out.push(full);
  }
  return out;
}

function propertiesOf(componentPath) {
  const tsFile = join(MP, componentPath.replace(/^\//, '') + '.ts');
  if (!existsSync(tsFile)) return null;
  const source = readFileSync(tsFile, 'utf8');
  const start = source.indexOf('properties');
  if (start < 0) return new Set();
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) return new Set();
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const body = source.slice(braceStart + 1, end);
  const names = new Set();
  let level = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      level += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      continue;
    }
    if (level === 0) {
      const match = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:/);
      if (match) names.add(match[1]);
    }
    level += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
  }
  return names;
}

const componentProps = new Map();
for (const path of new Set(Object.values(app.usingComponents || {}))) {
  const props = propertiesOf(path);
  if (props) componentProps.set(path.split('/').filter(Boolean).pop(), props);
}

function checkComponentAttributes(rel, src, pageJson) {
  const local = Object.assign({}, app.usingComponents || {}, pageJson.usingComponents || {});
  for (const [tag, path] of Object.entries(local)) {
    if (!new RegExp(`<${tag}[\\s/>]`).test(src)) continue;
    const props = propertiesOf(path);
    if (!props) continue;
    const tagRe = new RegExp(`<${tag}([^>]*?)/?>`, 'g');
    for (const match of src.matchAll(tagRe)) {
      const attrs = match[1];
      for (const attr of attrs.matchAll(/([A-Za-z][\w:.-]*)(?:\s*=\s*"[^"]*")?/g)) {
        const raw = attr[1];
        if (/^(class|style|id|slot|hidden|hover-class)$/.test(raw)) continue;
        if (/^(bind|catch|mut-bind|capture-bind|capture-catch)/.test(raw)) continue;
        if (raw.startsWith('wx:') || raw.startsWith('data-') || raw.startsWith('aria-') || raw.startsWith('generic:')) continue;
        const camel = raw.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
        if (!props.has(camel) && !props.has(raw)) {
          errors.push(`${rel}: <${tag}> 的属性 ${raw} 未在组件 properties 中声明`);
        }
      }
    }
  }
}

function pageJsonFor(wxmlFile) {
  const jsonFile = wxmlFile.replace(/\.wxml$/, '.json');
  if (!existsSync(jsonFile)) return { usingComponents: {} };
  return JSON.parse(readFileSync(jsonFile, 'utf8'));
}

for (const file of walk(MP)) {
  const rel = file.replace(ROOT + '/', '');
  const src = readFileSync(file, 'utf8');
  const tsFile = file.replace(/\.wxml$/, '.ts');
  const ts = existsSync(tsFile) ? readFileSync(tsFile, 'utf8') : '';

  // 1) 表达式语法
  for (const match of src.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const expr = match[1].trim();
    if (!expr) continue;
    try {
      // 仅编译不执行；用 with 允许任意字段访问
      new Function('__data', `with (__data) { return (${expr}); }`);
    } catch (error) {
      errors.push(`${rel}: 表达式语法错误 {{${expr}}} → ${error.message}`);
    }
  }

  // 2) 标签配对（先去掉 mustache，避免 > 干扰）
  const stripped = src.replace(/\{\{[\s\S]*?\}\}/g, '0');
  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^<>]*?)(\/?)>/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(stripped))) {
    const closing = tagMatch[1] === '/';
    const name = tagMatch[2];
    const selfClosing = tagMatch[4] === '/';
    if (closing) {
      const last = stack.pop();
      if (last !== name) {
        errors.push(`${rel}: 标签不匹配 </${name}>，期望 </${last || '无'}>`);
        break;
      }
    } else if (!selfClosing && !VOID_TAGS.has(name)) {
      stack.push(name);
    }
  }
  if (stack.length) errors.push(`${rel}: 未闭合标签 ${stack.join(', ')}`);

  // 3) 事件处理函数
  const handlerRe = /(?:bind|catch)(?::?[a-z]+)="([A-Za-z_$][\w$]*)"/g;
  for (const match of src.matchAll(handlerRe)) {
    const handler = match[1];
    const found = new RegExp(`\\b${handler}\\s*[:(]`).test(ts) || new RegExp(`\\b${handler}\\b`).test(ts);
    if (!found) errors.push(`${rel}: 事件处理函数 ${handler} 在 ${tsFile.replace(ROOT + '/', '')} 中未找到`);
  }

  // 4) wx:for 必须有 wx:key
  const blockRe = /<([a-zA-Z][\w-]*)([^<>]*?wx:for=[^<>]*?)>/g;
  for (const match of src.matchAll(blockRe)) {
    if (!/wx:key=/.test(match[2])) warnings.push(`${rel}: <${match[1]}> 使用了 wx:for 但没有 wx:key`);
  }

  // 5) 自定义组件声明 + 属性声明
  const pageJson = pageJsonFor(file);
  checkComponentAttributes(rel, stripped, pageJson);
  const allowed = new Set([...globalComponents, ...Object.keys(pageJson.usingComponents || {})]);
  const componentRe = /<([a-z][a-z0-9]*-[a-z0-9-]+)/g;
  for (const match of src.matchAll(componentRe)) {
    const tag = match[1];
    if (BUILTIN_HYPHEN.has(tag)) continue;
    if (!allowed.has(tag)) errors.push(`${rel}: 组件 <${tag}> 未在 app.json / 页面 json 中声明`);
  }
}

if (warnings.length) {
  console.log(`WXML 警告（${warnings.length}）：`);
  for (const warning of warnings) console.log(' - ' + warning);
}
if (errors.length) {
  console.error(`WXML 检查失败（${errors.length}）：`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}
console.log('WXML 检查通过：表达式、标签、事件处理函数、wx:key、组件声明。');
