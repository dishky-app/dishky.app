import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./QuickLinksFab.css";
import { useIsBelowWidth } from "./shared/useIsBelowWidth";

/**
 * QuickLinksFab — "…" floating trigger shown on the Food Category page
 * only. Popping open reveals 4 shortcut items (Crowd Picks, Combo,
 * Offers, Events & Bookings) along a CURVED quarter-circle arc to the
 * upper-left of the trigger button — 90° (straight up) through 180°
 * (straight left) — while still keeping each item's height a fixed,
 * EQUAL step above the one before it (item 0 the lowest, the last the
 * highest). Each item pops outward from the trigger's own position,
 * same pop-in-place idea as the Uiverse tooltip reference (icon in
 * the middle, related items blossoming out around it).
 *
 * Each item is its own name, rendered directly as the clickable pill
 * (.quick-links-item-label) — no separate icon/circle element. That
 * label's RIGHT edge is what sits at its own (tx, ty) point on the
 * arc: the label itself is right-anchored (position: right: 0 in the
 * CSS), so translating it by (tx, ty) directly places its inner edge
 * there.
 *
 * Every pill shares the same fixed height (see .quick-links-item-label
 * in the CSS — height + flex centering, not an intrinsic
 * content-driven height), so pills are always identical in height
 * regardless of how long each one's name is.
 *
 * HOW THE CURVE AND THE EQUAL Y-STEPS COEXIST: the vertical step is
 * still the plain constant it was before (STEP_Y) — every item's ty
 * is exactly `-STEP_Y * index`, so the height DIFFERENCE between any
 * two consecutive items is exactly STEP_Y, unchanged from before.
 * What's new is tx: instead of being placed by cumulative pill width
 * (a straight staircase), tx is now DERIVED from that same fixed ty
 * using the circle equation tx² + ty² = R², solved for tx:
 *   tx = -sqrt(R² - ty²)
 * with R set to exactly (STEP_Y * 2) — the topmost item's |ty| — so
 * item 0 (ty: 0) lands precisely at 180° and item 2 (ty: -R) lands
 * precisely at 90°, with item 1 landing wherever the circle
 * naturally puts it at its own fixed ty in between. Because the y
 * positions were fixed first and the x positions were solved to fit
 * a circle through those exact points, this produces a true curved
 * arc rather than the straight diagonal line a plain width-based
 * offset would draw between the same three y-heights. Checked against
 * the actual pill sizing in the CSS to confirm none of the 3 items
 * overlap on this curve at this radius.
 *
 * .quick-links-menu is a sibling of the trigger button, absolutely
 * positioned over the trigger's own bottom-right corner rather than
 * nested inside it — a separate layer floating above the page, the
 * same way .mobile-footer-nav is its own element rather than living
 * inside whatever button opens/closes it.
 *
 * Each item's position is expressed as CSS custom properties
 * (--qli-tx/--qli-ty, the resting offset from the trigger's corner)
 * computed once per render — so QuickLinksFab.css only needs to
 * animate a generic translate(var(--qli-tx), var(--qli-ty)) rather
 * than hardcoding four separate positions.
 *
 * Open triggers: hover (desktop/mouse) OR a click/tap.
 * Close triggers: clicking the trigger again while open, picking one
 * of the 3 buttons, the mouse leaving the whole cluster (hover-only
 * opens), or a tap outside it (click-opened, touch devices).
 *
 * A click and a hover are tracked separately (`clickOpen` / `hoverOpen`)
 * so a second *click* always closes the menu even if the cursor is
 * still hovering it — otherwise the hover state would just re-open it
 * the instant the click-close ran.
 */

// Fixed vertical step (in px) between each consecutive item — item i
// sits at ty = -STEP_Y * i, so the height DIFFERENCE between any two
// adjacent items is exactly STEP_Y for every pair, unchanged from the
// plain-staircase version of this file. Mobile uses a smaller step to
// match the smaller pill sizing used there (see the CSS).
const STEP_Y = 50;
const STEP_Y_MOBILE = 40;
const ITEM_COUNT = 4; // Crowd Picks, Combo, Offers, Events & Bookings

// Per-item stagger delay (ms) between each pill's pop-in / pop-out
// animation, so they visibly appear and disappear one at a time
// rather than all firing together with only a token offset. Chosen
// to be a meaningful fraction of the pill's own transform transition
// (0.38s, see the CSS) — big enough that item i is clearly still
// mid-animation (or not yet started) when item i+1 begins, rather
// than the two blurring into what reads as one simultaneous motion.
const STAGGER_MS = 90;

// How long the pill's own transform transition takes (matches the
// 0.38s set in the CSS) — used to compute the total time the closing
// sequence needs before the menu is safe to mark inert again (see
// menuInert in the component below).
const CLOSE_TRANSITION_MS = 380;

/**
 * (tx, ty) for each of `count` items, ty fixed at -STEP_Y * index and
 * tx solved from the circle equation tx² + ty² = R² so every point
 * lands on a true quarter-circle arc (90°-180°) through those exact
 * heights — see the file header comment for the full reasoning.
 *
 * Returns an array of { tx, ty } objects, one per item.
 */
const layoutCurvedPositions = (count, stepY) => {
  const radius = stepY * (count - 1); // topmost item's |ty| — the
  // radius that puts item 0 exactly at 180° and the last item exactly
  // at 90°, per the circle equation.
  const positions = [];
  for (let i = 0; i < count; i++) {
    const ty = -stepY * i;
    const tx = -Math.sqrt(Math.max(radius * radius - ty * ty, 0));
    positions.push({ tx, ty });
  }
  return positions;
};

