import {
  DEFAULT_SCHEMA_VERSION,
  STORE_NAMES,
  makeStoreKey,
  resolveProfileId,
} from './storageKeys.js';
import { DASH_STAGE_IDS, toDashStageId } from '../features/dashStages.js';
import { DEFAULT_DASH_MODE, normalizeDashModeId } from '../game/dash/modes/modeTypes.js';

const DASH_STATS_SCHEMA_VERSION = 'v2';
const MAX_HISTORY = 20;
const VALID_END_REASONS = new Set(['collision', 'timeup', 'goal', 'manual']);

const readFromStorage = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
};

const writeToStorage = (storageKey, data) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    return null;
  }
};

const normalizeEndReason = (endReason) => (
  typeof endReason === 'string' && VALID_END_REASONS.has(endReason) ? endReason : 'unknown'
);

const normalizeSession = (session) => ({
  runId: typeof session?.runId === 'string' ? session.runId : null,
  mode: normalizeDashModeId(session?.mode ?? DEFAULT_DASH_MODE),
  distanceM: Number.isFinite(session?.distanceM) ? session.distanceM : 0,
  score: Number.isFinite(session?.score) ? session.score : (Number.isFinite(session?.distanceM) ? session.distanceM : 0),
  correctCount: Number.isFinite(session?.correctCount) ? session.correctCount : 0,
  wrongCount: Number.isFinite(session?.wrongCount) ? session.wrongCount : 0,
  defeatedCount: Number.isFinite(session?.defeatedCount) ? session.defeatedCount : 0,
  maxStreak: Number.isFinite(session?.maxStreak) ? session.maxStreak : 0,
  timeLeftMs: Number.isFinite(session?.timeLeftMs) ? session.timeLeftMs : 0,
  stageId: toDashStageId(session?.stageId),
  endReason: normalizeEndReason(session?.endReason),
  retired: Boolean(session?.retired ?? session?.endReason !== 'timeup'),
  endedAt: typeof session?.endedAt === 'string' ? session.endedAt : new Date().toISOString(),
  cleared: Boolean(session?.cleared),
<<<<<<< codex/summarize-plan-goal.md-for-pr1-bxf68q
  goalDistanceM: normalizeDashModeId(session?.mode ?? DEFAULT_DASH_MODE) === 'goalRun'
    ? (Number.isFinite(session?.goalDistanceM) ? session.goalDistanceM : 1000)
    : (Number.isFinite(session?.goalDistanceM) ? session.goalDistanceM : null),
  clearTimeMs: Number.isFinite(session?.clearTimeMs) ? session.clearTimeMs : null,
  rank: typeof session?.rank === 'string' ? session.rank : null,
  hits: Number.isFinite(session?.hits) ? session.hits : 0,
  totalScore: Number.isFinite(session?.totalScore) ? session.totalScore : (Number.isFinite(session?.score) ? session.score : 0),
  combo: Number.isFinite(session?.combo) ? session.combo : 0,
  maxCombo: Number.isFinite(session?.maxCombo) ? session.maxCombo : 0,
=======
  goalDistanceM: Number.isFinite(session?.goalDistanceM) ? session.goalDistanceM : null,
  clearTimeMs: Number.isFinite(session?.clearTimeMs) ? session.clearTimeMs : null,
  rank: typeof session?.rank === 'string' ? session.rank : null,
  hits: Number.isFinite(session?.hits) ? session.hits : 0,
>>>>>>> 他モード削除
  schemaVersion: DASH_STATS_SCHEMA_VERSION,
});

const createEmptyAggregate = () => {
  const stageBest = {};
  const stagePlayCount = {};
  DASH_STAGE_IDS.forEach((stageId) => {
    stageBest[stageId] = 0;
    stagePlayCount[stageId] = 0;
  });
  return {
    bestScore: 0,
    stageBest,
    stagePlayCount,
  };
};


const createEmptyModeAggregate = () => {
  const bestTimeByStage = {};
  const clearCountByStage = {};
  const playCountByStage = {};
  DASH_STAGE_IDS.forEach((stageId) => {
    bestTimeByStage[stageId] = null;
    clearCountByStage[stageId] = 0;
    playCountByStage[stageId] = 0;
  });
<<<<<<< codex/summarize-plan-goal.md-for-pr1-bxf68q
  const bestScoreByStage = {};
  DASH_STAGE_IDS.forEach((stageId) => {
    bestScoreByStage[stageId] = 0;
  });
=======
>>>>>>> 他モード削除
  return {
    goalRun: {
      bestTimeByStage,
      clearCountByStage,
      playCountByStage,
    },
<<<<<<< codex/summarize-plan-goal.md-for-pr1-bxf68q
    scoreAttack60: {
      bestScoreByStage,
    },
=======
>>>>>>> 他モード削除
  };
};

