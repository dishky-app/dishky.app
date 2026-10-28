/**
 * support/service.js — ticket business logic shared by the Restaurant Admin,
 * Super Admin and Developer panels. Routes stay thin; every state change goes
 * through performAction(), which calls workflow.evaluate() and then persists the
 * result, the history entry, notifications and real-time events together.
 */
const crypto = require("crypto");
const M = require("./models");
const C = require("./constants");
const W = require("./workflow");
const { parseUploads } = require("./uploads");
const { sendMail } = require("../../services/Mailer");

const {
  Ticket, TicketAttachment, TicketComment, TicketHistory, TicketQAReport, TicketRelease,
  SupportNotification, SupportConfig, DishkyStaff,
} = M;

/* ───────── config ───────── */
let cfgCache = null;
async function getConfig(force = false) {
  if (!force && cfgCache && Date.now() - cfgCache.at < 10000) return cfgCache.value;
  let doc = await SupportConfig.findById("support").lean();
  if (!doc) {
    try { await SupportConfig.create({ _id: "support" }); } catch (e) { if (e.code !== 11000) throw e; }
    doc = await SupportConfig.findById("support").lean();
  }
  // New roles / permissions added in code appear for existing installs without wiping edits.
  doc.rolePermissions = doc.rolePermissions || {};
  for (const r of C.STAFF_ROLES) if (!Array.isArray(doc.rolePermissions[r])) doc.rolePermissions[r] = C.ROLE_DEFAULTS[r] || [];
  cfgCache = { at: Date.now(), value: doc };
  return doc;
}
const invalidateConfig = () => { cfgCache = null; };

/* ───────── real-time hook (server.js injects the Socket.IO emitter) ───────── */
let emitter = { toRestaurant() {} };
const setEmitter = (e) => { emitter = e || emitter; };

/* ───────── actors ───────── */
function platformAdminActor(admin) {
  return { kind: "platformAdmin", id: admin.id, name: admin.name, perms: "*", restaurantScope: [] };
}
async function staffActor(staff) {
  const cfg = await getConfig();
  return {
    kind: "staff", id: staff.id, name: staff.name, role: staff.role,
    perms: new Set(cfg.rolePermissions[staff.role] || []),
    restaurantScope: staff.restaurantScope || [],
  };
}
/** admin = req.admin from auth.js; perms = { read, write } from the restaurant permission matrix. */
function reporterActor(admin, restaurantId, perms) {
  return {
    kind: "reporter", id: admin.id, name: admin.name, email: admin.email, roleTitle: admin.roleTitle,
    roleGroup: admin.roleGroup, venueId: admin.venueId || null, restaurantId,
    canRead: !!perms.read, canWrite: !!perms.write, perms: new Set(),
  };
}
const hasPerm = (actor, p) => actor.perms === "*" || actor.perms.has(p);

/* ───────── access rules ───────── */
function staffCanAccess(actor, t) {
  if (hasPerm(actor, "tickets.view")) return true;
  if (hasPerm(actor, "tickets.viewAssigned") && [t.developerId, t.testerId, t.reviewerId].includes(actor.id)) return true;
  if (hasPerm(actor, "tickets.viewRestaurant") && (actor.restaurantScope || []).includes(t.restaurantId)) return true;
  return false;
}
/** Mongo filter equivalent of staffCanAccess. */
function staffScopeFilter(actor) {
  if (hasPerm(actor, "tickets.view")) return {};
  const or = [];
  if (hasPerm(actor, "tickets.viewAssigned")) or.push({ developerId: actor.id }, { testerId: actor.id }, { reviewerId: actor.id });
  if (hasPerm(actor, "tickets.viewRestaurant") && actor.restaurantScope && actor.restaurantScope.length) or.push({ restaurantId: { $in: actor.restaurantScope } });
  return or.length ? { $or: or } : { _id: null };
}
function reporterCanAccess(actor, t) {
  if (!actor.canRead || t.restaurantId !== actor.restaurantId) return false;
  if (actor.roleGroup === "Super Admin") return true;
  return !!actor.venueId && t.venueId === actor.venueId;
}
function reporterScopeFilter(actor) {
  if (!actor.canRead) return { _id: null };
  const f = { restaurantId: actor.restaurantId };
  if (actor.roleGroup !== "Super Admin") f.venueId = actor.venueId || "__none__";
  return f;
}

const httpErr = (status, message, code) => Object.assign(new Error(message), { status, code: code || "ERROR" });
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ───────── notifications ───────── */
async function notify(list, ticket) {
  const docs = list.filter(Boolean).map((n) => ({ ...n, ticketId: ticket.ticketId, restaurantId: ticket.restaurantId }));
  if (!docs.length) return;
  try { await SupportNotification.insertMany(docs); } catch (e) { console.error("[support] notify failed:", e.message); }
  const rest = docs.filter((d) => d.recipientKind === "restaurant");
  if (rest.length) emitter.toRestaurant(ticket.restaurantId, "support:ticket", { ticketId: ticket.ticketId, message: rest[0].message, kind: rest[0].kind });
}
async function staffIdsWithPerm(perm) {
  const cfg = await getConfig();
  const roles = C.STAFF_ROLES.filter((r) => (cfg.rolePermissions[r] || []).includes(perm));
  if (!roles.length) return [];
  const rows = await DishkyStaff.find({ status: "active", role: { $in: roles } }).select("id").lean();
  return rows.map((r) => r.id);
}
const toSuper = (kind, message) => ({ recipientKind: "superadmin", recipientId: "", kind, message });
const toStaff = (id, kind, message) => (id ? { recipientKind: "staff", recipientId: id, kind, message } : null);
const toReporter = (t, kind, message) => (t.reporter && t.reporter.adminId ? { recipientKind: "restaurant", recipientId: t.reporter.adminId, kind, message } : null);

