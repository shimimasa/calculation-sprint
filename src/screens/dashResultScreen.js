import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';
import gameState from '../core/gameState.js';
import dashStatsStore from '../core/dashStatsStore.js';
import { getDashStageLabelJa, normalizeDashStageId, toDashStageId } from '../features/dashStages.js';

const calculateRewardTitle = ({ distanceM = 0, accuracy = 0, maxStreak = 0, missRate = 0, correctCount = 0 }) => {
  if (distanceM >= 120 && missRate <= 5) {
    return { title: 'スピードスター', sub: 'ミスが少なく、長い距離を走りきった！' };
  }
  if (maxStreak >= 12) {
    return { title: 'れんぞくせいかい名人', sub: '集中力ばつぐん！連続正解がすごい！' };
  }
  if (accuracy >= 90 && correctCount >= 20) {
    return { title: 'せいかいマスター', sub: '高い正答率で安定したラン！' };
  }
  if (distanceM >= 80) {
    return { title: 'ダッシュレンジャー', sub: 'いいペースでぐんぐん進んだ！' };
  }
  if (correctCount >= 10) {
    return { title: 'コツコツチャレンジャー', sub: '正解を重ねて着実に前進！' };
  }
  return { title: 'がんばりランナー', sub: 'つぎのランでもっとのびる！' };
};


const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const playCelebrationEffect = () => {
  if (prefersReducedMotion()) {
    return;
  }
  const host = domRefs.dashResult.record;
  if (!host) {
    return;
  }

  const previous = host.querySelector('.dash-result-confetti');
  previous?.remove();

  const confetti = document.createElement('div');
  confetti.className = 'dash-result-confetti';
  confetti.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 18; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'dash-result-confetti__piece';
    piece.style.setProperty('--piece-x', `${(i / 18) * 100}%`);
    piece.style.setProperty('--piece-delay', `${(i % 6) * 60}ms`);
    piece.style.setProperty('--piece-rot', `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 8)}deg`);
    piece.style.setProperty('--piece-hue', `${(i * 23) % 360}`);
    confetti.append(piece);
  }

  host.append(confetti);
  window.setTimeout(() => {
    confetti.remove();
  }, 3000);
};

const ensureRewardArea = () => {
  const record = domRefs.dashResult.record;
  if (!record) {
    return null;
  }
  let reward = record.querySelector('.dash-result-reward');
  if (!reward) {
    reward = document.createElement('div');
    reward.className = 'dash-result-reward';
    reward.innerHTML = '<p class="dash-result-reward__kicker">今回の称号</p><p class="dash-result-reward__title"></p><p class="dash-result-reward__sub"></p>';
    record.prepend(reward);
  }
  return reward;
};


