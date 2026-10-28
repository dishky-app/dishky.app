/** SupplierPayments.js — record supplier payments against approved invoices. Dishky records; it never moves money. */
import React, { useCallback, useRef, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { DataTable, Field, Modal, PageHead, Pager, dateShort, errText, money, useDebounced, usePagedList, useRef_ } from "./InvUi";
import { History, KeyVals, ReasonDialog, StatusBadge, statusLabel } from "./PurchUi";

const METHODS = [["bank_transfer", "Bank transfer"], ["upi", "UPI"], ["cheque", "Cheque"], ["cash", "Cash"], ["card", "Card"], ["other", "Other"]];
const today = () => new Date().toISOString().slice(0, 10);
const newKey = () => `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function SupplierPayments() {
  const { hasModulePermission } = useAuth();
  const { venueId, currentVenue } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchasePayments", "write");
  const canApprove = hasModulePermission("purchaseApprovals", "write");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/finance/payments", { status, search: dSearch });
  const suppliers = useRef_("/inventory/suppliers", { limit: 200 }, (d) => d.data);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [ask, setAsk] = useState(null);
  const [alloc, setAlloc] = useState(null);
  const [busy, setBusy] = useState(false);
  const key = useRef("");

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);
  const open = useCallback(async (id) => { try { setDetail((await api.get(`/finance/payments/${id}`)).data); } catch (e) { toast.error(errText(e)); } }, [toast]);
  const act = async (path, body = {}, msg) => { const r = await run(() => api.post(`/finance/payments/${detail.id}/${path}`, body), msg); if (r) { setAsk(null); setDetail(r.data); } };

  const loadInvoices = async (supplierId) => {
    if (!supplierId) return [];
    try { return (await api.get("/finance/invoices", { params: { supplierId, status: "approved", limit: 200, venueId } })).data.data.filter((i) => i.payableNow > 0); }
    catch (e) { toast.error(errText(e)); return []; }
  };
  const openNew = () => { key.current = newKey(); setForm({ supplierId: "", method: "bank_transfer", reference: "", paymentDate: today(), amount: "", notes: "", invoices: [], pay: {} }); };
  const pickSupplier = async (supplierId) => { const invoices = await loadInvoices(supplierId); setForm((f) => ({ ...f, supplierId, invoices, pay: {}, amount: "" })); };
  const setPay = (id, v) => setForm((f) => {
    const pay = { ...f.pay, [id]: v };
    const sum = Object.values(pay).reduce((n, x) => n + (Number(x) || 0), 0);
    return { ...f, pay, amount: String(Math.round(sum * 100) / 100) };
  });
  const save = async (ev) => {
    ev.preventDefault();
    if (!form.supplierId) { toast.error("Choose the supplier"); return; }
    const allocations = Object.entries(form.pay).filter(([, v]) => Number(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
    if (!(Number(form.amount) > 0)) { toast.error("Enter the amount paid"); return; }
    const r = await run(() => api.post("/finance/payments", { supplierId: form.supplierId, method: form.method, reference: form.reference, paymentDate: form.paymentDate, amount: Number(form.amount), notes: form.notes, allocations }, { params: { venueId }, headers: { "Idempotency-Key": key.current } }), "Payment recorded");
    if (r) { r.data.warnings?.forEach((w) => toast.error(w)); setForm(null); setDetail(r.data); }
  };
  const openAlloc = async () => { const invoices = await loadInvoices(detail.supplierId); setAlloc({ invoices, pay: {} }); };
  const advance = detail ? detail.advance : 0;

  const columns = [
    { key: "payNo", label: "Payment", render: (r) => <button type="button" className="inv-link" onClick={() => open(r.id)}>{r.payNo}</button> },
    { key: "supplierName", label: "Supplier" }, { key: "paymentDate", label: "Date", render: (r) => dateShort(r.paymentDate) },
    { key: "method", label: "Method", render: (r) => statusLabel(r.method) }, { key: "reference", label: "Reference", render: (r) => r.reference || "—" },
    { key: "amount", label: "Amount", num: true, render: (r) => money(r.amount) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="inv-page">
      <PageHead title="Supplier payments" crumb="Finance">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" onClick={openNew}>+ Record payment</button>}
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      <div className="inv-banner">This screen records payments you have made or are about to make. It does not transfer money.</div>
      <div className="inv-card">
        <div className="inv-toolbar">
          <input className="inv-input inv-search" placeholder="Search payment, reference or supplier" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="inv-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["pending_approval", "completed", "rejected", "cancelled", "reversed"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No payments recorded yet." />
        <Pager page={list.page} setPage={list.setPage} total={list.total} pageSize={list.pageSize} />
      </div>

      {form && (
        <Modal wide title="Record supplier payment" onClose={() => setForm(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setForm(null)}>Cancel</button><button type="submit" form="spay-form" className="inv-btn inv-btn-primary" disabled={busy}>Save payment</button></>}>
          <form id="spay-form" onSubmit={save}>
            <div className="inv-grid">
              <Field label="Supplier" required><select className="inv-select" value={form.supplierId} onChange={(e) => pickSupplier(e.target.value)}><option value="">Choose supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Payment date"><input type="date" className="inv-input" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></Field>
              <Field label="Method"><select className="inv-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label={`Reference${form.method === "cash" ? "" : " *"}`} hint="UTR, UPI transaction id or cheque number"><input className="inv-input" maxLength={80} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
            </div>
            {form.supplierId && (form.invoices.length === 0 ? <div className="inv-hint">No approved invoices with a balance for this supplier. You can still record an advance.</div> : (
              <div className="inv-tablewrap"><table className="inv-table">
                <thead><tr><th>Invoice</th><th>Due</th><th className="inv-num">Still payable</th><th className="inv-num">Pay now (₹)</th><th /></tr></thead>
                <tbody>{form.invoices.map((i) => (<tr key={i.id}><td>{i.docNo} <span className="inv-muted">{i.invoiceNo}</span></td><td>{dateShort(i.dueDate)}</td><td className="inv-num">{money(i.payableNow)}</td>
                  <td className="inv-num"><input className="inv-input inv-w90" aria-label={`Amount for ${i.docNo}`} inputMode="decimal" value={form.pay[i.id] ?? ""} onChange={(e) => setPay(i.id, e.target.value)} /></td>
                  <td><button type="button" className="inv-btn inv-btn-sm" onClick={() => setPay(i.id, String(i.payableNow))}>Pay in full</button></td></tr>))}</tbody>
              </table></div>))}
            <div className="inv-grid">
              <Field label="Amount paid (₹)" required hint="Anything above the amounts allocated to invoices is kept as an advance."><input className="inv-input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Notes"><input className="inv-input" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          </form>
        </Modal>
      )}

      {detail && !form && (
        <Modal wide title={detail.payNo} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            {detail.status === "pending_approval" && canApprove && <>
              <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={() => act("approve", {}, "Approved")}>Approve payment</button>
              <button type="button" className="inv-btn inv-btn-danger" onClick={() => setAsk({ title: "Reject payment", path: "reject", label: "Reason", danger: true })}>Reject</button></>}
            {detail.status === "pending_approval" && canWrite && <button type="button" className="inv-btn" onClick={() => setAsk({ title: "Cancel payment", path: "cancel", label: "Reason", danger: true })}>Cancel</button>}
            {detail.status === "completed" && canWrite && advance > 0 && <button type="button" className="inv-btn" onClick={openAlloc}>Allocate advance ({money(advance)})</button>}
            {detail.status === "completed" && canApprove && <button type="button" className="inv-btn inv-btn-danger" onClick={() => setAsk({ title: "Reverse payment", path: "reverse", label: "Why is it being reversed? (e.g. cheque bounced)", danger: true })}>Reverse</button>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Supplier", detail.supplierName], ["Date", dateShort(detail.paymentDate)], ["Method", statusLabel(detail.method)], ["Reference", detail.reference], ["Amount", money(detail.amount)], ["Unallocated (advance)", detail.advance > 0 ? money(detail.advance) : undefined], ["Reversal reason", detail.reverseReason], ["Recorded by", detail.createdByName], ["Notes", detail.notes]]} />
          {detail.allocations.length > 0 && <div className="inv-tablewrap"><table className="inv-table"><thead><tr><th>Invoice</th><th className="inv-num">Allocated</th></tr></thead><tbody>{detail.allocations.map((a) => <tr key={a.invoiceId}><td>{a.docNo}</td><td className="inv-num">{money(a.amount)}</td></tr>)}</tbody></table></div>}
          <History entries={detail.history} />
        </Modal>
      )}
      {ask && <ReasonDialog {...ask} busy={busy} onClose={() => setAsk(null)} onSubmit={(t) => act(ask.path, { reason: t }, "Done")} />}
      {alloc && (
        <Modal title="Allocate advance to invoices" onClose={() => setAlloc(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setAlloc(null)}>Back</button><button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={async () => {
            const allocations = Object.entries(alloc.pay).filter(([, v]) => Number(v) > 0).map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));
            if (!allocations.length) { toast.error("Enter an amount"); return; }
            const r = await run(() => api.post(`/finance/payments/${detail.id}/allocate`, { allocations }), "Allocated"); if (r) { setAlloc(null); setDetail(r.data); }
          }}>Allocate</button></>}>
          {alloc.invoices.length === 0 ? <div className="inv-muted">No approved invoices with a balance for this supplier.</div> : alloc.invoices.map((i) => (
            <div key={i.id} className="inv-row"><span style={{ flex: 1 }}>{i.docNo} — payable {money(i.payableNow)}</span>
              <input className="inv-input inv-w90" aria-label={`Amount for ${i.docNo}`} inputMode="decimal" value={alloc.pay[i.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, pay: { ...alloc.pay, [i.id]: e.target.value } })} /></div>))}
        </Modal>
      )}
    </div>
  );
}
