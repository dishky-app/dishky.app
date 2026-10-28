/**
 * Shared scroll lock.
 *
 * Setting `overflow: hidden` on <html> is NOT enough on this site: Lenis
 * (smooth scroll) listens to wheel events itself and keeps scrolling the page
 * regardless of CSS overflow. So locking needs two parts:
 *   1. the CSS overflow lock (stops native touch/keyboard scroll), and
 *   2. pausing Lenis (stops its wheel-driven scroll).
 *
 * Multiple things may want to lock at once (mobile menu, a future modal), so
 * this is reference-counted: scroll only resumes when the LAST lock releases.
 */
let lenisInstance = null;
let locks = 0;
let saved = null;

export function registerLenis(instance) {
  lenisInstance = instance;
  // If a lock was taken before Lenis finished initialising, honour it.
  if (instance && locks > 0) instance.stop();
}

export function lockScroll() {
  locks += 1;
  if (locks > 1) return;

  const html = document.documentElement;
  const body = document.body;
  saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPad: body.style.paddingRight,
  };
  const scrollbar = window.innerWidth - html.clientWidth;
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  lenisInstance?.stop();
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;

  const html = document.documentElement;
  const body = document.body;
  if (saved) {
    html.style.overflow = saved.htmlOverflow;
    body.style.overflow = saved.bodyOverflow;
    body.style.paddingRight = saved.bodyPad;
    saved = null;
  }
  lenisInstance?.start();
}
