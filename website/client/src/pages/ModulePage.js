import React, { Suspense, lazy, useMemo } from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { bySlug, routeToSlug, categories } from "../data/modules.js";
import { ParallaxPhoto, RelatedModules } from "../components/Modules/ModuleBlocks.js";
import { GuestBody, OpsBody, BookBody, PeopleBody, GrowthBody } from "../components/Modules/ModuleTemplates.js";
import bespoke from "../components/Modules/pages/index.js";
import Title from "../components/Modules/ModuleTitle.js";
import ModuleTilesSection from "../components/FeatureShowcase/ModuleTilesSection.js";
import { Demo } from "../components/demos/index.js";
import { artFor } from "../components/ui/Art.js";
import Breadcrumbs from "../components/ui/Breadcrumbs.js";
import { ResponsiveLines } from "../components/SectionHeading/SectionHeading.js";

/** A slow ticker of the module's features, right under the hero. */
function FeatureTicker({ m }) {
  const reps = Math.max(1, Math.ceil(8 / m.features.length));
  const base = Array.from({ length: reps }).flatMap(() => m.features);
  const items = base.concat(base);
  return (
    <div className="dk-marquee relative overflow-hidden border-y border-white/10 bg-ink py-3.5" aria-label="Features">
      <ul className="dk-marquee__track flex w-max gap-3 pr-3">
        {items.map((f, i) => (
          <li key={i} aria-hidden={i >= base.length ? "true" : undefined} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-cream/85">
            <f.icon size={15} className="text-amberLight" /> {f.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dedicated page for one module. Content comes from data/modules.js. */
export default function ModulePage({ slug: slugProp }) {
  const params = useParams();
  const m = bySlug[slugProp || routeToSlug[params.slug]];
  const Bespoke = useMemo(() => (m && bespoke[m.slug] ? lazy(bespoke[m.slug]) : null), [m]);
  if (!m) return <Navigate to="/features" replace />;
  const family = (categories.find((c) => c.slugs.includes(m.slug)) || {}).id;
  const alt = ((categories.find((c) => c.slugs.includes(m.slug)) || { slugs: [] }).slugs.indexOf(m.slug)) % 2 === 1;
  const layout = family === "guest" || family === "people" ? "split" : family === "book" || family === "growth" ? "center" : "stack";

  return (
    <>
      {Bespoke ? (
        <Suspense fallback={<div className="min-h-[100svh] bg-ink" />}><Bespoke m={m} /></Suspense>
      ) : (
        <>
      {/* Hero: the layout follows the module's family so the pages do not all look alike */}
      {layout === "split" ? (
        <section className="hero-min relative isolate overflow-hidden bg-white text-ink" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 5vw, 56px))", paddingBottom: "var(--section-space-tight)" }}>
          <PageBackdrop tone="light" />
          <div aria-hidden="true" className="absolute -right-32 -top-32 h-[560px] w-[560px] rounded-full opacity-[0.06] blur-3xl" style={{ background: "#000000" }} />
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5" style={{ background: "#0a0a0a" }} />
          <div className="container-dishky relative grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
              <div className="mb-6"><Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Features", to: "/features" }, { label: m.name }]} /></div>
              <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl" style={{ background: m.color }}><m.icon size={26} /></span>
              <h1 className="heading-hero"><ResponsiveLines text={m.name} /></h1>
              <p className="text-lead mt-4 max-w-md text-ink/65">{m.tagline}</p>
              {m.lacks && <p className="mt-3 font-display text-base font-bold text-amber">{m.lacks}</p>}
              <div className="cta-row mt-7">
                <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
                <Link to="/pricing" className="btn-secondary">View Plans</Link>
              </div>
            </motion.div>
            <motion.div id="try" initial={{ opacity: 0, y: 50, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
              <Demo name={m.demo} />
              <p className="mt-3 text-center text-xs text-ink/45">Interactive demo with sample data. It is not connected to a live restaurant.</p>
            </motion.div>
          </div>
        </section>
      ) : layout === "center" ? (
        <section data-nav-theme="dark" className="hero-min relative isolate overflow-hidden text-center text-cream" style={{ background: `radial-gradient(120% 80% at 50% 0%, #2a2a2a, #0a0a0a 62%)`, paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 72px))", paddingBottom: "var(--section-space-tight)" }}>
          <ParallaxPhoto src={m.photo} art={artFor[m.slug]} className="absolute inset-0 opacity-25" strength={50} />
          <PageBackdrop tone="dark" z="z-0" />
          <div className="container-dishky relative">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-3xl">
              <div className="mb-6 flex justify-center"><Breadcrumbs dark items={[{ label: "Home", to: "/" }, { label: "Features", to: "/features" }, { label: m.name }]} /></div>
              <motion.span initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.2 }} className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink shadow-2xl"><m.icon size={28} style={{ color: m.color }} /></motion.span>
              <h1 className="heading-hero"><ResponsiveLines text={m.name} /></h1>
              <p className="text-lead mx-auto mt-4 max-w-xl text-cream/75">{m.tagline}</p>
              {m.lacks && <p className="mt-3 font-display text-base font-bold text-amberLight">{m.lacks}</p>}
              <div className="cta-row mt-7 justify-center">
                <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
                <a href="#try" className="btn-secondary !border-cream/25 !text-cream">Try it live <ArrowDown size={16} /></a>
              </div>
            </motion.div>
            <motion.div id="try" initial={{ opacity: 0, y: 70, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mx-auto mt-12 max-w-4xl text-left">
              <Demo name={m.demo} />
              <p className="mt-3 text-center text-xs text-cream/45">Interactive demo with sample data. It is not connected to a live restaurant.</p>
            </motion.div>
          </div>
        </section>
      ) : (
      <section data-nav-theme="dark" className="hero-min relative isolate overflow-hidden bg-ink text-cream" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 72px))", paddingBottom: "var(--section-space-tight)" }}>
        <ParallaxPhoto src={m.photo} art={artFor[m.slug]} className="absolute inset-0 opacity-60" strength={70} />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
        <PageBackdrop tone="dark" z="z-0" />
        <div className="glow -right-20 top-10 h-[420px] w-[420px] opacity-40" style={{ background: m.color }} />
        <div className="container-dishky relative">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="max-w-4xl">
            <div className="mb-6"><Breadcrumbs dark items={[{ label: "Home", to: "/" }, { label: "Features", to: "/features" }, { label: m.name }]} /></div>
            <motion.span
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber text-white shadow-[0_20px_50px_-10px_rgba(243,55,22,0.7)]"
            >
              <m.icon size={30} />
            </motion.span>
            <h1 className="heading-hero"><ResponsiveLines text={m.name} /></h1>
            <p className="text-lead mt-5 max-w-xl text-cream/70">{m.tagline}</p>
            {m.lacks && <p className="mt-3 font-display text-base font-bold text-amberLight">{m.lacks}</p>}
            <div className="cta-row mt-8">
              <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
              <a href="#try" className="btn-secondary !border-cream/25 !text-cream">Try it live <ArrowDown size={16} /></a>
            </div>
          </motion.div>

          <div id="try" className="mt-14 md:mt-20">
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <Demo name={m.demo} />
              <p className="mt-3 text-center text-xs text-cream/45">Interactive demo with sample data. It is not connected to a live restaurant.</p>
            </motion.div>
          </div>
        </div>
      </section>

      )}

      {(family === "ops" || family === "growth") && <FeatureTicker m={m} />}

      {/* Body: a different layout for each family of modules */}
      {family === "guest" ? <GuestBody m={m} alt={alt} />
        : family === "book" ? <BookBody m={m} alt={alt} />
        : family === "people" ? <PeopleBody m={m} alt={alt} />
        : family === "growth" ? <GrowthBody m={m} />
        : <OpsBody m={m} />}

        </>
      )}

      {/* Related */}
      <section className="bg-beige" style={{ paddingBlock: "var(--section-space-tight)" }}>
        <div className="container-dishky">
          <Title>Works with</Title>
          <RelatedModules slugs={m.related} />
          <div className="mt-12 text-center">
            <div className="cta-row justify-center">
              <Link to="/book-demo" className="btn-primary">Book a Demo <ArrowRight size={18} /></Link>
              <Link to="/pricing" className="btn-secondary">View Plans</Link>
              <Link to="/contact" className="btn-secondary">Talk to Our Team</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Every other module, on the landing page's own explorer */}
      <ModuleTilesSection />
    </>
  );
}
