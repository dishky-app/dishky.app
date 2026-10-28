/**
 * purchaseModels.js — procurement documents (Phase 2).
 *
 * Tenant scope comes from the global tenancy plugin; branch scope is `venueId`.
 * Document numbers (PR-00001, RFQ-00001 ...) are unique per restaurant. Quantities are integer
 * milli base-units, unit prices micro-rupees per base unit, money paise (see precision.js).
 * Lines snapshot the item name/SKU so a document stays readable if the item is later renamed.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { newId } = require("./models");

const opts = { timestamps: true, versionKey: false };

const approvalEntry = new Schema(
  { action: String, by: String, byName: String, at: { type: Date, default: Date.now }, comment: { type: String, default: "" }, fromStatus: String, toStatus: String },
  { _id: false }
);
const attachment = new Schema({ name: String, url: String }, { _id: false });

/* ── Purchase settings (one document per restaurant) ──────────────── */
const settingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "purchase" },
    // A document whose value is at or below the limit needs no approval (0 = always needs approval)
    prApprovalLimitPaise: { type: Number, default: 0, min: 0 },
    poApprovalLimitPaise: { type: Number, default: 0, min: 0 },
    // maker-checker: may the person who created a document also approve it?
    allowSelfApproval: { type: Boolean, default: false },
    allowManualPo: { type: Boolean, default: false },
    // invoice matching tolerances and payment approval
    matchQtyTolerancePct: { type: Number, default: 0, min: 0, max: 100 },
    matchPriceTolerancePct: { type: Number, default: 0, min: 0, max: 100 },
    invoiceTotalTolerancePaise: { type: Number, default: 100, min: 0 },
    paymentApprovalLimitPaise: { type: Number, default: 0, min: 0 }, // payments at or below need no approval; 0 = every payment needs approval
    overReceiptPct: { type: Number, default: 0, min: 0, max: 100 }, // tolerated over-delivery on a PO line, in percent
    gstStateCode: { type: String, default: "" }, // 2-digit GST state code of the restaurant
    reorderLookbackDays: { type: Number, default: 30, min: 1, max: 365 },
  },
  opts
);
const PurchaseSettings = mongoose.model("InvPurchaseSettings", settingsSchema, "invPurchaseSettings");

/* ── Purchase request ─────────────────────────────────────────────── */
const prLine = new Schema(
  {
    itemId: String, itemName: String, sku: String,
    qtyMilli: Number, unit: String, // base unit
    enteredQty: Number, enteredUnit: String, // as the requester typed it (display only)
    availableMilli: { type: Number, default: 0 }, // snapshot taken when submitted
    suggestedMilli: { type: Number, default: 0 },
    estUnitCostMicro: { type: Number, default: 0 },
    estTotalPaise: { type: Number, default: 0 },
    requiredBy: { type: Date, default: null },
    remarks: { type: String, default: "" },
  },
  { _id: false }
);
const PR_STATUS = ["draft", "pending_approval", "changes_requested", "approved", "rejected", "rfq_issued", "ordered", "cancelled"];
const prSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("pr") },
    prNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    department: { type: String, default: "", maxlength: 80 },
    requestDate: { type: Date, default: Date.now },
    requiredDate: { type: Date, default: null },
    requestedBy: { type: String, required: true },
    requestedByName: { type: String, default: "" },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    purpose: { type: String, default: "", maxlength: 500 },
    preferredSupplierId: { type: String, default: null },
    notes: { type: String, default: "", maxlength: 2000 },
    attachments: { type: [attachment], default: [] },
    lines: { type: [prLine], default: [] },
    totalPaise: { type: Number, default: 0 },
    status: { type: String, enum: PR_STATUS, default: "draft" },
    approvals: { type: [approvalEntry], default: [] },
    source: { type: String, default: "manual" }, // manual | reorder
    rfqId: { type: String, default: null },
    poIds: { type: [String], default: [] },
  },
  opts
);
prSchema.index({ venueId: 1, status: 1, createdAt: -1 });
prSchema.index({ requestedBy: 1 });
const PurchaseRequest = mongoose.model("InvPurchaseRequest", prSchema, "invPurchaseRequests");

/* ── RFQ ──────────────────────────────────────────────────────────── */
const rfqLine = new Schema(
  {
    itemId: String, itemName: String, sku: String, description: { type: String, default: "" },
    brand: { type: String, default: "" }, qtyMilli: Number, unit: String,
    enteredQty: Number, enteredUnit: String,
    alternatives: { type: String, default: "" }, qualitySpec: { type: String, default: "" },
    packaging: { type: String, default: "" }, requiredBy: { type: Date, default: null },
  },
  { _id: false }
);
const rfqSupplier = new Schema(
  { supplierId: String, name: String, status: { type: String, enum: ["invited", "responded", "declined"], default: "invited" } },
  { _id: false }
);
const RFQ_STATUS = ["draft", "sent", "responses_received", "evaluation", "awarded", "closed", "cancelled"];
const rfqSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("rfq") },
    rfqNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    prId: { type: String, default: null },
    issueDate: { type: Date, default: Date.now },
    deadline: { type: Date, default: null },
    requiredDate: { type: Date, default: null },
    deliveryAddress: { type: String, default: "", maxlength: 500 },
    paymentTerms: { type: String, default: "", maxlength: 200 },
    deliveryTerms: { type: String, default: "", maxlength: 200 },
    currency: { type: String, default: "INR" },
    notes: { type: String, default: "", maxlength: 2000 },
    attachments: { type: [attachment], default: [] },
    suppliers: { type: [rfqSupplier], default: [] },
    lines: { type: [rfqLine], default: [] },
    status: { type: String, enum: RFQ_STATUS, default: "draft" },
    sentAt: { type: Date, default: null },
    sentBy: { type: String, default: null },
    awardedQuotationId: { type: String, default: null },
    selectionReason: { type: String, default: "" },
    createdBy: { type: String, default: null },
    createdByName: { type: String, default: "" },
    history: { type: [approvalEntry], default: [] },
  },
  opts
);
rfqSchema.index({ venueId: 1, status: 1, createdAt: -1 });
const Rfq = mongoose.model("InvRfq", rfqSchema, "invRfqs");

