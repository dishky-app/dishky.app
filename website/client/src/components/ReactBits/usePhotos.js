import { useEffect, useState } from "react";
import { artImage } from "./artImages.js";

const memo = new Map();

// Resolves true when the photo loads with CORS allowed (WebGL needs that).
function probe(url) {
  if (!memo.has(url)) {
    memo.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(() => resolve(false), 9000);
        img.onload = () => { clearTimeout(t); resolve(true); };
        img.onerror = () => { clearTimeout(t); resolve(false); };
        img.src = url;
      })
    );
  }
  return memo.get(url);
}

/**
 * Takes [{ photo, art }] and returns the list of usable image URLs once every
 * photo has loaded (a photo that fails is swapped for its illustration), or
 * null while they are still loading.
 */
export default function usePhotos(entries) {
  const key = entries.map((e) => e.photo).join("|");
  const [urls, setUrls] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all(entries.map((e) => (e.photo ? probe(e.photo) : false))).then((ok) => {
      if (live) setUrls(entries.map((e, i) => (ok[i] ? e.photo : artImage(e.art || "menu", false))));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
