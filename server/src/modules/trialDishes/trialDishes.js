/**
 * trialDishes.js — Dishky "Trial Dish Tracking"
 *
 * A dish being tried out before it joins the menu. Each trial moves through
 *     Pending → In Progress → Under Review → Approved | Rejected | Retest (back to In Progress, attempt + 1)
 * with On Hold as a side state. Trials carry structured evaluations (7 criteria), staff comments, ingredient
 * modifications, a progress timeline and a chronological activity log.
 *
 * Mounted at /trial-dishes (requireModule("trialDishes")).
 *   GET    /                 list (server-paginated)   filters: status, category, assignedTo, priority, from, to, search, sort, dir, page, limit
 *   GET    /summary          counts for the overview cards (same scope / date filters)
 *   GET    /meta             statuses, priorities, evaluation criteria
 *   GET    /notifications    the caller's trial notifications          POST /notifications/read  { ids? }
 *   POST   /                 create                                    GET /:id  detail      PUT /:id  edit details
 *   DELETE /:id              delete (Super Admin / Manager)
 *   POST   /:id/status       { to, reason?, recommendations?, nextTrialDate?, remarks? }   — workflow, enforced here
 *   POST   /:id/progress     { progressPct, note? }
 *   POST   /:id/evaluations  { scores:{criterion:1..10}, weights?, feedback, rating(1-5), actualCost? }
 *   POST   /:id/comments     { text, kind: "comment" | "observation" }
 *   POST   /:id/modifications{ ingredient, change, from?, to?, reason? }
 *
 * Branch scope: non-Super-Admin accounts only ever see / touch their own venue's trials. Approve / reject / retest are
 * limited to Super Admin and Manager role groups; staff with write access can run the trial and submit it for review.
 */
const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { asPlainString, safeErrorMessage, validateOptionalDataUrlFile } = require("../../core/validation");

/* ── vocabulary ───────────────────────────────────────────────────── */
const STATUSES = ["pending", "in_progress", "under_review", "approved", "rejected", "on_hold"];
const STATUS_LABEL = { pending: "Pending", in_progress: "In Progress", under_review: "Under Review", approved: "Approved", rejected: "Rejected", on_hold: "On Hold" };
const PRIORITIES = ["low", "medium", "high"];
const CRITERIA = [
  { key: "taste", label: "Taste & Flavor" },
  { key: "presentation", label: "Presentation & Appearance" },
  { key: "texture", label: "Texture & Consistency" },
  { key: "portion", label: "Portion Size" },
  { key: "prepTime", label: "Preparation Time" },
  { key: "ingredientCost", label: "Ingredient Cost" },
  { key: "customerAppeal", label: "Customer Appeal" },
];
const CRITERIA_KEYS = CRITERIA.map((c) => c.key);
const CHANGE_KINDS = ["added", "removed", "changed"];
const REVIEW_ROLES = new Set(["Super Admin", "Manager"]); // who may approve / reject / send for retest / delete

// Allowed status moves. "retest" is an action (under_review → in_progress with attempt + 1), handled separately.
const FLOW = {
  pending: ["in_progress", "on_hold"],
  in_progress: ["under_review", "on_hold"],
  under_review: ["approved", "rejected", "retest"],
  on_hold: ["in_progress", "pending"],
  approved: [],
  rejected: ["pending"], // reopen — Super Admin / Manager only (reviewer move)
};
const REVIEWER_MOVES = new Set(["approved", "rejected", "retest", "reopen"]);

/* ── pure helpers (unit-testable) ─────────────────────────────────── */
const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Weighted mean of the supplied 1–10 scores, as a 0–100 score. Missing criteria are ignored. */
function overallScore(scores, weights = {}) {
  let sum = 0, w = 0;
  for (const k of CRITERIA_KEYS) {
    const s = Number(scores && scores[k]);
    if (!(s >= 1 && s <= 10)) continue;
    const wt = Number(weights && weights[k]) > 0 ? Number(weights[k]) : 1;
    sum += s * wt; w += wt;
  }
  return w ? r2((sum / w) * 10) : 0;
}

