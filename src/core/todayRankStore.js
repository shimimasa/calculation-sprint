const STORAGE_KEY = 'calcSprint.rank.distance.today.v1';

const normalizeTop = (top) => {
  if (!Array.isArray(top)) {
    return [];
  }
  return top.filter((value) => Number.isFinite(value) && value > 0);
};

const read = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      dateKey: typeof parsed.dateKey === 'string' ? parsed.dateKey : null,
      top: normalizeTop(parsed.top),
    };
  } catch (error) {
    return null;
  }
};

const write = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const todayRankStore = {
  get(dateKey) {
    const stored = read();
    if (!stored || stored.dateKey !== dateKey) {
      return { dateKey, top: [] };
    }
    return { dateKey, top: stored.top };
  },
  update(dateKey, distanceM) {
    const current = this.get(dateKey);
    const nextTop = [...current.top, distanceM]
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a)
      .slice(0, 3);
    const next = { dateKey, top: nextTop };
    write(next);
    return next;
  },
};

export default todayRankStore;
