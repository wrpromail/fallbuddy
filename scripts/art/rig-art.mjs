/**
 * 摔友记 · 原创 Q 版骷髅素材（矢量源）
 *
 * 设计画布 320 × 480，坐标直接写在该画布内；每个图层导出时按 bbox 裁剪。
 * 所有造型为原创几何图形，不含任何品牌 Logo / 联名元素。
 *
 * 几何约定（正面）：
 *   头中心 (160,113)，肩 (208/112,194)，肘 (234/86,244)，腕 (241/79,286)
 *   髋 (176/144,314)，膝 (194/126,372)，踝 (198/122,412)，鞋底 440
 */

export const CANVAS = { width: 320, height: 480 };

export const C = {
  ink: '#2B2340',
  bone: '#F7F2E7',
  boneShade: '#E5DAC5',
  boneLine: '#D3C5A9',
  blush: '#FFA8B8',
  white: '#FFFDF7',
  outfit: {
    ski_blue: { main: '#4C8DFF', dark: '#2F6FE0', light: '#A9C8FF' },
    suit_orange: { main: '#FFA14A', dark: '#EF7A1F', light: '#FFD3A1' },
    vest_mint: { main: '#5ED6B3', dark: '#2FB98F', light: '#BFF3E2' },
  },
  headgear: {
    beanie_blue: { main: '#7C8CFF', dark: '#5566E0', pom: '#FFD166' },
    helmet_red: { main: '#FF6B6B', dark: '#E04545', stripe: '#FFF6EC' },
  },
  goggle: { lens: '#9BDCFF', frame: '#2B2340', strap: '#4A3F66', shine: '#E9FAFF' },
  steel: '#B9C3D4',
  steelDark: '#8A96AC',
};

const SKULL_PATH =
  'M160,52 C194,52 220,78 220,113 C220,135 209,148 199,156 C195,174 181,188 160,188 C139,188 125,174 121,156 C111,148 100,135 100,113 C100,78 126,52 160,52 Z';

const SQUARE_SKULL_PATH = 'M160,52 C196,52 218,76 220,108 L220,130 Q219,148 206,158 L200,174 Q195,188 178,188 H142 Q125,188 120,174 L114,158 Q101,148 100,130 L100,108 C102,76 124,52 160,52 Z';
const BONE_TINTS = {
  blue: ['#EDF5FF', '#C9DFFD', '#9CB9E0'],
  orange: ['#FFE9CF', '#FFD0A1', '#DFAB78'],
  purple: ['#F2E5FF', '#DEC7F6', '#BD9CDA'],
  mint: ['#E0FFF2', '#B4F0DB', '#83CBB3'],
};
const HEAD_SHAPES = { round: SKULL_PATH, soft_square: SQUARE_SKULL_PATH };

