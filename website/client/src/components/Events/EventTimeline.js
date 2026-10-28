import React, { useState } from "react";
import { Megaphone, CalendarCheck, PartyPopper, Camera, MapPin } from "lucide-react";
import { BrandMark } from "../Brand/Brand.js";
import { Photo, useInterval } from "../ui/kit.js";
import { images } from "../../assets/images/imageUrls.js";

const stages = [
  { Icon: Megaphone, label: "Announced" },
  { Icon: CalendarCheck, label: "Booked" },
  { Icon: PartyPopper, label: "Event night" },
  { Icon: Camera, label: "Recap" },
];

/** An event card whose four stages light up in turn. Tap a stage to jump. */
export default function EventTimeline({ className = "" }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useInterval(() => setI((v) => (v + 1) % stages.length), 2400, !hold);
  return (
    <div className={`relative mx-auto w-full max-w-[460px] ${className}`}>
      <div aria-hidden="true" className="absolute inset-x-6 top-8 h-[70%] rounded-full bg-neutral-500/20 blur-3xl" />
      <article
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        className="relative overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)]"
        style={{ animation: "dk-float 6s ease-in-out infinite" }}
      >
        <div className="relative h-52 text-white">
          <Photo src={images.dining} art="night" className="absolute inset-0" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, rgba(246.0,106.0,85.0,.75), rgba(243.0,55.0,22.0,.75))" }} />
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-6" />
              <p className="font-display text-[12px] font-bold">Dishky × Your Restaurant</p>
            </div>
            <div>
              <p className="font-display text-xl font-extrabold leading-tight">Chef’s Table Night</p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/85"><MapPin size={13} /> Your Restaurant</p>
            </div>
          </div>
        </div>
        <ol className="grid grid-cols-4 gap-1 p-5">
          {stages.map(({ Icon, label }, k) => (
            <li key={label}>
              <button type="button" onClick={() => setI(k)} className="flex w-full flex-col items-center gap-2" style={{ minHeight: 0 }}>
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-500 ${k <= i ? "bg-amber text-white" : "text-ink/40"} ${k === i ? "scale-110 dk-ping" : ""}`}
                  style={k > i ? { background: "rgba(0,0,0,0.06)" } : undefined}
                >
                  <Icon size={17} />
                </span>
                <span className={`text-[10px] font-bold ${k <= i ? "text-ink" : "text-ink/40"}`}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
