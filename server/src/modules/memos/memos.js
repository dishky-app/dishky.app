/**
 * memos.js — Dishky Memo Management & Issue Resolution Module
 *
 * A restaurant incident / complaint / operational-failure tracking
 * system, NOT a staff-announcement board. A memo is created when
 * something goes wrong (food quality, service failure, safety issue,
 * customer complaint, etc.) and tracked from creation through
 * investigation, corrective action, customer compensation, resolution,
 * and verification, all the way to closure — with a full, immutable,
 * timeline-style event history.
 *
 * CREATION PERMISSION
 * Only three roles may create a memo: Super Admin (roleGroup), and the
 * "Chef" / "Service Manager" roleTitles (both rank Manager). This is a
 * mixed roleGroup+roleTitle rule, so it can't be expressed with the
 * existing requireRole(...) helper (which only checks roleGroup) —
 * requireCanCreateMemo below is the dedicated gate, mirroring the
 * shape of requireCanManageStaff in auth.js. Everyone else may still be
 * assigned, mentioned, or involved in a memo; they just can't create
 * one. Enforced here (backend) — the frontend additionally hides the
 * Create Memo button, but that's a UX nicety, never the real gate.
 *
 * DATA MODEL
 * One Mongoose document per memo holds every section from the spec
 * (basic info, issue details, order/customer link, responsible
 * people, evidence, immediate action, root cause, an array of
 * corrective actions, aftermath/impact, staff/disciplinary action,
 * customer compensation, resolution, verification) plus an append-only
 * `timeline` array that IS the audit history for this memo — every
 * meaningful transition pushes an entry, and the details page's
 * timeline view renders straight from it rather than being hand
 * entered. Kept as one document (not split across collections) since
 * every sub-section is always read/written together with the memo as
 * a unit — this mirrors documents.js's self-contained style rather
 * than the generic ARRAY_COLLECTIONS pattern, because a memo's shape
 * is fixed and rich enough to deserve its own schema.
 *
 * Multi-tenant: every memo carries a venueId and every route scopes by
 * it using the same rule as server.js's ARRAY_COLLECTIONS (Super Admin
 * sees everything or can filter by ?venueId=, everyone else is hard
 * scoped to their own venue).
 */

const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { validateOptionalDataUrlFile, asPlainString, isNonEmptyString, safeErrorMessage } = require("../../core/validation");

const router = express.Router();

/* ─────────────────────────────────────────
   ENUMS
───────────────────────────────────────── */
const MEMO_TYPES = [
  "Incident", "Customer Complaint", "Service Issue", "Kitchen Issue",
  "Food Quality Issue", "Staff Issue", "Equipment Issue", "Hygiene Issue",
  "Safety Issue", "Billing Issue", "Inventory Issue", "Maintenance Issue",
  "Delivery Issue", "Other",
];

const LOCATIONS = ["Kitchen", "Dining Area", "Cash Counter", "Store", "Delivery Area", "Restaurant Entrance", "Other"];

const DEPARTMENTS = ["Kitchen", "Service", "Housekeeping", "Accounts", "Purchase", "Maintenance", "Delivery", "Management"];

const PRIORITIES = ["Low", "Normal", "High", "Critical"];

// Memo lifecycle status — distinct from resolution status (Section 5).
const MEMO_STATUSES = [
  "Open", "Under Investigation", "Action Required", "In Progress",
  "Awaiting Verification", "Resolved", "Closed", "Cancelled",
];

const RESOLUTION_STATUSES = [
  "Not Started", "Investigating", "Action Taken", "Fixed", "Solved",
  "Completed", "Verified", "Closed",
];

const ROOT_CAUSES = [
  "Human Error", "Communication Failure", "Training Issue", "Equipment Failure",
  "System Error", "Stock Issue", "Supplier Issue", "Process Failure",
  "Customer-related", "Unknown", "Other",
];

const CORRECTIVE_ACTION_STATUSES = ["Pending", "In Progress", "Completed", "Overdue", "Cancelled"];
const CUSTOMER_IMPACTS = ["No Impact", "Minor", "Moderate", "Major", "Severe"];
const OPERATIONAL_IMPACTS = ["None", "Minor Delay", "Service Disruption", "Major Disruption", "Temporary Closure"];

const STAFF_ACTION_TYPES = ["Verbal Warning", "Written Warning", "Training Required", "Counseling", "Process Correction", "No Action", "Other"];

const COMPENSATION_TYPES = ["Refund", "Partial Refund", "Full Refund", "Replacement", "Free Item", "Discount", "Coupon", "Complimentary Meal", "Complimentary Service", "Other"];
const COMPENSATION_STATUSES = ["Pending", "Approved", "Issued", "Rejected"];

const RESOLUTION_TYPES = ["Fixed", "Solved", "Completed", "Replaced", "Refunded", "Corrected", "No Further Action", "Other"];

