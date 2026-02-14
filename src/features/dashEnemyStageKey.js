import { normalizeDashStageId } from './dashStages.js';

const MODE_TO_STAGE_KEY = Object.freeze({
  add: 'plus',
  sub: 'minus',
  mul: 'multi',
  div: 'divide',
});

export const getEnemyStageKeyForQuestion = (question, worldKey) => {
  const normalizedWorldKey = normalizeDashStageId(worldKey);
  if (normalizedWorldKey && normalizedWorldKey !== 'mix') {
    return normalizedWorldKey;
  }

  const mode = question?.meta?.mode;
  if (typeof mode === 'string' && MODE_TO_STAGE_KEY[mode]) {
    return MODE_TO_STAGE_KEY[mode];
  }

  return 'plus';
};

export default getEnemyStageKeyForQuestion;