const LINKS = [
  { key: "others", label: "Crowd Picks", route: "/favourites/others" },
  { key: "combo", label: "Combo", route: "/combo" },
  { key: "offers", label: "Offers", route: "/offers" },
  { key: "events", label: "Events & Bookings", route: "/events" },
];

const QuickLinksFab = ({
  isCrowdPicksEnabled = true,
  isComboEnabled = true,
  isOffersEnabled = true,
  isEventsEnabled = true,
}) => {
  const [clickOpen, setClickOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const isMobile = useIsBelowWidth(480);
  const stepY = isMobile ? STEP_Y_MOBILE : STEP_Y;
  const positions = layoutCurvedPositions(ITEM_COUNT, stepY);

  const open = clickOpen || hoverOpen;

  const enabledFlags = {
    others: isCrowdPicksEnabled,
    combo: isComboEnabled,
    offers: isOffersEnabled,
    events: isEventsEnabled,
  };

  const visibleLinks = LINKS.filter((l) => enabledFlags[l.key] !== false);

  // `inert` is what it needs to be for accessibility once open is
  // false, but it can't just track `open` directly: setting it inert
  // in the exact same React commit that also removes the .open class
  // — the class change that's supposed to kick off each pill's
  // pop-out transition — has each pill go inert (excluded from
  // accessibility/paint scheduling) at the very instant the CSS
  // transition would otherwise begin, which is what was making the
  // pop-out look instant/skipped rather than staggered. Instead,
  // `menuInert` only flips true after a timeout matching how long the
  // slowest pill's pop-out (transform + its stagger delay) actually
  // takes, so the transition has already finished playing by the time
  // the subtree goes inert. It flips back to non-inert immediately on
  // open, since there's no transition to protect on the way in.
  const [menuInert, setMenuInert] = useState(true);
  useEffect(() => {
    if (open) {
      setMenuInert(false);
      return;
    }
    const totalCloseMs = STAGGER_MS * Math.max(visibleLinks.length - 1, 0) + CLOSE_TRANSITION_MS;
    const timer = setTimeout(() => setMenuInert(true), totalCloseMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visibleLinks.length]);

  useEffect(() => {
    if (!clickOpen) return;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setClickOpen(false);
        setHoverOpen(false);
        if (document.activeElement instanceof HTMLElement && wrapRef.current.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [clickOpen]);

  if (visibleLinks.length === 0) return null;

  const goTo = (route) => {
    setClickOpen(false);
    setHoverOpen(false);
    // Blur whatever's focused before closing — belt-and-braces on top
    // of `inert` below, so a focused .quick-links-item-label can
    // never become an inert descendant even for a single frame.
    if (document.activeElement instanceof HTMLElement && wrapRef.current?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    navigate(route);
  };

  const handleTriggerClick = () => {
    setClickOpen((prev) => {
      const next = !prev;
      if (!next) {
        setHoverOpen(false); // a closing click also cancels any lingering hover-open
        if (document.activeElement instanceof HTMLElement && wrapRef.current?.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }
      return next;
    });
  };

  return (
    <div
      className={`quick-links-fab-wrap ${open ? "open" : ""}`}
      ref={wrapRef}
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
    >
      <button
        type="button"
        className="quick-links-fab-btn"
        onClick={handleTriggerClick}
        aria-label="Quick links"
        aria-expanded={open}
      >
        <span className="quick-links-fab-icon">⋯</span>
      </button>

      {/* Separate layer anchored over the trigger's own corner — not
          nested inside .quick-links-fab-btn — so it floats above the
          page independently of the button's own hover/active
          transforms, the same way .mobile-footer-nav sits apart from
          whatever navigation triggered it. */}
      <div className="quick-links-menu" inert={menuInert}>
        {visibleLinks.map((link, i) => {
          const { tx, ty } = positions[i] ?? positions[positions.length - 1];
          return (
            <button
              type="button"
              key={link.key}
              className="quick-links-item-label"
              style={{
                "--qli-tx": `${tx.toFixed(1)}px`,
                "--qli-ty": `${ty}px`,
                // Staggers each pill's pop-in (opening, index order —
                // item 0 first) and pop-out (closing, reverse order —
                // the last item that popped in is the first to pop
                // back out, so the sequence visually undoes itself
                // rather than restarting from the top every time).
                //
                // Passed as the --qli-delay CUSTOM PROPERTY, not the
                // transitionDelay style property directly — App.css
                // has a global `button { transition: ease-in 0.15s
                // !important; }` rule whose implicit transition-delay:
                // 0s otherwise always wins over a plain (non-
                // !important) inline transitionDelay, no matter how
                // specific the inline style is. Custom properties
                // aren't subject to that collision (they're just
                // variables), and QuickLinksFab.css reads this one
                // back inside its own transition-delay declaration,
                // which IS !important, so it can actually win. See
                // .quick-links-item-label in the CSS for the other
                // half of this.
                "--qli-delay": open
                  ? `${i * STAGGER_MS}ms`
                  : `${(visibleLinks.length - 1 - i) * STAGGER_MS}ms`,
              }}
              onClick={() => goTo(link.route)}
              aria-label={link.label}
            >
              {link.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickLinksFab;