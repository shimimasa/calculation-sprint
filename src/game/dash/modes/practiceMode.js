import { DASH_MODE_TYPES } from './modeTypes.js';
import { toDashStageId } from '../../../features/dashStages.js';

export const PRACTICE_GOAL_CORRECT = 10;
// 実質「時間切れなし」。エンジンは timeLeftMs 減算を前提とするため十分大きな有限値を使う。
const PRACTICE_TIME_LIMIT_MS = 99 * 60 * 1000;

const practiceModeStrategy = {
  id: DASH_MODE_TYPES.practice,
  timePolicy: {
    onCorrectMs: 0,
    onDefeatMs: 0,
    onWrongMs: 0,
    onCollisionMs: 0,
  },
  initRun() {
    return {
      correctTotal: 0,
      goalCorrect: PRACTICE_GOAL_CORRECT,
    };
  },
  getInitialTimeLimitMs() {
    return PRACTICE_TIME_LIMIT_MS;
  },
  onAnswer({ isCorrect, modeRuntime }) {
    if (!modeRuntime || typeof modeRuntime !== 'object') {
      return;
    }
    if (isCorrect) {
      modeRuntime.correctTotal = (Number(modeRuntime.correctTotal) || 0) + 1;
    }
  },
  checkEnd({ timeLeftMs, modeRuntime }) {
    const goalCorrect = Number(modeRuntime?.goalCorrect) || PRACTICE_GOAL_CORRECT;
    if ((Number(modeRuntime?.correctTotal) || 0) >= goalCorrect) {
      return { ended: true, endReason: 'goal', cleared: true };
    }
    if (Number.isFinite(timeLeftMs) && timeLeftMs <= 0) {
      return { ended: true, endReason: 'timeout', cleared: false };
    }
    return { ended: false, endReason: null, cleared: false };
  },
  getHudState({ modeRuntime }) {
    const goalCorrect = Number(modeRuntime?.goalCorrect) || PRACTICE_GOAL_CORRECT;
    const correctTotal = Math.min(Number(modeRuntime?.correctTotal) || 0, goalCorrect);
    const progress = goalCorrect > 0 ? Math.max(0, Math.min(correctTotal / goalCorrect, 1)) : 0;
    return {
      distanceLabel: 'せいかい',
      distanceText: `${correctTotal} / ${goalCorrect}`,
      distanceUnit: 'もん',
      progressRatio: progress,
      progressText: `ゴールまで あと${Math.max(0, goalCorrect - correctTotal)}もん`,
      hideNextArea: true,
    };
  },
  onBeforeEnd({ endReason }) {
    if (endReason === 'goal') {
      return {
        cueText: 'よくがんばった！',
        sfxId: 'sfx_goal',
        delayMs: 1000,
        visualEffect: 'goal-clear',
        visualDurationMs: 1000,
      };
    }
    return null;
  },
  buildResult({ runId, distanceM, correctCount, wrongCount, defeatedCount, maxStreak, timeLeftMs, stageId, endReason, hits }) {
    return {
      runId,
      mode: DASH_MODE_TYPES.practice,
      distanceM,
      correctCount,
      wrongCount,
      defeatedCount,
      maxStreak,
      hits: Number(hits) || 0,
      timeLeftMs: Math.max(0, Number(timeLeftMs) || 0),
      stageId: toDashStageId(stageId),
      endReason,
      retired: endReason === 'retired',
      cleared: endReason === 'goal',
    };
  },
};

export default practiceModeStrategy;
