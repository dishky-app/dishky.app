import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, EyeOff, Pencil, Plus } from "lucide-react";
import { BrowserFrame, PhoneFrame, Segmented, Chip } from "../../Kit/Kit.js";
import { images } from "../../../assets/images/imageUrls.js";

const CATS = [
  { value: "mains", label: "Mains" },
  { value: "starters", label: "Starters" },
  { value: "sweet", label: "Desserts" },
  { value: "drinks", label: "Drinks" },
];
const SEED = [
  { id: 1, cat: "mains", name: "Dum Biryani", price: 360, on: true, img: images.dishBiryani },
  { id: 2, cat: "mains", name: "Butter Curry", price: 320, on: true, img: images.dishCurry },
  { id: 3, cat: "mains", name: "Penne Arrabbiata", price: 280, on: true, img: images.dishPasta },
  { id: 4, cat: "starters", name: "Paneer Tikka", price: 290, on: true, img: images.chefPlating },
  { id: 5, cat: "starters", name: "Crispy Corn", price: 210, on: true, img: images.kitchenAction },
  { id: 6, cat: "sweet", name: "Choco Lava", price: 180, on: true, img: images.dishDessert },
  { id: 7, cat: "sweet", name: "Gulab Jamun", price: 140, on: true, img: images.restaurantTable },
  { id: 8, cat: "drinks", name: "Mint Cooler", price: 120, on: true, img: images.dishDrink },
  { id: 9, cat: "drinks", name: "Masala Chai", price: 60, on: true, img: images.cafeInterior },
];
const inr = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function PriceEdit({ item, onSave, dark }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const open = () => { setV(String(item.price)); setEditing(true); };
  const commit = () => {
    const n = parseInt(v, 10);
    if (n > 0) onSave(Math.min(n, 9999));
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus inputMode="numeric" aria-label={`Price for ${item.name}`} value={v}
        onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className={`h-10 w-20 rounded-xl border-2 border-amber px-2 text-center font-display text-sm font-bold outline-none ${dark ? "bg-white/10 text-white" : "bg-white text-ink"}`}
      />
    );
  }
  return (
    <button type="button" aria-label={`Edit price of ${item.name}`} onClick={open} className={`group flex min-h-[40px] items-center gap-1 rounded-xl px-2 font-display text-sm font-bold ${dark ? "hover:bg-white/10" : "hover:bg-beige"}`}>
      <motion.span key={item.price} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{inr(item.price)}</motion.span>
      <Pencil size={12} className="opacity-40 group-hover:opacity-100" />
    </button>
  );
}

export default function MenuDemo({ dark = false }) {
  const [items, setItems] = useState(SEED);
  const [cat, setCat] = useState("mains");
  const [combo, setCombo] = useState([1, 8]);
  const [disc, setDisc] = useState(15);

  const patch = (id, p) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const rows = items.filter((x) => x.cat === cat);
  const guest = rows.filter((x) => x.on);
  const picked = combo.map((id) => items.find((x) => x.id === id)).filter(Boolean);
  const base = picked.reduce((s, x) => s + x.price, 0);
  const final = base * (1 - disc / 100);
  const toggleCombo = (id) => setCombo((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? [...c.slice(1), id] : [...c, id]));

  const sub = dark ? "text-white/50" : "text-ink/50";
  const card = dark ? "border-white/10 bg-white/5" : "border-ink/5 bg-white shadow-sm";

  return (
    <div className="w-full">
      <div className={`mx-auto w-full max-w-[980px] rounded-3xl p-3 sm:p-5 ${dark ? "bg-white/5" : "bg-beige"}`}>
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="min-w-0">
            <BrowserFrame title="admin.dishky.com/menu" dark={dark}>
              <div className="flex flex-col gap-3">
                <Segmented options={CATS} value={cat} onChange={setCat} dark={dark} />
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {rows.map((x) => (
                      <motion.div
                        layout key={x.id}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: x.on ? 1 : 0.5, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        className={`flex items-center gap-2 rounded-2xl border p-2 sm:gap-3 ${card}`}
                      >
                        <img src={x.img} alt="" draggable="false" className={`h-12 w-12 shrink-0 rounded-xl object-cover transition ${x.on ? "" : "grayscale"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{x.name}</p>
                          <AnimatePresence initial={false}>
                            {!x.on && (
                              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex items-center gap-1 overflow-hidden text-[11px] text-amber">
                                <EyeOff size={11} />Hidden from guests
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        <PriceEdit item={x} dark={dark} onSave={(p) => patch(x.id, { price: p })} />
                        <button type="button" role="switch" aria-checked={x.on} aria-label={`${x.name} available`} onClick={() => patch(x.id, { on: !x.on })} className="flex h-10 w-12 shrink-0 items-center justify-center">
                          <span className={`relative h-6 w-11 rounded-full transition-colors ${x.on ? "bg-amber" : dark ? "bg-white/20" : "bg-ink/20"}`}>
                            <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${x.on ? "right-0.5" : "left-0.5"}`} />
                          </span>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <p className={`text-[11px] ${sub}`}>Tap a price to edit</p>
              </div>
            </BrowserFrame>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2">
            <Chip tone="brand">Guest view</Chip>
            <PhoneFrame>
              <div className="flex h-full flex-col gap-2 overflow-hidden bg-[#f6f6f6] px-3 pb-3 pt-10">
                <p className="font-display text-sm font-extrabold">{CATS.find((c) => c.value === cat).label}</p>
                <div className="flex-1 space-y-2 overflow-hidden">
                  <AnimatePresence initial={false} mode="popLayout">
                    {guest.map((x) => (
                      <motion.div layout key={x.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 40 }} className="flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-sm">
                        <img src={x.img} alt="" draggable="false" className="h-10 w-10 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold leading-tight">{x.name}</p>
                          <motion.p key={x.price} initial={{ scale: 1.25, color: "#f33716" }} animate={{ scale: 1, color: "#111111" }} className="origin-left text-[11px] font-semibold">{inr(x.price)}</motion.p>
                        </div>
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber text-white"><Plus size={12} /></span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!guest.length && <p className="pt-8 text-center text-[11px] text-ink/40">Nothing available</p>}
                </div>
              </div>
            </PhoneFrame>
          </div>
        </div>

        <section className={`mt-5 rounded-3xl border p-4 sm:p-5 ${card}`}>
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold">Combo builder</p>
            <span className={`text-[11px] ${sub}`}>Pick 2–3</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {items.filter((x) => x.on).map((x) => {
              const on = combo.includes(x.id);
              return (
                <button key={x.id} type="button" aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${x.name} in combo`} onClick={() => toggleCombo(x.id)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 transition ${on ? "ring-amber" : "opacity-60 ring-transparent"}`}>
                  <img src={x.img} alt="" draggable="false" className="h-full w-full object-cover" />
                  {on && <span className="absolute right-1 top-1 rounded-full bg-amber p-0.5 text-white"><Check size={10} /></span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className={`flex justify-between text-xs font-semibold ${sub}`}><span>Discount</span><span className="text-amber">{disc}%</span></span>
              <input type="range" min={0} max={30} value={disc} aria-label="Combo discount" onChange={(e) => setDisc(+e.target.value)} className="mt-1 h-10 w-full accent-[#f33716]" />
            </label>
            <div className="flex items-end gap-3">
              <div>
                <p className={`text-xs line-through ${sub}`}>{inr(base)}</p>
                <motion.p key={final} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-2xl font-extrabold leading-none">{inr(final)}</motion.p>
              </div>
              <Chip tone={base && disc ? "ok" : "mute"}>Save {inr(base - final)}</Chip>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
