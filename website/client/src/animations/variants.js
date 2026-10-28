// Shared Framer Motion variants, reused across the site so every section
// animates with a consistent feel. Easing follows the project's chosen
// cinematic curve.
export const EASE = [0.22, 1, 0.36, 1];

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: EASE } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export const fadeDown = {
  hidden: { opacity: 0, y: -40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export const slideLeft = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.9, ease: EASE } },
};

export const slideRight = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.9, ease: EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE } },
};

export const textReveal = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

export const imageReveal = {
  hidden: { opacity: 0, scale: 1.08 },
  visible: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: EASE } },
};

export const staggerChildren = (stagger = 0.12, delayChildren = 0) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
});

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -6,
    scale: 1.01,
    transition: { duration: 0.4, ease: EASE },
  },
};

export const dashboardTransition = {
  hidden: { opacity: 0, x: 50, rotateY: -6 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { duration: 1, ease: EASE },
  },
};
