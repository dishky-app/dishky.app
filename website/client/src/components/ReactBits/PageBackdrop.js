import React from "react";
import { useLocation } from "react-router-dom";
import Backdrop from "./Backdrop.js";
import { modules } from "../../data/modules.js";

// Quiet, professional backdrops matched to each page's background. Patterns may repeat across pages.
const BY_ROUTE = {
  "/": "dotfield",
  "/user-panel": "dots",
  "/admin-panel": "squares",
  "/pricing": "waves",
  "/solutions": "beams",
  "/resources": "particles",
  "/about": "aurora",
  "/contact": "waves",
  "/book-demo": "waves",
  "/login": "aurora",
  "/signup": "beams",
  "/reset-password": "warp",
  "/account": "squares",
  "/account/billing": "dots",
  "/legal/privacy": "squares",
  "/legal/terms": "dots",
  "/legal/security": "squares",
  "/legal/cookies": "dots",
};
const LIGHT = ["dots", "squares", "warp", "waves"];
const DARK = ["beams", "particles", "waves", "aurora", "warp", "squares"];

function pick(pathname, tone) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (BY_ROUTE[path]) return BY_ROUTE[path];
  if (path.startsWith("/features/")) {
    const i = Math.max(0, modules.findIndex((m) => m.path === path));
    const pool = tone === "dark" ? DARK : LIGHT;
    return pool[i % pool.length];
  }
  return tone === "dark" ? "particles" : "dots";
}

export default function PageBackdrop({ tone = "light", z, name }) {
  const { pathname } = useLocation();
  return <Backdrop name={name || pick(pathname, tone)} tone={tone} z={z} />;
}
