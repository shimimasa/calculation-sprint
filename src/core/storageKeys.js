// ADR-004, ADR-002 Phase0補修: Centralize storage key generation so Phase1 can inject profileId safely.
export const STORAGE_NAMESPACE = 'portal.calcSprint';
export const DEFAULT_PROFILE_ID = 'default';
export const DEFAULT_SCHEMA_VERSION = 'v1';
export const LAST_PROFILE_ID_KEY = `${STORAGE_NAMESPACE}.lastProfileId`;

// makeKey(storeName, profileId='default', version='v1')
export const makeKey = (storeName, profileId = DEFAULT_PROFILE_ID, version = DEFAULT_SCHEMA_VERSION) => (
  `${STORAGE_NAMESPACE}.${storeName}.${version}.${profileId}`
);

export const STORE_NAMES = Object.freeze({
  daily: 'daily',
  todayRankDistance: 'rank.distance.today',
  stageProgress: 'stageProgress',
});

export const LEGACY_KEYS = Object.freeze({
  daily: 'calcSprint.daily.v1',
  todayRankDistance: 'calcSprint.rank.distance.today.v1',
  stageProgress: 'calcSprint.stageProgress.v1',
});
