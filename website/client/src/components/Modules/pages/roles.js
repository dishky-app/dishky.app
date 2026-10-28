import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { mk, mute, line, Sec, Block, HeroText, heroPad, TryDemo, Features, Journey, Stats, Gaps, Uses, Steps, Faq, Title, Reveal, pad } from "./parts/kit.js";

const ROLES = ["Owner", "Manager", "Server", "Chef"];
const PERMS = ["Orders", "Menu", "Inventory", "Salary", "Reports", "Roles"];
const INIT = [[1, 1, 1, 1], [1, 1, 0, 0], [1, 1, 0, 1], [0, 1, 0, 0], [1, 1, 0, 0], [1, 0, 0, 0]].map((r) => r.map(Boolean));
const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function RolesPage({ m }) {
  const term = mk({ dark: true, bg: "#0b0b0b", card: "rgba(255,255,255,0.04)", accent: "#f33214", onAccent: "#0b0b0b" });
  const light = mk({ bg: "#f2f2f2", card: "#ffffff", accent: "#e4290c" });
  const [g, setG] = useState(INIT);
  const [log, setLog] = useState([]);
  const [role, setRole] = useState(1);
  const tog = (p, r) => { setG((x) => x.map((row, i) => (i === p ? row.map((v, j) => (j === r ? !v : v)) : row))); setLog((l) => [`${stamp()}  ${ROLES[r]} · ${PERMS[p]} → ${!g[p][r] ? "allowed" : "blocked"}`, ...l].slice(0, 5)); };
  return (
    <>
      <Sec t={term} style={heroPad} className="overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(#f33214 1px, transparent 1px)", backgroundSize: "100% 4px" }} />
        <div className="relative">
          <HeroText m={m} t={term} h1Class="heading-hero font-display" tryLabel="Open the matrix" />
          <Reveal className="mt-8"><div className="overflow-x-auto rounded-2xl border" style={{ borderColor: line(term, 0.3), background: term.card }}>
            <table className="w-full min-w-[520px] border-collapse text-center text-sm">
              <thead><tr className="font-display text-xs" style={{ color: term.accent }}><th className="px-4 py-3 text-left">PERMISSION</th>{ROLES.map((r) => <th key={r} className="px-3 py-3">{r.toUpperCase()}</th>)}</tr></thead>
              <tbody>{PERMS.map((p, i) => (
                <tr key={p} className="border-t" style={{ borderColor: line(term) }}>
                  <th className="px-4 py-2 text-left font-display text-sm font-bold">{p}</th>
                  {ROLES.map((r, j) => <td key={r} className="p-1.5"><button role="switch" aria-checked={g[i][j]} aria-label={`${r} ${p}`} onClick={() => tog(i, j)} className="mx-auto flex h-11 w-16 items-center rounded-full border px-1 transition-colors" style={{ borderColor: g[i][j] ? term.accent : line(term, 0.3), background: g[i][j] ? `${term.accent}33` : "transparent" }}><motion.span layout className="flex h-8 w-8 items-center justify-center rounded-full" style={{ marginLeft: g[i][j] ? "auto" : 0, background: g[i][j] ? term.accent : "rgba(255,255,255,0.2)", color: term.onAccent }}>{g[i][j] ? <Check size={16} strokeWidth={3} /> : <Lock size={13} />}</motion.span></button></td>)}
                </tr>))}</tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border p-4 font-display text-xs" style={{ borderColor: line(term), color: mute(term, 0.75) }}><p style={{ color: term.accent }}>$ audit --tail</p>{log.length ? log.map((l, i) => <motion.p key={l + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>{l}</motion.p>) : <p>no changes yet. flip a switch above.</p>}</div></Reveal>
        </div>
      </Sec>
      <Sec t={light}>
        <Title eyebrow="Who sees what" sub="Pick a role to see the screens they get.">One login, the right screens.</Title>
        <div className="mx-auto max-w-3xl">
          <div role="tablist" className="mb-5 flex flex-wrap justify-center gap-2">{ROLES.map((r, i) => <button key={r} role="tab" aria-selected={role === i} onClick={() => setRole(i)} className="min-h-[44px] rounded-full border px-5 text-sm font-bold" style={role === i ? { background: light.accent, color: "#ffffff", borderColor: light.accent } : { borderColor: line(light, 0.25) }}>{r}</button>)}</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{PERMS.map((p, i) => <motion.div key={p} animate={{ opacity: g[i][role] ? 1 : 0.35, scale: g[i][role] ? 1 : 0.96 }} className="flex h-24 items-center justify-center gap-2 rounded-2xl border bg-white font-display text-lg font-extrabold" style={{ borderColor: g[i][role] ? light.accent : line(light) }}>{g[i][role] ? <Check size={18} style={{ color: light.accent }} /> : <Lock size={16} />}{p}</motion.div>)}</div>
        </div>
      </Sec>
      <Block t={term} left eyebrow="Controls" title="What roles & audit includes."><Features v="rows" m={m} t={term} /></Block>
      <Block t={light} title="Try the permissions panel." eyebrow="Interactive"><TryDemo m={m} t={light} /></Block>
      <Block t={term} eyebrow="Grant to audit" title="Access, step by step."><Journey v="steps" m={m} t={term} /></Block>
      <Sec t={light}><Stats v="ring" m={m} t={light} /></Sec>
      <Block t={term} eyebrow="The gap" title="Shared logins vs. real roles."><Gaps v="table" m={m} t={term} /></Block>
      {m.extra && <Block t={light} title="Another routine."><TryDemo m={m} t={light} name={m.extra} max="max-w-2xl" /></Block>}
      <Block t={term} left title="Who controls access." eyebrow="Real moments"><Uses v="list" m={m} t={term} /></Block>
      <Block t={light} title="Live in three steps."><Steps v="big" m={m} t={light} /></Block>
      <Block t={term} title="Questions, answered."><Faq m={m} t={term} /></Block>
    </>
  );
}