/** Which move is `from → to` ("retest" / "reopen" included)? Returns { ok, action } or { ok:false, error }. */
function resolveMove(from, to) {
  const allowed = FLOW[from] || [];
  if (!allowed.includes(to)) return { ok: false, error: `A trial that is ${STATUS_LABEL[from] || from} cannot move to ${STATUS_LABEL[to] || to}.` };
  if (from === "rejected" && to === "pending") return { ok: true, action: "reopen", next: "pending" };
  if (to === "retest") return { ok: true, action: "retest", next: "in_progress" };
  return { ok: true, action: to, next: to };
}

function costAnalysis(t) {
  const est = Number(t.estimatedCost) || 0, price = Number(t.sellingPrice) || 0;
  const actuals = (t.evaluations || []).map((e) => Number(e.actualCost)).filter((n) => n > 0);
  const latest = actuals.length ? actuals[actuals.length - 1] : null;
  const used = latest != null ? latest : est;
  return {
    estimatedCost: est, sellingPrice: price, latestActualCost: latest,
    estimatedMargin: price > 0 ? r2(price - est) : null, estimatedMarginPct: price > 0 ? r2(((price - est) / price) * 100) : null,
    actualMargin: price > 0 && latest != null ? r2(price - latest) : null, actualMarginPct: price > 0 && latest != null ? r2(((price - latest) / price) * 100) : null,
    foodCostPct: price > 0 ? r2((used / price) * 100) : null,
    variance: latest != null ? r2(latest - est) : null,
  };
}

const isExpired = (t) => !!t.expectedCompletion && t.expectedCompletion < today() && !["approved", "rejected"].includes(t.status);

/* ── schema ───────────────────────────────────────────────────────── */
const evalSchema = new mongoose.Schema({
  id: String, attempt: Number, scores: { type: Object, default: {} }, weights: { type: Object, default: {} },
  overall: Number, rating: Number, feedback: { type: String, default: "" }, actualCost: { type: Number, default: null },
  byId: String, byName: String, at: { type: Date, default: Date.now },
}, { _id: false });
const commentSchema = new mongoose.Schema({ id: String, kind: { type: String, default: "comment" }, text: String, attempt: Number, byId: String, byName: String, at: { type: Date, default: Date.now } }, { _id: false });
const modSchema = new mongoose.Schema({ id: String, ingredient: String, change: String, from: { type: String, default: "" }, to: { type: String, default: "" }, reason: { type: String, default: "" }, attempt: Number, byId: String, byName: String, at: { type: Date, default: Date.now } }, { _id: false });
const activitySchema = new mongoose.Schema({ id: String, action: String, detail: { type: String, default: "" }, from: { type: String, default: "" }, to: { type: String, default: "" }, byId: String, byName: String, at: { type: Date, default: Date.now } }, { _id: false });
const attemptSchema = new mongoose.Schema({ attempt: Number, startedAt: Date, endedAt: { type: Date, default: null }, outcome: { type: String, default: "" }, reason: { type: String, default: "" }, recommendations: { type: String, default: "" } }, { _id: false });

const trialSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  seq: { type: Number, required: true },
  trialId: { type: String, required: true },
  venueId: { type: String, default: null },
  name: { type: String, required: true, trim: true },
  image: { type: String, default: "" },
  description: { type: String, default: "" },
  category: { type: String, default: "" },
  ingredients: { type: [{ _id: false, name: String, quantity: String, unit: String }], default: [] },
  preparationMethod: { type: String, default: "" },
  assignedStaffId: { type: String, default: "" },
  assignedStaffName: { type: String, default: "" },
  estimatedCost: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  trialStartDate: { type: String, required: true },
  expectedCompletion: { type: String, required: true },
  priority: { type: String, enum: PRIORITIES, default: "medium" },
  remarks: { type: String, default: "" },
  status: { type: String, enum: STATUSES, default: "pending" },
  progressPct: { type: Number, default: 0 },
  attempt: { type: Number, default: 1 },
  attempts: { type: [attemptSchema], default: [] },
  nextTrialDate: { type: String, default: "" },
  holdReason: { type: String, default: "" },
  finalDecision: { type: new mongoose.Schema({ decision: String, remarks: String, recommendations: String, byId: String, byName: String, at: Date }, { _id: false }), default: null },
  evaluations: { type: [evalSchema], default: [] },
  comments: { type: [commentSchema], default: [] },
  modifications: { type: [modSchema], default: [] },
  activity: { type: [activitySchema], default: [] },
  createdById: String, createdByName: String,
}, { timestamps: true, versionKey: false });
trialSchema.index({ venueId: 1, status: 1 });
trialSchema.index({ seq: 1 }, { unique: true }); // per restaurant — the tenancy plugin scopes unique indexes

