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

const STAGE_VISUAL_MAP = {
  plus: { cssClass: 'stage-plus', symbol: '＋' },
  minus: { cssClass: 'stage-minus', symbol: '−' },
  multi: { cssClass: 'stage-multi', symbol: '×' },
  divide: { cssClass: 'stage-divide', symbol: '÷' },
  mix: { cssClass: 'stage-mix', symbol: '🎲' },
};

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

const dashStageSelectScreen = {
  enter() {
    uiRenderer.showScreen('dash-stage-select');
    this.events = createEventRegistry('dash-stage-select');

    const selectedStage = toDashStageId(gameState.dash?.stageId);
    domRefs.dashStageSelect.buttons.forEach((button) => {
      enhanceStageButton(button);
      const stageId = toDashStageId(button.dataset.dashStageId);
      const isSelected = stageId === selectedStage;
      updateSelectionState(button, isSelected);
    });

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
      gameState.dash.currentMode = null;
      preloadStageCoreImages(stage.id, { mode: 'dash' });
      screenManager.changeScreen('dash-game');
    };

    this.handleBack = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };

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
