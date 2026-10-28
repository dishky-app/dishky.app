import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Img from "../ui/Img.js";
import Reveal from "../ui/Reveal.js";
import SectionHeading from "../SectionHeading/SectionHeading.js";
import { Widget } from "../interactive/index.js";
import { images } from "../../assets/images/imageUrls.js";

/** What is Dishky: guest on one side, owner on the other, Dishky in the middle. Then prove it. */
export default function WhatIsDishky() {
  return (
    <section id="what-is-dishky" data-nav-theme="dark" className="relative overflow-hidden bg-ink text-cream" style={{ paddingBlock: "var(--section-space)" }}>
      <div className="container-dishky relative">
        <SectionHeading title={"WHAT IS\nDISHKY?"} subtitle="The software behind a smooth service." size="xl" dark />

        <div className="mt-10 grid items-center gap-4 md:mt-14 md:grid-cols-[1fr_auto_1fr] md:gap-6">
          <Reveal dir="left">
            <div className="relative overflow-hidden rounded-[2rem]">
              <Img src={images.diningFriends} alt="Guests ordering" tone="#e4290c" className="aspect-[4/3] w-full" imgClassName="transition duration-700 hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <p className="absolute bottom-4 left-5 font-display text-xl font-extrabold">Your guests</p>
            </div>
          </Reveal>
          <div className="flex items-center justify-center gap-2 text-amber md:flex-col" aria-hidden="true">
            <motion.span animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} className="max-md:rotate-90"><ArrowRight size={26} /></motion.span>
            <span className="rounded-2xl bg-amber px-4 py-2 font-display text-lg font-extrabold text-ink shadow-[0_0_40px_6px_rgba(243,55,22,0.4)]">DISHKY</span>
            <motion.span animate={{ x: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.8, delay: 0.9 }} className="max-md:rotate-90"><ArrowRight size={26} className="rotate-180" /></motion.span>
          </div>
          <Reveal dir="right">
            <div className="relative overflow-hidden rounded-[2rem]">
              <Img src={images.kitchenAction} alt="Restaurant team" tone="#ea2a0c" className="aspect-[4/3] w-full" imgClassName="transition duration-700 hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <p className="absolute bottom-4 left-5 font-display text-xl font-extrabold">Your restaurant</p>
            </div>
          </Reveal>
        </div>

        <Reveal className="mx-auto mt-10 max-w-3xl md:mt-14"><Widget type="orderflow" dark /></Reveal>
      </div>
    </section>
  );
}
