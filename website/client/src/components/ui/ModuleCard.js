import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Img from "./Img.js";
import { moduleHref } from "../../data/modules.js";

/** Image tile for a module. Zooms the photo and lifts on hover. */
export default function ModuleCard({ m, index = 0, className = "" }) {
  const Icon = m.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <Link to={moduleHref(m)} className="group relative block aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-ink shadow-lg transition-shadow duration-500 hover:shadow-2xl">
        <Img src={m.images[0]} alt="" tone={m.tone} className="absolute inset-0" imgClassName="transition-transform duration-[900ms] ease-out group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 transition-opacity duration-500 group-hover:from-black/95" />
        <span className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" style={{ background: m.tone }}>
          <Icon size={20} />
        </span>
        <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition duration-500 group-hover:opacity-100"><ArrowUpRight size={16} /></span>
        <span className="absolute inset-x-5 bottom-5 text-white">
          <span className="block font-display text-lg font-extrabold leading-tight">{m.name}</span>
          <span className="mt-1 block max-h-0 overflow-hidden text-sm leading-snug text-white/75 opacity-0 transition-all duration-500 group-hover:max-h-16 group-hover:opacity-100 max-md:max-h-16 max-md:opacity-100">{m.short}</span>
        </span>
      </Link>
    </motion.div>
  );
}
