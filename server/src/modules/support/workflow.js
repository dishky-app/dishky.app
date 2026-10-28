/**
 * support/workflow.js — the ONE place that decides whether a ticket may move.
 *
 * evaluate() is pure: it takes the ticket as it is stored, the action, the
 * (server-verified) actor and the request input, and either throws a
 * WorkflowError or returns { to, patch, publicNote }. It never reads the
 * database and never trusts anything the client says about who they are —
 * the service layer builds `actor` from the session before calling it.
 *
 * Actor shape:
 *   { kind: "platformAdmin" | "staff" | "reporter", id, name,
 *     perms: "*" | Set<string>,           // platform actors
 *     restaurantId, canWrite }            // reporter actors
 *
 * Separation of duties (the spec's "do not treat review, release approval,
 * push and deployment as the same action") is encoded below as four different
 * actions with four different permissions and their own required evidence:
 *   fix_approve / fix_reject  -> permission fix.review
 *   release_approve / reject  -> permission release.approve (needs fix review first)
 *   record_push               -> permission deploy.record (needs release approval)
 *   record_deployment         -> permission deploy.record (needs a recorded push);
 *                                only a "success" result moves the ticket to Released.
 * A developer can never QA, review or approve their own ticket.
 */
const S = require("./constants").STATUS;
const C = require("./constants");

class WorkflowError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bad = (m) => new WorkflowError(400, "VALIDATION", m);
const forbidden = (m) => new WorkflowError(403, "FORBIDDEN", m || "You are not allowed to perform this action.");
const conflict = (m) => new WorkflowError(409, "INVALID_TRANSITION", m);

