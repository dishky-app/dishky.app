/**
 * support/constants.js — shared vocabulary for the Developer Support & Ticket
 * Management system. Every app (Restaurant Admin, Super Admin, Developer Panel)
 * receives these values from GET .../meta so the status / category / priority
 * names can never drift between panels.
 */

const STATUS = Object.freeze({
  NEW: "new",
  TRIAGED: "triaged",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  AWAITING_REPORTER: "awaiting_reporter_response",
  BLOCKED: "blocked",
  READY_FOR_QA: "ready_for_qa",
  QA_IN_PROGRESS: "qa_in_progress",
  QA_PASSED: "qa_passed",
  QA_FAILED: "qa_failed",
  CHANGES_REQUESTED: "changes_requested",
  AWAITING_RELEASE: "awaiting_release_approval",
  APPROVED_FOR_RELEASE: "approved_for_release",
  RELEASE_REJECTED: "release_rejected",
  RELEASED: "released",
  AWAITING_CONFIRMATION: "awaiting_reporter_confirmation",
  RESOLVED: "resolved",
  CLOSED: "closed",
  REOPENED: "reopened",
});

const STATUS_LABEL = Object.freeze({
  new: "New",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In Progress",
  awaiting_reporter_response: "Awaiting Reporter Response",
  blocked: "Blocked",
  ready_for_qa: "Ready for QA",
  qa_in_progress: "QA In Progress",
  qa_passed: "QA Passed",
  qa_failed: "QA Failed",
  changes_requested: "Changes Requested",
  awaiting_release_approval: "Awaiting Release Approval",
  approved_for_release: "Approved for Release",
  release_rejected: "Release Rejected",
  released: "Released",
  awaiting_reporter_confirmation: "Awaiting Reporter Confirmation",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
});

const ALL_STATUSES = Object.keys(STATUS_LABEL);

// Statuses in which the developer owns the next move.
const DEV_ACTIVE = ["assigned", "in_progress", "blocked", "qa_failed", "changes_requested", "release_rejected"];
// Statuses in which a deadline can be "overdue" (work not yet delivered to QA/release).
const DEADLINE_ACTIVE = ["assigned", "in_progress", "blocked", "qa_failed", "changes_requested", "release_rejected", "awaiting_reporter_response"];
const DONE = ["resolved", "closed"];
const OPEN = ALL_STATUSES.filter((s) => !DONE.includes(s));

/** What a restaurant user sees. Internal QA / release machinery stays hidden. */
const PUBLIC_STATUS = Object.freeze({
  new: { key: "received", label: "Received" },
  triaged: { key: "under_review", label: "Under review" },
  assigned: { key: "in_progress", label: "In progress" },
  in_progress: { key: "in_progress", label: "In progress" },
  blocked: { key: "in_progress", label: "In progress" },
  awaiting_reporter_response: { key: "awaiting_you", label: "Waiting for your response" },
  ready_for_qa: { key: "testing", label: "Testing the fix" },
  qa_in_progress: { key: "testing", label: "Testing the fix" },
  qa_passed: { key: "testing", label: "Testing the fix" },
  qa_failed: { key: "in_progress", label: "In progress" },
  changes_requested: { key: "in_progress", label: "In progress" },
  awaiting_release_approval: { key: "preparing_release", label: "Preparing release" },
  approved_for_release: { key: "preparing_release", label: "Preparing release" },
  release_rejected: { key: "in_progress", label: "In progress" },
  released: { key: "verifying", label: "Fix released – verifying" },
  awaiting_reporter_confirmation: { key: "awaiting_you", label: "Please confirm the fix" },
  resolved: { key: "resolved", label: "Resolved" },
  closed: { key: "closed", label: "Closed" },
  reopened: { key: "reopened", label: "Reopened" },
});

