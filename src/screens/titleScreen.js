import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';
import { isModeEnabled } from '../core/modeAvailability.js';

const titleScreen = {
  enter() {
    uiRenderer.showScreen('title');
    this.events = createEventRegistry('title');

    const isStageModeEnabled = isModeEnabled('stage');
    const isFreeModeEnabled = isModeEnabled('free');

    if (domRefs.title.startButton) {
      domRefs.title.startButton.hidden = !isStageModeEnabled;
      domRefs.title.startButton.disabled = !isStageModeEnabled;
    }
    if (domRefs.title.freeButton) {
      domRefs.title.freeButton.hidden = !isFreeModeEnabled;
      domRefs.title.freeButton.disabled = !isFreeModeEnabled;
    }
    if (domRefs.title.dashButton) {
      domRefs.title.dashButton.classList.add('primary-button');
      domRefs.title.dashButton.classList.remove('secondary-button');
    }

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
    if (isStageModeEnabled) {
      this.events.on(domRefs.title.startButton, 'click', this.handleStageStart);
    }
    if (isFreeModeEnabled) {
      this.events.on(domRefs.title.freeButton, 'click', this.handleFreePlay);
    }
    this.events.on(domRefs.title.dashButton, 'click', this.handleDashRun);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default titleScreen;
