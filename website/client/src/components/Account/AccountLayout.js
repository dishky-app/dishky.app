import React from "react";
import { motion } from "framer-motion";
import { fadeUp, staggerChildren } from "../../animations/variants.js";
import PageBackdrop from "../ReactBits/PageBackdrop.js";
import { AuthAside } from "../ui/HeroFacts.js";

// Shared frame for the sign-up / sign-in / account pages.
// dark = the full-bleed black style used by Book a Demo; otherwise light.
export default function AccountLayout({ title, intro, dark = false, wide = false, children }) {
  return (
    <div
      data-nav-theme={dark ? "dark" : undefined}
      className={`hero-min relative isolate ${dark ? "bg-ink text-cream" : "bg-beige text-ink"}`}
      style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 56px))", paddingBottom: "var(--section-space)" }}
    >
      <PageBackdrop tone={dark ? "dark" : "light"} />
      <div className={`container-dishky ${wide ? "" : "mx-auto max-w-xl lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:gap-16 xl:gap-24"}`}>
        <div className="min-w-0">
        <motion.div variants={staggerChildren(0.08)} initial="hidden" animate="visible">
          <motion.h1 variants={fadeUp} className="heading-lg">{title}</motion.h1>
          {intro && (
            <motion.p variants={fadeUp} className={`text-lead mt-4 max-w-lg ${dark ? "text-cream/60" : "text-ink/60"}`}>
              {intro}
            </motion.p>
          )}
        </motion.div>
        <div className="mt-8 md:mt-10">{children}</div>
        </div>
        {!wide && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.35 }} className="min-w-0">
            <AuthAside dark={dark} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function Field({ id, label, hint, error, dark = false, children }) {
  return (
    <div className="field">
      <label htmlFor={id} className={dark ? "text-cream/80" : undefined}>{label}</label>
      {children}
      {hint && !error && <p className={`text-xs ${dark ? "text-cream/50" : "text-ink/50"}`}>{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "bg-neutral-100 text-ink border-black/10",
    ok: "bg-red-50 text-amber border-red-200",
    warn: "bg-red-50 text-amber border-red-200",
    error: "bg-red-50 text-amber border-red-200",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
