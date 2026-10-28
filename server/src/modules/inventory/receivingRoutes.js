/**
 * receivingRoutes.js — receiving, quality inspection, quarantine and supplier returns (Phase 3).
 * Mounted at /receiving.
 *
 *   /grns         goods receipt notes against purchase orders (draft -> posted)
 *   /quarantine   stock currently held in quarantine
 *   /returns      supplier returns (draft -> approval -> dispatched -> credited)
 *   /suppliers/:id/performance
 *
 * Stock only changes through stockService (idempotent keys: grn:<id>:<line>:in|q, ret:<id>:<line>).
 * PO received quantities are recomputed from posted GRNs and dispatched returns, never incremented,
 * so a retried request can never double count.
 */
const express = require("express");
const { asPlainString, safeErrorMessage } = require("../../core/validation");
const M = require("./models");
const PM = require("./purchaseModels");
const RM = require("./receivingModels");
const C = require("./purchaseCalc");
const P = require("./precision");
const U = require("./units");
const svc = require("./stockService");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RECEIVABLE = ["sent", "partially_received"];

/** in-process mutex per key (defense in depth; correctness also rests on idempotency keys) */
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

/** Reliability figures from posted receipts, per supplier. null when there is no history. */
async function supplierPerformance(supplierIds) {
  const out = new Map();
  for (const id of supplierIds) {
    const grns = await RM.Grn.find({ supplierId: id, status: "posted" }).lean();
    if (!grns.length) { out.set(id, null); continue; }
    let ordered = 0, delivered = 0, kept = 0, rejected = 0, quarantined = 0, onTime = 0, timed = 0;
    for (const g of grns) {
      if (g.onTime !== null && g.onTime !== undefined) { timed++; if (g.onTime) onTime++; }
      for (const l of g.lines) {
        delivered += l.deliveredMilli; rejected += l.rejectedMilli; quarantined += l.quarantinedMilli; kept += l.acceptedMilli + l.quarantinedMilli; ordered += l.orderedMilli || 0;
      }
    }
    const rets = await RM.SupplierReturn.find({ supplierId: id, status: { $in: ["dispatched", "credited"] } }).lean();
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
    out.set(id, {
      receipts: grns.length, onTimePct: pct(onTime, timed), fillRatePct: pct(Math.min(kept, ordered), ordered),
      rejectionPct: pct(rejected, delivered), quarantinePct: pct(quarantined, delivered),
      qualityCompliancePct: delivered > 0 ? Math.round((1 - (rejected + quarantined) / delivered) * 1000) / 10 : null,
      returns: rets.length, returnValue: P.fromPaise(rets.reduce((n, r) => n + r.totalPaise, 0)),
    });
  }
  return out;
}

