// ADR-004, ADR-002 Phase0補修: Centralized key generation (Phase1 will inject profileId).
import { LEGACY_KEYS, STORE_NAMES, DEFAULT_PROFILE_ID, makeKey } from './storageKeys.js';
const LEGACY_STORAGE_KEY = LEGACY_KEYS.todayRankDistance;

const normalizeTop = (top) => {
  if (!Array.isArray(top)) {
    return [];
  }
  return top.filter((value) => Number.isFinite(value) && value > 0);
};

const readFromStorage = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      dateKey: typeof parsed.dateKey === 'string' ? parsed.dateKey : null,
      top: normalizeTop(parsed.top),
    };
  } catch (error) {
    return null;
  }
};

const writeToStorage = (storageKey, data) => {
  localStorage.setItem(storageKey, JSON.stringify(data));
};

const todayRankStore = {
  get(dateKey, profileId = DEFAULT_PROFILE_ID) {
    const storageKey = makeKey(STORE_NAMES.todayRankDistance, profileId);
    let stored = readFromStorage(storageKey);
    if (!stored) {
      const legacy = readFromStorage(LEGACY_STORAGE_KEY);
      if (legacy) {
        // ADR-004: Best-effort, non-destructive migration (copy only).
        writeToStorage(storageKey, legacy);
        stored = legacy;
      }
    }
    if (!stored || stored.dateKey !== dateKey) {
      return { dateKey, top: [] };
    }
    return { dateKey, top: stored.top };
  },
  update(dateKey, distanceM, profileId = DEFAULT_PROFILE_ID) {
    const storageKey = makeKey(STORE_NAMES.todayRankDistance, profileId);
    const current = this.get(dateKey, profileId);
    const nextTop = [...current.top, distanceM]
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a)
      .slice(0, 3);
    const next = { dateKey, top: nextTop };
    writeToStorage(storageKey, next);
    return next;
  },
};

export default todayRankStore;
