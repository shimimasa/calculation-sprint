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
const BG_BASE_SPEED_PX = 42;
const SKY_SPEED_FACTOR = 0.08;
const GROUND_SPEED_FACTOR = 1;
const CLOUD_COUNT_MIN = 3;
const CLOUD_COUNT_MAX = 7;
const CLOUD_Y_MIN = 0.15;
const CLOUD_Y_MAX = 0.55;
const CLOUD_SCALE_MIN = 0.6;
const CLOUD_SCALE_MAX = 1.2;
const CLOUD_SPEED_MIN = 0.1;
const CLOUD_SPEED_MAX = 0.25;
const CLOUD_GAP_MIN_PX = 80;
const CLOUD_GAP_MAX_PX = 260;
const DEFAULT_CLOUD_WIDTH = 220;
const RUNNER_BASE_LEFT_PX = 64;
const RUNNER_FOOT_OFFSET_PX = 62;
const DEFAULT_GROUND_SURFACE_INSET_PX = 160;
const EFFECT_MAX_SPEED_MPS = 8;
const DEBUG_INPUT = false;
const DEBUG_KEYPAD = false;
const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomIntBetween = (min, max) => Math.floor(randomBetween(min, max + 1));
const extractCssUrl = (value) => {
  if (!value) {
    return '';
  }
  const match = value.match(/url\((['"]?)(.*?)\1\)/);
  return match ? match[2] : '';
};
const waitForImageDecode = (img) => {
  if (img.decode) {
    return img.decode().catch(() => new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    }));
  }
  return new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });
};
const loadCloudBaseWidth = async (src) => {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await waitForImageDecode(img);
  return img.naturalWidth || DEFAULT_CLOUD_WIDTH;
};
const getGroundSurfaceInsetPx = () => {
  const inset = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--ground-surface-inset'),
  );
  return Number.isFinite(inset) ? inset : DEFAULT_GROUND_SURFACE_INSET_PX;
};
const describeActiveElement = () => {
  const active = document.activeElement;
  if (!active) {
    return 'none';
  }
  const tag = active.tagName?.toLowerCase() ?? 'unknown';
  const id = active.id ? `#${active.id}` : '';
  return `${tag}${id}`;
};
const isEditableTarget = (target) => {
  if (!target) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};
const logInputDebug = (label, payload = {}) => {
  if (!DEBUG_INPUT) {
    return;
  }
  console.log(`[input-debug:${label}]`, {
    activeElement: describeActiveElement(),
    ...payload,
  });
};
const formatTargetLabel = (target) => {
  if (!target) {
    return 'none';
  }
  const tag = target.tagName?.toLowerCase() ?? 'unknown';
  const id = target.id ? `#${target.id}` : '';
  const classes = target.classList?.length ? `.${[...target.classList].join('.')}` : '';
  return `${tag}${id}${classes}`;
};
const logKeypadDebug = (label, payload = {}) => {
  if (!DEBUG_KEYPAD) {
    return;
  }
  console.log(`[keypad-debug:${label}]`, payload);
};