function emailReporter(t, subject, line) {
  if (!t.reporter || !t.reporter.email) return;
  const url = (process.env.ADMIN_APP_URL || process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const text = `${line}\n\nTicket ${t.ticketId}: ${t.title}${url ? `\n${url}/support` : ""}`;
  sendMail({ to: t.reporter.email, subject: `[${t.ticketId}] ${subject}`, text, html: `<p>${escapeHtml(line)}</p><p><b>${t.ticketId}</b> — ${escapeHtml(t.title)}</p>` }).catch(() => {});
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ───────── views ───────── */
const OVERDUE_STATES = new Set(C.DEADLINE_ACTIVE);
function deadlineInfo(t, now = Date.now()) {
  if (!t.deadline) return { overdue: false, remainingMs: null };
  const ms = new Date(t.deadline).getTime() - now;
  return { overdue: ms < 0 && OVERDUE_STATES.has(t.status), remainingMs: ms };
}

function staffView(t, config) {
  const o = { ...t };
  delete o._id;
  const d = deadlineInfo(t);
  o.overdue = d.overdue;
  o.remainingMs = d.remainingMs;
  o.statusLabel = C.STATUS_LABEL[t.status];
  return o;
}
function reporterView(t) {
  const pub = C.PUBLIC_STATUS[t.status] || { key: t.status, label: t.status };
  return {
    ticketId: t.ticketId, title: t.title, category: t.category, module: t.module,
    description: t.description, expected: t.expected, actual: t.actual, steps: t.steps, impact: t.impact,
    suggestedPriority: t.suggestedPriority, priority: t.priority, venueId: t.venueId, branchName: t.branchName,
    reporter: { name: t.reporter && t.reporter.name },
    status: pub.key, statusLabel: pub.label,
    awaitingYou: pub.key === "awaiting_you",
    attachments: (t.attachments || []).filter((a) => !a.internal).map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, at: a.at })),
    resolutionSummary: ["resolved", "closed", "awaiting_reporter_confirmation"].includes(t.status) ? t.resolutionSummary : "",
    latestResponse: t.latestPublicResponse || "",
    reopenCount: t.reopenCount || 0,
    createdAt: t.createdAt, updatedAt: t.lastPublicActivityAt || t.updatedAt,
  };
}

/* ───────── create ───────── */
function cleanText(v, max) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }

async function createTicket({ actor, body, restaurant, venue, onBehalfOf }) {
  const title = cleanText(body.title, 200);
  const description = cleanText(body.description, 8000);
  const category = String(body.category || "");
  const module = cleanText(body.module, 120);
  if (title.length < 5) throw httpErr(400, "Please enter a title (at least 5 characters).");
  if (description.length < 10) throw httpErr(400, "Please describe the problem (at least 10 characters).");
  if (!C.CATEGORIES.some((c) => c.value === category)) throw httpErr(400, "Please choose a category.");
  if (!module) throw httpErr(400, "Please choose the affected module.");
  const suggestedPriority = C.PRIORITIES.includes(body.suggestedPriority) ? body.suggestedPriority : "medium";
  const up = parseUploads(body.attachments);
  if (!up.ok) throw httpErr(400, up.error);

  const seq = await M.nextSeq("ticket");
  const ticketId = `TKT-${String(seq).padStart(6, "0")}`;
  const now = new Date();
  const atts = [];
  for (const f of up.files) {
    const att = await TicketAttachment.create({
      ticketId, restaurantId: restaurant.id, name: f.name, mime: f.mime, size: f.size, data: f.buffer,
      uploadedBy: actor.name, uploadedByKind: actor.kind,
    });
    atts.push({ id: att.id, name: f.name, mime: f.mime, size: f.size, uploadedBy: actor.name, uploadedByKind: actor.kind, at: now });
  }
  const ticket = await Ticket.create({
    ticketId, restaurantId: restaurant.id, restaurantName: restaurant.name,
    venueId: venue ? venue.id : null, branchName: venue ? venue.name : "",
    reporter: { adminId: actor.kind === "reporter" ? actor.id : null, name: actor.name, email: actor.email || "", roleTitle: actor.roleTitle || actor.role || "", onBehalfOf: onBehalfOf || "" },
    title, description, category, module,
    expected: cleanText(body.expected, 4000), actual: cleanText(body.actual, 4000), steps: cleanText(body.steps, 6000),
    impact: cleanText(body.impact, 3000), suggestedPriority, attachments: atts, lastPublicActivityAt: now,
    latestPublicResponse: "We received your ticket.",
  });
  await TicketHistory.create({ ticketId, type: "created", to: C.STATUS.NEW, note: "Ticket created", publicNote: "Ticket created", public: true, actor: { kind: actor.kind, id: actor.id, name: actor.name } });
  await notify([
    toSuper("created", `New ticket ${ticketId} from ${restaurant.name}: ${title}`),
    toReporter(ticket, "created", `Your ticket ${ticketId} was received.`),
  ], ticket);
  emailReporter(ticket, "We received your ticket", "We received your support ticket and will review it shortly.");
  return ticket.toObject();
}

