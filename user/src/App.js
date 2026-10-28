import "./App.css";
import "./pages/Profile.css";
import { useEffect, useState, useRef } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import api from "./api";
import socket from "./socket";
import { resolved } from "./tenant";

// ─── Page Components ───────────────────────────────────────────────────────
import Welcome from "./pages/Welcome";
import FoodCategory from "./pages/FoodCategory";
import AppetizerBuilder from "./pages/AppetizerBuilder";
import SubCategoryPage from "./pages/SubCategoryPage";
import FoodGridList from "./pages/FoodGridList";
import BestSellers from "./pages/BestSellers";
import FoodList from "./pages/FoodList";
import FoodListExpanded from "./pages/FoodListExpanded";
import FoodItem from "./pages/FoodItem";
import IngredientDetail from "./pages/IngredientDetail";
import ThankYou from "./pages/ThankYou";
import FloatingBag from "./pages/FloatingBag";
import Profile from "./pages/Profile";
import MobileFooterNav from "./pages/MobileFooterNav";

// ─── Attender (waiter) layer ─────────────────────────────────────────────────
import useAttender from "./pages/attender/useAttender";
import AttenderAuth from "./pages/attender/AttenderAuth";
import AttenderTables from "./pages/attender/AttenderTables";
import AttenderSwitcher from "./pages/attender/AttenderSwitcher";
import { endCustomerSession } from "./pages/customerSession";

// ─── Favourites ─────────────────────────────────────────────────────────────
import FavouriteCategories from "./pages/FavouriteCategories";
import FavouriteDishList from "./pages/FavouriteDishList";
import FavouriteDishDetail from "./pages/FavouriteDishDetail";
import ComboPage from "./pages/ComboPage";
import FavouriteCombo from "./pages/FavouriteCombo";
import MyOrders from "./pages/MyOrders";
import OrderDetails from "./pages/OrderDetails";
import OffersGrid from "./pages/OffersGrid";

// ─── Events ─────────────────────────────────────────────────────────────────
import EventHome from "./pages/EventHome";
import EventsPage from "./pages/EventsPage";
import ReservationForm from "./pages/ReservationForm";
import CelebrationForm from "./pages/CelebrationForm";
import PreBooking from "./pages/PreBooking";
import CateringForm from "./pages/CateringForm";

// ─── Shared Components ───────────────────────────────────────────────────────
import PageLoader from "./components/PageLoader";
import { useToast } from "./components/Usetoast";

// ─── Assets ─────────────────────────────────────────────────────────────────
import bellGif from "./assets/bell/bell.gif";
import bellStatic from "./assets/bell/bell-static.png";
import { normalizeBagItem, findMatchingBagIndex } from "./pages/shared/normalizeBagItem";
import { getUnitPrice } from "./pages/shared/bagUtils";

// ─── Shared fallback image ───────────────────────────────────────────────────
// Used as the alternate/placeholder image across every page whenever a
// dish/category/item image fails to load or is missing.
export const FALLBACK_IMAGE = "/assets/category-assets/img-not-available.png";

// Attach as onError={handleImgFallback} on any <img> that renders a
// data-driven src (dish.image, category.image, etc.). Guards against an
// infinite loop if the fallback image itself fails to load.
export function handleImgFallback(e) {
  if (e.target.src.endsWith(FALLBACK_IMAGE)) return;
  e.target.onerror = null;
  e.target.src = FALLBACK_IMAGE;
}

// ─── Page transition config ──────────────────────────────────────────────────
const pageVariants = {
  initial: (direction) => ({ x: direction > 0 ? 100 : -100, opacity: 0, height: "stretch" }),
  animate: { opacity: 1, x: 0, height: "stretch" },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -100 : 100, height: "stretch" }),
};

const pageTransition = { duration: 0.3, ease: "linear" };

