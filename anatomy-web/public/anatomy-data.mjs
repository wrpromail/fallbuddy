// anatomy-data.mjs —— 人体模型层 · 数据核心
// 视图无关的解剖拓扑：14 个区域，每个区域是一张结构化卡片。
// AI 讲解与调侃的 prompt 上下文全部由这里生成，保证大模型不瞎编部位结构。
// 浏览器与 Node（server.mjs 校验/组 prompt）共用本文件，保持纯数据、无 DOM 依赖。

export const SCHEMA_VERSION = 1;

/** 战损记录（与摔友记 incident 的部位枚举对齐为解剖粒度） */
export const REGION_IDS = [
  'head', 'neck', 'shoulder', 'upper_arm', 'forearm', 'hand',
  'chest', 'abdomen', 'back_spine', 'pelvis_hip',
  'thigh', 'knee', 'shin', 'ankle_foot',
];

export const REGION_LABEL = {
  head: '头部', neck: '颈部', shoulder: '肩部', upper_arm: '上臂', forearm: '前臂',
  hand: '手腕与手', chest: '胸部', abdomen: '腹部', back_spine: '背部与脊柱',
  pelvis_hip: '髋与骨盆', thigh: '大腿', knee: '膝', shin: '小腿', ankle_foot: '踝与足',
};

/** 每个区域的「演示动作」id（anatomy-rig.mjs 提供同名动作） */
export const REGION_DEMO = {
  head: 'neckRoll', neck: 'neckRoll',
  shoulder: 'armCircle', upper_arm: 'elbowFlex', forearm: 'elbowFlex', hand: 'wristFlick',
  chest: 'spineSway', abdomen: 'spineSway', back_spine: 'spineSway',
  pelvis_hip: 'hipSway',
  thigh: 'squat', knee: 'squat',
  shin: 'ankleFlex', ankle_foot: 'ankleFlex',
};

/**
 * 解剖卡片：骨骼 / 肌肉（含分工）/ 协作方式 / 常见损伤。
 * motion 与 injuries 会原样进入 AI prompt（科普模式的唯一事实来源）。
 */
