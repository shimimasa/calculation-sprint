const RUN_BG_THEME_FALLBACK_ID = 'default';

const RUN_BG_THEME_IDS = Object.freeze([
  RUN_BG_THEME_FALLBACK_ID,
  'theme1',
  'w1',
  'bg_add',
  'bg_sub',
  'bg_mul',
  'bg_div',
  'bg_mix',
]);

const DASH_STAGE_BG_THEME_MAP = Object.freeze({
  plus: 'bg_add',
  minus: 'bg_sub',
  multi: 'bg_mul',
  divide: 'bg_div',
  mix: 'bg_mix',
});

const isRunBgThemeId = (themeId) => RUN_BG_THEME_IDS.includes(themeId);

export const normalizeRunBgThemeId = (
  themeId,
  fallbackThemeId = RUN_BG_THEME_FALLBACK_ID,
) => {
  if (isRunBgThemeId(themeId)) {
    return themeId;
  }
  return isRunBgThemeId(fallbackThemeId)
    ? fallbackThemeId
    : RUN_BG_THEME_FALLBACK_ID;
};

export const toDashRunBgThemeId = (dashStageId) => {
  const mappedThemeId = DASH_STAGE_BG_THEME_MAP[dashStageId];
  return normalizeRunBgThemeId(mappedThemeId);
};
