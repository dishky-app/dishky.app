import React, { useMemo, useState } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { modules, categories } from "../data/modules.js";
import { CountUp } from "../components/ui/kit.js";
import Breadcrumbs from "../components/ui/Breadcrumbs.js";

const tabs = [{ id: "all", label: "All" }, ...categories];

/** Features: a live module atlas. Search, filter by area, and every tile is a doorway. */
export default function Platform() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const catOf = useMemo(() => Object.fromEntries(categories.flatMap((c) => c.slugs.map((s) => [s, c.id]))), []);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return modules.filter((m) => (cat === "all" || catOf[m.slug] === cat) && (!t || `${m.name} ${m.short} ${m.features.map((f) => f.title).join(" ")}`.toLowerCase().includes(t)));
  }, [q, cat, catOf]);

  return (
    <div className="relative isolate min-h-screen-safe overflow-x-clip bg-white" style={{ paddingTop: "calc(var(--header-clearance) + clamp(20px, 5vw, 56px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="light" />
      <div className="container-dishky">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Features" }]} />

        <div className="mt-6 grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">Module atlas</p>
            <h1 className="mt-3 font-display font-extrabold leading-[0.9] tracking-tight text-ink" style={{ fontSize: "clamp(3.5rem, 12vw, 9rem)" }}>
              <CountUp to={modules.length} /> <span className="text-amber">modules.</span>
            </h1>
            <p className="text-lead mt-4 max-w-md text-ink/60">One platform, built from parts you can switch on one at a time. Find the one you need.</p>
          </div>
          <label className="relative block">
            <span className="sr-only">Search modules</span>
            <Search size={20} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              value={q}
              maxLength={100} onChange={(e) => setQ(e.target.value)}
              placeholder="Try “kitchen”, “loyalty” or “bookings”"
              className="w-full rounded-full border border-ink/10 bg-white py-4 pl-14 pr-6 text-base shadow-[0_20px_50px_-25px_rgba(0,0,0,0.35)] outline-none transition-shadow focus:shadow-[0_20px_60px_-20px_rgba(243,55,22,0.45)]"
            />
          </label>
        </div>

        <div role="tablist" aria-label="Areas" className="mt-8 flex gap-2 overflow-x-auto pb-2 md:flex-wrap">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={cat === t.id} onClick={() => setCat(t.id)} className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors ${cat === t.id ? "bg-ink text-white" : "bg-white text-ink/70 hover:text-ink"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <motion.div layout className="mt-6 grid auto-rows-[minmax(12rem,auto)] gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
          <AnimatePresence mode="popLayout">
            {list.map((m, i) => {
              const big = i % 7 === 0 && !q;
              return (
                <motion.div key={m.slug} layout initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.03 }} className={big ? "sm:col-span-2" : ""}>
                  <Link to={m.path} className="group relative flex h-full min-h-[12rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-ink/[0.07] bg-white p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl md:p-6">
                    <span aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.14] transition-all duration-700 group-hover:scale-[2.2] group-hover:opacity-[0.22]" style={{ background: m.color }} />
                    <div className="relative flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" style={{ background: m.color }}><m.icon size={22} /></span>
                      <ArrowUpRight size={20} className="text-ink/25 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber" />
                    </div>
                    <div className="relative mt-6">
                      <p className="font-display text-lg font-bold leading-tight text-ink md:text-xl">{m.name}</p>
                      <p className="mt-1 text-sm text-ink/60">{m.short}</p>
                      <div className="mt-3 flex max-h-0 flex-wrap gap-1.5 overflow-hidden opacity-0 transition-all duration-500 group-hover:max-h-24 group-hover:opacity-100">
                        {m.features.slice(0, 4).map((f) => <span key={f.title} className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink/70">{f.title}</span>)}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {list.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-ink/20 p-10 text-center">
            <p className="font-display text-xl font-bold">Nothing matches “{q}”.</p>
            <p className="mt-1 text-ink/60">Try a simpler word, or ask us what you need.</p>
            <Link to="/contact" className="btn-secondary mt-5 inline-flex">Talk to our team</Link>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-ink p-6 text-cream md:p-10">
          <div>
            <p className="font-display text-2xl font-extrabold md:text-3xl">Not sure where to start?</p>
            <p className="mt-1 text-cream/60">We will set up the modules that fit your restaurant.</p>
          </div>
          <div className="cta-row">
            <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
            <Link to="/pricing" className="btn-secondary !border-cream/25 !text-cream">View Plans</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
