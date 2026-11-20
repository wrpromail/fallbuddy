// anatomy-art-shared.mjs —— 人体模型层 · 共享绘制原语
// 标准解剖与 Q 版两种风格共用：SVG 标签生成、双描骨骼线、平滑肌块、
// 长骨、覆盖层元素。颜色与坐标常量也在这里统一。

import { REGION_LABEL } from './anatomy-data.mjs';

export const INK = '#3a352d';
export const BONE = '#f0e8d4';
export const MUS = '#d98a75';
export const MUS_D = '#a35440';

/** 画布约定：520×760，中线 x=260；左侧形状显式定义，右侧 MX() 镜像 */
export const CANVAS = { width: 520, height: 760 };
export const f = (n) => Number(n).toFixed(1).replace(/\.0$/, '');
export const MX = (x) => f(520 - x);

export function attrs(a) {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${String(v).replace(/"/g, '&quot;')}"`))
    .join(' ');
}

export function tag(name, a = {}, children = '') {
  return children === '' && !['g', 'svg', 'text'].includes(name)
    ? `<${name} ${attrs(a)}/>`
    : `<${name} ${attrs(a)}>${children}</${name}>`;
}

/** 折线双描：深色打底 + 浅色主体 → 带轮廓的“骨骼线” */
export function dblPoly(pts, w, { fill = BONE, edge = INK, cls = 'bone', mirror = false } = {}) {
  const p = mirror ? pts.map(([x, y]) => [520 - x, y]) : pts;
  const d = 'M ' + p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ');
  return (
    tag('path', { d, fill: 'none', stroke: edge, 'stroke-width': f(w + 4.5), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }) +
    tag('path', { d, fill: 'none', stroke: fill, 'stroke-width': f(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: cls })
  );
}

/** 长骨：骨干双描 + 两端骨骺圆 */
export function longBone(x1, y1, x2, y2, w, { mirror = false } = {}) {
  const X = (x) => (mirror ? 520 - x : x);
  return (
    dblPoly([[X(x1), y1], [X(x2), y2]], w, { mirror: false }) +
    tag('circle', { cx: f(X(x1)), cy: f(y1), r: f(w * 0.85 + 2.2), fill: INK }) +
    tag('circle', { cx: f(X(x1)), cy: f(y1), r: f(w * 0.85), fill: BONE, stroke: INK, 'stroke-width': 2, class: 'bone' }) +
    tag('circle', { cx: f(X(x2)), cy: f(y2), r: f(w * 0.7 + 2.2), fill: INK }) +
    tag('circle', { cx: f(X(x2)), cy: f(y2), r: f(w * 0.7), fill: BONE, stroke: INK, 'stroke-width': 2, class: 'bone' })
  );
}

/** Catmull-Rom 闭合平滑曲线 */
export function blobD(pts, { mirror = false } = {}) {
  const p = (mirror ? pts.map(([x, y]) => [520 - x, y]) : pts).map(([x, y]) => [+x, +y]);
  const n = p.length;
  let d = `M ${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + ' Z';
}

/** 肌肉团块：闭合平滑形状 + 可选肌纤维暗示线 */
export function muscle(pts, { mirror = false, fiber = [] } = {}) {
  const fib = (mirror ? fiber.map(([x1, y1, x2, y2]) => [520 - x1, y1, 520 - x2, y2]) : fiber)
    .map(([x1, y1, x2, y2]) =>
      tag('path', {
        d: `M ${f(x1)} ${f(y1)} Q ${f((x1 + x2) / 2)} ${f((y1 + y2) / 2 + 6)} ${f(x2)} ${f(y2)}`,
        fill: 'none', stroke: MUS_D, 'stroke-width': 1.6, opacity: 0.55,
      }),
    )
    .join('');
  return tag('path', { d: blobD(pts, { mirror }), fill: MUS, stroke: MUS_D, 'stroke-width': 2.4, class: 'muscle' }, fib);
}

/** 肌肉条带（胸锁乳突肌、竖脊肌、跟腱等） */
export function muscleStrap(pts, w, { mirror = false } = {}) {
  const p = mirror ? pts.map(([x, y]) => [520 - x, y]) : pts;
  const d = 'M ' + p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ');
  return (
    tag('path', { d, fill: 'none', stroke: MUS_D, 'stroke-width': f(w + 3.6), 'stroke-linecap': 'round' }) +
    tag('path', { d, fill: 'none', stroke: MUS, 'stroke-width': f(w), 'stroke-linecap': 'round', class: 'muscle' })
  );
}

/** 小圆骨块（骨骺、籽骨等） */
export function boneDot(x, y, r, { mirror = false } = {}) {
  const cx = mirror ? 520 - x : x;
  return (
    tag('circle', { cx: f(cx), cy: f(y), r: f(r + 1.6), fill: INK }) +
    tag('circle', { cx: f(cx), cy: f(y), r: f(r), fill: BONE, stroke: INK, 'stroke-width': 2, class: 'bone' })
  );
}

/** 骨骼团块（颅骨、骨盆、肩胛、足等） */
export function boneBlob(pts, { mirror = false } = {}) {
  return tag('path', { d: blobD(pts, { mirror }), fill: BONE, stroke: INK, 'stroke-width': 2.6, class: 'bone' });
}

/** 椎骨链：fromY→toY 的分节矩形 */
export function spineChain(fromY, toY, { w = 13, h = 9, gap = 2 } = {}) {
  const n = Math.max(2, Math.round((toY - fromY) / (h + gap)));
  let out = '';
  for (let i = 0; i <= n; i++) {
    const y = fromY + ((toY - fromY) * i) / n;
    out += tag('rect', { x: f(260 - w / 2), y: f(y), width: w, height: h, rx: f(w * 0.28), fill: BONE, stroke: INK, 'stroke-width': 2, class: 'bone' });
  }
  return out;
}

/* ---------------- 覆盖层（点击热区 + 热力着色 + 徽标锚点） ---------------- */

export function ovEllipse(regionId, cx, cy, rx, ry, mirror = false) {
  return {
    regionId,
    shape: { kind: 'ellipse', cx: mirror ? +MX(cx) : +cx, cy: +cy, rx: +rx, ry: +ry },
    label: [mirror ? +MX(cx) : +cx, +cy],
  };
}
export function ovRect(regionId, x, y, w, h) {
  return { regionId, shape: { kind: 'rect', x: +x, y: +y, width: +w, height: +h }, label: [+x + w / 2, +y + h / 2] };
}

/** 覆盖层形状 → SVG 元素（fill 由热力状态决定） */
export function overlayElement(o, { fill, selected }) {
  const s = o.shape;
  const base = { 'data-region': o.regionId, class: 'ov' + (selected ? ' sel' : ''), fill };
  const title = tag('title', {}, REGION_LABEL[o.regionId] ?? o.regionId);
  if (s.kind === 'ellipse') {
    return tag('ellipse', { ...base, cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry }, title);
  }
  return tag('rect', { ...base, x: s.x, y: s.y, width: s.width, height: s.height, rx: 14 }, title);
}
