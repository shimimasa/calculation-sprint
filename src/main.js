import screenManager from './core/screenManager.js';
import titleScreen from './screens/titleScreen.js';
import stageSelectScreen from './screens/stageSelectScreen.js';
import settingsScreen from './screens/settingsScreen.js';
import gameScreen from './screens/gameScreen.js';
import resultScreen from './screens/resultScreen.js';
import gameState from './core/gameState.js';

const screens = {
  title: titleScreen,
  'stage-select': stageSelectScreen,
  settings: settingsScreen,
  game: gameScreen,
  result: resultScreen,
};

const init = () => {
  screenManager.registerScreens(screens);
  screenManager.changeScreen('title');
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
