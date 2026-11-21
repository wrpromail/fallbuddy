import { AWARDS, type Award, type Nomination } from '../../shared/community';
import { weekKey } from '../../shared/time';
import { loadState, loadStateForWrite, platformPollsPaused, saveState } from '../store';
import { circleStories, isActiveMember } from './access';
import { fail, nextRequestId, ok } from './response';

type Ballot = Pick<Nomination, 'groupId' | 'period' | 'award'>;
type Entry = Ballot & { storyId: string };
const sameBallot = (row: Ballot, key: Ballot) =>
  row.groupId === key.groupId && row.period === key.period && row.award === key.award;
const sameEntry = (row: Entry, key: Entry) => sameBallot(row, key) && row.storyId === key.storyId;

export async function listPoll(params: { groupId: string; award: Award; period?: string }) {
  const state = loadState();
  const id = nextRequestId();
  const { groupId, award } = params;
  if (!isActiveMember(state, groupId, state.currentUserId)) return fail('NOT_MEMBER', '仅圈子成员可见', id);
  if (!Object.prototype.hasOwnProperty.call(AWARDS, award)) return fail('VALIDATION_FAILED', '请选择奖项', id);
  const current = weekKey();
  const periods = [...new Set([current, ...(state.nominations ?? []).filter((row) => row.groupId === groupId).map((row) => row.period)])].sort().reverse();
  const period = params.period ?? current;
  if (!periods.includes(period)) return fail('NOT_FOUND', '找不到这期评选', id);
  const key = { groupId, award, period };
  const closed = period !== current || !!state.closedPolls?.some((row) => sameBallot(row, key));
  const stories = circleStories(state, groupId);
  const owner = state.groups.some((row) => row.id === groupId && row.ownerId === state.currentUserId);
  const entries = (state.nominations ?? []).filter((row) => sameBallot(row, key));
  const votes = (state.votes ?? []).filter((row) => sameBallot(row, key));
  const candidates = entries.flatMap((row) => {
    const story = stories.find((item) => item.id === row.storyId);
    if (!story || row.status === 'withdrawn' || !isActiveMember(state, groupId, story.authorId)) return [];
    const mine = story.authorId === state.currentUserId;
    if (row.status === 'pending' && (!mine && !owner || closed)) return [];
    return [{ id: story.id, title: story.title, mine, pending: row.status === 'pending',
      votes: votes.filter((vote) => vote.storyId === story.id).length, rank: 0 }];
  }).sort((a, b) => Number(a.pending) - Number(b.pending) || b.votes - a.votes || a.id.localeCompare(b.id));
  for (const candidate of candidates) {
    if (!candidate.pending && candidate.votes) candidate.rank = 1 + candidates.filter((c) => !c.pending && c.votes > candidate.votes).length;
  }
  const paused = platformPollsPaused();
  const choices = owner && !closed && !paused ? stories.filter((story) => isActiveMember(state, groupId, story.authorId) &&
    !entries.some((row) => row.storyId === story.id)).map(({ id, title }) => ({ id, title })) : [];
  return ok({ period, periods, closed, paused, owner, candidates, choices,
    voted: votes.some((row) => row.userId === state.currentUserId) }, id);
}

export async function changePoll(params: Entry & { action: 'nominate' | 'accept' | 'withdraw' | 'vote' }) {
  const state = loadStateForWrite();
  const id = nextRequestId();
  const mine = state.currentUserId;
  const { groupId, storyId, action, award, period } = params;
  if (!isActiveMember(state, groupId, mine)) return fail('NOT_MEMBER', '仅圈子成员可操作', id);
  if (!Object.prototype.hasOwnProperty.call(AWARDS, award) || (period !== weekKey() || state.closedPolls?.some((row) => sameBallot(row, params))) && action !== 'withdraw') {
    return fail('VALIDATION_FAILED', '请刷新本周评选', id);
  }
  if (action !== 'withdraw' && platformPollsPaused()) return fail('INTERACTION_DISABLED', '评选已暂停', id);
  const story = circleStories(state, groupId).find((row) => row.id === storyId);
  if (!story || !isActiveMember(state, groupId, story.authorId)) return fail('NOT_VISIBLE', '故事当前不可参选', id);
  const rows = state.nominations ??= [];
  const entry = rows.find((row) => sameEntry(row, params));
  if (action === 'nominate') {
    if (!state.groups.some((row) => row.id === groupId && row.ownerId === mine)) return fail('UNAUTHORIZED', '仅圈主可以提名', id);
    if (entry?.status === 'withdrawn') return fail('CONFLICT', '作者已退出本期评选', id);
    if (!entry) rows.push({ groupId, award, period, storyId, status: 'pending' });
  } else if (!entry) return fail('NOT_VISIBLE', '候选故事不存在', id);
  else if (action === 'accept' || action === 'withdraw') {
    if (story.authorId !== mine) return fail('UNAUTHORIZED', '须由故事作者确认', id);
    if (entry.status === 'withdrawn' && action === 'accept') return fail('CONFLICT', '已退出本期评选', id);
    entry.status = action === 'accept' ? 'accepted' : 'withdrawn';
  } else if (action === 'vote') {
    if (entry.status !== 'accepted') return fail('NOT_VISIBLE', '故事尚未参选', id);
    const votes = state.votes ??= [];
    const previous = votes.find((row) => sameBallot(row, params) && row.userId === mine);
    if (previous && previous.storyId !== storyId) return fail('CONFLICT', '本期这个奖项已经投过票', id);
    if (!previous) votes.push({ groupId, award, period, storyId, userId: mine });
    const badges = state.pollBadges ??= [];
    if (!badges.includes(mine)) badges.push(mine);
  } else return fail('VALIDATION_FAILED', '未知操作', id);
  saveState(state, true);
  return ok({ saved: true }, id);
}

export async function myPollBadge() {
  const state = loadState();
  return ok({ earned: !!state.pollBadges?.includes(state.currentUserId) }, nextRequestId());
}

export async function closePoll(params: Ballot) {
  const state = loadStateForWrite();
  const id = nextRequestId();
  if (!isActiveMember(state, params.groupId, state.currentUserId) ||
      !state.groups.some((row) => row.id === params.groupId && row.ownerId === state.currentUserId)) {
    return fail('UNAUTHORIZED', '仅圈主可以结束评选', id);
  }
  if (params.period !== weekKey() || !Object.prototype.hasOwnProperty.call(AWARDS, params.award)) {
    return fail('VALIDATION_FAILED', '请选择本期奖项', id);
  }
  const rows = state.closedPolls ??= [];
  if (!rows.some((row) => sameBallot(row, params))) rows.push({ groupId: params.groupId, period: params.period, award: params.award });
  saveState(state, true);
  return ok({ closed: true }, id);
}
