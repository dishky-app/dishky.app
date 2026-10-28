// Where the brand artwork lives. Files are in  client/public/brand/ .
// To change the artwork: overwrite the files there (same names), or point
// these paths at your new file names / formats (png, svg, webp).
export const brand = {
  name: "Dishky",
  // Logo mark (fork + D icon): header, footer, preloader. This is the only
  // logo shown when the header/footer sits on a dark background.
  logo: "/brand/logo-mark.png",
  // Same mark for DARK surfaces: white fork + D on the site red (#f33716),
  // because the black fork on a dark header is hard to see. The red is baked
  // in, so no filter is applied to this file.
  logoOnDark: "/brand/logo-mark-dark.png",
  // The red Dishky app-icon (white fork + D on the brand red). Used in the top
  // bar on every background, light or dark, with no filter applied.
  logoRed: "/brand/logo-mark.png",
  // "DishKy" wordmark, shown beside the mark on LIGHT backgrounds only.
  wordmark: "/brand/logo-wordmark.png",
  // Wordmark for DARK surfaces: "Dish" in white, "Ky" in the site red. The red
  // is baked in, so no filter is applied to this file.
  wordmarkOnDark: "/brand/logo-wordmark-dark.png",
  // The supplied logo red is about #e4290c. This CSS filter maps it to the
  // site red (#f33716) and leaves black untouched. Set to "none" to disable.
  filter: "sepia(0.848) saturate(5.726) hue-rotate(-2.6deg) brightness(1.988) saturate(0.927)",
};
