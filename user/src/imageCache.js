const imageCache = new Set();

export const preloadImage = (src) => {
  if (!src || imageCache.has(src)) return;

  const img = new Image();
  img.src = src;

  imageCache.add(src);
};