import React from "react";
import { C, Person, Dish, Phone, Ticket, Table, Pin, Spark } from "./primitives.js";

const R = (x, y, w, h, fill, r = 10, extra = {}) => <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} rx={r} fill={fill} {...extra} />;
const Lines = ({ x, y, n = 3, w = 100, gap = 18, c = C.ink, o = 0.28 }) =>
  Array.from({ length: n }).map((_, i) => <rect key={i} x={x} y={y + i * gap} width={w - i * 16} height="8" rx="4" fill={c} opacity={o} />);

/** One storytelling scene per concept. Each reads at a glance: who, where, what is happening. */
export const storyScenes = {
  /* ---- The four stages of service ---- */
  order: () => (
    <g>
      <Table x={250} y={390} w={300} />
      <Dish x={330} y={384} r={34} kind="pasta" steam={false} />
      {/* QR table stand */}
      <g><path d="M470 390l-20-90h70l-20 90z" fill="#ffffff" /><rect x="456" y="310" width="52" height="52" rx="6" fill={C.cream} />{Array.from({ length: 16 }).map((_, i) => ((i * 5) % 3 !== 1) && <rect key={i} x={462 + (i % 4) * 11} y={316 + Math.floor(i / 4) * 11} width="8" height="8" fill={C.ink} />)}</g>
      <Person x={150} y={470} s={1.25} shirt={C.blue} phone skin={C.skin2} />
      <path d="M200 330L450 330" stroke={C.amber} strokeWidth="5" strokeDasharray="8 10" className="dk-art-dash" />
      <Phone x={560} y={110} w={150} h={290}>
        <rect x="14" y="20" width="106" height="14" rx="7" fill={C.amber} />
        {[0, 1, 2].map((i) => <g key={i}><rect x="14" y={50 + i * 66} width="106" height="56" rx="12" fill="#ffffff" /><circle cx="42" cy={78 + i * 66} r="16" fill={[C.gold, C.amberL, C.green][i]} /><rect x="68" y={68 + i * 66} width="44" height="8" rx="4" fill={C.ink} opacity="0.3" /></g>)}
        <rect x="14" y="248" width="106" height="14" rx="7" fill={C.amber} />
      </Phone>
      <Spark x={130} y={160} s={1} /><Spark x={700} y={450} s={0.8} delay={0.5} />
    </g>
  ),
  cook: () => (
    <g>
      <rect x="0" y="120" width="800" height="12" fill="#8a8a8a" />
      {[0, 1, 2, 3, 4].map((i) => <Ticket key={i} x={60 + i * 140} y={134} w={100} h={110 + (i % 2) * 24} tag={[C.amber, C.gold, C.green, C.amber, C.gold][i]} rot={[-2, 2, -1, 3, -2][i]} />)}
      <rect x="120" y="400" width="560" height="60" rx="10" fill="#2b2b2b" /><rect x="120" y="390" width="560" height="14" rx="6" fill="#444444" />
      {[210, 330, 450, 570].map((x, i) => <g key={x}><ellipse cx={x} cy="388" rx="46" ry="10" fill="#111111" />{[-20, 0, 20].map((o, k) => <path key={k} className="dk-art-flame" style={{ animationDelay: `${(i + k) * 0.15}s` }} d={`M${x + o} 384c-10-16 4-22 0-38 16 10 20 28 8 38z`} fill={k % 2 ? C.amberL : C.amber} />)}</g>)}
      <Person x={400} y={400} s={1.5} hat="chef" apron shirt="#f4f4f4" wave />
      <path d="M250 370c20-30 60-30 80 0z" fill="#bbbbbb" />
    </g>
  ),
  serve: () => (
    <g>
      <Table x={470} y={380} w={260} />
      {[0, 1].map((i) => <Person key={i} x={540 + i * 130} y={470} s={1.1} shirt={[C.green, C.gold][i]} skin={[C.skin2, C.skin3][i]} flip={i === 1} />)}
      <Dish x={620} y={374} r={30} kind="biryani" steam={false} />
      <Person x={250} y={480} s={1.45} tray shirt={C.amber} apron />
      <path d="M330 430l120-20" stroke={C.amber} strokeWidth="5" strokeDasharray="8 10" className="dk-art-dash" />
      <g className="dk-art-bob"><circle cx="150" cy="190" r="34" fill={C.amber} /><path d="M135 190l11 12 22-24" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
      <rect x="90" y="250" width="120" height="30" rx="15" fill="#ffffff" opacity="0.9" /><rect x="108" y="261" width="84" height="8" rx="4" fill={C.ink} opacity="0.3" />
    </g>
  ),
  pay: () => (
    <g>
      <Person x={230} y={480} s={1.45} phone shirt={C.blue} skin={C.skin2} />
      <Phone x={420} y={90} w={170} h={310}>
        <circle cx="77" cy="80" r="40" fill={C.green} /><path d="M58 80l14 14 28-30" stroke="#ffffff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="22" y="150" width="110" height="14" rx="7" fill={C.ink} opacity="0.35" /><rect x="40" y="176" width="74" height="10" rx="5" fill={C.ink} opacity="0.2" />
        <rect x="22" y="230" width="110" height="38" rx="19" fill={C.amber} />
      </Phone>
      <g className="dk-art-bob"><path d="M620 170h110v220l-14-10-14 10-14-10-14 10-14-10-14 10-14-10-14 10z" fill="#ffffff" /><Lines x={636} y={200} n={4} w={78} gap={22} /></g>
      {[0, 1, 2].map((i) => <ellipse key={i} cx="660" cy={450 - i * 16} rx="46" ry="14" fill={C.gold} stroke="#e4290c" strokeWidth="3" />)}
    </g>
  ),

  /* ---- What is Dishky ---- */
  platform: () => (
    <g>
      {[[400, 300, 200, 150], [400, 300, 520, 120], [400, 300, 600, 330], [400, 300, 520, 500], [400, 300, 280, 500], [400, 300, 180, 330], [400, 300, 280, 120]].map(([a, b, x, y], i) => <path key={i} d={`M${a} ${b}L${x} ${y}`} stroke={C.amber} strokeWidth="4" strokeDasharray="8 10" className="dk-art-dash" opacity="0.7" />)}
      {[[200, 150, C.gold], [520, 120, C.green], [600, 330, C.blue], [520, 500, C.amberL], [280, 500, C.gold], [180, 330, C.green], [280, 120, C.blue]].map(([x, y, f], i) => <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.25}s` }}><circle cx={x} cy={y} r="46" fill="#ffffff" /><circle cx={x} cy={y} r="30" fill={f} /></g>)}
      <circle cx="400" cy="300" r="92" fill={C.amber} className="dk-art-pulse" style={{ transformOrigin: "400px 300px" }} />
      <path d="M368 268h34c28 0 46 14 46 32s-18 32-46 32h-34z" fill="#ffffff" />
    </g>
  ),
  experience: () => (
    <g>
      <Phone x={290} y={80} w={200} h={360}>
        <rect x="16" y="20" width="136" height="90" rx="14" fill={C.amberL} /><Dish x={84} y={66} r={34} kind="curry" steam={false} />
        {[0, 1].map((i) => <g key={i}><rect x="16" y={126 + i * 72} width="136" height="60" rx="12" fill="#ffffff" /><circle cx="46" cy={156 + i * 72} r="18" fill={[C.gold, C.green][i]} /><Lines x={74} y={146 + i * 72} n={2} w={64} gap={16} /></g>)}
        <rect x="16" y="276" width="136" height="34" rx="17" fill={C.amber} />
      </Phone>
      {[[160, 200, "heart"], [620, 160, "star"], [640, 380, "heart"], [170, 400, "star"]].map(([x, y, k], i) => <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }}>{k === "heart" ? <path d={`M${x} ${y + 30}c-50-34-44-76-12-76 14 0 12 14 12 14s-2-14 12-14c32 0 38 42-12 76z`} fill={C.amber} transform={`translate(0 -6)`} /> : <Spark x={x} y={y} s={1.6} />}</g>)}
    </g>
  ),
  operations: () => (
    <g>
      <rect x="60" y="100" width="680" height="12" fill="#8a8a8a" />
      {[0, 1, 2].map((i) => <Ticket key={i} x={90 + i * 125} y={112} w={100} h={110} tag={[C.amber, C.gold, C.green][i]} rot={[-2, 2, -1][i]} />)}
      <Person x={560} y={440} s={1.3} hat="chef" apron shirt="#f4f4f4" />
      {[0, 1, 2].map((i) => <g key={i}>{R(70, 280 + i * 62, 360, 10, "#000000", 5, { opacity: 0.2 })}{[0, 1, 2, 3].map((k) => R(86 + k * 86, 244 + i * 62, 64, 36, [C.wood, C.woodL, C.gold, C.green][(i + k) % 4], 8))}</g>)}
    </g>
  ),

  /* ---- Daily problems (each shows the pain, resolved) ---- */
  "p-lost": () => (
    <g>
      {[[120, 120, -14], [300, 80, 8], [210, 250, -6]].map(([x, y, r], i) => <g key={i} opacity="0.55"><Ticket x={x} y={y} w={90} h={110} rot={r} tag={C.ink} /></g>)}
      <path d="M380 300h90" stroke={C.amber} strokeWidth="6" strokeLinecap="round" /><path d="M456 280l26 20-26 20" stroke={C.amber} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {R(520, 120, 220, 340, C.ink, 18)}
      {[0, 1, 2].map((i) => <g key={i}>{R(536, 140 + i * 100, 188, 80, "#ffffff", 12)}{R(550, 156 + i * 100, 70, 12, [C.amber, C.gold, C.green][i], 6)}<Lines x={550} y={182 + i * 100} n={2} w={150} gap={16} /></g>)}
    </g>
  ),
  "p-stock": () => (
    <g>
      {R(100, 150, 600, 14, C.ink, 7, { opacity: 0.4 })}{R(100, 310, 600, 14, C.ink, 7, { opacity: 0.4 })}
      {[0, 1, 2, 3].map((i) => R(130 + i * 140, 70, 90, 80, i === 2 ? "none" : C.cream, 14, { stroke: i === 2 ? C.amber : "none", strokeWidth: 4, strokeDasharray: "8 8" }))}
      {[0, 1, 3].map((i) => R(138 + i * 140, 150 - 44, 74, 44, [C.amber, C.gold, C.green][i % 3], 10, { opacity: 0.8 }))}
      {[0, 1, 2, 3].map((i) => R(130 + i * 140, 224, 90, 86, i === 1 ? "none" : C.wood, 10, { stroke: i === 1 ? C.amber : "none", strokeWidth: 4, strokeDasharray: "8 8" }))}
      <g className="dk-art-pulse"><circle cx="400" cy="440" r="56" fill={C.amber} /><path d="M400 412v32M400 458v4" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" /></g>
      {R(480, 410, 200, 60, "#ffffff", 30)}<Lines x={510} y={428} n={2} w={140} gap={16} />
    </g>
  ),
  "p-access": () => (
    <g>
      <g className="dk-art-bob"><rect x="270" y="210" width="260" height="210" rx="26" fill={C.amber} /><path d="M320 210v-50a80 80 0 0 1 160 0v50" fill="none" stroke={C.cream} strokeWidth="26" /><circle cx="400" cy="300" r="26" fill={C.cream} /><rect x="390" y="310" width="20" height="56" rx="8" fill={C.cream} /></g>
      {[[130, 180, C.green, "Chef"], [660, 190, C.gold, "Cashier"], [140, 400, C.blue, "Server"], [660, 410, C.amberL, "Owner"]].map(([x, y, f, t], i) => <g key={t} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }}><circle cx={x} cy={y} r="42" fill={f} /><circle cx={x} cy={y - 8} r="14" fill="#ffffff" /><path d={`M${x - 22} ${y + 26}a22 18 0 0 1 44 0z`} fill="#ffffff" /></g>)}
    </g>
  ),
  "p-cash": () => (
    <g>
      <path d="M400 200v260M270 460h260" stroke={C.ink} strokeWidth="12" strokeLinecap="round" />
      <path d="M220 230h360" stroke={C.ink} strokeWidth="10" strokeLinecap="round" />
      <path d="M220 230l-70 130h140zM580 230l-70 130h140z" fill={C.cream} stroke={C.ink} strokeWidth="6" />
      {[0, 1, 2].map((i) => <ellipse key={i} cx="220" cy={346 - i * 14} rx="40" ry="12" fill={C.gold} stroke="#e4290c" strokeWidth="3" />)}
      {R(540, 320, 80, 40, C.green, 8)}<circle cx="580" cy="340" r="10" fill="#ffffff" />
      <circle cx="400" cy="160" r="44" fill={C.green} className="dk-art-pop" /><path d="M380 160l14 14 26-30" stroke="#ffffff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  "p-double": () => (
    <g>
      <g><circle cx="400" cy="340" r="80" fill={C.wood} />{[0, 90, 180, 270].map((a) => <circle key={a} cx={400 + Math.cos((a * Math.PI) / 180) * 118} cy={340 + Math.sin((a * Math.PI) / 180) * 118} r="18" fill={C.ink} opacity="0.5" />)}</g>
      {R(110, 110, 230, 96, "#ffffff", 18, { opacity: 0.55, stroke: C.amber, strokeWidth: 3, strokeDasharray: "8 8" })}
      {R(470, 110, 230, 96, "#ffffff", 18)}<circle cx="504" cy="158" r="18" fill={C.amber} /><Lines x={534} y={146} n={2} w={140} gap={16} />
      <path d="M340 160h130" stroke={C.amber} strokeWidth="6" strokeDasharray="8 10" className="dk-art-dash" />
      <g className="dk-art-bob"><rect x="300" y="440" width="200" height="54" rx="27" fill={C.green} /><path d="M340 468l12 12 24-26" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /><rect x="392" y="462" width="80" height="10" rx="5" fill="#ffffff" opacity="0.8" /></g>
    </g>
  ),
  "p-branches": () => (
    <g>
      <path d="M130 410C230 280 300 360 400 250S560 220 670 150" fill="none" stroke={C.ink} strokeWidth="4" strokeDasharray="10 12" className="dk-art-dash" opacity="0.5" />
      {[[130, 410], [400, 250], [670, 150], [560, 440]].map(([x, y], i) => <Pin key={i} x={x} y={y} fill={i === 1 ? C.amber : C.amberL} delay={i * 0.25} />)}
      <Phone x={300} y={290} w={150} h={250} tilt={-6}>{[0, 1, 2].map((i) => R(14, 24 + i * 66, 106, 50, "#ffffff", 10))}{R(14, 20, 106, 10, C.amber, 5)}</Phone>
    </g>
  ),
  "p-menu": () => (
    <g>
      <rect x="260" y="60" width="280" height="480" rx="38" fill={C.ink} /><rect x="274" y="84" width="252" height="432" rx="26" fill={C.cream} />
      {Array.from({ length: 49 }).map((_, i) => ((i * 7 + (i >> 2)) % 3 !== 0) && <rect key={i} x={320 + (i % 7) * 24} y={170 + Math.floor(i / 7) * 24} width="20" height="20" rx="4" fill={C.ink} />)}
      {[[300, 150], [454, 150], [300, 304]].map(([x, y], i) => <rect key={i} x={x} y={y} width="46" height="46" rx="10" fill="none" stroke={C.amber} strokeWidth="8" />)}
      <rect x="276" y="320" width="248" height="6" fill={C.amber} className="dk-art-scan" opacity="0.8" />
      <Dish x={130} y={440} r={64} kind="biryani" /><Dish x={690} y={190} r={50} kind="drink" steam={false} />
    </g>
  ),
  "p-food": () => (
    <g>
      <circle cx="400" cy="300" r="150" fill="#ffffff" opacity="0.8" /><circle cx="400" cy="300" r="132" fill="none" stroke={C.ink} strokeOpacity="0.15" strokeWidth="6" />
      <path d="M400 300V190M400 300l78 46" stroke={C.amber} strokeWidth="12" strokeLinecap="round" className="dk-art-spin" style={{ transformOrigin: "400px 300px", animationDuration: "8s" }} />
      <circle cx="400" cy="300" r="12" fill={C.ink} />
      <Dish x={640} y={440} r={70} kind="pasta" /><path d="M300 440h250" stroke={C.amber} strokeWidth="6" strokeDasharray="8 10" className="dk-art-dash" />
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={140 + i * 36} cy="440" r="12" fill={i < 3 ? C.green : "#dddddd"} />)}
    </g>
  ),
  "p-ingredients": () => (
    <g>
      <Dish x={400} y={320} r={140} kind="salad" />
      {[[170, 160, "Tomato", C.amber], [650, 150, "Basil", C.green], [680, 360, "Olive oil", C.gold], [140, 400, "Feta", C.cream]].map(([x, y, t, f], i) => <g key={t} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }}>{R(x - 70, y - 24, 140, 48, "#ffffff", 24)}<circle cx={x - 44} cy={y} r="12" fill={f} stroke="#00000022" /><rect x={x - 22} y={y - 5} width="64" height="10" rx="5" fill={C.ink} opacity="0.3" /></g>)}
    </g>
  ),
  "p-bill": () => (
    <g>
      <Person x={220} y={480} s={1.45} phone shirt={C.green} skin={C.skin3} />
      <Phone x={440} y={80} w={160} h={300}><circle cx="72" cy="70" r="34" fill={C.green} /><path d="M56 70l12 12 24-26" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /><rect x="22" y="130" width="100" height="12" rx="6" fill={C.ink} opacity="0.3" /><rect x="22" y="236" width="100" height="36" rx="18" fill={C.amber} /></Phone>
      <g className="dk-art-bob"><circle cx="680" cy="190" r="50" fill="#ffffff" /><path d="M680 160v32l22 12" stroke={C.amber} strokeWidth="8" fill="none" strokeLinecap="round" /></g>
      <Dish x={660} y={420} r={52} kind="dessert" steam={false} />
    </g>
  ),

  /* ---- Benefits ---- */
  "b-guests": () => (
    <g>
      {[[250, 300, 100, C.amber], [450, 260, 120, C.gold], [600, 380, 80, C.green], [340, 430, 70, C.blue]].map(([x, y, r, f], i) => <g key={i} className="dk-art-bob" style={{ animationDelay: `${i * 0.3}s` }}><circle cx={x} cy={y} r={r} fill={f} /><circle cx={x - r * 0.3} cy={y - r * 0.15} r={r * 0.09} fill={C.ink} /><circle cx={x + r * 0.3} cy={y - r * 0.15} r={r * 0.09} fill={C.ink} /><path d={`M${x - r * 0.4} ${y + r * 0.2}q${r * 0.4} ${r * 0.45} ${r * 0.8} 0`} stroke={C.ink} strokeWidth={r * 0.08} fill="none" strokeLinecap="round" /></g>)}
      <path d="M130 140c-40-26-34-60-10-60 12 0 10 12 10 12s-2-12 10-12c24 0 30 34-10 60z" fill={C.amber} className="dk-art-pulse" />
    </g>
  ),
  "b-flow": () => (
    <g>
      {[0, 1, 2].map((i) => <g key={i}><Ticket x={90 + i * 230} y={170} w={110} h={150} tag={[C.gold, C.amber, C.green][i]} />{i < 2 && <path d={`M${215 + i * 230} 250h80`} stroke={C.amber} strokeWidth="6" strokeDasharray="8 10" className="dk-art-dash" />}</g>)}
      <Person x={150} y={500} s={1.1} hat="chef" apron shirt="#f4f4f4" /><Person x={640} y={500} s={1.1} shirt={C.amber} tray flip />
    </g>
  ),

  /* ---- Promotion feed posts ---- */
  "post-spotlight": () => (
    <g>
      <path d="M400 0L240 330h320z" fill="#ffffff" opacity="0.18" />
      <Dish x={400} y={360} r={150} kind="curry" /><Spark x={170} y={170} s={1.6} /><Spark x={650} y={220} s={1.2} delay={0.4} />
    </g>
  ),
  "post-collab": () => (
    <g>
      <Person x={250} y={500} s={1.7} hat="chef" apron shirt="#f4f4f4" /><Person x={560} y={500} s={1.7} shirt={C.blue} phone flip skin={C.skin2} />
      <g className="dk-art-bob"><circle cx="400" cy="200" r="48" fill={C.amber} /><path d="M378 204l16 14 30-34" stroke="#ffffff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
  ),
  "post-offer": () => (
    <g>
      <g className="dk-art-bob" style={{ transformOrigin: "400px 300px" }}><path d="M180 220h300l130 80-130 80H180z" fill={C.amber} /><circle cx="236" cy="300" r="22" fill={C.cream} /></g>
      <text x="290" y="318" fontSize="86" fontWeight="800" fill="#ffffff" fontFamily="Sora, sans-serif">%</text>
      <Dish x={620} y={470} r={80} kind="dessert" steam={false} />
    </g>
  ),
  "post-launch": () => (
    <g>
      {R(150, 220, 500, 250, C.cream, 12)}{R(150, 190, 500, 60, C.amber, 12)}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <path key={i} d={`M${160 + i * 62} 250h56v22a28 22 0 0 1-56 0z`} fill={i % 2 ? "#ffffff" : C.amberL} />)}
      {R(340, 340, 120, 130, C.wood, 10)}{R(180, 320, 130, 90, C.gold, 10, { opacity: 0.55 })}{R(490, 320, 130, 90, C.gold, 10, { opacity: 0.55 })}
      <path d="M130 150l60 40M670 150l-60 40M400 110v70" stroke={C.gold} strokeWidth="8" strokeLinecap="round" className="dk-art-pulse" />
    </g>
  ),

  /* ---- Before / after, closing ---- */
  chaos: () => (
    <g opacity="0.9">
      {Array.from({ length: 12 }).map((_, i) => <Ticket key={i} x={30 + (i * 137) % 700} y={30 + (i * 89) % 380} w={80} h={96} rot={((i * 37) % 50) - 25} tag={[C.ink, C.amber, C.gold][i % 3]} />)}
      <g transform="translate(560 380)"><rect width="150" height="70" rx="10" fill={C.ink} /><rect x="10" y="10" width="130" height="50" rx="6" fill="#444444" /></g>
    </g>
  ),
  calm: () => (
    <g>
      {R(120, 120, 560, 330, C.ink, 22, { opacity: 0.88 })}
      {[0, 1, 2].map((i) => <g key={i}>{R(150 + i * 176, 150, 156, 270, "#ffffff", 14, { opacity: 0.1 })}{[0, 1].map((k) => R(160 + i * 176, 168 + k * 100, 136, 82, "#ffffff", 12))}</g>)}
      <Spark x={700} y={110} s={1.3} />
    </g>
  ),
  cta: () => (
    <g>
      <rect y="0" width="800" height="380" fill="#000000" opacity="0.15" />
      {[130, 260, 400, 540, 670].map((x, i) => <g key={x}><path d={`M${x} 0v${70 + (i % 2) * 24}`} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="3" /><circle cx={x} cy={80 + (i % 2) * 24} r="24" fill={C.gold} className="dk-art-pulse" style={{ animationDelay: `${i * 0.25}s` }} /><circle cx={x} cy={80 + (i % 2) * 24} r="60" fill={C.gold} opacity="0.12" /></g>)}
      <Table x={180} y={410} w={440} /><Dish x={290} y={402} r={44} kind="pizza" steam /><Dish x={420} y={402} r={40} kind="salad" steam={false} /><Dish x={540} y={402} r={34} kind="drink" steam={false} />
      <Person x={90} y={500} s={1.2} shirt={C.amber} tray apron /><Person x={720} y={500} s={1.2} shirt={C.blue} flip skin={C.skin2} />
    </g>
  ),
  night: () => (
    <g>
      <path d="M40 110C200 200 360 200 400 130S620 60 760 150" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="4" />
      {[90, 190, 300, 420, 530, 650, 740].map((x, i) => <circle key={x} cx={x} cy={160 + (i % 2) * 20} r="14" fill={[C.gold, C.amber, C.amberL, C.green, C.gold, C.amber, C.gold][i]} className="dk-art-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
      {[200, 400, 600].map((x, i) => <g key={x}><circle cx={x} cy="400" r="62" fill={C.wood} /><circle cx={x} cy="400" r="48" fill="#ffffff" opacity="0.9" /><Dish x={x} y={400} r={34} kind={["curry", "pizza", "dessert"][i]} steam={false} /></g>)}
      <Person x={110} y={520} s={1.2} shirt={C.amber} tray flip /><Person x={700} y={520} s={1.2} shirt={C.blue} skin={C.skin2} />
    </g>
  ),

  /* ---- City branches ---- */
  "city-chennai": () => (
    <g>
      <rect y="400" width="800" height="200" fill="#f33619" opacity="0.45" />
      <path d="M0 440q100-26 200 0t200 0 200 0 200 0" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="5" fill="none" className="dk-art-dash" />
      <path d="M520 400l16-220h48l16 220z" fill="#ffffff" /><path d="M524 300h92M528 240h84" stroke={C.amber} strokeWidth="14" /><rect x="530" y="160" width="76" height="28" rx="6" fill={C.gold} className="dk-art-pulse" /><path d="M520 160h96l-48-42z" fill={C.amber} />
      {[[110, 420], [220, 440]].map(([x, y], i) => <g key={i}><path d={`M${x} ${y}v-130`} stroke="#e4290c" strokeWidth="12" /><path d={`M${x} ${y - 130}q-60-14-84 30M${x} ${y - 130}q60-14 84 30M${x} ${y - 130}q-30-50-70-40M${x} ${y - 130}q30-50 70-40`} stroke={C.green} strokeWidth="14" fill="none" strokeLinecap="round" /></g>)}
    </g>
  ),
  "city-madurai": () => (
    <g>
      {[0, 1, 2, 3, 4, 5].map((i) => R(220 + i * 8, 420 - i * 52, 360 - i * 16, 52, i % 2 ? C.amberL : C.cream, 4))}
      {R(380, 90, 40, 40, C.gold, 8)}<path d="M360 90h80l-40-46z" fill={C.amber} />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="340" y={402 - i * 52} width="120" height="16" rx="4" fill={C.wood} opacity="0.7" />)}
      {R(180, 420, 440, 40, C.wood, 6)}
    </g>
  ),
  "city-coimbatore": () => (
    <g>
      <path d="M0 440L180 200l120 160 130-220 150 240 220-160v380H0z" fill="#e4290c" opacity="0.8" /><path d="M0 500L220 320l140 120 120-100 320 160v80H0z" fill="#e4290c" />
      {R(560, 280, 80, 160, C.cream, 4)}{R(580, 200, 24, 90, "#8a8a8a", 4)}<circle cx="592" cy="190" r="22" fill="#ffffff" opacity="0.5" className="dk-art-bob" />
      {R(470, 360, 80, 80, C.amberL, 4)}{R(520, 330, 60, 110, C.wood, 4)}
    </g>
  ),
};

/** Food-only scenes for menu cards and demos. */
["curry", "biryani", "pasta", "dessert", "salad", "pizza", "steak", "drink"].forEach((k) => {
  storyScenes[`food-${k}`] = () => (
    <g>
      <rect y="360" width="800" height="240" fill={C.wood} opacity="0.55" />
      <ellipse cx="400" cy="470" rx="220" ry="26" fill="#000000" opacity="0.2" />
      <Dish x={400} y={330} r={190} kind={k} />
      <Spark x={110} y={150} s={1.1} /><Spark x={700} y={120} s={0.9} delay={0.6} />
    </g>
  );
});
