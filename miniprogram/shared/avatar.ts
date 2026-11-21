import { CARRY_HANDS, type CarryHand } from './enums';
import { ITEM_MAP, SNOWBOARD_ID, STARTER_COSMETICS } from './items';
import type { DbState, UserRecord } from './db-types';
import type { AvatarState, EquippedGear } from './types';

export const EMPTY_GEAR: EquippedGear = {
  headgear: null, goggles: null, outfit: null, hip_protector: null, boots: null,
  gloves: null, knee_pads: null, handheld: null,
};

export const ANONYMOUS_APPEARANCE = {
  headShape: 'round', palette: 'blue', expression: 'happy', equipped: EMPTY_GEAR,
} as const;

const STARTER_OUTFIT = { ...EMPTY_GEAR, outfit: 'ski_blue', hip_protector: 'basic_hip_protector' };

export function grantCosmetic(state: DbState, userId: string, itemId: string, now: string): boolean {
  const existing = state.inventory.find((item) => item.ownerId === userId && item.itemDefId === itemId);
  if (existing && existing.quantity > 0) return false;
  if (existing) {
    existing.quantity = 1;
    existing.expiresAt = null;
    existing.version += 1;
  } else {
    state.inventory.push({
      id: `inv_${userId}_${itemId}`, ownerId: userId, itemDefId: itemId, quantity: 1, expiresAt: null, version: 1,
    });
  }
  state.ledger.push({
    operationId: `cosmetic_${userId}_${itemId}`, fromUserId: null, toUserId: userId,
    itemDefId: itemId, delta: 1, eventId: 'cosmetic_grant', createdAt: now,
  });
  return true;
}

export function migrateAvatarCarry(avatar: AvatarState): boolean {
  const legacy = avatar.equipped as EquippedGear & { carryHand?: CarryHand };
  if (!Object.prototype.hasOwnProperty.call(legacy, 'carryHand')) return false;
  if (avatar.equipped.handheld === SNOWBOARD_ID && avatar.carryHand === undefined &&
      legacy.carryHand && CARRY_HANDS.includes(legacy.carryHand)) {
    avatar.carryHand = legacy.carryHand;
  }
  delete legacy.carryHand;
  return true;
}

export function ensureAvatar(state: DbState, user: UserRecord, now: string): boolean {
  const avatar = state.avatars.find((item) => item.ownerId === user.id);
  let changed = false;
  if (!avatar) {
    const initial: AvatarState = {
      id: user.avatarId, ownerId: user.id, rigVersion: 'skeleton-rig-v1',
      palette: user.palette, headShape: 'round', expression: 'happy',
      equipped: { ...STARTER_OUTFIT }, customized: false,
      privacy: { allowFunnyActions: user.preferences.allowFunnyActions, allowGifts: user.preferences.allowGifts },
      version: 1,
    };
    state.avatars.push(initial);
    changed = true;
  } else {
    if (migrateAvatarCarry(avatar)) changed = true;
    const legacy = avatar.equipped as EquippedGear & { hipProtector?: string | null };
    if ('hipProtector' in legacy || !('hip_protector' in legacy)) {
      const { hipProtector, ...equipped } = legacy;
      avatar.equipped = { ...EMPTY_GEAR, ...equipped, hip_protector: equipped.hip_protector !== undefined ? equipped.hip_protector : hipProtector ?? null };
      changed = true;
    }
    if (avatar.customized === undefined) {
      const pristine = avatar.version === 1 && !Object.values(avatar.equipped).some(Boolean);
      avatar.customized = !pristine;
      if (pristine) avatar.equipped = { ...STARTER_OUTFIT };
      changed = true;
    }
    if (avatar.headShape === undefined) {
      avatar.headShape = 'round';
      changed = true;
    }
  }
  for (const itemId of STARTER_COSMETICS) {
    if (ITEM_MAP[itemId]?.category === 'cosmetic' && grantCosmetic(state, user.id, itemId, now)) changed = true;
  }
  return changed;
}

export function withoutExpiredGear(state: DbState, avatar: AvatarState): AvatarState {
  if (avatar.equipped.hip_protector !== 'steel_hip_guard') return avatar;
  const guard = state.inventory.find((row) => row.ownerId === avatar.ownerId && row.itemDefId === 'steel_hip_guard');
  if (guard && guard.quantity > 0 && (!guard.expiresAt || Date.parse(guard.expiresAt) > Date.now())) return avatar;
  return { ...avatar, equipped: { ...avatar.equipped, hip_protector: null } };
}

export function removeUnavailableGear(state: DbState, userId: string) {
  const avatar = state.avatars.find((row) => row.ownerId === userId);
  if (!avatar) return;
  const visible = withoutExpiredGear(state, avatar);
  if (visible !== avatar) {
    avatar.equipped = visible.equipped;
    avatar.version++;
  }
}
