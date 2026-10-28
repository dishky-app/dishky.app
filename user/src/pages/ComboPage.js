import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./ComboPage.css";
import Button3D from "./shared/Button3D";
import ModalTransition from "./shared/ModalTransition";
import "./shared/ModalTransition.css";
import { useScrollHeader } from "./shared/useScrollHeader";
import api from "../api";
import socket from "../socket";
import { useToast } from "../components/Usetoast";
import closeIcon from "../assets/icons/close.png";
import { handleImgFallback } from "../App";
import cartIcon from "../assets/icons/cart.png";

/* ─── Animations ──────────────────────────────────────────── */
const pageVariant = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }
};

const overlayAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.18 } }
};

const sheetAnim = {
  hidden: { y: 60, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
  exit: { y: 40, opacity: 0, transition: { duration: 0.2 } }
};

const checkSpring = { type: "spring", stiffness: 300, damping: 18 };

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } }
};

const listRow = {
  hidden: { opacity: 0, x: 14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
};

// Fixed 3-image diagonal cascade — active image centered and full
// size, with the upcoming dish sitting above-right and the previous
// dish below-left, both noticeably large (not just faint background
// layers). Offsets/scale below are lifted directly from the approved
// reference layout.
//
// buildReelGeometry(xyScale) builds the FULL geometry pipeline (base
// slots → circle → angles → far-slots → arc paths) for a given x/y
// offset scale. Called once for desktop (scale 1) and once for phones
// (a smaller scale) below, so mobile gets genuinely smaller offsets —
// not a CSS transform fighting the page's overflow clipping — while
// every arc path stays derived from the SAME scaled circle as its
// matching resting position, so there's no mismatch/snap between the
// two at the end of a swipe transition.
// buildReelGeometry(xyScale, neighborScaleMult = 1, activeScaleMult = 1)
// — neighborScaleMult shrinks JUST the prev/next slots' own visual
// `scale` (not their x/y position), so their rendered footprint gets
// smaller and a visible gap opens up around the active dish — used on
// mobile/tablet, where xyScale alone can only pull them so close to
// the active dish before they'd clip off the viewport edge again.
// activeScaleMult scales the ACTIVE (centered) dish's own base 0.8
// scale independently of the neighbors — added so tablet can render a
// bigger centered dish without that also inflating (or being coupled
// to) prev/next's size.
const buildReelGeometry = (xyScale, neighborScaleMult = 1, activeScaleMult = 1) => {
  const REEL_SLOTS = [
    { x: -195 * xyScale, y: 390 * xyScale, scale: 0.4 * neighborScaleMult, rotate: 0, blur: 8, zIndex: 1 },   // previous (below-left)
    { x: 0, y: 0, scale: 0.8 * activeScaleMult, rotate: 0, blur: 0, zIndex: 3 },                              // active (front, centered)
    { x: 520 * xyScale, y: -130 * xyScale, scale: 0.5 * neighborScaleMult, rotate: 0, blur: 6, zIndex: 2 }    // next (above-right)
  ];

  // Circular motion between slots — the three resting spots above
  // happen to sit on a common circle, so instead of tweening straight
  // between them, each transition is sampled along that circle's arc
  // (a real curved/circular path) rather than a straight line.
  const circumcircleOf = (A, B, C) => {
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const cx = ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / d;
    const cy = ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / d;
    return { cx, cy, r: Math.hypot(A.x - cx, A.y - cy) };
  };

  const REEL_CIRCLE = circumcircleOf(REEL_SLOTS[0], REEL_SLOTS[1], REEL_SLOTS[2]);
  const angleOfSlot = (p) => Math.atan2(p.y - REEL_CIRCLE.cy, p.x - REEL_CIRCLE.cx) * (180 / Math.PI);
  const posOnCircle = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: REEL_CIRCLE.cx + REEL_CIRCLE.r * Math.cos(rad), y: REEL_CIRCLE.cy + REEL_CIRCLE.r * Math.sin(rad) };
  };

  let REEL_ANGLE_PREV = angleOfSlot(REEL_SLOTS[0]);
  let REEL_ANGLE_ACTIVE = angleOfSlot(REEL_SLOTS[1]);
  let REEL_ANGLE_NEXT = angleOfSlot(REEL_SLOTS[2]);
  while (REEL_ANGLE_ACTIVE < REEL_ANGLE_PREV) REEL_ANGLE_ACTIVE += 360;
  while (REEL_ANGLE_NEXT < REEL_ANGLE_ACTIVE) REEL_ANGLE_NEXT += 360;

  // The two off-display wrappers keep going around the SAME circle,
  // one step further out each side — so they sit outside the visible
  // display but still on the circular path, ready to sweep smoothly
  // into view instead of just fading in from a fixed, unrelated spot.
  const REEL_ANGLE_FAR_PREV = REEL_ANGLE_PREV - (REEL_ANGLE_ACTIVE - REEL_ANGLE_PREV);
  const REEL_ANGLE_FAR_NEXT = REEL_ANGLE_NEXT + (REEL_ANGLE_NEXT - REEL_ANGLE_ACTIVE);
  const REEL_FAR_PREV_POS = posOnCircle(REEL_ANGLE_FAR_PREV);
  const REEL_FAR_NEXT_POS = posOnCircle(REEL_ANGLE_FAR_NEXT);

  // All 5 wrapper roles, in circle order: far-prev, prev, active, next,
  // far-next. Only the middle 3 are ever opaque/interactive; the outer
  // two exist purely so their dish is pre-loaded and already sitting in
  // its correct circular spot the moment it needs to sweep into view.
  const REEL_SLOTS_5 = [
    { x: REEL_FAR_PREV_POS.x, y: REEL_FAR_PREV_POS.y, scale: REEL_SLOTS[0].scale * 0.75, rotate: 0, blur: REEL_SLOTS[0].blur + 4, zIndex: 0, opacity: 0 },
    { ...REEL_SLOTS[0], opacity: 1 },
    { ...REEL_SLOTS[1], opacity: 1 },
    { ...REEL_SLOTS[2], opacity: 1 },
    { x: REEL_FAR_NEXT_POS.x, y: REEL_FAR_NEXT_POS.y, scale: REEL_SLOTS[2].scale * 0.75, rotate: 0, blur: REEL_SLOTS[2].blur + 4, zIndex: 0, opacity: 0 }
  ];
  const REEL_ANGLES_5 = [REEL_ANGLE_FAR_PREV, REEL_ANGLE_PREV, REEL_ANGLE_ACTIVE, REEL_ANGLE_NEXT, REEL_ANGLE_FAR_NEXT];

  const ARC_STEPS = 32;
  const arcPath = (fromDeg, toDeg) => {
    const x = [], y = [];
    for (let i = 0; i <= ARC_STEPS; i++) {
      const deg = fromDeg + (toDeg - fromDeg) * (i / ARC_STEPS);
      const rad = (deg * Math.PI) / 180;
      x.push(REEL_CIRCLE.cx + REEL_CIRCLE.r * Math.cos(rad));
      y.push(REEL_CIRCLE.cy + REEL_CIRCLE.r * Math.sin(rad));
    }
    return { x, y };
  };

  // A hand-off happens between every adjacent pair of the 5 circle
  // positions (not just the visible 3) — e.g. on "next", the item
  // sitting off-display in the far-next spot sweeps in to become the
  // new next dish. Built once as curved paths along REEL_CIRCLE.
  const REEL_ARCS = {};
  for (let i = 0; i < REEL_ANGLES_5.length - 1; i++) {
    REEL_ARCS[`${i + 1}-${i}`] = arcPath(REEL_ANGLES_5[i + 1], REEL_ANGLES_5[i]);
    REEL_ARCS[`${i}-${i + 1}`] = arcPath(REEL_ANGLES_5[i], REEL_ANGLES_5[i + 1]);
  }

  return { REEL_SLOTS_5, REEL_ARCS };
};

