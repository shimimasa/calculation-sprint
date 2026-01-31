import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import timer from '../core/timer.js';
import questionGenerator from '../features/questionGenerator.js';
import buildReviewSummary from '../core/reviewSummary.js';

const gameScreen = {
  enter() {
    uiRenderer.showScreen('game');
    gameState.timeLeft = gameState.timeLimit;
    gameState.correctCount = 0;
    gameState.wrongCount = 0;
    gameState.totalAnswered = 0;
    gameState.totalAnswerTimeMs = 0;
    gameState.questionStartAtMs = 0;
    gameState.answeredCountForTiming = 0;
    Object.keys(gameState.wrongByMode).forEach((key) => {
      gameState.wrongByMode[key] = 0;
    });
    Object.keys(gameState.attemptByMode).forEach((key) => {
      gameState.attemptByMode[key] = 0;
    });
    if (!gameState.isReviewMode) {
      gameState.reviewAnsweredCount = 0;
      gameState.speedMps = 2.0;
      gameState.distanceM = 0;
    }
    uiRenderer.clearFeedback();
    this.feedbackTimeoutId = null;
    this.isLocked = false;

    this.handleKeyDown = (event) => {
      if (event.key !== 'Enter') {
        return;
      }
      this.submitAnswer();
    };

    domRefs.game.answerInput.addEventListener('keydown', this.handleKeyDown);
    this.loadNextQuestion();
    this.startTimer();
    domRefs.game.answerInput.focus();
  },
  startTimer() {
    timer.start(
      gameState.timeLimit,
      (timeLeft) => {
        gameState.timeLeft = timeLeft;
      },
      () => this.handleTimeUp(),
    );
  },
  handleTimeUp() {
    this.isLocked = true;
    if (this.feedbackTimeoutId) {
      window.clearTimeout(this.feedbackTimeoutId);
      this.feedbackTimeoutId = null;
    }
    uiRenderer.clearFeedback();
    screenManager.changeScreen('result');
  },
  loadNextQuestion() {
    gameState.currentQuestion = questionGenerator.next({
      ...gameState.settings,
      reviewModes: gameState.isReviewMode ? gameState.reviewModes : [],
    });
    domRefs.game.answerInput.value = '';
    gameState.questionStartAtMs = performance.now();
  },
  submitAnswer() {
    if (this.isLocked) {
      return;
    }
    if (!gameState.currentQuestion) {
      return;
    }
    const elapsedMs = performance.now() - gameState.questionStartAtMs;
    const rawValue = domRefs.game.answerInput.value.trim();
    const answerValue = Number(rawValue);
    const isCorrect = Number.isFinite(answerValue)
      && gameState.currentQuestion
      && answerValue === gameState.currentQuestion.answer;
    const mode = gameState.currentQuestion?.meta?.mode;
    const isTrackableMode = mode && Object.prototype.hasOwnProperty.call(gameState.wrongByMode, mode);

    if (isTrackableMode) {
      gameState.attemptByMode[mode] += 1;
    }

    gameState.totalAnswerTimeMs += elapsedMs;
    gameState.answeredCountForTiming += 1;
    gameState.totalAnswered += 1;
    if (gameState.isReviewMode) {
      gameState.reviewAnsweredCount += 1;
    }
    if (isCorrect) {
      gameState.correctCount += 1;
      uiRenderer.setFeedback('◯', 'correct');
    } else {
      gameState.wrongCount += 1;
      if (isTrackableMode) {
        gameState.wrongByMode[mode] += 1;
      }
      uiRenderer.setFeedback(`× 正解: ${gameState.currentQuestion.answer}`, 'wrong');
    }

    if (!gameState.isReviewMode) {
      if (isCorrect) {
        gameState.speedMps = Math.min(gameState.maxSpeedMps, gameState.speedMps + gameState.speedUp);
      } else {
        gameState.speedMps = Math.max(gameState.minSpeedMps, gameState.speedMps - gameState.speedDown);
      }
    }

    if (gameState.isReviewMode && gameState.reviewAnsweredCount >= gameState.reviewQuestionLimit) {
      this.isLocked = true;
      if (this.feedbackTimeoutId) {
        window.clearTimeout(this.feedbackTimeoutId);
        this.feedbackTimeoutId = null;
      }
      uiRenderer.clearFeedback();
      gameState.reviewCompleted = true;
      gameState.reviewSummary = buildReviewSummary(
        gameState.wrongByMode,
        gameState.attemptByMode,
        gameState.settings,
      );
      screenManager.changeScreen('result');
      return;
    }

    if (this.feedbackTimeoutId) {
      window.clearTimeout(this.feedbackTimeoutId);
    }
    this.feedbackTimeoutId = window.setTimeout(() => {
      uiRenderer.clearFeedback();
      this.loadNextQuestion();
      this.isLocked = false;
      domRefs.game.answerInput.focus();
    }, 500);
    this.isLocked = true;
  },
  update(dtMs) {
    if (gameState.isReviewMode) {
      return;
    }
    const dtSec = dtMs / 1000;
    if (!Number.isFinite(dtSec) || dtSec <= 0) {
      return;
    }
    gameState.speedMps = Math.max(
      gameState.minSpeedMps,
      gameState.speedMps - gameState.frictionMpsPerSec * dtSec,
    );
    gameState.distanceM += gameState.speedMps * dtSec;
  },
  render() {
    if (gameState.currentQuestion) {
      domRefs.game.question.textContent = gameState.currentQuestion.text;
    }
    domRefs.game.timeLeft.textContent = String(gameState.timeLeft);
    domRefs.game.correctCount.textContent = String(gameState.correctCount);
    domRefs.game.wrongCount.textContent = String(gameState.wrongCount);
    if (domRefs.game.distance) {
      const distanceValue = gameState.isReviewMode ? 0 : gameState.distanceM;
      domRefs.game.distance.textContent = distanceValue.toFixed(1);
    }
    if (domRefs.game.speed) {
      const speedValue = gameState.isReviewMode ? 0 : gameState.speedMps;
      domRefs.game.speed.textContent = speedValue.toFixed(1);
    }
    if (domRefs.game.runner) {
      const rawTrackLength = domRefs.game.runnerTrack?.clientWidth;
      const trackLength = rawTrackLength && rawTrackLength > 0 ? rawTrackLength : 520;
      const distanceValue = gameState.isReviewMode ? 0 : gameState.distanceM;
      const pxPerMeter = 12;
      const runnerX = (distanceValue * pxPerMeter) % trackLength;
      domRefs.game.runner.style.transform = `translateX(${runnerX}px)`;
    }
    if (domRefs.game.reviewProgress) {
      if (gameState.isReviewMode) {
        domRefs.game.reviewProgress.hidden = false;
        domRefs.game.reviewProgress.textContent = `復習: ${gameState.reviewAnsweredCount}/${gameState.reviewQuestionLimit}`;
      } else {
        domRefs.game.reviewProgress.hidden = true;
      }
    }
  },
  exit() {
    timer.stop();
    if (this.handleKeyDown) {
      domRefs.game.answerInput.removeEventListener('keydown', this.handleKeyDown);
    }
    if (this.feedbackTimeoutId) {
      window.clearTimeout(this.feedbackTimeoutId);
    }
    this.feedbackTimeoutId = null;
    this.isLocked = false;
  },
};

export default gameScreen;
