import { DASH_MODE_TYPES } from './modeTypes.js';
import { toDashStageId } from '../../../features/dashStages.js';
import {
  timePenaltyOnWrong,
  timePenaltyOnCollision,
} from '../../../features/dashConstants.js';

const SCORE_ATTACK_TIME_LIMIT_MS = 60000;
const BASE_SCORE_PER_CORRECT = 100;
const MAX_COMBO_FOR_MULTIPLIER = 10;

const toScoreMultiplier = (combo) => {
  const safeCombo = Math.max(0, Number(combo) || 0);
  const boostedCombo = Math.min(safeCombo, MAX_COMBO_FOR_MULTIPLIER);
  return 1 + boostedCombo * 0.1;
};

const scoreAttack60ModeStrategy = {
  id: DASH_MODE_TYPES.scoreAttack60,
  timePolicy: {
    onCorrectMs: 0,
    onDefeatMs: 0,
    onWrongMs: -timePenaltyOnWrong,
    onCollisionMs: -timePenaltyOnCollision,
  },
  initRun() {
    return {
      combo: 0,
      maxCombo: 0,
      totalScore: 0,
    };
  },
  getInitialTimeLimitMs() {
    return SCORE_ATTACK_TIME_LIMIT_MS;
  },
  onAnswer({ isCorrect, modeRuntime }) {
    if (!modeRuntime || typeof modeRuntime !== 'object') {
      return;
    }
    if (!isCorrect) {
      modeRuntime.combo = 0;
      return;
    }
    const nextCombo = (Number(modeRuntime.combo) || 0) + 1;
    modeRuntime.combo = nextCombo;
    modeRuntime.maxCombo = Math.max(Number(modeRuntime.maxCombo) || 0, nextCombo);
    const multiplier = toScoreMultiplier(nextCombo);
    const addScore = Math.floor(BASE_SCORE_PER_CORRECT * multiplier);
    modeRuntime.totalScore = (Number(modeRuntime.totalScore) || 0) + addScore;
  },
  onCollision({ modeRuntime }) {
    if (!modeRuntime || typeof modeRuntime !== 'object') {
      return;
    }
    modeRuntime.combo = 0;
  },
  checkEnd({ timeLeftMs }) {
    if (Number.isFinite(timeLeftMs) && timeLeftMs <= 0) {
      return { ended: true, endReason: 'timeup' };
    }
    return { ended: false, endReason: null };
  },
  getHudState({ modeRuntime }) {
    const score = Number(modeRuntime?.totalScore) || 0;
    const combo = Number(modeRuntime?.combo) || 0;
    const maxCombo = Number(modeRuntime?.maxCombo) || 0;
    return {
      distanceLabel: 'SCORE',
      distanceText: String(score),
      distanceUnit: 'pt',
      hideNextArea: true,
      statOverrides: {
        speed: {
          label: 'COMBO',
          value: String(combo),
          unit: 'x',
        },
        streak: {
          label: 'MAX COMBO',
          value: String(maxCombo),
          unit: 'x',
        },
      },
    };
  },
  buildResult({ runId, distanceM, correctCount, wrongCount, defeatedCount, maxStreak, timeLeftMs, stageId, endReason, hits, modeRuntime }) {
    const totalScore = Number(modeRuntime?.totalScore) || 0;
    const maxCombo = Number(modeRuntime?.maxCombo) || 0;
    const combo = Number(modeRuntime?.combo) || 0;
    return {
      runId,
      mode: DASH_MODE_TYPES.scoreAttack60,
      score: totalScore,
      totalScore,
      combo,
      maxCombo,
      distanceM,
      correctCount,
      wrongCount,
      defeatedCount,
      maxStreak,
      hits: Number(hits) || 0,
      timeLeftMs: Math.max(0, Number(timeLeftMs) || 0),
      stageId: toDashStageId(stageId),
      endReason,
      retired: false,
    };
  },
};

export default scoreAttack60ModeStrategy;
