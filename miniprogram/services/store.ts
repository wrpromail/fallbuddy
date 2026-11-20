import type { DbState } from '../shared/db-types';
import { hashString } from '../shared/time';
import { buildMockState } from '../shared/mock-build';
import { ensureAvatar } from '../shared/avatar';

const STORAGE_KEY = 'shaiyouji.v0.state';
const SEED_VERSION = 3;

type StoredState = DbState & { seedVersion?: number };

let cache: DbState | null = null;
let loaded = false;

function hasWxStorage(): boolean {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function';
}

function isValid(state: unknown): state is StoredState {
  const s = state as StoredState | null;
  return !!s && s.schemaVersion === 1 && s.seedVersion === SEED_VERSION && Array.isArray(s.stories) && Array.isArray(s.users);
}

function readRaw(): StoredState | null {
  if (!hasWxStorage()) return null;
  try {
    const raw = wx.getStorageSync(STORAGE_KEY) as string | StoredState | undefined;
    if (!raw) return null;
    return typeof raw === 'string' ? (JSON.parse(raw) as StoredState) : raw;
  } catch {
    return null;
  }
}

export function loadState(): DbState {
  if (loaded && cache) return cache;
  const stored = readRaw();
  if (isValid(stored)) {
    const now = new Date().toISOString();
    let changed = false;
    for (const user of stored.users) {
      if (ensureAvatar(stored, user, now)) changed = true;
    }
    if (changed) saveState(stored);
    else {
      cache = stored;
      loaded = true;
    }
    return stored;
  }
  return resetState();
}

/** 写入失败时不会改变当前缓存中的事故记录。 */
export function loadStateForWrite(): DbState {
  return JSON.parse(JSON.stringify(loadState())) as DbState;
}

export function saveState(state: DbState, durable = false): void {
  if (hasWxStorage()) {
    try {
      wx.setStorageSync(STORAGE_KEY, JSON.stringify({ ...state, seedVersion: SEED_VERSION }));
    } catch (error) {
      if (durable) throw error;
    }
  }
  cache = state;
  loaded = true;
}

export function resetState(now: number = Date.now()): DbState {
  const state = buildMockState(now);
  saveState(state);
  return state;
}

export function hasPersistedState(): boolean {
  return !!readRaw();
}

export { SEED_VERSION };

export function mintInviteToken(): string {
  return `inv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function inviteTokenHash(token: string): string {
  return hashString(token).toString(36);
}
