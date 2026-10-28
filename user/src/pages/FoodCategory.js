import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./shared/buttons.css";
import "./FoodCategory.css";
import listIcon from "../assets/icons/list.png";
import gridIcon from "../assets/icons/grid.png";
import eventFallbackImg from "../assets/events-fallback.png";
import Button3D from "./shared/Button3D";
import QuickLinksFab from "./QuickLinksFab";
import { fmtDate as fmtDateNumeric } from "../utils/dateUtils";
import { handleImgFallback } from "../App";

/* ═══════════════════════════════════════════════
   DATA HELPERS
═══════════════════════════════════════════════ */

/** Flatten every dish from categories + subCategories into a Map keyed by id */
function buildDishMap(categories = []) {
  const map = new Map();
  for (const cat of categories) {
    for (const d of cat.dishes || []) {
      map.set(d.id, { ...d, _catId: cat.id });
    }
    for (const sub of cat.subCategories || []) {
      for (const d of sub.dishes || []) {
        map.set(d.id, { ...d, _catId: cat.id, _subId: sub.id });
      }
    }
  }
  return map;
}

/** Count how many times each dishId appears across all orders */
function buildOrderCount(orders = []) {
  const count = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      const id = item.id || item.dishId;
      if (id) count.set(id, (count.get(id) || 0) + (item.quantity || 1));
    }
  }
  return count;
}

/** Format "YYYY-MM-DD" → "Mon, 31-07-2026" */
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return `${weekday}, ${fmtDateNumeric(dateStr)}`;
}

/* ─────────────────────────────────────────────
   Derive PROMO chips from live db data (max 8)
───────────────────────────────────────────── */
function derivePromoItems({ categories, orders, offers, comboOffers, events }) {
  const dishMap = buildDishMap(categories);
  const orderCount = buildOrderCount(orders);
  const chips = [];

  /* 1. Active offer dishes */
  for (const offer of offers || []) {
    if (offer.active !== "yes") continue;
    const dish = dishMap.get(offer.dishId);
    if (!dish?.name || !dish?.basePrice) continue;
    chips.push({
      id: `offer-${offer.id}`,
      type: "offer",                              // ← type "offer" → navigates to /offers
      badge: `${offer.percentage}% OFF`,
      badgeColor: "hot",
      discount: `Save ₹${Math.round(offer.offerAmount ?? (offer.originalPrice - offer.offerPrice))}`,
      title: dish.name,
      price: `₹${Math.round(offer.offerPrice)}`,
      oldPrice: `₹${offer.originalPrice}`,
      image: dish.image,
      cta: "Order now",
      categoryId: dish._catId,
      dishId: dish.id,
    });
  }

  /* 2. Top-ordered dish (trending) */
  const sorted = [...orderCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, count] of sorted) {
    const dish = dishMap.get(id);
    if (!dish?.name || !dish?.basePrice || !dish?.image) continue;
    chips.push({
      id: `trending-${id}`,
      type: "popular",
      badge: `${count} orders`,
      badgeColor: "pop",
      discount: "Most ordered",
      title: dish.name,
      price: `₹${dish.basePrice}`,
      oldPrice: null,
      image: dish.image,
      cta: "Order now",
      categoryId: dish._catId,
      dishId: dish.id,
      orderCount: count,
    });
    break;
  }

  /* 3. Published events — only ongoing/active right now, or
     genuinely upcoming (status says so AND the date hasn't passed).
     Anything completed, cancelled, draft, or a stale "upcoming"
     with a past date is excluded from the promo rail. */
  const today = new Date().toISOString().slice(0, 10);
  const ONGOING_STATUSES = ["ongoing", "active"];
  for (const ev of events || []) {
    if (!ev.isPublished) continue;
    const isOngoing = ONGOING_STATUSES.includes(ev.status);
    const isUpcoming = ev.status === "upcoming" && ev.date >= today;
    if (!isOngoing && !isUpcoming) continue;
    chips.push({
      id: `event-${ev.id}`,
      type: "event",
      image: ev.image || null,
      badge: fmtDate(ev.date),
      badgeColor: "event",
      discount: ev.highlights?.[0] || null,
      title: ev.title,
      price: ev.price ? `₹${ev.price}` : null,
      oldPrice: null,
      cta: "Book now",
      eventId: ev.id,
    });
  }

  /* 5. New-arrival filler (last dishes by db position) */
  if (chips.length < 8) {
    const usedIds = new Set(chips.filter((c) => c.dishId).map((c) => c.dishId));
    const allDishes = [];
    for (const cat of categories || []) {
      for (const d of cat.dishes || []) {
        if (d.name && d.basePrice && d.image && !usedIds.has(d.id))
          allDishes.push({ ...d, _catId: cat.id });
      }
      for (const sub of cat.subCategories || []) {
        for (const d of sub.dishes || []) {
          if (d.name && d.basePrice && d.image && !usedIds.has(d.id))
            allDishes.push({ ...d, _catId: cat.id });
        }
      }
    }
    for (const dish of allDishes.slice(-(8 - chips.length))) {
      chips.push({
        id: `new-${dish.id}`,
        type: "new",
        badge: "New Arrival",
        badgeColor: "pop",
        discount: "Just added",
        title: dish.name,
        price: `₹${dish.basePrice}`,
        oldPrice: null,
        image: dish.image,
        cta: "Try it",
        categoryId: dish._catId,
        dishId: dish.id,
      });
    }
  }

  return chips.slice(0, 8);
}

