import gameState from './gameState.js';

// ADR-004, ADR-002 Phase0補修: Centralize storage key generation so Phase1 can inject profileId safely.
export const STORAGE_NAMESPACE = 'calc-sprint';
const STORAGE_META_SCOPE = `${STORAGE_NAMESPACE}::meta`;
export const DEFAULT_PROFILE_ID = 'default';
export const DEFAULT_SCHEMA_VERSION = 'v1';
export const LAST_PROFILE_ID_KEY = `${STORAGE_META_SCOPE}::last-profile`;
export const LEGACY_LAST_PROFILE_ID_KEYS = Object.freeze([
  'portal.calcSprint.lastProfileId',
  'calcSprint.lastProfileId',
]);

// makeStoreKey(profileId='default', storeName, version='v1')
export const makeStoreKey = (profileId = DEFAULT_PROFILE_ID, storeName, version = DEFAULT_SCHEMA_VERSION) => (
  `${STORAGE_NAMESPACE}::${profileId}::${storeName}.${version}`
);

// makeKey(storeName, profileId='default', version='v1') - legacy signature
export const makeKey = (storeName, profileId = DEFAULT_PROFILE_ID, version = DEFAULT_SCHEMA_VERSION) => (
  makeStoreKey(profileId, storeName, version)
);

export const STORE_NAMES = Object.freeze({
  daily: 'daily',
  todayRankDistance: 'rank.distance.today',
  stageProgress: 'stageProgress',
});

export const LEGACY_MIGRATION_KEYS = Object.freeze({
  daily: `${STORAGE_META_SCOPE}::migration::${STORE_NAMES.daily}.${DEFAULT_SCHEMA_VERSION}`,
  todayRankDistance: `${STORAGE_META_SCOPE}::migration::${STORE_NAMES.todayRankDistance}.${DEFAULT_SCHEMA_VERSION}`,
  stageProgress: `${STORAGE_META_SCOPE}::migration::${STORE_NAMES.stageProgress}.${DEFAULT_SCHEMA_VERSION}`,
});

export const LEGACY_KEYS = Object.freeze({
  daily: [
    `portal.calcSprint.${STORE_NAMES.daily}.${DEFAULT_SCHEMA_VERSION}.p:${DEFAULT_PROFILE_ID}`,
    `calcSprint.${STORE_NAMES.daily}.${DEFAULT_SCHEMA_VERSION}`,
  ],
  todayRankDistance: [
    `portal.calcSprint.${STORE_NAMES.todayRankDistance}.${DEFAULT_SCHEMA_VERSION}.p:${DEFAULT_PROFILE_ID}`,
    `calcSprint.${STORE_NAMES.todayRankDistance}.${DEFAULT_SCHEMA_VERSION}`,
  ],
  stageProgress: [
    `portal.calcSprint.${STORE_NAMES.stageProgress}.${DEFAULT_SCHEMA_VERSION}.p:${DEFAULT_PROFILE_ID}`,
    `calcSprint.${STORE_NAMES.stageProgress}.${DEFAULT_SCHEMA_VERSION}`,
  ],
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