const str = (v, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const has = (actor, perm) => !!actor && (actor.perms === "*" || (actor.perms && actor.perms.has(perm)));
const isStaffLike = (actor) => actor && (actor.kind === "staff" || actor.kind === "platformAdmin");
const isSuper = (actor) => actor && actor.perms === "*";

function need(actor, perm) {
  if (!isStaffLike(actor) || !has(actor, perm)) throw forbidden(`Missing permission: ${perm}`);
}

function needAssignee(ticket, actor, role = "developerId") {
  if (isSuper(actor)) return;
  if (!actor || actor.kind !== "staff" || actor.id !== ticket[role]) {
    throw forbidden("Only the assigned team member can do this.");
  }
}

function notOwnWork(ticket, actor, what) {
  if (actor.kind === "staff" && ticket.developerId && actor.id === ticket.developerId) {
    throw forbidden(`The developer who worked on a ticket cannot ${what} it.`);
  }
}

function reporterOnly(ticket, actor) {
  if (!actor || actor.kind !== "reporter") throw forbidden("Only the restaurant that reported this ticket can do this.");
  if (actor.restaurantId !== ticket.restaurantId) throw forbidden("This ticket belongs to a different restaurant.");
  if (!actor.canWrite) throw forbidden("You do not have permission to respond to tickets.");
}

function reason(input, field = "reason", min = 3) {
  const v = str(input[field], 4000);
  if (v.length < min) throw bad(`${field === "reason" ? "A reason" : field} is required.`);
  return v;
}

/* Fields a developer can record while working; merged before submit-for-QA checks. */
const WORK_FIELDS = ["investigationNotes", "rootCause", "fixSummary", "testEvidence", "branch", "commitRef"];
function workPatch(input) {
  const out = {};
  for (const f of WORK_FIELDS) if (input[f] !== undefined) out[f] = str(input[f], f === "branch" || f === "commitRef" ? 300 : 8000);
  return out;
}

const ACTIONS = {
  /* ── Stage 2: triage & assignment ── */
  triage: {
    from: [S.NEW, S.REOPENED],
    run({ ticket, actor, input }) {
      need(actor, "tickets.prioritize");
      const priority = str(input.priority, 20), severity = str(input.severity, 20);
      if (!C.PRIORITIES.includes(priority)) throw bad("A valid priority is required.");
      if (!C.SEVERITIES.includes(severity)) throw bad("A valid severity is required.");
      return { to: S.TRIAGED, patch: { priority, severity, triagedAt: new Date(), triagedBy: actor.name }, publicNote: "We reviewed your ticket and set its priority." };
    },
  },
  assign: {
    from: [S.TRIAGED, S.REOPENED, S.ASSIGNED, S.IN_PROGRESS, S.BLOCKED, S.QA_FAILED, S.CHANGES_REQUESTED, S.RELEASE_REJECTED, S.READY_FOR_QA, S.QA_IN_PROGRESS, S.AWAITING_RELEASE],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.assign");
      const developerId = str(input.developerId, 100);
      if (!developerId) throw bad("A developer is required.");
      const testerId = str(input.testerId, 100) || null;
      const reviewerId = str(input.reviewerId, 100) || null;
      if (testerId && testerId === developerId) throw bad("The tester must be a different person from the developer.");
      if (reviewerId && reviewerId === developerId) throw bad("The reviewer must be a different person from the developer.");
      const deadline = new Date(input.deadline);
      if (!input.deadline || Number.isNaN(deadline.getTime())) throw bad("A valid deadline is required.");
      if (deadline.getTime() <= now.getTime()) throw bad("The deadline must be in the future.");
      const lateStage = [S.READY_FOR_QA, S.QA_IN_PROGRESS, S.AWAITING_RELEASE].includes(ticket.status);
      if (lateStage && developerId !== ticket.developerId) {
        throw conflict("The fix is already with QA / review; only the tester or reviewer can be changed now.");
      }
      const devChanged = developerId !== ticket.developerId;
      const patch = {
        developerId, developerName: str(input.developerName, 200), testerId, testerName: testerId ? str(input.testerName, 200) : "",
        reviewerId, reviewerName: reviewerId ? str(input.reviewerName, 200) : "", deadline,
      };
      if (devChanged || !ticket.assignedAt) { patch.assignedAt = now; patch.acknowledgedAt = null; }
      if (!ticket.deadline || new Date(ticket.deadline).getTime() !== deadline.getTime()) {
        patch.$pushDeadline = { from: ticket.deadline || null, to: deadline, by: actor.name, reason: str(input.reason, 500), at: now };
        patch.deadlineWarnedAt = null; patch.overdueNotifiedAt = null;
      }
      const to = [S.TRIAGED, S.REOPENED].includes(ticket.status) ? S.ASSIGNED : ticket.status;
      return { to, patch, publicNote: to !== ticket.status ? "Your ticket was assigned to our technical team." : null };
    },
  },
  set_priority: {
    from: C.OPEN,
    run({ ticket, actor, input }) {
      need(actor, "tickets.prioritize");
      const patch = {};
      if (input.priority !== undefined) {
        if (!C.PRIORITIES.includes(input.priority)) throw bad("Invalid priority.");
        patch.priority = input.priority;
      }
      if (input.severity !== undefined) {
        if (!C.SEVERITIES.includes(input.severity)) throw bad("Invalid severity.");
        patch.severity = input.severity;
      }
      if (!Object.keys(patch).length) throw bad("Nothing to change.");
      return { to: ticket.status, patch, publicNote: null };
    },
  },
  set_deadline: {
    from: C.OPEN,
    run({ ticket, actor, input, now }) {
      if (!has(actor, "tickets.prioritize") && !has(actor, "tickets.assign")) throw forbidden("Missing permission: tickets.prioritize");
      if (!ticket.developerId) throw conflict("Assign a developer before setting a deadline.");
      const deadline = new Date(input.deadline);
      if (!input.deadline || Number.isNaN(deadline.getTime())) throw bad("A valid deadline is required.");
      if (deadline.getTime() <= now.getTime()) throw bad("The deadline must be in the future.");
      return {
        to: ticket.status,
        patch: {
          deadline, deadlineWarnedAt: null, overdueNotifiedAt: null,
          $pushDeadline: { from: ticket.deadline || null, to: deadline, by: actor.name, reason: str(input.reason, 500), at: now },
        },
        publicNote: null,
      };
    },
  },

  /* ── Stage 3: development ── */
  acknowledge: {
    from: [S.ASSIGNED],
    run({ ticket, actor, now }) {
      need(actor, "tickets.updateProgress");
      needAssignee(ticket, actor);
      if (ticket.acknowledgedAt) throw conflict("Already acknowledged.");
      return { to: S.ASSIGNED, patch: { acknowledgedAt: now }, publicNote: null };
    },
  },
  start: {
    from: [S.ASSIGNED, S.QA_FAILED, S.CHANGES_REQUESTED, S.RELEASE_REJECTED],
    run({ ticket, actor, now }) {
      need(actor, "tickets.updateProgress");
      needAssignee(ticket, actor);
      const patch = { lastProgressAt: now, blockerReason: "" };
      if (!ticket.startedAt) patch.startedAt = now;
      if (ticket.status === S.QA_FAILED || ticket.status === S.CHANGES_REQUESTED || ticket.status === S.RELEASE_REJECTED) {
        patch.review = null; patch.progressPct = Math.min(ticket.progressPct || 0, 90);
      }
      return { to: S.IN_PROGRESS, patch, publicNote: ticket.status === S.ASSIGNED ? "Our team started working on your ticket." : null };
    },
  },
  progress: {
    from: [S.IN_PROGRESS],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.updateProgress");
      needAssignee(ticket, actor);
      const patch = workPatch(input);
      if (input.progressPct !== undefined) {
        const n = Number(input.progressPct);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw bad("Progress must be between 0 and 100.");
        patch.progressPct = Math.round(n);
      }
      if (!Object.keys(patch).length) throw bad("Nothing to update.");
      patch.lastProgressAt = now;
      return { to: S.IN_PROGRESS, patch, publicNote: null };
    },
  },
  block: {
    from: [S.IN_PROGRESS],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.updateProgress");
      needAssignee(ticket, actor);
      return { to: S.BLOCKED, patch: { blockerReason: reason(input), lastProgressAt: now }, publicNote: null };
    },
  },
  unblock: {
    from: [S.BLOCKED],
    run({ ticket, actor, now }) {
      if (!isSuper(actor) && !has(actor, "tickets.assign")) needAssignee(ticket, actor);
      if (!has(actor, "tickets.updateProgress") && !has(actor, "tickets.assign")) throw forbidden();
      return { to: S.IN_PROGRESS, patch: { blockerReason: "", lastProgressAt: now }, publicNote: null };
    },
  },
  request_clarification: {
    from: [S.NEW, S.TRIAGED, S.ASSIGNED, S.IN_PROGRESS, S.BLOCKED],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.requestClarification");
      if (actor.kind === "staff" && !has(actor, "tickets.view") && actor.id !== ticket.developerId && actor.id !== ticket.testerId) {
        throw forbidden("Only the assigned team can ask for clarification.");
      }
      const message = str(input.message, 4000);
      if (message.length < 3) throw bad("Tell the reporter what you need to know.");
      return { to: S.AWAITING_REPORTER, patch: { resumeStatus: ticket.status, clarificationRequestedAt: now }, publicNote: "We need more information from you.", comment: { visibility: "public", body: message } };
    },
  },
  reporter_respond: {
    from: [S.AWAITING_REPORTER],
    run({ ticket, actor, input }) {
      reporterOnly(ticket, actor);
      const message = str(input.message, 4000);
      if (message.length < 1) throw bad("Please write your response.");
      return { to: ticket.resumeStatus || S.TRIAGED, patch: { resumeStatus: null }, publicNote: "The reporter replied.", comment: { visibility: "public", body: message } };
    },
  },

  /* ── Stage 4: QA ── */
  submit_for_qa: {
    from: [S.IN_PROGRESS],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.submitForQA");
      needAssignee(ticket, actor);
      const patch = workPatch(input);
      const merged = { ...ticket, ...patch };
      const missing = ["rootCause", "fixSummary", "testEvidence"].filter((f) => !str(merged[f]));
      if (missing.length) throw bad(`Before submitting for QA, fill in: ${missing.join(", ")}.`);
      Object.assign(patch, { submittedForQAAt: now, qaCycle: (ticket.qaCycle || 0) + 1, progressPct: 100, lastProgressAt: now, review: null });
      return { to: S.READY_FOR_QA, patch, publicNote: "A fix is ready and is now being tested." };
    },
  },
  qa_start: {
    from: [S.READY_FOR_QA],
    run({ ticket, actor, now }) {
      need(actor, "qa.record");
      notOwnWork(ticket, actor, "test");
      if (ticket.testerId && !isSuper(actor) && actor.id !== ticket.testerId) throw forbidden("This ticket is assigned to another tester.");
      const patch = { qaStartedAt: now };
      if (!ticket.testerId && actor.kind === "staff") { patch.testerId = actor.id; patch.testerName = actor.name; }
      return { to: S.QA_IN_PROGRESS, patch, publicNote: null };
    },
  },
  qa_pass: {
    from: [S.QA_IN_PROGRESS],
    run({ ticket, actor, input, now }) {
      need(actor, "qa.record");
      notOwnWork(ticket, actor, "test");
      if (ticket.testerId && !isSuper(actor) && actor.id !== ticket.testerId) throw forbidden("This ticket is assigned to another tester.");
      const summary = reason(input, "summary", 5);
      return {
        to: S.QA_PASSED,
        then: S.AWAITING_RELEASE,
        patch: { qaPassedAt: now, lastQA: { verdict: "pass", summary, at: now, by: actor.name } },
        qaReport: { verdict: "pass", summary, evidence: str(input.evidence, 8000), steps: str(input.steps, 8000) },
        publicNote: null,
      };
    },
  },
  qa_fail: {
    from: [S.QA_IN_PROGRESS],
    run({ ticket, actor, input, now }) {
      need(actor, "qa.record");
      notOwnWork(ticket, actor, "test");
      if (ticket.testerId && !isSuper(actor) && actor.id !== ticket.testerId) throw forbidden("This ticket is assigned to another tester.");
      const summary = reason(input, "summary", 5);
      const evidence = str(input.evidence, 8000);
      if (evidence.length < 3) throw bad("Evidence is required when rejecting a fix.");
      return {
        to: S.QA_FAILED,
        patch: { lastQA: { verdict: "fail", summary, at: now, by: actor.name }, progressPct: 80 },
        qaReport: { verdict: "fail", summary, evidence, steps: str(input.steps, 8000) },
        publicNote: null,
      };
    },
  },

  /* ── Stage 5: review, release approval, push, deployment (four distinct actions) ── */
  fix_approve: {
    from: [S.AWAITING_RELEASE],
    run({ ticket, actor, input, now }) {
      need(actor, "fix.review");
      notOwnWork(ticket, actor, "review");
      if (ticket.review && ticket.review.approved) throw conflict("The fix has already been approved.");
      return { to: S.AWAITING_RELEASE, patch: { review: { approved: true, by: actor.name, byId: actor.id, at: now, note: str(input.note, 2000) } }, publicNote: null };
    },
  },
  fix_reject: {
    from: [S.AWAITING_RELEASE],
    run({ ticket, actor, input }) {
      need(actor, "fix.review");
      notOwnWork(ticket, actor, "review");
      return { to: S.CHANGES_REQUESTED, patch: { review: null, changesReason: reason(input) }, publicNote: null };
    },
  },
  release_approve: {
    from: [S.AWAITING_RELEASE],
    run({ ticket, actor, input, now }) {
      need(actor, "release.approve");
      notOwnWork(ticket, actor, "approve the release of");
      if (!ticket.review || !ticket.review.approved) throw conflict("The fix must be approved in code review before the release can be approved.");
      if (ticket.review.byId && actor.kind === "staff" && ticket.review.byId === actor.id && !isSuper(actor)) {
        throw forbidden("Release approval must come from a different person than the code reviewer.");
      }
      return { to: S.APPROVED_FOR_RELEASE, patch: { releaseApproval: { by: actor.name, byId: actor.id, at: now, note: str(input.note, 2000) } }, publicNote: null };
    },
  },
  release_reject: {
    from: [S.AWAITING_RELEASE],
    run({ ticket, actor, input }) {
      need(actor, "release.approve");
      notOwnWork(ticket, actor, "reject the release of");
      return { to: S.RELEASE_REJECTED, patch: { review: null, changesReason: reason(input) }, publicNote: null };
    },
  },
  record_push: {
    from: [S.APPROVED_FOR_RELEASE],
    run({ ticket, actor, input, now }) {
      need(actor, "deploy.record");
      const branch = str(input.branch, 300), commitRef = str(input.commitRef, 300);
      if (!branch) throw bad("The branch is required.");
      if (!commitRef) throw bad("A commit hash or pull-request reference is required.");
      return { to: S.APPROVED_FOR_RELEASE, patch: { codePush: { branch, commitRef, by: actor.name, at: now, note: str(input.note, 1000) }, branch, commitRef }, publicNote: null };
    },
  },
  record_deployment: {
    from: [S.APPROVED_FOR_RELEASE],
    run({ ticket, actor, input, now }) {
      need(actor, "deploy.record");
      if (!ticket.codePush || !ticket.codePush.commitRef) throw conflict("Record the code push (branch and commit) before recording a deployment.");
      const releaseId = str(input.releaseId, 200);
      if (!releaseId) throw bad("A release identifier is required.");
      const environment = str(input.environment, 20);
      if (!C.ENVIRONMENTS.includes(environment)) throw bad("A valid target environment is required.");
      const result = str(input.result, 20);
      if (!C.DEPLOY_RESULTS.includes(result)) throw bad("A deployment result is required (success, failed or rolled_back).");
      const operator = str(input.operator, 200) || actor.name;
      const rec = { releaseId, environment, result, operator, branch: ticket.codePush.branch, commitRef: ticket.codePush.commitRef, notes: str(input.notes, 2000), approvedBy: ticket.releaseApproval && ticket.releaseApproval.by };
      if (result === "success") {
        return { to: S.RELEASED, patch: { releasedAt: now, lastRelease: { releaseId, environment, at: now } }, releaseRecord: rec, publicNote: "The fix has been released." };
      }
      return { to: S.APPROVED_FOR_RELEASE, patch: {}, releaseRecord: rec, publicNote: null };
    },
  },

  /* ── Stage 6: verification & closure ── */
  request_confirmation: {
    from: [S.RELEASED],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.resolve");
      const verificationNote = reason(input, "verificationNote", 5);
      const resolutionSummary = reason(input, "resolutionSummary", 5);
      return { to: S.AWAITING_CONFIRMATION, patch: { verificationNote, resolutionSummary, verifiedAt: now }, publicNote: "Please confirm that the problem is fixed.", comment: { visibility: "public", body: resolutionSummary } };
    },
  },
  resolve: {
    from: [S.RELEASED],
    run({ ticket, actor, input, now }) {
      need(actor, "tickets.resolve");
      const verificationNote = reason(input, "verificationNote", 5);
      const resolutionSummary = reason(input, "resolutionSummary", 5);
      return { to: S.RESOLVED, patch: { verificationNote, resolutionSummary, verifiedAt: now, resolvedAt: now }, publicNote: "Your ticket was resolved.", comment: { visibility: "public", body: resolutionSummary } };
    },
  },
  reporter_confirm: {
    from: [S.AWAITING_CONFIRMATION],
    run({ ticket, actor, input, now }) {
      reporterOnly(ticket, actor);
      return { to: S.RESOLVED, patch: { resolvedAt: now, reporterConfirmedAt: now }, publicNote: "The reporter confirmed the fix.", comment: str(input.message) ? { visibility: "public", body: str(input.message) } : null };
    },
  },
  close: {
    from: [S.RESOLVED],
    run({ ticket, actor, now, config }) {
      need(actor, "tickets.close");
      if (!ticket.resolvedAt) throw conflict("The ticket has not been resolved.");
      if (!ticket.reporterConfirmedAt && !ticket.verificationNote) throw conflict("Closure requires a reporter confirmation or a recorded verification.");
      return { to: S.CLOSED, patch: { closedAt: now }, publicNote: "Your ticket was closed." };
    },
  },
  reporter_reopen: {
    from: [S.AWAITING_CONFIRMATION, S.RESOLVED, S.CLOSED],
    run({ ticket, actor, input, now, config }) {
      reporterOnly(ticket, actor);
      const why = reason(input);
      const windowDays = (config && config.reopenWindowDays) || 30;
      const doneAt = ticket.closedAt || ticket.resolvedAt;
      if (doneAt && now.getTime() - new Date(doneAt).getTime() > windowDays * 86400000) {
        throw conflict(`Tickets can be reopened within ${windowDays} days. Please raise a new ticket.`);
      }
      return { to: S.REOPENED, patch: reopenPatch(ticket), publicNote: "The reporter reopened the ticket.", comment: { visibility: "public", body: why } };
    },
  },
  reopen: {
    from: [S.AWAITING_CONFIRMATION, S.RELEASED, S.RESOLVED, S.CLOSED],
    run({ ticket, actor, input }) {
      need(actor, "tickets.reopen");
      const why = reason(input);
      return { to: S.REOPENED, patch: reopenPatch(ticket), publicNote: "The ticket was reopened.", comment: { visibility: "internal", body: why } };
    },
  },
};

