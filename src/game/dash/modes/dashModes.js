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

const isDevEnvironment = () => {
  if (typeof process === 'undefined' || !process?.env) return false;
  return process.env.NODE_ENV !== 'production';
};

const warnInvalidTimePolicy = (modeId, timePolicy) => {
  if (!isDevEnvironment() || !timePolicy) return;

  if (Number(timePolicy.onWrongMs) > 0 || Number(timePolicy.onCollisionMs) > 0) {
    console.warn('[dash-modes] timePolicy penalty events should be <= 0ms (negative means time reduction).', {
      modeId,
      onWrongMs: timePolicy.onWrongMs,
      onCollisionMs: timePolicy.onCollisionMs,
    });
  }

  if (Number.isNaN(Number(timePolicy.onCorrectMs)) || Number.isNaN(Number(timePolicy.onDefeatMs))) {
    console.warn('[dash-modes] timePolicy bonus events should be numeric values.', {
      modeId,
      onCorrectMs: timePolicy.onCorrectMs,
      onDefeatMs: timePolicy.onDefeatMs,
    });
  }
};

/**
 * Dash mode timePolicy contract (ms deltas applied to `timeLeftMs`).
 *
 * | mode            | onCorrectMs          | onDefeatMs           | onWrongMs                    | onCollisionMs                |
 * |-----------------|----------------------|----------------------|------------------------------|------------------------------|
 * | infinite        | +timeBonusOnCorrect  | +timeBonusOnDefeat   | -timePenaltyOnWrong          | -timePenaltyOnCollision      |
 * | goalRun         | +timeBonusOnCorrect  | +timeBonusOnDefeat   | -timePenaltyOnWrong          | -timePenaltyOnCollision      |
 * | scoreAttack60   | 0                    | 0                    | -timePenaltyOnWrong          | -timePenaltyOnCollision      |
 *
 * NOTE: `onWrongMs` / `onCollisionMs` represent subtraction via negative values.
 */
export const getDashModeTimePolicy = (modeId, modeStrategy = getDashModeStrategy(modeId)) => {
  const normalizedMode = normalizeDashModeId(modeId);
  const strategyPolicy = modeStrategy?.getTimePolicy?.() ?? modeStrategy?.timePolicy;
  if (strategyPolicy && typeof strategyPolicy === 'object') {
    const mergedPolicy = {
      ...DEFAULT_TIME_POLICY,
      ...strategyPolicy,
    };
    warnInvalidTimePolicy(normalizedMode, mergedPolicy);
    return mergedPolicy;
  }

  const fallbackPolicy = {
    ...DEFAULT_TIME_POLICY,
    ...(MODE_TIME_POLICY_FALLBACKS[normalizedMode] ?? null),
  };
  warnInvalidTimePolicy(normalizedMode, fallbackPolicy);
  return fallbackPolicy;
};

export default STRATEGIES;
