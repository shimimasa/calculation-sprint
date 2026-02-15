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
  getDashStageLabelJa,
  getDashStageLevels,
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

const MODE_BADGE_LABEL_MAP = Object.freeze({
  infinite: 'Infinite',
  goalRun: 'GoalRun',
  scoreAttack60: 'ScoreAttack60',
});

const SELECTED_CLASS_NAME = 'is-selected';
const DASH_LEVEL_ACTION_SELECTOR = [
  '[data-role="dash-level"]',
  '[data-role="dash-start"]',
  '[data-role="dash-close"]',
  '.dash-level-button',
].join(',');


const isDashDebugEnabled = () => {
  if (window.__DASH_DEBUG === true) {
    return true;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('dashDebug') === '1';
  } catch (error) {
    return false;
  }
};

const logDashStageClickDecision = ({
  worldLevelEnabled,
  modeId,
  clickedStageId,
  selectedWorld,
  selectedLevel,
  decidedAction,
  reason,
}) => {
  if (!isDashDebugEnabled()) {
    return;
  }
  console.log('[dash-stage-select]', {
    worldLevelEnabled,
    modeId,
    clickedStageId,
    selectedWorld,
    selectedLevel,
    decidedAction,
    reason,
  });
};


const describeClickNode = (node) => {
  if (!(node instanceof Element)) {
    return null;
  }

  return {
    tagName: node.tagName.toLowerCase(),
    role: node.getAttribute('data-role') ?? null,
    dashStageId: node.getAttribute('data-dash-stage-id') ?? null,
    levelId: node.getAttribute('data-level-id') ?? null,
    className: node.className ?? '',
  };
};

const logDashLevelAction = (payload) => {
  if (!isDashDebugEnabled()) {
    return;
  }
  console.log('[dash-stage-select.level-action]', payload);
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
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
  });
};

const getSelectedLevelLabel = () => {
  const selectedLevel = gameState.dash?.levelId ?? gameState.dash?.level;
  if (selectedLevel === undefined || selectedLevel === null || selectedLevel === '') {
    return null;
  }
  return String(selectedLevel);
};

const getNormalizedLevelSelection = (stageId, levelId) => {
  const levels = getDashStageLevels(stageId);
  const numericLevel = Number(levelId);
  if (!Number.isInteger(numericLevel) || !levels.includes(numericLevel)) {
    return {
      levelId: levels[0],
      levels,
    };
  }

  return {
    levelId: numericLevel,
    levels,
  };
};

const normalizeLevelId = (stageId, levelId) => {
  const { levelId: normalizedLevelId } = getNormalizedLevelSelection(stageId, levelId);
  return normalizedLevelId;
};

const updateSelectionBadges = () => {
  const modeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
  const stageId = toDashStageId(gameState.dash?.stageId);
  const levelLabel = getSelectedLevelLabel();

  if (domRefs.dashStageSelect.modeBadge) {
    const modeLabel = MODE_BADGE_LABEL_MAP[modeId] ?? MODE_BADGE_LABEL_MAP.infinite;
    domRefs.dashStageSelect.modeBadge.textContent = `モード: ${modeLabel}`;
  }

  if (domRefs.dashStageSelect.stageBadge) {
    domRefs.dashStageSelect.stageBadge.textContent = `ステージ: ${getDashStageLabelJa(stageId)}`;
  }

  if (domRefs.dashStageSelect.levelBadge) {
    const shouldShowLevel = Boolean(levelLabel);
    domRefs.dashStageSelect.levelBadge.hidden = !shouldShowLevel;
    if (shouldShowLevel) {
      domRefs.dashStageSelect.levelBadge.textContent = `Lv: ${levelLabel}`;
    }
  }
};

