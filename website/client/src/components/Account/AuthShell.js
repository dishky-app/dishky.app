import React from "react";
import PageBackdrop from "../ReactBits/PageBackdrop.js";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import BrandLockup from "../Brand/Brand.js";
import { fadeUp, staggerChildren } from "../../animations/variants.js";

/**
 * Shared frame for sign in / sign up / reset password: a brand panel on the
 * left (desktop) and the form on the right. `side` = { eyebrow, heading, points[] }.
 */
export default function AuthShell({ title, intro, side, children, footer }) {
  return (
    <div
      className="relative isolate min-h-screen-safe bg-beige text-ink"
      style={{ paddingTop: "calc(var(--header-clearance) + clamp(8px, 2vw, 24px))", paddingBottom: "var(--section-space)" }}
    >
      <PageBackdrop tone="light" />
      <div className="container-dishky">
        <div className="grid overflow-hidden rounded-[32px] border border-ink/10 bg-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6.5fr)]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-cream lg:flex xl:p-14">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-neutral-500/30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-neutral-500/15 blur-3xl" />
            <div className="relative">
              <BrandLockup dark markClassName="h-9" wordmarkClassName="h-6" />
            </div>
            <div className="relative my-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amberLight">{side.eyebrow}</p>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">{side.heading}</h2>
              <ul className="mt-8 space-y-4">
                {side.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-cream/80">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber text-ink">
                      <Check size={14} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-[0.95rem] leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="relative text-sm text-cream/45">Built for restaurants of every size.</p>
          </aside>

          <section className="dk-auto-h p-6 sm:p-10 xl:p-14">
            <motion.div variants={staggerChildren(0.08)} initial="hidden" animate="visible" className="max-w-xl">
              <motion.h1 variants={fadeUp} className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</motion.h1>
              {intro && <motion.p variants={fadeUp} className="mt-3 text-ink/60">{intro}</motion.p>}
            </motion.div>
            <div className="mt-8 max-w-xl">{children}</div>
            {footer && <div className="mt-8 max-w-xl border-t border-ink/10 pt-6 text-sm text-ink/60">{footer}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Small numbered heading that splits a long form into sections. */
export function FormSection({ n, title, children }) {
  return (
    <fieldset className="space-y-4 border-0 p-0">
      <legend className="mb-1 flex items-center gap-3 font-display text-base font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs text-white">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
