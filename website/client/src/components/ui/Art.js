import React, { useState } from "react";
import { USE_STOCK_PHOTOS, sceneImages } from "../../assets/images/imageUrls.js";
import { Backdrop } from "./art/primitives.js";
import { storyScenes } from "./art/scenes.js";

/**
 * Original vector illustrations, one per Dishky feature. They are bundled
 * code, so they always load (no network), scale to any size, and animate with
 * CSS. When a photo is available, <Photo art="..."/> shows it on top.
 */

const A = "#f33716";
const AL = "#f66b56";
const CREAM = "#f6f6f6";
const INK = "#1b1b1b";

const Card = ({ x, y, w, h, fill = CREAM, op = 1, r = 18, ...p }) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} opacity={op} {...p} />
);

const scenes = {
  kitchen: ({ d }) => (
    <g>
      <rect x="60" y="120" width="680" height="10" rx="5" fill={d ? "#7a7a7a" : "#f44226"} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.4}s` }}>
          <Card x={100 + i * 160} y={135} w={130} h={150 + (i % 2) * 30} fill={CREAM} r={10} />
          <rect x={112 + i * 160} y={150} width="70" height="10" rx="5" fill={A} />
          {[0, 1, 2].map((k) => <rect key={k} x={112 + i * 160} y={178 + k * 24} width={90 - k * 14} height="8" rx="4" fill={INK} opacity="0.25" />)}
        </g>
      ))}
      <ellipse cx="400" cy="470" rx="190" ry="26" fill="#000000" opacity="0.25" />
      <path d="M230 380h340l-26 80H256z" fill="#2b2b2b" />
      <rect x="560" y="396" width="120" height="16" rx="8" fill="#2b2b2b" />
      {[290, 350, 410, 470, 520].map((x, i) => (
        <path key={x} className="dk-art-flame" style={{ animationDelay: `${i * 0.15}s` }} d={`M${x} 372c-20-30 6-40 0-70 30 20 38 50 14 70z`} fill={i % 2 ? AL : A} />
      ))}
    </g>
  ),
  orders: () => (
    <g>
      <rect x="110" y="90" width="190" height="400" rx="30" fill={INK} />
      <Card x="122" y="110" w="166" h="360" r="20" />
      {[0, 1, 2].map((i) => <Card key={i} x={134} y={130 + i * 70} w={142} h={56} fill="#ffffff" r={12} />)}
      {[0, 1, 2].map((i) => <rect key={i} x={146} y={146 + i * 70} width={70 - i * 10} height="9" rx="4" fill={INK} opacity="0.35" />)}
      <rect x="146" y="420" width="118" height="32" rx="16" fill={A} />
      <path d="M320 290h120" stroke={A} strokeWidth="6" strokeLinecap="round" strokeDasharray="10 12" className="dk-art-dash" />
      <path d="M430 270l24 20-24 20" fill="none" stroke={A} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="dk-art-bob"><Card x="480" y="140" w="210" h="300" r="14" /></g>
      {["New", "Cooking", "Ready"].map((t, i) => (
        <g key={t}>
          <rect x="500" y={170 + i * 78} width="170" height="56" rx="12" fill={["#eaeaea", "#e4e4e4", "#e6e6e6"][i]} />
          <circle cx="526" cy={198 + i * 78} r="9" fill={[A, "#dc270c", "#d1250b"][i]} />
          <rect x="548" y={192 + i * 78} width="90" height="10" rx="5" fill={INK} opacity="0.35" />
        </g>
      ))}
    </g>
  ),
  payments: () => (
    <g>
      <g transform="rotate(-8 400 300)" className="dk-art-bob">
        <rect x="170" y="170" width="380" height="230" rx="26" fill={INK} />
        <rect x="170" y="215" width="380" height="46" fill={A} />
        <rect x="200" y="320" width="150" height="14" rx="7" fill={CREAM} opacity="0.7" />
        <rect x="200" y="350" width="90" height="12" rx="6" fill={CREAM} opacity="0.4" />
        <circle cx="500" cy="350" r="22" fill={AL} /><circle cx="522" cy="350" r="22" fill="#f66650" opacity="0.9" />
      </g>
      {[0, 1, 2].map((i) => <ellipse key={i} cx="610" cy={430 - i * 18} rx="62" ry="18" fill="#f66650" stroke="#e4290c" strokeWidth="4" />)}
      <circle cx="610" cy="130" r="54" fill="#d1250b" className="dk-art-pop" />
      <path d="M586 130l18 18 34-38" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  analytics: () => (
    <g>
      <Card x="90" y="90" w="620" height="420" h="420" r="26" />
      {[150, 235, 190, 300, 260, 340].map((h, i) => (
        <rect key={i} x={140 + i * 90} y={470 - h} width="52" height={h} rx="10" fill={i === 5 ? A : AL} opacity={i === 5 ? 1 : 0.55} className="dk-art-grow" style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${166 + i * 90}px 470px` }} />
      ))}
      <path d="M140 330C230 260 280 300 360 220S520 200 660 130" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" strokeDasharray="8 10" className="dk-art-dash" />
      <circle cx="660" cy="130" r="14" fill={INK} />
    </g>
  ),
  staff: () => (
    <g>
      <Card x="80" y="110" w="640" h="380" r="26" />
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <circle cx="130" cy={170 + r * 82} r="22" fill={[A, AL, "#dc270c", "#d1250b"][r]} />
          <rect x="170" y={162 + r * 82} width="80" height="12" rx="6" fill={INK} opacity="0.4" />
          {[0, 1, 2, 3, 4].map((c) => ((r + c) % 3 !== 2) && (
            <rect key={c} x={280 + c * 86} y={150 + r * 82} width="74" height="44" rx="12" fill={[A, AL, "#f66650", "#f77a67"][(r + c) % 4]} opacity="0.85" className="dk-art-bob" style={{ animationDelay: `${(r + c) * 0.2}s` }} />
          ))}
        </g>
      ))}
    </g>
  ),
  inventory: () => (
    <g>
      <rect x="90" y="150" width="620" height="14" rx="7" fill={INK} opacity="0.4" />
      <rect x="90" y="300" width="620" height="14" rx="7" fill={INK} opacity="0.4" />
      <rect x="90" y="450" width="620" height="14" rx="7" fill={INK} opacity="0.4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.25}s` }}>
          <rect x={120 + i * 120} y="70" width="84" height="80" rx="16" fill={CREAM} />
          <rect x={120 + i * 120} y={150 - (30 + (i * 17) % 44)} width="84" height={30 + (i * 17) % 44} rx="12" fill={[A, AL, "#dc270c", "#d1250b", A][i]} opacity="0.8" />
        </g>
      ))}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={150 + i * 140} y="220" width="90" height="80" rx="10" fill="#f33c20" />)}
      <rect x="150" y="350" width="130" height="100" rx="10" fill="#f33c20" />
      <rect x="320" y="370" width="110" height="80" rx="10" fill="#f5573e" />
      <circle cx="580" cy="400" r="48" fill={A} className="dk-art-pop" />
      <path d="M580 378v30M580 420v4" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
    </g>
  ),
  loyalty: () => (
    <g>
      <path d="M400 470C230 360 190 260 250 200c46-44 120-26 150 30 30-56 104-74 150-30 60 60 20 160-150 270z" fill={A} className="dk-art-pulse" style={{ transformOrigin: "400px 320px" }} />
      {[[140, 140], [660, 190], [600, 480], [170, 440]].map(([x, y], i) => (
        <path key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }} d={`M${x} ${y - 28}l8 20 22 2-17 14 6 22-19-12-19 12 6-22-17-14 22-2z`} fill="#f66650" />
      ))}
      <rect x="560" y="90" width="110" height="90" rx="14" fill={CREAM} />
      <rect x="560" y="120" width="110" height="14" fill={AL} /><rect x="608" y="90" width="14" height="90" fill={AL} />
    </g>
  ),
  promotions: () => (
    <g>
      <g className="dk-art-bob"><path d="M140 300l320-130v260z" fill={A} /><rect x="110" y="270" width="60" height="60" rx="14" fill={INK} /><rect x="440" y="150" width="34" height="300" rx="14" fill={AL} /></g>
      {[0, 1, 2].map((i) => <path key={i} d={`M${510 + i * 36} ${250 + i * -24}q30 ${50 - i * 12} 0 ${100 + i * 24}`} fill="none" stroke={A} strokeWidth="9" strokeLinecap="round" opacity={1 - i * 0.25} className="dk-art-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
      <Card x="520" y="90" w="190" h="130" r="16" /><circle cx="552" cy="124" r="14" fill={A} /><rect x="576" y="116" width="100" height="10" rx="5" fill={INK} opacity="0.4" /><rect x="536" y="152" width="160" height="40" rx="10" fill="#dddddd" />
      <Card x="520" y="400" w="190" h="110" r="16" /><rect x="540" y="424" width="90" height="12" rx="6" fill={A} /><rect x="540" y="452" width="140" height="10" rx="5" fill={INK} opacity="0.3" />
    </g>
  ),
  events: () => (
    <g>
      <path d="M60 110C200 190 340 190 400 120S600 60 740 130" fill="none" stroke={INK} strokeWidth="4" opacity="0.6" />
      {[110, 210, 310, 420, 520, 630].map((x, i) => <circle key={x} cx={x} cy={150 + (i % 2) * 22 + (i === 3 ? -20 : 0)} r="13" fill={["#f66650", A, AL, "#f77a67", "#f66650", A][i]} className="dk-art-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
      <Card x="150" y="230" w="360" h="280" r="22" />
      <rect x="150" y="230" width="360" height="62" rx="22" fill={A} /><rect x="150" y="268" width="360" height="24" fill={A} />
      {Array.from({ length: 15 }).map((_, i) => <rect key={i} x={174 + (i % 5) * 64} y={312 + Math.floor(i / 5) * 62} width="44" height="42" rx="10" fill={i === 7 ? A : "#e7e7e7"} className={i === 7 ? "dk-art-pulse" : ""} />)}
      <g className="dk-art-bob"><path d="M590 300h110l-12 120c-2 20-86 20-88 0z" fill="#ffffff" opacity="0.85" /><rect x="640" y="420" width="12" height="70" fill="#ffffff" opacity="0.85" /><rect x="610" y="488" width="72" height="12" rx="6" fill="#ffffff" opacity="0.85" /><circle cx="645" cy="350" r="20" fill={A} /></g>
    </g>
  ),
  bookings: () => (
    <g>
      <Card x="100" y="100" w="430" h="400" r="24" />
      {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 5 }).map((__, c) => (
        <rect key={`${r}${c}`} x={130 + c * 76} y={140 + r * 68} width="60" height="50" rx="12" fill={(r * 5 + c) % 7 === 3 ? A : (r + c) % 4 === 0 ? "#dddddd" : "#ececec"} className={(r * 5 + c) % 7 === 3 ? "dk-art-pulse" : ""} />
      )))}
      <circle cx="620" cy="260" r="110" fill={CREAM} /><circle cx="620" cy="260" r="96" fill="none" stroke={INK} strokeWidth="6" opacity="0.15" />
      <path d="M620 260V190M620 260l50 28" stroke={A} strokeWidth="10" strokeLinecap="round" className="dk-art-spin" style={{ transformOrigin: "620px 260px" }} />
      <rect x="560" y="410" width="150" height="70" rx="16" fill={A} /><rect x="580" y="432" width="90" height="12" rx="6" fill="#ffffff" opacity="0.8" />
    </g>
  ),
  service: () => (
    <g>
      <Card x="70" y="90" w="660" h="420" r="26" fill="#f6f6f6" />
      {[[170, 190], [370, 190], [570, 190], [170, 380], [370, 380], [570, 380]].map(([x, y], i) => (
        <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.2}s` }}>
          <circle cx={x} cy={y} r="48" fill={i % 3 === 1 ? A : "#f33c20"} />
          {[0, 90, 180, 270].map((a) => <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * 72} cy={y + Math.sin((a * Math.PI) / 180) * 72} r="14" fill={INK} opacity="0.55" />)}
        </g>
      ))}
    </g>
  ),
  qr: () => (
    <g>
      <rect x="260" y="60" width="280" height="480" rx="38" fill={INK} />
      <rect x="274" y="84" width="252" height="432" rx="26" fill={CREAM} />
      {Array.from({ length: 49 }).map((_, i) => ((i * 7 + (i >> 2)) % 3 !== 0) && <rect key={i} x={320 + (i % 7) * 24} y={170 + Math.floor(i / 7) * 24} width="20" height="20" rx="4" fill={INK} />)}
      {[[300, 150], [454, 150], [300, 304]].map(([x, y], i) => <rect key={i} x={x} y={y} width="46" height="46" rx="10" fill="none" stroke={A} strokeWidth="8" />)}
      <rect x="276" y="320" width="248" height="6" fill={A} className="dk-art-scan" opacity="0.8" />
      <rect x="320" y="456" width="160" height="38" rx="19" fill={A} />
    </g>
  ),
  roles: () => (
    <g>
      <path d="M400 70l210 70v150c0 130-90 200-210 240C280 490 190 420 190 290V140z" fill={CREAM} />
      <path d="M400 110l170 56v124c0 104-72 160-170 192-98-32-170-88-170-192V166z" fill={A} />
      <circle cx="400" cy="270" r="44" fill={CREAM} /><rect x="386" y="290" width="28" height="86" rx="12" fill={CREAM} /><rect x="400" y="340" width="40" height="14" rx="7" fill={CREAM} /><rect x="400" y="366" width="28" height="12" rx="6" fill={CREAM} />
      {[[130, 160], [680, 200], [640, 450]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="22" fill={[AL, "#f66650", "#f77a67"][i]} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }} />)}
    </g>
  ),
  branches: () => (
    <g>
      <path d="M170 420C260 300 330 360 400 260S560 220 640 150" fill="none" stroke={INK} strokeWidth="5" strokeDasharray="10 12" className="dk-art-dash" opacity="0.6" />
      {[[170, 420], [400, 260], [640, 150], [560, 440]].map(([x, y], i) => (
        <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.25}s` }}>
          <path d={`M${x} ${y}c-58-60-58-120 0-120s58 60 0 120z`} transform={`translate(0 ${-0})`} fill={i === 1 ? A : AL} />
          <circle cx={x} cy={y - 66} r="20" fill="#ffffff" />
        </g>
      ))}
    </g>
  ),
  backoffice: () => (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`rotate(${[-8, 3, 9][i]} 400 320)`} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }}>
          <rect x={210 + i * 40} y={110 + i * 20} width="260" height="340" rx="16" fill={i === 1 ? "#ffffff" : CREAM} stroke={INK} strokeOpacity="0.1" strokeWidth="2" />
          {[0, 1, 2, 3].map((k) => <rect key={k} x={236 + i * 40} y={170 + i * 20 + k * 40} width={190 - k * 24} height="10" rx="5" fill={INK} opacity="0.22" />)}
          <rect x={236 + i * 40} y={134 + i * 20} width="80" height="16" rx="8" fill={A} />
        </g>
      ))}
      <Card x="520" y="150" w="170" h="170" r="18" fill="#f66650" className="dk-art-bob" /><rect x="544" y="180" width="110" height="10" rx="5" fill={INK} opacity="0.4" /><rect x="544" y="206" width="90" height="10" rx="5" fill={INK} opacity="0.3" />
    </g>
  ),
  guests: () => (
    <g>
      {[[250, 250, 80], [450, 230, 100], [560, 360, 70], [340, 390, 62]].map(([x, y, r], i) => (
        <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }}>
          <circle cx={x} cy={y} r={r} fill={[A, AL, "#dc270c", "#d1250b"][i]} />
          <circle cx={x} cy={y - r * 0.2} r={r * 0.32} fill={CREAM} /><path d={`M${x - r * 0.6} ${y + r * 0.7}a${r * 0.6} ${r * 0.5} 0 0 1 ${r * 1.2} 0z`} fill={CREAM} />
        </g>
      ))}
      <path d="M610 130l10 24 26 2-20 17 7 26-23-14-23 14 7-26-20-17 26-2z" fill="#f66650" className="dk-art-spin" style={{ transformOrigin: "610px 160px" }} />
    </g>
  ),
  menu: () => (
    <g>
      <circle cx="400" cy="320" r="190" fill={CREAM} /><circle cx="400" cy="320" r="150" fill="#ffffff" stroke={INK} strokeOpacity="0.08" strokeWidth="4" />
      <circle cx="400" cy="320" r="96" fill="#f5573e" /><circle cx="370" cy="300" r="30" fill="#d1250b" /><circle cx="438" cy="330" r="26" fill={A} /><circle cx="404" cy="360" r="18" fill="#f66650" />
      <rect x="120" y="190" width="14" height="260" rx="7" fill={INK} opacity="0.7" /><rect x="660" y="190" width="14" height="260" rx="7" fill={INK} opacity="0.7" />
      <g className="dk-art-spin" style={{ transformOrigin: "400px 320px" }}>{[0, 1, 2, 3].map((i) => <circle key={i} cx={400 + Math.cos((i * Math.PI) / 2) * 210} cy={320 + Math.sin((i * Math.PI) / 2) * 210} r="12" fill={A} />)}</g>
    </g>
  ),
};
Object.assign(scenes, storyScenes);
scenes.tracking = scenes.orders;
scenes.offers = scenes.promotions;

