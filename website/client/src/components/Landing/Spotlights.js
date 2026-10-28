import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { spotlight, others } from "../../data/modules.js";
import { Demo } from "../demos/index.js";
import { Photo, Reveal, Tilt } from "../ui/kit.js";
import { ParallaxPhoto } from "../Modules/ModuleBlocks.js";
import { ResponsiveLines } from "../SectionHeading/SectionHeading.js";

/** One full section for one standout feature: big title, chips, live demo. */
export function SpotlightSection({ m, index }) {
  const dark = index % 2 === 0;
  return (
    <section
      id={`spot-${m.slug}`}
      data-spot
      data-nav-theme={dark ? "dark" : undefined}
      className={`relative overflow-hidden ${dark ? "bg-ink text-cream" : "bg-beige text-ink"}`}
      style={{ paddingBlock: "var(--section-space)" }}
    >
      {dark && <ParallaxPhoto src={m.photo} className="absolute inset-0 opacity-25" strength={60} />}
      {dark && <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/80 to-ink" />}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-6 right-4 select-none font-display text-[10rem] font-extrabold leading-none md:text-[18rem] ${dark ? "text-white/[0.04]" : "text-ink/[0.04]"}`}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="container-dishky relative">
        <div className="mb-10 grid items-end gap-6 md:mb-14 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber text-white shadow-[0_18px_40px_-10px_rgba(243,55,22,0.7)]">
              <m.icon size={26} />
            </span>
            <h2 className="heading-lg"><ResponsiveLines text={m.name} /></h2>
            {m.lacks && <p className="mt-3 font-display text-lg font-bold text-amber">{m.lacks}</p>}
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="flex flex-wrap gap-2">
              {m.features.slice(0, 5).map((f) => (
                <li key={f.title} className="group relative">
                  <span
                    tabIndex={0}
                    className={`flex cursor-default items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors duration-300 ${dark ? "border-white/15 hover:border-amber hover:bg-amber/15" : "border-ink/10 bg-white hover:border-amber"}`}
                  >
                    <f.icon size={14} className="text-amber" /> {f.title}
                  </span>
                  <span className={`pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-52 translate-y-1 rounded-xl p-3 text-xs opacity-0 shadow-xl transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 ${dark ? "bg-white text-ink" : "bg-ink text-cream"}`}>
                    {f.tip}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal y={60}>
          <Demo name={m.demo} />
        </Reveal>

        <Reveal className="mt-8">
          <Link to={m.path} className="btn-primary">
            Explore {m.name} <ArrowRight size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function Spotlights() {
  return (
    <>
      {spotlight.map((m, i) => (
        <SpotlightSection key={m.slug} m={m} index={i} />
      ))}
    </>
  );
}

/** Fixed dot rail: shows which spotlight you are on and jumps between them. */
export function SpotlightRail() {
  const [active, setActive] = useState(null);
  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-spot]"));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id.replace("spot-", ""))),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    els.forEach((el) => io.observe(el));
    const more = document.getElementById("more");
    const off = new IntersectionObserver(([e]) => e.isIntersecting && setActive(null), { rootMargin: "-45% 0px -45% 0px" });
    if (more) off.observe(more);
    return () => { io.disconnect(); off.disconnect(); };
  }, []);
  return (
    <nav aria-label="Featured modules" className={`fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 transition-opacity duration-500 lg:flex ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      {spotlight.map((m) => (
        <a key={m.slug} href={`#spot-${m.slug}`} aria-label={m.name} className="group relative flex items-center justify-end" style={{ minHeight: 0 }}>
          <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">{m.name}</span>
          <span className={`block rounded-full border border-amber transition-all duration-300 ${active === m.slug ? "h-4 w-4 bg-amber" : "h-2.5 w-2.5 bg-transparent"}`} />
        </a>
      ))}
    </nav>
  );
}

/** Everything else: photo tiles with hover reveal. */
export function OtherFeatures() {
  return (
    <section id="more" className="bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <Reveal className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="heading-lg">And everything else <span className="text-amber">your restaurant runs on.</span></h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((m, i) => (
            <Reveal key={m.slug} delay={(i % 3) * 0.08}>
              <Tilt>
                <Link to={m.path} className="group relative block h-72 overflow-hidden rounded-3xl">
                  <Photo src={m.photo} className="absolute inset-0" zoom />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-colors duration-500 group-hover:from-black/95" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-12">
                      <m.icon size={20} />
                    </span>
                    <p className="font-display text-xl font-extrabold">{m.name}</p>
                    <p className="max-h-0 overflow-hidden text-sm text-cream/75 opacity-0 transition-all duration-500 group-hover:mt-1 group-hover:max-h-16 group-hover:opacity-100">{m.short}</p>
                  </div>
                </Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 text-center">
          <Link to="/platform" className="btn-dark">See all modules <ArrowRight size={18} /></Link>
        </Reveal>
      </div>
    </section>
  );
}
