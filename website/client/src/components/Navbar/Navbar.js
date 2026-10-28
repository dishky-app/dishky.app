import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { ScrollTrigger } from "../../animations/gsapSetup.js";
import useMediaQuery from "../../hooks/useMediaQuery.js";
import useReducedMotion from "../../hooks/useReducedMotion.js";
import BrandLockup from "../Brand/Brand.js";
import { useOwner } from "../../context/OwnerContext.js";
import { EASE } from "../../animations/variants.js";
import { categories, bySlug } from "../../data/modules.js";

// Feature directory: every module, grouped, for the mega menu and mobile menu.
const featureGroups = [
  ...categories.map((c) => ({
    label: c.label,
    links: c.slugs.map((sl) => bySlug[sl]).filter(Boolean).map((m) => ({ label: m.name, to: m.path })),
  })),
  { label: "The two panels", links: [{ label: "Admin Panel", to: "/admin-panel" }, { label: "Guest App (User Panel)", to: "/user-panel" }] },
];


const mobileLinks = [
  { label: "Home", to: "/" },
  { label: "Solutions", to: "/solutions" },
  { label: "Features", to: "/features", groups: true },
  { label: "Pricing", to: "/pricing" },
  { label: "Promotions", to: "/features/promotions" },
  { label: "Events", to: "/features/event-collaboration" },
  { label: "Resources", to: "/resources" },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// One theme object drives the pill, the dropdown and the phone menu, so they always share
// the same background and text colours: white over light sections, black over dark ones.
const THEMES = {
  light: {
    solid: "border-black/10 bg-white/90 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.3)] backdrop-blur-2xl backdrop-saturate-150",
    clear: "border-black/10 bg-white/90 backdrop-blur-2xl backdrop-saturate-150",
    open: "border-black/10 bg-white",
    text: "text-ink",
    muted: "text-ink/65",
    faint: "text-ink/45",
    hover: "hover:text-ink",
    focus: "focus-visible:text-ink",
    mobile: "border-black/10 bg-white text-ink",
    row: "active:opacity-60",
    soft: "text-ink/30",
    ctaBar: "border-ink/10",
    rule: "border-ink/10",
    line: "bg-ink",
    card: "border-ink/15",
    ghost: "border-ink/20 hover:border-ink/60",
    toggle: "border-ink/15 active:bg-ink active:text-white",
    cta: "border-ink",
  },
  dark: {
    solid: "border-white/15 bg-black/90 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-150",
    clear: "border-white/15 bg-black/90 backdrop-blur-2xl backdrop-saturate-150",
    open: "border-white/15 bg-black",
    text: "text-white",
    muted: "text-white/70",
    faint: "text-white/50",
    hover: "hover:text-white",
    focus: "focus-visible:text-white",
    mobile: "border-white/15 bg-black text-white",
    row: "active:opacity-60",
    soft: "text-white/30",
    ctaBar: "border-white/10",
    rule: "border-white/15",
    line: "bg-white",
    card: "border-white/20",
    ghost: "border-white/25 hover:border-white/60",
    toggle: "border-white/15 active:bg-white active:text-black",
    cta: "border-white",
  },
};

const navItems = [
  { label: "Home", to: "/", end: true },
  { label: "Features", to: "/features", mega: true },
  { label: "Solutions", to: "/solutions" },
  { label: "Pricing", to: "/pricing" },
  { label: "Resources", to: "/resources" },
];

function MenuIcon({ open }) {
  const t = { duration: 0.5, ease: EASE };
  return (
    <span aria-hidden="true" className="relative block h-5 w-7">
      <motion.span className="absolute left-0 top-[5px] block h-px w-7 bg-current" animate={open ? { y: 4.5, rotate: 45 } : { y: 0, rotate: 0 }} transition={t} />
      <motion.span className="absolute bottom-[5px] left-0 block h-px w-7 bg-current" animate={open ? { y: -4.5, rotate: -45 } : { y: 0, rotate: 0 }} transition={t} />
    </span>
  );
}

/**
 * Features mega menu. Rendered beside the header pill (never inside it), with the
 * same glass surface as the pill, so its blur actually samples the page behind it.
 */
function MegaMenu({ groups, t, onEnter, onLeave, onNavigate }) {
  return (
    <motion.div
      id="mega-features"
      aria-label="Features menu"
      className={`absolute inset-x-0 top-full mt-3 hidden rounded-[28px] border transition-colors duration-500 lg:block ${t.solid} ${t.text}`}
      initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
      animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
      exit={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
      transition={{ duration: 0.45, ease: EASE }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="grid gap-x-8 gap-y-7 p-8 lg:grid-cols-4">
        {groups.map((g, i) => (
          <motion.div key={g.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.08 + i * 0.06 }}>
            <div className={`mb-3 flex items-start gap-3 border-b pb-3 ${t.rule}`}>
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.faint}`}>0{i + 1}</span>
              <span className="font-display text-base font-semibold tracking-tight">{g.label}</span>
            </div>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} onClick={onNavigate} className={`group inline-flex min-h-[28px] items-center gap-2 text-sm transition-colors ${t.muted} ${t.hover} ${t.focus}`}>
                    <span className={`h-px w-0 ${t.line} transition-all duration-500 ease-out group-hover:w-4 group-focus-visible:w-4`} />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
        <motion.div
          className={`flex flex-col justify-between rounded-2xl border p-6 lg:col-span-2 ${t.card}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.08 + groups.length * 0.06 }}
        >
          <div>
            <p className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${t.faint}`}>Not sure where to start?</p>
            <p className="font-display text-xl font-medium leading-snug tracking-tight">Tell us about your restaurant. We'll show you the right modules.</p>
          </div>
          <Link to="/book-demo" onClick={onNavigate} className={`group mt-6 inline-flex items-center gap-3 self-start border-b pb-1 text-sm font-semibold ${t.cta}`}>
            Book a Demo
            <ArrowRight size={16} className="transition-transform duration-500 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featOpen, setFeatOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [hoverKey, setHoverKey] = useState(null);
  const [isOnDark, setIsOnDark] = useState(false);
  const headerRef = useRef(null);
  const freezeTheme = useRef(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const megaTimer = useRef(0);
  const location = useLocation();
  const { owner } = useOwner();
  const reducedMotion = useReducedMotion();

  // The full desktop nav needs ~1024px: 5 links + 2 CTAs + logo. Below that
  // (tablet portrait included) it collapses to the compact menu, so it can
  // never run off the edge at intermediate widths like 768-900px.
  const compact = useMediaQuery("(max-width: 1023px)");

  const closeMenu = useCallback(() => setMobileOpen(false), []);
  const openMega = useCallback(() => {
    clearTimeout(megaTimer.current);
    setMegaOpen(true);
  }, []);
  const closeMega = useCallback((delay = 160) => {
    clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaOpen(false), delay);
  }, []);
  useEffect(() => () => clearTimeout(megaTimer.current), []);

  // One rAF-throttled scroll listener: the pill shrinks and turns solid after 24px.
  useEffect(() => {
    let ticking = false;
    const update = () => {
      setScrolled(window.scrollY > 24);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Route change closes the menus.
  useEffect(() => {
    setMobileOpen(false);
    setMegaOpen(false);
    setHoverKey(null);
  }, [location.pathname, location.hash]);

  // Growing past the compact breakpoint (rotate / resize) must not leave the
  // page scroll-locked behind a menu that no longer exists.
  useEffect(() => {
    if (!compact) setMobileOpen(false);
    else setMegaOpen(false);
  }, [compact]);

  // Mega menu: Escape and outside press.
  useEffect(() => {
    if (!megaOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMegaOpen(false);
    const onDown = (e) => {
      if (!e.target.closest?.("[data-header]")) setMegaOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [megaOpen]);

  // Scroll lock while the menu is open (spec section 6).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("is-locked", mobileOpen);
    return () => root.classList.remove("is-locked");
  }, [mobileOpen]);

  // Keyboard behaviour while open: Escape closes, Tab is trapped inside the
  // panel (+ the toggle), and focus returns to the toggle on close.
  useEffect(() => {
    if (!mobileOpen) return;
    const toggle = toggleRef.current;

    // The panel mounts via AnimatePresence in the same commit, so wait a frame.
    const raf = requestAnimationFrame(() => {
      menuRef.current?.querySelector(FOCUSABLE)?.focus();
    });

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return;
      }
      const menu = menuRef.current;
      if (e.key !== "Tab" || !menu) return;
      const nodes = [toggle, ...Array.from(menu.querySelectorAll(FOCUSABLE))].filter(Boolean);
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      toggle?.focus({ preventScroll: true });
    };
  }, [mobileOpen, closeMenu]);

  // Theme probe: which section sits under the pill? Over a dark section the header,
  // dropdown and phone menu turn black; over a light one they turn white. The probe is
  // paused while a menu is open so the menu itself is never mistaken for the page.
  freezeTheme.current = megaOpen || mobileOpen;
  useLayoutEffect(() => {
    const updateTheme = () => {
      const header = headerRef.current;
      if (!header || freezeTheme.current) return;
      const box = header.firstElementChild;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const prev = box.style.pointerEvents;
      box.style.pointerEvents = "none";
      const el = document.elementFromPoint(window.innerWidth / 2, rect.top + 36);
      box.style.pointerEvents = prev;
      setIsOnDark(Boolean(el?.closest('[data-nav-theme="dark"]')));
    };
    const trigger = ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      onUpdate: updateTheme,
      onRefresh: updateTheme,
    });
    updateTheme();
    // Re-sample for a while after navigation (the page swaps in after its transition) and then
    // every so often, so the header never keeps the previous page's colour.
    const timers = [150, 450, 900, 1600, 2600].map((ms) => setTimeout(updateTheme, ms));
    const poll = setInterval(updateTheme, 700);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(poll);
      trigger.kill();
    };
  }, [location.pathname]);

  const dark = isOnDark;
  const t = dark ? THEMES.dark : THEMES.light;
  const solid = scrolled || mobileOpen || megaOpen;
  const activeKey = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname === n.to || location.pathname.startsWith(`${n.to}/`)))?.to;
  const indicatorKey = hoverKey ?? activeKey;

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header
        ref={headerRef}
        data-header=""
        onMouseLeave={() => closeMega()}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 transition-[padding] duration-500 ease-out md:px-6"
        style={{ paddingTop: scrolled ? "clamp(8px, 1vw, 12px)" : "var(--header-offset)" }}
      >
        {/* Floating pill: 1240px wide, easing to 1040px once the page scrolls. */}
        <div className="pointer-events-auto relative mx-auto w-full transition-[max-width] duration-700 ease-out" style={{ maxWidth: scrolled ? 1040 : 1240 }}>
          <div
            className={`relative z-[55] flex items-center justify-between gap-3 rounded-full border pl-4 pr-2 transition-[height,background-color,border-color,box-shadow,color] duration-500 ease-out sm:pl-5 lg:pl-6 lg:pr-3 ${t.text} ${
              mobileOpen ? t.open : solid ? t.solid : t.clear
            }`}
            style={{ height: scrolled ? 56 : "var(--header-h)" }}
          >
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
              <Link to="/" aria-label="Dishky home" className="group flex min-h-[44px] shrink-0 items-center">
                <BrandLockup
                  dark={dark}
                  markClassName="h-8 transition-transform duration-[900ms] ease-out group-hover:rotate-6 lg:h-9"
                  wordmarkClassName="h-5 lg:h-6"
                />
              </Link>
            </motion.div>

            {/* Desktop nav (>=1024) */}
            <nav aria-label="Primary" className="hidden items-center gap-3 lg:flex xl:gap-8">
              <ul className="flex items-center gap-3 xl:gap-8" onMouseLeave={() => setHoverKey(null)}>
                {navItems.map((item, i) => (
                  <motion.li
                    key={item.to}
                    className="relative"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.12 + i * 0.07 }}
                    onMouseEnter={() => {
                      setHoverKey(item.to);
                      if (item.mega) openMega();
                      else closeMega(60);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {item.mega ? (
                        <button
                          type="button"
                          aria-expanded={megaOpen}
                          aria-controls="mega-features"
                          onClick={() => (megaOpen ? setMegaOpen(false) : openMega())}
                          className={`relative block min-h-[44px] py-3 text-sm font-medium tracking-wide transition-colors duration-300 ${megaOpen || indicatorKey === item.to ? t.text : t.muted}`}
                        >
                          {item.label}
                          {indicatorKey === item.to && (
                            <motion.span layoutId="nav-indicator" aria-hidden="true" className={`absolute inset-x-0 bottom-1.5 h-px ${t.line}`} transition={{ type: "spring", stiffness: 420, damping: 36 }} />
                          )}
                        </button>
                      ) : (
                        <NavLink
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            `relative block min-h-[44px] py-3 text-sm font-medium tracking-wide transition-colors duration-300 ${isActive || indicatorKey === item.to ? t.text : t.muted}`
                          }
                        >
                          {item.label}
                          {indicatorKey === item.to && (
                            <motion.span
                              layoutId="nav-indicator"
                              aria-hidden="true"
                              className={`absolute inset-x-0 bottom-1.5 h-px ${t.line}`}
                              transition={{ type: "spring", stiffness: 420, damping: 36 }}
                            />
                          )}
                        </NavLink>
                      )}
                      {item.mega && (
                        <button
                          type="button"
                          aria-expanded={megaOpen}
                          aria-controls="mega-features"
                          aria-label="Show features menu"
                          onClick={() => (megaOpen ? setMegaOpen(false) : openMega())}
                          className={`flex h-8 w-6 items-center justify-center transition-colors ${t.faint} ${t.hover}`}
                        >
                          <ChevronDown aria-hidden="true" size={14} className={`transition-transform duration-500 ${megaOpen ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            </nav>

            <motion.div
              className="hidden items-center gap-2 lg:flex xl:gap-3"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.46 }}
              onMouseEnter={() => closeMega(60)}
            >
              <Link
                to={owner ? "/account" : "/login"}
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap px-2 text-sm font-semibold transition-colors ${t.muted} ${t.hover}`}
              >
                {owner ? "My account" : "Log in"}
              </Link>
              <Link
                to="/book-demo"
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-all duration-300 xl:px-5 ${t.ghost}`}
              >
                Book a Demo
              </Link>
              <Link
                to={owner ? "/account" : "/signup"}
                className="group inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber to-amberLight px-4 text-sm font-semibold text-white shadow-md shadow-amber/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber/35 xl:px-5"
              >
                {owner ? "Dashboard" : "Start free trial"}
                <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            {/* Compact: CTA (tablet only) + hamburger */}
            <div className="flex items-center gap-2 lg:hidden">
              <Link
                to="/book-demo"
                className="hidden min-h-[44px] items-center rounded-full bg-gradient-to-r from-amber to-amberLight px-5 text-sm font-semibold text-white shadow-md shadow-amber/25 md:inline-flex"
              >
                Book a Demo
              </Link>
              <button
                ref={toggleRef}
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
                className={`relative z-[60] flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${t.toggle}`}
              >
                <MenuIcon open={mobileOpen} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {megaOpen && !compact && <MegaMenu groups={featureGroups} t={t} onEnter={openMega} onLeave={() => closeMega()} onNavigate={() => setMegaOpen(false)} />}
          </AnimatePresence>
        </div>
      </header>

      {/* Mobile / tablet menu: large floating panel */}
      <AnimatePresence>
        {mobileOpen && compact && (
          <>
            <motion.button
              key="scrim"
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.25 }}
              onClick={closeMenu}
              className="fixed inset-0 z-40 !min-h-0 cursor-default bg-ink/40 backdrop-blur-sm"
            />
            <motion.div
              key="panel"
              id="mobile-menu"
              ref={menuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: reducedMotion ? 0 : 0.55, ease: EASE }}
              className={`fixed inset-2 z-[45] flex flex-col overflow-hidden rounded-[28px] border pt-24 md:inset-x-6 md:mx-auto md:max-w-[1240px] ${t.mobile}`}
            >
              <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-3">
                <ul className="flex flex-col">
                  {mobileLinks.map((l, i) => (
                    <motion.li
                      key={l.label}
                      className={`border-b last:border-b-0 ${t.rule}`}
                      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reducedMotion ? 0 : 0.12 + i * 0.06, duration: 0.6, ease: EASE }}
                    >
                      {l.groups ? (
                        <div>
                          <button type="button" aria-expanded={featOpen} onClick={() => setFeatOpen((o) => !o)} className={`flex min-h-[52px] w-full items-center justify-between rounded-2xl px-4 font-display text-xl font-bold ${t.row}`}>
                            {l.label}
                            <ChevronDown size={18} className={`${t.faint} transition-transform ${featOpen ? "rotate-180" : ""}`} />
                          </button>
                          {featOpen && (
                            <div className="px-4 pb-3">
                              {featureGroups.map((g) => (
                                <div key={g.label} className="mt-3">
                                  <p className={`text-[11px] font-semibold uppercase tracking-widest ${t.faint}`}>{g.label}</p>
                                  <ul>
                                    {g.links.map((x) => (
                                      <li key={x.label}><Link to={x.to} onClick={closeMenu} className={`flex min-h-[44px] items-center text-base ${t.muted}`}>{x.label}</Link></li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                      <Link
                        to={l.to}
                        onClick={closeMenu}
                        className={`flex min-h-[52px] items-center justify-between rounded-2xl px-4 font-display text-xl font-bold transition-colors ${t.row}`}
                      >
                        {l.label}
                        <ArrowRight size={18} className={t.soft} />
                      </Link>
                      )}
                    </motion.li>
                  ))}
                </ul>
              </nav>

              <div className={`grid gap-3 border-t p-4 sm:grid-cols-2 ${t.ctaBar}`}>
                <Link to={owner ? "/account" : "/signup"} onClick={closeMenu} className="btn-primary">
                  {owner ? "My account" : "Start free trial"} <ArrowRight size={18} />
                </Link>
                <Link to={owner ? "/pricing" : "/login"} onClick={closeMenu} className={`btn-secondary !bg-transparent ${dark ? "!border-white/25 !text-white" : "!border-ink/20 !text-ink"}`}>
                  {owner ? "See Pricing" : "Log in"}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
