import React, { useEffect, useState } from "react";
import CustomDropdown from "../components/CustomDropdown.js";
import { ErrorNote } from "../components.js";
import { useToast } from "../useToast.js";
import { toTitleCase } from "../formUtils.js";
import DateTimeField from "./DateTimeField.js";
import Modal, { Field } from "./Modal.js";
import { toLocalInput, useTicketApi } from "./ui.js";

/* One entry per workflow action. `fields` drive the dialog; the server (workflow.js) stays the authority. */
const T = (name, label, extra = {}) => ({ name, label, type: "textarea", ...extra });
export const ACTION_FORMS = {
  triage: { label: "Triage", title: "Triage ticket", fields: [{ name: "priority", label: "Priority", type: "priority", required: true }, { name: "severity", label: "Severity", type: "severity", required: true }] },
  assign: { label: "Assign", title: "Assign developer & deadline", assign: true },
  set_priority: { label: "Change priority", title: "Change priority / severity", fields: [{ name: "priority", label: "Priority", type: "priority" }, { name: "severity", label: "Severity", type: "severity" }] },
  set_deadline: { label: "Change deadline", title: "Change deadline", fields: [{ name: "deadline", label: "New deadline", type: "datetime", required: true }, T("reason", "Reason for change")] },
  acknowledge: { label: "Acknowledge", title: "Acknowledge assignment", confirm: "Confirm that you have received this assignment.", primary: true },
  start: { label: "Start work", title: "Start work", confirm: "Mark this ticket as In Progress?", primary: true },
  progress: { label: "Update progress", title: "Update progress", wide: true, fields: [{ name: "progressPct", label: "Progress (%)", type: "number" }, T("investigationNotes", "Investigation notes"), T("rootCause", "Root-cause analysis"), T("fixSummary", "Fix summary"), T("testEvidence", "Test evidence"), { name: "branch", label: "Branch", type: "text" }, { name: "commitRef", label: "Commit / PR reference", type: "text" }] },
  block: { label: "Report blocker", title: "Report a blocker", danger: true, fields: [T("reason", "What is blocking you?", { required: true })] },
  unblock: { label: "Unblock", title: "Resume work", confirm: "Mark the blocker as cleared and resume work?" },
  request_clarification: { label: "Request clarification", title: "Request clarification from the reporter", fields: [T("message", "Your question (visible to the restaurant)", { required: true })] },
  submit_for_qa: { label: "Submit for QA", title: "Submit fix for QA", wide: true, primary: true, fields: [T("rootCause", "Root-cause analysis", { required: true }), T("fixSummary", "Fix summary", { required: true }), T("testEvidence", "Test evidence", { required: true }), { name: "branch", label: "Branch", type: "text" }, { name: "commitRef", label: "Commit / PR reference", type: "text" }] },
  qa_start: { label: "Start QA", title: "Start testing", confirm: "Start testing this fix?", primary: true },
  qa_pass: { label: "QA pass", title: "QA passed", wide: true, primary: true, fields: [T("summary", "Test summary", { required: true }), T("steps", "Steps performed"), T("evidence", "Evidence (links, notes)")] },
  qa_fail: { label: "QA fail", title: "QA failed — return to developer", wide: true, danger: true, fields: [T("summary", "Why did it fail?", { required: true }), T("evidence", "Evidence (links, screenshots, logs)", { required: true }), T("steps", "Steps to reproduce")] },
  fix_approve: { label: "Approve fix", title: "Approve fix (code review)", primary: true, fields: [T("note", "Review notes")] },
  fix_reject: { label: "Reject fix", title: "Reject fix — request changes", danger: true, fields: [T("reason", "What must change?", { required: true })] },
  release_approve: { label: "Approve release", title: "Approve release", primary: true, fields: [T("note", "Approval notes")] },
  release_reject: { label: "Reject release", title: "Reject release", danger: true, fields: [T("reason", "Reason", { required: true })] },
  record_push: { label: "Record code push", title: "Record code push", fields: [{ name: "branch", label: "Branch", type: "text", required: true }, { name: "commitRef", label: "Commit hash / pull-request", type: "text", required: true }, T("note", "Notes")] },
  record_deployment: { label: "Record deployment", title: "Record deployment result", wide: true, fields: [{ name: "releaseId", label: "Release identifier", type: "text", required: true }, { name: "environment", label: "Target environment", type: "env", required: true }, { name: "result", label: "Result", type: "deployResult", required: true }, { name: "operator", label: "Deployment operator", type: "text" }, T("notes", "Notes")] },
  request_confirmation: { label: "Request reporter confirmation", title: "Verify and ask the restaurant to confirm", fields: [T("verificationNote", "How was the fix verified?", { required: true }), T("resolutionSummary", "Resolution summary (visible to the restaurant)", { required: true })] },
  resolve: { label: "Resolve", title: "Resolve ticket", primary: true, fields: [T("verificationNote", "How was the fix verified?", { required: true }), T("resolutionSummary", "Resolution summary (visible to the restaurant)", { required: true })] },
  close: { label: "Close", title: "Close ticket", confirm: "Close this ticket? The full history is kept." },
  reopen: { label: "Reopen", title: "Reopen ticket", danger: true, fields: [T("reason", "Reason", { required: true })] },
};
export const ACTION_ORDER = ["acknowledge", "start", "progress", "unblock", "submit_for_qa", "qa_start", "qa_pass", "qa_fail", "fix_approve", "release_approve", "record_push", "record_deployment", "request_confirmation", "resolve", "close", "triage", "assign", "set_priority", "set_deadline", "request_clarification", "block", "fix_reject", "release_reject", "reopen"];

