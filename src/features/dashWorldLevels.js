import { toDashStageId } from './dashStages.js';

const DASH_WORLD_LEVEL_DEFINITIONS = Object.freeze({
  plus: Object.freeze([
    Object.freeze({ levelId: 1, difficultyKey: 'plus-l1' }),
    Object.freeze({ levelId: 2, difficultyKey: 'plus-l2' }),
    Object.freeze({ levelId: 3, difficultyKey: 'plus-l3' }),
    Object.freeze({ levelId: 4, difficultyKey: 'plus-l4' }),
  ]),
  minus: Object.freeze([
    Object.freeze({ levelId: 1, difficultyKey: 'minus-l1' }),
    Object.freeze({ levelId: 2, difficultyKey: 'minus-l2' }),
    Object.freeze({ levelId: 3, difficultyKey: 'minus-l3' }),
    Object.freeze({ levelId: 4, difficultyKey: 'minus-l4' }),
  ]),
  multi: Object.freeze([
    Object.freeze({ levelId: 1, difficultyKey: 'multi-l1' }),
    Object.freeze({ levelId: 2, difficultyKey: 'multi-l2' }),
  ]),
  divide: Object.freeze([
    Object.freeze({ levelId: 1, difficultyKey: 'divide-l1' }),
    Object.freeze({ levelId: 2, difficultyKey: 'divide-l2' }),
  ]),
  mix: Object.freeze([
    Object.freeze({ levelId: 1, difficultyKey: 'mix-l1' }),
    Object.freeze({ levelId: 2, difficultyKey: 'mix-l2' }),
  ]),
});

export const DASH_WORLD_KEYS = Object.freeze(Object.keys(DASH_WORLD_LEVEL_DEFINITIONS));
export const DASH_WORLD_LEVELS = DASH_WORLD_LEVEL_DEFINITIONS;

export const toDashWorldKey = (worldKey, fallbackWorldKey = 'plus') => {
  const normalizedWorldKey = toDashStageId(worldKey, fallbackWorldKey);
  return DASH_WORLD_KEYS.includes(normalizedWorldKey) ? normalizedWorldKey : 'plus';
};

export const toDashLevelId = (worldKey, levelId, fallbackLevelId = 1) => {
  const resolvedWorldKey = toDashWorldKey(worldKey);
  const levels = DASH_WORLD_LEVEL_DEFINITIONS[resolvedWorldKey] ?? [];
  if (levels.some((entry) => entry.levelId === levelId)) {
    return levelId;
  }
  return levels.some((entry) => entry.levelId === fallbackLevelId) ? fallbackLevelId : 1;
};

export const getDashWorldLevel = (worldKey, levelId = 1) => {
  const resolvedWorldKey = toDashWorldKey(worldKey);
  const resolvedLevelId = toDashLevelId(resolvedWorldKey, levelId, 1);
  const levels = DASH_WORLD_LEVEL_DEFINITIONS[resolvedWorldKey] ?? [];
  const level = levels.find((entry) => entry.levelId === resolvedLevelId) ?? levels[0] ?? null;
  return {
    worldKey: resolvedWorldKey,
    levelId: level?.levelId ?? 1,
    difficultyKey: level?.difficultyKey ?? null,
  };
};
