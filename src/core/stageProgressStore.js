const STORAGE_KEY = 'calcSprint.stageProgress.v1';

const buildDefaultProgress = () => ({
  clearedStageIds: [],
  lastPlayedStageId: null,
  updatedAt: new Date().toISOString(),
});

const parseProgress = (raw) => {
  if (!raw) {
    return buildDefaultProgress();
  }
  try {
    const parsed = JSON.parse(raw);
    const clearedStageIds = Array.isArray(parsed.clearedStageIds)
      ? parsed.clearedStageIds.filter((id) => typeof id === 'string')
      : [];
    const lastPlayedStageId = typeof parsed.lastPlayedStageId === 'string'
      ? parsed.lastPlayedStageId
      : null;
    const updatedAt = typeof parsed.updatedAt === 'string'
      ? parsed.updatedAt
      : new Date().toISOString();
    return { clearedStageIds, lastPlayedStageId, updatedAt };
  } catch (error) {
    return buildDefaultProgress();
  }
};

const saveProgress = (progress) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    // ignore storage failures
  }
};

const stageProgressStore = {
  getProgress() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return parseProgress(raw);
    } catch (error) {
      return buildDefaultProgress();
    }
  },
  markCleared(stageId) {
    if (!stageId) {
      return;
    }
    const progress = this.getProgress();
    const clearedStageIds = progress.clearedStageIds.includes(stageId)
      ? progress.clearedStageIds
      : [...progress.clearedStageIds, stageId];
    const updated = {
      clearedStageIds,
      lastPlayedStageId: stageId,
      updatedAt: new Date().toISOString(),
    };
    saveProgress(updated);
  },
  isCleared(stageId) {
    if (!stageId) {
      return false;
    }
    const progress = this.getProgress();
    return progress.clearedStageIds.includes(stageId);
  },
  reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // ignore storage failures
    }
  },
};

export default stageProgressStore;