/* ─────────────────────────────────────────────
   Derive POPULAR DISHES (top 12 by order count)
───────────────────────────────────────────── */
function derivePopularDishes({ categories, orders }, limit = 12) {
  const dishMap = buildDishMap(categories);
  const orderCount = buildOrderCount(orders);
  const result = [];

  for (const [id, count] of [...orderCount.entries()].sort((a, b) => b[1] - a[1])) {
    const d = dishMap.get(id);
    if (!d?.name || !d?.basePrice || !d?.image) continue;
    result.push({
      id,
      name: d.name,
      image: d.image,
      price: d.basePrice,
      categoryId: d._catId,
      subCategoryId: d._subId || null,
      orderCount: count,
    });
    if (result.length >= limit) break;
  }
  return result;
}

/* ─────────────────────────────────────────────
   Derive EVENTS (published + upcoming)
───────────────────────────────────────────── */
function deriveEvents({ events }) {
  const today = new Date().toISOString().slice(0, 10);
  return (events || []).filter(
    (ev) => ev.isPublished && (ev.status === "upcoming" || ev.date >= today)
  );
}

/* ─────────────────────────────────────────────
   Derive FAVOURITE COMBOS (top 6 by order count)
───────────────────────────────────────────── */
function deriveFavouriteCombos({ orders }, limit = 6) {
  const comboCount = new Map();
  for (const order of orders || []) {
    for (const item of order.items || []) {
      if (!item.isCombo) continue;
      const key = item.id || item.name;
      if (!key) continue;
      comboCount.set(key, {
        count: (comboCount.get(key)?.count || 0) + (item.quantity || 1),
        item,
      });
    }
  }
  return [...comboCount.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ count, item }) => ({
      id: item.id || item.name,
      name: item.name,
      image:
        item.comboItems?.main?.image ||
        item.comboItems?.starter?.image ||
        item.comboItems?.drink?.image ||
        null,
      price: item.unitPrice || item.perComboFinalPrice || 0,
      orderCount: count,
      comboItems: item.comboItems || {},
    }));
}

/* ─────────────────────────────────────────────
   Derive CROWD PICKS — top dishes from ALL orders (different frame from popular)
   Shows the top 10 dishes by unique order frequency
───────────────────────────────────────────── */
function deriveCrowdPicks({ categories, orders }, limit = 10) {
  const dishMap = buildDishMap(categories);

  // Count unique orders (not quantities) per dish → real "crowd" signal
  const uniqueOrderCount = new Map();
  for (const order of orders || []) {
    const seenInThisOrder = new Set();
    for (const item of order.items || []) {
      const id = item.id || item.dishId;
      if (!id || seenInThisOrder.has(id)) continue;
      seenInThisOrder.add(id);
      uniqueOrderCount.set(id, (uniqueOrderCount.get(id) || 0) + 1);
    }
  }

  const result = [];
  for (const [id, count] of [...uniqueOrderCount.entries()].sort((a, b) => b[1] - a[1])) {
    const d = dishMap.get(id);
    if (!d?.name || !d?.basePrice || !d?.image) continue;
    result.push({
      id,
      name: d.name,
      image: d.image,
      price: d.basePrice,
      categoryId: d._catId,
      subCategoryId: d._subId || null,
      orderCount: count,
    });
    if (result.length >= limit) break;
  }
  return result;
}

