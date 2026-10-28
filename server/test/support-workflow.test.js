// Pure unit tests for the ticket workflow engine (no database needed).
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluate, availableActions, WorkflowError } = require("../src/modules/support/workflow");
const C = require("../src/modules/support/constants");

const perms = (...p) => new Set(p);
const staff = (id, ...p) => ({ kind: "staff", id, name: id, perms: perms(...p) });
const SUPER = { kind: "platformAdmin", id: "sa", name: "Admin", perms: "*" };
const reporter = (over = {}) => ({ kind: "reporter", id: "r1", name: "Rita", restaurantId: "rest1", canWrite: true, perms: new Set(), ...over });
const T = (over = {}) => ({ ticketId: "TKT-1", restaurantId: "rest1", status: "new", developerId: "dev", testerId: "qa", ...over });
const run = (ticket, action, actor, input = {}, now = new Date("2026-01-01T00:00:00Z")) => evaluate({ ticket, action, actor, input, now });
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof WorkflowError, e.stack); return e.code; } assert.fail("expected error"); };

test("transitions are limited to the defined graph", () => {
  assert.equal(code(() => run(T({ status: "new" }), "submit_for_qa", staff("dev", "tickets.submitForQA"))), "INVALID_TRANSITION");
  assert.equal(code(() => run(T({ status: "triaged" }), "resolve", SUPER, { verificationNote: "ok ok", resolutionSummary: "fixed ok" })), "INVALID_TRANSITION");
});

test("triage needs priority and severity and the prioritize permission", () => {
  assert.equal(code(() => run(T(), "triage", SUPER, { priority: "high" })), "VALIDATION");
  assert.equal(code(() => run(T(), "triage", staff("x", "tickets.view"), { priority: "high", severity: "major" })), "FORBIDDEN");
  const r = run(T(), "triage", SUPER, { priority: "high", severity: "major" });
  assert.equal(r.to, "triaged");
});

test("assign needs a future deadline and different developer / tester", () => {
  const t = T({ status: "triaged", developerId: null });
  assert.equal(code(() => run(t, "assign", SUPER, { developerId: "d", deadline: "2025-01-01" })), "VALIDATION");
  assert.equal(code(() => run(t, "assign", SUPER, { developerId: "d", testerId: "d", deadline: "2027-01-01" })), "VALIDATION");
  const r = run(t, "assign", SUPER, { developerId: "d", developerName: "D", deadline: "2027-01-01" });
  assert.equal(r.to, "assigned");
  assert.ok(r.patch.$pushDeadline);
});

test("only the assigned developer can acknowledge / start / submit; developers cannot skip QA", () => {
  const dev = staff("dev", "tickets.updateProgress", "tickets.submitForQA");
  const other = staff("other", "tickets.updateProgress", "tickets.submitForQA");
  assert.equal(code(() => run(T({ status: "assigned" }), "start", other)), "FORBIDDEN");
  assert.equal(run(T({ status: "assigned" }), "start", dev).to, "in_progress");
  // no QA / review / release actions for a developer role
  for (const a of ["qa_start", "qa_pass", "fix_approve", "release_approve", "record_deployment", "resolve", "close"]) {
    const from = { qa_start: "ready_for_qa", qa_pass: "qa_in_progress", fix_approve: "awaiting_release_approval", release_approve: "awaiting_release_approval", record_deployment: "approved_for_release", resolve: "released", close: "resolved" }[a];
    assert.equal(code(() => run(T({ status: from }), a, dev, { summary: "all good", verificationNote: "okay ok", resolutionSummary: "okay ok" })), "FORBIDDEN", a);
  }
});

test("submit for QA requires root cause, fix summary and test evidence", () => {
  const dev = staff("dev", "tickets.submitForQA");
  const t = T({ status: "in_progress" });
  assert.equal(code(() => run(t, "submit_for_qa", dev, { rootCause: "x" })), "VALIDATION");
  const r = run(t, "submit_for_qa", dev, { rootCause: "null deref", fixSummary: "guard", testEvidence: "unit test added" });
  assert.equal(r.to, "ready_for_qa");
});

test("QA: developer cannot test own work; failure needs reason and evidence; pass moves to release approval", () => {
  const qa = staff("qa", "qa.record");
  assert.equal(code(() => run(T({ status: "ready_for_qa", developerId: "qa", testerId: null }), "qa_start", qa)), "FORBIDDEN");
  const started = run(T({ status: "ready_for_qa" }), "qa_start", qa);
  assert.equal(started.to, "qa_in_progress");
  const t = T({ status: "qa_in_progress" });
  assert.equal(code(() => run(t, "qa_fail", qa, { summary: "still broken" })), "VALIDATION");
  assert.equal(run(t, "qa_fail", qa, { summary: "still broken", evidence: "screenshot" }).to, "qa_failed");
  const pass = run(t, "qa_pass", qa, { summary: "verified fix" });
  assert.equal(pass.to, "qa_passed");
  assert.equal(pass.then, "awaiting_release_approval");
  assert.equal(code(() => run(t, "qa_pass", staff("wrong", "qa.record"), { summary: "verified fix" })), "FORBIDDEN"); // not the assigned tester
});

