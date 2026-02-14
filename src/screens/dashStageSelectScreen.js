import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import audioManager from '../core/audioManager.js';
import dashSettingsStore from '../core/dashSettingsStore.js';
import dashWorldLevelStore from '../core/dashWorldLevelStore.js';
import { createEventRegistry } from '../core/eventRegistry.js';
import { perfLog } from '../core/perf.js';
import { preloadStageCoreImages } from '../core/stageAssetPreloader.js';
import {
  DASH_STAGE_IDS,
  findDashStageById,
  getDashStageOrFallback,
  toDashStageId,
} from '../features/dashStages.js';
import { DASH_WORLD_LEVELS, getDashWorldLevel } from '../features/dashWorldLevels.js';
import { DEFAULT_DASH_MODE, normalizeDashModeId } from '../game/dash/modes/modeTypes.js';

const STAGE_VISUAL_MAP = {
  plus: { cssClass: 'stage-plus', symbol: '＋' },
  minus: { cssClass: 'stage-minus', symbol: '−' },
  multi: { cssClass: 'stage-multi', symbol: '×' },
  divide: { cssClass: 'stage-divide', symbol: '÷' },
  mix: { cssClass: 'stage-mix', symbol: '🎲' },
};

const MODE_NOTE_MAP = Object.freeze({
  infinite: 'じかんをのばして どこまでいける？',
  goalRun: '1000mまで いっきにダッシュ！',
  scoreAttack60: '60びょうで スコアをかせげ！',
});

const enhanceStageButton = (button) => {
  const stageId = toDashStageId(button.dataset.dashStageId);
  const visual = STAGE_VISUAL_MAP[stageId] ?? STAGE_VISUAL_MAP.mix;
  button.dataset.stage = stageId;
  button.dataset.stageSymbol = visual.symbol;
  button.classList.add('dash-stage-card', visual.cssClass);

  const title = button.querySelector('span');
  const description = button.querySelector('small');
  title?.classList.add('dash-stage-card__title');
  description?.classList.add('dash-stage-card__description');

  if (!button.querySelector('.dash-stage-card__badge')) {
    const badge = document.createElement('span');
    badge.className = 'dash-stage-card__badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = visual.symbol;
    button.prepend(badge);
  }

  if (!button.querySelector('.dash-stage-card__selected')) {
    const selected = document.createElement('span');
    selected.className = 'dash-stage-card__selected';
    selected.textContent = 'えらんだ！';
    selected.setAttribute('aria-hidden', 'true');
    button.append(selected);
  }
};

const updateSelectionState = (button, isSelected) => {
  button.classList.toggle('is-current', isSelected);
  button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  if (isSelected) {
    button.setAttribute('aria-current', 'true');
  } else {
    button.removeAttribute('aria-current');
  }
};

const updateModeSelectionState = (button, isSelected) => {
  button.classList.toggle('is-current', isSelected);
  button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
};

