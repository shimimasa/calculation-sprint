import { DASH_MODE_TYPES } from './modeTypes.js';
import { toDashStageId } from '../../../features/dashStages.js';

const infiniteModeStrategy = {
  id: DASH_MODE_TYPES.infinite,
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