test("review, release approval, push and deployment are four separate, ordered steps", () => {
  const reviewer = staff("rev", "fix.review");
  const approver = staff("rel", "release.approve");
  const ops = staff("ops", "deploy.record");
  const t0 = T({ status: "awaiting_release_approval" });
  // release approval is impossible before code review
  assert.equal(code(() => run(t0, "release_approve", approver)), "INVALID_TRANSITION");
  // a reviewer cannot approve the release, an approver cannot do code review
  assert.equal(code(() => run(t0, "release_approve", reviewer)), "FORBIDDEN");
  assert.equal(code(() => run(t0, "fix_approve", approver)), "FORBIDDEN");
  const reviewed = run(t0, "fix_approve", reviewer);
  const t1 = T({ status: "awaiting_release_approval", ...reviewed.patch });
  const approved = run(t1, "release_approve", approver);
  assert.equal(approved.to, "approved_for_release");
  const t2 = T({ status: "approved_for_release", ...approved.patch });
  // deployment cannot be recorded before the push
  assert.equal(code(() => run(t2, "record_deployment", ops, { releaseId: "r1", environment: "production", result: "success" })), "INVALID_TRANSITION");
  const pushed = run(t2, "record_push", ops, { branch: "fix/x", commitRef: "abc123" });
  assert.equal(pushed.to, "approved_for_release", "pushing code does not mean released");
  const t3 = T({ status: "approved_for_release", ...approved.patch, ...pushed.patch });
  const failed = run(t3, "record_deployment", ops, { releaseId: "r1", environment: "production", result: "failed" });
  assert.equal(failed.to, "approved_for_release", "a failed deployment is not a release");
  const ok = run(t3, "record_deployment", ops, { releaseId: "r1", environment: "production", result: "success" });
  assert.equal(ok.to, "released");
});

test("the same person cannot review and then approve the release (unless Super Admin)", () => {
  const both = staff("same", "fix.review", "release.approve");
  const t = T({ status: "awaiting_release_approval", review: { approved: true, byId: "same" } });
  assert.equal(code(() => run(t, "release_approve", both)), "FORBIDDEN");
  assert.equal(run(t, "release_approve", SUPER).to, "approved_for_release");
});

test("resolution requires release + verification; closure requires confirmation or verification", () => {
  const pm = staff("pm", "tickets.resolve", "tickets.close");
  assert.equal(code(() => run(T({ status: "released" }), "resolve", pm, {})), "VALIDATION");
  const r = run(T({ status: "released" }), "resolve", pm, { verificationNote: "checked prod", resolutionSummary: "Fixed the crash" });
  assert.equal(r.to, "resolved");
  assert.equal(code(() => run(T({ status: "resolved", resolvedAt: new Date() }), "close", pm)), "INVALID_TRANSITION");
  assert.equal(run(T({ status: "resolved", resolvedAt: new Date(), verificationNote: "ok" }), "close", pm).to, "closed");
});

test("reporter actions are limited to their own restaurant and need write permission", () => {
  const t = T({ status: "awaiting_reporter_confirmation" });
  assert.equal(run(t, "reporter_confirm", reporter()).to, "resolved");
  assert.equal(code(() => run(t, "reporter_confirm", reporter({ restaurantId: "other" }))), "FORBIDDEN");
  assert.equal(code(() => run(t, "reporter_confirm", reporter({ canWrite: false }))), "FORBIDDEN");
  assert.equal(code(() => run(t, "reporter_confirm", staff("dev", "tickets.resolve"))), "FORBIDDEN");
  assert.equal(code(() => run(T({ status: "in_progress" }), "reporter_reopen", reporter(), { reason: "again" })), "INVALID_TRANSITION");
});

test("clarification round-trip resumes the previous status", () => {
  const dev = staff("dev", "tickets.requestClarification");
  const asked = run(T({ status: "in_progress" }), "request_clarification", dev, { message: "Which branch?" });
  assert.equal(asked.to, "awaiting_reporter_response");
  assert.equal(asked.patch.resumeStatus, "in_progress");
  const back = run(T({ status: "awaiting_reporter_response", resumeStatus: "in_progress" }), "reporter_respond", reporter(), { message: "Main branch" });
  assert.equal(back.to, "in_progress");
});

test("reopen resets approvals; reporters are limited by the reopen window", () => {
  const closedLongAgo = T({ status: "closed", closedAt: new Date("2025-01-01") });
  assert.equal(code(() => run(closedLongAgo, "reporter_reopen", reporter(), { reason: "back again" })), "INVALID_TRANSITION");
  const r = run(T({ status: "resolved", resolvedAt: new Date("2025-12-30"), review: { approved: true } }), "reporter_reopen", reporter(), { reason: "back again" });
  assert.equal(r.to, "reopened");
  assert.equal(r.patch.review, null);
  assert.equal(r.patch.reopenCount, 1);
});

test("a passed deadline never completes a ticket (overdue is only informational)", () => {
  const t = T({ status: "in_progress", deadline: new Date("2020-01-01") });
  assert.deepEqual(availableActions({ ticket: t, actor: staff("dev", "tickets.updateProgress", "tickets.submitForQA"), config: {} }).sort(), ["block", "progress", "submit_for_qa"].sort());
  assert.ok(!Object.keys(require("../src/modules/support/workflow").ACTIONS).includes("auto_complete"));
});

test("every status is reachable and labelled", () => {
  for (const s of C.ALL_STATUSES) assert.ok(C.STATUS_LABEL[s] && C.PUBLIC_STATUS[s], s);
});
