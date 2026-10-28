import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUp, ArrowUpRight, Facebook, Instagram, Youtube } from "lucide-react";
import { subscribeNewsletter } from "../../services/api.js";
import { toast } from "../Toast/Toast.js";
import { isEmail, formatEmail } from "../../utils/validate.js";
import { EASE } from "../../animations/variants.js";
import BrandLockup from "../Brand/Brand.js";
import { XIcon, ThreadsIcon } from "./SocialIcons.js";

// Admin Panel leads: it is the product owners buy.
const columns = [
  {
    title: "Platform",
    links: [
      { label: "Admin Panel", to: "/admin-panel" },
      { label: "User Panel", to: "/user-panel" },
      { label: "Live Orders", to: "/features/live-orders" },
      { label: "Kitchen Display", to: "/features/kitchen-display" },
      { label: "Service & Tables", to: "/features/tables-service" },
      { label: "Guests & Loyalty", to: "/features/loyalty-campaigns" },
      { label: "Inventory", to: "/features/inventory-management" },
      { label: "Payments", to: "/features/payment-tracking" },
      { label: "Analytics", to: "/features/analytics" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Solutions", to: "/solutions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", to: "/resources#docs" },
      { label: "Help Center", to: "/resources#help" },
      { label: "Blog", to: "/resources#blog" },
      { label: "Guides", to: "/resources#guides" },
      { label: "API", to: "/resources#api" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Promotions", to: "/features/promotions" },
      { label: "Events", to: "/features/event-collaboration" },
      { label: "Careers", to: "/about#careers" },
      { label: "Partners", to: "/about#partners" },
    ],
  },
];

// Parent company shown in the footer. Update name/url, and swap the logo file.
const PARENT_COMPANY = { name: "Parent Company", url: "https://www.marqwon.com/" };

const legal = [
  { label: "Privacy", to: "/legal/privacy" },
  { label: "Terms", to: "/legal/terms" },
  { label: "Security", to: "/legal/security" },
  { label: "Cookies", to: "/legal/cookies" },
];

// Placeholder destinations: swap for the real brand profiles before launch.
const socials = [
  { label: "Instagram", href: "https://instagram.com", Icon: Instagram },
  { label: "Facebook", href: "https://facebook.com", Icon: Facebook },
  { label: "X", href: "https://x.com", Icon: XIcon },
  { label: "Threads", href: "https://threads.net", Icon: ThreadsIcon },
  { label: "YouTube", href: "https://youtube.com", Icon: Youtube },
];

// The daily problems Dishky fixes, as a running ribbon.
const ribbon = [
  "No more lost orders",
  "Stock that warns you first",
  "Cash that matches the orders",
  "Every branch, one login",
  "Staff see only what they should",
  "Tables never double-booked",
  "Guests order for themselves",
  "Your restaurant, promoted by Dishky",
];

// Fixed values (not random) so the embers are identical on every load.
const embers = [
  { left: "6%", size: 3, dur: 11, delay: 0 },
  { left: "17%", size: 2, dur: 14, delay: 3 },
  { left: "29%", size: 4, dur: 12, delay: 6 },
  { left: "41%", size: 2, dur: 16, delay: 1 },
  { left: "55%", size: 3, dur: 13, delay: 8 },
  { left: "67%", size: 2, dur: 15, delay: 4 },
  { left: "78%", size: 4, dur: 12, delay: 9 },
  { left: "90%", size: 3, dur: 14, delay: 2 },
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE, delay: i * 0.08 },
  }),
};
const inView = { once: true, amount: 0.2 };

