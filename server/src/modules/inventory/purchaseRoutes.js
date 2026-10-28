/**
 * purchaseRoutes.js — procurement API (Phase 2). Mounted at /purchase.
 *
 *   purchase requests  /requests      draft -> approval -> RFQ or PO
 *   reorder planning   /reorder       suggestions + conversion into draft PRs
 *   RFQs               /rfqs          invite suppliers, collect quotations, evaluate, award
 *   quotations         /quotations    shortlist / reject / request revision
 *   purchase orders    /orders        approval, sending record, revisions, cancel, short-close
 *   settings           /settings      approval limits and maker-checker policy
 *
 * Rules enforced here, never trusted from the client: totals, tax, round-off, document numbers,
 * status transitions (conditional updates, so two people cannot both win a transition),
 * received/outstanding quantities, approval authority and maker-checker separation.
 */
const express = require("express");
const { asPlainString, safeErrorMessage } = require("../../core/validation");
const M = require("./models");
const PM = require("./purchaseModels");
const C = require("./purchaseCalc");
const P = require("./precision");
const U = require("./units");

const MAX_LIMIT = 200;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OPEN_PO = ["pending_approval", "approved", "sent", "partially_received"];
const OPEN_PR = ["draft", "changes_requested", "pending_approval", "approved", "rfq_issued"]; // drafts count so reorder does not raise duplicates

