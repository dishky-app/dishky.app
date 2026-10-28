/**
 * receivingModels.js — goods receipt notes and supplier returns (Phase 3).
 *
 * A GRN line splits what was delivered into accepted + quarantined + rejected.
 * Only accepted and quarantined quantities enter stock; rejected goods never do.
 * PO "received" quantities are DERIVED from posted GRNs and dispatched returns, never incremented.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { newId } = require("./models");

const opts = { timestamps: true, versionKey: false };
const hist = new Schema({ action: String, by: String, byName: String, at: { type: Date, default: Date.now }, comment: { type: String, default: "" }, toStatus: String }, { _id: false });

const grnLine = new Schema(
  {
    itemId: String, itemName: String, sku: String, unit: String, // base unit
    orderedMilli: { type: Number, default: 0 }, // PO line quantity at receipt time (informational)
    deliveredMilli: Number, acceptedMilli: { type: Number, default: 0 }, quarantinedMilli: { type: Number, default: 0 }, rejectedMilli: { type: Number, default: 0 },
    locationId: String, batchNo: { type: String, default: "" }, mfgDate: { type: Date, default: null }, expiryDate: { type: Date, default: null },
    unitCostMicro: { type: Number, default: 0 }, // from the PO line: net of discount, before GST
    checks: { type: Schema.Types.Mixed, default: {} }, // { packagingOk, labelOk, qualityOk, tempC }
    reason: { type: String, default: "" }, // required when anything is rejected or quarantined
    remarks: { type: String, default: "" },
  },
  { _id: false }
);
const GRN_STATUS = ["draft", "posting", "posted", "cancelled"];
const grnSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("grn") },
    grnNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    poId: { type: String, required: true, index: true },
    poNo: String, supplierId: String, supplierName: String,
    receivedDate: { type: Date, default: Date.now },
    deliveryNoteNo: { type: String, default: "" }, supplierInvoiceNo: { type: String, default: "" }, vehicleNo: { type: String, default: "" },
    receivedBy: String, receivedByName: String,
    notes: { type: String, default: "", maxlength: 2000 },
    lines: { type: [grnLine], default: [] },
    status: { type: String, enum: GRN_STATUS, default: "draft" },
    postedAt: { type: Date, default: null },
    onTime: { type: Boolean, default: null }, // receivedDate <= PO expected date, set when posted
    history: { type: [hist], default: [] },
  },
  opts
);
grnSchema.index({ venueId: 1, status: 1, createdAt: -1 });
grnSchema.index({ supplierId: 1, status: 1 });
const Grn = mongoose.model("InvGrn", grnSchema, "invGrns");

const retLine = new Schema(
  {
    itemId: String, itemName: String, unit: String, qtyMilli: Number,
    source: { type: String, enum: ["stock", "quarantine", "rejected_at_gate"] },
    locationId: { type: String, default: "" }, batchNo: { type: String, default: "" },
    grnId: { type: String, default: null }, // required for rejected_at_gate
    unitCostMicro: { type: Number, default: 0 }, valuePaise: { type: Number, default: 0 },
    reopenPo: { type: Boolean, default: false }, // the returned quantity becomes outstanding on the PO again
    reason: { type: String, default: "" },
  },
  { _id: false }
);
const RETURN_STATUS = ["draft", "pending_approval", "approved", "rejected", "dispatched", "credited", "cancelled"];
const retSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("ret") },
    returnNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    supplierId: { type: String, required: true }, supplierName: String,
    poId: { type: String, default: null }, poNo: { type: String, default: "" },
    reasonCategory: { type: String, enum: ["damaged", "expired", "quality", "wrong_item", "short_shelf_life", "excess", "other"], default: "quality" },
    notes: { type: String, default: "", maxlength: 2000 },
    lines: { type: [retLine], default: [] },
    totalPaise: { type: Number, default: 0 },
    status: { type: String, enum: RETURN_STATUS, default: "draft" },
    createdBy: String, createdByName: String,
    dispatchedAt: { type: Date, default: null }, vehicleNo: { type: String, default: "" },
    appliedInvoiceId: { type: String, default: null }, // supplier invoice this credit note was set against
    creditNoteNo: { type: String, default: "" }, creditAmountPaise: { type: Number, default: 0 }, creditDate: { type: Date, default: null },
    history: { type: [hist], default: [] },
  },
  opts
);
retSchema.index({ venueId: 1, status: 1, createdAt: -1 });
retSchema.index({ poId: 1 });
const SupplierReturn = mongoose.model("InvSupplierReturn", retSchema, "invSupplierReturns");

module.exports = { Grn, GRN_STATUS, SupplierReturn, RETURN_STATUS };
