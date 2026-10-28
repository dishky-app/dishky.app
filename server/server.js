// Dishky — multi-tenant restaurant platform API
require("dotenv").config();
// MUST come before anything that defines a Mongoose model: it registers the
// global plugin that isolates every restaurant's data (see tenancy.js).
const tenancy = require("./src/core/tenancy");
const dns = require("dns");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const {
  router: authRouter,
  todoRouter,
  requireAuth: requireAdminAuth,
  requireRole: requireAdminRole,
  requireMinRank: requireAdminMinRank,
  requireCanManageStaff: requireAdminCanManageStaff,
  Admin,
  ensureAdminsHaveStaffRecords,
  ensureAdminRoleGroupsMatchTitle,
} = require("./src/modules/auth/auth");
const venuesModule = require("./src/modules/venues/venues");
const attendersModule = require("./src/modules/attenders/attenders");
const permissionsModule = require("./src/modules/auth/permissions");
const rolesModule = require("./src/modules/auth/roles");
const workPlanModule = require("./src/modules/workPlan/workPlan");
const auditLogModule = require("./src/modules/auditLog/auditLog");
const documentsModule = require("./src/modules/documents/documents");
const memosModule = require("./src/modules/memos/memos");
const { isThumbnailableDocument, generateFirstPageThumbnail } = require("./src/services/fileThumbnail");
const { validateOptionalDataUrlFile, asPlainString, payloadShapeGuard, safeErrorMessage } = require("./src/core/validation");
const { buildLimiter } = require("./src/core/rateLimitStore");
const paymentsModule = require("./src/modules/payments/payments");
const bankAccountModule = require("./src/modules/payments/bankAccount");
const chatModule = require("./src/modules/chat/chat");
const whatsappModule = require("./src/modules/whatsapp/whatsapp");
const { logAudit } = auditLogModule;
const { hasPermission } = permissionsModule;
const { getModel } = require("./src/core/genericModel");
const platformModule = require("./src/modules/platform");
const subscriptionsSvc = require("./src/modules/platform/subscriptions");
const { tenantMiddleware } = require("./src/modules/platform/tenantResolver");
const { assertWithinLimit, requireModule, sendLimitError } = require("./src/modules/platform/limits");
const slugsLib = require("./src/modules/platform/slugs");
const { currentTenantId, runInTenant, runAsPlatform } = tenancy;
const ingredientBridge = require("./src/modules/inventory/ingredientBridge");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

/* ─────────────────────────────────────────
   APP + SOCKET SETUP
───────────────────────────────────────── */
const app = express();

// Render (and most PaaS hosts) terminate TLS at a reverse proxy in front
// of this app, so Express sees plain HTTP internally. Without trusting
// that proxy, Express can't correctly determine the request was actually
// HTTPS, which breaks `secure: true` cookies (they get silently dropped
// instead of set) — the exact cause of every route 401ing in production
// while working fine on localhost. Must be set before any cookies are
// issued.
// Number of reverse-proxy hops in front of this process. Render's load balancer
// is one hop; both frontends additionally reach this API through Vercel (a
// rewrite for the admin panel, a serverless function for the customer app), which
// is a second hop. With only 1 trusted hop, req.ip is Vercel's egress address
// for EVERY visitor, so all per-IP rate limits (login, customer-auth, general)
// are shared by the whole user base. Set TRUST_PROXY_HOPS=2 in production once
// verified (default stays 1 so behaviour is unchanged until opted in).
const TRUST_PROXY_HOPS = Math.max(1, parseInt(process.env.TRUST_PROXY_HOPS || "1", 10) || 1);
app.set("trust proxy", TRUST_PROXY_HOPS);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
  // Allow the default polling->websocket upgrade path instead of forcing
  // websocket-only. A pure-WS connection has no fallback, so any brief
  // network blip (flaky cafe wifi/router) kills it outright instead of
  // degrading gracefully — that was causing the frequent connect/
  // disconnect cycles for the printer bridge seen in the logs.
});

// CORS must reflect the actual request origin (not "*") and set
// Allow-Credentials so the browser will send/accept the httpOnly session
// cookie across the Vercel (frontend) <-> Render (backend) origin split.
// ALLOWED_ORIGINS in .env: comma-separated list, e.g.
//   ALLOWED_ORIGINS=https://dishky-admin.vercel.app,https://www.dishky.com,http://localhost:3000
//
// SECURITY: this list must be explicitly configured. Previously, an
// empty/unset ALLOWED_ORIGINS was treated as "allow every origin" while
// still sending Access-Control-Allow-Credentials: true — combined with
// cookie-based sessions, that meant any website could make credentialed
// requests on a visitor's behalf against this API in an environment
// where the env var was missing (e.g. a fresh deploy). Fail CLOSED
// instead: with nothing configured, no cross-origin request is allowed
// (same-origin and server-to-server calls are unaffected either way).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  console.warn(
    "[cors] WARNING: ALLOWED_ORIGINS is not set — no cross-origin browser requests will be permitted. " +
    "Set ALLOWED_ORIGINS in your environment to a comma-separated list of trusted frontend origins."
  );
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, X-Restaurant, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

/**
 * CSRF protection for state-changing requests.
 *
 * Why this is needed despite the CORS allow-list above: this app's
 * session cookies are necessarily `SameSite=None` in production (the
 * Vercel frontends and this Render backend are different origins, so
 * `SameSite=Lax/Strict` would silently drop the cookie on every
 * cross-origin request — see the cookie config in auth.js/server.js).
 * `SameSite=None` provides NO CSRF protection by itself: the browser
 * attaches the cookie to a cross-site request regardless of who
 * triggered it. The CORS allow-list above stops an attacker's page
 * from READING the response, but that's irrelevant to classic CSRF —
 * the attacker doesn't need to read the response, only to make the
 * state-changing side effect happen (e.g. a hidden auto-submitting
 * form on a malicious site placing an order, changing a password, or
 * deleting a record on the victim's behalf). Critically, a plain HTML
 * form submission with `enctype="application/x-www-form-urlencoded"`
 * (or `multipart/form-data`, or `text/plain`) is a CORS "simple
 * request" — it never triggers a preflight, so the origin allow-list
 * is never even consulted before the browser sends it, and this app
 * mounts express.urlencoded() so such a body would be parsed and
 * acted on.
 *
 * The fix: require a custom header (X-Requested-With) on every
 * state-changing request. A custom header is NOT allowed on a CORS
 * simple request — adding one forces the browser to run a real
 * preflight (OPTIONS) first, and that preflight IS checked against
 * ALLOWED_ORIGINS above (Access-Control-Allow-Headers must explicitly
 * list the header, which it already does). A plain HTML form (the
 * classic CSRF vector) has no way to add a custom header, so it can
 * no longer reach any state-changing route here at all — only
 * JavaScript running on an already-CORS-approved origin can.
 *
 * GET/HEAD/OPTIONS are exempt (they should never cause a state
 * change in a correctly-built API, and requiring the header on GET
 * would break plain link navigation / server-to-server GETs).
 */
const CSRF_EXEMPT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Server-to-server webhooks cannot send custom headers; they are authenticated
// by an HMAC signature over the raw body instead.
const CSRF_EXEMPT_PATHS = [/^\/payments\/webhook(\/|$)/, /^\/platform\/webhooks\//];
app.use((req, res, next) => {
  if (CSRF_EXEMPT_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.some((re) => re.test(req.path))) return next();
  if (req.headers["x-requested-with"] !== "XMLHttpRequest" && req.headers["x-requested-with"] !== "fetch") {
    return res.status(403).json({
      error: "Missing required request header. This endpoint cannot be called from a plain HTML form.",
    });
  }
  next();
});

// Security headers. This server is a pure JSON API (no HTML views), so
// most of these matter less than they would for a page-serving app, but
// they're cheap, correct, and close real gaps: a browser that ever
// renders a raw JSON/error response from this origin (e.g. someone
// navigating straight to an API URL, or an error page) should still get
// a locked-down CSP rather than the browser's default of "anything
// goes". No new dependency needed for this handful of headers; a fuller
// helmet() setup could replace this later if more headers are needed.
app.use((req, res, next) => {
  res.header("X-Content-Type-Options", "nosniff");
  // Belt-and-braces framing protection: X-Frame-Options for older
  // browsers that don't honor CSP's frame-ancestors, plus frame-ancestors
  // itself below for browsers that do. This API is never meant to be
  // embedded in a frame by anyone.
  res.header("X-Frame-Options", "DENY");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions-Policy: this origin never needs camera/mic/geolocation/
  // payment access itself, and explicitly disclaiming them means a
  // browser rendering any response from here (including an embedded
  // iframe, however unlikely) can't be tricked into granting them.
  res.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
  );
  // Content-Security-Policy: this server serves JSON, not HTML/JS to
  // render, so the policy is intentionally as restrictive as CSP
  // allows — default-deny everything, no framing (frame-ancestors
  // backs up X-Frame-Options above for browsers that support CSP3),
  // no plugins, no base tag hijacking, and upgrade any accidental
  // plain-HTTP subresource reference to HTTPS.
  res.header(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ")
  );
  // Strict-Transport-Security: safe to send unconditionally even though
  // Express only ever sees plain HTTP internally (TLS is terminated at
  // Render's proxy, see `app.set("trust proxy", 1)` above) — the header
  // reaches the browser over the actual HTTPS connection to Render, and
  // instructs it to never downgrade to plain HTTP for this host again.
  // 1 year, including subdomains; omit `preload` until the domain is
  // actually submitted to the HSTS preload list, since removing preload
  // later is far harder than adding it.
  res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// General API rate limiter — covers every route that doesn't already
// have its own stricter, purpose-specific limiter (login, forgot-password,
// create-account, customer-auth, whatsapp/*, etc. all set tighter caps
// on top of this one). Without this, the venue-scoped CRUD routes, chat,
// documents, and payments had no request-volume cap at all — only the
// dedicated auth endpoints did. Keyed by IP; generous enough not to
// affect normal admin/customer usage (dashboards can legitimately fire
// many small requests per minute), but bounds sustained scraping/abuse
// against any single instance. Health checks are excluded so uptime
// monitors/keep-alive pings never trip it.
const generalApiLimiter = buildLimiter("general-api", {
  windowMs: 60 * 1000,
  max: 300, // per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  // Health checks and Razorpay's webhook are excluded: uptime monitors
  // shouldn't trip this, and a burst of legitimate webhook deliveries
  // (Razorpay's own IPs, not a customer's) getting rate-limited would
  // just cause Razorpay to retry the same events more, not less.
  skip: (req) => req.path === "/health" || /^\/(payments\/webhook|platform\/webhooks\/)/.test(req.path),
});
app.use(generalApiLimiter);

// Captures the raw request body bytes (before JSON parsing) onto
// req.rawBody, ONLY for the Razorpay webhook route. Signature
// verification (see payments.js's POST /webhook route) MUST hash the
// exact bytes Razorpay signed — re-serializing the parsed JS object
// with JSON.stringify(req.body) is a well-known way to get a
// different byte sequence (key order, spacing) and fail verification
// even for a genuine, unmodified webhook. Scoped to just this one
// path so every other route's body isn't held in memory twice.
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    if (/^\/(payments\/webhook|platform\/webhooks\/)/.test(req.originalUrl)) {
      req.rawBody = buf;
    }
  },
}));
app.use(payloadShapeGuard);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ─────────────────────────────────────────
   PLATFORM API (dishky.com: owner accounts, plans, billing) — NOT tenant data.
   Mounted before the tenant middleware: it manages tenants themselves.
───────────────────────────────────────── */
app.use("/platform", platformModule.buildRouter());
// Dishky staff console (separate login, separate cookie, optional IP allow-list).
app.use("/superadmin", require("./src/modules/platform/superadmin").buildRouter());
// Developer Panel API (Dishky technical staff: own login, own cookie). Not tenant data.
const supportRoutes = require("./src/modules/support/routes");
app.use("/dev", supportRoutes.buildDevRouter());

/* ─────────────────────────────────────────
   TENANT RESOLUTION + SUBSCRIPTION GATE
   From here on every request runs inside exactly one restaurant's context;
   the Mongoose plugin (tenancy.js) then scopes every query to it.
───────────────────────────────────────── */
app.use(tenantMiddleware({ staffCookieName: "dishkyid" }));

/* ─────────────────────────────────────────
   MONGOOSE — GENERIC SCHEMA (see genericModel.js)
───────────────────────────────────────── */

/* ─────────────────────────────────────────
   CUSTOMER SESSIONS (user panel)

   Mirrors the admin-panel session pattern in auth.js (httpOnly cookie +
   server-side session doc, TTL-cleaned) but as its own collection/cookie
   so a customer session and a staff session can coexist in the same
   browser without clashing. Previously the user panel only stored a raw
   userId in localStorage with no server-side session at all — anyone
   could set that value to any user's id and "become" them, and a reload
   only worked as long as GET /users/:id happened to succeed.
───────────────────────────────────────── */
const customerSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const CustomerSession = mongoose.model("CustomerSession", customerSessionSchema, "customerSessions");

// One cookie per restaurant: a guest who is signed in at one restaurant is a
// stranger at another (customers are scoped per restaurant), and signing in at
// a second restaurant must not log them out of the first.
function customerCookieName() {
  const id = currentTenantId();
  if (!id) throw new Error("customer session requires a restaurant");
  return `dishkyid_cust_${id}`;
}
const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — customers expect to stay logged in

// Customer login/signup is mobile-number-only (no password) — rate
// limiting here is what stands in for brute-force protection, since
// there's no password attempt to otherwise slow down. Keyed by IP.
const customerAuthLimiter = buildLimiter("customer-auth", {
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function customerCookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: CUSTOMER_SESSION_TTL_MS,
    path: "/",
  };
}

async function createCustomerSession(userId, req, res) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  await CustomerSession.create({
    sessionId,
    userId,
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip,
    expiresAt: new Date(Date.now() + CUSTOMER_SESSION_TTL_MS),
  });
  res.cookie(customerCookieName(), sessionId, customerCookieOpts());
  return sessionId;
}

/**
 * requireCustomerAuth — validates the dishkyid cookie against
 * customerSessions, attaches req.customerUserId. Used by /auth/me and
 * /auth/logout; the rest of the /users/* CRUD routes stay open for now
 * (unchanged from prior behavior) so this is additive, not a breaking
 * lockdown of existing user-panel calls.
 */