const dashStageSelectScreen = {
  renderLevelButtons() {
    const levelList = domRefs.dashStageSelect.levelList;
    if (!levelList) {
      return;
    }
    const levels = DASH_WORLD_LEVELS[this.selectedWorldKey] ?? [];
    levelList.innerHTML = levels
      .map((entry) => {
        const selectedClass = entry.levelId === this.selectedLevelId ? ' is-current' : '';
        const pressed = entry.levelId === this.selectedLevelId ? 'true' : 'false';
        return `<button class="secondary-button dash-level-button${selectedClass}" type="button" data-level-id="${entry.levelId}" aria-pressed="${pressed}">LEVEL ${entry.levelId}</button>`;
      })
      .join('');
  },
  syncWorldSelectionUi() {
    domRefs.dashStageSelect.buttons.forEach((button) => {
      const stageId = toDashStageId(button.dataset.dashStageId);
      updateSelectionState(button, stageId === this.selectedWorldKey);
    });
  },
  startDashWithSelection() {
    const stage = findDashStageById(this.selectedWorldKey) ?? getDashStageOrFallback(this.selectedWorldKey);
    if (!stage || !DASH_STAGE_IDS.includes(stage.id)) {
      return;
    }
    const worldLevel = dashWorldLevelStore.save({ worldKey: this.selectedWorldKey, levelId: this.selectedLevelId });
    gameState.dash.stageId = stage.id;
    gameState.dash.worldKey = worldLevel.worldKey;
    gameState.dash.levelId = worldLevel.levelId;
    gameState.dash.modeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
    gameState.dash.currentMode = null;
    preloadStageCoreImages(stage.id, { mode: 'dash' });
    screenManager.changeScreen('dash-game');
  },
  enter() {
    uiRenderer.showScreen('dash-stage-select');
    this.events = createEventRegistry('dash-stage-select');
    const worldLevelEnabled = dashSettingsStore.getWorldLevelEnabled();

    const selectedStage = toDashStageId(gameState.dash?.stageId);
    const selectedModeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
    gameState.dash.modeId = selectedModeId;

    if (worldLevelEnabled) {
      const storeWorldKey = dashWorldLevelStore.getSelectedWorldKey();
      const storeLevelId = dashWorldLevelStore.getSelectedLevelId();
      const resolved = getDashWorldLevel(storeWorldKey ?? selectedStage, storeLevelId ?? 1);
      this.selectedWorldKey = resolved.worldKey;
      this.selectedLevelId = resolved.levelId;
    } else {
      this.selectedWorldKey = selectedStage;
      this.selectedLevelId = null;
    }

    domRefs.dashStageSelect.buttons.forEach((button) => {
      enhanceStageButton(button);
    });
    this.syncWorldSelectionUi();

    domRefs.dashStageSelect.modeButtons.forEach((button) => {
      const modeId = normalizeDashModeId(button.dataset.dashModeId);
      updateModeSelectionState(button, modeId === selectedModeId);
    });
    if (domRefs.dashStageSelect.modeNote) {
      domRefs.dashStageSelect.modeNote.textContent = MODE_NOTE_MAP[selectedModeId] ?? MODE_NOTE_MAP.infinite;
    }

    if (domRefs.dashStageSelect.levelPanel) {
      domRefs.dashStageSelect.levelPanel.hidden = !worldLevelEnabled;
    }
    if (domRefs.dashStageSelect.startButton) {
      domRefs.dashStageSelect.startButton.hidden = !worldLevelEnabled;
    }
    if (worldLevelEnabled) {
      this.renderLevelButtons();
    } else if (domRefs.dashStageSelect.levelList) {
      domRefs.dashStageSelect.levelList.innerHTML = '';
    }

    this.handleSelectMode = (event) => {
      const button = event.target.closest('[data-dash-mode-id]');
      if (!button) {
        return;
      }
      const modeId = normalizeDashModeId(button.dataset.dashModeId);
      gameState.dash.modeId = modeId;
      domRefs.dashStageSelect.modeButtons.forEach((candidate) => {
        const candidateMode = normalizeDashModeId(candidate.dataset.dashModeId);
        updateModeSelectionState(candidate, candidateMode === modeId);
      });
      if (domRefs.dashStageSelect.modeNote) {
        domRefs.dashStageSelect.modeNote.textContent = MODE_NOTE_MAP[modeId] ?? MODE_NOTE_MAP.infinite;
      }
      audioManager.playSfx('sfx_click');
    };

    this.handleSelectStage = (event) => {
      const button = event.target.closest('[data-dash-stage-id]');
      if (!button) {
        return;
      }
      const stageId = toDashStageId(button.dataset.dashStageId);
      perfLog('dash.stage.select.click', { stageId });
      const stage = findDashStageById(stageId) ?? getDashStageOrFallback(stageId);
      if (!stage || !DASH_STAGE_IDS.includes(stage.id)) {
        return;
      }

      if (!worldLevelEnabled) {
        audioManager.unlock();
        audioManager.playSfx('sfx_confirm');
        gameState.dash.stageId = stage.id;
        gameState.dash.modeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
        gameState.dash.currentMode = null;
        preloadStageCoreImages(stage.id, { mode: 'dash' });
        screenManager.changeScreen('dash-game');
        return;
      }

      this.selectedWorldKey = stage.id;
      const resolved = getDashWorldLevel(this.selectedWorldKey, this.selectedLevelId ?? 1);
      this.selectedLevelId = resolved.levelId;
      this.syncWorldSelectionUi();
      this.renderLevelButtons();
      audioManager.playSfx('sfx_click');
    };

    this.handleSelectLevel = (event) => {
      if (!worldLevelEnabled) {
        return;
      }
      const button = event.target.closest('[data-level-id]');
      if (!button) {
        return;
      }
      const levelId = Number.parseInt(button.dataset.levelId ?? '', 10);
      const resolved = getDashWorldLevel(this.selectedWorldKey, levelId);
      this.selectedLevelId = resolved.levelId;
      this.renderLevelButtons();
      audioManager.playSfx('sfx_click');
    };

    this.handleStart = () => {
      if (!worldLevelEnabled) {
        return;
      }
      audioManager.unlock();
      audioManager.playSfx('sfx_confirm');
      this.startDashWithSelection();
    };

    this.handleBack = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };

    this.events.on(domRefs.dashStageSelect.modeList, 'click', this.handleSelectMode);
    this.events.on(domRefs.dashStageSelect.list, 'click', this.handleSelectStage);
    this.events.on(domRefs.dashStageSelect.levelList, 'click', this.handleSelectLevel);
    this.events.on(domRefs.dashStageSelect.startButton, 'click', this.handleStart);
    this.events.on(domRefs.dashStageSelect.backButton, 'click', this.handleBack);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashStageSelectScreen;
