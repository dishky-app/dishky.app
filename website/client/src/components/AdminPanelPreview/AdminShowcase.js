import React, { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { BellRing, Boxes, CalendarDays, ShieldCheck, Wallet, GitBranch } from "lucide-react";
import { EASE } from "../../animations/variants.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import {
  OrdersView, StockView, BookingsView, TeamView, PaymentsView, BranchesView,
} from "./AdminViews.js";

const AUTOPLAY_MS = 7000;

// One entry per everyday problem. `view` is the Admin Panel screen that fixes it.
export const adminFixes = [
  {
    id: "orders",
    icon: BellRing,
    label: "Orders",
    screen: "Live Orders",
    View: OrdersView,
    problem: "Lost orders",
    fix: "One live board",
    points: ["New → preparing → ready", "Kitchen tickets, automatic", "Guests see progress"],
  },
  {
    id: "stock",
    icon: Boxes,
    label: "Stock",
    screen: "Ingredients & Stock",
    View: StockView,
    problem: "Surprise stock-outs",
    fix: "Low-stock alerts",
    points: ["Per-ingredient stock", "Early warnings", "Sold-out dishes hide"],
  },
  {
    id: "bookings",
    icon: CalendarDays,
    label: "Bookings",
    screen: "Reservations",
    View: BookingsView,
    problem: "Double bookings",
    fix: "One shared schedule",
    points: ["Reservations", "Events and catering", "Pre-bookings"],
  },
  {
    id: "team",
    icon: ShieldCheck,
    label: "Team",
    screen: "Roles & Permissions",
    View: TeamView,
    problem: "Open access",
    fix: "Roles per module",
    points: ["Super Admin to Staff", "Per-module permissions", "Change once, applies to all"],
  },
  {
    id: "payments",
    icon: Wallet,
    label: "Payments",
    screen: "Payments",
    View: PaymentsView,
    problem: "Cash that doesn't add up",
    fix: "Paid or pending, always",
    points: ["Status on every order", "Daily totals", "Pay from the phone"],
  },
  {
    id: "branches",
    icon: GitBranch,
    label: "Branches",
    screen: "Branches",
    View: BranchesView,
    problem: "Can't be everywhere",
    fix: "All branches, one login",
    points: ["Compare side by side", "Same standards everywhere", "Staff and stock per branch"],
  },
];

/**
 * Interactive "pick a problem, see the fix" showcase for restaurant owners.
 * Built for a DARK parent. Auto-advances (the active tab's progress hairline
 * ends the cycle) and pauses on hover/focus, off-screen, and for reduced
 * motion. No timers in JS: the CSS animation's `animationend` drives it.
 */
