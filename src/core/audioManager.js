import { diagnoseAssetResponse } from './assetDiagnostics.js';
import dashSettingsStore from './dashSettingsStore.js';

// ADR-004: Use relative asset paths so subpath hosting works (avoid absolute `/assets/...`).
const BGM_URLS = {
  bgm_title: 'assets/audio/bgm/title.mp3',
  bgm_free: 'assets/audio/bgm/free.mp3',
  bgm_result: 'assets/audio/bgm/result.mp3',
  bgm_clear: 'assets/audio/bgm/clear.mp3',
  bgm_add: 'assets/audio/bgm/add.mp3',
  bgm_sub: 'assets/audio/bgm/minus.mp3',
  bgm_mul: 'assets/audio/bgm/multi.mp3',
  bgm_div: 'assets/audio/bgm/divide.mp3',
  bgm_mix: 'assets/audio/bgm/mix.mp3',
  bgm_dash: 'assets/audio/bgm/bgm-1.mp3',
};

// ADR-004: Use relative asset paths so subpath hosting works (avoid absolute `/assets/...`).
const SFX_URLS = {
  sfx_click: 'assets/audio/sfx/click.mp3',
  sfx_correct: 'assets/audio/sfx/correct.mp3',
  sfx_wrong: 'assets/audio/sfx/wrong.mp3',
  sfx_decide: 'assets/audio/sfx/click.mp3',
  sfx_cancel: 'assets/audio/sfx/click.mp3',
  sfx_confirm: 'assets/audio/sfx/click.mp3',
  sfx_stage_clear: 'assets/audio/sfx/correct.mp3',
  sfx_stage_unlock: 'assets/audio/sfx/correct.mp3',
  sfx_levelup: 'assets/audio/sfx/correct.mp3',
  sfx_countdown: 'assets/audio/sfx/wrong.mp3',
  sfx_attack: 'assets/audio/sfx/attack.mp3',
  sfx_damage: 'assets/audio/sfx/damage.mp3',
  sfx_goal: 'assets/audio/sfx/goal.mp3',
};

const SILENT_WAV_DATA_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const warnedUnknownBgmIds = new Set();
const warnedUnknownSfxIds = new Set();
const warnUnknownBgmId = (id) => {
  if (!id || BGM_URLS[id]) {
    return;
  }
  if (warnedUnknownBgmIds.has(id)) {
    return;
  }
  warnedUnknownBgmIds.add(id);
  console.warn(`[audio] unknown bgmId "${id}" -> fallback to bgm_free`);
};
const warnUnknownSfxId = (id) => {
  if (!id || SFX_URLS[id]) {
    return;
  }
  if (warnedUnknownSfxIds.has(id)) {
    return;
  }
  warnedUnknownSfxIds.add(id);
  console.warn(`[audio] unknown sfxId "${id}" -> ignored`);
};
const resolveBgmId = (id) => {
  if (!id) {
    return null;
  }
  if (BGM_URLS[id]) {
    return id;
  }
  if (id !== 'bgm_free' && BGM_URLS.bgm_free) {
    return 'bgm_free';
  }
  return null;
};

const fadeAudio = (audio, from, to, durationMs, onComplete, shouldContinue) => {
  if (!audio) {
    if (onComplete) {
      onComplete();
    }
    return;
  }
  if (!durationMs || durationMs <= 0) {
    audio.volume = to;
    if (onComplete) {
      onComplete();
    }
    return;
  }
  const startAt = performance.now();
  const delta = to - from;
  const step = (now) => {
    if (shouldContinue && !shouldContinue()) {
      return;
    }
    const progress = clamp((now - startAt) / durationMs, 0, 1);
    audio.volume = from + delta * progress;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else if (onComplete) {
      onComplete();
    }
  };
  audio.volume = from;
  window.requestAnimationFrame(step);
};

class AudioManager {
  constructor() {
    this.currentBgmId = null;
    this.currentBgm = null;
    this.bgmEnabled = true;
    this.sfxEnabled = true;
    this.bgmVolume = 1;
    this.fadeToken = 0;
    this.unlocked = false;
    this.unlockPromise = null;
    this.pendingBgmId = null;
  }

