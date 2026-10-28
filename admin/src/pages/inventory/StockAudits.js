/**
 * StockAudits.js — physical stock counts. Count (blind by default) -> submit -> a second person approves ->
 * the differences are posted to the stock ledger as adjustments. Nothing changes stock until the final step.
 */
import React, { useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, Field, Modal, PageHead, Pager, dateTime, errText, money, qty, usePagedList, useRef_ } from "./InvUi";
import { History, ReasonDialog, StatusBadge } from "./PurchUi";

function NewAudit({ locations, onClose, onDone }) {
  const { venueParam } = useVenue();
  const { toast } = useToast();
  const cats = useRef_("/inventory/categories", {});
  const [f, setF] = useState({ title: "", locationId: "", categoryId: "", blind: true });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post("/automation/audits", { ...f, locationId: f.locationId || undefined, categoryId: f.categoryId || undefined }, { params: venueParam() }); toast.success(`${data.auditNo} opened with ${data.lineCount} lines`); onDone(data.id); }
    catch (err) { toast.error(errText(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title="New stock audit" onClose={onClose} footer={<><button type="button" className="inv-btn" onClick={onClose}>Cancel</button><button type="submit" form="aud-new" className="inv-btn inv-btn-primary" disabled={busy}>{busy ? "Opening…" : "Open audit"}</button></>}>
      <form id="aud-new" onSubmit={submit}>
        <div className="inv-grid">
          <Field label="Title" full><input className="inv-input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Weekly dry store count" /></Field>
          <Field label="Storage location" hint="Leave empty to count the whole branch"><select className="inv-select" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">All locations</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
          <Field label="Category"><select className="inv-select" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Blind count" full hint="Counters do not see the system quantity until the counts are submitted."><label><input type="checkbox" checked={f.blind} onChange={(e) => setF({ ...f, blind: e.target.checked })} /> Hide system quantities while counting</label></Field>
        </div>
        <div className="inv-muted">The audit takes a snapshot of today's stock. Movements after it opens are not hidden: variances are measured against the snapshot.</div>
      </form>
    </Modal>
  );
}

function AuditSheet({ id, onClose, onChanged }) {
  const { hasModulePermission } = useAuth();
  const { venueParam } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("stockAudits", "write");
  const canApprove = hasModulePermission("purchaseApprovals", "write");
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null);
  const load = React.useCallback(async () => {
    try { const { data } = await api.get(`/automation/audits/${id}`, { params: venueParam() }); setA(data); setEdits({}); } catch (e) { setErr(errText(e)); }
  }, [id, venueParam]);
  React.useEffect(() => { load(); }, [load]);

  const act = async (path, body = {}, msg) => {
    setBusy(true);
    try { await api.post(`/automation/audits/${id}/${path}`, body, { params: venueParam() }); if (msg) toast.success(msg); await load(); onChanged(); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); setDlg(null); }
  };
  const saveCounts = async () => {
    const counts = Object.entries(edits).map(([index, v]) => ({ index: Number(index), qty: v.qty === "" ? null : v.qty, reason: v.reason }));
    if (!counts.length) return true;
    try { await api.put(`/automation/audits/${id}/counts`, { counts }, { params: venueParam() }); await load(); return true; }
    catch (e) { toast.error(errText(e)); return false; }
  };
  const save = async () => { setBusy(true); if (await saveCounts()) toast.success("Counts saved"); setBusy(false); };
  const submit = async () => { setBusy(true); if (await saveCounts()) await act("submit", {}, "Submitted for approval"); setBusy(false); };
  const setE = (i, k, v) => setEdits((p) => ({ ...p, [i]: { ...(p[i] || {}), [k]: v } }));

  if (err) return <Modal title="Stock audit" onClose={onClose}><div className="inv-banner">{err}</div></Modal>;
  if (!a) return <Modal title="Stock audit" onClose={onClose}>Loading…</Modal>;
  const counting = a.status === "counting";
  const showVar = !counting || !a.blind;
  const cols = [
    { key: "itemName", label: "Item", render: (l) => <><span className="inv-strong">{l.itemName}</span><div className="inv-muted">{l.batchNo ? `Batch ${l.batchNo}` : l.sku}</div></> },
    ...(showVar ? [{ key: "system", label: "System", num: true, render: (l) => `${qty(l.system)} ${l.unit}` }] : []),
    { key: "counted", label: `Counted (${a.lines[0]?.unit || ""})`, num: true, render: (l) => counting && canWrite
      ? <input className="inv-input inv-w90" aria-label={`Count for ${l.itemName}`} inputMode="decimal" value={edits[l.index]?.qty ?? (l.counted ?? "")} onChange={(e) => setE(l.index, "qty", e.target.value)} />
      : (l.counted === null ? "—" : qty(l.counted)) },
    ...(showVar ? [
      { key: "variance", label: "Difference", num: true, render: (l) => (l.variance === null ? "—" : <span style={{ color: l.variance < 0 ? "#dc2626" : l.variance > 0 ? "#15803d" : undefined }}>{l.variance > 0 ? "+" : ""}{qty(l.variance)}</span>) },
      { key: "varianceValue", label: "Value", num: true, render: (l) => (l.varianceValue ? money(l.varianceValue) : "—") },
    ] : []),
    { key: "reason", label: "Reason", render: (l) => counting && canWrite
      ? <input className="inv-input" aria-label={`Reason for ${l.itemName}`} maxLength={300} value={edits[l.index]?.reason ?? l.reason} onChange={(e) => setE(l.index, "reason", e.target.value)} placeholder="Needed if different" />
      : l.reason },
    ...(a.status === "posted" ? [{ key: "posted", label: "", render: (l) => (l.posted ? <Badge tone="green">posted</Badge> : "") }] : []),
  ];
  return (
    <Modal wide title={`${a.auditNo}${a.title ? ` — ${a.title}` : ""}`} onClose={onClose}
      footer={<>
        <button type="button" className="inv-btn" onClick={onClose}>Close</button>
        {counting && canWrite && <><button type="button" className="inv-btn" disabled={busy || !Object.keys(edits).length} onClick={save}>Save counts</button><button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={submit}>Submit for approval</button></>}
        {a.status === "pending_approval" && canApprove && <><button type="button" className="inv-btn inv-btn-danger" disabled={busy} onClick={() => setDlg("reject")}>Send back for recount</button><button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={() => act("approve", {}, "Approved")}>Approve</button></>}
        {a.status === "approved" && canApprove && <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={() => act("post", {}, "Adjustments posted to the stock ledger")}>Post adjustments</button>}
        {["counting", "pending_approval", "approved"].includes(a.status) && canWrite && <button type="button" className="inv-btn inv-btn-danger" disabled={busy} onClick={() => setDlg("cancel")}>Cancel audit</button>}
      </>}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <StatusBadge status={a.status} /> <span className="inv-muted">{a.counted}/{a.lineCount} counted · opened by {a.createdByName}</span>
        {a.status !== "counting" && <span>Shrinkage <b>{money(a.shrink)}</b> · surplus <b>{money(a.surplus)}</b></span>}
      </div>
      {counting && a.blind && <div className="inv-banner" style={{ margin: "10px 0" }}>Blind count: system quantities are hidden. Enter 0 for anything not on the shelf. Counts are in each item's base unit.</div>}
      <DataTable columns={cols} rows={a.lines} rowKey={(l) => l.index} />
      <History entries={a.history} />
      {dlg && <ReasonDialog title={dlg === "reject" ? "Send back for recount" : "Cancel this audit"} busy={busy} danger confirmLabel="Confirm" onClose={() => setDlg(null)} onSubmit={(r) => act(dlg === "reject" ? "reject" : "cancel", { reason: r }, dlg === "reject" ? "Sent back for recount" : "Audit cancelled")} />}
    </Modal>
  );
}

