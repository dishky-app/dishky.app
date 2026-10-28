import React from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import useReducedMotion from "../../hooks/useReducedMotion.js";

/** Hairline reading-progress bar along the very top of the viewport (same as the MarqWon site). */
export default function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-gradient-to-r from-amber to-amberLight"
      style={{ scaleX }}
    />
  );
}
