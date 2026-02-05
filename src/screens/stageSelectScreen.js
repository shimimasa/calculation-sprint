import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import stageProgressStore from '../core/stageProgressStore.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';
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

const stageSelectIcons = {
  current: `
    <svg class="stage-select-icon stage-select-icon--current" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 5l10 7-10 7V5z" />
    </svg>
  `,
  clear: `
    <svg class="stage-select-icon stage-select-icon--clear" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 12l4 4 8-9" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  lock: `
    <svg class="stage-select-icon stage-select-icon--lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="6" y="10" width="12" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 018 0v2" fill="none" stroke-width="2" stroke-linecap="round" />
    </svg>
  `,
};

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
        ${
          current
            ? `<span class="stage-select-current">${stageSelectIcons.current}<span>いまここ</span></span>`
            : ''
        }
        <span class="stage-select-title">${stage.label}</span>
        <span class="stage-select-description">${stage.description}</span>
        ${
          cleared
            ? `<span class="stage-select-clear">${stageSelectIcons.clear}<span>実施済み</span> <span class="stage-select-star">★</span></span>`
            : ''
        }
        ${unlocked ? '' : `<span class="stage-select-lock">${stageSelectIcons.lock}<span>1回実施で開放</span></span>`}
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
        <h3>${formatWorldLabel(world.worldId)} <span class="stage-world-progress">(${clearedCount} / ${totalCount} 実施済み)</span></h3>
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

const resolveStageSelectTheme = (progress) => {
  const fallbackStage = STAGES[0];
  const lastStage = progress?.lastPlayedStageId ? findStageById(progress.lastPlayedStageId) : null;
  const stage = lastStage ?? fallbackStage ?? null;
  return {
    worldId: stage?.worldId ?? 'world',
    themeId: stage?.themeId ?? stage?.worldId ?? 'world',
  };
};

const stageSelectScreen = {
  enter() {
    uiRenderer.showScreen('stage-select');
    this.events = createEventRegistry('stage-select');
    const stageSelectElement = domRefs.screens['stage-select'];
    const progress = stageProgressStore.getProgress();
    if (stageSelectElement) {
      const { worldId, themeId } = resolveStageSelectTheme(progress);
      stageSelectElement.dataset.worldId = worldId;
      stageSelectElement.dataset.themeId = themeId;
    }
    if (domRefs.stageSelect.list) {
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
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
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
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('title');
    };

    this.handleFreePlay = () => {
      audioManager.unlock();
      audioManager.playSfx('sfx_click');
      gameState.playMode = 'free';
      gameState.selectedStageId = null;
      screenManager.changeScreen('settings');
    };

    this.events.on(domRefs.stageSelect.list, 'click', this.handleStageClick);
    this.events.on(domRefs.stageSelect.backButton, 'click', this.handleBack);
    this.events.on(domRefs.stageSelect.freeButton, 'click', this.handleFreePlay);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default stageSelectScreen;
