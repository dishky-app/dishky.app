import Art from "../ui/Art.js";
import { USE_STOCK_PHOTOS } from "../../assets/images/imageUrls.js";
import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "../../animations/gsapSetup.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import useMediaQuery, { QUERIES } from "../../hooks/useMediaQuery.js";

/**
 * A parallax image: the outer frame clips overflow, the <img> inside is
 * oversized and drifts vertically at a fraction of scroll speed.
 *
 * Responsive behaviour (this also serves as the site's "food background"
 * primitive, so the rules match the spec):
 *  - Fine-pointer desktops get the full drift.
 *  - Touch / phone screens get NO parallax. The image is still oversized, so
 *    it fills the frame, but it is static: no scrub trigger per image, no
 *    per-frame transforms, far cheaper on a phone GPU.
 *  - `position` moves the focal point per breakpoint via CSS variables, so a
 *    landscape photo keeps its subject in frame in a tall mobile crop.
 *
 * @param {string} src
 * @param {string} alt
 * @param {string} className - applied to the outer frame (size/radius here)
 * @param {number} strength - drift in percent (default 15)
 * @param {string} position - object-position on desktop, e.g. "center 40%"
 * @param {string} mobilePosition - object-position below `md`
 * @param {boolean} eager - true for above-the-fold images
 */
export default function ParallaxImage({
  src,
  art,
  artDark = true,
  alt = "",
  className = "",
  strength = 15,
  position = "center",
  mobilePosition,
  eager = false,
}) {
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const finePointer = useMediaQuery(QUERIES.finePointer);
  const drift = finePointer && !reducedMotion;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !drift) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        img,
        { yPercent: -strength },
        {
          yPercent: strength,
          ease: "none",
          scrollTrigger: {
            trigger: frame,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }, frame);

    return () => ctx.revert();
  }, [strength, drift]);

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        "--pos": position,
        "--pos-m": mobilePosition || position,
      }}
    >
      {art && !USE_STOCK_PHOTOS ? (
        <div ref={imgRef} className="absolute inset-x-0 w-full" style={drift ? { top: "-15%", height: "130%" } : { top: 0, height: "100%" }}>
          <Art kind={art} dark={artDark} />
        </div>
      ) : (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={eager ? "high" : "auto"}
        className="parallax-img absolute inset-x-0 w-full object-cover"
        // Oversized only when it actually drifts; static images just fill the frame.
        style={
          drift
            ? { top: "-15%", height: "130%" }
            : { top: 0, height: "100%" }
        }
      />
      )}
    </div>
  );
}
