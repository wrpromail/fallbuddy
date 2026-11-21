/** 受控枚举：与 schemas/incident.schema.json、schemas/avatar.schema.json 保持一致 */

export const SCHEMA_VERSION = 1;

export const SPORTS = ['ski_double', 'ski_single', 'inline_skate', 'cycling', 'ball_sport', 'other'] as const;
export type Sport = (typeof SPORTS)[number];
export const SPORT_LABEL: Record<Sport, string> = {
  ski_double: '双板滑雪',
  ski_single: '单板滑雪',
  inline_skate: '轮滑',
  cycling: '骑行',
  ball_sport: '球类',
  other: '其他运动',
};
export const SPORT_EMOJI: Record<Sport, string> = {
  ski_double: '🎿',
  ski_single: '🏂',
  inline_skate: '🛼',
  cycling: '🚲',
  ball_sport: '🏀',
  other: '🏃',
};

export const SCENARIOS = ['turning', 'braking', 'flat_ground', 'lift', 'queue', 'collision', 'other', 'unknown'] as const;
export type Scenario = (typeof SCENARIOS)[number];
export const SCENARIO_LABEL: Record<Scenario, string> = {
  turning: '转弯',
  braking: '刹车',
  flat_ground: '平地滑行',
  lift: '缆车',
  queue: '排队',
  collision: '碰撞',
  other: '其他',
  unknown: '说不清',
};

export const CAUSES = ['edge_catch', 'balance_loss', 'too_fast', 'obstacle', 'contact_with_other', 'unknown', 'other'] as const;
export type Cause = (typeof CAUSES)[number];
export const CAUSE_LABEL: Record<Cause, string> = {
  edge_catch: '卡刃',
  balance_loss: '重心失控',
  too_fast: '速度太快',
  obstacle: '没注意障碍',
  contact_with_other: '和别人碰了一下',
  unknown: '原因未知',
  other: '其他',
};

export const BODY_PARTS = [
  'head',
  'shoulder_l',
  'shoulder_r',
  'wrist_l',
  'wrist_r',
  'back',
  'waist',
  'tailbone',
  'knee_l',
  'knee_r',
  'ankle_l',
  'ankle_r',
  'other',
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];
export const BODY_PART_LABEL: Record<BodyPart, string> = {
  head: '头',
  shoulder_l: '左肩',
  shoulder_r: '右肩',
  wrist_l: '左手腕',
  wrist_r: '右手腕',
  back: '背',
  waist: '腰',
  tailbone: '尾椎',
  knee_l: '左膝',
  knee_r: '右膝',
  ankle_l: '左脚踝',
  ankle_r: '右脚踝',
  other: '其他',
};

export const IMPACT_KINDS = ['near_miss', 'minor_discomfort', 'stopped_activity', 'prefer_not_to_say'] as const;
export type ImpactKind = (typeof IMPACT_KINDS)[number];
export const IMPACT_LABEL: Record<ImpactKind, string> = {
  near_miss: '虚惊一场',
  minor_discomfort: '轻微不适',
  stopped_activity: '当天停止运动',
  prefer_not_to_say: '本人选择不描述',
};

export const PROTECTIVE_ITEMS = ['helmet', 'goggles', 'hip_protector', 'knee_pad', 'wrist_guard', 'gloves', 'other'] as const;
export type ProtectiveItem = (typeof PROTECTIVE_ITEMS)[number];
export const PROTECTIVE_LABEL: Record<ProtectiveItem, string> = {
  helmet: '头盔',
  goggles: '雪镜',
  hip_protector: '护臀',
  knee_pad: '护膝',
  wrist_guard: '护腕',
  gloves: '手套',
  other: '其他护具',
};

export const PALETTES = ['blue', 'orange', 'purple', 'mint'] as const;
export type Palette = (typeof PALETTES)[number];
export const PALETTE_COLOR: Record<Palette, string> = {
  blue: '#4C8DFF',
  orange: '#FFA14A',
  purple: '#9B7BFF',
  mint: '#5ED6B3',
};

export const HEAD_SHAPES = ['round', 'soft_square'] as const;
export type HeadShape = (typeof HEAD_SHAPES)[number];

export const EXPRESSIONS = ['happy', 'surprised', 'awkward', 'comfort', 'cool'] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export const EXPRESSION_LABEL: Record<Expression, string> = {
  happy: '开心',
  surprised: '惊了',
  awkward: '尴尬',
  comfort: '求安慰',
  cool: '酷',
};

export const TONES = ['humorous', 'supportive', 'neutral'] as const;
export type Tone = (typeof TONES)[number];
export const TONE_LABEL: Record<Tone, string> = {
  humorous: '轻松调侃',
  supportive: '求安慰',
  neutral: '平实记录',
};

export const UPDATE_TYPES = [
  'follow_up',
  'insurance_experience',
  'clinic_experience',
  'equipment_reflection',
  'return_to_sport',
  'other',
] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];
export const UPDATE_TYPE_LABEL: Record<UpdateType, string> = {
  follow_up: '后续更新',
  insurance_experience: '保险亲历',
  clinic_experience: '就医亲历',
  equipment_reflection: '装备复盘',
  return_to_sport: '回归运动',
  other: '其他',
};

/** 装备槽位（与 rig 图层 slot 对应） */
export const EQUIP_SLOTS = ['headgear', 'goggles', 'outfit', 'hip_protector', 'boots', 'gloves', 'knee_pads', 'handheld'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];
export const CARRY_HANDS = ['left', 'right'] as const;
export type CarryHand = (typeof CARRY_HANDS)[number];
export const EQUIP_SLOT_LABEL: Record<EquipSlot, string> = {
  headgear: '头饰',
  goggles: '雪镜',
  outfit: '服装',
  hip_protector: '护臀',
  boots: '鞋靴',
  gloves: '手套',
  knee_pads: '护膝',
  handheld: '手持',
};

export function labelOf<T extends string>(map: Record<T, string>, value: string): string {
  return (map as Record<string, string>)[value] ?? value;
}
