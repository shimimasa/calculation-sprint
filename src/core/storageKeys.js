import gameState from './gameState.js';

// ADR-004, ADR-002 Phase0補修: Centralize storage key generation so Phase1 can inject profileId safely.
export const STORAGE_NAMESPACE = 'portal.calcSprint';
export const DEFAULT_PROFILE_ID = 'default';
export const DEFAULT_SCHEMA_VERSION = 'v1';
export const LAST_PROFILE_ID_KEY = `${STORAGE_NAMESPACE}.lastProfileId`;

// makeKey(storeName, profileId='default', version='v1')
export const makeKey = (storeName, profileId = DEFAULT_PROFILE_ID, version = DEFAULT_SCHEMA_VERSION) => (
  `${STORAGE_NAMESPACE}.${storeName}.${version}.p:${profileId}`
);

export const STORE_NAMES = Object.freeze({
  daily: 'daily',
  todayRankDistance: 'rank.distance.today',
  stageProgress: 'stageProgress',
});

export const LEGACY_MIGRATION_KEYS = Object.freeze({
  daily: `${STORAGE_NAMESPACE}.migration.${STORE_NAMES.daily}.${DEFAULT_SCHEMA_VERSION}`,
  todayRankDistance: `${STORAGE_NAMESPACE}.migration.${STORE_NAMES.todayRankDistance}.${DEFAULT_SCHEMA_VERSION}`,
  stageProgress: `${STORAGE_NAMESPACE}.migration.${STORE_NAMES.stageProgress}.${DEFAULT_SCHEMA_VERSION}`,
});

export const LEGACY_KEYS = Object.freeze({
  daily: 'calcSprint.daily.v1',
  todayRankDistance: 'calcSprint.rank.distance.today.v1',
  stageProgress: 'calcSprint.stageProgress.v1',
});

export const resolveProfileId = (profileId) => {
  if (typeof profileId === 'string' && profileId.length > 0) {
    return profileId;
  }
  if (typeof gameState.profileId === 'string' && gameState.profileId.length > 0) {
    return gameState.profileId;
  }
  return DEFAULT_PROFILE_ID;
};