const CATEGORIES = [
  { value: "bug", label: "Bug / defect" },
  { value: "error", label: "Application error" },
  { value: "query", label: "Technical query" },
  { value: "payment", label: "Payment issue" },
  { value: "performance", label: "Performance issue" },
  { value: "access", label: "Access / permission problem" },
  { value: "data", label: "Data issue" },
  { value: "integration", label: "Integration problem" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other support request" },
];

const PRIORITIES = ["critical", "high", "medium", "low"];
const SEVERITIES = ["critical", "major", "minor", "trivial"];

/** Modules offered in "Affected module" besides the permission-matrix modules. */
const EXTRA_MODULES = [
  "Login & Authentication",
  "Dashboard & Reports",
  "Customer Ordering App (QR)",
  "Subscription & Billing",
  "Printing / Print Bridge",
  "Notifications",
  "Other / Not sure",
];

const ENVIRONMENTS = ["staging", "production", "other"];
const DEPLOY_RESULTS = ["success", "failed", "rolled_back"];

/* ─────────────────────────────────────────
   PERMISSIONS — group "Developer Support & Ticket Management".
   Used by the platform (Dishky staff) roles. Restaurant users are governed by
   the restaurant Permissions matrix instead (module "supportTickets").
───────────────────────────────────────── */
const PERMISSION_GROUP = "Developer Support & Ticket Management";

const PERMISSIONS = [
  { key: "tickets.view", label: "View tickets", group: "Tickets" },
  { key: "tickets.create", label: "Create tickets (on behalf of a restaurant)", group: "Tickets" },
  { key: "tickets.viewAssigned", label: "View assigned tickets", group: "Tickets" },
  { key: "tickets.viewRestaurant", label: "View restaurant-specific tickets (restaurants in the staff member's scope)", group: "Tickets" },
  { key: "tickets.assign", label: "Assign and reassign developers / testers", group: "Triage" },
  { key: "tickets.prioritize", label: "Set priority, severity and deadlines", group: "Triage" },
  { key: "tickets.updateProgress", label: "Update progress", group: "Development" },
  { key: "comments.public", label: "Add public comments", group: "Communication" },
  { key: "comments.internal", label: "Add internal notes", group: "Communication" },
  { key: "tickets.requestClarification", label: "Request clarification", group: "Communication" },
  { key: "tickets.submitForQA", label: "Submit fixes for QA", group: "Development" },
  { key: "qa.record", label: "Record test results", group: "Quality & Release" },
  { key: "fix.review", label: "Approve or reject fixes", group: "Quality & Release" },
  { key: "release.approve", label: "Approve releases", group: "Quality & Release" },
  { key: "deploy.record", label: "Record push & deployment results", group: "Quality & Release" },
  { key: "tickets.resolve", label: "Resolve tickets", group: "Closure" },
  { key: "tickets.close", label: "Close tickets", group: "Closure" },
  { key: "tickets.reopen", label: "Reopen tickets", group: "Closure" },
  { key: "staff.view", label: "View Dishky staff", group: "Dishky Staff" },
  { key: "staff.manage", label: "Manage Dishky staff", group: "Dishky Staff" },
  { key: "staff.create", label: "Create staff accounts", group: "Dishky Staff" },
  { key: "staff.update", label: "Update staff details", group: "Dishky Staff" },
  { key: "staff.deactivate", label: "Activate and deactivate staff", group: "Dishky Staff" },
  { key: "staff.roles", label: "Manage staff roles and permissions", group: "Dishky Staff" },
];
const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** Roles of Dishky's internal team. "Super Admin" = a platform admin (see platform/superadmin.js). */
const STAFF_ROLES = [
  "Developer",
  "Senior Developer",
  "Tester / QA Engineer",
  "QA Lead",
  "Support Engineer",
  "DevOps / Release Manager",
  "Project Manager",
];

const COMMON = ["tickets.viewAssigned", "comments.public", "comments.internal", "tickets.requestClarification"];
const ROLE_DEFAULTS = {
  "Developer": [...COMMON, "tickets.updateProgress", "tickets.submitForQA"],
  "Senior Developer": [...COMMON, "tickets.view", "tickets.updateProgress", "tickets.submitForQA", "fix.review"],
  "Tester / QA Engineer": [...COMMON, "qa.record"],
  "QA Lead": [...COMMON, "tickets.view", "qa.record", "tickets.assign"],
  "Support Engineer": [...COMMON, "tickets.view", "tickets.create", "tickets.prioritize", "tickets.resolve", "tickets.reopen"],
  "DevOps / Release Manager": [...COMMON, "tickets.view", "fix.review", "release.approve", "deploy.record"],
  "Project Manager": [
    ...COMMON, "tickets.view", "tickets.assign", "tickets.prioritize", "tickets.resolve", "tickets.close",
    "tickets.reopen", "staff.view",
  ],
};

const DEFAULT_SLA_HOURS = { critical: 8, high: 24, medium: 72, low: 168 };

const MAX_ATTACHMENTS_PER_REQUEST = 3;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

module.exports = {
  STATUS, STATUS_LABEL, ALL_STATUSES, DEV_ACTIVE, DEADLINE_ACTIVE, DONE, OPEN, PUBLIC_STATUS,
  CATEGORIES, PRIORITIES, SEVERITIES, EXTRA_MODULES, ENVIRONMENTS, DEPLOY_RESULTS,
  PERMISSION_GROUP, PERMISSIONS, PERMISSION_KEYS, STAFF_ROLES, ROLE_DEFAULTS, DEFAULT_SLA_HOURS,
  MAX_ATTACHMENTS_PER_REQUEST, MAX_ATTACHMENT_BYTES,
};