export default function AdminShowcase({ active: controlledActive, onSelect, progress } = {}) {
  // Two modes:
  //  - self-driven (default): auto-advances on a timer, click to jump.
  //  - scroll-driven: the parent controls `active` and passes a `progress`
  //    MotionValue (0 to 1 within the current problem). `onSelect` is called
  //    on tab click so the parent can scroll to that step.
  const scrollDriven = controlledActive !== undefined;
  const [inner, setInner] = useState(0);
  const active = scrollDriven ? controlledActive : inner;
  const setActive = (i) => (onSelect ? onSelect(i) : setInner(i));
  const [hold, setHold] = useState(false);
  const rootRef = useRef(null);
  const visible = useInView(rootRef, { amount: 0.35 });
  const reducedMotion = useReducedMotion();
  const item = adminFixes[active];
  const View = item.View;
  const autoplay = !reducedMotion && !scrollDriven;
  const paused = hold || !visible;

  const next = () => setInner((a) => (a + 1) % adminFixes.length);

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10"
    >
      {/* ---- Problem picker --------------------------------------------- */}
      <div data-showcase-tabs role="tablist" aria-label="Everyday restaurant problems" aria-orientation="vertical" className="min-w-0">
        {/* phones: horizontal pills */}
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" style={{ scrollbarWidth: "none" }}>
          {adminFixes.map((f, i) => {
            const Icon = f.icon;
            const on = i === active;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="admin-fix-panel"
                onClick={() => setActive(i)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  on ? "border-amber bg-amber text-ink" : "border-cream/15 text-cream/70"
                }`}
              >
                <Icon size={15} />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* desktop: stacked cards. The active one opens with a height + fade
            transition (grid-template-rows 0fr -> 1fr, so no JS measuring and
            no jump). The label never changes: only the detail opens beneath. */}
        <ul className="hidden space-y-1.5 lg:block">
          {adminFixes.map((f, i) => {
            const Icon = f.icon;
            const on = i === active;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="admin-fix-panel"
                  onClick={() => setActive(i)}
                  className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-[background-color,border-color] duration-500 ease-dishky ${
                    on ? "border-cream/20 bg-cream/[0.06]" : "border-transparent hover:bg-cream/[0.04]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-500 ease-dishky ${
                        on ? "scale-105 bg-amber text-ink" : "bg-cream/10 text-cream/70"
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className={`font-display text-sm font-bold transition-colors duration-500 ${on ? "text-cream" : "text-cream/60"}`}>
                      {f.label}
                    </span>
                  </span>

                  <span
                    aria-hidden={!on}
                    className={`grid transition-[grid-template-rows,opacity] duration-[700ms] ease-dishky ${
                      on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <span className="min-h-0 overflow-hidden">
                      <span className="block pb-2 pl-12 pt-3">
                        <span className="block font-display text-sm font-bold text-cream/45 line-through decoration-amber">{f.problem}</span>
                        <span className="mt-1 block font-display text-lg font-extrabold text-cream">→ {f.fix}</span>
                      </span>
                    </span>
                  </span>

                  {on && scrollDriven && progress && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-cream/10" aria-hidden="true">
                      <motion.span className="block h-full origin-left bg-amber" style={{ scaleX: progress }} />
                    </span>
                  )}
                  {on && autoplay && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-cream/10" aria-hidden="true">
                      <span
                        key={active}
                        onAnimationEnd={next}
                        className="dk-progress block h-full origin-left bg-amber"
                        style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* phones: problem + fix card (desktop shows these in the tab) */}
        <div className="rounded-2xl border border-cream/15 bg-cream/[0.05] p-5 lg:hidden">
          <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            <p className="font-display text-sm font-bold text-cream/45 line-through decoration-amber">{item.problem}</p>
            <p className="mt-1 font-display text-lg font-extrabold text-cream">→ {item.fix}</p>
          </motion.div>
          {autoplay && (
            <span className="mt-4 block h-[2px] bg-cream/10" aria-hidden="true">
              <span
                key={active}
                onAnimationEnd={next}
                className="dk-progress block h-full origin-left bg-amber"
                style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
              />
            </span>
          )}
        </div>
      </div>

      {/* ---- Admin Panel window ----------------------------------------- */}
      <div id="admin-fix-panel" role="tabpanel" className="min-w-0">
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-neutral-500/10 blur-3xl" aria-hidden="true" />
          <div data-showcase-window className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-cream/10 sm:rounded-3xl">
            <div className="flex items-center gap-3 border-b border-ink/[0.07] bg-ink/[0.03] px-4 py-3">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
              </span>
              <span key={item.id} className="dk-fade-in min-w-0 flex-1 truncate text-center font-display text-xs font-bold text-ink/70">
                Dishky Admin · {item.screen}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" aria-hidden="true" />
                Live
              </span>
            </div>

            <div className="grid min-h-[300px] p-4 sm:min-h-[340px] sm:p-5">
              <AnimatePresence initial={false}>
                <motion.div
                  key={item.id}
                  style={{ gridArea: "1 / 1" }}
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(4px)", transition: { duration: 0.4, ease: EASE } }}
                  transition={{ duration: 0.65, ease: EASE }}
                >
                  <View />
                </motion.div>
              </AnimatePresence>
            </div>

            <ul
              key={item.id}
              className="dk-fade-in flex min-h-[3.75rem] flex-wrap content-center gap-x-5 gap-y-1.5 border-t border-ink/[0.07] bg-ink/[0.02] px-4 py-3 sm:min-h-[3.25rem] sm:px-5"
            >
              {item.points.map((p) => (
                <li key={p} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-cream/40">Illustrative screens.</p>
      </div>
    </div>
  );
}
