/** Resize a picked image to a small square-ish JPEG data URL (default 256px) so it can be stored on the profile. */
export function fileToAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type)) { reject(new Error("Choose a PNG, JPG or WebP picture.")); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Could not read the picture."));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid picture."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
