import { EASE } from "./variants.js";

// Page-level transition used when routing between top-level pages.
export const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.4, ease: EASE } },
};

// Shared viewport settings for scroll-triggered reveals so every section
// animates in at a consistent scroll position.
export const viewportOnce = { once: true, amount: 0.25 };
export const viewportRepeat = { once: false, amount: 0.3 };
