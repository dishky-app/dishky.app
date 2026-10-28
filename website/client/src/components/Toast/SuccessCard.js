import React from "react";
import "./Toast.css";

/** Green tick that draws itself: circle first, then the check. */
export function AnimatedTick({ size = 72 }) {
  return (
    <svg data-keep-colors className="dk-tick" width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <circle className="dk-tick__circle" cx="26" cy="26" r="23" fill="none" />
      <path className="dk-tick__check" fill="none" d="M15 27.5l7.5 7.5L37.5 19" />
    </svg>
  );
}

/** Success panel that fills the height of its container (so it matches the column beside it). */
export default function SuccessCard({ title, text, dark = false, className = "" }) {
  return (
    <div role="status" className={`dk-success ${dark ? "dk-success--dark" : ""} ${className}`}>
      <AnimatedTick />
      <p className="dk-success__title">{title}</p>
      <p className="dk-success__text">{text}</p>
    </div>
  );
}