/* ───────── core: perform a workflow action ───────── */
async function resolveAssignees(input) {
  const out = { ...input };
  const load = async (id, perm, label) => {
    const s = await DishkyStaff.findOne({ id }).lean();
    if (!s) throw httpErr(400, `${label} not found.`);
    if (s.status !== "active") throw httpErr(400, `${label} (${s.name}) is not an active account.`);
    const cfg = await getConfig();
    if (!(cfg.rolePermissions[s.role] || []).includes(perm)) throw httpErr(400, `${s.name}'s role (${s.role}) cannot be assigned as ${label.toLowerCase()}.`);
    return s;
  };
  if (input.developerId) { const s = await load(input.developerId, "tickets.submitForQA", "Developer"); out.developerName = s.name; }
  if (input.testerId) { const s = await load(input.testerId, "qa.record", "Tester"); out.testerName = s.name; }
  if (input.reviewerId) {
    const s = await DishkyStaff.findOne({ id: input.reviewerId }).lean();
    if (!s || s.status !== "active") throw httpErr(400, "Reviewer is not an active account.");
    const cfg = await getConfig();
    const perms = cfg.rolePermissions[s.role] || [];
    if (!perms.includes("fix.review") && !perms.includes("release.approve")) throw httpErr(400, `${s.name} cannot review fixes or approve releases.`);
    out.reviewerName = s.name;
  }
  return out;
}

async function performAction({ ticketId, action, actor, input = {}, access }) {
  const ticket = await Ticket.findOne({ ticketId: String(ticketId) }).lean();
  if (!ticket) throw httpErr(404, "Ticket not found.");
  if (!access(ticket)) throw httpErr(404, "Ticket not found."); // do not reveal that it exists
  const config = await getConfig();
  const now = new Date();
  let inp = input;
  if (action === "assign") {
    inp = await resolveAssignees(input);
    if (!inp.deadline && ticket.priority) {
      const hrs = (config.slaHours || C.DEFAULT_SLA_HOURS)[ticket.priority] || 72;
      inp = { ...inp, deadline: new Date(now.getTime() + hrs * 3600000).toISOString() };
    }
  }
  let r;
  try { r = W.evaluate({ ticket, action, actor, input: inp, config, now }); }
  catch (e) { if (e instanceof W.WorkflowError) throw httpErr(e.status, e.message, e.code); throw e; }

  const { $pushDeadline, ...setPatch } = r.patch || {};
  const finalStatus = r.then || r.to;
  const update = { $set: { ...setPatch, status: finalStatus } };
  if ($pushDeadline) update.$push = { deadlineHistory: $pushDeadline };
  const publicChange = !!(r.publicNote || r.comment && r.comment.visibility === "public");
  if (publicChange) {
    update.$set.lastPublicActivityAt = now;
    if (r.publicNote) update.$set.latestPublicResponse = r.publicNote;
  }
  // Optimistic concurrency: the ticket must still be in the status we evaluated against.
  const res = await Ticket.updateOne({ ticketId: ticket.ticketId, status: ticket.status }, update);
  if (!res.matchedCount) throw httpErr(409, "This ticket was just updated by someone else. Reload and try again.", "CONFLICT");

  const who = { kind: actor.kind, id: actor.id, name: actor.name };
  const histories = [{ ticketId: ticket.ticketId, type: historyType(action), action, from: ticket.status, to: r.to, note: summarizeNote(action, inp), publicNote: r.publicNote || "", public: !!r.publicNote, actor: who, at: now }];
  if (r.then) histories.push({ ticketId: ticket.ticketId, type: "status", action: "auto", from: r.to, to: r.then, note: "Moved to release approval after QA passed", public: false, actor: who, at: new Date(now.getTime() + 1) });
  await TicketHistory.insertMany(histories);

  if (r.comment && r.comment.body) {
    await TicketComment.create({ ticketId: ticket.ticketId, visibility: r.comment.visibility, body: r.comment.body, author: who });
  } else if (inp.message && ["request_clarification", "reporter_respond"].includes(action)) { /* handled via r.comment */ }
  if (r.qaReport) {
    await TicketQAReport.create({ ticketId: ticket.ticketId, cycle: ticket.qaCycle || 1, verdict: r.qaReport.verdict, summary: r.qaReport.summary, evidence: r.qaReport.evidence, steps: r.qaReport.steps, tester: { id: actor.id, name: actor.name } });
  }
  if (r.releaseRecord) {
    await TicketRelease.create({ ticketId: ticket.ticketId, ...r.releaseRecord, recordedBy: { id: actor.id, name: actor.name } });
  }

  const after = await Ticket.findOne({ ticketId: ticket.ticketId }).lean();
  await postActionNotify({ before: ticket, after, action, r, actor, input: inp });
  return after;
}

