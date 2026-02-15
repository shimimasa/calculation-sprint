import infiniteModeStrategy from './infiniteMode.js';
import goalRunModeStrategy from './goalRunMode.js';
import scoreAttack60ModeStrategy from './scoreAttack60Mode.js';
import {
  timeBonusOnCorrect,
  timeBonusOnDefeat,
  timePenaltyOnWrong,
  timePenaltyOnCollision,
} from '../../../features/dashConstants.js';
import { DASH_MODE_TYPES, DEFAULT_DASH_MODE, normalizeDashModeId } from './modeTypes.js';

const STRATEGIES = Object.freeze({
  [infiniteModeStrategy.id]: infiniteModeStrategy,
  [goalRunModeStrategy.id]: goalRunModeStrategy,
  [scoreAttack60ModeStrategy.id]: scoreAttack60ModeStrategy,
});

export const getDashModeStrategy = (modeId) => {
  const normalizedMode = normalizeDashModeId(modeId);
  return STRATEGIES[normalizedMode] ?? STRATEGIES[DEFAULT_DASH_MODE];
};

const DEFAULT_TIME_POLICY = Object.freeze({
  onCorrectMs: timeBonusOnCorrect,
  onDefeatMs: timeBonusOnDefeat,
  onWrongMs: -timePenaltyOnWrong,
  onCollisionMs: -timePenaltyOnCollision,
});

const MODE_TIME_POLICY_FALLBACKS = Object.freeze({
  [DASH_MODE_TYPES.scoreAttack60]: {
    ...DEFAULT_TIME_POLICY,
    onCorrectMs: 0,
    onDefeatMs: 0,
  },
});

export const getDashModeTimePolicy = (modeId, modeStrategy = getDashModeStrategy(modeId)) => {
  const normalizedMode = normalizeDashModeId(modeId);
  const strategyPolicy = modeStrategy?.getTimePolicy?.() ?? modeStrategy?.timePolicy;
  if (strategyPolicy && typeof strategyPolicy === 'object') {
    return {
      ...DEFAULT_TIME_POLICY,
      ...strategyPolicy,
    };
  }
  return {
    ...DEFAULT_TIME_POLICY,
    ...(MODE_TIME_POLICY_FALLBACKS[normalizedMode] ?? null),
  };
};

export default STRATEGIES;
