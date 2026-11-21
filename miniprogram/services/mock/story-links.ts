import type { DbState } from '../../shared/db-types';
import type { StoryLink } from '../../shared/community';
import { loadState, loadStateForWrite, platformInteractionsPaused, saveState } from '../store';
import { circleStories, isActiveMember, isBlockedBetween } from './access';
import { fail, nextRequestId, ok } from './response';

function visiblePair(state: DbState, link: StoryLink) {
  const stories = circleStories(state, link.groupId);
  const source = stories.find((story) => story.id === link.source);
  const target = stories.find((story) => story.id === link.target);
  if (!source || !target || isBlockedBetween(state, source.authorId, target.authorId) ||
      ![source, target].every((story) => isActiveMember(state, link.groupId, story.authorId))) return null;
  return { source, target };
}

function paused(state: DbState, groupId: string) {
  return platformInteractionsPaused() || state.groups.some((group) => group.id === groupId && group.interactionsPaused);
}

export async function listLinks(params: { groupId: string; storyId: string }) {
  const state = loadState();
  const id = nextRequestId();
  const stories = circleStories(state, params.groupId);
  const story = stories.find((row) => row.id === params.storyId);
  if (!story) return fail('NOT_VISIBLE', '故事当前不可见', id);
  const links = (state.storyLinks ?? []).flatMap((link) => {
    if (link.groupId !== params.groupId || link.status === 'revoked' ||
        (link.source !== story.id && link.target !== story.id)) return [];
    const pair = visiblePair(state, link);
    if (!pair) return [];
    const canReview = pair.target.authorId === state.currentUserId;
    const canRevoke = canReview || pair.source.authorId === state.currentUserId;
    if (!canRevoke && link.status !== 'accepted') return [];
    const other = link.source === story.id ? pair.target : pair.source;
    return [{ id: link.id, otherId: other.id, title: other.title, status: link.status, canReview, canRevoke }];
  });
  const choices = story.authorId === state.currentUserId || !isActiveMember(state, params.groupId, story.authorId) ||
    paused(state, params.groupId) ? [] : stories.filter((row) =>
      row.authorId === state.currentUserId && !links.some((link) => link.otherId === row.id))
      .map(({ id, title }) => ({ id, title }));
  return ok({ links, choices }, id);
}

export async function requestLink(params: { groupId: string; storyId: string; myStoryId: string; requestId: string }) {
  const state = loadStateForWrite();
  const id = params.requestId;
  if (typeof id !== 'string' || !id || id.length > 140) return fail('VALIDATION_FAILED', '请重新发起关联', nextRequestId());
  const proposal: StoryLink = { id: nextRequestId(), groupId: params.groupId, source: params.myStoryId,
    target: params.storyId, status: 'pending' };
  const pair = visiblePair(state, proposal);
  if (!pair || pair.source.authorId !== state.currentUserId || pair.target.authorId === state.currentUserId) {
    return fail('NOT_VISIBLE', '请选择同圈内自己和圈友各一条可见故事', id);
  }
  if (paused(state, proposal.groupId)) return fail('INTERACTION_DISABLED', '圈内互动已暂停', id);
  const rows = state.storyLinks ??= [];
  const existing = rows.find((row) =>
    [row.source, row.target].includes(proposal.source) && [row.source, row.target].includes(proposal.target));
  if (existing) {
    if (existing.groupId !== proposal.groupId) return fail('CONFLICT', '这对故事暂不可关联', id);
    if (existing.status === 'revoked') return fail('CONFLICT', '这两条故事的关联已取消', id);
    return ok({ id: existing.id }, id);
  }
  rows.push(proposal);
  saveState(state, true);
  return ok({ id: proposal.id }, id);
}

export async function decideLink(params: { id: string; decision: 'accept' | 'revoke' }) {
  const state = loadStateForWrite();
  const id = nextRequestId();
  const row = state.storyLinks?.find((item) => item.id === params.id);
  if (!row) return fail('NOT_VISIBLE', '关联当前不可见', id);
  const pair = visiblePair(state, row);
  const mine = state.currentUserId;
  if (!pair || ![pair.source.authorId, pair.target.authorId].includes(mine)) return fail('NOT_VISIBLE', '关联当前不可见', id);
  if (params.decision === 'accept') {
    if (pair.target.authorId !== mine || row.status === 'revoked') return fail('UNAUTHORIZED', '无法确认此关联', id);
    if (paused(state, row.groupId)) return fail('INTERACTION_DISABLED', '圈内互动已暂停', id);
    row.status = 'accepted';
  } else if (params.decision === 'revoke') row.status = 'revoked';
  else return fail('VALIDATION_FAILED', '未知操作', id);
  saveState(state, true);
  return ok({ status: row.status }, id);
}

export async function linkRequests() {
  const state = loadState();
  return ok((state.storyLinks ?? []).flatMap((row) => {
    if (row.status !== 'pending') return [];
    const pair = visiblePair(state, row);
    return pair?.target.authorId === state.currentUserId
      ? [{ id: row.id, groupId: row.groupId, storyId: row.target, title: pair.source.title, targetTitle: pair.target.title }] : [];
  }), nextRequestId());
}
