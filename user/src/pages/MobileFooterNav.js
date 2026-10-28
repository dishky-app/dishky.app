import React from "react";
import { getBagItemCount } from "./shared/bagUtils";
import { useTabLiquid } from "../hooks/useTabLiquid";
import Home from "../assets/icons/footer-home.png";
import Bag from "../assets/icons/footer-subscribe.png";
import Profile from "../assets/icons/footer-profile.png";
import Fav from "../assets/icons/footer-fav.png";
import Orders from "../assets/icons/footer-orders.png";

/**
 * MobileFooterNav — bottom tab bar shown only on narrow (<600px) screens,
 * on every page except Welcome. Visibility/width is entirely CSS-driven
 * (see .mobile-footer-nav in App.css) so this component always renders;
 * it just stays hidden above the 600px breakpoint.
 *
 * Bag opens the existing slide-up bag sheet (same as the floating bag
 * button) rather than navigating to a route, since the app doesn't have
 * a dedicated "bag page" — it's a sheet overlay everywhere else too.
 * Tapping it again while the sheet is already open closes it (toggles
 * isBagOpen rather than always forcing it open), matching how tapping
 * an already-active tab elsewhere in the app doesn't need a second
 * dedicated close action.
 *
 * The active tab is highlighted with the same "liquid" sliding pill
 * used by the admin panel's Permissions/Roles switch (useTabLiquid +
 * .app-tab-pill-liquid in Common.css there) — ported here as
 * .mobile-footer-tab-liquid so the highlight glides between tabs
 * instead of the background/color just snapping on the new one.
 *
 * Every tab's `active` class is derived from the single `activeKey`
 * below, never from re-checking its own route match independently —
 * that used to let two tabs end up "active" at once (e.g. Home still
 * matching /categories while Bag was also active from isBagOpen),
 * which showed as two separate highlight boxes since each carried its
 * own static background on top of the one sliding thumb.
 */
const MobileFooterNav = ({
  currentUser,
  bag,
  isBagOpen,
  setIsBagOpen,
  handleNavigate,
  isMyOrdersCardEnabled,
  isMyFavouritesEnabled,
  activePath,
}) => {
  const totalItems = getBagItemCount(bag || []);
  const isAuthenticatedUser = Boolean(currentUser?.id);
  const isRealAccount = isAuthenticatedUser && currentUser.id !== "guest";

  const isActive = (path) => activePath === path;

  // One key drives the liquid thumb — "bag" isn't a route match like
  // the others (it's a sheet-open boolean), so it takes priority over
  // path matching when open rather than the two fighting for which
  // tab is "really" active.
  const activeKey = isBagOpen
    ? "bag"
    : isActive("/categories")
      ? "home"
      : isActive("/favourites/my")
        ? "favourites"
        : isActive("/my-orders")
          ? "orders"
          : isActive("/profile")
            ? "profile"
            : null;

  const { containerRef, thumbStyle } = useTabLiquid(activeKey, ".mobile-footer-tab.active");

  return (
    <nav className="mobile-footer-nav" ref={containerRef}>
      <span className="mobile-footer-tab-liquid" style={thumbStyle} />

      <button
        type="button"
        className={`mobile-footer-tab ${activeKey === "home" ? "active" : ""}`}
        onClick={() => handleNavigate("/categories")}
        aria-label="Home"
      >
        <span className="mobile-footer-tab-icon"><img src={Home} alt="Home" /></span>
        <span className="mobile-footer-tab-label">Home</span>
      </button>

      {isRealAccount && isMyFavouritesEnabled && (
        <button
          type="button"
          className={`mobile-footer-tab ${activeKey === "favourites" ? "active" : ""}`}
          onClick={() => handleNavigate("/favourites/my")}
          aria-label="My Favourites"
        >
          <span className="mobile-footer-tab-icon"><img src={Fav} alt="Favourites" /></span>
          <span className="mobile-footer-tab-label">Favourites</span>
        </button>
      )}

      <button
        type="button"
        className={`mobile-footer-tab ${activeKey === "bag" ? "active" : ""}`}
        onClick={() => setIsBagOpen((prev) => !prev)}
        aria-label="Bag"
      >
        <span className="mobile-footer-tab-icon mobile-footer-tab-icon--bag">
          <img src={Bag} alt="Bag" />
          {totalItems > 0 && (
            <span className="mobile-footer-tab-badge">{totalItems}</span>
          )}
        </span>
        <span className="mobile-footer-tab-label">Bag</span>
      </button>

      {isRealAccount && isMyOrdersCardEnabled && (
        <button
          type="button"
          className={`mobile-footer-tab ${activeKey === "orders" ? "active" : ""}`}
          onClick={() => handleNavigate("/my-orders")}
          aria-label="My Orders"
        >
          <span className="mobile-footer-tab-icon"><img src={Orders} alt="Orders" /></span>
          <span className="mobile-footer-tab-label">Orders</span>
        </button>
      )}

      {isRealAccount && (
        <button
          type="button"
          className={`mobile-footer-tab ${activeKey === "profile" ? "active" : ""}`}
          onClick={() => handleNavigate("/profile")}
          aria-label="Profile"
        >
          <span className="mobile-footer-tab-icon"><img src={Profile} alt="Profile" />
          </span>
          <span className="mobile-footer-tab-label">
            {currentUser?.name || "Profile"}
          </span>
        </button>
      )}
    </nav>
  );
};

export default MobileFooterNav;