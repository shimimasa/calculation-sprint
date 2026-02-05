import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import timer from '../core/timer.js';
import questionGenerator from '../features/questionGenerator.js';
import buildReviewSummary from '../core/reviewSummary.js';
import stageProgressStore from '../core/stageProgressStore.js';
import { applyStageSettings, findStageById } from '../features/stages.js';
import audioManager from '../core/audioManager.js';
import inputActions from '../core/inputActions.js';

const RUNNER_X_MIN_RATIO = 0.08;
const RUNNER_X_MAX_RATIO = 0.3;
const RUNNER_X_FOLLOW_RATE = 0.12;
const RUNNER_BASE_LEFT_PX = 64;
const BG_FAR_SPEED_FACTOR = 0.65;
const BG_NEAR_SPEED_FACTOR = 1.1;
const BG_BOOST_DURATION_MS = 400; // 300-500ms window for noticeable boost without overstaying.
const BG_BOOST_NEAR_DELTA = 0.3; // Near layer needs stronger bump to feel acceleration.
const BG_BOOST_FAR_DELTA = 0.25; // Far layer bump kept subtle to avoid seam emphasis.
const EFFECT_BY_LEVEL = {
  0: { glow: 0.8, line: 0.9, boost: 0.95 },
  1: { glow: 1.0, line: 1.0, boost: 1.0 },
  2: { glow: 1.15, line: 1.1, boost: 1.05 },
  3: { glow: 1.3, line: 1.2, boost: 1.1 },
};
const WORLD_TUNING_BY_LEVEL = {
  0: {
    parallaxFar: 1,
    parallaxNear: 1,
    contrast: 1,
    brightness: 1,
    clarity: 1,
  },
  1: {
    parallaxFar: 1.04,
    parallaxNear: 1.06,
    contrast: 1.02,
    brightness: 1.01,
    clarity: 1.03,
  },
  2: {
    parallaxFar: 1.07,
    parallaxNear: 1.1,
    contrast: 1.04,
    brightness: 1.02,
    clarity: 1.06,
  },
  3: {
    parallaxFar: 1.1,
    parallaxNear: 1.14,
    contrast: 1.06,
    brightness: 1.03,
    clarity: 1.09,
  },
};
const getScalingLevelFromStreak = (streak) => {
  if (streak >= 10) {
    return 3;
  }
  if (streak >= 6) {
    return 2;
  }
  if (streak >= 3) {
    return 1;
  }
  return 0;
};

