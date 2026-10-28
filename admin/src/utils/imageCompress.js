/**
 * imageCompress.js — shrink a picked image before it is stored.
 *
 * Event images are saved inside the event document as data URLs, and the
 * server rejects request bodies over 10 MB. A few phone photos easily exceed
 * that, so each image is scaled down (longest side ≤ maxSide) and re-encoded
 * as JPEG. A typical photo ends up around 100–250 KB.
 */
export const compressImage = (file, { maxSide = 1280, quality = 0.8 } = {}) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; // JPEG has no transparency
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