function historyType(action) {
  if (action === "assign") return "assign";
  if (action === "set_deadline") return "deadline";
  if (action === "set_priority" || action === "triage") return "priority";
  if (action.startsWith("qa_")) return "qa";
  if (action.startsWith("fix_") || action === "release_approve" || action === "release_reject") return "approval";
  if (action === "record_push" || action === "record_deployment") return "release";
  if (action === "reopen" || action === "reporter_reopen") return "reopen";
  return "status";
}
function summarizeNote(action, i) {
  const pick = (...keys) => keys.map((k) => (typeof i[k] === "string" ? i[k] : null)).find(Boolean) || "";
  switch (action) {
    case "assign": return `Assigned to ${i.developerName || i.developerId}${i.testerName ? `, tester ${i.testerName}` : ""}${i.deadline ? `, due ${new Date(i.deadline).toISOString()}` : ""}`;
    case "triage": return `Priority ${i.priority}, severity ${i.severity}`;
    case "set_priority": return `Priority ${i.priority || "-"} / severity ${i.severity || "-"}`;
    case "set_deadline": return `Deadline set to ${new Date(i.deadline).toISOString()}${i.reason ? ` — ${i.reason}` : ""}`;
    case "record_push": return `Pushed ${i.branch} @ ${i.commitRef}`;
    case "record_deployment": return `Release ${i.releaseId} to ${i.environment}: ${i.result}`;
    case "qa_pass": case "qa_fail": return pick("summary");
    case "block": case "reopen": case "reporter_reopen": case "fix_reject": case "release_reject": return pick("reason");
    case "request_confirmation": case "resolve": return pick("resolutionSummary");
    default: return pick("note", "message", "reason", "summary");
  }
}

async function postActionNotify({ before, after, action, r, actor, input }) {
  const t = after;
  const list = [];
  const label = C.STATUS_LABEL[t.status];
  const tag = `${t.ticketId}`;
  if (r.publicNote) list.push(toReporter(t, "status", `${tag}: ${r.publicNote}`));
  switch (action) {
    case "assign": {
      const devChanged = before.developerId !== t.developerId;
      if (devChanged) list.push(toStaff(t.developerId, "assigned", `You were assigned ${tag}: ${t.title}`));
      else if (before.deadline && t.deadline && new Date(before.deadline).getTime() !== new Date(t.deadline).getTime()) list.push(toStaff(t.developerId, "deadline", `Deadline for ${tag} changed to ${new Date(t.deadline).toUTCString()}`));
      if (t.testerId && t.testerId !== before.testerId) list.push(toStaff(t.testerId, "assigned", `You were assigned as tester on ${tag}`));
      if (t.reviewerId && t.reviewerId !== before.reviewerId) list.push(toStaff(t.reviewerId, "assigned", `You were assigned as reviewer on ${tag}`));
      break;
    }
    case "set_deadline": list.push(toStaff(t.developerId, "deadline", `Deadline for ${tag} changed to ${new Date(t.deadline).toUTCString()}`)); break;
    case "set_priority": list.push(toStaff(t.developerId, "status", `Priority of ${tag} is now ${t.priority}`)); break;
    case "submit_for_qa": {
      list.push(toSuper("status", `${tag} was submitted for QA by ${actor.name}`));
      if (t.testerId) list.push(toStaff(t.testerId, "qa", `${tag} is ready for QA`));
      else for (const id of await staffIdsWithPerm("qa.record")) list.push(toStaff(id, "qa", `${tag} is ready for QA`));
      break;
    }
    case "qa_pass": {
      list.push(toSuper("qa", `QA passed for ${tag}; awaiting release approval`));
      list.push(toStaff(t.developerId, "qa", `QA passed for ${tag}`));
      const ids = new Set([t.reviewerId, ...(await staffIdsWithPerm("release.approve")), ...(await staffIdsWithPerm("fix.review"))].filter(Boolean));
      for (const id of ids) if (id !== t.developerId) list.push(toStaff(id, "qa", `${tag} passed QA and awaits review / release approval`));
      break;
    }
    case "qa_fail": list.push(toStaff(t.developerId, "qa", `QA failed for ${tag}: returned for corrections`)); list.push(toSuper("qa", `QA failed for ${tag}`)); break;
    case "fix_reject": case "release_reject": list.push(toStaff(t.developerId, "status", `${tag} was returned for corrections: ${t.changesReason}`)); list.push(toSuper("status", `${tag} returned: ${t.changesReason}`)); break;
    case "release_approve": list.push(toSuper("release", `Release approved for ${tag}`)); for (const id of await staffIdsWithPerm("deploy.record")) list.push(toStaff(id, "release", `${tag} is approved for release`)); list.push(toStaff(t.developerId, "release", `Release approved for ${tag}`)); break;
    case "record_deployment": if (t.status === C.STATUS.RELEASED) { list.push(toSuper("release", `${tag} was released`)); list.push(toStaff(t.developerId, "release", `${tag} was released`)); } else list.push(toSuper("release", `Deployment ${input.result} for ${tag}`)); break;
    case "block": list.push(toSuper("status", `${tag} is blocked: ${t.blockerReason}`)); break;
    case "request_clarification": list.push(toReporter(t, "clarification", `${tag}: we need more information from you.`)); emailReporter(t, "We need more information", "Our team needs more information to continue working on your ticket."); break;
    case "reporter_respond": list.push(toStaff(t.developerId, "comment", `The reporter replied on ${tag}`)); list.push(toSuper("comment", `The reporter replied on ${tag}`)); break;
    case "request_confirmation": emailReporter(t, "Please confirm the fix", "A fix has been released for your ticket. Please confirm that it works."); break;
    case "resolve": emailReporter(t, "Ticket resolved", "Your ticket has been resolved."); break;
    case "reporter_confirm": list.push(toSuper("resolved", `${tag} was confirmed by the reporter`)); break;
    case "close": emailReporter(t, "Ticket closed", "Your ticket has been closed."); break;
    case "reporter_reopen": case "reopen": list.push(toSuper("reopened", `${tag} was reopened`)); list.push(toStaff(t.developerId, "reopened", `${tag} was reopened`)); emailReporter(t, "Ticket reopened", "Your ticket has been reopened."); break;
    default: break;
  }
  await notify(list, t);
}

