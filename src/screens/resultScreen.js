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
    domRefs.result.dailyHistorySum.textContent = `直近7日合計：回答 ${attemptSum} / ミス ${wrongSum} / 距離 ${distanceSum.toFixed(1)}m`;
  }
};

const resultScreen = {
  enter() {
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
        domRefs.result.distance.textContent = gameState.distanceM.toFixed(1);
      }
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
      distanceM: gameState.isReviewMode ? 0 : gameState.distanceM,
      attemptTotal: total,
      wrongTotal: gameState.wrongCount,
      wrongByMode: { ...gameState.wrongByMode },
    };
    const todayKey = formatDateKey(new Date());
    let todayRank = todayRankStore.get(todayKey);
    if (!gameState.isReviewMode && gameState.distanceM > 0) {
      todayRank = todayRankStore.update(todayKey, gameState.distanceM);
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
        this.bestToastTimeout = window.setTimeout(() => {
          if (domRefs.result.bestToast) {
            domRefs.result.bestToast.hidden = true;
          }
          this.bestToastTimeout = null;
        }, 1500);
      } else {
        domRefs.result.bestToast.hidden = true;
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
        domRefs.result.dailyHistorySum.textContent = '直近7日合計：回答 0 / ミス 0 / 距離 0.0m';
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
    if (domRefs.result.bestToast) {
      domRefs.result.bestToast.hidden = true;
    }
  },
};

export default resultScreen;
