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

  if (!button.querySelector('.dash-world-expand')) {
    const expand = document.createElement('div');
    expand.className = 'dash-world-expand';
    expand.hidden = true;
    expand.innerHTML = `
      <p class="dash-world-expand__title">レベルをえらぼう</p>
      <div class="dash-world-expand__levels" role="list" aria-label="レベル一覧"></div>
      <div class="dash-world-expand__actions">
        <button class="secondary-button dash-world-expand__start" type="button" data-world-start="true">このレベルでスタート</button>
        <button class="secondary-button dash-world-expand__cancel" type="button" data-world-expand-close="true">閉じる</button>
      </div>
    `;
    button.append(expand);
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
    const worldButton = domRefs.dashStageSelect.list?.querySelector(
      `[data-dash-stage-id="${this.selectedWorldKey}"]`,
    );
    const levelList = worldButton?.querySelector('.dash-world-expand__levels');
    if (!worldButton || !levelList) {
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
      const isSelected = stageId === this.selectedWorldKey;
      updateSelectionState(button, isSelected);
      const expand = button.querySelector('.dash-world-expand');
      if (expand) {
        expand.hidden = !this.worldLevelEnabled || !isSelected;
      }
    });
  },
  syncWorldLevelStateFromStore() {
    const selectedStage = toDashStageId(gameState.dash?.stageId);
    if (this.worldLevelEnabled) {
      const storeWorldKey = dashWorldLevelStore.getSelectedWorldKey();
      const storeLevelId = dashWorldLevelStore.getSelectedLevelId();
      const resolved = getDashWorldLevel(storeWorldKey ?? selectedStage, storeLevelId ?? 1);
      this.selectedWorldKey = resolved.worldKey;
      this.selectedLevelId = resolved.levelId;
      return;
    }
    this.selectedWorldKey = selectedStage;
    this.selectedLevelId = null;
  },
  applyWorldLevelUiMode() {
    if (domRefs.dashStageSelect.worldLevelToggle) {
      domRefs.dashStageSelect.worldLevelToggle.checked = this.worldLevelEnabled;
    }
    if (domRefs.dashStageSelect.levelPanel) {
      domRefs.dashStageSelect.levelPanel.hidden = true;
    }
    if (domRefs.dashStageSelect.startButton) {
      domRefs.dashStageSelect.startButton.hidden = true;
    }
    this.syncWorldLevelStateFromStore();
    this.syncWorldSelectionUi();
    this.renderLevelButtons();
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
    this.worldLevelEnabled = dashSettingsStore.getWorldLevelEnabled();

    const selectedModeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
    gameState.dash.modeId = selectedModeId;

    domRefs.dashStageSelect.buttons.forEach((button) => {
      enhanceStageButton(button);
    });

    domRefs.dashStageSelect.modeButtons.forEach((button) => {
      const modeId = normalizeDashModeId(button.dataset.dashModeId);
      updateModeSelectionState(button, modeId === selectedModeId);
    });
    if (domRefs.dashStageSelect.modeNote) {
      domRefs.dashStageSelect.modeNote.textContent = MODE_NOTE_MAP[selectedModeId] ?? MODE_NOTE_MAP.infinite;
    }

    this.applyWorldLevelUiMode();

    this.handleToggleWorldLevel = (event) => {
      const enabled = event.currentTarget?.checked === true;
      dashSettingsStore.setWorldLevelEnabled(enabled);
      this.worldLevelEnabled = enabled;
      this.applyWorldLevelUiMode();
      audioManager.playSfx('sfx_click');
    };

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

      if (!this.worldLevelEnabled) {
        audioManager.unlock();
        audioManager.playSfx('sfx_confirm');
        gameState.dash.stageId = stage.id;
        gameState.dash.modeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
        gameState.dash.currentMode = null;
        preloadStageCoreImages(stage.id, { mode: 'dash' });
        screenManager.changeScreen('dash-game');
        return;
      }

      if (event.target.closest('[data-level-id], [data-world-start], [data-world-expand-close]')) {
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
      if (!this.worldLevelEnabled) {
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
      if (!this.worldLevelEnabled) {
        return;
      }
      audioManager.unlock();
      audioManager.playSfx('sfx_confirm');
      this.startDashWithSelection();
    };

    this.handleExpandAction = (event) => {
      if (!this.worldLevelEnabled) {
        return;
      }
      const startButton = event.target.closest('[data-world-start]');
      if (startButton) {
        this.handleStart();
        return;
      }
      const closeButton = event.target.closest('[data-world-expand-close]');
      if (!closeButton) {
        return;
      }
      this.selectedWorldKey = null;
      this.selectedLevelId = null;
      this.syncWorldSelectionUi();
      audioManager.playSfx('sfx_click');
    };

    this.handleBack = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };

    this.events.on(domRefs.dashStageSelect.worldLevelToggle, 'change', this.handleToggleWorldLevel);
    this.events.on(domRefs.dashStageSelect.modeList, 'click', this.handleSelectMode);
    this.events.on(domRefs.dashStageSelect.list, 'click', this.handleSelectStage);
    this.events.on(domRefs.dashStageSelect.list, 'click', this.handleSelectLevel);
    this.events.on(domRefs.dashStageSelect.list, 'click', this.handleExpandAction);
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
