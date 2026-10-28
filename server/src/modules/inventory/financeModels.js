/**
 * financeModels.js — supplier invoices and payments (Phase 4).
 * Money is paise, unit prices micro-rupees per base unit, quantities milli base-units (see precision.js).
 * An invoice's paid amount and a return-credit total are DERIVED from payments / returns, never incremented.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { newId } = require("./models");

const opts = { timestamps: true, versionKey: false };
const hist = new Schema({ action: String, by: String, byName: String, at: { type: Date, default: Date.now }, comment: { type: String, default: "" }, toStatus: String }, { _id: false });

const invLine = new Schema(
  {
    itemId: String, itemName: String, unit: String,
    qtyMilli: Number, unitPriceMicro: Number, discountBp: { type: Number, default: 0 }, gstBp: { type: Number, default: 0 },
    grossPaise: Number, discountPaise: Number, taxablePaise: Number, taxPaise: Number, totalPaise: Number,
  },
  { _id: false }
);

const INVOICE_STATUS = ["draft", "pending_approval", "approved", "rejected", "disputed", "cancelled"];
const invSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("sinv") },
    docNo: { type: String, unique: true, required: true }, // our own number, e.g. SINV-00001
    invoiceNo: { type: String, required: true, trim: true, maxlength: 60 }, // the supplier's number
    invoiceKey: { type: String, required: true, unique: true }, // supplierId|NORMALISEDNO — duplicate guard
    venueId: { type: String, required: true },
    supplierId: { type: String, required: true }, supplierName: String, supplierGstin: { type: String, default: "" },
    poId: { type: String, default: null }, poNo: { type: String, default: "" },
    invoiceDate: { type: Date, required: true }, dueDate: { type: Date, default: null },
    lines: { type: [invLine], default: [] },
    freightPaise: { type: Number, default: 0, min: 0 }, otherChargesPaise: { type: Number, default: 0, min: 0 },
    totals: { type: Schema.Types.Mixed, default: {} },
    taxSplit: { type: Schema.Types.Mixed, default: null },
    statedTotalPaise: { type: Number, default: null }, // the total printed on the supplier's invoice, for cross-checking
    creditsAppliedPaise: { type: Number, default: 0 }, // derived from supplier returns applied to this invoice
    paidPaise: { type: Number, default: 0 }, pendingPaise: { type: Number, default: 0 }, // derived from payments
    match: { type: Schema.Types.Mixed, default: null }, // 3-way match snapshot
    overrideReason: { type: String, default: "" },
    notes: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: INVOICE_STATUS, default: "draft" },
    createdBy: String, createdByName: String,
    history: { type: [hist], default: [] },
  },
  opts
);
invSchema.index({ venueId: 1, status: 1, createdAt: -1 });
invSchema.index({ supplierId: 1, status: 1 });
invSchema.index({ poId: 1 });
const SupplierInvoice = mongoose.model("InvSupplierInvoice", invSchema, "invSupplierInvoices");

const PAYMENT_STATUS = ["pending_approval", "completed", "rejected", "cancelled", "reversed"];
const METHODS = ["bank_transfer", "upi", "cheque", "cash", "card", "other"];
const paySchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("spay") },
    payNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    supplierId: { type: String, required: true }, supplierName: String,
    paymentDate: { type: Date, required: true },
    method: { type: String, enum: METHODS, required: true },
    reference: { type: String, default: "", maxlength: 80 }, // UTR / cheque / transaction number
    refKey: { type: String, default: undefined }, // supplier|method|reference — duplicate guard (only when a reference exists)
    idemKey: { type: String, default: undefined }, // client Idempotency-Key
    amountPaise: { type: Number, required: true, min: 1 },
    allocations: { type: [new Schema({ invoiceId: String, docNo: String, amountPaise: Number }, { _id: false })], default: [] },
    notes: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: PAYMENT_STATUS, default: "pending_approval" },
    reverseReason: { type: String, default: "" },
    createdBy: String, createdByName: String,
    history: { type: [hist], default: [] },
  },
  opts
);
paySchema.index({ refKey: 1 }, { unique: true, sparse: true });
paySchema.index({ idemKey: 1 }, { unique: true, sparse: true });
paySchema.index({ venueId: 1, status: 1, createdAt: -1 });
paySchema.index({ supplierId: 1 });
const SupplierPayment = mongoose.model("InvSupplierPayment", paySchema, "invSupplierPayments");

module.exports = { SupplierInvoice, INVOICE_STATUS, SupplierPayment, PAYMENT_STATUS, METHODS };
