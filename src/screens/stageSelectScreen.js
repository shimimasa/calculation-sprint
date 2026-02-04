import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import stageProgressStore from '../core/stageProgressStore.js';
import audioManager from '../core/audioManager.js';
import {
  STAGES,
  applyStageSettings,
  findStageById,
  isStageUnlocked,
} from '../features/stages.js';

const formatWorldLabel = (worldId) => {
  const numeric = worldId.replace(/^[a-zA-Z]+/, '');
  if (numeric) {
    return `WORLD ${numeric}`;
  }
  return `WORLD ${worldId.toUpperCase()}`;
};

const formatStageLabel = (stageId) => stageId.replace(/^w/i, '').toUpperCase();

const buildStageMarkup = (stage, { unlocked, cleared, current }) => {
  const stageLabel = formatStageLabel(stage.id);
  const isNext = unlocked && !cleared;
  return `
    <div class="stage-map-node${cleared ? ' is-cleared' : ''}${isNext ? ' is-next' : ''}${current ? ' is-current' : ''}">
      <button
        class="stage-select-button secondary-button${unlocked ? '' : ' is-locked'}${cleared ? ' is-cleared' : ''}${isNext ? ' is-next' : ''}${current ? ' is-current' : ''}"
        data-stage-id="${stage.id}"
        ${unlocked ? '' : 'disabled aria-disabled="true"'}
      >
        <span class="stage-select-label">STAGE ${stageLabel}</span>
        ${current ? '<span class="stage-select-current">▶ いまここ</span>' : ''}
        <span class="stage-select-title">${stage.label}</span>
        <span class="stage-select-description">${stage.description}</span>
        ${cleared ? '<span class="stage-select-clear">✔ クリア <span class="stage-select-star">★</span></span>' : ''}
        ${unlocked ? '' : '<span class="stage-select-lock">🔒 クリアで開放</span>'}
      </button>
    </div>
  `;
};

const buildWorldMarkup = (world, progress) => {
  const clearedCount = world.stages.filter((stage) => stageProgressStore.isCleared(stage.id)).length;
  const totalCount = world.stages.length;
  return `
    <section class="stage-world">
      <div class="stage-world-header">
        <h3>${formatWorldLabel(world.worldId)} <span class="stage-world-progress">(${clearedCount} / ${totalCount} クリア)</span></h3>
      </div>
      <div class="stage-map">
        ${world.stages
          .map((stage) => {
            const unlocked = isStageUnlocked(stage, progress);
            const cleared = stageProgressStore.isCleared(stage.id);
            const current = progress.lastPlayedStageId === stage.id;
            return buildStageMarkup(stage, { unlocked, cleared, current });
          })
          .join('')}
      </div>
    </section>
  `;
};

const groupStagesByWorld = (stages) => {
  const worlds = [];
  const worldMap = new Map();
  stages.forEach((stage) => {
    const worldId = stage.worldId ?? 'world';
    if (!worldMap.has(worldId)) {
      const entry = { worldId, stages: [] };
      worldMap.set(worldId, entry);
      worlds.push(entry);
    }
    worldMap.get(worldId).stages.push(stage);
  });
  return worlds;
};

const stageSelectScreen = {
  enter() {
    uiRenderer.showScreen('stage-select');
    if (domRefs.stageSelect.list) {
      const progress = stageProgressStore.getProgress();
      const worlds = groupStagesByWorld(STAGES);
      domRefs.stageSelect.list.innerHTML = `
        <div class="stage-worlds">
          ${worlds.map((world) => buildWorldMarkup(world, progress)).join('')}
        </div>
      `;
    }

    this.handleStageClick = (event) => {
      const button = event.target.closest('button[data-stage-id]');
      if (!button || button.disabled) {
        return;
      }
      audioManager.playSfx('sfx_click');
      const stageId = button.dataset.stageId;
      const stage = findStageById(stageId);
      if (!stage) {
        return;
      }
      stageProgressStore.setLastPlayed(stage.id);
      gameState.playMode = 'stage';
      gameState.selectedStageId = stage.id;
      applyStageSettings(stage, gameState);
      screenManager.changeScreen('game');
    };

    this.handleBack = () => {
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('title');
    };

    this.handleFreePlay = () => {
      audioManager.playSfx('sfx_click');
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