export const REGIONS = [
  {
    id: 'head', nameZh: '头部',
    bones: ['颅骨', '下颌骨'],
    muscles: [
      { nameZh: '颞肌', role: '上提下颌，咬合发力' },
      { nameZh: '咬肌', role: '闭口研磨，腮帮子里最壮的一块' },
    ],
    motion: '颅骨是一顶长在身上的头盔，把大脑整个扣住；颞肌和咬肌挂在颅骨侧方，咬紧牙关时在太阳穴和腮帮能摸到它们收缩。',
    injuries: '常见：头皮血肿、脑震荡。雪面高速摔拍后脑或头侧着地需要立刻观察，头盔就是为这一刻准备的。',
  },
  {
    id: 'neck', nameZh: '颈部',
    bones: ['颈椎（7 节）'],
    muscles: [
      { nameZh: '胸锁乳突肌', role: '点头与转头的「拉索」' },
      { nameZh: '斜方肌上束', role: '耸肩并护住颈根' },
    ],
    motion: '颈椎托着一颗约 5 公斤的头；胸锁乳突肌像两根拉索从耳后拉到胸口，负责点头转头；猛烈的甩动会让这些拉索拉伤。',
    injuries: '常见：落枕、挥鞭样损伤。向后摔时头部猛烈后仰再回弹是典型机制。',
  },
  {
    id: 'shoulder', nameZh: '肩部',
    bones: ['锁骨', '肩胛骨', '肱骨近端'],
    muscles: [
      { nameZh: '三角肌', role: '把整条手臂抬起来' },
      { nameZh: '肩袖四肌', role: '像吊床一样把肱骨头按在肩胛盂里' },
    ],
    motion: '肩关节像高尔夫球放在浅球座上：活动度极大，全靠肩袖四肌兜住肱骨头，表面的三角肌负责大力抬臂——稳定与力量各司其职。',
    injuries: '常见：锁骨骨折、肩袖拉伤、肩关节脱位。摔倒手撑地时锁骨往往第一个抗议。',
  },
  {
    id: 'upper_arm', nameZh: '上臂',
    bones: ['肱骨'],
    muscles: [
      { nameZh: '肱二头肌', role: '屈肘并让前臂旋转后' },
      { nameZh: '肱三头肌', role: '伸肘，撑杖推雪的主力' },
    ],
    motion: '肱二头肌与肱三头肌隔着一根肱骨前后对拉：一个收、一个放，像杠杆两端的配重，手肘因此又快又稳。',
    injuries: '常见：二头肌腱拉伤、上臂挫伤。杖尖别手或直接怼到地面时扭的是这里。',
  },
  {
    id: 'forearm', nameZh: '前臂',
    bones: ['桡骨', '尺骨'],
    muscles: [
      { nameZh: '前臂屈肌群', role: '握杖握把，攥紧的力都从这来' },
      { nameZh: '前臂伸肌群', role: '张开手掌并稳定手腕' },
    ],
    motion: '桡骨承担大部分腕部力量的传导，屈肌群的肌腱一路延伸到指骨，握力全靠这排「前置发动机」发货。',
    injuries: '常见：桡骨远端骨折——摔倒手撑地的头号经典款。',
  },
  {
    id: 'hand', nameZh: '手腕与手',
    bones: ['腕骨（舟骨等 8 块）', '掌骨'],
    muscles: [
      { nameZh: '屈指肌腱', role: '从前臂穿过腕管，隔空驱动手指' },
    ],
    motion: '手本身几乎没有肌肉，全靠前臂肌肉的肌腱像提线木偶一样操纵五根手指——所以手的伤常常根源在前臂。',
    injuries: '常见：舟骨骨折、滑雪杖导致的拇指掌指关节扭伤。',
  },
  {
    id: 'chest', nameZh: '胸部',
    bones: ['胸骨', '肋骨（12 对）', '胸椎'],
    muscles: [
      { nameZh: '胸大肌', role: '推与撑，胸前的「门板」' },
      { nameZh: '肋间肌', role: '在肋骨之间辅助呼吸' },
    ],
    motion: '肋骨像鸟笼一样护住心肺，肋间肌在缝隙间撑开收拢辅助呼吸；胸大肌从锁骨和胸骨一路铺到肱骨，负责把身体撑起来。',
    injuries: '常见：肋骨挫伤与应力损伤。胸口拍在雪面或把杖戳进肋骨间。',
  },
  {
    id: 'abdomen', nameZh: '腹部',
    bones: ['腰椎上段', '腹白线'],
    muscles: [
      { nameZh: '腹直肌', role: '屈脊柱，收核心' },
      { nameZh: '腹斜肌', role: '转体与侧向稳定' },
    ],
    motion: '腹肌群像一条宽腰带包裹躯干前方，与背部竖脊肌一前一后把躯干绷成刚体——一切转体动作的轴心都在这。',
    injuries: '常见：腹肌拉伤。冷天没热身就强行发力转体是标准配方。',
  },
  {
    id: 'back_spine', nameZh: '背部与脊柱',
    bones: ['胸椎', '腰椎', '肩胛骨'],
    muscles: [
      { nameZh: '斜方肌', role: '升降与后收肩带' },
      { nameZh: '背阔肌', role: '把上臂向后向下拉，身上最大的「翼」' },
      { nameZh: '竖脊肌', role: '像桅杆的稳定索，把脊柱立起来' },
    ],
    motion: '脊柱是堆叠的积木串，两侧竖脊肌像钢索把它绷直；背阔肌压重心时把上臂牢牢按下来——滑行压低姿态全靠它俩合作。',
    injuries: '常见：腰肌劳损、腰椎小关节紊乱。落地没屈膝，腰就替腿挨了这一下。',
  },
  {
    id: 'pelvis_hip', nameZh: '髋与骨盆',
    bones: ['髂骨', '坐骨', '尾骨', '股骨头'],
    muscles: [
      { nameZh: '臀大肌', role: '伸髋，从坐姿站起来的主力' },
      { nameZh: '髂腰肌', role: '屈髋抬腿' },
    ],
    motion: '骨盆是上下半身的传动盘：臀大肌从骨盆后侧拉股骨把身体推进站立，前面的髂腰肌负责把腿抬起来——一前一后像曲轴。',
    injuries: '常见：尾骨挫伤——摔屁墩儿的头号受害者；髋部挫伤。',
  },
  {
    id: 'thigh', nameZh: '大腿',
    bones: ['股骨（全身最长最壮的骨）'],
    muscles: [
      { nameZh: '股四头肌', role: '伸膝，前方主引擎' },
      { nameZh: '腘绳肌', role: '屈膝并充当刹车片' },
      { nameZh: '内收肌群', role: '并腿夹紧，稳住中线' },
    ],
    motion: '股四头肌在前、腘绳肌在后，隔着股骨对拉：一收一放完成每一次蹬伸，滑行减速时它们轮流当刹车片。',
    injuries: '常见：股四头肌挫伤（被板刃或球鞋对抡）、腘绳肌拉伤（没热身就冲刺）。',
  },
  {
    id: 'knee', nameZh: '膝',
    bones: ['股骨远端', '胫骨近端', '髌骨'],
    muscles: [
      { nameZh: '股四头肌', role: '经髌骨与髌腱拉动胫骨伸膝' },
      { nameZh: '腘绳肌', role: '屈膝减速，膝后方的缰绳' },
    ],
    motion: '髌骨是天然的定滑轮：股四头肌的力经它转向、贴着股骨滑车把胫骨结节拉起来，让伸膝省力一截——全身最精巧的省力结构之一。',
    injuries: '常见：前交叉韧带损伤、半月板撕裂、髌腱炎。被固定在雪鞋里的膝是最先抗议的关节。',
  },
  {
    id: 'shin', nameZh: '小腿',
    bones: ['胫骨', '腓骨'],
    muscles: [
      { nameZh: '胫骨前肌', role: '勾脚背，控制脚尖朝向' },
      { nameZh: '腓肠肌与比目鱼肌', role: '蹬地踮脚，力量经跟腱发出' },
    ],
    motion: '胫骨直接躺在皮下，几乎没有肌肉缓冲；后侧的腓肠肌像两瓣发动机，靠跟腱这根粗缆把力传到跟骨。',
    injuries: '常见：胫骨挫伤（板刃、球鞋正面对抡）、小腿抽筋。',
  },
  {
    id: 'ankle_foot', nameZh: '踝与足',
    bones: ['距骨', '跟骨', '跖骨'],
    muscles: [
      { nameZh: '腓骨肌群', role: '外翻脚掌，护住踝外侧防线' },
      { nameZh: '胫骨后肌腱', role: '支撑足弓内侧' },
    ],
    motion: '距骨像一块塞进胫腓骨钳口的积木，承重全从它过；腓骨肌在踝外侧拉紧防线——内翻扭伤时被撕扯的就是这批肌肉与韧带。',
    injuries: '常见：踝内翻扭伤、跟腱炎、第五跖骨基底骨折。',
  },
];

