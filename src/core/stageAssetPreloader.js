import domRefs from '../ui/domRefs.js';
import { findStageById } from '../features/stages.js';
import { toDashRunBgThemeId, normalizeRunBgThemeId } from '../features/backgroundThemes.js';
import { toDashStageId } from '../features/dashStages.js';
import { perfLog } from './perf.js';

const imagePromiseByUrl = new Map();
const warmedUrls = new Set();
const preloadPromiseByKey = new Map();

let warmupCanvas = null;
let warmupCtx = null;

const DASH_STAGE_TO_ENEMY_TYPE = Object.freeze({
  plus: 'plus',
  minus: 'minus',
  multi: 'multi',
  divide: 'divide',
  mix: 'plus',
});

const extractCssUrls = (value) => {
  if (!value) {
    return [];
  }
  const matches = [...value.matchAll(/url\((['"]?)(.*?)\1\)/g)];
  return matches.map((match) => match[2]).filter(Boolean);
};

const getRunWorldThemeUrls = (themeId) => {
  const world = domRefs.game.runWorld;
  if (!world) {
    return [];
  }
  const prevTheme = world.getAttribute('data-bg-theme');
  world.setAttribute('data-bg-theme', themeId);
  const computed = getComputedStyle(world);
  const urls = [
    ...extractCssUrls(computed.getPropertyValue('--run-sky-image')),
    ...extractCssUrls(computed.getPropertyValue('--run-ground-image')),
  ];
  if (prevTheme) {
    world.setAttribute('data-bg-theme', prevTheme);
  } else {
    world.removeAttribute('data-bg-theme');
  }
  return [...new Set(urls)];
};

const getStageThemeId = (stageId) => {
  const stage = findStageById(stageId);
  return normalizeRunBgThemeId(stage?.theme?.bgThemeId);
};

const getDashEnemyRepresentativeUrl = (stageId) => {
  const normalizedStageId = toDashStageId(stageId);
  const enemyType = DASH_STAGE_TO_ENEMY_TYPE[normalizedStageId] ?? 'plus';
  return `assets/enemy/enemy_${enemyType}_walk.png`;
};

export const preloadImage = (url, { decode = true } = {}) => {
  if (!url) {
    return Promise.resolve(null);
  }
  if (imagePromiseByUrl.has(url)) {
    return imagePromiseByUrl.get(url);
  }
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = async () => {
      if (decode && typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch (error) {
          perfLog('preload.decode.fallback', { url, reason: String(error?.message ?? error) });
        }
      }
      perfLog('preload.decode.done', { url });
      resolve(img);
    };
    img.onerror = () => {
      perfLog('preload.error', { url });
      resolve(img);
    };
    perfLog('preload.start', { url });
    img.src = url;
  });
  imagePromiseByUrl.set(url, promise);
  return promise;
};

export const warmupImage = (img) => {
  const url = img?.currentSrc || img?.src || '';
  if (!img || !url || warmedUrls.has(url)) {
    return;
  }
  warmupCanvas = warmupCanvas ?? document.createElement('canvas');
  warmupCanvas.width = 1;
  warmupCanvas.height = 1;
  warmupCtx = warmupCtx ?? warmupCanvas.getContext('2d');
  if (!warmupCtx) {
    return;
  }
  warmupCtx.drawImage(img, -9999, -9999, 1, 1);
  warmedUrls.add(url);
  perfLog('preload.warmup.done', { url });
};

const getPreloadKey = (mode, stageId) => `${mode}:${stageId}`;

const collectCoreUrls = (stageId, mode = 'stage') => {
  if (mode === 'dash') {
    const themeId = toDashRunBgThemeId(stageId);
    return [
      ...getRunWorldThemeUrls(themeId),
      getDashEnemyRepresentativeUrl(stageId),
    ];
  }
  const themeId = getStageThemeId(stageId);
  return getRunWorldThemeUrls(themeId);
};

export const preloadStageCoreImages = (stageId, { mode = 'stage' } = {}) => {
  const key = getPreloadKey(mode, stageId);
  if (!stageId) {
    return Promise.resolve([]);
  }
  if (preloadPromiseByKey.has(key)) {
    return preloadPromiseByKey.get(key);
  }
  const urls = [...new Set(collectCoreUrls(stageId, mode).filter(Boolean))];
  perfLog('preload.batch.start', { mode, stageId, count: urls.length });
  const promise = Promise.all(urls.map((url) => preloadImage(url, { decode: true })))
    .then((images) => {
      images.forEach((img) => warmupImage(img));
      return images;
    })
    .finally(() => {
      perfLog('preload.batch.done', { mode, stageId, count: urls.length });
    });
  preloadPromiseByKey.set(key, promise);
  return promise;
};

export const getStageCorePreloadPromise = (stageId, { mode = 'stage' } = {}) => {
  if (!stageId) {
    return null;
  }
  return preloadPromiseByKey.get(getPreloadKey(mode, stageId)) ?? null;
};
