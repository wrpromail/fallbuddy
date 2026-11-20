import type {
  BodyPart,
  Cause,
  EquipSlot,
  Expression,
  ImpactKind,
  Palette,
  ProtectiveItem,
  Scenario,
  Sport,
  Tone,
  UpdateType,
} from './enums';

/* ------------------------------------------------------------ 通用响应信封 */

export type ApiCode =
  | 'OK'
  | 'UNAUTHORIZED'
  | 'NOT_MEMBER'
  | 'NOT_VISIBLE'
  | 'RATE_LIMIT'
  | 'INTERACTION_DISABLED'
  | 'INVENTORY_INSUFFICIENT'
  | 'BUDGET_EXCEEDED'
  | 'AI_PROCESSING'
  | 'CONTENT_REJECTED'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED';

export type ErrorCode = Exclude<ApiCode, 'OK'>;

export interface ApiOk<T> {
  ok: true;
  code: 'OK';
  data: T;
  requestId: string;
}
export interface ApiErr {
  ok: false;
  code: ErrorCode;
  message: string;
  requestId: string;
}
export type ApiResponse<T> = ApiOk<T> | ApiErr;

/* -------------------------------------------------------------------- 用户 */

export interface PublicUser {
  id: string;
  displayName: string;
  palette: Palette;
  avatarId: string;
  isMe?: boolean;
}

export interface UserPreferences {
  allowFunnyActions: boolean;
  allowGifts: boolean;
  reduceMotion: boolean;
  anonymousByDefault: boolean;
}

export interface EquippedGear {
  headgear: string | null;
  goggles: string | null;
  outfit: string | null;
  hip_protector: string | null;
  boots: string | null;
}

export interface AvatarState {
  id: string;
  ownerId: string;
  rigVersion: 'skeleton-rig-v1';
  palette: Palette;
  equipped: EquippedGear;
  expression: Expression;
  privacy: {
    allowFunnyActions: boolean;
    allowGifts: boolean;
  };
  version: number;
}

/* ---------------------------------------------------------- 圈子 / 成员关系 */

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  joinMode: 'open' | 'approval';
  createdAt: string;
}

export interface Membership {
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'left';
  joinedAt: string;
}

export interface GroupSummary extends Group {
  memberCount: number;
  role: Membership['role'];
}

/* -------------------------------------------------------------- 事件与故事 */

