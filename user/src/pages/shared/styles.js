/**
 * Shared inline-style constants for Button3D / ButtonFace overrides.
 */

/** Horizontal edge gradient used on red "delete" style 3D buttons. */
export const RED_EDGE_GRADIENT = {
  background: `linear-gradient(
      to left,
      var(--edge-color-dark) 0%,
      var(--edge-color-light) 8%,
      var(--edge-color-light) 92%,
      var(--edge-color-dark) 100%
    )`
};

/** Front-face style for red "delete" buttons. */
export const RED_FRONT_STYLE = { backgroundColor: "var(--color-red)" };
