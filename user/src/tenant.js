// tenant.js — works out which restaurant / venue / table this page is for.
//
//   dishky.com/<restaurant>/<venue>/<table>/<in-app route...>
//
// The first path segment is the restaurant, then an optional venue and an
// optional table. Anything that is one of the app's own routes ends the
// prefix (so "/dishky/main/categories" is venue "main", no table).
// The prefix becomes the router basename, so every in-app link keeps working
// unchanged ("/categories" resolves to "/dishky/main/5/categories").

// First path segment of every route defined in App.js. Keep in sync with
// CUSTOMER_APP_ROUTES in the server's platform/slugs.js.
export const APP_ROUTES = [
  "categories", "appetizer-builder", "best-sellers", "combo", "display", "events", "favourite-combos",
  "favourites", "food", "foods", "ingredient", "my-orders", "my-subscriptions", "offers",
  "profile", "subcategory", "subscribe", "subscription", "thank-you", "attender",
];

export function parseTenantPath(pathname) {
  const segs = String(pathname || "/").split("/").filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  const restaurant = segs[0] && !APP_ROUTES.includes(segs[0].toLowerCase()) ? segs[0].toLowerCase() : null;
  if (!restaurant) return { restaurant: null, venue: null, table: null, display: false, basename: "" };
  let i = 1;
  let venue = null;
  let table = null;
  if (segs[i] && !APP_ROUTES.includes(segs[i].toLowerCase())) { venue = segs[i].toLowerCase(); i += 1; }
  // dishky.com/<restaurant>/<venue>/display is the order-status board (kitchen
  // display), not a table: it ends the prefix like a table would.
  let display = false;
  if (venue && segs[i] && segs[i].toLowerCase() === "display") { display = true; i += 1; }
  else if (venue && segs[i] && !APP_ROUTES.includes(segs[i].toLowerCase())) { table = segs[i]; i += 1; }
  const basename = "/" + segs.slice(0, i).map(encodeURIComponent).join("/");
  return { restaurant, venue, table, display, basename };
}

const tenant = parseTenantPath(typeof window !== "undefined" ? window.location.pathname : "/");

// Filled in once /public/resolve answers (ids the API needs).
export const resolved = { venueId: null, venueName: null, restaurantName: null, branding: null, acceptingOrders: true, tableValid: null };

export const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || "https://www.dishky.com";

export default tenant;
