/** SupplierReturns.js — return goods to suppliers (approval → dispatch → credit note) and the quarantine list. */
import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, Field, Modal, PageHead, SearchBox, Select, Tabs, Toolbar, dateShort, errText, money, qty, useDebounced, usePagedList, useOpenParam, useRowFilters, useRef_, ExportBtn } from "../pi-shared/InvUi";
import { History, KeyVals, ReasonDialog, StatusBadge, statusLabel } from "../pi-shared/PurchUi";

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
  const rf = useRowFilters(list.rows, { supplier: "supplierName" });
  const suppliers = useRef_("/inventory/suppliers", { limit: 200 }, (d) => d.data);
  const locations = useRef_("/inventory/locations", {}, (d) => d);
  const items = useRef_("/inventory/items", { limit: 200 }, (d) => d.data);
  const [quar, setQuar] = useState({ rows: [], loading: true, error: "" });
  const [form, setForm] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [caps, setCaps] = useState({}); // itemId -> { ordered, received, returned, max } for the chosen order
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

  // orders that have had goods received are the only ones a return can be raised against
  const openForm = useCallback(async (base) => {
    setForm(base);
    try {
      const [a, b, c] = await Promise.all(["partially_received", "received", "closed"].map((st) => api.get("/purchase/orders", { params: { ...venueParam(), status: st, limit: 100 } })));
      setOrders([...a.data.data, ...b.data.data, ...c.data.data].filter((o) => o.lines.some((l) => Number(l.received) > 0)).sort((x, y) => String(y.poNo).localeCompare(String(x.poNo))));
      setStockRows((await api.get("/inventory/stock", { params: { ...venueParam(), limit: 200 } })).data.data);
    } catch (e) { toast.error(errText(e, "Could not load orders")); }
  }, [venueParam, toast]);

  const loadCaps = useCallback(async (poId) => {
    setCaps({});
    if (!poId) return;
    try { setCaps(Object.fromEntries((await api.get("/receiving/returns/returnable", { params: { poId } })).data.map((c) => [c.itemId, c]))); }
    catch (e) { toast.error(errText(e, "Could not load returnable quantities")); }
  }, [toast]);

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);
  const open = async (id) => { try { setDetail((await api.get(`/receiving/returns/${id}`)).data); } catch (e) { toast.error(errText(e)); } };
  const act = async (path, body = {}, msg) => { const r = await run(() => api.post(`/receiving/returns/${detail.id}/${path}`, body), msg); if (r) { setAsk(null); setCredit(null); setDetail(r.data); } };

  const startFromQuarantine = (q) => openForm({ fromQuarantine: true, poId: "", supplierId: "", reasonCategory: "quality", returnReason: "", notes: "", lines: [{ itemId: q.itemId, qty: String(q.quarantined), unit: q.unit, source: "quarantine", locationId: q.locationId, batchNo: q.batchNo, reason: "" }] });
  const save = async (ev) => {
    ev.preventDefault();
    if (!form.poId && !form.supplierId) { toast.error("Choose the order number"); return; }
    if (!form.returnReason.trim()) { setForm({ ...form, reasonErr: "Say why the goods are being returned" }); return; }
    const lines = form.lines.filter((l) => Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty), unit: l.unit, source: l.source, locationId: l.locationId, batchNo: l.batchNo, reason: l.reason }));
    if (!lines.length) { toast.error("Enter a quantity to return"); return; }
    const over = lines.find((l) => caps[l.itemId] && l.qty > caps[l.itemId].max);
    if (over) { toast.error(`${caps[over.itemId].itemName}: you can return at most ${qty(caps[over.itemId].max)} ${over.unit}`); return; }
    const r = await run(() => api.post("/receiving/returns", { ...(form.poId ? { poId: form.poId } : { supplierId: form.supplierId }), reasonCategory: form.reasonCategory, returnReason: form.returnReason.trim(), notes: form.notes, lines }, { params: { venueId } }), "Return saved as a draft");
    if (r) { setForm(null); setTab("returns"); setDetail(r.data); }
  };

  // Refund = the supplier's credit note: recorded once the return is credited, expected once the goods have been dispatched.
  const refundCell = (r) => {
    if (r.status === "credited") return <><b>{money(r.creditAmount)}</b><div className="inv-muted">{r.creditNoteNo}{r.creditVariance < 0 ? ` · ${money(-r.creditVariance)} less than value` : ""}</div></>;
    if (r.status === "dispatched") return <Badge tone="blue">Awaiting refund</Badge>;
    return <span className="inv-muted">—</span>;
  };
  const columns = [
    { key: "returnNo", label: "Return no.", render: (r) => <>{r.returnNo}</> },
    { key: "createdAt", label: "Date", render: (r) => dateShort(r.createdAt) },
    { key: "supplierName", label: "Supplier" },
    { key: "items", label: "Returned items", sort: false, exp: (r) => r.lines.map((l) => `${l.itemName} — ${qty(l.qty)} ${l.unit}`).join("; "), render: (r) => r.lines.map((l, i) => <div key={i}>{l.itemName} <span className="inv-muted">— {qty(l.qty)} {l.unit}</span></div>) },
    { key: "reasonCategory", label: "Reason", render: (r) => statusLabel(r.reasonCategory) },
    { key: "returnReason", label: "Why returned", render: (r) => r.returnReason || "—" },
    { key: "total", label: "Value", num: true, render: (r) => money(r.total) },
    { key: "creditAmount", label: "Refund", num: true, sortValue: (r) => (r.status === "credited" ? r.creditAmount : -1), render: refundCell },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  const qcols = [
    { key: "itemName", label: "Item" }, { key: "locationName", label: "Location" }, { key: "batchNo", label: "Batch", render: (r) => r.batchNo || "—" },
    { key: "expiryDate", label: "Expiry", render: (r) => dateShort(r.expiryDate) },
    { key: "quarantined", label: "Held", num: true, render: (r) => `${qty(r.quarantined)} ${r.unit}` }, { key: "value", label: "Value", num: true, render: (r) => money(r.value) },
    ...(canWrite ? [{ key: "act", label: "", render: (r) => <Btn type="button" kind="plain" sm onClick={() => startFromQuarantine(r)}>Return to supplier</Btn> }] : []),
  ];

  useOpenParam(open);
  return (
    <div className="inner-page inv-page">
      <PageHead title="Supplier returns & quarantine" count={tab === "returns" ? `${list.total} return(s)` : undefined}>
        {tab === "returns" ? <ExportBtn list={list} apply={rf.apply} columns={columns} name="supplier_returns" sheet="Supplier returns" /> : <ExportBtn rows={quar.rows} columns={qcols} name="quarantine" sheet="Quarantine" />}
        {canWrite && <Btn type="button" kind="primary" onClick={() => openForm({ poId: "", supplierId: "", reasonCategory: "quality", returnReason: "", notes: "", lines: [] })}>+ New return</Btn>}
      </PageHead>
      <Tabs tabs={[["returns", "Returns"], ["quarantine", "Quarantine"]]} value={tab} onChange={setTab} />
      {tab === "returns" ? (
        <div className="inv-stack">
          <Toolbar>
            <SearchBox placeholder=" Search return no." aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["draft", "pending_approval", "approved", "rejected", "dispatched", "credited", "cancelled"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select>
            {rf.controls}
        </Toolbar>
          <DataTable detail="purchase/returns" columns={columns} rows={rf.filtered} loading={list.loading} error={list.error} onRetry={list.reload} empty="No supplier returns." more={list} />
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
              {form.fromQuarantine ? (
                <Field label="Supplier" required><Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              ) : (
                <Field label="Order number" required><Select value={form.poId} onChange={(e) => { setForm({ ...form, poId: e.target.value, lines: [] }); loadCaps(e.target.value); }}><option value="">Choose order</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.poNo} · {o.supplierName}</option>)}</Select></Field>
              )}
              <Field label="Reason"><Select value={form.reasonCategory} onChange={(e) => setForm({ ...form, reasonCategory: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{statusLabel(c)}</option>)}</Select></Field>
            </div>
            <Field label="Reason for returning" required error={form.reasonErr} full hint="Explain what is wrong with the goods — the supplier and approvers will read this."><textarea className="inv-textarea" maxLength={1000} value={form.returnReason} onChange={(e) => setForm({ ...form, returnReason: e.target.value, reasonErr: "" })} /></Field>
            {!form.fromQuarantine && (() => {
              const po = orders.find((o) => o.id === form.poId);
              if (!po) return <div className="inv-hint">Choose the order to pick the items being returned.</div>;
              const picked = new Set(form.lines.map((l) => l.itemId));
              const toggle = (l) => {
                if (picked.has(l.itemId)) { setForm({ ...form, lines: form.lines.filter((x) => x.itemId !== l.itemId) }); return; }
                const sr = stockRows.find((r) => r.itemId === l.itemId && r.available > 0);
                setForm({ ...form, lines: [...form.lines, { itemId: l.itemId, qty: "", unit: l.unit, source: "stock", locationId: sr ? sr.locationId : "", batchNo: sr ? sr.batchNo : "", reason: "" }] });
              };
              return (
                <Field label="Items to return" required full hint="You can return up to what was received on this order, less anything already returned.">
                  <div className="filter-pills">
                    {po.lines.filter((l) => (caps[l.itemId] ? caps[l.itemId].max > 0 : Number(l.received) > 0)).map((l) => (
                      <button type="button" key={l.itemId} className={`filter-pill${picked.has(l.itemId) ? " active" : ""}`} aria-pressed={picked.has(l.itemId)} onClick={() => toggle(l)}>{picked.has(l.itemId) ? "✓ " : ""}{l.itemName}</button>
                    ))}
                  </div>
                </Field>
              );
            })()}
            {form.lines.map((l, i) => {
              const upd = (patch) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              const name = items.find((t) => t.id === l.itemId)?.name || orders.find((o) => o.id === form.poId)?.lines.find((x) => x.itemId === l.itemId)?.itemName || l.itemId;
              const batches = stockRows.filter((r) => r.itemId === l.itemId && r.available > 0);
              return (
                <div key={i} className="inv-row">
                  <Field label="Item"><div className="inv-muted" style={{ paddingTop: 8 }}><b>{name}</b></div></Field>
                  <Field label={`Qty (${l.unit})`} hint={caps[l.itemId] ? `Max ${qty(caps[l.itemId].max)} ${l.unit}` : undefined}><input className="inv-input inv-w90" inputMode="decimal" value={l.qty} onChange={(e) => { let v = e.target.value.replace(/[^\d.]/g, ""); const m = caps[l.itemId] ? caps[l.itemId].max : null; if (m != null && Number(v) > m) { v = String(m); toast.error(`Only ${qty(m)} ${l.unit} of ${name} can be returned on this order`); } upd({ qty: v }); }} /></Field>
                  {l.source === "quarantine" ? (
                    <Field label="From"><div className="inv-muted" style={{ paddingTop: 8 }}>Quarantine · batch {l.batchNo || "—"}</div></Field>
                  ) : (
                    <Field label="Batch / location"><Select value={`${l.locationId}|${l.batchNo}`} onChange={(e) => { const [locationId, ...rest] = e.target.value.split("|"); upd({ locationId, batchNo: rest.join("|") }); }}>
                      {!batches.length && <option value="|">No stock available</option>}
                      {batches.map((r) => <option key={`${r.locationId}|${r.batchNo}`} value={`${r.locationId}|${r.batchNo}`}>{r.batchNo || "no batch"} · {r.locationName || locations.find((x) => x.id === r.locationId)?.name || ""} · {qty(r.available)} {l.unit}</option>)}
                    </Select></Field>
                  )}
                  {!form.fromQuarantine && <Btn type="button" kind="plain" sm onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>Remove</Btn>}
                </div>
              );
            })}
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
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Supplier", detail.supplierName], ["Order", detail.poNo], ["Reason", statusLabel(detail.reasonCategory)], ["Why returned", detail.returnReason], ["Dispatched", detail.dispatchedAt ? dateShort(detail.dispatchedAt) : undefined], ["Credit note", detail.creditNoteNo ? `${detail.creditNoteNo} — ${money(detail.creditAmount)} (${detail.creditVariance === 0 ? "matches" : `${money(detail.creditVariance)} vs value`})` : undefined], ["Notes", detail.notes]]} />
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
