export const getTestConfig = () => {
  if (typeof window === 'undefined') {
    return { enabled: false, timeLimit: null };
  }
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('test') === '1';
  const timeLimitParam = params.get('timeLimit');
  const timeLimit = timeLimitParam ? Number(timeLimitParam) : null;
  return { enabled, timeLimit };
};

export const applyTestOverrides = (state) => {
  const config = getTestConfig();
  if (!config.enabled) {
    return config;
  }
  const resolvedLimit = Number.isFinite(config.timeLimit) && config.timeLimit > 0
    ? Math.floor(config.timeLimit)
    : 5;
  state.timeLimit = resolvedLimit;
  state.timeLeft = resolvedLimit;
  return { ...config, timeLimit: resolvedLimit };
};
