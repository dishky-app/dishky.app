import React, { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Photo } from "../ui/kit.js";
import { demoFor } from "../demos/index.js";
import { gsap, ScrollTrigger } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import FeatureCarousel from "./FeatureCarousel.js";

function Pinned({ items, title }) {
  const sec = useRef(null);
  const track = useRef(null);
  const bar = useRef(null);
  const st = useRef(null);
  const [idx, setIdx] = useState(0);
  const n = items.length;

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const dist = () => Math.max(0, track.current.scrollWidth - window.innerWidth);
      const tween = gsap.to(track.current, {
        x: () => -dist(),
        ease: "none",
        scrollTrigger: {
          trigger: sec.current,
          start: "top top",
          end: () => "+=" + dist(),
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
            setIdx(Math.min(n - 1, Math.round(self.progress * (n - 1))));
          },
        },
      });
      st.current = tween.scrollTrigger;
    }, sec);
    return () => ctx.revert();
  }, [n]);

  // Tabbing to a panel that is off-screen scrolls the page to bring it in.
  const focusPanel = (i) => {
    const s = st.current || ScrollTrigger.getAll().find((t) => t.trigger === sec.current);
    if (!s) return;
    window.scrollTo({ top: s.start + (i / Math.max(1, n - 1)) * (s.end - s.start) });
  };

  return (
    <section ref={sec} className="relative flex h-screen min-h-[600px] flex-col justify-center overflow-hidden pt-20 bg-ink text-cream" data-nav-theme="dark">
      <div className="container-dishky mb-6 flex items-end justify-between gap-6">
        <h2 className="font-display text-3xl font-extrabold leading-[1.05] md:text-5xl" style={{ whiteSpace: "pre-line" }}>{title}</h2>
        <div className="hidden w-64 shrink-0 md:block">
          <p className="mb-2 text-right font-display text-sm font-bold tabular-nums">{String(idx + 1).padStart(2, "0")}<span className="opacity-40"> / {String(n).padStart(2, "0")}</span></p>
          <div className="h-[3px] overflow-hidden rounded-full bg-white/20"><div ref={bar} className="h-full origin-left bg-amber" style={{ transform: "scaleX(0)" }} /></div>
        </div>
      </div>
      <div ref={track} className="flex w-max gap-6 pl-[max(1.5rem,calc((100vw-80rem)/2))] pr-24 will-change-transform">
        {items.map((it, i) => {
          const near = Math.abs(i - idx) <= 1;
          return (
            <article key={it.id} className="group relative h-[min(62vh,36rem)] w-[min(74vw,66rem)] shrink-0 overflow-hidden rounded-[2rem] bg-black">
              <Photo src={it.photo} art={it.art} className="absolute inset-0" zoom />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
              <div className="absolute inset-y-0 left-0 flex w-[46%] flex-col justify-end p-10">
                <p className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-cream/70">
                  <span className="font-display text-sm text-amber">{String(i + 1).padStart(2, "0")}</span>
                  <span className="h-px w-8 bg-cream/40" aria-hidden="true" />
                  {it.kicker}
                </p>
                <h3 className="font-display text-4xl font-extrabold leading-tight">{it.title}</h3>
                {it.text && <p className="mt-3 max-w-xs text-sm text-cream/75">{it.text}</p>}
                <Link to={it.to} onFocus={() => focusPanel(i)} className="group/cta mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white">
                  Explore feature <ArrowRight size={16} className="transition-transform duration-300 group-hover/cta:translate-x-1" />
                </Link>
              </div>
              {it.demo && demoFor[it.demo] && near && (
                <div className="absolute inset-y-8 right-8 w-[46%] overflow-hidden rounded-2xl shadow-2xl">{demoFor[it.demo]()}</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Product tour. Wide screens with a mouse: the page pins and the panels glide
 * sideways as you scroll down (always ends, never traps; Tab brings a panel
 * into view). Everywhere else it is the swipeable carousel, no scroll hijack.
 */
export default function HorizontalFeatureGallery({ items, title }) {
  const reduced = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px) and (hover: hover) and (pointer: fine) and (min-height: 600px)");
  if (reduced || !wide) {
    return (
      <section className="bg-ink py-16 text-cream md:py-24" data-nav-theme="dark">
        <div className="container-dishky mb-8">
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] md:text-5xl" style={{ whiteSpace: "pre-line" }}>{title}</h2>
        </div>
        <div className="container-dishky"><FeatureCarousel items={items.map((x) => ({ ...x, media: undefined }))} label="Product tour" dark /></div>
      </section>
    );
  }
  return <Pinned items={items} title={title} />;
}
