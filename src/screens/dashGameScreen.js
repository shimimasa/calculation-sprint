import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import dashSettingsStore from '../core/dashSettingsStore.js';
import gameState from '../core/gameState.js';
import inputActions from '../core/inputActions.js';
import questionGenerator from '../features/questionGenerator.js';
import {
  baseSpeed,
  speedIncrementPerCorrect,
  enemyBaseSpeed,
  enemySpeedIncrementPerStreak,
  collisionThreshold,
  streakAttack,
  streakDefeat,
} from '../features/dashConstants.js';
import {
  ATTACK_WINDOW_MS,
  PX_PER_METER,
  BOSS_DEFEAT_TIME_BONUS_MS,
  createDashEnemySystem,
} from '../features/dashEnemySystem.js';
import { createEventRegistry } from '../core/eventRegistry.js';
import { toDashStageId } from '../features/dashStages.js';
import { toDashRunBgThemeId } from '../features/backgroundThemes.js';
import { waitForImageDecode } from '../core/imageDecode.js';
import { getStageCorePreloadPromise } from '../core/stageAssetPreloader.js';
import { isStageFrameWaitEnabled, perfLog } from '../core/perf.js';
import { resolveAssetUrl } from '../core/assetUrl.js';
import { getDashModeStrategy, getDashModeTimePolicy } from '../game/dash/modes/dashModes.js';
import { DASH_MODE_TYPES, normalizeDashModeId } from '../game/dash/modes/modeTypes.js';

