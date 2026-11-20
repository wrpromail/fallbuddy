import type {
  AvatarState,
  Group,
  Incident,
  InteractionEvent,
  InventoryItem,
  LedgerEntry,
  Membership,
  PublicUser,
  Story,
  StoryUpdate,
  UserPreferences,
} from './types';

/** 运行时数据库（V0 为本地存储；V1 由云函数以同一结构承载） */
export interface UserRecord extends PublicUser {
  /** 仅服务端使用，绝不返回客户端 */
  openid: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  targetId: string;
  eventId: string;
  kind: 'interaction';
  readAt: string | null;
  createdAt: string;
}

export interface WeeklyGrantRecord {
  userId: string;
  weekKey: string;
  grantId: string;
  items: string[];
  createdAt: string;
}

export interface InviteRecord {
  tokenHash: string;
  groupId: string;
  ownerId: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  status: 'active' | 'revoked';
}

export interface OperationRecord {
  action: string;
  userId: string;
  requestId: string;
  createdAt: string;
  /** 已序列化的 ApiResponse，保证重复请求返回同一结果 */
  response: string;
}

export interface DbState {
  schemaVersion: 1;
  currentUserId: string;
  seededAt: string;
  users: UserRecord[];
  avatars: AvatarState[];
  groups: Group[];
  memberships: Membership[];
  incidents: Incident[];
  stories: Story[];
  storyUpdates: StoryUpdate[];
  inventory: InventoryItem[];
  ledger: LedgerEntry[];
  interactions: InteractionEvent[];
  notifications: NotificationRecord[];
  weeklyGrants: WeeklyGrantRecord[];
  invites: InviteRecord[];
  operations: Record<string, OperationRecord>;
}
