/**
 * support/models.js — platform-level (cross-tenant) collections for the
 * Developer Support & Ticket Management system.
 *
 * All declared `tenantScoped: false` (see tenancy.js): a ticket belongs to a
 * restaurant but is worked on by Dishky staff who sit outside every tenant, so
 * these collections cannot be auto-filtered by the tenancy plugin. Isolation is
 * therefore enforced in service.js: every restaurant-side query is pinned to
 * the restaurantId of the signed-in session, never to anything in the request.
 */
const mongoose = require("mongoose");
const crypto = require("crypto");
const C = require("./constants");

const opts = { versionKey: false, tenantScoped: false };
const rid = (p) => `${p}_${crypto.randomBytes(9).toString("hex")}`;
const m = (name, schema, coll) => mongoose.models[name] || mongoose.model(name, schema, coll);

/* Monotonic counters for human-friendly ids (TKT-000123, DSK-0007). */
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, opts);
const SupportCounter = m("SupportCounter", counterSchema, "supportCounters");
async function nextSeq(name) {
  const c = await SupportCounter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return c.seq;
}

/* Dishky internal staff: profile + login in one record. */
const staffSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("dsk") },
    staffNo: { type: String, unique: true }, // DSK-0001
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    profileImage: { type: String, default: "" }, // https URL only (validated in routes)
    department: { type: String, default: "Engineering", trim: true, maxlength: 80 },
    designation: { type: String, default: "", trim: true, maxlength: 80 },
    role: { type: String, enum: C.STAFF_ROLES, required: true },
    skills: { type: [String], default: [] },
    supportedModules: { type: [String], default: [] },
    restaurantScope: { type: [String], default: [] }, // restaurant ids for tickets.viewRestaurant
    passwordHash: { type: String, default: "" }, // bcrypt; empty until the invitation is accepted
    status: { type: String, enum: ["invited", "active", "deactivated"], default: "invited", index: true },
    joinedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { ...opts, timestamps: true }
);

const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    staffId: { type: String, required: true, index: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { ...opts, timestamps: true }
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* One-time tokens for forgot-password and for accepting an invitation. Only the hash is stored. */
const resetSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    staffId: { type: String, required: true, index: true },
    purpose: { type: String, enum: ["reset", "invite"], default: "reset" },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { ...opts, timestamps: true }
);
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const attachmentRefSchema = new mongoose.Schema(
  { id: String, name: String, mime: String, size: Number, uploadedBy: String, uploadedByKind: String, at: Date },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true }, // TKT-000123
    restaurantId: { type: String, required: true, index: true },
    restaurantName: { type: String, default: "" },
    venueId: { type: String, default: null, index: true },
    branchName: { type: String, default: "" },

    reporter: {
      adminId: String, name: String, email: String, roleTitle: String,
      onBehalfOf: { type: String, default: "" }, // set when Dishky staff create a ticket for a restaurant
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: C.CATEGORIES.map((c) => c.value), required: true },
    module: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 8000 },
    expected: { type: String, default: "", maxlength: 4000 },
    actual: { type: String, default: "", maxlength: 4000 },
    steps: { type: String, default: "", maxlength: 6000 },
    impact: { type: String, default: "", maxlength: 3000 },
    suggestedPriority: { type: String, enum: C.PRIORITIES, default: "medium" },
    attachments: { type: [attachmentRefSchema], default: [] },

    status: { type: String, enum: C.ALL_STATUSES, default: C.STATUS.NEW, index: true },
    resumeStatus: { type: String, default: null },
    priority: { type: String, enum: C.PRIORITIES, default: null, index: true },
    severity: { type: String, enum: C.SEVERITIES, default: null },
    triagedAt: Date, triagedBy: String,

    developerId: { type: String, default: null, index: true }, developerName: { type: String, default: "" },
    testerId: { type: String, default: null, index: true }, testerName: { type: String, default: "" },
    reviewerId: { type: String, default: null, index: true }, reviewerName: { type: String, default: "" },
    assignedAt: Date, acknowledgedAt: Date, startedAt: Date, lastProgressAt: Date,
    deadline: { type: Date, default: null, index: true },
    deadlineHistory: { type: [{ from: Date, to: Date, by: String, reason: String, at: Date, _id: false }], default: [] },
    deadlineWarnedAt: Date, overdueNotifiedAt: Date,
    progressPct: { type: Number, default: 0 },
    blockerReason: { type: String, default: "" },
    clarificationRequestedAt: Date,

    // developer workspace
    investigationNotes: { type: String, default: "" },
    rootCause: { type: String, default: "" },
    fixSummary: { type: String, default: "" },
    testEvidence: { type: String, default: "" },
    branch: { type: String, default: "" },
    commitRef: { type: String, default: "" },
    qaCycle: { type: Number, default: 0 },
    submittedForQAAt: Date, qaStartedAt: Date, qaPassedAt: Date,
    lastQA: { type: mongoose.Schema.Types.Mixed, default: null },
    changesReason: { type: String, default: "" },

    // review / release (kept as four separate facts)
    review: { type: mongoose.Schema.Types.Mixed, default: null },
    releaseApproval: { type: mongoose.Schema.Types.Mixed, default: null },
    codePush: { type: mongoose.Schema.Types.Mixed, default: null },
    lastRelease: { type: mongoose.Schema.Types.Mixed, default: null },
    releasedAt: Date,

    // closure
    verificationNote: { type: String, default: "" },
    resolutionSummary: { type: String, default: "" },
    verifiedAt: Date, resolvedAt: Date, closedAt: Date, reporterConfirmedAt: Date,
    reopenCount: { type: Number, default: 0 },
    lastPublicActivityAt: { type: Date, default: Date.now },
    latestPublicResponse: { type: String, default: "" },
  },
  { ...opts, timestamps: true }
);
ticketSchema.index({ restaurantId: 1, createdAt: -1 });
ticketSchema.index({ restaurantId: 1, venueId: 1, status: 1 });
ticketSchema.index({ status: 1, deadline: 1 });

const attachmentSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("att") },
    ticketId: { type: String, required: true, index: true },
    restaurantId: { type: String, required: true },
    name: String, mime: String, size: Number,
    data: { type: Buffer, required: true },
    uploadedBy: String, uploadedByKind: String,
    internal: { type: Boolean, default: false }, // staff-only attachment (hidden from the reporter)
  },
  { ...opts, timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("tcm") },
    ticketId: { type: String, required: true, index: true },
    visibility: { type: String, enum: ["public", "internal"], default: "public" },
    body: { type: String, required: true, maxlength: 6000 },
    author: { kind: String, id: String, name: String },
  },
  { ...opts, timestamps: true }
);
commentSchema.index({ ticketId: 1, createdAt: 1 });

/* Status history / activity timeline. `public` events are what the reporter sees. */
const historySchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, index: true },
    type: { type: String, required: true }, // created | status | assign | deadline | priority | approval | qa | release | comment | reopen ...
    action: String,
    from: String, to: String,
    note: { type: String, default: "" },
    publicNote: { type: String, default: "" },
    public: { type: Boolean, default: false },
    actor: { kind: String, id: String, name: String },
    at: { type: Date, default: Date.now },
  },
  { ...opts }
);
historySchema.index({ ticketId: 1, at: 1 });

const qaSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("qa") },
    ticketId: { type: String, required: true, index: true },
    cycle: Number,
    verdict: { type: String, enum: ["pass", "fail"], required: true },
    summary: String, evidence: String, steps: String,
    tester: { id: String, name: String },
  },
  { ...opts, timestamps: true }
);

const releaseSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("rel") },
    ticketId: { type: String, required: true, index: true },
    releaseId: String, environment: String, result: String, operator: String,
    branch: String, commitRef: String, notes: String, approvedBy: String,
    recordedBy: { id: String, name: String },
  },
  { ...opts, timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, default: () => rid("ntf") },
    // recipient: { kind: "staff" | "superadmin" | "restaurant" }
    recipientKind: { type: String, enum: ["staff", "superadmin", "restaurant"], required: true },
    recipientId: { type: String, default: "" }, // staff id / restaurant admin id; "" = every platform admin
    restaurantId: { type: String, default: null },
    ticketId: String,
    kind: String, // created | assigned | status | comment | deadline | overdue | qa | release | clarification | resolved | closed | reopened
    message: String,
    read: { type: Boolean, default: false },
  },
  { ...opts, timestamps: true }
);
notificationSchema.index({ recipientKind: 1, recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 120 });

/* Staff-management, permission and auth events (ticket events live in TicketHistory). */
const auditSchema = new mongoose.Schema(
  {
    category: String, // staff | permissions | auth | config
    action: String,
    targetId: String, targetLabel: String,
    actor: { kind: String, id: String, name: String },
    detail: { type: mongoose.Schema.Types.Mixed, default: undefined },
    ip: String,
    at: { type: Date, default: Date.now },
  },
  opts
);
auditSchema.index({ at: -1 });

/* Singleton configuration: SLA hours, closure rules, role→permission map. */
const configSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "support" },
    slaHours: { type: mongoose.Schema.Types.Mixed, default: () => ({ ...C.DEFAULT_SLA_HOURS }) },
    reopenWindowDays: { type: Number, default: 30 },
    autoCloseDays: { type: Number, default: 7 }, // resolved tickets are closed automatically after this many days; 0 = never
    deadlineWarningHours: { type: Number, default: 24 },
    rolePermissions: { type: mongoose.Schema.Types.Mixed, default: () => JSON.parse(JSON.stringify(C.ROLE_DEFAULTS)) },
  },
  { ...opts, timestamps: true, minimize: false }
);

module.exports = {
  rid, nextSeq,
  SupportCounter,
  DishkyStaff: m("DishkyStaff", staffSchema, "dishkyStaff"),
  DevSession: m("DevSession", sessionSchema, "dishkyStaffSessions"),
  DevReset: m("DevReset", resetSchema, "dishkyStaffResetTokens"),
  Ticket: m("Ticket", ticketSchema, "supportTickets"),
  TicketAttachment: m("TicketAttachment", attachmentSchema, "supportTicketAttachments"),
  TicketComment: m("TicketComment", commentSchema, "supportTicketComments"),
  TicketHistory: m("TicketHistory", historySchema, "supportTicketHistory"),
  TicketQAReport: m("TicketQAReport", qaSchema, "supportQAReports"),
  TicketRelease: m("TicketRelease", releaseSchema, "supportReleases"),
  SupportNotification: m("SupportNotification", notificationSchema, "supportNotifications"),
  SupportAudit: m("SupportAudit", auditSchema, "supportAudit"),
  SupportConfig: m("SupportConfig", configSchema, "supportConfig"),
};
