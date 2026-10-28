import React from "react";
import { brand } from "../../config/brand.js";

/**
 * Header / footer / preloader brand artwork. These are plain <img> tags:
 * replace the files in  client/public/brand/  (same file names) or change the
 * paths in  src/config/brand.js.  Sizing is by HEIGHT (width follows the
 * image), so any aspect ratio works; adjust the h-* classes where used.
 * The logo red is recoloured to the site red with a CSS filter (brand.filter).
 */
const artStyle = brand.filter && brand.filter !== "none" ? { filter: brand.filter } : undefined;

export function BrandMark({ className = "h-9", dark = false, red = false }) {
  // red: the red Dishky icon exactly as supplied (same on light and dark surfaces, no filter).
  if (red && brand.logoRed) {
    return (
      <img
        src={brand.logoRed}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={`w-auto max-w-none shrink-0 select-none rounded-[22%] object-contain ${className}`}
      />
    );
  }
  const useDarkArt = dark && Boolean(brand.logoOnDark);
  return (
    <img
      src={useDarkArt ? brand.logoOnDark : brand.logo}
      alt=""
      aria-hidden="true"
      draggable="false"
      className={`w-auto max-w-none shrink-0 select-none object-contain ${className}`}
      style={useDarkArt ? undefined : artStyle}
    />
  );
}

/**
 * Brand-name image. The wordmark has black letters, so on a dark surface
 * (dark = true) the light-artwork file brand.wordmarkOnDark is used instead;
 * if none is set, nothing is rendered and the logo mark stands alone.
 */
export function BrandWordmark({ dark = false, className = "h-5" }) {
  const src = dark ? brand.wordmarkOnDark : brand.wordmark;
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable="false"
      className={`w-auto max-w-none select-none object-contain ${className}`}
      style={dark ? undefined : artStyle}
    />
  );
}

/** Logo image + brand-name image side by side. */
export default function BrandLockup({ dark = false, red = false, markClassName, wordmarkClassName, gap = "gap-2.5" }) {
  return (
    <span className={`inline-flex items-center ${gap}`}>
      <BrandMark dark={dark} red={red} className={markClassName} />
      <BrandWordmark dark={dark} className={wordmarkClassName} />
    </span>
  );
}