  syncSettings(profileId) {
    const settings = dashSettingsStore.get(profileId);
    this.bgmEnabled = settings.bgmEnabled !== false;
    this.sfxEnabled = settings.sfxEnabled !== false;
    if (this.currentBgm) {
      this.currentBgm.volume = this.bgmEnabled ? this.bgmVolume : 0;
    }
    return settings;
  }

  setMuted(muted, profileId) {
    const enabled = !Boolean(muted);
    return this.applySettings({ bgmEnabled: enabled, sfxEnabled: enabled }, profileId);
  }

  isMuted() {
    return !this.bgmEnabled && !this.sfxEnabled;
  }

  setBgmEnabled(enabled, profileId) {
    return this.applySettings({ bgmEnabled: Boolean(enabled) }, profileId);
  }

  setSfxEnabled(enabled, profileId) {
    return this.applySettings({ sfxEnabled: Boolean(enabled) }, profileId);
  }

  applySettings(nextSettings, profileId) {
    const settings = dashSettingsStore.save(nextSettings, profileId);
    this.bgmEnabled = settings.bgmEnabled;
    this.sfxEnabled = settings.sfxEnabled;
    if (this.currentBgm) {
      this.currentBgm.volume = this.bgmEnabled ? this.bgmVolume : 0;
    }
    return settings;
  }

  isBgmEnabled() {
    return this.bgmEnabled;
  }

  isSfxEnabled() {
    return this.sfxEnabled;
  }

  isUnlocked() {
    return this.unlocked;
  }

  unlock() {
    if (this.unlocked) {
      return Promise.resolve();
    }
    if (this.unlockPromise) {
      return this.unlockPromise;
    }
    this.unlockPromise = this.performUnlock().finally(() => {
      this.unlockPromise = null;
    });
    return this.unlockPromise;
  }

