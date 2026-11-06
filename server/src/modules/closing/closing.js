/**
 * closing.js — the daily closing checklist.
 *
 * Whoever closes the restaurant records, once per branch per day:
 *   • gas cylinders   — several cylinders, each with the balance left (kg)
 *   • food wastage    — several dishes/items, each with a weight or quantity and a reason
 *   • electricity     — several EB connections, each with the closing meter reading (consumption = reading − last reading)
 *   • cash in hand and the tally (POS sales vs cash / UPI / card collected; expected cash vs counted cash)
 *   • a tick list of closing checks (gas off, lights off, doors locked …) plus notes
 *
 * A checklist is a draft until it is submitted; a submitted one is locked and only a Super Admin / Manager can reopen it.
 * Stored in the schemaless tenant-scoped collection `closingChecklists` (one document per branch + date, id
 * `closing_<venueId>_<date>`). Money is rupees with two decimals; the derived figures (consumption, tally difference,
 * cash variance) are always computed here, never trusted from the browser.
 *
 *   GET    /closing?from=&to=&venueId=      list
 *   GET    /closing/prefill?date=&venueId=  the template for a new day, carried over from the previous closing
 *   GET    /closing/:id
 *   POST   /closing                         create a draft for { date, ... }
 *   PUT    /closing/:id                     update a draft
 *   POST   /closing/:id/submit              lock it
 *   POST   /closing/:id/reopen              Super Admin / Manager
 *   DELETE /closing/:id                     Super Admin / Manager, drafts only
 */
const express = require("express");
const { getModel } = require("../../core/genericModel");
const { asPlainString, safeErrorMessage } = require("../../core/validation");