async function requireCustomerAuth(req, res, next) {
  try {
    const sessionId = req.cookies ? req.cookies[customerCookieName()] : null;
    if (!sessionId) return res.status(401).json({ error: "Not logged in" });

    const session = await CustomerSession.findOne({ sessionId }).lean();
    if (!session || session.expiresAt < new Date()) {
      res.clearCookie(customerCookieName(), customerCookieOpts());
      return res.status(401).json({ error: "Session expired" });
    }

    // Sliding expiry, same pattern as admin sessions.
    CustomerSession.updateOne(
      { sessionId },
      { $set: { lastActive: new Date(), expiresAt: new Date(Date.now() + CUSTOMER_SESSION_TTL_MS) } }
    ).catch(() => { });

    req.customerSessionId = sessionId;
    req.customerUserId = session.userId;
    next();
  } catch (err) {
    console.error("requireCustomerAuth error:", err.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}

/* ─────────────────────────────────────────
   COLLECTION REGISTRY

   ARRAY collections   → normal REST CRUD
                          GET /col           list all
                          GET /col/:id       single doc by app "id" field
                          POST /col          create
                          PUT /col/:id       full replace
                          PATCH /col/:id     partial update
                          DELETE /col/:id    remove

   SINGLETON collections → one document per collection, stored with id="singleton"
                          GET /col           returns the object directly (or {})
                          PUT /col           full replace
                          PATCH /col         partial merge

   Source of truth: your MongoDB Atlas collections
───────────────────────────────────────── */
const ARRAY_COLLECTIONS = [
  "users",
  "categories",
  "ingredients",
  "favourites",
  "orders",
  "staff",
  "careers",
  "holidays",
  "recipes",
  "offers",
  "reservations",
  "celebrations",
  "preBookings",
  "cateringOrders",
  "events",
  "eventBookings",
  "tables",
  "serviceActivity",
  "serviceSchedules",
  "kitchenActivity",
  "kitchenSchedules",
  "tasks",
  "combo_offers",
  "combo",
  "callHistory",
  "tablePreferences",
];

// Plain objects in db.json — stored as one doc with id="singleton"
const SINGLETON_COLLECTIONS = [
  "grooming",
  "mise",
  "kitchenAssign",
  "kitchenMise",
  "serviceAssign",
  "serviceGrooming",
  "serviceMise",
  "comboSectionConfig",
  "categoryCards",
];

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */

/** Strip MongoDB internal fields from a lean doc before sending to client. */
function stripMeta(doc) {
  if (!doc) return doc;
  const out = { ...doc };
  delete out._id;
  delete out.__v;
  return out;
}

/**
 * Generates (or refreshes) first-page-preview thumbnails for a staff
 * record's file fields, in place on the given body object.
 *
 * `staff` is one of the generic, schemaless ARRAY_COLLECTIONS, so
 * there's no fixed field list to hook into at the schema level —
 * instead this is called explicitly from the staff-specific branches
 * of the POST/PUT/PATCH /staff handlers below, mirroring how the
 * DELETE handler already special-cases `name === "staff"` for linked
 * login-account cleanup.
 *
 * Covers:
 *   - body.idProof / body.bonafide           — flat fields
 *   - body.training[].certificate            — nested array field
 *
 * `previousDoc` (the record's existing state before this write, or
 * null on create) lets this skip re-rendering a thumbnail for a file
 * that didn't actually change — training records in particular can
 * be a long-lived array where most edits don't touch older entries'
 * certificates.
 *
 * Best-effort: a render failure never blocks the save (already
 * handled inside generateFirstPageThumbnail, which returns null
 * rather than throwing).
 */
/**
 * attachStaffFileThumbnails also DOUBLES as the validation gate for
 * every staff file-upload field (idProof, bonafide, and each training
 * entry's certificate) — every write to these fields funnels through
 * here regardless of whether it came from POST, PUT, or PATCH, so this
 * is the single place that needs to enforce the file-type/size
 * allow-list rather than duplicating the check at each call site.
 * Throws a descriptive Error (caught by callers and turned into a 400)
 * on the first invalid file found; does not attempt to report every
 * invalid field at once.
 */
async function attachStaffFileThumbnails(body, previousDoc) {
  const flatFileFields = [
    { dataField: "idProof", typeField: "idProofType", thumbField: "idProofThumbnail" },
    { dataField: "bonafide", typeField: "bonafideType", thumbField: "bonafideThumbnail" },
  ];

  for (const { dataField, typeField, thumbField, label } of flatFileFields) {
    if (body[dataField] === undefined) continue; // field not part of this write
    const fileChanged = !previousDoc || body[dataField] !== previousDoc[dataField];
    if (fileChanged) {
      const check = validateOptionalDataUrlFile(body[dataField]);
      if (!check.ok) {
        const err = new Error(`${label || dataField}: ${check.error}`);
        err.isValidationError = true;
        throw err;
      }
    }
    const fileType = body[typeField] || sniffMimeFromDataUrl(body[dataField]);
    // Also regenerate when this record predates the thumbnail feature
    // and has never had one — see the PUT /documents route in
    // documents.js for the same self-healing rationale.
    const missingThumbnail = !previousDoc?.[thumbField];
    if (!fileChanged && !missingThumbnail) continue; // keep the existing thumbnail
    body[thumbField] = isThumbnailableDocument(fileType) && body[dataField]
      ? (await generateFirstPageThumbnail(fileType, body[dataField])) || ""
      : "";
  }

  if (Array.isArray(body.training)) {
    const previousTraining = Array.isArray(previousDoc?.training) ? previousDoc.training : [];
    for (const entry of body.training) {
      if (!entry || !entry.certificate) continue;
      const previousEntry = previousTraining.find(t => t && t.id && entry.id && t.id === entry.id);
      const fileChanged = !previousEntry || entry.certificate !== previousEntry.certificate;
      if (fileChanged) {
        const check = validateOptionalDataUrlFile(entry.certificate);
        if (!check.ok) {
          const err = new Error(`Training certificate: ${check.error}`);
          err.isValidationError = true;
          throw err;
        }
      }
      const missingThumbnail = !previousEntry?.certificateThumbnail;
      if (!fileChanged && !missingThumbnail) {
        if (previousEntry?.certificateThumbnail) entry.certificateThumbnail = previousEntry.certificateThumbnail;
        continue;
      }
      const fileType = entry.certificateType || sniffMimeFromDataUrl(entry.certificate);
      entry.certificateThumbnail = isThumbnailableDocument(fileType)
        ? (await generateFirstPageThumbnail(fileType, entry.certificate)) || ""
        : "";
    }
  }
}

/** Reads the mime type out of a `data:<mime>;base64,...` URL, if present. */
function sniffMimeFromDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return "";
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return match ? match[1] : "";
}

/* ─────────────────────────────────────────
   REALTIME ROOMS — every restaurant has its own rooms, so one restaurant can
   never hear another's orders, bells or printer traffic:
     r:<restaurantId>:staff    sockets that proved a staff session
     r:<restaurantId>:guests   customer-app sockets that joined by restaurant slug
     admin:<adminId>           one staff member (chat)
───────────────────────────────────────── */
const roomOf = (restaurantId, kind) => `r:${restaurantId}:${kind}`;

// Ticket system: push "your ticket changed" to that restaurant's signed-in staff only.
require("./src/modules/support/service").setEmitter({
  toRestaurant: (restaurantId, event, payload) => {
    if (restaurantId) io.to(roomOf(restaurantId, "staff")).emit(event, payload);
  },
});

/** Emit an event to a single admin's own socket room (see chat:register). */
function emitToAdmin(adminId, event, payload) {
  io.to(`admin:${adminId}`).emit(event, payload);
}

/** Whether an admin currently has at least one connected socket (see chat:register). */
function isAdminOnline(adminId) {
  const room = io.sockets.adapter.rooms.get(`admin:${adminId}`);
  return !!room && room.size > 0;
}

/* ─────────────────────────────────────────
   STAFF SOCKET ROOM
   Socket.IO connections are unauthenticated (browsers reach this API's socket
   cross-origin, so the httpOnly session cookie is not sent). Only sockets that
   prove an admin session join their restaurant's "staff" room and receive full
   payloads; customer sockets join the "guests" room and get redacted events
   that are enough to trigger a refetch or patch a visible order status.
   Flow: admin app calls GET /socket-token (session-authenticated), then emits
   "staff:join" with the one-time token over the socket. The token carries the
   restaurant, so the room can never be chosen by the client.
───────────────────────────────────────── */
const socketJoinTokens = new Map(); // token -> { adminId, restaurantId, venueId, exp }
function issueSocketJoinToken(admin) {
  const now = Date.now();
  for (const [t, v] of socketJoinTokens) if (v.exp < now) socketJoinTokens.delete(t);
  const token = crypto.randomBytes(24).toString("hex");
  socketJoinTokens.set(token, {
    adminId: admin.id,
    restaurantId: currentTenantId(),
    venueId: admin.venueId || null,
    roleGroup: admin.roleGroup,
    exp: now + 60 * 1000,
  });
  return token;
}
function consumeSocketJoinToken(token) {
  const v = socketJoinTokens.get(String(token || ""));
  if (!v) return null;
  socketJoinTokens.delete(String(token));
  return v.exp >= Date.now() ? v : null;
}

/** What a non-staff (guest/customer) socket is allowed to see about a change. */
const GUEST_FULL_PAYLOAD_RESOURCES = new Set(["categories", "ingredients", "combo", "combo_offers", "offers", "events", "tables", "categoryCards", "comboSectionConfig", "tablePreferences"]);
function redactForGuests(resource, payload) {
  if (GUEST_FULL_PAYLOAD_RESOURCES.has(resource)) return payload;
  if (resource === "orders" && payload && typeof payload === "object") {
    return { id: payload.id, venueId: payload.venueId, status: payload.status, paymentStatus: payload.paymentStatus };
  }
  if (payload && typeof payload === "object") return { id: payload.id };
  return null;
}

/** Emit a data-change event with a unique eventId to prevent double-firing. */
function emitChange(resource, action, payload) {
  const restaurantId = currentTenantId();
  if (!restaurantId) {
    console.warn(`[realtime] emitChange(${resource}) called outside a restaurant context — dropped`);
    return;
  }
  const eventId = `${resource}_${action}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  io.to(roomOf(restaurantId, "staff")).emit("data-change", { resource, action, payload, eventId });
  io.to(roomOf(restaurantId, "guests")).emit("data-change", { resource, action, payload: redactForGuests(resource, payload), eventId });
}


ingredientBridge.init({ emitChange });

/**
 * Ends every customer session belonging to the customer who placed
 * `orderId`. Called when the bill is printed or when the payment gateway
 * verifies the payment — the visit is over, so the customer must log in
 * again for the next one. Broadcasts "session-expired" so an open user
 * panel logs out immediately instead of on its next request. Best-effort:
 * never throws, guest orders (no userId) are a no-op.
 */
async function expireCustomerSessionsForOrder(orderId, reason) {
  try {
    if (!orderId) return 0;
    const order = await getModel("orders").findOne({ id: orderId }).select("userId").lean();
    const userId = order?.userId;
    if (!userId) return 0;
    const result = await CustomerSession.deleteMany({ userId });
    const restaurantId = currentTenantId();
    if (restaurantId) io.to(roomOf(restaurantId, "guests")).emit("session-expired", { userId, reason: reason || "bill-settled" });
    return result.deletedCount || 0;
  } catch (err) {
    console.warn("expireCustomerSessionsForOrder failed:", err.message);
    return 0;
  }
}

/** Resources that trigger an admin "new booking" toast on creation. */
const BOOKING_META = {
  eventBookings: { label: "New event booking", route: "/event-bookings" },
  reservations: { label: "New reservation", route: "/reservations" },
  celebrations: { label: "New celebration booking", route: "/celebrations" },
  cateringOrders: { label: "New catering order", route: "/catering" },
  preBookings: { label: "New pre-booking", route: "/pre-bookings" },
};

function notifyNewBooking(resource, body) {
  const meta = BOOKING_META[resource];
  if (!meta) return;
  const restaurantId = currentTenantId();
  if (!restaurantId) return;
  const name = body.name || body.userName || body.customerName || "";
  io.to(roomOf(restaurantId, "staff")).emit("new-booking", {
    resource,
    message: name ? `${meta.label} — ${name}` : meta.label,
    route: meta.route,
  });
}


/**
 * Server-side order pricing. The browser still computes the cart (sizes,
 * customisation, offers, combos all live in the UI), but the server no longer
 * trusts the totals it sends:
 *  - every line's totalPrice is recomputed as unitPrice x quantity,
 *  - subtotal / CGST / SGST / total are recomputed from those lines,
 *  - plain (non-customised, non-combo) dish lines are checked against the
 *    catalogue: unitPrice may not drop below the dish's cheapest size price
 *    minus the largest active offer discount for that dish.
 * Returns { error } for a rejected order, otherwise the trusted totals.
 */
async function priceOrderServerSide(items, venueId) {
  const lines = [];
  let sub = 0;
  let catalogue = null;
  let offers = null;
  for (const it of items) {
    const qty = Math.floor(Number(it.quantity));
    const unit = Number(it.unitPrice);
    if (!Number.isFinite(unit) || unit < 0) return { error: "Invalid item price" };
    const line = Math.round(unit * qty);
    if (Math.abs(Number(it.totalPrice) - line) > Math.max(1, qty)) return { error: "Item total does not match price x quantity" };

    const plain = !it.isCustomized && !it.isCombo && it.dishId && it.dishId !== "__custom__";
    if (plain) {
      if (!catalogue) {
        const cats = await getModel("categories").find(venueId ? { venueId } : {}).lean();
        catalogue = new Map();
        for (const c of cats) {
          const mults = (Array.isArray(c.sizes) ? c.sizes : []).map((z) => Number(z.priceMultiplier) || 1);
          const minMult = mults.length ? Math.min(1, ...mults) : 1;
          for (const d of Array.isArray(c.dishes) ? c.dishes : []) catalogue.set(String(d.id), { base: Number(d.basePrice), minMult });
        }
        offers = await getModel("offers").find({ active: "yes" }).lean();
      }
      const dish = catalogue.get(String(it.dishId));
      if (dish && Number.isFinite(dish.base)) {
        const maxPct = Math.max(0, ...offers.filter((o) => String(o.dishId) === String(it.dishId)).map((o) => Number(o.percentage) || 0));
        const floor = Math.floor(dish.base * dish.minMult * (1 - Math.min(maxPct, 100) / 100)) - 1;
        if (unit < floor) return { error: "Item price is below the menu price" };
      }
    }
    sub += line;
    lines.push({ ...it, quantity: qty, unitPrice: Math.round(unit), totalPrice: line });
  }
  const cgst = Number((sub * 0.025).toFixed(2));
  const sgst = Number((sub * 0.025).toFixed(2));
  return {
    items: lines,
    totalAmount: sub,
    totalWithGST: { subTotal: sub, cgst, sgst, total: Math.round(sub + cgst + sgst) },
  };
}

/**
 * ONE BILL PER TABLE.
 * A dine-in table keeps a single open order ("bill") until its payment is
 * completed: when the same table orders again (re-order button, QR scanned
 * again, or an attender adding more) the new dishes are appended to that open
 * order instead of creating a new one, and the totals are recomputed over the
 * whole bill. Once paymentStatus is "completed" the bill is closed and the next
 * order at that table starts a fresh one. An attender tab that names a guest
 * keeps its own bill per (table, guest) so two parties at one table can pay
 * separately. Bills older than BILL_WINDOW_MS are never reused (a forgotten,
 * never-paid order must not swallow tomorrow's orders).
 */
const BILL_WINDOW_MS = 12 * 60 * 60 * 1000;

const billKey = (o) =>
  o && o.attenderId && o.userName && String(o.userName).trim().toLowerCase() !== "guest"
    ? String(o.userName).trim().toLowerCase()
    : "";

function billTotals(items) {
  const sub = (Array.isArray(items) ? items : [])
    .filter((i) => String(i.status || "").toLowerCase().trim() !== "cancelled")
    .reduce((n, i) => n + (Number(i.totalPrice) || 0), 0);
  const cgst = Number((sub * 0.025).toFixed(2));
  const sgst = Number((sub * 0.025).toFixed(2));
  return { totalAmount: sub, totalWithGST: { subTotal: sub, cgst, sgst, total: Math.round(sub + cgst + sgst) } };
}

// Same rule the admin panel uses to derive an order's status from its items.
function billStatus(items) {
  const active = (Array.isArray(items) ? items : []).filter((i) => String(i.status || "").toLowerCase().trim() !== "cancelled");
  if (active.length === 0) return "cancelled";
  if (active.every((i) => i.status === "completed")) return "completed";
  if (active.some((i) => i.status === "preparing" || i.status === "service pickup")) return "preparing";
  return "placed";
}

/** The table's open (unpaid, not cancelled) bill for this venue, or null. */
async function findOpenBill(order) {
  const table = order.tableNo == null ? "" : String(order.tableNo).trim();
  if (!table || !order.venueId) return null;
  const tableValues = [table];
  if (/^\d+$/.test(table)) tableValues.push(Number(table));
  const since = new Date(Date.now() - BILL_WINDOW_MS).toISOString();
  const candidates = await getModel("orders")
    .find({ venueId: order.venueId, tableNo: { $in: tableValues }, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  const wanted = billKey(order);
  return (
    candidates.find(
      (o) =>
        String(o.paymentStatus || "pending").toLowerCase() !== "completed" &&
        String(o.status || "").toLowerCase().trim() !== "cancelled" &&
        billKey(o) === wanted
    ) || null
  );
}

/** Appends `order.items` to the table's open bill. Returns { order, addedItems } or null when there is no open bill. */
async function appendToOpenBill(order) {
  const open = await findOpenBill(order);
  if (!open) return null;
  const Orders = getModel("orders");
  const now = new Date().toISOString();
  const addedItems = order.items.map((i) => ({
    ...i,
    status: "placed",
    createdAt: now,
    ...(order.attenderName ? { attenderId: order.attenderId, attenderName: order.attenderName } : {}),
  }));
  const $set = { updatedAt: now };
  if (order.attenderName) {
    $set.attenderId = order.attenderId;
    $set.attenderName = order.attenderName;
  }
  // $push is atomic; totals/status are then recomputed over the whole bill.
  const after = await Orders.findOneAndUpdate(
    { id: open.id, paymentStatus: { $ne: "completed" } },
    { $push: { items: { $each: addedItems } }, $set },
    { returnDocument: "after" }
  ).lean();
  if (!after) return null; // paid in the meantime: start a new bill instead
  const final = await Orders.findOneAndUpdate(
    { id: open.id },
    { $set: { ...billTotals(after.items), status: billStatus(after.items) } },
    { returnDocument: "after" }
  ).lean();
  return { order: stripMeta(final), addedItems };
}

/**
 * Generate a safe, incrementing order id like "order_00001".
 * The user-panel sends id:"pending" as a placeholder; the server assigns the real id.
 */
async function generateOrderId() {
  const Model = getModel("orders");
  const Counter = getModel("counters");

  // Fast path: atomically increment a persisted counter instead of scanning
  // every existing order id on every single order creation. This used to be
  // an O(n) scan over the whole orders collection (already 2,000+ documents
  // and growing) purely to find the current maximum id — this reduces that
  // to a single indexed upsert.
  let counterDoc = await Counter.findOneAndUpdate(
    { id: "order_id_counter" },
    { $inc: { seq: 1 } },
    { returnDocument: "after" }
  ).lean();

  if (!counterDoc) {
    // First-ever call (no counter document exists yet): seed it from the
    // current maximum order id, exactly as the old scan-based logic did,
    // so numbering picks up where existing orders left off rather than
    // restarting from 1. This scan only ever runs once, at seed time.
    const docs = await Model.find(
      { id: { $regex: /^order_\d+$/ } },
      { id: 1 }
    ).lean();
    let maxNum = 0;
    for (const d of docs) {
      const n = parseInt(d.id.replace("order_", ""), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    // Upsert with the seeded value, then increment atomically. If two
    // requests race to seed at the same time, the unique `id` on the
    // counter document means only one insert wins; the loser simply
    // retries the increment against the now-existing document.
    try {
      counterDoc = await Counter.findOneAndUpdate(
        { id: "order_id_counter" },
        { $setOnInsert: { seq: maxNum } },
        { returnDocument: "after", upsert: true }
      ).lean();
      counterDoc = await Counter.findOneAndUpdate(
        { id: "order_id_counter" },
        { $inc: { seq: 1 } },
        { returnDocument: "after" }
      ).lean();
    } catch (err) {
      // Extremely unlikely duplicate-key race on first seed; just retry once.
      counterDoc = await Counter.findOneAndUpdate(
        { id: "order_id_counter" },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
      ).lean();
    }
  }

  let candidateNum = counterDoc.seq;
  let candidate = `order_${String(candidateNum).padStart(5, "0")}`;

  // Guard against the (now rarer, but still possible if the counter and the
  // orders collection ever drift — e.g. a manually-inserted order) case
  // where the candidate id already exists.
  while (await Model.exists({ id: candidate })) {
    const bumped = await Counter.findOneAndUpdate(
      { id: "order_id_counter" },
      { $inc: { seq: 1 } },
      { returnDocument: "after" }
    ).lean();
    candidateNum = bumped.seq;
    candidate = `order_${String(candidateNum).padStart(5, "0")}`;
  }
  return candidate;
}

/* ─────────────────────────────────────────
   AUTH MIDDLEWARE
───────────────────────────────────────── */

/* ─────────────────────────────────────────
   PHASE-4 — STAFF / ROLE-BASED AUTH
   Mounted separately from the legacy customer
   /auth/* routes below (which operate on the
   `users` collection, not `admins`).
───────────────────────────────────────── */
app.use("/staff-auth", authRouter);
// Attenders (waiters) sign in on the user panel to take dine-in orders for tables.
app.use("/attender-auth", attendersModule.buildRouter());
app.use("/todos", todoRouter);

/* ─────────────────────────────────────────
   LEGACY / CUSTOMER AUTH ROUTES
───────────────────────────────────────── */

// POST /auth/session-login — mobile-number lookup, matching how the user
// panel (Welcome.js) actually authenticates customers (no password).
// Issues an httpOnly cookie session instead of the frontend trusting a
// raw userId in localStorage.
/* ─────────────────────────────────────────
   GET /auth/mobile-exists?mobile=... — used only to power the
   mobile-number autocomplete on the login screen, before any session
   exists. Deliberately returns nothing but a boolean (never actual
   user records) — the old approach called the admin-only GET /users
   and filtered every customer's mobile number client-side, which both
   (a) 401s now that admin routes are properly session-gated, and
   (b) would have exposed every customer's phone number to anyone on
   the login screen even if it had "worked". This route can't be used
   to enumerate real numbers beyond exact/prefix matches the caller
   already typed, and returns only { exists: boolean }.
───────────────────────────────────────── */
app.get("/auth/mobile-exists", customerAuthLimiter, async (req, res) => {
  try {
    const mobile = String(req.query.mobile || "").trim();
    if (!mobile) return res.json({ exists: false });
    const match = await getModel("users").findOne({ mobile }).lean();
    res.json({ exists: !!match });
  } catch (err) {
    console.error("GET /auth/mobile-exists", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

app.post("/auth/session-login", customerAuthLimiter, async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: "mobile is required" });

    const Model = getModel("users");
    const matches = await Model.find({ mobile }).lean();
    if (matches.length === 0) return res.status(404).json({ error: "No account exists with this mobile number" });
    if (matches.length > 1) return res.status(409).json({ error: "Multiple accounts found. Contact support." });

    const user = matches[0];
    await createCustomerSession(user.id, req, res);

    const result = stripMeta(user);
    delete result.password;
    res.json({ user: result });
  } catch (err) {
    console.error("POST /auth/session-login", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// POST /auth/session-signup — first-time mobile signup, also used by the
// user panel. Creates the user doc, then immediately starts a session
// the same way session-login does, so signup logs the customer straight in.
app.post("/auth/session-signup", customerAuthLimiter, async (req, res) => {
  try {
    const { name, mobile } = req.body;
    if (!name || !mobile) return res.status(400).json({ error: "name and mobile are required" });

    const Model = getModel("users");
    const existing = await Model.find({ mobile }).lean();
    if (existing.length > 0) return res.status(409).json({ error: "An account already exists with this mobile number" });

    const newUser = {
      id: `user_${mobile}`,
      name: name.trim(),
      mobile,
      favourites: [],
      combo: [],
      orders: [],
    };
    await Model.create(newUser);
    await createCustomerSession(newUser.id, req, res);

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error("POST /auth/session-signup", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// GET /auth/me — called on app mount to restore the logged-in customer
// from the httpOnly cookie, so a page reload keeps them signed in as
// long as the session is valid server-side (rather than trusting
// whatever id happens to be sitting in localStorage).
app.get("/auth/me", requireCustomerAuth, async (req, res) => {
  try {
    const Model = getModel("users");
    const user = await Model.findOne({ id: req.customerUserId }).lean();
    if (!user) return res.status(401).json({ error: "Account not found" });

    const result = stripMeta(user);
    delete result.password;
    res.json({ user: result });
  } catch (err) {
    console.error("GET /auth/me", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// POST /auth/logout — clears the customer session, both server-side
// (so the cookie can't be replayed) and the cookie itself.
app.post("/auth/logout", async (req, res) => {
  try {
    const sessionId = req.cookies ? req.cookies[customerCookieName()] : null;
    if (sessionId) await CustomerSession.deleteOne({ sessionId });
    res.clearCookie(customerCookieName(), customerCookieOpts());
    res.json({ success: true });
  } catch (err) {
    console.error("POST /auth/logout", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   POST /orders/:id/bill-printed — the admin panel calls this after the
   thermal printer confirms a bill printed. Ends the customer's session.
───────────────────────────────────────── */
app.post("/orders/:id/bill-printed", requireAdminAuth, async (req, res) => {
  try {
    const expired = await expireCustomerSessionsForOrder(req.params.id, "bill-printed");
    res.json({ success: true, sessionsExpired: expired });
  } catch (err) {
    console.error("POST /orders/:id/bill-printed", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   GET /orders/mine — a logged-in customer's own order history.
   Registered BEFORE the generic /orders loop (which requires admin
   auth) so this customer-facing route takes priority. Reads from the
   orders collection directly (rather than the embedded copy on the
   user doc) so it stays correct even if an order is later updated
   (status changes, etc.) after being embedded at creation time.
───────────────────────────────────────── */
app.get("/orders/mine", requireCustomerAuth, async (req, res) => {
  try {
    const docs = await getModel("orders")
      .find({ userId: req.customerUserId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(docs.map(stripMeta));
  } catch (err) {
    console.error("GET /orders/mine", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   PATCH /users/me/favourites — toggle a dish in the logged-in
   customer's own favourites. Registered BEFORE the generic /users
   loop (which requires admin auth via requireAdminAuth) so this
   customer-facing route takes priority — the wishlist heart on the
   food list/grid/expanded pages calls this with the customer's own
   session cookie, which the generic admin-only /users/:id route
   would otherwise reject outright (401/403), silently failing the
   toggle with no visible error to the customer.
   Body: the favourite object to add ({ id, name, image, ... }), or
   { id, _remove: true } to remove one. Returns the updated user doc
   so the caller can refresh currentUser.favourites in one round trip.
───────────────────────────────────────── */
app.patch("/users/me/favourites", requireCustomerAuth, async (req, res) => {
  try {
    const favourite = req.body || {};
    if (!favourite.id) return res.status(400).json({ error: "favourite.id is required" });

    const Model = getModel("users");

    // Single atomic update instead of a read-then-write pair — halves the
    // DB round trips per toggle (was: findOne, then findOneAndUpdate).
    // $pull/$addToSet both operate directly on the stored array, so no
    // separate read of the current favourites is needed first.
    const update = favourite._remove
      ? { $pull: { favourites: { id: favourite.id } } }
      : { $addToSet: { favourites: favourite } };

    const updated = await Model.findOneAndUpdate(
      { id: req.customerUserId },
      update,
      { returnDocument: "after" }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Account not found" });

    const result = stripMeta(updated);
    delete result.password;
    res.json(result);
  } catch (err) {
    console.error("PATCH /users/me/favourites", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   GET /users/me — the logged-in customer's own profile. Registered
   BEFORE the generic /users/:id loop (admin-only) so this takes
   priority for a customer's own session. Used by every booking form
   to pre-fill name/mobile/email (bookingCrud.resolveUser()) instead
   of the admin-gated GET /users/:id, which always 401s for a
   customer session.
───────────────────────────────────────── */
app.get("/users/me", requireCustomerAuth, async (req, res) => {
  try {
    const user = await getModel("users").findOne({ id: req.customerUserId }).lean();
    if (!user) return res.status(404).json({ error: "Account not found" });
    const result = stripMeta(user);
    delete result.password;
    res.json(result);
  } catch (err) {
    console.error("GET /users/me", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   PATCH /users/me — update the logged-in customer's own profile
   fields (name, mobile, email, combo favourites, etc.). Deliberately
   allowlists which fields can be self-updated rather than accepting
   a raw full-document overwrite — the users collection is shared with
   staff/admin accounts and carries a `role` field, so blindly trusting
   client-supplied fields here would let a customer escalate their own
   account. Add to ALLOWED_SELF_UPDATE_FIELDS as new self-editable
   profile fields are introduced.
───────────────────────────────────────── */
const ALLOWED_SELF_UPDATE_FIELDS = ["name", "mobile", "email", "combo", "address"];
app.patch("/users/me", requireCustomerAuth, async (req, res) => {
  try {
    const update = {};
    for (const field of ALLOWED_SELF_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        update[field] = req.body[field];
      }
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await getModel("users")
      .findOneAndUpdate({ id: req.customerUserId }, update, { returnDocument: "after" })
      .lean();
    if (!updated) return res.status(404).json({ error: "Account not found" });

    const result = stripMeta(updated);
    delete result.password;
    res.json(result);
  } catch (err) {
    console.error("PATCH /users/me", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});


/**
 * requireCustomerAuthOrNext — same cookie/session check as
 * requireCustomerAuth, but used only on the booking routes below,
 * which are registered at the same paths (/reservations, etc.) as the
 * admin-scoped ARRAY_COLLECTIONS routes further down this file.
 *
 * requireCustomerAuth hard-401s when there's no valid dishkyid
 * cookie — correct for customer-only routes like /auth/me, but wrong
 * here: Express matches routes in registration order, so if this
 * block 401'd on a missing/expired customer cookie, an admin session
 * (which only ever carries dishkyid, never dishkyid) would
 * never reach the real admin-scoped handler for these same paths
 * registered later — every admin request to /reservations,
 * /celebrations, /preBookings, /cateringOrders, and /eventBookings
 * would 401 outright, regardless of how valid the admin's own session
 * was. (This was live in production: any leftover/expired dishkyid
 * cookie from previously using the customer-facing panel in the same
 * browser was enough to make GET /reservations etc. always return
 * "Session expired" for an admin, no matter which role logged in.)
 *
 * Falling through via next() when there's no valid customer session
 * lets the request continue on to the admin-scoped handler further
 * down instead of dead-ending here. A genuine customer session is
 * still required (and still enforced) for the customer-scoped
 * behavior itself — this only changes what happens when that specific
 * session is absent.
 */
async function requireCustomerAuthOrNext(req, res, next) {
  try {
    const sessionId = req.cookies ? req.cookies[customerCookieName()] : null;
    if (!sessionId) return next("route");

    const session = await CustomerSession.findOne({ sessionId }).lean();
    if (!session || session.expiresAt < new Date()) {
      return next("route");
    }

    CustomerSession.updateOne(
      { sessionId },
      { $set: { lastActive: new Date(), expiresAt: new Date(Date.now() + CUSTOMER_SESSION_TTL_MS) } }
    ).catch(() => { });

    req.customerSessionId = sessionId;
    req.customerUserId = session.userId;
    next();
  } catch (err) {
    console.error("requireCustomerAuthOrNext error:", err.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}

/* ─────────────────────────────────────────
   Customer-scoped booking routes: reservations, celebrations,
   preBookings, cateringOrders, eventBookings.
   Registered BEFORE the generic ARRAY_COLLECTIONS loop (admin-only)
   so these take priority for a customer session. Mirrors the exact
   shape the admin panel and eventBookingCrud.js (User Panel) already
   expect — same collections, same id/status conventions — the only
   difference is the auth guard and that reads/updates/deletes are
   scoped to the caller's own userId so one customer can never see or
   modify another's bookings.

   Uses requireCustomerAuthOrNext (not requireCustomerAuth): when
   there's no valid customer session, the request falls through to the
   admin-scoped ARRAY_COLLECTIONS handler for the same path instead of
   401ing outright — see that function's comment for why the plain
   401-on-missing-cookie version broke every admin request to these
   exact paths.
───────────────────────────────────────── */
const CUSTOMER_BOOKING_COLLECTIONS = [
  "reservations",
  "celebrations",
  "preBookings",
  "cateringOrders",
  "eventBookings",
];

CUSTOMER_BOOKING_COLLECTIONS.forEach((name) => {
  const base = `/${name}`;

  // POST /reservations (etc.) — create a booking owned by the caller.
  // Forces userId to the authenticated session regardless of what the
  // client sent, so a customer can never create a booking under
  // someone else's account.
  app.post(base, requireCustomerAuthOrNext, async (req, res) => {
    try {
      const Model = getModel(name);
      const doc = { ...req.body, userId: req.customerUserId };
      const created = await Model.create(doc);
      const result = stripMeta(created.toObject ? created.toObject() : created);
      emitChange(name, "created", result);
      notifyNewBooking(name, result);
      res.status(201).json(result);
    } catch (err) {
      console.error(`POST ${base} (customer)`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /reservations (etc.) — the caller's own bookings only.
  app.get(base, requireCustomerAuthOrNext, async (req, res) => {
    try {
      const docs = await getModel(name)
        .find({ userId: req.customerUserId })
        .sort({ createdAt: -1 })
        .lean();
      res.json(docs.map(stripMeta));
    } catch (err) {
      console.error(`GET ${base} (customer)`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /reservations/:id (etc.) — single booking, only if it's the
  // caller's own (404s rather than 403s if it belongs to someone
  // else, so as not to leak whether the id exists at all).
  app.get(`${base}/:id`, requireCustomerAuthOrNext, async (req, res) => {
    try {
      const doc = await getModel(name)
        .findOne({ id: req.params.id, userId: req.customerUserId })
        .lean();
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(stripMeta(doc));
    } catch (err) {
      console.error(`GET ${base}/:id (customer)`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // PUT /reservations/:id (etc.) — update, own bookings only. Used for
  // cancellation (status → "cancelled") via bookingCrud.cancel().
  // userId is re-forced to the caller's own id on every update so a
  // crafted payload can never reassign a booking to another account.
  app.put(`${base}/:id`, requireCustomerAuthOrNext, async (req, res) => {
    try {
      const Model = getModel(name);
      const update = { ...req.body, userId: req.customerUserId };
      const updated = await Model.findOneAndUpdate(
        { id: req.params.id, userId: req.customerUserId },
        update,
        { returnDocument: "after" }
      ).lean();
      if (!updated) return res.status(404).json({ error: "Not found" });
      const result = stripMeta(updated);
      emitChange(name, "updated", result);
      res.json(result);
    } catch (err) {
      console.error(`PUT ${base}/:id (customer)`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // DELETE /reservations/:id (etc.) — own bookings only.
  app.delete(`${base}/:id`, requireCustomerAuthOrNext, async (req, res) => {
    try {
      const result = await getModel(name).deleteOne({
        id: req.params.id,
        userId: req.customerUserId,
      });
      if (!result.deletedCount) return res.status(404).json({ error: "Not found" });
      emitChange(name, "deleted", req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(`DELETE ${base}/:id (customer)`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });
});

/* ─────────────────────────────────────────
   GET /tablePreferences — read-only reference data (dining
   preference options shown in booking forms, e.g. "Window seat",
   "Quiet area"). Not owned by any one user, so no userId scoping —
   any authenticated customer can read the full list. Registered
   BEFORE the generic admin-only loop so a customer session isn't
   rejected trying to populate a booking form's preference dropdown.
───────────────────────────────────────── */
app.get("/tablePreferences", requireCustomerAuth, async (req, res) => {
  try {
    const docs = await getModel("tablePreferences").find({}).lean();
    res.json(docs.map(stripMeta));
  } catch (err) {
    console.error("GET /tablePreferences (customer)", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   ORDERS — dedicated create route
   Registered BEFORE the generic loop so it
   takes priority for POST /orders.
   Assigns a real order id server-side and
   embeds the order into the user doc for
   per-user order history / revenue stats.

   AUTHORIZATION NOTE: this route is intentionally reachable without a
   customer session (guest/dine-in orders placed before any login are
   a legitimate flow). However, IF the order should be associated with
   a specific customer's account (userId), that association must come
   from the caller's own verified session cookie — never from
   req.body.userId. Previously this route did `{ ...req.body }`
   verbatim and trusted whatever userId the client sent, which let
   anyone attach an order (and therefore inject an entry into
   GET /orders/mine) onto ANY other customer's account just by naming
   their id — a textbook IDOR/BOLA. A logged-out visitor's order is now
   simply placed without a userId (guest order) rather than accepting
   an unverified one.
───────────────────────────────────────── */
app.post("/orders", async (req, res) => {
  try {
    // Only ever trust a userId derived from the caller's own verified
    // session — req.body.userId is discarded entirely, never merged in.
    // attenderId / attenderName are likewise never taken from the body: they are
    // stamped below from the attender's own verified session. `attenderOrder` is
    // only the browser saying "this order is being taken by an attender".
    const {
      userId: _ignoredClientUserId,
      paymentStatus: _ignoredClientPaymentStatus,
      attenderId: _ignoredClientAttenderId,
      attenderName: _ignoredClientAttenderName,
      attenderOrder,
      ...restOfBody
    } = req.body || {};
    const newOrder = { ...restOfBody };

    const sessionId = req.cookies ? req.cookies[customerCookieName()] : null;
    if (sessionId) {
      const session = await CustomerSession.findOne({ sessionId }).lean();
      if (session && session.expiresAt >= new Date()) {
        newOrder.userId = session.userId; // verified — this is genuinely the logged-in customer
      }
      // An invalid/expired cookie doesn't error the order out — it's
      // simply placed as a guest order, same as no cookie at all.
    }

    // Order taken by an attender at a table: must come from a signed-in attender
    // (otherwise the attender's name would silently go missing from the KOT and
    // receipt, so refuse and let the app ask them to sign in again). The order
    // belongs to the table's guest, never to a customer account that happens to
    // be signed in on the same device.
    if (attenderOrder === true) {
      const attender = await attendersModule.resolveAttender(req);
      if (!attender) {
        return res.status(401).json({ error: "Attender session expired. Please sign in again.", code: "ATTENDER_SESSION_EXPIRED" });
      }
      delete newOrder.userId;
      newOrder.attenderId = attender.id;
      newOrder.attenderName = attender.name;
    }

    // Guest-reachable route: never trust client-chosen workflow state.
    // A new order always starts as "placed" (what placeOrder.js sends anyway).
    newOrder.status = "placed";
    // Bound the payload a guest can submit so one request can't zero out stock
    // or bloat the orders collection.
    if (!Array.isArray(newOrder.items) || newOrder.items.length === 0 || newOrder.items.length > 100) {
      return res.status(400).json({ error: "Order must contain between 1 and 100 items" });
    }
    for (const it of newOrder.items) {
      const q = Number(it && it.quantity);
      if (!Number.isFinite(q) || q < 1 || q > 100) {
        return res.status(400).json({ error: "Each item quantity must be between 1 and 100" });
      }
    }
    // A client-supplied venueId must refer to a real venue; otherwise fall back below.
    if (newOrder.venueId) {
      const { Venue: VenueModel } = venuesModule;
      const venueExists = await VenueModel.exists({ id: String(newOrder.venueId) });
      if (!venueExists) newOrder.venueId = null;
    }

    // Recompute money server-side; never persist client-supplied totals.
    if (!newOrder.venueId) {
      const { Venue: V0 } = venuesModule;
      const fb = await V0.findOne().sort({ createdAt: 1 }).lean();
      newOrder.venueId = fb ? fb.id : null;
    }
    const priced = await priceOrderServerSide(newOrder.items, newOrder.venueId);
    if (priced.error) return res.status(400).json({ error: priced.error });
    newOrder.items = priced.items;
    newOrder.totalAmount = priced.totalAmount;
    newOrder.totalWithGST = priced.totalWithGST;

    // Table already has an open bill? Add these dishes to it (see ONE BILL PER TABLE above).
    const appended = await appendToOpenBill(newOrder);

    let result;
    let newItems;
    if (appended) {
      result = appended.order;
      newItems = appended.addedItems;
    } else {
      newOrder.id = await generateOrderId();
      // Time is stamped by the server so the order-status board and kitchen timers never depend on a customer's clock.
      newOrder.createdAt = new Date().toISOString();
      // Every new order starts unpaid — flips to "completed" once an admin
      // confirms a scanned UPI QR payment for it (see payments.js). Always
      // server-set, regardless of what the client sent — a customer could
      // otherwise place an order that already claims to be paid.
      newOrder.paymentStatus = "pending";
      // Customer-facing order placement doesn't go through admin auth, so it
      // can't be scoped from req.admin. The user panel should send venueId
      // once it has branch selection; until then, fall back to whichever
      // venue was created first (Main Branch) so orders aren't lost/orphaned.
      if (!newOrder.venueId) {
        const { Venue } = venuesModule;
        const fallback = await Venue.findOne().sort({ createdAt: 1 }).lean();
        newOrder.venueId = fallback ? fallback.id : null;
      }

      // Remember which attender took each dish, so a table's bill can be filtered per attender.
      if (newOrder.attenderName && Array.isArray(newOrder.items)) {
        newOrder.items = newOrder.items.map((i) => ({ ...i, attenderId: newOrder.attenderId, attenderName: newOrder.attenderName }));
      }
      const doc = await getModel("orders").create(newOrder);
      result = stripMeta(doc.toObject());
      newItems = result.items;
    }

    // Embed a copy into the user document for quick history lookups
    if (result.userId) {
      try {
        if (appended) {
          await getModel("users").updateOne({ id: result.userId, "orders.id": result.id }, { $set: { "orders.$": result } });
        } else {
          await getModel("users").updateOne({ id: result.userId }, { $push: { orders: result } });
        }
      } catch (embedErr) {
        console.warn("Could not embed order in user doc:", embedErr.message);
      }
    }

    // Deduct consumed ingredient stock server-side, using the ingredient
    // quantities already embedded on each order item (item.ingredients,
    // each { name, quantity } in grams). This used to run client-side —
    // the customer's browser would fetch the ENTIRE ingredients
    // collection (including every other ingredient's current stock
    // level) and push authenticated writes back to it directly, which
    // is both an unnecessary data exposure and, now that admin routes
    // are properly session-gated, simply can't work from a customer
    // session at all. Doing it here means the customer only ever sends
    // what they ordered; the server computes and applies the deduction
    // with the same access it already has for order creation, and a
    // failure here doesn't roll back or block the order itself — stock
    // accuracy issues (e.g. a race between two simultaneous orders) are
    // worth fixing but shouldn't ever prevent someone's food order from
    // going through.
    try {
      const usedKgByName = new Map();
      // Only the dishes just ordered use up stock (an appended bill already paid for the rest).
      for (const item of Array.isArray(newItems) ? newItems : []) {
        const qty = Number(item.quantity) || 1;
        for (const ing of Array.isArray(item.ingredients) ? item.ingredients : []) {
          if (!ing?.name) continue;
          const usedKg = ((Number(ing.quantity) || 0) * qty) / 1000;
          if (usedKg <= 0) continue;
          usedKgByName.set(ing.name, (usedKgByName.get(ing.name) || 0) + usedKg);
        }
      }

      // Ingredients linked to an inventory item are consumed through the stock ledger (FEFO);
      // everything else keeps the legacy direct decrement below.
      if (usedKgByName.size) {
        const handled = await ingredientBridge.consumeForOrder({
          venueId: result.venueId, orderId: result.id, tag: `n${(result.items || []).length}`, usedKgByName,
        });
        for (const name of handled) usedKgByName.delete(name);
      }

      if (usedKgByName.size) {
        const IngredientModel = getModel("ingredients");
        await Promise.all(
          Array.from(usedKgByName.entries()).map(([name, usedKg]) =>
            // $inc with a negative value is atomic — two orders deducting
            // the same ingredient concurrently can't clobber each other's
            // write the way a client-side read-then-write round trip
            // could. Floors at 0 in a follow-up clamp rather than letting
            // stock go negative under high concurrency.
            IngredientModel.updateOne({ name, venueId: result.venueId }, { $inc: { stockRemaining: -usedKg } })
          )
        );
        await IngredientModel.updateMany(
          { name: { $in: Array.from(usedKgByName.keys()) }, venueId: result.venueId, stockRemaining: { $lt: 0 } },
          { $set: { stockRemaining: 0 } }
        );
      }
    } catch (stockErr) {
      console.warn("Could not deduct ingredient stock for order", result.id, stockErr.message);
    }

    emitChange("orders", appended ? "updated" : "created", result);
    // `appended` / `newItems` tell the user panel this joined an open bill and which dishes are new (for the KOT).
    res.status(201).json(appended ? { ...result, appended: true, newItems } : result);
  } catch (err) {
    console.error("POST /orders", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});


/* ─────────────────────────────────────────
   LOYALTY — settings per venue + manual point adjustments per customer.
   Previously the admin panel kept both only in each browser's localStorage
   (these routes did not exist), so different devices disagreed.
───────────────────────────────────────── */
function loyaltyVenueKey(req) {
  const f = scopeFilter(req);
  return f.venueId || "global";
}
app.get("/settings/loyalty", requireAdminAuth, requirePerm("users", "read"), async (req, res) => {
  try {
    const doc = await getModel("loyaltySettings").findOne({ id: `loyalty:${loyaltyVenueKey(req)}` }).lean();
    res.json(doc ? stripMeta(doc).settings || {} : {});
  } catch (err) {
    console.error("GET /settings/loyalty", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
app.put("/settings/loyalty", requireAdminAuth, requirePerm("users", "write"), async (req, res) => {
  try {
    const settings = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e6) settings[k] = v;
      else if (typeof v === "string" && v.length <= 200) settings[k] = v;
      else if (v && typeof v === "object" && !Array.isArray(v)) settings[k] = v; // tier thresholds etc. (shape already guarded globally)
      else if (typeof v === "boolean") settings[k] = v;
    }
    const id = `loyalty:${loyaltyVenueKey(req)}`;
    const before = await getModel("loyaltySettings").findOne({ id }).lean();
    await getModel("loyaltySettings").findOneAndUpdate(
      { id },
      { $set: { id, venueId: scopeFilter(req).venueId || null, settings } },
      { upsert: true }
    );
    logAudit(req, { action: "update", resource: "loyaltySettings", targetId: id, before: before && before.settings, after: settings });
    res.json(settings);
  } catch (err) {
    console.error("PUT /settings/loyalty", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
app.get("/users/:id/loyalty-adjustments", requireAdminAuth, requirePerm("users", "read"), async (req, res) => {
  try {
    const user = await getModel("users").findOne({ ...scopeFilter(req), id: req.params.id }).select("id").lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    const docs = await getModel("loyaltyAdjustments").find({ userId: req.params.id }).sort({ date: 1 }).lean();
    res.json(docs.map(stripMeta).map(({ userId, venueId, ...rest }) => rest));
  } catch (err) {
    console.error("GET loyalty-adjustments", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});
app.post("/users/:id/loyalty-adjustments", requireAdminAuth, requirePerm("users", "write"), async (req, res) => {
  try {
    const user = await getModel("users").findOne({ ...scopeFilter(req), id: req.params.id }).select("id venueId").lean();
    if (!user) return res.status(404).json({ error: "Not found" });
    const points = Number(req.body && req.body.points);
    if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100000) {
      return res.status(400).json({ error: "points must be a non-zero number" });
    }
    const entry = {
      id: (typeof req.body.id === "string" && req.body.id.slice(0, 60)) || `adj_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      userId: req.params.id,
      venueId: user.venueId || null,
      points,
      reason: String(req.body.reason || "").slice(0, 500),
      staffName: String((req.admin && req.admin.name) || req.body.staffName || "Staff").slice(0, 100),
      date: new Date().toISOString(),
    };
    await getModel("loyaltyAdjustments").findOneAndUpdate({ id: entry.id }, { $setOnInsert: entry }, { upsert: true });
    logAudit(req, { action: "create", resource: "loyaltyAdjustments", targetId: entry.id, after: entry });
    const { userId, venueId, ...out } = entry;
    res.status(201).json(out);
  } catch (err) {
    console.error("POST loyalty-adjustments", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   ARRAY COLLECTION ROUTES — venue-scoped + permission-matrix-gated

   Every collection here is multi-tenant: every document carries a
   venueId, every request is authenticated, and every read/write is
   checked against the permission matrix (permissions.js) for the
   caller's roleTitle + this module. Super Admin always passes and
   can optionally scope to one venue via ?venueId= (the venue
   switcher) — omit it to see all venues combined.

   Non-Super-Admin callers are hard-scoped to their own venueId
   (req.admin.venueId) on every op — they can never read, create,
   update, or delete another venue's data, even if they pass a
   different venueId explicitly.

   Every write is recorded to the audit log (auditLog.js).
───────────────────────────────────────── */

/** requirePerm(name, action) — auth + permission-matrix check for a given module. */
function requirePerm(name, action) {
  return async (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: "Not logged in" });
    // Plan gate: a module the restaurant's plan doesn't include is unavailable
    // to everyone, Super Admin included.
    if (req.tenant && !req.tenant.entitlements.modules.includes(name)) {
      return res.status(402).json({
        error: "This feature is not included in your current plan.",
        code: "PLAN_UPGRADE_REQUIRED",
        module: name,
        upgradeUrl: `${process.env.PUBLIC_SITE_URL || "https://www.dishky.com"}/account/billing`,
      });
    }
    const ok = await hasPermission(req.admin, name, action);
    if (!ok) {
      // Authorization failures are worth their own audit trail entry —
      // repeated denials against the same resource/admin are exactly
      // the kind of pattern that indicates a compromised session probing
      // for access, or a genuine privilege-escalation attempt, and
      // logAudit() is fire-and-forget (doesn't block the response).
      logAudit(req, { action: "authz_denied", resource: name, targetId: action });
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/**
 * scopeFilter(req) — the venueId filter to apply to a query.
 *   Super Admin + no ?venueId=  -> {} (see everything)
 *   Super Admin + ?venueId=X    -> { venueId: X }
 *   Everyone else               -> { venueId: req.admin.venueId } (forced)
 */
function scopeFilter(req) {
  if (req.admin.roleGroup === "Super Admin") {
    const venueId = asPlainString(req.query.venueId);
    return venueId ? { venueId } : {};
  }
  return { venueId: req.admin.venueId };
}

/**
 * A venueId named by a client must be one of THIS restaurant's venues. Without
 * this a Super Admin could stamp records with another restaurant's venue id
 * (they would stay invisible to that restaurant, but the dangling reference is
 * still wrong data).
 */
async function venueBelongsToTenant(venueId) {
  if (!venueId) return false;
  return !!(await venuesModule.Venue.exists({ id: String(venueId) }));
}

/** The venueId a new document created by req.admin should be stamped with. */
function scopeVenueForCreate(req) {
  if (req.admin.roleGroup === "Super Admin") {
    // Super Admin must specify which venue a new record belongs to.
    return asPlainString(req.body.venueId) || asPlainString(req.query.venueId) || null;
  }
  return req.admin.venueId;
}

/**
 * Public menu-browsing routes — no session required at all.
 *
 * The user panel's fetchMenu() needs categories/ingredients/combo/offers/
 * tables/events before a customer has ever logged in (or even created an
 * account) — that's the whole point of browsing a menu. These were
 * previously served by the generic ARRAY_COLLECTIONS routes below, which
 * are gated by requireAdminAuth — correct for the admin panel's writes,
 * but wrong for a guest's read-only menu view, and the actual cause of
 * every "Failed to load menu" 401 a first-time visitor saw. Root-caused
 * the same session as the /users/me/favourites fix (same underlying
 * pattern: a customer-facing call was hitting an admin-only route).
 *
 * Kept intentionally narrow and read-only — only the exact collections
 * fetchMenu() actually needs for guest browsing. Orders/favourites for a
 * *specific* customer still correctly require a session (see /auth/me,
 * /orders/mine, /users/me/favourites above) — a public route can't know
 * who's asking, so those aren't included here.
 */
/**
 * GET /public/restaurant — what the customer app needs to render a restaurant
 * landing page from dishky.com/<restaurant>: name, branding, and its venues.
 * The restaurant comes from the X-Restaurant header (set from the URL).
 */
app.get("/public/restaurant", async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: "Restaurant not found", code: "RESTAURANT_NOT_FOUND" });
    const { Venue } = venuesModule;
    const venues = await Venue.find({ status: "active" }).sort({ isMainBranch: -1, name: 1 }).select("id name slug area isMainBranch").lean();
    const r = req.tenant.restaurant;
    res.json({
      restaurant: { slug: r.slug, name: r.name, branding: r.branding || {} },
      venues: venues.filter((v) => v.slug).map((v) => ({ id: v.id, name: v.name, slug: v.slug, area: v.area, isMainBranch: !!v.isMainBranch })),
      acceptingOrders: req.tenant.access.level === "full",
    });
  } catch (err) {
    console.error("GET /public/restaurant", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/**
 * GET /public/resolve?venue=<venue-slug>&table=<table-number> — turns the URL
 * dishky.com/<restaurant>/<venue>/<table> into ids, and says whether that
 * table really exists at that venue (a typo'd or stale QR code is told so
 * instead of silently ordering for a table that isn't there).
 */
app.get("/public/resolve", async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: "Restaurant not found", code: "RESTAURANT_NOT_FOUND" });
    const venueSlug = asPlainString(req.query.venue).toLowerCase();
    const table = asPlainString(req.query.table);
    const { Venue } = venuesModule;
    const venue = venueSlug ? await Venue.findOne({ slug: venueSlug, status: "active" }).lean() : null;
    if (!venue) return res.status(404).json({ error: "Venue not found", code: "VENUE_NOT_FOUND" });
    let tableOk = null;
    if (table) {
      const docs = await getModel("tables").find({ venueId: venue.id }).lean();
      tableOk = docs.some((d) => Array.isArray(d.list) && d.list.map(String).includes(table));
    }
    res.json({
      restaurant: { slug: req.tenant.restaurant.slug, name: req.tenant.restaurant.name, branding: req.tenant.restaurant.branding || {} },
      venue: { id: venue.id, name: venue.name, slug: venue.slug, area: venue.area },
      table: table ? { number: table, valid: tableOk } : null,
      acceptingOrders: req.tenant.access.level === "full",
    });
  } catch (err) {
    console.error("GET /public/resolve", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/**
 * GET /public/display/orders?venueId=<id> — feeds the in-restaurant order
 * status board at dishky.com/<restaurant>/<venue>/display (a screen guests can
 * see: "preparing" / "ready for pickup"). Read-only and deliberately minimal:
 * today's recent orders for ONE venue, with no prices, totals, phone numbers,
 * notes or payment data, and only the customer's first name.
 */
app.get("/public/display/orders", async (req, res) => {
  try {
    if (!req.tenant) return res.status(404).json({ error: "Restaurant not found", code: "RESTAURANT_NOT_FOUND" });
    const venueId = asPlainString(req.query.venueId);
    if (!venueId) return res.status(400).json({ error: "venueId is required" });
    if (!(await venuesModule.Venue.exists({ id: venueId, status: "active" }))) {
      return res.status(404).json({ error: "Venue not found", code: "VENUE_NOT_FOUND" });
    }
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const docs = await getModel("orders")
      .find({ venueId, createdAt: { $gte: since.toISOString() } })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.set("Cache-Control", "no-store");
    res.json(docs
      .filter((o) => String(o.status || "").toLowerCase() !== "cancelled")
      .map((o) => ({
        id: o.id,
        status: o.status,
        mode: o.mode,
        tableNo: o.tableNo,
        time: o.time,
        date: o.date,
        createdAt: o.createdAt,
        priority: !!o.priority,
        userName: o.userName ? String(o.userName).trim().split(/\s+/)[0] : "",
        items: (Array.isArray(o.items) ? o.items : []).map((i) => ({
          dishName: i.dishName || i.name,
          quantity: i.quantity,
          status: i.status,
          selectedSize: i.selectedSize,
        })),
      })));
  } catch (err) {
    console.error("GET /public/display/orders", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

const PUBLIC_MENU_COLLECTIONS = ["categories", "ingredients", "combo", "offers", "tables", "events"];
PUBLIC_MENU_COLLECTIONS.forEach((name) => {
  app.get(`/public/${name}`, async (req, res) => {
    try {
      const venueId = asPlainString(req.query.venueId);
      const filter = venueId ? { venueId } : {};
      const docs = await getModel(name).find(filter).lean();
      res.json(docs.map(stripMeta));
    } catch (err) {
      console.error(`GET /public/${name}`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });
});

// Upload-specific rate limiter — separate from and stricter than the
// general API limiter registered earlier. Any write to the "staff"
// collection's idProof/bonafide/training[].certificate fields, and any
// write to /documents, can trigger a real document-processing pipeline
// (fileThumbnail.js: pdfjs rendering or a full headless LibreOffice
// conversion for DOCX). Each of those is meaningfully more expensive
// than an ordinary CRUD write — CPU, memory, and (for DOCX) an actual
// child process — so beyond validating the file itself, the volume of
// such requests needs its own cap independent of the general limiter,
// per Requirement 9's explicit call for rate limits on upload operations.
const uploadLimiter = buildLimiter("upload", {
  windowMs: 5 * 60 * 1000,
  max: 30, // generous for legitimate staff onboarding/document upkeep, not for sustained abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many file uploads. Please slow down and try again shortly." },
});

/**
 * Tables are stored as one document per venue: { id, list: [1, 2, 3...] }.
 * Before a write that would raise the restaurant's total table count above its
 * plan, refuse it. Returns the new total, or throws a PLAN_LIMIT error.
 */
async function assertTablesWithinPlan(newList, _docId, venueId) {
  if (!Array.isArray(newList)) return;
  for (const t of newList) {
    const bad = slugsLib.validateTableId(t);
    if (bad) throw Object.assign(new Error(bad), { status: 400 });
  }
  if (new Set(newList.map(String)).size !== newList.length) {
    throw Object.assign(new Error("Table numbers must be unique"), { status: 400 });
  }
  // Everything the restaurant has in OTHER venues counts; this venue's list is being replaced.
  const docs = await getModel("tables").find({}).lean();
  const othersTotal = docs
    .filter((d) => d.venueId !== venueId)
    .reduce((n, d) => n + (Array.isArray(d.list) ? d.list.length : 0), 0);
  const state = await subscriptionsSvc.getAccessState(currentTenantId());
  const limit = state.entitlements.maxTables;
  if (limit !== null && limit !== undefined && othersTotal + newList.length > limit) {
    throw Object.assign(new Error(`Your plan allows ${limit} tables. Upgrade your plan to add more.`), {
      status: 402, code: "PLAN_LIMIT", kind: "tables", limit, used: othersTotal + newList.length,
      upgradeUrl: `${process.env.PUBLIC_SITE_URL || "https://www.dishky.com"}/account/billing`,
    });
  }
}
function handleWriteError(res, err, name) {
  if (err.code === "PLAN_LIMIT") return sendLimitError(res, err);
  if (err.status === 400 && name === "tables") return res.status(400).json({ error: err.message });
  return null;
}

ARRAY_COLLECTIONS.forEach((name) => {
  const base = `/${name}`;
  // Only the "staff" collection's writes can carry a file upload
  // (idProof/bonafide/training certificates) — applying uploadLimiter
  // to every other collection's plain CRUD writes would be pointless
  // friction for operations that never touch fileThumbnail.js at all.
  const maybeUploadLimiter = name === "staff" ? [uploadLimiter] : [];

  // GET /collection — list, scoped to caller's venue (or filtered/all for Super Admin)
  app.get(base, requireAdminAuth, requirePerm(name, "read"), async (req, res) => {
    try {
      const docs = await getModel(name).find(scopeFilter(req)).lean();
      res.json(docs.map(stripMeta));
    } catch (err) {
      console.error(`GET /${name}`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /collection/:id — single document by app "id" field, still venue-scoped
  app.get(`${base}/:id`, requireAdminAuth, requirePerm(name, "read"), async (req, res) => {
    try {
      const Model = getModel(name);
      const filter = { ...scopeFilter(req), id: req.params.id };
      let doc = await Model.findOne(filter).lean();
      // Fallback: allow querying by MongoDB _id (still venue-scoped)
      if (!doc && mongoose.Types.ObjectId.isValid(req.params.id)) {
        doc = await Model.findOne({ ...scopeFilter(req), _id: req.params.id }).lean();
      }
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(stripMeta(doc));
    } catch (err) {
      console.error(`GET /${name}/:id`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /collection — create (orders has its own route above)
  if (name !== "orders") {
    app.post(base, requireAdminAuth, ...maybeUploadLimiter, requirePerm(name, "write"), async (req, res) => {
      try {
        const venueId = scopeVenueForCreate(req);
        if (!venueId) {
          return res.status(400).json({ error: "venueId is required (Super Admin must specify one)" });
        }
        if (!(await venueBelongsToTenant(venueId))) return res.status(400).json({ error: "Unknown venue" });
        const body = { ...req.body, venueId };
        if (!body.id) body.id = String(Date.now());
        if (name === "tables") await assertTablesWithinPlan(body.list, body.id, venueId);
        if (name === "staff") await attachStaffFileThumbnails(body, null);
        const doc = await getModel(name).create(body);
        const result = stripMeta(doc.toObject());
        emitChange(name, "created", result);
        notifyNewBooking(name, result);
        logAudit(req, { action: "create", resource: name, targetId: result.id, after: result });
        res.status(201).json(result);
      } catch (err) {
        if (handleWriteError(res, err, name)) return;
        console.error(`POST /${name}`, err.message);
        res.status(err.isValidationError ? 400 : 500).json({ error: err.isValidationError ? err.message : safeErrorMessage(err) });
      }
    });
  }

  // PUT /collection/:id — full replace (upsert so PUT on new id creates it), venue-scoped
  app.put(`${base}/:id`, requireAdminAuth, ...maybeUploadLimiter, requirePerm(name, "write"), async (req, res) => {
    try {
      const filter = { ...scopeFilter(req), id: req.params.id };
      const before = await getModel(name).findOne(filter).lean();
      // On upsert-create, stamp the record with the caller's (or Super
      // Admin's chosen) venue rather than trusting an arbitrary body.venueId.
      const venueId = before ? before.venueId : scopeVenueForCreate(req);
      if (!venueId) {
        return res.status(400).json({ error: "venueId is required (Super Admin must specify one)" });
      }
      if (!before && !(await venueBelongsToTenant(venueId))) return res.status(400).json({ error: "Unknown venue" });
      const body = { ...req.body, id: req.params.id, venueId };
      if (name === "tables") await assertTablesWithinPlan(body.list, req.params.id, venueId);
      if (name === "staff") await attachStaffFileThumbnails(body, before);
      const doc = await getModel(name)
        .findOneAndReplace(filter, body, { returnDocument: "after", upsert: true })
        .lean();
      let result = stripMeta(doc);
      if (name === "ingredients") {
        // linked ingredient: a stock figure changed here becomes a ledger adjustment
        await ingredientBridge.reconcileEdit({ venueId: result.venueId, ingredient: result, user: { id: req.admin.id, name: req.admin.name } });
        result = stripMeta(await getModel(name).findOne({ ...scopeFilter(req), id: result.id }).lean()) || result;
      }
      emitChange(name, "updated", result);
      logAudit(req, { action: "update", resource: name, targetId: result.id, before, after: result });
      res.json(result);
    } catch (err) {
      if (handleWriteError(res, err, name)) return;
      console.error(`PUT /${name}/:id`, err.message);
      res.status(err.isValidationError ? 400 : 500).json({ error: err.isValidationError ? err.message : safeErrorMessage(err) });
    }
  });

  // PATCH /collection/:id — partial update, venue-scoped (never touches another venue's doc)
  app.patch(`${base}/:id`, requireAdminAuth, ...maybeUploadLimiter, requirePerm(name, "write"), async (req, res) => {
    try {
      const filter = { ...scopeFilter(req), id: req.params.id };
      const before = await getModel(name).findOne(filter).lean();
      if (!before) return res.status(404).json({ error: "Not found" });
      // venueId is never editable via PATCH body — reassigning a record to
      // a different venue is a deliberate, separate operation if ever needed.
      const { venueId: _ignoredVenueId, id: _ignoredId, _id: _ignoredMongoId, ...patchBody } = req.body;
      if (name === "tables") await assertTablesWithinPlan(patchBody.list, req.params.id, before.venueId);
      if (name === "staff") await attachStaffFileThumbnails(patchBody, before);
      const doc = await getModel(name)
        .findOneAndUpdate(filter, { $set: patchBody }, { returnDocument: "after" })
        .lean();
      let result = stripMeta(doc);
      if (name === "ingredients" && "stockRemaining" in patchBody) {
        await ingredientBridge.reconcileEdit({ venueId: result.venueId, ingredient: result, user: { id: req.admin.id, name: req.admin.name } });
        result = stripMeta(await getModel(name).findOne({ ...scopeFilter(req), id: result.id }).lean()) || result;
      }
      emitChange(name, "updated", result);
      logAudit(req, { action: "update", resource: name, targetId: result.id, before, after: result });
      res.json(result);
    } catch (err) {
      if (handleWriteError(res, err, name)) return;
      console.error(`PATCH /${name}/:id`, err.message);
      res.status(err.isValidationError ? 400 : 500).json({ error: err.isValidationError ? err.message : safeErrorMessage(err) });
    }
  });

  // DELETE /collection/:id — remove, venue-scoped
  app.delete(`${base}/:id`, requireAdminAuth, requirePerm(name, "write"), async (req, res) => {
    try {
      const filter = { ...scopeFilter(req), id: req.params.id };
      const doc = await getModel(name).findOneAndDelete(filter).lean();
      if (!doc) return res.status(404).json({ error: "Not found" });
      const result = stripMeta(doc);
      emitChange(name, "deleted", result);
      logAudit(req, { action: "delete", resource: name, targetId: result.id, before: result });

      // Every login account must be linked to a real staff record — if
      // the staff record itself is deleted, its login account (if any)
      // is deleted along with it, so an account can never outlive the
      // staff member it belongs to. Session cleanup mirrors the
      // DELETE /staff-auth/admins/:id route.
      if (name === "staff") {
        const { Admin, Session } = require("./src/modules/auth/auth");
        const linkedAccount = await Admin.findOneAndDelete({ staffId: result.id }).lean();
        if (linkedAccount) {
          await Session.deleteMany({ adminId: linkedAccount.id });
          logAudit(req, { action: "delete", resource: "admins", targetId: linkedAccount.id, before: linkedAccount });
        }

        // Back up the deleted staff record into a separate archive
        // collection before it's gone for good, so HR can restore or
        // reference it later. Archiving failure must never block the
        // delete itself from succeeding — it's logged and swallowed.
        try {
          await getModel("staffArchive").create({
            ...result,
            archivedAt: new Date().toISOString(),
            archivedBy: req.admin?.id || null,
          });
        } catch (archiveErr) {
          console.error("Failed to archive deleted staff record", archiveErr.message);
        }
      }

      res.json(result);
    } catch (err) {
      console.error(`DELETE /${name}/:id`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });
});

/* ─────────────────────────────────────────
   STAFF ARCHIVE — backup of deleted staff records

   Every staff record removed via DELETE /staff/:id is copied into this
   collection first (see the DELETE /staff/:id handler above). Read-only
   list here, plus a restore action that recreates the record back in
   the live `staff` collection. Venue-scoped the same way as the main
   ARRAY_COLLECTIONS routes.
───────────────────────────────────────── */
app.get("/staff-archive", requireAdminAuth, requirePerm("staff", "read"), async (req, res) => {
  try {
    const docs = await getModel("staffArchive").find(scopeFilter(req)).lean();
    res.json(docs.map(stripMeta));
  } catch (err) {
    console.error("GET /staff-archive", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

app.post("/staff-archive/:id/restore", requireAdminAuth, requirePerm("staff", "write"), async (req, res) => {
  try {
    const filter = { ...scopeFilter(req), id: req.params.id };
    const archived = await getModel("staffArchive").findOne(filter).lean();
    if (!archived) return res.status(404).json({ error: "Not found in archive" });

    const alreadyExists = await getModel("staff").findOne({ id: archived.id }).lean();
    if (alreadyExists) {
      return res.status(409).json({ error: "A staff record with this id already exists" });
    }

    const restored = { ...archived };
    delete restored.archivedAt;
    delete restored.archivedBy;

    const doc = await getModel("staff").create(restored);
    const result = stripMeta(doc.toObject());
    await getModel("staffArchive").deleteOne(filter);

    emitChange("staff", "created", result);
    logAudit(req, { action: "restore", resource: "staff", targetId: result.id, after: result });
    res.status(201).json(result);
  } catch (err) {
    console.error("POST /staff-archive/:id/restore", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   SINGLETON COLLECTION ROUTES — now one-per-venue

   Previously these were global (a single doc with id="singleton").
   With multi-venue, each branch needs its own grooming/mise/assign
   config, so the "singleton" is now scoped per venueId: the app id
   field becomes `singleton:<venueId>` internally but the API shape
   is unchanged (still returns the bare object, not wrapped).

   `theme` is the one exception carried over from SINGLETON_COLLECTIONS
   below — see the dedicated theme guard further down, which keeps it
   truly global and Super-Admin-only, per the "theme stays global"
   decision.

   GET    /collection   → returns the object for the caller's venue
                           (or ?venueId= for Super Admin), or {} if unseeded
   PUT    /collection   → full replace (upsert) for that venue
   PATCH  /collection   → partial merge update (upsert) for that venue
───────────────────────────────────────── */
const GLOBAL_SINGLETONS = new Set(["theme", "categoryCards"]); // Super Admin only, not venue-scoped
const VENUE_SINGLETONS = SINGLETON_COLLECTIONS.filter((n) => !GLOBAL_SINGLETONS.has(n));

function singletonIdFor(name, venueId) {
  return GLOBAL_SINGLETONS.has(name) ? "singleton" : `singleton:${venueId}`;
}

/** Which venueId a singleton read/write should target for this caller. */
function singletonVenueId(req) {
  if (!req.admin) {
    throw new Error("singletonVenueId called without req.admin — auth middleware did not run first");
  }
  if (req.admin.roleGroup === "Super Admin") {
    return asPlainString(req.query?.venueId) || asPlainString(req.body?.venueId) || null;
  }
  return req.admin.venueId;
}

VENUE_SINGLETONS.forEach((name) => {
  const base = `/${name}`;

  app.get(base, requireAdminAuth, requirePerm(name, "read"), async (req, res) => {
    try {
      const venueId = singletonVenueId(req);
      if (!venueId) return res.json({}); // Super Admin with no venue picked yet
      const doc = await getModel(name).findOne({ id: singletonIdFor(name, venueId) }).lean();
      if (!doc) return res.json({});
      const { _id, __v, id, ...rest } = doc;
      res.json(rest);
    } catch (err) {
      console.error(`GET /${name}`, err.message, err.stack);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  app.put(base, requireAdminAuth, requirePerm(name, "write"), async (req, res) => {
    try {
      const venueId = singletonVenueId(req);
      if (!venueId) return res.status(400).json({ error: "venueId is required (Super Admin must specify one)" });
      if (!(await venueBelongsToTenant(venueId))) return res.status(400).json({ error: "Unknown venue" });
      const before = await getModel(name).findOne({ id: singletonIdFor(name, venueId) }).lean();
      const body = { ...req.body, id: singletonIdFor(name, venueId), venueId };
      const doc = await getModel(name)
        .findOneAndReplace({ id: singletonIdFor(name, venueId) }, body, { returnDocument: "after", upsert: true })
        .lean();
      const { _id, __v, id, ...result } = doc;
      emitChange(name, "updated", result);
      logAudit(req, { action: "update", resource: name, targetId: venueId, before, after: result });
      res.json(result);
    } catch (err) {
      console.error(`PUT /${name}`, err.message, err.stack);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  app.patch(base, requireAdminAuth, requirePerm(name, "write"), async (req, res) => {
    try {
      const venueId = singletonVenueId(req);
      if (!venueId) return res.status(400).json({ error: "venueId is required (Super Admin must specify one)" });
      if (!(await venueBelongsToTenant(venueId))) return res.status(400).json({ error: "Unknown venue" });
      const before = await getModel(name).findOne({ id: singletonIdFor(name, venueId) }).lean();
      const { venueId: _ignored, ...patchBody } = req.body;
      const doc = await getModel(name)
        .findOneAndUpdate(
          { id: singletonIdFor(name, venueId) },
          { $set: { ...patchBody, venueId } },
          { returnDocument: "after", upsert: true }
        )
        .lean();
      const { _id, __v, id, ...result } = doc;
      emitChange(name, "updated", result);
      logAudit(req, { action: "update", resource: name, targetId: venueId, before, after: result });
      res.json(result);
    } catch (err) {
      console.error(`PATCH /${name}`, err.message, err.stack);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });
});

/* ─────────────────────────────────────────
   COMBO OFFERS — public read
   Powers the "Offer applied" notification banner in the user-panel
   Combo builder (ComboPage.js) — same problem and same fix as
   combo-section-config/public above: combo_offers is an ARRAY_COLLECTION
   behind requireAdminAuth, but the user panel only ever holds a customer
   session. Read-only; writes still go through the Super-Admin-gated
   /combo_offers route. Resolves to the main branch for the same reason
   documented on combo-section-config/public.
───────────────────────────────────────── */
app.get("/combo-offers/public", async (req, res) => {
  try {
    const { Venue } = venuesModule;
    const wanted = asPlainString(req.query.venueId);
    const mainBranch = (wanted && (await Venue.findOne({ id: wanted }).lean())) ||
      (await Venue.findOne({ isMainBranch: true }).lean()) || (await Venue.findOne().sort({ createdAt: 1 }).lean());
    if (!mainBranch) return res.json([]);

    const docs = await getModel("combo_offers").find({ venueId: mainBranch.id }).lean();
    res.json(docs.map(stripMeta));
  } catch (err) {
    console.error("GET /combo-offers/public", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   COMBO SECTION CONFIG — public read
   The user-panel Combo page (ComboPage.js) needs to read the admin's
   category → combo-section mapping (Manage Combo Categories), but that
   config lives in the venue-scoped comboSectionConfig singleton behind
   requireAdminAuth — the user panel is a public/customer surface that
   only ever holds a customer session cookie, never an admin one, so it
   can never satisfy that check. Mirrors GET /category-cards/public
   above: a dedicated, read-only, unauthenticated route for the one
   customer-facing page that needs this data.
   The user panel has no venue concept of its own (single-storefront
   app), so this always resolves to whichever venue is currently marked
   as the main branch — falling back to the oldest-created venue if none
   is explicitly marked yet, matching ensureMainBranchAndBackfill()'s own
   fallback logic below.
───────────────────────────────────────── */
app.get("/combo-section-config/public", async (req, res) => {
  try {
    const { Venue } = venuesModule;
    const wanted = asPlainString(req.query.venueId);
    const mainBranch = (wanted && (await Venue.findOne({ id: wanted }).lean())) ||
      (await Venue.findOne({ isMainBranch: true }).lean()) || (await Venue.findOne().sort({ createdAt: 1 }).lean());
    if (!mainBranch) return res.json({ sections: [] });

    const doc = await getModel("comboSectionConfig").findOne({ id: singletonIdFor("comboSectionConfig", mainBranch.id) }).lean();
    if (!doc) return res.json({ sections: [] });
    const { _id, __v, id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error("GET /combo-section-config/public", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   CATEGORY CARDS — public read
   The "special cards" row at the top of the user-panel Food Category
   page (My Favourites, Crowd Picks, My Orders, Combos, Offers,
   Events & Booking) is admin-configurable (name/image/enabled) via
   the categoryCards singleton above, but the user panel is a public,
   unauthenticated surface — it can't send an admin session cookie to
   read it. This mirrors GET /orders/mine's approach of a dedicated
   customer/public-facing route sitting alongside the admin-gated one.
   Read-only; writes still go through the Super-Admin-gated
   /categoryCards route below.
───────────────────────────────────────── */
app.get("/category-cards/public", async (req, res) => {
  try {
    const doc = await getModel("categoryCards").findOne({ id: "singleton" }).lean();
    if (!doc) return res.json({});
    const { _id, __v, id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error("GET /category-cards/public", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

/* ─────────────────────────────────────────
   THEME — stays global and Super-Admin-only (not venue-scoped), per
   the "one theme, controlled only by Super Admin" decision.
   CATEGORY CARDS reuses the same global/Super-Admin-write shape for
   its admin-panel-facing route (see the public read route above for
   the user-panel-facing counterpart).
───────────────────────────────────────── */
// Public theme read — the customer app needs this to render its UI theme
// before any login, same reasoning as PUBLIC_MENU_COLLECTIONS above.
app.get("/public/theme", async (_req, res) => {
  try {
    const doc = await getModel("theme").findOne({ id: "singleton" }).lean();
    if (!doc) return res.json({});
    const { _id, __v, id, ...rest } = doc;
    res.json(rest);
  } catch (err) {
    console.error("GET /public/theme", err.message);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

GLOBAL_SINGLETONS.forEach((name) => {
  const base = `/${name}`;

  // Any logged-in admin can READ the theme (it renders the whole UI).
  app.get(base, requireAdminAuth, async (req, res) => {
    try {
      const doc = await getModel(name).findOne({ id: "singleton" }).lean();
      if (!doc) return res.json({});
      const { _id, __v, id, ...rest } = doc;
      res.json(rest);
    } catch (err) {
      console.error(`GET /${name}`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // Only Super Admin can WRITE the theme.
  app.put(base, requireAdminAuth, requireAdminRole("Super Admin"), async (req, res) => {
    try {
      const before = await getModel(name).findOne({ id: "singleton" }).lean();
      const body = { ...req.body, id: "singleton" };
      const doc = await getModel(name)
        .findOneAndReplace({ id: "singleton" }, body, { returnDocument: "after", upsert: true })
        .lean();
      const { _id, __v, id, ...result } = doc;
      emitChange(name, "updated", result);
      logAudit(req, { action: "update", resource: name, targetId: "global", before, after: result });
      res.json(result);
    } catch (err) {
      console.error(`PUT /${name}`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  app.patch(base, requireAdminAuth, requireAdminRole("Super Admin"), async (req, res) => {
    try {
      const before = await getModel(name).findOne({ id: "singleton" }).lean();
      const doc = await getModel(name)
        .findOneAndUpdate({ id: "singleton" }, { $set: req.body }, { returnDocument: "after", upsert: true })
        .lean();
      const { _id, __v, id, ...result } = doc;
      emitChange(name, "updated", result);
      logAudit(req, { action: "update", resource: name, targetId: "global", before, after: result });
      res.json(result);
    } catch (err) {
      console.error(`PATCH /${name}`, err.message);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });
});

/* ─────────────────────────────────────────
   SOCKET.IO
───────────────────────────────────────── */
// Ephemeral table-bell state, per restaurant + venue (acceptable to lose on restart).
// key: `${restaurantId}|${venueId}|${tableNo}`
const activeBells = new Map();
const bellKey = (rid, venueId, tableNo) => `${rid}|${venueId || "-"}|${tableNo}`;

/** The bells a socket may see: its restaurant's, narrowed to its venue when it has one. */
function bellsFor(socket) {
  const rid = socket.data.restaurantId;
  const out = {};
  if (!rid) return out;
  for (const k of activeBells.keys()) {
    const [r, v, t] = k.split("|");
    if (r !== rid) continue;
    if (socket.data.venueId && v !== socket.data.venueId) continue;
    out[t] = true;
  }
  return out;
}

/* ── Printer bridge relay state ──
   The local print-bridge (running next to a venue's physical printer)
   connects out to this server as a normal socket.io client and registers
   itself with its restaurant, venue and that venue's bridge token. Panels
   never talk to it directly — everything is relayed through here, so no
   public IP/port/tunnel is ever needed on the restaurant's local network.
   One bridge per venue: a restaurant's orders can only ever reach its own
   venue's printer. */
const printerSockets = new Map(); // `${restaurantId}|${venueId}` -> socket.id
const printerKey = (rid, venueId) => `${rid}|${venueId}`;

// jobId -> { requesterSocketId, timeout }
const pendingPrintJobs = new Map();
const PRINT_JOB_TIMEOUT_MS = 15000;

// If the bridge just dropped, it's usually mid-reconnect a moment later
// (e.g. brief wifi blip). Give it a short grace window to re-register
// before telling the requester it's offline, instead of failing instantly.
const PRINTER_RECONNECT_GRACE_MS = 4000;
const printerOnlineWaiters = new Map(); // printerKey -> [resolve callbacks]

function isPrinterOnline(rid, venueId) {
  const id = printerSockets.get(printerKey(rid, venueId));
  return !!(id && io.sockets.sockets.get(id));
}

function waitForPrinterOnline(rid, venueId, timeoutMs) {
  if (isPrinterOnline(rid, venueId)) return Promise.resolve(true);
  const key = printerKey(rid, venueId);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      printerOnlineWaiters.set(key, (printerOnlineWaiters.get(key) || []).filter((w) => w !== onOnline));
      resolve(false);
    }, timeoutMs);
    function onOnline() {
      clearTimeout(timer);
      resolve(true);
    }
    printerOnlineWaiters.set(key, [...(printerOnlineWaiters.get(key) || []), onOnline]);
  });
}

function emitPrinterStatus(rid, venueId) {
  const payload = { online: isPrinterOnline(rid, venueId), venueId };
  io.to(roomOf(rid, "staff")).emit("printer:status", payload);
  io.to(roomOf(rid, "guests")).emit("printer:status", payload);
}

app.get("/socket-token", requireAdminAuth, (req, res) => {
  res.json({ token: issueSocketJoinToken(req.admin) });
});

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

io.on("connection", (socket) => {
  // A socket belongs to no restaurant until it proves one (staff:join with a
  // server-issued token, guest:join with a restaurant URL name, or
  // printer:register with a venue token). Until then it can do nothing.
  const joined = () => !!socket.data.restaurantId;

  socket.on("staff:join", (payload, ack) => {
    const t = consumeSocketJoinToken(payload && payload.token);
    if (t) {
      socket.data.restaurantId = t.restaurantId;
      socket.data.adminId = t.adminId;
      socket.data.isStaff = true;
      socket.data.roleGroup = t.roleGroup;
      socket.data.venueId = t.roleGroup === "Super Admin" ? null : t.venueId;
      socket.join(roomOf(t.restaurantId, "staff"));
      socket.emit("bell-sync", bellsFor(socket));
    }
    if (typeof ack === "function") ack({ ok: !!t });
  });
  socket.on("staff:leave", () => {
    if (socket.data.restaurantId) socket.leave(roomOf(socket.data.restaurantId, "staff"));
    socket.data.isStaff = false;
  });

  // Customer app: join by restaurant URL name (+ optional venue URL name).
  socket.on("guest:join", async (payload, ack) => {
    try {
      const slug = String((payload && payload.restaurant) || "").toLowerCase().trim();
      const { restaurantBySlug } = require("./src/modules/platform/tenantResolver");
      const restaurant = slug ? await restaurantBySlug(slug) : null;
      if (!restaurant || restaurant.status !== "active") {
        if (typeof ack === "function") ack({ ok: false });
        return;
      }
      let venueId = null;
      const venueSlug = payload && payload.venue ? String(payload.venue).toLowerCase().trim() : "";
      if (venueSlug) {
        const { Venue } = venuesModule;
        const v = await runInTenant(restaurant.id, () => Venue.findOne({ slug: venueSlug, status: "active" }).select("id").lean());
        venueId = v ? v.id : null;
      }
      if (!socket.data.isStaff) {
        socket.data.restaurantId = restaurant.id;
        socket.data.venueId = venueId;
        socket.join(roomOf(restaurant.id, "guests"));
        socket.emit("bell-sync", bellsFor(socket));
        socket.emit("printer:status", { online: venueId ? isPrinterOnline(restaurant.id, venueId) : false, venueId });
      }
      if (typeof ack === "function") ack({ ok: true, venueId });
    } catch (err) {
      console.error("guest:join", err.message);
      if (typeof ack === "function") ack({ ok: false });
    }
  });

  // Staff chat: the client announces its own admin id right after joining so
  // we can target it directly (emitToAdmin) without every chat event being
  // broadcast to every connected socket. Only a socket that has proven this
  // exact staff session may claim the admin's room. Also flips any messages
  // waiting for this admin from "sent" to "delivered" and tells each sender.
  socket.on("chat:register", async (payload) => {
    const adminId = payload && payload.adminId;
    if (!adminId || typeof adminId !== "string") return;
    if (!socket.data.isStaff || socket.data.adminId !== adminId) return;
    socket.data.chatAdminId = adminId;
    socket.join(`admin:${adminId}`);
    if (typeof chatModule.markDelivered === "function") {
      const bySender = await runInTenant(socket.data.restaurantId, () => chatModule.markDelivered(adminId));
      bySender.forEach((messageIds, senderId) => {
        emitToAdmin(senderId, "chat:delivered", { toId: adminId, messageIds });
      });
    }
  });

  socket.on("bell-ring", (payload) => {
    if (!joined()) return;
    const { tableNo } = payload || {};
    if (!tableNo) return;
    const venueId = socket.data.venueId || (payload && payload.venueId) || null;
    activeBells.set(bellKey(socket.data.restaurantId, venueId, tableNo), true);
    const evt = { tableNo, venueId };
    io.to(roomOf(socket.data.restaurantId, "staff")).emit("bell-ring", evt);
    io.to(roomOf(socket.data.restaurantId, "guests")).emit("bell-ring", evt);
  });

  socket.on("bell-off", (payload) => {
    if (!joined()) return;
    const { tableNo } = payload || {};
    if (!tableNo) return;
    const venueId = socket.data.venueId || (payload && payload.venueId) || null;
    activeBells.delete(bellKey(socket.data.restaurantId, venueId, tableNo));
    const evt = { tableNo, venueId };
    io.to(roomOf(socket.data.restaurantId, "staff")).emit("bell-off", evt);
    io.to(roomOf(socket.data.restaurantId, "guests")).emit("bell-off", evt);
  });

  // Only staff may restyle the restaurant's apps, and only that restaurant's.
  socket.on("theme-update", (payload) => {
    if (!socket.data.isStaff) return;
    socket.to(roomOf(socket.data.restaurantId, "staff")).to(roomOf(socket.data.restaurantId, "guests")).emit("theme-update", payload);
  });

  /* ── Printer bridge registers itself ──
     Payload: { restaurant, venueId, token } — the restaurant's URL name, the
     venue the printer belongs to and that venue's bridge token (Venues page ->
     "Printer bridge"). */
  socket.on("printer:register", async (payload) => {
    try {
      const { restaurant: slug, venueId, token } = payload || {};
      const { restaurantBySlug } = require("./src/modules/platform/tenantResolver");
      const restaurant = slug ? await restaurantBySlug(String(slug).toLowerCase()) : null;
      const venue = restaurant && venueId
        ? await runInTenant(restaurant.id, () => venuesModule.Venue.findOne({ id: String(venueId) }).select("+printerToken").lean())
        : null;
      if (!restaurant || restaurant.status !== "active" || !venue || !venue.printerToken || !safeEqual(token, venue.printerToken)) {
        console.warn(`Printer bridge auth failed from ${socket.id}`);
        socket.emit("printer:register-ack", { ok: false, error: "Invalid restaurant, venue or token" });
        return;
      }
      const key = printerKey(restaurant.id, venue.id);
      const previous = printerSockets.get(key);
      if (previous && previous !== socket.id && io.sockets.sockets.get(previous)) {
        // Last-registered wins, but a second bridge for the same venue is
        // an operational event worth surfacing.
        console.warn(`Printer bridge conflict for ${key}: ${socket.id} is taking over from ${previous}`);
      }
      printerSockets.set(key, socket.id);
      socket.data.isPrinterBridge = true;
      socket.data.printerKey = key;
      socket.data.printerRestaurantId = restaurant.id;
      socket.data.printerVenueId = venue.id;
      console.log(`Printer bridge registered: ${key}`);
      socket.emit("printer:register-ack", { ok: true });
      emitPrinterStatus(restaurant.id, venue.id);
      const waiters = printerOnlineWaiters.get(key) || [];
      printerOnlineWaiters.delete(key);
      waiters.forEach((w) => w());
    } catch (err) {
      console.error("printer:register", err.message);
      socket.emit("printer:register-ack", { ok: false, error: "Registration failed" });
    }
  });

  // A panel asking whether its venue's printer is up.
  socket.on("printer:status-check", (payload) => {
    if (!joined()) return;
    const venueId = socket.data.venueId || (payload && payload.venueId) || null;
    socket.emit("printer:status", { online: venueId ? isPrinterOnline(socket.data.restaurantId, venueId) : false, venueId });
  });

  /* ── Staff panel requests a print job ──
     Payload: { jobId, jobType: "kot" | "bill" | "test", order, venueId? }
     jobId is generated client-side (e.g. crypto.randomUUID()) so the
     requester can match the eventual result. */
  socket.on("printer:print", async (payload) => {
    const { jobId, jobType, order } = payload || {};
    if (!jobId || !jobType) {
      socket.emit("printer:result", { jobId, success: false, error: "Missing jobId or jobType" });
      return;
    }
    if (!socket.data.isStaff) {
      socket.emit("printer:result", { jobId, success: false, error: "Not authorised to print" });
      return;
    }
    const rid = socket.data.restaurantId;
    const venueId = socket.data.venueId || (payload && payload.venueId) || (order && order.venueId) || null;
    if (!venueId) {
      socket.emit("printer:result", { jobId, success: false, error: "Choose a venue to print to" });
      return;
    }
    if (!isPrinterOnline(rid, venueId)) {
      // Don't fail instantly — the bridge may be mid-reconnect after a
      // brief drop. Wait a short grace period for it to come back.
      const cameBackOnline = await waitForPrinterOnline(rid, venueId, PRINTER_RECONNECT_GRACE_MS);
      if (!cameBackOnline) {
        socket.emit("printer:result", { jobId, success: false, error: "Printer bridge is offline" });
        return;
      }
    }

    pendingPrintJobs.set(jobId, { requesterSocketId: socket.id, restaurantId: rid });

    // Safety timeout in case the bridge never responds
    const timer = setTimeout(() => {
      if (pendingPrintJobs.has(jobId)) {
        pendingPrintJobs.delete(jobId);
        io.to(socket.id).emit("printer:result", {
          jobId,
          success: false,
          error: "Print job timed out — printer may be offline or unreachable",
        });
      }
    }, PRINT_JOB_TIMEOUT_MS);
    pendingPrintJobs.get(jobId).timeout = timer;

    io.to(printerSockets.get(printerKey(rid, venueId))).emit("printer:print", { jobId, jobType, order });
  });

  /* ── Bridge reports the outcome of a job ──
     Payload: { jobId, success, message, error } */
  socket.on("printer:result", (payload) => {
    if (!socket.data.isPrinterBridge) return;
    const { jobId } = payload || {};
    const job = pendingPrintJobs.get(jobId);
    // A bridge can only answer jobs of its own restaurant.
    if (!job || job.restaurantId !== socket.data.printerRestaurantId) return;
    clearTimeout(job.timeout);
    pendingPrintJobs.delete(jobId);
    io.to(job.requesterSocketId).emit("printer:result", payload);
  });

  socket.on("disconnect", () => {
    if (socket.data.isPrinterBridge && printerSockets.get(socket.data.printerKey) === socket.id) {
      printerSockets.delete(socket.data.printerKey);
      console.log(`Printer bridge disconnected: ${socket.data.printerKey}`);
      emitPrinterStatus(socket.data.printerRestaurantId, socket.data.printerVenueId);
    }
  });
});

/* ─────────────────────────────────────────
   HEALTH CHECK
───────────────────────────────────────── */
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

app.use(
  "/venues",
  requireModule("venues"),
  venuesModule.buildRouter({ requireAuth: requireAdminAuth, requireRole: requireAdminRole, logAudit })
);
app.use(
  "/permissions",
  requireModule("permissions"),
  permissionsModule.buildRouter({ requireAuth: requireAdminAuth, requireRole: requireAdminRole, logAudit })
);
app.use(
  "/roles",
  requireModule("roles"),
  rolesModule.buildRouter({
    requireAuth: requireAdminAuth,
    requireRole: requireAdminRole,
    logAudit,
  })
);
app.use(
  "/work-plan",
  requireModule("workPlan"),
  workPlanModule.buildRouter({
    requireAuth: requireAdminAuth,
    requireRole: requireAdminRole,
    logAudit,
  })
);
app.use(
  "/audit-logs",
  requireModule("auditLogs"),
  auditLogModule.buildRouter({ requireAuth: requireAdminAuth, requireRole: requireAdminRole })
);
app.use(
  "/documents",
  requireModule("documents"),
  documentsModule.buildRouter({ requireAuth: requireAdminAuth, requireRole: requireAdminRole, logAudit, uploadLimiter })
);
app.use(
  "/memos",
  requireModule("memos"),
  memosModule.buildRouter({ requireAuth: requireAdminAuth, requireRole: requireAdminRole, logAudit, uploadLimiter, emitChange, getModel })
);
app.use(
  "/payments",
  requireModule("payments"),
  paymentsModule.buildRouter({ requireAuth: requireAdminAuth, requirePerm, logAudit, emitChange, getModel, expireCustomerSessionsForOrder })
);
app.use(
  "/bank-account",
  requireModule("bankAccount"),
  bankAccountModule.buildRouter({ requireAuth: requireAdminAuth, requireRole: requireAdminRole, logAudit })
);
app.use(
  "/chat",
  requireModule("chat"),
  chatModule.buildRouter({ requireAuth: requireAdminAuth, logAudit, emitToAdmin, isAdminOnline })
);
app.use(
  "/whatsapp",
  requireModule("whatsapp"),
  whatsappModule.buildRouter({ requireAuth: requireAdminAuth })
);

app.use(
  "/inventory",
  require("./src/modules/inventory/routes").buildRouter({
    requireAuth: requireAdminAuth, requirePerm, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange,
  })
);

app.use(
  "/purchase",
  require("./src/modules/inventory/purchaseRoutes").buildPurchaseRouter({
    requireAuth: requireAdminAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange,
  })
);

app.use(
  "/receiving",
  require("./src/modules/inventory/receivingRoutes").buildReceivingRouter({
    requireAuth: requireAdminAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange,
  })
);

app.use(
  "/finance",
  require("./src/modules/inventory/financeRoutes").buildFinanceRouter({
    requireAuth: requireAdminAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange,
  })
);

app.use(
  "/automation",
  require("./src/modules/inventory/automationRoutes").buildAutomationRouter({
    requireAuth: requireAdminAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange,
    sendTemplate: whatsappModule.sendTemplate,
    getVenueName: async (id) => { const v = await venuesModule.Venue.findOne({ id: String(id) }).select("name").lean(); return v ? v.name : ""; },
  })
);

app.use(
  "/support",
  requireModule("supportTickets"),
  supportRoutes.buildRestaurantRouter({ requireAuth: requireAdminAuth, hasPermission, logAudit })
);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

/**
 * Final error-handling middleware — Express only invokes a 4-arg
 * handler like this for errors that reach it via next(err) or a
 * thrown/rejected error in middleware BEFORE a route's own try/catch
 * gets a chance (e.g. express.json() failing to parse a malformed
 * body, or a synchronous throw in middleware). Every route in this
 * app already has its own try/catch that formats its own response, so
 * in normal operation this should rarely fire — it exists as a safety
 * net so that if something ever does slip through, the client still
 * gets a generic, safe message rather than Express's own default error
 * page (which includes the full stack trace whenever NODE_ENV isn't
 * exactly "production", and even in production still risks leaking
 * more than intended). Never includes err.stack or err.message from an
 * unrecognized error type in the response — those go to the server
 * log only.
 */
app.use((err, req, res, _next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return; // response already started; nothing safe to change now
  if (err && err.code === "TENANT_CONTEXT_REQUIRED") {
    // A request reached tenant data without naming a restaurant (customer app
    // without X-Restaurant, login without a restaurant...). Never a 500.
    return res.status(400).json({ error: "Restaurant not specified", code: "RESTAURANT_REQUIRED" });
  }
  if (err && err.type === "entity.parse.failed") {
    // express.json()'s own parse error — safe, specific, and not internal.
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  res.status(500).json({ error: "An unexpected error occurred" });
});

/* ─────────────────────────────────────────
   KEEP-ALIVE SELF-PING
   Prevents Render free tier from spinning
   down after 15 min of inactivity.
   Set SELF_URL in .env to enable.
───────────────────────────────────────── */
const SELF_URL = process.env.SELF_URL || null;
if (SELF_URL) {
  setInterval(async () => {
    try {
      await fetch(`${SELF_URL}/health`);
      console.log("Keep-alive: self-ping OK");
    } catch (err) {
      console.warn("Keep-alive ping failed:", err.message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
}

/* ─────────────────────────────────────────
   START
───────────────────────────────────────── */
const PORT = process.env.PORT || 4000;

/**
 * resetMonthlySalaryFieldsIfNeeded — advance, deduction, penalty, bonus,
 * and overtime on every staff member's salary record are per-month
 * figures (Salary Management page), not running totals, so they need to
 * clear back to 0 at the start of each new calendar month rather than
 * carrying over.
 *
 * `remainingSalary` is now a running MONTHLY LEDGER (oldest → newest),
 * one entry per calendar month, rather than a single mutated record —
 * this preserves full salary history for the Salary Management page's
 * history view. On month rollover this function appends a fresh
 * zeroed entry for the new month (stamped with each staff member's
 * current base salary) instead of mutating the previous month's entry
 * in place, so past months stay exactly as they were finalized.
 *
 * A marker doc (in a tiny dedicated "salaryResetState" collection)
 * records the last month this ran for, so it's a no-op on every server
 * restart within the same month, and only actually resets once when the
 * month first rolls over — checked both at startup and periodically
 * (below), since a long-running process wouldn't otherwise notice the
 * month changing without a restart.
 */
const SalaryResetState = mongoose.model(
  "SalaryResetState",
  new mongoose.Schema({ id: String, lastResetMonth: String }, { versionKey: false }),
  "salaryResetState"
);

async function resetMonthlySalaryFieldsIfNeeded() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const state = await SalaryResetState.findOneAndUpdate(
      { id: "singleton" },
      { $setOnInsert: { id: "singleton", lastResetMonth: currentMonth } },
      { returnDocument: "after", upsert: true }
    );
    if (state.lastResetMonth === currentMonth) return; // already reset (or just initialized) for this month

    const StaffModel = getModel("staff");
    // Append a new zeroed ledger entry for the new month onto every
    // staff member's history, stamped with their current base salary,
    // rather than rewriting whatever the previous month's entry was.
    // Staff with no history yet are left alone — their first entry is
    // created the first time the Salary page saves an edit for them.
    const result = await StaffModel.updateMany(
      { "remainingSalary.0": { $exists: true } },
      [
        {
          $set: {
            remainingSalary: {
              $concatArrays: [
                "$remainingSalary",
                [{
                  month: currentMonth,
                  baseSalary: { $ifNull: ["$salary", 0] },
                  advance: 0, deduction: 0, penalty: 0, bonus: 0, overtime: 0,
                  remaining: { $ifNull: ["$salary", 0] },
                  updatedAt: new Date().toISOString(),
                }],
              ],
            },
            salaryRemaining: { $ifNull: ["$salary", 0] },
          },
        },
      ],
      // The update above is an aggregation pipeline (array), not a plain
      // update-operator object — needed because $concatArrays has to read
      // each doc's own existing `remainingSalary` field while writing it,
      // which a normal $set/$push update can't express. Mongoose's
      // schema-aware updateMany() rejects a pipeline update unless told
      // explicitly to allow it.
      { updatePipeline: true }
    );
    await SalaryResetState.updateOne({ id: "singleton" }, { $set: { lastResetMonth: currentMonth } });
    console.log(`[salary-reset] Appended new-month salary ledger entry on ${result.modifiedCount} staff record(s) for ${currentMonth}.`);
  } catch (err) {
    console.error("[salary-reset] Failed to reset monthly salary fields:", err.message);
  }
}

/**
 * Per-restaurant housekeeping that used to run once at boot for "the" cafe.
 * Each task runs inside a restaurant's own context, once per active restaurant.
 */
async function runTenantMaintenance() {
  const { Restaurant } = require("./src/modules/platform/models");
  const ids = (await runAsPlatform(() => Restaurant.find({ status: "active" }).select("id").lean())).map((r) => r.id);
  await tenancy.forEachTenant(ids, async () => {
    await ensureAdminsHaveStaffRecords();
    await ensureAdminRoleGroupsMatchTitle();
    await permissionsModule.seedDefaultPermissions();
    await rolesModule.ensureDefaultRoles();
    await rolesModule.retireRemovedRoles();
    await resetMonthlySalaryFieldsIfNeeded();
  });
}

if (require.main === module) {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }
  mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
      console.log("Connected to MongoDB");
      await platformModule.ensureDefaultPlans();
      await runTenantMaintenance();
      // Re-check every 6 hours so a long-running process (no restart) still
      // resets salary ledgers promptly after midnight on the 1st of the month.
      setInterval(() => runTenantMaintenance().catch((e) => console.error("[maintenance]", e.message)), 6 * 60 * 60 * 1000);
      subscriptionsSvc.startSweeper();
      require("./src/modules/support/service").startSweeps(); // ticket deadline warnings + auto-close of resolved tickets
      chatModule.scheduleWeeklyChatPurge(() => io.emit("chat:purged", {}));
      httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Dishky API running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
      process.exit(1);
    });
}

module.exports = { app, httpServer, io, runTenantMaintenance };
