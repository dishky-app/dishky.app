/**
 * tenantResolver.js — decides WHICH restaurant a request belongs to, puts the
 * request inside that tenant's context (tenancy.js), and applies the
 * subscription gate.
 *
 * Resolution order:
 *   1. A valid staff session cookie  -> the restaurant the session was created for.
 *      (A staff member can never act on another restaurant by changing a header.)
 *   2. X-Restaurant header (the customer app and login screens send the slug
 *      taken from the URL) or ?restaurant= / body.restaurant (login forms).
 *
 * Subscription gate (after the tenant is known):
 *   blocked  -> every request refused (403 ACCOUNT_BLOCKED)
 *   readonly -> reads allowed, writes refused (402 SUBSCRIPTION_INACTIVE),
 *               except sign-in/out so owners can still reach the billing page
 *   full     -> pass
 */
const { Restaurant } = require("./models");
const subs = require("./subscriptions");
const { runAsPlatform, tenantMiddlewareRun } = require("../../core/tenancy");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Writes that must keep working when the subscription has lapsed.
const READONLY_ALLOWED_WRITES = [
  /^\/staff-auth\/(login|logout|logout-all|sso|forgot-password|reset-password|change-password)$/,
  /^\/auth\/logout$/,
  /^\/staff-auth\/me$/,
];
// Paths that are not tenant-specific at all.
const PLATFORM_PREFIXES = ["/platform", "/health"];

const slugCache = new Map(); // slug -> { at, restaurant }
const sessionCache = new Map(); // sessionId -> { at, restaurantId }
const SLUG_TTL = 30 * 1000;
const SESSION_TTL = 5 * 1000;

function invalidateRestaurant(slug) {
  if (slug) slugCache.delete(slug);
  else slugCache.clear();
}

async function restaurantBySlug(slug) {
  const hit = slugCache.get(slug);
  if (hit && Date.now() - hit.at < SLUG_TTL) return hit.restaurant;
  const restaurant = await runAsPlatform(() => Restaurant.findOne({ slug }).lean());
  slugCache.set(slug, { at: Date.now(), restaurant });
  return restaurant;
}

async function restaurantIdFromSession(sessionId) {
  const hit = sessionCache.get(sessionId);
  if (hit && Date.now() - hit.at < SESSION_TTL) return hit.restaurantId;
  const { Session } = require("../auth/auth");
  const session = await runAsPlatform(() => Session.findOne({ sessionId }).select("restaurantId expiresAt").lean());
  const restaurantId = session && session.expiresAt > new Date() ? session.restaurantId || null : null;
  sessionCache.set(sessionId, { at: Date.now(), restaurantId });
  return restaurantId;
}

function tenantMiddleware({ staffCookieName }) {
  return async function resolveTenant(req, res, next) {
    try {
      if (PLATFORM_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();

      let restaurant = null;
      const sessionId = req.cookies && req.cookies[staffCookieName];
      const slugHint = String(req.headers["x-restaurant"] || req.query.restaurant || (req.body && req.body.restaurant) || "")
        .toLowerCase().trim();

      // Sign-in screens address a restaurant explicitly; any old cookie is irrelevant there.
      const isSignIn = req.path === "/staff-auth/login" || req.path === "/staff-auth/sso" ||
        req.path === "/staff-auth/forgot-password" || req.path === "/staff-auth/reset-password";

      if (sessionId && !isSignIn) {
        const rid = await restaurantIdFromSession(sessionId);
        if (rid) {
          restaurant = await runAsPlatform(() => Restaurant.findOne({ id: rid }).lean());
          if (restaurant && slugHint && slugHint !== restaurant.slug) {
            return res.status(403).json({ error: "This session belongs to a different restaurant", code: "TENANT_MISMATCH" });
          }
        }
      }
      if (!restaurant && slugHint) restaurant = await restaurantBySlug(slugHint);

      if (!restaurant) return next(); // no tenant: tenant-scoped queries will refuse to run

      const state = await subs.getAccessState(restaurant.id);
      req.tenant = {
        restaurant,
        access: state.access,
        planKey: state.planKey,
        entitlements: state.entitlements,
        subscription: state.subscription,
      };

      const level = state.access.level;
      if (level === "blocked") {
        return res.status(403).json({ error: "This restaurant account is not active.", code: "ACCOUNT_BLOCKED" });
      }
      if (level === "readonly" && !SAFE_METHODS.has(req.method) && !READONLY_ALLOWED_WRITES.some((re) => re.test(req.path))) {
        return res.status(402).json({
          error: "The Dishky subscription for this restaurant is not active.",
          code: "SUBSCRIPTION_INACTIVE",
          reason: state.access.reason,
        });
      }

      return tenantMiddlewareRun(restaurant.id, next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { tenantMiddleware, restaurantBySlug, invalidateRestaurant };
