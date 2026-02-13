import infiniteModeStrategy from './infiniteMode.js';
import { DEFAULT_DASH_MODE, normalizeDashModeId } from './modeTypes.js';

const STRATEGIES = Object.freeze({
  [infiniteModeStrategy.id]: infiniteModeStrategy,
});

export const getDashModeStrategy = (modeId) => {
  const normalizedMode = normalizeDashModeId(modeId);
  return STRATEGIES[normalizedMode] ?? STRATEGIES[DEFAULT_DASH_MODE];
};

export default STRATEGIES;
