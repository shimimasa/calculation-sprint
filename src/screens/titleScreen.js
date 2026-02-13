import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const titleScreen = {
  enter() {
    uiRenderer.showScreen('title');
    this.events = createEventRegistry('title');
    audioManager.syncSettings();
    if (domRefs.title.dashButton) {
      domRefs.title.dashButton.classList.add('primary-button');
      domRefs.title.dashButton.classList.remove('secondary-button');
    }
    this.handleDashRun = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      const nextScreen = domRefs.screens['dash-stage-select'] ? 'dash-stage-select' : 'dash-game';
      screenManager.changeScreen(nextScreen);
    };
    this.handleDashSettings = () => {
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('dash-settings', { backScreen: 'title' });
    };
    this.handleDashStats = () => {
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('dash-stats');
    };
    this.events.on(domRefs.title.dashButton, 'click', this.handleDashRun);
    this.events.on(domRefs.title.dashSettingsButton, 'click', this.handleDashSettings);
    this.events.on(domRefs.title.dashStatsButton, 'click', this.handleDashStats);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default titleScreen;
