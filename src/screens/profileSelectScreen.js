import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import audioManager from '../core/audioManager.js';
import { LAST_PROFILE_ID_KEY, LEGACY_LAST_PROFILE_ID_KEYS } from '../core/storageKeys.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const PROFILE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const PROFILE_THEME_MAP = ['plus', 'minus', 'multi', 'divide', 'mix', 'plus', 'minus', 'multi'];

const loadLastProfileId = () => {
  const stored = window.localStorage.getItem(LAST_PROFILE_ID_KEY);
  if (stored && PROFILE_IDS.includes(stored)) {
    return stored;
  }
  for (const legacyKey of LEGACY_LAST_PROFILE_ID_KEYS) {
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy && PROFILE_IDS.includes(legacy)) {
      window.localStorage.setItem(LAST_PROFILE_ID_KEY, legacy);
      return legacy;
    }
  }
  return PROFILE_IDS[0];
};

const profileSelectScreen = {
  enter() {
    uiRenderer.showScreen('profile-select');
    this.events = createEventRegistry('profile-select');
    this.selectedProfileId = loadLastProfileId();
    this.handleProfileClick = (event) => {
      const button = event.currentTarget;
      const profileId = button?.dataset?.profileId;
      if (!profileId) {
        return;
      }
      audioManager.playSfx('sfx_click');
      this.selectProfile(profileId);
    };
    this.handleContinue = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      const nextProfileId = this.selectedProfileId || PROFILE_IDS[0];
      gameState.profileId = nextProfileId;
      window.localStorage.setItem(LAST_PROFILE_ID_KEY, nextProfileId);
      screenManager.changeScreen('title');
    };
    domRefs.profileSelect.buttons.forEach((button, index) => {
      const theme = PROFILE_THEME_MAP[index] ?? 'mix';
      button.dataset.profileTheme = theme;
      button.classList.add('profile-select-button--character');
      this.events.on(button, 'click', this.handleProfileClick);
    });
    this.events.on(domRefs.profileSelect.continueButton, 'click', this.handleContinue);
    this.selectProfile(this.selectedProfileId);
  },
  selectProfile(profileId) {
    this.selectedProfileId = profileId;
    domRefs.profileSelect.buttons.forEach((button) => {
      const isSelected = button.dataset.profileId === profileId;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
    domRefs.profileSelect.selectedLabel.textContent = profileId;
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default profileSelectScreen;
