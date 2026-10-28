import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCheck } from "lucide-react";
import Img from "../ui/Img.js";
import Count from "../ui/Count.js";
import { images } from "../../assets/images/imageUrls.js";

const CAMPAIGNS = [
  { key: "offer", label: "Weekend offer", img: images.pizza, text: "Weekend special: 20% off all mains. Show this at your table." },
  { key: "menu", label: "New menu", img: images.dishDessert, text: "Our new dessert menu is live. Scan, taste, enjoy." },
  { key: "event", label: "Event invite", img: images.dinnerEvent, text: "You're invited: Chef's Table night this Friday." },
];

/** Pick a campaign, send it, watch it land in a guest's chat. */
export default function CampaignChat() {
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [sent, setSent] = useState(0);
  const end = useRef(null);
  const timer = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs, typing]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const send = (c) => {
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setTyping(false); setMsgs((m) => [...m.slice(-2), { ...c, id: Date.now() }]); setSent((s) => s + 128); }, 900);
  };
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-ink/10 bg-white p-4 shadow-xl sm:grid-cols-[0.9fr_1.1fr] sm:p-6">
      <div>
        <p className="font-display text-sm font-bold">Send to your guests</p>
        <ul className="mt-3 space-y-2">
          {CAMPAIGNS.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => send(c)} style={{ minHeight: 0 }} className="group flex w-full items-center gap-3 rounded-2xl bg-ink/[0.05] p-2 text-left transition hover:bg-amber/10">
                <Img src={c.img} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
                <span className="flex-1 text-xs font-bold">{c.label}</span>
                <Send size={15} className="mr-1 text-amber transition group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs font-semibold text-ink/50">Delivered to <b className="font-display text-base text-ink"><Count value={sent} /></b> guests</p>
      </div>
      <div className="flex h-72 flex-col overflow-hidden rounded-2xl bg-[#eaeaea]">
        <div className="bg-[#e4290c] px-4 py-2.5 text-xs font-bold text-white">Your Restaurant</div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {msgs.length === 0 && !typing && <p className="pt-12 text-center text-xs text-ink/40">Pick a campaign to send.</p>}
          <AnimatePresence initial={false}>
            {msgs.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="ml-auto max-w-[85%] overflow-hidden rounded-2xl rounded-tr-sm bg-[#e8e8e8] shadow-sm">
                <Img src={m.img} alt="" className="aspect-[16/9] w-full" />
                <p className="px-3 pt-2 text-[11px] leading-snug text-ink/80">{m.text}</p>
                <p className="flex justify-end gap-1 px-3 pb-1.5 text-[10px] text-ink/40"><CheckCheck size={12} className="text-red-500" /></p>
              </motion.div>
            ))}
          </AnimatePresence>
          {typing && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-auto flex w-14 justify-center gap-1 rounded-2xl bg-[#e8e8e8] py-2.5">{[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-ink/40" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.12 }} />)}</motion.div>}
          <div ref={end} />
        </div>
      </div>
    </div>
  );
}