/* ═══════════════════════════════════════════════
   PROMO CARD
═══════════════════════════════════════════════ */
const PromoCard = ({ item, onClick }) => {
  // Events can be published without an image; fall back to a generic
  // calendar/booking illustration instead of a broken/blank media box.
  const mediaSrc = item.image || (item.type === "event" ? eventFallbackImg : null);

  return (
    <button
      className={`pc-card pc-card--${item.type}`}
      onClick={() => onClick(item)}
      aria-label={item.title}
    >
      {/* Image / icon block */}
      <div className="pc-card__media">
        {mediaSrc && <img src={mediaSrc} alt={item.title} loading="lazy" onError={handleImgFallback} />}
      </div>

      {/* Info */}
      <div className="pc-card__body">
        {/* Top row: type pill + badge */}
        <div className="pc-card__top">
          {item.badge && <span className="pc-card__badge">{item.badge}</span>}
        </div>

        {/* Title */}
        <p className="pc-card__title">{item.title}</p>

        {/* Bottom row: price + CTA */}
        <div className="pc-card__bottom">
          <div className="pc-card__price-group">
            {item.price && <span className="pc-card__price">{item.price}</span>}
            {item.oldPrice && <span className="pc-card__old-price">{item.oldPrice}</span>}
            {item.discount && !item.price && <span className="pc-card__discount">{item.discount}</span>}
          </div>
          <span className="pc-card__cta">{item.cta} →</span>
        </div>
      </div>
    </button>
  );
};

/* ─────────────────────────────────────────────
   Hook: returns window inner-width, debounced
───────────────────────────────────────────── */
function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    let raf;
    const handler = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setWidth(window.innerWidth)); };
    window.addEventListener("resize", handler);
    return () => { window.removeEventListener("resize", handler); cancelAnimationFrame(raf); };
  }, []);
  return width;
}

/* ─────────────────────────────────────────────
   Derive pageSize from viewport width:
     ≥ 1200px → 4 cards per page
     992–1199px → 3 cards per page
     768–991px  → 2 cards per page
     < 768px    → 1 card per page
───────────────────────────────────────────── */
function getPageSize(width) {
  if (width >= 1200) return 4;
  if (width >= 992) return 3;
  if (width >= 768) return 2;
  return 1;
}

