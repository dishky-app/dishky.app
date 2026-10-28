import React from "react";
import { motion } from "framer-motion";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { MOTION } from "./motion.js";

/** Clip-path reveal with a slow settle: the picture opens like a window. */
export default function ImageReveal({ children, className = "", from = "inset(12% 8% 12% 8% round 2rem)" }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ clipPath: from, scale: 1.06 }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 2rem)", scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1.1, ease: MOTION.ease }}
    >
      {children}
    </motion.div>
  );
}