function reopenPatch(ticket) {
  return {
    resolvedAt: null, closedAt: null, reporterConfirmedAt: null, review: null, releaseApproval: null, codePush: null,
    reopenCount: (ticket.reopenCount || 0) + 1, progressPct: 0, qaPassedAt: null, releasedAt: null, verifiedAt: null,
  };
}

/** Which actions could this actor attempt right now? (UI hint only — evaluate() is authoritative.) */
function availableActions({ ticket, actor, config, now = new Date() }) {
  const out = [];
  for (const name of Object.keys(ACTIONS)) {
    const def = ACTIONS[name];
    if (!def.from.includes(ticket.status)) continue;
    try {
      // Dry-run with empty input: only permission / ownership errors mean "not available".
      def.run({ ticket, actor, input: {}, now, config });
      out.push(name);
    } catch (e) {
      if (e instanceof WorkflowError && e.code === "VALIDATION") out.push(name);
      else if (e instanceof WorkflowError && e.code === "INVALID_TRANSITION") continue;
      else if (!(e instanceof WorkflowError)) throw e;
    }
  }
  return out;
}

function evaluate({ ticket, action, actor, input = {}, config = {}, now = new Date() }) {
  const def = ACTIONS[action];
  if (!def) throw bad(`Unknown action "${action}".`);
  if (!actor) throw new WorkflowError(401, "UNAUTHENTICATED", "Not signed in.");
  if (!def.from.includes(ticket.status)) {
    throw conflict(`"${action.replace(/_/g, " ")}" is not possible while the ticket is "${C.STATUS_LABEL[ticket.status] || ticket.status}".`);
  }
  const result = def.run({ ticket, actor, input: input || {}, config, now });
  return { action, from: ticket.status, ...result };
}

module.exports = { evaluate, availableActions, WorkflowError, ACTIONS, WORK_FIELDS };
