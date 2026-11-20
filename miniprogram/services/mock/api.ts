import { ANONYMOUS_APPEARANCE, EMPTY_GEAR, grantCosmetic } from '../../shared/avatar';
import { ACTIONS, ACTION_MAP, ANIMATION_VERSION, MAX_GIFTS_PER_DAY, MAX_INTERACTIONS_PER_DAY } from '../../shared/actions';
import { ITEM_DEFINITIONS, ITEM_MAP, WEEKLY_GRANT } from '../../shared/items';
import {
  BODY_PART_LABEL,
  EQUIP_SLOTS,
  EXPRESSIONS,
  PALETTES,
  HEAD_SHAPES,
  type HeadShape,
  UPDATE_TYPES,
  type UpdateType,
  type BodyPart,
  type Expression,
  type Palette,
} from '../../shared/enums';
import { addDays, dayKey, hashString, isThisWeek, relativeTime, weekKey } from '../../shared/time';
import { findSensitiveInfo } from '../../shared/moderation';
import { validateCreateStoryInput } from '../../shared/validation';
import { hotspotsFor, resolveRigLayers } from '../../shared/rig';
import { inviteTokenHash, loadState, loadStateForWrite, mintInviteToken, saveState } from '../store';
import type { DbState, UserRecord } from '../../shared/db-types';
import type {
  ActionId,
  ApiResponse,
  AtlasData,
  AtlasStoryCard,
  AtlasUserChip,
  AvatarState,
  CreateStoryInput,
  EquippedGear,
  ErrorCode,
  GroupMemberView,
  GroupSummary,
  HotspotSummary,
  InboxEvent,
  Incident,
  InteractionEvent,
  InventoryItem,
  InventoryView,
  PublicUser,
  ReactionSummary,
  Story,
  StoryDetail,
  StoryDraft,
  StoryReport,
  StoryUpdate,
  UserPreferences,
  WeeklyStatus,
} from '../../shared/types';

/* ------------------------------------------------------------------ 基础 */

let requestSeq = 0;

