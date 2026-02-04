import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import { WORLDS } from '../features/stages.js';

const formatSettingsLabel = (settings) => {
  const modeLabelMap = {
    add: 'たし算',
    sub: 'ひき算',
    mul: 'かけ算',
    div: 'わり算',
    mix: 'ミックス',
  };
  const modeLabel = modeLabelMap[settings.mode] ?? settings.mode;
  const digitLabel = `${settings.digit}桁`;
  const carryLabel = settings.carry ? 'くり上がりあり' : 'くり上がりなし';
  return `${modeLabel} / ${digitLabel} / ${carryLabel}`;
};

const createStageCard = (stage) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'stage-card-button';
  card.dataset.stageId = stage.id;

  const header = document.createElement('div');
  header.className = 'stage-card-header';
  const title = document.createElement('span');
  title.className = 'stage-card-title';
  title.textContent = stage.name;
  const stageId = document.createElement('span');
  stageId.className = 'stage-card-id';
  stageId.textContent = stage.id.toUpperCase();
  header.append(title, stageId);

  const description = document.createElement('p');
  description.className = 'stage-card-description';
  description.textContent = stage.description;

  const detail = document.createElement('p');
  detail.className = 'stage-card-detail';
  detail.textContent = formatSettingsLabel(stage.settings);

  card.append(header, description, detail);
  return card;
};

const renderWorlds = (container) => {
  container.innerHTML = '';
  WORLDS.forEach((world) => {
    const worldSection = document.createElement('div');
    worldSection.className = 'stage-world';

    const worldHeader = document.createElement('div');
    worldHeader.className = 'stage-world-header';
    const worldTitle = document.createElement('h3');
    worldTitle.textContent = world.name;
    const worldDescription = document.createElement('p');
    worldDescription.textContent = world.description;
    worldHeader.append(worldTitle, worldDescription);

    const stageGrid = document.createElement('div');
    stageGrid.className = 'stage-grid';
    world.stages.forEach((stage) => {
      stageGrid.append(createStageCard(stage));
    });

    worldSection.append(worldHeader, stageGrid);
    container.append(worldSection);
  });
};

const findStageById = (stageId) => {
  for (const world of WORLDS) {
    const stage = world.stages.find((item) => item.id === stageId);
    if (stage) {
      return stage;
    }
  }
  return null;
};

const stageSelectScreen = {
  enter() {
    uiRenderer.showScreen('stage');
    if (domRefs.stage.worlds) {
      renderWorlds(domRefs.stage.worlds);
    }

    this.handleStageClick = (event) => {
      const target = event.target.closest('[data-stage-id]');
      if (!target) {
        return;
      }
      const stageId = target.dataset.stageId;
      const stage = findStageById(stageId);
      if (!stage) {
        return;
      }
      gameState.selectedStage = stage;
      gameState.isReviewMode = false;
      gameState.settings = {
        ...gameState.settings,
        ...stage.settings,
      };
      screenManager.changeScreen('game', { stageId });
    };

    this.handleFreePlay = () => {
      screenManager.changeScreen('settings');
    };

    domRefs.stage.worlds?.addEventListener('click', this.handleStageClick);
    domRefs.stage.freePlayButton?.addEventListener('click', this.handleFreePlay);
  },
  render() {},
  exit() {
    if (this.handleStageClick) {
      domRefs.stage.worlds?.removeEventListener('click', this.handleStageClick);
    }
    if (this.handleFreePlay) {
      domRefs.stage.freePlayButton?.removeEventListener('click', this.handleFreePlay);
    }
  },
};

export default stageSelectScreen;