const dashGameScreen = {
  answerBuffer: '',
  isSyncingAnswer: false,
  ensureRunLayerMounted() {
    const runLayer = domRefs.game.runLayer;
    const host = domRefs.dashGame.runHost;
    if (!runLayer || !host) {
      return;
    }
    if (!this.runLayerOriginalParent) {
      this.runLayerOriginalParent = runLayer.parentElement;
      this.runLayerOriginalNextSibling = runLayer.nextElementSibling;
    }
    if (runLayer.parentElement !== host) {
      host.appendChild(runLayer);
    }
    runLayer.hidden = false;
  },
  restoreRunLayer() {
    const runLayer = domRefs.game.runLayer;
    const parent = this.runLayerOriginalParent;
    if (!runLayer || !parent) {
      return;
    }
    const before = this.runLayerOriginalNextSibling;
    if (before && before.parentElement === parent) {
      parent.insertBefore(runLayer, before);
    } else {
      parent.appendChild(runLayer);
    }
  },
  getCloudImageSrc() {
    const world = domRefs.game.runWorld;
    if (!world) {
      return 'assets/bg-cloud.png';
    }
    const computed = getComputedStyle(world);
    const cssValue = computed.getPropertyValue('--run-cloud-image');
    return extractCssUrl(cssValue) || 'assets/bg-cloud.png';
  },
  initRunBackgrounds() {
    this.clouds = [];
    const cloudContainer = domRefs.game.runClouds;
    if (cloudContainer) {
      cloudContainer.innerHTML = '';
    }
    const count = randomIntBetween(CLOUD_COUNT_MIN, CLOUD_COUNT_MAX);
    const cloudSrc = this.getCloudImageSrc();
    const loadToken = Symbol('cloud-load');
    this.cloudLoadToken = loadToken;
    loadCloudBaseWidth(cloudSrc).then((baseWidth) => {
      if (this.cloudLoadToken !== loadToken) {
        return;
      }
      if (!cloudContainer) {
        return;
      }
      for (let i = 0; i < count; i += 1) {
        this.spawnCloud({
          container: cloudContainer,
          cloudSrc,
          initial: true,
          baseWidth,
        });
      }
    });
    this.resetGroundTiles();
  },
  resetGroundTiles() {
    this.groundTileWidth = 0;
    this.groundTileX = [0, 0];
    this.groundDebugLogged = false;
    if (domRefs.game.runGroundTiles?.length >= 2) {
      domRefs.game.runGroundTiles[0].style.transform = 'translate3d(0px, 0px, 0px)';
      domRefs.game.runGroundTiles[1].style.transform = 'translate3d(0px, 0px, 0px)';
    }
    this.updateGroundLayout(true);
    this.updateRunnerGroundAlignment(true);
  },
  updateGroundLayout(force = false) {
    const runGround = domRefs.game.runGround;
    const tileA = domRefs.game.runGroundTileA;
    const tileB = domRefs.game.runGroundTileB;
    if (!runGround || !tileA || !tileB) {
      return;
    }
    const nextWidth = Math.round(runGround.getBoundingClientRect().width || 0);
    if (!nextWidth) {
      return;
    }
    if (force || Math.abs(nextWidth - this.groundTileWidth) > 1) {
      this.initGround(runGround, tileA, tileB);
    }
  },
  initGround(groundEl, tileA, tileB) {
    if (!groundEl || !tileA || !tileB) {
      return;
    }
    const tileW = Math.round(groundEl.getBoundingClientRect().width || 0);
    if (!tileW) {
      return;
    }
    this.groundTileWidth = tileW;
    this.groundTileX = [0, tileW];
    tileA.style.width = `${tileW}px`;
    tileB.style.width = `${tileW}px`;
    tileA.style.transform = 'translate3d(0px, 0px, 0px)';
    tileB.style.transform = `translate3d(${Math.round(tileW)}px, 0px, 0px)`;
    this.logGroundDebug();
  },
  updateGround(dtSec, speedPerSec) {
    if (!this.groundTileWidth) {
      return;
    }
    const tileA = domRefs.game.runGroundTileA;
    const tileB = domRefs.game.runGroundTileB;
    if (!tileA || !tileB) {
      return;
    }
    const tileW = this.groundTileWidth;
    const nextXA = (this.groundTileX?.[0] ?? 0) - speedPerSec * dtSec;
    const nextXB = (this.groundTileX?.[1] ?? tileW) - speedPerSec * dtSec;
    let xA = nextXA;
    let xB = nextXB;
    if (xA <= -tileW) {
      xA = xB + tileW;
    }
    if (xB <= -tileW) {
      xB = xA + tileW;
    }
    this.groundTileX = [xA, xB];
    tileA.style.transform = `translate3d(${Math.round(xA)}px, 0px, 0px)`;
    tileB.style.transform = `translate3d(${Math.round(xB)}px, 0px, 0px)`;
  },
  logGroundDebug() {
    if (this.groundDebugLogged || !Number.isFinite(this.groundSurfaceY) || !this.groundTileWidth) {
      return;
    }
    const xA = Math.round(this.groundTileX?.[0] ?? 0);
    const xB = Math.round(this.groundTileX?.[1] ?? 0);
    console.log('[run-ground] init', {
      tileW: this.groundTileWidth,
      xA,
      xB,
      groundSurfaceY: this.groundSurfaceY,
    });
    this.groundDebugLogged = true;
  },
  updateRunnerGroundAlignment(force = false) {
    const runGround = domRefs.game.runGround;
    const runWorld = domRefs.game.runWorld;
    const runnerWrap = domRefs.game.runnerWrap;
    const runner = domRefs.game.runner;
    if (!runGround || !runWorld || !runnerWrap || !runner) {
      return;
    }
    const groundRect = runGround.getBoundingClientRect();
    const worldRect = runWorld.getBoundingClientRect();
    const groundSurfaceInsetPx = getGroundSurfaceInsetPx();
    const groundSurfaceY = Math.round(groundRect.bottom - groundSurfaceInsetPx);
    const runnerFootOffset = RUNNER_FOOT_OFFSET_PX;
    const runnerBaseLeft = Math.round(worldRect.left + RUNNER_BASE_LEFT_PX);
    if (
      !force
      && this.groundSurfaceY === groundSurfaceY
      && this.runnerFootOffset === runnerFootOffset
      && this.runnerBaseLeft === runnerBaseLeft
    ) {
      return;
    }
    this.groundSurfaceY = groundSurfaceY;
    this.runnerFootOffset = runnerFootOffset;
    this.runnerBaseLeft = runnerBaseLeft;
    gameState.run.groundSurfaceY = groundSurfaceY;
    gameState.run.groundY = groundSurfaceY;
    runWorld.style.setProperty('--calc-sprint-runner-foot-offset', `${runnerFootOffset}px`);
    runnerWrap.style.bottom = 'auto';
    runnerWrap.style.top = `${Math.round(groundSurfaceY - runnerFootOffset)}px`;
    runnerWrap.style.left = `${runnerBaseLeft}px`;
    this.logGroundDebug();
  },
  getAnswerInput() {
    const input = domRefs.dashGame.answerInput;
    if (input?.isConnected) {
      return input;
    }
    const refreshed = document.querySelector('.calc-sprint #dash-game-answer-input');
    if (refreshed) {
      domRefs.dashGame.answerInput = refreshed;
    }
    return refreshed;
  },
  focusAnswerInput() {
    const input = this.getAnswerInput();
    if (!input) {
      return null;
    }
    if (typeof input.focus === 'function') {
      input.focus({ preventScroll: true });
    }
    return input;
  },
  setAnswer(nextValue, meta = {}) {
    const value = `${nextValue ?? ''}`;
    const previous = this.answerBuffer ?? '';
    this.answerBuffer = value;
    const input = this.getAnswerInput();
    if (input && input.value !== value) {
      this.isSyncingAnswer = true;
      input.value = value;
      this.isSyncingAnswer = false;
    }
    logInputDebug('setAnswer', {
      handler: meta.handler,
      before: previous,
      after: value,
      defaultPrevented: meta.defaultPrevented,
    });
  },
  spawnCloud({ container, cloudSrc, initial = false, baseWidth = DEFAULT_CLOUD_WIDTH } = {}) {
    if (!container) {
      return;
    }
    const cloud = {};
    const img = document.createElement('img');
    img.src = cloudSrc;
    img.alt = '';
    img.className = 'run-cloud';
    img.decoding = 'async';
    img.loading = 'eager';
    img.style.width = `${DEFAULT_CLOUD_WIDTH}px`;
    img.style.height = 'auto';
    container.appendChild(img);
    cloud.el = img;
    cloud.baseWidth = baseWidth || DEFAULT_CLOUD_WIDTH;
    this.positionCloud(cloud, { initial });
    this.clouds.push(cloud);
  },
  positionCloud(cloud, { initial = false } = {}) {
    const world = domRefs.game.runWorld;
    if (!world) {
      return;
    }
    const worldWidth = world.clientWidth || 1;
    const worldHeight = world.clientHeight || 1;
    const xMax = worldWidth + (initial ? worldWidth * 0.6 : 0);
    cloud.x = initial
      ? randomBetween(0, xMax)
      : worldWidth + randomBetween(CLOUD_GAP_MIN_PX, CLOUD_GAP_MAX_PX);
    cloud.y = randomBetween(worldHeight * CLOUD_Y_MIN, worldHeight * CLOUD_Y_MAX);
    cloud.scale = randomBetween(CLOUD_SCALE_MIN, CLOUD_SCALE_MAX);
    cloud.speedFactor = randomBetween(CLOUD_SPEED_MIN, CLOUD_SPEED_MAX);
  },
  updateRunLayerVisuals(dtMs) {
    const dtSec = dtMs / 1000;
    if (!Number.isFinite(dtSec) || dtSec <= 0) {
      return;
    }
    if (this.hasEnded) {
      return;
    }
    const runWorld = domRefs.game.runWorld;
    const runSky = domRefs.game.runSky;
    const speedLines = domRefs.game.speedLines;
    const runner = domRefs.game.runner;
    const runnerWrap = domRefs.game.runnerWrap;

    const speedValue = Math.max(0, Number(this.playerSpeed) || 0);
    const baseSpeedPerSec = speedValue * BG_BASE_SPEED_PX;
    const skySpeedPerSec = baseSpeedPerSec * SKY_SPEED_FACTOR;
    const groundSpeedPerSec = baseSpeedPerSec * GROUND_SPEED_FACTOR;
    this.skyOffsetPx -= skySpeedPerSec * dtSec;
    const worldWidth = runWorld?.clientWidth || 0;
    if (worldWidth > 0 && this.skyOffsetPx <= -worldWidth) {
      this.skyOffsetPx += worldWidth;
    }
    this.updateGroundLayout();
    this.updateGround(dtSec, groundSpeedPerSec);
    this.updateRunnerGroundAlignment();
    this.clouds?.forEach((cloud) => {
      if (!cloud?.el) {
        return;
      }
      if (!cloud.baseWidth && cloud.el.naturalWidth) {
        cloud.baseWidth = cloud.el.naturalWidth;
      }
      const cloudSpeedPx = baseSpeedPerSec * cloud.speedFactor * dtSec;
      cloud.x -= cloudSpeedPx;
      const cloudWidth = (cloud.baseWidth || DEFAULT_CLOUD_WIDTH) * cloud.scale;
      if (cloud.x < -cloudWidth) {
        this.positionCloud(cloud);
      }
    });

    if (runSky) {
      runSky.style.backgroundPositionX = `${Math.round(this.skyOffsetPx)}px`;
    }
    if (domRefs.game.runGroundTiles?.length >= 2 && this.groundTileWidth > 0) {
      const offsets = this.groundTileX ?? [0, this.groundTileWidth];
      domRefs.game.runGroundTiles.forEach((tile, index) => {
        const offset = offsets[index] ?? 0;
        tile.style.transform = `translate3d(${Math.round(offset)}px, 0px, 0px)`;
      });
    }
    if (this.clouds?.length) {
      this.clouds.forEach((cloud) => {
        if (!cloud?.el) {
          return;
        }
        cloud.el.style.transform = `translate3d(${Math.round(cloud.x)}px, ${Math.round(cloud.y)}px, 0) scale(${cloud.scale})`;
      });
    }

    const speedRatio = Math.max(0, Math.min(speedValue / EFFECT_MAX_SPEED_MPS, 1));
    if (speedLines) {
      let lineOpacity = Math.max(0.05, Math.min(speedRatio, 0.65));
      speedLines.style.opacity = lineOpacity.toFixed(2);
      speedLines.classList.toggle('is-fast', speedRatio > 0.45);
      speedLines.classList.toggle('is-rapid', speedRatio > 0.75);
    }
    runWorld?.classList.toggle('is-fast', speedRatio > 0.6);
    runWorld?.classList.toggle('is-rapid', speedRatio > 0.85);
    runner?.classList.toggle('speed-glow', speedRatio > 0.7);
    runnerWrap?.classList.toggle('is-fast', speedRatio > 0.7);
    runnerWrap?.classList.toggle('is-rapid', speedRatio > 0.85);

    if (runner) {
      let nextTier = 'runner-speed-high';
      if (speedValue < 3.0) {
        nextTier = 'runner-speed-low';
      } else if (speedValue < 6.0) {
        nextTier = 'runner-speed-mid';
      }
      if (this.runnerSpeedTier !== nextTier) {
        runner.classList.remove('runner-speed-low', 'runner-speed-mid', 'runner-speed-high');
        runner.classList.add(nextTier);
        this.runnerSpeedTier = nextTier;
      }
      runner.classList.add('runner-bob');
    }
  },
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
    const normalized = String(digit);
    this.focusAnswerInput();
    this.setAnswer(`${this.answerBuffer}${normalized}`, { handler: 'keypad' });
  },
  clearAnswer() {
    if (!this.canAcceptInput()) {
      return;
    }
    this.focusAnswerInput();
    this.setAnswer('', { handler: 'clear' });
  },
  handleBackspace() {
    if (!this.canAcceptInput()) {
      return;
    }
    this.focusAnswerInput();
    this.setAnswer(this.answerBuffer.slice(0, -1), { handler: 'backspace' });
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
    const problemMain = domRefs.dashGame.screen?.querySelector('.dash-problem-main');
    if (problemMain) {
      if (this.feedbackFxTimeout) {
        window.clearTimeout(this.feedbackFxTimeout);
        this.feedbackFxTimeout = null;
      }
      problemMain.classList.remove('is-attack', 'is-hit');
      if (type === 'correct') {
        problemMain.classList.add('is-attack');
      } else if (type === 'wrong') {
        problemMain.classList.add('is-hit');
      }
      this.feedbackFxTimeout = window.setTimeout(() => {
        problemMain.classList.remove('is-attack', 'is-hit');
      }, 160);
    }
  },
  clearFeedback() {
    if (!domRefs.dashGame.feedback) {
      return;
    }
    domRefs.dashGame.feedback.textContent = '';
    domRefs.dashGame.feedback.classList.remove('is-correct', 'is-wrong');
    const problemMain = domRefs.dashGame.screen?.querySelector('.dash-problem-main');
    problemMain?.classList.remove('is-attack', 'is-hit');
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
    this.updateNextAreaIndicator(gameState.dash.distanceM);
    if (domRefs.dashGame.timeRemaining) {
      const timeSeconds = Math.max(0, Math.ceil(this.timeLeftMs / 1000));
      domRefs.dashGame.timeRemaining.textContent = String(timeSeconds);
    }
    const isLowTime = this.timeLeftMs <= LOW_TIME_THRESHOLD_MS;
    const timeRatio = (() => {
      const denom = Math.max(1, Number(this.initialTimeLimitMs) || DEFAULT_TIME_LIMIT_MS);
      return Math.max(0, Math.min(this.timeLeftMs / denom, 1));
    })();
    const timeWrap = domRefs.dashGame.timeWrap;
    if (timeWrap) {
      let nextState = 'safe';
      if (timeRatio <= 0.3) {
        nextState = 'danger';
      } else if (timeRatio <= 0.6) {
        nextState = 'caution';
      }
      timeWrap.dataset.state = isLowTime ? 'danger' : nextState;
    }
    if (domRefs.dashGame.timeBar) {
      domRefs.dashGame.timeBar.style.width = `${(timeRatio * 100).toFixed(1)}%`;
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
    const screen = domRefs.dashGame.screen;
    if (screen) {
      screen.dataset.enemyState = proximityState;
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
    const screen = domRefs.dashGame.screen;
    if (screen) {
      screen.dataset.area = String(nextArea);
    }
  },
  getNextAreaThreshold(distanceM) {
    const area = this.getAreaForDistance(distanceM);
    if (area === 1) {
      return AREA_2_START_M;
    }
    if (area === 2) {
      return AREA_3_START_M;
    }
    if (area === 3) {
      return AREA_4_START_M;
    }
    return null;
  },
  updateNextAreaIndicator(distanceM) {
    const indicator = domRefs.dashGame.nextArea;
    if (!indicator) {
      return;
    }
    if (!Number.isFinite(distanceM)) {
      if (!this.lastNextAreaHidden) {
        indicator.hidden = true;
        indicator.textContent = '';
        this.lastNextAreaHidden = true;
        this.lastNextAreaText = '';
      }
      return;
    }
    const nextThreshold = this.getNextAreaThreshold(distanceM);
    let nextText = '';
    if (nextThreshold === null) {
      nextText = 'さいごのエリアです';
    } else {
      const remainingM = Math.max(0, Math.ceil(nextThreshold - distanceM));
      nextText = `つぎのエリアまで あと${remainingM}m`;
    }
    if (this.lastNextAreaText === nextText && this.lastNextAreaHidden === false) {
      return;
    }
    indicator.hidden = false;
    indicator.textContent = nextText;
    this.lastNextAreaHidden = false;
    this.lastNextAreaText = nextText;
  },
  loadNextQuestion() {
    this.currentQuestion = questionGenerator.next(gameState.settings);
    if (domRefs.dashGame.question) {
      domRefs.dashGame.question.textContent = this.currentQuestion.text;
    }
    this.setAnswer('', { handler: 'load' });
    this.focusAnswerInput();
    this.clearFeedback();
  },
  submitAnswer() {
    if (!this.canSubmit()) {
      return;
    }
    logInputDebug('submit', {
      handler: 'submit',
      before: this.answerBuffer,
      after: this.answerBuffer,
      defaultPrevented: false,
    });
    const inputValue = this.answerBuffer;
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
      this.endSession('timeup');
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
      this.endSession('collision');
      return;
    }
    this.timeLeftMs -= dtMs;
    if (this.timeLeftMs <= 0) {
      this.endSession('timeup');
    }
    this.updateRunLayerVisuals(dtMs);
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
  endSession(endReason = 'unknown') {
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
      endReason,
    };
    screenManager.changeScreen('dash-result');
  },
  enter() {
    uiRenderer.showScreen('dash-game');
    this.events = createEventRegistry('dash-game');
    this.ensureRunLayerMounted();
    this.playerSpeed = baseSpeed;
    this.enemySpeed = enemyBaseSpeed;
    this.enemyGapM = collisionThreshold * 2;
    this.timeLeftMs = this.getInitialTimeLimitMs();
    this.initialTimeLimitMs = this.timeLeftMs;
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
    this.lastNextAreaText = null;
    this.lastNextAreaHidden = null;
    this.runLayerOriginalParent = this.runLayerOriginalParent ?? null;
    this.runLayerOriginalNextSibling = this.runLayerOriginalNextSibling ?? null;
    this.skyOffsetPx = 0;
    this.groundTileWidth = 0;
    this.groundTileX = [0, 0];
    this.clouds = [];
    this.runnerSpeedTier = null;
    this.answerBuffer = '';
    this.isSyncingAnswer = false;
    this.initRunBackgrounds();
    this.updateArea(gameState.dash.distanceM);
    this.updateHud();
    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      this.endSession('manual');
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
      const currentValue = this.answerBuffer;
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

    const answerInput = this.getAnswerInput();
    if (answerInput) {
      answerInput.inputMode = 'numeric';
      answerInput.autocomplete = 'off';
      answerInput.autocapitalize = 'off';
      answerInput.readOnly = false;
    }

    this.handleKeyDown = inputActions.createKeyHandler();
    this.events.on(this.getAnswerInput(), 'keydown', this.handleKeyDown);
    this.handleAnswerInput = (event) => {
      if (this.isSyncingAnswer) {
        return;
      }
      if (!this.canAcceptInput()) {
        this.setAnswer(this.answerBuffer, {
          handler: 'input-blocked',
          defaultPrevented: event.defaultPrevented,
        });
        return;
      }
      const input = this.getAnswerInput();
      if (!input) {
        return;
      }
      const raw = input.value ?? '';
      const sanitized = raw.replace(/\D+/g, '');
      this.setAnswer(sanitized, {
        handler: 'input',
        defaultPrevented: event.defaultPrevented,
      });
    };
    this.events.on(this.getAnswerInput(), 'input', this.handleAnswerInput);
    this.handleGlobalKeyDown = (event) => {
      if (!this.isScreenActive() || !this.canAcceptInput()) {
        return;
      }
      if (event.defaultPrevented) {
        return;
      }
      const input = this.getAnswerInput();
      const active = document.activeElement;
      if (active === input) {
        return;
      }
      if (isEditableTarget(active)) {
        return;
      }
      const key = event.key;
      if (/^\d$/.test(key)) {
        event.preventDefault();
        this.setAnswer(`${this.answerBuffer}${key}`, {
          handler: 'keyboard',
          defaultPrevented: event.defaultPrevented,
        });
        this.focusAnswerInput();
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault();
        inputActions.dispatch(inputActions.ACTIONS.BACK, { source: 'keyboard' });
        this.focusAnswerInput();
        return;
      }
      if (key === 'Enter') {
        event.preventDefault();
        inputActions.dispatch(inputActions.ACTIONS.SUBMIT, { source: 'keyboard' });
      }
    };
    this.events.on(window, 'keydown', this.handleGlobalKeyDown);

    this.handleKeypadToggleClick = () => {
      inputActions.dispatch(inputActions.ACTIONS.TOGGLE_KEYPAD, { source: 'button' });
    };
    this.events.on(domRefs.dashGame.keypadToggle, 'click', this.handleKeypadToggleClick);

    const keypadRoot = domRefs.dashGame.keypad?.closest('.dash-keypad-stack') ?? domRefs.dashGame.keypad;
    this.handleKeypadCapture = (event) => {
      if (!DEBUG_KEYPAD) {
        return;
      }
      const target = event.target;
      const button = target?.closest?.('[data-digit],[data-action]');
      const computed = button ? window.getComputedStyle(button) : null;
      logKeypadDebug('capture', {
        target: formatTargetLabel(target),
        button: formatTargetLabel(button),
        dataset: button ? { digit: button.dataset.digit, action: button.dataset.action } : null,
        pointerEvents: computed?.pointerEvents,
        zIndex: computed?.zIndex,
      });
    };
    this.handleKeypadClick = (event) => {
      const button = event.target.closest('[data-digit],[data-action]');
      if (!button) {
        logKeypadDebug('ignore', { reason: 'no-button' });
        return;
      }
      if (button.disabled) {
        logKeypadDebug('ignore', { reason: 'disabled', button: formatTargetLabel(button) });
        return;
      }
      const digit = button.dataset.digit;
      const action = button.dataset.action;
      if (digit !== undefined) {
        if (!this.canAcceptInput()) {
          logKeypadDebug('ignore', { reason: 'input-blocked', digit });
          return;
        }
        this.appendKeypadDigit(String(digit));
        return;
      }
      if (action === 'backspace') {
        if (!this.canAcceptInput()) {
          logKeypadDebug('ignore', { reason: 'input-blocked', action });
          return;
        }
        this.handleBackspace();
        return;
      }
      if (action === 'clear') {
        if (!this.canAcceptInput()) {
          logKeypadDebug('ignore', { reason: 'input-blocked', action });
          return;
        }
        this.clearAnswer();
        return;
      }
      if (action === 'submit') {
        if (!this.canSubmit()) {
          logKeypadDebug('ignore', { reason: 'submit-blocked', action });
          return;
        }
        this.submitAnswer();
        return;
      }
      logKeypadDebug('ignore', { reason: 'unknown-action', action });
    };
    this.events.on(keypadRoot, 'click', this.handleKeypadCapture, { capture: true });
    this.events.on(keypadRoot, 'click', this.handleKeypadClick);

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
    this.restoreRunLayer();
    if (domRefs.dashGame.screen) {
      domRefs.dashGame.screen.dataset.area = '1';
    }
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
    this.handleAnswerInput = null;
    this.handleGlobalKeyDown = null;
    this.handleKeypadToggleClick = null;
    this.handleKeypadClick = null;
    this.handleKeypadCapture = null;
    this.clearStreakCue();
    if (domRefs.game.runClouds) {
      domRefs.game.runClouds.innerHTML = '';
    }
    this.clouds = [];
    if (this.feedbackFxTimeout) {
      window.clearTimeout(this.feedbackFxTimeout);
      this.feedbackFxTimeout = null;
    }
  },
};

export default dashGameScreen;
