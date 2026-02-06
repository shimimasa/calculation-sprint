import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const dashGameScreen = {
  enter() {
    uiRenderer.showScreen('dash-game');
    this.events = createEventRegistry('dash-game');
    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };
    this.events.on(domRefs.dashGame.backButton, 'click', this.handleBack);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashGameScreen;
