/**
 * attender.js — attender (waiter) accounts for the user panel.
 *
 * An attender signs in with mobile number + password, then takes orders on
 * behalf of one or more tables. Orders placed while an attender session is
 * active are stamped server-side with the attender's id/name (see
 * attenderFromRequest(), used by POST /orders in server.js), so the name can
 * never be forged by a guest and always reaches the KOT and the receipt.
 *
 * Mounted at /attender (after the tenant middleware, so every query below is
 * automatically scoped to the current restaurant by tenancy.js):
 *   POST /attender/signup           { name, mobile, password }
 *   POST /attender/login            { mobile, password }
 *   GET  /attender/me
 *   POST /attender/logout
 *   POST /attender/forgot-password  { mobile }                 -> sends a 6-digit code on WhatsApp
 *   POST /attender/reset-password   { mobile, otp, newPassword }
 *
 * Own cookie (dishkyid_att_<restaurantId>) and own session collection, so an
 * attender session never mixes with a customer session or a staff session.
 */
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { currentTenantId } = require("../../core/tenancy");
const { buildLimiter } = require("../../core/rateLimitStore");
const { safeErrorMessage } = require("../../core/validation");

/* ───────────── models (tenant-scoped by the global plugin) ───────────── */
const attenderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // bcrypt hash
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { versionKey: false }
);
const Attender = mongoose.model("Attender", attenderSchema, "attenders");

const attenderSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    attenderId: { type: String, required: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
attenderSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const AttenderSession = mongoose.model("AttenderSession", attenderSessionSchema, "attenderSessions");

const attenderResetSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
attenderResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const AttenderReset = mongoose.model("AttenderReset", attenderResetSchema, "attenderResets");

/* ───────────── constants / helpers ───────────── */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // a shift; sliding, extended on every authenticated call
const RESET_TTL_MS = 10 * 60 * 1000;
const RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10); // equalises timing for unknown mobiles

const authLimiter = buildLimiter("attender-auth", {
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
  skipSuccessfulRequests: true,
});
const forgotLimiter = buildLimiter("attender-forgot", {
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests. Please try again later." },
});

const resetLimiter = buildLimiter("attender-reset", {
  windowMs: 15 * 60 * 1000,
  max: 15, // each code also has its own 5-attempt cap
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function cookieName() {
  const id = currentTenantId();
  if (!id) throw new Error("attender session requires a restaurant");
  return `dishkyid_att_${id}`;
}
function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: isProd, sameSite: isProd ? "none" : "lax", maxAge: SESSION_TTL_MS, path: "/" };
}

const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim();
const cleanMobile = (v) => String(v || "").replace(/\D/g, "");
const publicAttender = (a) => ({ id: a.id, name: a.name, mobile: a.mobile });

function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 6) return "Password must be at least 6 characters.";
  if (Buffer.byteLength(pw, "utf8") > 72) return "Password is too long (max 72 characters).";
  return null;
}

async function startSession(attenderId, req, res) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  await AttenderSession.create({
    sessionId,
    attenderId,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    ip: req.ip,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(cookieName(), sessionId, cookieOpts());
}

/**
 * attenderFromRequest(req) — the attender behind this request's session
 * cookie, or null. Never throws (a broken lookup just means "not an attender").
 */
async function attenderFromRequest(req) {
  try {
    const sessionId = req.cookies ? req.cookies[cookieName()] : null;
    if (!sessionId) return null;
    const session = await AttenderSession.findOne({ sessionId }).lean();
    if (!session || session.expiresAt < new Date()) return null;
    const attender = await Attender.findOne({ id: session.attenderId }).lean();
    if (!attender) return null;
    AttenderSession.updateOne(
      { sessionId },
      { $set: { lastActive: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) } }
    ).catch(() => { });
    return { ...publicAttender(attender), sessionId };
  } catch {
    return null;
  }
}

async function requireAttenderAuth(req, res, next) {
  const attender = await attenderFromRequest(req);
  if (!attender) {
    try { res.clearCookie(cookieName(), cookieOpts()); } catch { /* no tenant */ }
    return res.status(401).json({ error: "Not logged in" });
  }
  req.attender = attender;
  next();
}

/* ───────────── password-reset code delivery (WhatsApp via AiSensy) ───────────── */
function resetCodeHash(mobile, code) {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || "dishky-attender-reset";
  return crypto.createHash("sha256").update(`${mobile}:${code}:${secret}`).digest("hex");
}

