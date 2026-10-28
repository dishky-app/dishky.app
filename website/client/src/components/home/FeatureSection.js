import React from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Img from "../ui/Img.js";
import Chips from "../ui/Chips.js";
import Reveal from "../ui/Reveal.js";
import { Widget } from "../interactive/index.js";
import { moduleHref } from "../../data/modules.js";

/**
 * One standout feature gets one full section: big headline, three short
 * highlights, a working demo you can play with, and a photo that drifts as you
 * scroll. `flip` swaps the sides, `dark` swaps the surface.
 */
export default function FeatureSection({ m, n, dark = false, flip = false }) {
  const s = m.sections[0];
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const rot = useTransform(scrollYProgress, [0, 0.5, 1], [-2, 0, 2]);
  const Icon = m.icon;
  return (
    <section ref={ref} id={m.slug} data-nav-theme={dark ? "dark" : undefined} className={`relative overflow-hidden ${dark ? "bg-ink text-cream" : "bg-cream text-ink"}`} style={{ paddingBlock: "var(--section-space)" }}>
      <motion.div style={{ y, WebkitMaskImage: "linear-gradient(to right, transparent, #000000 45%)", maskImage: "linear-gradient(to right, transparent, #000000 45%)" }} aria-hidden="true" className="pointer-events-none absolute inset-y-0 -right-1/4 hidden w-2/3 opacity-[0.14] lg:block">
        <Img src={m.images[1]} tone={m.tone} className="h-full w-full" />
      </motion.div>
      <span aria-hidden="true" className={`pointer-events-none absolute left-[var(--page-gutter)] top-6 font-display text-[clamp(5rem,16vw,14rem)] font-extrabold leading-none ${dark ? "text-cream/[0.04]" : "text-ink/[0.04]"}`}>{String(n).padStart(2, "0")}</span>

      <div className={`container-dishky relative grid items-center gap-[var(--gap-lg)] lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="min-w-0">
          <Reveal>
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl" style={{ background: m.tone }}><Icon size={26} /></span>
            <h2 className="heading-lg">{m.headline}</h2>
            <p className={`text-lead mt-4 max-w-md ${dark ? "text-cream/60" : "text-ink/60"}`}>{m.sub}</p>
          </Reveal>
          <div className="mt-7"><Chips items={s.chips} dark={dark} /></div>
          <Reveal delay={0.2} className="cta-row mt-8">
            <Link to={moduleHref(m)} className="btn-primary group">
              Explore {m.name.split(" (")[0]}
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
        <motion.div style={{ rotate: rot }} className="min-w-0">
          <Reveal dir={flip ? "left" : "right"}>
            <Widget type={s.widget} props={s.props} dark={dark} />
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}