export interface Incident {
  id: string;
  schemaVersion: 1;
  authorId: string;
  sport: Sport;
  scenario: Scenario[];
  selfReportedCause: Cause[];
  bodyParts: BodyPart[];
  impactKind: ImpactKind;
  protectiveItems: ProtectiveItem[];
  source: 'manual' | 'ai_assisted';
  venueId: string | null;
  userSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
export type PublishStatus = 'draft' | 'published' | 'withdrawn';
/** 发布范围：groups=指定圈子；self=仅自己可见（不进入任何圈子图鉴） */
export type StoryVisibility = 'groups' | 'self';

export interface Story {
  id: string;
  schemaVersion: 1;
  incidentId: string;
  authorId: string;
  title: string;
  body: string;
  tone: Tone;
  visibility: StoryVisibility;
  visibilityGroupIds: string[];
  allowFunnyActions: boolean;
  allowGifts: boolean;
  isAnonymous: boolean;
  moderationStatus: ModerationStatus;
  publishStatus: PublishStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryUpdate {
  id: string;
  storyId: string;
  authorId: string;
  type: UpdateType;
  body: string;
  visibilityGroupIds: string[];
  moderationStatus: ModerationStatus;
  createdAt: string;
}

/* -------------------------------------------------------------- 互动与道具 */

export type ActionId = 'hug' | 'spin' | 'cheer' | 'receive_gift';

export interface ReactionSummary {
  actionId: ActionId;
  count: number;
  mine: number;
}

export interface InteractionEvent {
  id: string;
  storyId: string;
  actorId: string;
  targetId: string;
  actionId: ActionId;
  itemDefId?: string;
  animationVersion: number;
  status: 'ok' | 'hidden';
  createdAt: string;
}

export interface InboxEvent extends InteractionEvent {
  actorName: string;
  storyTitle: string;
  read: boolean;
}

export type ItemCategory = 'cosmetic' | 'consumable' | 'badge';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  assetKey: string;
  transferable: boolean;
  permanent: boolean;
  ttlDays?: number;
  maxStack: number;
  slot?: EquipSlot;
  icon: string;
  description: string;
}

export interface InventoryItem {
  id: string;
  ownerId: string;
  itemDefId: string;
  quantity: number;
  expiresAt: string | null;
  version: number;
}

export interface InventoryView extends InventoryItem {
  name: string;
  category: ItemCategory;
  icon: string;
  expiresText: string;
  equipped: boolean;
}

export interface WeeklyStatus {
  weekKey: string;
  claimed: boolean;
  grantId: string | null;
  items: InventoryView[];
}

export interface LedgerEntry {
  operationId: string;
  fromUserId: string | null;
  toUserId: string | null;
  itemDefId: string;
  delta: number;
  eventId: string;
  createdAt: string;
}

/* -------------------------------------------------------------------- 图鉴 */

export interface AtlasUserChip {
  userId: string;
  displayName: string;
  palette: Palette;
  expression: Expression;
  equipped: EquippedGear;
  isAnonymous: boolean;
}

export interface HotspotSummary {
  id: BodyPart;
  label: string;
  count: number;
  users: AtlasUserChip[];
  storyIds: string[];
  /** V0 状态贴纸：按该部位最新故事的语气/情况推导；无故事为空字符串 */
  sticker: string;
}

export interface AtlasStoryCard {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  sport: Sport;
  bodyParts: BodyPart[];
  impactKind: ImpactKind;
  tone: Tone;
  visibility: StoryVisibility;
  allowFunnyActions: boolean;
  allowGifts: boolean;
  publishStatus: PublishStatus;
  createdAt: string;
  palette: Palette;
  expression: Expression;
  equipped: EquippedGear;
}

export interface AtlasData {
  group: GroupSummary;
  view: 'front' | 'back';
  period: 'week' | 'all';
  hotspots: HotspotSummary[];
  storyCount: number;
  participantCount: number;
  hottest: { bodyPart: BodyPart; label: string; count: number }[];
  stories: AtlasStoryCard[];
}

/* ---------------------------------------------------------------- 故事详情 */

export interface StoryDetail {
  story: Story;
  incident: Incident;
  author: PublicUser;
  avatar: AvatarState;
  updates: StoryUpdate[];
  reactions: ReactionSummary[];
  myReactions: ReactionSummary[];
  giftable: boolean;
  canSpin: boolean;
  group: GroupSummary | null;
  canInteract: boolean;
  /** 当前调用者是否是作者（匿名故事不能靠 authorId 判断） */
  viewerIsAuthor: boolean;
}

/* -------------------------------------------------------------------- 动作 */

export interface ActionDefinition {
  id: ActionId;
  name: string;
  assetKey: string;
  durationMs: number;
  requiresFunnyConsent: boolean;
  requiresGift: boolean;
  maxPerActorPerStoryPerDay: number;
  fallbackEmoji: string;
}

/* ---------------------------------------------------------------- 请求参数 */

export interface CreateStoryInput {
  incident: {
    sport: Sport;
    scenario: Scenario[];
    selfReportedCause: Cause[];
    bodyParts: BodyPart[];
    impactKind: ImpactKind;
    protectiveItems: ProtectiveItem[];
    userSummary?: string;
  };
  story: {
    title: string;
    body: string;
    tone: Tone;
    /** 缺省为 groups，兼容既有调用方 */
    visibility?: StoryVisibility;
    visibilityGroupIds: string[];
    allowFunnyActions: boolean;
    allowGifts: boolean;
    isAnonymous: boolean;
  };
}

export interface GroupMemberView {
  userId: string;
  displayName: string;
  role: Membership['role'];
  palette: Palette;
  expression: Expression;
  equipped: EquippedGear;
  isMe: boolean;
  storyCount: number;
}
