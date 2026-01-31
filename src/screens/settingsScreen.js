import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';

const settingsScreen = {
  enter() {
    uiRenderer.showScreen('settings');
    domRefs.settings.modeInputs.forEach((input) => {
      input.checked = input.value === gameState.settings.mode;
    });
    domRefs.settings.digitInputs.forEach((input) => {
      input.checked = Number(input.value) === gameState.settings.digit;
    });
    domRefs.settings.carryCheckbox.checked = gameState.settings.carry;

    this.handlePlay = () => {
      const selectedMode = Array.from(domRefs.settings.modeInputs).find((input) => input.checked);
      const selectedDigit = Array.from(domRefs.settings.digitInputs).find((input) => input.checked);
      gameState.settings.mode = selectedMode ? selectedMode.value : 'add';
      gameState.settings.digit = selectedDigit ? Number(selectedDigit.value) : 1;
      gameState.settings.carry = domRefs.settings.carryCheckbox.checked;
      screenManager.changeScreen('game');
    };

    domRefs.settings.playButton.addEventListener('click', this.handlePlay);
  },
  render() {},
  exit() {
    if (this.handlePlay) {
      domRefs.settings.playButton.removeEventListener('click', this.handlePlay);
    }
  },
};

export default settingsScreen;
