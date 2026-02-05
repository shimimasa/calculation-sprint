const warnedUrls = new Set();

const normalizeUrl = (url) => {
  try {
    return new URL(url, window.location.href).href;
  } catch (error) {
    return String(url);
  }
};

const buildContext = (url, response, context) => {
  const resolvedUrl = normalizeUrl(url);
  const appPath = window.location.pathname;
  const baseHref = document.querySelector('base')?.getAttribute('href') ?? null;
  return {
    requestedUrl: resolvedUrl,
    status: response?.status ?? null,
    contentType: response?.headers?.get('content-type') ?? null,
    appPath,
    baseHref,
    context: context ?? null,
    hint: 'If assets return HTML or 404, check basepath and rewrite rules (SPA fallback may be responding).',
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

const warnIfHtmlAssetResponse = (url, response, context) => {
  const contentType = response?.headers?.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('text/html')) {
    warnOnce(url, '[asset] HTML response detected for asset URL.', buildContext(url, response, context));
  }
};

const warnIfMissingAssetResponse = (url, response, context) => {
  if (response?.status === 404) {
    warnOnce(url, '[asset] 404 detected for asset URL.', buildContext(url, response, context));
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
    warnIfHtmlAssetResponse(resolvedUrl, response, context);
    warnIfMissingAssetResponse(resolvedUrl, response, context);
  } catch (error) {
    warnOnce(resolvedUrl, '[asset] Request failed for asset URL.', {
      requestedUrl: resolvedUrl,
      context: context ?? null,
      error: error?.message ?? 'unknown',
      hint: 'Check network, basepath, or rewrite rules.',
    });
  }
};

export { diagnoseAssetResponse, warnIfHtmlAssetResponse, warnIfMissingAssetResponse };
