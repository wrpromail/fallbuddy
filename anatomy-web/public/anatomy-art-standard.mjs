// anatomy-art-standard.mjs —— 人体模型层 · 标准解剖画法
// 目标是“插画风的解剖图”：比例按 7 头身，结构按解剖学——颅骨（颅顶/眶/鼻切迹/
// 颧/齿/下颌）、颈椎、胸廓（9 对肋 + 胸骨柄/体/剑突）、真骨盆（髂骨翼/耻骨弓/
// 闭孔/髋臼）、长骨带骨骺、腕骨-掌骨-指骨分节、跗骨-跖骨-趾骨。
// 肌肉按起止点走向：胸大肌扇形、三角肌帽、腹直肌腱划、股四头肌三束、
// 斜方肌菱形、背阔翼、臀大肌、腘绳肌双束、腓肠肌双头 + 跟腱。

import {
  INK, BONE, MUS, MUS_D, f, MX,
  tag, dblPoly, longBone, muscle, muscleStrap, boneDot, boneBlob, spineChain,
  ovEllipse, ovRect,
} from './anatomy-art-shared.mjs';

/* ================= 中轴骨 ================= */

function skullFront() {
  const cranium = boneBlob([
    [260, 46], [288, 54], [300, 80], [298, 104], [290, 122], [272, 132], [248, 132], [230, 122], [222, 104], [220, 80], [232, 54],
  ]);
  const maxilla = boneBlob([[236, 116], [284, 116], [288, 134], [278, 142], [242, 142], [232, 134]]);
  const mandible = boneBlob([[228, 122], [226, 140], [238, 152], [260, 156], [282, 152], [294, 140], [292, 122]]);
  const orbits =
    tag('ellipse', { cx: 244, cy: 88, rx: 8.5, ry: 10, fill: INK }) +
    tag('ellipse', { cx: 276, cy: 88, rx: 8.5, ry: 10, fill: INK });
  const nasal = tag('path', { d: 'M 260 96 L 254 114 L 266 114 Z', fill: INK });
  const teeth = [248, 256, 264, 272]
    .map((x) => tag('line', { x1: x, y1: 132, x2: x, y2: 142, stroke: INK, 'stroke-width': 2 }))
    .join('');
  const zygoma =
    tag('path', { d: 'M 226 106 Q 236 114 248 112', fill: 'none', stroke: INK, 'stroke-width': 2 }) +
    tag('path', { d: 'M 294 106 Q 284 114 272 112', fill: 'none', stroke: INK, 'stroke-width': 2 });
  const temporal =
    tag('path', { d: 'M 222 76 Q 230 66 244 62', fill: 'none', stroke: INK, 'stroke-width': 1.6, opacity: 0.6 }) +
    tag('path', { d: 'M 298 76 Q 290 66 276 62', fill: 'none', stroke: INK, 'stroke-width': 1.6, opacity: 0.6 });
  return cranium + maxilla + mandible + orbits + nasal + teeth + zygoma + temporal;
}

function skullBack() {
  const dome = boneBlob([
    [260, 46], [288, 54], [300, 80], [298, 104], [290, 120], [272, 130], [248, 130], [230, 120], [222, 104], [220, 80], [232, 54],
  ]);
  const lambdoid =
    tag('path', { d: 'M 232 76 Q 244 58 260 62', fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.7 }) +
    tag('path', { d: 'M 288 76 Q 276 58 260 62', fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.7 }) +
    tag('path', { d: 'M 232 76 Q 260 88 288 76', fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.7 });
  const occiput = boneDot(260, 110, 4.5);
  return dome + lambdoid + occiput;
}

function clavicles() {
  // S 形曲度：从胸骨柄向外后行
  return dblPoly([[256, 190], [236, 186], [216, 192], [202, 197]], 5.5) +
    dblPoly([[256, 190], [276, 186], [296, 192], [310, 197]], 5.5);
}

