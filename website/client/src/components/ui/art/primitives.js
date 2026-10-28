import React from "react";

/** Shared palette and drawing helpers for the Dishky illustration set. */
export const C = {
  amber: "#f33716", amberL: "#f66b56", cream: "#f6f6f6", ink: "#1b1b1b", wood: "#f33c20", woodL: "#f6654e",
  green: "#d1250b", gold: "#f66650", blue: "#f5553c", skin1: "#faaa9d", skin2: "#f44d34", skin3: "#e4290c",
  white: "#ffffff",
};

/** Scene background: soft gradient, light bloom, and a filter for soft shadows. */
export function Backdrop({ id, dark, hue = C.amber, floor = true }) {
  const a = dark ? "#161616" : "#f2f2f2";
  const b = dark ? "#111111" : "#e2e2e2";
  return (
    <>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        <radialGradient id={`gl-${id}`} cx="0.72" cy="0.28" r="0.65"><stop offset="0" stopColor={hue} stopOpacity={dark ? 0.5 : 0.32} /><stop offset="1" stopColor={hue} stopOpacity="0" /></radialGradient>
        <linearGradient id={`fl-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000000" stopOpacity="0" /><stop offset="1" stopColor="#000000" stopOpacity={dark ? 0.5 : 0.18} /></linearGradient>
        <filter id={`sh-${id}`} x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000000" floodOpacity={dark ? 0.5 : 0.25} /></filter>
      </defs>
      <rect width="800" height="600" fill={`url(#bg-${id})`} />
      <rect width="800" height="600" fill={`url(#gl-${id})`} />
      <circle cx="80" cy="540" r="130" fill={hue} opacity="0.1" className="dk-art-drift" />
      <circle cx="730" cy="80" r="64" fill={C.amberL} opacity="0.16" className="dk-art-bob" />
      {floor && <rect y="440" width="800" height="160" fill={`url(#fl-${id})`} />}
    </>
  );
}

/** A person: head, torso, optional chef hat / apron / tray / phone. Origin is the feet. */
export function Person({ x = 0, y = 0, s = 1, skin = C.skin1, shirt = C.amber, hat, apron, tray, phone, flip, wave, hair = "#1e1e1e", className, style }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} className={className} style={style}>
      <ellipse cx="0" cy="2" rx="38" ry="8" fill="#000000" opacity="0.22" />
      <rect x="-22" y="-70" width="44" height="72" rx="18" fill={shirt} />
      {apron && <path d="M-16 -50h32l4 52h-40z" fill={C.cream} opacity="0.95" />}
      <rect x="-26" y="-62" width="14" height="46" rx="7" fill={shirt} transform={wave ? "rotate(18 -19 -60)" : undefined} />
      <rect x="12" y="-62" width="14" height="46" rx="7" fill={shirt} />
      <circle cx="0" cy="-92" r="22" fill={skin} />
      {hat === "chef" ? (
        <g fill={C.white}><rect x="-17" y="-122" width="34" height="16" rx="4" /><circle cx="-12" cy="-128" r="12" /><circle cx="0" cy="-134" r="14" /><circle cx="12" cy="-128" r="12" /></g>
      ) : hat === "cap" ? (
        <g fill={C.ink}><path d="M-22 -96a22 22 0 0 1 44 0z" /><rect x="-4" y="-98" width="34" height="7" rx="3" /></g>
      ) : (
        <path d={`M-22 -94a22 24 0 0 1 44 0c-8-10-30-12-44 0z`} fill={hair} />
      )}
      <circle cx="-8" cy="-90" r="2.4" fill={C.ink} /><circle cx="8" cy="-90" r="2.4" fill={C.ink} />
      <path d="M-7 -81q7 6 14 0" stroke={C.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {tray && (
        <g>
          <rect x="-48" y="-56" width="96" height="6" rx="3" fill="#9a9a9a" />
          <path d="M-18 -56a18 16 0 0 1 36 0z" fill="#e6e6e6" /><circle cx="0" cy="-74" r="3" fill="#bdbdbd" />
        </g>
      )}
      {phone && <g transform="translate(14 -76) rotate(14)"><rect width="22" height="38" rx="5" fill={C.ink} /><rect x="2.5" y="4" width="17" height="29" rx="3" fill={C.cream} /><rect x="5" y="8" width="12" height="12" rx="2" fill={C.amber} /></g>}
    </g>
  );
}

/** Top-down plated dish. */
export function Dish({ x = 0, y = 0, r = 60, kind = "curry", steam = true }) {
  const food = {
    curry: (
      <g>
        <circle r={r * 0.62} fill="#e4290c" /><circle r={r * 0.5} fill="#ee2b0d" />
        <path d={`M${-r * 0.4} 0q${r * 0.4} ${-r * 0.35} ${r * 0.8} 0`} stroke="#efefef" strokeWidth={r * 0.08} fill="none" strokeLinecap="round" />
        {[[-0.2, -0.15], [0.15, 0.12], [-0.05, 0.25]].map(([a, b], i) => <circle key={i} cx={r * a} cy={r * b} r={r * 0.09} fill="#f22f11" />)}
      </g>
    ),
    biryani: (
      <g>
        <circle r={r * 0.62} fill="#f5573e" />
        {Array.from({ length: 16 }).map((_, i) => <circle key={i} cx={Math.cos(i * 2.4) * r * (0.12 + (i % 5) * 0.09)} cy={Math.sin(i * 2.4) * r * (0.12 + (i % 5) * 0.09)} r={r * 0.07} fill={i % 4 ? "#f88978" : "#c0392b"} />)}
        <circle cx={-r * 0.1} cy={-r * 0.05} r={r * 0.15} fill="#e4290c" /><circle cx={r * 0.22} cy={r * 0.15} r={r * 0.11} fill="#f22f11" />
      </g>
    ),
    pasta: (
      <g>
        <circle r={r * 0.62} fill="#d3d3d3" />
        {[0.5, 0.38, 0.26, 0.14].map((k, i) => <circle key={i} r={r * k} fill="none" stroke="#f66f5b" strokeWidth={r * 0.07} />)}
        <circle cx={r * 0.05} cy={-r * 0.05} r={r * 0.2} fill="#d93b2b" opacity="0.85" /><circle cx={-r * 0.2} cy={r * 0.15} r={r * 0.07} fill="#d1250b" />
      </g>
    ),
    dessert: (
      <g>
        <path d={`M${-r * 0.4} ${r * 0.3}L${r * 0.4} ${r * 0.3}L${r * 0.1} ${-r * 0.4}z`} fill="#373737" />
        <path d={`M${-r * 0.3} ${r * 0.1}L${r * 0.3} ${r * 0.1}L${r * 0.18} ${-r * 0.12}L${-r * 0.1} ${-r * 0.12}z`} fill="#eaeaea" />
        <circle cx={r * 0.12} cy={-r * 0.46} r={r * 0.1} fill="#d62839" />
      </g>
    ),
    salad: (
      <g>
        {Array.from({ length: 9 }).map((_, i) => <ellipse key={i} cx={Math.cos(i * 0.7) * r * 0.3} cy={Math.sin(i * 0.7) * r * 0.3} rx={r * 0.22} ry={r * 0.1} fill={i % 3 ? "#ee2b0d" : "#f3371a"} transform={`rotate(${i * 40} ${Math.cos(i * 0.7) * r * 0.3} ${Math.sin(i * 0.7) * r * 0.3})`} />)}
        <circle cx={-r * 0.15} cy={-r * 0.1} r={r * 0.1} fill="#e53935" /><circle cx={r * 0.2} cy={r * 0.12} r={r * 0.09} fill="#e53935" /><circle cx={r * 0.05} cy={-r * 0.25} r={r * 0.07} fill="#f33113" />
      </g>
    ),
    pizza: (
      <g>
        <circle r={r * 0.64} fill="#f5563d" /><circle r={r * 0.54} fill="#e0452b" /><circle r={r * 0.5} fill="#f88472" />
        {[[-0.2, -0.1], [0.2, -0.2], [0.05, 0.25], [-0.15, 0.2], [0.28, 0.1]].map(([a, b], i) => <circle key={i} cx={r * a} cy={r * b} r={r * 0.09} fill="#e4290c" />)}
        <path d={`M0 ${-r * 0.54}V${r * 0.54}M${-r * 0.54} 0H${r * 0.54}`} stroke="#f5563d" strokeWidth="2" opacity="0.7" />
      </g>
    ),
    steak: (
      <g>
        <rect x={-r * 0.45} y={-r * 0.28} width={r * 0.9} height={r * 0.56} rx={r * 0.22} fill="#e4290c" />
        {[-0.2, 0, 0.2].map((k) => <path key={k} d={`M${r * k - r * 0.1} ${-r * 0.25}l${r * 0.2} ${r * 0.5}`} stroke="#222222" strokeWidth="3" />)}
        <circle cx={r * 0.35} cy={r * 0.3} r={r * 0.1} fill="#ee2b0d" />
      </g>
    ),
    drink: (
      <g>
        <circle r={r * 0.5} fill="#f0f0f0" opacity="0.9" /><circle r={r * 0.4} fill="#f55d46" /><circle cx={-r * 0.1} cy={-r * 0.1} r={r * 0.12} fill="#ffffff" opacity="0.5" />
        <circle cx={r * 0.15} cy={r * 0.12} r={r * 0.08} fill="#ffffff" opacity="0.5" /><path d={`M${r * 0.2} ${-r * 0.2}l${r * 0.25} ${-r * 0.3}`} stroke="#e53935" strokeWidth={r * 0.07} strokeLinecap="round" />
      </g>
    ),
  }[kind];
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill="#ffffff" /><circle r={r * 0.86} fill="none" stroke="#000000" strokeOpacity="0.08" strokeWidth="3" />
      {food}
      {steam && [-0.3, 0, 0.3].map((k, i) => <path key={i} d={`M${r * k} ${-r * 1.05}q${r * 0.12} ${-r * 0.2} 0 ${-r * 0.4}`} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round" fill="none" className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }} />)}
    </g>
  );
}

export function Phone({ x, y, w = 150, h = 290, children, tilt = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt} ${w / 2} ${h / 2})`}>
      <rect width={w} height={h} rx="26" fill={C.ink} />
      <rect x="8" y="12" width={w - 16} height={h - 24} rx="18" fill={C.cream} />
      <g transform="translate(8 12)">{children}</g>
    </g>
  );
}

export function Ticket({ x, y, w = 110, h = 130, tag = C.amber, rows = 3, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0h${w}v${h}l-${w / 12} -8 -${w / 12} 8 -${w / 12} -8 -${w / 12} 8 -${w / 12} -8 -${w / 12} 8 -${w / 12} -8 -${w / 12} 8 -${w / 12} -8 -${w / 12} 8 -${w / 12} -8 -${w / 12} 8 -${w / 12} -8 -${w / 12} 8z`} fill="#ffffff" />
      <rect x="10" y="12" width={w * 0.5} height="12" rx="6" fill={tag} />
      {Array.from({ length: rows }).map((_, i) => <rect key={i} x="10" y={38 + i * 22} width={w - 20 - i * 14} height="8" rx="4" fill={C.ink} opacity="0.25" />)}
    </g>
  );
}

