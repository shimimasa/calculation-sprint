const BGM_URLS = {
  bgm_title: '/assets/audio/bgm/title.mp3',
  bgm_free: '/assets/audio/bgm/free.mp3',
  bgm_result: '/assets/audio/bgm/result.mp3',
  bgm_clear: '/assets/audio/bgm/clear.mp3',
};

const SFX_URLS = {
  sfx_click: '/assets/audio/sfx/click.mp3',
  sfx_correct: '/assets/audio/sfx/correct.mp3',
  sfx_wrong: '/assets/audio/sfx/wrong.mp3',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fadeAudio = (audio, from, to, durationMs, onComplete) => {
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

  setBgm(id, opts = {}) {
    if (id === this.currentBgmId) {
      return;
    }
    if (!id) {
      this.stopBgm(opts);
      return;
    }
    const url = BGM_URLS[id];
    const fadeMs = opts.fadeMs ?? 0;
    const token = ++this.fadeToken;

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
        fadeAudio(nextAudio, 0, this.bgmVolume, fadeMs, null);
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
        });
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
      fadeAudio(currentAudio, currentAudio.volume, 0, fadeMs, () => {
        if (token && token !== this.fadeToken) {
          return;
        }
        currentAudio.pause();
      });
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