function ribcage() {
  // 9 对肋：外扩后内收，末两对“浮肋”缩短
  const hw = [38, 56, 72, 84, 92, 96, 92, 80, 62];
  let out = '';
  hw.forEach((w, i) => {
    const y = 196 + i * 13.5;
    const floating = i >= 7;
    const width = floating ? w * 0.72 : w;
    out += dblPoly([[259, y], [260 - width * 0.9, y + 4], [260 - width, y + 13], [260 - width * 0.45, y + 23]], 4.4);
    out += dblPoly([[261, y], [260 + width * 0.9, y + 4], [260 + width, y + 13], [260 + width * 0.45, y + 23]], 4.4);
  });
  return out;
}

function sternum() {
  // 胸骨柄 + 体 + 剑突
  return (
    tag('rect', { x: 253, y: 192, width: 14, height: 16, rx: 5, fill: BONE, stroke: INK, 'stroke-width': 2.4, class: 'bone' }) +
    tag('rect', { x: 255, y: 208, width: 10, height: 52, rx: 4, fill: BONE, stroke: INK, 'stroke-width': 2.4, class: 'bone' }) +
    tag('rect', { x: 257, y: 260, width: 6, height: 9, rx: 3, fill: BONE, stroke: INK, 'stroke-width': 2, class: 'bone' })
  );
}

function scapulae() {
  const plate = (m) => {
    const spineD = `M ${m ? 322 : 198} 196 Q ${m ? 302 : 218} 210 ${m ? 288 : 232} 234`;
    return (
      boneBlob([[196, 186], [226, 192], [240, 206], [232, 246], [214, 266], [196, 248], [186, 220]], { mirror: m }) +
      dblPoly([[196, 186], [188, 178], [180, 178]], 5.5, { mirror: m }) +
      tag('path', { d: spineD, fill: 'none', stroke: INK, 'stroke-width': 1.8, opacity: 0.7 })
    );
  };
  return plate(false) + plate(true);
}

function pelvisFront() {
  const ilium = (m) => boneBlob([[238, 378], [216, 388], [208, 410], [220, 430], [238, 434], [250, 420], [250, 392]], { mirror: m });
  const pubis = dblPoly([[238, 432], [252, 442], [260, 446], [268, 442], [282, 432]], 5);
  const foramina =
    tag('ellipse', { cx: 240, cy: 438, rx: 5, ry: 7, fill: INK, opacity: 0.75 }) +
    tag('ellipse', { cx: 280, cy: 438, rx: 5, ry: 7, fill: INK, opacity: 0.75 });
  const sacrumPeek = boneBlob([[248, 396], [272, 396], [264, 416], [256, 416]]);
  return ilium(false) + ilium(true) + sacrumPeek + pubis + foramina;
}

function pelvisBack() {
  const crests = (m) => dblPoly([[250, 380], [224, 384], [210, 400], [220, 412], [242, 414]], 6, { mirror: m });
  const sacrum = boneBlob([[246, 394], [274, 394], [266, 424], [254, 424]]);
  const foramina = [400, 408, 416, 424]
    .flatMap((y) => [tag('circle', { cx: 253, cy: y, r: 2.2, fill: INK, opacity: 0.6 }), tag('circle', { cx: 267, cy: y, r: 2.2, fill: INK, opacity: 0.6 })])
    .join('');
  return crests(false) + crests(true) + sacrum + foramina;
}

/* ================= 四肢骨 ================= */

function armBones(view, mirror) {
  // 肱骨：肱骨头 + 干 + 远端髁
  return (
    longBone(198, 208, 190, 318, 8.5, { mirror }) +
    boneDot(198, 196, 9.5, { mirror }) +
    boneDot(190, 322, 7.5, { mirror })
  );
}

function forearmBones(view, mirror) {
  // 尺骨 + 桡骨，中间留骨间膜间隙
  const out = longBone(190, 330, 186, 428, 5.2, { mirror }) +
    longBone(180, 332, 178, 424, 4.2, { mirror });
  if (view !== 'back') return out;
  // 背视图加鹰嘴突
  return dblPoly([[186, 326], [188, 314], [180, 318]], 5.5, { mirror }) + out;
}

