/** PurchaseRequests.js — raise, submit, approve and convert purchase requests. */
import React, { useCallback, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Btn, DataTable, DateInput, Field, Modal, PageHead, SearchBox, Select, Toolbar, dateShort, errText, money, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";
import { History, KeyVals, LineEditor, ReasonDialog, StatusBadge, linesPayload, statusLabel } from "./PurchUi";

const STATUSES = ["draft", "pending_approval", "changes_requested", "approved", "rfq_issued", "ordered", "rejected", "cancelled"];
const blank = () => ({ purpose: "", priority: "normal", requiredDate: "", department: "", notes: "", preferredSupplierId: "", lines: [] });

export default function PurchaseRequests() {
  const { hasModulePermission } = useAuth();
  const { venueId } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseRequests", "write");
  const canApprove = hasModulePermission("purchaseApprovals", "write");
  const canRfq = hasModulePermission("purchaseRfq", "write");
  const canPo = hasModulePermission("purchaseOrders", "write");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/purchase/requests", { status, search: dSearch });
  const items = useRef_("/inventory/items", { status: "active", limit: 200 }, (d) => d.data);
  const suppliers = useRef_("/inventory/suppliers", { status: "active", limit: 200 }, (d) => d.data);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [ask, setAsk] = useState(null);
  const [rfqDlg, setRfqDlg] = useState(null);
  const [poDlg, setPoDlg] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast.success(okMsg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);

  const open = async (id) => { try { setDetail((await api.get(`/purchase/requests/${id}`)).data); } catch (e) { toast.error(errText(e)); } };
  const edit = (pr) => setForm({
    id: pr.id, purpose: pr.purpose, priority: pr.priority, requiredDate: pr.requiredDate ? pr.requiredDate.slice(0, 10) : "", department: pr.department, notes: pr.notes, preferredSupplierId: pr.preferredSupplierId || "",
    lines: pr.lines.map((l) => ({ itemId: l.itemId, qty: l.enteredQty, unit: l.enteredUnit, unitPrice: "" })),
  });

  const save = async (ev) => {
    ev.preventDefault();
    let lines;
    try { lines = linesPayload(form.lines); } catch (e) { toast.error(e.message); return; }
    const body = { purpose: form.purpose, priority: form.priority, requiredDate: form.requiredDate || null, department: form.department, notes: form.notes, preferredSupplierId: form.preferredSupplierId || null, lines };
    const r = await run(() => (form.id ? api.patch(`/purchase/requests/${form.id}`, body) : api.post("/purchase/requests", body, { params: { venueId } })), "Request saved");
    if (r) { setForm(null); setDetail(null); }
  };
  const act = async (pr, path, body = {}, msg) => {
    const r = await run(() => api.post(`/purchase/requests/${pr.id}/${path}`, body), msg);
    if (r) { setAsk(null); setRfqDlg(null); setPoDlg(null); setDetail(r.data); }
  };

  const columns = [
    { key: "prNo", label: "PR no.", render: (r) => <span className="clickable" onClick={() => open(r.id)}>{r.prNo}</span> },
    { key: "requestedByName", label: "Requested by" },
    { key: "purpose", label: "Purpose", render: (r) => r.purpose || <span className="inv-muted">—</span> },
    { key: "priority", label: "Priority", render: (r) => <span className={r.priority === "urgent" ? "inv-urgent" : ""}>{r.priority}</span> },
    { key: "requiredDate", label: "Needed by", render: (r) => dateShort(r.requiredDate) },
    { key: "total", label: "Est. value", num: true, render: (r) => money(r.total) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Purchase requests" count={`${list.total} request(s)`}>
        {canWrite && <Btn type="button" kind="primary" onClick={() => setForm(blank())}>+ New request</Btn>}
      </PageHead>
      <div className="inv-stack">
        <Toolbar>
          <SearchBox placeholder=" Search PR no., purpose, requester" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        </Toolbar>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No purchase requests yet." more={list} />
      </div>

      {form && (
        <Modal wide title={form.id ? "Edit request" : "New purchase request"} onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="pr-form" kind="primary" disabled={busy}>Save draft</Btn></>}>
          <form id="pr-form" onSubmit={save}>
            <div className="inv-grid">
              <Field label="Purpose" full><input className="inv-input" maxLength={500} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
              <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
              <Field label="Needed by"><DateInput value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} /></Field>
              <Field label="Department"><input className="inv-input" maxLength={80} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <Field label="Preferred supplier"><Select value={form.preferredSupplierId} onChange={(e) => setForm({ ...form, preferredSupplierId: e.target.value })}><option value="">None</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            </div>
            <div className="inv-section">Items</div>
            <LineEditor items={items} value={form.lines} onChange={(lines) => setForm({ ...form, lines })} />
            <Field label="Notes" full><textarea className="inv-textarea" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="inv-hint">Estimated value uses the current average stock cost. The server calculates it when you save.</div>
          </form>
        </Modal>
      )}

      {detail && !form && (
        <Modal wide title={`${detail.prNo}`} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            {["draft", "changes_requested"].includes(detail.status) && canWrite && <>
              <Btn type="button" kind="plain" onClick={() => edit(detail)}>Edit</Btn>
              <Btn type="button" kind="primary" disabled={busy} onClick={() => act(detail, "submit", {}, "Submitted")}>Submit for approval</Btn></>}
            {detail.status === "pending_approval" && canApprove && <>
              <Btn type="button" kind="primary" disabled={busy} onClick={() => act(detail, "approve", {}, "Approved")}>Approve</Btn>
              <Btn type="button" kind="plain" onClick={() => setAsk({ title: "Request changes", path: "request-changes", label: "What needs to change?" })}>Request changes</Btn>
              <Btn type="button" kind="danger" onClick={() => setAsk({ title: "Reject request", path: "reject", label: "Reason for rejection", danger: true })}>Reject</Btn></>}
            {detail.status === "approved" && canRfq && <Btn type="button" kind="plain" onClick={() => setRfqDlg({ supplierIds: detail.preferredSupplierId ? [detail.preferredSupplierId] : [] })}>Create RFQ</Btn>}
            {detail.status === "approved" && canPo && <Btn type="button" kind="primary" onClick={() => setPoDlg({ supplierId: detail.preferredSupplierId || "" })}>Create purchase order</Btn>}
            {["draft", "pending_approval", "changes_requested", "approved"].includes(detail.status) && canWrite && !detail.poIds?.length &&
              <Btn type="button" kind="danger" onClick={() => setAsk({ title: "Cancel request", path: "cancel", label: "Reason for cancelling", danger: true })}>Cancel request</Btn>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Requested by", detail.requestedByName], ["Priority", detail.priority], ["Needed by", dateShort(detail.requiredDate)], ["Department", detail.department], ["Purpose", detail.purpose], ["Notes", detail.notes], ["Source", detail.source === "reorder" ? "Reorder planning" : undefined]]} />
          <div className="inv-tablewrap"><table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Requested</th><th className="inv-num">In stock when submitted</th><th className="inv-num">Est. cost / {"base unit"}</th><th className="inv-num">Est. value</th></tr></thead>
            <tbody>{detail.lines.map((l) => (<tr key={l.itemId}><td>{l.itemName}<div className="inv-muted">{l.sku}</div></td><td className="inv-num">{qty(l.enteredQty)} {l.enteredUnit}<div className="inv-muted">{qty(l.qty)} {l.unit}</div></td><td className="inv-num">{detail.status === "draft" ? "—" : `${qty(l.available)} ${l.unit}`}</td><td className="inv-num">{money(l.estUnitCost)}</td><td className="inv-num">{money(l.estTotal)}</td></tr>))}</tbody>
          </table></div>
          <div className="inv-totals"><div className="inv-grand"><span>Estimated total</span><span>{money(detail.total)}</span></div></div>
          <History entries={detail.approvals} />
        </Modal>
      )}

      {ask && <ReasonDialog {...ask} busy={busy} confirmLabel="Confirm" onClose={() => setAsk(null)} onSubmit={(t) => act(detail, ask.path, ask.path === "cancel" ? { reason: t } : { comment: t }, "Done")} />}

      {rfqDlg && (
        <Modal title="Create RFQ" onClose={() => setRfqDlg(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setRfqDlg(null)}>Back</Btn><Btn type="button" kind="primary" disabled={busy || !rfqDlg.supplierIds.length} onClick={() => act(detail, "convert-to-rfq", { supplierIds: rfqDlg.supplierIds }, "RFQ created as a draft")}>Create RFQ</Btn></>}>
          <div className="inv-hint">Choose the suppliers to invite. You can edit the RFQ before sending.</div>
          {suppliers.map((s) => (
            <label key={s.id} className="checkbox-item inv-check"><input type="checkbox" checked={rfqDlg.supplierIds.includes(s.id)} onChange={(e) => setRfqDlg({ supplierIds: e.target.checked ? [...rfqDlg.supplierIds, s.id] : rfqDlg.supplierIds.filter((x) => x !== s.id) })} />{s.name}</label>
          ))}
        </Modal>
      )}
      {poDlg && (
        <Modal title="Create purchase order" onClose={() => setPoDlg(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setPoDlg(null)}>Back</Btn><Btn type="button" kind="primary" disabled={busy || !poDlg.supplierId} onClick={() => act(detail, "convert-to-po", { supplierId: poDlg.supplierId }, "Purchase order created as a draft")}>Create order</Btn></>}>
          <Field label="Supplier" required hint="Prices come from the estimate; edit them on the order before submitting."><Select value={poDlg.supplierId} onChange={(e) => setPoDlg({ supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </Modal>
      )}
    </div>
  );
}
