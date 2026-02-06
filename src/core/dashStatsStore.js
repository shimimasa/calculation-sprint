import {
  DEFAULT_SCHEMA_VERSION,
  STORE_NAMES,
  makeStoreKey,
  resolveProfileId,
} from './storageKeys.js';

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
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    return null;
  }
};

const normalizeSession = (session) => ({
  distanceM: Number.isFinite(session?.distanceM) ? session.distanceM : 0,
  correctCount: Number.isFinite(session?.correctCount) ? session.correctCount : 0,
  wrongCount: Number.isFinite(session?.wrongCount) ? session.wrongCount : 0,
  maxStreak: Number.isFinite(session?.maxStreak) ? session.maxStreak : 0,
  timeLeftMs: Number.isFinite(session?.timeLeftMs) ? session.timeLeftMs : 0,
  endedAt: typeof session?.endedAt === 'string' ? session.endedAt : null,
  schemaVersion: typeof session?.schemaVersion === 'string'
    ? session.schemaVersion
    : DEFAULT_SCHEMA_VERSION,
});

const dashStatsStore = {
  getSession(profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeStoreKey(resolvedProfileId, STORE_NAMES.dashSession);
    return normalizeSession(readFromStorage(storageKey));
  },
  saveSession(session, profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeStoreKey(resolvedProfileId, STORE_NAMES.dashSession);
    const record = normalizeSession({
      ...session,
      endedAt: new Date().toISOString(),
      schemaVersion: DEFAULT_SCHEMA_VERSION,
    });
    writeToStorage(storageKey, record);
    return record;
  },
};

export default dashStatsStore;
