import React from "react";

// Inline loader — same markup/classes as the Admin Panel's <PageLoader inline />.
export default function PageLoader({ label = "Loading…" }) {
  return (
    <div className="pl-inline" role="status">
      <span className="pl-ring" />
      <p className="pl-label">{label}</p>
    </div>
  );
}
