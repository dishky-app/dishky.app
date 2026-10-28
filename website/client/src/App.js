import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Routes, Route, useLocation, Navigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Navbar from "./components/Navbar/Navbar.js";
import Footer from "./components/Footer/Footer.js";
import BackToTop from "./components/ScrollUi/BackToTop.js";
import Preloader from "./components/Preloader/Preloader.js";
import useScrollAnimation from "./hooks/useScrollAnimation.js";
import { pageTransition } from "./animations/transitions.js";
import { ScrollTrigger } from "./animations/gsapSetup.js";
import { glideToTop, scrollToHashOrTop, refreshTriggersSoon } from "./utils/scroll.js";

import Home from "./pages/Home.js";
import UserPanel from "./pages/UserPanel.js";
import AdminPanel from "./pages/AdminPanel.js";
import { modules } from "./data/modules.js";
import Pricing from "./pages/Pricing.js";
import ModulePage from "./pages/ModulePage.js";
import Solutions from "./pages/Solutions.js";
import Branches from "./pages/Branches.js";
import Resources from "./pages/Resources.js";
import About from "./pages/About.js";
import Contact from "./pages/Contact.js";
import BookDemo from "./pages/BookDemo.js";
import Legal from "./pages/Legal.js";
import NotFound from "./pages/NotFound.js";
import Signup from "./pages/Signup.js";
import Login from "./pages/Login.js";
import ResetPassword from "./pages/ResetPassword.js";
import Account from "./pages/Account.js";
import Billing from "./pages/Billing.js";
import PaletteGuard from "./components/ui/PaletteGuard.js";

/** Gives a page its own design skin. The landing page is deliberately not skinned. */
const Skin = ({ s, children }) => <PaletteGuard skin={s}>{children}</PaletteGuard>;

// Old module URLs keep working: /platform/<slug>, /promotions, /events.
function LegacyModule({ slug: fixed }) {
  const params = useParams();
  const m = modules.find((x) => x.slug === (fixed || params.slug));
  return <Navigate to={m ? m.path : "/"} replace />;
}

