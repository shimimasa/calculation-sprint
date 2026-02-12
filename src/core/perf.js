const PERF_STORAGE_KEY = 'calc-sprint::perf::enabled';
const PRELOAD_FRAME_WAIT_STORAGE_KEY = 'calc-sprint::perf::stage-frame-wait';

const readFlagFromStorage = (key) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  const value = window.localStorage.getItem(key);
  return value === '1' || value === 'true';
};

const hasQueryFlag = (name) => {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get(name) === '1';
};

export const isPerfEnabled = () => hasQueryFlag('perf') || readFlagFromStorage(PERF_STORAGE_KEY);

export const isStageFrameWaitEnabled = () => (
  hasQueryFlag('stageFrameWait')
  || readFlagFromStorage(PRELOAD_FRAME_WAIT_STORAGE_KEY)
);

export const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const perfLog = (label, data = {}) => {
  if (!isPerfEnabled()) {
    return;
  }
  console.debug(`[perf] ${label}`, {
    t: Number(perfNow().toFixed(2)),
    ...data,
  });
};

export const perfFlagKeys = Object.freeze({
  PERF_STORAGE_KEY,
  PRELOAD_FRAME_WAIT_STORAGE_KEY,
});
