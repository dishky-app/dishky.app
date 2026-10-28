import React from "react";
import brandIcon from "../icon/brand-icon.png";
import brandWordmark from "../icon/brand-wordmark.png";

// Brand panel shown beside every auth form (same look as the Admin Panel's AuthShell).
// On small screens only the brand row stays visible.
export default function AuthVisual({ product, headline, accent, text, points = [] }) {
  return (
    <div className="auth-visual">
      <div className="auth-visual-glow" />
      <div className="auth-brand">
        <img className="auth-brand-icon" src={brandIcon} alt="" aria-hidden="true" />
        <img className="auth-brand-wordmark" src={brandWordmark} alt="Dishky" />
        <span className="auth-brand-tag">{product}</span>
      </div>
      <div className="auth-hero">
        <h2>{headline} <em>{accent}</em></h2>
        {text && <p>{text}</p>}
        {points.length > 0 && <ul className="auth-points">{points.map((p) => <li key={p}>{p}</li>)}</ul>}
      </div>
      <div className="auth-visual-foot">&copy; Dishky &middot; {product}</div>
    </div>
  );
}
