import { normalizeDashStageId } from './dashStages.js';

const DEFAULT_ENEMY_TYPE = 'plus';
const DASH_STAGE_TO_ENEMY_TYPE = Object.freeze({
  plus: 'plus',
  minus: 'minus',
  multi: 'multi',
  divide: 'divide',
});
const ENEMY_TYPES = Object.freeze(['plus', 'minus', 'multi', 'divide']);
const ENEMY_STATES = ['walk', 'hit', 'dead'];
const ENEMY_SIZE_PX = 72;
const MIN_SPAWN_GAP_PX = 96;
const MIN_REACTION_DISTANCE_PX = 180;
const MIN_TIME_TO_COLLISION_SEC = 2.2;
const HIT_START_DELAY_MS = 150;
const HIT_DURATION_MS = 120;
const DEAD_DURATION_MS = 300;
const HIT_PULL_DURATION_MS = 80;
const HIT_PULL_PX = 16;
const HIT_FLASH_MS = 40;
const HIT_FLASH_SCALE = 1.03;
const MAX_ENEMIES = 2;
const START_GRACE_MS = 2500;
const COLLISION_KNOCKBACK_PX = 120;
const COLLISION_INVULN_MS = 700;
const BASE_SPEED_PX_PER_SEC = 220;
const SPEED_PER_CORRECT_PX_PER_SEC = 2.0;
const SPEED_PER_SEC_PX_PER_SEC = 1.5;
const SPAWN_INTERVAL_START_MS = 1500;
const SPAWN_INTERVAL_MIN_MS = 650;
const SPAWN_INTERVAL_DECAY_MS_PER_SEC = 18;

export const ATTACK_WINDOW_MS = 250;
export const PX_PER_METER = 100;

const clampState = (state) => (ENEMY_STATES.includes(state) ? state : 'walk');

const getEnemyAssetPath = (type, state) => `assets/enemy/enemy_${type}_${state}.png`;

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

const intersects = (a, b) => (
  a.x < b.x + b.w
  && a.x + a.w > b.x
  && a.y < b.y + b.h
  && a.y + a.h > b.y
);

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

const createEnemyElement = (type, state) => {
  const img = document.createElement('img');
  img.className = 'enemy-sprite';
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = getEnemyAssetPath(type, state);
  img.draggable = false;
  return img;
};

