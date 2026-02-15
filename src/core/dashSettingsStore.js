import {
  DEFAULT_SCHEMA_VERSION,
  LEGACY_MIGRATION_KEYS,
  STORE_NAMES,
  makeStoreKey,
  resolveProfileId,
} from './storageKeys.js';

const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
export const DEFAULT_DASH_SETTINGS = Object.freeze({
  bgmEnabled: true,
  sfxEnabled: true,
  difficulty: 'normal',
  schemaVersion: DEFAULT_SCHEMA_VERSION,
});

const normalizeDifficulty = (difficulty) => (
  VALID_DIFFICULTIES.has(difficulty) ? difficulty : DEFAULT_DASH_SETTINGS.difficulty
);

const normalizeSettings = (raw) => {
  const settings = raw && typeof raw === 'object' ? raw : {};
  return {
    bgmEnabled: settings.bgmEnabled !== false,
    sfxEnabled: settings.sfxEnabled !== false,
    difficulty: normalizeDifficulty(settings.difficulty),
    schemaVersion: DEFAULT_SCHEMA_VERSION,
  };
};

const readStorage = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    return null;
  }
};

const migrateLegacyMuted = (profileId, settings) => {
  try {
    const migrationKey = LEGACY_MIGRATION_KEYS.dashSettingsMuted;
    if (window.localStorage.getItem(migrationKey) === '1') {
      return settings;
    }
    const legacyMuted = window.localStorage.getItem('muted');
    if (legacyMuted === 'true') {
      const migrated = {
        ...settings,
        bgmEnabled: false,
        sfxEnabled: false,
      };
      writeStorage(makeStoreKey(profileId, STORE_NAMES.dashSettings), migrated);
      window.localStorage.setItem(migrationKey, '1');
      return migrated;
    }
    if (legacyMuted === 'false') {
      window.localStorage.setItem(migrationKey, '1');
      return settings;
    }
  } catch (error) {
    return settings;
  }
  return settings;
};

const dashSettingsStore = {
  get(profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const key = makeStoreKey(resolvedProfileId, STORE_NAMES.dashSettings);
    const normalized = normalizeSettings(readStorage(key));
    return migrateLegacyMuted(resolvedProfileId, normalized);
  },
  save(nextSettings, profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const key = makeStoreKey(resolvedProfileId, STORE_NAMES.dashSettings);
    const merged = normalizeSettings({
      ...this.get(resolvedProfileId),
      ...nextSettings,
    });
    writeStorage(key, merged);
    return merged;
  },
};

export default dashSettingsStore;
