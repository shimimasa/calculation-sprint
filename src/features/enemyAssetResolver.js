import { normalizeDashStageId, DASH_STAGE_FALLBACK_ID } from './dashStages.js';

export const ENEMY_TIER_IDS = Object.freeze(['normal', 'big', 'boss']);
export const ENEMY_STATE_IDS = Object.freeze(['walk', 'hit', 'dead']);

export const ENEMY_HP_BY_TIER = Object.freeze({
  normal: 1,
  big: 2,
  boss: 3,
});

const warnedMissingAssetPaths = new Set();

export const normalizeEnemyTier = (tier) => {
  const normalizedTier = String(tier ?? '').trim().toLowerCase();
  return ENEMY_TIER_IDS.includes(normalizedTier) ? normalizedTier : 'normal';
};

export const normalizeEnemySpriteState = (state) => {
  const normalizedState = String(state ?? '').trim().toLowerCase();
  return ENEMY_STATE_IDS.includes(normalizedState) ? normalizedState : 'walk';
};

const normalizeEnemyStageKey = (stageKey) => {
  const normalized = normalizeDashStageId(stageKey);
  return normalized === 'mix' ? DASH_STAGE_FALLBACK_ID : (normalized ?? DASH_STAGE_FALLBACK_ID);
};

export const getEnemyHpByTier = (tier) => ENEMY_HP_BY_TIER[normalizeEnemyTier(tier)] ?? ENEMY_HP_BY_TIER.normal;

export const buildEnemyAssetCandidates = ({ stageKey, tier = 'normal', state = 'walk' } = {}) => {
  const resolvedStageKey = normalizeEnemyStageKey(stageKey);
  const resolvedTier = normalizeEnemyTier(tier);
  const resolvedState = normalizeEnemySpriteState(state);
  const preferredPath = `assets/enemy/${resolvedStageKey}/${resolvedTier}/enemy_${resolvedStageKey}_${resolvedTier}_${resolvedState}.png`;
  const legacyPath = `assets/enemy/enemy_${resolvedStageKey}_${resolvedState}.png`;
  const safeFallbackPath = 'assets/enemy/enemy_plus_walk.png';
  return [preferredPath, legacyPath, safeFallbackPath];
};

export const enemyAssetResolver = ({ stageKey, tier = 'normal', state = 'walk' } = {}) => (
  buildEnemyAssetCandidates({ stageKey, tier, state })[0]
);

const warnMissingEnemyAssetOnce = (assetPath, fallbackPath) => {
  if (!assetPath || warnedMissingAssetPaths.has(assetPath)) {
    return;
  }
  warnedMissingAssetPaths.add(assetPath);
  console.warn('[dash-enemy] Missing enemy asset, applying fallback.', {
    missing: assetPath,
    fallback: fallbackPath,
  });
};

export const applyEnemySpriteWithFallback = (imgEl, { stageKey, tier = 'normal', state = 'walk' } = {}) => {
  if (!imgEl) {
    return '';
  }
  const candidates = buildEnemyAssetCandidates({ stageKey, tier, state });
  if (candidates.length === 0) {
    imgEl.onerror = null;
    imgEl.src = '';
    return '';
  }
  let index = 0;
  const applyCurrent = () => {
    const currentSrc = candidates[index] ?? candidates[candidates.length - 1] ?? '';
    imgEl.src = currentSrc;
    return currentSrc;
  };
  imgEl.onerror = () => {
    const failedSrc = candidates[index] ?? '';
    if (index < candidates.length - 1) {
      index += 1;
      const fallbackSrc = candidates[index] ?? candidates[candidates.length - 1] ?? '';
      warnMissingEnemyAssetOnce(failedSrc, fallbackSrc);
      applyCurrent();
      return;
    }
    warnMissingEnemyAssetOnce(failedSrc, null);
    imgEl.onerror = null;
  };
  return applyCurrent();
};

export default enemyAssetResolver;