const DEFAULT_TIME_LIMIT_MS = 30000;
const STREAK_CUE_DURATION_MS = 800;
const STREAK_ATTACK_CUE_TEXT = 'おした！';
const STREAK_DEFEAT_CUE_TEXT = 'はなれた！';
const BOSS_APPEAR_CUE_TEXT = 'ボス出現！';
const BOSS_DEFEAT_CUE_TEXT = 'ボス撃破！';
const LOW_TIME_THRESHOLD_MS = 8000;
const GOAL_RUN_FALLBACK_DISTANCE_M = 1000;
const DAMAGE_INVINCIBLE_MS = 800;
const HIT_SHAKE_MS = 160;
const HIT_FLASH_MS = 160;
const HIT_SHAKE_PX = 3;
const COLLISION_SLOW_MS = 1000;
const COLLISION_SLOW_MULT = 0.7;
const RUNNER_HIT_REACTION_MS = 420;
const KICK_MS = 300;
const MAX_LUNGE_PX = 140;
const LOOP_WATCHDOG_INTERVAL_MS = 1000;
const LOOP_STOPPED_THRESHOLD_MS = 1500;
const LOOP_RECOVERY_MAX_ATTEMPTS = 3;
const LOOP_ERROR_RECOVERY_COOLDOWN_MS = 120;
const PLAYER_RECT_NULL_RECOVERY_STREAK = 10;
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
const RUNNER_FOOT_OFFSET_PX = 78;
const DEFAULT_GROUND_SURFACE_INSET_PX = 160;
const DASH_DEBUG_QUERY_KEY = 'dashDebug';
const DASH_DEBUG_LEGACY_QUERY_KEY = 'dashDebugRunner';
const DASH_DEBUG_STORAGE_KEY = 'dashDebugRunner';
const DASH_DEBUG_WINDOW_FLAG = '__DASH_DEBUG_RUNNER';
const COLLISION_DEBUG_QUERY_KEY = 'debugCollision';
const COLLISION_DEBUG_STORAGE_KEY = 'dash.debugCollision';
const COLLISION_DEBUG_LOG_INTERVAL_MS = 200;
const DASH_DEBUG_ENEMY_QUERY_KEY = 'dashDebugEnemy';
const DASH_DEBUG_ENEMY_STORAGE_KEY = 'dash.debug.enemy';
const DASH_DEBUG_ENEMY_WINDOW_FLAG = '__DASH_DEBUG_ENEMY';
const DASH_TEST_COLLISION_QUERY_KEY = 'dashTestCollision';
const DASH_TEST_COLLISION_STORAGE_KEY = 'dash.test.collision';
const EFFECT_MAX_SPEED_MPS = 8;
const DASH_BUILD_TAG = 'damagefix-20260212-01';
const DASH_DEBUG_ALWAYS_ON = false;
const DEBUG_INPUT = false;
const DEBUG_KEYPAD = false;
const RUNNER_DEFAULT_SPRITE_PATH = 'assets/runner/runner.png';
const HIT_SHAKE_CLASS = 'is-shake';
const HIT_FLASH_CLASS = 'is-hitflash';
const DEFEAT_SHAKE_CLASS = 'is-defeat-shake';
const DEFEAT_SHAKE_MS = 120;
const DEFEAT_FLASH_CLASS = 'is-defeat-flash';
const DEFEAT_FLASH_MS = 200;
const HITSTOP_MS = 50;
const GOAL_OVERLAY_IMAGE_PATH = 'assets/bg-goal.png';
const GOAL_CLEAR_FX_CLASS = 'is-goal-clear-active';
const GOAL_CLEAR_SHAKE_CLASS = 'is-goal-shake';
const GOAL_CLEAR_DEFAULT_DURATION_MS = 1000;
const DASH_DIFFICULTY_TIME_LIMIT_MULTIPLIER = Object.freeze({
  easy: 1.2,
  normal: 1,
  hard: 0.85,
});
const DASH_STAGE_TO_BGM_ID = Object.freeze({
  plus: 'bgm_add',
  minus: 'bgm_sub',
  multi: 'bgm_mul',
  divide: 'bgm_div',
  mix: 'bgm_mix',
  dash: 'bgm_dash',
});
const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomIntBetween = (min, max) => Math.floor(randomBetween(min, max + 1));
const toFiniteOrNull = (value) => (Number.isFinite(value) ? value : null);
const normalizeRect = (rect) => {
  if (!rect || typeof rect !== 'object') {
    return null;
  }
  const x = toFiniteOrNull(rect.x);
  const y = toFiniteOrNull(rect.y);
  const widthCandidate = toFiniteOrNull(rect.w ?? rect.width);
  const heightCandidate = toFiniteOrNull(rect.h ?? rect.height);
  const leftCandidate = toFiniteOrNull(rect.left);
  const topCandidate = toFiniteOrNull(rect.top);
  const rightCandidate = toFiniteOrNull(rect.right);
  const bottomCandidate = toFiniteOrNull(rect.bottom);

  let left = leftCandidate;
  let top = topCandidate;
  let right = rightCandidate;
  let bottom = bottomCandidate;

  if (left === null && x !== null) {
    left = x;
  }
  if (top === null && y !== null) {
    top = y;
  }
  if (right === null && left !== null && widthCandidate !== null) {
    right = left + widthCandidate;
  }
  if (bottom === null && top !== null && heightCandidate !== null) {
    bottom = top + heightCandidate;
  }
  if (left === null && right !== null && widthCandidate !== null) {
    left = right - widthCandidate;
  }
  if (top === null && bottom !== null && heightCandidate !== null) {
    top = bottom - heightCandidate;
  }

  if ([left, top, right, bottom].some((value) => value === null)) {
    return null;
  }
  if (right < left) {
    [left, right] = [right, left];
  }
  if (bottom < top) {
    [top, bottom] = [bottom, top];
  }

  const width = Math.abs(right - left);
  const height = Math.abs(bottom - top);
  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
    x: left,
    y: top,
    w: width,
    h: height,
  };
};
const extractCssUrl = (value) => {
  if (!value) {
    return '';
  }
  const match = value.match(/url\((['"]?)(.*?)\1\)/);
  return match ? match[2] : '';
};
const loadCloudBaseWidth = async (src) => {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await waitForImageDecode(img);
  return img.naturalWidth || DEFAULT_CLOUD_WIDTH;
};
const resolveDashBgmId = (stageId) => {
  const normalizedStageId = String(stageId ?? '').trim().toLowerCase();
  return DASH_STAGE_TO_BGM_ID[normalizedStageId] ?? DASH_STAGE_TO_BGM_ID.dash;
};
const getGroundSurfaceInsetPx = () => {
  const target = domRefs.dashGame?.screen ?? document.documentElement;
  const inset = parseFloat(
    getComputedStyle(target).getPropertyValue('--ground-surface-inset'),
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

const isDashStartDebugLogEnabled = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(DASH_DEBUG_QUERY_KEY) === '1';
  } catch (error) {
    return false;
  }
};
const clamp01 = (value) => Math.max(0, Math.min(Number(value) || 0, 1));

const normalizeDashEndReason = (endReason) => {
  if (endReason === 'goal') return 'goal';
  if (endReason === 'retired' || endReason === 'manual') return 'retired';
  if (endReason === 'timeout' || endReason === 'timeup' || endReason === 'collision') return 'timeout';
  return 'timeout';
};

const dashGameScreen = {
  answerBuffer: '',
  isSyncingAnswer: false,
  isDebugEnabled() {
    return DASH_DEBUG_ALWAYS_ON === true;
  },
  resolveRunModeId() {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get('dashMode');
    return normalizeDashModeId(gameState.dash?.modeId ?? queryMode);
  },
  resolveModeStrategy() {
    const modeId = this.resolveRunModeId();
    this.currentDashModeId = modeId;
    this.modeStrategy = getDashModeStrategy(modeId);
    this.timePolicy = getDashModeTimePolicy(modeId, this.modeStrategy);
  },
  tryEndByMode() {
    const modeContext = this.getModeContext();
    const decision = this.modeStrategy?.checkEnd?.(modeContext);
    if (decision?.ended) {
      this.endSession(decision.endReason ?? 'timeout', decision);
      return true;
    }
    return false;
  },
  getModeContext() {
    return {
      distanceM: gameState.dash.distanceM,
      timeLeftMs: this.timeLeftMs,
      modeRuntime: this.modeRuntime,
      score: Number(this.modeRuntime?.totalScore) || 0,
      combo: Number(this.modeRuntime?.combo) || 0,
      maxCombo: Number(this.modeRuntime?.maxCombo) || 0,
    };
  },
  applyModeHud(modeHud) {
    const distanceCard = domRefs.dashGame.distance?.closest('.dash-stat-card');
    const speedCard = domRefs.dashGame.speed?.closest('.dash-stat-card');
    const enemyCard = domRefs.dashGame.enemyCount?.closest('.dash-stat-card');
    const streakCard = domRefs.dashGame.streak?.closest('.dash-stat-card');

    const setCard = (card, valueEl, fallback, override) => {
      if (!card || !valueEl) {
        return;
      }
      const labelEl = card.querySelector('.dash-stat-label');
      const unitEl = card.querySelector('.dash-stat-unit');
      if (labelEl) {
        labelEl.textContent = override?.label ?? fallback.label;
      }
      if (unitEl) {
        unitEl.textContent = override?.unit ?? fallback.unit;
      }
      if (typeof override?.value === 'string') {
        valueEl.textContent = override.value;
      }
    };

    setCard(distanceCard, domRefs.dashGame.distance, {
      label: '走ったきょり',
      unit: 'm',
    }, {
      label: modeHud?.distanceLabel,
      unit: modeHud?.distanceUnit,
      value: modeHud?.distanceText,
    });

    setCard(speedCard, domRefs.dashGame.speed, {
      label: 'はやさ',
      unit: 'm/s',
    }, modeHud?.statOverrides?.speed);

    setCard(enemyCard, domRefs.dashGame.enemyCount, {
      label: 'たおした敵の数',
      unit: '体',
    }, modeHud?.statOverrides?.enemyCount);

    setCard(streakCard, domRefs.dashGame.streak, {
      label: 'せいかいコンボ',
      unit: '回',
    }, modeHud?.statOverrides?.streak);

    if (!this.goalProgressWrapEl && distanceCard) {
      const wrap = document.createElement('div');
      wrap.className = 'dash-goal-progress';
      wrap.hidden = true;
      wrap.innerHTML = '<div class="dash-goal-progress__track"><div class="dash-goal-progress__fill"></div></div><span class="dash-goal-progress__text"></span>';
      distanceCard.append(wrap);
      this.goalProgressWrapEl = wrap;
      this.goalProgressFillEl = wrap.querySelector('.dash-goal-progress__fill');
      this.goalProgressTextEl = wrap.querySelector('.dash-goal-progress__text');
    }

    if (!modeHud || !Number.isFinite(modeHud.progressRatio)) {
      if (this.goalProgressWrapEl) {
        this.goalProgressWrapEl.hidden = true;
      }
      return;
    }

    if (this.goalProgressWrapEl) {
      this.goalProgressWrapEl.hidden = false;
    }
    if (this.goalProgressFillEl) {
      const ratio = Math.max(0, Math.min(modeHud.progressRatio, 1));
      this.goalProgressFillEl.style.width = `${(ratio * 100).toFixed(1)}%`;
    }
    if (this.goalProgressTextEl) {
      this.goalProgressTextEl.textContent = modeHud.progressText ?? '';
    }
  },
  // Enable runner debug via window.__DASH_DEBUG_RUNNER=true or ?dashDebug=1 or localStorage[dashDebugRunner]=1
  isDashRunnerDebugEnabled() {
    const flagFromWindow = window?.[DASH_DEBUG_WINDOW_FLAG] === true;
    const searchParams = new URLSearchParams(window.location.search);
    const queryValue = searchParams.get(DASH_DEBUG_QUERY_KEY) ?? searchParams.get(DASH_DEBUG_LEGACY_QUERY_KEY);
    const storageValue = window.localStorage?.getItem(DASH_DEBUG_STORAGE_KEY);
    return flagFromWindow || queryValue === '1' || storageValue === '1';
  },
  isDashEnemyDebugEnabled() {
    const searchParams = new URLSearchParams(window.location.search);
    const queryValue = searchParams.get(DASH_DEBUG_ENEMY_QUERY_KEY);
    if (queryValue !== null) {
      return queryValue === '1';
    }
    const flagFromWindow = window?.[DASH_DEBUG_ENEMY_WINDOW_FLAG] === true;
    if (flagFromWindow) {
      return true;
    }
    const storageValue = window.localStorage?.getItem(DASH_DEBUG_ENEMY_STORAGE_KEY);
    return storageValue === '1';
  },
  isDashCollisionTestModeEnabled() {
    if (!this.isDashEnemyDebugEnabled()) {
      return false;
    }
    const searchParams = new URLSearchParams(window.location.search);
    const queryValue = searchParams.get(DASH_TEST_COLLISION_QUERY_KEY);
    if (queryValue !== null) {
      return queryValue === '1';
    }
    const storageValue = window.localStorage?.getItem(DASH_TEST_COLLISION_STORAGE_KEY);
    return storageValue === '1';
  },
  isCollisionDebugEnabled() {
    const searchParams = new URLSearchParams(window.location.search);
    const queryValue = searchParams.get(COLLISION_DEBUG_QUERY_KEY);
    const storageValue = window.localStorage?.getItem(COLLISION_DEBUG_STORAGE_KEY);
    return queryValue === '1' || storageValue === '1';
  },
  classifyCollisionPipeline(sample) {
    if (!sample) {
      return 'unknown';
    }
    if (!sample.enemyUpdateCalled) {
      return 'not-running';
    }
    if (!sample.playerRectValid || !sample.enemyRectValid) {
      return 'not-hitting';
    }
    if (!sample.intersects && sample.enemiesCount > 0) {
      return 'not-hitting';
    }
    if (sample.intersects && !sample.collisionFired) {
      return 'ignored';
    }
    if (sample.intersects && sample.collisionFired) {
      return 'fired';
    }
    return 'unknown';
  },
  shouldLogCollisionStage(stage, enemyId, nowMs) {
    if (!this.isDashRunnerDebugEnabled() || !enemyId) {
      return false;
    }
    const key = `${stage}:${enemyId}:${Math.round(nowMs)}`;
    if (this.lastCollisionStageLogKey === key) {
      return false;
    }
    this.lastCollisionStageLogKey = key;
    return true;
  },
  logRunnerOverlapDebug({ enemyId, nowMs }) {
    if (!this.shouldLogCollisionStage('overlap', enemyId, nowMs)) {
      return;
    }
    const cooldownRemaining = Math.max(0, Math.round((this.runnerInvincibleUntilMs ?? 0) - nowMs));
    const invincible = nowMs < (this.runnerInvincibleUntilMs ?? 0);
    const kicking = nowMs < (this.kickUntilMs ?? 0);
    console.log(
      `[dash-debug][COLLIDE:overlap] enemyId=${enemyId}, now=${Math.round(nowMs)}, invincible=${invincible}, kicking=${kicking}, cooldownRemaining=${cooldownRemaining}`,
    );
    this.logCollisionRunnerDebugDump({
      nowMs,
      timeLeftBeforeMs: this.timeLeftMs,
      enemyUpdate: { events: [{ type: 'collision', enemyId }] },
      isRunnerInvincible: invincible,
      defeatSequenceActive: kicking,
      lightweight: true,
    });
  },
  getCollisionEnemyDebugInfo(enemyUpdate) {
    const collisionEvent = enemyUpdate?.events?.find((event) => event?.type === 'collision') ?? null;
    const enemyId = collisionEvent?.enemyId ?? null;
    const enemyType = this.enemySystem?.enemies?.find((enemy) => enemy.id === enemyId)?.type ?? null;
    return { enemyId, enemyType };
  },
  computeRunnerDebugFindings(wrapSnapshot, spriteSnapshot, wrapParentSnapshot) {
    const findings = [];
    if (!wrapSnapshot.exists || !spriteSnapshot.exists) {
      findings.push('A(domMissing)');
    }
    const hasHiddenStyle = [wrapSnapshot, spriteSnapshot].some((snapshot) => (
      snapshot.exists
      && (
        snapshot.computed.display === 'none'
        || snapshot.computed.visibility === 'hidden'
        || snapshot.computed.opacity <= 0.01
      )
    ));
    if (hasHiddenStyle) {
      findings.push('B(hidden)');
    }
    const hasOffscreen = [wrapSnapshot, spriteSnapshot].some((snapshot) => {
      if (!snapshot.exists || !snapshot.rect) {
        return false;
      }
      return (
        snapshot.rect.right < 0
        || snapshot.rect.left > window.innerWidth
        || snapshot.rect.bottom < 0
        || snapshot.rect.top > window.innerHeight
      );
    });
    if (hasOffscreen) {
      findings.push('C(offscreen)');
    }
    const hasStackingRisk = [wrapSnapshot, spriteSnapshot].some((snapshot) => (
      snapshot.exists
      && (
        snapshot.computed.zIndex === 'auto'
        || Number.isFinite(Number(snapshot.computed.zIndex))
      )
    )) && (
      wrapParentSnapshot?.exists
      && (wrapParentSnapshot.computed.isolation === 'isolate' || wrapParentSnapshot.computed.transform !== 'none')
    );
    if (hasStackingRisk) {
      findings.push('D(behind)');
    }
    return findings.length > 0 ? findings : ['none'];
  },
  logCollisionRunnerDebugDump({
    nowMs,
    timeLeftBeforeMs,
    enemyUpdate,
    isRunnerInvincible,
    defeatSequenceActive,
    lightweight = false,
  }) {
    if (!this.isDashRunnerDebugEnabled()) {
      return;
    }
    if (!lightweight && this.lastCollisionDebugMs === nowMs) {
      return;
    }
    if (!lightweight) {
      this.lastCollisionDebugMs = nowMs;
    }
    const runnerWrap = domRefs.game.runnerWrap ?? document.querySelector('.runner-wrap');
    const runnerSprite = domRefs.game.runner ?? document.querySelector('#runner-sprite');
    const wrapSnapshot = this.captureRunnerDebugSnapshot(runnerWrap, '.runner-wrap');
    const spriteSnapshot = this.captureRunnerDebugSnapshot(runnerSprite, '#runner-sprite');
    const wrapParentSnapshot = this.captureRunnerDebugSnapshot(runnerWrap?.parentElement ?? null, '.runner-wrap parent');
    const { enemyId, enemyType } = this.getCollisionEnemyDebugInfo(enemyUpdate);
    if (lightweight) {
      console.log('[dash-debug] collision-runner-dump', {
        nowMs,
        enemyId,
        enemyType,
        runnerWrap: {
          exists: wrapSnapshot.exists,
          className: wrapSnapshot.className,
          computed: wrapSnapshot.computed
            ? {
              display: wrapSnapshot.computed.display,
              visibility: wrapSnapshot.computed.visibility,
              opacity: wrapSnapshot.computed.opacity,
            }
            : null,
          rect: wrapSnapshot.rect,
        },
        runnerSprite: {
          exists: spriteSnapshot.exists,
          className: spriteSnapshot.className,
          computed: spriteSnapshot.computed
            ? {
              display: spriteSnapshot.computed.display,
              visibility: spriteSnapshot.computed.visibility,
              opacity: spriteSnapshot.computed.opacity,
            }
            : null,
          rect: spriteSnapshot.rect,
        },
      });
      return;
    }
    const findings = this.computeRunnerDebugFindings(wrapSnapshot, spriteSnapshot, wrapParentSnapshot);
    console.log('[dash-debug] collision-runner-dump', {
      nowMs,
      timeLeftBeforeMs,
      timeLeftAfterMs: this.timeLeftMs,
      enemyId,
      enemyType,
      runnerState: {
        isRunnerHit: nowMs < (this.runnerHitUntilMs ?? 0),
        isRunnerInvincible,
        isKicking: nowMs < (this.kickUntilMs ?? 0),
        defeatSequenceActive,
        kickUntilMs: this.kickUntilMs ?? 0,
        runnerInvincibleUntilMs: this.runnerInvincibleUntilMs ?? 0,
      },
      runnerWrap: wrapSnapshot,
      runnerSprite: spriteSnapshot,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      summary: findings.join('/'),
      note: 'E/F are verified by changeScreen trace and probe continuity logs',
    });
  },
  classifyRunnerDebugSnapshot(snapshot, parentSnapshot) {
    if (!snapshot.exists) {
      return 'DOM_REMOVED';
    }
    if (
      snapshot.computed.display === 'none'
      || snapshot.computed.visibility === 'hidden'
      || snapshot.computed.opacity <= 0.01
    ) {
      return 'HIDDEN_STYLE';
    }
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const isOutsideViewport = (
      snapshot.rect.right < -200
      || snapshot.rect.left > viewportW + 200
      || snapshot.rect.bottom < -200
      || snapshot.rect.top > viewportH + 200
    );
    if (snapshot.rect.width <= 1 || snapshot.rect.height <= 1 || isOutsideViewport) {
      return 'OFFSCREEN_OR_ZERO_RECT';
    }
    if (
      parentSnapshot?.exists
      && (
        parentSnapshot.computed.opacity < 1
        || parentSnapshot.computed.transform !== 'none'
        || parentSnapshot.computed.isolation === 'isolate'
      )
      && (snapshot.computed.zIndex === 'auto' || parentSnapshot.computed.zIndex === 'auto')
    ) {
      return 'STACKING_RISK';
    }
    return 'VISIBLE_OK';
  },
  captureRunnerDebugSnapshot(el, label) {
    if (!el) {
      return {
        label,
        exists: false,
        className: null,
        computed: null,
        rect: null,
      };
    }
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      label,
      exists: true,
      className: el.className,
      computed: {
        display: computed.display,
        visibility: computed.visibility,
        opacity: Number.parseFloat(computed.opacity) || 0,
        transform: computed.transform,
        zIndex: computed.zIndex,
        isolation: computed.isolation,
      },
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
    };
  },
  logRunnerDebugProbeFrame() {
    const runnerWrap = domRefs.game.runnerWrap ?? document.querySelector('.runner-wrap');
    const runnerSprite = domRefs.game.runner ?? document.querySelector('#runner-sprite');
    const wrapParent = runnerWrap?.parentElement ?? null;
    const spriteParent = runnerSprite?.parentElement ?? null;
    const wrapSnapshot = this.captureRunnerDebugSnapshot(runnerWrap, '.runner-wrap');
    const spriteSnapshot = this.captureRunnerDebugSnapshot(runnerSprite, '#runner-sprite');
    const wrapParentSnapshot = this.captureRunnerDebugSnapshot(wrapParent, '.runner-wrap parent');
    const spriteParentSnapshot = this.captureRunnerDebugSnapshot(spriteParent, '#runner-sprite parent');
    const wrapLabel = this.classifyRunnerDebugSnapshot(wrapSnapshot, wrapParentSnapshot);
    const spriteLabel = this.classifyRunnerDebugSnapshot(spriteSnapshot, spriteParentSnapshot);

    console.log('[dash-debug] runner-probe-frame', {
      frameCount: this.runnerDebugProbeFrameCount,
      timestamp: window.performance.now(),
      recentScreenChange: window.__DASH_DEBUG_LAST_SCREEN_CHANGE ?? null,
      frame: this.runnerDebugProbeFrameCount,
      wrap: {
        label: wrapLabel,
        exists: wrapSnapshot.exists,
        className: wrapSnapshot.className,
        computed: wrapSnapshot.computed,
        rect: wrapSnapshot.rect,
      },
      sprite: {
        label: spriteLabel,
        exists: spriteSnapshot.exists,
        className: spriteSnapshot.className,
        computed: spriteSnapshot.computed,
        rect: spriteSnapshot.rect,
      },
      wrapParent: {
        exists: wrapParentSnapshot.exists,
        className: wrapParentSnapshot.className,
        computed: wrapParentSnapshot.computed,
        rect: wrapParentSnapshot.rect,
      },
      spriteParent: {
        exists: spriteParentSnapshot.exists,
        className: spriteParentSnapshot.className,
        computed: spriteParentSnapshot.computed,
        rect: spriteParentSnapshot.rect,
      },
      hint: wrapLabel === 'VISIBLE_OK' && spriteLabel !== 'VISIBLE_OK'
        ? 'runner-wrap visible but sprite risky'
        : null,
    });
  },
  stopRunnerHitDebugProbe() {
    if (this.runnerDebugProbeRafId) {
      window.cancelAnimationFrame(this.runnerDebugProbeRafId);
      this.runnerDebugProbeRafId = null;
    }
    this.runnerDebugProbeActive = false;
  },
  startRunnerHitDebugProbe(nowMs = window.performance.now()) {
    if (!this.isDashRunnerDebugEnabled() || this.runnerDebugProbeActive) {
      return;
    }
    this.runnerDebugProbeActive = true;
    this.runnerDebugProbeUntilMs = nowMs + 1000;
    this.runnerDebugProbeFrameCount = 0;
    const tick = (timestamp) => {
      if (!this.runnerDebugProbeActive) {
        return;
      }
      this.runnerDebugProbeFrameCount += 1;
      if (this.runnerDebugProbeFrameCount % 12 === 0) {
        this.logRunnerDebugProbeFrame();
      }
      if (timestamp >= this.runnerDebugProbeUntilMs) {
        this.stopRunnerHitDebugProbe();
        return;
      }
      this.runnerDebugProbeRafId = window.requestAnimationFrame(tick);
    };
    this.runnerDebugProbeRafId = window.requestAnimationFrame(tick);
  },
  destroyRunnerDebugOutline() {
    if (this.runnerDebugOutlineEl) {
      this.runnerDebugOutlineEl.remove();
      this.runnerDebugOutlineEl = null;
    }
  },
  ensureRunnerDebugOutline() {
    if (!this.isDashRunnerDebugEnabled()) {
      this.destroyRunnerDebugOutline();
      return null;
    }
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return null;
    }
    if (!this.runnerDebugOutlineEl || !overlayRoot.contains(this.runnerDebugOutlineEl)) {
      const outline = document.createElement('div');
      outline.className = 'dash-runner-debug-outline';
      overlayRoot.appendChild(outline);
      this.runnerDebugOutlineEl = outline;
    }
    return this.runnerDebugOutlineEl;
  },
  updateRunnerDebugOutline() {
    const outline = this.ensureRunnerDebugOutline();
    if (!outline) {
      return;
    }
    const runnerWrap = domRefs.game.runnerWrap ?? document.querySelector('.runner-wrap');
    if (!runnerWrap) {
      outline.hidden = true;
      return;
    }
    const rect = runnerWrap.getBoundingClientRect();
    outline.hidden = false;
    outline.style.left = `${Math.round(rect.x)}px`;
    outline.style.top = `${Math.round(rect.y)}px`;
    outline.style.width = `${Math.max(0, Math.round(rect.width))}px`;
    outline.style.height = `${Math.max(0, Math.round(rect.height))}px`;
  },
  showDebugToast(message) {
    if (!this.isDebugEnabled()) {
      return;
    }
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return;
    }
    if (!this.debugToastEl || !overlayRoot.contains(this.debugToastEl)) {
      const toast = document.createElement('div');
      toast.className = 'dash-debug-toast';
      toast.setAttribute('aria-live', 'polite');
      overlayRoot.appendChild(toast);
      this.debugToastEl = toast;
    }
    this.debugToastEl.textContent = message;
    this.debugToastEl.hidden = false;
    if (this.debugToastTimeout) {
      window.clearTimeout(this.debugToastTimeout);
    }
    this.debugToastTimeout = window.setTimeout(() => {
      if (this.debugToastEl) {
        this.debugToastEl.hidden = true;
      }
      this.debugToastTimeout = null;
    }, 800);
  },
  ensureDashOverlayRoot() {
    const host = domRefs.dashGame.screen ?? document.body;
    if (!host) {
      return null;
    }
    if (!this.overlayRootEl || !this.overlayRootEl.isConnected || this.overlayRootEl.parentElement !== host) {
      this.overlayRootEl?.remove();
      const root = document.createElement('div');
      root.className = 'dash-overlay-root';
      host.appendChild(root);
      this.overlayRootEl = root;
    }
    return this.overlayRootEl;
  },
  showBuildBadge() {
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return;
    }
    if (!this.buildBadgeEl || !overlayRoot.contains(this.buildBadgeEl)) {
      const badge = document.createElement('div');
      badge.className = 'dash-build-badge';
      overlayRoot.appendChild(badge);
      this.buildBadgeEl = badge;
    }
    this.buildBadgeEl.textContent = `DASH BUILD: ${DASH_BUILD_TAG}`;
    this.buildBadgeEl.hidden = false;
    if (this.buildBadgeTimeout) {
      window.clearTimeout(this.buildBadgeTimeout);
    }
    this.buildBadgeTimeout = window.setTimeout(() => {
      if (this.buildBadgeEl) {
        this.buildBadgeEl.hidden = true;
      }
      this.buildBadgeTimeout = null;
    }, 2000);
  },
  ensureLoopMonitorBadge() {
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return null;
    }
    if (!this.loopMonitorBadgeEl || !overlayRoot.contains(this.loopMonitorBadgeEl)) {
      const badge = document.createElement('div');
      badge.className = 'dash-loop-monitor-badge';
      overlayRoot.appendChild(badge);
      this.loopMonitorBadgeEl = badge;
    }
    return this.loopMonitorBadgeEl;
  },
  getLastFrameAgoMs(nowMs = window.performance.now()) {
    if (!Number.isFinite(this.lastFrameAtMs)) {
      return null;
    }
    return Math.max(0, Math.round(nowMs - this.lastFrameAtMs));
  },
  isLoopStopped(nowMs = window.performance.now()) {
    if (!this.isRunning) {
      return true;
    }
    const lastFrameAgoMs = this.getLastFrameAgoMs(nowMs);
    return lastFrameAgoMs === null || lastFrameAgoMs >= LOOP_STOPPED_THRESHOLD_MS;
  },
  updateLoopMonitorBadge(nowMs = window.performance.now()) {
    const badge = this.ensureLoopMonitorBadge();
    if (!badge) {
      return;
    }
    const lastFrameAgoMs = this.getLastFrameAgoMs(nowMs);
    const status = this.isLoopStopped(nowMs) ? 'STOPPED' : 'OK';
    const agoText = lastFrameAgoMs === null ? '--' : String(lastFrameAgoMs);
    const errorText = this.lastLoopErrorMessage ? `\nLAST ERROR: ${this.lastLoopErrorMessage}` : '';
    badge.textContent = [
      `RUN LOOP: ${status}`,
      `frameCount: ${this.loopFrameCount}`,
      `lastFrameAgo(ms): ${agoText}`,
      `recoveries: ${this.loopRecoveryCount}/${LOOP_RECOVERY_MAX_ATTEMPTS}`,
    ].join('\n') + errorText;
    badge.setAttribute('data-status', status.toLowerCase());
  },
  noteLoopError(error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    this.lastLoopErrorMessage = message;
    this.lastLoopErrorAtMs = window.performance.now();
    console.error('[dash-game] loop error', error);
    this.updateLoopMonitorBadge();
  },
  refreshRunDomRefs() {
    const screen = domRefs.dashGame.screen;
    const runLayer = domRefs.game.runLayer;
    if (!screen) {
      return;
    }
    const resolveInScope = (selectors) => {
      for (const selector of selectors) {
        const found = screen.querySelector(selector);
        if (found) {
          return found;
        }
      }
      return null;
    };
    domRefs.game.runWorld = runLayer?.querySelector('.run-world')
      ?? resolveInScope(['.run-layer .run-world', '.run-world']);
    domRefs.game.runnerWrap = domRefs.game.runWorld?.querySelector('.runner-wrap')
      ?? resolveInScope(['.run-layer .runner-wrap', '.runner-wrap']);
    domRefs.game.runner = domRefs.game.runnerWrap?.querySelector('#runner-sprite, img#runner-sprite')
      ?? resolveInScope(['.run-layer #runner-sprite', '#runner-sprite']);
  },
  startLoopWatchdog() {
    this.stopLoopWatchdog();
    this.watchdogTimerId = window.setInterval(() => {
      if (!this.isScreenActive() || this.hasEnded) {
        return;
      }
      const nowMs = window.performance.now();
      this.updateLoopMonitorBadge(nowMs);
      if (!this.isLoopStopped(nowMs)) {
        return;
      }
      if (this.loopRecoveryCount >= LOOP_RECOVERY_MAX_ATTEMPTS) {
        return;
      }
      this.loopRecoveryCount += 1;
      this.startLoop({ isRecovery: true });
      this.updateLoopMonitorBadge();
    }, LOOP_WATCHDOG_INTERVAL_MS);
  },
  stopLoopWatchdog() {
    if (this.watchdogTimerId) {
      window.clearInterval(this.watchdogTimerId);
      this.watchdogTimerId = null;
    }
  },
  ensureDiagnosticsHud() {
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return null;
    }
    if (!this.diagnosticsHudEl || !overlayRoot.contains(this.diagnosticsHudEl)) {
      const hud = document.createElement('div');
      hud.className = 'dash-diagnostics-hud';
      overlayRoot.appendChild(hud);
      this.diagnosticsHudEl = hud;
    }
    return this.diagnosticsHudEl;
  },
  ensureDiagnosticsHitboxes() {
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return null;
    }
    if (!this.playerHitboxEl || !overlayRoot.contains(this.playerHitboxEl)) {
      const playerBox = document.createElement('div');
      playerBox.className = 'dash-hitbox-player';
      playerBox.hidden = true;
      overlayRoot.appendChild(playerBox);
      this.playerHitboxEl = playerBox;
    }
    if (!this.enemyHitboxEl || !overlayRoot.contains(this.enemyHitboxEl)) {
      const enemyBox = document.createElement('div');
      enemyBox.className = 'dash-hitbox-enemy';
      enemyBox.hidden = true;
      overlayRoot.appendChild(enemyBox);
      this.enemyHitboxEl = enemyBox;
    }
    return {
      player: this.playerHitboxEl,
      enemy: this.enemyHitboxEl,
    };
  },
  formatDiagnosticRect(label, rect) {
    if (!rect) {
      return `${label}:0 x:null y:null w:null h:null`;
    }
    return `${label}:1 x:${Math.round(rect.x)} y:${Math.round(rect.y)} w:${Math.round(rect.w)} h:${Math.round(rect.h)}`;
  },
  applyHitboxRect(hitboxEl, worldRect, rect) {
    if (!hitboxEl) {
      return;
    }
    if (!worldRect || !rect) {
      hitboxEl.hidden = true;
      return;
    }
    hitboxEl.hidden = false;
    hitboxEl.style.left = `${Math.round(worldRect.left + rect.x)}px`;
    hitboxEl.style.top = `${Math.round(worldRect.top + rect.y)}px`;
    hitboxEl.style.width = `${Math.max(0, Math.round(rect.w))}px`;
    hitboxEl.style.height = `${Math.max(0, Math.round(rect.h))}px`;
  },
  updateDiagnostics({
    playerRect,
    enemyRect,
    enemyRectRaw = null,
    playerRectNorm = null,
    enemyRectNorm = null,
    worldRect,
    groundY,
    collision,
    attackHandled,
    pipelineStatus = 'unknown',
    intersects = false,
    intersectsRaw = false,
    intersectsNorm = false,
    enemiesCount = 0,
    flags = {},
    groundDebug = null,
  }) {
    const debugEnabled = this.isDebugEnabled() || this.isCollisionDebugEnabled();
    if (!debugEnabled) {
      if (this.diagnosticsHudEl) {
        this.diagnosticsHudEl.hidden = true;
      }
      if (this.playerHitboxEl) {
        this.playerHitboxEl.hidden = true;
      }
      if (this.enemyHitboxEl) {
        this.enemyHitboxEl.hidden = true;
      }
      return;
    }
    const hud = this.ensureDiagnosticsHud();
    if (!hud) {
      return;
    }
    const dx = playerRect && enemyRect ? Math.round(enemyRect.x - playerRect.x) : null;
    const dy = playerRect && enemyRect ? Math.round(enemyRect.y - playerRect.y) : null;
    const fmtNormRect = (label, rect) => {
      if (!rect) {
        return `${label}:0 l:null t:null r:null b:null`;
      }
      return `${label}:1 l:${Math.round(rect.left)} t:${Math.round(rect.top)} r:${Math.round(rect.right)} b:${Math.round(rect.bottom)}`;
    };
    const normalizedPlayerRect = playerRectNorm ?? normalizeRect(playerRect);
    const normalizedEnemyRect = enemyRectNorm ?? normalizeRect(enemyRect);
    const worldRectDebug = groundDebug?.worldRect ?? null;
    const groundRectDebug = groundDebug?.groundRect ?? null;
    const localTopDebug = groundDebug?.localTop ?? null;
    const groundTopYFinalDebug = groundDebug?.worldGroundTopY ?? null;
    hud.textContent = [
      `ENEMY_SYS:${this.enemySystem ? 1 : 0} UPD:${this.enemyUpdateCount}`,
      `GROUND_Y:${groundY === null ? 'null' : Math.round(groundY)}`,
      `WORLD: t:${worldRectDebug ? Math.round(worldRectDebug.top) : 'null'} h:${worldRectDebug ? Math.round(worldRectDebug.height) : 'null'}`,
      `GROUND: t:${groundRectDebug ? Math.round(groundRectDebug.top) : 'null'} h:${groundRectDebug ? Math.round(groundRectDebug.height) : 'null'}`,
      `GROUND_LOCAL_TOP:${Number.isFinite(localTopDebug) ? Math.round(localTopDebug) : 'null'}`,
      `GROUND_TOP_Y(final):${groundTopYFinalDebug === null ? 'null' : Math.round(groundTopYFinalDebug)}`,
      this.formatDiagnosticRect('PLAYER(raw)', playerRect),
      this.formatDiagnosticRect('ENEMY(raw)', enemyRectRaw ?? enemyRect),
      this.formatDiagnosticRect('ENEMY(world)', enemyRect),
      fmtNormRect('PLAYER(norm)', normalizedPlayerRect),
      fmtNormRect('ENEMY(norm)', normalizedEnemyRect),
      `DX:${dx ?? 'null'} DY:${dy ?? 'null'}`,
      `COLL:${collision ? 1 : 0} ATK:${attackHandled ? 1 : 0} INT:${intersects ? 1 : 0} RAW:${intersectsRaw ? 1 : 0} NORM:${intersectsNorm ? 1 : 0}`,
      `ENEMIES:${enemiesCount} PIPE:${pipelineStatus}`,
      `FLAGS g:${flags.startGrace ? 1 : 0} inv:${flags.invincible ? 1 : 0} kick:${flags.kicking ? 1 : 0} en:${flags.collisionEnabled ? 1 : 0} h:${flags.handledCollision ? 1 : 0} cd:${Math.round(flags.cooldownMs ?? 0)}`,
    ].join('\n');

    this.ensureDiagnosticsHitboxes();
    this.applyHitboxRect(this.playerHitboxEl, worldRect, playerRect);
    this.applyHitboxRect(this.enemyHitboxEl, worldRect, enemyRect);
  },
  updateDebugHud({
    hasPlayerRect,
    collided,
    attackHandled,
    cooldownMs,
    enemyRect,
    nearestDxPx,
    nearestDyPx,
  }) {
    const debugEnabled = this.isDebugEnabled();
    if (!debugEnabled) {
      if (this.debugHudEl) {
        this.debugHudEl.hidden = true;
      }
      return;
    }
    const overlayRoot = this.ensureDashOverlayRoot();
    if (!overlayRoot) {
      return;
    }
    if (!this.debugHudEl || !overlayRoot.contains(this.debugHudEl)) {
      const hud = document.createElement('div');
      hud.className = 'dash-debug-hud';
      overlayRoot.appendChild(hud);
      this.debugHudEl = hud;
    }
    this.debugHudEl.hidden = false;
    const dx = Number.isFinite(nearestDxPx) ? Math.round(nearestDxPx) : '--';
    const dy = Number.isFinite(nearestDyPx) ? Math.round(nearestDyPx) : '--';
    const safeEnemyRect = enemyRect ?? null;
    const enemyRectText = safeEnemyRect
      ? `[${Math.round(safeEnemyRect.left)},${Math.round(safeEnemyRect.top)},${Math.round(safeEnemyRect.right)},${Math.round(safeEnemyRect.bottom)}]`
      : 'none';
    this.debugHudEl.textContent = `PR:${hasPlayerRect ? 1 : 0} COLL:${collided ? 1 : 0} ATK:${attackHandled ? 1 : 0} DX:${dx} DY:${dy} ENEMY_RECT:${enemyRectText} CD:${Math.max(0, Math.round(cooldownMs))}`;
  },
  verifyRunnerDom() {
    const screen = domRefs.dashGame.screen;
    const inDashDebug = this.isDebugEnabled();
    const queryFromScreen = (selectors) => {
      if (!screen) {
        return null;
      }
      for (const selector of selectors) {
        const found = screen.querySelector(selector);
        if (found) {
          return found;
        }
      }
      return null;
    };

    if (!domRefs.game.runnerWrap || !domRefs.game.runnerWrap.isConnected) {
      const nextRunnerWrap = queryFromScreen(['.runner-wrap', '#runner-wrap', '.runner']);
      if (nextRunnerWrap) {
        domRefs.game.runnerWrap = nextRunnerWrap;
      }
    }

    if (!domRefs.game.runner || !domRefs.game.runner.isConnected) {
      const nextRunner = queryFromScreen(['#runner-sprite', 'img#runner-sprite']);
      if (nextRunner) {
        domRefs.game.runner = nextRunner;
      }
    }

    if (inDashDebug && screen) {
      screen.dataset.debugRunnerwrap = domRefs.game.runnerWrap ? 'ok' : 'missing';
    }

    const messages = [];
    if (!domRefs.game.runnerWrap) {
      messages.push('runnerWrap missing');
    }
    if (!domRefs.game.runner) {
      messages.push('runner missing');
    }
    if (messages.length) {
      this.showDebugToast(messages.join(' / '));
    }
  },
  ensureRunnerSpriteGuard() {
    this.verifyRunnerDom();
    const runner = domRefs.game.runner;
    if (!runner) {
      return;
    }

    const defaultRunnerSrc = resolveAssetUrl(RUNNER_DEFAULT_SPRITE_PATH);
    if (!this.runnerSpriteLastSuccessfulSrc) {
      this.runnerSpriteLastSuccessfulSrc = runner.currentSrc || runner.src || defaultRunnerSrc;
    }

    if (runner.dataset.guardAttached !== 'true') {
      runner.removeAttribute('onerror');
      runner.dataset.guardAttached = 'true';
      this.handleRunnerSpriteLoad = () => {
        const loadedSrc = runner.currentSrc || runner.src;
        if (!loadedSrc) {
          return;
        }
        this.runnerSpriteLastSuccessfulSrc = loadedSrc;
        runner.style.removeProperty('display');
        runner.style.removeProperty('visibility');
        runner.style.opacity = '1';
      };
      this.handleRunnerSpriteError = () => {
        const failedSrc = runner.currentSrc || runner.src || '(unknown)';
        if (!this.runnerSpriteLoadWarned) {
          this.runnerSpriteLoadWarned = true;
          this.runnerSpriteLastFailedSrc = failedSrc;
          console.warn('[runner-sprite] image load failed; keeping runner visible with fallback sprite', {
            failedSrc,
          });
        }

        const fallbackSrc = this.runnerSpriteLastSuccessfulSrc || defaultRunnerSrc;
        if (runner.src !== fallbackSrc) {
          runner.src = fallbackSrc;
        } else if (fallbackSrc !== defaultRunnerSrc) {
          runner.src = defaultRunnerSrc;
        }

        runner.style.removeProperty('display');
        runner.style.removeProperty('visibility');
        runner.style.opacity = '1';
        document.documentElement.classList.remove('runner-missing');
        domRefs.game.runLayer?.classList.remove('runner-missing');
        domRefs.dashGame.screen?.classList.remove('runner-missing');
      };
      runner.addEventListener('load', this.handleRunnerSpriteLoad);
      runner.addEventListener('error', this.handleRunnerSpriteError);
    }

    const currentSrc = runner.currentSrc || runner.src || '';
    if (!currentSrc || currentSrc.includes('/undefined')) {
      runner.src = this.runnerSpriteLastSuccessfulSrc || defaultRunnerSrc;
    }
  },
  setupRunnerMutationDebugObserver() {
    if (!this.isDashRunnerDebugEnabled()) {
      return;
    }
    this.teardownRunnerMutationDebugObserver();
    const observeTarget = (target, targetLabel) => {
      if (!target) {
        return;
      }
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          const oldValue = mutation.oldValue ?? '';
          const newValue = target.getAttribute(mutation.attributeName) ?? '';
          if (oldValue === newValue) {
            return;
          }
          const mutationLabel = mutation.attributeName === 'class'
            ? 'class-change'
            : 'style-change';
          console.log(`[dash-debug][RUNNER:${mutationLabel}]`, {
            target: targetLabel,
            oldValue,
            newValue,
          });
          console.trace(`[dash-debug][RUNNER:${mutationLabel}]`);
        });
      });
      observer.observe(target, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style'],
      });
      this.runnerMutationObservers.push(observer);
    };
    this.runnerMutationObservers = [];
    observeTarget(domRefs.game.runnerWrap, 'class-change');
    observeTarget(domRefs.game.runner, 'sprite-class-change');
  },
  teardownRunnerMutationDebugObserver() {
    if (!Array.isArray(this.runnerMutationObservers)) {
      this.runnerMutationObservers = [];
      return;
    }
    this.runnerMutationObservers.forEach((observer) => observer.disconnect());
    this.runnerMutationObservers = [];
  },
  applyDashTheme() {
    const bgThemeId = toDashRunBgThemeId(this.dashStageId);
    [domRefs.dashGame.screen, domRefs.game.runWorld].forEach((element) => {
      if (!element) {
        return;
      }
      element.setAttribute('data-bg-theme', bgThemeId);
    });
  },
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
  getPlayerRect() {
    const worldRect = this.getWorldRectForCollision();
    const runnerWrap = domRefs.game.runnerWrap;
    if (!worldRect || !runnerWrap || !runnerWrap.isConnected) {
      return null;
    }
    const runnerRect = runnerWrap.getBoundingClientRect();
    return {
      x: runnerRect.left - worldRect.left,
      y: runnerRect.top - worldRect.top,
      w: runnerRect.width,
      h: runnerRect.height,
    };
  },
  getWorldRectForCollision() {
    const runWorld = this.runWorld ?? domRefs.game.runWorld;
    if (runWorld?.isConnected) {
      return runWorld.getBoundingClientRect();
    }
    const runLayer = this.runLayer ?? domRefs.game.runLayer;
    const runWorldFromLayer = runLayer?.isConnected ? runLayer.querySelector('.run-world') : null;
    if (runWorldFromLayer?.isConnected) {
      domRefs.game.runWorld = runWorldFromLayer;
      return runWorldFromLayer.getBoundingClientRect();
    }
    const runZone = domRefs.dashGame.screen?.querySelector('.dash-run-zone');
    if (runZone?.isConnected) {
      return runZone.getBoundingClientRect();
    }
    return null;
  },
  getWorldGroundTopY() {
    const runWorld = this.runWorld ?? domRefs.game.runWorld;
    const worldRect = this.getWorldRectForCollision();
    if (!runWorld?.isConnected || !worldRect) {
      this.lastGroundTopDiagnostics = {
        worldRect,
        groundRect: null,
        localTop: null,
        worldGroundTopY: null,
      };
      return null;
    }
    const runWorldGround = runWorld.querySelector('.run-ground');
    const groundTile = runWorldGround ? null : runWorld.querySelector('.run-ground__tile');
    const groundEl = runWorldGround
      ?? (groundTile?.parentElement && runWorld.contains(groundTile.parentElement)
        ? groundTile.parentElement
        : null);
    if (!groundEl || !groundEl.isConnected) {
      this.lastGroundTopDiagnostics = {
        worldRect,
        groundRect: null,
        localTop: null,
        worldGroundTopY: null,
      };
      return null;
    }
    const groundRect = groundEl.getBoundingClientRect();
    const localTop = groundRect.top - worldRect.top;
    let worldGroundTopY = Math.round(localTop);
    const invalidLocalTop = (
      !Number.isFinite(localTop)
      || localTop < 0
      || localTop > worldRect.height
    );
    if (invalidLocalTop) {
      const playerRect = this.getPlayerRect();
      if (playerRect) {
        worldGroundTopY = Math.round(playerRect.y + playerRect.h);
      } else if (Number.isFinite(groundRect.height)) {
        worldGroundTopY = Math.round(worldRect.height - groundRect.height);
      } else {
        worldGroundTopY = Math.round(worldRect.height * 0.85);
      }
    }
    this.lastGroundTopDiagnostics = {
      worldRect,
      groundRect,
      localTop,
      worldGroundTopY,
    };
    return worldGroundTopY;
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
  updateRunLayerVisuals(dtMs, runSpeed = this.playerSpeed, isSlowed = false) {
    const dtSec = dtMs / 1000;
    if (!Number.isFinite(dtSec) || dtSec <= 0) {
      return;
    }
    if (this.hasEnded) {
      return;
    }
    const nowMs = window.performance.now();
    const runWorld = domRefs.game.runWorld;
    const runSky = domRefs.game.runSky;
    const speedLines = domRefs.game.speedLines;
    const runner = domRefs.game.runner;
    const runnerWrap = domRefs.game.runnerWrap;

    const speedValue = Math.max(0, Number(runSpeed) || 0);
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
    runner?.classList.toggle('hit', isSlowed);
    runnerWrap?.classList.toggle('is-fast', speedRatio > 0.7);
    runnerWrap?.classList.toggle('is-rapid', speedRatio > 0.85);
    if (runnerWrap) {
      this.updateRunnerDamageState(nowMs);
      if (nowMs < (this.kickUntilMs ?? 0)) {
        runnerWrap.classList.add('is-kicking');
        const lungePx = Number(this.kickLungePx) || 0;
        runnerWrap.style.setProperty('--kick-lunge-px', `${lungePx}px`);
      } else {
        runnerWrap.classList.remove('is-kicking');
        runnerWrap.style.setProperty('--kick-lunge-px', '0px');
        this.kickLungePx = 0;
      }
    }

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
  triggerRunnerStumble() {
    this.verifyRunnerDom();
    const runnerWrap = domRefs.game.runnerWrap;
    if (!runnerWrap) {
      return;
    }
    const debugEnabled = this.isDebugEnabled();
    runnerWrap.classList.toggle('is-debug-stumble', debugEnabled);
    runnerWrap.classList.add('is-runner-hit');
  },
  addClassWithRestart(element, className, durationMs) {
    if (!element || !className) {
      return;
    }
    if (!this.hitEffectTimeouts) {
      this.hitEffectTimeouts = new WeakMap();
    }
    element.classList.remove(className);
    // Reflow to ensure the same animation class can be retriggered on consecutive hits.
    void element.offsetWidth;
    element.classList.add(className);
    const effectTimeouts = this.hitEffectTimeouts.get(element) ?? new Map();
    const prevTimeoutId = effectTimeouts.get(className);
    if (prevTimeoutId) {
      window.clearTimeout(prevTimeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      element.classList.remove(className);
      if (effectTimeouts.get(className) === timeoutId) {
        effectTimeouts.delete(className);
      }
    }, Math.max(0, durationMs));
    effectTimeouts.set(className, timeoutId);
    this.hitEffectTimeouts.set(element, effectTimeouts);
  },
  triggerHitEffects() {
    domRefs.game.runWorld?.style.setProperty('--dash-hit-shake-px', `${HIT_SHAKE_PX}px`);
    this.addClassWithRestart(domRefs.game.runWorld, HIT_SHAKE_CLASS, HIT_SHAKE_MS);
    this.addClassWithRestart(domRefs.game.runnerWrap, HIT_FLASH_CLASS, HIT_FLASH_MS);
  },
  triggerDefeatEffects() {
    this.addClassWithRestart(domRefs.game.runWorld, DEFEAT_SHAKE_CLASS, DEFEAT_SHAKE_MS);
    this.addClassWithRestart(domRefs.game.runWorld, DEFEAT_FLASH_CLASS, DEFEAT_FLASH_MS);
  },
  updateRunnerDamageState(nowMs) {
    const runnerWrap = domRefs.game.runnerWrap;
    if (!runnerWrap) {
      return;
    }
    const isRunnerHit = nowMs < (this.runnerHitUntilMs ?? 0);
    const isRunnerInvincible = nowMs < (this.runnerInvincibleUntilMs ?? 0);
    runnerWrap.classList.toggle('is-runner-hit', isRunnerHit);
    runnerWrap.classList.toggle('is-runner-invincible', isRunnerInvincible);
    if (!isRunnerHit) {
      runnerWrap.classList.remove('is-debug-stumble');
    }
  },
  resetDashRunnerVisibilityState() {
    const runner = domRefs.game.runner;
    const runnerWrap = domRefs.game.runnerWrap;
    const runLayer = domRefs.game.runLayer;
    document.documentElement.classList.remove('runner-missing');
    runLayer?.classList.remove('runner-missing');
    domRefs.dashGame.screen?.classList.remove('runner-missing');
    runnerWrap?.classList.remove('is-runner-hit', 'is-runner-invincible', 'is-debug-stumble', HIT_FLASH_CLASS);
    if (runner) {
      runner.style.removeProperty('display');
      runner.style.removeProperty('visibility');
      runner.style.opacity = '1';
      runner.classList.remove('hit');
    }
  },
  // State model (local-only, per spec):
  // - playerSpeed (m/s), enemySpeed (m/s), enemyGapM (meters behind), timeLeftMs (ms), lastTickTs (ms)
  // - currentQuestion / inputBuffer are managed locally via questionGenerator + input element.
  // Global results persist ONLY to gameState.dash: distanceM, correctCount, wrongCount, defeatedCount, streak.
  getInitialTimeLimitMs() {
    const limitSeconds = Number(gameState?.timeLimit);
    const difficulty = dashSettingsStore.get()?.difficulty ?? 'normal';
    const multiplier = DASH_DIFFICULTY_TIME_LIMIT_MULTIPLIER[difficulty] ?? 1;
    if (Number.isFinite(limitSeconds) && limitSeconds > 0) {
      return limitSeconds * 1000 * multiplier;
    }
    return DEFAULT_TIME_LIMIT_MS * multiplier;
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
  clearGoalClearEffect() {
    if (this.goalClearTimeout) {
      window.clearTimeout(this.goalClearTimeout);
      this.goalClearTimeout = null;
    }
    this.goalClearPlaying = false;
    domRefs.dashGame.screen?.classList.remove(GOAL_CLEAR_SHAKE_CLASS);
    domRefs.dashGame.goalOverlay?.classList.remove(GOAL_CLEAR_FX_CLASS);
  },
  triggerGoalClearEffect(durationMs = GOAL_CLEAR_DEFAULT_DURATION_MS) {
    if (this.goalClearPlaying) {
      return;
    }
    const overlay = domRefs.dashGame.goalOverlay;
    if (!overlay) {
      return;
    }
    this.goalClearPlaying = true;
    const clampedDurationMs = Math.max(800, Math.min(Number(durationMs) || GOAL_CLEAR_DEFAULT_DURATION_MS, 1200));
    overlay.classList.remove(GOAL_CLEAR_FX_CLASS);
    void overlay.offsetWidth;
    overlay.classList.add(GOAL_CLEAR_FX_CLASS);
    domRefs.dashGame.screen?.classList.add(GOAL_CLEAR_SHAKE_CLASS);
    this.goalClearTimeout = window.setTimeout(() => {
      this.clearGoalClearEffect();
    }, clampedDurationMs);
  },
  updateHud() {
    const modeHud = this.modeStrategy?.getHudState?.(this.getModeContext()) ?? null;
    const modeContext = this.getModeContext();
    if (domRefs.dashGame.distance) {
      domRefs.dashGame.distance.textContent = modeHud?.distanceText ?? gameState.dash.distanceM.toFixed(1);
    }
    this.applyModeHud(modeHud);
    if (modeHud?.hideNextArea) {
      if (domRefs.dashGame.nextArea) {
        domRefs.dashGame.nextArea.hidden = true;
        domRefs.dashGame.nextArea.textContent = '';
      }
    } else {
      this.updateNextAreaIndicator(gameState.dash.distanceM);
    }
    if (domRefs.dashGame.speed) {
      domRefs.dashGame.speed.textContent = modeHud?.statOverrides?.speed?.value ?? this.playerSpeed.toFixed(1);
    }
    if (domRefs.dashGame.enemyCount) {
      domRefs.dashGame.enemyCount.textContent = modeHud?.statOverrides?.enemyCount?.value ?? String(gameState.dash.defeatedCount || 0);
    }
    const barModel = this.buildBarModel(modeContext, modeHud);
    const widthPercentText = `${(barModel.ratio * 100).toFixed(1)}%`;
    const nextBarModel = {
      modeId: barModel.modeId,
      state: barModel.state,
      valueText: barModel.valueText,
      unitText: barModel.unitText,
      noteText: barModel.noteText,
      widthPercentText,
    };
    const prevBarModel = this.lastBarModel;
    const hasBarChanges = !prevBarModel
      || prevBarModel.modeId !== nextBarModel.modeId
      || prevBarModel.state !== nextBarModel.state
      || prevBarModel.valueText !== nextBarModel.valueText
      || prevBarModel.unitText !== nextBarModel.unitText
      || prevBarModel.noteText !== nextBarModel.noteText
      || prevBarModel.widthPercentText !== nextBarModel.widthPercentText;
    const timeWrap = domRefs.dashGame.timeWrap;
    if (timeWrap && hasBarChanges) {
      if (timeWrap.dataset.mode !== barModel.modeId) {
        timeWrap.dataset.mode = barModel.modeId;
      }
      if (timeWrap.dataset.state !== barModel.state) {
        timeWrap.dataset.state = barModel.state;
      }
    }
    if (domRefs.dashGame.timeBar && (!prevBarModel || prevBarModel.widthPercentText !== nextBarModel.widthPercentText)) {
      domRefs.dashGame.timeBar.style.width = widthPercentText;
    }
    if (domRefs.dashGame.timeRemaining && (!prevBarModel || prevBarModel.valueText !== nextBarModel.valueText)) {
      domRefs.dashGame.timeRemaining.textContent = barModel.valueText;
    }
    if (!this.timeUnitEl && timeWrap) {
      this.timeUnitEl = timeWrap.querySelector('.dash-time-unit');
    }
    if (this.timeUnitEl && (!prevBarModel || prevBarModel.unitText !== nextBarModel.unitText)) {
      this.timeUnitEl.textContent = barModel.unitText;
    }
    if (domRefs.dashGame.timeNote && (!prevBarModel || prevBarModel.noteText !== nextBarModel.noteText)) {
      domRefs.dashGame.timeNote.textContent = barModel.noteText;
    }
    this.lastBarModel = nextBarModel;
    if (domRefs.dashGame.streak) {
      domRefs.dashGame.streak.textContent = modeHud?.statOverrides?.streak?.value ?? String(gameState.dash.streak);
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
  buildBarModel(modeContext, modeHud) {
    void modeHud;
    const modeId = this.currentDashModeId;
    const safeTimeLeftMs = Math.max(0, Number(modeContext?.timeLeftMs) || 0);

    if (modeId === DASH_MODE_TYPES.goalRun) {
      const distanceM = Number(modeContext?.distanceM);
      const safeDistanceM = Number.isFinite(distanceM) ? Math.max(0, distanceM) : 0;
      // SSoT: goalRunMode.initRun() sets goalDistanceM (default 1000m). Keep fallback aligned with that mode contract.
      const goalDistanceM = Math.max(1, Number(modeContext?.modeRuntime?.goalDistanceM) || GOAL_RUN_FALLBACK_DISTANCE_M);
      const remainingDistanceM = Math.max(0, Math.ceil(goalDistanceM - safeDistanceM));
      return {
        modeId,
        ratio: clamp01(safeDistanceM / goalDistanceM),
        valueText: String(remainingDistanceM),
        unitText: 'm',
        noteText: `${safeDistanceM.toFixed(1)}m / ${goalDistanceM.toFixed(0)}m`,
        state: 'safe',
      };
    }

    const timeLimitMs = Math.max(1, Number(this.initialTimeLimitMs) || DEFAULT_TIME_LIMIT_MS);
    const ratio = clamp01(safeTimeLeftMs / timeLimitMs);
    const isLowTime = safeTimeLeftMs <= LOW_TIME_THRESHOLD_MS;
    let state = 'safe';
    if (ratio <= 0.3) {
      state = 'danger';
    } else if (ratio <= 0.6) {
      state = 'caution';
    }

    return {
      modeId,
      ratio,
      valueText: String(Math.max(0, Math.ceil(safeTimeLeftMs / 1000))),
      unitText: '秒',
      noteText: isLowTime ? '残りわずか' : '',
      state: isLowTime ? 'danger' : state,
    };
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
    this.currentQuestion = questionGenerator.next({
      ...gameState.settings,
      stageId: this.dashStageId,
      levelId: this.dashLevelId,
      questionMode: gameState.dash.currentMode,
    });
    if (isDashStartDebugLogEnabled() && !this.hasLoggedQuestionDifficultyDebug) {
      this.hasLoggedQuestionDifficultyDebug = true;
      const difficulty = this.currentQuestion?.meta?.difficulty ?? null;
      console.log('[dash-game.question-difficulty]', {
        stageId: this.dashStageId,
        levelId: this.dashLevelId,
        modeId: this.currentDashModeId,
        labelShort: difficulty?.labelShort ?? null,
        params: difficulty?.operandRule ?? null,
        operatorSet: difficulty?.operatorSet ?? null,
      });
    }
    gameState.dash.currentMode = this.currentQuestion?.meta?.mode ?? null;
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
      const nowMs = window.performance.now();
      const playerRect = this.getPlayerRect();
      const defeatResult = this.enemySystem?.defeatNearestEnemy({
        playerRect,
        nowMs,
        callerTag: 'submitAnswer:defeatNearestEnemy',
      });
      if (defeatResult?.defeated) {
        const target = defeatResult.target;
        if (playerRect && target) {
          const desiredRunnerRight = target.x + target.w * 0.35;
          const currentRunnerRight = playerRect.x + playerRect.w;
          const rawLungePx = desiredRunnerRight - currentRunnerRight;
          this.kickLungePx = Math.max(0, Math.min(rawLungePx, MAX_LUNGE_PX));
        } else {
          this.kickLungePx = 0;
        }
        this.kickUntilMs = nowMs + KICK_MS;
        this.triggerDefeatEffects();
        this.hitstopUntilMs = nowMs + HITSTOP_MS;
        if (defeatResult.isBoss) {
          audioManager.playSfx('sfx_boss_defeat');
          this.showStreakCue(BOSS_DEFEAT_CUE_TEXT);
        } else {
          audioManager.playSfx('sfx_attack');
        }
      } else if (defeatResult?.damaged) {
        audioManager.playSfx('sfx_attack');
        this.kickUntilMs = nowMs + KICK_MS * 0.5;
        this.kickLungePx = 0;
      } else {
        this.kickUntilMs = 0;
        this.kickLungePx = 0;
      }
      audioManager.playSfx('sfx_correct');
      gameState.dash.correctCount += 1;
      gameState.dash.streak += 1;
      this.maxStreak = Math.max(this.maxStreak, gameState.dash.streak);
      this.playerSpeed += speedIncrementPerCorrect;
      this.enemySpeed = enemyBaseSpeed + enemySpeedIncrementPerStreak * gameState.dash.streak;
      this.timeLeftMs += Number(this.timePolicy?.onCorrectMs) || 0;
      if (defeatResult?.defeated) {
        gameState.dash.defeatedCount += 1;
        if (defeatResult.isBoss) {
          gameState.dash.bossDefeatedCount = (gameState.dash.bossDefeatedCount ?? 0) + 1;
          this.timeLeftMs += BOSS_DEFEAT_TIME_BONUS_MS;
        } else {
          this.timeLeftMs += Number(this.timePolicy?.onDefeatMs) || 0;
        }
      }
      if (gameState.dash.streak === streakAttack) {
        this.enemyGapM += collisionThreshold;
        this.showStreakCue(STREAK_ATTACK_CUE_TEXT);
      }
      if (gameState.dash.streak === streakDefeat) {
        this.showStreakCue(STREAK_DEFEAT_CUE_TEXT);
        audioManager.playSfx('sfx_levelup', { volume: 0.8 });
        this.enemyGapM = collisionThreshold * 2;
        this.enemySpeed = enemyBaseSpeed;
        gameState.dash.streak = 0;
      }
      this.attackUntilMs = window.performance.now() + ATTACK_WINDOW_MS;
      this.modeStrategy?.onAnswer?.({ isCorrect: true, modeRuntime: this.modeRuntime });
      this.setFeedback('○', 'correct');
    } else {
      audioManager.playSfx('sfx_wrong');
      gameState.dash.wrongCount += 1;
      gameState.dash.streak = 0;
      this.enemySpeed = enemyBaseSpeed;
      this.timeLeftMs += Number(this.timePolicy?.onWrongMs) || 0;
      this.modeStrategy?.onAnswer?.({ isCorrect: false, modeRuntime: this.modeRuntime });
      this.setFeedback('×', 'wrong');
    }
    if (this.tryEndByMode()) {
      return;
    }
    this.loadNextQuestion();
  },
  updateFrame(dtMs) {
    if (this.timeLeftMs <= 0) {
      return;
    }
    const nowMs = window.performance.now();
    if (nowMs < (this.hitstopUntilMs ?? 0)) {
      return;
    }
    const dtSeconds = dtMs / 1000;
    const isSlowed = nowMs < (this.slowUntilMs ?? 0);
    const defeatSequenceActive = nowMs < (this.kickUntilMs ?? 0);
    const speedMultiplier = isSlowed ? COLLISION_SLOW_MULT : 1;
    const effectivePlayerSpeed = this.playerSpeed * speedMultiplier;
    gameState.dash.distanceM += effectivePlayerSpeed * dtSeconds;
    this.updateArea(gameState.dash.distanceM);
    if (!domRefs.game.runWorld?.isConnected || !domRefs.game.runEnemies?.isConnected) {
      this.refreshRunDomRefs();
    }
    const runWorld = domRefs.game.runWorld;
    const worldRect = runWorld?.getBoundingClientRect?.();
    const runGroundY = gameState.run.groundY ?? gameState.run.groundSurfaceY;
    const groundY = worldRect && Number.isFinite(runGroundY)
      ? Math.round(runGroundY - worldRect.top)
      : null;
    let playerRect = this.getPlayerRect();
    if (playerRect) {
      this.playerRectNullStreak = 0;
    } else {
      this.playerRectNullStreak = (this.playerRectNullStreak ?? 0) + 1;
      if (this.playerRectNullStreak >= PLAYER_RECT_NULL_RECOVERY_STREAK) {
        this.ensureRunLayerMounted();
        this.refreshRunDomRefs();
        this.verifyRunnerDom();
        this.updateRunnerGroundAlignment(true);
        playerRect = this.getPlayerRect();
        if (playerRect) {
          this.playerRectNullStreak = 0;
        }
      }
    }
    const collisionDebugEnabled = this.isCollisionDebugEnabled();
    if (this.enemySystem && (this.enemySystem.worldEl !== runWorld || this.enemySystem.containerEl !== domRefs.game.runEnemies)) {
      this.enemySystem.setWorld(runWorld, domRefs.game.runEnemies);
    }
    let debugCollision = false;
    let debugAttackHandled = false;
    let debugEnemyRect = null;
    let intersects = false;
    let intersectsRaw = false;
    let playerRectNorm = null;
    let enemyRectNorm = null;
    let enemiesCount = 0;
    let enemyRect = null;
    let enemyRectRaw = null;
    let enemyCollisionEnabled = false;
    let enemyStartGrace = false;
    const worldGroundTopY = this.getWorldGroundTopY();
    const groundDebug = this.lastGroundTopDiagnostics ?? null;
    const enemyUpdate = this.enemySystem?.update({
      dtMs,
      nowMs,
      groundY,
      worldGroundTopY,
      cameraX: 0,
      playerRect,
      correctCount: gameState.dash.correctCount,
      attackActive: nowMs <= (this.attackUntilMs ?? 0),
      defeatSequenceActive,
      distanceM: gameState.dash.distanceM ?? 0,
    });
    const isRunnerInvincible = nowMs < (this.runnerInvincibleUntilMs ?? 0);
    this.enemyUpdateCount += 1;
    if (enemyUpdate) {
      if (enemyUpdate.events) {
        for (const evt of enemyUpdate.events) {
          if (evt.type === 'boss_appear') {
            audioManager.playSfx('sfx_boss_appear');
            this.showStreakCue(BOSS_APPEAR_CUE_TEXT);
          }
        }
      }
      if (this.isDashRunnerDebugEnabled() && !this.hasLoggedCollisionResultDebug) {
        this.hasLoggedCollisionResultDebug = true;
        console.log('[dash-debug][COLLIDE:result]', enemyUpdate);
      }
      debugCollision = Boolean(enemyUpdate.collision);
      debugAttackHandled = Boolean(enemyUpdate.attackHandled);
      enemiesCount = enemyUpdate.debug?.enemiesCount ?? this.enemySystem?.enemies?.length ?? 0;
      enemyRect = enemyUpdate.debug?.enemyRect ?? enemyUpdate.nearestEnemyRect ?? null;
      enemyRectRaw = enemyUpdate.debug?.enemyRectRaw ?? null;
      enemyCollisionEnabled = enemyUpdate.debug?.collisionEnabled ?? false;
      enemyStartGrace = enemyUpdate.debug?.startGraceActive ?? false;
      intersects = Boolean(enemyUpdate.debug?.intersects);
      intersectsRaw = Boolean(enemyUpdate.debug?.intersectsRaw);
      playerRectNorm = enemyUpdate.debug?.playerRectNorm ?? null;
      enemyRectNorm = enemyUpdate.debug?.enemyRectNorm ?? null;
      if (enemyUpdate.nearestEnemyRect) {
        const nextEnemyRect = enemyUpdate.nearestEnemyRect;
        debugEnemyRect = {
          left: nextEnemyRect.x + (worldRect?.left ?? 0),
          top: nextEnemyRect.y + (worldRect?.top ?? 0),
          right: nextEnemyRect.x + nextEnemyRect.w + (worldRect?.left ?? 0),
          bottom: nextEnemyRect.y + nextEnemyRect.h + (worldRect?.top ?? 0),
          width: nextEnemyRect.w,
          height: nextEnemyRect.h,
        };
      }
      const handledCollision = (
        enemyUpdate.collision
        && !enemyUpdate.attackHandled
      );
      if (handledCollision) {
        const collisionEvent = enemyUpdate.events?.find((event) => event?.type === 'collision') ?? null;
        const collisionEnemyId = collisionEvent?.enemyId ?? 'unknown';
        if (this.shouldLogCollisionStage('handle-enter', collisionEnemyId, nowMs)) {
          console.log(
            `[dash-debug][COLLIDE:handle-enter] enemyId=${collisionEnemyId}, now=${Math.round(nowMs)}, invincible=${isRunnerInvincible}, kicking=${defeatSequenceActive}`,
          );
        }
        if (!isRunnerInvincible) {
          const timeLeftBeforeMs = this.timeLeftMs;
          const speedBefore = this.playerSpeed;
          // Hit-confirm point: collision && !attackHandled && !invincible.
          this.startRunnerHitDebugProbe(nowMs);
          // NOTE: playSfx is ignored until audio is unlocked; keep this here so
          // damage SFX only attempts on confirmed penalty (not cooldown skips).
          audioManager.playSfx('sfx_damage');
          const collisionDeltaMs = Number(this.timePolicy?.onCollisionMs) || 0;
          this.timeLeftMs = Math.max(0, this.timeLeftMs + collisionDeltaMs);
          this.collisionHits += 1;
          this.modeStrategy?.onCollision?.({ modeRuntime: this.modeRuntime });
          this.logCollisionRunnerDebugDump({
            nowMs,
            timeLeftBeforeMs,
            enemyUpdate,
            isRunnerInvincible,
            defeatSequenceActive,
          });
          this.slowUntilMs = nowMs + COLLISION_SLOW_MS;
          this.runnerHitUntilMs = nowMs + RUNNER_HIT_REACTION_MS;
          this.runnerInvincibleUntilMs = nowMs + DAMAGE_INVINCIBLE_MS;
          this.lastCollisionPenaltyAtMs = nowMs;
          if (this.shouldLogCollisionStage('penalty', collisionEnemyId, nowMs)) {
            console.log(
              `[dash-debug][COLLIDE:penalty] enemyId=${collisionEnemyId}, timeLeft:${Math.round(timeLeftBeforeMs)}->${Math.round(this.timeLeftMs)}, speed:${speedBefore.toFixed(2)}->${this.playerSpeed.toFixed(2)}`,
            );
          }
          if (collisionDebugEnabled) {
            console.debug('[dash-collision] collision event fired', {
              enemyId: collisionEnemyId,
              nowMs: Math.round(nowMs),
              timeLeftBeforeMs: Math.round(timeLeftBeforeMs),
              timeLeftAfterMs: Math.round(this.timeLeftMs),
            });
          }
          this.showDebugToast('HIT -3秒');
          this.verifyRunnerDom();
          this.triggerHitEffects();
          this.triggerRunnerStumble();
          this.updateRunnerDamageState(nowMs);
          this.updateHud();
          if (this.tryEndByMode()) {
            return;
          }
        }
        this.enemyGapM = collisionThreshold * 2;
      } else if (Number.isFinite(enemyUpdate.nearestDistancePx)) {
        this.enemyGapM = enemyUpdate.nearestDistancePx / PX_PER_METER;
      } else {
        this.enemyGapM = collisionThreshold * 2;
      }
    }
    const sample = {
      dtMs,
      enemyUpdateCalled: Boolean(enemyUpdate),
      playerRectValid: Boolean(playerRect),
      enemyRectValid: Boolean(enemyRect),
      worldRectValid: Boolean(worldRect),
      enemiesCount,
      intersects,
      intersectsRaw,
      intersectsNorm: intersects,
      collisionFired: Boolean(debugCollision && !debugAttackHandled && !isRunnerInvincible),
      startGrace: enemyStartGrace,
      invincible: isRunnerInvincible,
      kicking: defeatSequenceActive,
      collisionEnabled: enemyCollisionEnabled,
      handledCollision: Boolean(debugCollision && !debugAttackHandled),
      cooldownMs: Math.max(0, Math.round((this.runnerInvincibleUntilMs ?? 0) - nowMs)),
    };
    const pipelineStatus = this.classifyCollisionPipeline(sample);
    if (collisionDebugEnabled && nowMs - (this.lastCollisionDebugMs ?? -Infinity) >= COLLISION_DEBUG_LOG_INTERVAL_MS) {
      this.lastCollisionDebugMs = nowMs;
      console.debug('[dash-collision]', {
        ...sample,
        pipelineStatus,
        playerRect,
        worldRect: worldRect ? {
          left: Math.round(worldRect.left),
          top: Math.round(worldRect.top),
          width: Math.round(worldRect.width),
          height: Math.round(worldRect.height),
        } : null,
        enemyRect,
        enemyRectRaw,
        playerRectNorm,
        enemyRectNorm,
      });
    }
    this.updateDiagnostics({
      playerRect,
      enemyRect,
      enemyRectRaw,
      playerRectNorm,
      enemyRectNorm,
      worldRect,
      groundY,
      collision: debugCollision,
      attackHandled: debugAttackHandled,
      pipelineStatus,
      intersects,
      intersectsRaw,
      intersectsNorm: intersects,
      enemiesCount,
      flags: sample,
      groundDebug,
    });
    const safeDebugEnemyRect = typeof debugEnemyRect === 'undefined' ? null : debugEnemyRect;
    this.updateDebugHud({
      hasPlayerRect: Boolean(playerRect),
      collided: debugCollision,
      attackHandled: debugAttackHandled,
      cooldownMs: DAMAGE_INVINCIBLE_MS - (nowMs - (this.lastCollisionPenaltyAtMs ?? -Infinity)),
      enemyRect: safeDebugEnemyRect,
      nearestDxPx: enemyUpdate?.nearestDistancePx ?? null,
      nearestDyPx: null,
    });
    this.timeLeftMs -= dtMs;
    this.tryEndByMode();
    this.updateRunLayerVisuals(dtMs, effectivePlayerSpeed, isSlowed);
    this.updateRunnerDebugOutline();
    this.updateHud();
  },
  startLoop() {
    if (this.isRunning && this.rafId) {
      this.updateLoopMonitorBadge();
      return;
    }
    this.stopLoop();
    this.isRunning = true;
    this.lastTickTs = window.performance.now();
    const tick = (now) => {
      if (!this.isRunning) {
        return;
      }
      let nextDtMs = 0;
      try {
        const rawDt = Math.max(0, now - this.lastTickTs);
        nextDtMs = Math.min(rawDt, 50);
        this.lastTickTs = now;
        this.lastFrameAtMs = now;
        this.loopFrameCount += 1;
        this.updateFrame(nextDtMs);
      } catch (error) {
        const prevLoopErrorAtMs = this.lastLoopErrorAtMs ?? -Infinity;
        this.noteLoopError(error);
        this.lastTickTs = now;
        const lastErrorAgoMs = now - prevLoopErrorAtMs;
        if (this.isDashRunnerDebugEnabled() && lastErrorAgoMs > LOOP_ERROR_RECOVERY_COOLDOWN_MS) {
          console.warn('[dash-game] loop error; recovery deferred to next frame', {
            message: this.lastLoopErrorMessage,
          });
        }
      } finally {
        this.updateLoopMonitorBadge(now);
        if (this.isRunning) {
          this.rafId = window.requestAnimationFrame(tick);
        } else {
          this.rafId = null;
        }
      }
    };
    this.rafId = window.requestAnimationFrame(tick);
    this.updateLoopMonitorBadge();
  },
  stopLoop() {
    this.isRunning = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.updateLoopMonitorBadge();
  },
  startBgm() {
    if (this.isBgmActive) {
      return;
    }
    this.isBgmActive = true;
    const bgmId = resolveDashBgmId(gameState.dash?.stageId);
    console.log('[BGM] dash loop start', { stageId: gameState.dash?.stageId, bgmId });
    audioManager.playBgm(bgmId, { loop: true });
  },
  stopBgm() {
    if (!this.isBgmActive) {
      return;
    }
    this.isBgmActive = false;
    console.log('[BGM] dash stop');
    audioManager.stopBgm();
  },
  endSession(endReason = 'timeout', modeEndDecision = null) {
    if (this.hasEnded) {
      return;
    }
    this.enemySystem?.logEnemyDebugSummary?.(window.performance.now());
    if (this.isDashRunnerDebugEnabled()) {
      console.log(
        `[dash-debug][SESSION:end] reason=${endReason}, timeLeft=${Math.max(0, Math.round(this.timeLeftMs))}, collided=${Boolean(this.lastCollisionPenaltyAtMs > 0)}, stack=trace`,
      );
      console.trace('[dash-debug][SESSION:end]');
    }
    const normalizedEndReason = normalizeDashEndReason(endReason);
    this.hasEnded = true;
    this.stopBgm();
    this.stopLoop();
    const endFx = this.modeStrategy?.onBeforeEnd?.({
      endReason: normalizedEndReason,
      modeRuntime: this.modeRuntime,
      modeEndDecision,
    }) ?? null;
    if (endFx?.cueText) {
      this.showStreakCue(endFx.cueText);
    }
    if (endFx?.sfxId) {
      audioManager.playSfx(endFx.sfxId);
    }
    if (endFx?.visualEffect === 'goal-clear') {
      this.triggerGoalClearEffect(endFx?.visualDurationMs);
    }
    const buildContext = {
      runId: gameState.dash.currentRunId,
      distanceM: gameState.dash.distanceM,
      correctCount: gameState.dash.correctCount,
      wrongCount: gameState.dash.wrongCount,
      defeatedCount: gameState.dash.defeatedCount,
      bossDefeatedCount: gameState.dash.bossDefeatedCount ?? 0,
      maxStreak: this.maxStreak,
      timeLeftMs: this.timeLeftMs,
      stageId: gameState.dash?.stageId,
      endReason: normalizedEndReason,
      initialTimeLimitMs: this.initialTimeLimitMs,
      modeRuntime: this.modeRuntime,
      hits: this.collisionHits,
    };
    gameState.dash.result = this.modeStrategy?.buildResult?.(buildContext) ?? {
      ...buildContext,
      mode: this.currentDashModeId,
      timeLeftMs: Math.max(0, this.timeLeftMs),
      stageId: toDashStageId(gameState.dash?.stageId),
      retired: normalizedEndReason === 'retired',
    };
    const delayMs = Math.max(0, Number(endFx?.delayMs) || 0);
    if (delayMs > 0) {
      window.setTimeout(() => {
        screenManager.changeScreen('dash-result');
      }, delayMs);
      return;
    }
    screenManager.changeScreen('dash-result');
  },
  enter() {
    uiRenderer.showScreen('dash-game');
    this.events = createEventRegistry('dash-game');
    this.ensureRunLayerMounted();
    this.refreshRunDomRefs();
    this.verifyRunnerDom();
    this.ensureRunnerSpriteGuard();
    this.resetDashRunnerVisibilityState();
    this.playerSpeed = baseSpeed;
    this.enemySpeed = enemyBaseSpeed;
    this.enemyGapM = collisionThreshold * 2;
    this.attackUntilMs = 0;
    this.kickUntilMs = 0;
    this.hitstopUntilMs = 0;
    this.lastCollisionPenaltyAtMs = -Infinity;
    this.slowUntilMs = 0;
    this.runnerHitUntilMs = 0;
    this.runnerInvincibleUntilMs = 0;
    this.resolveModeStrategy();
    this.modeRuntime = this.modeStrategy?.initRun?.() ?? null;
    if (domRefs.dashGame.goalOverlayImage) {
      domRefs.dashGame.goalOverlayImage.src = resolveAssetUrl(GOAL_OVERLAY_IMAGE_PATH);
    }
    this.clearGoalClearEffect();
    const strategyTimeLimitMs = this.modeStrategy?.getInitialTimeLimitMs?.({ modeRuntime: this.modeRuntime });
    this.timeLeftMs = Number.isFinite(strategyTimeLimitMs) && strategyTimeLimitMs > 0
      ? strategyTimeLimitMs
      : this.getInitialTimeLimitMs();
    this.initialTimeLimitMs = this.timeLeftMs;
    this.lastTickTs = window.performance.now();
    this.currentQuestion = null;
    this.hasEnded = false;
    this.resolveModeStrategy();
    const settings = dashSettingsStore.get();
    this.modeRuntime = this.modeStrategy?.initRun?.({ difficulty: settings?.difficulty ?? "normal" }) ?? null;
    this.maxStreak = 0;
    this.clearStreakCue();
    gameState.dash.distanceM = 0;
    gameState.dash.correctCount = 0;
    gameState.dash.wrongCount = 0;
    gameState.dash.defeatedCount = 0;
    gameState.dash.bossDefeatedCount = 0;
    gameState.dash.streak = 0;
    gameState.dash.result = null;
    gameState.dash.modeId = this.currentDashModeId;
    gameState.dash.currentRunId = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.currentArea = null;
    this.lastNextAreaText = null;
    this.lastNextAreaHidden = null;
    this.lastBarModel = null;
    this.timeUnitEl = null;
    this.runLayerOriginalParent = this.runLayerOriginalParent ?? null;
    this.runLayerOriginalNextSibling = this.runLayerOriginalNextSibling ?? null;
    this.skyOffsetPx = 0;
    this.groundTileWidth = 0;
    this.groundTileX = [0, 0];
    this.clouds = [];
    this.runnerSpeedTier = null;
    this.answerBuffer = '';
    this.isSyncingAnswer = false;
    this.isBgmActive = false;
    this.debugToastTimeout = null;
    this.hitEffectTimeouts = new WeakMap();
    this.debugToastEl = null;
    this.overlayRootEl = null;
    this.buildBadgeEl = null;
    this.buildBadgeTimeout = null;
    this.debugHudEl = null;
    this.diagnosticsHudEl = null;
    this.playerHitboxEl = null;
    this.enemyHitboxEl = null;
    this.loopMonitorBadgeEl = null;
    this.watchdogTimerId = null;
    this.lastFrameAtMs = null;
    this.loopFrameCount = 0;
    this.loopRecoveryCount = 0;
    this.lastLoopErrorMessage = '';
    this.lastLoopErrorAtMs = 0;
    this.playerRectNullStreak = 0;
    this.runnerDebugProbeActive = false;
    this.runnerDebugProbeRafId = null;
    this.runnerDebugProbeUntilMs = 0;
    this.runnerDebugProbeFrameCount = 0;
    this.runnerDebugOutlineEl = null;
    this.runnerSpriteLoadWarned = false;
    this.runnerSpriteLastFailedSrc = null;
    this.enemyUpdateCount = 0;
    this.hasLoggedCollisionResultDebug = false;
    this.collisionHits = 0;
    this.lastCollisionDebugMs = -Infinity;
    this.lastCollisionStageLogKey = '';
    this.runnerMutationObservers = [];
    this.hasLoggedQuestionDifficultyDebug = false;
    this.dashStageId = toDashStageId(gameState.dash?.stageId ?? gameState.dash?.worldKey);
    const levelId = gameState.dash?.levelId ?? 1;
    this.dashLevelId = levelId;
    gameState.dash.stageId = this.dashStageId;
    gameState.dash.worldKey = this.dashStageId;
    gameState.dash.levelId = this.dashLevelId;
    if (isDashStartDebugLogEnabled()) {
      console.log('[dash-game.start]', {
        worldKey: this.dashStageId,
        stageId: this.dashStageId,
        levelId: this.dashLevelId,
        modeId: this.currentDashModeId,
      });
    }
    this.applyDashTheme();
    gameState.dash.currentMode = null;
    this.enemySystem = createDashEnemySystem({
      stageId: this.dashStageId,
      getCurrentMode: () => gameState.dash.currentMode,
      isDebugEnabled: () => this.isDashRunnerDebugEnabled(),
      isEnemyDebugEnabled: () => this.isDashEnemyDebugEnabled(),
      isCollisionTestModeEnabled: () => this.isDashCollisionTestModeEnabled(),
      isCollisionDebugEnabled: () => this.isCollisionDebugEnabled(),
      worldEl: domRefs.game.runWorld,
      containerEl: domRefs.game.runEnemies,
      onCollisionDebug: ({ stage, enemyId, nowMs }) => {
        if (stage === 'overlap') {
          this.logRunnerOverlapDebug({ enemyId, nowMs });
        }
      },
    });
    this.enemySystem.reset();
    const stagePreloadPromise = getStageCorePreloadPromise(this.dashStageId, { mode: 'dash' });
    const scheduleInitRunBackgrounds = async () => {
      if (isStageFrameWaitEnabled() && stagePreloadPromise) {
        await Promise.race([
          stagePreloadPromise,
          new Promise((resolve) => window.setTimeout(resolve, 50)),
        ]);
      }
      this.initRunBackgrounds();
      perfLog('screen.first-frame', { screen: 'dash-game', stageId: this.dashStageId });
    };
    window.requestAnimationFrame(() => {
      scheduleInitRunBackgrounds();
    });
    this.updateArea(gameState.dash.distanceM);
    this.updateHud();
    this.handleBack = () => {
      if (!window.confirm('ステージをやめますか？')) {
        return;
      }
      audioManager.playSfx('sfx_cancel');
      this.endSession('retired');
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
      this.handleBackspace();
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
    if (this.isDashRunnerDebugEnabled()) {
      const errorHandler = (event) => {
        console.error('[dash-debug] window.error', {
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          error: event.error,
        });
      };
      const rejectionHandler = (event) => {
        console.error('[dash-debug] window.unhandledrejection', {
          reason: event.reason,
        });
      };
      this.dashDebugErrorHandler = errorHandler;
      this.dashDebugRejectionHandler = rejectionHandler;
      window.addEventListener('error', errorHandler);
      window.addEventListener('unhandledrejection', rejectionHandler);
      this.startRunnerHitDebugProbe();
      this.setupRunnerMutationDebugObserver();
      console.log('[dash-debug] enabled', {
        hint: 'Use ?dashDebug=1 or localStorage.setItem("dashDebugRunner","1")',
      });
    }
    if (this.isDashEnemyDebugEnabled()) {
      console.log('[dash-debug][ENEMY] enabled', {
        hint: 'Use ?dashDebugEnemy=1 or window.__DASH_DEBUG_ENEMY=true or localStorage.setItem("dash.debug.enemy","1")',
      });
      if (this.isDashCollisionTestModeEnabled()) {
        console.log('[dash-debug][ENEMY] collision-test-mode enabled', {
          hint: 'Use ?dashTestCollision=1 or localStorage.setItem("dash.test.collision","1")',
        });
      }
    }
    this.startBgm();
    this.startLoop();
    this.startLoopWatchdog();
    this.showBuildBadge();
    this.ensureLoopMonitorBadge();
    this.updateLoopMonitorBadge();
    this.updateRunnerDebugOutline();
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
    this.stopLoopWatchdog();
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
    this.clearGoalClearEffect();
    if (domRefs.game.runner && this.handleRunnerSpriteLoad) {
      domRefs.game.runner.removeEventListener('load', this.handleRunnerSpriteLoad);
    }
    if (domRefs.game.runner && this.handleRunnerSpriteError) {
      domRefs.game.runner.removeEventListener('error', this.handleRunnerSpriteError);
    }
    if (domRefs.game.runner?.dataset) {
      delete domRefs.game.runner.dataset.guardAttached;
    }
    this.handleRunnerSpriteLoad = null;
    this.handleRunnerSpriteError = null;
    this.stopBgm();
    if (domRefs.game.runClouds) {
      domRefs.game.runClouds.innerHTML = '';
    }
    this.clouds = [];
    this.enemySystem?.destroy();
    this.enemySystem = null;
    this.stopRunnerHitDebugProbe();
    this.teardownRunnerMutationDebugObserver();
    if (this.dashDebugErrorHandler) {
      window.removeEventListener('error', this.dashDebugErrorHandler);
      this.dashDebugErrorHandler = null;
    }
    if (this.dashDebugRejectionHandler) {
      window.removeEventListener('unhandledrejection', this.dashDebugRejectionHandler);
      this.dashDebugRejectionHandler = null;
    }
    this.destroyRunnerDebugOutline();
    if (this.debugToastTimeout) {
      window.clearTimeout(this.debugToastTimeout);
      this.debugToastTimeout = null;
    }
    if (this.debugToastEl) {
      this.debugToastEl.remove();
      this.debugToastEl = null;
    }
    if (this.buildBadgeTimeout) {
      window.clearTimeout(this.buildBadgeTimeout);
      this.buildBadgeTimeout = null;
    }
    if (this.debugHudEl) {
      this.debugHudEl.remove();
      this.debugHudEl = null;
    }
    if (this.diagnosticsHudEl) {
      this.diagnosticsHudEl.remove();
      this.diagnosticsHudEl = null;
    }
    if (this.buildBadgeEl) {
      this.buildBadgeEl.remove();
      this.buildBadgeEl = null;
    }
    if (this.playerHitboxEl) {
      this.playerHitboxEl.remove();
      this.playerHitboxEl = null;
    }
    if (this.enemyHitboxEl) {
      this.enemyHitboxEl.remove();
      this.enemyHitboxEl = null;
    }
    if (this.loopMonitorBadgeEl) {
      this.loopMonitorBadgeEl.remove();
      this.loopMonitorBadgeEl = null;
    }
    if (this.overlayRootEl) {
      this.overlayRootEl.remove();
      this.overlayRootEl = null;
    }
    document.querySelectorAll('.dash-overlay-root').forEach((overlayRoot) => {
      overlayRoot.remove();
    });
    if (domRefs.dashGame.screen) {
      delete domRefs.dashGame.screen.dataset.debugRunnerwrap;
    }
    domRefs.game.runnerWrap?.classList.remove('is-runner-hit', 'is-runner-invincible', 'is-debug-stumble', HIT_FLASH_CLASS);
    if (this.feedbackFxTimeout) {
      window.clearTimeout(this.feedbackFxTimeout);
      this.feedbackFxTimeout = null;
    }
    const clearHitEffectTimeouts = (element) => {
      const timeouts = this.hitEffectTimeouts?.get(element);
      if (!timeouts) {
        return;
      }
      timeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeouts.clear();
    };
    clearHitEffectTimeouts(domRefs.game.runWorld);
    clearHitEffectTimeouts(domRefs.game.runnerWrap);
    if (this.hitEffectTimeouts) {
      this.hitEffectTimeouts = new WeakMap();
    }
    domRefs.game.runWorld?.classList.remove(HIT_SHAKE_CLASS, DEFEAT_SHAKE_CLASS, DEFEAT_FLASH_CLASS);
    domRefs.game.runnerWrap?.classList.remove(HIT_FLASH_CLASS);
    if (this.goalProgressWrapEl) {
      this.goalProgressWrapEl.remove();
      this.goalProgressWrapEl = null;
      this.goalProgressFillEl = null;
      this.goalProgressTextEl = null;
    }
    this.lastBarModel = null;
    this.timeUnitEl = null;
  },
};

export default dashGameScreen;
