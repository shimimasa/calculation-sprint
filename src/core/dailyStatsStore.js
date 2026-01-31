const STORAGE_KEY = 'calcSprint.daily.v1';

const DEFAULT_WRONG_BY_MODE = Object.freeze({
  add: 0,
  sub: 0,
  mul: 0,
  div: 0,
});

const createEmptyRecord = () => ({
  bestAvgSec: null,
  bestDistanceM: null,
  attemptTotal: 0,
  wrongTotal: 0,
  wrongByMode: { ...DEFAULT_WRONG_BY_MODE },
  sessions: 0,
});

const normalizeRecord = (record) => {
  const base = createEmptyRecord();
  if (!record || typeof record !== 'object') {
    return base;
  }
  return {
    bestAvgSec: typeof record.bestAvgSec === 'number' ? record.bestAvgSec : null,
    bestDistanceM: typeof record.bestDistanceM === 'number' ? record.bestDistanceM : null,
    attemptTotal: Number.isFinite(record.attemptTotal) ? record.attemptTotal : 0,
    wrongTotal: Number.isFinite(record.wrongTotal) ? record.wrongTotal : 0,
    wrongByMode: {
      ...DEFAULT_WRONG_BY_MODE,
      ...(record.wrongByMode || {}),
    },
    sessions: Number.isFinite(record.sessions) ? record.sessions : 0,
  };
};

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch (error) {
    return {};
  }
};

const writeAll = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const dailyStatsStore = {
  getAll() {
    return readAll();
  },
  get(dateKey) {
    const all = readAll();
    if (!all[dateKey]) {
      return null;
    }
    return normalizeRecord(all[dateKey]);
  },
  upsert(dateKey, sessionStats) {
    const all = readAll();
    const current = normalizeRecord(all[dateKey]);
    const wrongByMode = {
      ...DEFAULT_WRONG_BY_MODE,
      ...(sessionStats?.wrongByMode || {}),
    };

    const updated = {
      ...current,
      attemptTotal: current.attemptTotal + (sessionStats?.attemptTotal || 0),
      wrongTotal: current.wrongTotal + (sessionStats?.wrongTotal || 0),
      wrongByMode: {
        add: current.wrongByMode.add + wrongByMode.add,
        sub: current.wrongByMode.sub + wrongByMode.sub,
        mul: current.wrongByMode.mul + wrongByMode.mul,
        div: current.wrongByMode.div + wrongByMode.div,
      },
      sessions: current.sessions + 1,
    };

    const avgSec = sessionStats?.avgSec || 0;
    if (avgSec > 0) {
      if (updated.bestAvgSec === null || avgSec < updated.bestAvgSec) {
        updated.bestAvgSec = avgSec;
      }
    }
    const distanceM = Number.isFinite(sessionStats?.distanceM)
      ? sessionStats.distanceM
      : 0;
    if (distanceM > 0) {
      if (updated.bestDistanceM === null || distanceM > updated.bestDistanceM) {
        updated.bestDistanceM = distanceM;
      }
    }

    all[dateKey] = updated;
    writeAll(all);
    return updated;
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

export default dailyStatsStore;
