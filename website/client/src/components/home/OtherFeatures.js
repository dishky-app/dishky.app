import React from "react";

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import ModuleCard from "../ui/ModuleCard.js";
import Reveal from "../ui/Reveal.js";
import { others } from "../../data/modules.js";

/** Everything else Dishky does. Photo tiles that open their own page. */
export default function OtherFeatures() {
  return (
    <section id="more" className="bg-beige" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"AND EVERYTHING\nELSE YOU NEED."} subtitle="Tap a tile to open its page." />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 md:mt-14 lg:grid-cols-4">
          {others.map((m, i) => <ModuleCard key={m.slug} m={m} index={i} />)}
        </div>
        <Reveal className="cta-row mt-10"><Link to="/modules" className="btn-dark group">See every module <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></Link></Reveal>
      </div>
    </section>
  );
}