/* ───────── comments & attachments ───────── */
async function addComment({ ticketId, actor, visibility, body, access }) {
  const ticket = await Ticket.findOne({ ticketId: String(ticketId) }).lean();
  if (!ticket || !access(ticket)) throw httpErr(404, "Ticket not found.");
  const text = cleanText(body, 6000);
  if (!text) throw httpErr(400, "Please write a comment.");
  let vis = visibility === "internal" ? "internal" : "public";
  if (actor.kind === "reporter") {
    if (!actor.canWrite) throw httpErr(403, "You do not have permission to comment on tickets.");
    if (ticket.status === C.STATUS.CLOSED) throw httpErr(409, "This ticket is closed. Reopen it to add a comment.");
    vis = "public";
  } else if (vis === "internal" ? !hasPerm(actor, "comments.internal") : !hasPerm(actor, "comments.public")) {
    throw httpErr(403, `Missing permission: ${vis === "internal" ? "comments.internal" : "comments.public"}`);
  }
  const who = { kind: actor.kind, id: actor.id, name: actor.name };
  const c = await TicketComment.create({ ticketId: ticket.ticketId, visibility: vis, body: text, author: who });
  const set = {};
  if (vis === "public") { set.lastPublicActivityAt = new Date(); set.latestPublicResponse = text.slice(0, 200); }
  if (Object.keys(set).length) await Ticket.updateOne({ ticketId: ticket.ticketId }, { $set: set });
  await TicketHistory.create({ ticketId: ticket.ticketId, type: "comment", note: vis === "internal" ? "Internal note added" : "Comment added", publicNote: vis === "public" ? "Comment added" : "", public: vis === "public", actor: who });
  const list = [];
  if (vis === "public" && actor.kind !== "reporter") list.push(toReporter(ticket, "comment", `${ticket.ticketId}: new response from our team.`));
  if (actor.kind === "reporter") { list.push(toStaff(ticket.developerId, "comment", `New reply from the reporter on ${ticket.ticketId}`)); list.push(toSuper("comment", `New reply from the reporter on ${ticket.ticketId}`)); }
  else if (vis === "internal" || actor.kind === "staff") { if (actor.id !== ticket.developerId) list.push(toStaff(ticket.developerId, "comment", `New ${vis} comment on ${ticket.ticketId}`)); if (actor.kind === "staff") list.push(toSuper("comment", `New ${vis} comment on ${ticket.ticketId} by ${actor.name}`)); }
  await notify(list, ticket);
  return c.toObject();
}

async function addAttachments({ ticketId, actor, files, internal, access }) {
  const ticket = await Ticket.findOne({ ticketId: String(ticketId) }).lean();
  if (!ticket || !access(ticket)) throw httpErr(404, "Ticket not found.");
  if (actor.kind === "reporter" && !actor.canWrite) throw httpErr(403, "You do not have permission to add attachments.");
  if (ticket.status === C.STATUS.CLOSED && actor.kind === "reporter") throw httpErr(409, "This ticket is closed.");
  if (actor.kind !== "reporter" && !hasPerm(actor, "comments.internal") && !hasPerm(actor, "comments.public")) throw httpErr(403, "Missing permission to add attachments.");
  const up = parseUploads(files);
  if (!up.ok) throw httpErr(400, up.error);
  if (!up.files.length) throw httpErr(400, "No file received.");
  if ((ticket.attachments || []).length + up.files.length > 15) throw httpErr(400, "A ticket can hold at most 15 attachments.");
  const refs = [];
  const now = new Date();
  for (const f of up.files) {
    const att = await TicketAttachment.create({ ticketId: ticket.ticketId, restaurantId: ticket.restaurantId, name: f.name, mime: f.mime, size: f.size, data: f.buffer, uploadedBy: actor.name, uploadedByKind: actor.kind, internal: !!internal && actor.kind !== "reporter" });
    refs.push({ id: att.id, name: f.name, mime: f.mime, size: f.size, uploadedBy: actor.name, uploadedByKind: actor.kind, at: now, internal: !!internal && actor.kind !== "reporter" });
  }
  await Ticket.updateOne({ ticketId: ticket.ticketId }, { $push: { attachments: { $each: refs } } });
  await TicketHistory.create({ ticketId: ticket.ticketId, type: "attachment", note: `${refs.length} attachment(s) added`, public: !refs[0].internal, publicNote: refs[0].internal ? "" : "Attachment added", actor: { kind: actor.kind, id: actor.id, name: actor.name } });
  return refs;
}

