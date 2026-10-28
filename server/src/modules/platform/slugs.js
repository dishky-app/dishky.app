/**
 * slugs.js — URL-safe names for restaurants, venues and tables.
 *
 *   dishky.com/<restaurant>/<venue>/<table>
 *
 * The restaurant slug sits at the root of the domain, so it must never collide
 * with a marketing/product route. RESERVED_SLUGS is the single source of truth;
 * the website build generates its host rewrites from the same list
 * (see dishky-website/scripts/generate-vercel-config.js).
 */

const RESERVED_SLUGS = [
  // product + marketing routes
  "", "admin", "app", "api", "www", "login", "logout", "signup", "register", "account", "billing",
  "pricing", "plans", "features", "platform", "user-panel", "admin-panel", "promotions", "solutions",
  "branches", "resources", "about", "contact", "book-demo", "legal", "privacy", "terms", "security",
  "cookies", "help", "support", "docs", "blog", "status", "demo", "dashboard", "checkout", "sso",
  "assets", "static", "public", "brand", "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
  "health", "socket.io", "r", "t", "s", "dishky", "root", "null", "undefined", "new", "settings",
  "staff", "orders", "menu", "welcome", "foodcategory", "events", "profile", "thankyou",
];

// First path segments of the customer app's own routes (used so a table number
// can be told apart from an in-app route). Keep in sync with user-panel App.js.
const CUSTOMER_APP_ROUTES = [
  "categories", "appetizer-builder", "best-sellers", "combo", "display", "events", "favourite-combos",
  "favourites", "food", "foods", "ingredient", "my-orders", "my-subscriptions", "offers",
  "profile", "subcategory", "subscribe", "subscription", "thank-you", "attender",
];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Returns null if valid, otherwise a human-readable reason. */
function validateRestaurantSlug(slug) {
  if (typeof slug !== "string" || !slug) return "Restaurant URL name is required";
  if (!SLUG_RE.test(slug)) {
    return "Use 2-40 lowercase letters, numbers or hyphens (no leading/trailing hyphen)";
  }
  if (slug.length < 2) return "Restaurant URL name must be at least 2 characters";
  if (RESERVED_SLUGS.includes(slug) || CUSTOMER_APP_ROUTES.includes(slug)) {
    return "That name is reserved. Please choose another";
  }
  return null;
}

function validateVenueSlug(slug) {
  if (typeof slug !== "string" || !slug) return "Venue URL name is required";
  if (!SLUG_RE.test(slug)) return "Use lowercase letters, numbers or hyphens";
  if (CUSTOMER_APP_ROUTES.includes(slug)) return "That venue name is reserved. Please choose another";
  return null;
}

const TABLE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/;
function validateTableId(id) {
  const s = String(id);
  if (!TABLE_RE.test(s)) return "Table numbers may use letters, numbers and hyphens (max 12)";
  if (CUSTOMER_APP_ROUTES.includes(s.toLowerCase())) return "That table name is reserved";
  return null;
}

module.exports = {
  RESERVED_SLUGS,
  CUSTOMER_APP_ROUTES,
  slugify,
  validateRestaurantSlug,
  validateVenueSlug,
  validateTableId,
};
