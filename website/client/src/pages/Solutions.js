import React, { useState } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Photo } from "../components/ui/kit.js";
import { bySlug } from "../data/modules.js";
import { images } from "../assets/images/imageUrls.js";

const types = [
  { name: "Restaurants", line: "Dine-in service from the first scan to the final bill.", img: images.restaurantInterior1, art: "platform", points: ["QR ordering at every table", "Kitchen and floor on one live board", "Stock that follows every dish"], mods: ["guest-app", "orders", "kitchen", "service", "inventory"] },
  { name: "Cafés", line: "Quick tables, regulars who come back, and a menu you can change in a minute.", img: images.cafeInterior, art: "city-coimbatore", points: ["Rewards that bring guests back", "Menu and price edits in seconds", "Favourites and one-tap reorders"], mods: ["menu", "loyalty", "guest-app", "offers", "analytics"] },
  { name: "Bakeries", line: "Counters, pre-orders and what is left on the shelf.", img: images.foodSpread, art: "p-stock", points: ["Pre-bookings for pick-up", "Stock levels and low alerts", "Combos for gift boxes"], mods: ["prebookings", "inventory", "menu", "payments", "catering"] },
  { name: "QSR", line: "Speed matters. Orders go straight to a kitchen that keeps pace.", img: images.pizza, art: "food-pizza", points: ["Orders appear the second they are placed", "Timers that flag slow tickets", "Peak-hour reports for staffing"], mods: ["orders", "kitchen", "order-tracking", "analytics", "payments"] },
  { name: "Fine Dining", line: "Reservations, occasions and a service that never drops a beat.", img: images.dining, art: "night", points: ["Slot grid for every table", "Celebrations and special requests", "Routines for service and grooming"], mods: ["reservations", "celebrations", "service-management", "guests", "events"] },
  { name: "Restaurant Chains", line: "Every branch under one account, with the right access for each team.", img: images.restaurantInterior2, art: "p-branches", points: ["One login, many venues", "Compare branches side by side", "Roles and audit trail for every manager"], mods: ["branches", "roles", "analytics", "staff", "back-office"] },
];

/** Solutions: pick your kind of restaurant and the page reshapes around it. */
export default function Solutions() {
  const [i, setI] = useState(0);
  const t = types[i];
  return (
    <div className="relative isolate min-h-screen-safe bg-ink text-cream" data-nav-theme="dark" style={{ paddingTop: "calc(var(--header-clearance) + clamp(20px, 5vw, 56px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="dark" />
      <div className="container-dishky">
        <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">Solutions</p>
        <h1 className="heading-lg mt-3 max-w-3xl">What kind of restaurant do you run?</h1>
        <p className="text-lead mt-3 max-w-xl text-cream/60">Choose one. We will show what Dishky does for it.</p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-12">
          {/* Selector */}
          <div role="tablist" aria-label="Restaurant types" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
            {types.map((x, k) => (
              <button key={x.name} role="tab" aria-selected={k === i} onClick={() => setI(k)} onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setI(k)} className={`group relative shrink-0 whitespace-nowrap rounded-full border px-5 py-2.5 text-left font-display font-bold transition-all lg:rounded-none lg:border-0 lg:border-b lg:border-white/10 lg:bg-transparent lg:px-0 lg:py-5 lg:text-[clamp(1.6rem,3.2vw,2.75rem)] ${k === i ? "border-amber bg-amber text-white lg:text-white" : "border-white/15 text-cream/45 hover:text-cream lg:hover:pl-3"}`}>
                <span className="mr-3 hidden font-display text-xs font-normal tabular-nums text-amber lg:inline">{String(k + 1).padStart(2, "0")}</span>
                {x.name}
                <span aria-hidden="true" className={`absolute bottom-0 left-0 hidden h-px bg-amber transition-all duration-500 lg:block ${k === i ? "w-full" : "w-0"}`} />
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <AnimatePresence mode="wait">
              <motion.div key={t.name} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
                <div className="relative h-56 overflow-hidden rounded-[2rem] sm:h-72 lg:h-80">
                  <Photo src={t.img} art={t.art} className="absolute inset-0" zoom />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <p className="absolute bottom-5 left-6 right-6 font-display text-2xl font-extrabold md:text-3xl">{t.line}</p>
                </div>
                <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                  {t.points.map((p) => (
                    <li key={p} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold">
                      <Check size={16} className="mb-2 text-amber" /> {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-cream/45">Modules we would start with</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.mods.map((s) => bySlug[s] && (
                    <Link key={s} to={bySlug[s].path} className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-cream/85 transition-colors hover:border-amber hover:text-amber">
                      {React.createElement(bySlug[s].icon, { size: 15 })} {bySlug[s].name}
                    </Link>
                  ))}
                </div>
                <div className="cta-row mt-8">
                  <Link to="/book-demo" className="btn-primary">Book a demo for {t.name.toLowerCase()} <ArrowRight size={18} /></Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
