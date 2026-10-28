import Art from "../ui/Art.js";
import { USE_STOCK_PHOTOS } from "../../assets/images/imageUrls.js";
import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";

/**
 * An image that reveals via a sliding wipe panel as it scrolls into view.
 *
 * On wide screens the three story images sit side by side and wipe in from
 * opposite sides. On a narrow screen they are stacked, so a *horizontal* wipe
 * would slide the panel across the full page width. There the wipe becomes a
 * vertical reveal (bottom -> top) that stays inside the frame.
 *
 * @param {"left"|"right"|"top"|"bottom"} direction - wipe direction on wide screens
 */
export default function RevealImage({
  src,
  art,
  artDark = true,
  alt = "",
  className = "",
  direction = "left",
  position = "center",
  onError,
}) {
  const frameRef = useRef(null);
  const panelRef = useRef(null);
  const imgRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const wide = useMediaQuery("(min-width: 1024px)");

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const panel = panelRef.current;
    const img = imgRef.current;
    if (!frame || !panel || !img) return;

    if (reducedMotion) {
      gsap.set(panel, { autoAlpha: 0 });
      return;
    }

    const effective = wide ? direction : "top";
    const exitVars =
      effective === "left"
        ? { xPercent: -100 }
        : effective === "right"
        ? { xPercent: 100 }
        : effective === "top"
        ? { yPercent: -100 }
        : { yPercent: 100 };

    const ctx = gsap.context(() => {
      gsap.set(panel, { xPercent: 0, yPercent: 0, autoAlpha: 1 });
      gsap.set(img, { scale: wide ? 1.15 : 1.08 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: frame,
          start: "top 88%",
          end: wide ? "top 40%" : "top 55%",
          scrub: 1,
        },
      });

      tl.to(panel, { ...exitVars, duration: 1, ease: "none" }, 0);
      tl.to(img, { scale: 1, duration: 1, ease: "none" }, 0);
    }, frame);

    return () => ctx.revert();
  }, [direction, reducedMotion, wide]);

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className}`}>
      {art && !USE_STOCK_PHOTOS ? (
        <div ref={imgRef} className="absolute inset-0"><Art kind={art} dark={artDark} /></div>
      ) : (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={onError}
        loading="lazy"
        decoding="async"
        className="cover"
        style={{ objectPosition: position }}
      />
      )}
      <div ref={panelRef} className="absolute inset-0 bg-ink" aria-hidden="true" />
    </div>
  );
}
