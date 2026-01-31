import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import { PRESETS } from '../features/presets.js';

const applySettingsToUi = (settings) => {
  domRefs.settings.modeInputs.forEach((input) => {
    input.checked = input.value === settings.mode;
  });
  domRefs.settings.digitInputs.forEach((input) => {
    input.checked = Number(input.value) === settings.digit;
  });
  domRefs.settings.carryCheckbox.checked = settings.carry;
};

const readUiToSettings = () => {
  const selectedMode = Array.from(domRefs.settings.modeInputs).find((input) => input.checked);
  const selectedDigit = Array.from(domRefs.settings.digitInputs).find((input) => input.checked);
  gameState.settings.mode = selectedMode ? selectedMode.value : 'add';
  gameState.settings.digit = selectedDigit ? Number(selectedDigit.value) : 1;
  gameState.settings.carry = domRefs.settings.carryCheckbox.checked;
};

const settingsScreen = {
  enter() {
    uiRenderer.showScreen('settings');
    this.isSyncing = true;
    applySettingsToUi(gameState.settings);
    this.isSyncing = false;

    this.handlePresetChange = () => {
      const presetKey = domRefs.settings.presetSelect.value;
      if (!presetKey) {
        return;
      }
      const preset = PRESETS[presetKey];
      if (!preset) {
        return;
      }
      this.isSyncing = true;
      gameState.settings.mode = preset.mode;
      gameState.settings.digit = preset.digit;
      gameState.settings.carry = preset.carry;
      applySettingsToUi(gameState.settings);
      this.isSyncing = false;
      console.log('Preset applied:', presetKey, {
        mode: gameState.settings.mode,
        digit: gameState.settings.digit,
        carry: gameState.settings.carry,
      });
    };

    this.handleManualChange = () => {
      if (this.isSyncing) {
        return;
      }
      readUiToSettings();
      if (domRefs.settings.presetSelect.value !== '') {
        domRefs.settings.presetSelect.value = '';
        console.log('Manual change detected: preset reset to manual.');
      }
    };

    this.handlePlay = () => {
      readUiToSettings();
      screenManager.changeScreen('game');
    };

    domRefs.settings.presetSelect.addEventListener('change', this.handlePresetChange);
    domRefs.settings.modeInputs.forEach((input) => {
      input.addEventListener('change', this.handleManualChange);
    });
    domRefs.settings.digitInputs.forEach((input) => {
      input.addEventListener('change', this.handleManualChange);
    });
    domRefs.settings.carryCheckbox.addEventListener('change', this.handleManualChange);
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
    if (this.handleManualChange) {
      domRefs.settings.modeInputs.forEach((input) => {
        input.removeEventListener('change', this.handleManualChange);
      });
      domRefs.settings.digitInputs.forEach((input) => {
        input.removeEventListener('change', this.handleManualChange);
      });
      domRefs.settings.carryCheckbox.removeEventListener('change', this.handleManualChange);
    }
  },
};

export default settingsScreen;
