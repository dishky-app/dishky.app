/**
 * models.js — Mongoose models for the purchase & inventory module.
 *
 * Tenant isolation is NOT written here: the global plugin in core/tenancy.js
 * stamps/filters `restaurantId` on every model below and turns every `unique`
 * into a per-restaurant unique index. Branch isolation uses `venueId`, the same
 * field every other Dishky collection uses ("venue" = branch).
 *
 * Numbers: see precision.js. Quantities are integer milli base-units
 * (`...Milli`), unit costs are integer micro-rupees per base unit (`...Micro`),
 * money is integer paise (`...Paise`).
 *
 * Consistency model (one source of truth, no duplicated totals):
 *   - StockLedger is the append-only history of every movement.
 *   - StockBalance is the current state per (venue, item, location, batch). It
 *     is only ever changed by stockService.postMovement(), in the same
 *     transaction that inserts the ledger entry. Item-level totals are always
 *     aggregated from balances, never stored.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");

const { Schema } = mongoose;
const opts = { timestamps: true, versionKey: false };

const newId = (prefix) => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

/* ── Counters (document numbers) ─────────────────────────────────── */
const counterSchema = new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }, { versionKey: false });
const Counter = mongoose.model("InvCounter", counterSchema, "invCounters");

async function nextNumber(kind, prefix, width = 5) {
  const doc = await Counter.findOneAndUpdate(
    { key: kind },
    { $inc: { seq: 1 }, $setOnInsert: { key: kind } },
    { upsert: true, returnDocument: "after" }
  ).lean();
  return `${prefix}-${String(doc.seq).padStart(width, "0")}`;
}

/* ── Supplier ────────────────────────────────────────────────────── */
const SUPPLIER_STATUS = ["active", "inactive", "blocked"];
const SUPPLIER_TYPES = ["manufacturer", "wholesaler", "distributor", "retailer", "farmer", "service", "other"];
const supplierSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("sup") },
    code: { type: String, unique: true, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: SUPPLIER_TYPES, default: "wholesaler" },
    contactPerson: { type: String, default: "", trim: true, maxlength: 120 },
    phone: { type: String, default: "", trim: true, maxlength: 20 },
    whatsapp: { type: String, default: "", trim: true, maxlength: 20 },
    email: { type: String, default: "", trim: true, lowercase: true, maxlength: 200 },
    billingAddress: { type: String, default: "", maxlength: 500 },
    deliveryAddress: { type: String, default: "", maxlength: 500 },
    city: { type: String, default: "", maxlength: 100 },
    state: { type: String, default: "", maxlength: 100 },
    pincode: { type: String, default: "", maxlength: 12 },
    gstin: { type: String, default: "", trim: true, uppercase: true, maxlength: 15 },
    pan: { type: String, default: "", trim: true, uppercase: true, maxlength: 10 },
    categories: { type: [String], default: [] }, // inventory category ids supplied
    paymentTerms: { type: String, default: "", maxlength: 200 },
    creditLimitPaise: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 0, min: 0, max: 365 },
    minOrderValuePaise: { type: Number, default: 0, min: 0 },
    // The full account number is stored ENCRYPTED (AES-256-GCM, SETTINGS_ENCRYPTION_KEY, same
    // helper as payment-gateway secrets). It is never included in list/detail responses; only
    // GET /suppliers/:id/bank (suppliers:write, audited) decrypts it. Last 4 digits are kept
    // in clear for display.
    bank: {
      accountName: { type: String, default: "" },
      bankName: { type: String, default: "" },
      branch: { type: String, default: "" },
      ifsc: { type: String, default: "", uppercase: true },
      accountType: { type: String, enum: ["", "savings", "current", "cc", "other"], default: "" },
      upi: { type: String, default: "" },
      accountNumberEnc: { type: String, default: "" },
      accountLast4: { type: String, default: "" },
    },
    notes: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: SUPPLIER_STATUS, default: "active" },
    statusReason: { type: String, default: "" },
    createdBy: { type: String, default: null },
  },
  opts
);
supplierSchema.index({ name: 1 });
supplierSchema.index({ status: 1 });
const Supplier = mongoose.model("InvSupplier", supplierSchema, "invSuppliers");

