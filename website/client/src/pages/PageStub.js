import React, { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import ParallaxImage from "../components/ParallaxImage/ParallaxImage.js";
import { Photo, Tilt } from "../components/ui/kit.js";
import { gsap } from "../animations/gsapSetup.js";
import useReducedMotion from "../hooks/useReducedMotion.js";

/**
 * Shared layout for the content pages (Solutions, About, Resources). It uses the landing page's
 * own moves: a parallax photo hero with a word-by-word title, a ticker, tilting photo cards that
 * rise as you scroll, then any extra landing sections passed as children.
 * cards: [{ title, text?, img?, art? }] (plain strings work too)
 */
export default function PageStub({ title, description, eyebrow, photo, art = "platform", sections = [], children }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const cards = sections.map((s) => (typeof s === "string" ? { title: s } : s));
  const words = title.split(" ");
  const reps = Math.max(1, Math.ceil(8 / Math.max(1, cards.length)));
  const base = Array.from({ length: reps }).flatMap(() => cards.map((c) => c.title));
  const ticker = base.concat(base);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(el.querySelectorAll("[data-stub-w]"), { yPercent: 115, rotate: 3 }, { yPercent: 0, rotate: 0, stagger: 0.07, duration: 0.9, ease: "power4.out", delay: 0.15 });
      gsap.fromTo(el.querySelectorAll("[data-stub-fade]"), { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: "power3.out", delay: 0.5 });
      gsap.fromTo(el.querySelectorAll("[data-stub-card]"), { y: 70, opacity: 0, rotate: (i) => (i % 2 ? 3 : -3) }, { y: 0, opacity: 1, rotate: 0, stagger: 0.1, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: el.querySelector("[data-stub-grid]"), start: "top 85%", once: true } });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div ref={ref}>
      <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingTop: "calc(var(--header-clearance) + clamp(32px, 7vw, 88px))", paddingBottom: "var(--section-space)" }}>
        {photo && <ParallaxImage src={photo} art={art} className="absolute inset-0 opacity-50" strength={40} />}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/75 to-ink" />
        <div className="glow -right-24 top-0 h-[420px] w-[420px] bg-amber/30" />
        <div className="container-dishky relative">
          {eyebrow && <p data-stub-fade className="mb-4 text-xs font-extrabold uppercase tracking-[0.25em] text-amber">{eyebrow}</p>}
          <h1 className="heading-hero max-w-4xl" aria-label={title}>
            {words.map((w, i) => (
              <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <span data-stub-w className="inline-block">{w}&nbsp;</span>
              </span>
            ))}
          </h1>
          <p data-stub-fade className="text-lead mt-5 max-w-2xl text-cream/70">{description}</p>
          <div data-stub-fade className="cta-row mt-8">
            <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
            <Link to="/#modules" className="btn-secondary !border-cream/25 !text-cream">Explore features</Link>
          </div>
        </div>
      </section>

      {cards.length > 0 && (
        <div className="dk-marquee relative overflow-hidden border-y border-white/10 bg-ink py-3.5" aria-label="Topics">
          <ul className="dk-marquee__track flex w-max gap-3 pr-3">
            {ticker.map((t, i) => (
              <li key={i} aria-hidden={i >= base.length ? "true" : undefined} className="whitespace-nowrap rounded-full border border-white/15 px-5 py-1.5 text-sm font-semibold text-cream/85">{t}</li>
            ))}
          </ul>
        </div>
      )}

      {cards.length > 0 && (
        <section className="overflow-x-clip bg-beige" style={{ paddingBlock: "var(--section-space-tight)" }}>
          <div className="container-dishky">
            <div data-stub-grid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
              {cards.map((c) => (
                <div key={c.title} data-stub-card>
                  <Tilt>
                    <div className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-3xl bg-ink text-cream">
                      <Photo src={c.img} art={c.art || art} className="absolute inset-0" zoom />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="relative p-5">
                        <p className="font-display text-xl font-bold">{c.title}</p>
                        {c.text && <p className="mt-1 text-sm text-cream/70">{c.text}</p>}
                      </div>
                    </div>
                  </Tilt>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {children}
    </div>
  );
}
