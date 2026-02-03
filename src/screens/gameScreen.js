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
    this.effectTimeoutIds = [];
    this.isLocked = false;
    this.bgOffsetPx = 0;
    this.resetEffects();

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
    this.stumbleTimeoutId = null;
    this.runnerSpeedTier = null;
  },
  clearEffectTimeouts() {
    if (!this.effectTimeoutIds) {
      return;
    }
    this.effectTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.effectTimeoutIds = [];
  },
  clearStumbleTimeout() {
    if (!this.stumbleTimeoutId) {
      return;
    }
    if (Array.isArray(this.stumbleTimeoutId)) {
      this.stumbleTimeoutId.forEach((timeoutId) => window.clearTimeout(timeoutId));
    } else {
      window.clearTimeout(this.stumbleTimeoutId);
    }
    this.stumbleTimeoutId = null;
  },
  resetEffects() {
    domRefs.game.runner?.classList.remove(
      'boost',
      'hit',
      'stumble',
      'runner-speed-low',
      'runner-speed-mid',
      'runner-speed-high',
    );
    domRefs.game.speedLines?.classList.remove('boost-lines');
    domRefs.game.speed?.classList.remove('glow');
    domRefs.game.runWorld?.classList.remove('miss-flash');
    domRefs.game.runWorld?.classList.remove('stumble-freeze');
    domRefs.game.runWorld?.classList.remove('is-fast', 'is-rapid');
    domRefs.game.speedLines?.classList.remove('is-fast', 'is-rapid');
    domRefs.game.runner?.classList.remove('speed-glow');
    domRefs.game.runnerWrap?.classList.remove('is-fast', 'is-rapid');
    domRefs.game.runBg?.style.removeProperty('--stumble-freeze-x');
    this.runnerSpeedTier = null;
  },
  queueEffectReset(callback, delayMs) {
    const timeoutId = window.setTimeout(() => {
      callback();
      this.effectTimeoutIds = this.effectTimeoutIds.filter((id) => id !== timeoutId);
    }, delayMs);
    this.effectTimeoutIds.push(timeoutId);
  },
  triggerBoostEffect() {
    if (!domRefs.game.runner) {
      return;
    }
    domRefs.game.runner.classList.remove('hit');
    domRefs.game.runner.classList.add('boost');
    domRefs.game.speedLines?.classList.add('boost-lines');
    domRefs.game.speed?.classList.add('glow');
    this.queueEffectReset(() => {
      domRefs.game.runner?.classList.remove('boost');
      domRefs.game.speedLines?.classList.remove('boost-lines');
      domRefs.game.speed?.classList.remove('glow');
    }, 250);
  },
  triggerHitEffect() {
    if (!domRefs.game.runner) {
      return;
    }
    if (domRefs.game.runner.classList.contains('stumble')) {
      return;
    }
    domRefs.game.runner.classList.remove('boost');
    domRefs.game.runner.classList.add('hit');
    domRefs.game.runWorld?.classList.add('miss-flash');
    this.queueEffectReset(() => {
      domRefs.game.runner?.classList.remove('hit');
      domRefs.game.runWorld?.classList.remove('miss-flash');
    }, 200);
  },
  triggerStumbleEffect() {
    if (!domRefs.game.runner) {
      return;
    }
    this.clearStumbleTimeout();
    domRefs.game.runner.classList.remove('hit', 'boost');
    domRefs.game.speedLines?.classList.remove('boost-lines');
    domRefs.game.speed?.classList.remove('glow');
    domRefs.game.runner.classList.add('stumble');
    const timeoutIds = [];
    if (!gameState.isReviewMode) {
      domRefs.game.runWorld?.classList.add('stumble-freeze');
      domRefs.game.runBg?.style.setProperty('--stumble-freeze-x', `${this.bgOffsetPx}px`);
      timeoutIds.push(
        window.setTimeout(() => {
          domRefs.game.runWorld?.classList.remove('stumble-freeze');
          domRefs.game.runBg?.style.removeProperty('--stumble-freeze-x');
        }, 120),
      );
    }
    timeoutIds.push(window.setTimeout(() => {
      domRefs.game.runner?.classList.remove('stumble');
      domRefs.game.runWorld?.classList.remove('stumble-freeze');
      domRefs.game.runBg?.style.removeProperty('--stumble-freeze-x');
      this.stumbleTimeoutId = null;
    }, 320));
    this.stumbleTimeoutId = timeoutIds;
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
    this.clearEffectTimeouts();
    this.clearStumbleTimeout();
    this.resetEffects();
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
        this.triggerBoostEffect();
      } else {
        gameState.speedMps = Math.max(gameState.minSpeedMps, gameState.speedMps - gameState.speedDown);
        this.triggerStumbleEffect();
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
    const bgFactor = 42;
    const loopWidthPx = 1200;
    const isBgFrozen = domRefs.game.runWorld?.classList.contains('stumble-freeze');
    if (!isBgFrozen) {
      this.bgOffsetPx -= gameState.speedMps * dtSec * bgFactor;
      if (this.bgOffsetPx <= -loopWidthPx) {
        this.bgOffsetPx += loopWidthPx;
      }
    }
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
    if (domRefs.game.runBg) {
      const bgOffset = gameState.isReviewMode ? 0 : this.bgOffsetPx;
      domRefs.game.runBg.style.backgroundPositionX = `${bgOffset}px`;
    }
    if (domRefs.game.speedLines) {
      const speedValue = gameState.isReviewMode ? 0 : gameState.speedMps;
      const maxSpeed = gameState.maxSpeedMps || 1;
      const speedRatio = Math.max(0, Math.min(speedValue / maxSpeed, 1));
      let lineOpacity = Math.max(0.05, Math.min(speedRatio, 0.65));
      if (gameState.isReviewMode) {
        lineOpacity = 0;
      }
      if (domRefs.game.speedLines.classList.contains('boost-lines')) {
        lineOpacity = Math.min(1, lineOpacity + 0.25);
      }
      domRefs.game.speedLines.style.opacity = lineOpacity.toFixed(2);
      domRefs.game.speedLines.classList.toggle('is-fast', speedRatio > 0.45);
      domRefs.game.speedLines.classList.toggle('is-rapid', speedRatio > 0.75);
      domRefs.game.runWorld?.classList.toggle('is-fast', speedRatio > 0.6);
      domRefs.game.runWorld?.classList.toggle('is-rapid', speedRatio > 0.85);
      domRefs.game.runner?.classList.toggle('speed-glow', speedRatio > 0.7);
      domRefs.game.runnerWrap?.classList.toggle('is-fast', speedRatio > 0.7);
      domRefs.game.runnerWrap?.classList.toggle('is-rapid', speedRatio > 0.85);
    }
    if (domRefs.game.timeProgressBar && domRefs.game.timeProgressRunner) {
      const totalTime = gameState.timeLimit || 60;
      const timeLeft = gameState.isReviewMode ? totalTime : gameState.timeLeft;
      const elapsedSec = Math.max(0, totalTime - timeLeft);
      const progressRatio = Math.max(0, Math.min(elapsedSec / totalTime, 1));
      domRefs.game.timeProgressBar.style.width = `${(progressRatio * 100).toFixed(1)}%`;
      domRefs.game.timeProgressRunner.style.left = `${(progressRatio * 100).toFixed(1)}%`;
      domRefs.game.hud?.classList.toggle('final-phase', !gameState.isReviewMode && timeLeft <= 10);
    }
    if (domRefs.game.runLayer) {
      domRefs.game.runLayer.hidden = gameState.isReviewMode;
    }
    if (domRefs.game.reviewProgress) {
      if (gameState.isReviewMode) {
        domRefs.game.reviewProgress.hidden = false;
        domRefs.game.reviewProgress.textContent = `復習: ${gameState.reviewAnsweredCount}/${gameState.reviewQuestionLimit}`;
      } else {
        domRefs.game.reviewProgress.hidden = true;
      }
    }
    if (domRefs.game.runner) {
      if (gameState.isReviewMode) {
        domRefs.game.runner.classList.remove(
          'runner-speed-low',
          'runner-speed-mid',
          'runner-speed-high',
        );
        this.runnerSpeedTier = null;
      } else {
        const speedValue = gameState.speedMps;
        let nextTier = 'runner-speed-high';
        if (speedValue < 3.0) {
          nextTier = 'runner-speed-low';
        } else if (speedValue < 6.0) {
          nextTier = 'runner-speed-mid';
        }
        if (this.runnerSpeedTier !== nextTier) {
          domRefs.game.runner.classList.remove(
            'runner-speed-low',
            'runner-speed-mid',
            'runner-speed-high',
          );
          domRefs.game.runner.classList.add(nextTier);
          this.runnerSpeedTier = nextTier;
        }
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
    this.clearEffectTimeouts();
    this.clearStumbleTimeout();
    this.resetEffects();
    this.isLocked = false;
  },
};

export default gameScreen;
