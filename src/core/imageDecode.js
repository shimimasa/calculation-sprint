export const waitForImageDecode = (img) => {
  if (img?.decode) {
    return img.decode().catch(() => new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    }));
  }
  return new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });
};