const gameScreen = {
  applyStageThemeHooks() {
    const stage = gameState.selectedStage;
    const shouldApplyTheme = gameState.playMode === 'stage' && stage;
    [domRefs.screens.game, domRefs.game.runWorld].forEach((element) => {
      const dataset = element?.dataset;
      if (!dataset) {
        return;
      }
      if (stage) {
        dataset.stageId = stage.id;
        dataset.stageTheme = stage.themeId ?? '';
        dataset.worldId = stage.worldId ?? '';
      } else {
        delete dataset.stageId;
        delete dataset.stageTheme;
        delete dataset.worldId;
      }
      if (shouldApplyTheme) {
        element.setAttribute('data-bg-theme', stage.theme?.bgThemeId ?? 'default');
        element.setAttribute('data-bgm-id', stage.theme?.bgmId ?? '');
      } else {
        element.removeAttribute('data-bg-theme');
        element.removeAttribute('data-bgm-id');
      }
    });
  },
  updateScalingHud() {
    if (!domRefs.game.hud) {
      return;
    }
    domRefs.game.hud.classList.remove(
      'scale-lv-0',
      'scale-lv-1',
      'scale-lv-2',
      'scale-lv-3',
    );
    domRefs.game.hud.classList.add(`scale-lv-${gameState.scalingLevel}`);
  },
  applyWorldTuning() {
    const base = WORLD_TUNING_BY_LEVEL[gameState.scalingLevel] || WORLD_TUNING_BY_LEVEL[0];
    const reduceFactor = this.prefersReducedMotion ? 0.35 : 1;
    const tuneValue = (value) => 1 + (value - 1) * reduceFactor;
    this.worldParallax = {
      far: tuneValue(base.parallaxFar),
      near: tuneValue(base.parallaxNear),
    };
    domRefs.game.runWorld?.style.setProperty('--world-contrast', tuneValue(base.contrast));
    domRefs.game.runWorld?.style.setProperty('--world-brightness', tuneValue(base.brightness));
    domRefs.game.runWorld?.style.setProperty('--world-clarity', tuneValue(base.clarity));
  },
  isScreenActive() {
    return Boolean(domRefs.screens.game?.classList.contains('is-active'));
  },
  setLocked(nextLocked) {
    this.isLocked = nextLocked;
    if (domRefs.game.submitButton) {
      domRefs.game.submitButton.disabled = nextLocked;
      domRefs.game.submitButton.setAttribute('aria-disabled', String(nextLocked));
    }
    if (domRefs.game.keypadButtons) {
      domRefs.game.keypadButtons.forEach((button) => {
        button.disabled = nextLocked;
        button.setAttribute('aria-disabled', String(nextLocked));
      });
    }
  },
  canAcceptInput() {
    return this.isScreenActive() && !this.isLocked && gameState.timeLeft > 0;
  },
  canSubmit() {
    return this.canAcceptInput() && Boolean(gameState.currentQuestion);
  },
  toggleKeypad() {
    const keypad = domRefs.game.keypad;
    if (!keypad) {
      return;
    }
    keypad.hidden = !keypad.hidden;
    keypad.setAttribute('aria-hidden', String(keypad.hidden));
    domRefs.game.keypadToggle?.setAttribute('aria-expanded', String(!keypad.hidden));
  },
  appendKeypadDigit(digit) {
    if (!this.canAcceptInput()) {
      return;
    }
    if (!domRefs.game.answerInput) {
      return;
    }
    domRefs.game.answerInput.focus();
    domRefs.game.answerInput.value = `${domRefs.game.answerInput.value}${digit}`;
  },
  handleBackspace() {
    if (!this.canAcceptInput()) {
      return;
    }
    if (!domRefs.game.answerInput) {
      return;
    }
    domRefs.game.answerInput.focus();
    domRefs.game.answerInput.value = domRefs.game.answerInput.value.slice(0, -1);
  },
  enter() {
    uiRenderer.showScreen('game');
    if (gameState.playMode === 'stage') {
      const stage = findStageById(gameState.selectedStageId);
      if (stage) {
        applyStageSettings(stage, gameState);
        gameState.selectedStage = stage;
      } else {
        gameState.playMode = 'free';
        gameState.selectedStageId = null;
        gameState.selectedStage = null;
      }
    } else {
      gameState.selectedStageId = null;
      gameState.selectedStage = null;
    }
    this.applyStageThemeHooks();
    if (gameState.playMode === 'stage' && gameState.selectedStage) {
      const stageBgmId = gameState.selectedStage.theme?.bgmId
        ?? domRefs.screens.game?.dataset?.bgmId
        ?? null;
      audioManager.setBgm(stageBgmId);
    } else {
      audioManager.setBgm('bgm_free');
    }
    gameState.timeLeft = gameState.timeLimit;
    gameState.correctCount = 0;
    gameState.wrongCount = 0;
    gameState.totalAnswered = 0;
    gameState.totalAnswerTimeMs = 0;
    gameState.questionStartAtMs = 0;
    gameState.answeredCountForTiming = 0;
    gameState.currentStreak = 0;
    gameState.maxStreak = 0;
    gameState.scalingLevel = 0;
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
    this.setLocked(false);
    this.bgOffsetFarPx = 0;
    this.bgOffsetNearPx = 0;
    this.bgBoostRemainingMs = 0;
    this.runnerX = 0;
    this.runnerXTarget = 0;
    this.resetEffects();
    this.updateScalingHud();
    this.prefersReducedMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    this.applyWorldTuning();

    if (domRefs.game.keypad) {
      domRefs.game.keypad.hidden = true;
      domRefs.game.keypad.setAttribute('aria-hidden', 'true');
    }
    domRefs.game.keypadToggle?.setAttribute('aria-expanded', 'false');

    this.handleSubmitAction = () => {
      if (!this.canSubmit()) {
        return;
      }
      this.submitAnswer();
    };
    this.handleBackAction = () => {
      this.handleBackspace();
    };
    this.handleToggleKeypadAction = () => {
      if (!this.isScreenActive()) {
        return;
      }
      this.toggleKeypad();
    };

    inputActions.on(inputActions.ACTIONS.SUBMIT, this.handleSubmitAction);
    inputActions.on(inputActions.ACTIONS.BACK, this.handleBackAction);
    inputActions.on(inputActions.ACTIONS.TOGGLE_KEYPAD, this.handleToggleKeypadAction);

    this.handleKeyDown = inputActions.createKeyHandler();
    domRefs.game.answerInput?.addEventListener('keydown', this.handleKeyDown);

    this.handleSubmitClick = () => {
      inputActions.dispatch(inputActions.ACTIONS.SUBMIT, { source: 'button' });
    };
    domRefs.game.submitButton?.addEventListener('click', this.handleSubmitClick);

    this.handleKeypadToggleClick = () => {
      inputActions.dispatch(inputActions.ACTIONS.TOGGLE_KEYPAD, { source: 'button' });
    };
    domRefs.game.keypadToggle?.addEventListener('click', this.handleKeypadToggleClick);

    this.handleKeypadClick = (event) => {
      const button = event.target.closest('[data-keypad-key]');
      if (!button || button.disabled) {
        return;
      }
      const key = button.dataset.keypadKey;
      if (key === 'back') {
        inputActions.dispatch(inputActions.ACTIONS.BACK, { source: 'keypad' });
        return;
      }
      this.appendKeypadDigit(key);
    };
    domRefs.game.keypad?.addEventListener('click', this.handleKeypadClick);

    this.loadNextQuestion();
    this.startTimer();
    domRefs.game.answerInput?.focus();
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
    domRefs.game.runBgFar?.style.removeProperty('--stumble-freeze-x');
    domRefs.game.runBgNear?.style.removeProperty('--stumble-freeze-x');
    this.runnerSpeedTier = null;
  },
  queueEffectReset(callback, delayMs) {
    const timeoutId = window.setTimeout(() => {
      callback();
      this.effectTimeoutIds = this.effectTimeoutIds.filter((id) => id !== timeoutId);
    }, delayMs);
    this.effectTimeoutIds.push(timeoutId);
  },
  applyBoostIntensity() {
    const effect = EFFECT_BY_LEVEL[gameState.scalingLevel] || EFFECT_BY_LEVEL[0];
    domRefs.screens.game?.style.setProperty('--boost-glow', effect.glow);
    domRefs.screens.game?.style.setProperty('--boost-line', effect.line);
    domRefs.screens.game?.style.setProperty('--boost-bright', effect.boost);
  },
  triggerBoostEffect() {
    if (!domRefs.game.runner) {
      return;
    }
    this.applyBoostIntensity();
    domRefs.game.runner.classList.remove('hit');
    domRefs.game.runner.classList.add('boost');
    domRefs.game.speedLines?.classList.add('boost-lines');
    domRefs.game.speed?.classList.add('glow');
    this.bgBoostRemainingMs = BG_BOOST_DURATION_MS;
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
      domRefs.game.runBgFar?.style.setProperty('--stumble-freeze-x', `${this.bgOffsetFarPx}px`);
      domRefs.game.runBgNear?.style.setProperty('--stumble-freeze-x', `${this.bgOffsetNearPx}px`);
      timeoutIds.push(
        window.setTimeout(() => {
          domRefs.game.runWorld?.classList.remove('stumble-freeze');
          domRefs.game.runBgFar?.style.removeProperty('--stumble-freeze-x');
          domRefs.game.runBgNear?.style.removeProperty('--stumble-freeze-x');
        }, 120),
      );
    }
    timeoutIds.push(window.setTimeout(() => {
      domRefs.game.runner?.classList.remove('stumble');
      domRefs.game.runWorld?.classList.remove('stumble-freeze');
      domRefs.game.runBgFar?.style.removeProperty('--stumble-freeze-x');
      domRefs.game.runBgNear?.style.removeProperty('--stumble-freeze-x');
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
    this.setLocked(true);
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
    if (!this.canSubmit()) {
      return;
    }
    this.setLocked(true);
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
      gameState.currentStreak += 1;
      gameState.scalingLevel = getScalingLevelFromStreak(gameState.currentStreak);
      if (gameState.currentStreak > gameState.maxStreak) {
        gameState.maxStreak = gameState.currentStreak;
      }
      audioManager.playSfx('sfx_correct');
      uiRenderer.setFeedback('◯', 'correct');
    } else {
      gameState.wrongCount += 1;
      gameState.currentStreak = 0;
      gameState.scalingLevel = Math.max(0, gameState.scalingLevel - 1);
      if (isTrackableMode) {
        gameState.wrongByMode[mode] += 1;
      }
      audioManager.playSfx('sfx_wrong');
      uiRenderer.setFeedback(`× 正解: ${gameState.currentQuestion.answer}`, 'wrong');
    }
    this.updateScalingHud();
    this.applyWorldTuning();

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
      this.setLocked(false);
      domRefs.game.answerInput?.focus();
    }, 500);
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
      const boostRatio = Math.max(0, this.bgBoostRemainingMs / BG_BOOST_DURATION_MS);
      const easedBoost = boostRatio * (2 - boostRatio);
      const farBoost = BG_FAR_SPEED_FACTOR + BG_BOOST_FAR_DELTA * easedBoost;
      const nearBoost = BG_NEAR_SPEED_FACTOR + BG_BOOST_NEAR_DELTA * easedBoost;
      const baseOffset = gameState.speedMps * dtSec * bgFactor;
      this.bgOffsetFarPx -= baseOffset * farBoost;
      this.bgOffsetNearPx -= baseOffset * nearBoost;
      if (this.bgOffsetFarPx <= -loopWidthPx) {
        this.bgOffsetFarPx += loopWidthPx;
      }
      if (this.bgOffsetNearPx <= -loopWidthPx) {
        this.bgOffsetNearPx += loopWidthPx;
      }
    }
    if (this.bgBoostRemainingMs > 0) {
      this.bgBoostRemainingMs = Math.max(0, this.bgBoostRemainingMs - dtMs);
    }

    if (domRefs.game.runWorld && domRefs.game.runnerWrap) {
      const worldWidth = domRefs.game.runWorld.clientWidth;
      if (Number.isFinite(worldWidth) && worldWidth > 0) {
        const minSpeed = gameState.minSpeedMps || 0;
        const maxSpeed = gameState.maxSpeedMps || minSpeed + 1;
        const speedRatio = Math.max(
          0,
          Math.min((gameState.speedMps - minSpeed) / (maxSpeed - minSpeed), 1),
        );
        const targetX = worldWidth * (
          RUNNER_X_MIN_RATIO + (RUNNER_X_MAX_RATIO - RUNNER_X_MIN_RATIO) * speedRatio
        );
        this.runnerXTarget = targetX - RUNNER_BASE_LEFT_PX;
        const followRate = 1 - Math.pow(1 - RUNNER_X_FOLLOW_RATE, dtSec * 60);
        this.runnerX += (this.runnerXTarget - this.runnerX) * followRate;
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
    if (domRefs.game.runBgFar) {
      const bgOffset = gameState.isReviewMode ? 0 : this.bgOffsetFarPx;
      const parallaxFar = this.worldParallax?.far ?? 1;
      domRefs.game.runBgFar.style.backgroundPositionX = `${(bgOffset * parallaxFar).toFixed(2)}px`;
    }
    if (domRefs.game.runBgNear) {
      const bgOffset = gameState.isReviewMode ? 0 : this.bgOffsetNearPx;
      const parallaxNear = this.worldParallax?.near ?? 1;
      domRefs.game.runBgNear.style.backgroundPositionX = `${(bgOffset * parallaxNear).toFixed(2)}px`;
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
    if (domRefs.game.runnerWrap) {
      const translateX = gameState.isReviewMode ? 0 : this.runnerX;
      domRefs.game.runnerWrap.style.transform = `translateX(${translateX.toFixed(2)}px)`;
    }
  },
  exit() {
    timer.stop();
    if (this.handleKeyDown) {
      domRefs.game.answerInput.removeEventListener('keydown', this.handleKeyDown);
    }
    if (this.handleSubmitClick) {
      domRefs.game.submitButton?.removeEventListener('click', this.handleSubmitClick);
    }
    if (this.handleKeypadToggleClick) {
      domRefs.game.keypadToggle?.removeEventListener('click', this.handleKeypadToggleClick);
    }
    if (this.handleKeypadClick) {
      domRefs.game.keypad?.removeEventListener('click', this.handleKeypadClick);
    }
    if (this.handleSubmitAction) {
      inputActions.off(inputActions.ACTIONS.SUBMIT, this.handleSubmitAction);
    }
    if (this.handleBackAction) {
      inputActions.off(inputActions.ACTIONS.BACK, this.handleBackAction);
    }
    if (this.handleToggleKeypadAction) {
      inputActions.off(inputActions.ACTIONS.TOGGLE_KEYPAD, this.handleToggleKeypadAction);
    }
    if (this.feedbackTimeoutId) {
      window.clearTimeout(this.feedbackTimeoutId);
    }
    this.feedbackTimeoutId = null;
    this.clearEffectTimeouts();
    this.clearStumbleTimeout();
    this.resetEffects();
    this.setLocked(false);
  },
};

export default gameScreen;
