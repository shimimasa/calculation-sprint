import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import dashStatsStore from '../core/dashStatsStore.js';
import { DASH_STAGE_IDS, getDashStageLabelJa } from '../features/dashStages.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const getStageClassName = (stageId) => `stage-${String(stageId || 'mix')}`;

const formatDateTime = (isoValue) => {
  if (!isoValue) {
    return '-';
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const DASH_STATS_MODES = Object.freeze(['infinite', 'goalRun', 'scoreAttack60']);

const dashStatsScreen = {
  enter() {
    uiRenderer.showScreen('dash-stats');
    this.events = createEventRegistry('dash-stats');
    this.stats = dashStatsStore.getStats();
    this.currentModeFilter = DASH_STATS_MODES.includes(this.currentModeFilter) ? this.currentModeFilter : 'infinite';

    this.handleModeFilter = (event) => {
      const button = event.target.closest('[data-dash-stats-mode]');
      if (!button) {
        return;
      }
      const modeId = String(button.dataset.dashStatsMode || 'infinite');
      if (!DASH_STATS_MODES.includes(modeId)) {
        return;
      }
      this.currentModeFilter = modeId;
      audioManager.playSfx('sfx_click');
      this.renderStats();
    };

    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };

    this.events.on(domRefs.dashStats.modeFilters, 'click', this.handleModeFilter);
    this.events.on(domRefs.dashStats.backButton, 'click', this.handleBack);

    this.renderStats();
  },
  renderStats() {
    const stats = this.stats ?? dashStatsStore.getStats();
    const mode = this.currentModeFilter ?? 'infinite';

    domRefs.dashStats.modeFilterButtons.forEach((button) => {
      const isCurrent = button.dataset.dashStatsMode === mode;
      button.classList.toggle('is-current', isCurrent);
      button.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });

    const bestScore = Number.isFinite(stats.aggregate.bestScore) ? stats.aggregate.bestScore : 0;
    if (domRefs.dashStats.totalBest) {
      if (mode === 'goalRun') {
        domRefs.dashStats.totalBest.textContent = 'GoalRun';
      } else if (mode === 'scoreAttack60') {
        domRefs.dashStats.totalBest.textContent = `${bestScore.toFixed(0)} pt`;
      } else {
        domRefs.dashStats.totalBest.textContent = bestScore.toFixed(1);
      }
    }

    if (domRefs.dashStats.stageBestBody) {
      domRefs.dashStats.stageBestBody.textContent = '';
      DASH_STAGE_IDS.forEach((stageId) => {
        const tr = document.createElement('tr');
        tr.className = `dash-stats-row ${getStageClassName(stageId)}`;
        if (mode === 'goalRun') {
          const bestMs = stats.aggregate?.modes?.goalRun?.bestTimeByStage?.[stageId] ?? null;
          const clearCount = Number(stats.aggregate?.modes?.goalRun?.clearCountByStage?.[stageId] ?? 0);
          const playCount = Number(stats.aggregate?.modes?.goalRun?.playCountByStage?.[stageId] ?? 0);
          const bestText = Number.isFinite(bestMs)
            ? `${Math.floor(bestMs / 1000 / 60)}:${String(Math.floor(bestMs / 1000) % 60).padStart(2, '0')}`
            : '-';
          tr.innerHTML = `<th scope="row">${getDashStageLabelJa(stageId)}</th><td>${bestText}</td><td>${clearCount}/${playCount}</td>`;
        } else if (mode === 'scoreAttack60') {
          const best = Number(stats.aggregate?.modes?.scoreAttack60?.bestScoreByStage?.[stageId] ?? 0);
          tr.innerHTML = `<th scope="row">${getDashStageLabelJa(stageId)}</th><td>${best.toFixed(0)} pt</td><td>-</td>`;
        } else {
          const best = Number(stats.aggregate.stageBest?.[stageId] ?? 0);
          const count = Number(stats.aggregate.stagePlayCount?.[stageId] ?? 0);
          tr.innerHTML = `<th scope="row">${getDashStageLabelJa(stageId)}</th><td>${best.toFixed(1)} m</td><td>${count} 回</td>`;
        }
        domRefs.dashStats.stageBestBody.append(tr);
      });
    }

    if (domRefs.dashStats.historyBody) {
      domRefs.dashStats.historyBody.textContent = '';
      const filteredHistory = stats.history.filter((entry) => {
        const entryMode = String(entry.mode || 'infinite');
        return entryMode === mode;
      });
      filteredHistory.forEach((entry) => {
        const tr = document.createElement('tr');
        const stageId = String(entry.stageId || 'mix');
        tr.className = `dash-stats-row ${getStageClassName(stageId)}`;
        const statusLabel = entry.mode === 'goalRun'
          ? (entry.cleared ? 'CLEAR' : 'FAILED')
          : (entry.retired ? 'リタイア' : '完走');
        const score = Number.isFinite(entry.score) ? entry.score : entry.distanceM;
<<<<<<< codex/summarize-plan-goal.md-for-pr1-bxf68q
        const valueText = entry.mode === 'scoreAttack60' ? `${score.toFixed(0)} pt` : `${score.toFixed(1)} m`;
        const modeLabel = entry.mode === 'goalRun'
          ? 'GoalRun'
          : (entry.mode === 'scoreAttack60' ? 'ScoreAttack60' : 'Infinite');
        tr.innerHTML = `<td>${formatDateTime(entry.endedAt)}</td><td>${getDashStageLabelJa(stageId)}<br><small>${modeLabel}</small></td><td>${valueText}</td><td>${statusLabel}</td>`;
=======
        const stageBest = Number(stats.aggregate.stageBest?.[stageId] ?? 0);
        const isNewBest = score > 0 && Math.abs(score - stageBest) < 0.0001;
        const newBadge = isNewBest ? '<span class="badge dash-badge-new">NEW</span>' : '';
        const modeLabel = entry.mode === 'goalRun' ? 'GoalRun' : 'Infinite';
        tr.innerHTML = `<td>${formatDateTime(entry.endedAt)}</td><td>${getDashStageLabelJa(stageId)}<br><small>${modeLabel}</small></td><td>${score.toFixed(1)} m</td><td>${statusLabel} ${newBadge}</td>`;
>>>>>>> 他モード削除
        domRefs.dashStats.historyBody.append(tr);
      });
    }
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashStatsScreen;
