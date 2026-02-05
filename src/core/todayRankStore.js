// ADR-004, ADR-002 Phase0補修: Centralized key generation (Phase1 will inject profileId).
import {
  LEGACY_KEYS,
  LEGACY_MIGRATION_KEYS,
  STORE_NAMES,
  DEFAULT_PROFILE_ID,
  makeKey,
  resolveProfileId,
} from './storageKeys.js';
const LEGACY_STORAGE_KEYS = LEGACY_KEYS.todayRankDistance;
const LEGACY_MIGRATION_KEY = LEGACY_MIGRATION_KEYS.todayRankDistance;

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

const readLegacy = (storageKeys) => {
  for (const storageKey of storageKeys) {
    const legacy = readFromStorage(storageKey);
    if (legacy) {
      return legacy;
    }
  }
  return null;
};

const todayRankStore = {
  get(dateKey, profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeKey(STORE_NAMES.todayRankDistance, resolvedProfileId);
    let stored = readFromStorage(storageKey);
    if (!stored) {
      if (resolvedProfileId === DEFAULT_PROFILE_ID && !localStorage.getItem(LEGACY_MIGRATION_KEY)) {
        const legacy = readLegacy(LEGACY_STORAGE_KEYS);
        if (legacy) {
          // ADR-004: Best-effort, non-destructive migration (copy only).
          writeToStorage(storageKey, legacy);
          localStorage.setItem(LEGACY_MIGRATION_KEY, '1');
          stored = legacy;
        }
      }
    }
    if (!stored || stored.dateKey !== dateKey) {
      return { dateKey, top: [] };
    }
    return { dateKey, top: stored.top };
  },
  update(dateKey, distanceM, profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeKey(STORE_NAMES.todayRankDistance, resolvedProfileId);
    const current = this.get(dateKey, resolvedProfileId);
    const nextTop = [...current.top, distanceM]
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a)
      .slice(0, 3);
    const next = { dateKey, top: nextTop };
    writeToStorage(storageKey, next);
    return next;
  },
  reset(profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    try {
      localStorage.removeItem(makeKey(STORE_NAMES.todayRankDistance, resolvedProfileId));
    } catch (error) {
      // ignore storage failures
    }
  },
};

export default todayRankStore;
