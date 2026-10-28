import React from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { motion } from "framer-motion";
import { fadeUp, staggerChildren } from "../animations/variants.js";
import SectionHeading from "../components/SectionHeading/SectionHeading.js";
import PhoneMockup from "../components/UserPanelPreview/PhoneMockup.js";

const features = [
  "QR access", "Digital menu", "Categories", "Dish details", "Ingredients",
  "Cart", "Orders", "Payment", "Order tracking", "Offers", "Order history",
];

export default function UserPanel() {
  return (
    <div className="relative isolate min-h-screen-safe bg-cream" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="light" />
      <div className="container-dishky split">
        <motion.div variants={staggerChildren(0.1)} initial="hidden" animate="visible" className="min-w-0">
          <motion.h1 variants={fadeUp} className="heading-lg text-ink">
            A better guest experience.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lead mt-5 max-w-md text-ink/60 md:mt-6">
            Your guests get a simple, branded ordering experience without
            needing to navigate complicated restaurant software — just scan,
            order, pay and track.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-2 md:mt-8">
            {features.map((f) => (
              <span key={f} className="rounded-full bg-white px-4 py-2 text-xs font-medium text-ink/70 shadow-sm">
                {f}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <div className="flex min-w-0 justify-center">
          <PhoneMockup />
        </div>
      </div>
    </div>
  );
}