const DEFAULT_CHECKS = [
  "All gas cylinder regulators closed",
  "All stoves, grills and fryers switched off",
  "Lights, fans and AC switched off",
  "Refrigerators and freezers running",
  "Kitchen and dining area cleaned",
  "Garbage taken out",
  "Cash locked in the safe",
  "Doors, windows and shutters locked",
];
const WASTE_UNITS = ["kg", "g", "l", "ml", "portion", "pcs"];
const CYL_TYPES = ["LPG 19 kg", "LPG 14.2 kg", "LPG 5 kg", "Other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 40;

const bad = (message, code, status = 400) => Object.assign(new Error(message), { status, code, expose: true });
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const str = (v, max) => asPlainString(v).replace(/\s+/g, " ").trim().slice(0, max);

function num(v, label, { required = false, max = 1e9 } = {}) {
  if (v === "" || v === undefined || v === null) { if (required) throw bad(`${label} is required`, "REQUIRED"); return null; }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw bad(`${label} must be a number of 0 or more`, "BAD_NUMBER");
  return n;
}

function scopeFilter(req) {
  if (req.admin.roleGroup === "Super Admin") { const venueId = asPlainString(req.query.venueId); return venueId ? { venueId } : {}; }
  return { venueId: req.admin.venueId };
}
function venueForCreate(req) {
  if (req.admin.roleGroup === "Super Admin") return asPlainString(req.body.venueId) || asPlainString(req.query.venueId) || null;
  return req.admin.venueId;
}

/** Last reading per EB connection label from the most recent earlier closings. */
async function lastReadings(Model, venueId, beforeDate, excludeId) {
  const prev = await Model.find({ venueId, date: { $lt: beforeDate }, ...(excludeId ? { id: { $ne: excludeId } } : {}) }).sort({ date: -1 }).limit(14).lean();
  const out = new Map();
  for (const doc of prev) for (const m of doc.electricity || []) if (!out.has(m.label.toLowerCase()) && m.reading != null) out.set(m.label.toLowerCase(), { reading: m.reading, date: doc.date });
  return { out, latest: prev[0] || null };
}

/** Clean + validate the body, and add the derived figures. */
async function build(Model, body, { venueId, date, excludeId }) {
  const cylinders = (Array.isArray(body.cylinders) ? body.cylinders : []).slice(0, MAX_ROWS).map((c, i) => {
    const label = str(c.label, 60) || `Cylinder ${i + 1}`;
    return { label, type: CYL_TYPES.includes(c.type) ? c.type : "LPG 19 kg", remainingKg: r3(num(c.remainingKg, `${label}: remaining gas`, { required: true, max: 1000 })), inUse: !!c.inUse, notes: str(c.notes, 200) };
  });
  const foodWastage = (Array.isArray(body.foodWastage) ? body.foodWastage : []).slice(0, MAX_ROWS).filter((w) => str(w.dish, 100) || Number(w.quantity) > 0).map((w, i) => {
    const dish = str(w.dish, 100);
    if (!dish) throw bad(`Wastage row ${i + 1}: enter the dish or item name`, "REQUIRED");
    const unit = WASTE_UNITS.includes(w.unit) ? w.unit : "kg";
    return { dish, quantity: r3(num(w.quantity, `${dish}: quantity`, { required: true, max: 100000 })), unit, reason: str(w.reason, 200) };
  });
  const { out: last } = await lastReadings(Model, venueId, date, excludeId);
  const seen = new Set();
  const electricity = (Array.isArray(body.electricity) ? body.electricity : []).slice(0, MAX_ROWS).map((m, i) => {
    const label = str(m.label, 60) || `EB connection ${i + 1}`;
    if (seen.has(label.toLowerCase())) throw bad(`EB connection "${label}" is listed twice`, "DUPLICATE");
    seen.add(label.toLowerCase());
    const reading = r2(num(m.reading, `${label}: meter reading`, { required: true, max: 1e9 }));
    const prev = last.get(label.toLowerCase());
    const reset = !!m.meterReset;
    if (prev && reading < prev.reading && !reset) throw bad(`${label}: the reading (${reading}) is lower than the last one (${prev.reading} on ${prev.date}). If the meter was replaced, tick "meter replaced".`, "READING_LOWER");
    return { label, serviceNo: str(m.serviceNo, 40), reading, previousReading: prev ? prev.reading : null, previousDate: prev ? prev.date : null, meterReset: reset, consumption: prev && !reset ? r2(reading - prev.reading) : null };
  });

  const t = body.tally || {};
  const tally = { systemSales: r2(num(t.systemSales, "Sales per POS", { max: 1e9 }) || 0), cash: r2(num(t.cash, "Cash collected", { max: 1e9 }) || 0), upi: r2(num(t.upi, "UPI collected", { max: 1e9 }) || 0), card: r2(num(t.card, "Card collected", { max: 1e9 }) || 0), other: r2(num(t.other, "Other collected", { max: 1e9 }) || 0) };
  tally.collected = r2(tally.cash + tally.upi + tally.card + tally.other);
  tally.difference = r2(tally.collected - tally.systemSales); // 0 = the day tallies
  const c = body.cash || {};
  const cash = { openingFloat: r2(num(c.openingFloat, "Opening cash float", { max: 1e9 }) || 0), cashExpenses: r2(num(c.cashExpenses, "Cash paid out", { max: 1e9 }) || 0), cashInHand: r2(num(c.cashInHand, "Cash in hand", { max: 1e9 }) || 0) };
  cash.expectedCash = r2(cash.openingFloat + tally.cash - cash.cashExpenses);
  cash.variance = r2(cash.cashInHand - cash.expectedCash); // + extra cash, − cash short
  cash.countedAny = c.cashInHand !== "" && c.cashInHand !== undefined && c.cashInHand !== null;

  const checks = (Array.isArray(body.checks) ? body.checks : DEFAULT_CHECKS.map((label) => ({ label, done: false }))).slice(0, 60).map((x) => ({ label: str(x.label, 120), done: !!x.done })).filter((x) => x.label);
  return { cylinders, foodWastage, electricity, tally, cash, checks, notes: str(body.notes, 2000), closedBy: str(body.closedBy, 80) };
}

function buildRouter({ requireAuth, requireRole, logAudit, emitChange }) {
  const router = express.Router();
  const Model = () => getModel("closingChecklists");
  const mgr = requireRole("Super Admin", "Manager");
  const audit = (req, id, action, after) => { try { logAudit && logAudit(req, { action, resource: "closingChecklists", targetId: id, after }); } catch (_e) { /* best effort */ } };
  const fail = (res, err) => {
    if (err && err.expose) return res.status(err.status || 400).json({ error: err.message, code: err.code });
    console.error("closing", err && err.message); res.status(500).json({ error: safeErrorMessage(err) });
  };
  const view = (d) => { const { _id, __v, restaurantId, ...rest } = d; return rest; };

  router.get("/", requireAuth, async (req, res) => {
    try {
      const q = { ...scopeFilter(req) };
      const from = asPlainString(req.query.from), to = asPlainString(req.query.to);
      if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return res.status(400).json({ error: "Dates must be YYYY-MM-DD" });
      if (from || to) q.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
      const rows = await Model().find(q).sort({ date: -1 }).limit(400).lean();
      res.json(rows.map(view));
    } catch (err) { fail(res, err); }
  });

  router.get("/prefill", requireAuth, async (req, res) => {
    try {
      const venueId = scopeFilter(req).venueId || asPlainString(req.query.venueId);
      const date = asPlainString(req.query.date);
      if (!venueId) return res.status(400).json({ error: "venueId is required", code: "VENUE_REQUIRED" });
      if (!DATE_RE.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
      const { latest } = await lastReadings(Model(), venueId, date);
      const blankCyl = (c) => ({ label: c.label, type: c.type, remainingKg: "", inUse: !!c.inUse, notes: "" });
      res.json({
        date, venueId, wasteUnits: WASTE_UNITS, cylinderTypes: CYL_TYPES,
        cylinders: latest ? (latest.cylinders || []).map(blankCyl) : [],
        electricity: latest ? (latest.electricity || []).map((m) => ({ label: m.label, serviceNo: m.serviceNo || "", reading: "", previousReading: m.reading, previousDate: latest.date, meterReset: false })) : [],
        checks: DEFAULT_CHECKS.map((label) => ({ label, done: false })),
      });
    } catch (err) { fail(res, err); }
  });

  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const d = await Model().findOne({ id: asPlainString(req.params.id), ...scopeFilter(req) }).lean();
      if (!d) return res.status(404).json({ error: "Checklist not found" });
      res.json(view(d));
    } catch (err) { fail(res, err); }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      const venueId = venueForCreate(req);
      if (!venueId) return res.status(400).json({ error: "venueId is required (Super Admin must specify one)", code: "VENUE_REQUIRED" });
      const date = asPlainString(req.body.date);
      if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return res.status(400).json({ error: "Choose the closing date" });
      if (date > new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)) return res.status(400).json({ error: "The closing date cannot be in the future" });
      const id = `closing_${venueId}_${date}`;
      if (await Model().exists({ id })) return res.status(409).json({ error: "A closing checklist already exists for this branch and date. Open it instead.", code: "EXISTS", id });
      const data = await build(Model(), req.body, { venueId, date });
      const doc = { id, venueId, date, status: "draft", ...data, createdBy: req.admin.id, createdByName: req.admin.name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await Model().create(doc);
      audit(req, id, "create", { date });
      emitChange && emitChange("closingChecklists", "create", doc);
      res.status(201).json(view(doc));
    } catch (err) { fail(res, err); }
  });

  router.put("/:id", requireAuth, async (req, res) => {
    try {
      const cur = await Model().findOne({ id: asPlainString(req.params.id), ...scopeFilter(req) }).lean();
      if (!cur) return res.status(404).json({ error: "Checklist not found" });
      if (cur.status !== "draft") return res.status(409).json({ error: "This checklist is submitted. Ask a manager to reopen it.", code: "LOCKED" });
      const data = await build(Model(), req.body, { venueId: cur.venueId, date: cur.date, excludeId: cur.id });
      const set = { ...data, updatedAt: new Date().toISOString(), updatedByName: req.admin.name };
      await Model().updateOne({ id: cur.id, status: "draft" }, { $set: set });
      audit(req, cur.id, "update", {});
      res.json(view({ ...cur, ...set }));
    } catch (err) { fail(res, err); }
  });

  router.post("/:id/submit", requireAuth, async (req, res) => {
    try {
      const cur = await Model().findOne({ id: asPlainString(req.params.id), ...scopeFilter(req) }).lean();
      if (!cur) return res.status(404).json({ error: "Checklist not found" });
      if (cur.status !== "draft") return res.status(409).json({ error: "Already submitted", code: "LOCKED" });
      const open = (cur.checks || []).filter((c) => !c.done).map((c) => c.label);
      if (open.length) return res.status(400).json({ error: `Tick every closing check before submitting: ${open.join("; ")}`, code: "CHECKS_OPEN" });
      if (!cur.cash || !cur.cash.countedAny) return res.status(400).json({ error: "Enter the cash in hand before submitting", code: "CASH_REQUIRED" });
      const set = { status: "submitted", submittedAt: new Date().toISOString(), submittedBy: req.admin.id, submittedByName: req.admin.name };
      const r = await Model().updateOne({ id: cur.id, status: "draft" }, { $set: set });
      if (!r.modifiedCount && !r.nModified) return res.status(409).json({ error: "Already submitted", code: "LOCKED" });
      audit(req, cur.id, "submit", {});
      emitChange && emitChange("closingChecklists", "update", { ...cur, ...set });
      res.json(view({ ...cur, ...set }));
    } catch (err) { fail(res, err); }
  });

  router.post("/:id/reopen", requireAuth, mgr, async (req, res) => {
    try {
      const cur = await Model().findOne({ id: asPlainString(req.params.id), ...scopeFilter(req) }).lean();
      if (!cur) return res.status(404).json({ error: "Checklist not found" });
      if (cur.status !== "submitted") return res.status(409).json({ error: "Only a submitted checklist can be reopened" });
      const set = { status: "draft", reopenedAt: new Date().toISOString(), reopenedByName: req.admin.name };
      await Model().updateOne({ id: cur.id, status: "submitted" }, { $set: set });
      audit(req, cur.id, "reopen", {});
      res.json(view({ ...cur, ...set }));
    } catch (err) { fail(res, err); }
  });

  router.delete("/:id", requireAuth, mgr, async (req, res) => {
    try {
      const cur = await Model().findOne({ id: asPlainString(req.params.id), ...scopeFilter(req) }).lean();
      if (!cur) return res.status(404).json({ error: "Checklist not found" });
      if (cur.status !== "draft") return res.status(409).json({ error: "Only a draft can be deleted. Reopen it first.", code: "LOCKED" });
      await Model().deleteOne({ id: cur.id, status: "draft" });
      audit(req, cur.id, "delete", {});
      res.json({ success: true });
    } catch (err) { fail(res, err); }
  });

  return router;
}

module.exports = { buildRouter, DEFAULT_CHECKS };