/* ── Category / custom unit / storage location ───────────────────── */
const categorySchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("icat") },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: String, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  opts
);
const InventoryCategory = mongoose.model("InvCategory", categorySchema, "invCategories");

const customUnitSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("unit") },
    code: { type: String, unique: true, required: true, lowercase: true, trim: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    dimension: { type: String, enum: ["mass", "volume", "count"], required: true },
    // how many of the dimension's canonical unit (g / ml / pcs) make up one of these
    factor: { type: Number, required: true, min: 0.000001 },
  },
  opts
);
const CustomUnit = mongoose.model("InvUnit", customUnitSchema, "invUnits");

const LOCATION_TYPES = ["dry_store", "cold_room", "freezer", "kitchen", "bar", "receiving", "quarantine", "other"];
const locationSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("loc") },
    venueId: { type: String, required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: LOCATION_TYPES, default: "dry_store" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  opts
);
locationSchema.index({ venueId: 1, code: 1 }, { unique: true });
const StorageLocation = mongoose.model("InvLocation", locationSchema, "invLocations");

/* ── Inventory item ──────────────────────────────────────────────── */
const ITEM_TYPES = ["ingredient", "raw_material", "packaging", "beverage", "cleaning", "other"];
const itemSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("item") },
    sku: { type: String, unique: true, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 1000 },
    categoryId: { type: String, default: null },
    subcategoryId: { type: String, default: null },
    itemType: { type: String, enum: ITEM_TYPES, default: "ingredient" },
    brand: { type: String, default: "", maxlength: 100 },
    barcode: { type: String, default: "", trim: true, maxlength: 64 },
    baseUnit: { type: String, required: true, lowercase: true, trim: true },
    purchaseUnit: { type: String, default: "", lowercase: true, trim: true },
    // 1 <unit> = <factor> base units; only for units whose size depends on the product
    conversions: { type: [new Schema({ unit: String, factor: Number }, { _id: false })], default: [] },
    preferredSupplierId: { type: String, default: null },
    alternativeSupplierIds: { type: [String], default: [] },
    supplierRefs: { type: [new Schema({ supplierId: String, supplierItemCode: String }, { _id: false })], default: [] },
    // thresholds are in the item's base unit (milli) and apply to each branch separately
    minStockMilli: { type: Number, default: 0, min: 0 },
    reorderPointMilli: { type: Number, default: 0, min: 0 },
    safetyStockMilli: { type: Number, default: 0, min: 0 },
    maxStockMilli: { type: Number, default: 0, min: 0 },
    reorderQtyMilli: { type: Number, default: 0, min: 0 },
    defaultLocationId: { type: String, default: null },
    trackBatches: { type: Boolean, default: false },
    trackExpiry: { type: Boolean, default: false },
    requiresInspection: { type: Boolean, default: false },
    allowNegativeStock: { type: Boolean, default: false },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    hsn: { type: String, default: "", maxlength: 12 },
    costingMethod: { type: String, enum: ["weighted_average"], default: "weighted_average" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: String, default: null },
  },
  opts
);
itemSchema.index({ name: 1 });
itemSchema.index({ barcode: 1 });
itemSchema.index({ categoryId: 1, status: 1 });
const InventoryItem = mongoose.model("InvItem", itemSchema, "invItems");

/* ── Link between an inventory item and a branch's legacy `ingredients` record ──
   Ingredients are per branch; items are restaurant-wide, so one item can be linked to one
   ingredient in each branch. Once linked, the ledger is the source of truth for that
   ingredient's stock and `ingredients.stockRemaining` (kg) is a projection of it. */
const linkSchema = new Schema(
  {
    venueId: { type: String, required: true },
    ingredientId: { type: String, required: true },
    itemId: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false }
);
linkSchema.index({ venueId: 1, ingredientId: 1 }, { unique: true });
const IngredientLink = mongoose.model("InvIngredientLink", linkSchema, "invIngredientLinks");

