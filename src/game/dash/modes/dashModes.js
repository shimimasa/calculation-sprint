import infiniteModeStrategy from './infiniteMode.js';
import goalRunModeStrategy from './goalRunMode.js';
import scoreAttack60ModeStrategy from './scoreAttack60Mode.js';
import { DEFAULT_DASH_MODE, normalizeDashModeId } from './modeTypes.js';

const STRATEGIES = Object.freeze({
  [infiniteModeStrategy.id]: infiniteModeStrategy,
  [goalRunModeStrategy.id]: goalRunModeStrategy,
  [scoreAttack60ModeStrategy.id]: scoreAttack60ModeStrategy,
});

export const getDashModeStrategy = (modeId) => {
  const normalizedMode = normalizeDashModeId(modeId);
  return STRATEGIES[normalizedMode] ?? STRATEGIES[DEFAULT_DASH_MODE];
};

export default STRATEGIES;
