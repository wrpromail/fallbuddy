import type { DbState } from '../shared/db-types';
import { buildMockState } from '../shared/mock-build';

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
    cache = stored;
    loaded = true;
    return stored;
  }
  return resetState();
}

export function saveState(state: DbState): void {
  cache = state;
  loaded = true;
  if (!hasWxStorage()) return;
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify({ ...state, seedVersion: SEED_VERSION }));
  } catch {
    // 存储写入失败时保持内存态可继续使用
  }
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
