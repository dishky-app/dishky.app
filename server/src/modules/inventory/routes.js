/**
 * routes.js — REST API for the purchase & inventory module (Phase 1:
 * inventory foundation). Mounted at /inventory in server.js.
 *
 * Permission modules (see auth/permissions.js):
 *   suppliers       supplier master
 *   inventoryItems  items, categories, units, storage locations
 *   inventoryStock  stock overview + posting (opening, adjust, waste, status)
 *   stockLedger     ledger history; write = may post reversals
 *
 * Branch scope mirrors the generic collection routes: a Super Admin may name a
 * branch with ?venueId=; everyone else is pinned to their own branch. Tenant
 * scope comes from the global Mongoose plugin.
 */
const express = require("express");
const { asPlainString, safeErrorMessage } = require("../../core/validation");
const M = require("./models");
const P = require("./precision");
const U = require("./units");
const svc = require("./stockService");
const bridge = require("./ingredientBridge");
const { encrypt, decrypt } = require("../payments/gatewayCredentials");

const MAX_LIMIT = 200;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildRouter({ requireAuth, requirePerm, scopeFilter, scopeVenueForCreate, venueBelongsToTenant, logAudit, emitChange }) {
  const router = express.Router();
  router.use(requireAuth);

  /* ── helpers ───────────────────────────────────────────────────── */
  const fail = (res, err) => {
    if (err && (err.name === "InventoryError" || err.name === "UnitError" || err.name === "PrecisionError")) {
      return res.status(err.status || 400).json({ error: err.message, code: err.code, details: err.details });
    }
    if (err && err.name === "ValidationError") return res.status(400).json({ error: err.message });
    if (err && (err.code === 11000 || /E11000/.test(String(err.message)))) {
      return res.status(409).json({ error: "A record with the same unique value already exists.", code: "DUPLICATE" });
    }
    if (err && err.code === "LEDGER_IMMUTABLE") return res.status(409).json({ error: err.message, code: err.code });
    console.error("[inventory] unhandled:", err && err.message);
    return res.status(500).json({ error: safeErrorMessage(err) });
  };
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { fail(res, e); } };
  const str = (v, max = 200) => (v === undefined || v === null ? "" : String(asPlainString(v) ?? v).slice(0, max).trim());
  const page = (req) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);
    const pg = Math.max(parseInt(req.query.page, 10) || 1, 1);
    return { limit, page: pg, skip: (pg - 1) * limit };
  };
  const venueFor = async (req) => {
    const venueId = scopeVenueForCreate(req);
    if (!venueId) throw Object.assign(new Error("venueId is required (Super Admin must specify a branch)"), { name: "InventoryError", status: 400, code: "VENUE_REQUIRED" });
    if (!(await venueBelongsToTenant(venueId))) throw Object.assign(new Error("Unknown branch"), { name: "InventoryError", status: 400, code: "BAD_VENUE" });
    return venueId;
  };
  const ctxOf = async (req) => ({ venueId: await venueFor(req), user: { id: req.admin.id, name: req.admin.name } });
  const customUnits = () => M.CustomUnit.find({}).lean();
  const idemKey = (req) => {
    const k = str(req.get("Idempotency-Key") || (req.body && req.body.idempotencyKey), 120);
    return k ? `c:${k}` : undefined;
  };
  const audit = (req, resource, id, after) => logAudit(req, { action: "create", resource, targetId: id, after });

  /* ── presentation ──────────────────────────────────────────────── */
  const outItem = (i) => ({
    ...i,
    minStock: P.fromMilli(i.minStockMilli), reorderPoint: P.fromMilli(i.reorderPointMilli),
    safetyStock: P.fromMilli(i.safetyStockMilli), maxStock: P.fromMilli(i.maxStockMilli),
    reorderQty: P.fromMilli(i.reorderQtyMilli),
  });
  const outSupplier = (s) => {
    const { bank, ...rest } = s;
    return {
      ...rest,
      creditLimit: P.fromPaise(s.creditLimitPaise), minOrderValue: P.fromPaise(s.minOrderValuePaise),
      bank: bank ? { accountName: bank.accountName, bankName: bank.bankName, branch: bank.branch, ifsc: bank.ifsc, accountType: bank.accountType, upi: bank.upi, accountLast4: bank.accountLast4 || "", hasAccountNumber: !!bank.accountNumberEnc } : undefined,
    };
  };
  const outBalance = (b, item, loc, now = Date.now()) => {
    const expired = !!(b.expiryDate && +new Date(b.expiryDate) < now);
    return {
      itemId: b.itemId, venueId: b.venueId, locationId: b.locationId, batchNo: b.batchNo,
      itemName: item && item.name, sku: item && item.sku, unit: item && item.baseUnit,
      locationName: loc && loc.name,
      onHand: P.fromMilli(b.qtyOnHandMilli), reserved: P.fromMilli(b.reservedMilli),
      quarantined: P.fromMilli(b.quarantinedMilli), damaged: P.fromMilli(b.damagedMilli),
      expired: expired ? P.fromMilli(b.qtyOnHandMilli) : 0,
      available: expired ? 0 : P.fromMilli(b.availableMilli),
      unitCost: P.fromMicro(b.unitCostMicro), stockValue: P.fromPaise(P.valuePaise(b.qtyOnHandMilli, b.unitCostMicro)),
      mfgDate: b.mfgDate, expiryDate: b.expiryDate, isExpired: expired,
    };
  };
  const outLedger = (e, item, loc) => ({
    ...e, itemName: item && item.name, sku: item && item.sku, locationName: loc && loc.name,
    qtyIn: P.fromMilli(e.qtyInMilli), qtyOut: P.fromMilli(e.qtyOutMilli), balanceAfter: P.fromMilli(e.balanceAfterMilli),
    unitCost: P.fromMicro(e.unitCostMicro), valueImpact: P.fromPaise(e.valueImpactPaise),
  });

  /* ── config ────────────────────────────────────────────────────── */
  router.get("/config", requirePerm("inventoryStock", "read"), wrap(async (_req, res) => {
    res.json({
      transactions: svc.supportsTransactions(),
      allowNoTransactions: process.env.INVENTORY_ALLOW_NO_TRANSACTIONS === "true",
      systemUnits: U.SYSTEM_UNITS, itemTypes: M.ITEM_TYPES, locationTypes: M.LOCATION_TYPES,
      supplierTypes: M.SUPPLIER_TYPES, ledgerTypes: M.LEDGER_TYPES,
    });
  }));

  /* ── units & categories ────────────────────────────────────────── */
  router.get("/units", requirePerm("inventoryItems", "read"), wrap(async (_req, res) => {
    const custom = await customUnits();
    res.json({ system: Object.entries(U.SYSTEM_UNITS).map(([code, u]) => ({ code, ...u })), custom });
  }));
  router.post("/units", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const code = str(req.body.code, 20).toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,19}$/.test(code)) return res.status(400).json({ error: "Unit code must be letters/digits, starting with a letter" });
    if (U.systemUnit(code)) return res.status(409).json({ error: "That code is a built-in unit" });
    const unit = await M.CustomUnit.create({ code, name: str(req.body.name, 60), dimension: req.body.dimension, factor: Number(req.body.factor) });
    audit(req, "inventoryItems", unit.id, unit.toObject());
    res.status(201).json(unit.toObject());
  }));

  router.get("/categories", requirePerm("inventoryItems", "read"), wrap(async (_req, res) => {
    res.json(await M.InventoryCategory.find({}).sort({ name: 1 }).lean());
  }));
  router.post("/categories", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const parentId = str(req.body.parentId) || null;
    if (parentId && !(await M.InventoryCategory.exists({ id: parentId }))) return res.status(400).json({ error: "Unknown parent category" });
    const c = await M.InventoryCategory.create({ name: str(req.body.name, 120), parentId });
    audit(req, "inventoryItems", c.id, c.toObject());
    res.status(201).json(c.toObject());
  }));
  router.patch("/categories/:id", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const set = {};
    if (req.body.name !== undefined) set.name = str(req.body.name, 120);
    if (["active", "inactive"].includes(req.body.status)) set.status = req.body.status;
    const c = await M.InventoryCategory.findOneAndUpdate({ id: req.params.id }, { $set: set }, { returnDocument: "after" }).lean();
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  }));

  /* ── storage locations (per branch) ────────────────────────────── */
  router.get("/locations", requirePerm("inventoryItems", "read"), wrap(async (req, res) => {
    res.json(await M.StorageLocation.find(scopeFilter(req)).sort({ code: 1 }).lean());
  }));
  router.post("/locations", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const type = M.LOCATION_TYPES.includes(req.body.type) ? req.body.type : "dry_store";
    const loc = await M.StorageLocation.create({ venueId, code: str(req.body.code, 20), name: str(req.body.name, 120), type });
    audit(req, "inventoryItems", loc.id, loc.toObject());
    res.status(201).json(loc.toObject());
  }));
  router.patch("/locations/:id", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const set = {};
    if (req.body.name !== undefined) set.name = str(req.body.name, 120);
    if (M.LOCATION_TYPES.includes(req.body.type)) set.type = req.body.type;
    if (["active", "inactive"].includes(req.body.status)) set.status = req.body.status;
    const loc = await M.StorageLocation.findOneAndUpdate({ ...scopeFilter(req), id: req.params.id }, { $set: set }, { returnDocument: "after" }).lean();
    if (!loc) return res.status(404).json({ error: "Not found" });
    res.json(loc);
  }));

  /* ── suppliers (restaurant-wide) ───────────────────────────────── */
  const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
  function supplierFields(b, existing) {
    const out = {};
    for (const f of ["name", "contactPerson", "phone", "whatsapp", "email", "billingAddress", "deliveryAddress", "city", "state", "pincode", "paymentTerms", "notes"]) {
      if (b[f] !== undefined) out[f] = str(b[f], f === "notes" || f.endsWith("Address") ? 2000 : 200);
    }
    if (b.type !== undefined) out.type = b.type;
    if (b.gstin !== undefined) {
      out.gstin = str(b.gstin, 15).toUpperCase();
      if (out.gstin && !GSTIN.test(out.gstin)) throw Object.assign(new Error("GSTIN is not in a valid format"), { name: "InventoryError", code: "BAD_GSTIN" });
    }
    if (b.pan !== undefined) {
      out.pan = str(b.pan, 10).toUpperCase();
      if (out.pan && !PAN.test(out.pan)) throw Object.assign(new Error("PAN is not in a valid format"), { name: "InventoryError", code: "BAD_PAN" });
    }
    if (b.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email || str(b.email))) throw Object.assign(new Error("Email is not valid"), { name: "InventoryError", code: "BAD_EMAIL" });
    if (Array.isArray(b.categories)) out.categories = b.categories.map((c) => str(c, 60)).filter(Boolean).slice(0, 100);
    if (b.leadTimeDays !== undefined) out.leadTimeDays = Number(b.leadTimeDays);
    if (b.creditLimit !== undefined) out.creditLimitPaise = P.toPaise(b.creditLimit, "credit limit");
    if (b.minOrderValue !== undefined) out.minOrderValuePaise = P.toPaise(b.minOrderValue, "minimum order value");
    if (b.bank && typeof b.bank === "object") {
      for (const f of ["accountName", "bankName", "branch", "upi"]) if (b.bank[f] !== undefined) out[`bank.${f}`] = str(b.bank[f], 100);
      if (b.bank.accountType !== undefined) {
        if (!["", "savings", "current", "cc", "other"].includes(b.bank.accountType)) throw Object.assign(new Error("Invalid account type"), { name: "InventoryError", code: "BAD_BANK" });
        out["bank.accountType"] = b.bank.accountType;
      }
      if (b.bank.ifsc !== undefined) {
        const ifsc = str(b.bank.ifsc, 11).toUpperCase();
        if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw Object.assign(new Error("IFSC must look like SBIN0001234"), { name: "InventoryError", code: "BAD_IFSC" });
        out["bank.ifsc"] = ifsc;
      }
      if (b.bank.accountNumber) {
        const n = str(b.bank.accountNumber, 30).replace(/[\s-]/g, "");
        if (!/^\d{9,18}$/.test(n)) throw Object.assign(new Error("Account number must be 9 to 18 digits"), { name: "InventoryError", code: "BAD_ACCOUNT" });
        try { out["bank.accountNumberEnc"] = encrypt(n); }
        catch (e) { throw Object.assign(new Error("Bank details cannot be saved: encryption key is not configured on the server"), { name: "InventoryError", status: 503, code: "NO_ENC_KEY" }); }
        out["bank.accountLast4"] = n.slice(-4);
      }
    }
    return out;
  }

  router.get("/suppliers", requirePerm("suppliers", "read"), wrap(async (req, res) => {
    const { limit, page: pg, skip } = page(req);
    const q = {};
    const status = str(req.query.status, 20);
    if (status) q.status = status;
    const search = str(req.query.search, 80);
    if (search) q.$or = ["name", "code", "contactPerson", "phone", "gstin"].map((f) => ({ [f]: { $regex: esc(search), $options: "i" } }));
    const [rows, total] = await Promise.all([
      M.Supplier.find(q).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      M.Supplier.countDocuments(q),
    ]);
    res.json({ data: rows.map(outSupplier), page: pg, limit, total });
  }));
  router.get("/suppliers/:id", requirePerm("suppliers", "read"), wrap(async (req, res) => {
    const s = await M.Supplier.findOne({ id: req.params.id }).lean();
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(outSupplier(s));
  }));
  router.post("/suppliers", requirePerm("suppliers", "write"), wrap(async (req, res) => {
    const f = supplierFields(req.body);
    if (!f.name) return res.status(400).json({ error: "Supplier name is required" });
    const code = str(req.body.code, 20).toUpperCase() || (await M.nextNumber("supplier", "SUP"));
    const doc = { ...f, code, createdBy: req.admin.id };
    for (const k of Object.keys(doc)) if (k.startsWith("bank.")) { doc.bank = doc.bank || {}; doc.bank[k.slice(5)] = doc[k]; delete doc[k]; }
    const s = await M.Supplier.create(doc);
    const out = outSupplier(s.toObject());
    audit(req, "suppliers", s.id, out);
    res.status(201).json(out);
  }));
  router.patch("/suppliers/:id", requirePerm("suppliers", "write"), wrap(async (req, res) => {
    const before = await M.Supplier.findOne({ id: req.params.id }).lean();
    if (!before) return res.status(404).json({ error: "Not found" });
    const set = supplierFields(req.body);
    if (!Object.keys(set).length) return res.status(400).json({ error: "Nothing to update" });
    const s = await M.Supplier.findOneAndUpdate({ id: req.params.id }, { $set: set }, { returnDocument: "after", runValidators: true }).lean();
    logAudit(req, { action: "update", resource: "suppliers", targetId: s.id, before: outSupplier(before), after: outSupplier(s) });
    res.json(outSupplier(s));
  }));
  // Full bank details: the only place the account number is decrypted. Audited.
  router.get("/suppliers/:id/bank", requirePerm("suppliers", "write"), wrap(async (req, res) => {
    const s = await M.Supplier.findOne({ id: req.params.id }).lean();
    if (!s) return res.status(404).json({ error: "Not found" });
    let accountNumber = "";
    if (s.bank && s.bank.accountNumberEnc) {
      try { accountNumber = decrypt(s.bank.accountNumberEnc); }
      catch { return res.status(500).json({ error: "Stored account number could not be decrypted (check SETTINGS_ENCRYPTION_KEY)", code: "DECRYPT_FAILED" }); }
    }
    logAudit(req, { action: "update", resource: "suppliers", targetId: s.id, after: { viewedBankDetails: true } });
    res.json({ accountNumber });
  }));
  router.post("/suppliers/:id/status", requirePerm("suppliers", "write"), wrap(async (req, res) => {
    const status = req.body.status;
    if (!M.SUPPLIER_STATUS.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const reason = str(req.body.reason, 300);
    if (status === "blocked" && !reason) return res.status(400).json({ error: "A reason is required to block a supplier" });
    const s = await M.Supplier.findOneAndUpdate({ id: req.params.id }, { $set: { status, statusReason: reason } }, { returnDocument: "after" }).lean();
    if (!s) return res.status(404).json({ error: "Not found" });
    logAudit(req, { action: "update", resource: "suppliers", targetId: s.id, after: { status, reason } });
    res.json(outSupplier(s));
  }));

  /* ── items ─────────────────────────────────────────────────────── */
  async function itemFields(b, existing) {
    const out = {};
    const units = await customUnits();
    for (const f of ["name", "description", "brand", "barcode", "hsn"]) if (b[f] !== undefined) out[f] = str(b[f], f === "description" ? 1000 : 200);
    if (b.itemType !== undefined) {
      if (!M.ITEM_TYPES.includes(b.itemType)) throw Object.assign(new Error("Invalid item type"), { name: "InventoryError" });
      out.itemType = b.itemType;
    }
    for (const f of ["categoryId", "subcategoryId", "preferredSupplierId", "defaultLocationId"]) if (b[f] !== undefined) out[f] = str(b[f], 80) || null;
    if (Array.isArray(b.alternativeSupplierIds)) out.alternativeSupplierIds = b.alternativeSupplierIds.map((x) => str(x, 80)).filter(Boolean);
    if (Array.isArray(b.supplierRefs)) out.supplierRefs = b.supplierRefs.map((r) => ({ supplierId: str(r.supplierId, 80), supplierItemCode: str(r.supplierItemCode, 60) }));
    for (const f of ["trackBatches", "trackExpiry", "requiresInspection", "allowNegativeStock"]) if (b[f] !== undefined) out[f] = !!b[f];
    if (b.gstRate !== undefined) {
      const g = Number(b.gstRate);
      if (!Number.isFinite(g) || g < 0 || g > 100) throw Object.assign(new Error("GST rate must be between 0 and 100"), { name: "InventoryError" });
      out.gstRate = g;
    }
    if (["active", "inactive"].includes(b.status)) out.status = b.status;
    for (const [apiName, field] of [["minStock", "minStockMilli"], ["reorderPoint", "reorderPointMilli"], ["safetyStock", "safetyStockMilli"], ["maxStock", "maxStockMilli"], ["reorderQty", "reorderQtyMilli"]]) {
      if (b[apiName] !== undefined && b[apiName] !== "") {
        const v = P.toMilli(b[apiName], apiName);
        if (v < 0) throw Object.assign(new Error(`${apiName} cannot be negative`), { name: "InventoryError" });
        out[field] = v;
      }
    }
    // unit set: base unit is immutable once any stock history exists
    const baseUnit = b.baseUnit !== undefined ? str(b.baseUnit, 20).toLowerCase() : existing && existing.baseUnit;
    const conversions = b.conversions !== undefined
      ? (Array.isArray(b.conversions) ? b.conversions.map((c) => ({ unit: str(c.unit, 20).toLowerCase(), factor: Number(c.factor) })) : [])
      : (existing && existing.conversions) || [];
    const purchaseUnit = b.purchaseUnit !== undefined ? str(b.purchaseUnit, 20).toLowerCase() : existing && existing.purchaseUnit;
    if (b.baseUnit !== undefined || b.conversions !== undefined || b.purchaseUnit !== undefined || !existing) {
      U.validateItemUnits({ baseUnit, purchaseUnit, conversions }, units);
      out.baseUnit = baseUnit; out.conversions = conversions; out.purchaseUnit = purchaseUnit || "";
    }
    return out;
  }

  router.get("/items/lookup", requirePerm("inventoryItems", "read"), wrap(async (req, res) => {
    const code = str(req.query.barcode || req.query.code, 64);
    if (!code) return res.status(400).json({ error: "barcode is required" });
    // scanning only IDENTIFIES an item; it never posts stock
    const item = await M.InventoryItem.findOne({ $or: [{ barcode: code }, { sku: code.toUpperCase() }] }).lean();
    if (!item) return res.status(404).json({ error: "No item matches that barcode" });
    res.json(outItem(item));
  }));
  router.get("/items", requirePerm("inventoryItems", "read"), wrap(async (req, res) => {
    const { limit, page: pg, skip } = page(req);
    const q = {};
    for (const f of ["status", "itemType", "categoryId", "preferredSupplierId"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const search = str(req.query.search, 80);
    if (search) q.$or = ["name", "sku", "barcode", "brand"].map((f) => ({ [f]: { $regex: esc(search), $options: "i" } }));
    const [rows, total] = await Promise.all([
      M.InventoryItem.find(q).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      M.InventoryItem.countDocuments(q),
    ]);
    res.json({ data: rows.map(outItem), page: pg, limit, total });
  }));
  router.get("/items/:id", requirePerm("inventoryItems", "read"), wrap(async (req, res) => {
    const i = await M.InventoryItem.findOne({ id: req.params.id }).lean();
    if (!i) return res.status(404).json({ error: "Not found" });
    res.json(outItem(i));
  }));
  router.post("/items", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const f = await itemFields(req.body, null);
    if (!f.name) return res.status(400).json({ error: "Item name is required" });
    if (!f.baseUnit) return res.status(400).json({ error: "A base unit is required" });
    if (f.barcode && (await M.InventoryItem.exists({ barcode: f.barcode }))) return res.status(409).json({ error: "Another item already uses that barcode", code: "DUPLICATE_BARCODE" });
    const sku = str(req.body.sku, 40).toUpperCase() || (await M.nextNumber("item", "ITM"));
    const item = await M.InventoryItem.create({ ...f, sku, createdBy: req.admin.id });
    audit(req, "inventoryItems", item.id, item.toObject());
    res.status(201).json(outItem(item.toObject()));
  }));
  router.patch("/items/:id", requirePerm("inventoryItems", "write"), wrap(async (req, res) => {
    const before = await M.InventoryItem.findOne({ id: req.params.id }).lean();
    if (!before) return res.status(404).json({ error: "Not found" });
    const set = await itemFields(req.body, before);
    if (set.baseUnit && set.baseUnit !== before.baseUnit && (await M.StockLedger.exists({ itemId: before.id }))) {
      return res.status(409).json({ error: "The base unit cannot change once the item has stock history.", code: "BASE_UNIT_LOCKED" });
    }
    if (set.barcode && set.barcode !== before.barcode && (await M.InventoryItem.exists({ barcode: set.barcode, id: { $ne: before.id } }))) {
      return res.status(409).json({ error: "Another item already uses that barcode", code: "DUPLICATE_BARCODE" });
    }
    if (!Object.keys(set).length) return res.status(400).json({ error: "Nothing to update" });
    const item = await M.InventoryItem.findOneAndUpdate({ id: before.id }, { $set: set }, { returnDocument: "after", runValidators: true }).lean();
    logAudit(req, { action: "update", resource: "inventoryItems", targetId: item.id, before, after: item });
    res.json(outItem(item));
  }));

  /* ── stock overview ────────────────────────────────────────────── */
  async function hydrate(rows) {
    const items = await M.InventoryItem.find({ id: { $in: [...new Set(rows.map((r) => r.itemId))] } }).lean();
    const locs = await M.StorageLocation.find({ id: { $in: [...new Set(rows.map((r) => r.locationId))] } }).lean();
    return { items: new Map(items.map((i) => [i.id, i])), locs: new Map(locs.map((l) => [l.id, l])) };
  }

  router.get("/stock", requirePerm("inventoryStock", "read"), wrap(async (req, res) => {
    const { limit, page: pg, skip } = page(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["itemId", "locationId", "batchNo"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const now = new Date();
    const view = str(req.query.view, 30) || "all";
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 365);
    if (view === "available") q.availableMilli = { $gt: 0 };
    else if (view === "reserved") q.reservedMilli = { $gt: 0 };
    else if (view === "quarantined") q.quarantinedMilli = { $gt: 0 };
    else if (view === "damaged") q.damagedMilli = { $gt: 0 };
    else if (view === "expired") { q.expiryDate = { $lt: now }; q.qtyOnHandMilli = { $gt: 0 }; }
    else if (view === "near_expiry") { q.expiryDate = { $gte: now, $lte: new Date(+now + days * 864e5) }; q.qtyOnHandMilli = { $gt: 0 }; }
    else if (view !== "all") return res.status(400).json({ error: "Unknown view" });
    else if (req.query.includeEmpty !== "true") q.qtyOnHandMilli = { $ne: 0 };
    const search = str(req.query.search, 80);
    if (search) {
      const matched = await M.InventoryItem.find({ $or: ["name", "sku", "barcode"].map((f) => ({ [f]: { $regex: esc(search), $options: "i" } })) }).select("id").lean();
      q.itemId = { $in: matched.map((m) => m.id) };
    }
    const [rows, total] = await Promise.all([
      M.StockBalance.find(q).sort({ itemId: 1, locationId: 1, batchNo: 1 }).skip(skip).limit(limit).lean(),
      M.StockBalance.countDocuments(q),
    ]);
    const { items, locs } = await hydrate(rows);
    res.json({ data: rows.map((r) => outBalance(r, items.get(r.itemId), locs.get(r.locationId))), page: pg, limit, total });
  }));

  // item-level totals per branch with reorder status
  router.get("/stock/items", requirePerm("inventoryStock", "read"), wrap(async (req, res) => {
    const { limit, page: pg, skip } = page(req);
    const scope = scopeFilter(req);
    const now = new Date();
    const balances = await M.StockBalance.find(scope).lean();
    const agg = new Map();
    for (const b of balances) {
      const k = `${b.venueId}|${b.itemId}`;
      const a = agg.get(k) || { venueId: b.venueId, itemId: b.itemId, onHand: 0, available: 0, reserved: 0, quarantined: 0, damaged: 0, expired: 0, value: 0 };
      const expired = b.expiryDate && +new Date(b.expiryDate) < +now;
      a.onHand += b.qtyOnHandMilli; a.reserved += b.reservedMilli; a.quarantined += b.quarantinedMilli; a.damaged += b.damagedMilli;
      if (expired) a.expired += b.qtyOnHandMilli; else a.available += b.availableMilli;
      a.value += P.valuePaise(b.qtyOnHandMilli, b.unitCostMicro);
      agg.set(k, a);
    }
    const items = await M.InventoryItem.find({ status: "active" }).lean();
    const venueId = scope.venueId;
    const rows = [];
    for (const item of items) {
      const keys = venueId ? [`${venueId}|${item.id}`] : [...agg.keys()].filter((k) => k.endsWith(`|${item.id}`));
      const parts = keys.length ? keys.map((k) => agg.get(k)).filter(Boolean) : [];
      // merge when no branch filter (Super Admin overview)
      const a = parts.reduce((s, p) => ({
        onHand: s.onHand + p.onHand, available: s.available + p.available, reserved: s.reserved + p.reserved,
        quarantined: s.quarantined + p.quarantined, damaged: s.damaged + p.damaged, expired: s.expired + p.expired, value: s.value + p.value,
      }), { onHand: 0, available: 0, reserved: 0, quarantined: 0, damaged: 0, expired: 0, value: 0 });
      const status = a.available <= 0 ? "out_of_stock"
        : (item.reorderPointMilli > 0 && a.available <= item.reorderPointMilli) || (item.minStockMilli > 0 && a.available < item.minStockMilli) ? "low"
        : "ok";
      rows.push({
        itemId: item.id, sku: item.sku, name: item.name, unit: item.baseUnit, venueId: venueId || null,
        onHand: P.fromMilli(a.onHand), available: P.fromMilli(a.available), reserved: P.fromMilli(a.reserved),
        quarantined: P.fromMilli(a.quarantined), damaged: P.fromMilli(a.damaged), expired: P.fromMilli(a.expired),
        stockValue: P.fromPaise(a.value),
        minStock: P.fromMilli(item.minStockMilli), reorderPoint: P.fromMilli(item.reorderPointMilli), reorderStatus: status,
      });
    }
    const view = str(req.query.view, 20);
    let out = view === "low" ? rows.filter((r) => r.reorderStatus === "low") : view === "out_of_stock" ? rows.filter((r) => r.reorderStatus === "out_of_stock") : rows;
    const search = str(req.query.search, 80).toLowerCase();
    if (search) out = out.filter((r) => r.name.toLowerCase().includes(search) || r.sku.toLowerCase().includes(search));
    out.sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      data: out.slice(skip, skip + limit), page: pg, limit, total: out.length,
      totals: {
        stockValue: out.reduce((s, r) => s + r.stockValue, 0),
        lowCount: rows.filter((r) => r.reorderStatus === "low").length,
        outOfStockCount: rows.filter((r) => r.reorderStatus === "out_of_stock").length,
      },
    });
  }));

  /* ── stock postings ────────────────────────────────────────────── */
  async function resolvePosting(req, { needsCost = false } = {}) {
    const ctx = await ctxOf(req);
    const b = req.body || {};
    const item = await M.InventoryItem.findOne({ id: str(b.itemId, 80) }).lean();
    if (!item) throw Object.assign(new Error("Unknown item"), { name: "InventoryError", status: 404, code: "NO_ITEM" });
    const loc = await M.StorageLocation.findOne({ id: str(b.locationId, 80), venueId: ctx.venueId }).lean();
    if (!loc) throw Object.assign(new Error("Unknown storage location for this branch"), { name: "InventoryError", code: "NO_LOCATION" });
    const customs = await customUnits();
    const qtyMilli = U.toBaseMilli(b.qty, str(b.unit, 20) || item.baseUnit, item, customs);
    const batchNo = str(b.batchNo, 60);
    if (item.trackBatches && !batchNo) throw Object.assign(new Error("This item is batch-tracked; a batch number is required."), { name: "InventoryError", code: "BATCH_REQUIRED" });
    const expiryDate = b.expiryDate ? new Date(b.expiryDate) : null;
    const mfgDate = b.mfgDate ? new Date(b.mfgDate) : null;
    if ((expiryDate && isNaN(expiryDate)) || (mfgDate && isNaN(mfgDate))) throw Object.assign(new Error("Invalid date"), { name: "InventoryError" });
    if (mfgDate && expiryDate && mfgDate > expiryDate) throw Object.assign(new Error("Manufacturing date is after the expiry date"), { name: "InventoryError" });
    // cost is entered per the unit the quantity was entered in; store per base unit
    let unitCostMicro = 0;
    if (needsCost && b.unitCost !== undefined && b.unitCost !== "") {
      const perUnitFactor = U.toBaseMilli(1, str(b.unit, 20) || item.baseUnit, item, customs); // milli base units in one entered unit
      const costPerEntered = BigInt(P.toMicro(b.unitCost, "unit cost"));
      unitCostMicro = Number(P.divRound(costPerEntered * 1000n, BigInt(perUnitFactor)));
    }
    return { ctx, item, loc, qtyMilli, batchNo, expiryDate, mfgDate, unitCostMicro, reason: str(b.reason, 500) };
  }

  const done = async (req, res, result, item, loc, resource) => {
    const status = result.replayed ? 200 : 201;
    if (!result.replayed) {
      audit(req, resource, result.entry.id, { txnNo: result.entry.txnNo, type: result.entry.type, itemId: result.entry.itemId, qtyIn: result.entry.qtyInMilli, qtyOut: result.entry.qtyOutMilli });
      emitChange("inventoryStock", "updated", { venueId: result.entry.venueId, itemId: result.entry.itemId }); // persisted first
    }
    res.status(status).json({ replayed: !!result.replayed, entry: outLedger(result.entry, item, loc) });
  };

  router.post("/stock/opening", requirePerm("inventoryStock", "write"), wrap(async (req, res) => {
    const r = await resolvePosting(req, { needsCost: true });
    if (r.item.trackExpiry && !r.expiryDate) return res.status(400).json({ error: "This item tracks expiry; an expiry date is required." });
    // deterministic default key: re-submitting the same opening stock replays instead of doubling it
    const key = idemKey(req) || `opening:${r.ctx.venueId}:${r.item.id}:${r.loc.id}:${r.batchNo}`;
    const result = await svc.postMovement(r.ctx, {
      item: r.item, itemId: r.item.id, locationId: r.loc.id, batchNo: r.batchNo, type: "opening", qtyMilli: r.qtyMilli,
      unitCostMicro: r.unitCostMicro, mfgDate: r.mfgDate, expiryDate: r.expiryDate, reason: r.reason || "Opening stock", idempotencyKey: key,
    });
    await done(req, res, result, r.item, r.loc, "inventoryStock");
  }));

  router.post("/stock/adjust", requirePerm("inventoryStock", "write"), wrap(async (req, res) => {
    const direction = req.body.direction;
    if (!["in", "out"].includes(direction)) return res.status(400).json({ error: "direction must be 'in' or 'out'" });
    const r = await resolvePosting(req, { needsCost: direction === "in" });
    if (!r.reason) return res.status(400).json({ error: "A reason is required for every adjustment" });
    if (direction === "in" && r.item.trackExpiry && !r.expiryDate) return res.status(400).json({ error: "This item tracks expiry; an expiry date is required." });
    const result = await svc.postMovement(r.ctx, {
      item: r.item, itemId: r.item.id, locationId: r.loc.id, batchNo: r.batchNo,
      type: direction === "in" ? "adjustment_in" : "adjustment_out", qtyMilli: r.qtyMilli,
      unitCostMicro: r.unitCostMicro, mfgDate: r.mfgDate, expiryDate: r.expiryDate, reason: r.reason, idempotencyKey: idemKey(req),
    });
    await done(req, res, result, r.item, r.loc, "inventoryStock");
  }));

  const WASTE_REASONS = ["spoilage", "expired", "damaged", "spillage", "preparation_loss", "theft", "other"];
  router.post("/stock/waste", requirePerm("inventoryStock", "write"), wrap(async (req, res) => {
    const wasteReason = str(req.body.wasteReason, 30);
    if (!WASTE_REASONS.includes(wasteReason)) return res.status(400).json({ error: `wasteReason must be one of: ${WASTE_REASONS.join(", ")}` });
    const r = await resolvePosting(req);
    const fromBucket = ["available", "quarantined", "damaged"].includes(req.body.fromBucket) ? req.body.fromBucket : "available";
    const result = await svc.postMovement(r.ctx, {
      item: r.item, itemId: r.item.id, locationId: r.loc.id, batchNo: r.batchNo, type: "waste", qtyMilli: r.qtyMilli, fromBucket,
      reason: `${wasteReason}${r.reason ? `: ${r.reason}` : ""}`, meta: { wasteReason }, idempotencyKey: idemKey(req),
    });
    await done(req, res, result, r.item, r.loc, "inventoryStock");
  }));

  router.post("/stock/status", requirePerm("inventoryStock", "write"), wrap(async (req, res) => {
    const r = await resolvePosting(req);
    if (!r.reason) return res.status(400).json({ error: "A reason is required" });
    const result = await svc.changeStatus(r.ctx, {
      item: r.item, itemId: r.item.id, locationId: r.loc.id, batchNo: r.batchNo, action: str(req.body.action, 30),
      qtyMilli: r.qtyMilli, reason: r.reason, idempotencyKey: idemKey(req),
    });
    await done(req, res, result, r.item, r.loc, "inventoryStock");
  }));

  // Link this branch's Ingredients to inventory items and bring their stock under the ledger.
  // Safe to re-run: already-linked ingredients are skipped and opening stock cannot post twice.
  router.post("/import-ingredients", requirePerm("inventoryItems", "write"), requirePerm("inventoryStock", "write"), wrap(async (req, res) => {
    const venueId = await venueFor(req);
    const summary = await bridge.importIngredients({ venueId, user: { id: req.admin.id, name: req.admin.name } });
    audit(req, "inventoryItems", `import:${venueId}`, summary);
    emitChange("inventoryStock", "updated", { venueId });
    res.json(summary);
  }));

  /* ── ledger ────────────────────────────────────────────────────── */
  router.get("/ledger", requirePerm("stockLedger", "read"), wrap(async (req, res) => {
    const { limit, page: pg, skip } = page(req);
    const q = { ...scopeFilter(req) };
    for (const f of ["itemId", "locationId", "batchNo", "type", "refType", "refId"]) { const v = str(req.query[f], 80); if (v) q[f] = v; }
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if ((from && isNaN(from)) || (to && isNaN(to))) return res.status(400).json({ error: "Invalid date filter" });
    if (from || to) q.postedAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const [rows, total] = await Promise.all([
      M.StockLedger.find(q).sort({ postedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      M.StockLedger.countDocuments(q),
    ]);
    const { items, locs } = await hydrate(rows);
    res.json({ data: rows.map((e) => outLedger(e, items.get(e.itemId), locs.get(e.locationId))), page: pg, limit, total });
  }));

  router.post("/ledger/:id/reverse", requirePerm("stockLedger", "write"), wrap(async (req, res) => {
    const reason = str(req.body.reason, 500);
    if (!reason) return res.status(400).json({ error: "A reason is required to reverse an entry" });
    const entry = await M.StockLedger.findOne({ ...scopeFilter(req), id: req.params.id }).lean();
    if (!entry) return res.status(404).json({ error: "Not found" });
    const item = await M.InventoryItem.findOne({ id: entry.itemId }).lean();
    const loc = await M.StorageLocation.findOne({ id: entry.locationId }).lean();
    const result = await svc.reverseEntry({ venueId: entry.venueId, user: { id: req.admin.id, name: req.admin.name } }, entry, item, reason);
    await done(req, res, result, item, loc, "stockLedger");
  }));

  return router;
}

module.exports = { buildRouter };
