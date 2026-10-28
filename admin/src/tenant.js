// tenant.js — which restaurant this admin panel is signed in to.
//
// Staff sign in with their restaurant's URL name (the "dishky" in
// dishky.com/dishky). It comes from, in order: the ?restaurant= query
// parameter (set by links from the dishky.com account page and by password
// reset emails), then the last value used on this browser.

const KEY = "dishky_restaurant";

export const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || "https://www.dishky.com";
export const CUSTOMER_BASE_URL = (import.meta.env.VITE_CUSTOMER_URL || MARKETING_URL).replace(/\/$/, "");

const clean = (v) => String(v || "").trim().toLowerCase();

export function getRestaurant() {
  try {
    const fromUrl = clean(new URLSearchParams(window.location.search).get("restaurant"));
    if (fromUrl) {
      localStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    return clean(localStorage.getItem(KEY));
  } catch {
    return "";
  }
}

export function setRestaurant(slug) {
  try { localStorage.setItem(KEY, clean(slug)); } catch { /* storage unavailable */ }
}

/** Public ordering link: dishky.com/<restaurant>/<venue>[/<table>] */
export function customerUrl(venueSlug, tableNo) {
  const parts = [getRestaurant(), venueSlug, tableNo].filter((p) => p !== undefined && p !== null && p !== "");
  if (parts.length < 2) return `${CUSTOMER_BASE_URL}/${parts.map(encodeURIComponent).join("/")}`;
  return `${CUSTOMER_BASE_URL}/${parts.map((p) => encodeURIComponent(String(p))).join("/")}`;
}