function nextRequestId(): string {
  requestSeq += 1;
  return `req_${Date.now().toString(36)}_${requestSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

function ok<T>(data: T, requestId: string): ApiResponse<T> {
  // 模拟云端序列化，避免调用方拿到内部对象引用
  return { ok: true, code: 'OK', data: JSON.parse(JSON.stringify(data)) as T, requestId };
}

function fail(code: ErrorCode, message: string, requestId: string): ApiResponse<never> {
  return { ok: false, code, message, requestId };
}

function hasWx(): boolean {
  return typeof wx !== 'undefined';
}

async function latency(): Promise<void> {
  if (!hasWx()) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 90 + Math.floor(Math.random() * 120));
  });
}

function opKey(action: string, userId: string, requestId: string): string {
  return `${action}|${userId}|${requestId}`;
}

function cached<T>(state: DbState, action: string, requestId: string): ApiResponse<T> | null {
  const record = state.operations[opKey(action, state.currentUserId, requestId)];
  if (!record) return null;
  return JSON.parse(record.response) as ApiResponse<T>;
}

function remember<T>(state: DbState, action: string, requestId: string, response: ApiResponse<T>): void {
  state.operations[opKey(action, state.currentUserId, requestId)] = {
    action,
    userId: state.currentUserId,
    requestId,
    createdAt: new Date().toISOString(),
    response: JSON.stringify(response),
  };
  const keys = Object.keys(state.operations);
  if (keys.length > 200) {
    const oldest = keys
      .map((key) => ({ key, at: state.operations[key].createdAt }))
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, keys.length - 200);
    for (const item of oldest) delete state.operations[item.key];
  }
}

/* ---------------------------------------------------------------- 查询工具 */

function me(state: DbState): UserRecord {
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('mock state missing current user');
  return user;
}

function userById(state: DbState, userId: string): UserRecord | undefined {
  return state.users.find((u) => u.id === userId);
}

function avatarOf(state: DbState, userId: string): AvatarState | undefined {
  return state.avatars.find((a) => a.ownerId === userId);
}

function toPublicUser(user: UserRecord, currentUserId: string): PublicUser {
  return {
    id: user.id,
    displayName: user.displayName,
    palette: user.palette,
    avatarId: user.avatarId,
    isMe: user.id === currentUserId,
  };
}

function isActiveMember(state: DbState, groupId: string, userId: string): boolean {
  return state.memberships.some((m) => m.groupId === groupId && m.userId === userId && m.status === 'active');
}

function membershipRole(state: DbState, groupId: string, userId: string): 'owner' | 'admin' | 'member' | null {
  const m = state.memberships.find((x) => x.groupId === groupId && x.userId === userId && x.status === 'active');
  return m ? m.role : null;
}

function groupSummary(state: DbState, groupId: string): GroupSummary | null {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return null;
  const role = membershipRole(state, groupId, state.currentUserId);
  if (!role) return null;
  return {
    ...group,
    role,
    memberCount: state.memberships.filter((m) => m.groupId === groupId && m.status === 'active').length,
  };
}

function visibleGroupIds(state: DbState, story: Story): string[] {
  return story.visibilityGroupIds.filter((groupId) => isActiveMember(state, groupId, state.currentUserId));
}

/** 返回当前用户在该故事上可用的 groupId；无权访问返回 null */
function resolveStoryGroup(state: DbState, story: Story, preferredGroupId?: string): string | null {
  // 仅自己可见不参与任何圈子，也不接受互动/赠礼
  if (story.visibility === 'self') return null;
  const groups = visibleGroupIds(state, story);
  if (groups.length) {
    if (preferredGroupId && groups.includes(preferredGroupId)) return preferredGroupId;
    return groups[0];
  }
  // 作者始终可以读写自己的故事，即使已经退出圈子
  if (story.authorId === state.currentUserId) {
    if (preferredGroupId && story.visibilityGroupIds.includes(preferredGroupId)) return preferredGroupId;
    return story.visibilityGroupIds[0] ?? null;
  }
  return null;
}

function anonymousName(): string {
  return '匿名雪友';
}

/** 匿名故事的对外作者 ID：按故事生成，避免跨故事关联到真实用户 */
function anonymousAuthorId(story: Story): string {
  return `anon_${story.id}`;
}

/** 匿名故事对客户端暴露的作者标识（真实 ID 只留在服务端） */
function publicAuthorId(story: Story): string {
  return story.isAnonymous ? anonymousAuthorId(story) : story.authorId;
}

function stickerFor(tone: Story['tone'], impactKind: Incident['impactKind']): string {
  if (tone === 'supportive' || impactKind === 'prefer_not_to_say') return '💗';
  if (impactKind === 'near_miss') return '💨';
  if (impactKind === 'stopped_activity' || impactKind === 'minor_discomfort') return '🩹';
  return '✨';
}

function storyCard(state: DbState, story: Story): AtlasStoryCard {
  const author = userById(state, story.authorId);
  const avatar = avatarOf(state, story.authorId);
  const incident = state.incidents.find((i) => i.id === story.incidentId);
  const anonymous = story.isAnonymous;
  const appearance = anonymous ? ANONYMOUS_APPEARANCE : avatar;
  return {
    id: story.id,
    title: story.title,
    authorId: publicAuthorId(story),
    authorName: anonymous ? anonymousName() : (author?.displayName ?? '雪友'),
    isAnonymous: anonymous,
    sport: incident?.sport ?? 'other',
    bodyParts: incident?.bodyParts ?? ['other'],
    impactKind: incident?.impactKind ?? 'prefer_not_to_say',
    tone: story.tone,
    visibility: story.visibility,
    allowFunnyActions: story.allowFunnyActions,
    allowGifts: story.allowGifts,
    publishStatus: story.publishStatus,
    createdAt: story.createdAt,
    palette: appearance?.palette ?? 'blue',
    expression: appearance?.expression ?? 'happy',
    headShape: appearance?.headShape ?? 'round',
    equipped: appearance?.equipped ?? EMPTY_GEAR,
  };
}

function chipOf(state: DbState, story: Story): AtlasUserChip | null {
  const author = userById(state, story.authorId);
  const avatar = avatarOf(state, story.authorId);
  if (!author || !avatar) return null;
  const appearance = story.isAnonymous ? ANONYMOUS_APPEARANCE : avatar;
  return {
    userId: publicAuthorId(story),
    displayName: story.isAnonymous ? anonymousName() : author.displayName,
    palette: appearance.palette,
    expression: appearance.expression,
    equipped: appearance.equipped,
    headShape: appearance.headShape,
    isAnonymous: story.isAnonymous,
  };
}

function reactionSummary(state: DbState, storyId: string): ReactionSummary[] {
  const result: ReactionSummary[] = [];
  for (const action of ACTIONS) {
    if (action.id === 'receive_gift') continue;
    const events = state.interactions.filter((e) => e.storyId === storyId && e.actionId === action.id && e.status === 'ok');
    result.push({
      actionId: action.id,
      count: events.length,
      mine: events.filter((e) => e.actorId === state.currentUserId).length,
    });
  }
  return result;
}

function todayMine(state: DbState, storyId: string): ReactionSummary[] {
  const today = dayKey();
  return ACTIONS.filter((a) => a.id !== 'receive_gift').map((action) => {
    const events = state.interactions.filter(
      (e) =>
        e.storyId === storyId &&
        e.actionId === action.id &&
        e.actorId === state.currentUserId &&
        e.status === 'ok' &&
        dayKey(Date.parse(e.createdAt)) === today,
    );
    return { actionId: action.id, count: events.length, mine: events.length };
  });
}

function inventoryView(state: DbState, item: InventoryItem): InventoryView {
  const def = ITEM_MAP[item.itemDefId];
  const avatar = avatarOf(state, item.ownerId);
  const equipped = !!def?.slot && avatar?.equipped[def.slot] === item.itemDefId;
  return {
    ...item,
    name: def?.name ?? item.itemDefId,
    category: def?.category ?? 'consumable',
    icon: def && def.category === 'cosmetic' ? def.icon : `/assets/items/${item.itemDefId}.png`,
    expiresText: item.expiresAt ? `${relativeTime(item.expiresAt)}后过期` : '永久',
    equipped,
  };
}

function findInventory(state: DbState, ownerId: string, itemDefId: string): InventoryItem | undefined {
  return state.inventory.find((inv) => inv.ownerId === ownerId && inv.itemDefId === itemDefId);
}

function ensureInventory(state: DbState, ownerId: string, itemDefId: string): InventoryItem {
  const existing = findInventory(state, ownerId, itemDefId);
  if (existing) return existing;
  const def = ITEM_MAP[itemDefId];
  const created: InventoryItem = {
    id: `inv_${ownerId}_${itemDefId}`,
    ownerId,
    itemDefId,
    quantity: 0,
    expiresAt: def?.permanent ? null : addDays(Date.now(), def?.ttlDays ?? 14),
    version: 1,
  };
  state.inventory.push(created);
  return created;
}

function pushNotification(state: DbState, event: InteractionEvent): void {
  state.notifications.push({
    id: `ntf_${event.id}`,
    targetId: event.targetId,
    eventId: event.id,
    kind: 'interaction',
    readAt: null,
    createdAt: event.createdAt,
  });
}

/* ------------------------------------------------------------ 身份 / 圈子 */

async function ensureUser(): Promise<ApiResponse<{ user: PublicUser; avatar: AvatarState; preferences: UserPreferences }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const user = me(state);
  const avatar = avatarOf(state, user.id);
  if (!avatar) return fail('NOT_FOUND', '角色数据缺失', requestId);
  return ok({ user: toPublicUser(user, state.currentUserId), avatar, preferences: user.preferences }, requestId);
}

async function listMine(): Promise<ApiResponse<GroupSummary[]>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const groups = state.memberships
    .filter((m) => m.userId === state.currentUserId && m.status === 'active')
    .map((m) => groupSummary(state, m.groupId))
    .filter((g): g is GroupSummary => g !== null);
  return ok(groups, requestId);
}

async function getAtlas(params: {
  groupId: string;
  view?: 'front' | 'back';
  period?: 'week' | 'all';
}): Promise<ApiResponse<AtlasData>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const group = groupSummary(state, params.groupId);
  if (!group) return fail('NOT_MEMBER', '你还不在这个圈子里', requestId);
  const view = params.view ?? 'front';
  const period = params.period ?? 'all';
  const stories = state.stories.filter(
    (story) =>
      story.publishStatus === 'published' &&
      story.moderationStatus === 'approved' &&
      story.visibility !== 'self' &&
      story.visibilityGroupIds.includes(params.groupId) &&
      (period === 'all' || isThisWeek(story.createdAt)),
  );

  const byHotspot = new Map<string, { stories: string[]; users: AtlasUserChip[] }>();
  for (const spot of hotspotsFor(view)) byHotspot.set(spot.id, { stories: [], users: [] });
  const authorCounts = new Map<string, number>();
  const partCounts = new Map<BodyPart, number>();

  for (const story of stories) {
    const incident = state.incidents.find((i) => i.id === story.incidentId);
    if (!incident) continue;
    authorCounts.set(story.authorId, (authorCounts.get(story.authorId) ?? 0) + 1);
    for (const part of new Set(incident.bodyParts)) {
      partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
      const bucket = byHotspot.get(part);
      if (!bucket) continue;
      bucket.stories.push(story.id);
      const chip = chipOf(state, story);
      if (chip && !bucket.users.some((u) => u.userId === chip.userId)) bucket.users.push(chip);
    }
  }

  const hotspots: HotspotSummary[] = hotspotsFor(view).map((spot) => {
    const bucket = byHotspot.get(spot.id) ?? { stories: [], users: [] };
    const latest = stories
      .filter((story) => bucket.stories.includes(story.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const latestIncident = latest ? state.incidents.find((i) => i.id === latest.incidentId) : undefined;
    return {
      id: spot.id,
      label: spot.label,
      count: bucket.stories.length,
      users: bucket.users,
      storyIds: bucket.stories,
      sticker: latest && latestIncident ? stickerFor(latest.tone, latestIncident.impactKind) : '',
    };
  });

  const hottest = [...partCounts.entries()]
    .filter(([id]) => id !== 'other')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([bodyPart, count]) => ({ bodyPart, label: BODY_PART_LABEL[bodyPart], count }));

  return ok(
    {
      group,
      view,
      period,
      hotspots,
      storyCount: stories.length,
      participantCount: authorCounts.size,
      hottest,
      stories: stories
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((story) => storyCard(state, story)),
    },
    requestId,
  );
}

async function getMembers(groupId: string): Promise<ApiResponse<GroupMemberView[]>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  if (!isActiveMember(state, groupId, state.currentUserId)) {
    return fail('NOT_MEMBER', '你还不在这个圈子里', requestId);
  }
  const members = state.memberships
    .filter((m) => m.groupId === groupId && m.status === 'active')
    .map((m) => {
      const user = userById(state, m.userId);
      const avatar = avatarOf(state, m.userId);
      const storyCount = state.stories.filter(
        (s) => s.authorId === m.userId && s.publishStatus === 'published' && s.moderationStatus === 'approved' &&
          s.visibility !== 'self' && s.visibilityGroupIds.includes(groupId),
      ).length;
      if (!user || !avatar) return null;
      return {
        userId: user.id,
        displayName: user.displayName,
        role: m.role,
        palette: avatar.palette,
        expression: avatar.expression,
        equipped: avatar.equipped,
        headShape: avatar.headShape,
        isMe: user.id === state.currentUserId,
        storyCount,
      } satisfies GroupMemberView;
    })
    .filter((m) => m !== null)
    .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.displayName.localeCompare(b.displayName)));
  return ok(members, requestId);
}

async function createInvite(params: {
  groupId: string;
  ttlHours?: number;
}): Promise<ApiResponse<{ sharePath: string; expiresAt: string; token: string }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const role = membershipRole(state, params.groupId, state.currentUserId);
  if (!role) return fail('NOT_MEMBER', '你还不在这个圈子里', requestId);
  if (role !== 'owner' && role !== 'admin') return fail('UNAUTHORIZED', '只有圈主或管理员可以邀请', requestId);
  const token = mintInviteToken();
  const ttl = params.ttlHours ?? 48;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 48) return fail('VALIDATION_FAILED', '邀请有效期应为 1–48 小时', requestId);
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();
  state.invites.push({
    tokenHash: inviteTokenHash(token),
    groupId: params.groupId,
    ownerId: state.currentUserId,
    expiresAt,
    maxUses: 20,
    uses: 0,
    status: 'active',
  });
  saveState(state);
  return ok({ sharePath: `/pages/group/index?inviteToken=${token}`, expiresAt, token }, requestId);
}

async function join(params: { inviteToken: string }): Promise<ApiResponse<{ groupId: string; status: string }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  if (typeof params.inviteToken !== 'string' || !/^inv_[a-zA-Z0-9_-]{1,100}$/.test(params.inviteToken)) {
    return fail('NOT_FOUND', '邀请链接无效或已撤销', requestId);
  }
  const hash = inviteTokenHash(params.inviteToken);
  const invite = state.invites.find((i) => i.tokenHash === hash && i.status === 'active');
  if (!invite) return fail('NOT_FOUND', '邀请链接无效或已撤销', requestId);
  if (Date.parse(invite.expiresAt) < Date.now()) return fail('NOT_FOUND', '邀请链接已过期', requestId);
  if (invite.uses >= invite.maxUses) return fail('NOT_FOUND', '邀请链接已达到使用上限', requestId);
  const existing = state.memberships.find((m) => m.groupId === invite.groupId && m.userId === state.currentUserId);
  if (existing && existing.status === 'active') return ok({ groupId: invite.groupId, status: 'already_member' }, requestId);
  if (existing?.status === 'pending') return ok({ groupId: invite.groupId, status: 'pending' }, requestId);
  const group = state.groups.find((item) => item.id === invite.groupId);
  if (!group) return fail('NOT_FOUND', '圈子不存在', requestId);
  const status = group.joinMode === 'approval' ? 'pending' : 'active';
  if (existing) {
    existing.status = status;
    existing.joinedAt = new Date().toISOString();
  } else {
    state.memberships.push({
      groupId: invite.groupId,
      userId: state.currentUserId,
      role: 'member',
      status,
      joinedAt: new Date().toISOString(),
    });
  }
  invite.uses += 1;
  saveState(state);
  return ok({ groupId: invite.groupId, status: status === 'active' ? 'joined' : 'pending' }, requestId);
}

function canManageGroup(state: DbState, groupId: string): boolean {
  const role = membershipRole(state, groupId, state.currentUserId);
  return role === 'owner' || role === 'admin';
}

async function getJoinRequests(groupId: string): Promise<ApiResponse<PublicUser[]>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  if (!canManageGroup(state, groupId)) return fail('UNAUTHORIZED', '只有圈主或管理员可以查看申请', requestId);
  const users = state.users.filter((user) => state.memberships.some((membership) =>
    membership.groupId === groupId && membership.userId === user.id && membership.status === 'pending'));
  return ok(users.map((user) => toPublicUser(user, state.currentUserId)), requestId);
}

async function reviewMember(params: { groupId: string; userId: string; approve: boolean }): Promise<ApiResponse<{ approved: boolean }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  if (!canManageGroup(state, params.groupId)) return fail('UNAUTHORIZED', '只有圈主或管理员可以处理申请', requestId);
  if (typeof params.approve !== 'boolean') return fail('VALIDATION_FAILED', '处理结果无效', requestId);
  const pending = state.memberships.find((item) =>
    item.groupId === params.groupId && item.userId === params.userId && item.status === 'pending');
  if (!pending) return fail('NOT_FOUND', '申请已处理或不存在', requestId);

  pending.status = params.approve ? 'active' : 'left';
  saveState(state);
  return ok({ approved: params.approve }, requestId);
}

async function leave(params: { groupId: string }): Promise<ApiResponse<{ status: string }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const membership = state.memberships.find(
    (m) => m.groupId === params.groupId && m.userId === state.currentUserId && m.status === 'active',
  );
  if (!membership) return fail('NOT_MEMBER', '你还不在这个圈子里', requestId);
  if (membership.role === 'owner') return fail('VALIDATION_FAILED', '圈主暂时不能直接退出', requestId);
  membership.status = 'left';
  saveState(state);
  return ok({ status: 'left' }, requestId);
}

/* -------------------------------------------------------------- 故事 / 图鉴 */

async function getDetail(params: {
  storyId: string;
  groupId?: string;
}): Promise<ApiResponse<StoryDetail>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const story = state.stories.find((s) => s.id === params.storyId);
  if (!story) return fail('NOT_FOUND', '这条故事不存在或已被删除', requestId);
  const viewerIsAuthor = story.authorId === state.currentUserId;
  if (story.publishStatus !== 'published' && !viewerIsAuthor) {
    return fail('NOT_VISIBLE', '这条故事已被作者撤回', requestId);
  }
  if (story.moderationStatus !== 'approved' && !viewerIsAuthor) {
    return fail('NOT_VISIBLE', '这条故事还在处理中', requestId);
  }
  const isSelfOnly = story.visibility === 'self';
  if (isSelfOnly && !viewerIsAuthor) {
    return fail('NOT_VISIBLE', '这条故事仅作者自己可见', requestId);
  }
  const groupId = isSelfOnly ? null : resolveStoryGroup(state, story, params.groupId);
  if (!isSelfOnly && !groupId) return fail('NOT_VISIBLE', '这条故事不在你加入的圈子里', requestId);
  const incident = state.incidents.find((i) => i.id === story.incidentId);
  const author = userById(state, story.authorId);
  const avatar = avatarOf(state, story.authorId);
  if (!incident || !author || !avatar) return fail('NOT_FOUND', '故事数据不完整', requestId);

  const updates: StoryUpdate[] = state.storyUpdates
    .filter(
      (u) =>
        u.storyId === story.id &&
        !u.withdrawnAt &&
        u.moderationStatus === 'approved' &&
        (viewerIsAuthor || (!!groupId && u.visibilityGroupIds.includes(groupId))),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const maskedAuthorId = publicAuthorId(story);
  const maskedStory: Story = story.isAnonymous ? { ...story, authorId: maskedAuthorId } : story;
  const maskedIncident: Incident = story.isAnonymous ? { ...incident, authorId: maskedAuthorId } : incident;
  const maskedUpdates: StoryUpdate[] = story.isAnonymous
    ? updates.map((update) => ({ ...update, authorId: maskedAuthorId }))
    : updates;
  const maskedAvatar: AvatarState = story.isAnonymous
    ? { ...avatar, ...ANONYMOUS_APPEARANCE, id: `avt_${maskedAuthorId}`, ownerId: maskedAuthorId, version: 1, customized: false, privacy: { allowFunnyActions: false, allowGifts: true } }
    : avatar;

  const group = groupId ? groupSummary(state, groupId) : null;
  const authorPrefs = author.preferences;
  const detail: StoryDetail = {
    story: maskedStory,
    incident: maskedIncident,
    author: {
      id: maskedAuthorId,
      displayName: story.isAnonymous ? anonymousName() : author.displayName,
      palette: maskedAvatar.palette,
      avatarId: story.isAnonymous ? `avt_${maskedAuthorId}` : author.avatarId,
      isMe: viewerIsAuthor,
    },
    avatar: maskedAvatar,
    updates: maskedUpdates,
    reactions: reactionSummary(state, story.id),
    myReactions: todayMine(state, story.id),
    giftable:
      !!groupId && !viewerIsAuthor && story.allowGifts && authorPrefs.allowGifts && story.publishStatus === 'published',
    canSpin: !!groupId && !viewerIsAuthor && story.allowFunnyActions && authorPrefs.allowFunnyActions,
    group,
    canInteract: !!groupId && story.publishStatus === 'published' && !viewerIsAuthor,
    viewerIsAuthor,
  };
  return ok(detail, requestId);
}

async function getDraft(): Promise<ApiResponse<StoryDraft | null>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  return ok(state.storyDrafts?.[state.currentUserId] ?? null, requestId);
}

async function saveDraft(params: { input: CreateStoryInput; version: number }): Promise<ApiResponse<StoryDraft>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const invalid = validateCreateStoryInput(params.input, true);
  if (invalid) return fail('VALIDATION_FAILED', invalid, requestId);

  const drafts = (state.storyDrafts ??= {});
  const currentVersion = drafts[state.currentUserId]?.version ?? 0;
  if (params.version !== currentVersion) return fail('CONFLICT', '草稿已经更新，请重新打开查看', requestId);

  const draft = {
    input: JSON.parse(JSON.stringify(params.input)) as CreateStoryInput,
    version: Math.max(currentVersion, state.draftRevision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  drafts[state.currentUserId] = draft;
  state.draftRevision = draft.version;
  saveState(state, true);
  return ok(draft, requestId);
}

function validateStoryWrite(state: DbState, input: CreateStoryInput, requestId: string) {
  const invalid = validateCreateStoryInput(input);
  if (invalid) return fail('VALIDATION_FAILED', invalid, requestId);
  if (input.story.visibility !== 'self') {
    const groupIds = input.story.visibilityGroupIds ?? [];
    if (!groupIds.length) return fail('VALIDATION_FAILED', '请至少选择一个可见圈子，或选择「仅自己可见」', requestId);
    if (groupIds.some((groupId) => !isActiveMember(state, groupId, state.currentUserId))) {
      return fail('NOT_MEMBER', '只能发布到你已加入的圈子', requestId);
    }
  }
  if (findSensitiveInfo([input.story.title, input.story.body, input.incident.userSummary].filter(Boolean).join(' ')).length) {
    return fail('CONTENT_REJECTED', '内容里疑似包含手机号或证件号，请删除后再发布', requestId);
  }
  return null;
}

function incidentFields(input: CreateStoryInput['incident']) {
  return {
    sport: input.sport,
    scenario: [...input.scenario],
    selfReportedCause: [...input.selfReportedCause],
    bodyParts: [...input.bodyParts],
    impactKind: input.impactKind,
    protectiveItems: [...input.protectiveItems],
    userSummary: input.userSummary?.trim() || undefined,
    happenedOn: input.happenedOn,
  };
}

function storyFields(input: CreateStoryInput['story']) {
  const visibility: Story['visibility'] = input.visibility === 'self' ? 'self' : 'groups';
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    tone: input.tone,
    visibility,
    visibilityGroupIds: visibility === 'self' ? [] : [...new Set(input.visibilityGroupIds ?? [])],
    allowFunnyActions: input.allowFunnyActions,
    allowGifts: input.allowGifts,
    isAnonymous: input.isAnonymous,
  };
}

async function publish(params: { input: CreateStoryInput; requestId: string; draftVersion?: number })
  : Promise<ApiResponse<{ storyId: string; version: number }>> {
  const { input } = params;
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const replay = cached<{ storyId: string; version: number }>(state, 'story.publish', requestId);
  if (replay) return replay;
  const invalid = validateStoryWrite(state, input, requestId);
  if (invalid) return invalid;
  const draft = state.storyDrafts?.[state.currentUserId];
  if (params.draftVersion !== undefined && params.draftVersion !== (draft?.version ?? 0)) {
    return fail('CONFLICT', '草稿已经更新，请重新打开查看', requestId);
  }

  const storyId = nextRequestId().replace('req_', 'sty_');
  const incidentId = nextRequestId().replace('req_', 'inc_');
  const now = new Date().toISOString();
  state.incidents.push({
    ...incidentFields(input.incident),
    id: incidentId,
    schemaVersion: 1,
    authorId: state.currentUserId,
    source: 'manual',
    venueId: null,
    createdAt: now,
    updatedAt: now,
  });
  state.stories.push({
    ...storyFields(input.story),
    id: storyId,
    schemaVersion: 1,
    incidentId,
    authorId: state.currentUserId,
    moderationStatus: 'approved',
    publishStatus: 'published',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
  if (params.draftVersion && state.storyDrafts) delete state.storyDrafts[state.currentUserId];
  const response = ok({ storyId, version: 1 }, requestId);
  remember(state, 'story.publish', requestId, response);
  saveState(state, true);
  return response;
}

async function updateStory(params: { storyId: string; version: number; input: CreateStoryInput; requestId: string })
  : Promise<ApiResponse<{ storyId: string; version: number }>> {
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const story = state.stories.find((item) => item.id === params.storyId);
  if (!story) return fail('NOT_FOUND', '这条故事不存在', requestId);
  if (story.authorId !== state.currentUserId) return fail('UNAUTHORIZED', '只能编辑自己的故事', requestId);
  const replay = cached<{ storyId: string; version: number }>(state, 'story.update', requestId);
  if (replay) return replay;
  if (story.publishStatus !== 'published' || story.moderationStatus === 'hidden') {
    return fail('NOT_VISIBLE', '这条故事当前不可编辑', requestId);
  }
  if (story.version !== params.version) {
    return fail('CONFLICT', '另一个页面已经修改了这条记录，请保留本页文字后重新打开', requestId);
  }
  const invalid = validateStoryWrite(state, params.input, requestId);
  if (invalid) return invalid;
  const incident = state.incidents.find((item) => item.id === story.incidentId);
  if (!incident) return fail('NOT_FOUND', '事故记录不存在', requestId);
  const updatedAt = new Date().toISOString();
  // 本地原型使用和发布相同的同步文字校验。云端审核结果由服务端决定。
  Object.assign(incident, incidentFields(params.input.incident), { updatedAt });
  Object.assign(story, storyFields(params.input.story), { updatedAt, version: story.version + 1 });
  for (const update of state.storyUpdates) {
    if (update.storyId !== story.id) continue;
    update.visibilityGroupIds = update.visibilityGroupIds.filter((id) => story.visibilityGroupIds.includes(id));
  }

  const response = ok({ storyId: story.id, version: story.version }, requestId);
  remember(state, 'story.update', requestId, response);
  saveState(state, true);
  return response;
}

async function appendUpdate(params: { storyId: string; type: UpdateType; body: string; requestId: string })
  : Promise<ApiResponse<StoryUpdate>> {
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const story = state.stories.find((item) => item.id === params.storyId);
  if (!story) return fail('NOT_FOUND', '这条故事不存在', requestId);
  if (story.authorId !== state.currentUserId) return fail('UNAUTHORIZED', '只能给自己的故事追加后续', requestId);
  const replay = cached<StoryUpdate>(state, 'story.appendUpdate', requestId);
  if (replay) return replay;
  if (story.publishStatus !== 'published' || story.moderationStatus !== 'approved') {
    return fail('NOT_VISIBLE', '这条故事当前不能追加后续', requestId);
  }
  const body = typeof params.body === 'string' ? params.body.trim() : '';
  if (!UPDATE_TYPES.includes(params.type) || !body || body.length > 140) {
    return fail('VALIDATION_FAILED', '请选择后续类型并填写 1–140 个字', requestId);
  }
  if (findSensitiveInfo(body).length) return fail('CONTENT_REJECTED', '正文包含疑似个人信息', requestId);
  const now = Date.now();
  const recent = state.storyUpdates.filter((update) =>
    update.storyId === story.id && dayKey(Date.parse(update.createdAt)) === dayKey(now));
  if (recent.length >= 3) return fail('RATE_LIMIT', '同一条故事每天最多追加 3 条后续', requestId);
  const update: StoryUpdate = {
    id: nextRequestId().replace('req_', 'upd_'),
    storyId: story.id,
    authorId: state.currentUserId,
    type: params.type,
    body,
    visibilityGroupIds: story.visibility === 'self' ? [] : [...story.visibilityGroupIds],
    moderationStatus: 'approved',
    createdAt: new Date(now).toISOString(),
  };
  state.storyUpdates.push(update);
  const response = ok(update, requestId);
  remember(state, 'story.appendUpdate', requestId, response);
  saveState(state, true);
  return response;
}

async function withdrawUpdate(params: { storyId: string; updateId: string }): Promise<ApiResponse<{ withdrawnAt: string }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const story = state.stories.find((item) => item.id === params.storyId);
  const update = state.storyUpdates.find((item) => item.id === params.updateId && item.storyId === story?.id);
  if (!story || !update) return fail('NOT_FOUND', '这条后续不存在', requestId);
  if (story.authorId !== state.currentUserId) return fail('UNAUTHORIZED', '只能撤回自己的后续', requestId);

  update.withdrawnAt ??= new Date().toISOString();
  saveState(state, true);
  return ok({ withdrawnAt: update.withdrawnAt }, requestId);
}

async function withdraw(params: { storyId: string }): Promise<ApiResponse<{ status: string }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const story = state.stories.find((s) => s.id === params.storyId);
  if (!story) return fail('NOT_FOUND', '这条故事不存在', requestId);
  if (story.authorId !== state.currentUserId) return fail('UNAUTHORIZED', '只能撤回自己的故事', requestId);
  story.publishStatus = 'withdrawn';
  story.updatedAt = new Date().toISOString();
  story.version += 1;
  saveState(state, true);
  return ok({ status: story.publishStatus }, requestId);
}

async function listMyStories(): Promise<ApiResponse<AtlasStoryCard[]>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const stories = state.stories
    .filter((story) => story.authorId === state.currentUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((story) => storyCard(state, story));
  return ok(stories, requestId);
}

/* ------------------------------------------------------------------ 举报 */

async function reportStory(params: { storyId: string; groupId: string; reason: StoryReport['reason']; requestId: string })
  : Promise<ApiResponse<{ reportId: string }>> {
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadState();
  if (!['privacy', 'abuse', 'other'].includes(params.reason)) {
    return fail('VALIDATION_FAILED', '请选择举报原因', requestId);
  }
  const story = state.stories.find((item) => item.id === params.storyId);
  if (!story || story.visibility === 'self' || story.publishStatus !== 'published' ||
    story.moderationStatus !== 'approved' || !story.visibilityGroupIds.includes(params.groupId) ||
    !isActiveMember(state, params.groupId, state.currentUserId) || story.authorId === state.currentUserId) {
    return fail('NOT_VISIBLE', '只能举报当前圈子内可见的其他成员故事', requestId);
  }
  const reports = (state.reports ??= []);
  const existing = reports.find((report) => report.storyId === story.id && report.groupId === params.groupId &&
    report.reporterId === state.currentUserId && dayKey(Date.parse(report.createdAt)) === dayKey());
  if (existing) return ok({ reportId: existing.id }, requestId);
  const report = {
    id: nextRequestId().replace('req_', 'rpt_'),
    storyId: story.id,
    groupId: params.groupId,
    reporterId: state.currentUserId,
    reason: params.reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  } satisfies StoryReport;
  reports.push(report);
  saveState(state);
  return ok({ reportId: report.id }, requestId);
}

async function listReports(groupId: string): Promise<ApiResponse<Pick<StoryReport, 'id' | 'storyId' | 'reason' | 'createdAt'>[]>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  if (!canManageGroup(state, groupId)) return fail('UNAUTHORIZED', '只有圈主或管理员可以查看举报', requestId);
  const reports = (state.reports ?? []).filter((report) => report.groupId === groupId && report.status === 'pending');
  return ok(reports.slice(0, 30).map(({ id, storyId, reason, createdAt }) => ({ id, storyId, reason, createdAt })), requestId);
}

async function resolveReport(params: { groupId: string; reportId: string; decision: 'dismiss' | 'hide' })
  : Promise<ApiResponse<{ status: StoryReport['status'] }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  if (!canManageGroup(state, params.groupId)) return fail('UNAUTHORIZED', '只有圈主或管理员可以处理举报', requestId);
  if (params.decision !== 'dismiss' && params.decision !== 'hide') return fail('VALIDATION_FAILED', '处理结果无效', requestId);
  const report = state.reports?.find((item) => item.id === params.reportId && item.groupId === params.groupId);
  if (!report || report.status !== 'pending') return fail('NOT_FOUND', '举报已处理或不存在', requestId);
  if (params.decision === 'hide') {
    const story = state.stories.find((item) => item.id === report.storyId);
    if (!story || story.visibility !== 'groups' || !story.visibilityGroupIds.includes(report.groupId) ||
      !story.visibilityGroupIds.every((id) => canManageGroup(state, id))) {
      return fail('UNAUTHORIZED', '处理人需要管理这条故事当前分享的全部圈子', requestId);
    }
    story.moderationStatus = 'hidden';
    story.version += 1;
    story.updatedAt = new Date().toISOString();
  }
  report.status = params.decision === 'hide' ? 'hidden' : 'dismissed';
  saveState(state);
  return ok({ status: report.status }, requestId);
}

/* ------------------------------------------------------------------ Avatar */

async function getMyAvatar(): Promise<ApiResponse<AvatarState>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const avatar = avatarOf(state, state.currentUserId);
  if (!avatar) return fail('NOT_FOUND', '角色数据缺失', requestId);
  return ok(avatar, requestId);
}

function ownedCosmetic(state: DbState, itemDefId: string, slot: string): boolean {
  const def = ITEM_MAP[itemDefId];
  if (!def || def.category !== 'cosmetic' || def.slot !== slot) return false;
  const inv = findInventory(state, state.currentUserId, itemDefId);
  return !!inv && inv.quantity > 0;
}

async function updateAppearance(params: {
  appearance: { palette: Palette; equipped: EquippedGear; expression: Expression; headShape?: HeadShape };
  expectedVersion: number;
}): Promise<ApiResponse<{ avatar: AvatarState }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const avatar = avatarOf(state, state.currentUserId);
  if (!avatar) return fail('NOT_FOUND', '角色数据缺失', requestId);
  if (avatar.version !== params?.expectedVersion) {
    return fail('CONFLICT', '角色已被更新，请确认后再保存', requestId);
  }
  const appearance = params.appearance;
  if (!appearance?.equipped || Array.isArray(appearance.equipped) || typeof appearance.equipped !== 'object') {
    return fail('VALIDATION_FAILED', '穿戴配置不完整', requestId);
  }
  const headShape = appearance.headShape === undefined ? avatar.headShape ?? 'round' : appearance.headShape;
  if (!HEAD_SHAPES.includes(headShape)) return fail('VALIDATION_FAILED', '头型不可用', requestId);
  if (!PALETTES.includes(appearance.palette)) return fail('VALIDATION_FAILED', '配色不可用', requestId);
  if (!EXPRESSIONS.includes(appearance.expression)) return fail('VALIDATION_FAILED', '表情不可用', requestId);
  const equipped = { ...EMPTY_GEAR };
  for (const slot of EQUIP_SLOTS) {
    const value = appearance.equipped[slot];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || !ownedCosmetic(state, value, slot)) {
      return fail('VALIDATION_FAILED', '装备未拥有或与当前槽位不匹配', requestId);
    }
    equipped[slot] = value;
  }
  avatar.palette = appearance.palette;
  avatar.equipped = equipped;
  avatar.expression = appearance.expression;
  avatar.headShape = headShape;
  avatar.customized = true;
  avatar.version += 1;
  me(state).palette = avatar.palette;
  saveState(state, true);
  return ok({ avatar }, requestId);
}

/* -------------------------------------------------------------------- 背包 */

async function getInventory(): Promise<ApiResponse<InventoryView[]>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const order = { cosmetic: 0, consumable: 1, badge: 2 };
  const items = state.inventory
    .filter((inv) => inv.ownerId === state.currentUserId && inv.quantity > 0)
    .map((inv) => inventoryView(state, inv))
    .sort((a, b) => order[a.category] - order[b.category] || a.name.localeCompare(b.name));
  return ok(items, requestId);
}

async function claimCosmetic(params: { itemDefId: string }): Promise<ApiResponse<InventoryView>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadStateForWrite();
  const def = ITEM_MAP[params?.itemDefId];
  if (def?.category !== 'cosmetic' || !def.slot || !def.permanent) {
    return fail('VALIDATION_FAILED', '该物品不可作为外观领取', requestId);
  }
  if (grantCosmetic(state, state.currentUserId, def.id, new Date().toISOString())) saveState(state, true);
  const item = state.inventory.find((entry) => entry.ownerId === state.currentUserId && entry.itemDefId === def.id);
  return item ? ok(inventoryView(state, item), requestId) : fail('NOT_FOUND', '装备记录缺失', requestId);
}

async function claimWeekly(params: { requestId: string }): Promise<
  ApiResponse<{ grantId: string; items: InventoryView[]; alreadyGranted: boolean }>
> {
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadState();
  const cachedResponse =
    cached<{ grantId: string; items: InventoryView[]; alreadyGranted: boolean }>(state, 'inventory.claimWeekly', requestId);
  if (cachedResponse) return cachedResponse;

  const wk = weekKey();
  const existing = state.weeklyGrants.find((g) => g.userId === state.currentUserId && g.weekKey === wk);
  if (existing) {
    const items = existing.items
      .map((id) => findInventory(state, state.currentUserId, id))
      .filter((inv): inv is InventoryItem => !!inv)
      .map((inv) => inventoryView(state, inv));
    return ok({ grantId: existing.grantId, items, alreadyGranted: true }, requestId);
  }

  const pool = WEEKLY_GRANT.pool;
  const seed = hashString(`${state.currentUserId}:${wk}`);
  const picks: string[] = [];
  for (let i = 0; i < WEEKLY_GRANT.count; i += 1) {
    const id = pool[(seed + i) % pool.length];
    if (!picks.includes(id)) picks.push(id);
  }
  const now = Date.now();
  const grantId = `grant_${wk}_${state.currentUserId}`;
  for (const itemDefId of picks) {
    const def = ITEM_MAP[itemDefId];
    const inv = ensureInventory(state, state.currentUserId, itemDefId);
    inv.quantity = Math.min(def.maxStack, inv.quantity + 1);
    inv.expiresAt = def.permanent ? null : addDays(now, def.ttlDays ?? 14);
    inv.version += 1;
    state.ledger.push({
      operationId: `grant_${grantId}_${itemDefId}`,
      fromUserId: null,
      toUserId: state.currentUserId,
      itemDefId,
      delta: 1,
      eventId: grantId,
      createdAt: new Date(now).toISOString(),
    });
  }
  state.weeklyGrants.push({ userId: state.currentUserId, weekKey: wk, grantId, items: picks, createdAt: new Date(now).toISOString() });
  const items = picks
    .map((id) => findInventory(state, state.currentUserId, id))
    .filter((inv): inv is InventoryItem => !!inv)
    .map((inv) => inventoryView(state, inv));
  const response = ok({ grantId, items, alreadyGranted: false }, requestId);
  remember(state, 'inventory.claimWeekly', requestId, response);
  saveState(state);
  return response;
}

async function getWeeklyStatus(): Promise<ApiResponse<WeeklyStatus>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const wk = weekKey();
  const grant = state.weeklyGrants.find((g) => g.userId === state.currentUserId && g.weekKey === wk);
  const items = grant
    ? grant.items
        .map((id) => findInventory(state, state.currentUserId, id))
        .filter((inv): inv is InventoryItem => !!inv)
        .map((inv) => inventoryView(state, inv))
    : [];
  return ok({ weekKey: wk, claimed: !!grant, grantId: grant?.grantId ?? null, items }, requestId);
}

async function gift(params: {
  /** 可选：服务端从 storyId 解析真实作者，客户端不需要（也不应该）拿到匿名作者 ID */
  toUserId?: string;
  storyId: string;
  itemDefId: string;
  requestId: string;
}): Promise<ApiResponse<{ eventId: string; itemDefId: string; toUserId: string }>> {
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadState();
  const cachedResponse = cached<{ eventId: string; itemDefId: string; toUserId: string }>(state, 'inventory.gift', requestId);
  const story = state.stories.find((s) => s.id === params.storyId);
  if (!story) return fail('NOT_FOUND', '这条故事不存在', requestId);
  if (cachedResponse?.ok) {
    return ok({ ...cachedResponse.data, toUserId: publicAuthorId(story) }, requestId);
  }
  const targetId = story.authorId;
  if (params.toUserId && params.toUserId !== targetId) {
    return fail('VALIDATION_FAILED', '只能送给故事作者', requestId);
  }
  if (story.visibility === 'self') return fail('INTERACTION_DISABLED', '仅自己可见的故事不能收礼', requestId);
  if (story.publishStatus !== 'published' || story.moderationStatus !== 'approved') {
    return fail('NOT_VISIBLE', '这条故事当前不可见', requestId);
  }
  if (!resolveStoryGroup(state, story)) {
    return fail('NOT_MEMBER', '你不在这个故事所属的圈子里', requestId);
  }
  if (!story.allowGifts) return fail('INTERACTION_DISABLED', '作者关闭了收礼', requestId);
  const target = userById(state, targetId);
  if (!target) return fail('NOT_FOUND', '收礼的雪友不存在', requestId);
  if (!target.preferences.allowGifts) return fail('INTERACTION_DISABLED', '对方关闭了收礼', requestId);
  if (targetId === state.currentUserId) return fail('VALIDATION_FAILED', '不能给自己送装备', requestId);
  const def = ITEM_MAP[params.itemDefId];
  if (!def || def.category !== 'consumable' || !def.transferable) {
    return fail('VALIDATION_FAILED', '这个道具不能赠送', requestId);
  }
  const mine = findInventory(state, state.currentUserId, params.itemDefId);
  if (!mine || mine.quantity <= 0) return fail('INVENTORY_INSUFFICIENT', '背包里没有这件道具了', requestId);
  if (mine.expiresAt && Date.parse(mine.expiresAt) < Date.now()) {
    return fail('INVENTORY_INSUFFICIENT', '这件道具已经过期', requestId);
  }
  const today = dayKey();
  const giftsToday = state.interactions.filter(
    (e) =>
      e.actorId === state.currentUserId &&
      e.actionId === 'receive_gift' &&
      e.status === 'ok' &&
      dayKey(Date.parse(e.createdAt)) === today,
  ).length;
  if (giftsToday >= MAX_GIFTS_PER_DAY) return fail('RATE_LIMIT', '今天送礼次数已用完，明天再来', requestId);

  // 事务：扣减 → 增加 → 台账（任何一步失败都不保存）
  mine.quantity -= 1;
  mine.version += 1;
  const targetInv = ensureInventory(state, targetId, params.itemDefId);
  targetInv.quantity = Math.min(ITEM_MAP[params.itemDefId].maxStack, targetInv.quantity + 1);
  if (!ITEM_MAP[params.itemDefId].permanent) {
    targetInv.expiresAt = addDays(Date.now(), ITEM_MAP[params.itemDefId].ttlDays ?? 14);
  }
  targetInv.version += 1;
  const event: InteractionEvent = {
    id: `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    storyId: params.storyId,
    actorId: state.currentUserId,
    targetId,
    actionId: 'receive_gift',
    itemDefId: params.itemDefId,
    animationVersion: ANIMATION_VERSION,
    status: 'ok',
    createdAt: new Date().toISOString(),
  };
  state.interactions.push(event);
  pushNotification(state, event);
  state.ledger.push({
    operationId: `gift_${requestId}`,
    fromUserId: state.currentUserId,
    toUserId: targetId,
    itemDefId: params.itemDefId,
    delta: 1,
    eventId: event.id,
    createdAt: event.createdAt,
  });
  const response = ok({ eventId: event.id, itemDefId: params.itemDefId, toUserId: publicAuthorId(story) }, requestId);
  remember(state, 'inventory.gift', requestId, response);
  saveState(state);
  return response;
}

