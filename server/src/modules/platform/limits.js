/**
 * limits.js — plan-limit and plan-module enforcement for tenant routes.
 */
const { currentTenantId } = require("../../core/tenancy");
const subs = require("./subscriptions");

const LIMIT_KEYS = {
  venues: { entitlement: "maxVenues", label: "venues" },
  tables: { entitlement: "maxTables", label: "tables" },
  staffAccounts: { entitlement: "maxStaffAccounts", label: "staff accounts" },
};

function upgradeUrl() {
  return `${process.env.PUBLIC_SITE_URL || "https://www.dishky.com"}/account/billing`;
}

/**
 * Throws a 402 error if adding `adding` more of `kind` would exceed the plan.
 * `kind` is one of venues | tables | staffAccounts.
 */
async function assertWithinLimit(kind, adding = 1) {
  const restaurantId = currentTenantId();
  const meta = LIMIT_KEYS[kind];
  if (!restaurantId || !meta) return;
  const state = await subs.getAccessState(restaurantId);
  const limit = state.entitlements[meta.entitlement];
  if (limit === null || limit === undefined) return; // unlimited
  const usage = await subs.getUsage(restaurantId);
  if (usage[kind] + adding > limit) {
    throw Object.assign(
      new Error(`Your plan allows ${limit} ${meta.label}. Upgrade your plan to add more.`),
      { status: 402, code: "PLAN_LIMIT", kind, limit, used: usage[kind], upgradeUrl: upgradeUrl() }
    );
  }
}

/** Express middleware: block routes for modules the current plan does not include. */
function requireModule(moduleName) {
  return async (req, res, next) => {
    try {
      const restaurantId = currentTenantId();
      if (!restaurantId) return next();
      const state = await subs.getAccessState(restaurantId);
      if (!state.entitlements.modules.includes(moduleName)) {
        return res.status(402).json({
          error: "This feature is not included in your current plan.",
          code: "PLAN_UPGRADE_REQUIRED",
          module: moduleName,
          upgradeUrl: upgradeUrl(),
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function sendLimitError(res, err) {
  return res.status(err.status || 402).json({
    error: err.message, code: err.code, kind: err.kind, limit: err.limit, used: err.used, upgradeUrl: err.upgradeUrl,
  });
}

module.exports = { assertWithinLimit, requireModule, sendLimitError, upgradeUrl };
