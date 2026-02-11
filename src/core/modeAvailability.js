export const ENABLED_MODES = Object.freeze({
  dash: true,
  stage: false,
  free: false,
});

export const BLOCKED_SCREENS = new Set([
  'stage-select',
  'settings',
  'game',
  'result',
]);

export const isModeEnabled = (modeName) => ENABLED_MODES[modeName] === true;

export const isScreenBlocked = (screenName) => BLOCKED_SCREENS.has(screenName);

export const resolveSafeScreen = (screenRegistry) => {
  if (screenRegistry?.['dash-stage-select']) {
    return 'dash-stage-select';
  }
  return 'title';
};
