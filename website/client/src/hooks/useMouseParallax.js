import { useEffect, useRef } from "react";
import useReducedMotion from "./useReducedMotion.js";
import useMediaQuery, { QUERIES } from "./useMediaQuery.js";

/**
 * Returns a ref to attach to a container element. Children with the
 * data-parallax="<strength>" attribute shift slightly based on mouse
 * position, for subtle depth in hero/showcase sections.
 *
 * Desktop-only by design (spec section 16): a touch screen has no cursor, so
 * the effect is skipped entirely there rather than listening for events that
 * never fire. Movement is batched into one requestAnimationFrame per frame
 * instead of writing styles on every raw mousemove.
 */
export default function useMouseParallax() {
  const containerRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useMediaQuery(QUERIES.finePointer);

  useEffect(() => {
    if (reducedMotion || !finePointer) return;
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    let lastEvent = null;

    const apply = () => {
      raf = 0;
      if (!lastEvent) return;
      const rect = container.getBoundingClientRect();
      const x = (lastEvent.clientX - rect.left) / rect.width - 0.5;
      const y = (lastEvent.clientY - rect.top) / rect.height - 0.5;
      container.querySelectorAll("[data-parallax]").forEach((el) => {
        const strength = parseFloat(el.getAttribute("data-parallax")) || 10;
        el.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
      });
    };

    const handleMove = (e) => {
      lastEvent = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const handleLeave = () => {
      container.querySelectorAll("[data-parallax]").forEach((el) => {
        el.style.transform = "";
      });
    };

    container.addEventListener("mousemove", handleMove, { passive: true });
    container.addEventListener("mouseleave", handleLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
    };
  }, [reducedMotion, finePointer]);

  return containerRef;
}