/* ------------------------------------------------------------------ 互动 */

async function react(params: {
  storyId: string;
  actionId: ActionId;
  requestId: string;
}): Promise<ApiResponse<{ eventId: string; actionId: ActionId }>> {
  const requestId = params.requestId || nextRequestId();
  await latency();
  const state = loadState();
  const cachedResponse = cached<{ eventId: string; actionId: ActionId }>(state, 'interaction.react', requestId);
  if (cachedResponse) return cachedResponse;

  const def = ACTION_MAP[params.actionId];
  if (!def || params.actionId === 'receive_gift') return fail('VALIDATION_FAILED', '未知的互动动作', requestId);
  const story = state.stories.find((s) => s.id === params.storyId);
  if (!story) return fail('NOT_FOUND', '这条故事不存在', requestId);
  if (story.publishStatus !== 'published' || story.moderationStatus !== 'approved') {
    return fail('NOT_VISIBLE', '这条故事当前不可见', requestId);
  }
  if (story.visibility === 'self') return fail('NOT_VISIBLE', '这条故事仅作者自己可见', requestId);
  if (story.authorId === state.currentUserId) return fail('VALIDATION_FAILED', '不能给自己的故事做互动', requestId);
  const groupId = resolveStoryGroup(state, story);
  if (!groupId) return fail('NOT_MEMBER', '你不在这个故事所属的圈子里', requestId);
  const author = userById(state, story.authorId);
  if (!author) return fail('NOT_FOUND', '故事作者不存在', requestId);
  if (def.requiresFunnyConsent && (!story.allowFunnyActions || !author.preferences.allowFunnyActions)) {
    return fail('INTERACTION_DISABLED', '作者关闭了这个搞笑动作', requestId);
  }
  const usedToday = todayMine(state, story.id).reduce((sum, item) => sum + item.mine, 0);
  if (usedToday >= MAX_INTERACTIONS_PER_DAY) {
    return fail('RATE_LIMIT', '今天对这条故事的互动次数用完了', requestId);
  }
  const event: InteractionEvent = {
    id: `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    storyId: story.id,
    actorId: state.currentUserId,
    targetId: story.authorId,
    actionId: params.actionId,
    animationVersion: ANIMATION_VERSION,
    status: 'ok',
    createdAt: new Date().toISOString(),
  };
  state.interactions.push(event);
  pushNotification(state, event);
  const response = ok({ eventId: event.id, actionId: params.actionId }, requestId);
  remember(state, 'interaction.react', requestId, response);
  saveState(state);
  return response;
}

async function getInbox(params: { cursor?: string; limit?: number }): Promise<
  ApiResponse<{ events: InboxEvent[]; nextCursor: string | null; unreadCount: number }>
> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const offset = params.cursor ? Number(params.cursor) : 0;
  const all = state.interactions
    .filter((e) => e.targetId === state.currentUserId && e.status === 'ok')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = all.slice(offset, offset + limit).map((event) => {
    const actor = userById(state, event.actorId);
    const story = state.stories.find((s) => s.id === event.storyId);
    const notification = state.notifications.find((n) => n.eventId === event.id && n.targetId === state.currentUserId);
    return {
      ...event,
      actorName: actor?.displayName ?? '雪友',
      storyTitle: story?.title ?? '一条故事',
      read: !!notification?.readAt,
    } satisfies InboxEvent;
  });
  const unreadCount = all.filter((event) => {
    const notification = state.notifications.find((n) => n.eventId === event.id && n.targetId === state.currentUserId);
    return !notification?.readAt;
  }).length;
  return ok(
    {
      events: page,
      nextCursor: offset + limit < all.length ? String(offset + limit) : null,
      unreadCount,
    },
    requestId,
  );
}

async function markRead(params: { eventIds?: string[]; all?: boolean }): Promise<ApiResponse<{ updatedCount: number }>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const now = new Date().toISOString();
  let updated = 0;
  if (params.all) {
    // 全部已读由服务端按「当前用户」判定：客户端只加载了一页，
    // 不能让它替服务端决定「全部」的范围（否则分页外的未读会被漏标）
    for (const notification of state.notifications) {
      if (notification.targetId === state.currentUserId && !notification.readAt) {
        notification.readAt = now;
        updated += 1;
      }
    }
  } else {
    const eventIds = params.eventIds ?? [];
    if (!eventIds.length) return fail('VALIDATION_FAILED', '缺少要标记的事件', requestId);
    for (const notification of state.notifications) {
      if (
        notification.targetId === state.currentUserId &&
        eventIds.includes(notification.eventId) &&
        !notification.readAt
      ) {
        notification.readAt = now;
        updated += 1;
      }
    }
  }
  if (updated) saveState(state);
  return ok({ updatedCount: updated }, requestId);
}

/* ------------------------------------------------------------------ 设置 */

async function getSettings(): Promise<ApiResponse<UserPreferences>> {
  const requestId = nextRequestId();
  await latency();
  return ok(me(loadState()).preferences, requestId);
}

async function updateSettings(params: {
  preferences: Partial<UserPreferences>;
}): Promise<ApiResponse<UserPreferences>> {
  const requestId = nextRequestId();
  await latency();
  const state = loadState();
  const user = me(state);
  const changes = params.preferences;
  if (!changes || typeof changes !== 'object') return fail('VALIDATION_FAILED', '偏好设置不合法', requestId);
  const next = { ...user.preferences };
  for (const key of ['allowFunnyActions', 'allowGifts', 'reduceMotion', 'anonymousByDefault'] as const) {
    const value = changes[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') return fail('VALIDATION_FAILED', '偏好设置不合法', requestId);
    next[key] = value;
  }
  user.preferences = next;
  const avatar = avatarOf(state, user.id);
  if (avatar) {
    avatar.privacy = { allowFunnyActions: next.allowFunnyActions, allowGifts: next.allowGifts };
  }
  saveState(state);
  return ok(next, requestId);
}

/* ------------------------------------------------------------------ 导出 */

export const mockApi = {
  auth: { ensureUser },
  group: { listMine, getAtlas, getMembers, createInvite, join, leave, getJoinRequests, reviewMember },
  story: { getDetail, getDraft, saveDraft, publish, update: updateStory, appendUpdate, withdrawUpdate, withdraw, listMine: listMyStories },
  avatar: { getMine: getMyAvatar, updateAppearance },
  inventory: { getMine: getInventory, claimCosmetic, claimWeekly, getWeekly: getWeeklyStatus, gift },
  interaction: { react, getInbox, markRead },
  moderation: { reportStory, listReports, resolveReport },
  settings: { get: getSettings, update: updateSettings },
};

export type MockApi = typeof mockApi;

/** 供 UI 判断某个动作是否允许（与后端同一份规则） */
export function actionDisabledReason(
  actionId: ActionId,
  story: Story,
  authorPrefs: UserPreferences | undefined,
): string {
  const def = ACTION_MAP[actionId];
  if (!def) return '动作不存在';
  if (def.requiresFunnyConsent && (!story.allowFunnyActions || !authorPrefs?.allowFunnyActions)) {
    return '作者关闭了这个搞笑动作';
  }
  return '';
}

export { ACTIONS, ITEM_DEFINITIONS };

export function rigPreviewLayers(view: 'front' | 'back', avatar: AvatarState) {
  return resolveRigLayers(view, avatar);
}