/* ═══════════════════════════════════════════════
   PROMO CAROUSEL — responsive infinite page loop
   Pages are grouped by pageSize (4 / 3 / 2 / 1).
   Track layout: [clone-of-last-page, ...pages, clone-of-first-page]
   idx 1 = first real page. On transitionEnd, landing
   on a clone silently snaps to its real twin.

   Key fixes vs. previous version:
   • PAGE_COUNT stored in a ref so handleTransitionEnd
     always reads the live value (no stale closure).
   • idx is reset to 1 whenever items or pageSize
     changes so it never drifts out of bounds.
   • extended array is memoised — stable identity
     between renders that only change idx/animated.
═══════════════════════════════════════════════ */
const PromoCarousel = ({ items, onCardClick }) => {
  const width = useWindowWidth();
  const pageSize = getPageSize(width);

  // ── Build pages (memoised) ──────────────────────────────────────────────
  const pages = React.useMemo(() => {
    const result = [];
    if (!items.length) return result;
    for (let i = 0; i < items.length; i += pageSize) {
      const slice = items.slice(i, i + pageSize);
      if (slice.length < pageSize) {
        const needed = pageSize - slice.length;
        const fillers = items.slice(0, needed).map((item) => ({
          ...item,
          id: `${item.id}__fill`,
        }));
        result.push([...slice, ...fillers]);
      } else {
        result.push(slice);
      }
    }
    return result;
  }, [items, pageSize]);

  const PAGE_COUNT = pages.length;

  // ── Extended track (memoised) ───────────────────────────────────────────
  // [clone-of-last, ...real-pages, clone-of-first]
  const extended = React.useMemo(
    () => (PAGE_COUNT > 0 ? [pages[PAGE_COUNT - 1], ...pages, pages[0]] : []),
    [pages, PAGE_COUNT]
  );

  // Keep a ref so handleTransitionEnd never closes over a stale value
  const pageCountRef = useRef(PAGE_COUNT);
  useEffect(() => { pageCountRef.current = PAGE_COUNT; }, [PAGE_COUNT]);

  // ── Carousel state ──────────────────────────────────────────────────────
  const [idx, setIdx] = useState(1);
  const [animated, setAnimated] = useState(true);
  const startXRef = useRef(null);
  const autoRef = useRef(null);

  // Reset to page 1 (no animation) whenever items or pageSize changes
  const prevKey = useRef(`${items.length}-${pageSize}`);
  useEffect(() => {
    const key = `${items.length}-${pageSize}`;
    if (prevKey.current !== key) {
      prevKey.current = key;
      setAnimated(false);
      setIdx(1);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    }
  }, [items, pageSize]);

  // ── Navigation ──────────────────────────────────────────────────────────
  // snappingRef: true while we're doing the silent clone→real snap.
  // During that window, step() is ignored so rapid clicks can't race idx
  // past the clone boundary before transitionEnd fires.
  const snappingRef = useRef(false);

  const step = useCallback((dir) => {
    if (snappingRef.current) return;          // snap in-flight — ignore
    const total = pageCountRef.current;
    setAnimated(true);
    setIdx((prev) => {
      const next = prev + dir;
      // Hard-clamp: never go beyond the two clone slots (0 and total+1).
      // This makes rapid clicking safe even if transitionEnd is delayed.
      if (next < 0) return 0;
      if (next > total + 1) return total + 1;
      return next;
    });
  }, []);

  const goToPage = useCallback((pageIdx) => {
    setAnimated(true);
    setIdx(pageIdx + 1);
  }, []);

  // ── Auto-play ───────────────────────────────────────────────────────────
  const resetAuto = useCallback(() => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => step(1), 4500);
  }, [step]);

  useEffect(() => {
    if (PAGE_COUNT < 2) return;
    resetAuto();
    return () => clearInterval(autoRef.current);
  }, [resetAuto, PAGE_COUNT]);

  // ── Seamless infinite snap ──────────────────────────────────────────────
  // Reads live values via refs — never stale, never needs to re-create.
  const idxRef = useRef(idx);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  const handleTransitionEnd = useCallback(() => {
    const current = idxRef.current;
    const total = pageCountRef.current;
    if (current === 0 || current === total + 1) {
      snappingRef.current = true;
      setAnimated(false);
      setIdx(current === 0 ? total : 1);
      // Re-enable animation after the silent snap completes (two rAF = ~2 frames)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setAnimated(true);
        snappingRef.current = false;
      }));
    }
  }, []); // stable — reads live values via refs, never needs to re-create

  // ── Swipe support ───────────────────────────────────────────────────────
  const onTouchStart = (e) => { startXRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (startXRef.current === null) return;
    const dx = startXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) { step(dx > 0 ? 1 : -1); resetAuto(); }
    startXRef.current = null;
  };

  // ── Dot index (which real page is active) ──────────────────────────────
  const dotIdx = PAGE_COUNT > 0
    ? ((idx - 1) % PAGE_COUNT + PAGE_COUNT) % PAGE_COUNT
    : 0;

  if (!items.length) return null;

  return (
    <div className="pc-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button
        className="pc-arrow pc-arrow-left"
        onClick={() => { step(-1); resetAuto(); }}
        aria-label="Previous"
      />

      <div className="pc-viewport">
        <div
          className="pc-track"
          style={{
            width: `${extended.length * 100}%`,
            transform: `translateX(-${(idx / extended.length) * 100}%)`,
            transition: animated ? "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extended.map((group, gi) => (
            <div
              key={gi}
              className={`pc-page pc-page--${pageSize}`}
              style={{ width: `${100 / extended.length}%`, flex: `0 0 ${100 / extended.length}%` }}
            >
              {group.map((item) => (
                <PromoCard key={item.id} item={item} onClick={onCardClick} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <button
        className="pc-arrow pc-arrow-right"
        onClick={() => { step(1); resetAuto(); }}
        aria-label="Next"
      />

      {PAGE_COUNT > 1 && (
        <div className="pc-dots">
          {pages.map((_, i) => (
            <button
              key={i}
              className={`pc-dot ${i === dotIdx ? "active" : ""}`}
              onClick={() => { goToPage(i); resetAuto(); }}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   FOOD CATEGORY — main component
═══════════════════════════════════════════════ */
const FoodCategory = ({ foodData, currentUser, categoryCards }) => {
  const [viewMode, setViewMode] = useState("grid");
  const [promoItems, setPromoItems] = useState([]);
  const [popularDishes, setPopularDishes] = useState([]);
  const [crowdPicks, setCrowdPicks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [favouriteCombos, setFavouriteCombos] = useState([]);
  const navigate = useNavigate();

  // Super-Admin-configured overrides (name/image/enabled) for the special
  // cards below, keyed by card id. A card with no saved override — or no
  // config saved at all yet — falls back to its hardcoded default here,
  // so nothing changes until a Super Admin actually edits something via
  // the admin panel's Category Cards page.
  const cardOverride = (id) => (categoryCards || []).find((c) => c.id === id);
  const isCardEnabled = (id) => {
    const override = cardOverride(id);
    return override ? override.enabled !== false : true;
  };
  const cardName = (id, fallback) => cardOverride(id)?.name || fallback;
  const cardImage = (id, fallback) => cardOverride(id)?.image || fallback;

  /* ── Derive all sections from foodData ── */
  useEffect(() => {
    if (!foodData) return;
    const { categories = [], orders = [], offers = [], comboOffers = [], combo = [], events = [] } = foodData;
    const resolvedComboOffers = comboOffers.length ? comboOffers : combo;

    setPromoItems(
      derivePromoItems({
        categories,
        orders,
        offers: isCardEnabled("offers") ? offers : [],
        comboOffers: isCardEnabled("combo") ? resolvedComboOffers : [],
        events: isCardEnabled("events") ? events : [],
      })
    );
    setPopularDishes(derivePopularDishes({ categories, orders }));
    setCrowdPicks(deriveCrowdPicks({ categories, orders }));
    setUpcomingEvents(isCardEnabled("events") ? deriveEvents({ events }) : []);
    setFavouriteCombos(isCardEnabled("combo") ? deriveFavouriteCombos({ orders }) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodData, categoryCards]);

  /* ── Navigation handlers ── */

  // Promo carousel cards
  const handlePromoClick = (item) => {
    if (item.type === "offer") {
      // Offer → Offers page
      if (isCardEnabled("offers")) navigate("/offers");
    } else if (item.type === "dish" || item.type === "popular" || item.type === "new") {
      // Dish / popular / new arrival → FoodListExpanded so the dish is the focus
      navigate(`/foods/${item.categoryId}/expanded`, {
        state: { dishId: item.dishId, fromPromo: true }
      });
    } else if (item.type === "combo") {
      // Combo offer → Combo builder, pre-seeded with that offer
      if (isCardEnabled("combo")) navigate("/combo", { state: { comboOffer: item.comboOffer } });
    } else if (item.type === "event") {
      if (isCardEnabled("events")) navigate("/events/hosted", { state: { eventId: item.eventId } });
    }
  };

  /* ── Build category list ──
     The special cards (Crowd Picks / Combo / Offers / Events) used to
     lead the grid here — they now live in the "…" quick-menu FAB
     instead, so the grid only shows actual food categories. */
  const categoriesToRender = [];

  (foodData?.categories || []).forEach((category) => {
    const hasSubCategories = Array.isArray(category.subCategories) && category.subCategories.length > 0;
    const route =
      category.id === "appetizer"
        ? "/appetizer-builder"
        : hasSubCategories
          ? `/subcategory/${category.id}`
          : `/foods/${category.id}/grid`;
    categoriesToRender.push({ id: category.id, name: category.name, image: category.image, route });
  });

  /* ── Preload category images ── */
  useEffect(() => {
    categoriesToRender.forEach((cat) => {
      if (cat.image) { const img = new Image(); img.src = cat.image; }
    });
  }, []);

  return (
    <div className="food-category">

      {/* ── Sticky top bar ── */}
      <div className="view-toggle">
        <PromoCarousel items={promoItems} onCardClick={handlePromoClick} />
        <div className="view-toggle-btns">
          <Button3D
            className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <img className="grid-icon" src={gridIcon} alt="" />
          </Button3D>
          <Button3D
            className={`view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <img className="list-icon" src={listIcon} alt="" />
          </Button3D>
        </div>
      </div>

      {/* ── Category grid / list ── */}
      <div className={`food-category-container ${viewMode}`}>
        {categoriesToRender.map((category) => (
          <Link
            key={category.id}
            to={category.route}
            className={`food-category-items ${viewMode}
              ${category.id === "my" ? "special" : ""}
              ${category.id === "others" ? "special" : ""}
              ${category.id === "combo" ? "special" : ""}
              ${category.id === "events" ? "special" : ""}
              ${category.id === "offers" ? "special" : ""}
              ${category.id === "my-orders" ? "special" : ""}
              ${category.id === "best-sellers" ? "special" : ""}
            `}
          >
            <div className="food-category-image">
              <img src={category.image} alt={category.name} loading="lazy" decoding="async"  onError={handleImgFallback} />
            </div>
            <div className="food-category-name">{category.name}</div>
          </Link>
        ))}
      </div>

      {/* Quick Links "…" FAB — Crowd Picks / Combo / Offers shortcuts,
          this page only. Each link auto-hides if its Super-Admin card
          toggle is off, and the whole button hides if every link it
          would show is disabled. */}
      <QuickLinksFab
        isCrowdPicksEnabled={isCardEnabled("others")}
        isComboEnabled={isCardEnabled("combo")}
        isOffersEnabled={isCardEnabled("offers")}
        isEventsEnabled={isCardEnabled("events")}
      />
    </div>
  );
};

export default FoodCategory;