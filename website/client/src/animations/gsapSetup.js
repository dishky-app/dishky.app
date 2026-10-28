import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// ScrollTrigger must be registered exactly once for the whole app, before
// any component tries to create a trigger. Doing it here, at module load
// time (not inside a component), guarantees that regardless of which
// component imports this file first.
gsap.registerPlugin(ScrollTrigger);

// Keep GSAP's own smoothing out of the way — Lenis owns smooth scrolling,
// GSAP/ScrollTrigger only reacts to scroll position.
gsap.defaults({ ease: "power2.out" });

export { gsap, ScrollTrigger };