function handBones(cx) {
  // 腕骨簇 + 掌骨 + 指骨（相对 cx 定义，左右手各传中心）
  const rel = (x) => cx + x;
  const carpals = [[-8, 436], [0, 434], [8, 436], [-10, 444], [4, 444]]
    .map(([dx, y]) => tag('circle', { cx: f(rel(dx)), cy: y, r: 3.4, fill: BONE, stroke: INK, 'stroke-width': 1.6, class: 'bone' }))
    .join('');
  const fingers = [
    { dx: -11, end: 500 }, { dx: -4, end: 510 }, { dx: 3, end: 504 }, { dx: 10, end: 494 },
  ]
    .map(({ dx, end }) => dblPoly([[rel(dx), 450], [rel(dx), 484], [rel(dx), end]], 3.4) + boneDot(rel(dx), 484, 3.2))
    .join('');
  const thumb = dblPoly([[rel(8), 450], [rel(17), 464], [rel(21), 478]], 4.4);
  return carpals + fingers + thumb;
}

function legBones(view, mirror) {
  const X = (x) => (mirror ? 520 - x : x);
  const head = boneDot(236, 436, 7.5, { mirror });
  const neck = dblPoly([[236, 438], [226, 444]], 6, { mirror });
  const trochanter = boneDot(220, 448, 6.5, { mirror });
  const shaft = longBone(222, 452, 228, 560, 10, { mirror });
  const condyles = boneDot(222, 566, 7, { mirror }) + boneDot(234, 566, 7, { mirror });
  return head + neck + trochanter + shaft + condyles;
}

/** 髌骨：在膝组内、胫骨之后绘制（解剖位：髌骨覆于胫骨平台前方） */
function patella(view, mirror) {
  return view === 'front' ? boneDot(228, 570, 6.5, { mirror }) : '';
}

function shinBones(view, mirror) {
  const plateau = boneDot(228, 576, 7, { mirror });
  const tibia = longBone(228, 580, 226, 688, 8, { mirror });
  const fibula = longBone(216, 584, 214, 690, 4, { mirror });
  const malleoli = boneDot(226, 692, 5.5, { mirror }) + boneDot(214, 694, 4.5, { mirror });
  return plateau + tibia + fibula + malleoli;
}

function footBones(view, cx, mirror) {
  const X = (x) => (mirror ? 520 - x : x);
  const talus = boneDot(X(226), 700, 5.5);
  const calcaneus = boneBlob([[X(210), 700], [X(238), 700], [X(236), 720], [X(212), 720]]);
  const tarsals = [[218, 724], [228, 726], [238, 724]]
    .map(([x, y]) => tag('circle', { cx: f(X(x)), cy: y, r: 3.2, fill: BONE, stroke: INK, 'stroke-width': 1.6, class: 'bone' }))
    .join('');
  const rays = [214, 222, 230, 238, 246]
    .map((x) => dblPoly([[X(x), 730], [X(x), 744]], 3.4) + boneDot(X(x), 748, 3))
    .join('');
  if (view === 'back') {
    const heel = boneBlob([[X(208), 696], [X(240), 696], [X(238), 722], [X(214), 724]]);
    return talus + heel + rays;
  }
  return talus + calcaneus + tarsals + rays;
}

/* ================= 肌肉（左定义、右镜像） ================= */

