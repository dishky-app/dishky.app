import React, { useState } from "react";
import { motion } from "framer-motion";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const QR = Array.from({ length: 121 }, (_, i) => { const r = Math.floor(i / 11), c = i % 11; const finder = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3); return finder || ((r * 7 + c * 13 + r * c) % 3 === 0); });

function PhoneShell({ children, className = "" }) {
  return (
    <div className={`relative mx-auto h-[500px] w-[250px] shrink-0 rounded-[2.6rem] border-[9px] border-ink bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.5)] ${className}`}>
      <span className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink" />
      <div className="absolute inset-0 overflow-hidden rounded-[1.9rem]">{children}</div>
    </div>
  );
}

function ScanScreen({ color }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#ececec] px-6 pt-6">
      <p className="font-display text-sm font-extrabold text-ink">Table 7 · Scan to start</p>
      <div className="relative grid aspect-square w-full grid-cols-11 gap-[2px] rounded-xl bg-white p-3 shadow-inner">
        {QR.map((on, i) => <span key={i} className="aspect-square rounded-[1px]" style={{ background: on ? "#0a0a0a" : "transparent" }} />)}
        <motion.span className="absolute inset-x-1 h-1 rounded-full" style={{ background: color, boxShadow: `0 0 18px 4px ${color}` }} animate={{ top: ["6%", "92%", "6%"] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <p className="text-[11px] text-ink/50">No app to install</p>
    </div>
  );
}

function FeatureScreen({ f, i, color }) {
  return (
    <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex h-full flex-col justify-end gap-3 p-5 pb-8" style={{ background: `linear-gradient(160deg, ${color}22, #ffffff 55%)` }}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: color }}><f.icon size={26} /></span>
      <p className="font-display text-2xl font-extrabold leading-tight text-ink">{f.title}</p>
      <p className="text-sm text-ink/60">{f.tip}</p>
      <span className="mt-2 rounded-full py-2.5 text-center text-xs font-bold text-white" style={{ background: color }}>Continue</span>
    </motion.div>
  );
}

export default function GuestAppPage({ m }) {
  const t = mk({ bg: "#f7f7f7", accent: m.color });
  const alt = mk({ bg: "#e8e8e8", accent: m.color });
  const dk = mk({ dark: true, bg: "#0c0c0c", accent: m.color, card: "rgba(255,255,255,0.05)" });
  const [a, setA] = useState(0);
  return (
    <>
      <Sec t={t} style={heroPad} className="overflow-hidden">
        <div aria-hidden="true" className="absolute -right-24 top-10 h-[520px] w-[520px] rounded-full opacity-[0.05] blur-3xl" style={{ background: "#000000" }} />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <HeroText m={m} t={t} tryLabel="See the flow" />
          <motion.div initial={{ opacity: 0, y: 60, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="relative">
            <PhoneShell><ScanScreen color={m.color} /></PhoneShell>
            <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -left-2 top-16 hidden rounded-2xl bg-white px-4 py-3 text-sm font-bold shadow-xl md:block">📱 Scan</motion.span>
            <motion.span animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity }} className="absolute -right-2 bottom-24 hidden rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white shadow-xl md:block">✓ Paid</motion.span>
          </motion.div>
        </div>
      </Sec>

      <Sec t={alt}>
        <Title eyebrow="One scan, then this" left>The guest app, step by step.</Title>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_320px]">
          <ol className="space-y-4">
            {m.features.map((f, i) => (
              <motion.li key={f.title} onViewportEnter={() => setA(i)} viewport={{ amount: 0.8, margin: "-20% 0px -20% 0px" }} className="cursor-pointer" onClick={() => setA(i)}>
                <div className="flex gap-4 rounded-3xl border p-6 transition-all duration-500 lg:min-h-[130px]" style={{ background: a === i ? "#ffffff" : "transparent", borderColor: a === i ? m.color : line(t), boxShadow: a === i ? "0 18px 40px -22px rgba(0,0,0,0.35)" : "none" }}>
                  <span className="font-display text-4xl font-extrabold leading-none" style={{ color: a === i ? m.color : mute(t, 0.2) }}>{pad(i)}</span>
                  <div><p className="font-display text-xl font-extrabold">{f.title}</p><p className="mt-1 text-sm" style={{ color: mute(t) }}>{f.tip}</p></div>
                </div>
              </motion.li>
            ))}
          </ol>
          <div className="hidden lg:sticky lg:top-28 lg:block"><PhoneShell><FeatureScreen f={m.features[a]} i={a} color={m.color} /></PhoneShell></div>
        </div>
      </Sec>

      <Block t={t} title="Try it, right here." eyebrow="Interactive"><TryDemo m={m} t={t} /></Block>
      <Block t={dk} left eyebrow="A guest's evening" title="From the door to the receipt."><Journey v="strip" m={m} t={dk} /></Block>
      <Sec t={alt} tight><Stats v="line" m={m} t={alt} /></Sec>
      <Block t={t} title="What other apps make guests do." eyebrow="The gap"><Gaps v="cards" m={m} t={t} /></Block>
      {m.extra && <Block t={alt} title="And the routine." eyebrow="Try this too"><TryDemo m={m} t={alt} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={t} title="In the wild." eyebrow="Real moments"><Uses v="quotes" m={m} t={t} /></Block>
      <Block t={dk} title="Three steps, then you're live."><Steps v="row" m={m} t={dk} /></Block>
      <Block t={alt} title="Questions, answered."><Faq m={m} t={alt} /></Block>
    </>
  );
}
