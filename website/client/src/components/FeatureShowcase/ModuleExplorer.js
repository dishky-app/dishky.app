import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Photo, Pill, Tilt } from "../ui/kit.js";
import { artFor } from "../ui/Art.js";
import { bySlug, categories } from "../../data/modules.js";

/** Category tabs + photo tiles. Each tile opens that module's own page.
    Tap shows the one-liner on touch screens; hover does the same on desktop. */
export default function ModuleExplorer() {
  const [cat, setCat] = useState(categories[0].id);
  const [open, setOpen] = useState(null);
  const current = categories.find((c) => c.id === cat);
  const list = current.slugs.map((s) => bySlug[s]).filter(Boolean);

  return (
    <div>
      <div role="tablist" aria-label="Module categories" className="mb-8 flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:justify-center md:overflow-visible">
        {categories.map((c) => (
          <Pill key={c.id} dark={false} active={cat === c.id} onClick={() => { setCat(c.id); setOpen(null); }} className="shrink-0 whitespace-nowrap">
            {c.label}
          </Pill>
        ))}
      </div>
      <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((m) => (
            <motion.div key={m.slug} layout initial={{ opacity: 0, y: 30, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.45 }}>
              <Tilt>
                <Link
                  to={m.path}
                  onClick={(e) => {
                    // First tap on a touch screen reveals the line; second tap opens.
                    if (!window.matchMedia("(hover: hover)").matches && open !== m.slug) {
                      e.preventDefault();
                      setOpen(m.slug);
                    }
                  }}
                  className="group relative block h-60 overflow-hidden rounded-3xl md:h-72"
                >
                  <Photo src={m.photo} art={artFor[m.slug]} className="absolute inset-0" zoom />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-12">
                      <m.icon size={20} />
                    </span>
                    <p className="font-display text-xl font-extrabold">{m.name}</p>
                    <p className={`overflow-hidden text-sm text-cream/75 transition-all duration-500 group-hover:mt-1 group-hover:max-h-16 group-hover:opacity-100 ${open === m.slug ? "mt-1 max-h-16 opacity-100" : "max-h-0 opacity-0"}`}>{m.short}</p>
                  </div>
                  <ArrowRight size={18} className="absolute right-5 top-5 text-white/60 transition-all duration-500 group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              </Tilt>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
