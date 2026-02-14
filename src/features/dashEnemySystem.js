import { normalizeDashStageId } from './dashStages.js';
import {
  applyEnemySpriteWithFallback,
  getEnemyHpByTier,
  normalizeEnemyTier,
} from './enemyAssetResolver.js';

const DEFAULT_ENEMY_TYPE = 'plus';
const DASH_STAGE_TO_ENEMY_TYPE = Object.freeze({
  plus: 'plus',
  minus: 'minus',
  multi: 'multi',
  divide: 'divide',
});
const ENEMY_TYPES = Object.freeze(['plus', 'minus', 'multi', 'divide']);
const ENEMY_LABEL_BY_TYPE = Object.freeze({
  plus: 'プラス',
  minus: 'マイナス',
  multi: 'かけ算',
  divide: 'わり算',
});
const ENEMY_FOOT_OFFSETS = Object.freeze({
  plus: 0,
  minus: 0,
  multi: 0,
  divide: 0,
});
const ENEMY_STATES = Object.freeze([
  'approaching',
  'hit',
  'collision_resolved',
  'defeated_hit',
  'defeated_end',
]);
const ENEMY_SIZE_PX = 72;
const MIN_SPAWN_GAP_PX = 96;
const MIN_REACTION_DISTANCE_PX = 180;
const ENEMY_SPAWN_SCREEN_X_RATIO = 0.99;
const ENEMY_SPAWN_SAFE_MARGIN_PX = 16;
const HIT_DURATION_MS = 120;
const DEAD_DURATION_MS = 300;
const HIT_PULL_DURATION_MS = 80;
const HIT_PULL_PX = 16;
const HIT_FLASH_MS = 40;
const HIT_FLASH_SCALE = 1.03;
const MAX_ENEMIES = 2;
const START_GRACE_MS = 2500;
const COLLISION_RESOLVE_MS = 160;
const BASE_SPEED_PX_PER_SEC = 220;
const SPEED_PER_CORRECT_PX_PER_SEC = 2.0;
const SPEED_PER_SEC_PX_PER_SEC = 1.5;
const SPAWN_INTERVAL_START_MS = 1500;
const SPAWN_INTERVAL_MIN_MS = 650;
const SPAWN_INTERVAL_DECAY_MS_PER_SEC = 18;
const SPAWN_INTERVAL_JITTER_RATIO = 0.35;
const SPAWN_INTERVAL_MIN_RATIO = 0.60;
const SPAWN_INTERVAL_MAX_RATIO = 1.60;
const SPAWN_INTERVAL_SHORT_STREAK_GUARD_MS = 50;

export const ATTACK_WINDOW_MS = 250;
export const PX_PER_METER = 100;

const clampState = (state) => (ENEMY_STATES.includes(state) ? state : 'approaching');

const randIntInclusive = (min, max) => {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (high - low + 1)) + low;
};

const resolveNextSpawnIntervalMs = ({ baseMs, prevIntervalMs }) => {
  const safeBaseMs = Math.max(1, Math.floor(baseMs));
  const jitterMs = Math.floor(safeBaseMs * SPAWN_INTERVAL_JITTER_RATIO);
  const rawMs = safeBaseMs + randIntInclusive(-jitterMs, jitterMs);
  const minMs = Math.floor(safeBaseMs * SPAWN_INTERVAL_MIN_RATIO);
  const maxMs = Math.floor(safeBaseMs * SPAWN_INTERVAL_MAX_RATIO);
  let nextMs = Math.max(minMs, Math.min(maxMs, rawMs));
  if (Number.isFinite(prevIntervalMs) && prevIntervalMs < minMs + SPAWN_INTERVAL_SHORT_STREAK_GUARD_MS) {
    nextMs = Math.max(nextMs, safeBaseMs);
  }
  return {
    nextMs,
    baseMs: safeBaseMs,
    minMs,
    maxMs,
    jitterMs,
  };
};

const isDefeatedState = (enemy) => enemy?.state === 'defeated_hit' || enemy?.state === 'defeated_end';

const isInDefeatPipeline = (enemy) => (
  Number.isFinite(enemy?.hitAtTs)
  || enemy?.pendingVisualState === 'hit'
  || enemy?.pendingVisualState === 'dead'
  || enemy?.attackHandled === true
);

const normalizeEnemyType = (enemyType) => (
  ENEMY_TYPES.includes(enemyType) ? enemyType : null
);

const normalizeEnemyPool = (enemyPool) => {
  if (!Array.isArray(enemyPool)) {
    return [];
  }
  return enemyPool
    .map((enemyType) => normalizeEnemyType(enemyType))
    .filter((enemyType, index, list) => enemyType && list.indexOf(enemyType) === index);
};