function buildReceivingRouter({ requireAuth, requirePerm, hasPermission, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange }) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((req, _res, next) => { if (!req.body || typeof req.body !== "object") req.body = {}; next(); });

  const bad = (message, code = "BAD_REQUEST", status = 400, details) => Object.assign(new Error(message), { name: "InventoryError", code, status, details });
  const fail = (res, err) => {
    if (err && ["InventoryError", "UnitError", "PrecisionError"].includes(err.name)) return res.status(err.status || 400).json({ error: err.message, code: err.code, details: err.details });
    if (err && err.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err && (err.code === 11000 || /E11000/.test(String(err.message)))) return res.status(409).json({ error: "A record with the same unique value already exists.", code: "DUPLICATE" });
    console.error("[receiving] unhandled:", err && err.stack);
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
  const customUnits = () => M.CustomUnit.find({}).lean();
  const strip = ({ _id, ...rest }) => rest;
  const loadScoped = async (Model, req, id) => {
    const doc = await Model.findOne({ ...scopeFilter(req), id }).lean();
    if (!doc) throw bad("Not found", "NOT_FOUND", 404);
    return doc;
  };
  const getSettings = async () => ({ allowSelfApproval: false, overReceiptPct: 0, ...((await PM.PurchaseSettings.findOne({ key: "purchase" }).lean()) || {}) });
  const ctxFor = (req, venueId) => ({ venueId, user: { id: req.admin.id, name: req.admin.name } });

  async function move(Model, req, id, flow, from, to, { set = {}, entry } = {}) {
    for (const f of from) if (f !== to && !C.canMove(flow, f, to)) throw new Error(`internal: ${f} -> ${to} is not in the flow`);
    const update = { $set: { status: to, ...set } };
    if (entry) update.$push = { history: { ...entry, by: req.admin.id, byName: req.admin.name, at: new Date(), toStatus: to } };
    const doc = await Model.findOneAndUpdate({ ...scopeFilter(req), id, status: { $in: from } }, update, { returnDocument: "after" }).lean();
    if (doc) return doc;
    const cur = await Model.findOne({ ...scopeFilter(req), id }).lean();
    if (!cur) throw bad("Not found", "NOT_FOUND", 404);
    throw bad(`This document is ${cur.status.replace(/_/g, " ")}; it cannot be moved to ${to.replace(/_/g, " ")}.`, "INVALID_STATE", 409, { status: cur.status });
  }

  /* ── presentation ─────────────────────────────────────────────── */
  const outGrnLine = (l) => ({
    ...l, ordered: P.fromMilli(l.orderedMilli), delivered: P.fromMilli(l.deliveredMilli), accepted: P.fromMilli(l.acceptedMilli),
    quarantined: P.fromMilli(l.quarantinedMilli), rejected: P.fromMilli(l.rejectedMilli), unitCost: P.fromMicro(l.unitCostMicro),
    value: P.fromPaise(P.valuePaise(l.acceptedMilli + l.quarantinedMilli, l.unitCostMicro)),
  });
  const outGrn = (g) => ({ ...strip(g), lines: g.lines.map(outGrnLine) });
  const outRet = (r) => ({ ...strip(r), total: P.fromPaise(r.totalPaise), creditAmount: P.fromPaise(r.creditAmountPaise), creditVariance: r.status === "credited" ? P.fromPaise(r.creditAmountPaise - r.totalPaise) : null, lines: r.lines.map((l) => ({ ...l, qty: P.fromMilli(l.qtyMilli), unitCost: P.fromMicro(l.unitCostMicro), value: P.fromPaise(l.valuePaise) })) });

  /* ── PO received quantities (derived) ─────────────────────────── */
  async function recomputePo(poId) {
    return withLock(`po:${poId}`, async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const po = await PM.PurchaseOrder.findOne({ id: poId }).lean();
        if (!po) return null;
        const [grns, rets] = await Promise.all([
          RM.Grn.find({ poId, status: "posted" }).lean(),
          RM.SupplierReturn.find({ poId, status: { $in: ["dispatched", "credited"] } }).lean(),
        ]);
        const got = new Map();
        for (const g of grns) for (const l of g.lines) got.set(l.itemId, (got.get(l.itemId) || 0) + l.acceptedMilli + l.quarantinedMilli);
        for (const r of rets) for (const l of r.lines) if (l.reopenPo) got.set(l.itemId, (got.get(l.itemId) || 0) - l.qtyMilli);
        const set = {};
        po.lines.forEach((l, i) => { set[`lines.${i}.receivedMilli`] = Math.max(0, got.get(l.itemId) || 0); });
        await PM.PurchaseOrder.updateOne({ id: poId }, { $set: set });
        const fresh = await PM.PurchaseOrder.findOne({ id: poId }).lean();
        const next = C.derivePoStatus(fresh.lines, fresh.status);
        if (next !== fresh.status) await PM.PurchaseOrder.updateOne({ id: poId, status: fresh.status }, { $set: { status: next } });
        const check = await PM.PurchaseOrder.findOne({ id: poId }).lean();
        if (check.lines.every((l) => l.receivedMilli === Math.max(0, got.get(l.itemId) || 0))) return check;
      }
      return PM.PurchaseOrder.findOne({ id: poId }).lean();
    });
  }
  const poLineCostMicro = (l) => Number(P.divRound(BigInt(l.taxablePaise) * 10000000n, BigInt(l.qtyMilli)));

  /* ── GRN lines ────────────────────────────────────────────────── */
  async function buildGrnLines(raw, po, venueId, defaultLocationId) {
    if (!Array.isArray(raw) || !raw.length) throw bad("At least one line is required", "NO_LINES");
    if (raw.length > 200) throw bad("Too many lines");
    const customs = await customUnits();
    const items = new Map((await M.InventoryItem.find({ id: { $in: raw.map((l) => str(l.itemId, 80)) } }).lean()).map((i) => [i.id, i]));
    const locs = new Map((await M.StorageLocation.find({ venueId }).lean()).map((l) => [l.id, l]));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const settings = await getSettings();
    const retainedByItem = new Map();
    const lines = raw.map((l, n) => {
      const where = `Line ${n + 1}`;
      const poLine = po.lines.find((x) => x.itemId === str(l.itemId, 80));
      if (!poLine) throw bad(`${where}: that item is not on this purchase order`, "NOT_ON_PO");
      const item = items.get(poLine.itemId);
      if (!item) throw bad(`${where}: unknown item`, "NO_ITEM", 404);
      const unit = str(l.unit, 20).toLowerCase() || item.baseUnit;
      const conv = (v, label, allowZero) => {
        if (v === undefined || v === null || v === "") return null;
        const m = U.toBaseMilli(v, unit, item, customs);
        if (m < 0 || (!allowZero && m <= 0)) throw bad(`${where}: ${label} must be greater than zero`);
        return m;
      };
      const delivered = conv(l.delivered, "delivered quantity", false);
      if (delivered === null) throw bad(`${where}: delivered quantity is required`, "BAD_QTY");
      let accepted = conv(l.accepted, "accepted quantity", true), quarantined = conv(l.quarantined, "quarantined quantity", true), rejected = conv(l.rejected, "rejected quantity", true);
      quarantined = quarantined ?? 0; rejected = rejected ?? 0;
      accepted = accepted ?? delivered - quarantined - rejected;
      if (accepted < 0 || accepted + quarantined + rejected !== delivered) throw bad(`${where}: accepted + quarantined + rejected must equal the delivered quantity`, "QTY_MISMATCH");
      const reason = str(l.reason, 300);
      if ((rejected > 0 || quarantined > 0) && !reason) throw bad(`${where}: give the reason for rejecting or quarantining goods`, "REASON_REQUIRED");
      const retained = accepted + quarantined;
      retainedByItem.set(poLine.itemId, (retainedByItem.get(poLine.itemId) || 0) + retained);
      const locationId = str(l.locationId, 80) || defaultLocationId;
      const batchNo = str(l.batchNo, 60);
      const mfgDate = date(l.mfgDate, "Manufacturing date"), expiryDate = date(l.expiryDate, "Expiry date");
      if (retained > 0) {
        const loc = locs.get(locationId);
        if (!loc || loc.status !== "active") throw bad(`${where}: choose an active storage location of this branch`, "NO_LOCATION");
        if (item.trackBatches && !batchNo) throw bad(`${where}: ${item.name} is batch-tracked; enter the batch number`, "BATCH_REQUIRED");
        if (item.trackExpiry && !expiryDate) throw bad(`${where}: ${item.name} tracks expiry; enter the expiry date`, "EXPIRY_REQUIRED");
        if (accepted > 0 && expiryDate && expiryDate < today) throw bad(`${where}: expired goods cannot be accepted; reject or quarantine them`, "EXPIRED");
      }
      if (mfgDate && expiryDate && mfgDate > expiryDate) throw bad(`${where}: manufacturing date is after the expiry date`);
      const checks = {};
      for (const k of ["packagingOk", "labelOk", "qualityOk"]) if (typeof l.checks?.[k] === "boolean") checks[k] = l.checks[k];
      if (l.checks?.tempC !== undefined && l.checks.tempC !== "") { const t = Number(l.checks.tempC); if (!Number.isFinite(t) || t < -60 || t > 150) throw bad(`${where}: temperature is not realistic`); checks.tempC = t; }
      return {
        itemId: item.id, itemName: item.name, sku: item.sku, unit: item.baseUnit, orderedMilli: poLine.qtyMilli,
        deliveredMilli: delivered, acceptedMilli: accepted, quarantinedMilli: quarantined, rejectedMilli: rejected,
        locationId: retained > 0 ? locationId : locationId || "", batchNo, mfgDate, expiryDate, unitCostMicro: poLineCostMicro(poLine), checks, reason, remarks: str(l.remarks, 300),
      };
    });
    // over-receipt: what this GRN keeps may not exceed the outstanding quantity (plus tolerance)
    for (const [itemId, retained] of retainedByItem) {
      const pl = po.lines.find((x) => x.itemId === itemId);
      const outstanding = Math.max(0, pl.qtyMilli - pl.receivedMilli - (pl.closedMilli || 0));
      const allowed = outstanding + Math.floor((pl.qtyMilli * settings.overReceiptPct) / 100);
      if (retained > allowed) throw bad(`${pl.itemName}: receiving ${P.fromMilli(retained)} ${pl.unit} exceeds the outstanding ${P.fromMilli(outstanding)} ${pl.unit}${settings.overReceiptPct ? ` (+${settings.overReceiptPct}% tolerance)` : ""}. Reject the excess.`, "OVER_RECEIPT", 409);
    }
    return lines;
  }
  const assertReceivable = (po) => {
    if (!RECEIVABLE.includes(po.status)) throw bad(`Purchase order ${po.poNo} is ${po.status.replace(/_/g, " ")}; goods can only be received against a sent order.`, "PO_NOT_RECEIVABLE", 409);
  };
  const grnHeader = (b) => {
    const o = {};
    if (b.receivedDate !== undefined) o.receivedDate = date(b.receivedDate, "Received date") || new Date();
    for (const f of ["deliveryNoteNo", "supplierInvoiceNo", "vehicleNo"]) if (b[f] !== undefined) o[f] = str(b[f], 60);
    if (b.notes !== undefined) o.notes = str(b.notes, 2000);
    return o;
  };

  /* ═════════════ GRN ═════════════ */
  router.get("/grns", requirePerm("purchaseReceiving", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["status", "poId", "supplierId"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const search = str(req.query.search, 60);
    if (search) q.$or = [{ grnNo: { $regex: esc(search), $options: "i" } }, { poNo: { $regex: esc(search), $options: "i" } }, { deliveryNoteNo: { $regex: esc(search), $options: "i" } }];
    const [rows, total] = await Promise.all([RM.Grn.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), RM.Grn.countDocuments(q)]);
    res.json({ data: rows.map(outGrn), page, limit, total });
  }));
  router.get("/grns/:id", requirePerm("purchaseReceiving", "read"), wrap(async (req, res) => res.json(outGrn(await loadScoped(RM.Grn, req, req.params.id)))));

  router.post("/grns", requirePerm("purchaseReceiving", "write"), wrap(async (req, res) => {
    const po = await loadScoped(PM.PurchaseOrder, req, str(req.body.poId, 80));
    assertReceivable(po);
    const lines = await buildGrnLines(req.body.lines, po, po.venueId, str(req.body.locationId, 80));
    const grn = await RM.Grn.create({
      ...grnHeader(req.body), venueId: po.venueId, grnNo: await M.nextNumber("grn", "GRN"), poId: po.id, poNo: po.poNo, supplierId: po.supplierId, supplierName: po.supplierName,
      receivedBy: req.admin.id, receivedByName: req.admin.name, lines,
    });
    audit(req, "purchaseReceiving", grn.id, "create", { grnNo: grn.grnNo, po: po.poNo });
    notify("purchaseReceiving", grn);
    res.status(201).json(outGrn(grn.toObject()));
  }));

  router.patch("/grns/:id", requirePerm("purchaseReceiving", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(RM.Grn, req, req.params.id);
    if (cur.status !== "draft") throw bad("Only a draft receipt can be edited.", "INVALID_STATE", 409);
    const set = grnHeader(req.body);
    if (req.body.lines !== undefined) {
      const po = await loadScoped(PM.PurchaseOrder, req, cur.poId);
      assertReceivable(po);
      set.lines = await buildGrnLines(req.body.lines, po, cur.venueId, str(req.body.locationId, 80));
    }
    if (!Object.keys(set).length) throw bad("Nothing to update");
    const doc = await RM.Grn.findOneAndUpdate({ id: cur.id, status: "draft" }, { $set: set }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("The receipt changed while you were editing; reload it.", "INVALID_STATE", 409);
    audit(req, "purchaseReceiving", doc.id, "update", { grnNo: doc.grnNo });
    res.json(outGrn(doc));
  }));

  router.post("/grns/:id/cancel", requirePerm("purchaseReceiving", "write"), wrap(async (req, res) => {
    const reason = str(req.body.reason, 500);
    if (!reason) throw bad("A reason is required", "REASON_REQUIRED");
    const doc = await move(RM.Grn, req, req.params.id, C.GRN_FLOW, ["draft"], "cancelled", { entry: { action: "cancelled", comment: reason } });
    audit(req, "purchaseReceiving", doc.id, "update", { status: "cancelled", reason });
    res.json(outGrn(doc));
  }));

  // Posting is resumable: every stock entry has a deterministic key, so a retry after a failure replays what
  // was already posted and carries on. A receipt left in "posting" can simply be posted again.
  router.post("/grns/:id/post", requirePerm("purchaseReceiving", "write"), wrap(async (req, res) => {
    const grn0 = await loadScoped(RM.Grn, req, req.params.id);
    const result = await withLock(`grn:${grn0.id}`, async () => {
      const grn = await RM.Grn.findOne({ id: grn0.id }).lean();
      if (grn.status === "posted") return { grn, replayed: true };
      if (!["draft", "posting"].includes(grn.status)) throw bad(`This receipt is ${grn.status}; it cannot be posted.`, "INVALID_STATE", 409);
      const po = await PM.PurchaseOrder.findOne({ id: grn.poId }).lean();
      if (!po) throw bad("The purchase order no longer exists", "NOT_FOUND", 404);
      assertReceivable(po);
      // re-validate against the order as it is now (another receipt may have been posted meanwhile)
      await buildGrnLines(grn.lines.map((l) => ({ itemId: l.itemId, delivered: P.fromMilli(l.deliveredMilli), accepted: P.fromMilli(l.acceptedMilli), quarantined: P.fromMilli(l.quarantinedMilli), rejected: P.fromMilli(l.rejectedMilli), unit: l.unit, locationId: l.locationId, batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate, reason: l.reason, checks: l.checks })), po, grn.venueId, "");
      const started = await RM.Grn.findOneAndUpdate({ id: grn.id, status: { $in: ["draft", "posting"] } }, { $set: { status: "posting" }, $push: { history: { action: "posting", by: req.admin.id, byName: req.admin.name, at: new Date(), comment: "", toStatus: "posting" } } }, { returnDocument: "after" }).lean();
      if (!started) throw bad("This receipt is already being posted.", "INVALID_STATE", 409);
      const ctx = ctxFor(req, grn.venueId);
      const items = new Map((await M.InventoryItem.find({ id: { $in: grn.lines.map((l) => l.itemId) } }).lean()).map((i) => [i.id, i]));
      try {
        for (let i = 0; i < grn.lines.length; i++) {
          const l = grn.lines[i];
          const retained = l.acceptedMilli + l.quarantinedMilli;
          if (retained <= 0) continue;
          const item = items.get(l.itemId);
          await svc.postMovement(ctx, {
            item, itemId: l.itemId, locationId: l.locationId, batchNo: l.batchNo, type: "receipt", qtyMilli: retained, unitCostMicro: l.unitCostMicro,
            mfgDate: l.mfgDate, expiryDate: l.expiryDate, refType: "grn", refId: grn.id, reason: `Goods receipt ${grn.grnNo} (PO ${grn.poNo})`, idempotencyKey: `grn:${grn.id}:${i}:in`,
          });
          if (l.quarantinedMilli > 0) {
            await svc.changeStatus(ctx, {
              item, itemId: l.itemId, locationId: l.locationId, batchNo: l.batchNo, action: "quarantine", qtyMilli: l.quarantinedMilli,
              refType: "grn", refId: grn.id, reason: l.reason || "Held at receiving", idempotencyKey: `grn:${grn.id}:${i}:q`,
            });
          }
        }
      } catch (e) {
        throw Object.assign(e, { message: `${e.message} The receipt is partly posted; fix the cause and press Post again — nothing is posted twice.` });
      }
      const onTime = po.expectedDate ? +new Date(grn.receivedDate) <= +new Date(po.expectedDate) + 864e5 - 1 : null;
      const posted = await RM.Grn.findOneAndUpdate({ id: grn.id, status: "posting" }, { $set: { status: "posted", postedAt: new Date(), onTime }, $push: { history: { action: "posted", by: req.admin.id, byName: req.admin.name, at: new Date(), comment: "", toStatus: "posted" } } }, { returnDocument: "after" }).lean();
      await recomputePo(grn.poId);
      return { grn: posted || (await RM.Grn.findOne({ id: grn.id }).lean()), replayed: false };
    });
    if (!result.replayed) { audit(req, "purchaseReceiving", result.grn.id, "update", { status: "posted", grnNo: result.grn.grnNo }); notify("purchaseReceiving", result.grn); emitChange("purchaseOrders", "updated", { id: result.grn.poId, venueId: result.grn.venueId }); }
    res.status(result.replayed ? 200 : 201).json(outGrn(result.grn));
  }));

  /* ═════════════ QUARANTINE ═════════════ */
  router.get("/quarantine", requirePerm("purchaseReceiving", "read"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const rows = await M.StockBalance.find({ venueId, quarantinedMilli: { $gt: 0 } }).lean();
    const items = new Map((await M.InventoryItem.find({ id: { $in: rows.map((r) => r.itemId) } }).lean()).map((i) => [i.id, i]));
    const locs = new Map((await M.StorageLocation.find({ venueId }).lean()).map((l) => [l.id, l]));
    res.json({
      data: rows.map((r) => ({
        itemId: r.itemId, itemName: items.get(r.itemId)?.name || "", unit: items.get(r.itemId)?.baseUnit || "", locationId: r.locationId, locationName: locs.get(r.locationId)?.name || "",
        batchNo: r.batchNo, expiryDate: r.expiryDate, quarantined: P.fromMilli(r.quarantinedMilli), unitCost: P.fromMicro(r.unitCostMicro), value: P.fromPaise(P.valuePaise(r.quarantinedMilli, r.unitCostMicro)),
      })),
      note: "Release or write off quarantined stock from Stock Overview; return it to the supplier from Supplier Returns.",
    });
  }));

  /* ═════════════ SUPPLIER RETURNS ═════════════ */
  async function buildReturnLines(raw, venueId, po) {
    if (!Array.isArray(raw) || !raw.length) throw bad("At least one line is required", "NO_LINES");
    const customs = await customUnits();
    const items = new Map((await M.InventoryItem.find({ id: { $in: raw.map((l) => str(l.itemId, 80)) } }).lean()).map((i) => [i.id, i]));
    const active = await RM.SupplierReturn.find({ venueId, status: { $in: ["draft", "pending_approval", "approved", "dispatched", "credited"] } }).lean();
    const out = [];
    for (const [n, l] of raw.entries()) {
      const where = `Line ${n + 1}`;
      const item = items.get(str(l.itemId, 80));
      if (!item) throw bad(`${where}: unknown item`, "NO_ITEM", 404);
      const source = str(l.source, 30) || "stock";
      if (!["stock", "quarantine", "rejected_at_gate"].includes(source)) throw bad(`${where}: invalid source`);
      const qtyMilli = U.toBaseMilli(l.qty, str(l.unit, 20).toLowerCase() || item.baseUnit, item, customs);
      if (qtyMilli <= 0) throw bad(`${where}: quantity must be greater than zero`, "BAD_QTY");
      const line = { itemId: item.id, itemName: item.name, unit: item.baseUnit, qtyMilli, source, reason: str(l.reason, 300), reopenPo: false, locationId: "", batchNo: "", grnId: null, unitCostMicro: 0 };
      if (source === "rejected_at_gate") {
        const grn = await RM.Grn.findOne({ id: str(l.grnId, 80), venueId, status: "posted" }).lean();
        if (!grn) throw bad(`${where}: choose a posted receipt for goods rejected at the gate`, "NO_GRN", 404);
        const gl = grn.lines.filter((x) => x.itemId === item.id);
        const rejected = gl.reduce((s, x) => s + x.rejectedMilli, 0);
        const already = active.filter((r) => !["rejected", "cancelled"].includes(r.status)).flatMap((r) => r.lines).filter((x) => x.source === "rejected_at_gate" && x.grnId === grn.id && x.itemId === item.id).reduce((s, x) => s + x.qtyMilli, 0);
        if (qtyMilli > rejected - already) throw bad(`${where}: only ${P.fromMilli(Math.max(0, rejected - already))} ${item.baseUnit} rejected at the gate remains to be returned`, "OVER_RETURN", 409);
        line.grnId = grn.id; line.unitCostMicro = gl[0].unitCostMicro;
        if (po && grn.poId !== po.id) throw bad(`${where}: that receipt belongs to a different order`);
      } else {
        const loc = await M.StorageLocation.findOne({ id: str(l.locationId, 80), venueId }).lean();
        if (!loc) throw bad(`${where}: choose the storage location the goods are in`, "NO_LOCATION");
        const bal = await M.StockBalance.findOne({ venueId, itemId: item.id, locationId: loc.id, batchNo: str(l.batchNo, 60) }).lean();
        if (!bal) throw bad(`${where}: no stock of ${item.name} found at that location and batch`, "NO_STOCK", 404);
        const have = source === "quarantine" ? bal.quarantinedMilli : bal.availableMilli;
        if (qtyMilli > have) throw bad(`${where}: only ${P.fromMilli(have)} ${item.baseUnit} ${source === "quarantine" ? "in quarantine" : "available"} there`, "INSUFFICIENT_STOCK", 409);
        line.locationId = loc.id; line.batchNo = bal.batchNo; line.unitCostMicro = bal.unitCostMicro;
        line.reopenPo = !!(l.reopenPo && po && po.lines.some((x) => x.itemId === item.id));
      }
      line.valuePaise = P.valuePaise(qtyMilli, line.unitCostMicro);
      out.push(line);
    }
    return out;
  }
  const retHeader = (b) => {
    const o = {};
    if (b.reasonCategory !== undefined) {
      if (!["damaged", "expired", "quality", "wrong_item", "short_shelf_life", "excess", "other"].includes(b.reasonCategory)) throw bad("Invalid reason category");
      o.reasonCategory = b.reasonCategory;
    }
    if (b.notes !== undefined) o.notes = str(b.notes, 2000);
    if (b.vehicleNo !== undefined) o.vehicleNo = str(b.vehicleNo, 40);
    return o;
  };

  router.get("/returns", requirePerm("purchaseReturns", "read"), wrap(async (req, res) => {
    const { limit, page, skip } = paging(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["status", "supplierId", "poId"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const search = str(req.query.search, 60); if (search) q.returnNo = { $regex: esc(search), $options: "i" };
    const [rows, total] = await Promise.all([RM.SupplierReturn.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), RM.SupplierReturn.countDocuments(q)]);
    res.json({ data: rows.map(outRet), page, limit, total });
  }));
  router.get("/returns/:id", requirePerm("purchaseReturns", "read"), wrap(async (req, res) => res.json(outRet(await loadScoped(RM.SupplierReturn, req, req.params.id)))));

  router.post("/returns", requirePerm("purchaseReturns", "write"), wrap(async (req, res) => {
    const b = req.body;
    let po = null, venueId;
    if (b.poId) { po = await loadScoped(PM.PurchaseOrder, req, str(b.poId, 80)); venueId = po.venueId; } else venueId = await venueFor(req);
    const supplierId = po ? po.supplierId : str(b.supplierId, 80);
    const supplier = await M.Supplier.findOne({ id: supplierId }).lean();
    if (!supplier) throw bad("Choose the supplier the goods go back to", "NO_SUPPLIER", 404);
    const lines = await buildReturnLines(b.lines, venueId, po);
    const doc = await RM.SupplierReturn.create({
      ...retHeader(b), venueId, returnNo: await M.nextNumber("ret", "SRT"), supplierId: supplier.id, supplierName: supplier.name, poId: po ? po.id : null, poNo: po ? po.poNo : "",
      lines, totalPaise: lines.reduce((n, l) => n + l.valuePaise, 0), createdBy: req.admin.id, createdByName: req.admin.name,
    });
    audit(req, "purchaseReturns", doc.id, "create", { returnNo: doc.returnNo, total: doc.totalPaise });
    notify("purchaseReturns", doc);
    res.status(201).json(outRet(doc.toObject()));
  }));

  router.patch("/returns/:id", requirePerm("purchaseReturns", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(RM.SupplierReturn, req, req.params.id);
    if (!["draft", "rejected"].includes(cur.status)) throw bad("Only a draft or rejected return can be edited.", "INVALID_STATE", 409);
    const set = retHeader(req.body);
    if (req.body.lines !== undefined) {
      const po = cur.poId ? await PM.PurchaseOrder.findOne({ id: cur.poId }).lean() : null;
      set.lines = await buildReturnLines(req.body.lines, cur.venueId, po);
      set.totalPaise = set.lines.reduce((n, l) => n + l.valuePaise, 0);
    }
    if (!Object.keys(set).length) throw bad("Nothing to update");
    const doc = await RM.SupplierReturn.findOneAndUpdate({ id: cur.id, status: { $in: ["draft", "rejected"] } }, { $set: set }, { returnDocument: "after" }).lean();
    if (!doc) throw bad("The return changed while you were editing; reload it.", "INVALID_STATE", 409);
    res.json(outRet(doc));
  }));

  const retMove = (action, from, to, { needReason = false, perm } = {}) => wrap(async (req, res) => {
    const cur = await loadScoped(RM.SupplierReturn, req, req.params.id);
    const comment = str(req.body.reason || req.body.comment, 500);
    if (needReason && !comment) throw bad("A reason is required", "REASON_REQUIRED");
    if (perm === "approve" && cur.createdBy === req.admin.id && !(await getSettings()).allowSelfApproval) throw bad("You cannot approve a return you created. Ask another approver, or enable self-approval in Purchase settings.", "SELF_APPROVAL", 403);
    const doc = await move(RM.SupplierReturn, req, cur.id, C.RETURN_FLOW, from, to, { entry: { action, comment } });
    audit(req, "purchaseReturns", doc.id, "update", { status: to, comment });
    notify("purchaseReturns", doc);
    res.json(outRet(doc));
  });
  router.post("/returns/:id/submit", requirePerm("purchaseReturns", "write"), retMove("submitted", ["draft", "rejected"], "pending_approval"));
  router.post("/returns/:id/approve", requirePerm("purchaseApprovals", "write"), retMove("approved", ["pending_approval"], "approved", { perm: "approve" }));
  router.post("/returns/:id/reject", requirePerm("purchaseApprovals", "write"), retMove("rejected", ["pending_approval"], "rejected", { needReason: true, perm: "approve" }));
  router.post("/returns/:id/cancel", requirePerm("purchaseReturns", "write"), retMove("cancelled", ["draft", "pending_approval", "rejected", "approved"], "cancelled", { needReason: true }));

  // Dispatch takes the goods out of stock. The status flips first (so it cannot be cancelled meanwhile);
  // stock entries use deterministic keys, so a retry after a failure never posts twice.
  router.post("/returns/:id/dispatch", requirePerm("purchaseReturns", "write"), wrap(async (req, res) => {
    const cur = await loadScoped(RM.SupplierReturn, req, req.params.id);
    const doc = await withLock(`ret:${cur.id}`, async () => {
      const fresh = await RM.SupplierReturn.findOne({ id: cur.id }).lean();
      if (fresh.status !== "approved") throw bad(`This return is ${fresh.status.replace(/_/g, " ")}; only an approved return can be dispatched.`, "INVALID_STATE", 409);
      const ctx = ctxFor(req, fresh.venueId);
      const items = new Map((await M.InventoryItem.find({ id: { $in: fresh.lines.map((l) => l.itemId) } }).lean()).map((i) => [i.id, i]));
      const flipped = await move(RM.SupplierReturn, req, fresh.id, C.RETURN_FLOW, ["approved"], "dispatched", { set: { dispatchedAt: new Date(), vehicleNo: str(req.body.vehicleNo, 40) || fresh.vehicleNo }, entry: { action: "dispatched", comment: "" } });
      try {
        for (let i = 0; i < fresh.lines.length; i++) {
          const l = fresh.lines[i];
          if (l.source === "rejected_at_gate") continue; // never entered stock
          await svc.postMovement(ctx, {
            item: items.get(l.itemId), itemId: l.itemId, locationId: l.locationId, batchNo: l.batchNo, type: "supplier_return", qtyMilli: l.qtyMilli,
            fromBucket: l.source === "quarantine" ? "quarantined" : "available", refType: "supplier_return", refId: fresh.id,
            reason: `Return ${fresh.returnNo} to ${fresh.supplierName}${l.reason ? ` — ${l.reason}` : ""}`, idempotencyKey: `ret:${fresh.id}:${i}`,
          });
        }
      } catch (e) {
        await RM.SupplierReturn.updateOne({ id: fresh.id, status: "dispatched" }, { $set: { status: "approved", dispatchedAt: null } });
        throw Object.assign(e, { message: `${e.message} The return was not dispatched; correct the stock and try again.` });
      }
      if (fresh.poId) await recomputePo(fresh.poId);
      return flipped;
    });
    audit(req, "purchaseReturns", doc.id, "update", { status: "dispatched" });
    notify("purchaseReturns", doc);
    if (doc.poId) emitChange("purchaseOrders", "updated", { id: doc.poId, venueId: doc.venueId });
    res.json(outRet(doc));
  }));

  router.post("/returns/:id/credit", requirePerm("purchaseReturns", "write"), wrap(async (req, res) => {
    const creditNoteNo = str(req.body.creditNoteNo, 60);
    if (!creditNoteNo) throw bad("Enter the supplier's credit note number", "REASON_REQUIRED");
    const amount = P.toPaise(req.body.amount, "credit amount");
    if (amount < 0) throw bad("Credit amount cannot be negative");
    const doc = await move(RM.SupplierReturn, req, req.params.id, C.RETURN_FLOW, ["dispatched"], "credited", {
      set: { creditNoteNo, creditAmountPaise: amount, creditDate: date(req.body.creditDate, "Credit date") || new Date() }, entry: { action: "credit_recorded", comment: creditNoteNo },
    });
    audit(req, "purchaseReturns", doc.id, "update", { status: "credited", creditNoteNo, amount });
    notify("purchaseReturns", doc);
    res.json(outRet(doc));
  }));

  /* ═════════════ SUPPLIER PERFORMANCE ═════════════ */
  router.get("/suppliers/:id/performance", requirePerm("purchaseReceiving", "read"), wrap(async (req, res) => {
    if (!(await M.Supplier.exists({ id: str(req.params.id, 80) }))) throw bad("Unknown supplier", "NO_SUPPLIER", 404);
    const p = (await supplierPerformance([req.params.id])).get(req.params.id);
    res.json(p || { receipts: 0, note: "No posted goods receipts yet." });
  }));

  return router;
}

module.exports = { buildReceivingRouter, supplierPerformance };