const formatGoalRunClearTime = (clearTimeMs) => {
  const totalSeconds = Math.max(0, Math.round((Number(clearTimeMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ensureModeSummaryArea = () => {
  const record = domRefs.dashResult.record;
  if (!record) {
    return null;
  }
  let summary = record.querySelector('.dash-result-mode-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'dash-result-mode-summary';
    summary.hidden = true;
    record.prepend(summary);
  }
  return summary;
};


const getScoreAttackRecordState = (result, stats) => {
  if (result?.mode !== 'scoreAttack60' || !stats) {
    return { isNewRecord: false, previousBest: 0 };
  }
  const stageId = toDashStageId(result.stageId);
  const previousBest = Number(stats.aggregate?.modes?.scoreAttack60?.bestScoreByStage?.[stageId] ?? 0);
  const score = Number(result.score ?? result.totalScore ?? 0);
  return {
    isNewRecord: score > previousBest,
    previousBest,
  };
};

const normalizeDashResultEndReason = (result) => {
  const reason = typeof result?.endReason === 'string' ? result.endReason : null;
  if (reason === 'retired' || reason === 'goal' || reason === 'timeout') {
    return reason;
  }
  if (reason === 'manual') {
    return 'retired';
  }
  if (reason === 'timeup' || reason === 'collision') {
    return 'timeout';
  }
  if (result?.cleared === true) {
    return 'goal';
  }
  if (result?.retired === true) {
    return 'retired';
  }
  return 'timeout';
};
const dashResultScreen = {
  enter() {
    uiRenderer.showScreen('dash-result');
    this.events = createEventRegistry('dash-result');
    const renderResult = (result, options = {}) => {
      const endReasonTextMap = {
        retired: 'ちゅうだん',
        goal: 'ゴール！',
        timeout: 'じかんぎれ',
      };
      const totalAnswered = (result.correctCount || 0) + (result.wrongCount || 0);
      const accuracy = totalAnswered > 0
        ? Math.round((result.correctCount / totalAnswered) * 1000) / 10
        : 0;
      const missRate = totalAnswered > 0
        ? Math.round((result.wrongCount / totalAnswered) * 1000) / 10
        : 0;
      const timeSeconds = Math.max(0, Math.ceil((result.timeLeftMs || 0) / 1000));
      const reward = calculateRewardTitle({
        distanceM: Number(result.distanceM) || 0,
        accuracy,
        maxStreak: Number(result.maxStreak) || 0,
        missRate,
        correctCount: Number(result.correctCount) || 0,
      });
      if (domRefs.dashResult.record) {
        domRefs.dashResult.record.hidden = false;
      }
      if (domRefs.dashResult.message) {
        domRefs.dashResult.message.hidden = true;
      }
      if (domRefs.dashResult.stage) {
        const normalizedStageId = toDashStageId(result.stageId);
        const stageLabel = getDashStageLabelJa(normalizedStageId);
        domRefs.dashResult.stage.textContent = `ステージ：${stageLabel}`;
      }
      const normalizedReason = normalizeDashResultEndReason(result);
      if (domRefs.dashResult.reason) {
        domRefs.dashResult.reason.textContent = `終了メモ：${endReasonTextMap[normalizedReason]}`;
        domRefs.dashResult.reason.hidden = false;
      }

      const modeSummary = ensureModeSummaryArea();
      const isGoalRun = result.mode === 'goalRun';
      const isScoreAttack60 = result.mode === 'scoreAttack60';
      if (modeSummary) {
        if (isGoalRun) {
          const cleared = normalizedReason === 'goal';
          const clearOrFail = cleared ? 'CLEAR' : 'FAILED';
          const rank = String(result.rank || 'C');
          const reachedDistance = Number.isFinite(result.distanceM) ? result.distanceM.toFixed(1) : '0.0';
          const clearTimeLabel = cleared
            ? `クリアタイム: ${formatGoalRunClearTime(result.clearTimeMs)}`
            : `到達距離: ${reachedDistance}m`;
          modeSummary.hidden = false;
          modeSummary.innerHTML = `<p class="dash-result-mode-summary__title">Goal Run</p><p class="dash-result-mode-summary__status" data-cleared="${cleared ? '1' : '0'}">${clearOrFail}</p><p class="dash-result-mode-summary__detail">${clearTimeLabel}</p><p class="dash-result-mode-summary__detail">せいかい: ${Number(result.correctCount) || 0} / ミス: ${Number(result.wrongCount) || 0} / ぶつかった: ${Number(result.hits) || 0}</p><p class="dash-result-mode-summary__detail">せいかいりつ: ${accuracy.toFixed(1)}% / ランク: ${rank}</p>`;
        } else if (isScoreAttack60) {
          const recordState = getScoreAttackRecordState(result, options.previousStats);
          const score = Number(result.score ?? result.totalScore ?? 0);
          const newBadge = recordState.isNewRecord ? '<span class="badge dash-badge-new">NEW RECORD</span>' : '';
          modeSummary.hidden = false;
          modeSummary.innerHTML = `<p class="dash-result-mode-summary__title">Score Attack 60</p><p class="dash-result-mode-summary__status" data-cleared="1">スコア: ${score}${newBadge}</p><p class="dash-result-mode-summary__detail">せいかい: ${Number(result.correctCount) || 0} / ミス: ${Number(result.wrongCount) || 0} / ぶつかった: ${Number(result.hits) || 0}</p><p class="dash-result-mode-summary__detail">せいかいりつ: ${accuracy.toFixed(1)}% / さいだいコンボ: ${Number(result.maxCombo) || 0}</p><p class="dash-result-mode-summary__detail">ミスやぶつかりで じかんがへるよ。60びょうで どれだけスコアをかせげるか！</p>`;
        } else {
          modeSummary.hidden = true;
          modeSummary.textContent = '';
        }
      }

      const rewardArea = ensureRewardArea();
      if (rewardArea) {
        const title = rewardArea.querySelector('.dash-result-reward__title');
        const sub = rewardArea.querySelector('.dash-result-reward__sub');
        if (title) {
          title.textContent = reward.title;
        }
        if (sub) {
          sub.textContent = reward.sub;
        }
      }
      if (domRefs.dashResult.distance) {
        domRefs.dashResult.distance.textContent = Number.isFinite(result.distanceM)
          ? result.distanceM.toFixed(1)
          : '0.0';
      }
      if (domRefs.dashResult.correctCount) {
        domRefs.dashResult.correctCount.textContent = String(result.correctCount || 0);
      }
      if (domRefs.dashResult.wrongCount) {
        domRefs.dashResult.wrongCount.textContent = String(result.wrongCount || 0);
      }
      if (domRefs.dashResult.defeatedCount) {
        const bossCount = Number(result.bossDefeatedCount) || 0;
        const totalDefeated = String(result.defeatedCount || 0);
        domRefs.dashResult.defeatedCount.textContent = bossCount > 0
          ? `${totalDefeated}（ボス ${bossCount}）`
          : totalDefeated;
      }
      if (domRefs.dashResult.accuracy) {
        domRefs.dashResult.accuracy.textContent = accuracy.toFixed(1);
      }
      if (domRefs.dashResult.missRate) {
        domRefs.dashResult.missRate.textContent = missRate.toFixed(1);
      }
      if (domRefs.dashResult.maxStreak) {
        domRefs.dashResult.maxStreak.textContent = String(result.maxStreak || 0);
      }
      if (domRefs.dashResult.timeRemaining) {
        domRefs.dashResult.timeRemaining.textContent = String(timeSeconds);
      }

      const grid = domRefs.dashResult.record?.querySelector('.dash-result-grid');
      if (grid && domRefs.dashResult.reason) {
        domRefs.dashResult.record.append(domRefs.dashResult.reason);
      }

      domRefs.dashResult.replayButton?.classList.add('dash-result-replay-main');
      playCelebrationEffect();
    };
    const inMemoryResult = gameState.dash?.result;
    if (inMemoryResult && typeof inMemoryResult === 'object') {
      const previousStats = dashStatsStore.getStats(gameState.profileId);
      renderResult(inMemoryResult, { previousStats });
      dashStatsStore.finalizeRun(inMemoryResult);
    } else {
      const storedResult = dashStatsStore.getSession(gameState.profileId);
      if (storedResult) {
        renderResult(storedResult);
      } else {
        if (domRefs.dashResult.record) {
          domRefs.dashResult.record.hidden = true;
        }
        if (domRefs.dashResult.message) {
          domRefs.dashResult.message.hidden = false;
        }
        if (domRefs.dashResult.reason) {
          domRefs.dashResult.reason.hidden = true;
        }
      }
    }
    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };
    this.handleReplay = () => {
      audioManager.playSfx('sfx_confirm');
      const stageId = gameState.dash?.stageId;
      const nextScreen = normalizeDashStageId(stageId) ? 'dash-game' : 'dash-stage-select';
      screenManager.changeScreen(nextScreen);
    };
    this.handleSettings = () => {
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('dash-settings', { backScreen: 'dash-result' });
    };
    this.handleStats = () => {
      audioManager.playSfx('sfx_click');
      screenManager.changeScreen('dash-stats');
    };
    this.events.on(domRefs.dashResult.backButton, 'click', this.handleBack);
    this.events.on(domRefs.dashResult.replayButton, 'click', this.handleReplay);
    this.events.on(domRefs.dashResult.settingsButton, 'click', this.handleSettings);
    this.events.on(domRefs.dashResult.statsButton, 'click', this.handleStats);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashResultScreen;
