import screenManager from './core/screenManager.js';
import titleScreen from './screens/titleScreen.js';
import settingsScreen from './screens/settingsScreen.js';
import gameScreen from './screens/gameScreen.js';
import resultScreen from './screens/resultScreen.js';

const screens = {
  title: titleScreen,
  settings: settingsScreen,
  game: gameScreen,
  result: resultScreen,
};

const init = () => {
  screenManager.registerScreens(screens);
  screenManager.changeScreen('title');
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
