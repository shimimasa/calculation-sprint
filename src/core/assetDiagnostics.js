const warnedUrls = new Set();
const DEFAULT_HINT = 'SPA rewrite or basepath mismatch may be returning HTML for asset URLs.';

const normalizeUrl = (url) => {
  try {
    return new URL(url, window.location.href).href;
  } catch (error) {
    return String(url);
  }
};

const resolveBaseInfo = () => {
  const appPath = window.location.pathname;
  const baseHref = document.querySelector('base')?.getAttribute('href') ?? null;
  const baseUrl = baseHref ? new URL(baseHref, window.location.href) : null;
  const viteBase = import.meta?.env?.BASE_URL ?? null;
  return {
    appPath,
    baseHref,
    baseUrl: baseUrl?.href ?? null,
    basePathGuess: baseUrl?.pathname ?? viteBase ?? null,
    hasBaseTag: Boolean(baseHref),
    viteBase,
  };
};

const buildContext = (url, response, context, hint) => {
  const resolvedUrl = normalizeUrl(url);
  const baseInfo = resolveBaseInfo();
  return {
    requestedUrl: resolvedUrl,
    status: response?.status ?? null,
    contentType: response?.headers?.get('content-type') ?? null,
    ...baseInfo,
    context: context ?? null,
    hint: hint || DEFAULT_HINT,
    rewriteNote: 'If assets return HTML, an SPA fallback rewrite may be responding to asset URLs.',
  };
};

const warnOnce = (url, message, details) => {
  const resolvedUrl = normalizeUrl(url);
  if (warnedUrls.has(resolvedUrl)) {
    return;
  }
  warnedUrls.add(resolvedUrl);
  console.warn(message, details);
};

const warnIfHtmlAssetResponse = (url, { response, context, hint } = {}) => {
  const contentType = response?.headers?.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('text/html')) {
    warnOnce(url, '[asset] HTML response detected for asset URL.', buildContext(url, response, context, hint));
  }
};

const warnIf404 = (url, { response, context, hint } = {}) => {
  if (response?.status === 404) {
    warnOnce(url, '[asset] 404 detected for asset URL.', buildContext(url, response, context, hint));
  }
};

const diagnoseAssetResponse = async (url, context) => {
  if (!url) {
    return;
  }
  const resolvedUrl = normalizeUrl(url);
  if (warnedUrls.has(resolvedUrl)) {
    return;
  }
  try {
    let response = await fetch(resolvedUrl, { method: 'HEAD', cache: 'no-store' });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(resolvedUrl, { method: 'GET', cache: 'no-store' });
    }
    warnIfHtmlAssetResponse(resolvedUrl, { response, context });
    warnIf404(resolvedUrl, { response, context });
  } catch (error) {
    warnOnce(resolvedUrl, '[asset] Request failed for asset URL.', {
      requestedUrl: resolvedUrl,
      context: context ?? null,
      error: error?.message ?? 'unknown',
      hint: 'Check network, basepath, or rewrite rules.',
    });
  }
};

export { diagnoseAssetResponse, warnIfHtmlAssetResponse, warnIf404 };
