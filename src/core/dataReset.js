import {
  DEFAULT_PROFILE_ID,
  LEGACY_KEYS,
  LEGACY_MIGRATION_KEYS,
  STORAGE_NAMESPACE,
  resolveProfileId,
} from './storageKeys.js';
import dailyStatsStore from './dailyStatsStore.js';
import stageProgressStore from './stageProgressStore.js';
import todayRankStore from './todayRankStore.js';

const removeKey = (key) => {
  if (!key) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // ignore storage failures
  }
};

const removeLegacyKeys = () => {
  Object.values(LEGACY_KEYS).forEach((key) => removeKey(key));
  Object.values(LEGACY_MIGRATION_KEYS).forEach((key) => removeKey(key));
};

export const resetProfileData = (profileId) => {
  const resolvedProfileId = resolveProfileId(profileId);
  dailyStatsStore.reset(resolvedProfileId);
  stageProgressStore.reset(resolvedProfileId);
  todayRankStore.reset(resolvedProfileId);
  if (resolvedProfileId === DEFAULT_PROFILE_ID) {
    removeLegacyKeys();
  }
};

export const resetAllData = () => {
  const keysToRemove = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(STORAGE_NAMESPACE)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => removeKey(key));
  removeLegacyKeys();
};