function AnimatedRoutes() {
  const location = useLocation();
  const lastPath = useRef(location.pathname);
  const firstRender = useRef(true);

  // Going to a DIFFERENT page: the new page jumps itself to the top the
  // moment it mounts (see PageWrapper), after the old page has faded out.
  //
  // Staying on the SAME page (clicking the logo on Home, a hash link, or a
  // link to the page you are already on): there is no page swap, so glide
  // to the anchor, or to the top.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const samePage = lastPath.current === location.pathname;
    lastPath.current = location.pathname;
    if (samePage) scrollToHashOrTop(location.hash, { smooth: true });
  }, [location.key, location.pathname, location.hash]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
        {/* There is no features index page: the Features menu in the header lists every module. */}
        <Route path="/features" element={<Navigate to="/" replace />} />
        <Route path="/platform" element={<Navigate to="/" replace />} />
        <Route path="/user-panel" element={<PageWrapper><Skin s="bauhaus"><UserPanel /></Skin></PageWrapper>} />
        <Route path="/admin-panel" element={<PageWrapper><Skin s="mono"><AdminPanel /></Skin></PageWrapper>} />
        <Route path="/pricing" element={<PageWrapper><Skin s="swiss"><Pricing /></Skin></PageWrapper>} />
        <Route path="/promotions" element={<LegacyModule slug="promotions" />} />
        <Route path="/events" element={<LegacyModule slug="events" />} />
        <Route path="/platform/:slug" element={<LegacyModule />} />
        <Route path="/features/:slug" element={<PageWrapper><ModulePage /></PageWrapper>} />
        <Route path="/solutions" element={<PageWrapper><Skin s="noir"><Solutions /></Skin></PageWrapper>} />
        <Route path="/branches" element={<PageWrapper><Branches /></PageWrapper>} />
        <Route path="/resources" element={<PageWrapper><Skin s="blueprint"><Resources /></Skin></PageWrapper>} />
        <Route path="/about" element={<PageWrapper><Skin s="editorial"><About /></Skin></PageWrapper>} />
        <Route path="/contact" element={<PageWrapper><Skin s="receipt"><Contact /></Skin></PageWrapper>} />
        <Route path="/book-demo" element={<PageWrapper><Skin s="hazard"><BookDemo /></Skin></PageWrapper>} />
        <Route path="/signup" element={<PageWrapper><Signup /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/reset-password" element={<PageWrapper><ResetPassword /></PageWrapper>} />
        <Route path="/account" element={<PageWrapper><Account /></PageWrapper>} />
        <Route path="/account/billing" element={<PageWrapper><Skin s="outline"><Billing /></Skin></PageWrapper>} />
        <Route path="/legal/privacy" element={<PageWrapper><Skin s="soft"><Legal /></Skin></PageWrapper>} />
        <Route path="/legal/terms" element={<PageWrapper><Skin s="soft"><Legal /></Skin></PageWrapper>} />
        <Route path="/legal/security" element={<PageWrapper><Skin s="soft"><Legal /></Skin></PageWrapper>} />
        <Route path="/legal/cookies" element={<PageWrapper><Skin s="soft"><Legal /></Skin></PageWrapper>} />
        <Route path="*" element={<PageWrapper><Skin s="poster"><NotFound /></Skin></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

// Pages built from the landing page's own GSAP sections animate themselves.
const RICH_PAGES = /^\/($|features|solutions|about|resources|pricing)/;

function PageWrapper({ children }) {
  const { hash, pathname } = useLocation();

  // Mounts exactly when the previous page has finished exiting (AnimatePresence
  // is in "wait" mode), so this is the one moment to reset scroll: the old
  // page has already faded out in place, and the new one appears at the top
  // (or at its #anchor). Layout effect = before paint, so no flash of the old
  // scroll position. Goes through Lenis, otherwise Lenis glides the page back.
  useLayoutEffect(() => {
    scrollToHashOrTop(hash);
    refreshTriggersSoon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      data-auto-reveal={RICH_PAGES.test(pathname) ? undefined : ""}
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
    >
      {/* An AnimatePresence of its own keeps the many exit-animated widgets inside a page
          (demos, tabs, lists) from holding up the page-level exit, which used to leave
          the route blank. */}
      <AnimatePresence initial={false}>
        <React.Fragment key="page">{children}</React.Fragment>
      </AnimatePresence>
    </motion.div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  useScrollAnimation();

  // The homepage is mounted from the very first render, underneath the
  // preloader, so the preloader's final beat is a real reveal of the live
  // page rather than a fade to a second copy of it. It is held motionless
  // and non-interactive until the preloader finishes:
  //  - scroll is locked (nothing to scroll to yet, and it would fight the
  //    preloader's own full-screen presence)
  //  - pointer events are off (nothing underneath should be clickable while
  //    it is still covered)
  //  - ScrollTrigger only measures it once it is actually visible, below
  useEffect(() => {
    if (loading) document.documentElement.classList.add("is-locked");
    return () => document.documentElement.classList.remove("is-locked");
  }, [loading]);

  const handlePreloaderComplete = () => {
    setLoading(false);
    // The page underneath existed in the DOM the whole time but was
    // ignored by ScrollTrigger; refresh now that it is visible and
    // interactive so triggers measure its real, on-screen layout.
    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  return (
    <>
      {loading && <Preloader onComplete={handlePreloaderComplete} />}
      <div style={{ pointerEvents: loading ? "none" : "auto" }} aria-hidden={loading || undefined}>
        <Navbar />
        <main id="main" tabIndex={-1} className="outline-none">
          <AnimatedRoutes />
        </main>
        <Footer />
        <BackToTop />
      </div>
    </>
  );
}
