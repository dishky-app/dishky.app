import React from "react";
import { motion } from "framer-motion";
import { EASE } from "../../animations/variants.js";

/** Three short highlights, each a pill with an icon. Pops in one after another. */
export default function Chips({ items, dark = false }) {
  return (
    <ul className="flex flex-wrap gap-2.5">
      {items.map(([Icon, text], i) => (
        <motion.li
          key={text}
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.1 }}
          whileHover={{ y: -3 }}
          className={`inline-flex items-center gap-2 rounded-full py-2 pl-2 pr-4 text-sm font-semibold ${dark ? "bg-cream/10 text-cream" : "bg-ink/[0.06] text-ink"}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-white"><Icon size={14} /></span>
          {text}
        </motion.li>
      ))}
    </ul>
  );
}
