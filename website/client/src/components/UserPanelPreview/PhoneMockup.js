import Art from "../ui/Art.js";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, ShoppingCart, CreditCard, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import { images } from "../../assets/images/imageUrls.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";

const screens = [
  {
    id: "home",
    label: "Restaurant Home",
    render: () => (
      <div className="flex h-full flex-col p-4">
        <p className="font-display text-lg font-bold">Your Restaurant</p>
        <p className="text-xs text-ink/50">Table 12 · Chennai</p>
        <div className="mt-4 h-28 overflow-hidden rounded-2xl">
          <motion.div initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: "easeOut" }} className="h-full w-full">
            <Art kind="post-launch" dark={false} />
          </motion.div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/40">
          Categories
        </p>
        <div className="mt-2 flex gap-2">
          {["Starters", "Mains", "Drinks", "Desserts"].map((c) => (
            <span key={c} className="rounded-full bg-cream px-3 py-1 text-[10px] font-medium">
              {c}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "categories",
    label: "Categories",
    render: () => (
      <div className="flex h-full flex-col gap-2 p-4">
        <p className="font-display text-sm font-bold">Mains</p>
        {["Paneer Butter Masala", "Chicken Biryani", "Veg Fried Rice"].map((d) => (
          <div key={d} className="flex items-center justify-between rounded-xl bg-cream p-3">
            <span className="text-xs font-medium">{d}</span>
            <span className="text-xs font-bold text-amber">₹220</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "dish",
    label: "Dish Details",
    render: () => (
      <div className="flex h-full flex-col p-4">
        <div className="h-32 overflow-hidden rounded-2xl">
          <motion.div initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: "easeOut" }} className="h-full w-full">
            <Art kind="food-biryani" />
          </motion.div>
        </div>
        <p className="mt-3 font-display text-sm font-bold">Chicken Biryani</p>
        <p className="text-[10px] text-ink/50">Basmati rice, spiced chicken, saffron</p>
        <p className="mt-2 text-sm font-bold text-amber">₹260</p>
        <button className="mt-auto rounded-full bg-ink py-2 text-xs font-semibold text-cream">
          Add to Cart
        </button>
      </div>
    ),
  },
  {
    id: "cart",
    label: "Cart",
    render: () => (
      <div className="flex h-full flex-col p-4">
        <p className="font-display text-sm font-bold flex items-center gap-2">
          <ShoppingCart size={14} /> Your Cart
        </p>
        <div className="mt-3 space-y-2">
          {[
            ["Chicken Biryani", "₹260"],
            ["Paneer Butter Masala", "₹220"],
          ].map(([n, p]) => (
            <div key={n} className="flex justify-between text-xs">
              <span>{n}</span>
              <span className="font-semibold">{p}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex justify-between border-t border-ink/10 pt-3 text-sm font-bold">
          <span>Total</span>
          <span>₹480</span>
        </div>
      </div>
    ),
  },
  {
    id: "payment",
    label: "Payment",
    render: () => (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <CreditCard size={30} className="text-amber" />
        <p className="font-display text-sm font-bold">Confirm Payment</p>
        <p className="text-xs text-ink/50">₹480 · UPI</p>
        <button className="mt-2 rounded-full bg-amber px-6 py-2 text-xs font-semibold text-ink">
          Pay Now
        </button>
      </div>
    ),
  },
  {
    id: "tracking",
    label: "Order Tracking",
    render: () => (
      <div className="flex h-full flex-col justify-center gap-4 p-4">
        <p className="font-display text-sm font-bold flex items-center gap-2">
          <Truck size={14} /> Order #e4290c11
        </p>
        {["Placed", "Confirmed", "Preparing", "Ready"].map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${i <= 2 ? "bg-amber" : "bg-ink/15"}`}
            />
            {s}
          </div>
        ))}
      </div>
    ),
  },
];

export default function PhoneMockup({ autoPlay = true }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  // Autoplay never runs for reduced-motion users, and pauses while the user
  // is interacting (hover / focus / touch) so a screen never changes under
  // their finger.
  const playing = autoPlay && !reducedMotion && !paused;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % screens.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [playing]);

  const go = (delta) => setIndex((i) => (i + delta + screens.length) % screens.length);

  return (
    <div
      className="flex w-full flex-col items-center gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      {/* The device keeps a true 1:2 aspect ratio and scales with its
          container: 200px on the smallest phones, 240px from `sm` up. The
          screen content is authored for ~224px wide so it is never reflowed. */}
      <div
        className="relative aspect-[1/2] w-[min(62vw,200px)] rounded-[2.25rem] border-[7px] border-ink bg-white shadow-2xl sm:w-[240px] sm:rounded-[2.5rem] sm:border-8"
        role="group"
        aria-roledescription="carousel"
        aria-label="User Panel preview"
      >
        <div className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-ink/70" />
        <div className="h-full w-full overflow-hidden rounded-[1.6rem] pt-4 sm:rounded-[1.8rem]" aria-live={playing ? "off" : "polite"}>
          <AnimatePresence mode="wait">
            <motion.div
              key={screens[index].id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              {screens[index].render()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls. Navigation is the two 44x44 prev/next buttons, which work at
          every width. The dots are a position indicator only (aria-hidden,
          not focusable, not clickable): six real buttons cannot each be 44px
          wide on a 320px screen, so rather than ship undersized targets they
          are not targets at all. Screen readers get the live label below. */}
      <div className="flex w-full max-w-[17rem] items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/50 transition hover:text-ink"
          aria-label="Previous screen"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15">
            <ChevronLeft size={16} />
          </span>
        </button>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {screens.map((s, i) => (
            <span
              key={s.id}
              className={`block h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-amber" : "w-1.5 bg-ink/20"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/50 transition hover:text-ink"
          aria-label="Next screen"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15">
            <ChevronRight size={16} />
          </span>
        </button>
      </div>
      <p aria-live="polite" className="flex items-center gap-1.5 text-xs font-medium text-ink/50">
        <QrCode size={14} className="text-ink/30" aria-hidden="true" />
        {screens[index].label}
      </p>
    </div>
  );
}
