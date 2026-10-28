/**
 * payments.js — Dishky Razorpay UPI QR Payment System
 *
 * Generates a real, gateway-verified UPI QR for a restaurant order/bill
 * using Razorpay's QR Code API (POST /v1/qr_codes, type: "upi_qr"), and
 * verifies payment via Razorpay's webhook — NOT a manual "Mark as Paid"
 * click. This replaces the earlier plain `upi://pay?...` deep-link
 * design (see CHANGELOG / git history for that version's rationale),
 * now that the store wants gateway-verified payment instead of a
 * human checking their own UPI app before confirming.
 *
 * HOW A PAYMENT IS VERIFIED NOW
 * ------------------------------
 * 1. POST /payments/orders creates a Razorpay QR code (single_use,
 *    fixed_amount) for the exact bill amount and stores a local
 *    Payment record (PENDING) referencing it.
 * 2. The admin panel displays qrCode.image_url (a real Razorpay-hosted
 *    QR image) in the order preview modal, and encodes
 *    qrCode.image_content (the underlying upi://pay?... string) into
 *    the printed receipt's QR — the thermal printer bridge just draws
 *    a QR from a string either way, so it needs no changes.
 * 3. The customer scans and pays with any UPI app.
 * 4. Razorpay POSTs a `qr_code.credited` webhook to
 *    POST /payments/webhook the moment the payment is captured. This
 *    route verifies the HMAC-SHA256 signature (X-Razorpay-Signature)
 *    against the RAW request body before trusting anything in it, then
 *    marks the matching Payment record PAID and the linked order's
 *    paymentStatus "completed" — no admin click required.
 * 5. If Razorpay instead reports the payment failed (`payment.failed`)
 *    or the QR closes without being paid, the Payment record is marked
 *    FAILED with whatever reason Razorpay gives (bank decline, user
 *    cancelled, etc.), so staff can see why and get the customer to
 *    retry rather than stare at a QR that silently stopped working.
 *
 * WHY THE WEBHOOK ROUTE HAS NO requireAuth
 * ------------------------------------------
 * Razorpay's servers call this route directly — there is no admin
 * session, cookie, or bearer token to check. Trust instead comes
 * entirely from the HMAC signature check (constant-time compare,
 * computed over the untouched raw body — see server.js's express.json
 * `verify` hook for where req.rawBody is captured). A request with a
 * missing or invalid signature is rejected before any DB write happens.
 *
 * IDEMPOTENCY
 * ------------
 * Razorpay retries webhooks on a backoff schedule if it doesn't get a
 * 200 back quickly, and the same event can genuinely arrive twice.
 * Every state-changing branch below re-checks the record's current
 * status first and no-ops (still returns 200) if it's already in the
 * target state, so a duplicate delivery can never double-fire
 * markOrderPaid, double-log an audit entry, or clobber a later status
 * with a stale retried one.
 */

const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const { validateWebhookSignature } = require("razorpay/dist/utils/razorpay-utils");
const { BankAccount } = require("./bankAccount");
const { asPlainString, safeErrorMessage } = require("../../core/validation");

/* ─────────────────────────────────────────
   RAZORPAY CLIENT
───────────────────────────────────────── */
// Credentials are PER RESTAURANT (gatewayCredentials.js): customers' money must
// settle in the restaurant's own Razorpay account. Platform-owned ("internal")
// restaurants may fall back to the server's RAZORPAY_* env vars.
const gateway = require("./gatewayCredentials");
const { restaurantBySlug } = require("../platform/tenantResolver");
const { runInTenant, currentTenantId } = require("../../core/tenancy");

async function getRazorpayClient(req) {
  const internal = !!(req && req.tenant && req.tenant.restaurant && req.tenant.restaurant.internal);
  const creds = await gateway.getCredentials({ allowEnvFallback: internal });
  return creds ? gateway.clientFor(creds) : null;
}

