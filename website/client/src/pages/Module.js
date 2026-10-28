import React from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Img from "../components/ui/Img.js";
import Chips from "../components/ui/Chips.js";
import Reveal from "../components/ui/Reveal.js";
import ModuleCard from "../components/ui/ModuleCard.js";
import { Widget } from "../components/interactive/index.js";
import SectionHeading from "../components/SectionHeading/SectionHeading.js";
import NotFound from "./NotFound.js";
import { modules, bySlug, moduleHref } from "../data/modules.js";
import { images } from "../assets/images/imageUrls.js";
import { fadeUp, staggerChildren } from "../animations/variants.js";

function Hero({ m }) {
  const Icon = m.icon;
  return (
    <section data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space-tight)" }}>
      <div aria-hidden="true" className="glow -right-20 top-0 h-[460px] w-[460px] opacity-30" style={{ background: m.tone }} />
      <div className="container-dishky relative grid items-center gap-[var(--gap-xl)] lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible" className="min-w-0">
          <motion.span variants={fadeUp} className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-2xl" style={{ background: m.tone }}><Icon size={30} /></motion.span>
          <motion.h1 variants={fadeUp} className="heading-xl">{m.headline}</motion.h1>
          <motion.p variants={fadeUp} className="text-lead mt-5 max-w-md text-cream/65">{m.sub}</motion.p>
          <motion.div variants={fadeUp} className="cta-row mt-8">
            <Link to="/book-demo" className="btn-primary group">Book a Demo <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link>
            <Link to="/modules" className="btn-secondary !border-cream/25 !text-cream"><ArrowLeft size={16} /> All modules</Link>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="grid grid-cols-5 grid-rows-5 gap-3 sm:gap-4" style={{ aspectRatio: "1 / 0.92" }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="col-span-3 row-span-3"><Img src={m.images[0]} tone={m.tone} className="h-full w-full rounded-[2rem] shadow-2xl" imgClassName="animate-[dk-kenburns_20s_ease-in-out_infinite_alternate]" /></motion.div>
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="col-span-2 row-span-2"><Img src={m.images[1]} tone={m.tone} className="h-full w-full rounded-[2rem] shadow-xl" imgClassName="animate-[dk-kenburns_24s_ease-in-out_infinite_alternate-reverse]" /></motion.div>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="col-span-2 row-span-3"><Img src={m.images[2]} tone={m.tone} className="h-full w-full rounded-[2rem] shadow-xl" imgClassName="animate-[dk-kenburns_22s_ease-in-out_infinite_alternate]" /></motion.div>
            <div className="col-span-3 row-span-2 flex items-center justify-center rounded-[2rem] bg-cream/[0.06] backdrop-blur"><Icon size={64} style={{ color: m.tone }} className="drop-shadow-[0_0_30px_currentColor]" /></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** A slow, endless band of photography. */
function PhotoBand({ m }) {
  const pool = [...m.images, images.foodSpread, images.dishCurry, images.restaurantWarm, images.chefPlating, images.dishDessert];
  const strip = [...pool, ...pool];
  return (
    <div aria-hidden="true" className="overflow-hidden bg-ink py-4">
      <div className="dk-marquee flex w-max gap-4">
        {strip.map((src, i) => <Img key={i} src={src} tone={m.tone} className="h-32 w-52 shrink-0 rounded-2xl sm:h-40 sm:w-64" />)}
      </div>
    </div>
  );
}

function Showcase({ s, m, i }) {
  const dark = !!s.dark;
  const flip = i % 2 === 1;
  return (
    <section data-nav-theme={dark ? "dark" : undefined} className={dark ? "bg-ink text-cream" : "bg-cream text-ink"} style={{ paddingBlock: "var(--section-space)" }}>
      <div className={`container-dishky grid items-center gap-[var(--gap-lg)] lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="min-w-0">
          <Reveal>
            <span className="font-display text-sm font-extrabold" style={{ color: m.tone }}>{String(i + 1).padStart(2, "0")}</span>
            <h2 className="heading-lg mt-2">{s.title}</h2>
            <p className={`text-lead mt-4 max-w-md ${dark ? "text-cream/60" : "text-ink/60"}`}>{s.line}</p>
          </Reveal>
          <div className="mt-7"><Chips items={s.chips} dark={dark} /></div>
        </div>
        <Reveal dir={flip ? "left" : "right"} className="min-w-0"><Widget type={s.widget} props={s.props} dark={dark} /></Reveal>
      </div>
    </section>
  );
}

export default function Module({ slug: slugProp }) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const m = bySlug[slug];
  if (!m) return <NotFound />;
  const i = modules.indexOf(m);
  const prev = modules[(i - 1 + modules.length) % modules.length];
  const next = modules[(i + 1) % modules.length];
  const more = modules.filter((x) => x.slug !== m.slug).slice(i % 8, (i % 8) + 4);
  const rest = more.length === 4 ? more : modules.filter((x) => x.slug !== m.slug).slice(0, 4);
  return (
    <div key={m.slug}>
      <Hero m={m} />
      <PhotoBand m={m} />
      {m.sections.map((s, n) => <Showcase key={s.title} s={s} m={m} i={n} />)}

      <section className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <SectionHeading title={"KEEP\nEXPLORING."} />
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {rest.map((x, n) => <ModuleCard key={x.slug} m={x} index={n} />)}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <Link to={moduleHref(prev)} className="btn-secondary"><ArrowLeft size={16} /> {prev.name.split(" (")[0]}</Link>
            <Link to={moduleHref(next)} className="btn-secondary">{next.name.split(" (")[0]} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section data-nav-theme="dark" className="bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }}>
        <div className="container-dishky">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="heading-lg">See it with your own restaurant.</h2>
            <div className="cta-row mt-8 justify-center">
              <Link to="/book-demo" className="btn-primary group">Book a Demo <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link>
              <Link to="/pricing" className="btn-secondary !border-cream/25 !text-cream">See pricing</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
