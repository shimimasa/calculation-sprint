import { DASH_MODE_TYPES } from './modeTypes.js';
import { toDashStageId } from '../../../features/dashStages.js';
import {
  timeBonusOnCorrect,
  timeBonusOnDefeat,
  timePenaltyOnWrong,
  timePenaltyOnCollision,
} from '../../../features/dashConstants.js';

const infiniteModeStrategy = {
  id: DASH_MODE_TYPES.infinite,
  timePolicy: {
    onCorrectMs: timeBonusOnCorrect,
    onDefeatMs: timeBonusOnDefeat,
    onWrongMs: -timePenaltyOnWrong,
    onCollisionMs: -timePenaltyOnCollision,
  },
  checkEnd({ timeLeftMs }) {
    if (Number.isFinite(timeLeftMs) && timeLeftMs <= 0) {
      return { ended: true, endReason: 'timeup' };
    }
    return { ended: false, endReason: null };
  },
  buildResult({ runId, distanceM, correctCount, wrongCount, defeatedCount, maxStreak, timeLeftMs, stageId, endReason }) {
    return {
      runId,
      mode: DASH_MODE_TYPES.infinite,
      distanceM,
      correctCount,
      wrongCount,
      defeatedCount,
      maxStreak,
      timeLeftMs: Math.max(0, timeLeftMs),
      stageId: toDashStageId(stageId),
      endReason,
      retired: endReason !== 'timeup',
    };
  },
};

export default infiniteModeStrategy;
