/**
 * financeRoutes.js — supplier invoices, three-way match, payments and cost reports (Phase 4). Mounted at /finance.
 *
 *   /invoices   record, match against PO + receipts, approve (override needs a reason), dispute, apply credit notes
 *   /payments   record payments against approved invoices (maker-checker above the limit), reverse
 *   /reports    purchase summary, payables aging, price trend, consumption cost, invoice variance
 *
 * Dishky records payments; it never moves money. Paid amounts are DERIVED from completed payments.
 */
const express = require("express");
const { safeErrorMessage } = require("../../core/validation");
const M = require("./models");
const PM = require("./purchaseModels");
const RM = require("./receivingModels");
const FM = require("./financeModels");
const C = require("./purchaseCalc");
const F = require("./financeCalc");
const P = require("./precision");
const U = require("./units");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LIVE_INV = ["pending_approval", "approved", "disputed"]; // invoices that consume billable quantity
const BILLABLE_PO = ["sent", "partially_received", "received", "closed"];
const PAY_FLOW = { pending_approval: ["completed", "rejected", "cancelled"], completed: ["reversed"], rejected: [], cancelled: [], reversed: [] };
const INV_FLOW = {
  draft: ["pending_approval", "cancelled"], pending_approval: ["approved", "rejected", "disputed", "cancelled"],
  rejected: ["pending_approval", "cancelled"], disputed: ["pending_approval", "cancelled"], approved: ["cancelled"], cancelled: [],
};

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

