/** SupplierReturns.js — return goods to suppliers (approval → dispatch → credit note) and the quarantine list. */
import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Btn, DataTable, Field, Modal, PageHead, SearchBox, Select, Tabs, Toolbar, dateShort, errText, money, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";
import { History, KeyVals, ReasonDialog, StatusBadge, statusLabel } from "./PurchUi";

const CATS = ["damaged", "expired", "quality", "wrong_item", "short_shelf_life", "excess", "other"];

export default function SupplierReturns() {
  const { hasModulePermission } = useAuth();
  const { venueId, venueParam } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseReturns", "write");
  const canApprove = hasModulePermission("purchaseApprovals", "write");
  const [tab, setTab] = useState("returns");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/receiving/returns", { status, search: dSearch });
  const suppliers = useRef_("/inventory/suppliers", { limit: 200 }, (d) => d.data);
  const locations = useRef_("/inventory/locations", {}, (d) => d);
  const items = useRef_("/inventory/items", { limit: 200 }, (d) => d.data);
  const [quar, setQuar] = useState({ rows: [], loading: true, error: "" });
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [ask, setAsk] = useState(null);
  const [credit, setCredit] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadQ = useCallback(async () => {
    setQuar((q) => ({ ...q, loading: true, error: "" }));
    try { setQuar({ rows: (await api.get("/receiving/quarantine", { params: venueParam() })).data.data, loading: false, error: "" }); }
    catch (e) { setQuar({ rows: [], loading: false, error: errText(e, "Could not load quarantine") }); }
  }, [venueParam]);
  useEffect(() => { if (tab === "quarantine") loadQ(); }, [tab, loadQ, venueId]);

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);
  const open = async (id) => { try { setDetail((await api.get(`/receiving/returns/${id}`)).data); } catch (e) { toast.error(errText(e)); } };
  const act = async (path, body = {}, msg) => { const r = await run(() => api.post(`/receiving/returns/${detail.id}/${path}`, body), msg); if (r) { setAsk(null); setCredit(null); setDetail(r.data); } };

  const startFromQuarantine = (q) => setForm({ supplierId: "", reasonCategory: "quality", notes: "", lines: [{ itemId: q.itemId, qty: String(q.quarantined), unit: q.unit, source: "quarantine", locationId: q.locationId, batchNo: q.batchNo, reason: "" }] });
  const save = async (ev) => {
    ev.preventDefault();
    if (!form.supplierId) { toast.error("Choose the supplier"); return; }
    const lines = form.lines.filter((l) => Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty), unit: l.unit, source: l.source, locationId: l.locationId, batchNo: l.batchNo, reason: l.reason }));
    if (!lines.length) { toast.error("Enter a quantity to return"); return; }
    const r = await run(() => api.post("/receiving/returns", { supplierId: form.supplierId, reasonCategory: form.reasonCategory, notes: form.notes, lines }, { params: { venueId } }), "Return saved as a draft");
    if (r) { setForm(null); setTab("returns"); setDetail(r.data); }
  };

  const columns = [
    { key: "returnNo", label: "Return no.", render: (r) => <span className="clickable" onClick={() => open(r.id)}>{r.returnNo}</span> },
    { key: "supplierName", label: "Supplier" }, { key: "reasonCategory", label: "Reason", render: (r) => statusLabel(r.reasonCategory) },
    { key: "total", label: "Value", num: true, render: (r) => money(r.total) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  const qcols = [
    { key: "itemName", label: "Item" }, { key: "locationName", label: "Location" }, { key: "batchNo", label: "Batch", render: (r) => r.batchNo || "—" },
    { key: "expiryDate", label: "Expiry", render: (r) => dateShort(r.expiryDate) },
    { key: "quarantined", label: "Held", num: true, render: (r) => `${qty(r.quarantined)} ${r.unit}` }, { key: "value", label: "Value", num: true, render: (r) => money(r.value) },
    ...(canWrite ? [{ key: "act", label: "", render: (r) => <Btn type="button" kind="plain" sm onClick={() => startFromQuarantine(r)}>Return to supplier</Btn> }] : []),
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Supplier returns & quarantine">
        {canWrite && <Btn type="button" kind="primary" onClick={() => setForm({ supplierId: "", reasonCategory: "quality", notes: "", lines: [] })}>+ New return</Btn>}
      </PageHead>
      <Tabs tabs={[["returns", "Returns"], ["quarantine", "Quarantine"]]} value={tab} onChange={setTab} />
      {tab === "returns" ? (
        <div className="inv-stack">
          <Toolbar>
            <SearchBox placeholder=" Search return no." aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["draft", "pending_approval", "approved", "rejected", "dispatched", "credited", "cancelled"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select>
          </Toolbar>
          <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No supplier returns." more={list} />
        </div>
      ) : (
        <div className="inv-stack">
          <DataTable columns={qcols} rows={quar.rows} loading={quar.loading} error={quar.error} onRetry={loadQ} rowKey={(r) => `${r.itemId}|${r.locationId}|${r.batchNo}`} empty="Nothing is in quarantine." />
          <div className="inv-hint" style={{ padding: 12 }}>To release or write off quarantined stock, use Stock Overview.</div>
        </div>
      )}

      {form && (
        <Modal wide title="New supplier return" onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="ret-form" kind="primary" disabled={busy}>Save draft</Btn></>}>
          <form id="ret-form" onSubmit={save}>
            <div className="inv-grid">
              <Field label="Supplier" required><Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Reason"><Select value={form.reasonCategory} onChange={(e) => setForm({ ...form, reasonCategory: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{statusLabel(c)}</option>)}</Select></Field>
            </div>
            {form.lines.length === 0 && <div className="inv-hint">Start a return from the Quarantine tab, or add a line from stock below.</div>}
            {form.lines.map((l, i) => (
              <div key={i} className="inv-row">
                <Field label="Item"><Select value={l.itemId} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value, unit: items.find((t) => t.id === e.target.value)?.baseUnit || x.unit } : x)) })}>{items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
                <Field label={`Qty (${l.unit})`}><input className="inv-input inv-w90" inputMode="decimal" value={l.qty} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} /></Field>
                <Field label="From"><Select value={l.source} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })}><option value="stock">Available stock</option><option value="quarantine">Quarantine</option></Select></Field>
                <Field label="Location"><Select value={l.locationId} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, locationId: e.target.value } : x)) })}>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
                <Field label="Batch"><input className="inv-input inv-w90" value={l.batchNo} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, batchNo: e.target.value } : x)) })} /></Field>
                <Btn type="button" kind="plain" sm onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>Remove</Btn>
              </div>
            ))}
            <div><Btn type="button" kind="plain" sm disabled={!items.length || !locations.length} onClick={() => setForm({ ...form, lines: [...form.lines, { itemId: items[0].id, qty: "", unit: items[0].baseUnit, source: "stock", locationId: locations[0].id, batchNo: "", reason: "" }] })}>+ Add line</Btn></div>
            <Field label="Notes" full><textarea className="inv-textarea" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="inv-hint">To return goods rejected at the gate, or to make the quantity outstanding on the order again, create the return from the receipt/order screens or the API (reopen option).</div>
          </form>
        </Modal>
      )}

      {detail && !form && (
        <Modal wide title={detail.returnNo} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            {["draft", "rejected"].includes(detail.status) && canWrite && <Btn type="button" kind="primary" disabled={busy} onClick={() => act("submit", {}, "Submitted for approval")}>Submit for approval</Btn>}
            {detail.status === "pending_approval" && canApprove && <>
              <Btn type="button" kind="primary" disabled={busy} onClick={() => act("approve", {}, "Approved")}>Approve</Btn>
              <Btn type="button" kind="danger" onClick={() => setAsk({ title: "Reject return", path: "reject", label: "Reason for rejection", danger: true })}>Reject</Btn></>}
            {detail.status === "approved" && canWrite && <Btn type="button" kind="primary" disabled={busy} onClick={() => act("dispatch", {}, "Dispatched — stock deducted")}>Dispatch (deduct stock)</Btn>}
            {detail.status === "dispatched" && canWrite && <Btn type="button" kind="primary" onClick={() => setCredit({ creditNoteNo: "", amount: String(detail.total) })}>Record credit note</Btn>}
            {["draft", "pending_approval", "rejected", "approved"].includes(detail.status) && canWrite && <Btn type="button" kind="danger" onClick={() => setAsk({ title: "Cancel return", path: "cancel", label: "Reason for cancelling", danger: true })}>Cancel</Btn>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Supplier", detail.supplierName], ["Order", detail.poNo], ["Reason", statusLabel(detail.reasonCategory)], ["Dispatched", detail.dispatchedAt ? dateShort(detail.dispatchedAt) : undefined], ["Credit note", detail.creditNoteNo ? `${detail.creditNoteNo} — ${money(detail.creditAmount)} (${detail.creditVariance === 0 ? "matches" : `${money(detail.creditVariance)} vs value`})` : undefined], ["Notes", detail.notes]]} />
          <div className="inv-tablewrap"><table className="inv-table">
            <thead><tr><th>Item</th><th>From</th><th>Batch</th><th className="inv-num">Qty</th><th className="inv-num">Value</th></tr></thead>
            <tbody>{detail.lines.map((l, i) => (<tr key={i}><td>{l.itemName}{l.reason && <div className="inv-muted">{l.reason}</div>}</td><td>{statusLabel(l.source)}</td><td>{l.batchNo || "—"}</td><td className="inv-num">{qty(l.qty)} {l.unit}</td><td className="inv-num">{money(l.value)}</td></tr>))}</tbody>
          </table></div>
          <div className="inv-totals"><div className="inv-grand"><span>Total value</span><span>{money(detail.total)}</span></div></div>
          <History entries={detail.history} />
        </Modal>
      )}
      {ask && <ReasonDialog {...ask} busy={busy} onClose={() => setAsk(null)} onSubmit={(t) => act(ask.path, { reason: t }, "Done")} />}
      {credit && (
        <Modal title="Record supplier credit note" onClose={() => setCredit(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setCredit(null)}>Back</Btn><Btn type="button" kind="primary" disabled={busy || !credit.creditNoteNo.trim()} onClick={() => act("credit", { creditNoteNo: credit.creditNoteNo, amount: Number(credit.amount) || 0 }, "Credit recorded")}>Save</Btn></>}>
          <Field label="Credit note no." required><input className="inv-input" maxLength={60} value={credit.creditNoteNo} onChange={(e) => setCredit({ ...credit, creditNoteNo: e.target.value })} /></Field>
          <Field label="Credit amount (₹)" hint="Any difference from the return value is shown on the return."><input className="inv-input" inputMode="decimal" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
