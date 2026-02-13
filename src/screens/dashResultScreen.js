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

const dashResultScreen = {
  enter() {
    uiRenderer.showScreen('dash-result');
    this.events = createEventRegistry('dash-result');
    const renderResult = (result) => {
      const endReasonTextMap = {
        collision: 'モンスターにぶつかりました',
        timeup: '時間が0になりました',
        manual: 'ここでいったん終了',
        unknown: '終了理由：不明',
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
      if (domRefs.dashResult.reason) {
        const normalizedReason = typeof result.endReason === 'string' ? result.endReason : 'unknown';
        domRefs.dashResult.reason.textContent = `終了メモ：${endReasonTextMap[normalizedReason] ?? endReasonTextMap.unknown}`;
        domRefs.dashResult.reason.hidden = false;
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
        domRefs.dashResult.defeatedCount.textContent = String(result.defeatedCount || 0);
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
      renderResult(inMemoryResult);
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
