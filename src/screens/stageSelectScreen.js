import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import { STAGES, applyStageSettings, findStageById } from '../features/stages.js';

const buildStageMarkup = (stage) => `
  <button class="stage-select-button secondary-button" data-stage-id="${stage.id}">
    <span class="stage-select-label">STAGE ${String(stage.order).padStart(2, '0')}</span>
    <span class="stage-select-title">${stage.label}</span>
    <span class="stage-select-description">${stage.description}</span>
  </button>
`;

const stageSelectScreen = {
  enter() {
    uiRenderer.showScreen('stage-select');
    if (domRefs.stageSelect.list) {
      domRefs.stageSelect.list.innerHTML = STAGES.map(buildStageMarkup).join('');
    }

    this.handleStageClick = (event) => {
      const button = event.target.closest('[data-stage-id]');
      if (!button) {
        return;
      }
      const stageId = button.dataset.stageId;
      const stage = findStageById(stageId);
      if (!stage) {
        return;
      }
      gameState.playMode = 'stage';
      gameState.selectedStageId = stage.id;
      applyStageSettings(stage, gameState);
      screenManager.changeScreen('game');
    };

    this.handleBack = () => {
      screenManager.changeScreen('title');
    };

    this.handleFreePlay = () => {
      gameState.playMode = 'free';
      gameState.selectedStageId = null;
      screenManager.changeScreen('settings');
    };

    domRefs.stageSelect.list?.addEventListener('click', this.handleStageClick);
    domRefs.stageSelect.backButton?.addEventListener('click', this.handleBack);
    domRefs.stageSelect.freeButton?.addEventListener('click', this.handleFreePlay);
  },
  render() {},
  exit() {
    if (this.handleStageClick) {
      domRefs.stageSelect.list?.removeEventListener('click', this.handleStageClick);
    }
    if (this.handleBack) {
      domRefs.stageSelect.backButton?.removeEventListener('click', this.handleBack);
    }
    if (this.handleFreePlay) {
      domRefs.stageSelect.freeButton?.removeEventListener('click', this.handleFreePlay);
    }
  },
};

export default stageSelectScreen;
