import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Photo } from "../ui/kit.js";
import { demoFor } from "../demos/index.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import ScrollReveal from "./ScrollReveal.js";
import ImageReveal from "./ImageReveal.js";

/**
 * Sticky storytelling. On wide screens the step list stays put and its line
 * fills as you scroll; each chapter card comes into focus when it reaches the
 * middle of the screen. On small screens the chapters simply stack.
 * steps: [{ id, label, pain, fix, to, art, demo }]
 */
export default function StickyFeatureStory({ title, steps, cta }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number(e.target.dataset.i));
        });
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  const jump = (i) => refs.current[i]?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  const pct = ((active + 1) / steps.length) * 100;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <ScrollReveal>
          <h3 className="font-display text-3xl font-extrabold leading-[1.05] md:text-4xl">{title}</h3>
        </ScrollReveal>
        <ol className="relative mt-8 hidden lg:block" aria-label="Chapters">
          <span className="absolute bottom-3 left-[15px] top-3 w-px bg-ink/15" aria-hidden="true" />
          <span className="absolute left-[15px] top-3 w-px bg-amber transition-[height] duration-700 ease-dishky" style={{ height: `calc((100% - 1.5rem) * ${pct / 100})` }} aria-hidden="true" />
          {steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(i)}
                aria-current={i === active}
                className="relative flex w-full items-center gap-4 py-3 text-left"
              >
                <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ${i <= active ? "bg-amber text-white" : "bg-cream text-ink/50 ring-1 ring-ink/15"} ${i === active ? "scale-110" : ""}`}>
                  {i + 1}
                </span>
                <span className={`font-display text-lg font-bold transition-all duration-500 ${i === active ? "translate-x-1 text-ink" : "text-ink/40"}`}>{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {cta && (
          <Link to={cta.to} className="btn-dark group mt-8 hidden w-fit lg:inline-flex">
            {cta.label}
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      <ol className="space-y-6 lg:space-y-0">
        {steps.map((s, i) => {
          const on = i === active;
          return (
            <li key={s.id} ref={(el) => { refs.current[i] = el; }} data-i={i} className="flex items-center lg:min-h-[78vh]">
              <ImageReveal className="w-full">
                <article
                  className={`relative h-[31rem] w-full overflow-hidden rounded-[2rem] bg-ink text-cream transition-[transform,opacity] duration-700 ease-dishky lg:h-[35rem] ${on ? "" : "lg:scale-[0.96] lg:opacity-45"}`}
                >
                  <Photo art={s.art} src={s.photo} className="absolute inset-0 opacity-70" zoom />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/30" />
                  <div className="relative z-10 flex items-start justify-between gap-4 p-6 md:p-8">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cream/65">
                        <span className="mr-2 font-display text-sm text-amber">{String(i + 1).padStart(2, "0")}</span>{s.label}
                      </p>
                      <p className="font-display text-base font-bold text-cream/50 line-through decoration-amber decoration-2">{s.pain}</p>
                      <h4 className="font-display text-2xl font-extrabold md:text-3xl">{s.fix}</h4>
                    </div>
                    <Link to={s.to} aria-label={`Explore ${s.label}`} className="group/c flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber text-white">
                      <ArrowRight size={20} className="transition-transform duration-300 group-hover/c:translate-x-1" />
                    </Link>
                  </div>
                  {demoFor[s.demo] && (
                    <motion.div
                      className="absolute inset-x-4 bottom-0 top-[9.5rem] overflow-hidden rounded-t-2xl shadow-2xl md:inset-x-8"
                      animate={{ y: on || reduced ? 0 : 14 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {demoFor[s.demo]()}
                    </motion.div>
                  )}
                </article>
              </ImageReveal>
            </li>
          );
        })}
      </ol>
      {cta && (
        <Link to={cta.to} className="btn-dark group w-fit lg:hidden">
          {cta.label}
          <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