/** Returns true when the code was handed to the WhatsApp provider. */
async function sendResetCode(mobile, code) {
  const apiKey = process.env.AISENSY_API_KEY;
  const template = process.env.AISENSY_ATTENDER_OTP_TEMPLATE;
  if (!apiKey || !template) return false;
  const response = await fetch("https://backend.aisensy.com/campaign/t1/api/sendTemplateMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      campaignName: template,
      destination: `91${mobile}`,
      userName: process.env.AISENSY_USER_NAME || "Dishky",
      templateParams: [code],
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status})`);
  return true;
}

/* ───────────── router ───────────── */
function buildRouter() {
  const router = express.Router();

  router.post("/signup", authLimiter, async (req, res) => {
    try {
      const name = cleanName(req.body && req.body.name);
      const mobile = cleanMobile(req.body && req.body.mobile);
      const password = req.body && req.body.password;

      if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Enter a valid name (2–60 characters)." });
      if (mobile.length !== 10) return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });
      const pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });

      if (await Attender.exists({ mobile })) {
        return res.status(409).json({ error: "An attender account already exists with this mobile number." });
      }

      const attender = await Attender.create({
        id: `att_${crypto.randomBytes(6).toString("hex")}`,
        name,
        mobile,
        password: await bcrypt.hash(password, 10),
        lastLoginAt: new Date(),
      });
      await startSession(attender.id, req, res);
      res.status(201).json({ attender: publicAttender(attender) });
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ error: "An attender account already exists with this mobile number." });
      console.error("POST /attender/signup", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  router.post("/login", authLimiter, async (req, res) => {
    try {
      const mobile = cleanMobile(req.body && req.body.mobile);
      const password = String((req.body && req.body.password) || "");
      if (mobile.length !== 10 || !password) return res.status(400).json({ error: "Mobile number and password are required." });

      const attender = await Attender.findOne({ mobile }).lean();
      const valid = await bcrypt.compare(password, attender ? attender.password : DUMMY_HASH);
      if (!attender || !valid) return res.status(401).json({ error: "Invalid mobile number or password." });

      await Attender.updateOne({ id: attender.id }, { $set: { lastLoginAt: new Date() } });
      await startSession(attender.id, req, res);
      res.json({ attender: publicAttender(attender) });
    } catch (err) {
      console.error("POST /attender/login", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  router.get("/me", requireAttenderAuth, (req, res) => {
    const { id, name, mobile } = req.attender;
    res.json({ attender: { id, name, mobile } });
  });

  router.post("/logout", async (req, res) => {
    try {
      const sessionId = req.cookies ? req.cookies[cookieName()] : null;
      if (sessionId) await AttenderSession.deleteOne({ sessionId });
      res.clearCookie(cookieName(), cookieOpts());
      res.json({ success: true });
    } catch (err) {
      console.error("POST /attender/logout", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // Always answers the same way whether or not the number has an account, so it
  // can't be used to find out which mobile numbers are registered.
  router.post("/forgot-password", forgotLimiter, async (req, res) => {
    try {
      const mobile = cleanMobile(req.body && req.body.mobile);
      if (mobile.length !== 10) return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });

      const generic = { ok: true, message: "If an account exists for this number, a 6-digit code has been sent on WhatsApp." };
      const attender = await Attender.findOne({ mobile }).lean();
      if (!attender) return res.json(generic);

      const existing = await AttenderReset.findOne({ mobile }).lean();
      if (existing && Date.now() - new Date(existing.createdAt).getTime() < RESET_RESEND_COOLDOWN_MS) {
        return res.json(generic); // a code was just sent — don't spam WhatsApp
      }

      const code = String(crypto.randomInt(100000, 1000000));
      const isProd = process.env.NODE_ENV === "production";
      let sent = false;
      try {
        sent = await sendResetCode(mobile, code);
      } catch (sendErr) {
        console.error("attender reset code delivery failed:", sendErr.message);
      }
      if (!sent && isProd) {
        return res.status(503).json({ error: "Password reset isn't available right now. Please ask your manager to help." });
      }

      await AttenderReset.findOneAndUpdate(
        { mobile },
        { $set: { mobile, codeHash: resetCodeHash(mobile, code), attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + RESET_TTL_MS) } },
        { upsert: true }
      );

      if (!sent) {
        // Development only: no WhatsApp template configured, so surface the code locally.
        console.log(`[attender] DEV reset code for ${mobile}: ${code}`);
        return res.json({ ...generic, devCode: code });
      }
      res.json(generic);
    } catch (err) {
      console.error("POST /attender/forgot-password", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  router.post("/reset-password", resetLimiter, async (req, res) => {
    try {
      const mobile = cleanMobile(req.body && req.body.mobile);
      const otp = String((req.body && req.body.otp) || "").replace(/\D/g, "");
      const newPassword = req.body && req.body.newPassword;
      const bad = { error: "That code is incorrect or has expired." };

      if (mobile.length !== 10 || otp.length !== 6) return res.status(400).json(bad);
      const pwErr = validatePassword(newPassword);
      if (pwErr) return res.status(400).json({ error: pwErr });

      const reset = await AttenderReset.findOne({ mobile }).lean();
      if (!reset || reset.expiresAt < new Date() || reset.attempts >= RESET_MAX_ATTEMPTS) {
        if (reset) await AttenderReset.deleteOne({ mobile });
        return res.status(400).json(bad);
      }

      const expected = Buffer.from(reset.codeHash, "hex");
      const given = Buffer.from(resetCodeHash(mobile, otp), "hex");
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        await AttenderReset.updateOne({ mobile }, { $inc: { attempts: 1 } });
        return res.status(400).json(bad);
      }

      const attender = await Attender.findOne({ mobile }).lean();
      if (!attender) return res.status(400).json(bad);

      await Attender.updateOne({ id: attender.id }, { $set: { password: await bcrypt.hash(newPassword, 10) } });
      await AttenderReset.deleteOne({ mobile });
      await AttenderSession.deleteMany({ attenderId: attender.id }); // sign out every device
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /attender/reset-password", err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  return router;
}

module.exports = { buildRouter, attenderFromRequest };