// ─── Routes that hide the FloatingBag ───────────────────────────────────────
const EVENT_PATHS = [
  "/events/reservation",
  "/events/celebration",
  "/events/events",
  "/events/prebooking",
  "/events/catering",
  "/events/hosted",
  "/events",
  "/events/home",
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── State ────────────────────────────────────────────────────────────────
  const [isBagOpen, setIsBagOpen] = useState(true);
  const [direction, setDirection] = useState(1);
  const [lastAction, setLastAction] = useState("forward");
  // Attender layer: owns the bag. For guests/customers it is the one normal bag;
  // while an attender is signed in it is the ACTIVE table's bag (one bag per table).
  const { toast } = useToast();
  const attenderCtl = useAttender();
  const { bag, setBag } = attenderCtl;
  const [currentUser, setCurrentUser] = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const [isDineIn, setIsDineIn] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [foodData, setFoodData] = useState({
    categories: [],
    favourites: [],
    combo: [],
    comboOffers: [],
    ingredients: [],
    orders: [],
    offers: [],
    events: [],
  });
  // Super-Admin-configured special cards (My Favourites, Crowd Picks, My
  // Orders, Combos, Offers, Events & Booking) — name/image/enabled per
  // card. null while unloaded; FoodCategory falls back to its own
  // hardcoded defaults (all enabled) whenever a card id isn't present
  // here, so nothing changes for a fresh install with no saved config.
  const [categoryCards, setCategoryCards] = useState(null);

  const bellVibrateRef = useRef(null);

  const isExpandedPage = location.pathname.includes("/expanded");
  const isAuthenticatedUser = Boolean(currentUser?.id);

  // Whether a Super-Admin-configured special card is enabled. A missing
  // entry (nothing saved yet, or categoryCards still loading) defaults to
  // enabled — matches current/default behavior so nothing regresses until
  // a Super Admin actually disables something via the admin panel.
  const isCardEnabled = (id) => {
    if (!categoryCards) return true;
    const card = categoryCards.find((c) => c.id === id);
    return card ? card.enabled !== false : true;
  };
  const isMyFavouritesEnabled = isCardEnabled("my");
  const isCrowdPicksEnabled = isCardEnabled("others");
  const isMyOrdersCardEnabled = isCardEnabled("my-orders");
  const isComboEnabled = isCardEnabled("combo");
  const isOffersEnabled = isCardEnabled("offers");
  const isEventsEnabled = isCardEnabled("events");

  const motionProps = {
    className: "page-transition-wrapper",
    variants: pageVariants,
    initial: "initial",
    animate: "animate",
    exit: "exit",
    transition: pageTransition,
    custom: direction,
  };

  // Public, unauthenticated config for the special cards row on the Food
  // Category page — kept separate from fetchMenu so a failure here (or
  // simply "nothing saved yet") never blocks the rest of the menu from
  // loading; FoodCategory treats a missing card entry as "enabled" with
  // its own default name/image.
  const fetchCategoryCards = async () => {
    try {
      const res = await api.get("/category-cards/public");
      setCategoryCards(Array.isArray(res.data?.cards) ? res.data.cards : []);
    } catch {
      setCategoryCards([]);
    }
  };

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchMenu = async () => {
    setMenuLoading(true);
    try {
      // Purely a console-noise reduction: skip /orders/mine and /auth/me
      // (for favourites) up front on a device that's never logged in,
      // rather than firing them and silently catching the expected 401.
      // Server-side auth is unaffected either way — a stale/wrong flag
      // here only means an extra network call, never a false result.
      const everLoggedIn = !!localStorage.getItem("userId");

      // Favourites live embedded on the customer's own user doc, not a
      // separate collection — /favourites is the admin-only master list
      // (401s for a customer session), so pull them from /auth/me instead.
      // Fired in the SAME Promise.all batch as everything else (previously
      // this ran as its own sequential await AFTER the batch resolved,
      // which tacked a full extra network round-trip onto every load for
      // logged-in users before the app could render).
      const [categoriesRes, ingredientsRes, comboRes, offersRes, tablesRes, eventsRes, ordersRes, meRes] =
        await Promise.all([
          api.get("/public/categories"),
          api.get("/public/ingredients"),
          api.get("/public/combo"),
          api.get("/public/offers"),
          api.get("/public/tables"),
          api.get("/public/events").catch(() => ({ data: [] })),
          everLoggedIn ? api.get("/orders/mine").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
          everLoggedIn ? api.get("/auth/me").catch(() => null) : Promise.resolve(null),
        ]);

      const favourites = meRes?.data?.user?.favourites || [];

      setFoodData((prev) => ({
        ...prev,
        categories: categoriesRes.data || [],
        ingredients: ingredientsRes.data || [],
        favourites,
        combo: comboRes.data || [],
        comboOffers: comboRes.data || [],
        offers: offersRes.data || [],
        tables: tablesRes.data?.[0]?.list || [],
        events: eventsRes.data || [],
        orders: ordersRes.data || [],
      }));
      setConnectionError(false);
      setInitialLoading(false);
    } catch (err) {
      console.error("Failed to load menu", err);
      setConnectionError(true);
    } finally {
      setMenuLoading(false);
    }
  };

  // ─── User Init ────────────────────────────────────────────────────────────
  // Restores the logged-in customer from the server-side session
  // (httpOnly dishkyid cookie) rather than trusting a raw userId
  // sitting in localStorage — that's what used to make reloads
  // unreliable (nothing actually validated the id server-side, so any
  // hiccup on GET /users/:id silently logged the customer out).
  useEffect(() => {
    const initUser = async () => {
      // Purely a console-noise reduction, not a security check: if this
      // device has never logged in (userId was never set, or was cleared
      // on logout), skip the first /auth/me attempt entirely rather than
      // firing it and silently catching the expected 401. Anyone who HAS
      // logged in before still always hits /auth/me — the actual
      // session validity is still decided server-side by the httpOnly
      // cookie, never by this flag; a stale/wrong localStorage value
      // here can only cause an extra network call, never a false login.
      if (localStorage.getItem("userId")) {
        try {
          const res = await api.get("/auth/me");
          setCurrentUser(res.data.user);
          localStorage.setItem("userId", res.data.user.id); // kept in sync for any legacy reads elsewhere
          return;
        } catch {
          // No valid session cookie (not logged in, or session expired) —
          // fall through to the old localStorage-based lookup so guest/
          // legacy users already mid-session before this change aren't
          // abruptly logged out; a stale/broken value here still gets
          // cleared below.
        }
      }

      const rawUserId = localStorage.getItem("userId");
      if (!rawUserId) return;

      try {
        const res = await api.get(`/users/me`);
        setCurrentUser(res.data);
      } catch {
        localStorage.removeItem("userId");
        setCurrentUser(null);
      }
    };
    initUser();
  }, []);

  useEffect(() => {
    const tableNo = localStorage.getItem("tableNo");
    setIsDineIn(!!tableNo);
  }, [location.pathname]);

  useEffect(() => { fetchMenu(); }, []);
  useEffect(() => { fetchMenu(); }, [currentUser]);
  useEffect(() => { fetchCategoryCards(); }, []);

  // Auto-retry the initial connection if it failed, so the user isn't
  // stuck on "Reconnecting…" forever without another attempt being made.
  useEffect(() => {
    if (!initialLoading || !connectionError) return;
    const retryTimer = setTimeout(() => { fetchMenu(); }, 3000);
    return () => clearTimeout(retryTimer);
  }, [initialLoading, connectionError]);

  // ─── Scroll to Top on Route Change ───────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector(".App")?.scrollTo(0, 0);
  }, [location.pathname]);

  // ─── Navigation Direction Reset ──────────────────────────────────────────
  useEffect(() => {
    if (lastAction === "back") {
      const timer = setTimeout(() => {
        setDirection(1);
        setLastAction("forward");
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, lastAction]);

  // ─── Socket: Data Changes ─────────────────────────────────────────────────
  useEffect(() => {
    const MENU_RESOURCES = ["ingredients", "categories", "favourites", "combo", "offers", "events"];

    socket.on("data-change", ({ resource, action, payload }) => {
      if (resource === "orders") {
        // Guests only receive a redacted {id,status,paymentStatus} stub for
        // orders, so merge into known orders instead of appending/replacing.
        if (action !== "created" && payload && payload.id) {
          setFoodData((prev) => ({
            ...prev,
            orders: (prev.orders || []).map((o) => (o.id === payload.id ? { ...o, ...payload } : o)),
          }));
        }
      }
      if (resource === "categoryCards") fetchCategoryCards();
      if (MENU_RESOURCES.includes(resource)) fetchMenu();
    });

    return () => socket.off("data-change");
  }, []);

  // ─── Socket: Session Expiry ───────────────────────────────────────────────
  // Server ends a customer's session once their bill is printed or payment
  // is verified by the gateway. Log out live if it's this customer.
  useEffect(() => {
    const onSessionExpired = ({ userId }) => {
      const mine = localStorage.getItem("userId");
      if (!mine || mine !== userId) return;
      localStorage.removeItem("userId");
      setCurrentUser(null);
    };
    socket.on("session-expired", onSessionExpired);
    return () => socket.off("session-expired", onSessionExpired);
  }, []);

  // ─── Bell Vibration Helpers ───────────────────────────────────────────────
  // The user panel never plays a sound for the bell — it vibrates the device
  // in a repeating pattern until the admin panel explicitly turns the bell
  // off from the topbar (bell-off). The admin panel keeps its own audible
  // ring, handled separately in the admin app.
  const VIBRATE_PATTERN = [400, 200]; // vibrate 400ms, pause 200ms, repeat
  const VIBRATE_REPEAT_MS = 600; // pattern length — re-issue navigator.vibrate on this cadence

  const startBellVibrate = () => {
    if (bellVibrateRef.current) return; // already vibrating
    if (!("vibrate" in navigator)) return; // unsupported device/browser — silently no-op

    navigator.vibrate(VIBRATE_PATTERN);
    bellVibrateRef.current = setInterval(() => {
      navigator.vibrate(VIBRATE_PATTERN);
    }, VIBRATE_REPEAT_MS);
  };

  const stopBellVibrate = () => {
    if (bellVibrateRef.current) {
      clearInterval(bellVibrateRef.current);
      bellVibrateRef.current = null;
    }
    if ("vibrate" in navigator) navigator.vibrate(0); // cancel any in-flight vibration
  };

  // ─── Socket: Bell ─────────────────────────────────────────────────────────
  useEffect(() => {
    const myTable = localStorage.getItem("tableNo");

    // Bells are per venue: another venue's table 5 must not ring this one.
    const isMine = ({ tableNo, venueId }) =>
      String(tableNo) === String(localStorage.getItem("tableNo")) && (!venueId || venueId === resolved.venueId);

    const handleSync = (activeBells) => {
      if (myTable && activeBells[myTable]) { setIsRinging(true); startBellVibrate(); }
    };
    const handleBellOff = (evt) => {
      if (isMine(evt)) { setIsRinging(false); stopBellVibrate(); }
    };
    const handleBellRing = (evt) => {
      if (isMine(evt)) { setIsRinging(true); startBellVibrate(); }
    };

    socket.on("bell-sync", handleSync);
    socket.on("bell-off", handleBellOff);
    socket.on("bell-ring", handleBellRing);

    return () => {
      socket.off("bell-sync", handleSync);
      socket.off("bell-off", handleBellOff);
      socket.off("bell-ring", handleBellRing);
      stopBellVibrate();
    };
  }, []);

  // ─── Bag: Fly-to-bag image reveal ────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setBag((prev) => {
        if (!prev.length) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], __pendingImage: false };
        return copy;
      });
    };
    window.addEventListener("REVEAL_LAST_BAG_IMAGE", handler);
    return () => window.removeEventListener("REVEAL_LAST_BAG_IMAGE", handler);
  }, []);

  // ─── Bag Actions ──────────────────────────────────────────────────────────
  const addToBag = (rawItem) => {
    // An attender must pick a table first, otherwise there is no bag to add to.
    if (attenderCtl.isAttender && !attenderCtl.activeTab) {
      handleNavigate("/attender/tables");
      return;
    }
    setBag((prev) => {
      const item = normalizeBagItem(rawItem, foodData);
      const matchIndex = findMatchingBagIndex(prev, item);

      if (matchIndex !== -1) {
        return prev.map((p, i) =>
          i === matchIndex
            ? { ...p, quantity: p.quantity + item.quantity, totalPrice: p.unitPrice * (p.quantity + item.quantity) }
            : p
        );
      }
      return [...prev, item];
    });
    setIsBagOpen(true);
  };

  const increaseQty = (index) => {
    setBag((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const unit = getUnitPrice(item);
        const newQty = Number(item.quantity || 1) + 1;
        return { ...item, quantity: newQty, totalPrice: unit * newQty };
      })
    );
  };

  const decreaseQty = (index) => {
    setBag((prev) =>
      prev
        .map((item, i) => {
          if (i !== index) return item;
          const unit = getUnitPrice(item);
          const newQty = Number(item.quantity || 1) - 1;
          return { ...item, quantity: newQty, totalPrice: unit * newQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateBagItem = (index, updatedItem) => {
    setBag((prev) => prev.map((item, i) => (i === index ? updatedItem : item)));
  };

  // ─── Navigation Helpers ───────────────────────────────────────────────────
  const handleBack = (e) => { e?.preventDefault(); setDirection(-1); setLastAction("back"); navigate(-1); };
  const handleHome = (e) => { e?.preventDefault(); setDirection(-1); setLastAction("back"); navigate("/categories"); };
  const handleNavigate = (path) => { setDirection(1); setLastAction("forward"); navigate(path); };

  // ─── Attender Helpers ─────────────────────────────────────────────────────
  // After attender login/signup: drop any customer session on this device (so an
  // attender's orders can never attach to a customer account), then ask which table.
  const handleAttenderAuthed = (attender) => {
    endCustomerSession();
    setCurrentUser(null);
    attenderCtl.login(attender);
    handleNavigate("/attender/tables");
  };

  // The server ended the attender's session while orders were still open: their tables
  // are kept, they just sign in again.
  const handleAttenderExpired = () => {
    attenderCtl.expireSession();
    handleNavigate("/attender");
  };

  // ─── User Helpers ─────────────────────────────────────────────────────────
  // First letter of every word upper-cased, the rest left as typed (so GTR / MRK stay as entered).
  const toCamelCase = (value = "") =>
    String(value)
      .replace(/\s+/g, " ")
      .replace(/^\s/, "")
      .replace(/(^|\s)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

  const handleRingBell = () => {
    const tableNo = localStorage.getItem("tableNo") || "Guest";
    if (isRinging) return;
    socket.emit("bell-ring", { tableNo, venueId: resolved.venueId });
    setIsRinging(true);
    startBellVibrate();
  };

  // ─── Favourites Toggle ────────────────────────────────────────────────────
  // Optimistic update: flip currentUser.favourites (and so the heart icon,
  // which derives isWishlisted from it) immediately on click, then fire the
  // PATCH in the background. Previously the heart didn't update until the
  // full request/response round trip resolved, which is why the toggle felt
  // slow — the UI was waiting on the network + DB write instead of just
  // reflecting the click. If the request actually fails, the optimistic
  // change is rolled back and the error is surfaced.
  const onToggleFavourite = async (dish) => {
    const userId = localStorage.getItem("userId");

    // Guest user — localStorage only, already instant, no round trip to wait on
    if (!userId) {
      const guestFavs = JSON.parse(localStorage.getItem("guestFavourites")) || [];
      const exists = guestFavs.some((f) => f.id === dish.id);
      const updated = exists ? guestFavs.filter((f) => f.id !== dish.id) : [...guestFavs, dish];
      localStorage.setItem("guestFavourites", JSON.stringify(updated));
      return;
    }

    const previousFavourites = Array.isArray(currentUser?.favourites) ? currentUser.favourites : [];
    const existsInUser = previousFavourites.some((f) => f.id === dish.id);

    const enrichedDish = existsInUser
      ? { id: dish.id, _remove: true }
      : { ...dish, userId, customerName: currentUser?.name || "Guest" };

    // Apply the change locally right away — this is what makes the heart
    // flip instantly instead of waiting on the server.
    const optimisticFavourites = existsInUser
      ? previousFavourites.filter((f) => f.id !== dish.id)
      : [...previousFavourites, enrichedDish];
    setCurrentUser((prev) => (prev ? { ...prev, favourites: optimisticFavourites } : prev));

    try {
      const res = await api.patch("/users/me/favourites", enrichedDish);
      // Reconcile with the server's actual state in the background — covers
      // edge cases like a concurrent change from another tab/device — but
      // the visible toggle already happened above, so this doesn't block
      // anything the user sees.
      setCurrentUser(res.data);
    } catch (err) {
      // Roll back the optimistic change on genuine failure, so the heart
      // doesn't lie about what's actually saved.
      setCurrentUser((prev) => (prev ? { ...prev, favourites: previousFavourites } : prev));
      console.error("Favourite toggle failed:", err);
      if (err?.response?.status === 401) {
        toast.warning("Please log in again to use your wishlist.");
      }
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="App">
        <PageLoader
          label={connectionError ? "Reconnecting to the server" : "Connecting to the server"}
        />
      </div>
    );
  }

  return (
    <LayoutGroup>
      <div className="App">

        {/* Floating Bag — hidden on event pages and the attender sign-in/table pages */}
        {!EVENT_PATHS.includes(location.pathname) && !location.pathname.startsWith("/attender") && (
          <FloatingBag
            bag={bag}
            increaseQty={increaseQty}
            decreaseQty={decreaseQty}
            isOpen={isBagOpen}
            setIsOpen={setIsBagOpen}
            attenderTab={attenderCtl.isAttender ? attenderCtl.activeTab : null}
            onAttenderExpired={handleAttenderExpired}
          />
        )}

        {/* Attender table switcher — only while an attender is signed in */}
        {attenderCtl.isAttender && location.pathname !== "/" && !location.pathname.startsWith("/attender") && (
          <AttenderSwitcher attenderCtl={attenderCtl} handleNavigate={handleNavigate} />
        )}

        {/* Floating Profile bubble — logged-in users only, hidden on
            Welcome/Thank You (per request) and on the Profile page
            itself (nothing to navigate to from there). On the events/
            booking pages the default bottom-right spot sits over
            those forms' own sticky header, so it gets a dedicated
            repositioning class there instead of sharing the default
            spot used everywhere else. */}
        {isAuthenticatedUser &&
          !["/", "/thank-you", "/profile"].includes(location.pathname) && (
            <button
              type="button"
              id="floating-profile-btn"
              className={`floating-profile-btn${EVENT_PATHS.includes(location.pathname) ? " floating-profile-btn--event-page" : ""}`}
              onClick={() => handleNavigate("/profile")}
              aria-label="Profile"
            >
              {(currentUser?.name || "?").trim().charAt(0).toUpperCase() || "?"}
            </button>
          )}

        {/* Floating Bell — dine-in guests only (an attender is the one being called) */}
        {isDineIn && !attenderCtl.isAttender && (
          <div
            className={`floating-bell-wrapper${isRinging ? " is-ringing" : ""}`}
            onClick={handleRingBell}
            title={isRinging ? "Attender called – waiting for response" : "Call the attender"}
          >
            <span className="floating-bell-pulse" aria-hidden="true" />
            <button
              className={`floating-bell ${isRinging ? "ringing" : ""}`}
              disabled={isRinging}
              aria-label="Call attender"
            >
              <img
                key={isRinging ? "animated" : "static"}
                src={isRinging ? bellGif : bellStatic}
                alt="Call Attender"
                className="bell-image"
              />
            </button>
            <div className="bell-label">
              <span className="bell-label-title">
                {isRinging ? "Attender is on the way!" : "Call Attender"}
              </span>
              {isRinging && (
                <span className="bell-label-sub">Your phone will vibrate until they arrive</span>
              )}
            </div>
          </div>
        )}

        {/* Routes */}
        {/*
          Previously the expanded food-detail page was routed through a
          second, separate <AnimatePresence>/<Routes> tree (branched on
          isExpandedPage), swapped in via a plain ternary alongside this
          one. That meant navigating FoodList -> FoodListExpanded
          unmounted this entire tree and mounted the other one outright,
          instead of React Router/Framer Motion tracking it as one route
          change. That broke two things: FoodListExpanded's exit
          animation never got to play (this tree just vanished), and the
          layoutId-based shared image transition between the two pages'
          <motion.img> elements lost continuity, since LayoutGroup could
          no longer see both the outgoing and incoming element in the
          same animation cycle. That's what caused the image to blink
          during the transition instead of morphing smoothly.

          Folding /foods/:categoryId/expanded into this single
          <AnimatePresence>/<Routes> tree (and giving it the same
          motionProps every other route uses) lets Framer Motion see the
          FoodList <-> FoodListExpanded transition as a normal route
          change within one AnimatePresence, so the shared layoutId image
          can crossfade/morph correctly and the slide transition applies
          consistently instead of the expanded page appearing with no
          transition at all.
        */}
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>

            <Route path="/" element={<motion.div {...motionProps}><Welcome handleNavigate={handleNavigate} toCamelCase={toCamelCase} setCurrentUser={setCurrentUser} fetchMenu={fetchMenu} /></motion.div>} />

            <Route path="/attender" element={<motion.div {...motionProps}><AttenderAuth attenderCtl={attenderCtl} onAuthed={handleAttenderAuthed} handleNavigate={handleNavigate} toCamelCase={toCamelCase} /></motion.div>} />

            <Route path="/attender/tables" element={
              attenderCtl.isAttender
                ? <motion.div {...motionProps}><AttenderTables attenderCtl={attenderCtl} foodData={foodData} handleNavigate={handleNavigate} /></motion.div>
                : <Navigate to="/attender" replace />
            } />

            <Route path="/categories" element={<motion.div {...motionProps}><FoodCategory foodData={foodData} handleNavigate={handleNavigate} currentUser={currentUser} categoryCards={categoryCards} /></motion.div>} />

            <Route path="/appetizer-builder" element={<div className="page-transition-wrapper"><AppetizerBuilder foodData={foodData} addToBag={addToBag} handleBack={handleBack} handleHome={handleHome} /></div>} />

            <Route path="/foods/:categoryId" element={<motion.div {...motionProps}><FoodList foodData={foodData} handleNavigate={handleNavigate} handleBack={handleBack} handleHome={handleHome} addToBag={addToBag} currentUser={currentUser} setCurrentUser={setCurrentUser} onToggleFavourite={onToggleFavourite} /></motion.div>} />

            <Route
              path="/foods/:categoryId/expanded"
              element={
                <motion.div {...motionProps}>
                  <FoodListExpanded
                    foodData={foodData}
                    addToBag={addToBag}
                    handleBack={handleBack}
                    handleHome={handleHome}
                    currentUser={currentUser}
                    onToggleFavourite={onToggleFavourite}
                  />
                </motion.div>
              }
            />

            <Route path="/subcategory/:categoryId" element={<motion.div {...motionProps}><SubCategoryPage foodData={foodData} handleNavigate={handleNavigate} handleBack={handleBack} handleHome={handleHome} /></motion.div>} />

            <Route path="foods/:categoryId/grid" element={<motion.div {...motionProps}><FoodGridList foodData={foodData} handleNavigate={handleNavigate} handleBack={handleBack} handleHome={handleHome} addToBag={addToBag} currentUser={currentUser} setCurrentUser={setCurrentUser} onToggleFavourite={onToggleFavourite} /></motion.div>} />

            <Route path="/best-sellers" element={<motion.div {...motionProps}><BestSellers foodData={foodData} currentUser={currentUser} onToggleFavourite={onToggleFavourite} handleBack={handleBack} handleHome={handleHome} /></motion.div>} />

            <Route path="/food/:id" element={<motion.div {...motionProps}><FoodItem foodData={foodData} onToggleFavourite={onToggleFavourite} addToBag={addToBag} updateBagItem={updateBagItem} setDirection={setDirection} setLastAction={setLastAction} toCamelCase={toCamelCase} handleHome={handleHome} handleBack={handleBack} currentUser={currentUser} isWishlistEnabled={isMyFavouritesEnabled && isCrowdPicksEnabled} /></motion.div>} />

            <Route path="/ingredient/:id" element={<motion.div {...motionProps}><IngredientDetail handleBack={handleBack} foodData={foodData} handleNavigate={handleNavigate} /></motion.div>} />

            <Route path="/thank-you" element={<motion.div {...motionProps}><ThankYou bag={bag} setBag={setBag} setIsBagOpen={setIsBagOpen} isAttender={attenderCtl.isAttender} /></motion.div>} />

            <Route path="/profile" element={
              isAuthenticatedUser
                ? <motion.div {...motionProps}><Profile currentUser={currentUser} setCurrentUser={setCurrentUser} handleBack={handleBack} handleHome={handleHome} isMyFavouritesEnabled={isMyFavouritesEnabled} isMyOrdersCardEnabled={isMyOrdersCardEnabled} /></motion.div>
                : <Navigate to="/categories" replace />
            } />

            <Route path="/favourites/:source" element={
              (location.pathname.includes("/my") ? isMyFavouritesEnabled : isCrowdPicksEnabled)
                ? <motion.div {...motionProps}><FavouriteCategories foodData={foodData} currentUser={currentUser} handleBack={handleBack} handleHome={handleHome} /></motion.div>
                : <Navigate to="/categories" replace />
            } />

            <Route path="/favourites/:source/category/:categoryId" element={
              (location.pathname.includes("/my") ? isMyFavouritesEnabled : isCrowdPicksEnabled)
                ? <motion.div {...motionProps}><FavouriteDishList foodData={foodData} currentUser={currentUser} setCurrentUser={setCurrentUser} handleBack={handleBack} handleHome={handleHome} addToBag={addToBag} /></motion.div>
                : <Navigate to="/categories" replace />
            } />

            <Route path="/favourites/:source/dish/:dishId" element={
              (location.pathname.includes("/my") ? isMyFavouritesEnabled : isCrowdPicksEnabled)
                ? <motion.div {...motionProps}><FavouriteDishDetail foodData={foodData} handleBack={handleBack} addToBag={addToBag} handleHome={handleHome} currentUser={currentUser} /></motion.div>
                : <Navigate to="/categories" replace />
            } />

            <Route path="/combo" element={isComboEnabled ? <motion.div {...motionProps}><ComboPage foodData={foodData} comboOfferRules={foodData.comboOffers || []} addToBag={addToBag} updateBagItem={updateBagItem} handleBack={handleBack} handleHome={handleHome} currentUser={currentUser} setCurrentUser={setCurrentUser} /></motion.div> : <Navigate to="/categories" replace />} />

            <Route path="/favourite-combos" element={isAuthenticatedUser && isComboEnabled ? <motion.div {...motionProps}><FavouriteCombo currentUser={currentUser} setCurrentUser={setCurrentUser} addToBag={addToBag} handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />

            <Route path="/my-orders" element={isAuthenticatedUser && isMyOrdersCardEnabled ? <motion.div {...motionProps}><MyOrders currentUser={currentUser} initialOrders={foodData.orders} handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />

            <Route path="/my-orders/:orderId" element={isAuthenticatedUser && isMyOrdersCardEnabled ? <motion.div {...motionProps}><OrderDetails handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />

            <Route path="/offers" element={isOffersEnabled ? <motion.div {...motionProps}><OffersGrid foodData={foodData} addToBag={addToBag} handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />

            <Route path="/events" element={isEventsEnabled ? <motion.div {...motionProps}><EventHome handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />
            <Route path="/events/hosted" element={isEventsEnabled ? <motion.div {...motionProps}><EventsPage handleBack={handleBack} handleHome={handleHome} currentUser={currentUser} /></motion.div> : <Navigate to="/categories" replace />} />
            <Route path="/events/reservation" element={isEventsEnabled ? <motion.div {...motionProps}><ReservationForm foodData={foodData} bag={bag} setBag={setBag} handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />
            <Route path="/events/celebration" element={isEventsEnabled ? <motion.div {...motionProps}><CelebrationForm bag={bag} setBag={setBag} handleBack={handleBack} handleHome={handleHome} navigateToCatering={() => handleNavigate("/events/catering")} /></motion.div> : <Navigate to="/categories" replace />} />
            <Route path="/events/prebooking" element={isEventsEnabled ? <motion.div {...motionProps}><PreBooking bag={bag} setBag={setBag} handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />
            <Route path="/events/catering" element={isEventsEnabled ? <motion.div {...motionProps}><CateringForm bag={bag} setBag={setBag} handleBack={handleBack} handleHome={handleHome} /></motion.div> : <Navigate to="/categories" replace />} />

          </Routes>
        </AnimatePresence>

        {/* Mobile bottom nav — CSS-hidden above 600px width, hidden on
            Welcome per request (every other page shows it). */}
        {location.pathname !== "/" && !location.pathname.startsWith("/attender") && (
          <MobileFooterNav
            currentUser={currentUser}
            bag={bag}
            isBagOpen={isBagOpen}
            setIsBagOpen={setIsBagOpen}
            handleNavigate={handleNavigate}
            isMyOrdersCardEnabled={isMyOrdersCardEnabled}
            isMyFavouritesEnabled={isMyFavouritesEnabled}
            activePath={location.pathname}
          />
        )}

      </div>
    </LayoutGroup>
  );
}

export default App;