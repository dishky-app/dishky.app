/**
 * gatewayCredentials.js — each restaurant's OWN Razorpay credentials for
 * collecting customers' UPI payments.
 *
 * In a multi-tenant product the money must land in the restaurant's account,
 * never Dishky's, so these are per-restaurant settings, stored encrypted
 * (AES-256-GCM, key from SETTINGS_ENCRYPTION_KEY). Platform-owned ("internal")
 * restaurants such as the original Dishky may fall back to the server's
 * RAZORPAY_* environment variables.
 *
 * Distinct from billing/razorpay.js, which is Dishky charging restaurant
 * owners for their subscription.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const { currentTenantId } = require("../../core/tenancy");

const schema = new mongoose.Schema(
  {
    id: { type: String, default: "singleton", unique: true },
    keyId: { type: String, default: "" },
    keySecretEnc: { type: String, default: "" },
    webhookSecretEnc: { type: String, default: "" },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);
const PaymentGateway = mongoose.models.PaymentGateway || mongoose.model("PaymentGateway", schema, "paymentGateway");

function encKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY || "";
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : crypto.createHash("sha256").update(raw).digest();
  return buf;
}
function encrypt(plain) {
  const key = encKey();
  if (!key) throw Object.assign(new Error("SETTINGS_ENCRYPTION_KEY is not configured on the server"), { status: 503 });
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}
function decrypt(blob) {
  if (!blob) return "";
  const key = encKey();
  if (!key) return "";
  const [v, iv, tag, data] = String(blob).split(".");
  if (v !== "v1") return "";
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** { keyId, keySecret, webhookSecret, source } for the CURRENT tenant, or null. */
async function getCredentials({ allowEnvFallback }) {
  if (!currentTenantId()) return null;
  const doc = await PaymentGateway.findOne({ id: "singleton" }).lean();
  if (doc && doc.keyId && doc.keySecretEnc) {
    try {
      return { keyId: doc.keyId, keySecret: decrypt(doc.keySecretEnc), webhookSecret: decrypt(doc.webhookSecretEnc), source: "restaurant" };
    } catch (e) {
      console.error("[gateway] could not decrypt stored credentials:", e.message);
      return null;
    }
  }
  if (allowEnvFallback && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    return {
      keyId: process.env.RAZORPAY_KEY_ID, keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "", source: "environment",
    };
  }
  return null;
}

const clients = new Map();
function clientFor(creds) {
  const k = `${creds.keyId}:${crypto.createHash("sha256").update(creds.keySecret).digest("hex").slice(0, 12)}`;
  if (!clients.has(k)) clients.set(k, new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret }));
  return clients.get(k);
}

async function saveCredentials({ keyId, keySecret, webhookSecret, adminId }) {
  const set = { keyId: String(keyId || "").trim(), updatedBy: adminId || null };
  if (!set.keyId) throw Object.assign(new Error("Key ID is required"), { status: 400 });
  const existing = await PaymentGateway.findOne({ id: "singleton" }).lean();
  if (keySecret) set.keySecretEnc = encrypt(keySecret);
  else if (!existing || !existing.keySecretEnc) throw Object.assign(new Error("Key secret is required"), { status: 400 });
  if (webhookSecret !== undefined && webhookSecret !== "") set.webhookSecretEnc = encrypt(webhookSecret);
  await PaymentGateway.findOneAndUpdate({ id: "singleton" }, { $set: set }, { upsert: true });
}

async function describe() {
  const doc = await PaymentGateway.findOne({ id: "singleton" }).lean();
  return {
    configured: !!(doc && doc.keyId && doc.keySecretEnc),
    keyId: doc ? doc.keyId : "",
    hasKeySecret: !!(doc && doc.keySecretEnc),
    hasWebhookSecret: !!(doc && doc.webhookSecretEnc),
  };
}

module.exports = { getCredentials, clientFor, saveCredentials, describe, PaymentGateway, encrypt, decrypt };