const setEnemySprite = (enemy, state) => {
  if (!enemy?.el || enemy.visualState === state) {
    return;
  }
  enemy.visualState = state;
  enemy.el.src = getEnemyAssetPath(enemy.type, state);
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
  getCurrentMode = null,
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
    getCurrentMode,
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

  system.reset = () => {
    system.enemies.forEach((enemy) => {
      enemy.el?.remove();
    });
    system.enemies = [];
    system.spawnTimerMs = START_GRACE_MS;
    system.elapsedMs = 0;
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
    groundY,
    speedPxPerSec,
    playerRect,
    minGapPx = MIN_SPAWN_GAP_PX,
    minReactionDistancePx = MIN_REACTION_DISTANCE_PX,
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
    const state = 'walk';
    const width = ENEMY_SIZE_PX;
    const height = ENEMY_SIZE_PX;
    const baseOffset = width * 0.3;
    const speedMagnitude = Math.abs(speedPxPerSec);
    const spawnX = worldWidth + baseOffset + speedMagnitude * MIN_TIME_TO_COLLISION_SEC;
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
    const enemy = {
      id: `enemy-${system.idCounter += 1}`,
      type,
      state,
      x: spawnX,
      y: Math.max(0, (groundY ?? 0) - height),
      w: width,
      h: height,
      vx: speedPxPerSec,
      tStateUntil: null,
      isAlive: true,
      hitAtTs: null,
      visualState: state,
      pendingVisualState: null,
      ignoreCollisionUntilMs: 0,
      el: createEnemyElement(type, state),
    };
    enemy.el.style.width = `${width}px`;
    enemy.el.style.height = `${height}px`;
    enemy.el.style.transform = getEnemyTransform(enemy);
    container.appendChild(enemy.el);
    system.enemies.push(enemy);
    return enemy;
  };

  system.defeatNearestEnemy = ({ playerRect, nowMs }) => {
    if (!playerRect) {
      return { defeated: false, target: null };
    }
    let nearestEnemy = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    system.enemies.forEach((enemy) => {
      if (!enemy?.isAlive || enemy.state !== 'walk') {
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
    system.setEnemyState(nearestEnemy, 'hit', nowMs);
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

  system.setEnemyState = (enemy, nextState, nowMs) => {
    const state = clampState(nextState);
    if (enemy.state === state) {
      return;
    }
    enemy.state = state;
    if (state === 'hit') {
      enemy.hitAtTs = nowMs + HIT_START_DELAY_MS;
      enemy.tStateUntil = enemy.hitAtTs + HIT_DURATION_MS;
      enemy.pendingVisualState = 'hit';
    } else if (state === 'dead') {
      enemy.hitAtTs = null;
      enemy.pendingVisualState = null;
      enemy.tStateUntil = nowMs + DEAD_DURATION_MS;
      setEnemySprite(enemy, state);
    } else {
      enemy.hitAtTs = null;
      enemy.pendingVisualState = null;
      enemy.tStateUntil = null;
      setEnemySprite(enemy, state);
    }
  };

  system.update = ({
    dtMs,
    nowMs,
    groundY,
    playerRect,
    correctCount,
    attackActive,
  }) => {
    if (!Number.isFinite(dtMs) || dtMs <= 0) {
      return { nearestDistancePx: null, collision: false, attackHandled: false };
    }
    if (!system.worldEl) {
      return { nearestDistancePx: null, collision: false, attackHandled: false };
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
    const spawnInterval = Math.max(
      SPAWN_INTERVAL_MIN_MS,
      SPAWN_INTERVAL_START_MS - elapsedSec * SPAWN_INTERVAL_DECAY_MS_PER_SEC,
    );
    while (system.spawnTimerMs <= 0) {
      const activeEnemies = system.enemies.filter((enemy) => enemy?.isAlive).length;
      if (activeEnemies >= MAX_ENEMIES) {
        system.spawnTimerMs += spawnInterval;
        break;
      }
      system.spawnEnemy({
        nowMs,
        groundY,
        speedPxPerSec,
        playerRect,
      });
      system.spawnTimerMs += spawnInterval;
    }

    let nearestDistancePx = Number.POSITIVE_INFINITY;
    let collision = false;
    let attackHandled = false;

    system.enemies = system.enemies.filter((enemy) => {
      if (!enemy?.el) {
        return false;
      }
      enemy.vx = speedPxPerSec;
      if (enemy.state === 'hit' && enemy.tStateUntil && nowMs >= enemy.tStateUntil) {
        system.setEnemyState(enemy, 'dead', nowMs);
      } else if (enemy.state === 'dead' && enemy.tStateUntil && nowMs >= enemy.tStateUntil) {
        enemy.isAlive = false;
      }

      if (!enemy.isAlive) {
        enemy.el.remove();
        return false;
      }

      if (enemy.state === 'hit' && enemy.pendingVisualState && nowMs >= enemy.hitAtTs) {
        setEnemySprite(enemy, enemy.pendingVisualState);
        enemy.pendingVisualState = null;
      }

      let hitPullPx = 0;
      let hitScale = 1;
      if (enemy.state === 'hit' && Number.isFinite(enemy.hitAtTs)) {
        const hitElapsedMs = nowMs - enemy.hitAtTs;
        if (hitElapsedMs >= 0 && hitElapsedMs < HIT_PULL_DURATION_MS) {
          const progress = hitElapsedMs / HIT_PULL_DURATION_MS;
          hitPullPx = -HIT_PULL_PX * (1 - progress);
        }
        if (hitElapsedMs >= 0 && hitElapsedMs < HIT_FLASH_MS) {
          hitScale = HIT_FLASH_SCALE;
        }
      }
      enemy.el.style.setProperty('--enemy-hit-pull', `${hitPullPx.toFixed(2)}px`);
      enemy.el.style.setProperty('--enemy-hit-scale', hitScale.toFixed(3));

      enemy.x += enemy.vx * dtSec;
      enemy.y = Math.max(0, (groundY ?? enemy.y) - enemy.h);
      enemy.el.style.transform = getEnemyTransform(enemy);

      if (enemy.x + enemy.w < 0) {
        enemy.el.remove();
        return false;
      }

      if (playerRect && enemy.state === 'walk') {
        const distancePx = Math.max(0, enemy.x - (playerRect.x + playerRect.w));
        nearestDistancePx = Math.min(nearestDistancePx, distancePx);
        if (!collision && nowMs >= enemy.ignoreCollisionUntilMs && intersects(playerRect, enemy)) {
          collision = true;
          enemy.ignoreCollisionUntilMs = nowMs + COLLISION_INVULN_MS;
          const knockbackTargetX = Math.max(
            enemy.x + COLLISION_KNOCKBACK_PX,
            playerRect.x + playerRect.w + 1,
          );
          enemy.x = knockbackTargetX;
          enemy.el.style.transform = getEnemyTransform(enemy);
          if (attackActive) {
            attackHandled = true;
            system.setEnemyState(enemy, 'hit', nowMs);
          }
        }
      }

      return true;
    });

    if (!Number.isFinite(nearestDistancePx)) {
      nearestDistancePx = null;
    }

    return {
      nearestDistancePx,
      collision,
      attackHandled,
    };
  };

  system.setWorld(worldEl, containerEl);

  return system;
};