export const Table = ({ x, y, w = 200, h = 24 }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="8" fill={C.wood} /><rect x={x + 8} y={y} width={w - 16} height="6" rx="3" fill={C.woodL} />
    <rect x={x + 16} y={y + h} width="14" height={80} fill="#e4290c" /><rect x={x + w - 30} y={y + h} width="14" height={80} fill="#e4290c" />
  </g>
);

export const Pin = ({ x, y, fill = C.amber, r = 26, delay = 0 }) => (
  <g className="dk-art-bob" style={{ animationDelay: `${delay}s` }}>
    <path d={`M${x} ${y}c-${r * 2.2}-${r * 2.2}-${r * 2.2}-${r * 4.4} 0-${r * 4.4}s${r * 2.2} ${r * 2.2} 0 ${r * 4.4}z`} fill={fill} transform={`translate(0 ${r * 0.1})`} />
    <circle cx={x} cy={y - r * 2.9} r={r * 0.8} fill="#ffffff" />
  </g>
);

export const Spark = ({ x, y, s = 1, fill = C.gold, delay = 0 }) => (
  <path className="dk-art-pulse" style={{ animationDelay: `${delay}s` }} d={`M${x} ${y - 22 * s}l${6 * s} ${16 * s} ${16 * s} ${6 * s}-${16 * s} ${6 * s}-${6 * s} ${16 * s}-${6 * s}-${16 * s}-${16 * s}-${6 * s} ${16 * s}-${6 * s}z`} fill={fill} />
);
