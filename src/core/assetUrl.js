const APP_ROOT_URL = new URL('../../', import.meta.url);

const isAbsoluteUrl = (value) => /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);

export const resolveAssetUrl = (assetPath) => {
  const rawPath = String(assetPath ?? '').trim();
  if (!rawPath) {
    return '';
  }
  if (isAbsoluteUrl(rawPath)) {
    return rawPath;
  }
  const normalizedPath = rawPath.replace(/^\/+/, '');
  return new URL(normalizedPath, APP_ROOT_URL).href;
};

export default resolveAssetUrl;
