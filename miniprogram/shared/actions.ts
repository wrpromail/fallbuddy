import type { ActionDefinition, ActionId } from './types';

/**
 * 动作协议：客户端本地按 ActionDefinition 播放，不生成视频文件。
 * assetKey 指向动作资源；V0 用 WXSS 关键帧实现，缺失时降级为 emoji。
 */
export const ACTIONS: ActionDefinition[] = [
  {
    id: 'hug',
    name: '抱抱',
    assetKey: 'actions/hug-v1',
    durationMs: 1400,
    requiresFunnyConsent: false,
    requiresGift: false,
    maxPerActorPerStoryPerDay: 3,
    fallbackEmoji: '🫂',
  },
  {
    id: 'spin',
    name: '转圈',
    assetKey: 'actions/spin-v1',
    durationMs: 900,
    requiresFunnyConsent: true,
    requiresGift: false,
    maxPerActorPerStoryPerDay: 3,
    fallbackEmoji: '😵‍💫',
  },
  {
    id: 'cheer',
    name: '鼓掌',
    assetKey: 'actions/cheer-v1',
    durationMs: 900,
    requiresFunnyConsent: false,
    requiresGift: false,
    maxPerActorPerStoryPerDay: 3,
    fallbackEmoji: '👏',
  },
  {
    id: 'receive_gift',
    name: '收装备',
    assetKey: 'actions/receive-gift-v1',
    durationMs: 1300,
    requiresFunnyConsent: false,
    requiresGift: true,
    maxPerActorPerStoryPerDay: 3,
    fallbackEmoji: '🎁',
  },
];

export const ACTION_MAP: Record<ActionId, ActionDefinition> = ACTIONS.reduce(
  (acc, action) => {
    acc[action.id] = action;
    return acc;
  },
  {} as Record<ActionId, ActionDefinition>,
);

/** 故事详情页的主要互动按钮（礼物在背包选择后单独触发） */
export const REACTION_ACTION_IDS: ActionId[] = ['hug', 'spin', 'cheer'];

/**
 * 方案 5.4：同一用户对同一故事每天最多 3 次互动（抱抱/转圈/鼓掌合计）。
 * ActionDefinition 里的 maxPerActorPerStoryPerDay 保留为单动作配置，服务端以本常量为准。
 */
export const MAX_INTERACTIONS_PER_DAY = 3;

/** 动画协议版本：历史事件回放时用于降级 */
export const ANIMATION_VERSION = 1;

/** 每位互动者每日赠送上限（与后端一致） */
export const MAX_GIFTS_PER_DAY = 3;
