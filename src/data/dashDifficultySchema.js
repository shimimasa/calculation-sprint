import { getDashWorldLevel } from '../features/dashWorldLevels.js';

const DASH_DIFFICULTY_SCHEMA = Object.freeze({
  plus: Object.freeze({
    1: Object.freeze({ mode: 'add', aDigits: 1, bDigits: 1, carry: false }),
    2: Object.freeze({ mode: 'add', aDigits: 1, bDigits: 1, carry: true }),
    3: Object.freeze({ mode: 'add', aDigits: 2, bDigits: 1, carry: true }),
    4: Object.freeze({ mode: 'add', aDigits: 2, bDigits: 2, carry: true }),
  }),
  minus: Object.freeze({
    1: Object.freeze({ mode: 'sub', aDigits: 1, bDigits: 1, borrow: false, nonNegative: true }),
    2: Object.freeze({ mode: 'sub', aDigits: 1, bDigits: 1, borrow: true, nonNegative: true }),
    3: Object.freeze({ mode: 'sub', aDigits: 2, bDigits: 1, borrow: true, nonNegative: true }),
    4: Object.freeze({ mode: 'sub', aDigits: 2, bDigits: 2, borrow: true, nonNegative: true }),
  }),
  multi: Object.freeze({
    1: Object.freeze({ mode: 'mul', aDigits: 1, bDigits: 1 }),
    2: Object.freeze({ mode: 'mul', aDigits: 2, bDigits: 1 }),
  }),
  divide: Object.freeze({
    1: Object.freeze({ mode: 'div', divisible: true }),
    2: Object.freeze({ mode: 'div', divisible: false, integerAnswerOnly: true }),
  }),
  mix: Object.freeze({
    1: Object.freeze({ mode: 'mix' }),
    2: Object.freeze({ mode: 'mix' }),
  }),
});

export const getDashDifficultyRule = (worldKey, levelId) => {
  const worldLevel = getDashWorldLevel(worldKey, levelId);
  const rule = DASH_DIFFICULTY_SCHEMA[worldLevel.worldKey]?.[worldLevel.levelId] ?? null;
  return {
    worldKey: worldLevel.worldKey,
    levelId: worldLevel.levelId,
    difficultyKey: worldLevel.difficultyKey,
    rule,
  };
};

export default DASH_DIFFICULTY_SCHEMA;
