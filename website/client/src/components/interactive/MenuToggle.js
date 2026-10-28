import React, { useState } from "react";
import Window from "../ui/Window.js";
import Img from "../ui/Img.js";
import { images } from "../../assets/images/imageUrls.js";

const DISHES = [
  { n: "Butter Chicken", p: 360, img: images.dishCurry },
  { n: "Chicken Biryani", p: 320, img: images.dishBiryani },
  { n: "Creamy Pasta", p: 280, img: images.dishPasta },
  { n: "Chocolate Torte", p: 190, img: images.dishDessert },
  { n: "Mint Cooler", p: 120, img: images.dishDrink },
  { n: "Garden Salad", p: 210, img: images.salad },
];

/** Flip a dish off in the Admin Panel and it is sold out on the guest menu, instantly. */
export default function MenuToggle() {
  const [on, setOn] = useState(DISHES.map(() => true));
  return (
    <Window title="Dishes · availability">
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <ul className="space-y-1.5">
          {DISHES.map((d, i) => (
            <li key={d.n} className="flex items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2">
              <span className="flex-1 truncate text-xs font-bold">{d.n}</span>
              <button type="button" role="switch" aria-checked={on[i]} aria-label={`${d.n} available`} onClick={() => setOn((o) => o.map((v, n) => (n === i ? !v : v)))} style={{ minHeight: 0 }}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on[i] ? "bg-amber" : "bg-ink/20"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on[i] ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-[1.6rem] bg-ink p-2">
          <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] bg-white p-2">
            {DISHES.map((d, i) => (
              <div key={d.n} className="relative overflow-hidden rounded-xl">
                <Img src={d.img} alt={d.n} className={`aspect-square w-full transition duration-500 ${on[i] ? "" : "grayscale opacity-50"}`} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-5 text-[10px] font-bold text-white">{d.n}</div>
                {!on[i] && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold text-cream">Sold out</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Window>
  );
}
