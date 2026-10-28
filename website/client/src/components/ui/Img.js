import React, { useState } from "react";

/**
 * Photo frame. If the photo fails to load the tinted gradient underneath stays
 * visible, so a dead image link can never leave a hole in the layout.
 */
export default function Img({ src, alt = "", className = "", imgClassName = "", tone = "#f33716", children }) {
  const [bad, setBad] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-charcoal ${className}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${tone}d9 0%, #1a1a1a 115%)` }}
      />
      {src && !bad && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable="false"
          onError={() => setBad(true)}
          className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
        />
      )}
      {children}
    </div>
  );
}
