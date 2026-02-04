import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import stageProgressStore from '../core/stageProgressStore.js';
import {
  STAGES,
  applyStageSettings,
  findStageById,
  isStageUnlocked,
} from '../features/stages.js';

const buildStageMarkup = (stage, unlocked) => `
  <button
    class="stage-select-button secondary-button${unlocked ? '' : ' is-locked'}"
    data-stage-id="${stage.id}"
    ${unlocked ? '' : 'disabled aria-disabled="true"'}
  >
    <span class="stage-select-label">STAGE ${String(stage.order).padStart(2, '0')}</span>
    <span class="stage-select-title">${stage.label}</span>
    <span class="stage-select-description">${stage.description}</span>
    ${unlocked ? '' : '<span class="stage-select-lock">🔒 ロック中</span>'}
  </button>
`;

const stageSelectScreen = {
  enter() {
    uiRenderer.showScreen('stage-select');
    if (domRefs.stageSelect.list) {
      const progress = stageProgressStore.getProgress();
      domRefs.stageSelect.list.innerHTML = STAGES
        .map((stage) => buildStageMarkup(stage, isStageUnlocked(stage, progress)))
        .join('');
    }

    this.handleStageClick = (event) => {
      const button = event.target.closest('button[data-stage-id]');
      if (!button || button.disabled) {
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
