import React from "react";
import { motion } from "framer-motion";
import { fadeUp } from "../../animations/variants.js";
import { viewportOnce } from "../../animations/transitions.js";

/**
 * Splits an authored title on "\n" and joins the parts with a break that only
 * exists from the `md` breakpoint up. On desktop that preserves the editorial
 * line composition; on a phone the text simply reflows to the available width
 * (with text-wrap: balance from typography.css) instead of being forced into
 * lines that were designed for a 1280px canvas.
 */
export function ResponsiveLines({ text }) {
  const parts = String(text).split("\n");
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <>
          <span className="br-desktop" aria-hidden="true">
            <br />
          </span>
          <span className="md:hidden"> </span>
        </>
      )}
    </React.Fragment>
  ));
}

export default function SectionHeading({
  title,
  subtitle,
  align = "left",
  size = "lg",
  dark = false,
  as: Tag = "h2",
}) {
  const centered = align === "center";
  const headingClass = size === "xl" ? "heading-xl" : "heading-lg";

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className={`max-w-2xl ${centered ? "mx-auto text-center" : "text-left"}`}
    >
      <Tag className={`${headingClass} ${dark ? "text-cream" : "text-ink"}`}>
        <ResponsiveLines text={title} />
      </Tag>
      {subtitle && (
        <p className={`text-lead mt-4 md:mt-5 ${dark ? "text-cream/60" : "text-ink/60"}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
