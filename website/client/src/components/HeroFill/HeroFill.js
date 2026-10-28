import React from "react";
import { CountUp } from "../ui/kit.js";

/**
 * Filler for heroes: real, relevant content that sits under the headline so the
 * first screen is full. Styles live in styles/herofill.css (namespace hf-).
 */

/** A row of big numbers. items: [{ n: number, suffix?, label }] */
export function HeroStats({ items, dark = false, className = "" }) {
  return (
    <div className={`hf-stats ${className}`}>
      {items.map((it) => (
        <div key={it.label} className={`hf-stat ${dark ? "hf-stat--dark" : ""}`}>
          <p className="hf-stat__n">
            {typeof it.n === "number" ? <CountUp to={it.n} suffix={it.suffix || ""} /> : it.n}
          </p>
          <p className="hf-stat__l">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

/** The little "scroll" hint at the bottom of a hero. */
export function HeroCue({ className = "" }) {
  return (
    <div className={`flex justify-center ${className}`} aria-hidden="true">
      <span className="hf-cue">
        Scroll
        <span className="hf-cue__line" />
      </span>
    </div>
  );
}
