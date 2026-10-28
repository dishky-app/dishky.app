import { getLenis } from "../hooks/useScrollAnimation.js";
import { ScrollTrigger } from "../animations/gsapSetup.js";

/** Jump (no animation) to the top, through Lenis if it is running. */
export function jumpToTop() {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Glide to the top (same-page navigation, e.g. clicking the logo on Home). */
export function glideToTop() {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(0, { duration: 1.1, force: true });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Scroll to  #hash  if that element exists; otherwise go to the top. */
export function scrollToHashOrTop(hash, { smooth = false } = {}) {
  const id = hash ? decodeURIComponent(hash.replace(/^#/, "")) : "";
  const el = id ? document.getElementById(id) : null;
  if (!el) return smooth ? glideToTop() : jumpToTop();

  const lenis = getLenis();
  if (lenis) lenis.scrollTo(el, { offset: -110, immediate: !smooth, force: true });
  else el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

/** Re-measure pinned / scrubbed sections once the new page has laid out. */
export function refreshTriggersSoon() {
  requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
}
