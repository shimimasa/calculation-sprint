// ADR-004, ADR-002: Use an app-specific, profile-ready storage namespace (subpath/portal safe).
// - New key includes a stable prefix + schema version + profileId.
// - Legacy key is migrated on first read when safe to do so.
const STORAGE_PREFIX = 'portal.calcSprint';
const SCHEMA_VERSION = 'v1';
const DEFAULT_PROFILE_ID = 'default';
const buildStorageKey = (profileId = DEFAULT_PROFILE_ID) => `${STORAGE_PREFIX}.rank.distance.today.${SCHEMA_VERSION}.${profileId}`;
const LEGACY_STORAGE_KEY = 'calcSprint.rank.distance.today.v1';

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
    const storageKey = buildStorageKey(profileId);
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
    const storageKey = buildStorageKey(profileId);
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
