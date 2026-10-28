import React, { useLayoutEffect, useRef } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { gsap } from "../animations/gsapSetup.js";
import useReducedMotion from "../hooks/useReducedMotion.js";
import { CountUp } from "../components/ui/kit.js";
import { modules } from "../data/modules.js";

const manifesto = "Dishky was built restaurant-first. Connected operations, QR ordering, centralized management, role-based access, multi-branch readiness, guest management, and kitchen and service workflows. All under one subscription.";
const principles = [
  ["One system, not ten.", "Orders, kitchen, stock, staff and payments should share one truth, so nobody retypes anything."],
  ["Built for the floor.", "Every screen is made for someone standing up, mid-service, with seconds to spare."],
  ["Guests first, owners always.", "A simple experience for the guest, and the full picture for the person who runs the place."],
  ["Grow without re-platforming.", "Add a module, a branch or a role when you need it. Nothing has to be rebuilt."],
];

/** About: an editorial page. A manifesto that fills in as you read, then principles as large rows. */
export default function About() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const words = manifesto.split(" ");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelectorAll("[data-mw]"), { opacity: 0.14 }, { opacity: 1, stagger: 0.06, ease: "none", scrollTrigger: { trigger: el.querySelector("[data-manifesto]"), start: "top 75%", end: "bottom 45%", scrub: true } });
      el.querySelectorAll("[data-row]").forEach((row) => {
        gsap.fromTo(row.querySelector("[data-line]"), { scaleX: 0 }, { scaleX: 1, ease: "power3.out", duration: 1.1, scrollTrigger: { trigger: row, start: "top 85%", once: true } });
        gsap.fromTo(row.querySelectorAll("[data-rin]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: row, start: "top 85%", once: true } });
      });
      gsap.fromTo(el.querySelector("[data-big]"), { xPercent: 8 }, { xPercent: -30, ease: "none", scrollTrigger: { trigger: el.querySelector("[data-big]"), start: "top bottom", end: "bottom top", scrub: true } });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div ref={ref} className="overflow-x-clip bg-white text-ink">
      <section className="hero-min relative isolate" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 72px))", paddingBottom: "var(--section-space-tight)" }}>
        <PageBackdrop tone="light" />
        <div className="container-dishky">
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber">About Dishky</p>
          <p data-manifesto className="mt-6 max-w-5xl font-display font-extrabold leading-[1.08] tracking-tight" style={{ fontSize: "clamp(1.9rem, 5.2vw, 4.25rem)" }}>
            {words.map((w, i) => <span key={i} data-mw className="inline-block pr-[0.28em]">{w}</span>)}
          </p>
        </div>
      </section>

      <section className="border-y border-ink/10 bg-white" style={{ paddingBlock: "var(--section-space-tight)" }}>
        <div className="container-dishky grid grid-cols-3 gap-4 text-center">
          {[[modules.length, "", "Modules"], [2, "", "Panels: guest and admin"], [1, "", "Subscription"]].map(([n, s, l]) => (
            <div key={l}>
              <p className="font-display font-extrabold leading-none text-amber" style={{ fontSize: "clamp(2.5rem, 9vw, 6rem)" }}><CountUp to={n} suffix={s} /></p>
              <p className="mt-2 text-xs font-semibold text-ink/60 md:text-sm">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <h2 className="heading-lg max-w-2xl">What we believe.</h2>
          <div className="mt-10">
            {principles.map(([t, d], i) => (
              <div key={t} data-row className="relative grid gap-3 py-8 md:grid-cols-[6rem_1.1fr_1fr] md:gap-8 md:py-10">
                <span aria-hidden="true" data-line className="absolute left-0 top-0 h-px w-full origin-left bg-ink/25" />
                <p data-rin className="font-display text-sm font-extrabold tabular-nums text-amber">{String(i + 1).padStart(2, "0")}</p>
                <h3 data-rin className="font-display text-2xl font-extrabold leading-tight md:text-4xl">{t}</h3>
                <p data-rin className="text-ink/65 md:pt-2">{d}</p>
              </div>
            ))}
            <div className="h-px w-full bg-ink/25" />
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-ink py-10 text-cream" aria-hidden="true">
        <p data-big className="whitespace-nowrap font-display font-extrabold uppercase text-white/10" style={{ fontSize: "clamp(5rem, 18vw, 15rem)" }}>Restaurant-first · Restaurant-first · Restaurant-first</p>
      </section>

      <section style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky grid gap-4 md:grid-cols-3">
          {[["Our Story", "How a restaurant-first platform came together.", "/contact"], ["Careers", "Help build the platform restaurants run on.", "/contact"], ["Partners", "Work with us to reach more kitchens.", "/contact"]].map(([t, d, to]) => (
            <Link key={t} to={to} className="group flex min-h-[10rem] flex-col justify-between rounded-3xl border border-ink/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber hover:shadow-xl">
              <p className="font-display text-2xl font-extrabold">{t}</p>
              <div className="flex items-end justify-between gap-3"><p className="text-sm text-ink/60">{d}</p><ArrowRight className="shrink-0 text-amber transition-transform duration-300 group-hover:translate-x-1" /></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