/* ── Stock balance (current state, one row per venue/item/location/batch) ── */
const balanceSchema = new Schema(
  {
    venueId: { type: String, required: true },
    itemId: { type: String, required: true },
    locationId: { type: String, required: true },
    batchNo: { type: String, default: "" },
    mfgDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    qtyOnHandMilli: { type: Number, default: 0 },
    reservedMilli: { type: Number, default: 0, min: 0 },
    quarantinedMilli: { type: Number, default: 0, min: 0 },
    damagedMilli: { type: Number, default: 0, min: 0 },
    // persisted so list queries can filter on it; recomputed on EVERY balance write:
    // available = onHand - reserved - quarantined - damaged
    availableMilli: { type: Number, default: 0 },
    unitCostMicro: { type: Number, default: 0, min: 0 },
    rev: { type: Number, default: 0 }, // optimistic-concurrency token
  },
  { timestamps: true, versionKey: false }
);
balanceSchema.index({ venueId: 1, itemId: 1, locationId: 1, batchNo: 1 }, { unique: true });
balanceSchema.index({ venueId: 1, expiryDate: 1 });
balanceSchema.index({ itemId: 1 });
const StockBalance = mongoose.model("InvBalance", balanceSchema, "invBalances");

/* ── Stock ledger (append-only) ──────────────────────────────────── */
const LEDGER_TYPES = [
  "opening", "receipt", "adjustment_in", "adjustment_out", "waste", "consumption",
  "supplier_return", "transfer_in", "transfer_out", "status_change", "reversal",
];
const ledgerSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("led") },
    txnNo: { type: String, required: true, unique: true },
    venueId: { type: String, required: true },
    locationId: { type: String, required: true },
    itemId: { type: String, required: true },
    batchNo: { type: String, default: "" },
    type: { type: String, enum: LEDGER_TYPES, required: true },
    refType: { type: String, default: "" },
    refId: { type: String, default: "" },
    qtyInMilli: { type: Number, default: 0, min: 0 },
    qtyOutMilli: { type: Number, default: 0, min: 0 },
    unit: { type: String, required: true }, // the item's base unit at posting time
    balanceAfterMilli: { type: Number, required: true }, // on-hand of this (item, location, batch) after the entry
    unitCostMicro: { type: Number, default: 0 },
    valueImpactPaise: { type: Number, default: 0 }, // + for stock in, - for stock out
    reason: { type: String, default: "", maxlength: 500 },
    meta: { type: Schema.Types.Mixed, default: undefined }, // e.g. status_change { from, to }
    userId: { type: String, default: null },
    userName: { type: String, default: "" },
    approvalRef: { type: String, default: "" },
    reversalOf: { type: String, default: "" },
    // Always set (random when the caller sends none) so one plain unique index
    // makes every posting replay-safe.
    idempotencyKey: { type: String, unique: true, required: true },
    postedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, timestamps: false }
);
ledgerSchema.index({ venueId: 1, itemId: 1, postedAt: -1 });
ledgerSchema.index({ venueId: 1, postedAt: -1 });
ledgerSchema.index({ refType: 1, refId: 1 });

// Posted ledger entries are history. Corrections are new `reversal` entries.
const IMMUTABLE_OPS = [
  "updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne",
  "deleteOne", "deleteMany", "findOneAndDelete",
];
for (const op of IMMUTABLE_OPS) {
  ledgerSchema.pre(op, function () {
    throw Object.assign(new Error("Stock ledger entries are append-only; post a reversal instead."), { code: "LEDGER_IMMUTABLE" });
  });
}
ledgerSchema.pre("save", function () {
  if (!this.isNew) throw Object.assign(new Error("Stock ledger entries are append-only; post a reversal instead."), { code: "LEDGER_IMMUTABLE" });
});
const StockLedger = mongoose.model("InvLedger", ledgerSchema, "invLedger");

module.exports = {
  newId, nextNumber, Counter,
  Supplier, SUPPLIER_STATUS, SUPPLIER_TYPES,
  InventoryCategory, CustomUnit, StorageLocation, LOCATION_TYPES,
  InventoryItem, ITEM_TYPES, IngredientLink,
  StockBalance, StockLedger, LEDGER_TYPES,
};
