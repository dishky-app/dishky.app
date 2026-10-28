import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api.js";
import Button3D from "../components/Button3D.js";
import CustomDropdown from "../components/CustomDropdown.js";
import { Collapsible, ErrorNote, PageHeader, Stat, useCollapse } from "../components.js";
import { useToast } from "../useToast.js";
import Modal, { Field } from "../tickets/Modal.js";
import TicketList from "../tickets/TicketList.js";
import { usePolling } from "../tickets/ui.js";

const CARDS = [
  { k: "new", label: "New tickets", to: "status=new" },
  { k: "unassigned", label: "Unassigned", to: "view=unassigned", tone: "warning" },
  { k: "criticalHigh", label: "Critical & high priority", to: "view=critical", tone: "bad" },
  { k: "inProgress", label: "In progress", to: "status=in_progress" },
  { k: "approachingDeadline", label: "Approaching deadline", to: "view=approaching", tone: "warning" },
  { k: "overdue", label: "Overdue", to: "view=overdue", tone: "bad" },
  { k: "awaitingQA", label: "Awaiting QA", to: "status=ready_for_qa,qa_in_progress" },
  { k: "awaitingReview", label: "Awaiting review", to: "view=awaitingReview" },
  { k: "awaitingRelease", label: "Awaiting release", to: "view=awaitingRelease" },
  { k: "resolved", label: "Resolved", to: "status=resolved" },
  { k: "closed", label: "Closed", to: "status=closed" },
];

function NewTicketDialog({ meta, restaurants, onClose, onCreated }) {
  const [v, setV] = useState({ restaurantId: "", title: "", category: "", module: "", description: "", suggestedPriority: "medium" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (x) => setV((p) => ({ ...p, [k]: x && x.target ? x.target.value : x }));
  const { toast } = useToast();
  const submit = async () => {
    if (!v.restaurantId) return toast.error("Choose a restaurant.");
    if (v.title.trim().length < 3) return toast.error("Enter a ticket title (at least 3 characters).");
    if (!v.category) return toast.error("Choose a category.");
    if (!v.module) return toast.error("Choose the affected module.");
    if (v.description.trim().length < 10) return toast.error("Describe the problem (at least 10 characters).");
    setBusy(true); setError("");
    try { const r = await api.createTicketFor(v); toast.success("Ticket created"); onCreated(r.ticketId); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="New ticket on behalf of a restaurant" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create ticket" wide>
      <CustomDropdown label="Restaurant" required value={v.restaurantId} onChange={set("restaurantId")} options={restaurants.map((r) => ({ value: r.id, label: r.name }))} placeholder="Choose restaurant" />
      <Field label="Title" required><input value={v.title} onChange={set("title")} maxLength={200} /></Field>
      <CustomDropdown label="Category" required value={v.category} onChange={set("category")} options={meta.categories} placeholder="Choose category" />
      <CustomDropdown label="Affected module" required value={v.module} onChange={set("module")} options={meta.modules} placeholder="Choose module" />
      <Field label="Description" required><textarea value={v.description} onChange={set("description")} /></Field>
      <CustomDropdown label="Suggested priority" value={v.suggestedPriority} onChange={set("suggestedPriority")} options={meta.priorities} placeholder={null} />
      <ErrorNote error={error} />
    </Modal>
  );
}

export default function Tickets() {
  const navigate = useNavigate();
  const [collapsed, toggleCollapsed] = useCollapse();
  const [meta, setMeta] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [dash, setDash] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.ticketApi.meta().then(setMeta).catch((e) => setError(e.message));
    api.supportRestaurants().then(setRestaurants).catch(() => {});
    Promise.all([api.ticketApi.assignable("developer"), api.ticketApi.assignable("tester")]).then(([d, t]) => {
      const testers = new Set(t.map((x) => x.id));
      const map = new Map();
      [...d, ...t].forEach((x) => map.set(x.id, { ...x, canTest: testers.has(x.id) }));
      setDevelopers([...map.values()]);
    }).catch(() => {});
  }, []);
  const loadDash = useCallback(() => api.supportDashboard().then((d) => { setDash(d); setError(""); }).catch((e) => setError(e.message)), []);
  usePolling(loadDash, 30000, []);

  return (
    <div className="inner-page" style={{ overflowY: "auto" }}>
      <PageHeader title="Ticket Management" subtitle="Complaints and support requests from every restaurant" collapsed={collapsed} onToggle={toggleCollapsed} collapseLabel="summary & filters">
        {meta && <Button3D onClick={() => setCreating(true)}>New ticket</Button3D>}
      </PageHeader>
      <ErrorNote error={error} />
      {dash && (
        <Collapsible collapsed={collapsed}><div className="tk-kpis">
          {CARDS.map((c) => (
            <Link key={c.k} className="tk-kpi-link" to={`/tickets?${c.to}`}>
              <Stat label={c.label} value={dash.counts[c.k]} tone={dash.counts[c.k] > 0 ? c.tone : undefined} />
            </Link>
          ))}
        </div></Collapsible>
      )}
      <TicketList basePath="/tickets" admin meta={meta} restaurants={restaurants} developers={developers} collapsed={collapsed} />
      {creating && meta && <NewTicketDialog meta={meta} restaurants={restaurants} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/tickets/${id}`)} />}
    </div>
  );
}