const computeAggregate = (history) => {
  const aggregate = createEmptyAggregate();
  const modes = createEmptyModeAggregate();
  history.forEach((session) => {
    const score = Number.isFinite(session.score) ? session.score : session.distanceM;
    aggregate.bestScore = Math.max(aggregate.bestScore, score);
    const stageId = toDashStageId(session.stageId);
    aggregate.stageBest[stageId] = Math.max(aggregate.stageBest[stageId] ?? 0, score);
    aggregate.stagePlayCount[stageId] = (aggregate.stagePlayCount[stageId] ?? 0) + 1;

    if (session.mode === 'goalRun') {
      const modeAgg = modes.goalRun;
      modeAgg.playCountByStage[stageId] = (modeAgg.playCountByStage[stageId] ?? 0) + 1;
      if (session.cleared) {
        modeAgg.clearCountByStage[stageId] = (modeAgg.clearCountByStage[stageId] ?? 0) + 1;
        const currentBest = modeAgg.bestTimeByStage[stageId];
        const clearTimeMs = Number.isFinite(session.clearTimeMs) ? session.clearTimeMs : null;
        if (clearTimeMs !== null && (currentBest === null || clearTimeMs < currentBest)) {
          modeAgg.bestTimeByStage[stageId] = clearTimeMs;
        }
      }
    }
<<<<<<< codex/summarize-plan-goal.md-for-pr1-bxf68q

    if (session.mode === 'scoreAttack60') {
      const score = Number.isFinite(session.score) ? session.score : 0;
      modes.scoreAttack60.bestScoreByStage[stageId] = Math.max(
        modes.scoreAttack60.bestScoreByStage[stageId] ?? 0,
        score,
      );
    }
=======
>>>>>>> 他モード削除
  });
  return {
    ...aggregate,
    modes,
  };
};

const normalizeStats = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const history = Array.isArray(source.history)
    ? source.history.map((entry) => normalizeSession(entry)).slice(0, MAX_HISTORY)
    : [];
  const aggregate = computeAggregate(history);
  return {
    schemaVersion: DASH_STATS_SCHEMA_VERSION,
    history,
    aggregate,
    lastRunId: typeof source.lastRunId === 'string' ? source.lastRunId : null,
    lastSession: history[0] ?? null,
  };
};

const migrateFromLegacySessionIfNeeded = (resolvedProfileId, stats) => {
  if (stats.history.length > 0) {
    return stats;
  }
  const legacyKey = makeStoreKey(resolvedProfileId, STORE_NAMES.dashSession);
  const legacySession = readFromStorage(legacyKey);
  if (!legacySession) {
    return stats;
  }
  const migratedSession = normalizeSession(legacySession);
  const migrated = normalizeStats({ history: [migratedSession], lastRunId: migratedSession.runId });
  writeToStorage(makeStoreKey(resolvedProfileId, STORE_NAMES.dashStats), migrated);
  return migrated;
};

const dashStatsStore = {
  getStats(profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const storageKey = makeStoreKey(resolvedProfileId, STORE_NAMES.dashStats);
    const stats = normalizeStats(readFromStorage(storageKey));
    return migrateFromLegacySessionIfNeeded(resolvedProfileId, stats);
  },
  getSession(profileId) {
    const stats = this.getStats(profileId);
    return stats.lastSession;
  },
  saveSession(session, profileId) {
    return this.finalizeRun(session, profileId);
  },
  finalizeRun(session, profileId) {
    const resolvedProfileId = resolveProfileId(profileId);
    const normalized = normalizeSession({
      ...session,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      endedAt: session?.endedAt ?? new Date().toISOString(),
    });
    const statsKey = makeStoreKey(resolvedProfileId, STORE_NAMES.dashStats);
    const sessionKey = makeStoreKey(resolvedProfileId, STORE_NAMES.dashSession);
    const current = this.getStats(resolvedProfileId);
    if (normalized.runId && current.lastRunId && normalized.runId === current.lastRunId) {
      return current.lastSession;
    }

    const history = [normalized, ...current.history]
      .slice(0, MAX_HISTORY)
      .map((entry) => normalizeSession(entry));
    const next = {
      schemaVersion: DASH_STATS_SCHEMA_VERSION,
      history,
      aggregate: computeAggregate(history),
      lastRunId: normalized.runId,
      lastSession: normalized,
    };
    writeToStorage(statsKey, next);
    writeToStorage(sessionKey, normalized);
    return normalized;
  },
};

export default dashStatsStore;
