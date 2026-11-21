import { publishRequestFingerprint } from '../store';
import type { DbState, OperationRecord } from '../../shared/db-types';

export function removeCommunityAudience(state: DbState, storyId: string, groupId: string) {
  for (const row of state.storyLinks ?? []) {
    if (row.groupId === groupId && [row.source, row.target].includes(storyId)) row.status = 'revoked';
  }
  for (const row of state.nominations ?? []) {
    if (row.groupId === groupId && row.storyId === storyId) row.status = 'withdrawn';
  }
  state.follows = state.follows?.filter((row) => row.groupId !== groupId || row.storyId !== storyId);
}

export function removeStoryAudience(state: DbState, groupId: string, authorId?: string): void {
  const now = new Date().toISOString();
  const affected = new Set<string>();
  for (const story of state.stories) {
    if ((authorId && story.authorId !== authorId) || !story.visibilityGroupIds.includes(groupId)) continue;
    story.visibilityGroupIds = story.visibilityGroupIds.filter((id) => id !== groupId);
    if (!story.visibilityGroupIds.length) story.visibility = 'self';
    story.version += 1;
    story.updatedAt = now;
    affected.add(story.id);
    removeCommunityAudience(state, story.id, groupId);
  }
  for (const update of state.storyUpdates) {
    if (affected.has(update.storyId)) update.visibilityGroupIds = update.visibilityGroupIds.filter((id) => id !== groupId);
  }
  state.reports = state.reports?.filter((report) => report.groupId !== groupId || !affected.has(report.storyId));
}

export function publishKey(userId: string, requestId: string): string {
  return `${userId}|${publishRequestFingerprint(requestId)}`;
}

export function recordedPublishStoryId(operation: OperationRecord): string | undefined {
  if (operation.action !== 'story.publish') return undefined;
  const storyId: unknown = JSON.parse(operation.response)?.data?.storyId;
  return typeof storyId === 'string' ? storyId : undefined;
}

function purgeOperations(state: DbState, ids: Set<string>, storyIds: Set<string>, userId?: string): void {
  for (const [key, operation] of Object.entries(state.operations)) {
    if (operation.userId === userId) {
      delete state.operations[key];
      continue;
    }
    // 旧版只在操作缓存里保存发布请求，删除旧记录时也把它转成删除标记。
    const storyId = recordedPublishStoryId(operation);
    if (storyId && storyIds.has(storyId)) {
      (state.storyPublishes ??= {})[publishKey(operation.userId, operation.requestId)] = null;
    }
    let matches = false;
    JSON.parse(operation.response, (_key, value) => {
      if (typeof value === 'string' && ids.has(value)) matches = true;
      return value;
    });
    if (matches) delete state.operations[key];
  }
}

export function purgeStories(state: DbState, storyIds: Set<string>, closedUserId?: string): void {
  const incidents = new Set(state.stories.filter((story) => storyIds.has(story.id)).map((story) => story.incidentId));
  const references = new Set(storyIds);
  state.follows = state.follows?.filter((row) => !storyIds.has(row.storyId) && row.userId !== closedUserId);
  state.storyLinks = state.storyLinks?.filter((link) => !storyIds.has(link.source) && !storyIds.has(link.target));
  state.nominations = state.nominations?.filter((entry) => !storyIds.has(entry.storyId));
  // 保留已投票资格的占用，删除对这条故事的指向。
  for (const vote of state.votes ?? []) if (storyIds.has(vote.storyId)) vote.storyId = '';

  state.stories = state.stories.filter((story) => !storyIds.has(story.id));
  state.incidents = state.incidents.filter((incident) => !incidents.has(incident.id));
  state.storyUpdates = state.storyUpdates.filter((update) => {
    if (!storyIds.has(update.storyId)) return true;
    references.add(update.id);
    return false;
  });
  state.reports = state.reports?.filter((report) => {
    if (!storyIds.has(report.storyId) && report.reporterId !== closedUserId) return true;
    references.add(report.id);
    return false;
  });

  const events = new Set<string>();
  state.interactions = state.interactions.filter((event) => {
    if (!storyIds.has(event.storyId) && event.actorId !== closedUserId && event.targetId !== closedUserId) return true;
    events.add(event.id);
    references.add(event.id);
    return false;
  });
  state.notifications = state.notifications.filter((notice) => notice.targetId !== closedUserId && !events.has(notice.eventId));
  const ignoredInbox = state.ignoredInbox ?? {};
  for (const [userId, keys] of Object.entries(ignoredInbox)) {
    ignoredInbox[userId] = keys.filter((key) => !storyIds.has(key.split('|')[0]));
  }
  if (closedUserId) references.add(closedUserId);
  purgeOperations(state, references, storyIds, closedUserId);
  const publishes = state.storyPublishes;
  if (publishes) {
    for (const [key, storyId] of Object.entries(publishes)) {
      if (closedUserId && key.startsWith(`${closedUserId}|`)) delete publishes[key];
      else if (storyId !== null && storyIds.has(storyId)) publishes[key] = null;
    }
  }
}

