import type { BodyPart, Cause, Expression, ImpactKind, Palette, ProtectiveItem, Scenario, Sport, Tone, UpdateType } from '../shared/enums';
import type { EquippedGear, UserPreferences } from '../shared/types';

/**
 * V0 本地演示数据（全部为虚构人物与故事，不涉及真实雪场、真实伤情或真实个人）。
 * 时间用「距今多少小时」表示，seed 时换算成绝对时间，保证「本周」统计始终有意义。
 */

export interface FixtureUser {
  id: string;
  displayName: string;
  palette: Palette;
  expression: Expression;
  equipped: EquippedGear;
  preferences: UserPreferences;
  hoursAgo: number;
}

export interface FixtureGroup {
  id: string;
  name: string;
  ownerId: string;
  joinMode: 'open' | 'approval';
  hoursAgo: number;
}

export interface FixtureStory {
  id: string;
  authorId: string;
  groupIds: string[];
  title: string;
  body: string;
  tone: Tone;
  sport: Sport;
  scenario: Scenario[];
  cause: Cause[];
  bodyParts: BodyPart[];
  impactKind: ImpactKind;
  protectiveItems: ProtectiveItem[];
  allowFunnyActions: boolean;
  allowGifts: boolean;
  isAnonymous?: boolean;
  hoursAgo: number;
  updates?: { type: UpdateType; body: string; hoursAgo: number }[];
  reactions?: { actionId: 'hug' | 'spin' | 'cheer'; actors: string[]; hoursAgo: number }[];
  gift?: { from: string; itemDefId: string; hoursAgo: number };
}

export const ME = 'usr_me';

