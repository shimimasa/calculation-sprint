let currentScreen = null;
let currentName = null;
const screens = {};
let isTransitioning = false;

const screenManager = {
  registerScreens(map) {
    Object.entries(map).forEach(([name, screen]) => {
      screens[name] = screen;
    });
  },
  changeScreen(nextName, params = {}) {
    if (isTransitioning || !screens[nextName]) {
      return;
    }
    isTransitioning = true;
    const prevName = currentName;
    if (currentScreen && typeof currentScreen.exit === 'function') {
      currentScreen.exit(nextName);
    }
    currentScreen = screens[nextName];
    currentName = nextName;
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
