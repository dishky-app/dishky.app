import "./AppetizerBuilder.css";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button3D from "./shared/Button3D.js";
import { buildDishBagItem } from "./shared/bagUtils.js";
import { useScrollHeader } from "./shared/useScrollHeader.js";
import closeIcon from "../assets/icons/close.png";
import homeIcon from "../assets/icons/home.png";
import cartIcon from "../assets/icons/cart.png";
import { handleImgFallback } from "../App";

/* ─── Animations (mirrors ComboPage) ─────────────────────────── */
const pageVariant = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }
};

/* Phase-to-phase crossfade — same blur/scale language as the combo
   builder so the two flows feel like the same product. */
const phaseTransition = {
  hidden: { opacity: 0, y: 26, scale: 0.97, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    y: -18,
    scale: 0.97,
    filter: "blur(8px)",
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] }
  }
};

// Fixed 3-image diagonal cascade — same resting positions as
// ComboPage's reel, so both builders look and move identically.
//
// buildReelGeometry(xyScale) builds the FULL geometry pipeline (base
// slots → circle → angles → far-slots → arc paths) for a given x/y
// offset scale — mirrors ComboPage.js's identical helper so both
// builders stay visually consistent. Called once for desktop (scale 1)
// and once for phones (a smaller scale) below, so mobile gets genuinely
// smaller offsets instead of being clipped by .appetizer-page's
// overflow-x: hidden, with the resting position and its swipe-arc
// always derived from the SAME scaled circle (no snap/mismatch).
// activeScaleMult (mirrors ComboPage.js) scales the ACTIVE (centered)
// dish's own base 0.8 scale independently of neighborScaleMult.
const buildReelGeometry = (xyScale, neighborScaleMult = 1, activeScaleMult = 1) => {
  const REEL_SLOTS = [
    { x: -195 * xyScale, y: 390 * xyScale, scale: 0.4 * neighborScaleMult, rotate: 0, blur: 8, zIndex: 1 },   // previous (below-left)
    { x: 0, y: 0, scale: 0.8 * activeScaleMult, rotate: 0, blur: 0, zIndex: 3 },                              // active (front, centered)
    { x: 520 * xyScale, y: -130 * xyScale, scale: 0.5 * neighborScaleMult, rotate: 0, blur: 6, zIndex: 2 }    // next (above-right)
  ];

  const circumcircleOf = (A, B, C) => {
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    const ux = ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / d;
    const uy = ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / d;
    return { cx: ux, cy: uy, r: Math.hypot(A.x - ux, A.y - uy) };
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

  const REEL_ANGLE_FAR_PREV = REEL_ANGLE_PREV - (REEL_ANGLE_ACTIVE - REEL_ANGLE_PREV);
  const REEL_ANGLE_FAR_NEXT = REEL_ANGLE_NEXT + (REEL_ANGLE_NEXT - REEL_ANGLE_ACTIVE);
  const REEL_FAR_PREV_POS = posOnCircle(REEL_ANGLE_FAR_PREV);
  const REEL_FAR_NEXT_POS = posOnCircle(REEL_ANGLE_FAR_NEXT);

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

  const REEL_ARCS = {};
  for (let i = 0; i < REEL_ANGLES_5.length - 1; i++) {
    REEL_ARCS[`${i + 1}-${i}`] = arcPath(REEL_ANGLES_5[i + 1], REEL_ANGLES_5[i]);
    REEL_ARCS[`${i}-${i + 1}`] = arcPath(REEL_ANGLES_5[i], REEL_ANGLES_5[i + 1]);
  }

  return { REEL_SLOTS_5, REEL_ARCS };
};

// Same mobile scale + neighborScaleMult as ComboPage.js (math-verified
// against the wrapper's own visual scale so the peeking dishes land
// fully inside a 375px-wide phone viewport with a bigger visible gap
// around the active dish — see ComboPage.js's comment for the full
// derivation, including the 0.17→0.2→0.22 xyScale bumps and the
// 0.7→0.6 neighborScaleMult pulldown), for visual consistency between
// the two builders.
const DESKTOP_REEL_GEOMETRY = buildReelGeometry(1);
const MOBILE_REEL_GEOMETRY = buildReelGeometry(0.22, 0.6);

// Tablet variant — same values and derivation as ComboPage.js
// (AppetizerBuilder.css mirrors the same 578px/992px/768px breakpoints
// and reel-column percentages verbatim, so the same geometry is safe
// here too): fixes prev/next being positioned entirely outside the
// visible reel column at tablet widths, widens the gap between
// prev/current/next, and grows the active dish ~20% — see
// ComboPage.js's comment for the full margin math.
const TABLET_REEL_GEOMETRY = buildReelGeometry(0.21, 0.42, 1.2);

const REEL_SPRING = { type: "spring", stiffness: 70, damping: 26, mass: 1 };
/* Faster crossfade for the name/description block specifically —
   mirrors ComboPage's REEL_DETAILS_SPRING so both builders feel the same. */
const REEL_DETAILS_SPRING = { type: "spring", stiffness: 260, damping: 26, mass: 0.7 };
const REEL_ARC_TWEEN = { duration: 0.55, ease: [0.65, 0, 0.35, 1] };

/* Slot lookup for the reel — takes the geometry set selected by the
   component (desktop vs mobile) so the transform matches the current
   viewport. See buildReelGeometry above. */
const reelSlotTransform = (geometry, slot) => geometry.REEL_SLOTS_5[slot];

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

/* ─── Grouping geometry (compact progress strip) ──────────────
   Sauce docks straight up (90°) from the base, main ingredient
   docks at 45° from the sauce — same angle language as the combo
   builder's starter → main → drink strip, just with two slots.
──────────────────────────────────────────────────────────── */
const SLOT_LABELS = { sauce: "Sauce", main: "Main Ingredient" };

const GroupNode = ({ item, type, onClick }) => (
  <motion.button
    className={`appetizer-group-node appetizer-group-node--${type}`}
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
      layoutId={`appetizer-fly-${type}`}
      src={item.image}
      alt={item.name}
      draggable={false}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
      onError={handleImgFallback}
    />
  </motion.button>
);

/* ─── FoodList-style swipeable reel for the active phase — same
   circular-motion system as ComboPage's reel (see REEL_SLOTS_5 /
   REEL_ARCS above) so both builders move identically. ──────── */
const AppetizerReel = ({ items, type, onSelect }) => {
  const [renderIndex, setRenderIndex] = useState(0);
  const [direction, setDirection] = useState(null); // 'next' | 'prev' | null
  const startX = useRef(0);
  const startY = useRef(0);
  const isPointerDown = useRef(false);

  // Three-tier breakpoint matching AppetizerBuilder.css's own bands
  // (578px phone cutoff, 992px tablet cutoff), same fix and reasoning
  // as ComboPage.js — the tablet band previously fell through to
  // DESKTOP_REEL_GEOMETRY's full-size offsets inside a much narrower
  // reel column, pushing prev/next outside the visible area.
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
    return <div className="appetizer-reel-empty">Nothing here yet — check back soon.</div>;
  }

  // 5 slots total: [farPrev, prev, active, next, farNext]. Only the
  // middle 3 (prev/active/next) are ever visible — farPrev/farNext
  // stay in the DOM purely so their dish's image is already loaded
  // by the time it swipes into view, avoiding a pop-in flash.
  const n = items.length;
  const modIndices = [
    (renderIndex - 2 + n * 2) % n,
    (renderIndex - 1 + n) % n,
    renderIndex,
    (renderIndex + 1) % n,
    (renderIndex + 2) % n
  ];
  const visible = modIndices.map(idx => items[idx]);

  // With fewer than 5 items in the category, some of the 5 circle
  // roles land on the very same dish (e.g. with 4 items, farPrev and
  // farNext are literally the same dish). Rendering that dish twice
  // under the same key confuses Framer Motion into treating two
  // different roles as one moving element, which is what caused the
  // far-edge image to visibly slide across the whole display instead
  // of quietly fading in. So each unique dish only ever gets ONE
  // wrapper — the nearer/most-visible role wins the slot, and the
  // duplicate far-edge role (which exists purely to preload) is
  // simply skipped.
  const slotPriority = [2, 1, 3, 0, 4];
  const claimed = new Set();
  const renderSlot = [false, false, false, false, false];
  slotPriority.forEach(slot => {
    const idx = modIndices[slot];
    if (!claimed.has(idx)) {
      claimed.add(idx);
      renderSlot[slot] = true;
    }
  });

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
      className="appetizer-reel"
      onPointerDown={(e) => {
        if (e.target.closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        startX.current = e.clientX;
        startY.current = e.clientY;
        isPointerDown.current = true;
      }}
      onPointerUp={(e) => {
        if (!isPointerDown.current) return;
        isPointerDown.current = false;
        const dy = startY.current - e.clientY;
        const dx = Math.abs(startX.current - e.clientX);
        if (dx > Math.abs(dy)) return;
        if (dy > 40) goPrev();
        else if (dy < -40) goNext();
      }}
      onPointerCancel={() => { isPointerDown.current = false; }}
    >
      <div className="appetizer-reel-details">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
            transition={REEL_DETAILS_SPRING}
          >
            <h2 className="appetizer-reel-name">{active.name}</h2>
            {active.price != null || active.basePrice != null ? (
              <div className="appetizer-reel-price">₹{active.price ?? active.basePrice}</div>
            ) : null}
            {active.description && <p className="appetizer-reel-desc">{active.description}</p>}
          </motion.div>
        </AnimatePresence>

        <Button3D className="btn-3d red" style={{ marginTop: 22, width: "fit-content" }} onClick={() => onSelect(active)}>
          Select »
        </Button3D>
      </div>

      <div className="appetizer-reel-images">
        {visible.map((item, slot) => {
          // slot maps 1:1 onto the 5 circle roles: 0=far-prev,
          // 1=prev, 2=active, 3=next, 4=far-next. The two edges stay
          // fully off-display (opacity 0, non-interactive) but sit
          // in their real circular position, so when an item's role
          // shifts into view it sweeps in along the arc instead of
          // just fading in from nowhere.
          const t = reelSlotTransform(geometry, slot);
          const isActive = slot === 2;
          const isEdge = slot === 0 || slot === 4;

          if (!renderSlot[slot]) return null;

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
              key={item.id}
              className={`appetizer-reel-image-wrapper${isEdge ? " appetizer-reel-image-wrapper--hidden" : ""}`}
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
                className="appetizer-reel-image"
                layoutId={isActive ? `appetizer-fly-${type}` : undefined}
                animate={{ filter: `blur(${t.blur}px)` }}
                transition={REEL_SPRING}
                draggable={false}
                onError={handleImgFallback}
              />
            </motion.div>
          );
        })}
      </div>

      <div className="appetizer-reel-nav">
        <Button3D className="btn-3d white" onClick={goPrev} aria-label="Previous item">▲</Button3D>
        <Button3D className="btn-3d white" onClick={goNext} aria-label="Next item">▼</Button3D>
      </div>
    </div>
  );
};

