const ENEMY_TYPES = ['plus', 'minus', 'multi', 'divide'];
const ENEMY_STATES = ['walk', 'hit', 'dead'];
const ENEMY_SIZE_PX = 72;
const HIT_DURATION_MS = 120;
const DEAD_DURATION_MS = 300;
const BASE_SPEED_PX_PER_SEC = 220;
const SPEED_PER_CORRECT_PX_PER_SEC = 2.0;
const SPEED_PER_SEC_PX_PER_SEC = 1.5;
const SPAWN_INTERVAL_START_MS = 1500;
const SPAWN_INTERVAL_MIN_MS = 650;
const SPAWN_INTERVAL_DECAY_MS_PER_SEC = 18;

export const ATTACK_WINDOW_MS = 250;
export const PX_PER_METER = 100;

const pickRandomType = () => ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];

const clampState = (state) => (ENEMY_STATES.includes(state) ? state : 'walk');

const getEnemyAssetPath = (type, state) => `assets/enemy/enemy_${type}_${state}.png`;

const intersects = (a, b) => (
  a.x < b.x + b.w
  && a.x + a.w > b.x
  && a.y < b.y + b.h
  && a.y + a.h > b.y
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

const getSpeedPxPerSec = ({ correctCount = 0, elapsedSec = 0 }) => -(
  BASE_SPEED_PX_PER_SEC
  + correctCount * SPEED_PER_CORRECT_PX_PER_SEC
  + elapsedSec * SPEED_PER_SEC_PX_PER_SEC
);

export const createDashEnemySystem = ({ worldEl, containerEl } = {}) => {
  const system = {
    worldEl,
    containerEl,
    enemies: [],
    spawnTimerMs: 0,
    elapsedMs: 0,
    idCounter: 0,
  };

  system.setWorld = (nextWorld, nextContainer) => {
    system.worldEl = nextWorld ?? system.worldEl;
    system.containerEl = ensureEnemyContainer(system.worldEl, nextContainer ?? system.containerEl);
  };

  system.reset = () => {
    system.enemies.forEach((enemy) => {
      enemy.el?.remove();
    });
    system.enemies = [];
    system.spawnTimerMs = 0;
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

  system.spawnEnemy = ({ nowMs, groundY, speedPxPerSec }) => {
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
    const type = pickRandomType();
    const state = 'walk';
    const width = ENEMY_SIZE_PX;
    const height = ENEMY_SIZE_PX;
    const enemy = {
      id: `enemy-${system.idCounter += 1}`,
      type,
      state,
      x: worldWidth + width * 0.3,
      y: Math.max(0, (groundY ?? 0) - height),
      w: width,
      h: height,
      vx: speedPxPerSec,
      tStateUntil: null,
      isAlive: true,
      hitAtTs: null,
      el: createEnemyElement(type, state),
    };
    enemy.el.style.width = `${width}px`;
    enemy.el.style.height = `${height}px`;
    enemy.el.style.transform = `translate3d(${Math.round(enemy.x)}px, ${Math.round(enemy.y)}px, 0)`;
    container.appendChild(enemy.el);
    system.enemies.push(enemy);
    return enemy;
  };

  system.setEnemyState = (enemy, nextState, nowMs) => {
    const state = clampState(nextState);
    if (enemy.state === state) {
      return;
    }
    enemy.state = state;
    enemy.el.src = getEnemyAssetPath(enemy.type, state);
    if (state === 'hit') {
      enemy.tStateUntil = nowMs + HIT_DURATION_MS;
    } else if (state === 'dead') {
      enemy.tStateUntil = nowMs + DEAD_DURATION_MS;
    } else {
      enemy.tStateUntil = null;
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
      system.spawnEnemy({
        nowMs,
        groundY,
        speedPxPerSec,
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

      enemy.x += enemy.vx * dtSec;
      enemy.y = Math.max(0, (groundY ?? enemy.y) - enemy.h);
      enemy.el.style.transform = `translate3d(${Math.round(enemy.x)}px, ${Math.round(enemy.y)}px, 0)`;

      if (enemy.x + enemy.w < 0) {
        enemy.el.remove();
        return false;
      }

      if (playerRect && enemy.state === 'walk') {
        const distancePx = Math.max(0, enemy.x - (playerRect.x + playerRect.w));
        nearestDistancePx = Math.min(nearestDistancePx, distancePx);
        if (!collision && intersects(playerRect, enemy)) {
          collision = true;
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