function buildPurchaseRouter({ requireAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange }) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((req, _res, next) => { if (!req.body || typeof req.body !== "object") req.body = {}; next(); }); // GET/DELETE carry no body

  /* ── plumbing ──────────────────────────────────────────────────── */
  const bad = (message, code = "BAD_REQUEST", status = 400, details) => Object.assign(new Error(message), { name: "InventoryError", code, status, details });
  const fail = (res, err) => {
    if (err && ["InventoryError", "UnitError", "PrecisionError"].includes(err.name)) {
      return res.status(err.status || 400).json({ error: err.message, code: err.code, details: err.details });
    }
    if (err && err.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err && (err.code === 11000 || /E11000/.test(String(err.message)))) return res.status(409).json({ error: "A record with the same unique value already exists.", code: "DUPLICATE" });
    console.error("[purchase] unhandled:", err && err.stack);
    return res.status(500).json({ error: safeErrorMessage(err) });
  };
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max).trim() : "");
  const date = (v, label) => {
    if (v === undefined || v === null || v === "") return null;
    const d = new Date(v);
    if (isNaN(d)) throw bad(`${label} is not a valid date`);
    return d;
  };
  const paging = (req) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), MAX_LIMIT);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    return { limit, page, skip: (page - 1) * limit };
  };
  const venueFor = async (req) => {
    const venueId = scopeVenueForCreate(req);
    if (!venueId) throw bad("venueId is required (Super Admin must specify a branch)", "VENUE_REQUIRED");
    if (!(await venueBelongsToTenant(venueId))) throw bad("Unknown branch", "BAD_VENUE");
    return venueId;
  };
  const me = (req) => ({ id: req.admin.id, name: req.admin.name });
  const audit = (req, resource, id, action, after, before) => logAudit(req, { action, resource, targetId: id, after, before });
  const notify = (resource, doc) => emitChange(resource, "updated", { id: doc.id, status: doc.status, venueId: doc.venueId }); // after persistence
  const customUnits = () => M.CustomUnit.find({}).lean();

  async function getSettings() {
    const s = await PM.PurchaseSettings.findOne({ key: "purchase" }).lean();
    return { prApprovalLimitPaise: 0, poApprovalLimitPaise: 0, allowSelfApproval: false, allowManualPo: false, gstStateCode: "", reorderLookbackDays: 30, overReceiptPct: 0, matchQtyTolerancePct: 0, matchPriceTolerancePct: 0, invoiceTotalTolerancePaise: 100, paymentApprovalLimitPaise: 0, ...(s || {}) };
  }
  const loadScoped = async (Model, req, id) => {
    const doc = await Model.findOne({ ...scopeFilter(req), id }).lean();
    if (!doc) throw bad("Not found", "NOT_FOUND", 404);
    return doc;
  };

  /**
   * Conditional status change: succeeds only if the document is still in one of `from`.
   * Two simultaneous approvals can never both pass.
   */
  async function move(Model, req, id, flow, from, to, { set = {}, entry, historyField = "approvals" } = {}) {
    for (const f of from) if (!C.canMove(flow, f, to)) throw new Error(`internal: ${f} -> ${to} is not in the flow`);
    const update = { $set: { status: to, ...set } };
    if (entry) update.$push = { [historyField]: { ...entry, by: req.admin.id, byName: req.admin.name, at: new Date(), toStatus: to } };
    const doc = await Model.findOneAndUpdate({ ...scopeFilter(req), id, status: { $in: from } }, update, { returnDocument: "after" }).lean();
    if (doc) return doc;
    const cur = await Model.findOne({ ...scopeFilter(req), id }).lean();
    if (!cur) throw bad("Not found", "NOT_FOUND", 404);
    throw bad(`This document is ${cur.status.replace(/_/g, " ")}; it cannot be moved to ${to.replace(/_/g, " ")}.`, "INVALID_STATE", 409, { status: cur.status });
  }

  function assertMakerChecker(settings, ownerId, req) {
    if (ownerId === req.admin.id && !settings.allowSelfApproval) {
      throw bad("You cannot approve a document you created. Ask another approver, or enable self-approval in Purchase settings.", "SELF_APPROVAL", 403);
    }
  }
  async function canEdit(req, ownerId) {
    return ownerId === req.admin.id || (await hasPermission(req.admin, "purchaseApprovals", "write"));
  }

  /* ── lines ─────────────────────────────────────────────────────── */
  async function loadItems(ids) {
    const items = await M.InventoryItem.find({ id: { $in: [...new Set(ids)] } }).lean();
    return new Map(items.map((i) => [i.id, i]));
  }
  function baseQty(item, l, customs) {
    const unit = str(l.unit, 20).toLowerCase() || item.baseUnit;
    const qtyMilli = U.toBaseMilli(l.qty, unit, item, customs);
    if (qtyMilli <= 0) throw bad(`Quantity for ${item.name} must be greater than zero`, "BAD_QTY");
    return { qtyMilli, enteredQty: Number(l.qty), enteredUnit: unit };
  }
  const needLines = (raw, max = 200) => {
    if (!Array.isArray(raw) || raw.length === 0) throw bad("At least one line item is required", "NO_LINES");
    if (raw.length > max) throw bad(`Too many lines (max ${max})`);
    const seen = new Set();
    for (const l of raw) {
      if (!l || typeof l !== "object" || !str(l.itemId, 80)) throw bad("Every line needs an item", "BAD_LINE");
      if (seen.has(l.itemId)) throw bad("An item can appear only once per document", "DUPLICATE_ITEM");
      seen.add(l.itemId);
    }
    return raw;
  };
  async function avgCosts(venueId, itemIds) {
    const rows = await M.StockBalance.find({ venueId, itemId: { $in: itemIds }, qtyOnHandMilli: { $gt: 0 } }).lean();
    const acc = new Map();
    for (const r of rows) {
      const a = acc.get(r.itemId) || { q: 0n, v: 0n };
      a.q += BigInt(r.qtyOnHandMilli); a.v += BigInt(r.qtyOnHandMilli) * BigInt(r.unitCostMicro);
      acc.set(r.itemId, a);
    }
    return new Map([...acc].map(([k, a]) => [k, a.q > 0n ? Number(P.divRound(a.v, a.q)) : 0]));
  }
  async function availableByItem(venueId, itemIds) {
    const rows = await M.StockBalance.find({ venueId, itemId: { $in: itemIds } }).lean();
    const now = Date.now();
    const out = new Map();
    for (const r of rows) {
      if (r.expiryDate && +new Date(r.expiryDate) < now) continue;
      out.set(r.itemId, (out.get(r.itemId) || 0) + Math.max(0, r.availableMilli));
    }
    return out;
  }

  async function buildPrLines(raw, venueId) {
    needLines(raw);
    const customs = await customUnits();
    const items = await loadItems(raw.map((l) => l.itemId));
    const costs = await avgCosts(venueId, raw.map((l) => l.itemId));
    return raw.map((l) => {
      const item = items.get(l.itemId);
      if (!item) throw bad("Unknown item on a line", "NO_ITEM", 404);
      if (item.status !== "active") throw bad(`${item.name} is inactive`, "ITEM_INACTIVE", 409);
      const q = baseQty(item, l, customs);
      const estUnitCostMicro = l.estUnitCost !== undefined && l.estUnitCost !== "" ? C.costPerBaseMicro(item, q.enteredUnit, l.estUnitCost, customs) : costs.get(item.id) || 0;
      return {
        itemId: item.id, itemName: item.name, sku: item.sku, ...q, unit: item.baseUnit,
        estUnitCostMicro, estTotalPaise: P.valuePaise(q.qtyMilli, estUnitCostMicro),
        suggestedMilli: l.suggestedMilli > 0 ? Math.floor(l.suggestedMilli) : 0,
        requiredBy: date(l.requiredBy, "Required-by date"), remarks: str(l.remarks, 300),
      };
    });
  }

  /* ── presentation ──────────────────────────────────────────────── */
  const strip = ({ _id, ...rest }) => rest;
  const outPrLine = (l) => ({ ...l, qty: P.fromMilli(l.qtyMilli), available: P.fromMilli(l.availableMilli), suggested: P.fromMilli(l.suggestedMilli), estUnitCost: P.fromMicro(l.estUnitCostMicro), estTotal: P.fromPaise(l.estTotalPaise) });
  const outPR = (d) => ({ ...strip(d), total: P.fromPaise(d.totalPaise), lines: d.lines.map(outPrLine) });
  const outTotals = (t = {}) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k.replace(/Paise$/, ""), typeof v === "number" && /Paise$/.test(k) ? P.fromPaise(v) : v]));
  const outMoneyLine = (l) => ({
    ...l, qty: P.fromMilli(l.qtyMilli), unitPrice: P.fromMicro(l.unitPriceMicro), discountPct: l.discountBp / 100, gstRate: l.gstBp / 100,
    gross: P.fromPaise(l.grossPaise), discount: P.fromPaise(l.discountPaise), taxable: P.fromPaise(l.taxablePaise), tax: P.fromPaise(l.taxPaise), total: P.fromPaise(l.totalPaise),
    ...(l.receivedMilli !== undefined ? { received: P.fromMilli(l.receivedMilli), closed: P.fromMilli(l.closedMilli || 0), outstanding: P.fromMilli(Math.max(0, l.qtyMilli - l.receivedMilli - (l.closedMilli || 0))) } : {}),
  });
  const outPO = (d) => ({
    ...strip(d), lines: d.lines.map(outMoneyLine), totals: outTotals(d.totals),
    taxSplit: d.taxSplit ? { type: d.taxSplit.type, cgst: P.fromPaise(d.taxSplit.cgstPaise), sgst: P.fromPaise(d.taxSplit.sgstPaise), igst: P.fromPaise(d.taxSplit.igstPaise) } : null,
    overdue: !!(d.expectedDate && +new Date(d.expectedDate) < Date.now() && ["sent", "partially_received"].includes(d.status)),
    revisions: (d.revisions || []).map(({ snapshot, ...r }) => r),
  });
  const outRfq = (d) => ({ ...strip(d), lines: d.lines.map((l) => ({ ...l, qty: P.fromMilli(l.qtyMilli) })) });
  const outQuo = (d) => ({ ...strip(d), lines: d.lines.map(outMoneyLine), totals: outTotals(d.totals), freight: P.fromPaise(d.freightPaise), otherCharges: P.fromPaise(d.otherChargesPaise), expired: !!(d.validUntil && +new Date(d.validUntil) < Date.now()) });

  /* ═════════════ SETTINGS ═════════════ */
  const outSettings = (s) => ({ prApprovalLimit: P.fromPaise(s.prApprovalLimitPaise), poApprovalLimit: P.fromPaise(s.poApprovalLimitPaise), allowSelfApproval: s.allowSelfApproval, allowManualPo: s.allowManualPo, gstStateCode: s.gstStateCode, reorderLookbackDays: s.reorderLookbackDays, overReceiptPct: s.overReceiptPct, matchQtyTolerancePct: s.matchQtyTolerancePct, matchPriceTolerancePct: s.matchPriceTolerancePct, invoiceTotalTolerance: P.fromPaise(s.invoiceTotalTolerancePaise), paymentApprovalLimit: P.fromPaise(s.paymentApprovalLimitPaise) });
  router.get("/settings", requirePerm("purchaseSettings", "read"), wrap(async (_req, res) => {
    const s = await getSettings();
    res.json(outSettings(s));
  }));
  router.patch("/settings", requirePerm("purchaseSettings", "write"), wrap(async (req, res) => {
    const b = req.body || {};
    const set = {};
    if (b.prApprovalLimit !== undefined) set.prApprovalLimitPaise = P.toPaise(b.prApprovalLimit, "PR approval limit");
    if (b.poApprovalLimit !== undefined) set.poApprovalLimitPaise = P.toPaise(b.poApprovalLimit, "PO approval limit");
    if ((set.prApprovalLimitPaise ?? 0) < 0 || (set.poApprovalLimitPaise ?? 0) < 0) throw bad("Limits cannot be negative");
    for (const f of ["allowSelfApproval", "allowManualPo"]) if (b[f] !== undefined) set[f] = !!b[f];
    if (b.gstStateCode !== undefined) {
      const c = str(b.gstStateCode, 2);
      if (c && !/^\d{2}$/.test(c)) throw bad("GST state code is two digits, e.g. 29");
      set.gstStateCode = c;
    }
    for (const f of ["matchQtyTolerancePct", "matchPriceTolerancePct"]) if (b[f] !== undefined) {
      const n = Number(b[f]);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw bad("Tolerance must be 0 to 100 percent");
      set[f] = n;
    }
    if (b.invoiceTotalTolerance !== undefined) set.invoiceTotalTolerancePaise = P.toPaise(b.invoiceTotalTolerance, "invoice total tolerance");
    if (b.paymentApprovalLimit !== undefined) set.paymentApprovalLimitPaise = P.toPaise(b.paymentApprovalLimit, "payment approval limit");
    if ((set.invoiceTotalTolerancePaise ?? 0) < 0 || (set.paymentApprovalLimitPaise ?? 0) < 0) throw bad("Values cannot be negative");
    if (b.overReceiptPct !== undefined) {
      const n = Number(b.overReceiptPct);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw bad("Over-receipt tolerance must be 0 to 100 percent");
      set.overReceiptPct = n;
    }
    if (b.reorderLookbackDays !== undefined) {
      const n = Number(b.reorderLookbackDays);
      if (!Number.isInteger(n) || n < 1 || n > 365) throw bad("Lookback must be 1 to 365 days");
      set.reorderLookbackDays = n;
    }
    if (!Object.keys(set).length) throw bad("Nothing to update");
    await PM.PurchaseSettings.updateOne({ key: "purchase" }, { $set: set, $setOnInsert: { key: "purchase" } }, { upsert: true });
    audit(req, "purchaseSettings", "purchase", "update", set);
    const s = await getSettings();
    res.json(outSettings(s));
  }));

  /* ═════════════ PURCHASE REQUESTS ═════════════ */
  const PRIORITIES = ["low", "normal", "high", "urgent"];
  async function prHeader(b, venueId) {
    const out = {};
    if (b.department !== undefined) out.department = str(b.department, 80);
    if (b.requiredDate !== undefined) out.requiredDate = date(b.requiredDate, "Required date");
    if (b.priority !== undefined) { if (!PRIORITIES.includes(b.priority)) throw bad("Invalid priority"); out.priority = b.priority; }
    if (b.purpose !== undefined) out.purpose = str(b.purpose, 500);
    if (b.notes !== undefined) out.notes = str(b.notes, 2000);
    if (b.preferredSupplierId !== undefined) {
      const id = str(b.preferredSupplierId, 80) || null;
      if (id && !(await M.Supplier.exists({ id }))) throw bad("Unknown supplier", "NO_SUPPLIER", 404);
      out.preferredSupplierId = id;
    }
    return out;
  }

  router.get("/requests", requirePerm("purchaseRequests", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["status", "priority", "requestedBy"]) { const v = str(req.query[f], 60); if (v) q[f] = v; }
    const search = str(req.query.search, 60);
    if (search) q.$or = [{ prNo: { $regex: esc(search), $options: "i" } }, { purpose: { $regex: esc(search), $options: "i" } }, { requestedByName: { $regex: esc(search), $options: "i" } }];
    const [rows, total] = await Promise.all([PM.PurchaseRequest.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PM.PurchaseRequest.countDocuments(q)]);
    res.json({ data: rows.map(outPR), page, limit, total });
  }));
  router.get("/requests/:id", requirePerm("purchaseRequests", "read"), wrap(async (req, res) => res.json(outPR(await loadScoped(PM.PurchaseRequest, req, req.params.id)))));

  router.post("/requests", requirePerm("purchaseRequests", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const lines = await buildPrLines(req.body.lines, venueId);
    const header = await prHeader(req.body, venueId);
    const doc = await PM.PurchaseRequest.create({
      ...header, venueId, prNo: await M.nextNumber("pr", "PR"), requestedBy: req.admin.id, requestedByName: req.admin.name,
      lines, totalPaise: lines.reduce((n, l) => n + l.estTotalPaise, 0), source: "manual",
    });
    audit(req, "purchaseRequests", doc.id, "create", { prNo: doc.prNo, total: doc.totalPaise });
    notify("purchaseRequests", doc);
    res.status(201).json(outPR(doc.toObject()));
  }));

  router.patch("/requests/:id", requirePerm("purchaseRequests", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseRequest, req, req.params.id);
    if (!["draft", "changes_requested"].includes(cur.status)) throw bad("Only a draft or a request sent back for changes can be edited.", "INVALID_STATE", 409);
    if (!(await canEdit(req, cur.requestedBy))) throw bad("Only the requester can edit this request.", "FORBIDDEN", 403);
    const set = await prHeader(req.body, cur.venueId);
    if (req.body.lines !== undefined) {
      set.lines = await buildPrLines(req.body.lines, cur.venueId);
      set.totalPaise = set.lines.reduce((n, l) => n + l.estTotalPaise, 0);
    }
    if (!Object.keys(set).length) throw bad("Nothing to update");
    const doc = await PM.PurchaseRequest.findOneAndUpdate({ id: cur.id, status: { $in: ["draft", "changes_requested"] } }, { $set: set }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("The request changed while you were editing; reload it.", "INVALID_STATE", 409);
    audit(req, "purchaseRequests", doc.id, "update", { prNo: doc.prNo }, { status: cur.status });
    res.json(outPR(doc));
  }));

  router.post("/requests/:id/submit", requirePerm("purchaseRequests", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseRequest, req, req.params.id);
    if (!(await canEdit(req, cur.requestedBy))) throw bad("Only the requester can submit this request.", "FORBIDDEN", 403);
    if (!cur.lines.length) throw bad("Add at least one line before submitting", "NO_LINES");
    const settings = await getSettings();
    const avail = await availableByItem(cur.venueId, cur.lines.map((l) => l.itemId));
    const lines = cur.lines.map((l) => ({ ...l, availableMilli: avail.get(l.itemId) || 0 }));
    const total = lines.reduce((n, l) => n + l.estTotalPaise, 0);
    const auto = settings.prApprovalLimitPaise > 0 && total <= settings.prApprovalLimitPaise;
    const doc = await move(PM.PurchaseRequest, req, cur.id, C.PR_FLOW, ["draft", "changes_requested"], auto ? "approved" : "pending_approval", {
      set: { lines, totalPaise: total }, entry: { action: auto ? "auto_approved" : "submitted", comment: str(req.body.comment, 500) },
    });
    audit(req, "purchaseRequests", doc.id, "update", { status: doc.status });
    notify("purchaseRequests", doc);
    res.json(outPR(doc));
  }));

  const decide = (action, to, { needComment }) => wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseRequest, req, req.params.id);
    const comment = str(req.body.comment || req.body.reason, 500);
    if (needComment && !comment) throw bad("A reason is required", "REASON_REQUIRED");
    assertMakerChecker(await getSettings(), cur.requestedBy, req);
    const doc = await move(PM.PurchaseRequest, req, cur.id, C.PR_FLOW, ["pending_approval"], to, { entry: { action, comment } });
    audit(req, "purchaseRequests", doc.id, "update", { status: doc.status, comment });
    notify("purchaseRequests", doc);
    res.json(outPR(doc));
  });
  router.post("/requests/:id/approve", requirePerm("purchaseApprovals", "write"), decide("approved", "approved", { needComment: false }));
  router.post("/requests/:id/reject", requirePerm("purchaseApprovals", "write"), decide("rejected", "rejected", { needComment: true }));
  router.post("/requests/:id/request-changes", requirePerm("purchaseApprovals", "write"), decide("changes_requested", "changes_requested", { needComment: true }));

  router.post("/requests/:id/cancel", requirePerm("purchaseRequests", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseRequest, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required", "REASON_REQUIRED");
    if (!(await canEdit(req, cur.requestedBy))) throw bad("Only the requester or an approver can cancel this request.", "FORBIDDEN", 403);
    if (cur.poIds && cur.poIds.length) throw bad("Orders were already raised from this request.", "HAS_ORDERS", 409);
    const doc = await move(PM.PurchaseRequest, req, cur.id, C.PR_FLOW, ["draft", "pending_approval", "changes_requested", "approved"], "cancelled", { entry: { action: "cancelled", comment: reason } });
    audit(req, "purchaseRequests", doc.id, "update", { status: "cancelled", reason });
    notify("purchaseRequests", doc);
    res.json(outPR(doc));
  }));

  /* ── PR -> RFQ ── */
  router.post("/requests/:id/convert-to-rfq", requirePerm("purchaseRequests", "write"), requirePerm("purchaseRfq", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseRequest, req, req.params.id);
    if (cur.status !== "approved") throw bad("Only an approved request can be converted.", "INVALID_STATE", 409);
    const suppliers = await resolveRfqSuppliers(req.body.supplierIds);
    const rfqNo = await M.nextNumber("rfq", "RFQ");
    const rfqId = require("./models").newId("rfq");
    await move(PM.PurchaseRequest, req, cur.id, C.PR_FLOW, ["approved"], "rfq_issued", { set: { rfqId }, entry: { action: "converted_to_rfq", comment: rfqNo } });
    try {
      const rfq = await PM.Rfq.create({
        id: rfqId, rfqNo, venueId: cur.venueId, prId: cur.id, suppliers,
        requiredDate: cur.requiredDate, deadline: date(req.body.deadline, "Deadline"),
        deliveryAddress: str(req.body.deliveryAddress, 500), paymentTerms: str(req.body.paymentTerms, 200), deliveryTerms: str(req.body.deliveryTerms, 200), notes: str(req.body.notes, 2000),
        lines: cur.lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, sku: l.sku, qtyMilli: l.qtyMilli, unit: l.unit, enteredQty: l.enteredQty, enteredUnit: l.enteredUnit, requiredBy: l.requiredBy })),
        createdBy: req.admin.id, createdByName: req.admin.name,
      });
      audit(req, "purchaseRfq", rfq.id, "create", { rfqNo, prId: cur.id });
      notify("purchaseRequests", { ...cur, status: "rfq_issued" });
      res.status(201).json(outRfq(rfq.toObject()));
    } catch (e) {
      await PM.PurchaseRequest.updateOne({ id: cur.id, status: "rfq_issued" }, { $set: { status: "approved", rfqId: null } }); // undo
      throw e;
    }
  }));

  /* ── PR -> PO ── */
  router.post("/requests/:id/convert-to-po", requirePerm("purchaseRequests", "write"), requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseRequest, req, req.params.id);
    if (cur.status !== "approved") throw bad("Only an approved request can be converted.", "INVALID_STATE", 409);
    const supplierId = str(req.body.supplierId, 80) || cur.preferredSupplierId;
    if (!supplierId) throw bad("Choose a supplier for the order", "NO_SUPPLIER");
    const po = await createPo(req, { venueId: cur.venueId, supplierId, prId: cur.id, linesRaw: cur.lines.map((l) => ({ itemId: l.itemId, qtyMilli: l.qtyMilli, unitPriceMicro: l.estUnitCostMicro, enteredQty: l.enteredQty, enteredUnit: l.enteredUnit })), body: req.body });
    await move(PM.PurchaseRequest, req, cur.id, C.PR_FLOW, ["approved"], "ordered", { set: {}, entry: { action: "converted_to_po", comment: po.poNo } }).catch(async (e) => {
      await PM.PurchaseOrder.deleteOne({ id: po.id }); // the request was taken by someone else first
      throw e;
    });
    await PM.PurchaseRequest.updateOne({ id: cur.id }, { $push: { poIds: po.id } });
    res.status(201).json(outPO(po));
  }));

  /* ═════════════ REORDER PLANNING ═════════════ */
  router.get("/reorder/suggestions", requirePerm("purchaseRequests", "read"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const settings = await getSettings();
    const since = new Date(Date.now() - settings.reorderLookbackDays * 864e5);
    const items = await M.InventoryItem.find({ status: "active" }).lean();
    const ids = items.map((i) => i.id);
    const [avail, costs, openPos, openPrs, usage, suppliers] = await Promise.all([
      availableByItem(venueId, ids), avgCosts(venueId, ids),
      PM.PurchaseOrder.find({ venueId, status: { $in: OPEN_PO } }).lean(),
      PM.PurchaseRequest.find({ venueId, status: { $in: OPEN_PR } }).lean(),
      M.StockLedger.aggregate([{ $match: { venueId, type: "consumption", postedAt: { $gte: since } } }, { $group: { _id: "$itemId", out: { $sum: "$qtyOutMilli" } } }]),
      M.Supplier.find({}).lean(),
    ]);
    const onOrder = new Map(), onRequest = new Map();
    for (const po of openPos) for (const l of po.lines) onOrder.set(l.itemId, (onOrder.get(l.itemId) || 0) + Math.max(0, l.qtyMilli - l.receivedMilli - (l.closedMilli || 0)));
    for (const pr of openPrs) for (const l of pr.lines) onRequest.set(l.itemId, (onRequest.get(l.itemId) || 0) + l.qtyMilli);
    const used = new Map(usage.map((u) => [u._id, u.out]));
    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    const customs = await customUnits();
    const rows = [];
    for (const item of items) {
      const sup = item.preferredSupplierId ? supMap.get(item.preferredSupplierId) : null;
      const usable = sup && sup.status === "active" ? sup : null;
      let packMilli = 0;
      if (item.purchaseUnit && item.purchaseUnit !== item.baseUnit) { try { packMilli = U.toBaseMilli(1, item.purchaseUnit, item, customs); } catch { packMilli = 0; } }
      const s = C.reorderSuggestion({
        item, availableMilli: avail.get(item.id) || 0, onOrderMilli: onOrder.get(item.id) || 0, onRequestMilli: onRequest.get(item.id) || 0,
        avgDailyMilli: (used.get(item.id) || 0) / settings.reorderLookbackDays, leadTimeDays: usable ? usable.leadTimeDays : 0, packMilli,
      });
      if (!s) continue;
      const cost = costs.get(item.id) || 0;
      rows.push({
        itemId: item.id, sku: item.sku, name: item.name, unit: item.baseUnit, purchaseUnit: item.purchaseUnit || item.baseUnit, packSize: P.fromMilli(packMilli),
        available: P.fromMilli(avail.get(item.id) || 0), onOrder: P.fromMilli(onOrder.get(item.id) || 0), onRequest: P.fromMilli(onRequest.get(item.id) || 0),
        reorderLevel: P.fromMilli(s.levelMilli), avgDailyUse: P.fromMilli(Math.round((used.get(item.id) || 0) / settings.reorderLookbackDays)),
        suggestedQty: P.fromMilli(s.qtyMilli), suggestedMilli: s.qtyMilli, priority: s.priority,
        supplier: usable ? { id: usable.id, name: usable.name, leadTimeDays: usable.leadTimeDays } : null,
        supplierWarning: sup && !usable ? `Preferred supplier ${sup.name} is ${sup.status}` : !sup ? "No preferred supplier" : null,
        estUnitCost: P.fromMicro(cost), estTotal: P.fromPaise(P.valuePaise(s.qtyMilli, cost)),
      });
    }
    const rank = { urgent: 0, high: 1, normal: 2 };
    rows.sort((a, b) => rank[a.priority] - rank[b.priority] || a.name.localeCompare(b.name));
    res.json({ data: rows, lookbackDays: settings.reorderLookbackDays, note: "Available stock excludes reserved, quarantined, damaged and expired quantities; open orders and open requests are counted once." });
  }));

  router.post("/reorder/create-requests", requirePerm("purchaseRequests", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const raw = needLines(req.body.lines);
    const items = await loadItems(raw.map((l) => l.itemId));
    const groups = new Map();
    for (const l of raw) {
      const item = items.get(l.itemId);
      if (!item) throw bad("Unknown item", "NO_ITEM", 404);
      const key = item.preferredSupplierId || "";
      groups.set(key, [...(groups.get(key) || []), l]);
    }
    const created = [];
    for (const [supplierId, lines] of groups) {
      const built = await buildPrLines(lines, venueId);
      const doc = await PM.PurchaseRequest.create({
        venueId, prNo: await M.nextNumber("pr", "PR"), requestedBy: req.admin.id, requestedByName: req.admin.name,
        purpose: "Reorder planning", priority: "normal", preferredSupplierId: supplierId || null, source: "reorder",
        lines: built, totalPaise: built.reduce((n, l) => n + l.estTotalPaise, 0),
      });
      audit(req, "purchaseRequests", doc.id, "create", { prNo: doc.prNo, source: "reorder" });
      created.push(outPR(doc.toObject()));
    }
    created.forEach((d) => emitChange("purchaseRequests", "updated", { id: d.id, status: d.status, venueId }));
    res.status(201).json({ data: created });
  }));

  /* ═════════════ RFQ ═════════════ */
  async function resolveRfqSuppliers(ids) {
    if (ids === undefined) return [];
    if (!Array.isArray(ids)) throw bad("supplierIds must be a list");
    const uniq = [...new Set(ids.map((i) => str(i, 80)).filter(Boolean))];
    const found = await M.Supplier.find({ id: { $in: uniq } }).lean();
    if (found.length !== uniq.length) throw bad("Unknown supplier in the invitation list", "NO_SUPPLIER", 404);
    const unusable = found.filter((s) => s.status !== "active");
    if (unusable.length) throw bad(`Cannot invite ${unusable.map((s) => `${s.name} (${s.status})`).join(", ")}`, "SUPPLIER_BLOCKED", 409);
    return found.map((s) => ({ supplierId: s.id, name: s.name, status: "invited" }));
  }
  async function buildRfqLines(raw) {
    needLines(raw);
    const customs = await customUnits();
    const items = await loadItems(raw.map((l) => l.itemId));
    return raw.map((l) => {
      const item = items.get(l.itemId);
      if (!item) throw bad("Unknown item on a line", "NO_ITEM", 404);
      const q = baseQty(item, l, customs);
      return {
        itemId: item.id, itemName: item.name, sku: item.sku, ...q, unit: item.baseUnit,
        description: str(l.description, 300), brand: str(l.brand, 100), alternatives: str(l.alternatives, 300), qualitySpec: str(l.qualitySpec, 300),
        packaging: str(l.packaging, 200), requiredBy: date(l.requiredBy, "Required-by date"),
      };
    });
  }
  const rfqHeader = (b) => {
    const o = {};
    if (b.deadline !== undefined) o.deadline = date(b.deadline, "Deadline");
    if (b.requiredDate !== undefined) o.requiredDate = date(b.requiredDate, "Required date");
    for (const f of ["deliveryAddress"]) if (b[f] !== undefined) o[f] = str(b[f], 500);
    for (const f of ["paymentTerms", "deliveryTerms"]) if (b[f] !== undefined) o[f] = str(b[f], 200);
    if (b.notes !== undefined) o.notes = str(b.notes, 2000);
    return o;
  };

  router.get("/rfqs", requirePerm("purchaseRfq", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    const status = str(req.query.status, 40); if (status) q.status = status;
    const search = str(req.query.search, 60); if (search) q.rfqNo = { $regex: esc(search), $options: "i" };
    const [rows, total] = await Promise.all([PM.Rfq.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PM.Rfq.countDocuments(q)]);
    const counts = await PM.Quotation.aggregate([{ $match: { rfqId: { $in: rows.map((r) => r.id) } } }, { $group: { _id: "$rfqId", n: { $sum: 1 } } }]);
    const cm = new Map(counts.map((c) => [c._id, c.n]));
    res.json({ data: rows.map((r) => ({ ...outRfq(r), quotationCount: cm.get(r.id) || 0 })), page, limit, total });
  }));
  router.get("/rfqs/:id", requirePerm("purchaseRfq", "read"), wrap(async (req, res) => {
    const rfq = await loadScoped(PM.Rfq, req, req.params.id);
    const quotes = await PM.Quotation.find({ rfqId: rfq.id }).sort({ createdAt: 1 }).lean();
    res.json({ ...outRfq(rfq), quotations: quotes.map(outQuo) });
  }));

  router.post("/rfqs", requirePerm("purchaseRfq", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const suppliers = await resolveRfqSuppliers(req.body.supplierIds);
    const rfq = await PM.Rfq.create({
      ...rfqHeader(req.body), venueId, rfqNo: await M.nextNumber("rfq", "RFQ"), suppliers, lines: await buildRfqLines(req.body.lines),
      createdBy: req.admin.id, createdByName: req.admin.name,
    });
    audit(req, "purchaseRfq", rfq.id, "create", { rfqNo: rfq.rfqNo });
    res.status(201).json(outRfq(rfq.toObject()));
  }));

  router.patch("/rfqs/:id", requirePerm("purchaseRfq", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.Rfq, req, req.params.id);
    if (cur.status !== "draft") throw bad("Only a draft RFQ can be edited.", "INVALID_STATE", 409);
    const set = rfqHeader(req.body);
    if (req.body.lines !== undefined) set.lines = await buildRfqLines(req.body.lines);
    if (req.body.supplierIds !== undefined) set.suppliers = await resolveRfqSuppliers(req.body.supplierIds);
    if (!Object.keys(set).length) throw bad("Nothing to update");
    const doc = await PM.Rfq.findOneAndUpdate({ id: cur.id, status: "draft" }, { $set: set }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("The RFQ changed while you were editing; reload it.", "INVALID_STATE", 409);
    audit(req, "purchaseRfq", doc.id, "update", { rfqNo: doc.rfqNo });
    res.json(outRfq(doc));
  }));

  const rfqMove = (action, from, to, { needReason = false, after } = {}) => wrap(async (req, res) => {
    const cur = await loadScoped(PM.Rfq, req, req.params.id);
    const comment = str(req.body.reason || req.body.comment, 500);
    if (needReason && !comment) throw bad("A reason is required", "REASON_REQUIRED");
    const set = {};
    if (action === "sent") {
      if (!cur.suppliers.length) throw bad("Invite at least one supplier first", "NO_SUPPLIERS");
      if (!cur.lines.length) throw bad("The RFQ has no lines", "NO_LINES");
      const live = await M.Supplier.find({ id: { $in: cur.suppliers.map((s) => s.supplierId) } }).lean();
      const unusable = live.filter((s) => s.status !== "active");
      if (unusable.length) throw bad(`Remove ${unusable.map((s) => `${s.name} (${s.status})`).join(", ")} before sending`, "SUPPLIER_BLOCKED", 409);
      set.sentAt = new Date(); set.sentBy = req.admin.id;
    }
    const doc = await move(PM.Rfq, req, cur.id, C.RFQ_FLOW, from, to, { set, entry: { action, comment }, historyField: "history" });
    if (after) await after(doc, req);
    audit(req, "purchaseRfq", doc.id, "update", { status: doc.status, comment });
    notify("rfqs", doc);
    res.json(outRfq(doc));
  });
  router.post("/rfqs/:id/send", requirePerm("purchaseRfq", "write"), rfqMove("sent", ["draft"], "sent"));
  router.post("/rfqs/:id/evaluate", requirePerm("purchaseRfq", "write"), rfqMove("evaluation_started", ["sent", "responses_received"], "evaluation"));
  router.post("/rfqs/:id/close", requirePerm("purchaseRfq", "write"), rfqMove("closed", ["awarded"], "closed"));
  router.post("/rfqs/:id/cancel", requirePerm("purchaseRfq", "write"), rfqMove("cancelled", ["draft", "sent", "responses_received", "evaluation"], "cancelled", {
    needReason: true,
    after: async (doc) => { // the request goes back to "approved" so it can be re-planned
      if (doc.prId) await PM.PurchaseRequest.updateOne({ id: doc.prId, status: "rfq_issued", rfqId: doc.id }, { $set: { status: "approved", rfqId: null } });
    },
  }));

  /* ── quotations ── */
  router.post("/rfqs/:id/quotations", requirePerm("purchaseRfq", "write"), wrap(async (req, res) => {
    const rfq = await loadScoped(PM.Rfq, req, req.params.id);
    if (!["sent", "responses_received", "evaluation"].includes(rfq.status)) throw bad("Quotations can only be recorded while the RFQ is open.", "INVALID_STATE", 409);
    const b = req.body || {};
    const invited = rfq.suppliers.find((s) => s.supplierId === str(b.supplierId, 80));
    if (!invited) throw bad("That supplier was not invited to this RFQ", "NOT_INVITED", 409);
    const supplier = await M.Supplier.findOne({ id: invited.supplierId }).lean();
    if (!supplier || supplier.status !== "active") throw bad("That supplier is not active", "SUPPLIER_BLOCKED", 409);
    const supplierRef = str(b.supplierRef, 80);
    if (supplierRef && (await PM.Quotation.exists({ rfqId: rfq.id, supplierId: supplier.id, supplierRef }))) throw bad("This supplier quotation reference was already recorded", "DUPLICATE_QUOTATION", 409);
    needLines(b.lines);
    const customs = await customUnits();
    const items = await loadItems(b.lines.map((l) => l.itemId));
    const rfqItems = new Map(rfq.lines.map((l) => [l.itemId, l]));
    const lines = b.lines.map((l) => {
      const rl = rfqItems.get(l.itemId);
      if (!rl) throw bad("A quoted item is not part of this RFQ", "NOT_IN_RFQ");
      const item = items.get(l.itemId);
      const qtyMilli = l.qty !== undefined && l.qty !== "" ? baseQty(item, l, customs).qtyMilli : rl.qtyMilli;
      const unitPriceMicro = C.costPerBaseMicro(item, str(l.unit, 20).toLowerCase() || item.baseUnit, l.unitPrice, customs);
      const discountBp = C.toBp(l.discountPct || 0, "Discount"), gstBp = C.toBp(l.gstRate ?? item.gstRate ?? 0, "GST rate");
      return {
        itemId: item.id, itemName: item.name, brand: str(l.brand, 100), qtyMilli, unit: item.baseUnit, unitPriceMicro, discountBp, gstBp,
        ...C.calcLine({ qtyMilli, unitPriceMicro, discountBp, gstBp }), availability: str(l.availability, 100), leadTimeDays: Math.max(0, Math.min(365, parseInt(l.leadTimeDays, 10) || 0)),
      };
    });
    const freightPaise = b.freight ? P.toPaise(b.freight, "freight") : 0, otherChargesPaise = b.otherCharges ? P.toPaise(b.otherCharges, "other charges") : 0;
    if (freightPaise < 0 || otherChargesPaise < 0) throw bad("Charges cannot be negative");
    const quo = await PM.Quotation.create({
      quoNo: await M.nextNumber("quo", "QUO"), venueId: rfq.venueId, rfqId: rfq.id, supplierId: supplier.id, supplierName: supplier.name, supplierRef,
      quotationDate: date(b.quotationDate, "Quotation date") || new Date(), validUntil: date(b.validUntil, "Valid until"),
      lines, freightPaise, otherChargesPaise, totals: C.calcTotals(lines, { freightPaise, otherPaise: otherChargesPaise }),
      paymentTerms: str(b.paymentTerms, 200), remarks: str(b.remarks, 1000), recordedBy: req.admin.id, recordedByName: req.admin.name,
    });
    // whole-array write rather than the positional operator, which not every MongoDB-compatible store supports
    await PM.Rfq.updateOne({ id: rfq.id }, { $set: { suppliers: rfq.suppliers.map((s) => (s.supplierId === supplier.id ? { ...s, status: "responded" } : s)) } });
    if (rfq.status === "sent") await PM.Rfq.updateOne({ id: rfq.id, status: "sent" }, { $set: { status: "responses_received" } });
    audit(req, "purchaseRfq", quo.id, "create", { quoNo: quo.quoNo, rfq: rfq.rfqNo, total: quo.totals.grandTotalPaise });
    notify("rfqs", { ...rfq, status: rfq.status === "sent" ? "responses_received" : rfq.status });
    res.status(201).json(outQuo(quo.toObject()));
  }));

  const quoMove = (action, to, { needReason }) => wrap(async (req, res) => {
    const q = await loadScoped(PM.Quotation, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (needReason && !reason) throw bad("A reason is required", "REASON_REQUIRED");
    const rfq = await PM.Rfq.findOne({ id: q.rfqId }).lean();
    if (!rfq || !["sent", "responses_received", "evaluation"].includes(rfq.status)) throw bad("The RFQ is no longer open.", "INVALID_STATE", 409);
    const doc = await PM.Quotation.findOneAndUpdate({ id: q.id, status: { $in: ["received", "shortlisted", "revision_requested"] } }, { $set: { status: to, decisionReason: reason } }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("This quotation is already decided.", "INVALID_STATE", 409);
    audit(req, "purchaseRfq", doc.id, "update", { status: to, reason });
    res.json(outQuo(doc));
  });
  router.post("/quotations/:id/shortlist", requirePerm("purchaseRfq", "write"), quoMove("shortlist", "shortlisted", { needReason: false }));
  router.post("/quotations/:id/reject", requirePerm("purchaseRfq", "write"), quoMove("reject", "rejected", { needReason: true }));
  router.post("/quotations/:id/request-revision", requirePerm("purchaseRfq", "write"), quoMove("revision", "revision_requested", { needReason: true }));

  // Evaluation matrix. Informational only: selection is always a person's decision with a recorded reason.
  router.get("/rfqs/:id/comparison", requirePerm("purchaseRfq", "read"), wrap(async (req, res) => {
    const rfq = await loadScoped(PM.Rfq, req, req.params.id);
    const all = await PM.Quotation.find({ rfqId: rfq.id, status: { $ne: "rejected" } }).sort({ createdAt: 1 }).lean();
    const latest = new Map(); // newest live quotation per supplier
    for (const q of all) if (q.status !== "revision_requested") latest.set(q.supplierId, q);
    const quotes = [...latest.values()];
    const perf = await require("./receivingRoutes").supplierPerformance([...new Set(quotes.map((q) => q.supplierId))]);
    const suppliers = quotes.map((q) => {
      const covered = rfq.lines.filter((l) => q.lines.some((ql) => ql.itemId === l.itemId)).length;
      return {
        quotationId: q.id, quoNo: q.quoNo, supplierId: q.supplierId, supplierName: q.supplierName, status: q.status,
        taxable: P.fromPaise(q.totals.taxablePaise), tax: P.fromPaise(q.totals.taxPaise), freight: P.fromPaise(q.freightPaise), otherCharges: P.fromPaise(q.otherChargesPaise),
        total: P.fromPaise(q.totals.grandTotalPaise), paymentTerms: q.paymentTerms, validUntil: q.validUntil, expired: !!(q.validUntil && +new Date(q.validUntil) < Date.now()),
        deliveryLeadDays: Math.max(0, ...q.lines.map((l) => l.leadTimeDays || 0)), coverage: { covered, of: rfq.lines.length },
        reliability: perf.get(q.supplierId) ? { onTimePct: perf.get(q.supplierId).onTimePct, fillRatePct: perf.get(q.supplierId).fillRatePct, receipts: perf.get(q.supplierId).receipts } : null,
        qualityCompliance: perf.get(q.supplierId) ? perf.get(q.supplierId).qualityCompliancePct : null, // from posted goods receipts; null = no history
      };
    });
    const items = rfq.lines.map((l) => ({
      itemId: l.itemId, itemName: l.itemName, qty: P.fromMilli(l.qtyMilli), unit: l.unit,
      offers: quotes.map((q) => {
        const ql = q.lines.find((x) => x.itemId === l.itemId);
        return ql ? { supplierId: q.supplierId, brand: ql.brand, unitPrice: P.fromMicro(ql.unitPriceMicro), discountPct: ql.discountBp / 100, effectiveUnitPrice: ql.qtyMilli ? Number((ql.taxablePaise / 100 / (ql.qtyMilli / 1000)).toFixed(4)) : 0, gstRate: ql.gstBp / 100, lineTotal: P.fromPaise(ql.totalPaise), leadTimeDays: ql.leadTimeDays, availability: ql.availability } : { supplierId: q.supplierId, missing: true };
      }),
    }));
    const full = suppliers.filter((s) => s.coverage.covered === s.coverage.of && !s.expired);
    const lowest = full.length ? full.reduce((a, b) => (b.total < a.total ? b : a)).supplierId : null;
    res.json({ rfq: { id: rfq.id, rfqNo: rfq.rfqNo, status: rfq.status }, suppliers, items, lowestFullCoverageSupplierId: lowest, note: "The lowest total is shown for information only. Awarding requires a person to choose a quotation and record the reason." });
  }));

  router.post("/rfqs/:id/award", requirePerm("purchaseRfq", "write"), wrap(async (req, res) => {
    const rfq = await loadScoped(PM.Rfq, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("Record why this supplier was selected", "REASON_REQUIRED");
    const quo = await PM.Quotation.findOne({ id: str(req.body.quotationId, 80), rfqId: rfq.id }).lean();
    if (!quo) throw bad("Quotation not found on this RFQ", "NOT_FOUND", 404);
    if (["rejected", "revision_requested"].includes(quo.status)) throw bad(`That quotation is ${quo.status.replace("_", " ")}`, "INVALID_STATE", 409);
    if (quo.validUntil && +new Date(quo.validUntil) < Date.now()) throw bad("That quotation has expired; request a revision.", "QUOTATION_EXPIRED", 409);
    const sup = await M.Supplier.findOne({ id: quo.supplierId }).lean();
    if (!sup || sup.status !== "active") throw bad("That supplier is not active", "SUPPLIER_BLOCKED", 409);
    const doc = await move(PM.Rfq, req, rfq.id, C.RFQ_FLOW, ["responses_received", "evaluation"], "awarded", { set: { awardedQuotationId: quo.id, selectionReason: reason }, entry: { action: "awarded", comment: reason }, historyField: "history" });
    await PM.Quotation.updateOne({ id: quo.id }, { $set: { status: "selected", decisionReason: reason } });
    await PM.Quotation.updateMany({ rfqId: rfq.id, id: { $ne: quo.id }, status: { $in: ["received", "shortlisted"] } }, { $set: { status: "rejected", decisionReason: "Another quotation was selected" } });
    audit(req, "purchaseRfq", doc.id, "update", { status: "awarded", quotation: quo.quoNo, reason });
    notify("rfqs", doc);
    res.json(outRfq(doc));
  }));

  /* ═════════════ PURCHASE ORDERS ═════════════ */
  async function poHeader(b) {
    const o = {};
    if (b.expectedDate !== undefined) o.expectedDate = date(b.expectedDate, "Expected delivery date");
    if (b.orderDate !== undefined && b.orderDate) o.orderDate = date(b.orderDate, "Order date");
    for (const f of ["paymentTerms", "deliveryTerms"]) if (b[f] !== undefined) o[f] = str(b[f], 200);
    if (b.deliveryAddress !== undefined) o.deliveryAddress = str(b.deliveryAddress, 500);
    if (b.notes !== undefined) o.notes = str(b.notes, 2000);
    return o;
  }
  /** raw lines: { itemId, qty|qtyMilli, unit, unitPrice|unitPriceMicro, discountPct, gstRate, expectedDate, brand } */
  async function buildPoLines(raw, defaults = {}) {
    needLines(raw);
    const customs = await customUnits();
    const items = await loadItems(raw.map((l) => l.itemId));
    return raw.map((l) => {
      const item = items.get(l.itemId);
      if (!item) throw bad("Unknown item on a line", "NO_ITEM", 404);
      if (item.status !== "active") throw bad(`${item.name} is inactive`, "ITEM_INACTIVE", 409);
      const q = l.qtyMilli !== undefined ? { qtyMilli: l.qtyMilli, enteredQty: l.enteredQty ?? P.fromMilli(l.qtyMilli), enteredUnit: l.enteredUnit || item.baseUnit } : baseQty(item, l, customs);
      if (!(q.qtyMilli > 0)) throw bad(`Quantity for ${item.name} must be greater than zero`, "BAD_QTY");
      const unitPriceMicro = l.unitPriceMicro !== undefined ? l.unitPriceMicro : C.costPerBaseMicro(item, q.enteredUnit, l.unitPrice, customs);
      if (!(unitPriceMicro >= 0)) throw bad(`Unit price for ${item.name} is invalid`, "BAD_PRICE");
      const discountBp = l.discountBp !== undefined ? l.discountBp : C.toBp(l.discountPct || 0, "Discount");
      const gstBp = l.gstBp !== undefined ? l.gstBp : C.toBp(l.gstRate ?? item.gstRate ?? 0, "GST rate");
      return {
        itemId: item.id, itemName: item.name, sku: item.sku, brand: str(l.brand, 100), ...q, unit: item.baseUnit,
        unitPriceMicro, discountBp, gstBp, ...C.calcLine({ qtyMilli: q.qtyMilli, unitPriceMicro, discountBp, gstBp }),
        expectedDate: date(l.expectedDate, "Line expected date") || defaults.expectedDate || null, receivedMilli: 0, closedMilli: 0,
      };
    });
  }
  async function finishPo(lines, supplier, { freightPaise = 0, otherPaise = 0 }) {
    const settings = await getSettings();
    const totals = C.calcTotals(lines, { freightPaise, otherPaise });
    return { totals, taxSplit: C.taxSplit(totals.taxPaise, supplier.gstin, settings.gstStateCode) };
  }
  const charges = (b) => {
    const freightPaise = b.freight ? P.toPaise(b.freight, "freight") : 0, otherPaise = b.otherCharges ? P.toPaise(b.otherCharges, "other charges") : 0;
    if (freightPaise < 0 || otherPaise < 0) throw bad("Charges cannot be negative");
    return { freightPaise, otherPaise };
  };
  async function usableSupplier(id) {
    const s = await M.Supplier.findOne({ id: str(id, 80) }).lean();
    if (!s) throw bad("Unknown supplier", "NO_SUPPLIER", 404);
    if (s.status !== "active") throw bad(`${s.name} is ${s.status}; orders cannot be raised.`, "SUPPLIER_BLOCKED", 409);
    return s;
  }

  async function createPo(req, { venueId, supplierId, prId = null, rfqId = null, quotationId = null, linesRaw, body, defaults = {} }) {
    const supplier = await usableSupplier(supplierId);
    const header = await poHeader({ ...defaults, ...body });
    const lines = await buildPoLines(linesRaw, { expectedDate: header.expectedDate });
    const { totals, taxSplit } = await finishPo(lines, supplier, charges({ ...defaults, ...body }));
    const doc = await PM.PurchaseOrder.create({
      ...header, venueId, poNo: await M.nextNumber("po", "PO"), supplierId: supplier.id, supplierName: supplier.name, supplierGstin: supplier.gstin,
      prId, rfqId, quotationId, buyerId: req.admin.id, buyerName: req.admin.name, lines, totals, taxSplit,
      paymentTerms: header.paymentTerms ?? supplier.paymentTerms ?? "",
    });
    audit(req, "purchaseOrders", doc.id, "create", { poNo: doc.poNo, total: totals.grandTotalPaise });
    notify("purchaseOrders", doc);
    return doc.toObject();
  }

  router.get("/orders", requirePerm("purchaseOrders", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["status", "supplierId"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    if (req.query.overdue === "true") { q.status = { $in: ["sent", "partially_received"] }; q.expectedDate = { $lt: new Date() }; }
    const from = req.query.from ? new Date(String(req.query.from)) : null, to = req.query.to ? new Date(String(req.query.to)) : null;
    if ((from && isNaN(from)) || (to && isNaN(to))) throw bad("Invalid date filter");
    if (from || to) q.orderDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const search = str(req.query.search, 60);
    if (search) q.$or = [{ poNo: { $regex: esc(search), $options: "i" } }, { supplierName: { $regex: esc(search), $options: "i" } }];
    const [rows, total] = await Promise.all([PM.PurchaseOrder.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PM.PurchaseOrder.countDocuments(q)]);
    res.json({ data: rows.map(outPO), page, limit, total });
  }));
  router.get("/orders/:id", requirePerm("purchaseOrders", "read"), wrap(async (req, res) => res.json(outPO(await loadScoped(PM.PurchaseOrder, req, req.params.id)))));

  router.post("/orders", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const b = req.body || {};
    const source = str(b.source, 20) || "manual";
    if (source === "request") return res.status(400).json({ error: "Use POST /requests/:id/convert-to-po", code: "USE_CONVERT" });
    if (source === "quotation") {
      const quo = await loadScoped(PM.Quotation, req, str(b.quotationId, 80));
      const rfq = await loadScoped(PM.Rfq, req, quo.rfqId);
      if (quo.status !== "selected" || rfq.status !== "awarded" || rfq.awardedQuotationId !== quo.id) throw bad("Only the awarded quotation can be turned into an order.", "NOT_AWARDED", 409);
      if (await PM.PurchaseOrder.exists({ quotationId: quo.id, status: { $ne: "cancelled" } })) throw bad("An order already exists for this quotation.", "ALREADY_ORDERED", 409);
      const po = await createPo(req, {
        venueId: quo.venueId, supplierId: quo.supplierId, prId: rfq.prId, rfqId: rfq.id, quotationId: quo.id, body: b,
        defaults: { paymentTerms: quo.paymentTerms || rfq.paymentTerms, deliveryTerms: rfq.deliveryTerms, deliveryAddress: rfq.deliveryAddress, expectedDate: rfq.requiredDate, freight: P.fromPaise(quo.freightPaise), otherCharges: P.fromPaise(quo.otherChargesPaise) },
        linesRaw: quo.lines.map((l) => ({ itemId: l.itemId, qtyMilli: l.qtyMilli, unitPriceMicro: l.unitPriceMicro, discountBp: l.discountBp, gstBp: l.gstBp, brand: l.brand })),
      });
      if (rfq.prId) {
        await PM.PurchaseRequest.updateOne({ id: rfq.prId, status: { $in: ["rfq_issued", "approved"] } }, { $set: { status: "ordered" }, $push: { poIds: po.id } });
      }
      return res.status(201).json(outPO(po));
    }
    // manual purchase — only when explicitly enabled
    if (!(await getSettings()).allowManualPo) throw bad("Manual purchase orders are disabled. Raise a purchase request, or enable manual orders in Purchase settings.", "MANUAL_PO_DISABLED", 403);
    const venueId = await venueFor(req);
    const po = await createPo(req, { venueId, supplierId: b.supplierId, linesRaw: needLines(b.lines), body: b });
    res.status(201).json(outPO(po));
  }));

  router.patch("/orders/:id", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    if (cur.status !== "draft") throw bad("Only a draft order can be edited. Use a revision for an approved or sent order.", "INVALID_STATE", 409);
    if (!(await canEdit(req, cur.buyerId))) throw bad("Only the buyer can edit this order.", "FORBIDDEN", 403);
    const b = req.body || {};
    const set = await poHeader(b);
    let lines = cur.lines;
    if (b.lines !== undefined) {
      const raw = needLines(b.lines).map((l) => { // quantities already received are preserved
        const old = cur.lines.find((x) => x.itemId === l.itemId);
        return old && l.qty === undefined && l.qtyMilli === undefined ? { ...l, qtyMilli: old.qtyMilli, enteredQty: old.enteredQty, enteredUnit: old.enteredUnit } : l;
      });
      lines = await buildPoLines(raw, { expectedDate: set.expectedDate ?? cur.expectedDate });
      set.lines = lines;
    }
    const supplier = await usableSupplier(cur.supplierId);
    const ch = { freightPaise: b.freight !== undefined ? P.toPaise(b.freight || 0, "freight") : cur.totals.freightPaise, otherPaise: b.otherCharges !== undefined ? P.toPaise(b.otherCharges || 0, "other charges") : cur.totals.otherPaise };
    if (ch.freightPaise < 0 || ch.otherPaise < 0) throw bad("Charges cannot be negative");
    Object.assign(set, await finishPo(lines, supplier, ch));
    const doc = await PM.PurchaseOrder.findOneAndUpdate({ id: cur.id, status: "draft" }, { $set: set }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("The order changed while you were editing; reload it.", "INVALID_STATE", 409);
    audit(req, "purchaseOrders", doc.id, "update", { poNo: doc.poNo, total: doc.totals.grandTotalPaise });
    res.json(outPO(doc));
  }));

  router.post("/orders/:id/submit", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    if (!(await canEdit(req, cur.buyerId))) throw bad("Only the buyer can submit this order.", "FORBIDDEN", 403);
    if (!cur.lines.length) throw bad("The order has no lines", "NO_LINES");
    await usableSupplier(cur.supplierId);
    const settings = await getSettings();
    const auto = settings.poApprovalLimitPaise > 0 && cur.totals.grandTotalPaise <= settings.poApprovalLimitPaise;
    const doc = await move(PM.PurchaseOrder, req, cur.id, C.PO_FLOW, ["draft"], auto ? "approved" : "pending_approval", { entry: { action: auto ? "auto_approved" : "submitted", comment: str(req.body.comment, 500) } });
    audit(req, "purchaseOrders", doc.id, "update", { status: doc.status });
    notify("purchaseOrders", doc);
    res.json(outPO(doc));
  }));

  const poDecide = (action, to, needComment) => wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    const comment = str(req.body.comment || req.body.reason, 500);
    if (needComment && !comment) throw bad("A reason is required", "REASON_REQUIRED");
    assertMakerChecker(await getSettings(), cur.buyerId, req);
    const doc = await move(PM.PurchaseOrder, req, cur.id, C.PO_FLOW, ["pending_approval"], to, { entry: { action, comment } });
    audit(req, "purchaseOrders", doc.id, "update", { status: doc.status, comment });
    notify("purchaseOrders", doc);
    res.json(outPO(doc));
  });
  router.post("/orders/:id/approve", requirePerm("purchaseApprovals", "write"), poDecide("approved", "approved", false));
  router.post("/orders/:id/reject", requirePerm("purchaseApprovals", "write"), poDecide("rejected", "rejected", true));

  // Records that the order was sent. Dishky does not transmit it; `via` says how the buyer sent it.
  router.post("/orders/:id/send", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    await usableSupplier(cur.supplierId);
    const via = ["whatsapp", "email", "phone", "in_person", "print"].includes(req.body.via) ? req.body.via : "manual";
    const doc = await move(PM.PurchaseOrder, req, cur.id, C.PO_FLOW, ["approved"], "sent", { set: { sentAt: new Date(), sentBy: req.admin.id, sentVia: via }, entry: { action: "sent", comment: via } });
    audit(req, "purchaseOrders", doc.id, "update", { status: "sent", via });
    notify("purchaseOrders", doc);
    res.json(outPO(doc));
  }));

  // Versioned revision: snapshot, bump version, and send back through approval.
  router.post("/orders/:id/revise", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required for a revision", "REASON_REQUIRED");
    if (cur.lines.some((l) => l.receivedMilli > 0)) throw bad("Goods were already received against this order; it cannot be revised. Short-close it and raise a new order.", "HAS_RECEIPTS", 409);
    const { revisions, ...snapshot } = cur;
    const doc = await move(PM.PurchaseOrder, req, cur.id, C.PO_FLOW, ["approved", "sent"], "draft", {
      set: { version: cur.version + 1, sentAt: null, sentBy: null, sentVia: "" },
      entry: { action: "revised", comment: reason },
    });
    await PM.PurchaseOrder.updateOne({ id: cur.id }, { $push: { revisions: { version: cur.version, reason, by: req.admin.id, byName: req.admin.name, at: new Date(), snapshot } } });
    audit(req, "purchaseOrders", doc.id, "update", { status: "draft", version: doc.version, reason });
    notify("purchaseOrders", doc);
    res.json(outPO(await PM.PurchaseOrder.findOne({ id: cur.id }).lean()));
  }));

  router.post("/orders/:id/cancel", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required", "REASON_REQUIRED");
    if (cur.lines.some((l) => l.receivedMilli > 0)) throw bad("Goods were already received against this order. Close (short-close) it instead of cancelling.", "HAS_RECEIPTS", 409);
    const doc = await move(PM.PurchaseOrder, req, cur.id, C.PO_FLOW, ["draft", "pending_approval", "rejected", "approved", "sent"], "cancelled", { set: { cancelReason: reason }, entry: { action: "cancelled", comment: reason } });
    // release the request so it can be ordered again
    if (cur.prId) await PM.PurchaseRequest.updateOne({ id: cur.prId, status: "ordered" }, { $set: { status: "approved" }, $pull: { poIds: cur.id } });
    audit(req, "purchaseOrders", doc.id, "update", { status: "cancelled", reason });
    notify("purchaseOrders", doc);
    res.json(outPO(doc));
  }));

  // Short-close: stop expecting the outstanding quantity (used after partial deliveries).
  router.post("/orders/:id/close", requirePerm("purchaseOrders", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(PM.PurchaseOrder, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required", "REASON_REQUIRED");
    const lines = cur.lines.map((l) => ({ ...l, closedMilli: (l.closedMilli || 0) + Math.max(0, l.qtyMilli - l.receivedMilli - (l.closedMilli || 0)) }));
    const doc = await move(PM.PurchaseOrder, req, cur.id, C.PO_FLOW, ["sent", "partially_received", "received"], "closed", { set: { lines }, entry: { action: "closed", comment: reason } });
    audit(req, "purchaseOrders", doc.id, "update", { status: "closed", reason });
    notify("purchaseOrders", doc);
    res.json(outPO(doc));
  }));

  return router;
}

module.exports = { buildPurchaseRouter };