async function getAttachment({ ticketId, attId, access, reporter }) {
  const ticket = await Ticket.findOne({ ticketId: String(ticketId) }).lean();
  if (!ticket || !access(ticket)) throw httpErr(404, "File not found.");
  const ref = (ticket.attachments || []).find((a) => a.id === attId);
  if (!ref || (reporter && ref.internal)) throw httpErr(404, "File not found.");
  const att = await TicketAttachment.findOne({ id: attId, ticketId: ticket.ticketId }).lean();
  if (!att) throw httpErr(404, "File not found.");
  return att;
}

/* ───────── detail (assembled per audience) ───────── */
async function ticketDetailForStaff(ticket, actor) {
  const [comments, history, qa, releases] = await Promise.all([
    TicketComment.find({ ticketId: ticket.ticketId }).sort({ createdAt: 1 }).lean(),
    TicketHistory.find({ ticketId: ticket.ticketId }).sort({ at: 1 }).lean(),
    TicketQAReport.find({ ticketId: ticket.ticketId }).sort({ createdAt: 1 }).lean(),
    TicketRelease.find({ ticketId: ticket.ticketId }).sort({ createdAt: 1 }).lean(),
  ]);
  const config = await getConfig();
  return {
    ticket: staffView(ticket),
    comments: comments.map(strip), history: history.map(strip), qaReports: qa.map(strip), releases: releases.map(strip),
    actions: W.availableActions({ ticket, actor, config }),
    canComment: { public: hasPerm(actor, "comments.public"), internal: hasPerm(actor, "comments.internal") },
  };
}
async function ticketDetailForReporter(ticket, actor) {
  const [comments, history] = await Promise.all([
    TicketComment.find({ ticketId: ticket.ticketId, visibility: "public" }).sort({ createdAt: 1 }).lean(),
    TicketHistory.find({ ticketId: ticket.ticketId, public: true }).sort({ at: 1 }).lean(),
  ]);
  const config = await getConfig();
  const acts = W.availableActions({ ticket, actor, config }).filter((a) => ["reporter_respond", "reporter_confirm", "reporter_reopen"].includes(a));
  return {
    ticket: reporterView(ticket),
    comments: comments.map((c) => ({ id: c.id, body: c.body, at: c.createdAt, author: { name: c.author && c.author.name, mine: c.author && c.author.kind === "reporter", staff: !(c.author && c.author.kind === "reporter") } })),
    timeline: history.map((h) => ({ at: h.at, text: h.publicNote || h.note, to: h.to && (C.PUBLIC_STATUS[h.to] || {}).label })),
    actions: acts,
    canWrite: actor.canWrite,
  };
}
function strip(o) { const x = { ...o }; delete x._id; return x; }

