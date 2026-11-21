import type { ItemDefinition } from './types';

/**
 * 道具定义（全局共享模板）。库存只保存 itemDefId + ownerId + quantity。
 * 所有道具免费、无现金价值、不可交易（除明确 transferable 的互动道具）。
 */
export const STARTER_COSMETICS = ['ski_blue', 'basic_hip_protector'] as const;
export const SNOWBOARD_ID = 'snowboard_dawn';

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'ski_blue',
    name: '基础蓝雪服',
    category: 'cosmetic',
    assetKey: 'rigs/front/outfit/ski_blue',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'outfit',
    icon: '🧥',
    description: '首次创建角色即拥有的原创雪服。',
  },
  {
    id: 'suit_orange',
    name: '落日橙连体服',
    category: 'cosmetic',
    assetKey: 'rigs/front/outfit/suit_orange',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'outfit',
    icon: '🧥',
    description: '在雪场一眼就能被搭子找到。',
  },
  {
    id: 'vest_mint',
    name: '薄荷小马甲',
    category: 'cosmetic',
    assetKey: 'rigs/front/outfit/vest_mint',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'outfit',
    icon: '🎽',
    description: '轻薄马甲，适合陆地冲浪局。',
  },
  {
    id: 'beanie_blue',
    name: '蓝毛线帽',
    category: 'cosmetic',
    assetKey: 'rigs/front/headgear/beanie_blue',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'headgear',
    icon: '🧢',
    description: '带小绒球的原创毛线帽。',
  },
  {
    id: 'helmet_red',
    name: '番茄红头盔',
    category: 'cosmetic',
    assetKey: 'rigs/front/headgear/helmet_red',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'headgear',
    icon: '⛑️',
    description: '护具救场奖的常驻嘉宾。',
  },
  {
    id: 'snow_goggles',
    name: '半透明雪镜',
    category: 'cosmetic',
    assetKey: 'rigs/front/goggles/snow_goggles',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'goggles',
    icon: '🥽',
    description: '镜片是半透明的，表情不会被挡住。',
  },
  {
    id: 'basic_hip_protector',
    name: '新手护臀',
    category: 'cosmetic',
    assetKey: 'rigs/front/hip_protector/basic_hip_protector',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'hip_protector',
    icon: '🛡️',
    description: '尾椎的忠实伙伴，首次创建角色即拥有。',
  },
  {
    id: 'snow_boots',
    name: '深蓝雪靴',
    category: 'cosmetic',
    assetKey: 'rigs/front/boots/snow_boots',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'boots',
    icon: '🥾',
    description: '带蓝色搭扣与深色鞋底的原创雪靴。',
  },
  {
    id: 'gloves_frost',
    name: '霜蓝雪地手套',
    category: 'cosmetic',
    assetKey: 'rigs/front/glove_left/gloves_frost',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'gloves',
    icon: '🧤',
    description: '成对穿戴，正面可看到掌心补强。',
  },
  {
    id: 'pads_slate',
    name: '青岩护膝',
    category: 'cosmetic',
    assetKey: 'rigs/front/knee_pads/pads_slate',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'knee_pads',
    icon: '🛡️',
    description: '正面是膝盖护壳，背面可看到固定带。',
  },
  {
    id: SNOWBOARD_ID,
    name: '晨光单板',
    category: 'cosmetic',
    assetKey: 'rigs/front/board_left/snowboard_dawn',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'handheld',
    icon: '🏂',
    description: '可由左手或右手握持，正背面显示板面与板底。',
  },
  {
    id: 'ski_poles',
    name: '冰川双雪杖',
    category: 'cosmetic',
    assetKey: 'rigs/front/pole_left/ski_poles',
    transferable: false,
    permanent: true,
    maxStack: 1,
    slot: 'handheld',
    icon: '⛷️',
    description: '每只手各握一根雪杖。',
  },
  {
    id: 'steel_hip_guard',
    name: '祖传钢铁护臀',
    category: 'consumable',
    assetKey: 'items/steel_hip_guard',
    slot: 'hip_protector',
    transferable: true,
    permanent: false,
    ttlDays: 30,
    maxStack: 8,
    icon: '🛡️',
    description: '互动礼物：可赠送、消耗或在衣橱试穿。穿戴期间须持有一件有效护臀。',
  },
  {
    id: 'hot_cocoa',
    name: '续命热可可',
    category: 'consumable',
    assetKey: 'items/hot_cocoa',
    transferable: true,
    permanent: false,
    ttlDays: 14,
    maxStack: 8,
    icon: '☕',
    description: '雪场休息区的温暖问候。',
  },
  {
    id: 'comfort_patch',
    name: '友谊创可贴',
    category: 'consumable',
    assetKey: 'items/comfort_patch',
    transferable: true,
    permanent: false,
    ttlDays: 14,
    maxStack: 8,
    icon: '🩹',
    description: '不代表医疗建议，只代表有人在。',
  },
];

export const ITEM_MAP: Record<string, ItemDefinition> = ITEM_DEFINITIONS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, ItemDefinition>,
);

/** 每周免费补给：固定 2 件，无分享要求，无现金价值 */
export const WEEKLY_GRANT = {
  count: 2,
  pool: ['steel_hip_guard', 'hot_cocoa', 'comfort_patch'] as string[],
};

export function itemIconPath(itemId: string): string {
  const item = ITEM_MAP[itemId];
  if (!item) return '';
  if (item.category === 'cosmetic') return '';
  return `/assets/items/${itemId}.png`;
}
