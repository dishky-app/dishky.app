import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const STAGES = ["Applied", "Interview", "Offer", "Joined"];
const LEVELS = [["Level 1", "Orientation"], ["Level 2", "Station basics"], ["Level 3", "Service skills"], ["Level 4", "Lead a shift"]];

export default function CareersPage({ m }) {
  const sky = mk({ bg: "#f4f4f4", card: "#ffffff", accent: "#f3391d" });
  const navy = mk({ dark: true, bg: "#222222", card: "rgba(255,255,255,0.06)", accent: "#f89181", onAccent: "#222222" });
  const [cands, setCands] = useState([["Candidate A", 0], ["Candidate B", 0], ["Candidate C", 1], ["Candidate D", 2], ["Candidate E", 1]]);
  const [lvl, setLvl] = useState(1);
  const adv = (i) => setCands((c) => c.map((x, k) => (k === i ? [x[0], Math.min(3, x[1] + 1)] : x)));
  return (
    <>
      <Sec t={sky} style={heroPad}>
        <HeroText m={m} t={sky} tryLabel="Open the board" />
        <Reveal className="mt-8"><div className="grid gap-3 overflow-x-auto md:grid-cols-4">
          {STAGES.map((s, c) => (
            <div key={s} className="min-h-[200px] min-w-[200px] rounded-2xl p-3" style={{ background: "#ededed" }}>
              <p className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-widest" style={{ color: sky.accent }}>{s}<span>{cands.filter((x) => x[1] === c).length}</span></p>
              <div className="space-y-2">{cands.map((x, i) => x[1] === c && (
                <motion.button layout layoutId={x[0]} key={x[0]} onClick={() => adv(i)} disabled={c === 3} className="flex min-h-[48px] w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm font-bold shadow">{x[0]}{c < 3 && <ArrowRight size={14} style={{ color: sky.accent }} />}</motion.button>
              ))}</div>
            </div>
          ))}
        </div><p className="mt-3 text-center text-sm" style={{ color: mute(sky) }}>Tap a candidate to move them forward. Sample data.</p></Reveal>
      </Sec>
      <Sec t={navy}>
        <Title dark left eyebrow="Grow your team" sub="Every hire follows a training path. Tap a level.">Climb the ladder.</Title>
        <div className="flex items-end gap-2 md:gap-4">
          {LEVELS.map(([n, d], i) => (
            <button key={n} onClick={() => setLvl(i)} aria-pressed={lvl === i} className="min-w-0 flex-1 break-words text-left">
              <motion.div animate={{ height: 90 + i * 55 }} className="flex flex-col justify-end rounded-t-2xl p-3 md:p-5" style={{ background: i <= lvl ? navy.accent : "rgba(255,255,255,0.08)", color: i <= lvl ? navy.onAccent : "#ffffff" }}>
                <p className="font-display text-[11px] font-bold opacity-70">{n}</p><p className="font-display text-sm font-extrabold md:text-xl">{d}</p>
              </motion.div>
            </button>
          ))}
        </div>
        <div className="h-1.5 rounded-b" style={{ background: navy.accent }} />
      </Sec>
      <Block t={sky} left eyebrow="Hiring toolkit" title="What careers & training covers."><Features v="grid" m={m} t={sky} /></Block>
      <Block t={navy} title="Try it live." eyebrow="Interactive"><TryDemo m={m} t={navy} /></Block>
      <Block t={sky} eyebrow="Applicant to lead" title="A career, step by step."><Journey v="timeline" m={m} t={sky} /></Block>
      <Sec t={navy}><Stats v="line" m={m} t={navy} /></Sec>
      <Block t={sky} eyebrow="The gap" title="Resumes in chats vs. a pipeline."><Gaps v="cards" m={m} t={sky} /></Block>
      {m.extra && <Block t={navy} title="Another routine."><TryDemo m={m} t={navy} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={sky} left title="Who hires and trains." eyebrow="Real moments"><Uses v="quotes" m={m} t={sky} /></Block>
      <Block t={navy} title="Live in three steps."><Steps v="row" m={m} t={navy} /></Block>
      <Block t={sky} title="Questions, answered."><Faq m={m} t={sky} /></Block>
    </>
  );
}
