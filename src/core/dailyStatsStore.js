// ADR-004, ADR-002: Use an app-specific, profile-ready storage namespace (subpath/portal safe).
// - New key includes a stable prefix + schema version + profileId.
// - Legacy key is migrated on first read when safe to do so.
const STORAGE_PREFIX = 'portal.calcSprint';
const SCHEMA_VERSION = 'v1';
const DEFAULT_PROFILE_ID = 'default';
const buildStorageKey = (profileId = DEFAULT_PROFILE_ID) => `${STORAGE_PREFIX}.daily.${SCHEMA_VERSION}.${profileId}`;
const LEGACY_STORAGE_KEY = 'calcSprint.daily.v1';

const DEFAULT_WRONG_BY_MODE = Object.freeze({
  add: 0,
  sub: 0,
  mul: 0,
  div: 0,
});

const createEmptyRecord = () => ({
  bestAvgSec: null,
  bestDistanceM: null,
  attemptTotal: 0,
  wrongTotal: 0,
  wrongByMode: { ...DEFAULT_WRONG_BY_MODE },
  sessions: 0,
});

const normalizeRecord = (record) => {
  const base = createEmptyRecord();
  if (!record || typeof record !== 'object') {
    return base;
  }
  return {
    bestAvgSec: typeof record.bestAvgSec === 'number' ? record.bestAvgSec : null,
    bestDistanceM: typeof record.bestDistanceM === 'number' ? record.bestDistanceM : null,
    attemptTotal: Number.isFinite(record.attemptTotal) ? record.attemptTotal : 0,
    wrongTotal: Number.isFinite(record.wrongTotal) ? record.wrongTotal : 0,
    wrongByMode: {
      ...DEFAULT_WRONG_BY_MODE,
      ...(record.wrongByMode || {}),
    },
    sessions: Number.isFinite(record.sessions) ? record.sessions : 0,
  };
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
    return parsed;
  } catch (error) {
    return null;
  }
};

const writeToStorage = (storageKey, data) => {
  localStorage.setItem(storageKey, JSON.stringify(data));
};

const readAll = (profileId = DEFAULT_PROFILE_ID) => {
  const storageKey = buildStorageKey(profileId);
  const current = readFromStorage(storageKey);
  if (current) {
    return current;
  }
  const legacy = readFromStorage(LEGACY_STORAGE_KEY);
  if (legacy) {
    // ADR-004: Best-effort, non-destructive migration (copy only).
    writeToStorage(storageKey, legacy);
    return legacy;
  }
  return {};
};

const dailyStatsStore = {
  getAll(profileId = DEFAULT_PROFILE_ID) {
    return readAll(profileId);
  },
  get(dateKey, profileId = DEFAULT_PROFILE_ID) {
    const all = readAll(profileId);
    if (!all[dateKey]) {
      return null;
    }
    return normalizeRecord(all[dateKey]);
  },
  upsert(dateKey, sessionStats, profileId = DEFAULT_PROFILE_ID) {
    const storageKey = buildStorageKey(profileId);
    const all = readAll(profileId);
    const current = normalizeRecord(all[dateKey]);
    const wrongByMode = {
      ...DEFAULT_WRONG_BY_MODE,
      ...(sessionStats?.wrongByMode || {}),
    };

    const updated = {
      ...current,
      attemptTotal: current.attemptTotal + (sessionStats?.attemptTotal || 0),
      wrongTotal: current.wrongTotal + (sessionStats?.wrongTotal || 0),
      wrongByMode: {
        add: current.wrongByMode.add + wrongByMode.add,
        sub: current.wrongByMode.sub + wrongByMode.sub,
        mul: current.wrongByMode.mul + wrongByMode.mul,
        div: current.wrongByMode.div + wrongByMode.div,
      },
      sessions: current.sessions + 1,
    };

    const avgSec = sessionStats?.avgSec || 0;
    if (avgSec > 0) {
      if (updated.bestAvgSec === null || avgSec < updated.bestAvgSec) {
        updated.bestAvgSec = avgSec;
      }
    }
    const distanceM = Number.isFinite(sessionStats?.distanceM)
      ? sessionStats.distanceM
      : 0;
    if (distanceM > 0) {
      if (updated.bestDistanceM === null || distanceM > updated.bestDistanceM) {
        updated.bestDistanceM = distanceM;
      }
    }

    all[dateKey] = updated;
    writeToStorage(storageKey, all);
    return updated;
  },
  reset(profileId = DEFAULT_PROFILE_ID) {
    // ADR-004: Remove both new + legacy keys so reset can't be undone by auto-migration.
    localStorage.removeItem(buildStorageKey(profileId));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  },
};

export default dailyStatsStore;
