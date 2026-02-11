import { isScreenBlocked, resolveSafeScreen } from './modeAvailability.js';

let currentScreen = null;
let currentName = null;
const screens = {};
let isTransitioning = false;

// ADR-004 Phase0補修: Scope DOM queries under the calc-sprint root to avoid collisions when embedded in a portal.
const getAppRoot = () => document.querySelector('.calc-sprint') ?? document;

let prevHtmlOverflow = null;
let prevBodyOverflow = null;
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
    isTransitioning = true;
    const prevName = currentName;
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
