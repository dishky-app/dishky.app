import React from "react";
import PageBackdrop from "../components/ReactBits/PageBackdrop.js";
import { motion } from "framer-motion";
import { fadeUp } from "../animations/variants.js";
import AdminShowcase from "../components/AdminPanelPreview/AdminShowcase.js";
import DashboardPreview from "../components/DashboardPreview/DashboardPreview.js";

export default function AdminPanel() {
  return (
    <div className="relative isolate min-h-screen-safe bg-beige" style={{ paddingTop: "calc(var(--header-clearance) + clamp(24px, 6vw, 64px))", paddingBottom: "var(--section-space)" }}>
      <PageBackdrop tone="light" />
      <div className="container-dishky">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="max-w-2xl">
          <h1 className="heading-lg text-ink">Your whole day. One control center.</h1>
        </motion.div>

        {/* Problem -> fix, on a dark stage */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          data-nav-theme="dark"
          className="mt-10 rounded-[2rem] bg-ink p-5 text-cream sm:p-8 md:mt-14 lg:p-12"
        >
          <AdminShowcase />
        </motion.div>

        <div className="mx-auto mt-16 max-w-4xl md:mt-24">
          <h2 className="heading-md mb-6 text-ink">Every module, one place</h2>
          <DashboardPreview />
        </div>
      </div>
    </div>
  );
}
