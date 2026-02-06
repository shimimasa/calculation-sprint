import screenManager from './core/screenManager.js';
import profileSelectScreen from './screens/profileSelectScreen.js';
import titleScreen from './screens/titleScreen.js';
import stageSelectScreen from './screens/stageSelectScreen.js';
import settingsScreen from './screens/settingsScreen.js';
import dashGameScreen from './screens/dashGameScreen.js';
import dashResultScreen from './screens/dashResultScreen.js';
import gameScreen from './screens/gameScreen.js';
import resultScreen from './screens/resultScreen.js';
import gameState from './core/gameState.js';
import { applyTestOverrides } from './core/testFlags.js';

const screens = {
  'profile-select': profileSelectScreen,
  title: titleScreen,
  'stage-select': stageSelectScreen,
  settings: settingsScreen,
  'dash-game': dashGameScreen,
  'dash-result': dashResultScreen,
  game: gameScreen,
  result: resultScreen,
};

const init = () => {
  screenManager.registerScreens(screens);
  const testConfig = applyTestOverrides(gameState);
  screenManager.changeScreen('profile-select');
  // Debug-only helpers for Playwright smoke screenshots.
  // This is intentionally minimal and only used when called explicitly.
  window.__debug = window.__debug || {};
  window.__debug.showStageSelect = () => {
    screenManager.changeScreen('stage-select');
  };
  window.__debug.showResultStageSample = () => {
    gameState.playMode = 'stage';
    gameState.selectedStageId = 'w1-1';
    screenManager.changeScreen('result');
  };
  if (testConfig?.enabled) {
    window.__testConfig = testConfig;
  }
};

let lastTime = performance.now();
const loop = (time) => {
  const dt = time - lastTime;
  lastTime = time;
  screenManager.update(dt);
  screenManager.render();
  window.requestAnimationFrame(loop);
};

init();
window.requestAnimationFrame(loop);
