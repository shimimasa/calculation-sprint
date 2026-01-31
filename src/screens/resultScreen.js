import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';

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

    this.reviewModes = Object.keys(gameState.wrongByMode)
      .filter((mode) => gameState.wrongByMode[mode] > 0);
    if (domRefs.result.reviewButton) {
      domRefs.result.reviewButton.hidden = this.reviewModes.length === 0;
    }

    this.handleRetry = () => {
      gameState.isReviewMode = false;
      gameState.reviewModes = [];
      screenManager.changeScreen('game', { retry: true });
    };
    this.handleReview = () => {
      gameState.isReviewMode = true;
      gameState.reviewModes = this.reviewModes;
      screenManager.changeScreen('game');
    };
    this.handleBack = () => {
      gameState.isReviewMode = false;
      gameState.reviewModes = [];
      screenManager.changeScreen('settings');
    };

    domRefs.result.retryButton.addEventListener('click', this.handleRetry);
    if (domRefs.result.reviewButton) {
      domRefs.result.reviewButton.addEventListener('click', this.handleReview);
    }
    domRefs.result.backButton.addEventListener('click', this.handleBack);
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
  },
};

export default resultScreen;
