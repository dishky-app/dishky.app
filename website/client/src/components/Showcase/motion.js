// One motion language for every showcase component: same easing, distances,
// durations and stagger, so the page moves as a single system.
export const MOTION = {
  ease: [0.22, 1, 0.36, 1],
  dur: 0.8,
  durFast: 0.45,
  dist: 40,
  distSmall: 22,
  stagger: 0.08,
};
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
