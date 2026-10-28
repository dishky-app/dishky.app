/**
 * automationRoutes.js — Phase 5. Mounted at /automation.
 *
 *   /settings                      thresholds + WhatsApp template name
 *   /alerts                        computed live from stock, orders, invoices, approvals (nothing is stored but consumption issues)
 *   /forecast                      consumption-history forecast + cover days + suggested order quantity
 *   /consumption                   usage by item (orders vs waste vs adjustments) and ledger coverage
 *   /suppliers/performance         scorecards
 *   /audits                        stock audits: count -> submit -> approve (maker-checker) -> post adjustments to the ledger
 *   /whatsapp/purchase-list/...    preview / send a purchase list to a supplier (user-triggered, rate-limited, logged)
 */
const express = require("express");
const { safeErrorMessage } = require("../../core/validation");
const M = require("./models");
const PM = require("./purchaseModels");
const FM = require("./financeModels");
const RM = require("./receivingModels");
const A = require("./automationModels");
const F = require("./forecastCalc");
const P = require("./precision");
const U = require("./units");
const svc = require("./stockService");
const { supplierPerformance } = require("./receivingRoutes");
const { getModel } = require("../../core/genericModel");

const OPEN_PO = ["approved", "sent", "partially_received"];
const AUDIT_FLOW = { counting: ["pending_approval", "cancelled"], pending_approval: ["approved", "counting", "cancelled"], approved: ["posted", "cancelled"], posted: [], cancelled: [] };
const locks = new Map();
async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const tail = prev.then(() => mine);
  locks.set(key, tail);
  await prev;
  try { return await fn(); } finally { release(); if (locks.get(key) === tail) locks.delete(key); }
}