function buildFinanceRouter({ requireAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange }) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((req, _res, next) => { if (!req.body || typeof req.body !== "object") req.body = {}; next(); });

  const bad = (message, code = "BAD_REQUEST", status = 400, details) => Object.assign(new Error(message), { name: "InventoryError", code, status, details });
  const fail = (res, err) => {
    if (err && ["InventoryError", "UnitError", "PrecisionError"].includes(err.name)) return res.status(err.status || 400).json({ error: err.message, code: err.code, details: err.details });
    if (err && err.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err && (err.code === 11000 || /E11000/.test(String(err.message)))) return res.status(409).json({ error: "A record with the same unique value already exists.", code: "DUPLICATE" });
    console.error("[finance] unhandled:", err && err.stack);
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
  const audit = (req, resource, id, action, after, before) => logAudit(req, { action, resource, targetId: id, after, before });
  const notify = (resource, doc) => emitChange(resource, "updated", { id: doc.id, status: doc.status, venueId: doc.venueId });
  const strip = ({ _id, ...rest }) => rest;
  const loadScoped = async (Model, req, id) => {
    const doc = await Model.findOne({ ...scopeFilter(req), id }).lean();
    if (!doc) throw bad("Not found", "NOT_FOUND", 404);
    return doc;
  };
  const getSettings = async () => ({
    allowSelfApproval: false, matchQtyTolerancePct: 0, matchPriceTolerancePct: 0, invoiceTotalTolerancePaise: 100, paymentApprovalLimitPaise: 0, gstStateCode: "",
    ...((await PM.PurchaseSettings.findOne({ key: "purchase" }).lean()) || {}),
  });
  async function move(Model, req, id, flow, from, to, { set = {}, entry } = {}) {
    for (const f of from) if (!C.canMove(flow, f, to)) throw new Error(`internal: ${f} -> ${to} is not in the flow`);
    const update = { $set: { status: to, ...set } };
    if (entry) update.$push = { history: { ...entry, by: req.admin.id, byName: req.admin.name, at: new Date(), toStatus: to } };
    const doc = await Model.findOneAndUpdate({ ...scopeFilter(req), id, status: { $in: from } }, update, { returnDocument: "after" }).lean();
    if (doc) return doc;
    const cur = await Model.findOne({ ...scopeFilter(req), id }).lean();
    if (!cur) throw bad("Not found", "NOT_FOUND", 404);
    throw bad(`This document is ${cur.status.replace(/_/g, " ")}; it cannot be moved to ${to.replace(/_/g, " ")}.`, "INVALID_STATE", 409, { status: cur.status });
  }
  const makerChecker = (settings, ownerId, req, what) => {
    if (ownerId === req.admin.id && !settings.allowSelfApproval) throw bad(`You cannot approve a ${what} you created. Ask another approver, or enable self-approval in Purchase settings.`, "SELF_APPROVAL", 403);
  };

  /* ── presentation ─────────────────────────────────────────────── */
  const outTotals = (t = {}) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k.replace(/Paise$/, ""), typeof v === "number" && /Paise$/.test(k) ? P.fromPaise(v) : v]));
  const outLine = (l) => ({ ...l, qty: P.fromMilli(l.qtyMilli), unitPrice: P.fromMicro(l.unitPriceMicro), discountPct: l.discountBp / 100, gstRate: l.gstBp / 100, gross: P.fromPaise(l.grossPaise), discount: P.fromPaise(l.discountPaise), taxable: P.fromPaise(l.taxablePaise), tax: P.fromPaise(l.taxPaise), total: P.fromPaise(l.totalPaise) });
  const outMatch = (m) => m && ({
    ...m, lines: m.lines.map((l) => ({
      ...l, billable: P.fromMilli(l.billableMilli || 0), invoiced: P.fromMilli(l.invoicedMilli || 0), qtyVariance: P.fromMilli(l.qtyVarianceMilli || 0),
      poNetPrice: P.fromMicro(l.poNetMicro || 0), invoiceNetPrice: P.fromMicro(l.invoiceNetMicro || 0), priceVariance: P.fromPaise(l.priceVariancePaise || 0),
      poGstRate: (l.poGstBp || 0) / 100, invoiceGstRate: (l.invoiceGstBp || 0) / 100,
    })),
  });
  function outInvoice(d, now = Date.now()) {
    const payable = d.totals.grandTotalPaise - d.creditsAppliedPaise;
    const outstanding = Math.max(0, payable - d.paidPaise);
    const paymentStatus = d.status !== "approved" ? null : payable <= 0 || d.paidPaise >= payable ? "paid" : d.paidPaise > 0 ? "partially_paid" : "unpaid";
    return {
      ...strip(d), lines: d.lines.map(outLine), totals: outTotals(d.totals), match: outMatch(d.match),
      taxSplit: d.taxSplit ? { type: d.taxSplit.type, cgst: P.fromPaise(d.taxSplit.cgstPaise), sgst: P.fromPaise(d.taxSplit.sgstPaise), igst: P.fromPaise(d.taxSplit.igstPaise) } : null,
      statedTotal: d.statedTotalPaise === null || d.statedTotalPaise === undefined ? null : P.fromPaise(d.statedTotalPaise),
      creditsApplied: P.fromPaise(d.creditsAppliedPaise), payable: P.fromPaise(payable), paid: P.fromPaise(d.paidPaise), pending: P.fromPaise(d.pendingPaise),
      outstanding: P.fromPaise(outstanding), payableNow: P.fromPaise(Math.max(0, outstanding - d.pendingPaise)), paymentStatus,
      overdue: d.status === "approved" && outstanding > 0 && !!d.dueDate && +new Date(d.dueDate) < now,
    };
  }
  const outPay = (p) => ({ ...strip(p), amount: P.fromPaise(p.amountPaise), allocations: p.allocations.map((a) => ({ ...a, amount: P.fromPaise(a.amountPaise) })), advance: P.fromPaise(p.amountPaise - p.allocations.reduce((n, a) => n + a.amountPaise, 0)) });

  /* ── derived amounts ──────────────────────────────────────────── */
  async function recomputeInvoice(invoiceId) {
    return withLock(`inv:${invoiceId}`, async () => {
      const [pays, credits] = await Promise.all([
        FM.SupplierPayment.find({ "allocations.invoiceId": invoiceId, status: { $in: ["completed", "pending_approval"] } }).lean(),
        RM.SupplierReturn.find({ appliedInvoiceId: invoiceId, status: "credited" }).lean(),
      ]);
      let paid = 0, pending = 0;
      for (const p of pays) for (const a of p.allocations) if (a.invoiceId === invoiceId) { if (p.status === "completed") paid += a.amountPaise; else pending += a.amountPaise; }
      const creditsAppliedPaise = credits.reduce((n, r) => n + r.creditAmountPaise, 0);
      await FM.SupplierInvoice.updateOne({ id: invoiceId }, { $set: { paidPaise: paid, pendingPaise: pending, creditsAppliedPaise } });
      return { paid, pending, creditsAppliedPaise };
    });
  }
  async function runMatch(inv) {
    const settings = await getSettings();
    const po = inv.poId ? await PM.PurchaseOrder.findOne({ id: inv.poId }).lean() : null;
    const others = new Map();
    if (inv.poId) {
      const list = await FM.SupplierInvoice.find({ poId: inv.poId, status: { $in: LIVE_INV }, id: { $ne: inv.id } }).lean();
      for (const o of list) for (const l of o.lines) others.set(l.itemId, (others.get(l.itemId) || 0) + l.qtyMilli);
    }
    const m = F.threeWayMatch({ invoice: inv, po, othersQty: others, tol: { qtyPct: settings.matchQtyTolerancePct, pricePct: settings.matchPriceTolerancePct, totalPaise: settings.invoiceTotalTolerancePaise } });
    return { ...m, computedAt: new Date() };
  }

  /* ── invoice lines ────────────────────────────────────────────── */
  async function buildLines(raw) {
    if (!Array.isArray(raw) || !raw.length) throw bad("At least one line is required", "NO_LINES");
    if (raw.length > 200) throw bad("Too many lines");
    const customs = await M.CustomUnit.find({}).lean();
    const items = new Map((await M.InventoryItem.find({ id: { $in: raw.map((l) => str(l.itemId, 80)) } }).lean()).map((i) => [i.id, i]));
    const seen = new Set();
    return raw.map((l, n) => {
      const item = items.get(str(l.itemId, 80));
      if (!item) throw bad(`Line ${n + 1}: unknown item`, "NO_ITEM", 404);
      if (seen.has(item.id)) throw bad("An item can appear only once per invoice", "DUPLICATE_ITEM");
      seen.add(item.id);
      const unit = str(l.unit, 20).toLowerCase() || item.baseUnit;
      const qtyMilli = U.toBaseMilli(l.qty, unit, item, customs);
      if (qtyMilli <= 0) throw bad(`Line ${n + 1}: quantity must be greater than zero`, "BAD_QTY");
      if (l.unitPrice === undefined || l.unitPrice === "") throw bad(`Line ${n + 1}: unit price is required`, "BAD_PRICE");
      const unitPriceMicro = C.costPerBaseMicro(item, unit, l.unitPrice, customs);
      const discountBp = C.toBp(l.discountPct || 0, "Discount"), gstBp = C.toBp(l.gstRate ?? item.gstRate ?? 0, "GST rate");
      return { itemId: item.id, itemName: item.name, unit: item.baseUnit, qtyMilli, unitPriceMicro, discountBp, gstBp, ...C.calcLine({ qtyMilli, unitPriceMicro, discountBp, gstBp }) };
    });
  }
  const charges = (b) => {
    const freightPaise = b.freight ? P.toPaise(b.freight, "freight") : 0, otherChargesPaise = b.otherCharges ? P.toPaise(b.otherCharges, "other charges") : 0;
    if (freightPaise < 0 || otherChargesPaise < 0) throw bad("Charges cannot be negative");
    return { freightPaise, otherChargesPaise };
  };
  async function finish(lines, ch, supplier, b) {
    const totals = C.calcTotals(lines, { freightPaise: ch.freightPaise, otherPaise: ch.otherChargesPaise });
    const taxSplit = C.taxSplit(totals.taxPaise, supplier.gstin, (await getSettings()).gstStateCode);
    const statedTotalPaise = b.statedTotal === undefined || b.statedTotal === "" || b.statedTotal === null ? null : P.toPaise(b.statedTotal, "invoice total");
    return { totals, taxSplit, statedTotalPaise };
  }

  /* ═════════════ INVOICES ═════════════ */
  // Quantities received but not yet invoiced, at the order's prices — used to pre-fill an invoice.
  router.get("/orders/:poId/billable", requirePerm("purchaseInvoices", "read"), wrap(async (req, res) => {
    const po = await loadScoped(PM.PurchaseOrder, req, req.params.poId);
    const others = new Map();
    for (const o of await FM.SupplierInvoice.find({ poId: po.id, status: { $in: LIVE_INV } }).lean()) for (const l of o.lines) others.set(l.itemId, (others.get(l.itemId) || 0) + l.qtyMilli);
    res.json({
      poId: po.id, poNo: po.poNo, supplierId: po.supplierId, supplierName: po.supplierName, paymentTerms: po.paymentTerms,
      lines: po.lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, unit: l.unit, ordered: P.fromMilli(l.qtyMilli), received: P.fromMilli(l.receivedMilli), billable: P.fromMilli(Math.max(0, l.receivedMilli - (others.get(l.itemId) || 0))), unitPrice: P.fromMicro(l.unitPriceMicro), discountPct: l.discountBp / 100, gstRate: l.gstBp / 100 })).filter((l) => l.billable > 0),
    });
  }));

  router.get("/invoices", requirePerm("purchaseInvoices", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["status", "supplierId", "poId"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const m = str(req.query.match, 20);
    if (m) q["match.status"] = m;
    if (req.query.overdue === "true") { q.status = "approved"; q.dueDate = { $lt: new Date() }; }
    const search = str(req.query.search, 60);
    if (search) q.$or = [{ docNo: { $regex: esc(search), $options: "i" } }, { invoiceNo: { $regex: esc(search), $options: "i" } }, { supplierName: { $regex: esc(search), $options: "i" } }];
    let [rows, total] = await Promise.all([FM.SupplierInvoice.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), FM.SupplierInvoice.countDocuments(q)]);
    let data = rows.map((r) => outInvoice(r));
    if (req.query.overdue === "true") data = data.filter((r) => r.overdue); // due date passed AND money still owed
    res.json({ data, page, limit, total });
  }));
  router.get("/invoices/:id", requirePerm("purchaseInvoices", "read"), wrap(async (req, res) => {
    const inv = await loadScoped(FM.SupplierInvoice, req, req.params.id);
    const [pays, credits] = await Promise.all([FM.SupplierPayment.find({ "allocations.invoiceId": inv.id }).sort({ createdAt: 1 }).lean(), RM.SupplierReturn.find({ appliedInvoiceId: inv.id }).lean()]);
    res.json({
      ...outInvoice(inv),
      payments: pays.map((p) => ({ id: p.id, payNo: p.payNo, status: p.status, paymentDate: p.paymentDate, method: p.method, reference: p.reference, amount: P.fromPaise(p.allocations.find((a) => a.invoiceId === inv.id).amountPaise) })),
      credits: credits.map((r) => ({ id: r.id, returnNo: r.returnNo, creditNoteNo: r.creditNoteNo, amount: P.fromPaise(r.creditAmountPaise) })),
    });
  }));

  async function invoiceHeader(b, supplier, po) {
    const invoiceDate = date(b.invoiceDate, "Invoice date");
    if (!invoiceDate) throw bad("Invoice date is required");
    if (+invoiceDate > Date.now() + 864e5) throw bad("Invoice date is in the future");
    let dueDate = b.dueDate !== undefined && b.dueDate !== "" ? date(b.dueDate, "Due date") : F.dueDateFrom(invoiceDate, (po && po.paymentTerms) || supplier.paymentTerms);
    if (dueDate && dueDate < invoiceDate) throw bad("Due date is before the invoice date");
    return { invoiceDate, dueDate };
  }

  router.post("/invoices", requirePerm("purchaseInvoices", "write"), wrap(async (req, res) => {
    const b = req.body;
    const invoiceNo = str(b.invoiceNo, 60);
    if (!invoiceNo) throw bad("Enter the supplier's invoice number", "INVOICE_NO_REQUIRED");
    let po = null, venueId;
    if (b.poId) {
      po = await loadScoped(PM.PurchaseOrder, req, str(b.poId, 80));
      if (!BILLABLE_PO.includes(po.status)) throw bad(`Order ${po.poNo} is ${po.status.replace(/_/g, " ")}; it can only be invoiced once sent.`, "PO_NOT_BILLABLE", 409);
      venueId = po.venueId;
    } else venueId = await venueFor(req);
    const supplier = await M.Supplier.findOne({ id: po ? po.supplierId : str(b.supplierId, 80) }).lean();
    if (!supplier) throw bad("Choose the supplier", "NO_SUPPLIER", 404);
    if (po && b.supplierId && b.supplierId !== po.supplierId) throw bad("That order belongs to a different supplier", "SUPPLIER_MISMATCH");
    const key = F.invoiceKey(supplier.id, invoiceNo);
    const dup = await FM.SupplierInvoice.findOne({ invoiceKey: key }).lean();
    if (dup) throw bad(`Invoice ${invoiceNo} from ${supplier.name} is already recorded as ${dup.docNo}.`, "DUPLICATE_INVOICE", 409, { docNo: dup.docNo, id: dup.id });
    const head = await invoiceHeader(b, supplier, po);
    const lines = await buildLines(b.lines);
    const ch = charges(b);
    const fin = await finish(lines, ch, supplier, b);
    const warnings = [];
    const sameAmount = await FM.SupplierInvoice.findOne({ supplierId: supplier.id, invoiceDate: head.invoiceDate, "totals.grandTotalPaise": fin.totals.grandTotalPaise, status: { $ne: "cancelled" } }).lean();
    if (sameAmount) warnings.push(`Same supplier, date and total as ${sameAmount.docNo} (invoice ${sameAmount.invoiceNo}) — check this is not a duplicate.`);
    const doc = await FM.SupplierInvoice.create({
      ...head, ...fin, ...ch, venueId, docNo: await M.nextNumber("sinv", "SINV"), invoiceNo, invoiceKey: key, supplierId: supplier.id, supplierName: supplier.name, supplierGstin: supplier.gstin || "",
      poId: po ? po.id : null, poNo: po ? po.poNo : "", lines, notes: str(b.notes, 2000), createdBy: req.admin.id, createdByName: req.admin.name,
    });
    const match = await runMatch(doc.toObject());
    await FM.SupplierInvoice.updateOne({ id: doc.id }, { $set: { match } });
    audit(req, "purchaseInvoices", doc.id, "create", { docNo: doc.docNo, invoiceNo, total: fin.totals.grandTotalPaise });
    notify("purchaseInvoices", doc);
    res.status(201).json({ ...outInvoice({ ...doc.toObject(), match }), warnings });
  }));

  router.patch("/invoices/:id", requirePerm("purchaseInvoices", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierInvoice, req, req.params.id);
    if (!["draft", "rejected"].includes(cur.status)) throw bad("Only a draft or rejected invoice can be edited.", "INVALID_STATE", 409);
    const b = req.body;
    const supplier = await M.Supplier.findOne({ id: cur.supplierId }).lean();
    const po = cur.poId ? await PM.PurchaseOrder.findOne({ id: cur.poId }).lean() : null;
    const set = {};
    if (b.invoiceNo !== undefined) {
      const no = str(b.invoiceNo, 60);
      if (!no) throw bad("Enter the supplier's invoice number", "INVOICE_NO_REQUIRED");
      const key = F.invoiceKey(cur.supplierId, no);
      if (key !== cur.invoiceKey && (await FM.SupplierInvoice.exists({ invoiceKey: key }))) throw bad(`Invoice ${no} is already recorded.`, "DUPLICATE_INVOICE", 409);
      set.invoiceNo = no; set.invoiceKey = key;
    }
    if (b.invoiceDate !== undefined || b.dueDate !== undefined) Object.assign(set, await invoiceHeader({ invoiceDate: b.invoiceDate ?? cur.invoiceDate, dueDate: b.dueDate }, supplier, po));
    if (b.notes !== undefined) set.notes = str(b.notes, 2000);
    const lines = b.lines !== undefined ? await buildLines(b.lines) : cur.lines;
    if (b.lines !== undefined) set.lines = lines;
    const ch = (b.freight !== undefined || b.otherCharges !== undefined) ? charges({ freight: b.freight ?? P.fromPaise(cur.freightPaise), otherCharges: b.otherCharges ?? P.fromPaise(cur.otherChargesPaise) }) : { freightPaise: cur.freightPaise, otherChargesPaise: cur.otherChargesPaise };
    Object.assign(set, ch, await finish(lines, ch, supplier, { statedTotal: b.statedTotal !== undefined ? b.statedTotal : cur.statedTotalPaise === null ? "" : P.fromPaise(cur.statedTotalPaise) }));
    const doc = await FM.SupplierInvoice.findOneAndUpdate({ id: cur.id, status: { $in: ["draft", "rejected"] } }, { $set: set }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("The invoice changed while you were editing; reload it.", "INVALID_STATE", 409);
    const match = await runMatch(doc);
    await FM.SupplierInvoice.updateOne({ id: doc.id }, { $set: { match } });
    audit(req, "purchaseInvoices", doc.id, "update", { docNo: doc.docNo });
    res.json(outInvoice({ ...doc, match }));
  }));

  router.post("/invoices/:id/submit", requirePerm("purchaseInvoices", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierInvoice, req, req.params.id);
    const match = await runMatch(cur);
    const doc = await move(FM.SupplierInvoice, req, cur.id, INV_FLOW, ["draft", "rejected", "disputed"], "pending_approval", { set: { match }, entry: { action: "submitted", comment: str(req.body.comment, 500) } });
    audit(req, "purchaseInvoices", doc.id, "update", { status: doc.status, match: match.status });
    notify("purchaseInvoices", doc);
    res.json(outInvoice(doc));
  }));

  router.post("/invoices/:id/approve", requirePerm("purchaseApprovals", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierInvoice, req, req.params.id);
    makerChecker(await getSettings(), cur.createdBy, req, "invoice");
    const match = await runMatch(cur); // fresh: receipts and other invoices may have changed since submission
    const overrideReason = str(req.body.overrideReason, 500);
    if (match.status !== "matched" && !overrideReason) throw bad("This invoice does not match the order and receipts. Fix the invoice, or approve it with a written override reason.", "MATCH_VARIANCE", 409, { match: outMatch(match) });
    const doc = await move(FM.SupplierInvoice, req, cur.id, INV_FLOW, ["pending_approval"], "approved", { set: { match, overrideReason: match.status !== "matched" ? overrideReason : "" }, entry: { action: match.status === "matched" ? "approved" : "approved_with_override", comment: overrideReason } });
    audit(req, "purchaseInvoices", doc.id, "update", { status: "approved", match: match.status, overrideReason });
    notify("purchaseInvoices", doc);
    res.json(outInvoice(doc));
  }));
  const invDecide = (action, from, to) => wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierInvoice, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required", "REASON_REQUIRED");
    if (action === "cancelled") {
      if (cur.paidPaise > 0 || cur.pendingPaise > 0) throw bad("Payments exist against this invoice; reverse them first.", "HAS_PAYMENTS", 409);
      if (await RM.SupplierReturn.exists({ appliedInvoiceId: cur.id })) throw bad("Credit notes are applied to this invoice; remove them first.", "HAS_CREDITS", 409);
      if (cur.createdBy !== req.admin.id && !(await hasPermission(req.admin, "purchaseApprovals", "write"))) throw bad("Only the person who recorded this invoice or an approver can cancel it.", "FORBIDDEN", 403);
    } else makerChecker(await getSettings(), cur.createdBy, req, "invoice");
    const doc = await move(FM.SupplierInvoice, req, cur.id, INV_FLOW, from, to, { entry: { action, comment: reason } });
    audit(req, "purchaseInvoices", doc.id, "update", { status: to, reason });
    notify("purchaseInvoices", doc);
    res.json(outInvoice(doc));
  });
  router.post("/invoices/:id/reject", requirePerm("purchaseApprovals", "write"), invDecide("rejected", ["pending_approval"], "rejected"));
  router.post("/invoices/:id/dispute", requirePerm("purchaseApprovals", "write"), invDecide("disputed", ["pending_approval"], "disputed"));
  router.post("/invoices/:id/cancel", requirePerm("purchaseInvoices", "write"), invDecide("cancelled", ["draft", "pending_approval", "rejected", "disputed", "approved"], "cancelled"));

  // Set a supplier credit note (from a returned-and-credited return) against this invoice.
  router.post("/invoices/:id/apply-credit", requirePerm("purchaseInvoices", "write"), wrap(async (req, res) => {
    const inv = await loadScoped(FM.SupplierInvoice, req, req.params.id);
    if (inv.status !== "approved") throw bad("Credit can only be applied to an approved invoice.", "INVALID_STATE", 409);
    const ret = await RM.SupplierReturn.findOne({ id: str(req.body.returnId, 80), venueId: inv.venueId }).lean();
    if (!ret || ret.supplierId !== inv.supplierId) throw bad("Choose a credited return from the same supplier", "NOT_FOUND", 404);
    if (ret.status !== "credited") throw bad("That return has no credit note recorded yet.", "INVALID_STATE", 409);
    if (ret.appliedInvoiceId) throw bad("That credit note is already applied.", "ALREADY_APPLIED", 409);
    await withLock(`inv:${inv.id}`, async () => {
      const fresh = await FM.SupplierInvoice.findOne({ id: inv.id }).lean();
      const payable = fresh.totals.grandTotalPaise - fresh.creditsAppliedPaise;
      if (ret.creditAmountPaise > payable - fresh.paidPaise - fresh.pendingPaise) throw bad("The credit is larger than what is still unpaid on this invoice.", "CREDIT_TOO_LARGE", 409);
      const taken = await RM.SupplierReturn.findOneAndUpdate({ id: ret.id, appliedInvoiceId: null, status: "credited" }, { $set: { appliedInvoiceId: inv.id } }, { returnDocument: "after" }).lean();
      if (!taken) throw bad("That credit note is already applied.", "ALREADY_APPLIED", 409);
    });
    await recomputeInvoice(inv.id);
    audit(req, "purchaseInvoices", inv.id, "update", { appliedCredit: ret.returnNo, amount: ret.creditAmountPaise });
    res.json(outInvoice(await FM.SupplierInvoice.findOne({ id: inv.id }).lean()));
  }));

  /* ═════════════ PAYMENTS ═════════════ */
  // What can still be paid on an invoice, counting every other live payment (completed or pending).
  async function payableNow(inv, excludePaymentId) {
    const pays = await FM.SupplierPayment.find({ "allocations.invoiceId": inv.id, status: { $in: ["completed", "pending_approval"] } }).lean();
    let used = 0;
    for (const p of pays) if (p.id !== excludePaymentId) for (const a of p.allocations) if (a.invoiceId === inv.id) used += a.amountPaise;
    return inv.totals.grandTotalPaise - inv.creditsAppliedPaise - used;
  }
  async function checkAllocations(allocs, supplierId, venueId, excludePaymentId) {
    const out = [];
    const seen = new Set();
    for (const a of allocs) {
      const id = str(a.invoiceId, 80);
      if (seen.has(id)) throw bad("An invoice can appear only once per payment", "DUPLICATE_INVOICE");
      seen.add(id);
      const inv = await FM.SupplierInvoice.findOne({ id, venueId }).lean();
      if (!inv || inv.supplierId !== supplierId) throw bad("Allocated invoice not found for this supplier and branch", "NOT_FOUND", 404);
      if (inv.status !== "approved") throw bad(`Invoice ${inv.docNo} is ${inv.status.replace(/_/g, " ")}; only approved invoices can be paid.`, "INVOICE_NOT_APPROVED", 409);
      const amountPaise = P.toPaise(a.amount, "allocation amount");
      if (amountPaise <= 0) throw bad("Allocation amounts must be greater than zero");
      const room = await payableNow(inv, excludePaymentId);
      if (amountPaise > room) throw bad(`Invoice ${inv.docNo}: only ${P.fromPaise(Math.max(0, room))} is still payable.`, "OVER_PAYMENT", 409, { invoice: inv.docNo, payable: P.fromPaise(Math.max(0, room)) });
      out.push({ invoiceId: inv.id, docNo: inv.docNo, amountPaise });
    }
    return out;
  }

  router.get("/payments", requirePerm("purchasePayments", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["status", "supplierId", "method"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const inv = str(req.query.invoiceId, 80); if (inv) q["allocations.invoiceId"] = inv;
    const search = str(req.query.search, 60);
    if (search) q.$or = [{ payNo: { $regex: esc(search), $options: "i" } }, { reference: { $regex: esc(search), $options: "i" } }, { supplierName: { $regex: esc(search), $options: "i" } }];
    const [rows, total] = await Promise.all([FM.SupplierPayment.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), FM.SupplierPayment.countDocuments(q)]);
    res.json({ data: rows.map(outPay), page, limit, total });
  }));
  router.get("/payments/:id", requirePerm("purchasePayments", "read"), wrap(async (req, res) => res.json(outPay(await loadScoped(FM.SupplierPayment, req, req.params.id)))));

  router.post("/payments", requirePerm("purchasePayments", "write"), wrap(async (req, res) => {
    const b = req.body;
    const idemKey = str(req.get("Idempotency-Key") || b.idempotencyKey, 80) || undefined;
    if (idemKey) {
      const prior = await FM.SupplierPayment.findOne({ idemKey }).lean();
      if (prior) return res.status(200).json({ ...outPay(prior), replayed: true });
    }
    const supplier = await M.Supplier.findOne({ id: str(b.supplierId, 80) }).lean();
    if (!supplier) throw bad("Choose the supplier", "NO_SUPPLIER", 404);
    const venueId = await venueFor(req);
    const method = str(b.method, 20);
    if (!FM.METHODS.includes(method)) throw bad(`Payment method must be one of: ${FM.METHODS.join(", ")}`);
    const reference = str(b.reference, 80);
    if (method !== "cash" && !reference) throw bad("Enter the transaction / cheque reference", "REFERENCE_REQUIRED");
    const amountPaise = P.toPaise(b.amount, "amount");
    if (amountPaise <= 0) throw bad("Amount must be greater than zero");
    const paymentDate = date(b.paymentDate, "Payment date") || new Date();
    const settings = await getSettings();
    const doc = await withLock(`pay:${supplier.id}`, async () => {
      const allocations = await checkAllocations(Array.isArray(b.allocations) ? b.allocations : [], supplier.id, venueId, null);
      const allocated = allocations.reduce((n, a) => n + a.amountPaise, 0);
      if (allocated > amountPaise) throw bad("Allocations add up to more than the payment amount", "OVER_ALLOCATED");
      const auto = settings.paymentApprovalLimitPaise > 0 && amountPaise <= settings.paymentApprovalLimitPaise;
      const refKey = reference ? `${supplier.id}|${method}|${reference.toUpperCase().replace(/\s+/g, "")}` : undefined;
      if (refKey && (await FM.SupplierPayment.exists({ refKey, status: { $ne: "cancelled" } }))) throw bad(`A payment with reference ${reference} is already recorded for this supplier.`, "DUPLICATE_PAYMENT", 409);
      return FM.SupplierPayment.create({
        venueId, payNo: await M.nextNumber("spay", "PAY"), supplierId: supplier.id, supplierName: supplier.name, paymentDate, method, reference, refKey, idemKey, amountPaise, allocations,
        notes: str(b.notes, 1000), status: auto ? "completed" : "pending_approval", createdBy: req.admin.id, createdByName: req.admin.name,
        history: [{ action: auto ? "auto_approved" : "submitted", by: req.admin.id, byName: req.admin.name, at: new Date(), comment: "", toStatus: auto ? "completed" : "pending_approval" }],
      });
    });
    for (const a of doc.allocations) await recomputeInvoice(a.invoiceId);
    const warnings = [];
    if (method === "cash" && amountPaise > 1000000) warnings.push("Cash payments to one supplier above ₹10,000 in a day may not be deductible for income tax (section 40A(3)). Confirm with your accountant.");
    audit(req, "purchasePayments", doc.id, "create", { payNo: doc.payNo, amount: amountPaise, status: doc.status });
    notify("purchasePayments", doc);
    res.status(201).json({ ...outPay(doc.toObject()), warnings });
  }));

  async function afterPayment(doc) { for (const a of doc.allocations) await recomputeInvoice(a.invoiceId); }
  router.post("/payments/:id/approve", requirePerm("purchaseApprovals", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierPayment, req, req.params.id);
    makerChecker(await getSettings(), cur.createdBy, req, "payment");
    const doc = await withLock(`pay:${cur.supplierId}`, async () => {
      await checkAllocations(cur.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: P.fromPaise(a.amountPaise) })), cur.supplierId, cur.venueId, cur.id); // still payable?
      return move(FM.SupplierPayment, req, cur.id, PAY_FLOW, ["pending_approval"], "completed", { entry: { action: "approved", comment: str(req.body.comment, 500) } });
    });
    await afterPayment(doc);
    audit(req, "purchasePayments", doc.id, "update", { status: "completed" });
    notify("purchasePayments", doc);
    res.json(outPay(doc));
  }));
  const payMove = (action, from, to, { perm }) => wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierPayment, req, req.params.id);
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required", "REASON_REQUIRED");
    if (perm === "approve") makerChecker(await getSettings(), cur.createdBy, req, "payment");
    const doc = await move(FM.SupplierPayment, req, cur.id, PAY_FLOW, from, to, { set: to === "reversed" ? { reverseReason: reason } : {}, entry: { action, comment: reason } });
    await afterPayment(doc);
    audit(req, "purchasePayments", doc.id, "update", { status: to, reason });
    notify("purchasePayments", doc);
    res.json(outPay(doc));
  });
  router.post("/payments/:id/reject", requirePerm("purchaseApprovals", "write"), payMove("rejected", ["pending_approval"], "rejected", { perm: "approve" }));
  router.post("/payments/:id/cancel", requirePerm("purchasePayments", "write"), payMove("cancelled", ["pending_approval"], "cancelled", {}));
  router.post("/payments/:id/reverse", requirePerm("purchaseApprovals", "write"), payMove("reversed", ["completed"], "reversed", {}));

  // Allocate the unallocated remainder (advance) of a completed payment to more invoices.
  router.post("/payments/:id/allocate", requirePerm("purchasePayments", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(FM.SupplierPayment, req, req.params.id);
    if (cur.status !== "completed") throw bad("Only a completed payment can be allocated.", "INVALID_STATE", 409);
    const doc = await withLock(`pay:${cur.supplierId}`, async () => {
      const fresh = await FM.SupplierPayment.findOne({ id: cur.id }).lean();
      const extra = await checkAllocations(Array.isArray(req.body.allocations) ? req.body.allocations : [], cur.supplierId, cur.venueId, null);
      const merged = [...fresh.allocations];
      for (const a of extra) { const ex = merged.find((m) => m.invoiceId === a.invoiceId); if (ex) ex.amountPaise += a.amountPaise; else merged.push(a); }
      if (merged.reduce((n, a) => n + a.amountPaise, 0) > fresh.amountPaise) throw bad("Not enough unallocated balance on this payment", "OVER_ALLOCATED", 409);
      return FM.SupplierPayment.findOneAndUpdate({ id: fresh.id, status: "completed" }, { $set: { allocations: merged }, $push: { history: { action: "allocated", by: req.admin.id, byName: req.admin.name, at: new Date(), comment: "", toStatus: "completed" } } }, { returnDocument: "after" }).lean();
    });
    await afterPayment(doc);
    audit(req, "purchasePayments", doc.id, "update", { allocated: req.body.allocations });
    res.json(outPay(doc));
  }));

  /* ═════════════ REPORTS ═════════════ */
  const range = (req) => {
    const to = date(req.query.to, "to") || new Date();
    const from = date(req.query.from, "from") || new Date(+to - 30 * 864e5);
    if (from > to) throw bad("The start date is after the end date");
    const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999);
    return { from, to: toEnd };
  };
  const ym = (d) => new Date(d).toISOString().slice(0, 7);
  const rupees = (p) => P.fromPaise(Math.round(p));
  const csv = (res, name, rows) => {
    if (!rows.length) { res.type("text/csv").send(""); return; }
    const cols = Object.keys(rows[0]);
    const cell = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; // spreadsheet formula injection guard
    res.set("Content-Disposition", `attachment; filename="${name}.csv"`).type("text/csv").send([cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n"));
  };
  const reply = (req, res, name, payload, rows) => (req.query.format === "csv" ? csv(res, name, rows) : res.json(payload));

  router.get("/reports/purchase-summary", requirePerm("purchaseReports", "read"), wrap(async (req, res) => {
    const { from, to } = range(req);
    const basis = req.query.basis === "invoiced" ? "invoiced" : "received";
    const groupBy = ["supplier", "item", "month"].includes(req.query.groupBy) ? req.query.groupBy : "supplier";
    const sc = scopeFilter(req);
    const acc = new Map();
    const bump = (key, label, patch) => { const r = acc.get(key) || { key, label, taxable: 0, tax: 0, total: 0, returns: 0 }; for (const [k, v] of Object.entries(patch)) r[k] += v; acc.set(key, r); };
    if (basis === "invoiced") {
      for (const inv of await FM.SupplierInvoice.find({ ...sc, status: "approved", invoiceDate: { $gte: from, $lte: to } }).limit(20000).lean()) {
        if (groupBy === "item") { for (const l of inv.lines) bump(l.itemId, l.itemName, { taxable: l.taxablePaise, tax: l.taxPaise, total: l.totalPaise }); }
        else { const k = groupBy === "month" ? ym(inv.invoiceDate) : inv.supplierId; bump(k, groupBy === "month" ? k : inv.supplierName, { taxable: inv.totals.taxablePaise, tax: inv.totals.taxPaise, total: inv.totals.grandTotalPaise }); }
      }
    } else {
      for (const g of await RM.Grn.find({ ...sc, status: "posted", receivedDate: { $gte: from, $lte: to } }).limit(20000).lean()) {
        for (const l of g.lines) {
          const v = P.valuePaise(l.acceptedMilli + l.quarantinedMilli, l.unitCostMicro);
          const k = groupBy === "item" ? l.itemId : groupBy === "month" ? ym(g.receivedDate) : g.supplierId;
          bump(k, groupBy === "item" ? l.itemName : groupBy === "month" ? k : g.supplierName, { taxable: v, total: v });
        }
      }
    }
    for (const r of await RM.SupplierReturn.find({ ...sc, status: { $in: ["dispatched", "credited"] }, dispatchedAt: { $gte: from, $lte: to } }).lean()) {
      if (groupBy === "item") for (const l of r.lines) bump(l.itemId, l.itemName, { returns: l.valuePaise });
      else { const k = groupBy === "month" ? ym(r.dispatchedAt) : r.supplierId; bump(k, groupBy === "month" ? k : r.supplierName, { returns: r.totalPaise }); }
    }
    const rows = [...acc.values()].map((r) => ({ key: r.key, name: r.label, taxable: rupees(r.taxable), tax: rupees(r.tax), total: rupees(r.total), returns: rupees(r.returns), net: rupees(r.total - r.returns) })).sort((a, b) => (groupBy === "month" ? a.name.localeCompare(b.name) : b.net - a.net));
    const sum = (k) => Math.round(rows.reduce((n, r) => n + r[k], 0) * 100) / 100;
    reply(req, res, "purchase-summary", { basis, groupBy, from, to, rows, totals: { taxable: sum("taxable"), tax: sum("tax"), total: sum("total"), returns: sum("returns"), net: sum("net") }, note: basis === "received" ? "Value of goods received into stock (after discount, before GST), by receipt date." : "Approved supplier invoices by invoice date." }, rows);
  }));

  router.get("/reports/payables-aging", requirePerm("purchaseReports", "read"), wrap(async (req, res) => {
    const sc = scopeFilter(req);
    const buckets = ["current", "d1_30", "d31_60", "d61_90", "d90_plus", "no_due_date"];
    const acc = new Map();
    const invs = await FM.SupplierInvoice.find({ ...sc, status: "approved" }).limit(20000).lean();
    const detail = [];
    for (const inv of invs) {
      const outstanding = inv.totals.grandTotalPaise - inv.creditsAppliedPaise - inv.paidPaise;
      if (outstanding <= 0) continue;
      const b = F.agingBucket(inv.dueDate);
      const r = acc.get(inv.supplierId) || { supplierId: inv.supplierId, supplier: inv.supplierName, total: 0, ...Object.fromEntries(buckets.map((k) => [k, 0])) };
      r[b] += outstanding; r.total += outstanding; acc.set(inv.supplierId, r);
      detail.push({ docNo: inv.docNo, invoiceNo: inv.invoiceNo, supplier: inv.supplierName, dueDate: inv.dueDate, bucket: b, outstanding: rupees(outstanding) });
    }
    const rows = [...acc.values()].map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? rupees(v) : v]))).sort((a, b) => b.total - a.total);
    const totals = Object.fromEntries([...buckets, "total"].map((k) => [k, Math.round(rows.reduce((n, r) => n + r[k], 0) * 100) / 100]));
    reply(req, res, "payables-aging", { asOf: new Date(), rows, totals, ...(req.query.detail === "true" ? { invoices: detail } : {}), note: "Outstanding = approved invoice total − credit notes applied − completed payments. Pending (unapproved) payments are not deducted." }, rows);
  }));

  router.get("/reports/price-trend", requirePerm("purchaseReports", "read"), wrap(async (req, res) => {
    const itemId = str(req.query.itemId, 80);
    const item = await M.InventoryItem.findOne({ id: itemId }).lean();
    if (!item) throw bad("Choose an item", "NO_ITEM", 404);
    const { from, to } = range({ query: { ...req.query, from: req.query.from || new Date(Date.now() - 365 * 864e5).toISOString() } });
    const acc = new Map();
    for (const g of await RM.Grn.find({ ...scopeFilter(req), status: "posted", receivedDate: { $gte: from, $lte: to } }).sort({ receivedDate: 1 }).limit(20000).lean()) {
      for (const l of g.lines.filter((x) => x.itemId === itemId && x.acceptedMilli + x.quarantinedMilli > 0)) {
        const k = `${g.supplierId}|${ym(g.receivedDate)}`;
        const r = acc.get(k) || { supplierId: g.supplierId, supplier: g.supplierName, month: ym(g.receivedDate), qty: 0, value: 0n };
        const q = l.acceptedMilli + l.quarantinedMilli;
        r.qty += q; r.value += BigInt(q) * BigInt(l.unitCostMicro); acc.set(k, r);
      }
    }
    const series = [...acc.values()].map((r) => ({ supplierId: r.supplierId, supplier: r.supplier, month: r.month, qty: P.fromMilli(r.qty), avgUnitCost: P.fromMicro(Number(P.divRound(r.value, BigInt(r.qty)))) })).sort((a, b) => a.month.localeCompare(b.month));
    const costs = series.map((s) => s.avgUnitCost);
    const changePct = series.length > 1 && series[0].avgUnitCost > 0 ? Math.round(((series[series.length - 1].avgUnitCost - series[0].avgUnitCost) / series[0].avgUnitCost) * 1000) / 10 : null;
    reply(req, res, "price-trend", { item: { id: item.id, name: item.name, unit: item.baseUnit }, from, to, series, min: costs.length ? Math.min(...costs) : null, max: costs.length ? Math.max(...costs) : null, changePct, note: "Average landed-excluding-freight cost per base unit of goods received, by supplier and month." }, series);
  }));

  router.get("/reports/consumption-cost", requirePerm("purchaseReports", "read"), wrap(async (req, res) => {
    const { from, to } = range(req);
    const sc = scopeFilter(req);
    const entries = await M.StockLedger.find({ ...sc, type: { $in: ["consumption", "waste"] }, postedAt: { $gte: from, $lte: to } }).limit(50000).lean();
    const sums = new Map();
    for (const e of entries) { const k = `${e.itemId}|${e.type}`; const r = sums.get(k) || { itemId: e.itemId, type: e.type, qty: 0, value: 0 }; r.qty += e.qtyOutMilli; r.value += Math.abs(e.valueImpactPaise); sums.set(k, r); }
    const agg = [...sums.values()].map((r) => ({ _id: { itemId: r.itemId, type: r.type }, qty: r.qty, value: r.value }));
    const items = new Map((await M.InventoryItem.find({ id: { $in: [...new Set(agg.map((a) => a._id.itemId))] } }).lean()).map((i) => [i.id, i]));
    const map = new Map();
    for (const a of agg) {
      const it = items.get(a._id.itemId);
      const r = map.get(a._id.itemId) || { itemId: a._id.itemId, name: it ? it.name : "", unit: it ? it.baseUnit : "", consumedQty: 0, consumedValue: 0, wasteQty: 0, wasteValue: 0 };
      const k = a._id.type === "consumption" ? "consumed" : "waste";
      r[`${k}Qty`] += a.qty; r[`${k}Value`] += Math.abs(a.value); map.set(a._id.itemId, r);
    }
    const rows = [...map.values()].map((r) => ({ itemId: r.itemId, name: r.name, unit: r.unit, consumedQty: P.fromMilli(r.consumedQty), consumedValue: rupees(r.consumedValue), wasteQty: P.fromMilli(r.wasteQty), wasteValue: rupees(r.wasteValue), wastePct: r.consumedValue + r.wasteValue > 0 ? Math.round((r.wasteValue / (r.consumedValue + r.wasteValue)) * 1000) / 10 : 0 })).sort((a, b) => b.consumedValue - a.consumedValue);
    reply(req, res, "consumption-cost", { from, to, rows, totals: { consumedValue: Math.round(rows.reduce((n, r) => n + r.consumedValue, 0) * 100) / 100, wasteValue: Math.round(rows.reduce((n, r) => n + r.wasteValue, 0) * 100) / 100 }, note: "Cost of stock used by orders and written off as waste, at weighted-average cost when posted." }, rows);
  }));

  router.get("/reports/invoice-variance", requirePerm("purchaseReports", "read"), wrap(async (req, res) => {
    const { from, to } = range(req);
    const rows = [];
    for (const inv of await FM.SupplierInvoice.find({ ...scopeFilter(req), status: { $in: ["pending_approval", "approved", "disputed"] }, invoiceDate: { $gte: from, $lte: to } }).limit(20000).lean()) {
      if (!inv.match) continue;
      for (const l of inv.match.lines) if (l.status !== "ok") rows.push({ docNo: inv.docNo, invoiceNo: inv.invoiceNo, supplier: inv.supplierName, po: inv.poNo, item: (inv.lines.find((x) => x.itemId === l.itemId) || {}).itemName || l.itemId, issue: l.status, priceVariance: rupees(l.priceVariancePaise || 0), qtyVariance: P.fromMilli(l.qtyVarianceMilli || 0), invoiceStatus: inv.status, override: inv.overrideReason });
      if (inv.match.status === "unmatched") rows.push({ docNo: inv.docNo, invoiceNo: inv.invoiceNo, supplier: inv.supplierName, po: "", item: "", issue: "no_purchase_order", priceVariance: 0, qtyVariance: 0, invoiceStatus: inv.status, override: inv.overrideReason });
    }
    reply(req, res, "invoice-variance", { from, to, rows, totalPriceVariance: Math.round(rows.reduce((n, r) => n + r.priceVariance, 0) * 100) / 100 }, rows);
  }));

  return router;
}

module.exports = { buildFinanceRouter };
