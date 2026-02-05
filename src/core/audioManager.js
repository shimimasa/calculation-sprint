import { diagnoseAssetResponse } from './assetDiagnostics.js';

// ADR-004: Use relative asset paths so subpath hosting works (avoid absolute `/assets/...`).
const BGM_URLS = {
  bgm_title: 'assets/audio/bgm/title.mp3',
  bgm_free: 'assets/audio/bgm/free.mp3',
  bgm_result: 'assets/audio/bgm/result.mp3',
  bgm_clear: 'assets/audio/bgm/clear.mp3',
};

// ADR-004: Use relative asset paths so subpath hosting works (avoid absolute `/assets/...`).
const SFX_URLS = {
  sfx_click: 'assets/audio/sfx/click.mp3',
  sfx_correct: 'assets/audio/sfx/correct.mp3',
  sfx_wrong: 'assets/audio/sfx/wrong.mp3',
};

const SILENT_WAV_DATA_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
    if (id === this.currentBgmId) {
      return;
    }
    if (!this.unlocked) {
      this.pendingBgmId = id ?? null;
      return;
    }
    if (!id) {
      this.stopBgm(opts);
      return;
    }
    const url = BGM_URLS[id];
    const fadeMs = opts.fadeMs ?? 0;
    const token = ++this.fadeToken;
    const fadeGuard = () => token === this.fadeToken;

    if (!url) {
      this.stopCurrentBgm(fadeMs, token);
      this.currentBgmId = id;
      return;
    }

    const nextAudio = new Audio(url);
    nextAudio.loop = true;
    nextAudio.preload = 'auto';
    nextAudio.volume = this.muted ? 0 : this.bgmVolume;
    nextAudio.addEventListener('error', () => {
      diagnoseAssetResponse(url, `bgm:${id}`);
      console.warn(`BGM failed to load: ${id}`);
    });

    const startNext = () => {
      if (token !== this.fadeToken) {
        return;
      }
      this.currentBgm = nextAudio;
      this.currentBgmId = id;
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          console.warn(`BGM playback blocked: ${id}`);
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

    if (nextId === this.currentBgmId && nextId) {
      return;
    }
    if (!this.unlocked) {
      this.pendingBgmId = nextId ?? null;
      return;
    }
    if (!nextId) {
      this.stopBgm({ fadeMs: fadeOutMs });
      return;
    }

    const url = BGM_URLS[nextId];
    const token = ++this.fadeToken;
    const fadeGuard = () => token === this.fadeToken;

    const startNext = () => {
      if (token !== this.fadeToken) {
        return;
      }
      if (!url) {
        this.currentBgmId = nextId;
        return;
      }
      const nextAudio = new Audio(url);
      nextAudio.loop = true;
      nextAudio.preload = 'auto';
      nextAudio.volume = this.muted ? 0 : this.bgmVolume;
      nextAudio.addEventListener('error', () => {
        diagnoseAssetResponse(url, `bgm:${nextId}`);
        console.warn(`BGM failed to load: ${nextId}`);
      });

      this.currentBgm = nextAudio;
      this.currentBgmId = nextId;
      const playPromise = nextAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          console.warn(`BGM playback blocked: ${nextId}`);
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