export default function StockAudits() {
  const { hasModulePermission } = useAuth();
  const { currentVenue } = useVenue();
  const canWrite = hasModulePermission("stockAudits", "write");
  const [status, setStatus] = useState("");
  const list = usePagedList("/automation/audits", { status });
  const locations = useRef_("/inventory/locations", {});
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const cols = [
    { key: "auditNo", label: "Audit", render: (r) => <button type="button" className="inv-link" onClick={() => setOpen(r.id)}>{r.auditNo}</button> },
    { key: "title", label: "Title" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "progress", label: "Counted", num: true, render: (r) => `${r.counted}/${r.lineCount}` },
    { key: "totalVariance", label: "Net difference", num: true, render: (r) => (r.status === "counting" ? "—" : money(r.totalVariance)) },
    { key: "createdByName", label: "Opened by" },
    { key: "createdAt", label: "Opened", render: (r) => dateTime(r.createdAt) },
  ];
  return (
    <div className="inv-page">
      <PageHead title="Stock audits" crumb="Automation">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" onClick={() => setCreating(true)}>New audit</button>}
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      <div className="inv-card">
        <div className="inv-toolbar">
          <select className="inv-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>{["counting", "pending_approval", "approved", "posted", "cancelled"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <DataTable columns={cols} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(r) => r.id} empty="No audits yet. Open one to count what is physically on the shelves." />
        <Pager page={list.page} setPage={list.setPage} total={list.total} pageSize={list.pageSize} />
      </div>
      {creating && <NewAudit locations={locations.filter((l) => l.status === "active")} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); list.reload(); setOpen(id); }} />}
      {open && <AuditSheet id={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </div>
  );
}