function frontMuscles() {
  const scm = muscleStrap([[244, 140], [252, 164], [258, 184]], 5) +
    muscleStrap([[244, 140], [252, 164], [258, 184]], 5, { mirror: true });
  const pec = (m) => muscle(
    [[254, 206], [254, 248], [240, 254], [220, 240], [212, 224], [220, 208], [238, 200]],
    { mirror: m, fiber: [[250, 216, 220, 214]] },
  );
  const deltoid = (m) => muscle(
    [[198, 172], [180, 182], [174, 206], [180, 230], [198, 242], [214, 234], [220, 208], [216, 184]],
    { mirror: m, fiber: [[194, 182, 182, 214]] },
  );
  const biceps = (m) => muscle([[202, 226], [206, 254], [200, 280], [192, 276], [188, 248], [194, 224]], { mirror: m });
  const forearm = (m) => muscle(
    [[198, 324], [200, 352], [192, 382], [182, 410], [176, 424], [172, 398], [178, 356], [186, 326]],
    { mirror: m, fiber: [[198, 336, 180, 414]] },
  );
  let abs = '';
  for (const cx of [248, 273]) {
    for (const y of [304, 321, 338]) {
      abs += tag('rect', { x: cx - 6.5, y, width: 13, height: 14, rx: 4, fill: MUS, stroke: MUS_D, 'stroke-width': 1.8, class: 'muscle' });
    }
    abs += tag('rect', { x: cx - 5.5, y: 356, width: 11, height: 9, rx: 4, fill: MUS, stroke: MUS_D, 'stroke-width': 1.8, class: 'muscle' });
  }
  const obliques = (m) => muscle([[226, 300], [218, 322], [216, 348], [222, 376], [234, 380], [240, 352], [238, 318], [236, 302]], { mirror: m });
  const quadRF = (m) => muscleStrap([[230, 444], [229, 502], [228, 552]], 12, { mirror: m });
  const vastusLat = (m) => muscle([[218, 440], [210, 474], [208, 520], [220, 524], [224, 490], [222, 452]], { mirror: m });
  const vastusMed = (m) => muscle([[242, 492], [240, 520], [234, 544], [228, 544], [230, 516], [234, 492]], { mirror: m });
  const tibialis = (m) => muscleStrap([[221, 584], [217, 618], [215, 646]], 7, { mirror: m });
  return { torso: scm + pec(false) + pec(true) + abs, armL: deltoid(false) + biceps(false), armR: deltoid(true) + biceps(true), foreL: forearm(false), foreR: forearm(true), torsoOuter: obliques(false) + obliques(true), legL: quadRF(false) + vastusLat(false) + vastusMed(false), legR: quadRF(true) + vastusLat(true) + vastusMed(true), shinL: tibialis(false), shinR: tibialis(true) };
}

function backMuscles() {
  const lats = (m) => muscle(
    [[252, 244], [226, 240], [204, 248], [200, 280], [212, 316], [228, 340], [246, 352], [252, 322], [250, 286], [250, 256]],
    { mirror: m, fiber: [[246, 258, 210, 300]] },
  );
  const traps = muscle(
    [[260, 140], [198, 180], [190, 200], [206, 218], [240, 230], [260, 232], [280, 230], [314, 218], [330, 200], [322, 180]],
    { fiber: [[256, 152, 226, 196]] },
  ) + tag('path', { d: 'M 260 148 L 260 230', stroke: MUS_D, 'stroke-width': 1.6, opacity: 0.5, fill: 'none' });
  const deltoid = (m) => muscle([[198, 172], [180, 182], [174, 206], [180, 230], [198, 242], [214, 234], [220, 208], [216, 184]], { mirror: m });
  const triceps = (m) => muscle(
    [[194, 232], [198, 260], [192, 288], [184, 284], [180, 254], [186, 232]],
    { mirror: m },
  ) + muscleStrap([[204, 232], [206, 262], [200, 290]], 7, { mirror: m });
  const erectors = (m) => muscleStrap([[254, 270], [252, 306], [254, 344], [257, 380]], 9, { mirror: m });
  const gluteMed = (m) => muscleStrap([[222, 398], [212, 414], [216, 428]], 8, { mirror: m });
  const gluteMax = (m) => muscle([[238, 424], [212, 430], [204, 458], [210, 488], [228, 500], [246, 492], [250, 458], [248, 428]], { mirror: m });
  const hams = (m) =>
    muscleStrap([[222, 478], [216, 512], [218, 548], [222, 562]], 10, { mirror: m }) +
    muscleStrap([[236, 480], [234, 516], [236, 552], [238, 564]], 8, { mirror: m });
  const gastroc = (m) =>
    muscle([[216, 592], [228, 584], [242, 590], [246, 612], [240, 630], [228, 634], [214, 622], [208, 606]], { mirror: m }) +
    muscleStrap([[233, 632], [232, 668]], 5, { mirror: m });
  return {
    torsoOuter: lats(false) + lats(true) + traps,
    rootOuter: erectors(false) + erectors(true),
    armL: deltoid(false) + triceps(false), armR: deltoid(true) + triceps(true),
    foreL: '', foreR: '',
    legL: gluteMed(false) + gluteMax(false) + hams(false), legR: gluteMed(true) + gluteMax(true) + hams(true),
    shinL: gastroc(false), shinR: gastroc(true),
  };
}

