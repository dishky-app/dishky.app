// Shared by the Developer Panel and the Super Admin console (same file in both apps).
import React, { createContext, useContext, useEffect, useRef } from "react";
import { Badge } from "../components.js";

const TicketApiContext = createContext(null);
export const TicketApiProvider = TicketApiContext.Provider;
export const useTicketApi = () => useContext(TicketApiContext);

export const STATUS_TONE = {
  new: "info", triaged: "info", assigned: "warn", in_progress: "warn", awaiting_reporter_response: "warn",
  blocked: "bad", ready_for_qa: "info", qa_in_progress: "info", qa_passed: "ok", qa_failed: "bad",
  changes_requested: "bad", awaiting_release_approval: "info", approved_for_release: "ok", release_rejected: "bad",
  released: "ok", awaiting_reporter_confirmation: "warn", resolved: "ok", closed: "muted", reopened: "bad",
};
export const PRIORITY_TONE = { critical: "bad", high: "warn", medium: "info", low: "muted" };

export const StatusTag = ({ status, label }) => <Badge tone={STATUS_TONE[status] || "muted"}>{label || status}</Badge>;
export const PriorityTag = ({ priority, suggested }) =>
  priority ? <Badge tone={PRIORITY_TONE[priority] || "muted"}>{priority}</Badge>
    : suggested ? <span className="subtitle" title="Suggested by the reporter">({suggested}?)</span> : <span className="subtitle">—</span>;

// Same display formats as the Admin Panel: DD-MM-YYYY and zero-padded HH:MM AM/PM.
const pad2 = (n) => String(n).padStart(2, "0");
export const dateOnly = (d) => { if (!d) return "—"; const x = new Date(d); return `${pad2(x.getDate())}-${pad2(x.getMonth() + 1)}-${x.getFullYear()}`; };
export const dateTime = (d) => { if (!d) return "—"; const x = new Date(d); const h = x.getHours(); return `${dateOnly(x)} ${pad2(h % 12 || 12)}:${pad2(x.getMinutes())} ${h >= 12 ? "PM" : "AM"}`; };

export function remaining(ms) {
  if (ms === null || ms === undefined) return "";
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000), d = Math.floor(h / 24);
  const txt = d >= 2 ? `${d} days` : h >= 1 ? `${h}h ${Math.floor((abs % 3600000) / 60000)}m` : `${Math.max(1, Math.floor(abs / 60000))}m`;
  return ms < 0 ? `${txt} overdue` : `${txt} left`;
}
export function DeadlineText({ ticket }) {
  if (!ticket.deadline) return <span className="subtitle">—</span>;
  const cls = ticket.overdue ? "sa-bad-text" : ticket.remainingMs !== null && ticket.remainingMs < 86400000 ? "sa-warn-text" : "";
  return <span className={cls} title={dateTime(ticket.deadline)}>{dateOnly(ticket.deadline)}{ticket.remainingMs !== null && ["assigned", "in_progress", "blocked", "qa_failed", "changes_requested", "release_rejected", "awaiting_reporter_response"].includes(ticket.status) ? ` · ${remaining(ticket.remainingMs)}` : ""}</span>;
}

/** Calls fn now and every `ms` while the tab is visible — the cross-panel refresh mechanism. */
export function usePolling(fn, ms, deps = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let stop = false;
    const tick = () => { if (!stop && !document.hidden) ref.current(); };
    ref.current();
    const t = setInterval(tick, ms);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export const toLocalInput = (d) => {
  const x = d ? new Date(d) : new Date(Date.now() + 86400000);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, dataUrl: r.result });
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });

export const bytesLabel = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Download a protected attachment (cookie-authenticated) through a blob. */
export async function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