/* ─────────────────────────────────────────
   SCHEMA — one doc per Razorpay QR generated for a bill
───────────────────────────────────────── */
const paymentSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true }, // our own generated id, see newPaymentId()
    orderId: { type: String, required: true, index: true }, // restaurant order's id — every route below checks this
    billNo: { type: Number, default: null }, // for split bills, which bill this covers
    amount: { type: Number, required: true }, // exact amount the QR was created for — never re-derived later
    currency: { type: String, default: "INR" },

    // Razorpay-side identifiers
    razorpayQrId: { type: String, required: true, index: true }, // qr_... (QR Codes API) or plink_... (payment-link fallback) — what the webhook is matched against
    source: { type: String, enum: ["qr", "link"], default: "qr" }, // which Razorpay product produced this record
    qrImageUrl: { type: String, default: "" }, // hosted QR image to display on-screen; empty for "link" records (the panel draws the QR from qrImageContent)
    qrImageContent: { type: String, required: true }, // upi://pay?... string (or payment-link URL) — what the QR encodes on screen and on the printer
    razorpayPaymentId: { type: String, default: null }, // pay_... — set once the webhook reports a captured payment
    method: { type: String, default: null }, // e.g. "upi" — from the webhook's payment entity
    vpa: { type: String, default: null }, // payer's VPA, from the webhook's payment entity (informational only)

    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING",
    },
    failureReason: { type: String, default: null }, // set when status is FAILED — Razorpay's own description, or a bank/user-side note
    confirmedAt: { type: Date, default: null }, // when the webhook marked this PAID
    venueId: { type: String, default: null },
    createdBy: { type: String, default: null }, // admin who opened the bill/generated the QR
  },
  { timestamps: true, versionKey: false }
);

const Payment = mongoose.model("Payment", paymentSchema, "payments");

