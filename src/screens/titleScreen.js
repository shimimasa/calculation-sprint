import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';

const titleScreen = {
  enter() {
    uiRenderer.showScreen('title');
    this.handleStart = () => {
      screenManager.changeScreen('stage');
    };
    domRefs.title.startButton.addEventListener('click', this.handleStart);
  },
  render() {},
  exit() {
    if (this.handleStart) {
      domRefs.title.startButton.removeEventListener('click', this.handleStart);
    }
  },
};

export default titleScreen;
