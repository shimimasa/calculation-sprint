import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import dashSettingsStore from '../core/dashSettingsStore.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const dashSettingsScreen = {
  enter(prevScreenName, params = {}) {
    uiRenderer.showScreen('dash-settings');
    this.events = createEventRegistry('dash-settings');
    this.backScreen = typeof params.backScreen === 'string' ? params.backScreen : 'title';

    const settings = dashSettingsStore.get();
    audioManager.syncSettings();

    if (domRefs.dashSettings.bgmToggle) {
      domRefs.dashSettings.bgmToggle.checked = settings.bgmEnabled;
    }
    if (domRefs.dashSettings.sfxToggle) {
      domRefs.dashSettings.sfxToggle.checked = settings.sfxEnabled;
    }
    if (domRefs.dashSettings.difficultySelect) {
      domRefs.dashSettings.difficultySelect.value = settings.difficulty;
    }

    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen(this.backScreen || 'title');
    };
    this.handleBgmToggle = (event) => {
      const bgmEnabled = Boolean(event.currentTarget?.checked);
      audioManager.setBgmEnabled(bgmEnabled);
    };
    this.handleSfxToggle = (event) => {
      const sfxEnabled = Boolean(event.currentTarget?.checked);
      const saved = audioManager.setSfxEnabled(sfxEnabled);
      if (saved.sfxEnabled) {
        audioManager.playSfx('sfx_click');
      }
    };
    this.handleDifficultyChange = (event) => {
      const difficulty = event.currentTarget?.value;
      dashSettingsStore.save({ difficulty });
      audioManager.playSfx('sfx_click');
    };

    this.events.on(domRefs.dashSettings.backButton, 'click', this.handleBack);
    this.events.on(domRefs.dashSettings.bgmToggle, 'change', this.handleBgmToggle);
    this.events.on(domRefs.dashSettings.sfxToggle, 'change', this.handleSfxToggle);
    this.events.on(domRefs.dashSettings.difficultySelect, 'change', this.handleDifficultyChange);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashSettingsScreen;