const notificationSchema = new mongoose.Schema({
  id: { type: String, unique: true }, adminId: { type: String, index: true }, venueId: { type: String, default: null },
  trialId: String, trialRef: String, type: String, message: String, read: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const Trial = mongoose.model("TrialDish", trialSchema, "trialDishes");
const TrialNotification = mongoose.model("TrialDishNotification", notificationSchema, "trialDishNotifications");

const uid = (p) => `${p}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const strip = (doc) => { if (!doc) return doc; const o = doc.toObject ? doc.toObject() : { ...doc }; delete o._id; delete o.restaurantId; return o; };
const view = (t, { detail = false } = {}) => {
  const o = strip(t);
  o.statusLabel = STATUS_LABEL[o.status];
  o.expired = isExpired(o);
  const evs = o.evaluations || [];
  o.latestScore = evs.length ? evs[evs.length - 1].overall : null;
  o.evaluationCount = evs.length;
  if (!detail) { delete o.evaluations; delete o.comments; delete o.modifications; delete o.activity; delete o.ingredients; delete o.preparationMethod; return o; }
  o.cost = costAnalysis(o);
  const rated = evs.filter((e) => e.rating > 0);
  o.avgRating = rated.length ? r2(rated.reduce((s, e) => s + e.rating, 0) / rated.length) : null;
  return o;
};

/* ── router ───────────────────────────────────────────────────────── */
function buildRouter({ requireAuth, requirePerm, logAudit, emitChange, getModel, adminModel }) {
  const router = express.Router();
  router.use(requireAuth);
  const read = requirePerm("trialDishes", "read");
  const write = requirePerm("trialDishes", "write");

  const bad = (message, status = 400) => Object.assign(new Error(message), { expose: true, status });
  const fail = (res, err) => {
    if (err && err.expose) return res.status(err.status || 400).json({ error: err.message });
    if (err && err.code === 11000) return res.status(409).json({ error: "That value already exists." });
    console.error("[trialDishes]", err && err.stack);
    return res.status(500).json({ error: safeErrorMessage(err) });
  };
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  const str = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const num = (v, label, { min = 0, max = 1e7 } = {}) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw bad(`${label} must be a number between ${min} and ${max}`);
    return r2(n);
  };
  const date = (v, label, required) => {
    const s = str(v, 10);
    if (!s) { if (required) throw bad(`${label} is required`); return ""; }
    if (!DATE_RE.test(s) || isNaN(new Date(s))) throw bad(`${label} must be a valid date`);
    return s;
  };
  const scope = (req) => {
    if (req.admin.roleGroup === "Super Admin") { const v = asPlainString(req.query.venueId); return v ? { venueId: v } : {}; }
    return { venueId: req.admin.venueId };
  };
  const isReviewer = (req) => REVIEW_ROLES.has(req.admin.roleGroup);
  const load = async (req) => {
    const t = await Trial.findOne({ id: asPlainString(req.params.id), ...scope(req) });
    if (!t) throw bad("Trial dish not found", 404);
    return t;
  };
  const who = (req) => ({ byId: req.admin.id, byName: req.admin.name });
  const log = (t, req, action, detail = "", from = "", to = "") => { t.activity.push({ id: uid("act"), action, detail: str(detail, 400), from, to, ...who(req), at: new Date() }); };
  const push = (t) => { try { emitChange && emitChange("trialDishes", "updated", { id: t.id, venueId: t.venueId }); } catch { /* realtime is best-effort */ } };

  /* notifications — to the linked login account of a staff member, or to every reviewer of the branch */
  async function accountsOf({ staffId, reviewersOf, excludeId }) {
    if (!adminModel) return [];
    const q = { status: "active", $or: [] };
    if (staffId) q.$or.push({ staffId });
    if (reviewersOf !== undefined) { q.$or.push({ roleGroup: "Super Admin" }); q.$or.push({ roleGroup: "Manager", venueId: reviewersOf }); }
    if (!q.$or.length) return [];
    return (await adminModel.find(q).select("id").lean()).map((a) => a.id).filter((id) => id !== excludeId);
  }
  async function notify(t, ids, type, message) {
    const uniq = [...new Set(ids)];
    if (!uniq.length) return;
    try {
      await TrialNotification.insertMany(uniq.map((adminId) => ({ id: uid("tn"), adminId, venueId: t.venueId, trialId: t.id, trialRef: t.trialId, type, message })));
      emitChange && emitChange("trialDishNotifications", "created", { id: t.id, adminIds: uniq });
    } catch (e) { console.warn("[trialDishes] notify failed:", e.message); }
  }

  async function staffFor(venueId, staffId) {
    if (!staffId) return null;
    const s = await getModel("staff").findOne({ id: staffId }).select("id name venueId").lean();
    if (!s) throw bad("The assigned staff member does not exist");
    if (venueId && s.venueId && s.venueId !== venueId) throw bad("The assigned staff member belongs to a different branch");
    return s;
  }

  function cleanDetails(body, { partial = false } = {}) {
    const out = {};
    const has = (k) => body[k] !== undefined;
    if (!partial || has("name")) { out.name = str(body.name, 100); if (!out.name) throw bad("Dish name is required"); }
    if (!partial || has("description")) out.description = str(body.description, 1000);
    if (!partial || has("category")) { out.category = str(body.category, 80); if (!out.category) throw bad("Food category is required"); }
    if (!partial || has("preparationMethod")) out.preparationMethod = str(body.preparationMethod, 4000);
    if (!partial || has("remarks")) out.remarks = str(body.remarks, 1000);
    if (!partial || has("estimatedCost")) out.estimatedCost = num(body.estimatedCost, "Estimated preparation cost");
    if (!partial || has("sellingPrice")) out.sellingPrice = num(body.sellingPrice, "Selling price");
    if (!partial || has("trialStartDate")) out.trialStartDate = date(body.trialStartDate, "Trial start date", true);
    if (!partial || has("expectedCompletion")) out.expectedCompletion = date(body.expectedCompletion, "Expected completion date", true);
    if (!partial || has("priority")) { const p = str(body.priority, 10).toLowerCase() || "medium"; if (!PRIORITIES.includes(p)) throw bad("Priority must be Low, Medium or High"); out.priority = p; }
    if (!partial || has("ingredients")) {
      const list = Array.isArray(body.ingredients) ? body.ingredients : [];
      if (list.length > 60) throw bad("Too many ingredients");
      out.ingredients = list.map((i) => ({ name: str(i && i.name, 80), quantity: str(i && i.quantity, 30), unit: str(i && i.unit, 20) })).filter((i) => i.name);
      if (!partial && !out.ingredients.length) throw bad("Add at least one ingredient");
    }
    if (has("image")) {
      const chk = validateOptionalDataUrlFile(body.image);
      if (!chk.ok) throw bad(`Dish image: ${chk.error}`);
      if (chk.mimeType && !/^image\/(jpeg|png|webp)$/.test(chk.mimeType)) throw bad("Dish image must be a JPG, PNG or WEBP picture");
      out.image = body.image || "";
    }
    if (out.trialStartDate && out.expectedCompletion && out.expectedCompletion < out.trialStartDate) throw bad("Expected completion cannot be before the trial start date");
    return out;
  }

  /* ── list / summary / meta ───────────────────────────────────────── */
  function listFilter(req) {
    const q = req.query, f = { ...scope(req) };
    const status = asPlainString(q.status);
    if (status === "expired") { f.status = { $nin: ["approved", "rejected"] }; f.expectedCompletion = { $lt: today() }; }
    else if (status && STATUSES.includes(status)) f.status = status;
    if (asPlainString(q.category)) f.category = asPlainString(q.category);
    if (asPlainString(q.assignedTo)) f.assignedStaffId = asPlainString(q.assignedTo);
    if (asPlainString(q.priority) && PRIORITIES.includes(asPlainString(q.priority))) f.priority = asPlainString(q.priority);
    const from = asPlainString(q.from), to = asPlainString(q.to);
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw bad("Dates must be YYYY-MM-DD");
    if (from || to) f.trialStartDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const search = asPlainString(q.search);
    if (search) { const re = new RegExp(search.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); f.$or = [{ name: re }, { trialId: re }]; }
    return f;
  }
  const SORTS = { trialId: "seq", name: "name", category: "category", assignedStaffName: "assignedStaffName", trialStartDate: "trialStartDate", expectedCompletion: "expectedCompletion", status: "status", priority: "priority", createdAt: "createdAt" };

  router.get("/meta", read, wrap(async (_req, res) => res.json({
    statuses: STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s] })), priorities: PRIORITIES, criteria: CRITERIA, changeKinds: CHANGE_KINDS,
    transitions: FLOW, scale: { min: 1, max: 10 },
  })));

  router.get("/summary", read, wrap(async (req, res) => {
    const f = listFilter({ ...req, query: { venueId: req.query.venueId, from: req.query.from, to: req.query.to }, admin: req.admin });
    const [total, byStatus, expired] = await Promise.all([
      Trial.countDocuments(f),
      Trial.aggregate([{ $match: f }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
      Trial.countDocuments({ ...f, status: { $nin: ["approved", "rejected"] }, expectedCompletion: { $lt: today() } }),
    ]);
    const c = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
    res.json({ total, pending: c.pending || 0, testing: c.in_progress || 0, underReview: c.under_review || 0, approved: c.approved || 0, rejected: c.rejected || 0, onHold: c.on_hold || 0, expired });
  }));

  router.get("/", read, wrap(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const sortKey = SORTS[asPlainString(req.query.sort)] || "seq";
    const dir = req.query.dir === "asc" ? 1 : -1;
    const f = listFilter(req);
    const [total, rows] = await Promise.all([
      Trial.countDocuments(f),
      Trial.find(f).select("-evaluations.scores -comments -modifications -activity -ingredients -preparationMethod").sort({ [sortKey]: dir, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    res.json({ total, page, limit, rows: rows.map((t) => view({ ...t, evaluations: t.evaluations || [] })) });
  }));

  /* ── notifications ────────────────────────────────────────────────── */
  router.get("/notifications", read, wrap(async (req, res) => {
    const rows = await TrialNotification.find({ adminId: req.admin.id }).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ unread: rows.filter((r) => !r.read).length, rows: rows.map(strip) });
  }));
  router.post("/notifications/read", read, wrap(async (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(asPlainString).filter(Boolean) : null;
    await TrialNotification.updateMany({ adminId: req.admin.id, ...(ids ? { id: { $in: ids } } : {}) }, { $set: { read: true } });
    res.json({ ok: true });
  }));

  /* ── create / read / edit / delete ───────────────────────────────── */
  router.post("/", write, wrap(async (req, res) => {
    const venueId = req.admin.roleGroup === "Super Admin" ? (asPlainString(req.body.venueId) || asPlainString(req.query.venueId) || null) : req.admin.venueId;
    if (!venueId) throw bad("Choose a branch for this trial dish");
    const d = cleanDetails(req.body);
    const staff = await staffFor(venueId, str(req.body.assignedStaffId, 80));
    if (!staff) throw bad("Assign a chef / staff member");
    let doc;
    for (let i = 0; i < 5 && !doc; i += 1) {
      const last = await Trial.findOne().sort({ seq: -1 }).select("seq").lean();
      const seq = (last ? last.seq : 0) + 1;
      try {
        doc = await Trial.create({ ...d, id: uid("td"), seq, trialId: `TD-${String(seq).padStart(4, "0")}`, venueId, assignedStaffId: staff.id, assignedStaffName: staff.name,
          createdById: req.admin.id, createdByName: req.admin.name, attempts: [{ attempt: 1, startedAt: new Date() }],
          activity: [{ id: uid("act"), action: "created", detail: `Trial created and assigned to ${staff.name}`, to: "pending", ...who(req), at: new Date() }] });
      } catch (e) { if (!(e && e.code === 11000)) throw e; }
    }
    if (!doc) throw bad("Could not allocate a trial number, please try again", 503);
    notify(doc, await accountsOf({ staffId: staff.id, excludeId: req.admin.id }), "assigned", `New trial assigned to you: ${doc.name} (${doc.trialId})`);
    logAudit(req, { action: "create", resource: "trialDishes", targetId: doc.id, after: { trialId: doc.trialId, name: doc.name } });
    push(doc);
    res.status(201).json(view(doc, { detail: true }));
  }));

  router.get("/:id", read, wrap(async (req, res) => res.json(view(await load(req), { detail: true }))));

  router.put("/:id", write, wrap(async (req, res) => {
    const t = await load(req);
    if (["approved"].includes(t.status) && !isReviewer(req)) throw bad("An approved trial can only be edited by a manager", 403);
    const d = cleanDetails({ ...req.body, trialStartDate: req.body.trialStartDate ?? t.trialStartDate, expectedCompletion: req.body.expectedCompletion ?? t.expectedCompletion }, { partial: true });
    const before = { name: t.name, category: t.category, assigned: t.assignedStaffId };
    Object.assign(t, d);
    if (req.body.nextTrialDate !== undefined) t.nextTrialDate = date(req.body.nextTrialDate, "Next trial date", false);
    let newlyAssigned = null;
    if (req.body.assignedStaffId !== undefined && str(req.body.assignedStaffId, 80) !== t.assignedStaffId) {
      const staff = await staffFor(t.venueId, str(req.body.assignedStaffId, 80));
      if (!staff) throw bad("Assign a chef / staff member");
      t.assignedStaffId = staff.id; t.assignedStaffName = staff.name; newlyAssigned = staff;
      log(t, req, "reassigned", `Assigned to ${staff.name}`);
    }
    log(t, req, "edited", "Trial details updated");
    await t.save();
    if (newlyAssigned) notify(t, await accountsOf({ staffId: newlyAssigned.id, excludeId: req.admin.id }), "assigned", `Trial assigned to you: ${t.name} (${t.trialId})`);
    logAudit(req, { action: "update", resource: "trialDishes", targetId: t.id, before, after: { name: t.name, category: t.category, assigned: t.assignedStaffId } });
    push(t);
    res.json(view(t, { detail: true }));
  }));

  router.delete("/:id", write, wrap(async (req, res) => {
    if (!isReviewer(req)) throw bad("Only a manager or super admin can delete a trial dish", 403);
    const t = await load(req);
    if (t.status === "approved" && req.admin.roleGroup !== "Super Admin") throw bad("Only a super admin can delete an approved trial", 403);
    await Trial.deleteOne({ id: t.id });
    logAudit(req, { action: "delete", resource: "trialDishes", targetId: t.id, before: { trialId: t.trialId, name: t.name } });
    push(t);
    res.json({ ok: true });
  }));

  /* ── workflow ─────────────────────────────────────────────────────── */
  router.post("/:id/status", write, wrap(async (req, res) => {
    const t = await load(req);
    const to = str(req.body.to, 20);
    const move = resolveMove(t.status, to);
    if (!move.ok) throw bad(move.error, 409);
    if (REVIEWER_MOVES.has(move.action) && !isReviewer(req)) throw bad("Only a manager or super admin can approve, reject or send a trial for retest", 403);
    const reason = str(req.body.reason, 600), recs = str(req.body.recommendations, 600), remarks = str(req.body.remarks, 600);
    const from = t.status;

    if (move.action === "under_review" && !t.evaluations.some((e) => e.attempt === t.attempt)) throw bad("Record at least one evaluation for this attempt before submitting it for review");
    if (move.action === "on_hold") { if (!reason) throw bad("Give a reason for putting the trial on hold"); t.holdReason = reason; }
    if (move.action === "rejected" && (!reason || !recs)) throw bad("Rejecting needs the reason and recommended modifications");
    if (move.action === "retest" && (!reason || !recs)) throw bad("Sending for retest needs the reason and recommended modifications");
    if (move.action === "approved" && !remarks) throw bad("Add the final approval remarks");

    const cur = t.attempts.find((a) => a.attempt === t.attempt);
    t.status = move.next;
    if (["in_progress"].includes(move.next) && from !== "under_review") t.holdReason = "";

    if (move.action === "approved" || move.action === "rejected") {
      t.finalDecision = { decision: move.action, remarks: move.action === "approved" ? remarks : reason, recommendations: recs, ...who(req), at: new Date() };
      if (cur) { cur.endedAt = new Date(); cur.outcome = move.action; cur.reason = move.action === "rejected" ? reason : remarks; cur.recommendations = recs; }
      t.progressPct = move.action === "approved" ? 100 : t.progressPct;
    }
    if (move.action === "retest") {
      if (cur) { cur.endedAt = new Date(); cur.outcome = "retest"; cur.reason = reason; cur.recommendations = recs; }
      t.attempt += 1; t.attempts.push({ attempt: t.attempt, startedAt: new Date() });
      t.progressPct = 0; t.finalDecision = null;
      if (req.body.nextTrialDate) t.nextTrialDate = date(req.body.nextTrialDate, "Next trial date", false);
    }
    if (move.action === "reopen") { t.finalDecision = null; t.attempt += 1; t.attempts.push({ attempt: t.attempt, startedAt: new Date() }); t.progressPct = 0; }
    if (move.action === "under_review") t.progressPct = Math.max(t.progressPct, 90);

    const detail = { retest: `Sent for retest — ${reason}. Recommended: ${recs}`, rejected: `Rejected — ${reason}. Recommended: ${recs}`, approved: `Approved — ${remarks}`, on_hold: `On hold — ${reason}`, under_review: "Submitted for review", in_progress: from === "on_hold" ? "Resumed" : "Trial started", pending: from === "rejected" ? "Reopened for a new attempt" : "Moved back to pending" }[move.action] || "";
    log(t, req, move.action, detail, from, t.status);
    await t.save();

    // who needs to know
    const ref = `${t.name} (${t.trialId})`;
    if (move.action === "under_review") notify(t, await accountsOf({ reviewersOf: t.venueId, excludeId: req.admin.id }), "review", `Submitted for review: ${ref}`);
    if (["approved", "rejected", "retest"].includes(move.action)) {
      const text = { approved: `Approved: ${ref}`, rejected: `Rejected: ${ref}`, retest: `Needs a retest: ${ref}` }[move.action];
      const owners = await accountsOf({ staffId: t.assignedStaffId, excludeId: req.admin.id });
      const creator = t.createdById && t.createdById !== req.admin.id ? [t.createdById] : [];
      notify(t, [...owners, ...creator], move.action, text);
    }
    logAudit(req, { action: "update", resource: "trialDishes", targetId: t.id, before: { status: from }, after: { status: t.status, action: move.action } });
    push(t);
    res.json(view(t, { detail: true }));
  }));

  router.post("/:id/progress", write, wrap(async (req, res) => {
    const t = await load(req);
    if (!["in_progress", "pending"].includes(t.status)) throw bad("Progress can only be updated while the trial is pending or in progress", 409);
    const pct = num(req.body.progressPct, "Progress", { min: 0, max: 100 });
    const note = str(req.body.note, 400);
    t.progressPct = Math.round(pct);
    log(t, req, "progress", `Progress set to ${t.progressPct}%${note ? ` — ${note}` : ""}`);
    await t.save(); push(t);
    res.json(view(t, { detail: true }));
  }));

  router.post("/:id/evaluations", write, wrap(async (req, res) => {
    const t = await load(req);
    if (!["in_progress", "under_review"].includes(t.status)) throw bad("Evaluations can be recorded while the trial is in progress or under review", 409);
    const scores = {}, weights = {};
    for (const k of CRITERIA_KEYS) {
      const v = req.body.scores && req.body.scores[k];
      if (v === undefined || v === "" || v === null) continue;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 10) throw bad(`${CRITERIA.find((c) => c.key === k).label} must be a whole number from 1 to 10`);
      scores[k] = n;
      const w = req.body.weights && Number(req.body.weights[k]);
      if (w > 0 && w <= 10) weights[k] = w;
    }
    if (!Object.keys(scores).length) throw bad("Score at least one criterion");
    const rating = req.body.rating === undefined || req.body.rating === "" ? 0 : Number(req.body.rating);
    if (!(rating === 0 || (Number.isInteger(rating) && rating >= 1 && rating <= 5))) throw bad("Rating must be 1 to 5 stars");
    const actualCost = req.body.actualCost === undefined || req.body.actualCost === "" ? null : num(req.body.actualCost, "Actual cost");
    const overall = overallScore(scores, weights);
    t.evaluations.push({ id: uid("ev"), attempt: t.attempt, scores, weights, overall, rating, feedback: str(req.body.feedback, 1500), actualCost, ...who(req), at: new Date() });
    log(t, req, "evaluated", `Evaluation recorded — overall ${overall}/100${rating ? `, ${rating}★` : ""}`);
    if (t.status === "in_progress") t.progressPct = Math.max(t.progressPct, 70);
    await t.save(); push(t);
    res.status(201).json(view(t, { detail: true }));
  }));

  router.post("/:id/comments", write, wrap(async (req, res) => {
    const t = await load(req);
    const text = str(req.body.text, 1500);
    if (!text) throw bad("Write the comment first");
    const kind = req.body.kind === "observation" ? "observation" : "comment";
    t.comments.push({ id: uid("cm"), kind, text, attempt: t.attempt, ...who(req), at: new Date() });
    log(t, req, kind, text.slice(0, 120));
    await t.save(); push(t);
    res.status(201).json(view(t, { detail: true }));
  }));

  router.post("/:id/modifications", write, wrap(async (req, res) => {
    const t = await load(req);
    if (["approved", "rejected"].includes(t.status)) throw bad("This trial is closed", 409);
    const ingredient = str(req.body.ingredient, 80), change = str(req.body.change, 10);
    if (!ingredient) throw bad("Name the ingredient");
    if (!CHANGE_KINDS.includes(change)) throw bad("Choose added, removed or changed");
    t.modifications.push({ id: uid("md"), ingredient, change, from: str(req.body.from, 80), to: str(req.body.to, 80), reason: str(req.body.reason, 300), attempt: t.attempt, ...who(req), at: new Date() });
    log(t, req, "modification", `${ingredient} ${change}`);
    await t.save(); push(t);
    res.status(201).json(view(t, { detail: true }));
  }));

  return router;
}

module.exports = { buildRouter, Trial, TrialNotification, STATUSES, CRITERIA, FLOW, overallScore, resolveMove, costAnalysis, isExpired };