// Built once at module load: full desktop-scale geometry, and a
// mobile variant with smaller x/y offsets so the peeking prev/next
// dishes land inside a phone-width viewport instead of being clipped
// by .combo-page's overflow-x: hidden. xyScale is sized against the
// wrapper's OWN visual scale too (each slot's `scale` field shrinks
// its 300px box independently, e.g. "next" renders at 150px wide) —
// so what matters is offset*xyScale + visibleHalfWidth staying under
// the ~171px half-viewport available on a 375px phone after the
// existing phone-breakpoint padding (see ComboPage.css's 578px
// block). The base REEL_SLOTS x offsets were widened (150→195,
// 400→520) to open a bigger visual gap between active/prev/next, so
// mobile's xyScale was nudged down (0.2→0.17) to keep the same
// on-screen offset and safety margin: next dish center offset
// 520*0.17≈88px, visual half-width 300*0.5*0.7/2=52.5px, right edge
// ≈140.5px — still comfortably inside the 171px bound. The 0.7
// neighborScaleMult shrinks prev/next's own footprint further
// (independent of their position), opening a visible gap around the
// active dish instead of them looking like they're touching it.
//
// xyScale bumped 0.17→0.2→0.22 across two rounds to widen the gap
// further per request ("more distance between prev/current/next on
// mobile"). Pushing xyScale alone past ~0.2 starts eating into the
// margin fast (0.24 alone would put the next dish's right edge at
// 177px, past the 171px bound), so this round also pulled
// neighborScaleMult down 0.7→0.6 — shrinking prev/next's own visual
// footprint a bit — to buy back room: next dish center offset
// 520*0.22=114.4px, visual half-width 300*0.5*0.6/2=45px, right edge
// ≈159.4px — still inside the 171px bound with ~11.6px to spare.
const DESKTOP_REEL_GEOMETRY = buildReelGeometry(1);
const MOBILE_REEL_GEOMETRY = buildReelGeometry(0.22, 0.6);

// Tablet variant — the 578-992px band was previously falling straight
// through to DESKTOP_REEL_GEOMETRY's raw (xyScale=1) offsets, which
// are sized against the desktop-width reel column. At tablet widths
// .combo-reel-images shrinks to 58-62% of a much narrower .combo-page
// (see ComboPage.css's 992px/768px blocks), so those same raw offsets
// (next dish at x:520) massively overflowed the actual available
// column — prev/next were rendering, just positioned entirely outside
// the visible area.
//
// xyScale=0.18/neighborScaleMult=0.5 fixed the overflow; bumped to
// 0.21/0.42 to also widen the gap further per request ("increase
// distance between prev/current/next"): at the tightest point of the
// band (579px width, 768px CSS block active: reel 58%, wrapper cap
// 220px), next dish right edge ≈135px vs a 154px available
// half-width — 19px margin (down from 30px at the old values, but
// still safely inside). At the wide end (991px), margin is far more
// generous. activeScaleMult=1.2 grows the centered active dish ~20%
// (base 0.8→0.96) per the "increase image size" request — verified
// against the same tightest width: active dish visual half-width
// ≈59px, next dish offset ≈109px at that width, leaving a clean 50px
// gap between them (no visual overlap).
const TABLET_REEL_GEOMETRY = buildReelGeometry(0.21, 0.42, 1.2);

const REEL_SPRING = { type: "spring", stiffness: 90, damping: 22, mass: 1.2 };
/* Faster crossfade for the name/price/description block specifically —
   snappier than the image reel's swipe so text feels immediate. */
const REEL_DETAILS_SPRING = { type: "spring", stiffness: 260, damping: 26, mass: 0.7 };
const REEL_ARC_TWEEN = { duration: 0.55, ease: [0.65, 0, 0.35, 1] };

/* ─── Helpers ─────────────────────────────────────────────── */
/* SLOT_LABELS / ANGLES are now derived at runtime from
   comboSectionConfig.sections (see buildSlotMeta below) instead of
   being hardcoded to starter/main/drink. */
const SLOT_ANGLE_CYCLE = [90, 45, 135, 60, 120];
const buildSlotMeta = (sections) => {
  const labels = {};
  const angles = {};
  sections.forEach((s, i) => {
    labels[s.key] = s.label;
    angles[s.key] = SLOT_ANGLE_CYCLE[i % SLOT_ANGLE_CYCLE.length];
  });
  return { labels, angles };
};

/* Fixed slot lookup for the reel — see REEL_SLOTS above. */
const reelSlotTransform = (geometry, slot) => geometry.REEL_SLOTS_5[slot];

const GroupNode = ({ item, type, slotIndex, onClick }) => (
  <motion.button
    className={`combo-group-node combo-group-node--slot-${slotIndex}`}
    layout
    initial={{ opacity: 0, scale: 0.5, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 220, damping: 26 }}
    onClick={onClick}
    aria-label={`Change ${item.name}`}
  >
    <motion.img
      layoutId={`combo-fly-${type}`}
      src={item.image}
      alt={item.name}
      draggable={false}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      onError={handleImgFallback}
    />
  </motion.button>
);