const ROW_ICONS = { sauce: "🌶️", main: "🍢" };

/* ─── Sheet list content (mirrors ComboPage's "My Combo" list) ─ */
const AppetizerContent = ({ selectedSauce, selectedMain, qty, setQty, finalDish, isComplete, onDelete }) => (
  <div className="appetizer-cart-content">
    <motion.div className="appetizer-cart-list" variants={listStagger} initial="hidden" animate="show">
      <AnimatePresence initial={false}>
        {["sauce", "main"].map(key => {
          const item = key === "sauce" ? selectedSauce : selectedMain;
          const label = SLOT_LABELS[key];
          return (
            <motion.div
              key={key}
              layout
              variants={listRow}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -14, transition: { duration: 0.18 } }}
              className={`appetizer-cart-row ${item ? "filled" : "empty"}`}
            >
              <div className="appetizer-cart-row-icon" aria-hidden="true">
                {item ? <img src={item.image} alt="" draggable={false} onError={handleImgFallback} /> : ROW_ICONS[key]}
              </div>
              <div className="appetizer-cart-row-text">
                <span className="appetizer-cart-row-label">{label}</span>
                <span className="appetizer-cart-row-name">{item ? item.name : "Not selected yet"}</span>
              </div>
              {item ? (
                <div className="appetizer-cart-row-right">
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
                <span className="appetizer-cart-row-empty">—</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>

    {isComplete && finalDish && (
      <div className="appetizer-cart-summary">
        <div className="appetizer-cart-qty">
          <span>Quantity</span>
          <div className="stepper-ctrl">
            <button
              as={motion.button}
              className="stepper-btn"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={qty === 1}
              aria-label="Decrease quantity"
              whileTap={{ scale: 0.85 }}
            >
              −
            </button>
            <span className="stepper-val">{qty}</span>
            <button
              as={motion.button}
              className="stepper-btn"
              onClick={() => setQty(q => q + 1)}
              aria-label="Increase quantity"
              whileTap={{ scale: 0.85 }}
            >
              +
            </button>
          </div>
        </div>

        <div className="appetizer-cart-divider" />

        <div className="appetizer-cart-totals">
          <div className="appetizer-cart-total-row final">
            <span>Total</span>
            <span>₹{finalDish.basePrice * qty}</span>
          </div>
        </div>
      </div>
    )}
  </div>
);

/* ─── Receipt-style confirmation (mirrors ComboPage's) ───────── */
const AddedConfirmation = ({ dishTitle, price, onDone }) => (
  <motion.div
    className="appetizer-receipt"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
  >
    <motion.div
      className="appetizer-receipt-check"
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
      className="appetizer-receipt-sub"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.26, duration: 0.25 }}
    >
      Your appetizer is waiting in your bag
    </motion.p>

    <div className="appetizer-cart-divider" />

    <div className="appetizer-receipt-row">
      <span>{dishTitle}</span>
      <span>₹{price}</span>
    </div>

    <Button3D
      as={motion.button}
      className="btn-3d green appetizer-receipt-done"
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
const AppetizerBuilder = ({ foodData, addToBag, handleBack, handleHome }) => {
  const { headerRef, scrolled } = useScrollHeader();
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [selectedMain, setSelectedMain] = useState(null);
  const [qty, setQty] = useState(1);
  const [showSheet, setShowSheet] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const appetizerCategory = useMemo(
    () => foodData.categories.find(c => c.id === "appetizer"),
    [foodData]
  );

  const sauces = useMemo(() => appetizerCategory?.appetizerSauces || [], [appetizerCategory]);
  const mains = useMemo(() => appetizerCategory?.appetizerMain || [], [appetizerCategory]);

  const finalDish = useMemo(() => (
    selectedSauce && selectedMain
      ? appetizerCategory?.dishes?.find(d => d.id === `${selectedSauce.id}_${selectedMain.id}`)
      : null
  ), [selectedSauce, selectedMain, appetizerCategory]);

  const phase = !selectedSauce ? "sauce" : !selectedMain ? "main" : "done";
  const phaseTypeKey = phase === "sauce" ? "sauce" : phase === "main" ? "main" : null;
  const activeItems = phase === "sauce" ? sauces : phase === "main" ? mains : [];

  const handlePick = useCallback((type, item) => {
    if (type === "sauce") setSelectedSauce(item);
    else setSelectedMain(item);
  }, []);

  const handleUndo = useCallback((type) => {
    if (type === "sauce") { setSelectedSauce(null); setSelectedMain(null); }
    else setSelectedMain(null);
    setQty(1);
  }, []);

  const resetSelection = () => {
    setSelectedSauce(null);
    setSelectedMain(null);
    setQty(1);
  };

  const addDishToBag = () => {
    if (!finalDish) return;

    addToBag(
      buildDishBagItem(finalDish, "appetizer", {
        quantity: qty,
        totalPrice: finalDish.basePrice * qty,
        ingredients: finalDish.ingredients
      })
    );

    setJustAdded(true);
  };

  const handleCloseConfirmation = useCallback(() => {
    setJustAdded(false);
    setShowSheet(false);
    setQty(1);
  }, []);

  const handleDoneReceipt = useCallback(() => {
    handleCloseConfirmation();
    handleHome?.();
  }, [handleCloseConfirmation, handleHome]);

  const selectedCount = [selectedSauce, selectedMain].filter(Boolean).length;

  /* ── Open the "My Appetizer" sheet automatically once the last
     item (main ingredient) completes the pick, instead of waiting
     for a bag-icon tap. Only fires on the false → true transition,
     so manually closing the sheet afterwards won't reopen it. ── */
  useEffect(() => {
    if (phase === "done") setShowSheet(true);
  }, [phase]);


  return (
    <motion.div className="no-padding" variants={pageVariant} initial="hidden" animate="show">

      {/* ── Top bar (back chevron + phase label + home) ── */}
      <div ref={headerRef} className={`pl-header${scrolled ? " header-scrolled" : ""}`}>
        <motion.button className="back-button" onClick={handleBack} aria-label="Back" whileTap={{ scale: 0.85, x: -2 }} />

        <div className="appetizer-phase-label">
          {phase === "sauce" && "Swipe up or down to browse, pick a sauce"}
          {phase === "main" && "Now swipe up or down and pick a main ingredient"}
          {phase === "done" && "Your appetizer is ready"}
        </div>

        <div className="appetizer-topbar-actions">
          <Button3D
            as={motion.button}
            className="btn-3d white sq-padding appetizer-icon-btn"
            onClick={() => setShowSheet(true)}
            aria-label="View your appetizer"
            whileTap={{ scale: 0.88 }}
            disabled={selectedCount === 0}
          >
            <img src={cartIcon} alt="View your appetizer" />
            <AnimatePresence>
              {selectedCount > 0 && (
                <motion.span
                  key={selectedCount}
                  className="appetizer-badge"
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

          <Button3D
            as={motion.button}
            className="home-btn home-btn-icon"
            onClick={handleHome}
            aria-label="Home"
            whileTap={{ scale: 0.88 }}
          >
            <img src={homeIcon} alt="Home" />
          </Button3D>
        </div>
      </div>

      <div className="pl-body">
        {/* ── Swipeable reel — crossfades between phases, hidden once the
           appetizer is complete since the sheet modal takes over from there ── */}
        <AnimatePresence initial={false} mode="popLayout">
          {phase !== "done" && (
            <motion.div
              key={phase}
              variants={phaseTransition}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ position: "relative" }}
            >
              <AppetizerReel items={activeItems} type={phaseTypeKey} onSelect={(item) => handlePick(phaseTypeKey, item)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Grouping strip — lives at page level (not inside the reel)
           so it survives the reel unmounting once phase === 'done'.
           Left-aligned below the reel while picking; once both sauce
           and main are chosen it centers itself over the page via the
           --complete modifier, sliding back on undo thanks to `layout`.
           Mirrors ComboPage's combo-group-strip exactly. ── */}
        {selectedCount > 0 && (
          <motion.div
            className={`appetizer-group-strip${selectedCount === 2 ? " appetizer-group-strip--complete" : ""}`}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="appetizer-group-strip-pricing">
              <div className="appetizer-group-strip-final">
                <span className="appetizer-group-strip-final-label">
                  {finalDish ? "Total" : "Selecting…"}
                </span>
                <span className="appetizer-group-strip-final-price">
                  ₹{finalDish ? finalDish.basePrice : 0}
                </span>
              </div>
            </div>

            <div className="appetizer-group-strip-photos">
              {selectedSauce && <GroupNode item={selectedSauce} type="sauce" onClick={() => handleUndo("sauce")} />}
              {selectedMain && <GroupNode item={selectedMain} type="main" onClick={() => handleUndo("main")} />}
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {showSheet && (
            <motion.div
              className="appetizer-sheet-overlay"
              variants={overlayAnim}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={() => !justAdded && setShowSheet(false)}
            >
              <motion.div
                className="appetizer-sheet-modal"
                variants={sheetAnim}
                initial="hidden"
                animate="show"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
                drag={!justAdded ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(e, info) => {
                  if (info.offset.y > 90) setShowSheet(false);
                }}
              >
                <div className="appetizer-sheet-handle" />

                {justAdded ? (
                  <>
                    <div className="appetizer-sheet-header">
                      <h3>Receipt</h3>
                      <Button3D as={motion.button} frontClassName="close-padding" className="home-btn home-btn-icon" onClick={handleCloseConfirmation} whileTap={{ scale: 0.85 }} aria-label="Close">
                        <img src={closeIcon} style={{ width: "20px", height: "20px" }} alt="Close" />
                      </Button3D>
                    </div>
                    <AddedConfirmation
                      dishTitle={finalDish ? finalDish.name : `${SLOT_LABELS.sauce} + ${SLOT_LABELS.main}`}
                      price={finalDish ? finalDish.basePrice * qty : 0}
                      onDone={handleDoneReceipt}
                    />
                  </>
                ) : (
                  <>
                    <div className="appetizer-sheet-header">
                      <h3>My Appetizer</h3>
                      <Button3D as={motion.button} className="btn-3d red" frontClassName="close-padding" onClick={() => setShowSheet(false)} whileTap={{ scale: 0.85 }} aria-label="Close">
                        <img style={{ width: "20px", height: "20px", filter: "brightness(0) invert(1)" }} src={closeIcon} alt="Close" />
                      </Button3D>
                    </div>

                    <div className="appetizer-sheet-body">
                      <AppetizerContent
                        selectedSauce={selectedSauce}
                        selectedMain={selectedMain}
                        qty={qty}
                        setQty={setQty}
                        finalDish={finalDish}
                        isComplete={phase === "done"}
                        onDelete={handleUndo}
                      />

                      {phase === "done" && !finalDish && (
                        <div className="final-placeholder">
                          <div className="placeholder-icon">🍽️</div>
                          <div className="placeholder-text">
                            This sauce and main ingredient combination isn't available yet.
                          </div>
                          <Button3D
                            as={motion.button}
                            className="btn-3d white"
                            onClick={() => { resetSelection(); setShowSheet(false); }}
                            whileTap={{ scale: 0.96 }}
                          >
                            Start Over
                          </Button3D>
                        </div>
                      )}
                    </div>

                    <Button3D
                      as={motion.button}
                      className="btn-3d red appetizer-checkout-bar"
                      disabled={!finalDish}
                      onClick={addDishToBag}
                      whileTap={{ scale: 0.97 }}
                      style={{ width: "170px", alignSelf: "end" }}
                      frontStyle={{ display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      <span>Add to Bag</span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={finalDish ? finalDish.basePrice * qty : 0}
                          className="appetizer-checkout-amount"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                        >
                          ₹{finalDish ? finalDish.basePrice * qty : 0}
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

export default AppetizerBuilder;