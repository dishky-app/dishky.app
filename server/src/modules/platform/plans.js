/**
 * plans.js — subscription plans and what each one entitles a restaurant to.
 *
 * Marketing copy (name/tagline/feature bullets/prices) lives on the Plan
 * document so it can be edited without a deploy; the machine-readable
 * ENTITLEMENTS (limits + modules) are defined here, keyed by plan key, so
 * enforcement can never drift from what was sold.
 *
 * A "module" is the same logical name the permission matrix already uses
 * (a collection name or a screen), so the existing requirePerm(name, ...) call
 * sites can enforce plan limits with one extra check.
 */

const CORE_MODULES = [
  "categories", "offers", "favourites", "orders", "payments", "tables", "tablePreferences",
  "users", "categoryCards", "theme", "bankAccount", "chat", "venues", "permissions", "roles",
  "tasks", "todos", "auditLogs", "counters", "supportTickets",
];

const GROWTH_MODULES = [
  ...CORE_MODULES,
  "ingredients", "combo", "combo_offers", "comboSectionConfig",
  "suppliers", "inventoryItems", "inventoryStock", "stockLedger",
  "purchaseRequests", "purchaseApprovals", "purchaseRfq", "purchaseOrders", "purchaseSettings", "purchaseReceiving", "purchaseReturns", "purchaseInvoices", "purchasePayments", "purchaseReports", "inventoryAlerts", "stockAudits", "purchaseWhatsapp", "supplierScorecards",
  "staff", "staffArchive", "careers", "holidays", "recipes", "callHistory",
  "reservations", "celebrations", "preBookings", "cateringOrders", "events", "eventBookings",
  "kitchenActivity", "kitchenSchedules", "kitchenAssign", "kitchenMise", "mise", "grooming",
  "serviceActivity", "serviceSchedules", "serviceAssign", "serviceMise", "serviceGrooming",
  "workPlan", "memos", "documents", "loyalty", "whatsapp",
];

// Display names: Essential (key "starter"), Professional ("growth"), Premium ("pro"), Custom ("enterprise").
// Keys stay as they are: subscriptions and billing records refer to them.
const PLAN_DEFINITIONS = [
  {
    key: "starter",
    name: "Essential",
    tagline: "For smaller restaurants and cafés",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    features: [
      "Dishky User Panel", "QR ordering", "Digital menu", "Basic order management",
      "Basic dashboard", "Single branch",
    ],
    mostPopular: false,
    ctaLabel: "Get Started",
    order: 1,
    selfServe: true,
    entitlements: { maxVenues: 1, maxTables: 15, maxStaffAccounts: 3, modules: CORE_MODULES },
  },
  {
    key: "growth",
    name: "Professional",
    tagline: "For growing restaurants",
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    features: [
      "Everything in Essential", "Advanced order management", "Inventory management",
      "Staff management", "Reservations & events", "Guest Management (GMS)",
      "Kitchen Management (KMS)", "Service Management (SMS)", "Advanced analytics",
      "Multiple staff accounts",
    ],
    mostPopular: true,
    ctaLabel: "Choose Professional",
    order: 2,
    selfServe: true,
    entitlements: { maxVenues: 1, maxTables: 80, maxStaffAccounts: 25, modules: GROWTH_MODULES },
  },
  {
    key: "pro",
    name: "Premium",
    tagline: "For multi-outlet restaurants",
    monthlyPrice: 5999,
    yearlyPrice: 59990,
    features: [
      "Everything in Professional", "Up to 5 branches", "Advanced roles & permissions",
      "Offers & promotions", "Advanced analytics", "Up to 100 staff accounts",
    ],
    mostPopular: false,
    ctaLabel: "Choose Premium",
    order: 3,
    selfServe: true,
    entitlements: { maxVenues: 5, maxTables: 300, maxStaffAccounts: 100, modules: GROWTH_MODULES },
  },
  {
    key: "enterprise",
    name: "Custom",
    tagline: "Custom plan for restaurant groups and chains",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Everything in Premium", "Unlimited branches", "Advanced roles & permissions",
      "Centralized management", "Advanced analytics", "Custom workflows", "Priority support",
      "Custom integrations",
    ],
    mostPopular: false,
    ctaLabel: "Talk to Sales",
    order: 4,
    selfServe: false, // priced per contract; assigned by the Dishky team
    entitlements: { maxVenues: null, maxTables: null, maxStaffAccounts: null, modules: GROWTH_MODULES },
  },
];

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
const PAST_DUE_GRACE_DAYS = Number(process.env.PAST_DUE_GRACE_DAYS || 7);

function definitionFor(planKey) {
  return PLAN_DEFINITIONS.find((p) => p.key === planKey) || null;
}

/** Plan rank for upgrade/downgrade decisions. */
function planRank(planKey) {
  const i = PLAN_DEFINITIONS.findIndex((p) => p.key === planKey);
  return i === -1 ? -1 : i;
}

/** Price in rupees for plan+cycle, or null if the plan is not self-serve. */
function priceFor(planKey, cycle) {
  const def = definitionFor(planKey);
  if (!def || !def.selfServe) return null;
  return cycle === "yearly" ? def.yearlyPrice : def.monthlyPrice;
}

module.exports = {
  PLAN_DEFINITIONS,
  TRIAL_DAYS,
  PAST_DUE_GRACE_DAYS,
  definitionFor,
  planRank,
  priceFor,
};
