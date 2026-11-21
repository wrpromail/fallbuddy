import { withoutExpiredGear } from '../../shared/avatar';
import { loadState, loadStateForWrite, saveState } from '../store';
import { ok, fail, nextRequestId } from './response';

export async function listOutfits() {
  const state = loadState();
  const slots = [1, 2, 3].map((slot) => {
    const saved = state.outfits?.find((row) => row.ownerId === state.currentUserId && row.slot === slot);
    return { slot, appearance: saved?.appearance ?? null, version: saved?.version ?? 0 };
  });
  return ok(slots, nextRequestId());
}

export async function saveOutfit(params: { slot: number; slotVersion: number; avatarVersion: number; clear?: boolean }) {
  const state = loadStateForWrite();
  const id = nextRequestId();
  const ownerId = state.currentUserId;
  const stored = state.avatars.find((row) => row.ownerId === ownerId);
  const avatar = stored && withoutExpiredGear(state, stored);
  if (!avatar || ![1, 2, 3].includes(params.slot)) return fail('VALIDATION_FAILED', '请选择穿搭位置', id);
  const outfits = state.outfits ??= [];
  let row = outfits.find((item) => item.ownerId === ownerId && item.slot === params.slot);
  if ((row?.version ?? 0) !== params.slotVersion || (!params.clear && avatar.version !== params.avatarVersion)) {
    return fail('CONFLICT', '穿搭已更新，请刷新后重试', id);
  }
  if (!row) {
    row = { ownerId, slot: params.slot, appearance: null, version: 0 };
    outfits.push(row);
  }
  const { palette, headShape, expression, equipped, carryHand } = avatar;
  row.appearance = params.clear ? null : { palette, headShape, expression, equipped: { ...equipped }, carryHand };
  row.version++;
  saveState(state, true);
  return ok({ slot: row.slot, version: row.version }, id);
}