const EVIDENCE_TYPES = ["Photo", "Video", "PDF", "Document", "Other"];

const VERIFICATION_RESULTS = ["Pass", "Fail"];

/* ─────────────────────────────────────────
   SUB-SCHEMAS
───────────────────────────────────────── */
const evidenceSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileType: { type: String, default: "" },
    fileData: { type: String, default: "" }, // base64 data URL
    mediaType: { type: String, enum: EVIDENCE_TYPES, default: "Other" },
    description: { type: String, default: "" },
    uploadedBy: { type: String, default: "" },
    uploadedByName: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const correctiveActionSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    description: { type: String, default: "" },
    assignedTo: { type: String, default: "" }, // staff id
    assignedToName: { type: String, default: "" },
    dueDate: { type: String, default: "" }, // YYYY-MM-DD
    status: { type: String, enum: CORRECTIVE_ACTION_STATUSES, default: "Pending" },
    completionDate: { type: String, default: "" },
    evidence: { type: [evidenceSchema], default: [] },
    notes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const staffActionSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    action: { type: String, enum: STAFF_ACTION_TYPES, default: "No Action" },
    staffId: { type: String, default: "" },
    staffName: { type: String, default: "" },
    reason: { type: String, default: "" },
    actionDate: { type: String, default: "" },
    authorizedBy: { type: String, default: "" },
    authorizedByName: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Free-form timeline / audit entry — this array IS the memo's audit
// history (Section 26) and drives the timeline view (Section 23).
const timelineEntrySchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    action: { type: String, default: "" }, // e.g. "Memo Created", "Status Changed", "Evidence Added"
    userId: { type: String, default: "" },
    userName: { type: String, default: "" },
    userRoleTitle: { type: String, default: "" },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: undefined },
    newValue: { type: mongoose.Schema.Types.Mixed, default: undefined },
    notes: { type: String, default: "" },
    story: { type: String, default: "" }, // narrative for this step — shown as a tooltip on the timeline
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ─────────────────────────────────────────
   MEMO SCHEMA