/* ─── FoodList-style swipeable reel for the active phase ─────── */
const ComboReel = ({ items, angle, type, slotIndex, onSelect }) => {
  const [renderIndex, setRenderIndex] = useState(0);
  const [direction, setDirection] = useState(null); // 'next' | 'prev' | null
  const startX = useRef(0);
  const startY = useRef(0);
  const isPointerDown = useRef(false);

  // Three-tier breakpoint matching ComboPage.css's own bands (578px
  // phone cutoff, 992px tablet cutoff) so the reel's JS geometry
  // always matches whichever CSS layout is actually active — previously
  // this was a straight mobile/desktop split, so the whole 578-992px
  // tablet band fell through to DESKTOP_REEL_GEOMETRY's raw offsets,
  // sized for the full desktop-width column. At tablet widths
  // .combo-reel-images is only 58-62% of a much narrower page, so
  // those offsets pushed prev/next entirely outside the visible
  // column — not clipped by overflow so much as positioned off in
  // space beyond it.
  const getTier = () => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w <= 578) return "mobile";
    if (w <= 992) return "tablet";
    return "desktop";
  };
  const [tier, setTier] = useState(getTier);
  useEffect(() => {
    const onResize = () => setTier(getTier());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const geometry =
    tier === "mobile"
      ? MOBILE_REEL_GEOMETRY
      : tier === "tablet"
        ? TABLET_REEL_GEOMETRY
        : DESKTOP_REEL_GEOMETRY;

  useEffect(() => { setRenderIndex(0); setDirection(null); }, [items]);

  if (!items.length) {
    return <div className="combo-reel-empty">Nothing here yet — check back soon.</div>;
  }

  // 5 slots total: [farPrev, prev, active, next, farNext]. Only the
  // middle 3 (prev/active/next) are ever visible — farPrev/farNext
  // stay in the DOM purely so their dish's image is already loaded
  // by the time it swipes into view, avoiding a pop-in flash.
  const n = items.length;
  const visible = [
    items[(renderIndex - 2 + n * 2) % n],
    items[(renderIndex - 1 + n) % n],
    items[renderIndex],
    items[(renderIndex + 1) % n],
    items[(renderIndex + 2) % n]
  ];

  const goNext = () => {
    setDirection("next");
    setRenderIndex(i => (i + 1) % items.length);
  };
  const goPrev = () => {
    setDirection("prev");
    setRenderIndex(i => (i - 1 + items.length) % items.length);
  };
  const active = visible[2];

  return (
    <div
      className="combo-reel"
      onPointerDown={(e) => {
        if (n === 1 || e.target.closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        startX.current = e.clientX;
        startY.current = e.clientY;
        isPointerDown.current = true;
      }}
      onPointerUp={(e) => {
        if (n === 1 || !isPointerDown.current) return;
        isPointerDown.current = false;
        const dy = startY.current - e.clientY;
        const dx = Math.abs(startX.current - e.clientX);
        if (dx > Math.abs(dy)) return;
        // dy > 0 means the pointer's Y position decreased, i.e. the
        // finger moved toward the TOP of the screen — a swipe up.
        // Swipe up → previous dish. Swipe down → next dish.
        if (dy > 40) goPrev();
        else if (dy < -40) goNext();
      }}
      onPointerCancel={() => { isPointerDown.current = false; }}
    >
      <div className="combo-reel-details">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
            transition={REEL_DETAILS_SPRING}
            style={{ height: "150px" }}
          >
            <h2 className="combo-reel-name">{active.name}</h2>
            <div className="combo-reel-price">₹{active.price ?? active.basePrice ?? 0}</div>
            {active.description && <p className="combo-reel-desc">{active.description}</p>}
          </motion.div>
        </AnimatePresence>

        <Button3D className="btn-3d red" style={{ marginTop: 22, width: "fit-content" }} onClick={() => onSelect(active)}>
          Select »
        </Button3D>
      </div>

      <div className={`combo-reel-images combo-reel-images--slot-${slotIndex}`}>
        {(() => {
          // With few items (n < 5), the same dish id can land in more
          // than one of the 5 slots at once (e.g. n=2 repeats each
          // dish across 2-3 slots via modulo wrap). Since each element
          // below is now keyed by dish id alone (so it can persist and
          // animate smoothly across an advance instead of remounting —
          // see the comment on the key prop), two slots sharing an id
          // would collide as duplicate React keys. Keep only the
          // occurrence closest to center (slot 2) per id; render the
          // rest as null, same principle as FoodList's seenIds dedupe.
          const centerSlotById = new Map();
          visible.forEach((item, slot) => {
            if (!item) return;
            const prevSlot = centerSlotById.get(item.id);
            if (prevSlot === undefined || Math.abs(slot - 2) < Math.abs(prevSlot - 2)) {
              centerSlotById.set(item.id, slot);
            }
          });
          return visible.map((item, slot) => (item && centerSlotById.get(item.id) === slot ? item : null));
        })().map((item, slot) => {
          // slot maps 1:1 onto the 5 circle roles: 0=far-prev,
          // 1=prev, 2=active, 3=next, 4=far-next. The two edges stay
          // fully off-display (opacity 0, non-interactive) but sit
          // in their real circular position, so when an item's role
          // shifts into view it sweeps in along the arc instead of
          // just fading in from nowhere.
          if (!item) return null;
          const isActive = slot === 2;

          // With only one item, every "role" resolves to that same
          // dish (n === 1 modulo wraps every index to 0) — rendering
          // all 5 would visibly duplicate the single image on either
          // side of center. Skip every non-active role in that case.
          if (n === 1 && !isActive) return null;

          const t = reelSlotTransform(geometry, slot);
          const isEdge = slot === 0 || slot === 4;

          // Which arc this slot is sweeping along right now — every
          // adjacent pair of the 5 circle roles hands off on each
          // nav action, including the two off-display ones.
          const arcKey =
            direction === "next" ? (slot < 4 ? `${slot + 1}-${slot}` : null)
              : direction === "prev" ? (slot > 0 ? `${slot - 1}-${slot}` : null)
                : null;
          const arc = arcKey ? geometry.REEL_ARCS[arcKey] : null;

          return (
            <motion.div
              // Keyed by dish id ALONE (not the slot it currently
              // occupies) so the same DOM/motion element persists as a
              // dish's role shifts across an advance — Framer Motion
              // then interpolates its x/y/rotate/scale continuously
              // along the arc below instead of unmounting one slot's
              // element and mounting a fresh one at the new slot,
              // which is what caused the old snap/"clink".
              key={item.id}
              className={`combo-reel-image-wrapper${isEdge ? " combo-reel-image-wrapper--hidden" : ""}`}
              aria-hidden={isEdge ? "true" : undefined}
              initial={{ x: t.x, y: t.y, rotate: t.rotate, scale: t.scale * 0.9, opacity: 0 }}
              animate={{
                x: arc ? arc.x : t.x,
                y: arc ? arc.y : t.y,
                rotate: t.rotate,
                scale: t.scale,
                zIndex: t.zIndex,
                opacity: t.opacity
              }}
              transition={arc ? REEL_ARC_TWEEN : REEL_SPRING}
              onAnimationComplete={() => {
                if (isActive && direction) setDirection(null);
              }}
            >
              <motion.img
                src={item.image}
                alt={item.name}
                className="combo-reel-image"
                layoutId={isActive ? `combo-fly-${type}` : undefined}
                animate={{ filter: `blur(${t.blur}px)` }}
                transition={REEL_SPRING}
                draggable={false}
                onError={handleImgFallback}
              />
            </motion.div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="combo-reel-nav">
          <Button3D className="btn-3d white" onClick={goPrev} aria-label="Previous dish">▲</Button3D>
          <Button3D className="btn-3d white" onClick={goNext} aria-label="Next dish">▼</Button3D>
        </div>
      )}
    </div>
  );
};

/* ─── Cart / "My Combo" list content (clone of "My Order") ──── */
const MyComboContent = ({
  selectedItems,
  slotLabels,
  quantity,
  setQuantity,
  originalTotal,
  discountedPrice,
  savings,
  matchedOffer,
  isComboComplete,
  onDelete
}) => (
  <div className="combo-cart-content">
    <motion.div className="combo-cart-list" variants={listStagger} initial="hidden" animate="show">
      <AnimatePresence initial={false}>
        {Object.keys(slotLabels).map(key => {
          const item = selectedItems[key];
          const label = slotLabels[key];
          return (
            <motion.div
              key={key}
              layout
              variants={listRow}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -14, transition: { duration: 0.18 } }}
              className={`combo-cart-row ${item ? "filled" : "empty"}`}
            >
              <div className="combo-cart-row-text">
                <span className="combo-cart-row-label">{label}</span>
                <span className="combo-cart-row-name">{item ? item.name : "Not selected"}</span>
              </div>
              {item ? (
                <div className="combo-cart-row-right">
                  <span className="combo-cart-row-price">₹{item.price ?? item.basePrice ?? 0}</span>
                  <Button3D
                    as={motion.button}
                    className="btn-3d white"
                    onClick={() => onDelete(key)}
                    aria-label={`Remove ${label}`}
                    whileTap={{ scale: 0.8 }}
                    frontClassName="close-padding"
                  >
                    <img style={{ width: "14px", height: "14px" }} src={closeIcon} alt="Remove" />
                  </Button3D>
                </div>
              ) : (
                <span className="combo-cart-row-empty">—</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>

    {isComboComplete && (
      <>
        <div className="combo-cart-qty">
          <span>Quantity</span>
          <div className="stepper-ctrl">
            <button
              as={motion.button}
              className="stepper-btn"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity === 1}
              aria-label="Decrease quantity"
              whileTap={{ scale: 0.85 }}
            >
              −
            </button>
            <span className="stepper-val">{quantity}</span>
            <button
              as={motion.button}
              className="stepper-btn"
              onClick={() => setQuantity(q => q + 1)}
              aria-label="Increase quantity"
              whileTap={{ scale: 0.85 }}
            >
              +
            </button>
          </div>
        </div>

        <div className="combo-cart-divider" />

        <div className="combo-cart-totals">
          <div className="combo-cart-total-row">
            <span>Subtotal</span>
            <span>₹{originalTotal}</span>
          </div>
          {matchedOffer && savings > 0 && (
            <div className="combo-cart-total-row combo-cart-savings">
              <span>{matchedOffer.label || "Offer applied"}</span>
              <span>−₹{savings}</span>
            </div>
          )}
          <div className="combo-cart-total-row final">
            <span>Total</span>
            <span>₹{discountedPrice}</span>
          </div>
        </div>
      </>
    )}
  </div>
);

/* ─── Receipt-style confirmation (clone of "Order Successful") ─ */
const AddedConfirmation = ({ comboTitle, discountedPrice, onDone }) => (
  <motion.div
    className="combo-receipt"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
  >
    <motion.div
      className="combo-receipt-check"
      initial={{ scale: 0, rotate: -35 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ ...checkSpring, delay: 0.08 }}
    >
      ✓
    </motion.div>
    <motion.h3 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.25 }}>
      Added to Bag!
    </motion.h3>
    <motion.p
      className="combo-receipt-sub"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.26, duration: 0.25 }}
    >
      Your combo is waiting in your bag
    </motion.p>

    <div className="combo-cart-divider" />

    <div className="combo-receipt-row">
      <span>{comboTitle}</span>
      <span>₹{discountedPrice}</span>
    </div>

    <Button3D
      as={motion.button}
      className="btn-3d green combo-receipt-done"
      onClick={onDone}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32, duration: 0.25 }}
      style={{ width: "100%" }}
    >
      Done
    </Button3D>
  </motion.div>
);

/* ─── Main Component ──────────────────────────────────────── */
const ComboPage = ({ foodData, addToBag, updateBagItem, handleBack, handleHome, currentUser, setCurrentUser }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { headerRef, scrolled } = useScrollHeader();
  const isEditMode = location.state?.fromBag;
  const editQuantity = location.state?.quantity;
  const editIndex = location.state?.bagIndex;

  /* ── Section config (Dishes/Desserts/Beverages etc., configured
     via Manage Categories in the admin Combo Offers page) — fetched
     live, never hardcoded. Each section's categoryIds is matched
     against foodData.categories, and only dishes flagged
     eventField === "yes" are included. ── */
  const [sectionConfig, setSectionConfig] = useState({ sections: [] });

  /* ── Admin-configured discount rules (Manage → Combo Offers tab).
     Each offer's `condition` maps section key → exact dish name (plus
     that dish's price at save-time, used only as a display fallback).
     Fetched + kept live the same way as sectionConfig, so an admin
     adding/editing/deleting an offer reflects here without a reload. ── */
  const [comboOffers, setComboOffers] = useState([]);

  useEffect(() => {
    const fetchSectionConfig = () => {
      api.get("/combo-section-config/public")
        .then(res => setSectionConfig(res.data || { sections: [] }))
        .catch(() => setSectionConfig({ sections: [] }));
    };
    const fetchComboOffers = () => {
      api.get("/combo-offers/public")
        .then(res => setComboOffers(Array.isArray(res.data) ? res.data : []))
        .catch(() => setComboOffers([]));
    };
    fetchSectionConfig();
    fetchComboOffers();
    const handler = ({ resource }) => {
      if (resource === "comboSectionConfig") fetchSectionConfig();
      if (resource === "combo_offers") fetchComboOffers();
    };
    socket.on("data-change", handler);
    socket.on("combo-update", handler);
    return () => {
      socket.off("data-change", handler);
      socket.off("combo-update", handler);
    };
  }, []);

  const configSections = useMemo(() => sectionConfig.sections || [], [sectionConfig]);
  const { labels: slotLabels, angles: slotAngles } = useMemo(() => buildSlotMeta(configSections), [configSections]);

  /* ── Data: build one "section" per configured slot, each holding
     its matched categories (e.g. Dishes → Pizza/Burger/Sandwich),
     and within each category its subCategory groups (e.g.
     Beverages → Cold Coffee/Iced Tea/...). Items are restricted to
     eventField === "yes" dishes only. ── */
  const categories = useMemo(() => (Array.isArray(foodData?.categories) ? foodData.categories : []), [foodData]);

  const sections = useMemo(() => {
    return configSections.map(cfg => {
      const matchedCats = categories.filter(c => (cfg.categoryIds || []).includes(c.id));
      const sectionCategories = matchedCats.map(cat => {
        let groups;
        if (Array.isArray(cat.subCategories) && cat.subCategories.length) {
          groups = cat.subCategories
            .map(sub => ({
              id: `${cat.id}__${sub.id}`,
              title: sub.name,
              items: (sub.dishes || []).filter(d => d.eventField === "yes")
            }))
            .filter(g => g.items.length);
        } else {
          const items = (cat.dishes || []).filter(d => d.eventField === "yes");
          groups = items.length ? [{ id: `${cat.id}__all`, title: cat.name, items }] : [];
        }
        return { id: cat.id, title: cat.name, groups };
      }).filter(c => c.groups.length);

      // Flat list of every group across every category in this
      // section — used as the fallback "all groups" view when no
      // category has been chosen yet, and for backward-compat call
      // sites that just want groups regardless of category.
      const groups = sectionCategories.flatMap(c => c.groups);

      return { key: cfg.key, label: cfg.label, categories: sectionCategories, groups };
    });
  }, [configSections, categories]);

  const sectionByKey = useCallback((key) => sections.find(s => s.key === key) || { groups: [], categories: [] }, [sections]);

  /* ── State ── */
  const [activeCategoryBySection, setActiveCategoryBySection] = useState({});
  const [activeGroupBySection, setActiveGroupBySection] = useState({});
  const [showAddFavConfirm, setShowAddFavConfirm] = useState(false);
  const [showDuplicateOverlay, setShowDuplicateOverlay] = useState(false);
  const [isSavingFav, setIsSavingFav] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [quantity, setQuantity] = useState(() => (isEditMode && editQuantity) ? editQuantity : 1);

  const [selectedItems, setSelectedItems] = useState(() => {
    if (location.state?.comboItems) return location.state.comboItems;
    return {};
  });

  /* ── Keep selectedItems keyed to whatever sections are currently
     configured (drop stale keys if the admin removes a section,
     add fresh empty slots for newly added ones). ── */
  useEffect(() => {
    setSelectedItems(prev => {
      const next = {};
      let changed = false;
      for (const s of sections) {
        next[s.key] = prev[s.key] || null;
        if (prev[s.key] !== next[s.key]) changed = true;
      }
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
  }, [sections]);

  const getActiveCategory = useCallback((key) => {
    const section = sectionByKey(key);
    return activeCategoryBySection[key] || section.categories?.[0]?.id || null;
  }, [activeCategoryBySection, sectionByKey]);

  const setActiveCategory = useCallback((key, categoryId) => {
    setActiveCategoryBySection(prev => ({ ...prev, [key]: categoryId }));
    // Switching category resets the subcategory pick to that
    // category's first group, so the two tiers never mismatch.
    setActiveGroupBySection(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const getActiveCategoryObj = useCallback((key) => {
    const section = sectionByKey(key);
    const catId = getActiveCategory(key);
    return (section.categories || []).find(c => c.id === catId) || { groups: [] };
  }, [sectionByKey, getActiveCategory]);

  const getActiveGroup = useCallback((key) => {
    const catObj = getActiveCategoryObj(key);
    return activeGroupBySection[key] || catObj.groups?.[0]?.id || null;
  }, [activeGroupBySection, getActiveCategoryObj]);

  const setActiveGroup = useCallback((key, groupId) => {
    setActiveGroupBySection(prev => ({ ...prev, [key]: groupId }));
  }, []);

  const perComboBasePrice = useMemo(() => (
    Object.values(selectedItems).filter(Boolean).reduce((s, i) => s + Number(i.price ?? i.basePrice ?? 0), 0)
  ), [selectedItems]);

  /* ── Match the current selection against admin-configured combo
     offers. An offer's `condition` only lists the section keys it
     cares about (e.g. an offer might only require dishes+beverages,
     ignoring desserts) — so a match requires every key present in
     the offer's condition to have a currently-selected dish with the
     exact same name; any selected sections the offer doesn't mention
     are simply irrelevant to it. Ties (more than one matching offer)
     go to whichever gives the customer the bigger discount. ── */
  const matchedOffer = useMemo(() => {
    if (!comboOffers.length) return null;

    const conditionKeys = (offer) =>
      Object.keys(offer.condition || {}).filter(k => !k.endsWith("Price"));

    const isMatch = (offer) => {
      const keys = conditionKeys(offer);
      if (!keys.length) return false;
      return keys.every(k => {
        const picked = selectedItems[k];
        return picked && picked.name === offer.condition[k];
      });
    };

    const calcFinal = (base, type, value) => {
      if (type === "PERCENT") return Math.max(0, base - (base * value) / 100);
      if (type === "FLAT") return Math.max(0, base - value);
      return base;
    };

    let best = null;
    let bestFinal = perComboBasePrice;
    for (const offer of comboOffers) {
      if (!isMatch(offer)) continue;
      const final = calcFinal(perComboBasePrice, offer.type, Number(offer.value) || 0);
      if (!best || final < bestFinal) {
        best = offer;
        bestFinal = final;
      }
    }
    return best;
  }, [comboOffers, selectedItems, perComboBasePrice]);

  const perComboFinalPrice = useMemo(() => {
    if (!matchedOffer) return perComboBasePrice;
    const value = Number(matchedOffer.value) || 0;
    if (matchedOffer.type === "PERCENT") return Math.max(0, perComboBasePrice - (perComboBasePrice * value) / 100);
    if (matchedOffer.type === "FLAT") return Math.max(0, perComboBasePrice - value);
    return perComboBasePrice;
  }, [matchedOffer, perComboBasePrice]);

  // Round every customer-facing figure — total, discount, and final
  // amount all display and save as whole rupees, never fractional paise.
  const originalTotal = Math.round(perComboBasePrice * quantity);
  const discountedPrice = Math.round(perComboFinalPrice * quantity);
  const savings = originalTotal - discountedPrice;

  const sectionKeys = useMemo(() => sections.map(s => s.key), [sections]);
  const isComboComplete = sectionKeys.length > 0 && sectionKeys.every(k => !!selectedItems[k]);
  const selectedCount = sectionKeys.filter(k => !!selectedItems[k]).length;

  /* ── Offer hint (suggestion modal) — ported from the earlier
     starter/main/drink build, generalised to work over however many
     dynamic sections are configured today.

     Fires only when exactly one section is filled: at that point we
     look for any offer whose condition includes the picked dish under
     the matching section key, then suggest whichever *other* dish that
     same offer requires — provided it can actually be found in that
     other section's current menu (categories can change, so a name
     saved on the offer might no longer resolve to a real item). ── */
  const findComboItemByName = useCallback((sectionKey, name) => {
    const section = sectionByKey(sectionKey);
    for (const group of (section.groups || [])) {
      const found = (group.items || []).find(i => i.name === name);
      if (found) return found;
    }
    return null;
  }, [sectionByKey]);

  const getOfferHint = useCallback(() => {
    if (selectedCount !== 1 || !comboOffers.length) return null;

    const filledKey = sectionKeys.find(k => selectedItems[k]);
    if (!filledKey) return null;
    const filledItem = selectedItems[filledKey];

    for (const offer of comboOffers) {
      const condition = offer.condition || {};
      if (condition[filledKey] !== filledItem.name) continue;

      // Find the first other section key this offer also requires,
      // that isn't filled yet — that's what we suggest adding next.
      const targetKey = sectionKeys.find(k =>
        k !== filledKey && condition[k] && !selectedItems[k]
      );
      if (!targetKey) continue;

      const targetName = condition[targetKey];
      const targetItem = findComboItemByName(targetKey, targetName);
      if (!targetItem) continue; // offer references a dish no longer in that section

      return {
        message: `Add "${targetName}" to unlock ${offer.label}`,
        targetKey,
        targetItem,
      };
    }
    return null;
  }, [selectedCount, comboOffers, sectionKeys, selectedItems, findComboItemByName]);

  const [offerHint, setOfferHint] = useState(null);
  useEffect(() => {
    setOfferHint(getOfferHint());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCount, JSON.stringify(Object.fromEntries(sectionKeys.map(k => [k, selectedItems[k]?.name || null]))), comboOffers]);

  const comboTitle = useMemo(() => {
    if (!isComboComplete) return "";
    return sectionKeys.map(k => selectedItems[k].name).join(" + ");
  }, [selectedItems, isComboComplete, sectionKeys]);

  const phase = sectionKeys.find(k => !selectedItems[k]) || (sectionKeys.length ? "done" : null);
  const phaseTypeKey = phase && phase !== "done" ? phase : null;

  const handlePick = useCallback((type, item) => {
    setSelectedItems(prev => {
      const idx = sectionKeys.indexOf(type);
      const wasAlreadyFilled = !!prev[type];
      const isActualChange = wasAlreadyFilled && prev[type].name !== item.name;
      const next = { ...prev, [type]: item };
      // Only cascade-clear later slots when this pick genuinely changes
      // an already-filled section — that's the case where downstream
      // choices (picked based on the old value) may no longer make
      // sense. Filling a slot that was still empty (e.g. picking
      // category2 after an offer hint already filled category3 out of
      // order) must never wipe sections that were already chosen.
      if (isActualChange) {
        sectionKeys.slice(idx + 1).forEach(k => { next[k] = null; });
      }
      return next;
    });
    setActiveGroupBySection(prev => {
      const idx = sectionKeys.indexOf(type);
      const wasAlreadyFilled = !!selectedItems[type];
      const isActualChange = wasAlreadyFilled && selectedItems[type].name !== item.name;
      if (!isActualChange) return prev;
      const next = { ...prev };
      sectionKeys.slice(idx + 1).forEach(k => { delete next[k]; });
      return next;
    });
    setActiveCategoryBySection(prev => {
      const idx = sectionKeys.indexOf(type);
      const wasAlreadyFilled = !!selectedItems[type];
      const isActualChange = wasAlreadyFilled && selectedItems[type].name !== item.name;
      if (!isActualChange) return prev;
      const next = { ...prev };
      sectionKeys.slice(idx + 1).forEach(k => { delete next[k]; });
      return next;
    });
  }, [sectionKeys, selectedItems]);

  /* ── Open "My Combo" sheet automatically once the last section
     completes the combo, instead of waiting for the cart icon tap.
     Only fires on the false → true transition, so manually closing
     the sheet afterwards won't reopen it. ── */
  useEffect(() => {
    if (isComboComplete) setShowCart(true);
  }, [isComboComplete]);

  const handleUndo = useCallback((type) => {
    const idx = sectionKeys.indexOf(type);
    setSelectedItems(prev => {
      const next = { ...prev };
      sectionKeys.slice(idx).forEach(k => { next[k] = null; });
      return next;
    });
    setActiveGroupBySection(prev => {
      const next = { ...prev };
      sectionKeys.slice(idx).forEach(k => { delete next[k]; });
      return next;
    });
    setActiveCategoryBySection(prev => {
      const next = { ...prev };
      sectionKeys.slice(idx).forEach(k => { delete next[k]; });
      return next;
    });
  }, [sectionKeys]);

  const handleHintAdd = useCallback(() => {
    if (!offerHint) return;
    handlePick(offerHint.targetKey, offerHint.targetItem);
    setOfferHint(null);
  }, [offerHint, handlePick]);

  const handleAddToBag = useCallback(() => {
    // Round every price on the bag/order line item — this is what gets
    // persisted with the order, so rounding here (not just on screen)
    // is what keeps the database free of fractional-rupee amounts.
    const roundedFinal = Math.round(perComboFinalPrice);
    const roundedBase = Math.round(perComboBasePrice);
    const comboItem = {
      id: `combo_${Date.now()}`,
      name: comboTitle,
      categoryId: "combo",
      quantity,
      unitPrice: roundedFinal,
      perComboBasePrice: roundedBase,
      perComboFinalPrice: roundedFinal,
      totalPrice: discountedPrice,
      originalPrice: originalTotal,
      comboItems: selectedItems,
      isCombo: true
    };
    if (isEditMode) updateBagItem(editIndex, comboItem);
    else addToBag(comboItem);
    setJustAdded(true);
  }, [comboTitle, quantity, perComboFinalPrice, perComboBasePrice, originalTotal, discountedPrice, selectedItems, isEditMode, editIndex, addToBag, updateBagItem]);

  const handleCloseConfirmation = useCallback(() => {
    setJustAdded(false);
    setShowCart(false);
    setQuantity(1);
  }, []);

  const handleDoneReceipt = useCallback(() => {
    handleCloseConfirmation();
    handleHome?.();
  }, [handleCloseConfirmation, handleHome]);

  const handleConfirmAddFav = useCallback(async () => {
    if (!currentUser || !isComboComplete) return;
    setIsSavingFav(true);

    const itemsByLabel = {};
    sectionKeys.forEach(k => { itemsByLabel[k] = selectedItems[k].name; });

    const newCombo = {
      id: `favcombo_${Date.now()}`,
      title: comboTitle,
      items: itemsByLabel,
      comboItems: selectedItems,
      originalPrice: originalTotal,
      perComboFinalPrice: Math.round(perComboFinalPrice),
      totalPrice: discountedPrice,
      createdAt: new Date().toISOString()
    };

    const existingCombos = currentUser.combo || [];
    const isDuplicate = existingCombos.some(c =>
      sectionKeys.every(k => c.items?.[k] === newCombo.items[k])
    );

    if (isDuplicate) { setIsSavingFav(false); setShowAddFavConfirm(false); setShowDuplicateOverlay(true); return; }

    try {
      const updatedUser = { ...currentUser, combo: [...existingCombos, newCombo] };
      await api.put(`/users/${currentUser.id}`, updatedUser);
      setCurrentUser(updatedUser);
      setShowAddFavConfirm(false);
    } catch (err) {
      console.error("Failed to save favourite combo", err);
      toast.error("Couldn't save to favourites. Please try again.");
      setShowAddFavConfirm(false);
    } finally {
      setIsSavingFav(false);
    }
  }, [currentUser, isComboComplete, comboTitle, selectedItems, originalTotal, perComboFinalPrice, discountedPrice, sectionKeys, setCurrentUser, toast]);

  /* ── Items / groups feeding the active reel, for whichever
     section key is currently active — resolved through the active
     category first (Pizza/Burger/Sandwich), then the active
     subcategory group within it (Cold Coffee/Iced Tea/...). ── */
  const activeSection = phaseTypeKey ? sectionByKey(phaseTypeKey) : { groups: [], categories: [] };
  const phaseCategories = activeSection.categories || [];
  const phaseActiveCategoryId = phaseTypeKey ? getActiveCategory(phaseTypeKey) : null;
  const activeCategoryObj = phaseTypeKey ? getActiveCategoryObj(phaseTypeKey) : { groups: [] };
  const activeGroupId = phaseTypeKey ? getActiveGroup(phaseTypeKey) : null;
  const activeItems = useMemo(() => (
    (activeCategoryObj.groups || []).find(g => g.id === activeGroupId)?.items || []
  ), [activeCategoryObj, activeGroupId]);

  useEffect(() => {
    if (!phaseTypeKey) return;
    if (!activeCategoryBySection[phaseTypeKey] && phaseCategories[0]?.id) {
      setActiveCategory(phaseTypeKey, phaseCategories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseTypeKey, phaseCategories]);

  useEffect(() => {
    if (!phaseTypeKey) return;
    if (!activeGroupBySection[phaseTypeKey] && activeCategoryObj.groups?.[0]?.id) {
      setActiveGroup(phaseTypeKey, activeCategoryObj.groups[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseTypeKey, activeCategoryObj]);

  const phaseGroups = activeCategoryObj.groups || [];
  const phaseActiveGroup = activeGroupId;
  const setPhaseActiveGroup = useCallback((groupId) => {
    if (phaseTypeKey) setActiveGroup(phaseTypeKey, groupId);
  }, [phaseTypeKey, setActiveGroup]);

  const setPhaseActiveCategory = useCallback((categoryId) => {
    if (phaseTypeKey) setActiveCategory(phaseTypeKey, categoryId);
  }, [phaseTypeKey, setActiveCategory]);

  const phaseSlotIndex = phaseTypeKey ? sectionKeys.indexOf(phaseTypeKey) : 0;
  const phaseLabel = phaseTypeKey ? slotLabels[phaseTypeKey] : null;

  return (
    <motion.div className="no-padding" variants={pageVariant} initial="hidden" animate="show">

      {/* ── Top bar (back chevron + bag) ── */}
      <div ref={headerRef} style={{flexWrap:"wrap"}} className={`pl-header${scrolled ? " header-scrolled" : ""}`}>
        <motion.button className="back-button" onClick={handleBack} aria-label="Back" whileTap={{ scale: 0.85, x: -2 }} />

        <div className="combo-phase-label">
          {phase === "done"
            ? "Your combo is grouped"
            : phaseLabel
              ? `Swipe up or down to browse, pick a ${phaseLabel.toLowerCase()}`
              : "No combo sections configured yet"}
        </div>

        {/* ── Section pills (Dishes / Desserts / Beverages) — pure
             progress indicator, matches the sequential picking order
             and is NOT clickable to jump ahead or back. ── */}
        {sections.length > 1 && (
          <div className="combo-size-pills">
            {sections.map(s => {
              const isDone = !!selectedItems[s.key];
              const isCurrent = s.key === phaseTypeKey;
              const isDisabled = !isCurrent; // done + upcoming are locked; only the active pill stays live
              return (
                <Button3D
                  key={s.key}
                  className={`chip combo-section-pill${isCurrent ? " active" : ""}${isDone ? " combo-section-pill--done" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : 0}
                >
                  {s.label}
                </Button3D>
              );
            })}
          </div>
        )}

        <div className="combo-topbar-actions">
          {currentUser && currentUser.id !== "guest" && (
            <Button3D
              as={motion.button}
              className="btn-3d white"
              onClick={() => navigate("/favourite-combos")}
              aria-label="My favourite combos"
              whileTap={{ scale: 0.88 }}
            >
              Favourites
            </Button3D>
          )}
          <Button3D
            as={motion.button}
            className="btn-3d white sq-padding combo-icon-btn"
            onClick={() => setShowCart(true)}
            aria-label="View your combo"
            whileTap={{ scale: 0.88 }}
          >
            <img src={cartIcon} alt="Cart" />
            <AnimatePresence>
              {selectedCount > 0 && (
                <motion.span
                  key={selectedCount}
                  className="combo-badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={checkSpring}
                >
                  {selectedCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Button3D>
        </div>
      </div>

      <div className="pl-body">
        {/* ── Category pills for the active section (e.g. Dishes →
           Pizza / Burger / Sandwich) — freely clickable, only
           shown when the section maps to more than one category. ── */}
        <AnimatePresence mode="popLayout" initial={false}>
          {phaseCategories.length > 1 && (
            <motion.div
              key={`cat-${phase}`}
              className="combo-size-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="combo-size-pills">
                {phaseCategories.map(c => (
                  <Button3D
                    key={c.id}
                    as={motion.button}
                    className={`chip ${phaseActiveCategoryId === c.id ? "active" : ""}`}
                    onClick={() => setPhaseActiveCategory(c.id)}
                    whileTap={{ scale: 0.95 }}
                    style={{ marginTop: "10px", marginBottom: "10px" }}
                  >
                    {c.title}
                  </Button3D>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Group pills for the active phase (subcategory, e.g.
           Beverages → Cold Coffee / Iced Tea / Hot Coffee) ── */}
        <AnimatePresence mode="popLayout" initial={false}>
          {phaseGroups.length > 1 && (
            <motion.div
              key={`grp-${phase}-${phaseActiveCategoryId}`}
              className="combo-size-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="combo-size-pills">
                {phaseGroups.map(g => (
                  <Button3D
                    key={g.id}
                    as={motion.button}
                    className={`chip ${phaseActiveGroup === g.id ? "active" : ""}`}
                    onClick={() => setPhaseActiveGroup(g.id)}
                    whileTap={{ scale: 0.95 }}
                    style={{ marginTop: "10px", marginBottom: "10px" }}
                  >
                    {g.title}
                  </Button3D>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Swipeable reel — crossfades between phases, hidden once the
           combo is complete since the sheet modal takes over from there ── */}
        <AnimatePresence mode="popLayout" initial={false}>
          {phase !== "done" && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 16, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(5px)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: "100%" }}
            >
              <ComboReel
                items={activeItems}
                angle={phaseTypeKey ? (slotAngles[phaseTypeKey] ?? 90) : 90}
                type={phaseTypeKey}
                slotIndex={phaseSlotIndex}
                onSelect={(item) => handlePick(phaseTypeKey, item)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Grouping strip — lives at page level (not inside the reel)
           so it survives the reel unmounting once phase === 'done'.
           Below the reel images while picking; once every configured
           section is filled it centers itself over the page via the
           --complete modifier, sliding back on undo thanks to `layout`. ── */}
        {selectedCount > 0 && (
          <motion.div
            className={`combo-group-strip${isComboComplete ? " combo-group-strip--complete" : ""}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="combo-group-strip-pricing">
              {perComboFinalPrice < perComboBasePrice && (
                <div className="combo-group-strip-regular">
                  <span className="combo-group-strip-regular-label">Regular Price</span>
                  <span className="combo-group-strip-regular-price">₹{Math.round(perComboBasePrice)}/-</span>
                </div>
              )}
              <div className="combo-group-strip-final">
                <span className="combo-group-strip-final-label">
                  {perComboFinalPrice < perComboBasePrice ? "Combo @ Just" : "Combo Total"}
                </span>
                <span className="combo-group-strip-final-price">₹{Math.round(perComboFinalPrice)}/-</span>
              </div>
            </div>

            <div className="combo-group-strip-photos">
              {sectionKeys.map((key, idx) => (
                selectedItems[key] && (
                  <GroupNode
                    key={key}
                    item={selectedItems[key]}
                    type={key}
                    slotIndex={idx}
                    onClick={() => handleUndo(key)}
                  />
                )
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Add to fav confirm ── */}
        {/* ── Offer hint (suggestion) modal ── */}
        <ModalTransition open={!!offerHint} onClose={() => setOfferHint(null)} overlayClassName="combo-overlay" panelClassName="combo-modal">
                <h3 className="combo-modal-title">Unlock a Combo Offer</h3>
                <p className="combo-modal-text">{offerHint?.message}</p>
                <div className="combo-modal-actions">
                  <Button3D as={motion.button} className="btn-3d white" onClick={() => setOfferHint(null)} whileTap={{ scale: 0.96 }}>Skip for now</Button3D>
                  <Button3D as={motion.button} className="btn-3d green" onClick={handleHintAdd} whileTap={{ scale: 0.96 }}>Add Item</Button3D>
                </div>
        </ModalTransition>

        <ModalTransition open={showAddFavConfirm} onClose={() => setShowAddFavConfirm(false)} overlayClassName="combo-overlay" panelClassName="combo-modal">
                <h3 className="combo-modal-title">Save to Favourites?</h3>
                <p className="combo-modal-text">{comboTitle}</p>
                <div className="combo-modal-actions">
                  <Button3D as={motion.button} className="btn-3d white" onClick={() => setShowAddFavConfirm(false)} whileTap={{ scale: 0.96 }}>Cancel</Button3D>
                  <Button3D
                    as={motion.button}
                    className="btn-3d green"
                    disabled={!isComboComplete || isSavingFav}
                    onClick={handleConfirmAddFav}
                    whileTap={{ scale: 0.96 }}
                  >
                    {isSavingFav ? "Saving" : "Confirm"}
                  </Button3D>
                </div>
        </ModalTransition>

        {/* ── Duplicate overlay ── */}
        <ModalTransition open={showDuplicateOverlay} onClose={() => setShowDuplicateOverlay(false)} overlayClassName="combo-overlay" panelClassName="combo-modal">
                <h3 className="combo-modal-title">Already Saved</h3>
                <p className="combo-modal-text">This combo already exists in your favourites.</p>
                <div className="combo-modal-actions">
                  <Button3D as={motion.button} className="btn-3d white" style={{ width: "100%" }} onClick={() => setShowDuplicateOverlay(false)} whileTap={{ scale: 0.96 }}>Okay</Button3D>
                </div>
        </ModalTransition>

        {/* ── "My Combo" sheet — clone of My Order / Receipt ── */}
        <AnimatePresence>
          {showCart && (
            <motion.div
              className="combo-sheet-overlay"
              variants={overlayAnim}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => !justAdded && setShowCart(false)}
            >
              <motion.div
                className="combo-sheet-modal"
                variants={sheetAnim}
                initial="hidden"
                animate="show"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
                drag={!justAdded ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(e, info) => {
                  if (info.offset.y > 90) setShowCart(false);
                }}
              >
                <div className="combo-sheet-handle" />

                {justAdded ? (
                  <>
                    <div className="combo-sheet-header">
                      <h3>Receipt</h3>
                      <Button3D as={motion.button} className="home-btn home-btn-icon" onClick={handleCloseConfirmation} whileTap={{ scale: 0.85 }} aria-label="Close" frontClassName="close-padding"><img src={closeIcon} style={{ width: "20px", height: "20px" }} alt="Close" /></Button3D>
                    </div>
                    <AddedConfirmation
                      comboTitle={comboTitle}
                      discountedPrice={discountedPrice}
                      onDone={handleDoneReceipt}
                    />
                  </>
                ) : (
                  <>
                    <div className="combo-sheet-header">
                      <h3>My Combo</h3>
                      <Button3D as={motion.button} className="btn-3d red" onClick={() => setShowCart(false)} whileTap={{ scale: 0.85 }} aria-label="Close" frontClassName="close-padding"><img style={{ width: "20px", height: "20px", filter: "brightness(0) invert(1)" }} src={closeIcon} alt="Close" /></Button3D>
                    </div>

                    <div className="combo-sheet-body">
                      <MyComboContent
                        selectedItems={selectedItems}
                        slotLabels={slotLabels}
                        quantity={quantity}
                        setQuantity={setQuantity}
                        originalTotal={originalTotal}
                        discountedPrice={discountedPrice}
                        savings={savings}
                        matchedOffer={matchedOffer}
                        isComboComplete={isComboComplete}
                        onDelete={handleUndo}
                      />

                      {isComboComplete && currentUser && currentUser.id !== "guest" && (
                        <Button3D
                          as={motion.button}
                          className="btn-3d white combo-save-btn"
                          onClick={() => setShowAddFavConfirm(true)}
                          whileTap={{ scale: 0.96 }}
                        >
                          Save to Favourites
                        </Button3D>
                      )}
                    </div>

                    <Button3D
                      as={motion.button}
                      className="btn-3d red combo-checkout-bar"
                      style={{ width: "170px", alignSelf: "end" }}
                      disabled={!isComboComplete}
                      onClick={handleAddToBag}
                      whileTap={{ scale: 0.97 }}
                      frontStyle={{ display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      <span>{isEditMode ? "Update Combo" : "Add to Bag"}</span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={discountedPrice}
                          className="combo-checkout-amount"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                        >
                          ₹{discountedPrice}
                        </motion.span>
                      </AnimatePresence>
                    </Button3D>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ComboPage;