/* ───────── lists & dashboards ───────── */
function buildListFilter(q, base) {
  const f = { ...base };
  const and = [];
  if (base.$or) { and.push({ $or: base.$or }); delete f.$or; }
  const set = (k, v) => { if (v) f[k] = v; };
  if (q.status) f.status = Array.isArray(q.status) ? { $in: q.status } : String(q.status).includes(",") ? { $in: String(q.status).split(",") } : q.status;
  set("category", q.category); set("module", q.module); set("priority", q.priority);
  set("developerId", q.developerId); set("testerId", q.testerId);
  if (q.restaurantId && !f.restaurantId) f.restaurantId = String(q.restaurantId);
  if (q.from || q.to) {
    f.createdAt = {};
    if (q.from && !Number.isNaN(Date.parse(q.from))) f.createdAt.$gte = new Date(q.from);
    if (q.to && !Number.isNaN(Date.parse(q.to))) f.createdAt.$lte = new Date(q.to);
    if (!Object.keys(f.createdAt).length) delete f.createdAt;
  }
  if (q.unacknowledged) { f.acknowledgedAt = null; f.status = C.STATUS.ASSIGNED; }
  if (q.dueFrom || q.dueTo) {
    f.deadline = {};
    if (q.dueFrom && !Number.isNaN(Date.parse(q.dueFrom))) f.deadline.$gte = new Date(q.dueFrom);
    if (q.dueTo && !Number.isNaN(Date.parse(q.dueTo))) f.deadline.$lt = new Date(q.dueTo);
    if (!Object.keys(f.deadline).length) delete f.deadline; else f.status = { $in: C.DEADLINE_ACTIVE };
  }
  if (q.view === "unassigned") { f.developerId = null; f.status = { $in: [C.STATUS.NEW, C.STATUS.TRIAGED, C.STATUS.REOPENED] }; }
  if (q.view === "overdue") { f.deadline = { $lt: new Date() }; f.status = { $in: C.DEADLINE_ACTIVE }; }
  if (q.view === "approaching") { f.deadline = { $gte: new Date(), $lte: new Date(Date.now() + 24 * 3600000) }; f.status = { $in: C.DEADLINE_ACTIVE }; }
  if (q.view === "awaitingReview") { f.status = C.STATUS.AWAITING_RELEASE; f["review.approved"] = { $ne: true }; }
  if (q.view === "awaitingRelease") { delete f.status; and.push({ $or: [{ status: C.STATUS.APPROVED_FOR_RELEASE }, { status: C.STATUS.AWAITING_RELEASE, "review.approved": true }] }); }
  if (q.view === "critical") { f.priority = { $in: ["critical", "high"] }; f.status = { $in: C.OPEN }; }
  if (q.search) {
    const re = new RegExp(escapeRegex(String(q.search).trim().slice(0, 100)), "i");
    and.push({ $or: [{ ticketId: re }, { title: re }, { restaurantName: re }, { module: re }] });
  }
  if (and.length) f.$and = and;
  return f;
}
const SORTS = { ticketId: "ticketId", title: "title", category: "category", module: "module", createdAt: "createdAt", updatedAt: "updatedAt", deadline: "deadline", priority: "priority", status: "status", lastPublicActivityAt: "lastPublicActivityAt" };
async function listTickets({ filter, q, mapper }) {
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 25));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const sortKey = SORTS[q.sort] || "createdAt";
  const dir = q.dir === "asc" ? 1 : -1;
  const [total, rows] = await Promise.all([
    Ticket.countDocuments(filter),
    Ticket.find(filter).select("-attachments.data").sort({ [sortKey]: dir, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { total, page, limit, rows: rows.map(mapper) };
}

async function dashboardCounts(base, config) {
  const now = new Date();
  const warn = new Date(now.getTime() + ((config && config.deadlineWarningHours) || 24) * 3600000);
  const c = (extra) => Ticket.countDocuments({ ...base, ...extra });
  const [newT, unassigned, crit, inProg, approaching, overdue, awaitingQA, awaitingReview, awaitingRelease, resolved, closed, open, blocked] = await Promise.all([
    c({ status: C.STATUS.NEW }),
    c({ developerId: null, status: { $in: [C.STATUS.NEW, C.STATUS.TRIAGED, C.STATUS.REOPENED] } }),
    c({ priority: { $in: ["critical", "high"] }, status: { $in: C.OPEN } }),
    c({ status: C.STATUS.IN_PROGRESS }),
    c({ deadline: { $gte: now, $lte: warn }, status: { $in: C.DEADLINE_ACTIVE } }),
    c({ deadline: { $lt: now }, status: { $in: C.DEADLINE_ACTIVE } }),
    c({ status: { $in: [C.STATUS.READY_FOR_QA, C.STATUS.QA_IN_PROGRESS] } }),
    c({ status: C.STATUS.AWAITING_RELEASE, "review.approved": { $ne: true } }),
    c({ $or: [{ status: C.STATUS.APPROVED_FOR_RELEASE }, { status: C.STATUS.AWAITING_RELEASE, "review.approved": true }] }),
    c({ status: C.STATUS.RESOLVED }),
    c({ status: C.STATUS.CLOSED }),
    c({ status: { $in: C.OPEN } }),
    c({ status: C.STATUS.BLOCKED }),
  ]);
  return { new: newT, unassigned, criticalHigh: crit, inProgress: inProg, approachingDeadline: approaching, overdue, awaitingQA, awaitingReview, awaitingRelease, resolved, closed, open, blocked };
}

async function developerDashboard(actor, { dayStart, dayEnd } = {}) {
  const now = new Date();
  const ds = dayStart && !Number.isNaN(Date.parse(dayStart)) ? new Date(dayStart) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const de = dayEnd && !Number.isNaN(Date.parse(dayEnd)) ? new Date(dayEnd) : new Date(ds.getTime() + 86400000);
  const mine = { developerId: actor.id };
  const c = (extra) => Ticket.countDocuments({ ...mine, ...extra });
  const [assigned, newAssignments, inProgress, dueToday, upcoming, overdue, awaitingQA, returned, awaitingReview, completed] = await Promise.all([
    c({ status: { $in: C.OPEN } }),
    c({ status: C.STATUS.ASSIGNED, acknowledgedAt: null }),
    c({ status: C.STATUS.IN_PROGRESS }),
    c({ deadline: { $gte: ds, $lt: de }, status: { $in: C.DEADLINE_ACTIVE } }),
    c({ deadline: { $gte: de, $lte: new Date(de.getTime() + 7 * 86400000) }, status: { $in: C.DEADLINE_ACTIVE } }),
    c({ deadline: { $lt: now }, status: { $in: C.DEADLINE_ACTIVE } }),
    c({ status: { $in: [C.STATUS.READY_FOR_QA, C.STATUS.QA_IN_PROGRESS] } }),
    c({ status: { $in: [C.STATUS.QA_FAILED, C.STATUS.CHANGES_REQUESTED, C.STATUS.RELEASE_REJECTED] } }),
    c({ status: { $in: [C.STATUS.AWAITING_RELEASE, C.STATUS.APPROVED_FOR_RELEASE] } }),
    c({ status: { $in: [C.STATUS.RELEASED, C.STATUS.AWAITING_CONFIRMATION, C.STATUS.RESOLVED, C.STATUS.CLOSED] } }),
  ]);
  return { assigned, newAssignments, inProgress, dueToday, upcoming, overdue, awaitingQA, returned, awaitingReview, completed };
}

/* ───────── notifications API helpers ───────── */
async function listNotifications(match, { limit = 30 } = {}) {
  const [rows, unread] = await Promise.all([
    SupportNotification.find(match).sort({ createdAt: -1 }).limit(limit).lean(),
    SupportNotification.countDocuments({ ...match, read: false }),
  ]);
  return { unread, rows: rows.map(strip) };
}
async function markRead(match, ids) {
  const f = { ...match };
  if (Array.isArray(ids) && ids.length) f.id = { $in: ids.map(String) };
  await SupportNotification.updateMany(f, { $set: { read: true } });
}

/* ───────── background sweeps ───────── */
async function runDeadlineSweep() {
  const config = await getConfig();
  const now = new Date();
  const warnAt = new Date(now.getTime() + (config.deadlineWarningHours || 24) * 3600000);
  const dueSoon = await Ticket.find({ deadline: { $gte: now, $lte: warnAt }, status: { $in: C.DEADLINE_ACTIVE }, deadlineWarnedAt: null, developerId: { $ne: null } }).lean();
  for (const t of dueSoon) {
    const r = await Ticket.updateOne({ ticketId: t.ticketId, deadlineWarnedAt: null }, { $set: { deadlineWarnedAt: now } });
    if (r.modifiedCount) await notify([toStaff(t.developerId, "deadline", `${t.ticketId} is due ${new Date(t.deadline).toUTCString()}`)], t);
  }
  const late = await Ticket.find({ deadline: { $lt: now }, status: { $in: C.DEADLINE_ACTIVE }, overdueNotifiedAt: null, developerId: { $ne: null } }).lean();
  for (const t of late) {
    const r = await Ticket.updateOne({ ticketId: t.ticketId, overdueNotifiedAt: null }, { $set: { overdueNotifiedAt: now } });
    if (r.modifiedCount) await notify([toStaff(t.developerId, "overdue", `${t.ticketId} is overdue`), toSuper("overdue", `${t.ticketId} is overdue (${t.developerName})`)], t);
  }
  return { warned: dueSoon.length, overdue: late.length };
}

/** Closes tickets that have been Resolved (and verified) for autoCloseDays. Never touches unresolved tickets. */
async function runAutoClose() {
  const config = await getConfig();
  if (!config.autoCloseDays || config.autoCloseDays <= 0) return { closed: 0 };
  const cutoff = new Date(Date.now() - config.autoCloseDays * 86400000);
  const rows = await Ticket.find({ status: C.STATUS.RESOLVED, resolvedAt: { $lte: cutoff } }).lean();
  let closed = 0;
  for (const t of rows) {
    if (!t.reporterConfirmedAt && !t.verificationNote) continue;
    const r = await Ticket.updateOne({ ticketId: t.ticketId, status: C.STATUS.RESOLVED }, { $set: { status: C.STATUS.CLOSED, closedAt: new Date(), lastPublicActivityAt: new Date(), latestPublicResponse: "Your ticket was closed." } });
    if (r.modifiedCount) {
      closed += 1;
      await TicketHistory.create({ ticketId: t.ticketId, type: "status", action: "auto_close", from: C.STATUS.RESOLVED, to: C.STATUS.CLOSED, note: `Closed automatically ${config.autoCloseDays} days after resolution`, publicNote: "Ticket closed", public: true, actor: { kind: "system", id: "system", name: "System" } });
      await notify([toReporter(t, "closed", `${t.ticketId} was closed.`)], t);
    }
  }
  return { closed };
}

let sweepTimer = null;
function startSweeps() {
  if (sweepTimer || process.env.NODE_ENV === "test") return;
  const run = () => runDeadlineSweep().then(runAutoClose).catch((e) => console.error("[support] sweep failed:", e.message));
  sweepTimer = setInterval(run, 10 * 60 * 1000);
  sweepTimer.unref();
  setTimeout(run, 30 * 1000).unref();
}

module.exports = {
  getConfig, invalidateConfig, setEmitter,
  platformAdminActor, staffActor, reporterActor, hasPerm,
  staffCanAccess, staffScopeFilter, reporterCanAccess, reporterScopeFilter,
  httpErr, escapeRegex, notify, staffIdsWithPerm,
  staffView, reporterView, createTicket, performAction, addComment, addAttachments, getAttachment,
  ticketDetailForStaff, ticketDetailForReporter, buildListFilter, listTickets, dashboardCounts, developerDashboard,
  listNotifications, markRead, runDeadlineSweep, runAutoClose, startSweeps, strip,
};