function RibbonRow({ hidden = false }) {
  return (
    <ul className="dk-marquee__row" aria-hidden={hidden || undefined}>
      {ribbon.map((t) => (
        <li key={t} className="dk-marquee__item">
          <span className="dk-marquee__dot" />
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim() || !isEmail(email)) {
      setStatus("invalid"); // no native bubble: the message is a toast
      toast.error(email.trim() ? "Enter a valid email address." : "Email is required.");
      return;
    }
    setStatus("loading");
    try {
      await subscribeNewsletter(email);
      setStatus("success");
      setEmail("");
      toast.success("Subscribed. Thank you!");
    } catch (err) {
      setStatus("error");
      toast.error(err?.message || "Something went wrong. Try again.");
    }
  };

  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer data-nav-theme="dark" className="dk-footer relative isolate overflow-hidden bg-ink text-cream">
      {/* ---- Atmosphere: dot grid, drifting glows, rising embers ---------- */}
      <div className="dk-footer__grid" aria-hidden="true" />
      <div className="dk-footer__orb dk-footer__orb--a" aria-hidden="true" />
      <div className="dk-footer__orb dk-footer__orb--b" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {embers.map((e, i) => (
          <span
            key={i}
            className="dk-ember"
            style={{ left: e.left, width: e.size, height: e.size, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }}
          />
        ))}
      </div>

      {/* ---- Ribbon: the problems Dishky fixes ---------------------------- */}
      <div className="dk-marquee" role="presentation">
        <div className="dk-marquee__track">
          <RibbonRow />
          <RibbonRow hidden />
        </div>
      </div>

      <div className="container-dishky relative pb-8 pt-14 md:pt-20">
        {/* ---- CTA panel with a slow-turning light on its border ---------- */}
        <motion.div
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={inView}
          className="dk-cta"
        >
          <div className="dk-cta__pattern" aria-hidden="true" />
          {/* The big shining wordmark is this panel's background */}
          <div className="dk-wordmark" aria-hidden="true">
            DISHKY
          </div>
          <div className="relative grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:gap-14 lg:p-14">
            <div>
              <h2 className="heading-lg max-w-[16ch] text-cream">
                Fix the daily problems. <span className="text-amber">Run the restaurant.</span>
              </h2>
              <p className="text-lead mt-5 max-w-md text-cream/60">
                See Dishky solve lost orders, empty shelves and mismatched cash from one admin
                panel, in a live demo.
              </p>
            </div>
            <div className="cta-row lg:justify-self-end">
              <Link to="/book-demo" className="btn-primary group">
                Book a Demo
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link to="/pricing" className="btn-secondary !border-cream/25 !text-cream">
                See Pricing
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ---- Brand + newsletter (left) | link columns (right) ----------- */}
        <div className="grid gap-12 py-14 md:py-20 lg:grid-cols-12 lg:gap-10">
          <motion.div
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={inView}
            custom={1}
            className="lg:col-span-4"
          >
            <Link to="/" aria-label="Dishky home" className="inline-flex min-h-[44px] items-center">
              <BrandLockup dark markClassName="h-12" wordmarkClassName="h-6" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/60">
              The operating system for modern restaurants. The problems of a normal service day,
              handled in one place.
            </p>

            <form onSubmit={handleSubscribe} noValidate className="mt-8 max-w-sm">
              <label htmlFor="footer-email" className="mb-2 block text-sm font-semibold text-cream/80">
                Get restaurant-ops tips in your inbox
              </label>
              <div className="dk-news">
                <input
                  id="footer-email"
                  type="email"
                  aria-required="true"
                  aria-invalid={status === "invalid" || undefined}
                  autoComplete="email"
                  autoCapitalize="none"
                  maxLength={100}
                  inputMode="email"
                  value={email}
                  onChange={(e) => { setEmail(formatEmail(e.target.value)); if (status === "invalid") setStatus("idle"); }}
                  placeholder="you@restaurant.com"
                  className="dk-news__input"
                />
                <button type="submit" disabled={status === "loading"} className="dk-news__btn" aria-label="Subscribe">
                  {status === "loading" ? "…" : <ArrowRight size={18} />}
                </button>
              </div>
            </form>

            <ul className="mt-6 flex items-center gap-2" aria-label="Social links">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="dk-social">
                    <Icon size={18} />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-8 lg:gap-x-8">
            {columns.map((col, ci) => (
              <motion.nav
                key={col.title}
                aria-label={col.title}
                variants={reveal}
                initial="hidden"
                whileInView="visible"
                viewport={inView}
                custom={ci + 2}
              >
                <h3 className="font-display text-sm font-bold text-cream">{col.title}</h3>
                <span className="mt-2 block h-px w-8 bg-amber" aria-hidden="true" />
                <ul className="mt-4 space-y-0.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="dk-link">
                        <span>{l.label}</span>
                        <ArrowUpRight size={13} className="dk-link__arrow" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.nav>
            ))}
          </div>
        </div>

        {/* ---- Bottom bar -------------------------------------------------- */}
        <div className="flex flex-col gap-5 border-t border-cream/10 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs text-cream/45">© {new Date().getFullYear()} Dishky. All rights reserved.</p>
            {/* Replace public/brand/parent-company.svg (and the name/link below) with the parent company's logo. */}
            <a
              href={PARENT_COMPANY.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-cream/45 transition-colors hover:text-cream white-color"
              aria-label={`Powered by ${PARENT_COMPANY.name}`}
            >
              Powered by
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                
                  <img src="/brand/marqwon-logo.png" alt={PARENT_COMPANY.name} className="h-6 w-auto" />
                
                <p className="inline-flex items-center gap-2 text-xs text-cream/45 transition-colors hover:text-cream white-color">Marqwon Dynamics Pvt. Ltd.</p>
              </div>
            </a>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            {legal.map((l) => (
              <Link key={l.label} to={l.to} className="dk-legal">
                {l.label}
              </Link>
            ))}
          </nav>
          <button type="button" onClick={toTop} className="dk-top group">
            Back to top
            <span className="dk-top__icon">
              <ArrowUp size={14} />
            </span>
          </button>
        </div>
      </div>

    </footer>
  );
}