const resolveEnemyTypeForStage = ({
  stageId,
  getEnemyType,
  getEnemyPool,
}) => {
  const resolvedByGetter = normalizeEnemyType(getEnemyType?.());
  if (resolvedByGetter) {
    return resolvedByGetter;
  }

  const normalizedStageId = normalizeDashStageId(stageId);
  if (normalizedStageId && normalizedStageId !== 'mix') {
    return DASH_STAGE_TO_ENEMY_TYPE[normalizedStageId] ?? DEFAULT_ENEMY_TYPE;
  }

  const enemyPool = normalizeEnemyPool(getEnemyPool?.());
  if (!normalizedStageId) {
    if (enemyPool.length === 0) {
      return DEFAULT_ENEMY_TYPE;
    }
    const poolIndex = Math.floor(Math.random() * enemyPool.length);
    return enemyPool[poolIndex] ?? DEFAULT_ENEMY_TYPE;
  }

  const pool = enemyPool.length > 0 ? enemyPool : ENEMY_TYPES;
  const poolIndex = Math.floor(Math.random() * pool.length);
  return pool[poolIndex] ?? DEFAULT_ENEMY_TYPE;
};

const toFiniteOrNull = (value) => (Number.isFinite(value) ? value : null);

const normalizeRect = (rect) => {
  if (!rect || typeof rect !== 'object') {
    return null;
  }

  const x = toFiniteOrNull(rect.x);
  const y = toFiniteOrNull(rect.y);
  const wCandidate = toFiniteOrNull(rect.w ?? rect.width);
  const hCandidate = toFiniteOrNull(rect.h ?? rect.height);
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

  if (right === null && left !== null && wCandidate !== null) {
    right = left + wCandidate;
  }
  if (bottom === null && top !== null && hCandidate !== null) {
    bottom = top + hCandidate;
  }

  if (left === null && right !== null && wCandidate !== null) {
    left = right - wCandidate;
  }
  if (top === null && bottom !== null && hCandidate !== null) {
    top = bottom - hCandidate;
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

const intersectsNormalized = (aRect, bRect) => {
  const a = normalizeRect(aRect);
  const b = normalizeRect(bRect);
  if (!a || !b) {
    return false;
  }
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
};

const intersectsRawXYWH = (a, b) => {
  if (!a || !b) {
    return false;
  }
  return (
    a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y
  );
};

const getEnemyTransform = (enemy) => (
  `translate3d(${Math.round(enemy.x)}px, ${Math.round(enemy.y)}px, 0)`
  + ' translateX(var(--enemy-hit-pull, 0px))'
  + ' scale(var(--enemy-hit-scale, 1))'
);

const ensureEnemyContainer = (worldEl, containerEl) => {
  if (containerEl?.isConnected) {
    return containerEl;
  }
  if (!worldEl) {
    return null;
  }
  const existing = worldEl.querySelector('.run-enemies');
  if (existing) {
    return existing;
  }
  const created = document.createElement('div');
  created.className = 'run-enemies';
  created.setAttribute('aria-hidden', 'true');
  worldEl.appendChild(created);
  return created;
};

const getEnemyDisplayName = (type) => ENEMY_LABEL_BY_TYPE[type] ?? 'モンスター';
const buildEnemyLabel = (enemy) => {
  const labelEl = document.createElement('div');
  labelEl.className = 'enemy-label';

  const nameEl = document.createElement('div');
  nameEl.className = 'enemy-name';
  nameEl.textContent = enemy.name;

  const hpEl = document.createElement('div');
  hpEl.className = 'enemy-hp';

  const hpFillEl = document.createElement('div');
  hpFillEl.className = 'enemy-hp__fill';
  hpEl.appendChild(hpFillEl);

  labelEl.append(nameEl, hpEl);
  return { labelEl, hpFillEl };
};

const createEnemyElement = (enemy) => {
  const wrap = document.createElement('div');
  wrap.className = 'enemy-wrap';
  wrap.dataset.enemyName = enemy.name;
  wrap.dataset.hp = String(enemy.hpCurrent);
  wrap.dataset.hpMax = String(enemy.hpMax);
  wrap.dataset.tier = enemy.tier;

  const img = document.createElement('img');
  img.className = 'enemy-sprite';
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'eager';
  applyEnemySpriteWithFallback(img, {
    stageKey: enemy.type,
    tier: enemy.tier,
    state: enemy.visualState ?? 'walk',
  });
  img.draggable = false;

  const { labelEl, hpFillEl } = buildEnemyLabel(enemy);
  wrap.append(img, labelEl);

  return {
    wrap,
    sprite: img,
    hpFill: hpFillEl,
  };
};

const updateEnemyHud = (enemy) => {
  if (!enemy?.el) {
    return;
  }
  const hpRatio = enemy.hpMax > 0 ? Math.max(0, Math.min(1, enemy.hpCurrent / enemy.hpMax)) : 0;
  enemy.el.dataset.hp = String(enemy.hpCurrent);
  enemy.el.dataset.hpMax = String(enemy.hpMax);
  enemy.hpFillEl?.style.setProperty('transform', `scaleX(${hpRatio.toFixed(3)})`);
};

const setEnemySprite = (enemy, visualState) => {
  if (!enemy?.el || enemy.visualState === visualState) {
    return false;
  }
  enemy.visualState = visualState;
  applyEnemySpriteWithFallback(enemy.spriteEl, {
    stageKey: enemy.type,
    tier: enemy.tier,
    state: visualState,
  });
  return true;
};

const applyEnemyStateClasses = (enemy) => {
  if (!enemy?.el) {
    return;
  }
  enemy.el.classList.toggle('is-collision-resolved', enemy.state === 'collision_resolved');
  enemy.el.classList.toggle('is-defeated', isDefeatedState(enemy));
};

const getSpeedPxPerSec = ({ correctCount = 0, elapsedSec = 0 }) => -(
  BASE_SPEED_PX_PER_SEC
  + correctCount * SPEED_PER_CORRECT_PX_PER_SEC
  + elapsedSec * SPEED_PER_SEC_PX_PER_SEC
);

export const createDashEnemySystem = ({
  worldEl,
  containerEl,
  stageId = null,
  getEnemyType = null,
  getEnemyPool = null,
  getEnemyTier = null,
  getCurrentMode = null,
  isDebugEnabled = null,
  isEnemyDebugEnabled = null,
  isCollisionTestModeEnabled = null,
  isCollisionDebugEnabled = null,
  onCollisionDebug = null,
} = {}) => {
  const system = {
    worldEl,
    containerEl,
    enemies: [],
    spawnTimerMs: START_GRACE_MS,
    elapsedMs: 0,
    idCounter: 0,
    stageId,
    getEnemyType,
    getEnemyPool,
    getEnemyTier,
    getCurrentMode,
    isDebugEnabled,
    isEnemyDebugEnabled,
    isCollisionTestModeEnabled,
    isCollisionDebugEnabled,
    onCollisionDebug,
    lastCollisionTestLogKey: '',
    previousSpawnIntervalMs: null,
    latestSpawnSchedule: null,
    enemyDebugCounters: {
      defeatStartCount: 0,
      hitShownCount: 0,
      endShownCount: 0,
      removeAfterEndCount: 0,
      offscreenRemoveCount: 0,
      unexpectedRemoveCount: 0,
    },
    enemyDebugById: new Map(),
    lastEnemyDebugSummaryAtMs: -Infinity,
  };

  system.isEnemyDebugActive = () => system.isEnemyDebugEnabled?.() === true;

  system.getEnemyDebugEntry = (enemyId) => {
    if (!enemyId) {
      return null;
    }
    const existing = system.enemyDebugById.get(enemyId);
    if (existing) {
      return existing;
    }
    const created = {
      enemyId,
      sawDefeat: false,
      sawHit: false,
      sawEnd: false,
      removed: false,
      removeReason: null,
    };
    system.enemyDebugById.set(enemyId, created);
    return created;
  };

  system.logEnemyDebug = (label, payload) => {
    if (!system.isEnemyDebugActive()) {
      return;
    }
    console.log(`[dash-debug][ENEMY:${label}]`, payload);
  };

  system.trackEnemySpriteShown = (enemy, visualState, nowMs) => {
    if (!system.isEnemyDebugActive()) {
      return;
    }
    const entry = system.getEnemyDebugEntry(enemy?.id);
    if (entry) {
      if (visualState === 'hit' && !entry.sawHit) {
        entry.sawHit = true;
        system.enemyDebugCounters.hitShownCount += 1;
      }
      if (visualState === 'dead' && !entry.sawEnd) {
        entry.sawEnd = true;
        system.enemyDebugCounters.endShownCount += 1;
      }
    }
    system.logEnemyDebug('sprite', {
      enemyId: enemy?.id ?? null,
      spriteName: visualState,
      nowMs: Math.round(nowMs),
      state: enemy?.state ?? null,
      hitAtTs: enemy?.hitAtTs ?? null,
      stateUntilMs: enemy?.stateUntilMs ?? null,
    });
  };

  system.removeEnemy = (enemy, removeReason, nowMs) => {
    enemy.isAlive = false;
    enemy.el?.remove();
    if (!system.isEnemyDebugActive()) {
      return;
    }
    const entry = system.getEnemyDebugEntry(enemy?.id);
    const removedInDefeatedState = isDefeatedState(enemy);
    const isOffscreenRemove = removeReason === 'offscreen';
    const isCollisionTimeoutRemove = removeReason === 'collision_resolved_timeout';
    const hasStateInconsistency = Number.isFinite(enemy?.hitAtTs) && !isDefeatedState(enemy);
    if (entry) {
      entry.removed = true;
      entry.removeReason = removeReason;
      if (entry.sawEnd && removeReason === 'defeated_end_timeout') {
        system.enemyDebugCounters.removeAfterEndCount += 1;
      }
      if (isOffscreenRemove) {
        system.enemyDebugCounters.offscreenRemoveCount += 1;
      }
      const isUnexpected = (
        isCollisionTimeoutRemove
        || (removedInDefeatedState && removeReason !== 'defeated_end_timeout')
        || hasStateInconsistency
      );
      if (isUnexpected) {
        system.enemyDebugCounters.unexpectedRemoveCount += 1;
      }
    }
    system.logEnemyDebug('remove', {
      enemyId: enemy?.id ?? null,
      removeReason,
      nowMs: Math.round(nowMs),
      state: enemy?.state ?? null,
      x: Number.isFinite(enemy?.x) ? Number(enemy.x.toFixed(2)) : null,
    });
  };

  system.logEnemyDebugSummary = (nowMs = window.performance.now()) => {
    if (!system.isEnemyDebugActive()) {
      return;
    }
    if (nowMs - system.lastEnemyDebugSummaryAtMs < 200) {
      return;
    }
    system.lastEnemyDebugSummaryAtMs = nowMs;
    const unresolved = [];
    system.enemyDebugById.forEach((entry) => {
      if (entry.removed && ((entry.sawHit && entry.sawEnd) || entry.removeReason === 'offscreen')) {
        return;
      }
      unresolved.push({
        enemyId: entry.enemyId,
        hitReached: entry.sawHit,
        endReached: entry.sawEnd,
        removed: entry.removed,
        removeReason: entry.removeReason,
      });
    });
    system.logEnemyDebug('summary', {
      counters: { ...system.enemyDebugCounters },
      unresolved,
    });
  };

  system.setWorld = (nextWorld, nextContainer) => {
    system.worldEl = nextWorld ?? system.worldEl;
    system.containerEl = ensureEnemyContainer(system.worldEl, nextContainer ?? system.containerEl);
  };

  system.setStageId = (nextStageId) => {
    system.stageId = nextStageId;
  };

  system.setEnemyTypeResolver = (resolver) => {
    system.getEnemyType = typeof resolver === 'function' ? resolver : null;
  };

  system.setEnemyPoolResolver = (resolver) => {
    system.getEnemyPool = typeof resolver === 'function' ? resolver : null;
  };

  system.setCurrentModeResolver = (resolver) => {
    system.getCurrentMode = typeof resolver === 'function' ? resolver : null;
  };

  system.setCollisionDebugLogger = (logger) => {
    system.onCollisionDebug = typeof logger === 'function' ? logger : null;
  };

  system.setDebugEnabledResolver = (resolver) => {
    system.isDebugEnabled = typeof resolver === 'function' ? resolver : null;
  };

  system.setEnemyDebugEnabledResolver = (resolver) => {
    system.isEnemyDebugEnabled = typeof resolver === 'function' ? resolver : null;
  };

  system.setCollisionTestModeEnabledResolver = (resolver) => {
    system.isCollisionTestModeEnabled = typeof resolver === 'function' ? resolver : null;
  };

  system.setCollisionDebugEnabledResolver = (resolver) => {
    system.isCollisionDebugEnabled = typeof resolver === 'function' ? resolver : null;
  };

  system.reset = () => {
    system.enemies.forEach((enemy) => {
      enemy.el?.remove();
    });
    system.enemies = [];
    system.spawnTimerMs = START_GRACE_MS;
    system.elapsedMs = 0;
    system.previousEnemyType = null;
    system.previousSpawnIntervalMs = null;
    system.latestSpawnSchedule = null;
    system.enemyDebugCounters = {
      defeatStartCount: 0,
      hitShownCount: 0,
      endShownCount: 0,
      removeAfterEndCount: 0,
      offscreenRemoveCount: 0,
      unexpectedRemoveCount: 0,
    };
    system.enemyDebugById = new Map();
    system.lastEnemyDebugSummaryAtMs = -Infinity;
  };

  system.destroy = () => {
    system.reset();
    if (system.containerEl) {
      system.containerEl.innerHTML = '';
    }
    system.containerEl = null;
    system.worldEl = null;
  };

  system.spawnEnemy = ({
    nowMs,
    groundTopY,
    cameraX = 0,
    speedPxPerSec,
    playerRect,
    minGapPx = MIN_SPAWN_GAP_PX,
    minReactionDistancePx = MIN_REACTION_DISTANCE_PX,
    tier: tierInput = null,
  }) => {
    const worldEl = system.worldEl;
    const container = ensureEnemyContainer(worldEl, system.containerEl);
    system.containerEl = container;
    if (!worldEl || !container) {
      return null;
    }
    const worldWidth = worldEl.clientWidth || 0;
    if (!worldWidth) {
      return null;
    }
    const type = resolveEnemyTypeForStage({
      stageId: system.stageId,
      getEnemyType: system.getEnemyType,
      getEnemyPool: system.getEnemyPool,
    });
    const state = 'approaching';
    const width = ENEMY_SIZE_PX;
    const height = ENEMY_SIZE_PX;
    const collisionTestModeEnabled = system.isCollisionTestModeEnabled?.() === true;
    const viewportW = worldWidth;
    const safeCameraX = Number.isFinite(cameraX) ? cameraX : 0;
    // Collision-test mode (debug only): spawn near player to force overlap without changing speed/timing.
    const ratioSpawnX = safeCameraX + viewportW * ENEMY_SPAWN_SCREEN_X_RATIO;
    const maxSpawnX = safeCameraX + viewportW - width - ENEMY_SPAWN_SAFE_MARGIN_PX;
    const clampedRatioSpawnX = Math.min(ratioSpawnX, maxSpawnX);
    const spawnX = collisionTestModeEnabled && playerRect
      ? (playerRect.x + playerRect.w + 160)
      : clampedRatioSpawnX;
    const spawnClamped = !collisionTestModeEnabled && clampedRatioSpawnX < ratioSpawnX;
    const rightmostEnemyX = system.enemies.reduce((maxX, enemy) => (
      enemy?.isAlive ? Math.max(maxX, enemy.x + enemy.w) : maxX
    ), Number.NEGATIVE_INFINITY);
    if (Number.isFinite(rightmostEnemyX) && spawnX - rightmostEnemyX < minGapPx) {
      // Spawn fairness: keep a minimum gap to avoid overlap with existing enemies.
      return null;
    }
    if (playerRect) {
      const playerRight = playerRect.x + playerRect.w;
      if (spawnX - playerRight < minReactionDistancePx) {
        // Spawn fairness: ensure reaction time by avoiding spawns inside the danger zone.
        return null;
      }
    }
    const tier = normalizeEnemyTier(tierInput ?? system.getEnemyTier?.() ?? 'normal');
    const hpMax = getEnemyHpByTier(tier);
    const enemy = {
      id: `enemy-${system.idCounter += 1}`,
      type,
      name: getEnemyDisplayName(type),
      state,
      x: spawnX,
      y: Math.max(0, ((groundTopY ?? 0) - height + (ENEMY_FOOT_OFFSETS[type] ?? 0))),
      w: width,
      h: height,
      vx: speedPxPerSec,
      stateUntilMs: null,
      isAlive: true,
      hitAtTs: null,
      visualState: 'walk',
      pendingVisualState: null,
      collisionEnabled: true,
      attackHandled: false,
      collisionCooldownUntilMs: null,
      tier,
      hpCurrent: hpMax,
      hpMax,
      hp: hpMax,
      maxHp: hpMax,
      el: null,
      spriteEl: null,
      hpFillEl: null,
    };
    const enemyElements = createEnemyElement(enemy);
    enemy.el = enemyElements.wrap;
    enemy.spriteEl = enemyElements.sprite;
    enemy.hpFillEl = enemyElements.hpFill;
    enemy.el.style.width = `${width}px`;
    enemy.el.style.height = `${height}px`;
    enemy.el.dataset.enemyId = enemy.id;
    enemy.el.style.transform = getEnemyTransform(enemy);
    enemy.el.style.opacity = '1';
    updateEnemyHud(enemy);
    applyEnemyStateClasses(enemy);
    container.appendChild(enemy.el);
    system.enemies.push(enemy);
    system.logEnemyDebug('spawn', {
      enemyId: enemy.id,
      spawnX: Number(enemy.x.toFixed(2)),
      spawnY: Number(enemy.y.toFixed(2)),
      cameraX: safeCameraX,
      viewportW,
      ratio: ENEMY_SPAWN_SCREEN_X_RATIO,
      clamped: spawnClamped,
      spawnIntervalMs: spawnSchedule?.nextMs ?? null,
      baseMs: spawnSchedule?.baseMs ?? null,
      minMs: spawnSchedule?.minMs ?? null,
      maxMs: spawnSchedule?.maxMs ?? null,
      jitterMs: spawnSchedule?.jitterMs ?? null,
      groundTopY: Number.isFinite(groundTopY) ? Number(groundTopY.toFixed(2)) : null,
    });
    return enemy;
  };

  system.damageEnemy = (enemy, amount = 1, nowMs = window.performance.now(), meta = null) => {
    if (!enemy?.isAlive || enemy.state !== 'approaching') {
      return {
        defeated: false,
        hpCurrent: enemy?.hpCurrent ?? enemy?.hp ?? 0,
        hpMax: enemy?.hpMax ?? enemy?.maxHp ?? 0,
        hp: enemy?.hpCurrent ?? enemy?.hp ?? 0,
        maxHp: enemy?.hpMax ?? enemy?.maxHp ?? 0,
      };
    }
    const damage = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    enemy.hpCurrent = Math.max(0, enemy.hpCurrent - damage);
    enemy.hp = enemy.hpCurrent;
    updateEnemyHud(enemy);
    if (enemy.hpCurrent <= 0) {
      const defeated = system.requestDefeatEnemy(enemy, nowMs, meta);
      return {
        defeated,
        hpCurrent: enemy.hpCurrent,
        hpMax: enemy.hpMax,
        hp: enemy.hpCurrent,
        maxHp: enemy.hpMax,
      };
    }
    system.setEnemyState(enemy, 'hit', nowMs, meta);
    return {
      defeated: false,
      hpCurrent: enemy.hpCurrent,
      hpMax: enemy.hpMax,
      hp: enemy.hpCurrent,
      maxHp: enemy.hpMax,
    };
  };

  system.defeatNearestEnemy = ({ playerRect, nowMs, callerTag = 'unknown' }) => {
    if (!playerRect) {
      return { defeated: false, target: null };
    }
    let nearestEnemy = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    system.enemies.forEach((enemy) => {
      if (!enemy?.isAlive || enemy.state !== 'approaching' || enemy.attackHandled) {
        return;
      }
      if (enemy.x + enemy.w < playerRect.x) {
        return;
      }
      const distance = Math.max(0, enemy.x - playerRect.x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = enemy;
      }
    });
    if (!nearestEnemy) {
      return { defeated: false, target: null };
    }
    const damageResult = system.damageEnemy(nearestEnemy, 1, nowMs, { callerTag });
    if (!damageResult.defeated) {
      return {
        defeated: false,
        target: {
          x: nearestEnemy.x,
          y: nearestEnemy.y,
          w: nearestEnemy.w,
          h: nearestEnemy.h,
        },
      };
    }
    return {
      defeated: true,
      target: {
        x: nearestEnemy.x,
        y: nearestEnemy.y,
        w: nearestEnemy.w,
        h: nearestEnemy.h,
      },
    };
  };

  system.requestDefeatEnemy = (enemy, nowMs, meta = null) => {
    if (!enemy?.isAlive) {
      return false;
    }
    if (isDefeatedState(enemy) || isInDefeatPipeline(enemy) || enemy.attackHandled) {
      return false;
    }
    enemy.attackHandled = true;
    system.setEnemyState(enemy, 'defeated_hit', nowMs, meta);
    return true;
  };

  system.setEnemyState = (enemy, nextState, nowMs, meta = null) => {
    const prevState = enemy.state;
    const state = clampState(nextState);
    if (prevState === state) {
      return;
    }
    enemy.state = state;
    if (state === 'hit') {
      enemy.collisionEnabled = false;
      enemy.attackHandled = false;
      enemy.hitAtTs = nowMs;
      enemy.stateUntilMs = nowMs + HIT_DURATION_MS;
      enemy.pendingVisualState = null;
      enemy.collisionCooldownUntilMs = null;
      if (setEnemySprite(enemy, 'hit')) {
        system.trackEnemySpriteShown(enemy, 'hit', nowMs);
      }
    } else if (state === 'defeated_hit') {
      enemy.collisionEnabled = false;
      enemy.attackHandled = true;
      enemy.hitAtTs = nowMs;
      enemy.stateUntilMs = nowMs + HIT_DURATION_MS;
      enemy.pendingVisualState = 'hit';
      enemy.collisionCooldownUntilMs = null;
    } else if (state === 'defeated_end') {
      enemy.collisionEnabled = false;
      enemy.attackHandled = true;
      enemy.hitAtTs = null;
      enemy.pendingVisualState = null;
      enemy.stateUntilMs = nowMs + DEAD_DURATION_MS;
      enemy.collisionCooldownUntilMs = null;
      if (setEnemySprite(enemy, 'dead')) {
        system.trackEnemySpriteShown(enemy, 'dead', nowMs);
      }
    } else if (state === 'collision_resolved') {
      enemy.collisionEnabled = false;
      enemy.attackHandled = false;
      enemy.hitAtTs = null;
      enemy.pendingVisualState = null;
      enemy.stateUntilMs = null;
      enemy.collisionCooldownUntilMs = nowMs + COLLISION_RESOLVE_MS;
      if (setEnemySprite(enemy, 'walk')) {
        system.trackEnemySpriteShown(enemy, 'walk', nowMs);
      }
    } else {
      enemy.collisionEnabled = true;
      enemy.attackHandled = false;
      enemy.hitAtTs = null;
      enemy.pendingVisualState = null;
      enemy.stateUntilMs = null;
      enemy.collisionCooldownUntilMs = null;
      if (setEnemySprite(enemy, 'walk')) {
        system.trackEnemySpriteShown(enemy, 'walk', nowMs);
      }
    }
    if (state === 'defeated_hit') {
      const entry = system.getEnemyDebugEntry(enemy.id);
      if (entry && !entry.sawDefeat && system.isEnemyDebugActive()) {
        entry.sawDefeat = true;
        system.enemyDebugCounters.defeatStartCount += 1;
      }
    }
    system.logEnemyDebug('state', {
      enemyId: enemy.id,
      transition: `${prevState}->${state}`,
      nowMs: Math.round(nowMs),
      callerTag: meta?.callerTag ?? 'unknown',
      hitAtTs: enemy.hitAtTs,
      stateUntilMs: enemy.stateUntilMs,
      pendingVisualState: enemy.pendingVisualState,
      collisionEnabled: enemy.collisionEnabled,
      attackHandled: enemy.attackHandled,
      x: Number.isFinite(enemy.x) ? Number(enemy.x.toFixed(2)) : null,
      y: Number.isFinite(enemy.y) ? Number(enemy.y.toFixed(2)) : null,
      w: enemy.w,
      h: enemy.h,
    });
    applyEnemyStateClasses(enemy);
  };

  system.update = ({
    dtMs,
    nowMs,
    groundY,
    worldGroundTopY = null,
    cameraX = 0,
    playerRect,
    correctCount,
    attackActive,
    defeatSequenceActive = false,
  }) => {
    const resolvedGroundY = Number.isFinite(groundY) ? groundY : null;
    if (!Number.isFinite(dtMs) || dtMs <= 0) {
      return {
        nearestDistancePx: null,
        collision: false,
        attackHandled: false,
        events: [],
        nearestEnemyRect: null,
        resolvedGroundY,
      };
    }
    if (!system.worldEl) {
      return {
        nearestDistancePx: null,
        collision: false,
        attackHandled: false,
        events: [],
        nearestEnemyRect: null,
        resolvedGroundY,
      };
    }
    system.setWorld(system.worldEl, system.containerEl);
    const dtSec = dtMs / 1000;
    system.elapsedMs += dtMs;
    const elapsedSec = system.elapsedMs / 1000;
    const speedPxPerSec = getSpeedPxPerSec({
      correctCount,
      elapsedSec,
    });

    system.spawnTimerMs -= dtMs;
    const baseSpawnIntervalMs = Math.max(
      SPAWN_INTERVAL_MIN_MS,
      SPAWN_INTERVAL_START_MS - elapsedSec * SPAWN_INTERVAL_DECAY_MS_PER_SEC,
    );
    while (system.spawnTimerMs <= 0) {
      const spawnSchedule = resolveNextSpawnIntervalMs({
        baseMs: baseSpawnIntervalMs,
        prevIntervalMs: system.previousSpawnIntervalMs,
      });
      const activeEnemies = system.enemies.filter((enemy) => enemy?.isAlive).length;
      if (activeEnemies >= MAX_ENEMIES) {
        system.spawnTimerMs += spawnSchedule.nextMs;
        system.previousSpawnIntervalMs = spawnSchedule.nextMs;
        system.latestSpawnSchedule = spawnSchedule;
        break;
      }
      system.spawnEnemy({
        nowMs,
        groundTopY: worldGroundTopY,
        cameraX,
        speedPxPerSec,
        playerRect,
        spawnSchedule,
      });
      system.spawnTimerMs += spawnSchedule.nextMs;
      system.previousSpawnIntervalMs = spawnSchedule.nextMs;
      system.latestSpawnSchedule = spawnSchedule;
    }

    let nearestDistancePx = Number.POSITIVE_INFINITY;
    let nearestEnemyRect = null;
    let nearestEnemyMetric = Number.POSITIVE_INFINITY;
    let collision = false;
    let attackHandled = false;
    const events = [];
    let firstEnemyRect = null;
    let firstEnemyRectRaw = null;
    let firstIntersectsRaw = false;
    let firstIntersectsNorm = false;
    let firstCollisionEnabled = false;
    let firstPlayerRectRaw = null;
    let firstEnemyRectNorm = null;
    let firstPlayerRectNorm = null;

    system.enemies = system.enemies.filter((enemy) => {
      if (!enemy?.el) {
        return false;
      }
      enemy.vx = speedPxPerSec;
      if (enemy.state === 'hit' && enemy.stateUntilMs && nowMs >= enemy.stateUntilMs) {
        system.setEnemyState(enemy, 'approaching', nowMs, { callerTag: 'update:hitTimeout' });
      } else if (enemy.state === 'defeated_hit' && enemy.stateUntilMs && nowMs >= enemy.stateUntilMs) {
        system.setEnemyState(enemy, 'defeated_end', nowMs, { callerTag: 'update:defeatedHitTimeout' });
      } else if (enemy.state === 'defeated_end' && enemy.stateUntilMs && nowMs >= enemy.stateUntilMs) {
        system.removeEnemy(enemy, 'defeated_end_timeout', nowMs);
      } else if (enemy.state === 'collision_resolved'
        && Number.isFinite(enemy.collisionCooldownUntilMs)
        && nowMs >= enemy.collisionCooldownUntilMs) {
        system.setEnemyState(enemy, 'approaching', nowMs, { callerTag: 'collision:cooldown_end' });
      }

      if (!enemy.isAlive) {
        return false;
      }

      if (enemy.state === 'defeated_hit' && enemy.pendingVisualState && nowMs >= enemy.hitAtTs) {
        if (setEnemySprite(enemy, enemy.pendingVisualState)) {
          system.trackEnemySpriteShown(enemy, enemy.pendingVisualState, nowMs);
        }
        enemy.pendingVisualState = null;
      }

      let hitPullPx = 0;
      let hitScale = 1;
      if (enemy.state === 'defeated_hit' && Number.isFinite(enemy.hitAtTs)) {
        const hitElapsedMs = nowMs - enemy.hitAtTs;
        if (hitElapsedMs >= 0 && hitElapsedMs < HIT_PULL_DURATION_MS) {
          const progress = hitElapsedMs / HIT_PULL_DURATION_MS;
          hitPullPx = -HIT_PULL_PX * (1 - progress);
        }
        if (hitElapsedMs >= 0 && hitElapsedMs < HIT_FLASH_MS) {
          hitScale = HIT_FLASH_SCALE;
        }
      }

      if (enemy.state === 'collision_resolved' && Number.isFinite(enemy.stateUntilMs)) {
        const remainingMs = Math.max(0, enemy.stateUntilMs - nowMs);
        const progress = 1 - (remainingMs / COLLISION_RESOLVE_MS);
        const clamped = Math.max(0, Math.min(1, progress));
        hitScale = 1 - 0.08 * clamped;
        enemy.el.style.opacity = (1 - 0.55 * clamped).toFixed(3);
      } else {
        enemy.el.style.opacity = '1';
      }
      enemy.el.style.setProperty('--enemy-hit-pull', `${hitPullPx.toFixed(2)}px`);
      enemy.el.style.setProperty('--enemy-hit-scale', hitScale.toFixed(3));

      enemy.x += enemy.vx * dtSec;
      enemy.y = Math.max(0, (groundY ?? enemy.y) - enemy.h);
      enemy.el.style.transform = getEnemyTransform(enemy);

      if (enemy.x + enemy.w < 0) {
        system.removeEnemy(enemy, 'offscreen', nowMs);
        return false;
      }

      if (enemy.isAlive && enemy.state === 'approaching') {
        let metric = enemy.x;
        if (playerRect) {
          metric = Math.max(0, enemy.x - (playerRect.x + playerRect.w));
        }
        if (metric < nearestEnemyMetric) {
          nearestEnemyMetric = metric;
          const collisionY = Number.isFinite(worldGroundTopY)
            ? worldGroundTopY - enemy.h
            : enemy.y;
          nearestEnemyRect = {
            x: enemy.x,
            y: collisionY,
            w: enemy.w,
            h: enemy.h,
          };
        }
      }

      if (!firstEnemyRect && enemy.state === 'approaching') {
        const collisionY = Number.isFinite(worldGroundTopY)
          ? worldGroundTopY - enemy.h
          : enemy.y;
        firstEnemyRect = {
          x: enemy.x,
          y: collisionY,
          w: enemy.w,
          h: enemy.h,
        };
        firstEnemyRectRaw = {
          x: enemy.x,
          y: enemy.y,
          w: enemy.w,
          h: enemy.h,
        };
      }

      if (playerRect && enemy.state === 'approaching' && enemy.collisionEnabled) {
        const distancePx = Math.max(0, enemy.x - (playerRect.x + playerRect.w));
        nearestDistancePx = Math.min(nearestDistancePx, distancePx);
        const enemyRectRaw = {
          x: enemy.x,
          y: enemy.y,
          w: enemy.w,
          h: enemy.h,
        };
        const enemyRectForHit = {
          x: enemy.x,
          y: Number.isFinite(worldGroundTopY)
            ? worldGroundTopY - enemy.h
            : enemy.y,
          w: enemy.w,
          h: enemy.h,
        };
        const playerRectNorm = normalizeRect(playerRect);
        const enemyRectNorm = normalizeRect(enemyRectForHit);
        const isOverlapRaw = intersectsRawXYWH(playerRect, enemyRectForHit);
        const isOverlap = intersectsNormalized(playerRect, enemyRectForHit);
        if (!firstCollisionEnabled) {
          firstCollisionEnabled = true;
          firstIntersectsRaw = isOverlapRaw;
          firstIntersectsNorm = isOverlap;
          firstPlayerRectRaw = playerRect;
          firstPlayerRectNorm = playerRectNorm;
          firstEnemyRectNorm = enemyRectNorm;
        }
        if (system.isDebugEnabled?.()) {
          const logKey = `${enemy.id}:${Math.round(nowMs)}`;
          if (system.lastCollisionTestLogKey !== logKey) {
            system.lastCollisionTestLogKey = logKey;
            console.log('[dash-debug][COLLIDE:test]', {
              enemyId: enemy.id,
              playerRect,
              playerRectNorm,
              enemyRect: enemyRectRaw,
              enemyRectForHit,
              enemyRectNorm,
              isOverlapRaw,
              isOverlap,
              state: enemy.state,
              collisionEnabled: enemy.collisionEnabled,
            });
          }
        }
        if (!collision && isOverlap) {
          system.onCollisionDebug?.({
            stage: 'overlap',
            enemyId: enemy.id,
            nowMs,
            attackActive: Boolean(attackActive),
            defeatSequenceActive: Boolean(defeatSequenceActive),
          });
          if (attackActive) {
            const defeatedByOverlap = system.requestDefeatEnemy(enemy, nowMs, {
              callerTag: 'update:attackActiveOverlap',
            });
            if (defeatedByOverlap) {
              attackHandled = true;
              events.push({ type: 'defeated', enemyId: enemy.id });
            }
          } else {
            if (isDefeatedState(enemy) || isInDefeatPipeline(enemy) || enemy.attackHandled) {
              return true;
            }
            collision = true;
            system.setEnemyState(enemy, 'collision_resolved', nowMs, {
              callerTag: 'update:collisionOverlap',
              attackHandled: false,
            });
            events.push({ type: 'collision', enemyId: enemy.id });
          }
          system.logEnemyDebug('collisionFrame', {
            enemyId: enemy.id,
            nowMs: Math.round(nowMs),
            groundY: Number.isFinite(groundY) ? Number(groundY.toFixed(2)) : null,
            worldGroundTopY: Number.isFinite(worldGroundTopY) ? Number(worldGroundTopY.toFixed(2)) : null,
            enemyY: Number.isFinite(enemy.y) ? Number(enemy.y.toFixed(2)) : null,
            enemyRectY: Number.isFinite(enemyRectForHit.y) ? Number(enemyRectForHit.y.toFixed(2)) : null,
            playerRectY: Number.isFinite(playerRect.y) ? Number(playerRect.y.toFixed(2)) : null,
          });
        }
      }

      return true;
    });

    if (!Number.isFinite(nearestDistancePx)) {
      nearestDistancePx = null;
    }

    const collisionDebugEnabled = system.isCollisionDebugEnabled?.() === true;
    system.logEnemyDebugSummary(nowMs);
    return {
      nearestDistancePx,
      collision,
      attackHandled,
      events,
      nearestEnemyRect,
      resolvedGroundY,
      debug: collisionDebugEnabled ? {
        enemiesCount: system.enemies.length,
        enemyRect: firstEnemyRect,
        enemyRectRaw: firstEnemyRectRaw,
        playerRectRaw: firstPlayerRectRaw,
        playerRectNorm: firstPlayerRectNorm,
        enemyRectNorm: firstEnemyRectNorm,
        intersectsRaw: firstIntersectsRaw,
        intersects: firstIntersectsNorm,
        collisionEnabled: firstCollisionEnabled,
        startGraceActive: system.elapsedMs < START_GRACE_MS,
      } : undefined,
    };
  };

  system.setWorld(worldEl, containerEl);

  return system;
};