function newPaymentId(orderId) {
  return `pay_${orderId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safePayment(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

/**
 * Marks the linked restaurant order's paymentStatus. Best-effort: a
 * failure here never blocks the webhook/confirm response itself, since
 * the Payment doc (the source of truth for status) is already saved by
 * the time this runs.
 */
async function setOrderPaymentStatus(getModel, emitChange, orderId, paymentStatus) {
  if (!getModel || !orderId) return;
  try {
    const OrderModel = getModel("orders");
    const updated = await OrderModel.findOneAndUpdate(
      { id: orderId },
      { $set: { paymentStatus } },
      { new: true }
    ).lean();
    if (updated) {
      delete updated._id;
      emitChange && emitChange("orders", "updated", updated);
    }
  } catch (err) {
    console.warn(`Could not set order paymentStatus="${paymentStatus}" for order`, orderId, err.message);
  }
}

/* ─────────────────────────────────────────
   ROUTES. Mounted at /payments.
───────────────────────────────────────── */
function buildRouter({ requireAuth, requirePerm, logAudit, emitChange, getModel, expireCustomerSessionsForOrder }) {
  const express = require("express");
  const router = express.Router();

  // Cashier-facing QR routes (create / poll a bill's QR) follow the Orders
  // permission — anyone who can open a bill must be able to show its QR.
  // The Payments admin screen (list / detail) follows its own "payments"
  // module. Falls back to plain auth if no permission helper is supplied.
  const ordersRead = requirePerm ? [requireAuth, requirePerm("orders", "read")] : [requireAuth];
  const paymentsRead = requirePerm ? [requireAuth, requirePerm("payments", "read")] : [requireAuth];

  function venueFilterFor(req) {
    if (req.admin?.roleGroup === "Super Admin") {
      const venueId = asPlainString(req.query.venueId);
      return venueId ? { venueId } : {};
    }
    return { venueId: req.admin?.venueId || null };
  }

  async function resolveOrderVenue(orderId) {
    if (!getModel || !orderId) return null;
    try {
      const order = await getModel("orders").findOne({ id: orderId }).select("venueId").lean();
      return order ? order.venueId || null : null;
    } catch (_) {
      return null;
    }
  }

  function canAccessVenue(req, venueId) {
    if (req.admin?.roleGroup === "Super Admin") return true;
    return !!venueId && venueId === req.admin?.venueId;
  }

  // POST /payments/orders — generate a Razorpay UPI QR for a bill
  router.post("/orders", ...ordersRead, async (req, res) => {
    try {
      const razorpay = await getRazorpayClient(req);
      if (!razorpay) {
        return res.status(503).json({
          error: "UPI payments are not set up yet. A Super Admin can add the restaurant's Razorpay keys under Payments settings.",
          code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
        });
      }

      const { orderId, amount, billNo } = req.body;
      if (!orderId || !(Number(amount) > 0)) {
        return res.status(400).json({ error: "orderId and a positive amount are required" });
      }

      const orderVenueId = await resolveOrderVenue(orderId);
      if (!canAccessVenue(req, orderVenueId)) {
        return res.status(404).json({ error: "Order not found" });
      }

      // The order must exist and must not already be settled — otherwise a
      // second QR for a paid bill (or for a mistyped/nonexistent order id,
      // which Super Admin could previously create) invites a double payment.
      const orderDoc = await getModel("orders").findOne({ id: orderId }).select("paymentStatus").lean();
      if (!orderDoc) return res.status(404).json({ error: "Order not found" });
      const alreadyPaid = await Payment.findOne({
        orderId,
        billNo: billNo ?? null,
        status: "PAID",
      }).lean();
      const orderSettled = String(orderDoc.paymentStatus || "").toLowerCase() === "completed";
      // Split bills share one order, and the order flips to "completed" as soon as
      // the first bill is paid — so the order-level flag only blocks unsplit bills.
      if (alreadyPaid || (orderSettled && (billNo === undefined || billNo === null))) {
        return res.status(409).json({ error: "This bill has already been paid" });
      }

      const bankAccount = await BankAccount.findOne({ id: "singleton" }).lean();
      const payeeName = (bankAccount?.accountHolderName || req.tenant?.restaurant?.name || "Restaurant").slice(0, 40);

      const paymentId = newPaymentId(orderId);
      const roundedAmount = Math.round(Number(amount) * 100) / 100;
      const amountPaise = Math.round(roundedAmount * 100);

      // Razorpay requires close_by to be at least 15 minutes out; give
      // a bill a generous 2-hour window to be paid before the QR
      // auto-closes, since a table can sit on an open bill a while.
      const closeBy = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

      const notes = {
        orderId,
        billNo: billNo != null ? String(billNo) : "",
        paymentId, // our own id, so the webhook handler can find this record even if it only has the qr_code/payment_link id to go on
        payeeName,
      };

      let source = "qr";
      let razorpayRefId;
      let qrImageUrl = "";
      let qrImageContent;

      try {
        const qrCode = await razorpay.qrCode.create({
          type: "upi_qr",
          name: `Order ${orderId}${billNo ? ` Bill ${billNo}` : ""}`,
          usage: "single_use",
          fixed_amount: true,
          payment_amount: amountPaise,
          description: `${req.tenant?.restaurant?.name || "Restaurant"} — Order ${orderId}`,
          close_by: closeBy,
          notes,
        });
        razorpayRefId = qrCode.id;
        qrImageUrl = qrCode.image_url;
        qrImageContent = qrCode.image_content;
      } catch (qrErr) {
        // Razorpay answers "The requested URL was not found on the server."
        // (HTTP 404 BAD_REQUEST_ERROR) when the QR Codes product is not
        // enabled for the account / mode. Fall back to a UPI payment link,
        // which every account has and which is webhook-verified the same way.
        const status = qrErr?.statusCode || qrErr?.status;
        const desc = String(qrErr?.error?.description || qrErr?.message || "");
        const featureUnavailable = status === 404 || /not found on the server|not enabled|not available/i.test(desc);
        if (!featureUnavailable) throw qrErr;
        console.warn("Razorpay QR Codes unavailable, falling back to payment link:", desc);

        const linkPayload = {
          amount: amountPaise,
          currency: "INR",
          accept_partial: false,
          reference_id: paymentId.slice(0, 40),
          description: `${req.tenant?.restaurant?.name || "Restaurant"} — Order ${orderId}${billNo ? ` Bill ${billNo}` : ""}`,
          expire_by: closeBy,
          notes,
        };
        let link;
        try {
          link = await razorpay.paymentLink.create({ ...linkPayload, upi_link: true });
        } catch (upiLinkErr) {
          link = await razorpay.paymentLink.create(linkPayload);
        }
        source = "link";
        razorpayRefId = link.id;
        qrImageContent = link.short_url;
      }

      const doc = await Payment.create({
        id: paymentId,
        orderId,
        billNo: billNo ?? null,
        amount: roundedAmount,
        razorpayQrId: razorpayRefId,
        source,
        qrImageUrl,
        qrImageContent,
        status: "PENDING",
        venueId: orderVenueId,
        createdBy: req.admin?.id || null,
      });

      const result = safePayment(doc);
      await logAudit(req, { action: "create", resource: "payments", targetId: paymentId, after: result });
      res.status(201).json(result);
    } catch (err) {
      console.error("POST /payments/orders", err?.error || err);
      const rzpMessage = err?.error?.description;
      res.status(500).json({ error: rzpMessage || safeErrorMessage(err) });
    }
  });

  // GET /payments/orders/:id — fetch a single payment record's current status
  router.get("/orders/:id", ...ordersRead, async (req, res) => {
    try {
      const local = await Payment.findOne({ id: req.params.id }).lean();
      if (!local) return res.status(404).json({ error: "Payment record not found" });
      if (!canAccessVenue(req, local.venueId)) {
        return res.status(404).json({ error: "Payment record not found" });
      }
      res.json(safePayment(local));
    } catch (err) {
      console.error("GET /payments/orders/:id", err);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /payments/orders?orderId= — payment record(s) for a restaurant order
  router.get("/orders", ...ordersRead, async (req, res) => {
    try {
      const filter = { ...venueFilterFor(req) };
      const orderId = asPlainString(req.query.orderId);
      if (orderId) filter.orderId = orderId;
      const docs = await Payment.find(filter).sort({ createdAt: -1 }).limit(50).lean();
      res.json(docs.map(safePayment));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /payments — list payment records for the Payments admin page.
  // Supports the same kind of filters as memos.js: date range, status,
  // and a loose search over orderId/razorpay ids.
  /* ── Payment gateway settings (this restaurant's own Razorpay account) ── */
  const superAdminOnly = (req, res, next) => {
    if (!req.admin || req.admin.roleGroup !== "Super Admin") return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };

  router.get("/gateway", requireAuth, superAdminOnly, async (req, res) => {
    try {
      const d = await gateway.describe();
      const slug = req.tenant ? req.tenant.restaurant.slug : null;
      const site = (process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
      res.json({ ...d, webhookPath: slug ? `/payments/webhook/${slug}` : null, webhookUrl: slug && site ? `${site}/payments/webhook/${slug}` : null });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  router.put("/gateway", requireAuth, superAdminOnly, async (req, res) => {
    try {
      const { keyId, keySecret, webhookSecret } = req.body || {};
      await gateway.saveCredentials({ keyId, keySecret, webhookSecret, adminId: req.admin.id });
      logAudit && logAudit(req, { action: "update", resource: "paymentGateway", targetId: "gateway", after: { keyId } });
      res.json(await gateway.describe());
    } catch (err) {
      res.status(err.status || 500).json({ error: err.status ? err.message : safeErrorMessage(err) });
    }
  });

  router.get("/", ...paymentsRead, async (req, res) => {
    try {
      const filter = { ...venueFilterFor(req) };

      const status = asPlainString(req.query.status);
      if (status) filter.status = status;

      const fromDate = asPlainString(req.query.fromDate);
      const toDate = asPlainString(req.query.toDate);
      if (fromDate || toDate) {
        filter.createdAt = {};
        if (fromDate) filter.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
        if (toDate) filter.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
      }

      const search = asPlainString(req.query.search);
      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [
          { orderId: re },
          { id: re },
          { razorpayQrId: re },
          { razorpayPaymentId: re },
        ];
      }

      const docs = await Payment.find(filter).sort({ createdAt: -1 }).limit(500).lean();
      res.json(docs.map(safePayment));
    } catch (err) {
      console.error("GET /payments", err);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /payments/:id — single payment record, for the Payment Details page
  router.get("/:id", ...paymentsRead, async (req, res) => {
    try {
      const local = await Payment.findOne({ id: req.params.id }).lean();
      if (!local) return res.status(404).json({ error: "Payment record not found" });
      if (!canAccessVenue(req, local.venueId)) {
        return res.status(404).json({ error: "Payment record not found" });
      }
      res.json(safePayment(local));
    } catch (err) {
      console.error("GET /payments/:id", err);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /**
   * POST /payments/webhook — Razorpay calls this directly. No
   * requireAuth: see file-level comment for why trust here comes from
   * the HMAC signature, not a session.
   */
  async function webhookHandler(req, res) {
    try {
      const signature = req.headers["x-razorpay-signature"];
      // Which restaurant is this for? Each restaurant registers its own webhook URL
      // in its Razorpay dashboard: /payments/webhook/<restaurant-url-name>.
      // The bare /payments/webhook belongs to LEGACY_WEBHOOK_RESTAURANT (the
      // original single-restaurant install), if configured.
      const slug = String(req.params.slug || process.env.LEGACY_WEBHOOK_RESTAURANT || "").toLowerCase();
      const restaurant = slug ? await restaurantBySlug(slug) : null;
      if (!restaurant || restaurant.status !== "active") {
        console.warn("Razorpay webhook rejected: unknown restaurant");
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
      return await runInTenant(restaurant.id, async () => {
        const creds = await gateway.getCredentials({ allowEnvFallback: !!restaurant.internal });
        const RAZORPAY_WEBHOOK_SECRET = creds ? creds.webhookSecret : "";
        if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
          console.warn("Razorpay webhook rejected: missing signature or webhook secret not configured");
          return res.status(400).json({ error: "Invalid webhook signature" });
        }

        // MUST be the raw bytes Razorpay actually signed — req.rawBody is
        // captured by the express.json() verify hook in server.js
        // specifically for this route. Re-serializing req.body here would
        // silently break verification for genuine, unmodified webhooks
        // (different key order/whitespace than what Razorpay hashed).
        const rawBody = req.rawBody;
        if (!rawBody) {
          console.error("Razorpay webhook rejected: raw body was not captured — check server.js's express.json verify hook");
          return res.status(400).json({ error: "Invalid webhook signature" });
        }

        const isValid = validateWebhookSignature(rawBody.toString(), signature, RAZORPAY_WEBHOOK_SECRET);
        if (!isValid) {
          console.warn("Razorpay webhook rejected: signature mismatch");
          return res.status(400).json({ error: "Invalid webhook signature" });
        }

        const { event, payload } = req.body || {};

        if (event === "qr_code.credited" || event === "payment_link.paid") {
          await handleQrCredited(payload, { emitChange, getModel, logAudit, req });
        } else if (event === "payment.failed") {
          await handlePaymentFailed(payload, { emitChange, getModel, logAudit, req });
        } else if (event === "qr_code.closed" || event === "payment_link.expired" || event === "payment_link.cancelled") {
          await handleQrClosed(payload, { emitChange, getModel, logAudit, req });
        }
        // Any other event: acknowledge and ignore — Razorpay will retry
        // on non-200, so unhandled-but-harmless events must still 200.

        res.status(200).json({ ok: true });
      });
    } catch (err) {
      console.error("POST /payments/webhook", err);
      // Still 200: an internal error on our side shouldn't make
      // Razorpay hammer retries for an event we may have already
      // partially processed. The idempotency guards in each handler
      // make a safe re-delivery (via Razorpay's own retry schedule, if
      // this response had failed) a no-op rather than a duplicate.
      res.status(200).json({ ok: false });
    }
  }
  router.post("/webhook", webhookHandler);
  router.post("/webhook/:slug", webhookHandler);

  async function findPaymentForWebhook(payload) {
    const qrId = payload?.qr_code?.entity?.id || payload?.payment_link?.entity?.id;
    const paymentIdFromNotes =
      payload?.payment?.entity?.notes?.paymentId || payload?.payment_link?.entity?.notes?.paymentId;
    if (paymentIdFromNotes) {
      const byNote = await Payment.findOne({ id: paymentIdFromNotes });
      if (byNote) return byNote;
    }
    if (qrId) {
      const byQr = await Payment.findOne({ razorpayQrId: qrId });
      if (byQr) return byQr;
    }
    return null;
  }

  async function handleQrCredited(payload, { emitChange, getModel, logAudit }) {
    const local = await findPaymentForWebhook(payload);
    if (!local) {
      console.warn("credited webhook: no matching Payment record for", payload?.qr_code?.entity?.id || payload?.payment_link?.entity?.id);
      return;
    }

    // Idempotency: a duplicate/retried delivery of the same event must
    // never re-fire markOrderPaid or overwrite an already-set
    // confirmedAt/razorpayPaymentId with a later retry's values.
    if (local.status === "PAID") return;

    const paymentEntity = payload?.payment?.entity || {};
    local.status = "PAID";
    local.razorpayPaymentId = paymentEntity.id || null;
    local.method = paymentEntity.method || "upi";
    local.vpa = paymentEntity.vpa || null;
    local.failureReason = null;
    local.confirmedAt = new Date();
    await local.save();

    const result = safePayment(local);
    emitChange && emitChange("payments", "updated", result);
    await setOrderPaymentStatus(getModel, emitChange, local.orderId, "completed");
    // Gateway-verified payment ends the customer's visit — expire their session.
    if (expireCustomerSessionsForOrder) await expireCustomerSessionsForOrder(local.orderId, "payment-verified");
    await logAudit(
      { admin: { id: "razorpay-webhook" } },
      { action: "update", resource: "payments", targetId: local.id, after: result }
    );
  }

  async function handlePaymentFailed(payload, { emitChange, getModel, logAudit }) {
    const local = await findPaymentForWebhook(payload);
    if (!local) return; // not every payment.failed event is for a QR payment of ours

    if (local.status === "PAID" || local.status === "FAILED") return; // idempotent — never downgrade a PAID record, never double-log a FAILED one

    const paymentEntity = payload?.payment?.entity || {};
    local.status = "FAILED";
    local.razorpayPaymentId = paymentEntity.id || local.razorpayPaymentId;
    local.method = paymentEntity.method || local.method;
    local.failureReason =
      paymentEntity.error_description ||
      (paymentEntity.error_source ? `${paymentEntity.error_source} error` : null) ||
      "Payment failed";
    await local.save();

    const result = safePayment(local);
    emitChange && emitChange("payments", "updated", result);
    await logAudit(
      { admin: { id: "razorpay-webhook" } },
      { action: "update", resource: "payments", targetId: local.id, after: result }
    );
  }

  async function handleQrClosed(payload, { emitChange, logAudit }) {
    const qrId = payload?.qr_code?.entity?.id || payload?.payment_link?.entity?.id;
    if (!qrId) return;
    const local = await Payment.findOne({ razorpayQrId: qrId });
    if (!local) return;

    // A QR that closes with reason "paid" already got its qr_code.credited
    // event — nothing further to do. Only an unpaid closure (expired,
    // manually closed) needs marking as failed, and only if it's still
    // sitting PENDING.
    if (local.status !== "PENDING") return;

    const closeReason = payload?.qr_code?.entity?.close_reason || (payload?.payment_link?.entity?.status === "expired" ? "expired" : null);
    if (closeReason === "paid") return;

    local.status = "FAILED";
    local.failureReason = closeReason === "expired" ? "QR code expired before payment" : "QR code closed before payment";
    await local.save();

    const result = safePayment(local);
    emitChange && emitChange("payments", "updated", result);
    await logAudit(
      { admin: { id: "razorpay-webhook" } },
      { action: "update", resource: "payments", targetId: local.id, after: result }
    );
  }

  return router;
}

module.exports = { buildRouter, Payment, safePayment, getRazorpayClient };
