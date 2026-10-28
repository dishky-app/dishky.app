import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ModuleCard from "../components/ui/ModuleCard.js";
import Reveal from "../components/ui/Reveal.js";
import { modules } from "../data/modules.js";
import { fadeUp, staggerChildren } from "../animations/variants.js";

const CATS = {
  All: null,
  Grow: ["promotions", "events", "guests"],
  "Run the day": ["kitchen-display", "orders", "menu", "inventory", "service", "bookings", "payments"],
  Team: ["staff", "roles", "workspace"],
  Scale: ["branches", "analytics"],
};

/** Every module as a photo tile, filterable. Also serves /platform and /features. */
export default function Modules() {
  const [cat, setCat] = useState("All");
  const list = CATS[cat] ? modules.filter((m) => CATS[cat].includes(m.slug)) : modules;
  return (
    <div className="bg-cream" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
      <div className="container-dishky">
        <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible">
          <motion.h1 variants={fadeUp} className="heading-xl max-w-3xl">EVERY MODULE. <span className="text-amber">ONE PLATFORM.</span></motion.h1>
          <motion.p variants={fadeUp} className="text-lead mt-5 max-w-md text-ink/60">Pick one to try it.</motion.p>
        </motion.div>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {Object.keys(CATS).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} style={{ minHeight: 42 }} className={`rounded-full px-5 text-sm font-bold transition ${cat === c ? "bg-ink text-cream" : "bg-ink/[0.06] text-ink/60 hover:bg-ink/10"}`}>{c}</button>
          ))}
        </div>
        <motion.div layout className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((m, i) => (
              <motion.div key={m.slug} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4 }}>
                <ModuleCard m={m} index={i} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        <Reveal className="cta-row mt-12"><Link to="/book-demo" className="btn-primary group">Book a Demo <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link></Reveal>
      </div>
    </div>
  );
}
