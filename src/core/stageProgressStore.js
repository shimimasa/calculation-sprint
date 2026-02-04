// ADR-004, ADR-002 Phase0補修: Centralized key generation (Phase1 will inject profileId).
import {
  LEGACY_KEYS,
  LEGACY_MIGRATION_KEYS,
  STORE_NAMES,
  DEFAULT_PROFILE_ID,
  makeKey,
  resolveProfileId,
} from './storageKeys.js';
const LEGACY_STORAGE_KEY = LEGACY_KEYS.stageProgress;
const LEGACY_MIGRATION_KEY = LEGACY_MIGRATION_KEYS.stageProgress;

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
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeKey(STORE_NAMES.stageProgress, resolvedProfileId);
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = parseProgress(raw);
      // ADR-004: Best-effort migration if new key is empty but legacy exists.
      if (!raw && resolvedProfileId === DEFAULT_PROFILE_ID && !window.localStorage.getItem(LEGACY_MIGRATION_KEY)) {
        const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          saveProgress(storageKey, parseProgress(legacyRaw));
          window.localStorage.setItem(LEGACY_MIGRATION_KEY, '1');
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
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeKey(STORE_NAMES.stageProgress, resolvedProfileId);
    const progress = this.getProgress(resolvedProfileId);
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
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeKey(STORE_NAMES.stageProgress, resolvedProfileId);
    const progress = this.getProgress(resolvedProfileId);
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
    const progress = this.getProgress(resolveProfileId(profileId));
    return progress.clearedStageIds.includes(stageId);
  },
  reset(profileId = DEFAULT_PROFILE_ID) {
    try {
      const resolvedProfileId = resolveProfileId(profileId);
      window.localStorage.removeItem(makeKey(STORE_NAMES.stageProgress, resolvedProfileId));
    } catch (error) {
      // ignore storage failures
    }
  },
};

export default stageProgressStore;
