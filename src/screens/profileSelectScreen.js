import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import audioManager from '../core/audioManager.js';
import { LAST_PROFILE_ID_KEY } from '../core/storageKeys.js';

const PROFILE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const loadLastProfileId = () => {
  const stored = window.localStorage.getItem(LAST_PROFILE_ID_KEY);
  if (stored && PROFILE_IDS.includes(stored)) {
    return stored;
  }
  return PROFILE_IDS[0];
};

const profileSelectScreen = {
  enter() {
    uiRenderer.showScreen('profile-select');
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
    domRefs.profileSelect.buttons.forEach((button) => {
      button.addEventListener('click', this.handleProfileClick);
    });
    domRefs.profileSelect.continueButton.addEventListener('click', this.handleContinue);
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
    if (this.handleProfileClick) {
      domRefs.profileSelect.buttons.forEach((button) => {
        button.removeEventListener('click', this.handleProfileClick);
      });
    }
    if (this.handleContinue) {
      domRefs.profileSelect.continueButton.removeEventListener('click', this.handleContinue);
    }
  },
};

export default profileSelectScreen;
