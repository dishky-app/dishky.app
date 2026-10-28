/** SupplierInvoices.js — record supplier invoices, see the three-way match, approve, dispute, apply credit notes. */
import React, { useCallback, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, Field, Modal, PageHead, Pager, dateShort, errText, money, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";
import { History, KeyVals, LineEditor, ReasonDialog, StatusBadge, linesPayload, statusLabel } from "./PurchUi";

const MATCH_TONE = { matched: "green", variance: "amber", unmatched: "red" };
const LINE_TEXT = { ok: "OK", not_on_po: "Not on the order", not_received: "Nothing received yet", over_billed: "Billed more than received", price_high: "Price above the order", tax_mismatch: "GST rate differs from the order" };
const FLAG_TEXT = { no_purchase_order: "Not linked to a purchase order", line_variance: "One or more lines differ from the order or receipts", stated_total_mismatch: "Total on the paper invoice differs from the calculated total" };
const today = () => new Date().toISOString().slice(0, 10);

export default function SupplierInvoices() {
  const { hasModulePermission } = useAuth();
  const { venueId, currentVenue } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseInvoices", "write");
  const canApprove = hasModulePermission("purchaseApprovals", "write");
  const canPay = hasModulePermission("purchasePayments", "write");
  const [status, setStatus] = useState("");
  const [match, setMatch] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/finance/invoices", { status, match, search: dSearch, ...(overdue ? { overdue: "true" } : {}) });
  const items = useRef_("/inventory/items", { limit: 200 }, (d) => d.data);
  const suppliers = useRef_("/inventory/suppliers", { limit: 200 }, (d) => d.data);
  const [pos, setPos] = useState([]);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [ask, setAsk] = useState(null);
  const [credits, setCredits] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);
  const open = useCallback(async (id) => { try { setDetail((await api.get(`/finance/invoices/${id}`)).data); } catch (e) { toast.error(errText(e)); } }, [toast]);
  const act = async (path, body = {}, msg) => { const r = await run(() => api.post(`/finance/invoices/${detail.id}/${path}`, body), msg); if (r) { setAsk(null); setCredits(null); open(detail.id); } };

  const openNew = async () => {
    try {
      const rows = (await api.get("/purchase/orders", { params: { limit: 200, ...(venueId ? { venueId } : {}) } })).data.data;
      setPos(rows.filter((p) => ["sent", "partially_received", "received", "closed"].includes(p.status)));
      setForm({ poId: "", supplierId: "", invoiceNo: "", invoiceDate: today(), dueDate: "", freight: "", otherCharges: "", statedTotal: "", notes: "", lines: [] });
    } catch (e) { toast.error(errText(e)); }
  };
  const pickPo = async (poId) => {
    setForm((f) => ({ ...f, poId, lines: [] }));
    if (!poId) return;
    try {
      const b = (await api.get(`/finance/orders/${poId}/billable`)).data;
      setForm((f) => ({ ...f, poId, supplierId: b.supplierId, lines: b.lines.map((l) => ({ itemId: l.itemId, qty: String(l.billable), unit: l.unit, unitPrice: String(l.unitPrice), discountPct: l.discountPct ? String(l.discountPct) : "", gstRate: String(l.gstRate) })) }));
      if (!b.lines.length) toast.info?.("Nothing received on this order is left to invoice.");
    } catch (e) { toast.error(errText(e)); }
  };
  const save = async (ev) => {
    ev.preventDefault();
    let lines;
    try { lines = linesPayload(form.lines, { price: true }); } catch (e) { toast.error(e.message); return; }
    if (!form.invoiceNo.trim()) { toast.error("Enter the supplier's invoice number"); return; }
    if (!form.poId && !form.supplierId) { toast.error("Choose a supplier or a purchase order"); return; }
    const body = { poId: form.poId || undefined, supplierId: form.supplierId, invoiceNo: form.invoiceNo, invoiceDate: form.invoiceDate, dueDate: form.dueDate || undefined, freight: Number(form.freight) || 0, otherCharges: Number(form.otherCharges) || 0, statedTotal: form.statedTotal === "" ? undefined : Number(form.statedTotal), notes: form.notes, lines };
    const r = await run(() => api.post("/finance/invoices", body, { params: { venueId } }), "Invoice recorded as a draft");
    if (r) { r.data.warnings?.forEach((w) => toast.error(w)); setForm(null); open(r.data.id); }
  };
  const tryApprove = async () => {
    setBusy(true);
    try { await api.post(`/finance/invoices/${detail.id}/approve`, {}); toast.success("Approved"); list.reload(); open(detail.id); }
    catch (e) {
      if (e?.response?.data?.code === "MATCH_VARIANCE") setAsk({ title: "Approve despite differences", path: "approve", label: "Why is it right to pay this invoice as it is?", confirmLabel: "Approve anyway", override: true });
      else toast.error(errText(e));
    } finally { setBusy(false); }
  };
  const loadCredits = async () => {
    try {
      const rows = (await api.get("/receiving/returns", { params: { status: "credited", supplierId: detail.supplierId, limit: 100, venueId: detail.venueId } })).data.data;
      setCredits(rows.filter((r) => !r.appliedInvoiceId));
    } catch (e) { toast.error(errText(e)); }
  };

  const columns = [
    { key: "docNo", label: "Ref", render: (r) => <button type="button" className="inv-link" onClick={() => open(r.id)}>{r.docNo}</button> },
    { key: "invoiceNo", label: "Supplier invoice" }, { key: "supplierName", label: "Supplier" },
    { key: "invoiceDate", label: "Date", render: (r) => dateShort(r.invoiceDate) },
    { key: "dueDate", label: "Due", render: (r) => <>{dateShort(r.dueDate)} {r.overdue && <Badge tone="red">overdue</Badge>}</> },
    { key: "payable", label: "Payable", num: true, render: (r) => money(r.payable) },
    { key: "outstanding", label: "Outstanding", num: true, render: (r) => (r.status === "approved" ? money(r.outstanding) : "—") },
    { key: "match", label: "Match", render: (r) => r.match ? <Badge tone={MATCH_TONE[r.match.status]}>{r.match.status}</Badge> : "—" },
    { key: "status", label: "Status", render: (r) => <><StatusBadge status={r.status} />{r.paymentStatus && <> <Badge tone={r.paymentStatus === "paid" ? "green" : r.paymentStatus === "partially_paid" ? "amber" : "grey"}>{statusLabel(r.paymentStatus)}</Badge></>}</> },
  ];

  return (
    <div className="inv-page">
      <PageHead title="Supplier invoices" crumb="Finance">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" onClick={openNew}>+ Record invoice</button>}
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      <div className="inv-card">
        <div className="inv-toolbar">
          <input className="inv-input inv-search" placeholder="Search ref, invoice no. or supplier" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="inv-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["draft", "pending_approval", "approved", "rejected", "disputed", "cancelled"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
          <select className="inv-select" aria-label="Match" value={match} onChange={(e) => setMatch(e.target.value)}><option value="">Any match</option><option value="matched">Matched</option><option value="variance">Variance</option><option value="unmatched">No order</option></select>
          <label className="inv-check"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Overdue only</label>
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No supplier invoices yet." />
        <Pager page={list.page} setPage={list.setPage} total={list.total} pageSize={list.pageSize} />
      </div>

      {form && (
        <Modal wide title="Record supplier invoice" onClose={() => setForm(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setForm(null)}>Cancel</button><button type="submit" form="sinv-form" className="inv-btn inv-btn-primary" disabled={busy}>Save draft</button></>}>
          <form id="sinv-form" onSubmit={save}>
            <div className="inv-grid">
              <Field label="Purchase order" hint="Pick the order to prefill what was received and not yet invoiced."><select className="inv-select" value={form.poId} onChange={(e) => pickPo(e.target.value)}><option value="">No order (will show as unmatched)</option>{pos.map((p) => <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName}</option>)}</select></Field>
              <Field label="Supplier" required={!form.poId}><select className="inv-select" disabled={!!form.poId} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Supplier's invoice no." required><input className="inv-input" maxLength={60} value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></Field>
              <Field label="Invoice date" required><input type="date" className="inv-input" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></Field>
              <Field label="Due date" hint="Leave blank to use the payment terms (e.g. Net 30)."><input type="date" className="inv-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
              <Field label="Total printed on the invoice (₹)" hint="Optional cross-check against the calculated total."><input className="inv-input" inputMode="decimal" value={form.statedTotal} onChange={(e) => setForm({ ...form, statedTotal: e.target.value })} /></Field>
            </div>
            <div className="inv-section">Items (price per selected unit, before discount and GST)</div>
            <LineEditor items={items} value={form.lines} price onChange={(lines) => setForm({ ...form, lines })} />
            <div className="inv-grid">
              <Field label="Freight (₹)"><input className="inv-input" inputMode="decimal" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} /></Field>
              <Field label="Other charges (₹)"><input className="inv-input" inputMode="decimal" value={form.otherCharges} onChange={(e) => setForm({ ...form, otherCharges: e.target.value })} /></Field>
            </div>
            <div className="inv-hint">The server calculates tax, round-off and the total, then matches it against the order and receipts.</div>
          </form>
        </Modal>
      )}

      {detail && !form && (
        <Modal wide title={`${detail.docNo} — ${detail.invoiceNo}`} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            {["draft", "rejected", "disputed"].includes(detail.status) && canWrite && <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={() => act("submit", {}, "Submitted for approval")}>Submit for approval</button>}
            {detail.status === "pending_approval" && canApprove && <>
              <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={tryApprove}>Approve</button>
              <button type="button" className="inv-btn" onClick={() => setAsk({ title: "Mark as disputed", path: "dispute", label: "What is disputed with the supplier?" })}>Dispute</button>
              <button type="button" className="inv-btn inv-btn-danger" onClick={() => setAsk({ title: "Reject invoice", path: "reject", label: "Reason for rejection", danger: true })}>Reject</button></>}
            {detail.status === "approved" && canWrite && detail.outstanding > 0 && <button type="button" className="inv-btn" onClick={loadCredits}>Apply credit note</button>}
            {detail.status === "approved" && canPay && detail.payableNow > 0 && <span className="inv-muted">Record the payment under Supplier Payments.</span>}
            {["draft", "pending_approval", "rejected", "disputed", "approved"].includes(detail.status) && canWrite && <button type="button" className="inv-btn inv-btn-danger" onClick={() => setAsk({ title: "Cancel invoice", path: "cancel", label: "Reason for cancelling", danger: true })}>Cancel</button>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Supplier", `${detail.supplierName}${detail.supplierGstin ? ` · ${detail.supplierGstin}` : ""}`], ["Order", detail.poNo || "None"], ["Invoice date", dateShort(detail.invoiceDate)], ["Due", dateShort(detail.dueDate)], ["Recorded by", detail.createdByName], ["Notes", detail.notes], ["Override reason", detail.overrideReason]]} />
          {detail.match && <div>
            <div className="inv-section">Three-way match: <Badge tone={MATCH_TONE[detail.match.status]}>{detail.match.status}</Badge></div>
            {detail.match.flags.map((f) => <div key={f} className="inv-banner" style={{ marginTop: 6 }}>{FLAG_TEXT[f] || f}</div>)}
            {detail.match.lines.length > 0 && <div className="inv-tablewrap"><table className="inv-table">
              <thead><tr><th>Item</th><th className="inv-num">Received, not yet billed</th><th className="inv-num">Invoiced</th><th className="inv-num">Order price</th><th className="inv-num">Invoice price</th><th>Result</th></tr></thead>
              <tbody>{detail.match.lines.map((l) => (<tr key={l.itemId}><td>{detail.lines.find((x) => x.itemId === l.itemId)?.itemName || l.itemId}</td><td className="inv-num">{qty(l.billable)}</td><td className="inv-num">{qty(l.invoiced)}</td><td className="inv-num">{money(l.poNetPrice)}</td><td className="inv-num">{money(l.invoiceNetPrice)}</td><td><Badge tone={l.status === "ok" ? "green" : "amber"}>{LINE_TEXT[l.status] || l.status}</Badge></td></tr>))}</tbody>
            </table></div>}
            <div className="inv-hint">Prices are per base unit after discount, before GST. Quantities are the order's received quantity minus what other invoices already bill.</div>
          </div>}
          <div className="inv-tablewrap"><table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Qty</th><th className="inv-num">Price</th><th className="inv-num">Disc</th><th className="inv-num">GST</th><th className="inv-num">Total</th></tr></thead>
            <tbody>{detail.lines.map((l) => (<tr key={l.itemId}><td>{l.itemName}</td><td className="inv-num">{qty(l.qty)} {l.unit}</td><td className="inv-num">{money(l.unitPrice)}</td><td className="inv-num">{l.discountPct}%</td><td className="inv-num">{l.gstRate}%</td><td className="inv-num">{money(l.total)}</td></tr>))}</tbody>
          </table></div>
          <div className="inv-totals">
            <div><span>Taxable value</span><span>{money(detail.totals.taxable)}</span></div>
            {detail.taxSplit?.type === "intra" ? <><div><span>CGST</span><span>{money(detail.taxSplit.cgst)}</span></div><div><span>SGST</span><span>{money(detail.taxSplit.sgst)}</span></div></> : detail.taxSplit?.type === "inter" ? <div><span>IGST</span><span>{money(detail.taxSplit.igst)}</span></div> : <div><span>GST</span><span>{money(detail.totals.tax)}</span></div>}
            {detail.totals.freight > 0 && <div><span>Freight</span><span>{money(detail.totals.freight)}</span></div>}
            {detail.totals.other > 0 && <div><span>Other charges</span><span>{money(detail.totals.other)}</span></div>}
            <div><span>Round-off</span><span>{money(detail.totals.roundOff)}</span></div>
            <div className="inv-grand"><span>Invoice total</span><span>{money(detail.totals.grandTotal)}</span></div>
            {detail.statedTotal !== null && <div><span>Printed total</span><span>{money(detail.statedTotal)}</span></div>}
            {detail.creditsApplied > 0 && <div><span>Credit notes</span><span>−{money(detail.creditsApplied)}</span></div>}
            {detail.status === "approved" && <><div><span>Paid</span><span>{money(detail.paid)}</span></div><div className="inv-grand"><span>Outstanding</span><span>{money(detail.outstanding)}</span></div></>}
          </div>
          {detail.payments?.length > 0 && <div><div className="inv-section">Payments</div><ul className="inv-history">{detail.payments.map((p) => <li key={p.id}>{p.payNo} — {money(p.amount)} by {statusLabel(p.method)}{p.reference ? ` (${p.reference})` : ""} · <StatusBadge status={p.status} /></li>)}</ul></div>}
          {detail.credits?.length > 0 && <div><div className="inv-section">Credit notes applied</div><ul className="inv-history">{detail.credits.map((c) => <li key={c.id}>{c.creditNoteNo} ({c.returnNo}) — {money(c.amount)}</li>)}</ul></div>}
          <History entries={detail.history} />
        </Modal>
      )}

      {ask && <ReasonDialog title={ask.title} label={ask.label} danger={ask.danger} confirmLabel={ask.confirmLabel} busy={busy} onClose={() => setAsk(null)}
        onSubmit={(t) => act(ask.path, ask.override ? { overrideReason: t } : { reason: t }, "Done")} />}
      {credits && (
        <Modal title="Apply a supplier credit note" onClose={() => setCredits(null)} footer={<button type="button" className="inv-btn" onClick={() => setCredits(null)}>Close</button>}>
          {credits.length === 0 ? <div className="inv-muted">No unapplied credit notes from this supplier. Record one on a dispatched supplier return first.</div> : credits.map((r) => (
            <div key={r.id} className="inv-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span>{r.creditNoteNo} — {r.returnNo} — {money(r.creditAmount)}</span>
              <button type="button" className="inv-btn inv-btn-sm inv-btn-primary" disabled={busy} onClick={async () => { const x = await run(() => api.post(`/finance/invoices/${detail.id}/apply-credit`, { returnId: r.id }), "Credit applied"); if (x) { setCredits(null); open(detail.id); } }}>Apply</button>
            </div>))}
        </Modal>
      )}
    </div>
  );
}
