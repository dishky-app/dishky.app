/**
 * models.js — platform-level (cross-tenant) collections.
 *
 * Everything here is declared `tenantScoped: false`: these documents describe
 * tenants themselves (restaurants, their owners, their subscriptions) so they
 * cannot live inside a tenant. Tenant data (menu, orders, staff...) is in the
 * main server modules and is isolated by tenancy.js.
 */
const mongoose = require("mongoose");
const crypto = require("crypto");

const opts = { versionKey: false, tenantScoped: false };

function rid(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

/* A person who buys Dishky. May own several restaurants. */
const ownerSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("own") },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    password: { type: String, required: true }, // bcrypt
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    lastLoginAt: { type: Date, default: null },
  },
  { ...opts, timestamps: true }
);

const ownerSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { ...opts, timestamps: true }
);
ownerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ownerResetSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  opts
);
ownerResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* A tenant. `id` is the value stamped on every tenant document as restaurantId. */
const restaurantSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("rest") },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    ownerId: { type: String, required: true, index: true },
    // active: normal. suspended: blocked by the Dishky team (non-payment, abuse...).
    // closed: owner closed the account (data retained for the retention window).
    status: { type: String, enum: ["active", "suspended", "closed"], default: "active" },
    branding: {
      logo: { type: String, default: "" },
      primaryColor: { type: String, default: "" },
      tagline: { type: String, default: "" },
    },
    contact: {
      phone: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    internal: { type: Boolean, default: false }, // comped / migrated accounts
  },
  { ...opts, timestamps: true }
);

const planSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: { type: String, default: "" },
    monthlyPrice: { type: Number, required: true, min: 0 },
    yearlyPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    features: { type: [String], default: [] },
    mostPopular: { type: Boolean, default: false },
    ctaLabel: { type: String, default: "Get Started" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    selfServe: { type: Boolean, default: true },
    providerPlanIds: { type: Map, of: String, default: {} }, // "razorpay:monthly" -> plan_xxx
  },
  { ...opts, timestamps: true }
);

const SUB_STATUSES = [
  "trialing",    // free trial running
  "incomplete",  // checkout started, first payment not confirmed
  "active",      // paid and current
  "past_due",    // renewal payment failed; grace period running
  "cancelled",   // cancelled; access continues until currentPeriodEnd
  "expired",     // trial / paid period ended with no payment
  "suspended",   // blocked by the Dishky team
];

const subscriptionSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("sub") },
    restaurantId: { type: String, required: true, unique: true }, // one live subscription per restaurant
    ownerId: { type: String, required: true, index: true },
    planKey: { type: String, required: true },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    status: { type: String, enum: SUB_STATUSES, default: "trialing" },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    graceEndsAt: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    // A scheduled downgrade / cycle change: applied when the current period ends.
    pendingChange: {
      planKey: { type: String, default: null },
      billingCycle: { type: String, default: null },
      effectiveAt: { type: Date, default: null },
    },
    // A payment the owner has started but not yet completed (first purchase / upgrade).
    pendingCheckout: {
      providerSubscriptionId: { type: String, default: null },
      planKey: { type: String, default: null },
      billingCycle: { type: String, default: null },
      amount: { type: Number, default: null },
      createdAt: { type: Date, default: null },
    },
    provider: { type: String, default: "mock" }, // mock | razorpay | internal
    providerSubscriptionId: { type: String, default: null, index: true },
    comped: { type: Boolean, default: false },
  },
  { ...opts, timestamps: true }
);
// restaurantId is unique here on purpose (platform-level, so plugin doesn't touch it).

const invoiceSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("inv") },
    restaurantId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    subscriptionId: { type: String, required: true },
    planKey: { type: String, required: true },
    billingCycle: { type: String, required: true },
    amount: { type: Number, required: true }, // rupees
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["paid", "failed", "refunded"], required: true },
    provider: { type: String, default: "mock" },
    providerPaymentId: { type: String, default: null, index: true },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { ...opts, timestamps: true }
);

// Webhook idempotency: each provider event id is processed exactly once.
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    type: { type: String, default: "" },
    processedAt: { type: Date, default: Date.now },
  },
  opts
);
webhookEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

// One-time "Open my dashboard" tokens (owner session on dishky.com -> admin panel).
const ssoTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    restaurantId: { type: String, required: true },
    ownerId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  opts
);
ssoTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["new", "read", "replied"], default: "new" },
  },
  { ...opts, timestamps: true }
);

const demoRequestSchema = new mongoose.Schema(
  {
    restaurantName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    city: { type: String, trim: true },
    restaurantType: { type: String, trim: true },
    numberOfOutlets: { type: Number, min: 1, default: 1 },
    currentSoftware: { type: String, trim: true },
    message: { type: String, trim: true },
    status: { type: String, enum: ["new", "contacted", "scheduled", "closed"], default: "new" },
  },
  { ...opts, timestamps: true }
);

const newsletterSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed" },
    subscribedAt: { type: Date, default: Date.now },
  },
  { ...opts, timestamps: true }
);

/* Dishky's own staff who may use the super-admin console. Created only by
   scripts/create-platform-admin.js — there is no public sign-up. */
const platformAdminSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("pa") },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // bcrypt
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    photo: { type: String, default: "" }, // small data-URL picture picked in the console, or an https URL
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "" },
  },
  { ...opts, timestamps: true }
);

const platformAdminSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true }, // sha256 of the cookie value
    adminId: { type: String, required: true, index: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { ...opts, timestamps: true }
);
platformAdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const platformAdminLogSchema = new mongoose.Schema(
  {
    adminId: { type: String, default: null },
    email: { type: String, default: "" },
    event: { type: String, required: true }, // login_ok | login_failed | locked | logout | password_changed | profile_updated
    ip: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  opts
);
platformAdminLogSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const m = (name, schema, coll) => mongoose.models[name] || mongoose.model(name, schema, coll);

module.exports = {
  rid,
  SUB_STATUSES,
  Owner: m("Owner", ownerSchema, "platformOwners"),
  OwnerReset: m("OwnerReset", ownerResetSchema, "platformOwnerResets"),
  OwnerSession: m("OwnerSession", ownerSessionSchema, "platformOwnerSessions"),
  Restaurant: m("Restaurant", restaurantSchema, "restaurants"),
  Plan: m("Plan", planSchema, "plans"),
  Subscription: m("Subscription", subscriptionSchema, "subscriptions"),
  Invoice: m("Invoice", invoiceSchema, "platformInvoices"),
  WebhookEvent: m("WebhookEvent", webhookEventSchema, "platformWebhookEvents"),
  SsoToken: m("SsoToken", ssoTokenSchema, "platformSsoTokens"),
  Contact: m("Contact", contactSchema, "contacts"),
  DemoRequest: m("DemoRequest", demoRequestSchema, "demoRequests"),
  Newsletter: m("Newsletter", newsletterSchema, "newsletters"),
  PlatformAdmin: m("PlatformAdmin", platformAdminSchema, "platformAdmins"),
  PlatformAdminSession: m("PlatformAdminSession", platformAdminSessionSchema, "platformAdminSessions"),
  PlatformAdminLog: m("PlatformAdminLog", platformAdminLogSchema, "platformAdminLogs"),
};
