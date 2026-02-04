import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import { PRESETS } from '../features/presets.js';

const CUSTOM_PRESET_VALUE = 'custom';
const CUSTOM_PRESET_DESCRIPTION = 'こまかく設定で自分で作れるよ。';

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

const updatePresetDescription = (presetKey) => {
  const description = PRESETS[presetKey]?.description ?? CUSTOM_PRESET_DESCRIPTION;
  domRefs.settings.presetDescriptionText.textContent = description;
  const isCustom = !PRESETS[presetKey];
  domRefs.settings.presetDescription.classList.toggle('is-custom', isCustom);
  domRefs.settings.presetTag.hidden = !isCustom;
};

const settingsScreen = {
  enter() {
    uiRenderer.showScreen('settings');
    this.isSyncing = true;
    applySettingsToUi(gameState.settings);
    this.isSyncing = false;
    if (!domRefs.settings.presetSelect.value) {
      domRefs.settings.presetSelect.value = CUSTOM_PRESET_VALUE;
    }
    updatePresetDescription(domRefs.settings.presetSelect.value);

    this.handlePresetChange = () => {
      const presetKey = domRefs.settings.presetSelect.value;
      if (!presetKey || presetKey === CUSTOM_PRESET_VALUE) {
        updatePresetDescription(presetKey);
        return;
      }
      const preset = PRESETS[presetKey];
      if (!preset) {
        updatePresetDescription(presetKey);
        return;
      }
      this.isSyncing = true;
      gameState.settings.mode = preset.mode;
      gameState.settings.digit = preset.digit;
      gameState.settings.carry = preset.carry;
      applySettingsToUi(gameState.settings);
      this.isSyncing = false;
      updatePresetDescription(presetKey);
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
      if (domRefs.settings.presetSelect.value !== CUSTOM_PRESET_VALUE) {
        domRefs.settings.presetSelect.value = CUSTOM_PRESET_VALUE;
        console.log('Manual change detected: preset reset to manual.');
      }
      updatePresetDescription(domRefs.settings.presetSelect.value);
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
    this.isSyncing = false;
  },
};

export default settingsScreen;