/* ── Supplier quotation ───────────────────────────────────────────── */
const quoLine = new Schema(
  {
    itemId: String, itemName: String, brand: { type: String, default: "" },
    qtyMilli: Number, unit: String,
    unitPriceMicro: Number, discountBp: { type: Number, default: 0 }, gstBp: { type: Number, default: 0 },
    grossPaise: Number, discountPaise: Number, taxablePaise: Number, taxPaise: Number, totalPaise: Number,
    availability: { type: String, default: "" }, leadTimeDays: { type: Number, default: 0 },
  },
  { _id: false }
);
const QUO_STATUS = ["received", "shortlisted", "selected", "rejected", "revision_requested"];
const quoSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("quo") },
    quoNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    rfqId: { type: String, required: true, index: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, default: "" },
    supplierRef: { type: String, default: "" },
    quotationDate: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
    lines: { type: [quoLine], default: [] },
    freightPaise: { type: Number, default: 0, min: 0 },
    otherChargesPaise: { type: Number, default: 0, min: 0 },
    paymentTerms: { type: String, default: "" },
    remarks: { type: String, default: "" },
    attachments: { type: [attachment], default: [] },
    totals: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: QUO_STATUS, default: "received" },
    decisionReason: { type: String, default: "" },
    recordedBy: { type: String, default: null },
    recordedByName: { type: String, default: "" },
  },
  opts
);
quoSchema.index({ rfqId: 1, supplierId: 1 });
const Quotation = mongoose.model("InvQuotation", quoSchema, "invQuotations");

/* ── Purchase order ───────────────────────────────────────────────── */
const poLine = new Schema(
  {
    itemId: String, itemName: String, sku: String, brand: { type: String, default: "" },
    qtyMilli: Number, unit: String, // ordered, in base unit
    enteredQty: Number, enteredUnit: String,
    unitPriceMicro: Number, discountBp: { type: Number, default: 0 }, gstBp: { type: Number, default: 0 },
    grossPaise: Number, discountPaise: Number, taxablePaise: Number, taxPaise: Number, totalPaise: Number,
    expectedDate: { type: Date, default: null },
    receivedMilli: { type: Number, default: 0, min: 0 }, // maintained by goods receipts (Phase 3)
    closedMilli: { type: Number, default: 0, min: 0 }, // short-closed quantity
  },
  { _id: false }
);
const PO_STATUS = ["draft", "pending_approval", "approved", "rejected", "sent", "partially_received", "received", "closed", "cancelled"];
const poSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("po") },
    poNo: { type: String, unique: true, required: true },
    version: { type: Number, default: 1 },
    venueId: { type: String, required: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, default: "" },
    supplierGstin: { type: String, default: "" },
    deliveryAddress: { type: String, default: "", maxlength: 500 },
    prId: { type: String, default: null },
    rfqId: { type: String, default: null },
    quotationId: { type: String, default: null },
    orderDate: { type: Date, default: Date.now },
    expectedDate: { type: Date, default: null },
    paymentTerms: { type: String, default: "", maxlength: 200 },
    deliveryTerms: { type: String, default: "", maxlength: 200 },
    currency: { type: String, default: "INR" },
    buyerId: { type: String, required: true },
    buyerName: { type: String, default: "" },
    notes: { type: String, default: "", maxlength: 2000 },
    attachments: { type: [attachment], default: [] },
    lines: { type: [poLine], default: [] },
    totals: { type: Schema.Types.Mixed, default: {} },
    taxSplit: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: PO_STATUS, default: "draft" },
    approvals: { type: [approvalEntry], default: [] },
    sentAt: { type: Date, default: null },
    sentBy: { type: String, default: null },
    sentVia: { type: String, default: "" }, // recorded by the user; Dishky does not transmit the PO itself yet
    cancelReason: { type: String, default: "" },
    revisions: { type: [new Schema({ version: Number, reason: String, by: String, byName: String, at: Date, snapshot: Schema.Types.Mixed }, { _id: false })], default: [] },
  },
  opts
);
poSchema.index({ venueId: 1, status: 1, createdAt: -1 });
poSchema.index({ supplierId: 1, status: 1 });
poSchema.index({ prId: 1 });
const PurchaseOrder = mongoose.model("InvPurchaseOrder", poSchema, "invPurchaseOrders");

module.exports = {
  PurchaseSettings, PurchaseRequest, PR_STATUS, Rfq, RFQ_STATUS, Quotation, QUO_STATUS, PurchaseOrder, PO_STATUS,
};
