import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';

const titleScreen = {
  enter() {
    uiRenderer.showScreen('title');
    this.handleStageStart = () => {
      screenManager.changeScreen('stage-select');
    };
    this.handleFreePlay = () => {
      gameState.playMode = 'free';
      gameState.selectedStageId = null;
      screenManager.changeScreen('settings');
    };
    domRefs.title.startButton.addEventListener('click', this.handleStageStart);
    domRefs.title.freeButton.addEventListener('click', this.handleFreePlay);
  },
  render() {},
  exit() {
    if (this.handleStageStart) {
      domRefs.title.startButton.removeEventListener('click', this.handleStageStart);
    }
    if (this.handleFreePlay) {
      domRefs.title.freeButton.removeEventListener('click', this.handleFreePlay);
    }
  },
};

export default titleScreen;
