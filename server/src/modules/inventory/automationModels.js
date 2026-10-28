/**
 * automationModels.js — Phase 5: automation settings, stock audits, WhatsApp send log, consumption issues.
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { newId } = require("./models");

const opts = { timestamps: true, versionKey: false };
const hist = new Schema({ action: String, by: String, byName: String, at: { type: Date, default: Date.now }, comment: { type: String, default: "" }, toStatus: String }, { _id: false });

/* one document per restaurant (tenant plugin scopes it) */
const settingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "automation" },
    expiryAlertDays: { type: Number, default: 7, min: 1, max: 90 },
    dueSoonDays: { type: Number, default: 3, min: 0, max: 60 },
    forecastLookbackDays: { type: Number, default: 28, min: 7, max: 120 },
    forecastHorizonDays: { type: Number, default: 7, min: 1, max: 60 },
    auditVarianceApprovalPaise: { type: Number, default: 0, min: 0 }, // informational threshold shown as "large variance"
    // AiSensy campaign/template name, pre-approved by WhatsApp. Sending is refused until set.
    whatsappPurchaseTemplate: { type: String, default: "", maxlength: 100 },
    whatsappHourlyLimit: { type: Number, default: 20, min: 1, max: 200 },
  },
  opts
);
const AutomationSettings = mongoose.model("InvAutomationSettings", settingsSchema, "invAutomationSettings");

/* ── stock audit (physical count) ── */
const AUDIT_STATUS = ["counting", "pending_approval", "approved", "posted", "cancelled"];
const auditLine = new Schema(
  {
    itemId: String, itemName: String, sku: String, unit: String,
    locationId: String, batchNo: { type: String, default: "" }, expiryDate: { type: Date, default: null },
    systemMilli: { type: Number, default: 0 }, // on-hand when the audit was opened
    countedMilli: { type: Number, default: null }, // null = not counted yet
    unitCostMicro: { type: Number, default: 0 },
    varianceMilli: { type: Number, default: 0 }, varianceValuePaise: { type: Number, default: 0 },
    reason: { type: String, default: "" }, countedBy: { type: String, default: "" }, countedAt: { type: Date, default: null },
    postedEntryId: { type: String, default: "" },
  },
  { _id: false }
);
const auditSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("aud") },
    auditNo: { type: String, unique: true, required: true },
    venueId: { type: String, required: true },
    title: { type: String, default: "", maxlength: 120 },
    locationId: { type: String, default: null }, categoryId: { type: String, default: null },
    blind: { type: Boolean, default: true }, // counters are not shown the system quantity
    lines: { type: [auditLine], default: [] },
    status: { type: String, enum: AUDIT_STATUS, default: "counting" },
    createdBy: String, createdByName: String,
    submittedBy: { type: String, default: null }, approvedBy: { type: String, default: null }, approvedByName: { type: String, default: "" },
    totalVariancePaise: { type: Number, default: 0 }, shrinkPaise: { type: Number, default: 0 }, surplusPaise: { type: Number, default: 0 },
    history: { type: [hist], default: [] },
  },
  opts
);
auditSchema.index({ venueId: 1, status: 1, createdAt: -1 });
const StockAudit = mongoose.model("InvStockAudit", auditSchema, "invStockAudits");

/* ── WhatsApp purchase-list log (one row per attempt) ── */
const waSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("wa") },
    venueId: { type: String, required: true },
    supplierId: String, supplierName: String,
    phoneMasked: String, template: String,
    refType: { type: String, default: "" }, refId: { type: String, default: "" },
    itemCount: Number, listText: { type: String, default: "" },
    status: { type: String, enum: ["sending", "sent", "failed"], default: "sending" },
    error: { type: String, default: "" },
    sentBy: String, sentByName: String,
  },
  opts
);
waSchema.index({ venueId: 1, createdAt: -1 });
waSchema.index({ sentBy: 1, createdAt: -1 });
const WhatsappLog = mongoose.model("InvWhatsappLog", waSchema, "invWhatsappLogs");

/* ── order consumption that could not be booked in full ── */
const issueSchema = new Schema(
  {
    id: { type: String, unique: true, default: () => newId("cis") },
    venueId: { type: String, required: true },
    orderId: String, itemId: String, itemName: String, unit: String,
    kind: { type: String, enum: ["shortfall", "ledger_failed"], default: "shortfall" },
    shortfallMilli: { type: Number, default: 0 }, detail: { type: String, default: "" },
    resolved: { type: Boolean, default: false }, resolvedBy: { type: String, default: "" }, resolvedAt: { type: Date, default: null },
  },
  opts
);
issueSchema.index({ venueId: 1, resolved: 1, createdAt: -1 });
issueSchema.index({ orderId: 1, itemId: 1, kind: 1 }, { unique: true }); // a replayed order cannot raise the same issue twice
const ConsumptionIssue = mongoose.model("InvConsumptionIssue", issueSchema, "invConsumptionIssues");

module.exports = { AutomationSettings, StockAudit, AUDIT_STATUS, WhatsappLog, ConsumptionIssue };
