import React, { useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api.js";
import { useAuth } from "../auth.js";
import { Collapsible, ErrorNote, PageHeader, Stat, useCollapse } from "../components.js";
import PageLoader from "../components/PageLoader.js";
import { DeadlineText, PriorityTag, StatusTag, usePolling } from "../tickets/ui.js";

const OPEN = "assigned,in_progress,blocked,awaiting_reporter_response,ready_for_qa,qa_in_progress,qa_passed,qa_failed,changes_requested,awaiting_release_approval,approved_for_release,release_rejected,released,awaiting_reporter_confirmation,reopened";

// Local calendar day boundaries, so "due today" matches the developer's own clock.
function dayRange() {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + 1);
  const w = new Date(e); w.setDate(w.getDate() + 7);
  return { s: s.toISOString(), e: e.toISOString(), w: w.toISOString() };
}

export default function Dashboard() {
  const { staff } = useAuth();
  const [collapsed, toggleCollapsed] = useCollapse();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const r = dayRange();
  usePolling(() => api.dashboard({ dayStart: r.s, dayEnd: r.e }).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)), 30000, []);

  const mine = `developerId=${staff.id}`;
  const cards = [
    { k: "assigned", label: "Assigned tickets", to: `${mine}&status=${OPEN}` },
    { k: "newAssignments", label: "New assignments", to: `${mine}&unacknowledged=1` },
    { k: "inProgress", label: "In progress", to: `${mine}&status=in_progress` },
    { k: "dueToday", label: "Due today", to: `${mine}&dueFrom=${encodeURIComponent(r.s)}&dueTo=${encodeURIComponent(r.e)}`, tone: "warning" },
    { k: "upcoming", label: "Upcoming deadlines (7 days)", to: `${mine}&dueFrom=${encodeURIComponent(r.e)}&dueTo=${encodeURIComponent(r.w)}` },
    { k: "overdue", label: "Overdue", to: `${mine}&view=overdue`, tone: "bad" },
    { k: "awaitingQA", label: "Awaiting QA", to: `${mine}&status=ready_for_qa,qa_in_progress` },
    { k: "returned", label: "Returned for corrections", to: `${mine}&status=qa_failed,changes_requested,release_rejected`, tone: "bad" },
    { k: "awaitingReview", label: "Awaiting review / release", to: `${mine}&status=awaiting_release_approval,approved_for_release` },
    { k: "completed", label: "Completed", to: `${mine}&status=released,awaiting_reporter_confirmation,resolved,closed` },
  ];

  return (
    <div className="inner-page" style={{ overflowY: "auto" }}>
      <PageHeader title="Dashboard" subtitle={`${staff.role} · ${staff.name}`} collapsed={collapsed} onToggle={toggleCollapsed} collapseLabel="summary" />
      <ErrorNote error={error} />
      {!data ? <PageLoader /> : (
        <>
          <Collapsible collapsed={collapsed}><div className="tk-kpis">
            {cards.map((c) => (
              <Link key={c.k} className="tk-kpi-link" to={`/tickets?${c.to}`}>
                <Stat label={c.label} value={data.counts[c.k]} tone={data.counts[c.k] > 0 ? c.tone : undefined} />
              </Link>
            ))}
          </div></Collapsible>
          <div className="tk-card">
            <h4>Next deadlines</h4>
            {data.upcoming.length === 0 ? <p className="subtitle">No open tickets assigned to you.</p> : (
              <div className="table-wrapper" style={{ flex: "none" }}>
                <table>
                  <thead><tr><th>Ticket</th><th>Title</th><th>Restaurant</th><th>Priority</th><th>Status</th><th>Deadline</th></tr></thead>
                  <tbody>
                    {data.upcoming.map((t) => (
                      <tr key={t.ticketId}>
                        <td><Link className="clickable" to={`/tickets/${t.ticketId}`}>{t.ticketId}</Link></td>
                        <td>{t.title}</td><td>{t.restaurantName}</td>
                        <td><PriorityTag priority={t.priority} /></td>
                        <td><StatusTag status={t.status} label={t.status.replace(/_/g, " ")} /></td>
                        <td><DeadlineText ticket={{ ...t, remainingMs: t.deadline ? new Date(t.deadline) - Date.now() : null }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