/** feature slug -> scene */
export const artFor = {
  promotions: "promotions", events: "night", kitchen: "cook", orders: "orders", staff: "staff", inventory: "inventory",
  loyalty: "loyalty", menu: "food-biryani", service: "service", payments: "pay", analytics: "analytics", branches: "p-branches",
  roles: "p-access", "guest-app": "order", "back-office": "backoffice", reservations: "bookings", celebrations: "night",
  catering: "food-pizza", prebookings: "p-food", attendance: "staff", salary: "p-cash", careers: "staff",
  "kitchen-management": "operations", "service-management": "serve", offers: "post-offer", guests: "b-guests",
  "order-tracking": "p-food",
};

export default function Art({ kind = "kitchen", dark = true, className = "", title }) {
  const Scene = scenes[kind] || scenes.menu;
  const id = `${kind}${dark ? "d" : "l"}`.replace(/[^a-z0-9]/gi, "");
  const [failed, setFailed] = useState(false);
  const photo = USE_STOCK_PHOTOS && !failed ? sceneImages[kind] : null;
  const svg = (
    <svg
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      className={`block h-full w-full ${photo ? "" : className}`}
      role={title && !photo ? "img" : undefined}
      aria-label={title}
      aria-hidden={title && !photo ? undefined : true}
    >
      <Backdrop id={id} dark={dark} />
      <Scene d={dark} />
    </svg>
  );
  if (!photo) return svg;
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {svg}
      <img
        src={photo}
        alt={title || ""}
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