function buildAutomationRouter({ requireAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange, sendTemplate, getVenueName }) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((req, _res, next) => { if (!req.body || typeof req.body !== "object") req.body = {}; next(); });

  const bad = (message, code = "BAD_REQUEST", status = 400, details) => Object.assign(new Error(message), { name: "InventoryError", code, status, details });
  const fail = (res, err) => {
    if (err && ["InventoryError", "UnitError", "PrecisionError"].includes(err.name)) return res.status(err.status || 400).json({ error: err.message, code: err.code, details: err.details });
    if (err && err.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err && (err.code === 11000 || /E11000/.test(String(err.message)))) return res.status(409).json({ error: "A record with the same unique value already exists.", code: "DUPLICATE" });
    console.error("[automation] unhandled:", err && err.stack);
    return res.status(500).json({ error: safeErrorMessage(err) });
  };
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max).trim() : "");
  const paging = (req) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    return { limit, page, skip: (page - 1) * limit };
  };
  const venueFor = async (req) => {
    const venueId = scopeVenueForCreate(req);
    if (!venueId) throw bad("venueId is required (Super Admin must specify a branch)", "VENUE_REQUIRED");
    if (!(await venueBelongsToTenant(venueId))) throw bad("Unknown branch", "BAD_VENUE");
    return venueId;
  };
  // the audit log only knows create/update/delete; the specific event travels in `after.event`
  const audit = (req, resource, id, action, after, before) => {
    const std = ["create", "update", "delete"].includes(action);
    return logAudit(req, { action: std ? action : "update", resource, targetId: id, after: std ? after : { event: action, ...(after || {}) }, before });
  };
  const notify = (resource, doc) => emitChange(resource, "updated", { id: doc.id, status: doc.status, venueId: doc.venueId });
  const strip = ({ _id, ...rest }) => rest;
  const entry = (req, action, toStatus, comment = "") => ({ action, by: req.admin.id, byName: req.admin.name, at: new Date(), comment, toStatus });
  const customUnits = () => M.CustomUnit.find({}).lean();
  const canMoveTo = (from, to) => !!(AUDIT_FLOW[from] && AUDIT_FLOW[from].includes(to));

  /** conditional status change: only succeeds if the document is still in `from` */
  async function move(Model, req, id, from, to, { set = {}, comment = "" } = {}) {
    if (!canMoveTo(from, to)) throw bad(`Cannot move from ${from} to ${to}`, "BAD_STATE", 409);
    const upd = await Model.updateOne(
      { id, venueId: scopeFilter(req).venueId || { $exists: true }, status: from },
      { $set: { ...set, status: to }, $push: { history: entry(req, to, to, comment) } }
    );
    if (!upd.modifiedCount && !upd.nModified) throw bad("This record was changed by someone else — reload and try again.", "STATE_CHANGED", 409);
  }

  /* ═════════════ SETTINGS ═════════════ */
  const getSettings = async () => {
    const s = await A.AutomationSettings.findOne({ key: "automation" }).lean();
    return { expiryAlertDays: 7, dueSoonDays: 3, forecastLookbackDays: 28, forecastHorizonDays: 7, auditVarianceApprovalPaise: 0, whatsappPurchaseTemplate: "", whatsappHourlyLimit: 20, ...(s || {}) };
  };
  const outSettings = (s) => ({
    expiryAlertDays: s.expiryAlertDays, dueSoonDays: s.dueSoonDays, forecastLookbackDays: s.forecastLookbackDays, forecastHorizonDays: s.forecastHorizonDays,
    largeVarianceThreshold: P.fromPaise(s.auditVarianceApprovalPaise), whatsappPurchaseTemplate: s.whatsappPurchaseTemplate, whatsappHourlyLimit: s.whatsappHourlyLimit,
    whatsappConfigured: !!process.env.AISENSY_API_KEY && !!s.whatsappPurchaseTemplate,
  });
  router.get("/settings", requirePerm("purchaseSettings", "read"), wrap(async (_req, res) => res.json(outSettings(await getSettings()))));
  router.put("/settings", requirePerm("purchaseSettings", "write"), wrap(async (req, res) => {
    const b = req.body, set = {};
    const num = (k, lo, hi, field = k) => {
      if (b[k] === undefined) return;
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n < lo || n > hi) throw bad(`${k} must be a whole number between ${lo} and ${hi}`);
      set[field] = n;
    };
    num("expiryAlertDays", 1, 90); num("dueSoonDays", 0, 60); num("forecastLookbackDays", 7, 120); num("forecastHorizonDays", 1, 60); num("whatsappHourlyLimit", 1, 200);
    if (b.largeVarianceThreshold !== undefined) set.auditVarianceApprovalPaise = P.toPaise(b.largeVarianceThreshold, "largeVarianceThreshold");
    if (b.whatsappPurchaseTemplate !== undefined) {
      const t = str(b.whatsappPurchaseTemplate, 100);
      if (t && !/^[A-Za-z0-9_\-. ]+$/.test(t)) throw bad("Template name may only contain letters, numbers, spaces, - _ .");
      set.whatsappPurchaseTemplate = t;
    }
    const before = await getSettings();
    await A.AutomationSettings.updateOne({ key: "automation" }, { $set: set }, { upsert: true });
    const after = await getSettings();
    audit(req, "purchaseSettings", "automation", "update", set, before);
    res.json(outSettings(after));
  }));

  /* ═════════════ ALERTS ═════════════ */
  async function availableMap(venueId) {
    const rows = await M.StockBalance.find({ venueId }).lean();
    const now = Date.now();
    const m = new Map();
    for (const r of rows) {
      const a = m.get(r.itemId) || { available: 0, hasRow: true };
      if (!(r.expiryDate && +new Date(r.expiryDate) < now)) a.available += Math.max(0, r.availableMilli);
      m.set(r.itemId, a);
    }
    return { m, rows };
  }

  router.get("/alerts", requirePerm("inventoryAlerts", "read"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const st = await getSettings();
    const now = new Date();
    const items = await M.InventoryItem.find({ status: "active" }).lean();
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const { m: avail, rows: balances } = await availableMap(venueId);

    const low = [], out = [];
    for (const it of items) {
      const a = avail.get(it.id);
      const policy = it.reorderPointMilli > 0 || it.minStockMilli > 0;
      if (!policy && !a) continue;
      const have = a ? a.available : 0;
      const row = { itemId: it.id, name: it.name, sku: it.sku, unit: it.baseUnit, available: P.fromMilli(have), reorderPoint: P.fromMilli(it.reorderPointMilli), minStock: P.fromMilli(it.minStockMilli) };
      if (have <= 0 && (policy || (a && a.hasRow))) out.push(row);
      else if ((it.reorderPointMilli > 0 && have <= it.reorderPointMilli) || (it.minStockMilli > 0 && have < it.minStockMilli)) low.push(row);
    }
    const horizon = new Date(+now + st.expiryAlertDays * 864e5);
    const batchRow = (b) => { const it = itemMap.get(b.itemId); return { itemId: b.itemId, name: it ? it.name : b.itemId, unit: it ? it.baseUnit : "", batchNo: b.batchNo, locationId: b.locationId, onHand: P.fromMilli(b.qtyOnHandMilli), expiryDate: b.expiryDate, daysLeft: b.expiryDate ? Math.ceil((+new Date(b.expiryDate) - +now) / 864e5) : null, value: P.fromPaise(P.valuePaise(b.qtyOnHandMilli, b.unitCostMicro)) }; };
    const expired = balances.filter((b) => b.expiryDate && +new Date(b.expiryDate) < +now && b.qtyOnHandMilli > 0).map(batchRow);
    const nearExpiry = balances.filter((b) => b.expiryDate && +new Date(b.expiryDate) >= +now && +new Date(b.expiryDate) <= +horizon && b.qtyOnHandMilli > 0).map(batchRow).sort((a, b) => a.daysLeft - b.daysLeft);
    const quarantined = balances.filter((b) => b.quarantinedMilli > 0).map((b) => ({ ...batchRow(b), quarantined: P.fromMilli(b.quarantinedMilli) }));

    const [pos, invs, issues, prPending, poPending, retPending, payPending, auditsPending, grnDraft] = await Promise.all([
      PM.PurchaseOrder.find({ venueId, status: { $in: OPEN_PO }, expectedDate: { $lt: now } }).lean(),
      FM.SupplierInvoice.find({ venueId, status: "approved", pendingPaise: { $gt: 0 } }).lean(),
      A.ConsumptionIssue.find({ venueId, resolved: false }).sort({ createdAt: -1 }).limit(100).lean(),
      PM.PurchaseRequest.countDocuments({ venueId, status: "pending_approval" }),
      PM.PurchaseOrder.countDocuments({ venueId, status: "pending_approval" }),
      RM.SupplierReturn.countDocuments({ venueId, status: "pending_approval" }),
      FM.SupplierPayment.countDocuments({ venueId, status: "pending_approval" }),
      A.StockAudit.countDocuments({ venueId, status: "pending_approval" }),
      RM.Grn.countDocuments({ venueId, status: "draft" }),
    ]);
    const overduePos = pos.map((p) => ({ id: p.id, poNo: p.poNo, supplierName: p.supplierName, expectedDate: p.expectedDate, daysLate: Math.floor((+now - +new Date(p.expectedDate)) / 864e5) })).sort((a, b) => b.daysLate - a.daysLate);
    const soon = new Date(+now + st.dueSoonDays * 864e5);
    const invRow = (i) => ({ id: i.id, docNo: i.docNo, invoiceNo: i.invoiceNo, supplierName: i.supplierName, dueDate: i.dueDate, pending: P.fromPaise(i.pendingPaise), daysOverdue: Math.floor((+now - +new Date(i.dueDate)) / 864e5) });
    const invoicesOverdue = invs.filter((i) => i.dueDate && +new Date(i.dueDate) < +now).map(invRow).sort((a, b) => b.daysOverdue - a.daysOverdue);
    const invoicesDueSoon = invs.filter((i) => i.dueDate && +new Date(i.dueDate) >= +now && +new Date(i.dueDate) <= +soon).map(invRow);
    const consumptionIssues = issues.map((i) => ({ id: i.id, orderId: i.orderId, itemName: i.itemName, kind: i.kind, shortfall: P.fromMilli(i.shortfallMilli), unit: i.unit, detail: i.detail, at: i.createdAt }));

    const sections = {
      outOfStock: out, lowStock: low, expired, nearExpiry, quarantined, overduePurchaseOrders: overduePos,
      invoicesOverdue, invoicesDueSoon, consumptionIssues,
    };
    const severity = { outOfStock: "critical", expired: "critical", consumptionIssues: "warning", lowStock: "warning", nearExpiry: "warning", overduePurchaseOrders: "warning", invoicesOverdue: "warning", quarantined: "info", invoicesDueSoon: "info" };
    res.json({
      generatedAt: now, venueId, settings: { expiryAlertDays: st.expiryAlertDays, dueSoonDays: st.dueSoonDays },
      counts: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.length])),
      severity,
      pendingApprovals: { purchaseRequests: prPending, purchaseOrders: poPending, supplierReturns: retPending, payments: payPending, stockAudits: auditsPending, draftGoodsReceipts: grnDraft },
      ...sections,
    });
  }));

  router.post("/alerts/consumption-issues/:id/resolve", requirePerm("inventoryAlerts", "write"), wrap(async (req, res) => {
    const venueFilter = scopeFilter(req);
    const upd = await A.ConsumptionIssue.updateOne({ id: str(req.params.id, 80), resolved: false, ...venueFilter }, { $set: { resolved: true, resolvedBy: req.admin.id, resolvedAt: new Date() } });
    if (!upd.modifiedCount && !upd.nModified) throw bad("Issue not found or already resolved", "NOT_FOUND", 404);
    audit(req, "inventoryAlerts", req.params.id, "resolve", { resolved: true });
    res.json({ ok: true });
  }));

  /* ═════════════ FORECAST ═════════════ */
  async function usageEvents(venueId, since, types = ["consumption"]) {
    const rows = await M.StockLedger.find({ venueId, type: { $in: types }, postedAt: { $gte: since } }).select("itemId postedAt qtyOutMilli qtyInMilli type").limit(50001).lean();
    if (rows.length > 50000) throw bad("Too much history to forecast in one request; shorten the look-back period.", "TOO_MUCH_DATA", 413);
    return rows;
  }
  router.get("/forecast", requirePerm("inventoryAlerts", "read"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const st = await getSettings();
    const lookback = Math.min(Math.max(parseInt(req.query.lookbackDays, 10) || st.forecastLookbackDays, 7), 120);
    const horizon = Math.min(Math.max(parseInt(req.query.horizonDays, 10) || st.forecastHorizonDays, 1), 60);
    const now = Date.now();
    const since = new Date(now - (lookback + 1) * 864e5);
    const [items, ledger, { m: avail }, openPos, suppliers, settings] = await Promise.all([
      M.InventoryItem.find({ status: "active" }).lean(), usageEvents(venueId, since), availableMap(venueId),
      PM.PurchaseOrder.find({ venueId, status: { $in: ["approved", "sent", "partially_received", "pending_approval"] } }).lean(),
      M.Supplier.find({}).lean(), PM.PurchaseSettings.findOne({ key: "purchase" }).lean(),
    ]);
    void settings;
    const byItem = new Map();
    for (const e of ledger) { const a = byItem.get(e.itemId) || []; a.push({ at: e.postedAt, qtyMilli: e.qtyOutMilli }); byItem.set(e.itemId, a); }
    const onOrder = new Map();
    for (const po of openPos) for (const l of po.lines) onOrder.set(l.itemId, (onOrder.get(l.itemId) || 0) + Math.max(0, l.qtyMilli - l.receivedMilli - (l.closedMilli || 0)));
    const supMap = new Map(suppliers.map((s) => [s.id, s]));
    const rows = [];
    for (const it of items) {
      const ev = byItem.get(it.id);
      if (!ev) continue; // no usage in the window: nothing to forecast
      const f = F.forecast({ events: ev, lookbackDays: lookback, horizonDays: horizon, now });
      const have = (avail.get(it.id) || { available: 0 }).available;
      const sup = it.preferredSupplierId ? supMap.get(it.preferredSupplierId) : null;
      const lead = sup && sup.status === "active" ? sup.leadTimeDays : 0;
      const cover = F.coverDays(have, f.avgDailyMilli);
      const need = Math.round(f.avgDailyMilli * (horizon + lead)) + (it.safetyStockMilli || 0);
      const position = have + (onOrder.get(it.id) || 0);
      const suggest = Math.max(0, need - position);
      rows.push({
        itemId: it.id, sku: it.sku, name: it.name, unit: it.baseUnit,
        available: P.fromMilli(have), onOrder: P.fromMilli(onOrder.get(it.id) || 0),
        avgDailyUse: P.fromMilli(f.avgDailyMilli), forecastUse: P.fromMilli(f.forecastMilli), trendPct: f.trendPct,
        coverDays: cover, stockoutDate: cover === null ? null : new Date(now + cover * 864e5), leadTimeDays: lead,
        suggestedOrderQty: P.fromMilli(suggest), method: f.method, confidence: f.confidence, activeDays: f.activeDays,
        risk: cover !== null && cover < lead ? "stockout_before_delivery" : cover !== null && cover < horizon ? "stockout_within_horizon" : "ok",
        supplier: sup ? { id: sup.id, name: sup.name } : null,
      });
    }
    const rank = { stockout_before_delivery: 0, stockout_within_horizon: 1, ok: 2 };
    rows.sort((a, b) => rank[a.risk] - rank[b.risk] || (a.coverDays ?? 1e9) - (b.coverDays ?? 1e9));
    res.json({
      data: rows, lookbackDays: lookback, horizonDays: horizon,
      note: "Forecast = past consumption posted by orders. It does not know about reservations, events, holidays, menu changes or supplier delays. Items with fewer than 10 days of usage have low confidence.",
    });
  }));

  /* ═════════════ CONSUMPTION ═════════════ */
  router.get("/consumption", requirePerm("purchaseReports", "read"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(+to - 30 * 864e5);
    if (isNaN(from) || isNaN(to) || from > to) throw bad("Invalid date range");
    if (+to - +from > 400 * 864e5) throw bad("Date range is limited to 400 days");
    const rows = await M.StockLedger.find({ venueId, postedAt: { $gte: from, $lte: to }, type: { $in: ["consumption", "waste", "adjustment_out", "adjustment_in", "reversal"] } }).limit(50001).lean();
    if (rows.length > 50000) throw bad("Too many ledger entries in this range; choose a shorter range.", "TOO_MUCH_DATA", 413);
    const items = new Map((await M.InventoryItem.find({}).lean()).map((i) => [i.id, i]));
    const acc = new Map();
    for (const r of rows) {
      const a = acc.get(r.itemId) || { orders: 0, waste: 0, adjOut: 0, adjIn: 0, ordersValue: 0, wasteValue: 0 };
      const val = Math.abs(r.valueImpactPaise);
      if (r.type === "consumption") { a.orders += r.qtyOutMilli; a.ordersValue += val; }
      else if (r.type === "waste") { a.waste += r.qtyOutMilli; a.wasteValue += val; }
      else if (r.type === "adjustment_out") a.adjOut += r.qtyOutMilli;
      else if (r.type === "adjustment_in") a.adjIn += r.qtyInMilli;
      acc.set(r.itemId, a);
    }
    const data = [...acc.entries()].map(([id, a]) => {
      const it = items.get(id);
      const used = a.orders + a.waste;
      return {
        itemId: id, name: it ? it.name : id, sku: it ? it.sku : "", unit: it ? it.baseUnit : "",
        usedByOrders: P.fromMilli(a.orders), wasted: P.fromMilli(a.waste), adjustedOut: P.fromMilli(a.adjOut), adjustedIn: P.fromMilli(a.adjIn),
        orderCost: P.fromPaise(a.ordersValue), wasteCost: P.fromPaise(a.wasteValue),
        wastePct: used > 0 ? Math.round((a.waste / used) * 1000) / 10 : 0,
      };
    }).sort((x, y) => y.orderCost - x.orderCost);
    // coverage: which of this branch's ingredients are NOT booked through the ledger?
    const ings = await getModel("ingredients").find({ venueId }).lean();
    const links = await M.IngredientLink.find({ venueId }).lean();
    const linked = new Set(links.map((l) => l.ingredientId));
    const unlinked = ings.filter((i) => !linked.has(i.id)).map((i) => ({ id: i.id, name: i.name }));
    res.json({
      from, to, data,
      totals: { orderCost: data.reduce((s, r) => s + r.orderCost, 0), wasteCost: data.reduce((s, r) => s + r.wasteCost, 0) },
      coverage: { ingredients: ings.length, linked: ings.length - unlinked.length, unlinked: unlinked.slice(0, 200), unlinkedCount: unlinked.length },
      note: "Order consumption is booked from the ingredients attached to each dish on an order. Ingredients not linked to an inventory item are still deducted from the legacy Stocks page but do not appear here.",
    });
  }));

  /* ═════════════ SUPPLIER SCORECARDS ═════════════ */
  const WEIGHTS = { onTimePct: 30, fillRatePct: 25, qualityCompliancePct: 25, invoiceAccuracyPct: 20 };
  const grade = (s) => (s === null ? "unrated" : s >= 90 ? "A" : s >= 80 ? "B" : s >= 65 ? "C" : "D");
  function composite(c) {
    let w = 0, sum = 0;
    for (const [k, wt] of Object.entries(WEIGHTS)) if (c[k] !== null && c[k] !== undefined) { w += wt; sum += c[k] * wt; }
    return w ? Math.round((sum / w) * 10) / 10 : null;
  }
  router.get("/suppliers/performance", requirePerm("supplierScorecards", "read"), wrap(async (req, res) => {
    const suppliers = await M.Supplier.find({ status: { $ne: "blocked" } }).sort({ name: 1 }).lean();
    const ids = suppliers.map((s) => s.id);
    const perf = await supplierPerformance(ids);
    const invs = await FM.SupplierInvoice.find({ supplierId: { $in: ids }, status: { $nin: ["draft", "cancelled"] } }).select("supplierId match status").limit(20001).lean();
    const inv = new Map();
    for (const i of invs) {
      const a = inv.get(i.supplierId) || { total: 0, clean: 0, disputed: 0 };
      a.total++; if (i.match && i.match.status === "matched") a.clean++; if (i.status === "disputed") a.disputed++;
      inv.set(i.supplierId, a);
    }
    const data = suppliers.map((s) => {
      const p = perf.get(s.id), iv = inv.get(s.id);
      const c = {
        onTimePct: p ? p.onTimePct : null, fillRatePct: p ? p.fillRatePct : null, qualityCompliancePct: p ? p.qualityCompliancePct : null,
        invoiceAccuracyPct: iv && iv.total >= 1 ? Math.round((iv.clean / iv.total) * 1000) / 10 : null,
      };
      const enough = !!p && p.receipts >= 3;
      const score = enough ? composite(c) : null;
      return { supplierId: s.id, name: s.name, code: s.code, status: s.status, receipts: p ? p.receipts : 0, invoices: iv ? iv.total : 0, disputedInvoices: iv ? iv.disputed : 0, returns: p ? p.returns : 0, returnValue: p ? p.returnValue : 0, ...c, score, grade: grade(score), ratedOn: enough ? "enough_data" : "fewer_than_3_receipts" };
    });
    data.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
    res.json({ data, weights: WEIGHTS, note: "Score = weighted average of on-time delivery, fill rate, quality compliance and clean invoice matching. Suppliers with fewer than 3 posted receipts are not rated. Figures cover all branches and all time." });
  }));

  /* ═════════════ STOCK AUDITS ═════════════ */
  const outAudit = (a, { reveal = true } = {}) => {
    const showSystem = reveal || !a.blind || a.status !== "counting";
    return {
      id: a.id, auditNo: a.auditNo, venueId: a.venueId, title: a.title, locationId: a.locationId, categoryId: a.categoryId, blind: a.blind, status: a.status,
      createdByName: a.createdByName, createdAt: a.createdAt, approvedByName: a.approvedByName, history: a.history,
      lineCount: a.lines.length, counted: a.lines.filter((l) => l.countedMilli !== null && l.countedMilli !== undefined).length,
      totalVariance: P.fromPaise(a.totalVariancePaise), shrink: P.fromPaise(a.shrinkPaise), surplus: P.fromPaise(a.surplusPaise),
      lines: a.lines.map((l, i) => ({
        index: i, itemId: l.itemId, itemName: l.itemName, sku: l.sku, unit: l.unit, locationId: l.locationId, batchNo: l.batchNo, expiryDate: l.expiryDate,
        system: showSystem ? P.fromMilli(l.systemMilli) : null, counted: l.countedMilli === null || l.countedMilli === undefined ? null : P.fromMilli(l.countedMilli),
        variance: showSystem && l.countedMilli !== null && l.countedMilli !== undefined ? P.fromMilli(l.varianceMilli) : null,
        varianceValue: showSystem ? P.fromPaise(l.varianceValuePaise) : null, reason: l.reason, posted: !!l.postedEntryId,
      })),
    };
  };
  const loadAudit = async (req) => {
    const a = await A.StockAudit.findOne({ id: str(req.params.id, 80), ...scopeFilter(req) }).lean();
    if (!a) throw bad("Audit not found", "NOT_FOUND", 404);
    return a;
  };

  router.get("/audits", requirePerm("stockAudits", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    const s = str(req.query.status, 30); if (s) q.status = s;
    const [rows, total] = await Promise.all([A.StockAudit.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), A.StockAudit.countDocuments(q)]);
    res.json({ data: rows.map((a) => { const o = outAudit(a, { reveal: false }); delete o.lines; return o; }), page, limit, total });
  }));
  router.get("/audits/:id", requirePerm("stockAudits", "read"), wrap(async (req, res) => res.json(outAudit(await loadAudit(req), { reveal: false }))));

  router.post("/audits", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const b = req.body;
    const locationId = str(b.locationId, 80) || null, categoryId = str(b.categoryId, 80) || null;
    if (locationId && !(await M.StorageLocation.findOne({ id: locationId, venueId }).lean())) throw bad("Unknown storage location for this branch", "NO_LOCATION");
    if (await A.StockAudit.exists({ venueId, status: { $in: ["counting", "pending_approval", "approved"] }, locationId, categoryId })) throw bad("An audit for this scope is already open. Finish or cancel it first.", "AUDIT_OPEN", 409);
    const q = { venueId, qtyOnHandMilli: { $ne: 0 } };
    if (locationId) q.locationId = locationId;
    let bal = await M.StockBalance.find(q).lean();
    const items = new Map((await M.InventoryItem.find({}).lean()).map((i) => [i.id, i]));
    if (categoryId) bal = bal.filter((r) => { const it = items.get(r.itemId); return it && (it.categoryId === categoryId || it.subcategoryId === categoryId); });
    if (!bal.length) throw bad("There is no stock in this scope to count.", "NOTHING_TO_COUNT");
    if (bal.length > 2000) throw bad("This scope has more than 2000 stock lines; narrow it by location or category.", "TOO_LARGE");
    bal.sort((x, y) => (items.get(x.itemId)?.name || "").localeCompare(items.get(y.itemId)?.name || "") || x.batchNo.localeCompare(y.batchNo));
    const lines = bal.map((r) => { const it = items.get(r.itemId) || {}; return { itemId: r.itemId, itemName: it.name || r.itemId, sku: it.sku || "", unit: it.baseUnit || "", locationId: r.locationId, batchNo: r.batchNo, expiryDate: r.expiryDate, systemMilli: r.qtyOnHandMilli, countedMilli: null, unitCostMicro: r.unitCostMicro }; });
    const doc = await A.StockAudit.create({
      venueId, auditNo: await M.nextNumber("audit", "AUD"), title: str(b.title, 120), locationId, categoryId, blind: b.blind !== false, lines,
      createdBy: req.admin.id, createdByName: req.admin.name, history: [entry(req, "create", "counting")],
    });
    audit(req, "stockAudits", doc.id, "create", { auditNo: doc.auditNo, lines: lines.length });
    notify("stockAudits", doc);
    res.status(201).json(outAudit(doc.toObject(), { reveal: false }));
  }));

  // body: { counts: [{ index, qty, unit?, reason? }] } — one count per line, re-sending replaces the previous count
  router.put("/audits/:id/counts", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    const a = await loadAudit(req);
    if (a.status !== "counting") throw bad("Counts can only be entered while the audit is in the counting stage", "BAD_STATE", 409);
    const counts = Array.isArray(req.body.counts) ? req.body.counts : null;
    if (!counts || !counts.length) throw bad("counts must be a non-empty list");
    if (counts.length > 2000) throw bad("Too many counts in one request");
    const customs = await customUnits();
    const items = new Map((await M.InventoryItem.find({ id: { $in: [...new Set(a.lines.map((l) => l.itemId))] } }).lean()).map((i) => [i.id, i]));
    const set = {};
    for (const c of counts) {
      const i = Number(c.index);
      if (!Number.isInteger(i) || i < 0 || i >= a.lines.length) throw bad(`Unknown line ${c.index}`);
      const line = a.lines[i], item = items.get(line.itemId);
      if (c.qty === null || c.qty === "") { set[`lines.${i}.countedMilli`] = null; continue; }
      if (!item) throw bad(`Item for line ${i + 1} no longer exists`);
      const qty = U.toBaseMilli(c.qty, str(c.unit, 20) || item.baseUnit, item, customs);
      if (qty < 0) throw bad("Counted quantity cannot be negative");
      set[`lines.${i}.countedMilli`] = qty; set[`lines.${i}.countedBy`] = req.admin.name; set[`lines.${i}.countedAt`] = new Date();
      if (c.reason !== undefined) set[`lines.${i}.reason`] = str(c.reason, 300);
    }
    const upd = await A.StockAudit.updateOne({ id: a.id, status: "counting" }, { $set: set });
    if (!upd.modifiedCount && !upd.nModified && Object.keys(set).length) { /* identical values re-sent */ }
    audit(req, "stockAudits", a.id, "count", { lines: counts.length });
    res.json(outAudit(await loadAudit(req), { reveal: false }));
  }));

  router.post("/audits/:id/submit", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    const a = await loadAudit(req);
    if (a.status !== "counting") throw bad("Only an audit that is being counted can be submitted", "BAD_STATE", 409);
    const missing = a.lines.map((l, i) => (l.countedMilli === null || l.countedMilli === undefined ? i + 1 : null)).filter(Boolean);
    if (missing.length) throw bad(`${missing.length} line(s) are not counted yet (first: line ${missing[0]}). Enter 0 if the item is not on the shelf.`, "UNCOUNTED", 400, { lines: missing.slice(0, 50) });
    // variances are fixed at submission against the snapshot taken when the audit opened
    const lines = a.lines.map((l) => {
      const variance = l.countedMilli - l.systemMilli;
      return { ...l, varianceMilli: variance, varianceValuePaise: P.valuePaise(variance, l.unitCostMicro) };
    });
    const noReason = lines.map((l, i) => (l.varianceMilli !== 0 && !l.reason ? i + 1 : null)).filter(Boolean);
    if (noReason.length) throw bad(`A reason is required for every line with a variance (first: line ${noReason[0]}).`, "REASON_REQUIRED", 400, { lines: noReason.slice(0, 50) });
    const shrink = lines.reduce((s, l) => s + (l.varianceValuePaise < 0 ? -l.varianceValuePaise : 0), 0);
    const surplus = lines.reduce((s, l) => s + (l.varianceValuePaise > 0 ? l.varianceValuePaise : 0), 0);
    await move(A.StockAudit, req, a.id, "counting", "pending_approval", { set: { lines, submittedBy: req.admin.id, shrinkPaise: shrink, surplusPaise: surplus, totalVariancePaise: surplus - shrink }, comment: str(req.body.comment, 300) });
    audit(req, "stockAudits", a.id, "submit", { shrinkPaise: shrink, surplusPaise: surplus });
    const cur = await loadAudit(req); notify("stockAudits", cur);
    res.json(outAudit(cur));
  }));

  const mayApprove = (req) => hasPermission(req.admin, "purchaseApprovals", "write");
  router.post("/audits/:id/approve", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    if (!(await mayApprove(req))) throw bad("You do not have permission to approve stock audits", "FORBIDDEN", 403);
    const a = await loadAudit(req);
    if (a.status !== "pending_approval") throw bad("This audit is not waiting for approval", "BAD_STATE", 409);
    const ps = await PM.PurchaseSettings.findOne({ key: "purchase" }).lean();
    if (a.submittedBy === req.admin.id && !(ps && ps.allowSelfApproval)) throw bad("The person who submitted the counts cannot approve them", "SELF_APPROVAL", 403);
    await move(A.StockAudit, req, a.id, "pending_approval", "approved", { set: { approvedBy: req.admin.id, approvedByName: req.admin.name }, comment: str(req.body.comment, 300) });
    audit(req, "stockAudits", a.id, "approve", { totalVariancePaise: a.totalVariancePaise });
    const cur = await loadAudit(req); notify("stockAudits", cur);
    res.json(outAudit(cur));
  }));
  router.post("/audits/:id/reject", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    if (!(await mayApprove(req))) throw bad("You do not have permission to reject stock audits", "FORBIDDEN", 403);
    const reason = str(req.body.reason, 300);
    if (!reason) throw bad("A reason is required");
    const a = await loadAudit(req);
    await move(A.StockAudit, req, a.id, "pending_approval", "counting", { comment: reason }); // back to counting for a recount
    audit(req, "stockAudits", a.id, "reject", { reason });
    const cur = await loadAudit(req); notify("stockAudits", cur);
    res.json(outAudit(cur, { reveal: false }));
  }));
  router.post("/audits/:id/cancel", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    const a = await loadAudit(req);
    if (!["counting", "pending_approval", "approved"].includes(a.status)) throw bad("This audit can no longer be cancelled", "BAD_STATE", 409);
    if (a.lines.some((l) => l.postedEntryId)) throw bad("Some adjustments are already posted; reverse them from the stock ledger instead", "ALREADY_POSTED", 409);
    await move(A.StockAudit, req, a.id, a.status, "cancelled", { comment: str(req.body.reason, 300) });
    audit(req, "stockAudits", a.id, "cancel", {});
    res.json(outAudit(await loadAudit(req), { reveal: false }));
  }));

  // Posts one adjustment per line with a variance. Resumable: lines already posted are skipped and every
  // posting has a deterministic idempotency key, so a retry after a crash never double-posts.
  router.post("/audits/:id/post", requirePerm("stockAudits", "write"), wrap(async (req, res) => {
    if (!(await mayApprove(req))) throw bad("You do not have permission to post audit adjustments", "FORBIDDEN", 403);
    const out = await withLock(`audit:${req.params.id}`, async () => {
      const a = await loadAudit(req);
      if (a.status !== "approved") throw bad("Only an approved audit can be posted", "BAD_STATE", 409);
      const ctx = { venueId: a.venueId, user: { id: req.admin.id, name: req.admin.name } };
      const items = new Map((await M.InventoryItem.find({ id: { $in: [...new Set(a.lines.map((l) => l.itemId))] } }).lean()).map((i) => [i.id, i]));
      let posted = 0;
      for (let i = 0; i < a.lines.length; i++) {
        const l = a.lines[i];
        if (l.postedEntryId) continue;
        if (l.varianceMilli === 0) { await A.StockAudit.updateOne({ id: a.id }, { $set: { [`lines.${i}.postedEntryId`]: "none" } }); continue; }
        const item = items.get(l.itemId);
        if (!item) throw bad(`Item on line ${i + 1} no longer exists`, "NO_ITEM", 409);
        const reason = `Stock audit ${a.auditNo}: ${l.reason}`;
        let r;
        try {
          r = await svc.postMovement(ctx, {
            item, itemId: l.itemId, locationId: l.locationId, batchNo: l.batchNo, type: l.varianceMilli > 0 ? "adjustment_in" : "adjustment_out",
            qtyMilli: Math.abs(l.varianceMilli), unitCostMicro: l.unitCostMicro, expiryDate: l.expiryDate, reason,
            refType: "stockAudit", refId: a.id, idempotencyKey: `audit:${a.id}:${i}`,
          });
        } catch (e) {
          if (e && e.name === "InventoryError") throw bad(`Line ${i + 1} (${l.itemName}) could not be posted: ${e.message}. Posted so far: ${posted}. Fix the cause and post again — finished lines are not repeated.`, e.code || "POST_FAILED", e.status || 409);
          throw e;
        }
        await A.StockAudit.updateOne({ id: a.id }, { $set: { [`lines.${i}.postedEntryId`]: r.entry.id } });
        posted++;
      }
      await move(A.StockAudit, req, a.id, "approved", "posted", { comment: `${posted} adjustment(s) posted` });
      return { posted };
    });
    audit(req, "stockAudits", req.params.id, "post", out);
    emitChange("inventoryStock", "updated", { venueId: (await loadAudit(req)).venueId });
    res.json({ ...out, audit: outAudit(await loadAudit(req)) });
  }));

  /* ═════════════ WHATSAPP PURCHASE LIST ═════════════ */
  const normPhone = (raw) => {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
    if (d.length === 12 && d.startsWith("91") && /^[6-9]/.test(d.slice(2))) return d;
    return null;
  };
  const mask = (p) => (p ? `${p.slice(0, 4)}••••${p.slice(-3)}` : "");

  async function buildList(req, venueId) {
    const b = req.body;
    const supplierId = str(b.supplierId, 80);
    const poId = str(b.poId, 80);
    let sup, lines = [];
    if (poId) {
      const po = await PM.PurchaseOrder.findOne({ id: poId, venueId }).lean();
      if (!po) throw bad("Purchase order not found", "NOT_FOUND", 404);
      if (!["approved", "sent", "partially_received"].includes(po.status)) throw bad("Only an approved or sent purchase order can be shared", "BAD_STATE", 409);
      sup = await M.Supplier.findOne({ id: po.supplierId }).lean();
      lines = po.lines.map((l) => ({ name: l.itemName, qtyMilli: Math.max(0, l.qtyMilli - l.receivedMilli - (l.closedMilli || 0)), unit: l.unit })).filter((l) => l.qtyMilli > 0);
    } else {
      if (!supplierId) throw bad("supplierId or poId is required");
      sup = await M.Supplier.findOne({ id: supplierId }).lean();
      const raw = Array.isArray(b.lines) ? b.lines : [];
      if (!raw.length) throw bad("Add at least one item");
      if (raw.length > 100) throw bad("A purchase list is limited to 100 items");
      const items = new Map((await M.InventoryItem.find({ id: { $in: raw.map((l) => str(l && l.itemId, 80)) } }).lean()).map((i) => [i.id, i]));
      const customs = await customUnits();
      const seen = new Set();
      for (const l of raw) {
        const it = items.get(str(l && l.itemId, 80));
        if (!it) throw bad("Unknown item in the list", "NO_ITEM", 404);
        if (seen.has(it.id)) throw bad(`${it.name} appears twice`);
        seen.add(it.id);
        const unit = str(l.unit, 20) || it.purchaseUnit || it.baseUnit;
        const qtyMilli = U.toBaseMilli(l.qty, unit, it, customs);
        if (qtyMilli <= 0) throw bad(`Quantity for ${it.name} must be greater than zero`);
        lines.push({ name: it.name, qtyMilli, unit: it.baseUnit, enteredQty: Number(l.qty), enteredUnit: unit });
      }
    }
    if (!sup) throw bad("Supplier not found", "NOT_FOUND", 404);
    if (sup.status !== "active") throw bad(`Supplier ${sup.name} is ${sup.status}`, "SUPPLIER_INACTIVE", 409);
    if (!lines.length) throw bad("Nothing left to order on this purchase order");
    const phone = normPhone(sup.whatsapp || sup.phone);
    const parts = lines.map((l) => `${l.name} ${l.enteredQty !== undefined ? `${l.enteredQty} ${l.enteredUnit}` : `${P.fromMilli(l.qtyMilli)} ${l.unit}`}`);
    let text = parts.join("; ");
    if (text.length > 900) { let n = 0, acc = ""; for (const p of parts) { if ((acc + p).length > 850) break; acc += (acc ? "; " : "") + p; n++; } text = `${acc}; +${parts.length - n} more items`; }
    return { sup, phone, lines, text, poId: poId || "", refType: poId ? "purchaseOrder" : "purchaseList" };
  }

  router.post("/whatsapp/purchase-list/preview", requirePerm("purchaseWhatsapp", "read"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const st = await getSettings();
    const l = await buildList(req, venueId);
    const branch = await getVenueName(venueId);
    res.json({
      supplier: { id: l.sup.id, name: l.sup.name }, phoneMasked: mask(l.phone), phoneValid: !!l.phone, itemCount: l.lines.length,
      variables: [l.sup.name, branch || "", l.text, new Date().toLocaleDateString("en-IN")],
      templateConfigured: !!st.whatsappPurchaseTemplate, apiConfigured: !!process.env.AISENSY_API_KEY,
      templateHelp: "The AiSensy template must be pre-approved by WhatsApp and take 4 variables in this order: {{1}} supplier name, {{2}} branch, {{3}} item list, {{4}} date.",
    });
  }));

  router.post("/whatsapp/purchase-list/send", requirePerm("purchaseWhatsapp", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const st = await getSettings();
    if (!process.env.AISENSY_API_KEY) throw bad("WhatsApp sending is not configured on this server (AISENSY_API_KEY).", "NOT_CONFIGURED", 503);
    if (!st.whatsappPurchaseTemplate) throw bad("Set the approved WhatsApp template name in Automation settings first.", "NOT_CONFIGURED", 503);
    const l = await buildList(req, venueId);
    if (!l.phone) throw bad(`${l.sup.name} has no valid WhatsApp/mobile number on file (10-digit Indian mobile).`, "NO_PHONE");
    const hourAgo = new Date(Date.now() - 36e5);
    const sentRecently = await A.WhatsappLog.countDocuments({ sentBy: req.admin.id, createdAt: { $gte: hourAgo } });
    if (sentRecently >= st.whatsappHourlyLimit) throw bad(`Hourly WhatsApp limit reached (${st.whatsappHourlyLimit}). Try again later.`, "RATE_LIMIT", 429);
    if (!req.body.force) {
      const dup = await A.WhatsappLog.findOne({ venueId, supplierId: l.sup.id, status: "sent", listText: l.text, createdAt: { $gte: new Date(Date.now() - 10 * 6e4) } }).lean();
      if (dup) throw bad("The same list was already sent to this supplier in the last 10 minutes. Send again with force=true if you really mean to.", "DUPLICATE_SEND", 409);
    }
    const branch = (await getVenueName(venueId)) || "";
    const log = await A.WhatsappLog.create({
      venueId, supplierId: l.sup.id, supplierName: l.sup.name, phoneMasked: mask(l.phone), template: st.whatsappPurchaseTemplate,
      refType: l.refType, refId: l.poId, itemCount: l.lines.length, listText: l.text, sentBy: req.admin.id, sentByName: req.admin.name,
    });
    try {
      await sendTemplate({ phone: l.phone, templateName: st.whatsappPurchaseTemplate, variables: [l.sup.name, branch, l.text, new Date().toLocaleDateString("en-IN")] });
      await A.WhatsappLog.updateOne({ id: log.id }, { $set: { status: "sent" } });
    } catch (e) {
      const msg = String(e && e.message || e).slice(0, 300);
      await A.WhatsappLog.updateOne({ id: log.id }, { $set: { status: "failed", error: msg } });
      audit(req, "purchaseWhatsapp", log.id, "send_failed", { supplierId: l.sup.id, error: msg });
      throw bad("WhatsApp could not send the message. It was not delivered; nothing was retried.", "SEND_FAILED", 502, { error: msg });
    }
    audit(req, "purchaseWhatsapp", log.id, "send", { supplierId: l.sup.id, itemCount: l.lines.length, refType: l.refType, refId: l.poId });
    res.status(201).json({ id: log.id, status: "sent", supplier: l.sup.name, phoneMasked: mask(l.phone), note: "Handed to WhatsApp (AiSensy). Delivery and read receipts are not tracked here." });
  }));

  router.get("/whatsapp/log", requirePerm("purchaseWhatsapp", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    const [rows, total] = await Promise.all([A.WhatsappLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), A.WhatsappLog.countDocuments(q)]);
    res.json({ data: rows.map(strip), page, limit, total });
  }));

  return router;
}

module.exports = { buildAutomationRouter };
