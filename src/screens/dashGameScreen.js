import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import gameState from '../core/gameState.js';
import inputActions from '../core/inputActions.js';
import questionGenerator from '../features/questionGenerator.js';
import {
  baseSpeed,
  speedIncrementPerCorrect,
  enemyBaseSpeed,
  enemySpeedIncrementPerStreak,
  collisionThreshold,
  timePenaltyOnCollision,
  timeBonusOnCorrect,
  timePenaltyOnWrong,
  timeBonusOnDefeat,
  streakAttack,
  streakDefeat,
} from '../features/dashConstants.js';
import { createEventRegistry } from '../core/eventRegistry.js';

const DEFAULT_TIME_LIMIT_MS = 30000;
const STREAK_CUE_DURATION_MS = 800;
const STREAK_ATTACK_CUE_TEXT = 'おした！';
const STREAK_DEFEAT_CUE_TEXT = 'はなれた！';
const LOW_TIME_THRESHOLD_MS = 8000;
const AREA_2_START_M = 200;
const AREA_3_START_M = 500;
const AREA_4_START_M = 1000;

const dashGameScreen = {
  // State model (local-only, per spec):
  // - playerSpeed (m/s), enemySpeed (m/s), enemyGapM (meters behind), timeLeftMs (ms), lastTickTs (ms)
  // - currentQuestion / inputBuffer are managed locally via questionGenerator + input element.
  // Global results persist ONLY to gameState.dash: distanceM, correctCount, wrongCount, streak.
  getInitialTimeLimitMs() {
    const limitSeconds = Number(gameState?.timeLimit);
    if (Number.isFinite(limitSeconds) && limitSeconds > 0) {
      return limitSeconds * 1000;
    }
    return DEFAULT_TIME_LIMIT_MS;
  },
  isScreenActive() {
    return Boolean(domRefs.screens['dash-game']?.classList.contains('is-active'));
  },
  canAcceptInput() {
    return this.isScreenActive() && this.timeLeftMs > 0;
  },
  canSubmit() {
    return this.canAcceptInput() && Boolean(this.currentQuestion);
  },
  toggleKeypad() {
    const keypad = domRefs.dashGame.keypad;
    if (!keypad) {
      return;
    }
    keypad.hidden = !keypad.hidden;
    keypad.setAttribute('aria-hidden', String(keypad.hidden));
    domRefs.dashGame.keypadToggle?.setAttribute('aria-expanded', String(!keypad.hidden));
  },
  appendKeypadDigit(digit) {
    if (!this.canAcceptInput()) {
      return;
    }
    const input = domRefs.dashGame.answerInput;
    if (!input) {
      return;
    }
    input.focus();
    input.value = `${input.value}${digit}`;
  },
  handleBackspace() {
    if (!this.canAcceptInput()) {
      return;
    }
    const input = domRefs.dashGame.answerInput;
    if (!input) {
      return;
    }
    input.focus();
    input.value = input.value.slice(0, -1);
  },
  setFeedback(message, type = 'correct') {
    if (!domRefs.dashGame.feedback) {
      return;
    }
    domRefs.dashGame.feedback.textContent = message;
    domRefs.dashGame.feedback.classList.remove('is-correct', 'is-wrong');
    if (type === 'correct') {
      domRefs.dashGame.feedback.classList.add('is-correct');
    } else if (type === 'wrong') {
      domRefs.dashGame.feedback.classList.add('is-wrong');
    }
  },
  clearFeedback() {
    if (!domRefs.dashGame.feedback) {
      return;
    }
    domRefs.dashGame.feedback.textContent = '';
    domRefs.dashGame.feedback.classList.remove('is-correct', 'is-wrong');
  },
  showStreakCue(message) {
    if (!domRefs.dashGame.streakCue) {
      return;
    }
    if (this.streakCueTimeout) {
      window.clearTimeout(this.streakCueTimeout);
      this.streakCueTimeout = null;
    }
    domRefs.dashGame.streakCue.textContent = message;
    domRefs.dashGame.streakCue.classList.add('is-visible');
    this.streakCueTimeout = window.setTimeout(() => {
      this.clearStreakCue();
    }, STREAK_CUE_DURATION_MS);
  },
  clearStreakCue() {
    if (!domRefs.dashGame.streakCue) {
      return;
    }
    domRefs.dashGame.streakCue.textContent = '';
    domRefs.dashGame.streakCue.classList.remove('is-visible');
    if (this.streakCueTimeout) {
      window.clearTimeout(this.streakCueTimeout);
      this.streakCueTimeout = null;
    }
  },
  updateHud() {
    if (domRefs.dashGame.distance) {
      domRefs.dashGame.distance.textContent = gameState.dash.distanceM.toFixed(1);
    }
    if (domRefs.dashGame.timeRemaining) {
      const timeSeconds = Math.max(0, Math.ceil(this.timeLeftMs / 1000));
      domRefs.dashGame.timeRemaining.textContent = String(timeSeconds);
    }
    const isLowTime = this.timeLeftMs <= LOW_TIME_THRESHOLD_MS;
    const timeCard = domRefs.dashGame.timeRemaining?.closest('.dash-stat-card');
    if (timeCard) {
      if (isLowTime) {
        timeCard.dataset.state = 'low';
      } else {
        delete timeCard.dataset.state;
      }
    }
    if (domRefs.dashGame.timeNote) {
      domRefs.dashGame.timeNote.textContent = isLowTime ? '残りわずか' : '';
    }
    if (domRefs.dashGame.streak) {
      domRefs.dashGame.streak.textContent = String(gameState.dash.streak);
    }
    const maxGap = Math.max(0.001, collisionThreshold * 2);
    const clampedGap = Math.max(0, Math.min(this.enemyGapM, maxGap));
    const proximityRatio = 1 - clampedGap / maxGap;
    const proximityPercent = Math.round(proximityRatio * 100);
    let proximityState = 'safe';
    let proximityLabel = '安全';
    if (proximityRatio >= 0.7) {
      proximityState = 'danger';
      proximityLabel = '危険';
    } else if (proximityRatio >= 0.4) {
      proximityState = 'caution';
      proximityLabel = '注意';
    }
    if (domRefs.dashGame.enemyWrap) {
      domRefs.dashGame.enemyWrap.dataset.state = proximityState;
    }
    if (domRefs.dashGame.enemyBar) {
      domRefs.dashGame.enemyBar.style.width = `${proximityPercent}%`;
    }
    if (domRefs.dashGame.enemyText) {
      domRefs.dashGame.enemyText.textContent = `${proximityLabel} (${proximityPercent}%)`;
    }
  },
  getAreaForDistance(distanceM) {
    if (distanceM >= AREA_4_START_M) {
      return 4;
    }
    if (distanceM >= AREA_3_START_M) {
      return 3;
    }
    if (distanceM >= AREA_2_START_M) {
      return 2;
    }
    return 1;
  },
  updateArea(distanceM) {
    const nextArea = this.getAreaForDistance(distanceM);
    if (nextArea === this.currentArea) {
      return;
    }
    this.currentArea = nextArea;
    const screen = domRefs.screens['dash-game'];
    if (screen) {
      screen.dataset.area = String(nextArea);
    }
  },
  loadNextQuestion() {
    this.currentQuestion = questionGenerator.next(gameState.settings);
    if (domRefs.dashGame.question) {
      domRefs.dashGame.question.textContent = this.currentQuestion.text;
    }
    if (domRefs.dashGame.answerInput) {
      domRefs.dashGame.answerInput.value = '';
      domRefs.dashGame.answerInput.focus();
    }
    this.clearFeedback();
  },
  submitAnswer() {
    if (!this.canSubmit()) {
      return;
    }
    const inputValue = domRefs.dashGame.answerInput?.value ?? '';
    if (inputValue === '') {
      return;
    }
    const numericValue = Number(inputValue);
    if (!Number.isFinite(numericValue)) {
      return;
    }
    const isCorrect = numericValue === this.currentQuestion.answer;
    if (isCorrect) {
      audioManager.playSfx('sfx_correct');
      gameState.dash.correctCount += 1;
      gameState.dash.streak += 1;
      this.maxStreak = Math.max(this.maxStreak, gameState.dash.streak);
      this.playerSpeed += speedIncrementPerCorrect;
      this.enemySpeed = enemyBaseSpeed + enemySpeedIncrementPerStreak * gameState.dash.streak;
      this.timeLeftMs += timeBonusOnCorrect;
      if (gameState.dash.streak === streakAttack) {
        this.enemyGapM += collisionThreshold;
        this.showStreakCue(STREAK_ATTACK_CUE_TEXT);
      }
      if (gameState.dash.streak === streakDefeat) {
        this.showStreakCue(STREAK_DEFEAT_CUE_TEXT);
        audioManager.playSfx('sfx_levelup', { volume: 0.8 });
        this.timeLeftMs += timeBonusOnDefeat;
        this.enemyGapM = collisionThreshold * 2;
        this.enemySpeed = enemyBaseSpeed;
        gameState.dash.streak = 0;
      }
      this.setFeedback('○', 'correct');
    } else {
      audioManager.playSfx('sfx_wrong');
      gameState.dash.wrongCount += 1;
      gameState.dash.streak = 0;
      this.enemySpeed = enemyBaseSpeed;
      this.timeLeftMs -= timePenaltyOnWrong;
      this.setFeedback('×', 'wrong');
    }
    if (this.timeLeftMs <= 0) {
      this.endSession();
      return;
    }
    this.loadNextQuestion();
  },
  updateFrame(dtMs) {
    if (this.timeLeftMs <= 0) {
      return;
    }
    const dtSeconds = dtMs / 1000;
    gameState.dash.distanceM += this.playerSpeed * dtSeconds;
    this.updateArea(gameState.dash.distanceM);
    this.enemyGapM -= (this.enemySpeed - this.playerSpeed) * dtSeconds;
    if (this.enemyGapM <= collisionThreshold) {
      audioManager.playSfx('sfx_wrong', { volume: 0.7 });
      this.timeLeftMs = Math.max(0, this.timeLeftMs - timePenaltyOnCollision);
      this.enemyGapM = collisionThreshold * 2;
      this.updateHud();
      this.endSession();
      return;
    }
    this.timeLeftMs -= dtMs;
    if (this.timeLeftMs <= 0) {
      this.endSession();
    }
    this.updateHud();
  },
  startLoop() {
    this.stopLoop();
    this.isRunning = true;
    this.lastTickTs = window.performance.now();
    const tick = (now) => {
      if (!this.isRunning) {
        return;
      }
      const rawDt = Math.max(0, now - this.lastTickTs);
      const dtMs = Math.min(rawDt, 50);
      this.lastTickTs = now;
      this.updateFrame(dtMs);
      if (this.isRunning) {
        this.rafId = window.requestAnimationFrame(tick);
      }
    };
    this.rafId = window.requestAnimationFrame(tick);
  },
  stopLoop() {
    this.isRunning = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },
  endSession() {
    if (this.hasEnded) {
      return;
    }
    this.hasEnded = true;
    this.stopLoop();
    gameState.dash.result = {
      distanceM: gameState.dash.distanceM,
      correctCount: gameState.dash.correctCount,
      wrongCount: gameState.dash.wrongCount,
      maxStreak: this.maxStreak,
      timeLeftMs: Math.max(0, this.timeLeftMs),
    };
    screenManager.changeScreen('dash-result');
  },
  enter() {
    uiRenderer.showScreen('dash-game');
    this.events = createEventRegistry('dash-game');
    this.playerSpeed = baseSpeed;
    this.enemySpeed = enemyBaseSpeed;
    this.enemyGapM = collisionThreshold * 2;
    this.timeLeftMs = this.getInitialTimeLimitMs();
    this.lastTickTs = window.performance.now();
    this.currentQuestion = null;
    this.hasEnded = false;
    this.maxStreak = 0;
    this.clearStreakCue();
    gameState.dash.distanceM = 0;
    gameState.dash.correctCount = 0;
    gameState.dash.wrongCount = 0;
    gameState.dash.streak = 0;
    gameState.dash.result = null;
    this.currentArea = null;
    this.updateArea(gameState.dash.distanceM);
    this.updateHud();
    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      this.endSession();
    };
    this.events.on(domRefs.dashGame.backButton, 'click', this.handleBack);

    this.handleSubmitAction = () => {
      if (!this.canSubmit()) {
        return;
      }
      this.submitAnswer();
    };
    this.handleNextAction = () => {
      if (!this.canSubmit()) {
        return;
      }
      this.submitAnswer();
    };
    this.handleBackAction = () => {
      const currentValue = domRefs.dashGame.answerInput?.value ?? '';
      if (currentValue !== '') {
        this.handleBackspace();
        return;
      }
      this.handleBack();
    };
    this.handleToggleKeypadAction = () => {
      if (!this.isScreenActive()) {
        return;
      }
      this.toggleKeypad();
    };
    inputActions.on(inputActions.ACTIONS.SUBMIT, this.handleSubmitAction);
    inputActions.on(inputActions.ACTIONS.NEXT, this.handleNextAction);
    inputActions.on(inputActions.ACTIONS.BACK, this.handleBackAction);
    inputActions.on(inputActions.ACTIONS.TOGGLE_KEYPAD, this.handleToggleKeypadAction);

    this.handleKeyDown = inputActions.createKeyHandler();
    this.events.on(domRefs.dashGame.answerInput, 'keydown', this.handleKeyDown);
    this.handleEnterKeyDown = (event) => {
      if (event.key !== 'Enter' || !this.isScreenActive()) {
        return;
      }
      event.preventDefault();
      inputActions.dispatch(inputActions.ACTIONS.SUBMIT, { source: 'keyboard' });
    };
    this.events.on(window, 'keydown', this.handleEnterKeyDown);

    this.handleSubmitClick = () => {
      inputActions.dispatch(inputActions.ACTIONS.SUBMIT, { source: 'button' });
    };
    this.events.on(domRefs.dashGame.submitButton, 'click', this.handleSubmitClick);

    this.handleKeypadToggleClick = () => {
      inputActions.dispatch(inputActions.ACTIONS.TOGGLE_KEYPAD, { source: 'button' });
    };
    this.events.on(domRefs.dashGame.keypadToggle, 'click', this.handleKeypadToggleClick);

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
    this.events.on(domRefs.dashGame.keypad, 'click', this.handleKeypadClick);

    if (domRefs.dashGame.keypad) {
      domRefs.dashGame.keypad.hidden = true;
      domRefs.dashGame.keypad.setAttribute('aria-hidden', 'true');
    }
    domRefs.dashGame.keypadToggle?.setAttribute('aria-expanded', 'false');

    this.loadNextQuestion();
    this.startLoop();
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
    this.stopLoop();
    if (this.handleSubmitAction) {
      inputActions.off(inputActions.ACTIONS.SUBMIT, this.handleSubmitAction);
    }
    if (this.handleNextAction) {
      inputActions.off(inputActions.ACTIONS.NEXT, this.handleNextAction);
    }
    if (this.handleBackAction) {
      inputActions.off(inputActions.ACTIONS.BACK, this.handleBackAction);
    }
    if (this.handleToggleKeypadAction) {
      inputActions.off(inputActions.ACTIONS.TOGGLE_KEYPAD, this.handleToggleKeypadAction);
    }
    this.handleSubmitAction = null;
    this.handleNextAction = null;
    this.handleBackAction = null;
    this.handleToggleKeypadAction = null;
    this.handleKeyDown = null;
    this.handleEnterKeyDown = null;
    this.handleSubmitClick = null;
    this.handleKeypadToggleClick = null;
    this.handleKeypadClick = null;
    this.clearStreakCue();
  },
};

export default dashGameScreen;