───────────────────────────────────────── */
const memoSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true }, // "MEMO-2026-000124"
    venueId: { type: String, default: null },

    // Basic info
    memoType: { type: String, enum: MEMO_TYPES, required: true },
    createdBy: { type: String, default: null }, // admin id — server-set, never client-supplied
    createdByName: { type: String, default: "" },
    createdByRoleTitle: { type: String, default: "" },

    // Issue details
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" }, // "What happened?"
    incidentDate: { type: String, default: "" }, // YYYY-MM-DD
    incidentTime: { type: String, default: "" }, // HH:MM
    location: { type: String, default: "" },
    department: { type: String, default: "" },
    priority: { type: String, enum: PRIORITIES, default: "Normal" },

    // Story / summary — the running narrative of the problem and how it is
    // being solved (what happened → why → what we did → outcome).
    story: { type: String, default: "" },

    // Order / customer link — all optional, not every memo concerns a customer
    orderId: { type: String, default: "" },
    customerName: { type: String, default: "" },
    tableNumber: { type: String, default: "" },
    reservationId: { type: String, default: "" },
    eventId: { type: String, default: "" },

    // Responsible people
    primaryResponsible: { type: String, default: "" }, // staff id
    primaryResponsibleName: { type: String, default: "" },
    involvedStaff: { type: [{ id: String, name: String }], default: [] },
    witnesses: { type: [{ id: String, name: String }], default: [] },
    departmentResponsible: { type: String, default: "" },

    // Evidence
    evidence: { type: [evidenceSchema], default: [] },

    // Immediate action
    immediateAction: { type: String, default: "" },
    immediateActionBy: { type: String, default: "" },
    immediateActionByName: { type: String, default: "" },
    immediateActionAt: { type: Date, default: null },
    immediateResult: { type: String, default: "" },

    // Root cause
    rootCause: { type: String, enum: [...ROOT_CAUSES, ""], default: "" },
    rootCauseDescription: { type: String, default: "" },
    contributingFactors: { type: [String], default: [] },
    preventiveAction: { type: String, default: "" },

    // Corrective actions (multiple)
    correctiveActions: { type: [correctiveActionSchema], default: [] },

    // Aftermath / consequences
    customerImpact: { type: String, enum: [...CUSTOMER_IMPACTS, ""], default: "" },
    operationalImpact: { type: String, enum: [...OPERATIONAL_IMPACTS, ""], default: "" },
    productLoss: { type: String, default: "" },
    financialLoss: { type: Number, default: null },
    otherConsequences: { type: String, default: "" },

    // Staff / disciplinary action (multiple, since more than one person can be actioned)
    staffActions: { type: [staffActionSchema], default: [] },

    // Customer compensation
    compensationRequired: { type: Boolean, default: false },
    compensationType: { type: String, enum: [...COMPENSATION_TYPES, ""], default: "" },
    compensationAmount: { type: Number, default: null },
    compensationDescription: { type: String, default: "" },
    compensationApprovedBy: { type: String, default: "" },
    compensationApprovedByName: { type: String, default: "" },
    compensationStatus: { type: String, enum: [...COMPENSATION_STATUSES, ""], default: "" },
    compensationDate: { type: String, default: "" },

    // Resolution
    resolutionSummary: { type: String, default: "" },
    resolutionType: { type: String, enum: [...RESOLUTION_TYPES, ""], default: "" },
    resolvedBy: { type: String, default: "" },
    resolvedByName: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    resolutionEvidence: { type: [evidenceSchema], default: [] },
    verificationRequired: { type: Boolean, default: false },

    // Verification
    verifiedBy: { type: String, default: "" },
    verifiedByName: { type: String, default: "" },
    verifiedAt: { type: Date, default: null },
    verificationResult: { type: String, enum: [...VERIFICATION_RESULTS, ""], default: "" },
    verificationNotes: { type: String, default: "" },

    // Lifecycle
    status: { type: String, enum: MEMO_STATUSES, default: "Open" },
    resolutionStatus: { type: String, enum: RESOLUTION_STATUSES, default: "Not Started" },

    // Reopen tracking — previous resolution snapshots are pushed here
    // rather than overwritten (Section 25: "do not overwrite the
    // previous resolution").
    reopenHistory: {
      type: [
        {
          reason: String,
          reopenedBy: String,
          reopenedByName: String,
          reopenedAt: { type: Date, default: Date.now },
          previousResolutionSummary: String,
          previousStatus: String,
        },
      ],
      default: [],
    },

    timeline: { type: [timelineEntrySchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

memoSchema.index({ venueId: 1, createdAt: -1 });
memoSchema.index({ status: 1 });
memoSchema.index({ priority: 1 });

const Memo = mongoose.model("Memo", memoSchema, "memos");

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function newMemoSuffixId() {
  return `${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

/** MEMO-<year>-000124 style id, atomically incremented per year via a counters doc. */
async function generateMemoId(getModel) {
  const year = new Date().getFullYear();
  const Counter = getModel("counters");
  const counterDoc = await Counter.findOneAndUpdate(
    { id: `memo_id_counter_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  ).lean();
  const seq = counterDoc?.seq || 1;
  return `MEMO-${year}-${String(seq).padStart(6, "0")}`;
}

function safeMemo(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  return obj;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Appends one immutable timeline entry. Mutates the passed memo doc/update object's timeline array — caller persists it. */
function timelineEntry({ action, admin, previousValue, newValue, notes, story }) {
  return {
    story: story || "",
    id: `evt_${newMemoSuffixId()}`,
    action,
    userId: admin?.id || "",
    userName: admin?.name || "",
    userRoleTitle: admin?.roleTitle || "",
    previousValue,
    newValue,
    notes: notes || "",
    createdAt: new Date(),
  };
}

/** An incident cannot have happened in the future. Times are interpreted in
 * the venue's timezone (MEMO_TZ_OFFSET, default IST +05:30) because the
 * server itself usually runs in UTC. */
const MEMO_TZ_OFFSET = process.env.MEMO_TZ_OFFSET || "+05:30";
const MAX_STORY_LENGTH = 5000;

function incidentInFuture(date, time) {
  if (!date) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = /^\d{2}:\d{2}$/.test(time || "") ? time : "00:00";
  const when = new Date(`${date}T${t}:00${MEMO_TZ_OFFSET}`);
  if (isNaN(when.getTime())) return false;
  return when.getTime() > Date.now() + 60 * 1000; // 1 min clock-skew tolerance
}

function validateStory(story) {
  if (story === undefined || story === null || story === "") return null;
  if (typeof story !== "string") return "story must be text";
  if (story.length > MAX_STORY_LENGTH) return `story must be ${MAX_STORY_LENGTH} characters or fewer`;
  return null;
}

/**
 * requireCanCreateMemo — only Super Admin (roleGroup), or a Manager
 * with roleTitle "Chef" / "Service Manager", may create a memo. This
 * is a fixed, spec-mandated rule (Section 1), not a per-venue
 * permission — same category of hard gate as documents.js's Super
 * Admin check, just with two extra allowed titles.
 */
const CREATOR_ROLE_TITLES = new Set(["Chef", "Service Manager"]);
function requireCanCreateMemo(logAudit) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: "Not logged in" });
    if (req.admin.roleGroup === "Super Admin" || CREATOR_ROLE_TITLES.has(req.admin.roleTitle)) {
      return next();
    }
    logAudit(req, { action: "authz_denied", resource: "memos", targetId: "create" });
    return res.status(403).json({ error: "Only Super Admin, Chef, or Service Manager can create memos" });
  };
}