/* ================= 关节定义 ================= */

export const JOINTS = {
  root: { pivot: [260, 428] },
  torso: { pivot: [260, 356] },
  breath: { scaleAround: [260, 244] },
  neck: { pivot: [260, 166] },
  shoulderL: { pivot: [198, 190] }, shoulderR: { pivot: [322, 190] },
  elbowL: { pivot: [190, 322] }, elbowR: { pivot: [330, 322] },
  wristL: { pivot: [186, 432] }, wristR: { pivot: [334, 432] },
  hipL: { pivot: [236, 434] }, hipR: { pivot: [284, 434] },
  kneeL: { pivot: [228, 568] }, kneeR: { pivot: [292, 568] },
  ankleL: { pivot: [226, 696] }, ankleR: { pivot: [294, 696] },
};

/* ================= 视图组装 ================= */

export function buildBodyMarkup(view, layerMode) {
  const showBones = layerMode === 'bones' || layerMode === 'both';
  const showMuscles = layerMode === 'muscles' || layerMode === 'both';
  const front = view === 'front';
  const M = front ? frontMuscles() : backMuscles();
  const bonesOf = (fn, ...a) => (showBones ? fn(...a) : '');
  const musOf = (s) => (showMuscles ? s : '');

  const arm = (side) => {
    const mirror = side === 'R';
    return (
      musOf(M['arm' + side]) +
      bonesOf(armBones, view, mirror) +
      tag('g', { id: `j:elbow${side}` },
        bonesOf(forearmBones, view, mirror) +
        musOf(M['fore' + side]) +
        tag('g', { id: `j:wrist${side}` }, bonesOf(handBones, mirror ? 334 : 186)))
    );
  };
  const leg = (side) => {
    const mirror = side === 'R';
    return (
      musOf(M['leg' + side]) +
      bonesOf(legBones, view, mirror) +
      tag('g', { id: `j:knee${side}` },
        bonesOf(shinBones, view, mirror) +
        bonesOf(patella, view, mirror) +
        musOf(M['shin' + side]) +
        tag('g', { id: `j:ankle${side}` }, bonesOf(footBones, view, mirror ? 294 : 226, mirror)))
    );
  };

  const breathInner = front
    ? bonesOf(ribcage) + bonesOf(sternum) + bonesOf(clavicles) + musOf(M.torso)
    : bonesOf(ribcage) + bonesOf(scapulae) + musOf(M.torso);

  const torso =
    tag('g', { id: 'j:breath' }, breathInner) +
    musOf(M.torsoOuter) +
    tag('g', { id: 'j:shoulderL' }, arm('L')) +
    tag('g', { id: 'j:shoulderR' }, arm('R')) +
    tag('g', { id: 'j:neck' }, bonesOf(front ? skullFront : skullBack));

  const core =
    (front ? bonesOf(pelvisFront) : bonesOf(pelvisBack)) +
    (front ? bonesOf(() => spineChain(312, 350, { w: 15, h: 10 })) : bonesOf(() => spineChain(174, 386, { w: 13, h: 9 }))) +
    (front ? bonesOf(() => spineChain(138, 168, { w: 11, h: 7 })) : '') +
    musOf(M.rootOuter ?? '');

  return tag('g', { id: 'j:root' },
    core +
    tag('g', { id: 'j:torso' }, torso) +
    tag('g', { id: 'j:hipL' }, leg('L')) +
    tag('g', { id: 'j:hipR' }, leg('R')));
}

