import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

/**
 * A stack of images occupying the same frame, crossfading through one
 * another in sequence as the user scrolls — each image also gets a
 * slight scale/ken-burns move during its "active" window.
 *
 * @param {{src: string, alt?: string}[]} items
 */
export default function ImageCrossfadeStack({ items, className = "" }) {
  const frameRef = useRef(null);
  const imgRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  imgRefs.current = [];

  const addImgRef = (el) => {
    if (el) imgRefs.current.push(el);
  };

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || imgRefs.current.length === 0) return;

    if (reducedMotion) {
      imgRefs.current.forEach((img, i) => gsap.set(img, { opacity: i === 0 ? 1 : 0 }));
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(imgRefs.current, { opacity: 0, scale: 1.1 });
      gsap.set(imgRefs.current[0], { opacity: 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: frame,
          start: "top 70%",
          end: "bottom 30%",
          scrub: 1,
        },
      });

      imgRefs.current.forEach((img, i) => {
        if (i === 0) {
          tl.to(img, { scale: 1, duration: 1 }, 0);
          return;
        }
        const prev = imgRefs.current[i - 1];
        tl.to(prev, { opacity: 0, duration: 0.6 }, i - 0.3)
          .to(img, { opacity: 1, scale: 1, duration: 0.8 }, i - 0.3);
      });
    }, frame);

    return () => ctx.revert();
  }, [items, reducedMotion]);

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className}`}>
      {items.map((item) => (
        <img
          key={item.src}
          ref={addImgRef}
          src={item.src}
          alt={item.alt || ""}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ))}
    </div>
  );
}
