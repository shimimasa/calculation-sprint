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

const dashStageSelectScreen = {
  enter() {
    uiRenderer.showScreen('dash-stage-select');
    this.events = createEventRegistry('dash-stage-select');

    const selectedStage = toDashStageId(gameState.dash?.stageId);
    domRefs.dashStageSelect.buttons.forEach((button) => {
      const stageId = button.dataset.dashStageId;
      const isSelected = stageId === selectedStage;
      button.classList.toggle('is-current', isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
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
