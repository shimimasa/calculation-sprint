// ADR-004, ADR-002: Use an app-specific, profile-ready storage namespace (subpath/portal safe).
// - New key includes a stable prefix + schema version + profileId.
// - Legacy key is migrated on first read when safe to do so.
const STORAGE_PREFIX = 'portal.calcSprint';
const SCHEMA_VERSION = 'v1';
const DEFAULT_PROFILE_ID = 'default';
const buildStorageKey = (profileId = DEFAULT_PROFILE_ID) => `${STORAGE_PREFIX}.stageProgress.${SCHEMA_VERSION}.${profileId}`;
const LEGACY_STORAGE_KEY = 'calcSprint.stageProgress.v1';

const buildDefaultProgress = () => ({
  clearedStageIds: [],
  lastPlayedStageId: null,
  updatedAt: new Date().toISOString(),
});

const parseProgress = (raw) => {
  if (!raw) {
    return buildDefaultProgress();
  }
  try {
    const parsed = JSON.parse(raw);
    const clearedStageIds = Array.isArray(parsed.clearedStageIds)
      ? parsed.clearedStageIds.filter((id) => typeof id === 'string')
      : [];
    const lastPlayedStageId = typeof parsed.lastPlayedStageId === 'string'
      ? parsed.lastPlayedStageId
      : null;
    const updatedAt = typeof parsed.updatedAt === 'string'
      ? parsed.updatedAt
      : new Date().toISOString();
    return { clearedStageIds, lastPlayedStageId, updatedAt };
  } catch (error) {
    return buildDefaultProgress();
  }
};

const saveProgress = (storageKey, progress) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch (error) {
    // ignore storage failures
  }
};

const stageProgressStore = {
  getProgress(profileId = DEFAULT_PROFILE_ID) {
    const storageKey = buildStorageKey(profileId);
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = parseProgress(raw);
      // ADR-004: Best-effort migration if new key is empty but legacy exists.
      if (!raw) {
        const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          saveProgress(storageKey, parseProgress(legacyRaw));
          return parseProgress(legacyRaw);
        }
      }
      return parsed;
    } catch (error) {
      return buildDefaultProgress();
    }
  },
  markCleared(stageId, profileId = DEFAULT_PROFILE_ID) {
    if (!stageId) {
      return;
    }
    const storageKey = buildStorageKey(profileId);
    const progress = this.getProgress(profileId);
    const clearedStageIds = progress.clearedStageIds.includes(stageId)
      ? progress.clearedStageIds
      : [...progress.clearedStageIds, stageId];
    const updated = {
      clearedStageIds,
      lastPlayedStageId: stageId,
      updatedAt: new Date().toISOString(),
    };
    saveProgress(storageKey, updated);
  },
  setLastPlayed(stageId, profileId = DEFAULT_PROFILE_ID) {
    if (!stageId) {
      return;
    }
    const storageKey = buildStorageKey(profileId);
    const progress = this.getProgress(profileId);
    const updated = {
      ...progress,
      lastPlayedStageId: stageId,
      updatedAt: new Date().toISOString(),
    };
    saveProgress(storageKey, updated);
  },
  isCleared(stageId, profileId = DEFAULT_PROFILE_ID) {
    if (!stageId) {
      return false;
    }
    const progress = this.getProgress(profileId);
    return progress.clearedStageIds.includes(stageId);
  },
  reset(profileId = DEFAULT_PROFILE_ID) {
    try {
      // ADR-004: Remove both new + legacy keys so reset can't be undone by auto-migration.
      window.localStorage.removeItem(buildStorageKey(profileId));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      // ignore storage failures
    }
  },
};

export default stageProgressStore;
