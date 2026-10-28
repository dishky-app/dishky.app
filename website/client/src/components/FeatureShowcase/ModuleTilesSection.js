import React, { lazy, useLayoutEffect, useRef } from "react";
import Enhanced from "../ReactBits/Enhanced.js";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import ModuleExplorer from "./ModuleExplorer.js";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const ModuleSphere = lazy(() => import("./ModuleSphere.js"));

/** "Everything else": the visual module explorer, grouped by category. */
export default function ModuleTilesSection() {
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        section.querySelector("[data-explorer]"),
        { opacity: 0, y: 80, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: section.querySelector("[data-explorer]"), start: "top 100%", end: "top 65%", scrub: 0.8 } }
      );
    }, section);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} id="modules" className="overflow-x-clip bg-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky">
        <SectionHeading title={"EVERYTHING ELSE.\nEVERY MODULE, ITS OWN PAGE."} align="center" />
        <div data-explorer className="mt-10 md:mt-14">
          <Enhanced webgl fallback={<ModuleExplorer />}>
            <ModuleSphere />
            <p className="mt-5 text-center text-sm text-ink/60">
              Drag to spin and open any module, or pick one from the Features menu.
            </p>
          </Enhanced>
        </div>
      </div>
    </section>
  );
}