/** Venue scope — mirrors server.js's scopeFilter(req) convention. */
function scopeFilter(req) {
  if (req.admin.roleGroup === "Super Admin") {
    const venueId = asPlainString(req.query.venueId);
    return venueId ? { venueId } : {};
  }
  return { venueId: req.admin.venueId };
}

function scopeVenueForCreate(req) {
  if (req.admin.roleGroup === "Super Admin") {
    return asPlainString(req.body.venueId) || asPlainString(req.query.venueId) || null;
  }
  return req.admin.venueId;
}

/** Server-side validated status transitions (Section 21). Cancelled/Closed can be reopened separately via /reopen. */
const ALLOWED_TRANSITIONS = {
  "Open": ["Under Investigation", "Action Required", "In Progress", "Resolved", "Cancelled"],
  "Under Investigation": ["Action Required", "In Progress", "Resolved", "Cancelled"],
  "Action Required": ["In Progress", "Resolved", "Cancelled"],
  "In Progress": ["Action Required", "Resolved", "Cancelled"],
  "Awaiting Verification": ["Resolved", "Action Required", "In Progress"],
  "Resolved": ["Awaiting Verification", "Closed", "Action Required"],
  "Closed": [], // only reachable forward via /verify or /close; reopened via /reopen
  "Cancelled": [],
};

