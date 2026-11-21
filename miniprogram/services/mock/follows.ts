import { loadState, loadStateForWrite, saveState } from '../store';
import { circleStories } from './access';
import { fail, nextRequestId, ok } from './response';

export async function setFollow(params: { groupId: string; storyId: string; follow: boolean }) {
  const state = loadStateForWrite();
  const id = nextRequestId();
  if (typeof params.follow !== 'boolean') return fail('VALIDATION_FAILED', '请选择关注状态', id);
  const mine = state.currentUserId;
  const rows = state.follows ??= [];
  const match = (row: typeof rows[number]) => row.groupId === params.groupId && row.userId === mine && row.storyId === params.storyId;
  if (params.follow) {
    const story = circleStories(state, params.groupId).find((row) => row.id === params.storyId && row.authorId !== mine);
    if (!story) return fail('NOT_VISIBLE', '当前无法关注这条故事', id);
    if (!rows.some(match)) rows.push({ groupId: params.groupId, storyId: story.id, userId: mine, from: new Date().toISOString() });
  } else state.follows = rows.filter((row) => !match(row));
  saveState(state, true);
  return ok({ following: params.follow }, id);
}

export async function followedUpdates() {
  const state = loadState();
  const updates = (state.follows ?? []).filter((row) => row.userId === state.currentUserId).flatMap((row) => {
    const story = circleStories(state, row.groupId).find((item) => item.id === row.storyId);
    if (!story) return [];
    return state.storyUpdates.filter((update) => update.storyId === story.id && update.createdAt >= row.from &&
      !update.withdrawnAt && update.moderationStatus === 'approved' && update.visibilityGroupIds.includes(row.groupId))
      .map((update) => ({ id: update.id, groupId: row.groupId, storyId: story.id, title: story.title,
        body: update.body, createdAt: update.createdAt }));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ok([...new Map(updates.map((update) => [update.id, update])).values()].slice(0, 50), nextRequestId());
}
