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

const dashStatsScreen = {
  enter() {
    uiRenderer.showScreen('dash-stats');
    this.events = createEventRegistry('dash-stats');

    const stats = dashStatsStore.getStats();
    const bestScore = Number.isFinite(stats.aggregate.bestScore) ? stats.aggregate.bestScore : 0;
    if (domRefs.dashStats.totalBest) {
      domRefs.dashStats.totalBest.textContent = bestScore.toFixed(1);
    }

    if (domRefs.dashStats.stageBestBody) {
      domRefs.dashStats.stageBestBody.textContent = '';
      DASH_STAGE_IDS.forEach((stageId) => {
        const tr = document.createElement('tr');
        tr.className = `dash-stats-row ${getStageClassName(stageId)}`;
        const best = Number(stats.aggregate.stageBest?.[stageId] ?? 0);
        const count = Number(stats.aggregate.stagePlayCount?.[stageId] ?? 0);
        tr.innerHTML = `<th scope="row">${getDashStageLabelJa(stageId)}</th><td>${best.toFixed(1)} m</td><td>${count} 回</td>`;
        domRefs.dashStats.stageBestBody.append(tr);
      });
    }

    if (domRefs.dashStats.historyBody) {
      domRefs.dashStats.historyBody.textContent = '';
      stats.history.forEach((entry) => {
        const tr = document.createElement('tr');
        const stageId = String(entry.stageId || 'mix');
        tr.className = `dash-stats-row ${getStageClassName(stageId)}`;
        const statusLabel = entry.mode === 'goalRun'
          ? (entry.cleared ? 'CLEAR' : 'FAILED')
          : (entry.retired ? 'リタイア' : '完走');
        const score = Number.isFinite(entry.score) ? entry.score : entry.distanceM;
        const stageBest = Number(stats.aggregate.stageBest?.[stageId] ?? 0);
        const isNewBest = score > 0 && Math.abs(score - stageBest) < 0.0001;
        const newBadge = isNewBest ? '<span class="badge dash-badge-new">NEW</span>' : '';
        const modeLabel = entry.mode === 'goalRun'
          ? 'GoalRun'
          : (entry.mode === 'scoreAttack60' ? 'ScoreAttack60' : 'Infinite');
        tr.innerHTML = `<td>${formatDateTime(entry.endedAt)}</td><td>${getDashStageLabelJa(stageId)}<br><small>${modeLabel}</small></td><td>${score.toFixed(1)} m</td><td>${statusLabel} ${newBadge}</td>`;
        domRefs.dashStats.historyBody.append(tr);
      });
    }

    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };

    this.events.on(domRefs.dashStats.backButton, 'click', this.handleBack);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashStatsScreen;
