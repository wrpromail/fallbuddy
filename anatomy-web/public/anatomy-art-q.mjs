// anatomy-art-q.mjs —— 人体模型层 · Q 版骷髅画法
// 与小程序现有 Q 版角色同调性：约 4 头身、大头短肢、圆钝骨骺、
// 结构上仍保留“真的有解剖”的简化版（短肋弓、迷你骨盆、双节指骨），
// 方便战损部位语义与标准版一致。

import {
  INK, BONE, MUS, MUS_D, f,
  tag, dblPoly, longBone, muscle, muscleStrap, boneDot, boneBlob, spineChain,
  ovEllipse, ovRect,
} from './anatomy-art-shared.mjs';

/* ================= 中轴骨 ================= */

function skullFrontQ() {
  const dome = boneBlob([
    [260, 62], [318, 84], [330, 148], [308, 196], [260, 208], [212, 196], [190, 148], [202, 84],
  ]);
  const eyes =
    tag('circle', { cx: 234, cy: 138, r: 10, fill: INK }) +
    tag('circle', { cx: 286, cy: 138, r: 10, fill: INK }) +
    tag('circle', { cx: 231, cy: 134, r: 2.6, fill: BONE }) +
    tag('circle', { cx: 283, cy: 134, r: 2.6, fill: BONE });
  const nose = tag('circle', { cx: 260, cy: 162, r: 3.4, fill: INK });
  const mouth = tag('path', { d: 'M 242 178 Q 260 190 278 178', fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' });
  const teeth =
    tag('line', { x1: 252, y1: 181, x2: 252, y2: 189, stroke: INK, 'stroke-width': 2 }) +
    tag('line', { x1: 268, y1: 181, x2: 268, y2: 189, stroke: INK, 'stroke-width': 2 });
  const blush =
    tag('ellipse', { cx: 214, cy: 164, rx: 9, ry: 5, fill: MUS, opacity: 0.35 }) +
    tag('ellipse', { cx: 306, cy: 164, rx: 9, ry: 5, fill: MUS, opacity: 0.35 });
  const seam =
    tag('path', { d: 'M 230 92 Q 260 76 290 92', fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.5 });
  return dome + seam + eyes + nose + mouth + teeth + blush;
}

function skullBackQ() {
  const dome = boneBlob([
    [260, 62], [318, 84], [330, 148], [308, 196], [260, 208], [212, 196], [190, 148], [202, 84],
  ]);
  const seam =
    tag('path', { d: 'M 224 110 Q 260 96 296 110', fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.6 }) +
    tag('path', { d: 'M 234 140 Q 260 128 286 140', fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.6 });
  return dome + seam;
}

function claviclesQ() {
  return dblPoly([[250, 224], [230, 222], [210, 226]], 6) + dblPoly([[250, 224], [270, 222], [290, 226]], 6);
}

function ribcageQ() {
  // 3 对圆钝肋弓 + 迷你胸骨
  const hw = [54, 64, 54];
  let out = '';
  hw.forEach((w, i) => {
    const y = 236 + i * 24;
    out += dblPoly([[256, y], [260 - w, y + 6], [260 - w * 0.5, y + 16]], 5);
    out += dblPoly([[264, y], [260 + w, y + 6], [260 + w * 0.5, y + 16]], 5);
  });
  return out;
}

function sternumQ() {
  return tag('rect', { x: 255, y: 228, width: 10, height: 44, rx: 5, fill: BONE, stroke: INK, 'stroke-width': 2.4, class: 'bone' });
}

function scapulaeQ() {
  const plate = (m) => boneBlob([[204, 230], [228, 234], [236, 252], [220, 268], [202, 256], [196, 238]], { mirror: m });
  return plate(false) + plate(true);
}

function pelvisFrontQ() {
  const bowl = dblPoly([[228, 346], [206, 354], [208, 376], [236, 382], [284, 382], [312, 376], [314, 354], [292, 346]], 6);
  const pubis = dblPoly([[240, 378], [254, 386], [260, 388], [266, 386], [280, 378]], 4.5);
  const foramina =
    tag('ellipse', { cx: 238, cy: 372, rx: 4, ry: 5.5, fill: INK, opacity: 0.7 }) +
    tag('ellipse', { cx: 282, cy: 372, rx: 4, ry: 5.5, fill: INK, opacity: 0.7 });
  return bowl + pubis + foramina + boneDot(230, 372, 7) + boneDot(290, 372, 7);
}

function pelvisBackQ() {
  const bowl = dblPoly([[228, 346], [206, 354], [208, 376], [236, 382], [284, 382], [312, 376], [314, 354], [292, 346]], 6);
  const sacrum = boneBlob([[248, 356], [272, 356], [266, 380], [254, 380]]);
  return bowl + sacrum + boneDot(230, 378, 6) + boneDot(290, 378, 6);
}

/* ================= 四肢骨 ================= */

function armBonesQ(mirror) {
  return longBone(206, 240, 196, 318, 11, { mirror }) + boneDot(206, 236, 9, { mirror }) + boneDot(196, 322, 8, { mirror });
}

function forearmBonesQ(mirror) {
  return longBone(200, 330, 190, 392, 6, { mirror }) + longBone(190, 332, 186, 390, 5, { mirror });
}

function handBonesQ(cx) {
  const rel = (x) => cx + x;
  const mitt = boneBlob([[rel(-12), 402], [rel(12), 402], [rel(14), 430], [rel(0), 436], [rel(-16), 424]]);
  const fingers = [-8, 0, 8]
    .map((dx) => dblPoly([[rel(dx), 432], [rel(dx), 446]], 4) + boneDot(rel(dx), 448, 3))
    .join('');
  const thumb = dblPoly([[rel(12), 412], [rel(20), 424]], 4.5);
  return mitt + fingers + thumb;
}

function legBonesQ(view, mirror) {
  const head = boneDot(230, 378, 8, { mirror });
  const shaft = longBone(230, 384, 228, 470, 12, { mirror });
  const condyle = boneDot(228, 474, 7.5, { mirror });
  return head + shaft + condyle;
}

/** 髌骨：在膝组内、胫骨之后绘制 */
function patellaQ(view, mirror) {
  return view === 'front' ? boneDot(228, 476, 6.5, { mirror }) : '';
}

function shinBonesQ(mirror) {
  return longBone(228, 486, 226, 568, 9, { mirror }) + longBone(216, 490, 214, 570, 4.5, { mirror }) +
    boneDot(226, 574, 5, { mirror }) + boneDot(214, 576, 4, { mirror });
}

function footBonesQ(view, mirror) {
  const X = (x) => (mirror ? 520 - x : x);
  const wedge = boneBlob([[X(210), 580], [X(242), 580], [X(238), 616], [X(222), 622], [X(206), 598]]);
  const toes = [-8, 0, 8]
    .map((dx) => dblPoly([[X(228 + dx), 618], [X(228 + dx), 632]], 3.6) + boneDot(X(228 + dx), 634, 3))
    .join('');
  return wedge + toes;
}

/* ================= 肌肉 ================= */

function frontMusclesQ() {
  const pec = (m) => muscle([[238, 242], [220, 246], [212, 264], [224, 278], [242, 272], [246, 254]], { mirror: m });
  const delt = (m) => muscle([[206, 214], [190, 222], [186, 244], [196, 258], [210, 252], [218, 236]], { mirror: m });
  const biceps = (m) => muscle([[212, 258], [215, 278], [209, 296], [202, 292], [200, 268]], { mirror: m });
  const fore = (m) => muscle([[200, 334], [202, 356], [194, 380], [186, 390], [182, 368], [190, 336]], { mirror: m });
  let abs = '';
  for (const cx of [247, 273]) {
    for (const y of [296, 312]) {
      abs += tag('rect', { x: cx - 7, y, width: 14, height: 13, rx: 4, fill: MUS, stroke: MUS_D, 'stroke-width': 1.8, class: 'muscle' });
    }
  }
  const quad = (m) => muscle([[232, 384], [222, 414], [226, 448], [236, 458], [244, 440], [242, 406]], { mirror: m });
  const tib = (m) => muscleStrap([[221, 492], [218, 516], [216, 540]], 6, { mirror: m });
  return {
    torso: pec(false) + pec(true) + abs,
    armL: delt(false) + biceps(false), armR: delt(true) + biceps(true),
    foreL: fore(false), foreR: fore(true),
    torsoOuter: '',
    legL: quad(false), legR: quad(true),
    shinL: tib(false), shinR: tib(true),
  };
}

function backMusclesQ() {
  const traps = muscle([[260, 206], [212, 228], [224, 252], [260, 258], [296, 252], [308, 228]]);
  const lat = (m) => muscle([[246, 250], [222, 256], [214, 282], [226, 306], [246, 314], [250, 282]], { mirror: m });
  const delt = (m) => muscle([[206, 214], [190, 222], [186, 244], [196, 258], [210, 252], [218, 236]], { mirror: m });
  const tri = (m) => muscle([[202, 260], [206, 282], [200, 300], [194, 296], [192, 270]], { mirror: m });
  const erector = (m) => muscleStrap([[252, 300], [251, 326], [253, 344]], 7, { mirror: m });
  const glute = (m) => muscle([[232, 376], [216, 382], [212, 404], [224, 416], [240, 410], [242, 390]], { mirror: m });
  const ham = (m) => muscleStrap([[224, 420], [220, 444], [224, 464]], 8, { mirror: m }) + muscleStrap([[236, 420], [234, 446], [236, 464]], 6, { mirror: m });
  const calf = (m) => muscle([[218, 494], [230, 490], [240, 498], [242, 524], [232, 540], [218, 534], [212, 512]], { mirror: m });
  return {
    torso: '',
    torsoOuter: lat(false) + lat(true) + traps,
    rootOuter: erector(false) + erector(true),
    armL: delt(false) + tri(false), armR: delt(true) + tri(true),
    foreL: '', foreR: '',
    legL: glute(false) + ham(false), legR: glute(true) + ham(true),
    shinL: calf(false), shinR: calf(true),
  };
}

/* ================= 关节与视图 ================= */

export const JOINTS = {
  root: { pivot: [260, 352] },
  torso: { pivot: [260, 300] },
  breath: { scaleAround: [260, 258] },
  neck: { pivot: [260, 206] },
  shoulderL: { pivot: [206, 232] }, shoulderR: { pivot: [314, 232] },
  elbowL: { pivot: [196, 322] }, elbowR: { pivot: [324, 322] },
  wristL: { pivot: [188, 398] }, wristR: { pivot: [332, 398] },
  hipL: { pivot: [230, 372] }, hipR: { pivot: [290, 372] },
  kneeL: { pivot: [228, 478] }, kneeR: { pivot: [292, 478] },
  ankleL: { pivot: [226, 576] }, ankleR: { pivot: [294, 576] },
};

export function buildBodyMarkup(view, layerMode) {
  const showBones = layerMode === 'bones' || layerMode === 'both';
  const showMuscles = layerMode === 'muscles' || layerMode === 'both';
  const front = view === 'front';
  const M = front ? frontMusclesQ() : backMusclesQ();
  const bonesOf = (fn, ...a) => (showBones ? fn(...a) : '');
  const musOf = (s) => (showMuscles ? s : '');

  const arm = (side) => {
    const mirror = side === 'R';
    return (
      musOf(M['arm' + side]) +
      bonesOf(armBonesQ, mirror) +
      tag('g', { id: `j:elbow${side}` },
        bonesOf(forearmBonesQ, mirror) +
        musOf(M['fore' + side]) +
        tag('g', { id: `j:wrist${side}` }, bonesOf(handBonesQ, mirror ? 332 : 188)))
    );
  };
  const leg = (side) => {
    const mirror = side === 'R';
    return (
      musOf(M['leg' + side]) +
      bonesOf(legBonesQ, view, mirror) +
      tag('g', { id: `j:knee${side}` },
        bonesOf(shinBonesQ, mirror) +
        bonesOf(patellaQ, view, mirror) +
        musOf(M['shin' + side]) +
        tag('g', { id: `j:ankle${side}` }, bonesOf(footBonesQ, view, mirror)))
    );
  };

  const breathInner = front
    ? bonesOf(ribcageQ) + bonesOf(sternumQ) + bonesOf(claviclesQ) + musOf(M.torso)
    : bonesOf(ribcageQ) + bonesOf(scapulaeQ) + musOf(M.torso);

  const torso =
    tag('g', { id: 'j:breath' }, breathInner) +
    musOf(M.torsoOuter) +
    tag('g', { id: 'j:shoulderL' }, arm('L')) +
    tag('g', { id: 'j:shoulderR' }, arm('R')) +
    tag('g', { id: 'j:neck' }, bonesOf(front ? skullFrontQ : skullBackQ));

  const core =
    (front ? bonesOf(pelvisFrontQ) : bonesOf(pelvisBackQ)) +
    (front ? bonesOf(() => spineChain(306, 344, { w: 14, h: 9 })) : bonesOf(() => spineChain(210, 344, { w: 12, h: 8 }))) +
    (front ? bonesOf(() => spineChain(210, 226, { w: 10, h: 6 })) : '') +
    musOf(M.rootOuter ?? '');

  return tag('g', { id: 'j:root' },
    core +
    tag('g', { id: 'j:torso' }, torso) +
    tag('g', { id: 'j:hipL' }, leg('L')) +
    tag('g', { id: 'j:hipR' }, leg('R')));
}

/* ================= 覆盖层 ================= */

const CHAINQ = (m) => [
  ovEllipse('upper_arm', 199, 280, 18, 46, m),
  ovEllipse('forearm', 192, 362, 16, 40, m),
  ovEllipse('hand', 188, 418, 20, 30, m),
  ovEllipse('thigh', 228, 428, 24, 50, m),
  ovEllipse('knee', 228, 478, 18, 20, m),
  ovEllipse('shin', 224, 528, 18, 52, m),
  ovEllipse('ankle_foot', 226, 600, 22, 40, m),
];

const FRONT_OVERLAYS_Q = [
  ovEllipse('head', 260, 134, 72, 76),
  ovRect('neck', 240, 198, 40, 26),
  ovEllipse('shoulder', 206, 232, 24, 26, false),
  ovEllipse('shoulder', 206, 232, 24, 26, true),
  ovRect('chest', 208, 228, 104, 86),
  ovRect('abdomen', 220, 314, 80, 44),
  ovEllipse('pelvis_hip', 260, 394, 60, 42),
  ...CHAINQ(false), ...CHAINQ(true),
];

const BACK_OVERLAYS_Q = [
  ovEllipse('head', 260, 134, 72, 76),
  ovRect('neck', 240, 196, 40, 28),
  ovEllipse('shoulder', 206, 232, 24, 26, false),
  ovEllipse('shoulder', 206, 232, 24, 26, true),
  ovRect('back_spine', 206, 210, 108, 140),
  ovEllipse('pelvis_hip', 260, 396, 60, 44),
  ...CHAINQ(false), ...CHAINQ(true),
];

export function getOverlays(view) {
  return view === 'front' ? FRONT_OVERLAYS_Q : BACK_OVERLAYS_Q;
}

export const STYLE_META = { id: 'q', label: 'Q版骷髅' };

/* ================= 动作（Q 版手臂短，可以整臂高举风车） ================= */

export const ACTIONS = {
  wave: {
    label: '挥手',
    duration: 2600,
    frames: [
      { t: 0, pose: {} },
      { t: 0.22, pose: { shoulderR: -150, elbowR: -28, neck: 6 } },
      { t: 0.34, pose: { shoulderR: -150, elbowR: -12, neck: 6 } },
      { t: 0.46, pose: { shoulderR: -150, elbowR: -28, neck: 6 } },
      { t: 0.58, pose: { shoulderR: -150, elbowR: -12, neck: 6 } },
      { t: 0.7, pose: { shoulderR: -150, elbowR: -28, neck: 6 } },
      { t: 0.86, pose: { shoulderR: -140 } },
      { t: 1, pose: {} },
    ],
  },
  fall: {
    label: '摔倒回放',
    duration: 3400,
    frames: [
      { t: 0, pose: {} },
      { t: 0.18, pose: { root: -10, torso: 10, shoulderL: 30, shoulderR: -30, elbowL: 12, elbowR: -12, neck: -6 } },
      { t: 0.42, pose: { root: -48, rootX: 30, rootY: 60, torso: 8, hipL: 10, hipR: -10, kneeL: -20, kneeR: 20, shoulderL: 22, shoulderR: -22 } },
      { t: 0.56, pose: { root: -44, rootX: 28, rootY: 52, torso: 8, hipL: 10, hipR: -10, kneeL: -20, kneeR: 20, shoulderL: 18, shoulderR: -18 } },
      { t: 0.72, pose: { root: -48, rootX: 30, rootY: 60, torso: 8, hipL: 10, hipR: -10, kneeL: -20, kneeR: 20, shoulderL: 22, shoulderR: -22 } },
      { t: 1, pose: {} },
    ],
  },
  neckRoll: {
    label: '颈部活动',
    duration: 2200,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { neck: -10 } },
      { t: 0.5, pose: { neck: 12 } },
      { t: 0.75, pose: { neck: -6 } },
      { t: 1, pose: {} },
    ],
  },
  armCircle: {
    label: '肩部环绕',
    duration: 2400,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.125, pose: { shoulderR: -60 } },
      { t: 0.25, pose: { shoulderR: -120 } },
      { t: 0.375, pose: { shoulderR: -180 } },
      { t: 0.5, pose: { shoulderR: -240 } },
      { t: 0.625, pose: { shoulderR: -300 } },
      { t: 0.75, pose: { shoulderR: -360 } },
      { t: 1, pose: {} },
    ],
  },
  elbowFlex: {
    label: '屈伸手肘',
    duration: 2000,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { shoulderL: 12, elbowL: 95 } },
      { t: 0.5, pose: { shoulderL: 8, elbowL: 12 } },
      { t: 0.75, pose: { shoulderL: 12, elbowL: 95 } },
      { t: 1, pose: {} },
    ],
  },
  wristFlick: {
    label: '手腕摆动',
    duration: 1600,
    loops: 3,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { wristL: 24 } },
      { t: 0.5, pose: { wristL: -18 } },
      { t: 0.75, pose: { wristL: 24 } },
      { t: 1, pose: {} },
    ],
  },
  spineSway: {
    label: '躯干转体',
    duration: 2600,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { torso: 8, neck: -5, shoulderL: -12, shoulderR: 8 } },
      { t: 0.5, pose: { torso: -7, neck: 4, shoulderL: 8, shoulderR: -12 } },
      { t: 0.75, pose: { torso: 8, neck: -5, shoulderL: -12, shoulderR: 8 } },
      { t: 1, pose: {} },
    ],
  },
  hipSway: {
    label: '骨盆摆动',
    duration: 2400,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { rootX: 10, hipL: 5, hipR: -5, torso: -5 } },
      { t: 0.5, pose: { rootX: -10, hipL: -5, hipR: 5, torso: 5 } },
      { t: 0.75, pose: { rootX: 10, hipL: 5, hipR: -5, torso: -5 } },
      { t: 1, pose: {} },
    ],
  },
  squat: {
    label: '屈膝演示',
    duration: 2400,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.3, pose: { rootY: 20, hipL: 12, hipR: -12, kneeL: -22, kneeR: 22, torso: 6 } },
      { t: 0.5, pose: { rootY: 20, hipL: 12, hipR: -12, kneeL: -22, kneeR: 22, torso: 6 } },
      { t: 1, pose: {} },
    ],
  },
  ankleFlex: {
    label: '踝部屈伸',
    duration: 1800,
    loops: 3,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { ankleL: 22, ankleR: -22 } },
      { t: 0.5, pose: { ankleL: -16, ankleR: 16 } },
      { t: 0.75, pose: { ankleL: 22, ankleR: -22 } },
      { t: 1, pose: {} },
    ],
  },
};
