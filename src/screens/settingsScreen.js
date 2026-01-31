import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import { PRESETS } from '../features/presets.js';

const settingsScreen = {
  enter() {
    uiRenderer.showScreen('settings');
    const applySettingsToUI = () => {
      domRefs.settings.modeInputs.forEach((input) => {
        input.checked = input.value === gameState.settings.mode;
      });
      domRefs.settings.digitInputs.forEach((input) => {
        input.checked = Number(input.value) === gameState.settings.digit;
      });
      domRefs.settings.carryCheckbox.checked = gameState.settings.carry;
    };

    applySettingsToUI();

    this.handlePresetChange = () => {
      const presetKey = domRefs.settings.presetSelect.value;
      if (!presetKey) {
        return;
      }
      const preset = PRESETS[presetKey];
      if (!preset) {
        return;
      }
      gameState.settings.mode = preset.mode;
      gameState.settings.digit = preset.digit;
      gameState.settings.carry = preset.carry;
      applySettingsToUI();
    };

    this.handlePlay = () => {
      const selectedMode = Array.from(domRefs.settings.modeInputs).find((input) => input.checked);
      const selectedDigit = Array.from(domRefs.settings.digitInputs).find((input) => input.checked);
      gameState.settings.mode = selectedMode ? selectedMode.value : 'add';
      gameState.settings.digit = selectedDigit ? Number(selectedDigit.value) : 1;
      gameState.settings.carry = domRefs.settings.carryCheckbox.checked;
      screenManager.changeScreen('game');
    };

    domRefs.settings.presetSelect.addEventListener('change', this.handlePresetChange);
    domRefs.settings.playButton.addEventListener('click', this.handlePlay);
  },
  render() {},
  exit() {
    if (this.handlePlay) {
      domRefs.settings.playButton.removeEventListener('click', this.handlePlay);
    }
    if (this.handlePresetChange) {
      domRefs.settings.presetSelect.removeEventListener('change', this.handlePresetChange);
    }
  },
};

export default settingsScreen;