export const REGION_MAP = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** 把卡片渲染成喂给大模型的纯文本（科普模式唯一事实来源） */
export function regionCardText(id) {
  const r = REGION_MAP[id];
  if (!r) return null;
  return [
    `【部位】${r.nameZh}`,
    `【骨骼】${r.bones.join('、')}`,
    `【肌肉与分工】${r.muscles.map((m) => `${m.nameZh}——${m.role}`).join('；')}`,
    `【协作方式】${r.motion}`,
    `【常见损伤】${r.injuries}`,
  ].join('\n');
}

/** 严重度 → 展示标签（用于战损列表的 tooltip） */
export const SEVERITY_LABEL = ['', '擦伤级', '影响走路', '请假三天', '见了医生', '打上石膏'];

/** 热力等级：按部位战损总分（severity 之和）分 5 档 */
export function heatLevel(score) {
  if (score <= 0) return 0;
  if (score <= 3) return 1;
  if (score <= 6) return 2;
  if (score <= 10) return 3;
  return 4;
}

/** 战损记录 → 每个区域的聚合分布（前端热力图与榜单共用） */
export function distribution(records) {
  const map = {};
  for (const r of records) {
    if (!REGION_MAP[r.regionId]) continue;
    const d = (map[r.regionId] ??= {
      regionId: r.regionId, count: 0, score: 0, maxSeverity: 0, members: [],
    });
    d.count += 1;
    d.score += r.severity;
    d.maxSeverity = Math.max(d.maxSeverity, r.severity);
    d.members.push({ name: r.anonymous ? '匿名群友' : r.member, severity: r.severity });
  }
  for (const d of Object.values(map)) d.level = heatLevel(d.score);
  return map;
}

/** 校验外部注入的记录字段（server 与前端表单共用） */
export function validateRecord(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['记录必须是对象'];
  const member = String(input.member ?? '').trim();
  if (!input.anonymous && member.length < 1) errors.push('昵称不能为空');
  if (!input.anonymous && member.length > 24) errors.push('昵称过长（≤24 字）');
  if (!REGION_MAP[input.regionId]) errors.push('部位不合法');
  const sev = Number(input.severity);
  if (!Number.isInteger(sev) || sev < 1 || sev > 5) errors.push('严重度必须是 1-5 的整数');
  if (input.note != null && String(input.note).length > 80) errors.push('经过说明过长（≤80 字）');
  if (input.sport != null && String(input.sport).length > 12) errors.push('运动名过长（≤12 字）');
  return errors;
}

/** 供战损榜与 AI 调侃使用的「一句话摘要」 */
export function recordLine(r) {
  const name = r.anonymous ? '匿名群友' : r.member;
  const sport = r.sport ? `${r.sport}，` : '';
  const note = r.note ? `${r.note}` : '原因保密';
  return `${name}：${sport}${note}（严重度 ${r.severity}/5）`;
}
