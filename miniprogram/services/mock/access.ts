import type { DbState } from '../../shared/db-types';

export function isActiveMember(state: DbState, groupId: string, userId: string): boolean {
  return state.memberships.some((m) => m.groupId === groupId && m.userId === userId && m.status === 'active');
}


export function isBlockedBetween(state: DbState, userId: string, otherUserId: string): boolean {
  return !!state.blocks?.[userId]?.includes(otherUserId) || !!state.blocks?.[otherUserId]?.includes(userId);
}

export function circleStories(state: DbState, groupId: string) {
  if (!isActiveMember(state, groupId, state.currentUserId)) return [];
  return state.stories.filter((story) => story.visibility === 'groups' &&
    story.publishStatus === 'published' && story.moderationStatus === 'approved' &&
    story.visibilityGroupIds.includes(groupId) && !isBlockedBetween(state, state.currentUserId, story.authorId));
}
