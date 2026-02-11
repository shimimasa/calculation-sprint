import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const titleScreen = {
  enter() {
    uiRenderer.showScreen('title');
    this.events = createEventRegistry('title');
    this.handleStageStart = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('stage-select');
    };
    this.handleFreePlay = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      gameState.playMode = 'free';
      gameState.selectedStageId = null;
      screenManager.changeScreen('settings');
    };
    this.handleDashRun = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      const nextScreen = domRefs.screens['dash-stage-select'] ? 'dash-stage-select' : 'dash-game';
      screenManager.changeScreen(nextScreen);
    };
    this.events.on(domRefs.title.startButton, 'click', this.handleStageStart);
    this.events.on(domRefs.title.freeButton, 'click', this.handleFreePlay);
    this.events.on(domRefs.title.dashButton, 'click', this.handleDashRun);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default titleScreen;
