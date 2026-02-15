export const DASH_STAGE_IDS = Object.freeze(['plus', 'minus', 'multi', 'divide', 'mix']);

export const DASH_STAGE_FALLBACK_ID = 'plus';

const DASH_STAGE_MODE_MAP = Object.freeze({
  plus: 'add',
  minus: 'sub',
  multi: 'mul',
  divide: 'div',
  mix: 'mix',
});

const DASH_STAGE_LABEL_MAP = Object.freeze({
  plus: 'たし算',
  minus: 'ひき算',
  multi: 'かけ算',
  divide: 'わり算',
  mix: 'ミックス',
});

const DASH_STAGE_DESCRIPTION_MAP = Object.freeze({
  plus: 'たし算だけが出るステージ',
  minus: 'ひき算だけが出るステージ',
  multi: 'かけ算だけが出るステージ',
  divide: 'わり算だけが出るステージ',
  mix: '4つの演算がランダムで出るステージ',
});

const DASH_STAGE_LEVEL_COUNT_MAP = Object.freeze({
  plus: 5,
  minus: 5,
  multi: 5,
  divide: 5,
  mix: 2,
});

const createDashStageLevels = (levelCount) =>
  Object.freeze(Array.from({ length: levelCount }, (_, index) => index + 1));

const createStageDefinition = (id) => {
  const mode = DASH_STAGE_MODE_MAP[id] ?? DASH_STAGE_MODE_MAP[DASH_STAGE_FALLBACK_ID];
  const isMix = id === 'mix';
  const levelCount = DASH_STAGE_LEVEL_COUNT_MAP[id] ?? DASH_STAGE_LEVEL_COUNT_MAP[DASH_STAGE_FALLBACK_ID];

  return Object.freeze({
    id,
    labelJa: DASH_STAGE_LABEL_MAP[id] ?? DASH_STAGE_LABEL_MAP[DASH_STAGE_FALLBACK_ID],
    descriptionJa:
      DASH_STAGE_DESCRIPTION_MAP[id] ?? DASH_STAGE_DESCRIPTION_MAP[DASH_STAGE_FALLBACK_ID],
    problemPolicy: Object.freeze({
      mode,
      allowedModes: isMix ? Object.freeze(['add', 'sub', 'mul', 'div']) : Object.freeze([mode]),
    }),
    enemyPolicy: Object.freeze({
      type: isMix ? 'mix' : id,
      allowedTypes: isMix
        ? Object.freeze(['plus', 'minus', 'multi', 'divide'])
        : Object.freeze([id]),
    }),
    levelCount,
    levels: createDashStageLevels(levelCount),
  });
};

export const DASH_STAGES = Object.freeze(DASH_STAGE_IDS.map((stageId) => createStageDefinition(stageId)));

export const normalizeDashStageId = (stageId) => {
  if (typeof stageId !== 'string') {
    return null;
  }

  const normalizedStageId = stageId.trim().toLowerCase();
  return DASH_STAGE_IDS.includes(normalizedStageId) ? normalizedStageId : null;
};

export const toDashStageId = (stageId, fallbackStageId = DASH_STAGE_FALLBACK_ID) => {
  const normalizedStageId = normalizeDashStageId(stageId);
  if (normalizedStageId) {
    return normalizedStageId;
  }

  const normalizedFallbackId = normalizeDashStageId(fallbackStageId);
  return normalizedFallbackId ?? DASH_STAGE_FALLBACK_ID;
};

export const isDashStageId = (stageId) => normalizeDashStageId(stageId) !== null;

export const findDashStageById = (stageId) => {
  const normalizedStageId = normalizeDashStageId(stageId);
  if (!normalizedStageId) {
    return null;
  }

  return DASH_STAGES.find((stage) => stage.id === normalizedStageId) ?? null;
};

export const getDashStageOrFallback = (
  stageId,
  fallbackStageId = DASH_STAGE_FALLBACK_ID,
) => {
  const resolvedStageId = toDashStageId(stageId, fallbackStageId);
  return findDashStageById(resolvedStageId) ?? findDashStageById(DASH_STAGE_FALLBACK_ID);
};

export const toQuestionMode = (stageId, fallbackStageId = DASH_STAGE_FALLBACK_ID) => {
  const stage = getDashStageOrFallback(stageId, fallbackStageId);
  return stage?.problemPolicy?.mode ?? DASH_STAGE_MODE_MAP[DASH_STAGE_FALLBACK_ID];
};

export const getDashStageLabelJa = (stageId, fallbackStageId = DASH_STAGE_FALLBACK_ID) => {
  const stage = getDashStageOrFallback(stageId, fallbackStageId);
  return stage?.labelJa ?? DASH_STAGE_LABEL_MAP[DASH_STAGE_FALLBACK_ID];
};

export const getDashStageLevels = (stageId, fallbackStageId = DASH_STAGE_FALLBACK_ID) => {
  const stage = getDashStageOrFallback(stageId, fallbackStageId);
  if (Array.isArray(stage?.levels) && stage.levels.length > 0) {
    return stage.levels;
  }

  const fallbackCount = stage?.levelCount ?? DASH_STAGE_LEVEL_COUNT_MAP[DASH_STAGE_FALLBACK_ID];
  return createDashStageLevels(fallbackCount);
};