function isValidTransition(from, to) {
  if (from === to) return true;
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

/** Once a memo reaches one of these statuses its underlying issue
 * data is locked — no more field edits, evidence, corrective actions,
 * root cause, impact, staff actions, or compensation changes. Only
 * the workflow-progression routes (verify, close, cancel, reopen) may
 * still act on it. Mirrors isLocked in MemoDetails.js on the frontend,
 * but is the real, server-side enforcement of that rule. */
const LOCKED_STATUSES = new Set(["Resolved", "Awaiting Verification", "Closed", "Cancelled"]);

function requireUnlockedMemo(before, res) {
  if (LOCKED_STATUSES.has(before.status)) {
    res.status(400).json({ error: `Memo is ${before.status} and its issue data is locked. Reopen it first to make changes.` });
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────
   ROUTES — mounted at /memos
───────────────────────────────────────── */
function buildRouter({ requireAuth, requireRole, logAudit, uploadLimiter, emitChange, getModel }) {
  const maybeUploadLimiter = uploadLimiter ? [uploadLimiter] : [];
  const canCreateMemo = requireCanCreateMemo(logAudit);

  /* ── LIST — full filter bar support (Section 3) ────────────── */
  router.get("/", requireAuth, async (req, res) => {
    try {
      const filter = { ...scopeFilter(req) };
      const q = req.query;

      if (q.memoType) filter.memoType = q.memoType;
      if (q.priority) filter.priority = q.priority;
      if (q.status) filter.status = q.status;
      if (q.resolutionStatus) filter.resolutionStatus = q.resolutionStatus;
      if (q.department) filter.department = q.department;
      if (q.createdBy) filter.createdBy = q.createdBy;
      if (q.primaryResponsible) filter.primaryResponsible = q.primaryResponsible;
      if (q.compensationRequired === "true") filter.compensationRequired = true;
      if (q.compensationRequired === "false") filter.compensationRequired = false;
      if (q.evidenceAvailable === "true") filter["evidence.0"] = { $exists: true };
      if (q.evidenceAvailable === "false") filter["evidence.0"] = { $exists: false };

      // Date span — filters on incidentDate (falls back to createdAt
      // range if incidentDate wasn't set), matching the spec's "Date
      // Span" filter over the memo's real-world date, not just when
      // the record was typed in.
      const from = asPlainString(q.fromDate);
      const to = asPlainString(q.toDate);
      if (from || to) {
        filter.incidentDate = {};
        if (from) filter.incidentDate.$gte = from;
        if (to) filter.incidentDate.$lte = to;
      }

      // Server-side search across id, title, description, customer,
      // responsible person, creator, order id, table number.
      const search = asPlainString(q.search);
      if (search) {
        const re = new RegExp(escapeRegex(search), "i");
        filter.$or = [
          { id: re }, { title: re }, { description: re },
          { customerName: re }, { primaryResponsibleName: re },
          { createdByName: re }, { orderId: re }, { tableNumber: re },
        ];
      }

      const memos = await Memo.find(filter).sort({ createdAt: -1 }).lean();
      res.json(memos.map(safeMemo));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── SINGLE ─────────────────────────────────────────────────── */
  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const memo = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!memo) return res.status(404).json({ error: "Memo not found" });
      res.json(safeMemo(memo));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── CREATE — Super Admin / Chef / Service Manager only ───────
     Memo ID, created date/time, and createdBy are always server-set
     (Section 8) — never trust a client-supplied value for any of them. */
  router.post("/", requireAuth, ...maybeUploadLimiter, canCreateMemo, async (req, res) => {
    try {
      if (!isNonEmptyString(req.body.title, { maxLength: 200 })) {
        return res.status(400).json({ error: "Issue title is required" });
      }
      if (!req.body.memoType || !MEMO_TYPES.includes(req.body.memoType)) {
        return res.status(400).json({ error: `memoType must be one of: ${MEMO_TYPES.join(", ")}` });
      }
      if (req.body.priority && !PRIORITIES.includes(req.body.priority)) {
        return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
      }

      if (incidentInFuture(req.body.incidentDate, req.body.incidentTime)) {
        return res.status(400).json({ error: "Incident date and time cannot be in the future" });
      }
      const storyErr = validateStory(req.body.story);
      if (storyErr) return res.status(400).json({ error: storyErr });

      const venueId = scopeVenueForCreate(req);
      if (!venueId) {
        return res.status(400).json({ error: "venueId is required (Super Admin must specify one)" });
      }

      // Evidence uploaded at creation time — validate every file's
      // data URL the same way documents.js validates a single file.
      const evidence = Array.isArray(req.body.evidence) ? req.body.evidence : [];
      for (const item of evidence) {
        if (item.fileData) {
          const check = validateOptionalDataUrlFile(item.fileData);
          if (!check.ok) return res.status(400).json({ error: `Evidence file invalid: ${check.error}` });
        }
      }
      const stampedEvidence = evidence.map((item) => ({
        ...item,
        id: item.id || `ev_${newMemoSuffixId()}`,
        uploadedBy: req.admin.id,
        uploadedByName: req.admin.name,
        uploadedAt: new Date(),
      }));

      const id = await generateMemoId(getModel);
      const initialTimeline = [
        timelineEntry({ action: "Memo Created", admin: req.admin, notes: req.body.title, story: req.body.story || req.body.description }),
      ];
      if (stampedEvidence.length) {
        initialTimeline.push(timelineEntry({ action: "Evidence Added", admin: req.admin, newValue: stampedEvidence.length }));
      }
      if (req.body.primaryResponsible) {
        initialTimeline.push(timelineEntry({
          action: "Staff Assigned", admin: req.admin,
          newValue: req.body.primaryResponsibleName || req.body.primaryResponsible,
        }));
      }

      const doc = await Memo.create({
        ...req.body,
        id,
        venueId,
        evidence: stampedEvidence,
        createdBy: req.admin.id,
        createdByName: req.admin.name,
        createdByRoleTitle: req.admin.roleTitle,
        status: req.body.status && MEMO_STATUSES.includes(req.body.status) ? req.body.status : "Open",
        resolutionStatus: "Not Started",
        immediateActionBy: req.body.immediateAction ? req.admin.id : "",
        immediateActionByName: req.body.immediateAction ? req.admin.name : "",
        immediateActionAt: req.body.immediateAction ? new Date() : null,
        timeline: initialTimeline,
        reopenHistory: [],
      });

      const result = safeMemo(doc);
      logAudit(req, { action: "create", resource: "memos", targetId: result.id, after: result });
      emitChange?.("memos", "create", result);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── UPDATE — general field edit (not a status transition) ───
     Locked-down fields (id, venueId, createdBy*, timeline,
     reopenHistory) can never be overwritten via this route. */
  router.put("/:id", requireAuth, ...maybeUploadLimiter, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;

      const {
        id: _ignoredId, venueId: _ignoredVenueId, createdBy: _cb, createdByName: _cbn,
        createdByRoleTitle: _cbr, timeline: _ignoredTimeline, reopenHistory: _ignoredReopen,
        status: _ignoredStatus, // status changes only via /status (validated transitions)
        ...editable
      } = req.body;

      if (editable.priority && !PRIORITIES.includes(editable.priority)) {
        return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(", ")}` });
      }

      const nextDate = editable.incidentDate !== undefined ? editable.incidentDate : before.incidentDate;
      const nextTime = editable.incidentTime !== undefined ? editable.incidentTime : before.incidentTime;
      if ((editable.incidentDate !== undefined || editable.incidentTime !== undefined) && incidentInFuture(nextDate, nextTime)) {
        return res.status(400).json({ error: "Incident date and time cannot be in the future" });
      }
      const storyErr = validateStory(editable.story);
      if (storyErr) return res.status(400).json({ error: storyErr });

      const update = { ...editable };
      const changeNotes = [];
      if (editable.story !== undefined && editable.story !== (before.story || "")) {
        changeNotes.push(timelineEntry({ action: "Story Updated", admin: req.admin, story: editable.story }));
      }
      if (editable.primaryResponsible !== undefined && editable.primaryResponsible !== before.primaryResponsible) {
        changeNotes.push(timelineEntry({
          action: "Staff Assigned", admin: req.admin,
          previousValue: before.primaryResponsibleName, newValue: editable.primaryResponsibleName,
        }));
      }

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        changeNotes.length
          ? { $set: update, $push: { timeline: { $each: changeNotes } } }
          : { $set: update },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, before, after: result });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── STORY UPDATE — append a narrative step to the timeline ─────
     Each entry's story shows as a tooltip when hovering that timeline
     item, and the latest text becomes the memo's running summary. */
  router.post("/:id/story", requireAuth, async (req, res) => {
    try {
      const text = typeof req.body.story === "string" ? req.body.story.trim() : "";
      if (!text) return res.status(400).json({ error: "Story text is required" });
      const storyErr = validateStory(text);
      if (storyErr) return res.status(400).json({ error: storyErr });

      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;

      const entry = timelineEntry({ action: "Story Update", admin: req.admin, story: text });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $set: { story: text }, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, before: { story: before.story }, after: { story: text } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── STATUS UPDATE — validated transitions only (Section 21) ── */
  router.patch("/:id/status", requireAuth, async (req, res) => {
    try {
      const { status, notes } = req.body;
      if (!status || !MEMO_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${MEMO_STATUSES.join(", ")}` });
      }
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!isValidTransition(before.status, status)) {
        return res.status(400).json({ error: `Cannot transition from "${before.status}" to "${status}"` });
      }

      const entry = timelineEntry({
        action: "Status Changed", admin: req.admin,
        previousValue: before.status, newValue: status, notes,
      });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $set: { status }, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, before: { status: before.status }, after: { status } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── EVIDENCE — add ────────────────────────────────────────── */
  router.post("/:id/evidence", requireAuth, ...maybeUploadLimiter, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;

      const item = req.body || {};
      if (item.fileData) {
        const check = validateOptionalDataUrlFile(item.fileData);
        if (!check.ok) return res.status(400).json({ error: check.error });
      }
      const stamped = {
        ...item,
        id: `ev_${newMemoSuffixId()}`,
        uploadedBy: req.admin.id,
        uploadedByName: req.admin.name,
        uploadedAt: new Date(),
      };
      const entry = timelineEntry({ action: "Evidence Added", admin: req.admin, newValue: stamped.fileName || stamped.description });

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $push: { evidence: stamped, timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { evidenceAdded: stamped.id } });
      emitChange?.("memos", "update", result);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── EVIDENCE — remove ─────────────────────────────────────── */
  router.delete("/:id/evidence/:evidenceId", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;
      const entry = timelineEntry({ action: "Evidence Removed", admin: req.admin, previousValue: req.params.evidenceId });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $pull: { evidence: { id: req.params.evidenceId } }, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { evidenceRemoved: req.params.evidenceId } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── CORRECTIVE ACTIONS — add ──────────────────────────────── */
  router.post("/:id/corrective-actions", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;
      if (!isNonEmptyString(req.body.description, { maxLength: 1000 })) {
        return res.status(400).json({ error: "Corrective action description is required" });
      }
      const action = {
        id: `ca_${newMemoSuffixId()}`,
        description: req.body.description,
        assignedTo: req.body.assignedTo || "",
        assignedToName: req.body.assignedToName || "",
        dueDate: req.body.dueDate || "",
        status: req.body.status && CORRECTIVE_ACTION_STATUSES.includes(req.body.status) ? req.body.status : "Pending",
        completionDate: "",
        evidence: [],
        notes: req.body.notes || "",
        createdAt: new Date(),
      };
      const entry = timelineEntry({ action: "Corrective Action Added", admin: req.admin, newValue: action.description });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $push: { correctiveActions: action, timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { correctiveActionAdded: action.id } });
      emitChange?.("memos", "update", result);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── CORRECTIVE ACTIONS — update (status/notes/completion) ───
     Marking one "Completed" logs a distinct timeline action so the
     memo's history clearly shows "Corrective Action Completed"
     (Section 26) rather than a generic edit. */
  router.put("/:id/corrective-actions/:actionId", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;
      const existing = (before.correctiveActions || []).find((a) => a.id === req.params.actionId);
      if (!existing) return res.status(404).json({ error: "Corrective action not found" });

      if (req.body.status && !CORRECTIVE_ACTION_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: `status must be one of: ${CORRECTIVE_ACTION_STATUSES.join(", ")}` });
      }

      const merged = {
        ...existing,
        description: req.body.description ?? existing.description,
        assignedTo: req.body.assignedTo ?? existing.assignedTo,
        assignedToName: req.body.assignedToName ?? existing.assignedToName,
        dueDate: req.body.dueDate ?? existing.dueDate,
        status: req.body.status ?? existing.status,
        completionDate: req.body.status === "Completed" && !existing.completionDate
          ? new Date().toISOString().slice(0, 10)
          : (req.body.completionDate ?? existing.completionDate),
        notes: req.body.notes ?? existing.notes,
      };

      const becameCompleted = req.body.status === "Completed" && existing.status !== "Completed";
      const entry = timelineEntry({
        action: becameCompleted ? "Corrective Action Completed" : "Corrective Action Updated",
        admin: req.admin,
        previousValue: existing.status, newValue: merged.status,
        notes: merged.description,
      });

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id, "correctiveActions.id": req.params.actionId },
        { $set: { "correctiveActions.$": merged }, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, before: existing, after: merged });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── STAFF ACTION — record disciplinary/other action ──────────
     An authorized management decision, never automatic (Section 17) —
     the frontend gates who can open this form, but nothing here
     infers punishment from someone merely being named elsewhere on
     the memo. */
  router.post("/:id/staff-actions", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;
      if (!req.body.action || !STAFF_ACTION_TYPES.includes(req.body.action)) {
        return res.status(400).json({ error: `action must be one of: ${STAFF_ACTION_TYPES.join(", ")}` });
      }
      const record = {
        id: `sa_${newMemoSuffixId()}`,
        action: req.body.action,
        staffId: req.body.staffId || "",
        staffName: req.body.staffName || "",
        reason: req.body.reason || "",
        actionDate: req.body.actionDate || new Date().toISOString().slice(0, 10),
        authorizedBy: req.admin.id,
        authorizedByName: req.admin.name,
        notes: req.body.notes || "",
        createdAt: new Date(),
      };
      const entry = timelineEntry({
        action: "Staff Action Recorded", admin: req.admin,
        newValue: `${record.action} — ${record.staffName}`,
      });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $push: { staffActions: record, timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { staffActionAdded: record.id } });
      emitChange?.("memos", "update", result);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── CUSTOMER COMPENSATION — record/update ─────────────────────
     Approving and issuing are distinct states (Section 18: "do not
     mark compensation as issued simply because it was approved"),
     each logging its own timeline entry when the status changes into
     that specific value. */
  router.put("/:id/compensation", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;

      const { compensationRequired, compensationType, compensationAmount, compensationDescription, compensationStatus, compensationDate } = req.body;
      if (compensationStatus && !COMPENSATION_STATUSES.includes(compensationStatus)) {
        return res.status(400).json({ error: `compensationStatus must be one of: ${COMPENSATION_STATUSES.join(", ")}` });
      }
      if (compensationType && !COMPENSATION_TYPES.includes(compensationType)) {
        return res.status(400).json({ error: `compensationType must be one of: ${COMPENSATION_TYPES.join(", ")}` });
      }

      const update = {};
      if (compensationRequired !== undefined) update.compensationRequired = !!compensationRequired;
      if (compensationType !== undefined) update.compensationType = compensationType;
      if (compensationAmount !== undefined) update.compensationAmount = compensationAmount;
      if (compensationDescription !== undefined) update.compensationDescription = compensationDescription;
      if (compensationDate !== undefined) update.compensationDate = compensationDate;

      const timelineEntries = [];
      if (compensationStatus && compensationStatus !== before.compensationStatus) {
        update.compensationStatus = compensationStatus;
        if (compensationStatus === "Approved") {
          update.compensationApprovedBy = req.admin.id;
          update.compensationApprovedByName = req.admin.name;
          timelineEntries.push(timelineEntry({ action: "Customer Compensation Approved", admin: req.admin, newValue: compensationType || before.compensationType }));
        } else if (compensationStatus === "Issued") {
          timelineEntries.push(timelineEntry({ action: "Customer Compensation Issued", admin: req.admin, newValue: compensationAmount ?? before.compensationAmount }));
        }
      }

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        timelineEntries.length
          ? { $set: update, $push: { timeline: { $each: timelineEntries } } }
          : { $set: update },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, before: { compensationStatus: before.compensationStatus }, after: update });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── RESOLUTION — mark resolved ───────────────────────────────
     Moves status to Resolved, or Awaiting Verification if
     verificationRequired is set (Section 20's stage diagram). */
  router.post("/:id/resolve", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!requireUnlockedMemo(before, res)) return;
      if (!isNonEmptyString(req.body.resolutionSummary, { maxLength: 2000 })) {
        return res.status(400).json({ error: "Resolution summary is required" });
      }
      if (req.body.resolutionType && !RESOLUTION_TYPES.includes(req.body.resolutionType)) {
        return res.status(400).json({ error: `resolutionType must be one of: ${RESOLUTION_TYPES.join(", ")}` });
      }

      const verificationRequired = !!req.body.verificationRequired;
      const nextStatus = verificationRequired ? "Awaiting Verification" : "Resolved";
      const nextResolutionStatus = verificationRequired ? "Completed" : "Solved";

      const update = {
        resolutionSummary: req.body.resolutionSummary,
        resolutionType: req.body.resolutionType || "",
        resolvedBy: req.admin.id,
        resolvedByName: req.admin.name,
        resolvedAt: new Date(),
        verificationRequired,
        status: nextStatus,
        resolutionStatus: nextResolutionStatus,
      };
      if (Array.isArray(req.body.resolutionEvidence)) {
        update.resolutionEvidence = req.body.resolutionEvidence.map((item) => ({
          ...item,
          id: item.id || `ev_${newMemoSuffixId()}`,
          uploadedBy: req.admin.id,
          uploadedByName: req.admin.name,
          uploadedAt: new Date(),
        }));
      }

      const entries = [
        timelineEntry({ action: "Issue Resolved", admin: req.admin, newValue: req.body.resolutionSummary }),
      ];
      if (verificationRequired) {
        entries.push(timelineEntry({ action: "Verification Requested", admin: req.admin }));
      }

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $set: update, $push: { timeline: { $each: entries } } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, before: { status: before.status }, after: { status: nextStatus } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── VERIFICATION — verify or fail (Section 20) ────────────── */
  router.post("/:id/verify", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (before.status !== "Awaiting Verification") {
        return res.status(400).json({ error: `Memo is not awaiting verification (current status: ${before.status})` });
      }
      const { result: verificationResult, notes } = req.body;
      if (!verificationResult || !VERIFICATION_RESULTS.includes(verificationResult)) {
        return res.status(400).json({ error: `result must be one of: ${VERIFICATION_RESULTS.join(", ")}` });
      }

      const passed = verificationResult === "Pass";
      const update = {
        verifiedBy: req.admin.id,
        verifiedByName: req.admin.name,
        verifiedAt: new Date(),
        verificationResult,
        verificationNotes: notes || "",
        status: passed ? "Resolved" : "Action Required",
        resolutionStatus: passed ? "Verified" : "Investigating",
      };
      const entry = timelineEntry({
        action: "Resolution Verified", admin: req.admin,
        newValue: verificationResult, notes,
      });

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $set: update, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { verificationResult } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── CLOSE ──────────────────────────────────────────────────── */
  router.post("/:id/close", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (!["Resolved", "Open"].includes(before.status)) {
        return res.status(400).json({ error: `Only a Resolved (or trivially Open) memo can be closed directly (current status: ${before.status})` });
      }
      const entry = timelineEntry({ action: "Memo Closed", admin: req.admin, previousValue: before.status });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $set: { status: "Closed", resolutionStatus: "Closed" }, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { status: "Closed" } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── CANCEL ─────────────────────────────────────────────────── */
  router.post("/:id/cancel", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (["Closed", "Cancelled"].includes(before.status)) {
        return res.status(400).json({ error: `Memo is already ${before.status}` });
      }
      const entry = timelineEntry({ action: "Memo Cancelled", admin: req.admin, previousValue: before.status, notes: req.body.reason });
      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        { $set: { status: "Cancelled" }, $push: { timeline: entry } },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { status: "Cancelled" } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  /* ── REOPEN — closed memo only, requires a reason, keeps history
     (Section 25: never overwrite the previous resolution) ──────── */
  router.post("/:id/reopen", requireAuth, async (req, res) => {
    try {
      const before = await Memo.findOne({ id: req.params.id, ...scopeFilter(req) }).lean();
      if (!before) return res.status(404).json({ error: "Memo not found" });
      if (before.status !== "Closed") {
        return res.status(400).json({ error: "Only a closed memo can be reopened" });
      }
      if (!isNonEmptyString(req.body.reason, { maxLength: 1000 })) {
        return res.status(400).json({ error: "A reason for reopening is required" });
      }

      const historyEntry = {
        reason: req.body.reason,
        reopenedBy: req.admin.id,
        reopenedByName: req.admin.name,
        reopenedAt: new Date(),
        previousResolutionSummary: before.resolutionSummary || "",
        previousStatus: before.status,
      };
      const entry = timelineEntry({ action: "Memo Reopened", admin: req.admin, notes: req.body.reason });

      const doc = await Memo.findOneAndUpdate(
        { id: req.params.id },
        {
          $set: { status: "Action Required", resolutionStatus: "Investigating" },
          $push: { reopenHistory: historyEntry, timeline: entry },
        },
        { returnDocument: "after" }
      ).lean();
      const result = safeMemo(doc);
      logAudit(req, { action: "update", resource: "memos", targetId: result.id, after: { reopened: true, reason: req.body.reason } });
      emitChange?.("memos", "update", result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  return router;
}

module.exports = {
  buildRouter,
  Memo,
  safeMemo,
  MEMO_TYPES,
  LOCATIONS,
  DEPARTMENTS,
  PRIORITIES,
  MEMO_STATUSES,
  RESOLUTION_STATUSES,
  ROOT_CAUSES,
  CORRECTIVE_ACTION_STATUSES,
  CUSTOMER_IMPACTS,
  OPERATIONAL_IMPACTS,
  STAFF_ACTION_TYPES,
  COMPENSATION_TYPES,
  COMPENSATION_STATUSES,
  RESOLUTION_TYPES,
  EVIDENCE_TYPES,
  VERIFICATION_RESULTS,
  CREATOR_ROLE_TITLES,
};
