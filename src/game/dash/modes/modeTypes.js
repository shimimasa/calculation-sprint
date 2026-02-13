export const DASH_MODE_TYPES = Object.freeze({
  infinite: 'infinite',
  goalRun: 'goalRun',
  scoreAttack60: 'scoreAttack60',
});

export const DEFAULT_DASH_MODE = DASH_MODE_TYPES.infinite;

export const normalizeDashModeId = (modeId) => {
  if (typeof modeId !== 'string') {
    return DEFAULT_DASH_MODE;
  }
  const normalized = modeId.trim();
  if (!normalized) {
    return DEFAULT_DASH_MODE;
  }
  return Object.values(DASH_MODE_TYPES).includes(normalized)
    ? normalized
    : DEFAULT_DASH_MODE;
};