export default function ActionDialog({ action, ticket, meta, onClose, onDone }) {
  const api = useTicketApi();
  const { toast } = useToast();
  const def = ACTION_FORMS[action];
  const initial = () => {
    const v = {};
    for (const f of def.fields || []) v[f.name] = ticket && ticket[f.name] !== undefined && ticket[f.name] !== null && f.type !== "datetime" ? String(ticket[f.name]) : "";
    if (action === "triage" || action === "set_priority") { v.priority = ticket.priority || ticket.suggestedPriority || ""; v.severity = ticket.severity || ""; }
    if (action === "set_deadline") v.deadline = toLocalInput(ticket.deadline);
    if (action === "record_push" && ticket.commitRef) v.commitRef = ticket.commitRef;
    if (action === "record_deployment") v.environment = "production", v.result = "success";
    if (action === "assign") Object.assign(v, { developerId: ticket.developerId || "", testerId: ticket.testerId || "", reviewerId: ticket.reviewerId || "", deadline: toLocalInput(ticket.deadline), reason: "" });
    return v;
  };
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState({ developer: [], tester: [], reviewer: [] });
  const set = (k) => (val) => setV((p) => ({ ...p, [k]: val && val.target ? val.target.value : val }));

  useEffect(() => {
    if (!def.assign) return;
    Promise.all(["developer", "tester", "reviewer"].map((k) => api.assignable(k).catch(() => [])))
      .then(([developer, tester, reviewer]) => setStaff({ developer, tester, reviewer }));
  }, [def.assign, api]);

  const submit = async () => {
    for (const f of def.fields || []) {
      if (f.required && !String(v[f.name] ?? "").trim()) return toast.error(`${f.label} is required.`);
    }
    if (def.assign) {
      if (!v.developerId) return toast.error("Choose a developer.");
      if (!v.deadline) return toast.error("Set a deadline.");
    }
    if (v.progressPct !== undefined && v.progressPct !== "" && !(Number(v.progressPct) >= 0 && Number(v.progressPct) <= 100)) return toast.error("Progress must be between 0 and 100.");
    setBusy(true); setError("");
    try {
      const body = { ...v };
      if (body.deadline) body.deadline = new Date(body.deadline).toISOString();
      if (body.progressPct !== undefined && body.progressPct !== "") body.progressPct = Number(body.progressPct); else delete body.progressPct;
      for (const k of Object.keys(body)) if (body[k] === "" && !["testerId", "reviewerId"].includes(k)) delete body[k];
      const res = await api.action(ticket.ticketId, action, body);
      onDone(res);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const opt = (list, withName) => list.map((x) => ({ value: x.id, label: withName ? `${x.name} — ${x.role} (${x.activeWorkload} active)` : x.name }));
  const renderField = (f) => {
    const common = { value: v[f.name] ?? "", onChange: set(f.name) };
    switch (f.type) {
      case "textarea": return <Field key={f.name} label={f.label} required={f.required}><textarea {...common} /></Field>;
      case "number": return <Field key={f.name} label={f.label}><input type="number" min="0" max="100" {...common} /></Field>;
      case "datetime": return <DateTimeField key={f.name} label={f.label} required={f.required} value={v[f.name]} onChange={set(f.name)} />;
      case "priority": return <CustomDropdown key={f.name} label={f.label} required={f.required} value={v[f.name]} onChange={set(f.name)} options={meta.priorities} placeholder={null} />;
      case "severity": return <CustomDropdown key={f.name} label={f.label} required={f.required} value={v[f.name]} onChange={set(f.name)} options={meta.severities} placeholder={null} />;
      case "env": return <CustomDropdown key={f.name} label={f.label} required value={v[f.name]} onChange={set(f.name)} options={meta.environments} placeholder={null} />;
      case "deployResult": return <CustomDropdown key={f.name} label={f.label} required value={v[f.name]} onChange={set(f.name)} options={meta.deployResults.map((x) => ({ value: x, label: x.replace("_", " ") }))} placeholder={null} />;
      default: return <Field key={f.name} label={f.label} required={f.required}><input type="text" {...(f.name === "operator" ? { value: v.operator ?? "", onChange: (e) => set("operator")(toTitleCase(e.target.value)) } : common)} /></Field>;
    }
  };

  return (
    <Modal title={def.title} onClose={onClose} onSubmit={submit} busy={busy} danger={def.danger} wide={def.wide || def.assign} submitLabel={def.label}>
      {def.confirm && <p style={{ margin: 0 }}>{def.confirm}</p>}
      {def.assign && (
        <>
          <CustomDropdown label="Developer" required value={v.developerId} onChange={set("developerId")} options={opt(staff.developer, true)} placeholder={null} />
          <CustomDropdown label="Tester (optional)" value={v.testerId} onChange={set("testerId")} options={opt(staff.tester, true)} placeholder="No tester yet" />
          <CustomDropdown label="Reviewer (optional)" value={v.reviewerId} onChange={set("reviewerId")} options={opt(staff.reviewer, true)} placeholder="No reviewer yet" />
          <DateTimeField label="Deadline" required value={v.deadline} onChange={set("deadline")} />
          <span className="subtitle">{ticket.priority ? `Suggested from the ${ticket.priority}-priority SLA — change it if needed.` : "Triage the ticket first to get an SLA suggestion."}</span>
          {ticket.developerId && <Field label="Reason for change (optional)"><textarea value={v.reason} onChange={set("reason")} /></Field>}
          {staff.developer.length === 0 && <p className="tk-warn">No active developers are available. Create staff in “Dishky Staff” first.</p>}
        </>
      )}
      {(def.fields || []).map(renderField)}
      <ErrorNote error={error} />
    </Modal>
  );
}
