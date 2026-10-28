/**
 * whatsapp.js — Dishky WhatsApp notifications (AiSensy)
 *
 * Replaces the old standalone `admin/server` mini-app (index.mjs +
 * routes/whatsapp.mjs + routes/campaign.mjs + aisensy.mjs), which ran as
 * its own unauthenticated Express process on port 5001 with open CORS
 * (`cors()` with no origin allow-list) and no rate limiting — anyone who
 * could reach it could fire arbitrary WhatsApp sends (and campaign
 * blasts to every phone number given) against Dishky's AiSensy
 * account/budget. It also logged the live AISENSY_API_KEY to stdout on
 * every send.
 *
 * That mini-server was in fact already orphaned in production: the
 * admin panel's `api.js` posts to `/api/campaign`, which Vercel's
 * rewrite sends to this main Render server, not to the port-5001
 * process — so `POST /campaign` was 404ing silently. Folding the same
 * functionality in here gives it, for free, this server's existing
 * session auth, permission checks, CORS allow-list, and can share the
 * same rate-limiting approach as the rest of the API.
 *
 * Mounted at /whatsapp in server.js:
 *   POST /whatsapp/order-status  — single templated message (order updates)
 *   POST /whatsapp/campaign      — bulk templated message to a list of users
 *
 * Both routes require an authenticated admin session (requireAuth) and
 * are rate-limited — campaign sends in particular can trigger a lot of
 * outbound messages and real cost per call, so it gets the stricter cap.
 */

const express = require("express");
const { buildLimiter } = require("../../core/rateLimitStore");
const { logAudit } = require("../auditLog/auditLog");

const router = express.Router();

const AISENSY_BASE_URL = "https://backend.aisensy.com/campaign/t1/api";

/**
 * sendTemplate — POSTs a single templated WhatsApp message via AiSensy.
 * Never logs the API key or the full request/response body (the old
 * aisensy.mjs logged the raw key on every call) — only a short,
 * secret-free summary on failure, for troubleshooting.
 */
async function sendTemplate({ phone, templateName, variables }) {
  const apiKey = process.env.AISENSY_API_KEY;
  if (!apiKey) {
    throw new Error("AISENSY_API_KEY is not configured on the server");
  }

  const response = await fetch(`${AISENSY_BASE_URL}/sendTemplateMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      campaignName: templateName,
      destination: phone,
      userName: process.env.AISENSY_USER_NAME || "Dishky",
      templateParams: variables || [],
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch (_) { /* ignore */ }
    throw new Error(`AiSensy send failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json().catch(() => ({}));
}

/* ─────────────────────────────────────────
   RATE LIMITING
   Both routes are gated behind requireAuth already, but a compromised
   or careless admin session (or a bug in a calling page) could still
   hammer these — each call costs real AiSensy send credits, and
   /campaign in particular can fan out to many recipients per request.
───────────────────────────────────────── */
const orderStatusLimiter = buildLimiter("whatsapp-order-status", {
  windowMs: 5 * 60 * 1000,
  max: 60, // generous — order-status notifications fire routinely during service
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many WhatsApp notifications sent. Please slow down." },
});

const campaignLimiter = buildLimiter("whatsapp-campaign", {
  windowMs: 60 * 60 * 1000,
  max: 5, // bulk campaign sends are rare and expensive — cap hard per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many campaign sends this hour. Please try again later." },
});

/**
 * buildRouter({ requireAuth }) — mirrors the module pattern used by
 * venues.js/permissions.js/etc. so this mounts the same way in server.js.
 */
function buildRouter({ requireAuth }) {
  // POST /whatsapp/order-status — single order-update notification.
  router.post("/order-status", requireAuth, orderStatusLimiter, async (req, res) => {
    try {
      const { phone, template, vars } = req.body || {};
      if (!phone || !template) {
        return res.status(400).json({ error: "Missing phone or template" });
      }

      await sendTemplate({ phone, templateName: template, variables: vars || [] });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /whatsapp/order-status failed:", err.message);
      res.status(500).json({ success: false, error: "WhatsApp send failed" });
    }
  });

  // POST /whatsapp/campaign — bulk promo send to a list of users.
  // Only Super Admin may trigger a blast to (potentially) every customer.
  router.post(
    "/campaign",
    requireAuth,
    campaignLimiter,
    async (req, res) => {
      try {
        if (!req.admin || req.admin.roleGroup !== "Super Admin") {
          logAudit(req, { action: "authz_denied", resource: "whatsapp-campaign", targetId: "send" });
          return res.status(403).json({ error: "Only Super Admin can send campaigns" });
        }

        const { users } = req.body || {};
        if (!Array.isArray(users) || users.length === 0) {
          return res.status(400).json({ error: "users array is required" });
        }
        // Hard cap per call regardless of what the client sends — keeps a
        // single request from fanning out into an unbounded number of
        // outbound sends even for an authorized Super Admin.
        const MAX_RECIPIENTS_PER_CALL = 500;
        if (users.length > MAX_RECIPIENTS_PER_CALL) {
          return res.status(400).json({
            error: `Too many recipients in one request (max ${MAX_RECIPIENTS_PER_CALL})`,
          });
        }

        const results = await Promise.allSettled(
          users
            .filter((u) => u && u.mobile)
            .map((u) =>
              sendTemplate({
                phone: `91${u.mobile}`,
                templateName: "promo_campaign",
                variables: [u.name || ""],
              })
            )
        );

        const failed = results.filter((r) => r.status === "rejected").length;
        res.json({ success: true, sent: results.length - failed, failed });
      } catch (err) {
        console.error("POST /whatsapp/campaign failed:", err.message);
        res.status(500).json({ success: false, error: "Campaign send failed" });
      }
    }
  );

  return router;
}

module.exports = { buildRouter, sendTemplate };