export const USERS: FixtureUser[] = [
  {
    id: 'usr_me',
    displayName: '小北',
    palette: 'blue',
    expression: 'happy',
    equipped: {
      headgear: 'beanie_blue',
      goggles: null,
      outfit: 'ski_blue',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
    preferences: { allowFunnyActions: true, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
    hoursAgo: 24 * 40,
  },
  {
    id: 'usr_lin',
    displayName: '林小满',
    palette: 'orange',
    expression: 'cool',
    equipped: {
      headgear: 'helmet_red',
      goggles: 'snow_goggles',
      outfit: 'suit_orange',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
    preferences: { allowFunnyActions: true, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
    hoursAgo: 24 * 40,
  },
  {
    id: 'usr_yu',
    displayName: '余可',
    palette: 'mint',
    expression: 'surprised',
    equipped: {
      headgear: 'beanie_blue',
      goggles: null,
      outfit: 'vest_mint',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
    preferences: { allowFunnyActions: true, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
    hoursAgo: 24 * 40,
  },
  {
    id: 'usr_tang',
    displayName: '唐不苦',
    palette: 'purple',
    expression: 'awkward',
    equipped: {
      headgear: 'helmet_red',
      goggles: null,
      outfit: 'ski_blue',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
    preferences: { allowFunnyActions: false, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
    hoursAgo: 24 * 39,
  },
  {
    id: 'usr_zhou',
    displayName: '周三石',
    palette: 'blue',
    expression: 'comfort',
    equipped: {
      headgear: 'beanie_blue',
      goggles: null,
      outfit: 'suit_orange',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
    preferences: { allowFunnyActions: false, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
    hoursAgo: 24 * 39,
  },
  {
    id: 'usr_ma',
    displayName: '马大哈',
    palette: 'orange',
    expression: 'happy',
    equipped: {
      headgear: 'beanie_blue',
      goggles: null,
      outfit: 'vest_mint',
      hip_protector: 'basic_hip_protector',
      boots: null,
    },
    preferences: { allowFunnyActions: true, allowGifts: true, reduceMotion: false, anonymousByDefault: false },
    hoursAgo: 24 * 38,
  },
];

export const GROUPS: FixtureGroup[] = [
  { id: 'grp_snow', name: '周末雪场小分队', ownerId: 'usr_lin', joinMode: 'approval', hoursAgo: 24 * 35 },
  { id: 'grp_skate', name: '陆地冲浪局', ownerId: 'usr_me', joinMode: 'open', hoursAgo: 24 * 30 },
  { id: 'grp_private', name: '内部封测小组', ownerId: 'usr_lin', joinMode: 'approval', hoursAgo: 24 * 20 },
];

export const MEMBERSHIPS: { groupId: string; userId: string; role: 'owner' | 'admin' | 'member'; hoursAgo: number }[] = [
  { groupId: 'grp_snow', userId: 'usr_lin', role: 'owner', hoursAgo: 24 * 35 },
  { groupId: 'grp_snow', userId: 'usr_me', role: 'member', hoursAgo: 24 * 34 },
  { groupId: 'grp_snow', userId: 'usr_yu', role: 'member', hoursAgo: 24 * 33 },
  { groupId: 'grp_snow', userId: 'usr_tang', role: 'member', hoursAgo: 24 * 31 },
  { groupId: 'grp_snow', userId: 'usr_zhou', role: 'member', hoursAgo: 24 * 28 },
  { groupId: 'grp_skate', userId: 'usr_me', role: 'owner', hoursAgo: 24 * 30 },
  { groupId: 'grp_skate', userId: 'usr_yu', role: 'member', hoursAgo: 24 * 29 },
  { groupId: 'grp_skate', userId: 'usr_ma', role: 'member', hoursAgo: 24 * 27 },
  { groupId: 'grp_private', userId: 'usr_lin', role: 'owner', hoursAgo: 24 * 20 },
  { groupId: 'grp_private', userId: 'usr_ma', role: 'member', hoursAgo: 24 * 19 },
];

export const STORIES: FixtureStory[] = [
  {
    id: 'sty_tailbone',
    authorId: 'usr_lin',
    groupIds: ['grp_snow'],
    title: '尾椎渡劫记',
    body: '左转的时候板刃突然卡住，我原地表演了一个屁股先落地的标准动作。缓了两分钟才爬起来，后来提前下山去吃热可可了。',
    tone: 'humorous',
    sport: 'ski_double',
    scenario: ['turning'],
    cause: ['edge_catch'],
    bodyParts: ['tailbone'],
    impactKind: 'stopped_activity',
    protectiveItems: ['hip_protector'],
    allowFunnyActions: true,
    allowGifts: true,
    hoursAgo: 120,
    updates: [
      { type: 'clinic_experience', body: '后续：去拍了片子，医生让我回家冰敷休息，别急着再上雪。', hoursAgo: 96 },
      { type: 'return_to_sport', body: '已经能正常走路啦，下周准备重新上雪，先从魔毯开始。', hoursAgo: 26 },
    ],
    reactions: [
      { actionId: 'hug', actors: ['usr_me', 'usr_yu', 'usr_tang'], hoursAgo: 98 },
      { actionId: 'cheer', actors: ['usr_zhou'], hoursAgo: 70 },
    ],
  },
  {
    id: 'sty_me_seat',
    authorId: ME,
    groupIds: ['grp_snow', 'grp_skate'],
    title: '第一次雪地坐姿',
    body: '跟着视频学换刃，结果屁股先学会了刹车。护臀今天立大功，人没事，就是有点丢人。',
    tone: 'humorous',
    sport: 'ski_double',
    scenario: ['turning'],
    cause: ['edge_catch'],
    bodyParts: ['tailbone'],
    impactKind: 'near_miss',
    protectiveItems: ['hip_protector'],
    allowFunnyActions: true,
    allowGifts: true,
    hoursAgo: 44,
    reactions: [
      { actionId: 'hug', actors: ['usr_lin'], hoursAgo: 3 },
      { actionId: 'cheer', actors: ['usr_yu'], hoursAgo: 20 },
    ],
    gift: { from: 'usr_zhou', itemDefId: 'hot_cocoa', hoursAgo: 24 },
  },
  {
    id: 'sty_wrist',
    authorId: 'usr_ma',
    groupIds: ['grp_skate'],
    title: '手腕说它今天不想上班',
    body: '轮滑场看到一个小坡就想试试，结果重心一飘，手先着地。护腕真的救命，回家还能继续打游戏。',
    tone: 'humorous',
    sport: 'inline_skate',
    scenario: ['flat_ground'],
    cause: ['balance_loss'],
    bodyParts: ['wrist_l'],
    impactKind: 'minor_discomfort',
    protectiveItems: ['wrist_guard'],
    allowFunnyActions: true,
    allowGifts: true,
    hoursAgo: 70,
    reactions: [{ actionId: 'cheer', actors: ['usr_me', 'usr_yu'], hoursAgo: 40 }],
  },
  {
    id: 'sty_head',
    authorId: 'usr_yu',
    groupIds: ['grp_snow'],
    title: '差一点就飞升',
    body: '下坡想刹车，速度没收住，直接从雪堆上飞过去。头盔磕了一下，人没事，心跳到嗓子眼。',
    tone: 'humorous',
    sport: 'ski_double',
    scenario: ['braking'],
    cause: ['too_fast'],
    bodyParts: ['head'],
    impactKind: 'near_miss',
    protectiveItems: ['helmet'],
    allowFunnyActions: true,
    allowGifts: true,
    hoursAgo: 90,
    reactions: [
      { actionId: 'hug', actors: ['usr_me'], hoursAgo: 70 },
      { actionId: 'cheer', actors: ['usr_zhou'], hoursAgo: 60 },
    ],
  },
  {
    id: 'sty_knee',
    authorId: 'usr_tang',
    groupIds: ['grp_snow'],
    title: '共享单车教我做人的一天',
    body: '路口躲一只突然窜出来的猫，车把一歪就摔了。膝盖磕青了一块，当天就没再骑。感谢护膝，也感谢那只猫没受伤。',
    tone: 'supportive',
    sport: 'cycling',
    scenario: ['flat_ground'],
    cause: ['obstacle'],
    bodyParts: ['knee_l'],
    impactKind: 'stopped_activity',
    protectiveItems: ['knee_pad'],
    allowFunnyActions: false,
    allowGifts: true,
    hoursAgo: 110,
    updates: [{ type: 'follow_up', body: '冰敷了两天，走路基本正常，周末先休息不骑车了。', hoursAgo: 60 }],
    reactions: [{ actionId: 'hug', actors: ['usr_me', 'usr_lin'], hoursAgo: 100 }],
  },
  {
    id: 'sty_waist',
    authorId: 'usr_zhou',
    groupIds: ['grp_snow'],
    title: '缆车排队时被雪板绊了一下',
    body: '排队上缆车的时候被后面滑过来的雪板绊了一下，膝盖着地。没大事，就是当时有点懵，想安静一会儿。',
    tone: 'supportive',
    sport: 'ski_double',
    scenario: ['lift', 'queue'],
    cause: ['unknown'],
    bodyParts: ['waist'],
    impactKind: 'prefer_not_to_say',
    protectiveItems: ['hip_protector'],
    allowFunnyActions: false,
    allowGifts: true,
    hoursAgo: 20,
    reactions: [{ actionId: 'hug', actors: ['usr_me', 'usr_lin', 'usr_tang'], hoursAgo: 10 }],
  },
  {
    id: 'sty_private',
    authorId: 'usr_lin',
    groupIds: ['grp_private'],
    title: '封测组的内部故事',
    body: '这句话只应该出现在封测小组里。如果其他圈子的朋友能看到，说明权限有 bug。',
    tone: 'neutral',
    sport: 'ski_single',
    scenario: ['other'],
    cause: ['unknown'],
    bodyParts: ['wrist_r'],
    impactKind: 'prefer_not_to_say',
    protectiveItems: [],
    allowFunnyActions: true,
    allowGifts: true,
    hoursAgo: 15,
    reactions: [],
  },
  {
    id: 'sty_back',
    authorId: 'usr_ma',
    groupIds: ['grp_skate'],
    title: '篮球场上的空中转体两周半',
    body: '抢篮板落地踩到别人的脚，背先着地。缓了半分钟，被队友笑称空中转体两周半，其实我一点都不想转。',
    tone: 'humorous',
    sport: 'ball_sport',
    scenario: ['other'],
    cause: ['contact_with_other'],
    bodyParts: ['back'],
    impactKind: 'near_miss',
    protectiveItems: ['other'],
    allowFunnyActions: true,
    allowGifts: true,
    isAnonymous: true,
    hoursAgo: 50,
    reactions: [{ actionId: 'cheer', actors: ['usr_me'], hoursAgo: 30 }],
  },
];
