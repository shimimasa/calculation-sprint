import { DASH_MODE_TYPES } from './modeTypes.js';
import { toDashStageId } from '../../../features/dashStages.js';
import {
  timeBonusOnCorrect,
  timeBonusOnDefeat,
  timePenaltyOnWrong,
  timePenaltyOnCollision,
} from '../../../features/dashConstants.js';

const GOAL_DISTANCE_M = 1000;

const computeRank = ({ cleared, accuracy, hits }) => {
  if (!cleared) {
    return 'C';
  }
  if (accuracy >= 95 && hits <= 1) {
    return 'S';
  }
  if (accuracy >= 85 && hits <= 3) {
    return 'A';
  }
  if (accuracy >= 70) {
    return 'B';
  }
  return 'C';
};

const goalRunModeStrategy = {
  id: DASH_MODE_TYPES.goalRun,
  timePolicy: {
    onCorrectMs: timeBonusOnCorrect,
    onDefeatMs: timeBonusOnDefeat,
    onWrongMs: -timePenaltyOnWrong,
    onCollisionMs: -timePenaltyOnCollision,
  },
  initRun() {
    return {
      goalDistanceM: GOAL_DISTANCE_M,
    };
  },
  checkEnd({ distanceM, timeLeftMs, modeRuntime }) {
    const goalDistanceM = Number(modeRuntime?.goalDistanceM) || GOAL_DISTANCE_M;
    if (Number.isFinite(distanceM) && distanceM >= goalDistanceM) {
      return { ended: true, endReason: 'goal', cleared: true };
    }
    if (Number.isFinite(timeLeftMs) && timeLeftMs <= 0) {
      return { ended: true, endReason: 'timeup', cleared: false };
    }
    return { ended: false, endReason: null, cleared: false };
  },
  getHudState({ distanceM, modeRuntime }) {
    const goalDistanceM = Number(modeRuntime?.goalDistanceM) || GOAL_DISTANCE_M;
    const safeDistance = Number.isFinite(distanceM) ? distanceM : 0;
    const progress = goalDistanceM > 0 ? Math.max(0, Math.min(safeDistance / goalDistanceM, 1)) : 0;
    return {
      distanceLabel: '進ちょく',
      distanceText: `${safeDistance.toFixed(1)} / ${goalDistanceM.toFixed(0)}`,
      distanceUnit: 'm',
      progressRatio: progress,
      progressText: `GOAL ${Math.round(progress * 100)}%`,
      hideNextArea: true,
    };
  },
  onBeforeEnd({ endReason }) {
    if (endReason === 'goal') {
      return {
        cueText: 'GOAL!',
        sfxId: 'sfx_goal',
        delayMs: 1000,
        visualEffect: 'goal-clear',
        visualDurationMs: 1000,
      };
    }
    return null;
  },
  buildResult({ runId, distanceM, correctCount, wrongCount, defeatedCount, maxStreak, timeLeftMs, stageId, endReason, initialTimeLimitMs, modeRuntime, hits }) {
    const safeTimeLeft = Math.max(0, Number(timeLeftMs) || 0);
    const totalAnswered = (Number(correctCount) || 0) + (Number(wrongCount) || 0);
    const accuracy = totalAnswered > 0 ? (Number(correctCount) / totalAnswered) * 100 : 0;
    const cleared = endReason === 'goal';
    const goalDistanceM = Number(modeRuntime?.goalDistanceM) || GOAL_DISTANCE_M;
    const elapsedMs = Math.max(0, (Number(initialTimeLimitMs) || 0) - safeTimeLeft);
    const hitCount = Number(hits) || 0;
    return {
      runId,
      mode: DASH_MODE_TYPES.goalRun,
      distanceM,
      correctCount,
      wrongCount,
      defeatedCount,
      maxStreak,
      hits: hitCount,
      timeLeftMs: safeTimeLeft,
      stageId: toDashStageId(stageId),
      endReason,
      retired: false,
      cleared,
      goalDistanceM,
      clearTimeMs: cleared ? elapsedMs : null,
      rank: computeRank({ cleared, accuracy, hits: hitCount }),
    };
  },
};

export default goalRunModeStrategy;
