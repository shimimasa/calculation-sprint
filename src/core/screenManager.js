import { isScreenBlocked, resolveSafeScreen } from './modeAvailability.js';
import { perfLog } from './perf.js';

let currentScreen = null;
let currentName = null;
const screens = {};
let isTransitioning = false;

// ADR-004 Phase0補修: Scope DOM queries under the calc-sprint root to avoid collisions when embedded in a portal.
const getAppRoot = () => document.querySelector('.calc-sprint') ?? document;

let prevHtmlOverflow = null;
let prevBodyOverflow = null;
const DASH_DEBUG_QUERY_KEY = 'dashDebug';
const DASH_DEBUG_LEGACY_QUERY_KEY = 'dashDebugRunner';
const DASH_DEBUG_STORAGE_KEY = 'dashDebugRunner';
const isDashDebugRunnerEnabled = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const queryValue = searchParams.get(DASH_DEBUG_QUERY_KEY) ?? searchParams.get(DASH_DEBUG_LEGACY_QUERY_KEY);
  const storageValue = window.localStorage?.getItem(DASH_DEBUG_STORAGE_KEY);
  return queryValue === '1' || storageValue === '1' || window.__DASH_DEBUG_RUNNER === true;
};
const setGlobalScrollLocked = (locked) => {
  const html = document.documentElement;
  const body = document.body;
  if (!html || !body) {
    return;
  }

  if (locked) {
    if (prevHtmlOverflow === null) {
      prevHtmlOverflow = html.style.overflow;
    }
    if (prevBodyOverflow === null) {
      prevBodyOverflow = body.style.overflow;
    }
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return;
  }

  if (prevHtmlOverflow !== null) {
    html.style.overflow = prevHtmlOverflow;
    prevHtmlOverflow = null;
  }
  if (prevBodyOverflow !== null) {
    body.style.overflow = prevBodyOverflow;
    prevBodyOverflow = null;
  }
};

const setScreenVisibility = (nextName) => {
  const targetId = `${nextName}-screen`;
  getAppRoot().querySelectorAll('.screen').forEach((screen) => {
    const isActive = screen.id === targetId;
    screen.classList.toggle('is-active', isActive);
    screen.toggleAttribute('hidden', !isActive);
    screen.setAttribute('aria-hidden', String(!isActive));
  });
  // Dash Run (PC) needs strict scroll lock to avoid viewport contract breaking.
  setGlobalScrollLocked(nextName === 'dash-game');
};

const screenManager = {
  registerScreens(map) {
    Object.entries(map).forEach(([name, screen]) => {
      screens[name] = screen;
    });
  },
  changeScreen(nextName, params = {}) {
    const targetName = isScreenBlocked(nextName) ? resolveSafeScreen(screens) : nextName;
    if (isTransitioning || !screens[targetName]) {
      return;
    }
    if (isDashDebugRunnerEnabled() && (String(targetName).startsWith('dash') || String(currentName).startsWith('dash'))) {
      window.__DASH_DEBUG_LAST_SCREEN_CHANGE = {
        at: window.performance.now(),
        from: currentName,
        to: targetName,
      };
      console.groupCollapsed('[dash-debug] changeScreen ->', targetName);
      console.trace();
      console.log('params', params);
      console.log('from', currentName);
      console.groupEnd();
    }
    isTransitioning = true;
    const prevName = currentName;
    perfLog('screen.change.start', { from: prevName ?? 'none', to: targetName });
    if (currentScreen && typeof currentScreen.exit === 'function') {
      currentScreen.exit(targetName);
    }
    currentScreen = screens[targetName];
    currentName = targetName;
    setScreenVisibility(targetName);
    if (currentScreen && typeof currentScreen.enter === 'function') {
      currentScreen.enter(prevName, params);
    }
    isTransitioning = false;
  },
  update(dt) {
    if (currentScreen && typeof currentScreen.update === 'function') {
      currentScreen.update(dt);
    }
  },
  render() {
    if (currentScreen && typeof currentScreen.render === 'function') {
      currentScreen.render();
    }
  },
};

export default screenManager;
