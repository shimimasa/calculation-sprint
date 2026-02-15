import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';
import { perfLog } from '../core/perf.js';
import { preloadStageCoreImages } from '../core/stageAssetPreloader.js';
import {
  DASH_STAGE_IDS,
  findDashStageById,
  getDashStageOrFallback,
  toDashStageId,
} from '../features/dashStages.js';
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

const SELECTED_CLASS_NAME = 'is-selected';

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

const updateButtonSelectionState = (button, isSelected) => {
  button.classList.toggle('is-current', isSelected);
  button.classList.toggle(SELECTED_CLASS_NAME, isSelected);
  button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
};

const updateSelectionState = (button, isSelected) => {
  updateButtonSelectionState(button, isSelected);
  if (isSelected) {
    button.setAttribute('aria-current', 'true');
  } else {
    button.removeAttribute('aria-current');
  }
};

const updateModeSelectionState = (button, isSelected) => {
  updateButtonSelectionState(button, isSelected);
};

const syncDashStartButtonState = () => {
  const startButtons = document.querySelectorAll('[data-role="dash-start"]');
  startButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
  });
};

const dashStageSelectScreen = {
  enter() {
    uiRenderer.showScreen('dash-stage-select');
    this.events = createEventRegistry('dash-stage-select');

    const selectedStage = toDashStageId(gameState.dash?.stageId);
    const selectedModeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
    gameState.dash.modeId = selectedModeId;

    domRefs.dashStageSelect.buttons.forEach((button) => {
      enhanceStageButton(button);
      const stageId = toDashStageId(button.dataset.dashStageId);
      const isSelected = stageId === selectedStage;
      updateSelectionState(button, isSelected);
    });

    domRefs.dashStageSelect.modeButtons.forEach((button) => {
      const modeId = normalizeDashModeId(button.dataset.dashModeId);
      updateModeSelectionState(button, modeId === selectedModeId);
    });
    syncDashStartButtonState();
    if (domRefs.dashStageSelect.modeNote) {
      domRefs.dashStageSelect.modeNote.textContent = MODE_NOTE_MAP[selectedModeId] ?? MODE_NOTE_MAP.infinite;
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
      syncDashStartButtonState();
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
      audioManager.unlock();
      audioManager.playSfx('sfx_confirm');
      gameState.dash.stageId = stage.id;
      domRefs.dashStageSelect.buttons.forEach((candidate) => {
        const candidateStageId = toDashStageId(candidate.dataset.dashStageId);
        updateSelectionState(candidate, candidateStageId === stage.id);
      });
      gameState.dash.modeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
      gameState.dash.currentMode = null;
      preloadStageCoreImages(stage.id, { mode: 'dash' });
      screenManager.changeScreen('dash-game');
    };

    this.handleBack = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };

    this.events.on(domRefs.dashStageSelect.modeList, 'click', this.handleSelectMode);
    this.events.on(domRefs.dashStageSelect.list, 'click', this.handleSelectStage);
    this.events.on(domRefs.dashStageSelect.backButton, 'click', this.handleBack);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashStageSelectScreen;