export function purgeAccount(state: DbState, user: { id: string }, fingerprint: string): void {
  const { id } = user;
  for (const group of state.groups.filter((item) => item.ownerId === id)) {
    removeStoryAudience(state, group.id);
    state.storyLinks = state.storyLinks?.filter((row) => row.groupId !== group.id);
    state.nominations = state.nominations?.filter((row) => row.groupId !== group.id);
    state.closedPolls = state.closedPolls?.filter((row) => row.groupId !== group.id);
    state.votes = state.votes?.filter((row) => row.groupId !== group.id);
    state.memberships = state.memberships.filter((membership) => membership.groupId !== group.id);
    state.invites = state.invites.filter((invite) => invite.groupId !== group.id);
    state.interactionControls = state.interactionControls?.filter((entry) => entry.groupId !== group.id);
  }
  purgeStories(state, new Set(state.stories.filter((story) => story.authorId === id).map((story) => story.id)), id);
  state.groups = state.groups.filter((group) => group.ownerId !== id);
  state.memberships = state.memberships.filter((membership) => membership.userId !== id);
  state.invites = state.invites.filter((invite) => invite.ownerId !== id);
  state.voiceJobs = state.voiceJobs?.filter((row) => row.userId !== id);
  state.outfits = state.outfits?.filter((row) => row.ownerId !== id);
  state.pollBadges = state.pollBadges?.filter((userId) => userId !== id);
  state.votes = state.votes?.filter((row) => row.userId !== id);
  state.avatars = state.avatars.filter((avatar) => avatar.ownerId !== id);
  state.inventory = state.inventory.filter((item) => item.ownerId !== id);
  state.weeklyGrants = state.weeklyGrants.filter((grant) => grant.userId !== id);
  state.ledger = state.ledger
    .filter((entry) => entry.fromUserId === id ? !!entry.toUserId && entry.toUserId !== id : entry.toUserId !== id || !!entry.fromUserId)
    .map((entry) => ({
      ...entry,
      operationId: entry.fromUserId === id || entry.toUserId === id ? `redacted_${entry.eventId}` : entry.operationId,
      fromUserId: entry.fromUserId === id ? null : entry.fromUserId,
      toUserId: entry.toUserId === id ? null : entry.toUserId,
    }));
  state.interactionControls = state.interactionControls?.map((entry) =>
    entry.changedBy === id ? { ...entry, changedBy: '' } : entry);
  if (state.storyDrafts) delete state.storyDrafts[id];
  if (state.ignoredInbox) delete state.ignoredInbox[id];
  if (state.blocks) {
    delete state.blocks[id];
    for (const [ownerId, blocked] of Object.entries(state.blocks)) {
      state.blocks[ownerId] = blocked.filter((targetId) => targetId !== id);
    }
  }
  state.users = state.users.filter((item) => item.id !== id);
  (state.deletedAccounts ??= {})[fingerprint] = true;
}
