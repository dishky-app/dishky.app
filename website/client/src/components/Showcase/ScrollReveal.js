import React from "react";
import { motion } from "framer-motion";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import { MOTION } from "./motion.js";

/** Fade + rise (or slide) into place the first time it scrolls into view. */
export default function ScrollReveal({ children, delay = 0, y = MOTION.dist, x = 0, className = "", as = "div" }) {
  const reduced = useReducedMotion();
  const Tag = motion[as] || motion.div;
  if (reduced) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: MOTION.dur, delay, ease: MOTION.ease }}
    >
      {children}
    </Tag>
  );
}