  async performUnlock() {
    const audio = new Audio(SILENT_WAV_DATA_URI);
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      await playPromise.catch(() => null);
    }
    audio.pause();
    audio.currentTime = 0;
    this.unlocked = true;
    if (this.pendingBgmId) {
      const pendingId = this.pendingBgmId;
      this.pendingBgmId = null;
      this.setBgm(pendingId);
    }
  }

  setBgm(id, opts = {}) {
    if (!this.bgmEnabled) {
      return;
    }
    warnUnknownBgmId(id);
    const resolvedId = resolveBgmId(id);
    const force = Boolean(opts.force);
    if (!force && resolvedId === this.currentBgmId) {
      return;
    }
    if (!this.unlocked) {
      this.pendingBgmId = resolvedId ?? null;
      return;
    }
    if (!resolvedId) {
      this.stopBgm(opts);
      return;
    }
    const url = BGM_URLS[resolvedId];
    const fadeMs = opts.fadeMs ?? 0;
    const token = ++this.fadeToken;
    const fadeGuard = () => token === this.fadeToken;

    const nextAudio = new Audio(url);
    nextAudio.loop = opts.loop ?? true;
    nextAudio.preload = 'auto';
    nextAudio.volume = this.bgmEnabled ? this.bgmVolume : 0;
    nextAudio.addEventListener('error', () => {
      diagnoseAssetResponse(url, `bgm:${resolvedId}`);
      console.warn(`BGM failed to load: ${resolvedId}`);
    });

    const startNext = () => {
      if (token !== this.fadeToken) {
        return;
      }
      this.currentBgm = nextAudio;
      this.currentBgmId = resolvedId;
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          console.warn(`BGM playback blocked: ${resolvedId}`);
        });
      }
      if (fadeMs > 0 && this.bgmEnabled) {
        nextAudio.volume = 0;
        fadeAudio(nextAudio, 0, this.bgmVolume, fadeMs, null, fadeGuard);
      }
    };

    if (this.currentBgm) {
      if (fadeMs > 0) {
        const currentAudio = this.currentBgm;
        const currentVolume = currentAudio.volume;
        fadeAudio(currentAudio, currentVolume, 0, fadeMs, () => {
          if (token !== this.fadeToken) {
            return;
          }
          currentAudio.pause();
          this.currentBgm = null;
          startNext();
        }, fadeGuard);
      } else {
        this.currentBgm.pause();
        this.currentBgm = null;
        startNext();
      }
    } else {
      startNext();
    }
  }

  playBgm(id, opts = {}) {
    const loop = opts.loop ?? true;
    this.setBgm(id, {
      ...opts,
      force: true,
      loop,
    });
  }

  stopCurrentBgm(fadeMs, token) {
    if (!this.currentBgm) {
      return;
    }
    const currentAudio = this.currentBgm;
    if (fadeMs > 0) {
      const fadeGuard = token ? () => token === this.fadeToken : null;
      fadeAudio(currentAudio, currentAudio.volume, 0, fadeMs, () => {
        if (token && token !== this.fadeToken) {
          return;
        }
        currentAudio.pause();
      }, fadeGuard);
    } else {
      currentAudio.pause();
    }
    this.currentBgm = null;
  }

  stopBgm(opts = {}) {
    const fadeMs = opts.fadeMs ?? 0;
    const token = ++this.fadeToken;
    this.stopCurrentBgm(fadeMs, token);
    this.currentBgmId = null;
  }

  transitionBgm(nextId, opts = {}) {
    if (!this.bgmEnabled) {
      return;
    }
    const fadeOutMs = opts.fadeOutMs ?? 0;
    const fadeInMs = opts.fadeInMs ?? 0;

    warnUnknownBgmId(nextId);
    const resolvedId = resolveBgmId(nextId);
    if (resolvedId === this.currentBgmId && resolvedId) {
      return;
    }
    if (!this.unlocked) {
      this.pendingBgmId = resolvedId ?? null;
      return;
    }
    if (!resolvedId) {
      this.stopBgm({ fadeMs: fadeOutMs });
      return;
    }

    const url = BGM_URLS[resolvedId];
    const token = ++this.fadeToken;
    const fadeGuard = () => token === this.fadeToken;

    const startNext = () => {
      if (token !== this.fadeToken) {
        return;
      }
      const nextAudio = new Audio(url);
      nextAudio.loop = true;
      nextAudio.preload = 'auto';
      nextAudio.volume = this.bgmEnabled ? this.bgmVolume : 0;
      nextAudio.addEventListener('error', () => {
        diagnoseAssetResponse(url, `bgm:${resolvedId}`);
        console.warn(`BGM failed to load: ${resolvedId}`);
      });

      this.currentBgm = nextAudio;
      this.currentBgmId = resolvedId;
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          console.warn(`BGM playback blocked: ${resolvedId}`);
        });
      }
      if (fadeInMs > 0 && this.bgmEnabled) {
        nextAudio.volume = 0;
        fadeAudio(nextAudio, 0, this.bgmVolume, fadeInMs, null, fadeGuard);
      }
    };

    if (this.currentBgm) {
      const currentAudio = this.currentBgm;
      const currentVolume = currentAudio.volume;
      if (fadeOutMs > 0) {
        fadeAudio(currentAudio, currentVolume, 0, fadeOutMs, () => {
          if (token !== this.fadeToken) {
            return;
          }
          currentAudio.pause();
          this.currentBgm = null;
          startNext();
        }, fadeGuard);
      } else {
        currentAudio.pause();
        this.currentBgm = null;
        startNext();
      }
    } else {
      startNext();
    }
  }

  playSfx(id, opts = {}) {
    if (!id) {
      return;
    }
    if (!this.sfxEnabled) {
      return;
    }
    if (!this.unlocked) {
      return;
    }
    const url = SFX_URLS[id];
    if (!url) {
      warnUnknownSfxId(id);
      return;
    }
    const audio = new Audio(url);
    audio.loop = false;
    audio.preload = 'auto';
    const volume = clamp(opts.volume ?? 1, 0, 1);
    audio.volume = this.sfxEnabled ? volume : 0;
    audio.addEventListener('error', () => {
      diagnoseAssetResponse(url, `sfx:${id}`);
      console.warn(`SFX failed to load: ${id}`);
    });
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        console.warn(`SFX playback blocked: ${id}`);
      });
    }
  }
}

const audioManager = new AudioManager();

export { BGM_URLS, SFX_URLS };
export default audioManager;
