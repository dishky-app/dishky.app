import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, ChevronLeft, ChevronRight, Sparkles, Handshake, BadgePercent, Rocket } from "lucide-react";
import Img from "../ui/Img.js";
import { BrandMark } from "../Brand/Brand.js";
import { images } from "../../assets/images/imageUrls.js";

const POSTS = [
  { tag: "Spotlight", icon: Sparkles, img: images.dishBiryani, tone: "#f33716", title: "Your Restaurant", line: "Come for the signature dish." },
  { tag: "Collab", icon: Handshake, img: images.chefPlating, tone: "#f66a55", title: "Dishky × Your Restaurant", line: "Made together. Served at your table." },
  { tag: "Offer", icon: BadgePercent, img: images.pizza, tone: "#ea2a0c", title: "This week only", line: "A limited-time special, live now." },
  { tag: "Launch", icon: Rocket, img: images.restaurantWarm, tone: "#e4290c", title: "Now open", line: "Our new branch is ready for you." },
];

/** A scrollable feed in the style of Dishky's social media. Tap the tags, swipe, like. */
export default function PromoCarousel({ dark = false }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [liked, setLiked] = useState({});
  const go = (n) => { setDir(n > i ? 1 : -1); setI((n + POSTS.length) % POSTS.length); };
  const p = POSTS[i];
  const Icon = p.icon;
  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {POSTS.map((x, n) => (
          <button key={x.tag} type="button" onClick={() => go(n)} style={{ minHeight: 34 }}
            className={`rounded-full px-3.5 text-xs font-bold transition ${n === i ? "bg-amber text-ink" : dark ? "bg-cream/10 text-cream/70" : "bg-ink/[0.07] text-ink/60"}`}>{x.tag}</button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute inset-x-6 top-10 h-3/4 rounded-full bg-neutral-500/25 blur-3xl" aria-hidden="true" />
        <article className="relative overflow-hidden rounded-[2rem] border border-ink/10 bg-white text-ink shadow-[0_30px_70px_-25px_rgba(0,0,0,0.5)]">
          <header className="flex items-center gap-2.5 px-4 py-3">
            <BrandMark className="h-7" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-bold leading-tight">dishky</p>
              <p className="text-[10px] text-ink/50">Sponsored collaboration</p>
            </div>
          </header>
          <div className="relative aspect-[4/5] overflow-hidden">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={i}
                custom={dir}
                initial={{ x: dir * 120, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir * -120, opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.4}
                onDragEnd={(_, info) => { if (info.offset.x < -60) go(i + 1); else if (info.offset.x > 60) go(i - 1); }}
                className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
              >
                <Img src={p.img} alt={p.title} tone={p.tone} className="h-full w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur"><Icon size={13} /> {p.tag}</span>
                <div className="absolute inset-x-5 bottom-5 text-white">
                  <p className="font-display text-xl font-extrabold leading-tight">{p.title}</p>
                  <p className="mt-1 text-sm text-white/85">{p.line}</p>
                </div>
              </motion.div>
            </AnimatePresence>
            <button type="button" aria-label="Previous post" onClick={() => go(i - 1)} style={{ minHeight: 0 }} className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink"><ChevronLeft size={18} /></button>
            <button type="button" aria-label="Next post" onClick={() => go(i + 1)} style={{ minHeight: 0 }} className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink"><ChevronRight size={18} /></button>
          </div>
          <footer className="flex items-center gap-4 px-4 py-3.5">
            <button type="button" aria-label="Like" onClick={() => setLiked((l) => ({ ...l, [i]: !l[i] }))} style={{ minHeight: 0 }} className="relative">
              <motion.span key={String(!!liked[i])} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 12 }} className="block">
                <Heart size={22} className={liked[i] ? "fill-amber text-amber" : "text-ink/70"} />
              </motion.span>
            </button>
            <MessageCircle size={22} className="text-ink/70" />
            <Send size={22} className="text-ink/70" />
            <span className="ml-auto flex gap-1.5">
              {POSTS.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-amber" : "w-1.5 bg-ink/20"}`} />)}
            </span>
          </footer>
        </article>
      </div>
    </div>
  );
}
