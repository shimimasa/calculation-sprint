import { diagnoseAssetResponse } from './assetDiagnostics.js';

// ADR-004: Use relative asset paths so subpath hosting works (avoid absolute `/assets/...`).
const BGM_URLS = {
  bgm_title: 'assets/audio/bgm/title.mp3',
  bgm_free: 'assets/audio/bgm/free.mp3',
  bgm_result: 'assets/audio/bgm/result.mp3',
  bgm_clear: 'assets/audio/bgm/clear.mp3',
  bgm_add: 'assets/audio/bgm/free.mp3',
  bgm_sub: 'assets/audio/bgm/free.mp3',
  bgm_mul: 'assets/audio/bgm/free.mp3',
  bgm_div: 'assets/audio/bgm/free.mp3',
  bgm_mix: 'assets/audio/bgm/free.mp3',
};

// ADR-004: Use relative asset paths so subpath hosting works (avoid absolute `/assets/...`).
const SFX_URLS = {
  sfx_click: 'assets/audio/sfx/click.mp3',
  sfx_correct: 'assets/audio/sfx/correct.mp3',
  sfx_wrong: 'assets/audio/sfx/wrong.mp3',
  sfx_decide: 'assets/audio/sfx/click.mp3',
  sfx_cancel: 'assets/audio/sfx/click.mp3',
  sfx_stage_clear: 'assets/audio/sfx/correct.mp3',
  sfx_stage_unlock: 'assets/audio/sfx/correct.mp3',
  sfx_levelup: 'assets/audio/sfx/correct.mp3',
  sfx_countdown: 'assets/audio/sfx/wrong.mp3',
};

const SILENT_WAV_DATA_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
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
    this.muted = false;
    this.bgmVolume = 1;
    this.fadeToken = 0;
    this.unlocked = false;
    this.unlockPromise = null;
    this.pendingBgmId = null;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.currentBgm) {
      this.currentBgm.volume = this.muted ? 0 : this.bgmVolume;
    }
  }

  isMuted() {
    return this.muted;
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
    const resolvedId = resolveBgmId(id);
    if (resolvedId === this.currentBgmId) {
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
    nextAudio.loop = true;
    nextAudio.preload = 'auto';
    nextAudio.volume = this.muted ? 0 : this.bgmVolume;
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
      if (fadeMs > 0 && !this.muted) {
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
    const fadeOutMs = opts.fadeOutMs ?? 0;
    const fadeInMs = opts.fadeInMs ?? 0;

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
      nextAudio.volume = this.muted ? 0 : this.bgmVolume;
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
      if (fadeInMs > 0 && !this.muted) {
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
    const url = SFX_URLS[id];
    if (!url) {
      return;
    }
    const audio = new Audio(url);
    audio.loop = false;
    audio.preload = 'auto';
    const volume = clamp(opts.volume ?? 1, 0, 1);
    audio.volume = this.muted ? 0 : volume;
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