function tinted(content, palette) {
  const [bone, shade, line] = BONE_TINTS[palette];
  const replacements = { [C.bone]: bone, [C.boneShade]: shade, [C.boneLine]: line };
  return content.replace(/#[0-9A-F]{6}/g, (color) => replacements[color] ?? color);
}

function variants(keys, draw) {
  return Object.fromEntries(keys.map((key) => [key, { content: () => draw(key) }]));
}

function headVariants(draw) {
  return Object.fromEntries(Object.entries(HEAD_SHAPES).flatMap(([shape, path]) =>
    Object.keys(BONE_TINTS).map((palette) => [shape + '-' + palette, { content: () => tinted(draw(path), palette) }]),
  ));
}

/* ---------------------------------------------------------------- helpers */

const n = (v) => (Math.round(v * 10) / 10).toString();

function capsule(x1, y1, x2, y2, w, opts = {}) {
  const fill = opts.fill || C.bone;
  const outline = opts.outline || C.ink;
  const ow = opts.ow == null ? 3 : opts.ow;
  return (
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${outline}" stroke-width="${n(w + ow * 2)}" stroke-linecap="round"/>` +
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${fill}" stroke-width="${n(w)}" stroke-linecap="round"/>`
  );
}

function knob(x, y, r, opts = {}) {
  const fill = opts.fill || C.bone;
  const outline = opts.outline || C.ink;
  const ow = opts.ow == null ? 3 : opts.ow;
  return (
    `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r + ow)}" fill="${outline}"/>` +
    `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"/>`
  );
}

function hand(x, y, r = 13) {
  return (
    knob(x, y, r) +
    `<path d="M${n(x - 5)},${n(y + 2)} L${n(x - 5)},${n(y + 8)} M${n(x)},${n(y + 3)} L${n(x)},${n(y + 9)} M${n(x + 5)},${n(y + 2)} L${n(x + 5)},${n(y + 8)}" stroke="${C.boneLine}" stroke-width="2" stroke-linecap="round"/>`
  );
}

function boot(x, y, flip = 1) {
  const w = 54;
  const h = 36;
  const left = flip > 0 ? x : x - w;
  return (
    `<rect x="${n(left)}" y="${n(y)}" width="${w}" height="${h}" rx="14" fill="${C.ink}"/>` +
    `<rect x="${n(left + 3)}" y="${n(y + 3)}" width="${w - 6}" height="${h - 9}" rx="11" fill="#4A3F66"/>` +
    `<path d="M${n(left + 8)},${n(y + h - 12)} L${n(left + w - 8)},${n(y + h - 12)}" stroke="${C.ink}" stroke-width="2.5" opacity="0.5"/>`
  );
}

function snowBoots(view) {
  return [96, 170].map((x) => `
    <path d="M${x + 10},422 L${x + 12},400 Q${x + 29},393 ${x + 43},401 L${x + 44},416 Q${x + 57},423 ${x + 54},436 Q${x + 52},440 ${x + 47},440 H${x + 10} Q${x},438 ${x},430 Q${x},425 ${x + 10},422 Z" fill="#345B94" stroke="${C.ink}" stroke-width="3"/>
    <path d="M${x + 5},434 H${x + 49}" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>
    <path d="M${x + 14},408 H${x + 41} M${x + 12},416 H${x + 43}" stroke="${view === 'front' ? '#C9EAFF' : '#77A8D3'}" stroke-width="3" stroke-linecap="round"/>
  `).join('');
}

/* ------------------------------------------------------------------ head */

function eyesHappy() {
  return `
    <path d="M124,124 Q138,104 152,124" stroke="${C.ink}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M168,124 Q182,104 196,124" stroke="${C.ink}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="117" cy="146" rx="9" ry="5" fill="${C.blush}" opacity="0.65"/>
    <ellipse cx="203" cy="146" rx="9" ry="5" fill="${C.blush}" opacity="0.65"/>`;
}

function eyesSurprised() {
  return `
    <ellipse cx="138" cy="118" rx="18" ry="20" fill="${C.ink}"/>
    <ellipse cx="182" cy="118" rx="18" ry="20" fill="${C.ink}"/>
    <circle cx="144" cy="111" r="5.4" fill="${C.white}" opacity="0.95"/>
    <circle cx="188" cy="111" r="5.4" fill="${C.white}" opacity="0.95"/>
    <path d="M112,92 Q124,84 136,92" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M184,92 Q196,84 208,92" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

function eyesAwkward() {
  return `
    <ellipse cx="138" cy="120" rx="14" ry="15" fill="${C.ink}"/>
    <circle cx="143" cy="115" r="4" fill="${C.white}" opacity="0.9"/>
    <ellipse cx="182" cy="120" rx="16" ry="7" fill="${C.ink}"/>
    <path d="M206,92 Q213,101 208,109 Q203,102 206,92 Z" fill="#8FD3FF" stroke="${C.ink}" stroke-width="2"/>`;
}

function eyesComfort() {
  return `
    <path d="M122,106 Q138,98 152,108" stroke="${C.ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M168,108 Q182,98 198,106" stroke="${C.ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="138" cy="122" rx="14" ry="14" fill="${C.ink}"/>
    <ellipse cx="182" cy="122" rx="14" ry="14" fill="${C.ink}"/>
    <circle cx="143" cy="117" r="4.6" fill="${C.white}" opacity="0.95"/>
    <circle cx="187" cy="117" r="4.6" fill="${C.white}" opacity="0.95"/>
    <path d="M208,128 Q216,140 208,148 Q200,140 208,128 Z" fill="#8FD3FF" stroke="${C.ink}" stroke-width="2"/>`;
}

function eyesCool() {
  return `
    <path d="M121,107 L150,111 M170,111 L199,105" stroke="${C.ink}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M122,119 Q137,128 151,118 M169,118 Q183,126 198,117" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M146,155 Q161,159 177,151" stroke="${C.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

function teeth(y = 154, w = 36, h = 18) {
  const x = 160 - w / 2;
  return `
    <rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="6" fill="${C.white}" stroke="${C.ink}" stroke-width="2.6"/>
    <line x1="${n(x + w / 3)}" y1="${n(y + 2)}" x2="${n(x + w / 3)}" y2="${n(y + h - 2)}" stroke="${C.ink}" stroke-width="1.8" opacity="0.5"/>
    <line x1="${n(x + (w * 2) / 3)}" y1="${n(y + 2)}" x2="${n(x + (w * 2) / 3)}" y2="${n(y + h - 2)}" stroke="${C.ink}" stroke-width="1.8" opacity="0.5"/>`;
}

function skullBase(path) {
  return `
    <path d="${path}" fill="${C.bone}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M116,96 C118,72 134,60 152,57" stroke="#FFFFFF" stroke-width="8" opacity="0.5" stroke-linecap="round" fill="none"/>`;
}

function face(expression) {
  const nose = `<path d="M160,136 L153,152 L167,152 Z" fill="${C.ink}"/>`;
  switch (expression) {
    case 'surprised':
      return `${nose}${eyesSurprised()}<ellipse cx="160" cy="160" rx="12" ry="11" fill="${C.ink}"/><rect x="152" y="152" width="16" height="7" rx="2.5" fill="${C.white}"/>`;
    case 'awkward':
      return `${nose}${eyesAwkward()}${teeth(155, 34, 17)}`;
    case 'comfort':
      return `${nose}${eyesComfort()}<path d="M146,158 Q160,166 174,158" stroke="${C.ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
    case 'cool':
      return `${nose}${eyesCool()}${teeth(158, 30, 15)}`;
    case 'happy':
    default:
      return `${nose}${eyesHappy()}${teeth()}`;
  }
}

function headBack(path) {
  return `
    <path d="${path}" fill="${C.bone}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M118,98 C120,72 136,58 154,56" stroke="#FFFFFF" stroke-width="8" opacity="0.42" stroke-linecap="round" fill="none"/>
    <path d="M126,132 Q160,152 194,132" stroke="${C.boneLine}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M138,100 Q160,110 182,100" stroke="${C.boneLine}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path d="M160,174 L160,188" stroke="${C.boneLine}" stroke-width="3" stroke-linecap="round"/>
  `;
}

/* ------------------------------------------------------------- body front */

function torsoFront() {
  const ribLines = [206, 226, 246, 264]
    .map(
      (y, i) =>
        `<path d="M${128 + i * 1.5},${y} Q160,${y + 12 - i} ${192 - i * 1.5},${y}" stroke="${C.boneLine}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    )
    .join('');
  return `
    ${capsule(160, 150, 160, 178, 24)}
    <path d="M116,186 C124,171 196,171 204,186 L197,268 Q160,284 123,268 Z" fill="${C.bone}" stroke="${C.ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M160,196 L160,270" stroke="${C.boneLine}" stroke-width="3" stroke-linecap="round"/>
    ${ribLines}
    <path d="M160,280 L160,294" stroke="${C.boneLine}" stroke-width="3" stroke-linecap="round"/>
    <path d="M130,288 L190,288 L186,318 Q160,330 134,318 Z" fill="${C.bone}" stroke="${C.ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M140,296 L180,296" stroke="${C.boneLine}" stroke-width="2.4" stroke-linecap="round"/>
  `;
}

function legsFront() {
  const legs = [
    { hip: [176, 314], knee: [194, 372], ankle: [198, 412], bootX: 170 },
    { hip: [144, 314], knee: [126, 372], ankle: [122, 412], bootX: 96 },
  ];
  return legs
    .map(
      (l) =>
        capsule(l.hip[0], l.hip[1], l.knee[0], l.knee[1], 14) +
        knob(l.knee[0], l.knee[1], 9.5) +
        capsule(l.knee[0], l.knee[1], l.ankle[0], l.ankle[1], 12) +
        knob(l.ankle[0], l.ankle[1], 7) +
        boot(l.bootX, 404),
    )
    .join('');
}

function armsFront() {
  return `
    ${capsule(208, 194, 234, 244, 15)}
    ${knob(208, 194, 10)}
    ${knob(234, 244, 8.5)}
    ${capsule(234, 244, 241, 286, 13)}
    ${hand(244, 293)}
    ${capsule(112, 194, 86, 244, 15)}
    ${knob(112, 194, 10)}
    ${knob(86, 244, 8.5)}
    ${capsule(86, 244, 79, 286, 13)}
    ${hand(76, 293)}
  `;
}

function bodyFront() {
  return `${legsFront()}${torsoFront()}${armsFront()}`;
}

/* -------------------------------------------------------------- body back */

function bodyBack() {
  const legs = [
    { hip: [176, 314], knee: [194, 372], ankle: [198, 412], bootX: 170 },
    { hip: [144, 314], knee: [126, 372], ankle: [122, 412], bootX: 96 },
  ]
    .map(
      (l) =>
        capsule(l.hip[0], l.hip[1], l.knee[0], l.knee[1], 14) +
        knob(l.knee[0], l.knee[1], 9.5) +
        capsule(l.knee[0], l.knee[1], l.ankle[0], l.ankle[1], 12) +
        knob(l.ankle[0], l.ankle[1], 7) +
        boot(l.bootX, 404),
    )
    .join('');

  const vertebrae = [196, 214, 232, 250, 268, 284]
    .map(
      (y, i) =>
        `<rect x="${160 - 9 + i * 0.4}" y="${y}" width="${18 - i * 0.8}" height="9" rx="4" fill="${C.bone}" stroke="${C.ink}" stroke-width="2.2"/>`,
    )
    .join('');

  return `
    ${legs}
    ${capsule(160, 150, 160, 178, 24)}
    <path d="M116,186 C124,171 196,171 204,186 L197,268 Q160,284 123,268 Z" fill="${C.bone}" stroke="${C.ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M128,196 Q148,214 142,252" stroke="${C.boneLine}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M192,196 Q172,214 178,252" stroke="${C.boneLine}" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${vertebrae}
    <path d="M130,288 L190,288 L186,318 Q160,330 134,318 Z" fill="${C.bone}" stroke="${C.ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M148,296 L172,296 L160,310 Z" fill="${C.boneShade}" stroke="${C.boneLine}" stroke-width="2"/>
    ${capsule(208, 194, 234, 244, 15)}
    ${knob(208, 194, 10)}
    ${knob(234, 244, 8.5)}
    ${capsule(234, 244, 241, 286, 13)}
    ${hand(244, 293)}
    ${capsule(112, 194, 86, 244, 15)}
    ${knob(112, 194, 10)}
    ${knob(86, 244, 8.5)}
    ${capsule(86, 244, 79, 286, 13)}
    ${hand(76, 293)}
  `;
}

/* ---------------------------------------------------------------- outfits */

function outfitFront(outfitId) {
  const p = C.outfit[outfitId] || C.outfit.ski_blue;
  const sleeves =
    outfitId === 'vest_mint'
      ? ''
      : `
      ${capsule(205, 192, 232, 242, 22, { fill: p.main, ow: 3.2 })}
      ${capsule(115, 192, 88, 242, 22, { fill: p.main, ow: 3.2 })}
      <path d="M216,236 Q226,244 232,238" stroke="${p.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M104,236 Q94,244 88,238" stroke="${p.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `
    <path d="M118,186 C128,175 192,175 202,186 L208,262 C204,286 186,296 160,296 C134,296 116,286 112,262 Z" fill="${p.main}" stroke="${C.ink}" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M118,186 C128,198 192,198 202,186" fill="${p.dark}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round" opacity="0.9"/>
    <path d="M160,196 L160,288" stroke="${p.light}" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 6" opacity="0.9"/>
    <path d="M112,262 C124,276 196,276 208,262" stroke="${p.dark}" stroke-width="6" fill="none" opacity="0.55"/>
    <path d="M126,206 L134,206 M126,220 L132,220" stroke="${p.light}" stroke-width="3.4" stroke-linecap="round" opacity="0.85"/>
    ${sleeves}
  `;
}

function outfitBack(outfitId) {
  const p = C.outfit[outfitId] || C.outfit.ski_blue;
  const sleeves =
    outfitId === 'vest_mint'
      ? ''
      : `
      ${capsule(205, 192, 232, 242, 22, { fill: p.main, ow: 3.2 })}
      ${capsule(115, 192, 88, 242, 22, { fill: p.main, ow: 3.2 })}
      <path d="M216,236 Q226,244 232,238" stroke="${p.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M104,236 Q94,244 88,238" stroke="${p.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `
    <path d="M118,186 C128,175 192,175 202,186 L208,262 C204,286 186,296 160,296 C134,296 116,286 112,262 Z" fill="${p.main}" stroke="${C.ink}" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M126,186 C142,196 178,196 194,186" fill="none" stroke="${p.dark}" stroke-width="6" opacity="0.6"/>
    <path d="M160,200 L160,288" stroke="${p.dark}" stroke-width="3.6" opacity="0.75" stroke-linecap="round"/>
    <path d="M120,192 Q160,208 200,192" stroke="${p.dark}" stroke-width="3.2" fill="none" opacity="0.7" stroke-linecap="round"/>
    <path d="M126,202 Q140,214 136,248 Q124,240 122,206 Z" fill="${p.dark}" opacity="0.18"/>
    <path d="M194,202 Q180,214 184,248 Q196,240 198,206 Z" fill="${p.dark}" opacity="0.18"/>
    <path d="M130,268 L122,274 M190,268 L198,274" stroke="${p.dark}" stroke-width="3" opacity="0.45" stroke-linecap="round"/>
    <path d="M138,222 Q160,232 182,222" stroke="${p.light}" stroke-width="4" fill="none" opacity="0.8" stroke-linecap="round"/>
    <path d="M112,262 C124,276 196,276 208,262" stroke="${p.dark}" stroke-width="6" fill="none" opacity="0.55"/>
    ${sleeves}
  `;
}

function hipProtector() {
  return `
    <path d="M126,288 Q160,280 194,288 L198,316 Q160,338 122,316 Z" fill="${C.steel}" stroke="${C.ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M134,298 Q160,292 186,298" stroke="#FFFFFF" stroke-width="4" fill="none" opacity="0.55" stroke-linecap="round"/>
    <circle cx="136" cy="312" r="3.4" fill="${C.steelDark}" stroke="${C.ink}" stroke-width="1.8"/>
    <circle cx="184" cy="312" r="3.4" fill="${C.steelDark}" stroke="${C.ink}" stroke-width="1.8"/>
    <path d="M126,300 L112,290 M194,300 L208,290" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="114" cy="291" r="3.6" fill="${C.steelDark}" stroke="${C.ink}" stroke-width="1.6"/>
    <circle cx="206" cy="291" r="3.6" fill="${C.steelDark}" stroke="${C.ink}" stroke-width="1.6"/>
  `;
}

/* -------------------------------------------------------------- headgear */

function headgearBeanie(back = false) {
  const p = C.headgear.beanie_blue;
  const fold = back
    ? ''
    : `<path d="M96,100 C114,90 136,86 160,86 C184,86 206,90 224,100 L224,108 C206,98 184,94 160,94 C136,94 114,98 96,108 Z" fill="${p.dark}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>`;
  return `
    <path d="M96,100 C97,52 124,32 160,32 C196,32 223,52 224,100 C206,90 184,86 160,86 C136,86 114,90 96,100 Z" fill="${p.main}" stroke="${C.ink}" stroke-width="3.6" stroke-linejoin="round"/>
    ${fold}
    <path d="M112,86 C118,62 134,46 156,42" stroke="#FFFFFF" stroke-width="6" fill="none" opacity="0.45" stroke-linecap="round"/>
    <circle cx="160" cy="26" r="13" fill="${p.pom}" stroke="${C.ink}" stroke-width="3"/>
    <path d="M154,20 Q160,26 166,20" stroke="${C.ink}" stroke-width="2" fill="none" opacity="0.4"/>
  `;
}

function headgearHelmet(back = false) {
  const p = C.headgear.helmet_red;
  const visor = back
    ? ''
    : `<path d="M214,94 L234,90 L234,102 L210,106 Z" fill="${p.dark}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>`;
  return `
    <path d="M98,104 C98,62 126,40 160,40 C194,40 222,62 222,104 L212,108 C190,96 130,96 108,108 Z" fill="${p.main}" stroke="${C.ink}" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M136,44 C146,72 146,94 142,104" stroke="${p.stripe}" stroke-width="7" fill="none" opacity="0.85" stroke-linecap="round"/>
    <path d="M108,108 C130,96 190,96 212,108" stroke="${p.dark}" stroke-width="5" fill="none" opacity="0.8"/>
    ${visor}
    <circle cx="104" cy="106" r="5" fill="${p.dark}" stroke="${C.ink}" stroke-width="2.4"/>
    <circle cx="216" cy="106" r="5" fill="${p.dark}" stroke="${C.ink}" stroke-width="2.4"/>
  `;
}

function goggles(back = false) {
  if (back) {
    return `
      <path d="M100,110 L220,110" stroke="${C.goggle.strap}" stroke-width="13" stroke-linecap="round"/>
      <path d="M100,110 L220,110" stroke="${C.ink}" stroke-width="2.4" stroke-dasharray="4 5" opacity="0.5"/>
      <rect x="146" y="103" width="28" height="14" rx="6" fill="${C.goggle.frame}"/>
    `;
  }
  return `
    <path d="M102,112 L218,112" stroke="${C.goggle.strap}" stroke-width="12" stroke-linecap="round"/>
    <rect x="106" y="100" width="108" height="38" rx="15" fill="${C.goggle.lens}" fill-opacity="0.6" stroke="${C.goggle.frame}" stroke-width="4"/>
    <path d="M118,130 Q134,110 152,108" stroke="${C.goggle.shine}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M160,104 L160,134" stroke="${C.goggle.frame}" stroke-width="4" opacity="0.7"/>
    <circle cx="104" cy="106" r="4" fill="${C.goggle.frame}"/>
    <circle cx="216" cy="106" r="4" fill="${C.goggle.frame}"/>
  `;
}

/* ----------------------------------------------------------------- shadow */

function shadow() {
  return `
    <ellipse cx="160" cy="446" rx="88" ry="13" fill="${C.ink}" opacity="0.16"/>
    <ellipse cx="160" cy="444" rx="58" ry="8" fill="${C.ink}" opacity="0.12"/>
  `;
}

/* --------------------------------------------------------------- registry */

/**
 * 图层定义：bbox 为画布内裁剪范围 [x, y, w, h]。
 * 导出 PNG 时按 bbox 裁剪；运行时按 bbox / canvas 百分比定位。
 */
export const LAYERS = [
  { id: 'shadow', view: 'front', bbox: [58, 424, 204, 40], z: 0, content: () => shadow() },
  { id: 'body', view: 'front', bbox: [58, 148, 204, 306], z: 10, slot: 'palette', variants: variants(Object.keys(BONE_TINTS), (palette) => tinted(bodyFront(), palette)) },
  {
    id: 'outfit',
    view: 'front',
    bbox: [58, 170, 204, 140],
    z: 20,
    slot: 'outfit',
    variants: {
      ski_blue: { content: () => outfitFront('ski_blue') },
      suit_orange: { content: () => outfitFront('suit_orange') },
      vest_mint: { content: () => outfitFront('vest_mint') },
    },
  },
  {
    id: 'hip_protector',
    view: 'front',
    bbox: [116, 280, 88, 62],
    z: 24,
    slot: 'hip_protector',
    variants: {
      basic_hip_protector: { content: () => hipProtector() },
      steel_hip_guard: { content: () => hipProtector() },
    },
  },
  { id: 'head', view: 'front', bbox: [86, 42, 148, 150], z: 30, slot: 'headShape', variants: headVariants(skullBase) },
  { id: 'face', view: 'front', bbox: [86, 42, 148, 150], z: 32, slot: 'expression',
    variants: variants(['happy', 'surprised', 'awkward', 'comfort', 'cool'], face) },
  {
    id: 'goggles',
    view: 'front',
    bbox: [92, 96, 136, 52],
    z: 34,
    slot: 'goggles',
    variants: { snow_goggles: { content: () => goggles(false) } },
  },
  {
    id: 'headgear',
    view: 'front',
    bbox: [86, 10, 148, 100],
    z: 40,
    slot: 'headgear',
    variants: {
      beanie_blue: { content: () => headgearBeanie(false) },
      helmet_red: { content: () => headgearHelmet(false) },
    },
  },

  ...['front', 'back'].map((view) => ({
    id: 'boots', view, bbox: [88, 394, 144, 52], z: 26, slot: 'boots',
    variants: { snow_boots: { content: () => snowBoots(view) } },
  })),
  { id: 'shadow', view: 'back', bbox: [58, 424, 204, 40], z: 0, content: () => shadow() },
  { id: 'body', view: 'back', bbox: [58, 148, 204, 306], z: 10, slot: 'palette', variants: variants(Object.keys(BONE_TINTS), (palette) => tinted(bodyBack(), palette)) },
  {
    id: 'outfit',
    view: 'back',
    bbox: [58, 170, 204, 140],
    z: 20,
    slot: 'outfit',
    variants: {
      ski_blue: { content: () => outfitBack('ski_blue') },
      suit_orange: { content: () => outfitBack('suit_orange') },
      vest_mint: { content: () => outfitBack('vest_mint') },
    },
  },
  {
    id: 'hip_protector',
    view: 'back',
    bbox: [116, 280, 88, 62],
    z: 24,
    slot: 'hip_protector',
    variants: {
      basic_hip_protector: { content: () => hipProtector() },
      steel_hip_guard: { content: () => hipProtector() },
    },
  },
  { id: 'head', view: 'back', bbox: [86, 42, 148, 150], z: 30, slot: 'headShape', variants: headVariants(headBack) },
  {
    id: 'goggles',
    view: 'back',
    bbox: [92, 96, 136, 34],
    z: 34,
    slot: 'goggles',
    variants: { snow_goggles: { content: () => goggles(true) } },
  },
  {
    id: 'headgear',
    view: 'back',
    bbox: [86, 10, 148, 100],
    z: 40,
    slot: 'headgear',
    variants: {
      beanie_blue: { content: () => headgearBeanie(true) },
      helmet_red: { content: () => headgearHelmet(true) },
    },
  },
];

/* --------------------------------------------------------------- hotspots */

export const HOTSPOTS = {
  front: [
    { id: 'head', label: '头', x: 160, y: 106, r: 50 },
    { id: 'shoulder_l', label: '左肩', x: 212, y: 192, r: 25 },
    { id: 'shoulder_r', label: '右肩', x: 108, y: 192, r: 25 },
    { id: 'wrist_l', label: '左手腕', x: 244, y: 292, r: 24 },
    { id: 'wrist_r', label: '右手腕', x: 76, y: 292, r: 24 },
    { id: 'waist', label: '腰', x: 160, y: 258, r: 23 },
    { id: 'tailbone', label: '尾椎', x: 160, y: 310, r: 22 },
    { id: 'knee_l', label: '左膝', x: 194, y: 372, r: 23 },
    { id: 'knee_r', label: '右膝', x: 126, y: 372, r: 23 },
    { id: 'ankle_l', label: '左脚踝', x: 198, y: 416, r: 21 },
    { id: 'ankle_r', label: '右脚踝', x: 122, y: 416, r: 21 },
  ],
  back: [
    { id: 'head', label: '头', x: 160, y: 106, r: 50 },
    { id: 'shoulder_l', label: '左肩', x: 108, y: 192, r: 25 },
    { id: 'shoulder_r', label: '右肩', x: 212, y: 192, r: 25 },
    { id: 'wrist_l', label: '左手腕', x: 76, y: 292, r: 24 },
    { id: 'wrist_r', label: '右手腕', x: 244, y: 292, r: 24 },
    { id: 'back', label: '背', x: 160, y: 224, r: 24 },
    { id: 'waist', label: '腰', x: 160, y: 278, r: 22 },
    { id: 'tailbone', label: '尾椎', x: 160, y: 326, r: 20 },
    { id: 'knee_l', label: '左膝', x: 126, y: 372, r: 23 },
    { id: 'knee_r', label: '右膝', x: 194, y: 372, r: 23 },
    { id: 'ankle_l', label: '左脚踝', x: 122, y: 416, r: 21 },
    { id: 'ankle_r', label: '右脚踝', x: 198, y: 416, r: 21 },
  ],
};

/* ---------------------------------------------------------------- anchors */

const pct = (x, y) => ({
  x: Math.round((x / CANVAS.width) * 1000) / 10,
  y: Math.round((y / CANVAS.height) * 1000) / 10,
});

export const ANCHORS = {
  head: pct(160, 113),
  neck: pct(160, 178),
  chest: pct(160, 232),
  hip: pct(160, 304),
  hand_l: pct(244, 293),
  hand_r: pct(76, 293),
  knee_l: pct(194, 372),
  knee_r: pct(126, 372),
  foot_l: pct(198, 424),
  foot_r: pct(122, 424),
  ground: pct(160, 444),
};


/** 按 z 顺序合成一个视图（equipment 决定装备变体；缺省装备时使用第一个变体） */
export function figureContent(view, equipment = {}) {
  const parts = [];
  const palette = equipment.palette ?? 'blue';
  const appearance = { expression: equipment.expression ?? 'happy', palette, headShape: (equipment.headShape ?? 'round') + '-' + palette };
  for (const layer of LAYERS.filter((l) => l.view === view).sort((a, b) => a.z - b.z)) {
    if (!layer.slot) {
      parts.push(layer.content());
      continue;
    }
    const key = appearance[layer.slot] ?? equipment[layer.slot];
    if (key && layer.variants[key]) parts.push(layer.variants[key].content());
  }
  return parts.join('');
}

/* ------------------------------------------------------------------ utils */

export function layerMap() {
  const map = new Map();
  for (const layer of LAYERS) {
    if (layer.variants) {
      for (const [key, variant] of Object.entries(layer.variants)) {
        map.set(`${layer.view}/${layer.id}/${key}`, { layer, key, content: variant.content() });
      }
    } else {
      map.set(`${layer.view}/${layer.id}`, { layer, key: 'default', content: layer.content() });
    }
  }
  return map;
}

export function svgFor(entry, scale = 1, padding = 0) {
  const [x, y, w, h] = entry.layer.bbox;
  const px = x - padding;
  const py = y - padding;
  const pw = w + padding * 2;
  const ph = h + padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pw * scale}" height="${ph * scale}" viewBox="${px} ${py} ${pw} ${ph}" shape-rendering="geometricPrecision">${entry.content}</svg>`;
}

export function layerSrcPath(entry) {
  const parts = ['rigs', entry.layer.view, entry.layer.id];
  if (entry.key !== 'default') parts.push(entry.key);
  return `/assets/${parts.join('/')}.png`;
}