/* ================= 覆盖层 ================= */

const CHAIN = (m) => [
  ovEllipse('upper_arm', 196, 262, 18, 62, m),
  ovEllipse('forearm', 187, 380, 15, 54, m),
  ovEllipse('hand', 185, 478, 26, 54, m),
  ovEllipse('thigh', 226, 508, 26, 58, m),
  ovEllipse('knee', 228, 570, 19, 22, m),
  ovEllipse('shin', 223, 634, 16, 60, m),
  ovEllipse('ankle_foot', 226, 720, 20, 32, m),
];

const FRONT_OVERLAYS = [
  ovEllipse('head', 260, 100, 46, 60),
  ovRect('neck', 240, 138, 40, 32),
  ovEllipse('shoulder', 198, 192, 26, 28, false),
  ovEllipse('shoulder', 198, 192, 26, 28, true),
  ovRect('chest', 198, 198, 124, 96),
  ovRect('abdomen', 218, 302, 84, 66),
  ovEllipse('pelvis_hip', 260, 424, 76, 44),
  ...CHAIN(false), ...CHAIN(true),
];

const BACK_OVERLAYS = [
  ovEllipse('head', 260, 100, 46, 58),
  ovRect('neck', 240, 136, 40, 36),
  ovEllipse('shoulder', 198, 192, 26, 28, false),
  ovEllipse('shoulder', 198, 192, 26, 28, true),
  ovRect('back_spine', 196, 186, 128, 190),
  ovEllipse('pelvis_hip', 260, 448, 76, 54),
  ...CHAIN(false), ...CHAIN(true),
];

export function getOverlays(view) {
  return view === 'front' ? FRONT_OVERLAYS : BACK_OVERLAYS;
}

export const STYLE_META = { id: 'standard', label: '标准解剖' };

/* ================= 动作（按本风格的肢体长度校准角度） ================= */

export const ACTIONS = {
  wave: {
    label: '挥手',
    duration: 2600,
    frames: [
      { t: 0, pose: {} },
      { t: 0.2, pose: { shoulderR: -28, elbowR: -118, neck: 5 } },
      { t: 0.32, pose: { shoulderR: -28, elbowR: -104, neck: 5 } },
      { t: 0.44, pose: { shoulderR: -28, elbowR: -118, neck: 5 } },
      { t: 0.56, pose: { shoulderR: -28, elbowR: -104, neck: 5 } },
      { t: 0.68, pose: { shoulderR: -28, elbowR: -118, neck: 5 } },
      { t: 0.86, pose: { shoulderR: -24 } },
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
      { t: 0.25, pose: { shoulderR: -40, elbowR: -70 } },
      { t: 0.5, pose: { shoulderR: -12, elbowR: -18 } },
      { t: 0.75, pose: { shoulderR: -40, elbowR: -70 } },
      { t: 1, pose: {} },
    ],
  },
  elbowFlex: {
    label: '屈伸手肘',
    duration: 2000,
    loops: 2,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { shoulderL: 15, elbowL: 95 } },
      { t: 0.5, pose: { shoulderL: 10, elbowL: 14 } },
      { t: 0.75, pose: { shoulderL: 15, elbowL: 95 } },
      { t: 1, pose: {} },
    ],
  },
  wristFlick: {
    label: '手腕摆动',
    duration: 1600,
    loops: 3,
    frames: [
      { t: 0, pose: {} },
      { t: 0.25, pose: { wristL: 20 } },
      { t: 0.5, pose: { wristL: -16 } },
      { t: 0.75, pose: { wristL: 20 } },
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
      { t: 0.3, pose: { rootY: 26, hipL: 14, hipR: -14, kneeL: -26, kneeR: 26, ankleL: -8, ankleR: 8, torso: 8 } },
      { t: 0.5, pose: { rootY: 26, hipL: 14, hipR: -14, kneeL: -26, kneeR: 26, ankleL: -8, ankleR: 8, torso: 8 } },
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
