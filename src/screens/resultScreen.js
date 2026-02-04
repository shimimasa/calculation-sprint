import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import dailyStatsStore from '../core/dailyStatsStore.js';
import todayRankStore from '../core/todayRankStore.js';

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatSignedNumber = (value, digits = 1) => {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
};

const formatRankValue = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}m` : '---');

// 距離ボーナス係数テーブル:
// add: 1.00 / sub: 1.05 / mul: 1.10 / div: 1.15 / mix: 1.08
// digit=2 は +0.05、carry=true は +0.03 を上乗せする。
const DISTANCE_MULTIPLIER_TABLE = Object.freeze({
  add: 1.0,
  sub: 1.05,
  mul: 1.1,
  div: 1.15,
  mix: 1.08,
});
const DISTANCE_DIGIT_BONUS = 0.05;
const DISTANCE_CARRY_BONUS = 0.03;

const calculateDistanceMultiplier = (settings) => {
  const base = DISTANCE_MULTIPLIER_TABLE[settings?.mode] ?? 1.0;
  const digitBonus = Number(settings?.digit) === 2 ? DISTANCE_DIGIT_BONUS : 0;
  const carryBonus = settings?.carry ? DISTANCE_CARRY_BONUS : 0;
  return base + digitBonus + carryBonus;
};

// 称号（優先順）:
// S: ノーミスランナー（ミス0）
// A: スピードスター（平均<=1.5秒/問）
// A: 連続正解王（最大連続正解>=10）
// B: 挑戦者（かけ算/わり算/ミックス）
// B: 安定走（正答率>=90%）
const selectSessionTitle = (stats) => {
  if (stats.wrongCount === 0 && stats.total > 0) {
    return { title: 'ノーミスランナー', message: 'ノーミスで走り切った！' };
  }
  if (stats.avgSec > 0 && stats.avgSec <= 1.5) {
    return { title: 'スピードスター', message: '速さで走り切った！' };
  }
  if (stats.maxStreak >= 10) {
    return { title: '連続正解王', message: '連続正解の勢いが光った！' };
  }
  if (['mul', 'div', 'mix'].includes(stats.mode)) {
    return { title: '挑戦者', message: '難しい演算に挑戦した！' };
  }
  if (stats.accuracy >= 90 && stats.total > 0) {
    return { title: '安定走', message: '安定した走りだった！' };
  }
  return { title: '称号なし', message: '次は称号を狙ってみよう！' };
};

const renderDailyHistory = (records) => {
  const tbody = domRefs.result.dailyHistoryBody;
  if (tbody) {
    tbody.innerHTML = '';
  }
  const bestCandidates = records.filter(({ record }) => typeof record.bestAvgSec === 'number');
  let bestKey = null;
  if (bestCandidates.length > 0) {
    let bestRecord = bestCandidates[0];
    for (let i = 1; i < bestCandidates.length; i += 1) {
      const current = bestCandidates[i];
      if (current.record.bestAvgSec < bestRecord.record.bestAvgSec) {
        bestRecord = current;
      }
    }
    bestKey = bestRecord.dateKey;
  }
  const bestDistanceCandidates = records.filter(({ record }) => typeof record.bestDistanceM === 'number');
  let bestDistanceKey = null;
  if (bestDistanceCandidates.length > 0) {
    let bestDistanceRecord = bestDistanceCandidates[0];
    for (let i = 1; i < bestDistanceCandidates.length; i += 1) {
      const current = bestDistanceCandidates[i];
      if (current.record.bestDistanceM > bestDistanceRecord.record.bestDistanceM) {
        bestDistanceRecord = current;
      }
    }
    bestDistanceKey = bestDistanceRecord.dateKey;
  }
  let attemptSum = 0;
  let wrongSum = 0;
  let distanceSum = 0;
  records.forEach(({ dateKey, record }) => {
    attemptSum += record.attemptTotal;
    wrongSum += record.wrongTotal;
    if (typeof record.bestDistanceM === 'number') {
      distanceSum += record.bestDistanceM;
    }
    const row = document.createElement('tr');
    if (bestKey && bestKey === dateKey) {
      row.classList.add('is-best');
    }
    if (bestDistanceKey && bestDistanceKey === dateKey) {
      row.classList.add('is-best-distance');
    }
    const bestAvg = record.bestAvgSec ?? 0;
    const bestDistanceM = record.bestDistanceM ?? 0;
    const cells = [
      dateKey,
      bestAvg.toFixed(1),
      bestDistanceM.toFixed(1),
      String(record.attemptTotal),
      String(record.wrongTotal),
    ];
    cells.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    if (tbody) {
      tbody.appendChild(row);
    }
  });
  if (domRefs.result.dailyHistorySum) {
    domRefs.result.dailyHistorySum.textContent = `直近7日合計：回答 ${attemptSum} / ミス ${wrongSum} / 距離 ${distanceSum.toFixed(1)}m（ボーナス込み）`;
  }
};

const resultScreen = {
  enter() {
    if (this.bestToastTimeout) {
      clearTimeout(this.bestToastTimeout);
      this.bestToastTimeout = null;
    }
    if (this.confettiTimeout) {
      clearTimeout(this.confettiTimeout);
      this.confettiTimeout = null;
    }
    if (domRefs.screens.result) {
      domRefs.screens.result.classList.remove('is-confetti');
    }
    uiRenderer.showScreen('result');
    const total = gameState.totalAnswered || 0;
    const accuracy = total > 0
      ? Math.round((gameState.correctCount / total) * 100)
      : 0;
    const avgSec = gameState.answeredCountForTiming > 0
      ? gameState.totalAnswerTimeMs / gameState.answeredCountForTiming / 1000
      : 0;
    if (avgSec > 0) {
      if (gameState.bestAvgSecSession === null || avgSec < gameState.bestAvgSecSession) {
        gameState.bestAvgSecSession = avgSec;
      }
    }
    const bestAvgSecSession = gameState.bestAvgSecSession ?? 0;

    const rawDistanceM = gameState.isReviewMode ? 0 : gameState.distanceM;
    const distanceMultiplier = calculateDistanceMultiplier(gameState.settings);
    const bonusDistanceM = rawDistanceM * distanceMultiplier;
    const bonusDeltaM = bonusDistanceM - rawDistanceM;

    const sessionTitle = selectSessionTitle({
      wrongCount: gameState.wrongCount,
      avgSec,
      maxStreak: gameState.maxStreak,
      mode: gameState.settings.mode,
      accuracy,
      total,
    });

    domRefs.result.correctCount.textContent = String(gameState.correctCount);
    domRefs.result.wrongCount.textContent = String(gameState.wrongCount);
    domRefs.result.totalAnswered.textContent = String(total);
    domRefs.result.accuracy.textContent = String(accuracy);
    domRefs.result.avgTime.textContent = avgSec.toFixed(1);
    domRefs.result.bestAvgTime.textContent = bestAvgSecSession.toFixed(1);
    if (domRefs.result.distance && domRefs.result.distanceRow) {
      if (gameState.isReviewMode) {
        domRefs.result.distanceRow.hidden = true;
        domRefs.result.distance.textContent = '0.0';
      } else {
        domRefs.result.distanceRow.hidden = false;
        domRefs.result.distance.textContent = bonusDistanceM.toFixed(1);
      }
    }
    if (domRefs.result.rawDistance) {
      domRefs.result.rawDistance.textContent = rawDistanceM.toFixed(1);
    }
    if (domRefs.result.bonusDistance) {
      domRefs.result.bonusDistance.textContent = formatSignedNumber(bonusDeltaM, 1);
    }
    if (domRefs.result.distanceMultiplier) {
      domRefs.result.distanceMultiplier.textContent = distanceMultiplier.toFixed(2);
    }
    if (domRefs.result.title) {
      domRefs.result.title.textContent = sessionTitle.title;
    }
    if (domRefs.result.titleMessage) {
      domRefs.result.titleMessage.textContent = sessionTitle.message;
    }
    ['add', 'sub', 'mul', 'div'].forEach((mode) => {
      const attempt = gameState.attemptByMode[mode];
      const wrong = gameState.wrongByMode[mode];
      const correct = Math.max(0, attempt - wrong);
      const rate = attempt > 0 ? Math.round((correct / attempt) * 100) : 0;
      const label = `${rate}% (${correct}/${attempt})`;
      const targetKey = `rate${mode[0].toUpperCase()}${mode.slice(1)}`;
      if (domRefs.result[targetKey]) {
        domRefs.result[targetKey].textContent = label;
      }
    });
    domRefs.result.wrongAdd.textContent = String(gameState.wrongByMode.add);
    domRefs.result.wrongSub.textContent = String(gameState.wrongByMode.sub);
    domRefs.result.wrongMul.textContent = String(gameState.wrongByMode.mul);
    domRefs.result.wrongDiv.textContent = String(gameState.wrongByMode.div);

    if (domRefs.result.reviewBanner && domRefs.result.reviewMessage) {
      if (gameState.reviewCompleted) {
        domRefs.result.reviewBanner.hidden = false;
        domRefs.result.reviewMessage.textContent = gameState.reviewSummary?.message || '';
        if (domRefs.result.nextActionButton) {
          const nextAction = gameState.reviewSummary?.nextAction || null;
          if (nextAction) {
            domRefs.result.nextActionButton.hidden = false;
            domRefs.result.nextActionButton.textContent = nextAction.label;
          } else {
            domRefs.result.nextActionButton.hidden = true;
            domRefs.result.nextActionButton.textContent = '';
          }
        }
      } else {
        domRefs.result.reviewBanner.hidden = true;
        domRefs.result.reviewMessage.textContent = '';
        if (domRefs.result.nextActionButton) {
          domRefs.result.nextActionButton.hidden = true;
          domRefs.result.nextActionButton.textContent = '';
        }
      }
    }

    this.reviewModes = Object.keys(gameState.wrongByMode)
      .filter((mode) => gameState.wrongByMode[mode] > 0);
    if (domRefs.result.reviewButton) {
      domRefs.result.reviewButton.hidden = this.reviewModes.length === 0;
    }

    const sessionStats = {
      avgSec,
      distanceM: gameState.isReviewMode ? 0 : bonusDistanceM,
      attemptTotal: total,
      wrongTotal: gameState.wrongCount,
      wrongByMode: { ...gameState.wrongByMode },
    };
    const todayKey = formatDateKey(new Date());
    let todayRank = todayRankStore.get(todayKey);
    if (!gameState.isReviewMode && bonusDistanceM > 0) {
      todayRank = todayRankStore.update(todayKey, bonusDistanceM);
    }
    if (domRefs.result.todayRank) {
      domRefs.result.todayRank.hidden = gameState.isReviewMode;
    }
    const rankTargets = [
      domRefs.result.todayRankFirst,
      domRefs.result.todayRankSecond,
      domRefs.result.todayRankThird,
    ];
    rankTargets.forEach((target, index) => {
      if (!target) {
        return;
      }
      target.textContent = formatRankValue(todayRank.top[index]);
    });
    if (domRefs.result.top3Message) {
      if (gameState.isReviewMode || bonusDistanceM <= 0) {
        domRefs.result.top3Message.hidden = true;
        domRefs.result.top3Message.textContent = '';
      } else {
        const topValues = todayRank.top
          .filter((value) => Number.isFinite(value))
          .sort((a, b) => b - a);
        let message = 'TOP3を狙おう！';
        if (topValues.length === 0) {
          message = '今日の1位に！';
        } else {
          const rank = topValues.findIndex((value) => bonusDistanceM >= value - 0.0001) + 1;
          if (rank > 0 && rank <= 3) {
            message = `今日の${rank}位にランクイン！`;
          } else if (topValues.length >= 3) {
            const diff = Math.max(0, topValues[2] - bonusDistanceM);
            message = `TOP3まであと${diff.toFixed(1)}m`;
          }
        }
        domRefs.result.top3Message.textContent = message;
        domRefs.result.top3Message.hidden = false;
      }
    }
    const todayRecordOld = dailyStatsStore.get(todayKey);
    const todayRecord = dailyStatsStore.upsert(todayKey, sessionStats);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayRecord = dailyStatsStore.get(formatDateKey(yesterday));

    const oldBestAvgSec = todayRecordOld?.bestAvgSec ?? null;
    const newBestAvgSec = todayRecord.bestAvgSec ?? null;
    const isBestAvgUpdated = newBestAvgSec !== null
      && (oldBestAvgSec === null || newBestAvgSec < oldBestAvgSec);
    const oldBestDistanceM = todayRecordOld?.bestDistanceM ?? null;
    const newBestDistanceM = todayRecord.bestDistanceM ?? null;
    const isBestDistanceUpdated = newBestDistanceM !== null
      && (oldBestDistanceM === null || newBestDistanceM > oldBestDistanceM);
    const shouldShowBestToast = isBestAvgUpdated || isBestDistanceUpdated;

    if (domRefs.result.bestToast) {
      if (this.bestToastTimeout) {
        clearTimeout(this.bestToastTimeout);
        this.bestToastTimeout = null;
      }
      if (shouldShowBestToast) {
        domRefs.result.bestToast.hidden = false;
        if (domRefs.screens.result) {
          domRefs.screens.result.classList.add('is-confetti');
          if (this.confettiTimeout) {
            clearTimeout(this.confettiTimeout);
          }
          this.confettiTimeout = window.setTimeout(() => {
            if (domRefs.screens.result) {
              domRefs.screens.result.classList.remove('is-confetti');
            }
            this.confettiTimeout = null;
          }, 1200);
        }
        this.bestToastTimeout = window.setTimeout(() => {
          if (domRefs.result.bestToast) {
            domRefs.result.bestToast.hidden = true;
          }
          this.bestToastTimeout = null;
        }, 1500);
      } else {
        domRefs.result.bestToast.hidden = true;
        if (domRefs.screens.result) {
          domRefs.screens.result.classList.remove('is-confetti');
        }
      }
    }

    if (domRefs.result.dailyBestAvg) {
      const bestAvg = todayRecord.bestAvgSec ?? 0;
      domRefs.result.dailyBestAvg.textContent = bestAvg.toFixed(1);
    }
    if (domRefs.result.dailyBestDistance) {
      const bestDistanceM = todayRecord.bestDistanceM ?? 0;
      domRefs.result.dailyBestDistance.textContent = bestDistanceM.toFixed(1);
    }
    if (domRefs.result.dailyAttempt) {
      domRefs.result.dailyAttempt.textContent = String(todayRecord.attemptTotal);
    }
    if (domRefs.result.dailyWrong) {
      domRefs.result.dailyWrong.textContent = String(todayRecord.wrongTotal);
    }
    if (domRefs.result.dailyDiffWrap) {
      if (yesterdayRecord) {
        domRefs.result.dailyDiffWrap.hidden = false;
        if (domRefs.result.diffBestAvg) {
          if (todayRecord.bestAvgSec !== null && yesterdayRecord.bestAvgSec !== null) {
            const diffBestAvg = todayRecord.bestAvgSec - yesterdayRecord.bestAvgSec;
            domRefs.result.diffBestAvg.textContent = formatSignedNumber(diffBestAvg, 1);
          } else {
            domRefs.result.diffBestAvg.textContent = '0.0';
          }
        }
        if (domRefs.result.diffWrong) {
          const diffWrong = todayRecord.wrongTotal - yesterdayRecord.wrongTotal;
          domRefs.result.diffWrong.textContent = formatSignedNumber(diffWrong, 0);
        }
      } else {
        domRefs.result.dailyDiffWrap.hidden = true;
      }
    }

    const recentRecords = [];
    for (let offset = 0; offset <= 6; offset += 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const dateKey = formatDateKey(date);
      const record = dateKey === todayKey ? todayRecord : dailyStatsStore.get(dateKey);
      if (record) {
        recentRecords.push({ dateKey, record });
      }
    }
    renderDailyHistory(recentRecords);

    this.handleDailyReset = () => {
      if (!domRefs.result.dailyResetButton) {
        return;
      }
      const shouldReset = window.confirm('記録をリセットしますか？');
      if (!shouldReset) {
        return;
      }
      dailyStatsStore.reset();
      if (domRefs.result.dailyBestAvg) {
        domRefs.result.dailyBestAvg.textContent = '0.0';
      }
      if (domRefs.result.dailyBestDistance) {
        domRefs.result.dailyBestDistance.textContent = '0.0';
      }
      if (domRefs.result.dailyAttempt) {
        domRefs.result.dailyAttempt.textContent = '0';
      }
      if (domRefs.result.dailyWrong) {
        domRefs.result.dailyWrong.textContent = '0';
      }
      if (domRefs.result.dailyDiffWrap) {
        domRefs.result.dailyDiffWrap.hidden = true;
      }
      if (domRefs.result.diffBestAvg) {
        domRefs.result.diffBestAvg.textContent = '0.0';
      }
      if (domRefs.result.diffWrong) {
        domRefs.result.diffWrong.textContent = '0';
      }
      if (domRefs.result.dailyHistoryBody) {
        domRefs.result.dailyHistoryBody.innerHTML = '';
      }
      if (domRefs.result.dailyHistorySum) {
        domRefs.result.dailyHistorySum.textContent = '直近7日合計：回答 0 / ミス 0 / 距離 0.0m（ボーナス込み）';
      }
      if (domRefs.result.bestToast) {
        if (this.bestToastTimeout) {
          clearTimeout(this.bestToastTimeout);
          this.bestToastTimeout = null;
        }
        domRefs.result.bestToast.hidden = true;
      }
    };

    this.handleRetry = () => {
      gameState.isReviewMode = false;
      gameState.reviewModes = [];
      gameState.reviewCompleted = false;
      gameState.reviewSummary = { topMode: null, message: '', nextAction: null };
      screenManager.changeScreen('game', { retry: true });
    };
    this.handleReview = () => {
      gameState.isReviewMode = true;
      gameState.reviewModes = this.reviewModes;
      gameState.reviewAnsweredCount = 0;
      gameState.reviewCompleted = false;
      gameState.reviewSummary = { topMode: null, message: '', nextAction: null };
      screenManager.changeScreen('game');
    };
    this.handleBack = () => {
      gameState.isReviewMode = false;
      gameState.reviewModes = [];
      gameState.reviewCompleted = false;
      gameState.reviewSummary = { topMode: null, message: '', nextAction: null };
      screenManager.changeScreen('settings');
    };
    this.handleNextAction = () => {
      const nextAction = gameState.reviewSummary?.nextAction;
      if (!nextAction) {
        return;
      }
      Object.assign(gameState.settings, nextAction.presetPatch);
      gameState.isReviewMode = false;
      gameState.reviewModes = [];
      gameState.reviewCompleted = false;
      gameState.reviewSummary = { topMode: null, message: '', nextAction: null };
      screenManager.changeScreen('settings');
    };

    domRefs.result.retryButton.addEventListener('click', this.handleRetry);
    if (domRefs.result.reviewButton) {
      domRefs.result.reviewButton.addEventListener('click', this.handleReview);
    }
    domRefs.result.backButton.addEventListener('click', this.handleBack);
    if (domRefs.result.nextActionButton) {
      domRefs.result.nextActionButton.addEventListener('click', this.handleNextAction);
    }
    if (domRefs.result.dailyResetButton) {
      domRefs.result.dailyResetButton.addEventListener('click', this.handleDailyReset);
    }
  },
  render() {},
  exit() {
    if (this.handleRetry) {
      domRefs.result.retryButton.removeEventListener('click', this.handleRetry);
    }
    if (this.handleReview && domRefs.result.reviewButton) {
      domRefs.result.reviewButton.removeEventListener('click', this.handleReview);
    }
    if (this.handleBack) {
      domRefs.result.backButton.removeEventListener('click', this.handleBack);
    }
    if (this.handleNextAction && domRefs.result.nextActionButton) {
      domRefs.result.nextActionButton.removeEventListener('click', this.handleNextAction);
    }
    if (this.handleDailyReset && domRefs.result.dailyResetButton) {
      domRefs.result.dailyResetButton.removeEventListener('click', this.handleDailyReset);
    }
    if (this.bestToastTimeout) {
      clearTimeout(this.bestToastTimeout);
      this.bestToastTimeout = null;
    }
    if (this.confettiTimeout) {
      clearTimeout(this.confettiTimeout);
      this.confettiTimeout = null;
    }
    if (domRefs.result.bestToast) {
      domRefs.result.bestToast.hidden = true;
    }
    if (domRefs.screens.result) {
      domRefs.screens.result.classList.remove('is-confetti');
    }
  },
};

export default resultScreen;
