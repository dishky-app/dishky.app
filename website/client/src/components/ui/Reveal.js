import React from "react";
import { motion } from "framer-motion";
import { EASE } from "../../animations/variants.js";

/** Scroll-in wrapper. dir: up | left | right | scale */
export default function Reveal({ children, dir = "up", delay = 0, className = "" }) {
  const from = {
    up: { opacity: 0, y: 40 },
    left: { opacity: 0, x: -60 },
    right: { opacity: 0, x: 60 },
    scale: { opacity: 0, scale: 0.92 },
  }[dir];
  return (
    <motion.div
      initial={from}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