const dashStageSelectScreen = {
  enter() {
    uiRenderer.showScreen('dash-stage-select');
    this.events = createEventRegistry('dash-stage-select');
    this.expandedStageId = null;

    const selectedStage = toDashStageId(gameState.dash?.stageId);
    const selectedModeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
    gameState.dash.modeId = selectedModeId;

    domRefs.dashStageSelect.buttons.forEach((button) => {
      enhanceStageButton(button);
      const stageId = toDashStageId(button.dataset.dashStageId);
      const isSelected = stageId === selectedStage;
      updateSelectionState(button, isSelected);
      this.closeExpandedWorld(stageId);
    });

    domRefs.dashStageSelect.modeButtons.forEach((button) => {
      const modeId = normalizeDashModeId(button.dataset.dashModeId);
      updateModeSelectionState(button, modeId === selectedModeId);
    });
    syncDashStartButtonState();
    updateSelectionBadges();
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
      updateSelectionBadges();
      if (domRefs.dashStageSelect.modeNote) {
        domRefs.dashStageSelect.modeNote.textContent = MODE_NOTE_MAP[modeId] ?? MODE_NOTE_MAP.infinite;
      }
      audioManager.playSfx('sfx_click');
    };

    this.handleSelectStage = (event) => {
      const levelActionButton = event.target.closest(DASH_LEVEL_ACTION_SELECTOR);
      if (levelActionButton) {
        this.handleLevelAction(levelActionButton, event);
        return;
      }

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
      gameState.dash.stageId = stage.id;
      domRefs.dashStageSelect.buttons.forEach((candidate) => {
        const candidateStageId = toDashStageId(candidate.dataset.dashStageId);
        updateSelectionState(candidate, candidateStageId === stage.id);
      });
      updateSelectionBadges();

      logDashStageClickDecision({
        worldLevelEnabled: true,
        modeId: gameState.dash.modeId,
        clickedStageId: stage.id,
        selectedWorld: gameState.dash.stageId,
        selectedLevel: gameState.dash.levelId ?? gameState.dash.level ?? null,
        decidedAction: 'expand',
        reason: 'always-expand-level-selection',
      });

      audioManager.playSfx('sfx_click');
      this.expandWorld(stage.id);
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
  handleLevelAction(actionButton, event) {
    const stageId = toDashStageId(
      actionButton.dataset.dashStageId
      ?? actionButton.closest('[data-dash-world-card]')?.dataset.dashWorldCard,
    );
    const role = actionButton.dataset.role;

    if (role === 'dash-level' || role === 'dash-start' || role === 'dash-close') {
      event?.stopPropagation();
    }

    if (role === 'dash-level') {
      const levelBefore = normalizeLevelId(stageId, gameState.dash?.levelId ?? gameState.dash?.level);
      const levelAfter = normalizeLevelId(stageId, actionButton.dataset.levelId);
      logDashLevelAction({
        action: 'level',
        stageId,
        levelId: levelAfter,
        selectedLevel: `${levelBefore}->${levelAfter}`,
        target: describeClickNode(event?.target),
        currentTarget: describeClickNode(event?.currentTarget),
      });
      this.selectLevel(levelAfter, stageId);
      audioManager.playSfx('sfx_click');
      return;
    }

    if (role === 'dash-start') {
      const levelId = normalizeLevelId(stageId, gameState.dash?.levelId ?? gameState.dash?.level);
      logDashLevelAction({
        action: 'start',
        worldKey: stageId,
        levelId,
        modeId: normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE),
      });
      this.startDashWithSelection(stageId);
      return;
    }

    if (role === 'dash-close') {
      logDashLevelAction({
        action: 'close',
        stageId,
        collapse: true,
      });
      this.closeExpandedWorld(stageId);
      audioManager.playSfx('sfx_cancel');
    }
  },
  getLevelHost(stageId) {
    return domRefs.dashStageSelect.list?.querySelector(`[data-dash-levels-for="${stageId}"]`) ?? null;
  },
  expandWorld(stageId) {
    const normalizedStageId = toDashStageId(stageId);
    if (this.expandedStageId && this.expandedStageId !== normalizedStageId) {
      this.closeExpandedWorld(this.expandedStageId);
    }

    const host = this.getLevelHost(normalizedStageId);
    const cardWrap = host?.closest('[data-dash-world-card]');
    if (!host || !cardWrap) {
      return;
    }

    const {
      levelId: selectedLevelId,
      levels: levelOptions,
    } = getNormalizedLevelSelection(normalizedStageId, gameState.dash?.levelId ?? gameState.dash?.level);
    gameState.dash.levelId = selectedLevelId;

    host.innerHTML = `
      <p class="dash-level-select-title" data-role="dash-level-title">LEVELをえらんでスタート</p>
      <div class="dash-level-select-list" role="group" aria-label="LEVEL選択 (${getDashStageLabelJa(normalizedStageId)})">
        ${levelOptions
    .map((levelId) => `
          <button
            class="secondary-button dash-level-button${levelId === selectedLevelId ? ' is-selected' : ''}"
            type="button"
            data-role="dash-level"
            data-dash-stage-id="${normalizedStageId}"
            data-level-id="${levelId}"
            aria-pressed="${levelId === selectedLevelId ? 'true' : 'false'}"
          >
            LEVEL ${levelId}
          </button>
        `)
    .join('')}
      </div>
      <div class="dash-stage-card__actions">
        <button class="secondary-button is-cta" type="button" data-role="dash-start" data-dash-stage-id="${normalizedStageId}">このレベルでスタート</button>
        <button class="secondary-button dash-close-button" type="button" data-role="dash-close" data-dash-stage-id="${normalizedStageId}">閉じる</button>
      </div>
    `;

    host.hidden = false;
    cardWrap.classList.add('is-expanded');
    this.expandedStageId = normalizedStageId;
    this.selectLevel(selectedLevelId, normalizedStageId);
    syncDashStartButtonState();
  },
  selectLevel(levelId, stageId = this.expandedStageId) {
    const normalizedStageId = toDashStageId(stageId);
    const host = this.getLevelHost(normalizedStageId);
    if (!host) {
      return;
    }

    const selectedLevelId = normalizeLevelId(normalizedStageId, levelId);
    gameState.dash.stageId = normalizedStageId;
    gameState.dash.levelId = selectedLevelId;

    host.querySelectorAll('[data-role="dash-level"]').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const buttonLevelId = normalizeLevelId(normalizedStageId, button.dataset.levelId);
      updateButtonSelectionState(button, buttonLevelId === selectedLevelId);
    });

    updateSelectionBadges();
  },
  closeExpandedWorld(stageId = this.expandedStageId) {
    if (!stageId) {
      return;
    }
    const normalizedStageId = toDashStageId(stageId);
    const host = this.getLevelHost(normalizedStageId);
    const cardWrap = host?.closest('[data-dash-world-card]');

    if (host) {
      host.hidden = true;
      host.innerHTML = '';
    }
    cardWrap?.classList.remove('is-expanded');

    if (this.expandedStageId === normalizedStageId) {
      this.expandedStageId = null;
    }
  },
  startDash(stageId) {
    const normalizedStageId = toDashStageId(stageId);
    gameState.dash.stageId = normalizedStageId;
    gameState.dash.modeId = normalizeDashModeId(gameState.dash?.modeId ?? DEFAULT_DASH_MODE);
    gameState.dash.currentMode = null;
    preloadStageCoreImages(normalizedStageId, { mode: 'dash' });
    screenManager.changeScreen('dash-game');
  },
  startDashWithSelection(stageId = this.expandedStageId) {
    const normalizedStageId = toDashStageId(stageId);
    const selectedLevelId = normalizeLevelId(normalizedStageId, gameState.dash?.levelId ?? gameState.dash?.level);
    gameState.dash.levelId = selectedLevelId;
    audioManager.unlock();
    audioManager.playSfx('sfx_confirm');
    this.startDash(normalizedStageId);
  },
  render() {},
  exit() {
    this.closeExpandedWorld(this.expandedStageId);
    this.events?.clear();
    this.events = null;
  },
};

export default dashStageSelectScreen;
