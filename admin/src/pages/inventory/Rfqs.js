/** Rfqs.js — requests for quotation: invite suppliers, record quotations, compare, award, order. */
import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, Field, Modal, PageHead, Pager, dateShort, errText, money, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";
import { History, KeyVals, LineEditor, ReasonDialog, StatusBadge, linesPayload, statusLabel } from "./PurchUi";

const OPEN = ["sent", "responses_received", "evaluation"];
const STATUSES = ["draft", "sent", "responses_received", "evaluation", "awarded", "closed", "cancelled"];

export default function Rfqs() {
  const { hasModulePermission } = useAuth();
  const { venueId, currentVenue } = useVenue();
  const { toast } = useToast();
  const nav = useNavigate();
  const canWrite = hasModulePermission("purchaseRfq", "write");
  const canPo = hasModulePermission("purchaseOrders", "write");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/purchase/rfqs", { status, search: dSearch });
  const items = useRef_("/inventory/items", { status: "active", limit: 200 }, (d) => d.data);
  const suppliers = useRef_("/inventory/suppliers", { status: "active", limit: 200 }, (d) => d.data);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [quote, setQuote] = useState(null);
  const [cmp, setCmp] = useState(null);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);
  const open = useCallback(async (id) => { try { setDetail((await api.get(`/purchase/rfqs/${id}`)).data); } catch (e) { toast.error(errText(e)); } }, [toast]);
  const act = async (path, body = {}, msg) => {
    const r = await run(() => api.post(`/purchase/rfqs/${detail.id}/${path}`, body), msg);
    if (r) { setAsk(null); setCmp(null); open(detail.id); }
  };
  const quoAct = async (q, path, reason) => {
    const r = await run(() => api.post(`/purchase/quotations/${q.id}/${path}`, { reason }), "Updated");
    if (r) { setAsk(null); open(detail.id); }
  };

  const create = async (ev) => {
    ev.preventDefault();
    let lines;
    try { lines = linesPayload(form.lines); } catch (e) { toast.error(e.message); return; }
    if (!form.supplierIds.length) { toast.error("Invite at least one supplier"); return; }
    const r = await run(() => api.post("/purchase/rfqs", { supplierIds: form.supplierIds, deadline: form.deadline || null, requiredDate: form.requiredDate || null, paymentTerms: form.paymentTerms, deliveryTerms: form.deliveryTerms, notes: form.notes, lines }, { params: { venueId } }), "RFQ saved as a draft");
    if (r) { setForm(null); setDetail({ ...r.data, quotations: [] }); }
  };

  const submitQuote = async (ev) => {
    ev.preventDefault();
    let lines;
    try {
      lines = quote.lines.map((l) => {
        if (l.unitPrice === "" || !(Number(l.unitPrice) >= 0)) throw new Error("Enter a price for every quoted line, or remove the line");
        const o = { itemId: l.itemId, unitPrice: Number(l.unitPrice), unit: l.unit, brand: l.brand, leadTimeDays: l.leadTimeDays, availability: l.availability };
        if (l.qty !== "") o.qty = Number(l.qty);
        if (l.discountPct !== "") o.discountPct = Number(l.discountPct);
        if (l.gstRate !== "") o.gstRate = Number(l.gstRate);
        return o;
      });
      if (!lines.length) throw new Error("Add at least one quoted line");
    } catch (e) { toast.error(e.message); return; }
    const r = await run(() => api.post(`/purchase/rfqs/${detail.id}/quotations`, { supplierId: quote.supplierId, supplierRef: quote.supplierRef, validUntil: quote.validUntil || null, freight: Number(quote.freight) || 0, otherCharges: Number(quote.otherCharges) || 0, paymentTerms: quote.paymentTerms, remarks: quote.remarks, lines }), "Quotation recorded");
    if (r) { setQuote(null); open(detail.id); }
  };
  const startQuote = (supplierId) => setQuote({
    supplierId, supplierRef: "", validUntil: "", freight: "", otherCharges: "", paymentTerms: "", remarks: "",
    lines: detail.lines.map((l) => ({ itemId: l.itemId, name: l.itemName, qty: "", unit: l.unit, unitPrice: "", discountPct: "", gstRate: items.find((i) => i.id === l.itemId)?.gstRate ?? "", brand: "", leadTimeDays: "", availability: "", rfqQty: l.qty })),
  });
  const compare = async () => { try { setCmp((await api.get(`/purchase/rfqs/${detail.id}/comparison`)).data); } catch (e) { toast.error(errText(e)); } };

  const columns = [
    { key: "rfqNo", label: "RFQ no.", render: (r) => <button type="button" className="inv-link" onClick={() => open(r.id)}>{r.rfqNo}</button> },
    { key: "suppliers", label: "Suppliers", render: (r) => r.suppliers.map((s) => s.name).join(", ") || "—" },
    { key: "deadline", label: "Reply by", render: (r) => dateShort(r.deadline) },
    { key: "quotationCount", label: "Quotations", num: true },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const awardedQuo = detail?.quotations?.find((q) => q.id === detail.awardedQuotationId);

  return (
    <div className="inv-page">
      <PageHead title="RFQs & quotations" crumb="Procurement">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" onClick={() => setForm({ supplierIds: [], deadline: "", requiredDate: "", paymentTerms: "", deliveryTerms: "", notes: "", lines: [] })}>+ New RFQ</button>}
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      <div className="inv-card">
        <div className="inv-toolbar">
          <input className="inv-input inv-search" placeholder="Search RFQ no." aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="inv-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No RFQs yet. Convert an approved purchase request, or start one here." />
        <Pager page={list.page} setPage={list.setPage} total={list.total} pageSize={list.pageSize} />
      </div>

      {form && (
        <Modal wide title="New RFQ" onClose={() => setForm(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setForm(null)}>Cancel</button><button type="submit" form="rfq-form" className="inv-btn inv-btn-primary" disabled={busy}>Save draft</button></>}>
          <form id="rfq-form" onSubmit={create}>
            <div className="inv-section">Suppliers to invite</div>
            <div className="inv-btnrow">{suppliers.map((s) => (<label key={s.id} className="inv-check"><input type="checkbox" checked={form.supplierIds.includes(s.id)} onChange={(e) => setForm({ ...form, supplierIds: e.target.checked ? [...form.supplierIds, s.id] : form.supplierIds.filter((x) => x !== s.id) })} />{s.name}</label>))}</div>
            <div className="inv-grid">
              <Field label="Reply by"><input type="date" className="inv-input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
              <Field label="Needed by"><input type="date" className="inv-input" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} /></Field>
              <Field label="Payment terms"><input className="inv-input" maxLength={200} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
              <Field label="Delivery terms"><input className="inv-input" maxLength={200} value={form.deliveryTerms} onChange={(e) => setForm({ ...form, deliveryTerms: e.target.value })} /></Field>
            </div>
            <div className="inv-section">Items</div>
            <LineEditor items={items} value={form.lines} onChange={(lines) => setForm({ ...form, lines })} />
            <Field label="Notes" full><textarea className="inv-textarea" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </form>
        </Modal>
      )}

      {detail && !form && !quote && !cmp && (
        <Modal wide title={detail.rfqNo} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            {detail.status === "draft" && canWrite && <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={() => act("send", {}, "Marked as sent")}>Mark as sent</button>}
            {OPEN.includes(detail.status) && canWrite && detail.quotations.length > 0 && <button type="button" className="inv-btn" onClick={compare}>Compare quotations</button>}
            {OPEN.includes(detail.status) && canWrite && detail.status !== "evaluation" && <button type="button" className="inv-btn" disabled={busy} onClick={() => act("evaluate", {}, "Evaluation started")}>Start evaluation</button>}
            {detail.status === "awarded" && canPo && awardedQuo && <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={async () => { const r = await run(() => api.post("/purchase/orders", { source: "quotation", quotationId: awardedQuo.id }), "Purchase order created as a draft"); if (r) nav("/purchase/orders"); }}>Create purchase order</button>}
            {detail.status === "awarded" && canWrite && <button type="button" className="inv-btn" disabled={busy} onClick={() => act("close", {}, "Closed")}>Close RFQ</button>}
            {["draft", ...OPEN].includes(detail.status) && canWrite && <button type="button" className="inv-btn inv-btn-danger" onClick={() => setAsk({ kind: "rfq", title: "Cancel RFQ", path: "cancel", label: "Reason for cancelling", danger: true })}>Cancel RFQ</button>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Reply by", dateShort(detail.deadline)], ["Needed by", dateShort(detail.requiredDate)], ["Payment terms", detail.paymentTerms], ["Delivery terms", detail.deliveryTerms], ["Selection reason", detail.selectionReason], ["Notes", detail.notes]]} />
          <div className="inv-section">Items requested</div>
          <ul className="inv-history">{detail.lines.map((l) => <li key={l.itemId}>{l.itemName} — {qty(l.qty)} {l.unit}</li>)}</ul>
          <div className="inv-section">Suppliers</div>
          <div className="inv-tablewrap"><table className="inv-table"><tbody>
            {detail.suppliers.map((s) => (<tr key={s.supplierId}><td>{s.name}</td><td><Badge tone={s.status === "responded" ? "green" : "grey"}>{s.status}</Badge></td><td className="inv-num">{OPEN.includes(detail.status) && canWrite && <button type="button" className="inv-btn inv-btn-sm" onClick={() => startQuote(s.supplierId)}>Record quotation</button>}</td></tr>))}
          </tbody></table></div>
          {detail.quotations.length > 0 && <>
            <div className="inv-section">Quotations</div>
            <div className="inv-tablewrap"><table className="inv-table">
              <thead><tr><th>Quote</th><th>Supplier</th><th>Valid until</th><th className="inv-num">Total</th><th>Status</th><th /></tr></thead>
              <tbody>{detail.quotations.map((q) => (<tr key={q.id}><td>{q.quoNo}</td><td>{q.supplierName}</td><td>{dateShort(q.validUntil)} {q.expired && <Badge tone="red">expired</Badge>}</td><td className="inv-num">{money(q.totals.grandTotal)}</td><td><StatusBadge status={q.status} /></td>
                <td>{OPEN.includes(detail.status) && canWrite && ["received", "shortlisted"].includes(q.status) && <span className="inv-btnrow">
                  {q.status === "received" && <button type="button" className="inv-btn inv-btn-sm" onClick={() => quoAct(q, "shortlist", "")}>Shortlist</button>}
                  <button type="button" className="inv-btn inv-btn-sm" onClick={() => setAsk({ kind: "quo", q, title: "Request a revised quotation", path: "request-revision", label: "What should the supplier change?" })}>Ask to revise</button>
                  <button type="button" className="inv-btn inv-btn-sm inv-btn-danger" onClick={() => setAsk({ kind: "quo", q, title: "Reject quotation", path: "reject", label: "Reason", danger: true })}>Reject</button></span>}</td></tr>))}</tbody>
            </table></div></>}
          <History entries={detail.history} />
        </Modal>
      )}

      {quote && (
        <Modal wide title="Record supplier quotation" onClose={() => setQuote(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setQuote(null)}>Back</button><button type="submit" form="quo-form" className="inv-btn inv-btn-primary" disabled={busy}>Save quotation</button></>}>
          <form id="quo-form" onSubmit={submitQuote}>
            <div className="inv-grid">
              <Field label="Supplier"><input className="inv-input" disabled value={detail.suppliers.find((s) => s.supplierId === quote.supplierId)?.name || ""} /></Field>
              <Field label="Supplier's quotation no."><input className="inv-input" maxLength={80} value={quote.supplierRef} onChange={(e) => setQuote({ ...quote, supplierRef: e.target.value })} /></Field>
              <Field label="Valid until"><input type="date" className="inv-input" value={quote.validUntil} onChange={(e) => setQuote({ ...quote, validUntil: e.target.value })} /></Field>
              <Field label="Payment terms"><input className="inv-input" maxLength={200} value={quote.paymentTerms} onChange={(e) => setQuote({ ...quote, paymentTerms: e.target.value })} /></Field>
            </div>
            <div className="inv-hint">Prices are per quoted unit. Leave quantity blank to quote the requested quantity. Remove lines the supplier did not quote.</div>
            <div className="inv-tablewrap"><table className="inv-table">
              <thead><tr><th>Item</th><th className="inv-num">Qty</th><th>Unit</th><th className="inv-num">Price</th><th className="inv-num">Disc %</th><th className="inv-num">GST %</th><th className="inv-num">Lead days</th><th /></tr></thead>
              <tbody>{quote.lines.map((l, i) => {
                const set = (p) => setQuote({ ...quote, lines: quote.lines.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                return (<tr key={l.itemId}><td>{l.name}<div className="inv-muted">asked {qty(l.rfqQty)} {l.unit}</div></td>
                  <td className="inv-num"><input className="inv-input inv-w80" aria-label="Quantity" inputMode="decimal" placeholder={String(l.rfqQty)} value={l.qty} onChange={(e) => set({ qty: e.target.value })} /></td>
                  <td>{l.unit}</td>
                  <td className="inv-num"><input className="inv-input inv-w90" aria-label="Unit price" inputMode="decimal" value={l.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} /></td>
                  <td className="inv-num"><input className="inv-input inv-w60" aria-label="Discount percent" inputMode="decimal" value={l.discountPct} onChange={(e) => set({ discountPct: e.target.value })} /></td>
                  <td className="inv-num"><input className="inv-input inv-w60" aria-label="GST percent" inputMode="decimal" value={l.gstRate} onChange={(e) => set({ gstRate: e.target.value })} /></td>
                  <td className="inv-num"><input className="inv-input inv-w60" aria-label="Lead time days" inputMode="numeric" value={l.leadTimeDays} onChange={(e) => set({ leadTimeDays: e.target.value })} /></td>
                  <td><button type="button" className="inv-btn inv-btn-sm" onClick={() => setQuote({ ...quote, lines: quote.lines.filter((_, j) => j !== i) })}>Remove</button></td></tr>);
              })}</tbody>
            </table></div>
            <div className="inv-grid">
              <Field label="Freight (₹)"><input className="inv-input" inputMode="decimal" value={quote.freight} onChange={(e) => setQuote({ ...quote, freight: e.target.value })} /></Field>
              <Field label="Other charges (₹)"><input className="inv-input" inputMode="decimal" value={quote.otherCharges} onChange={(e) => setQuote({ ...quote, otherCharges: e.target.value })} /></Field>
              <Field label="Remarks" full><input className="inv-input" maxLength={1000} value={quote.remarks} onChange={(e) => setQuote({ ...quote, remarks: e.target.value })} /></Field>
            </div>
          </form>
        </Modal>
      )}

      {cmp && (
        <Modal wide title={`Compare quotations — ${cmp.rfq.rfqNo}`} onClose={() => setCmp(null)}
          footer={<button type="button" className="inv-btn" onClick={() => setCmp(null)}>Close</button>}>
          <div className="inv-banner">{cmp.note}</div>
          <div className="inv-tablewrap"><table className="inv-table inv-cmp">
            <thead><tr><th>Supplier</th><th className="inv-num">Taxable</th><th className="inv-num">GST</th><th className="inv-num">Freight</th><th className="inv-num">Total</th><th>Covers</th><th className="inv-num">Lead days</th><th>Track record</th><th>Valid until</th><th /></tr></thead>
            <tbody>{cmp.suppliers.map((s) => (
              <tr key={s.quotationId} className={s.supplierId === cmp.lowestFullCoverageSupplierId ? "inv-best" : ""}>
                <td>{s.supplierName}<div className="inv-muted">{s.quoNo}</div></td><td className="inv-num">{money(s.taxable)}</td><td className="inv-num">{money(s.tax)}</td><td className="inv-num">{money(s.freight)}</td><td className="inv-num inv-strong">{money(s.total)}</td>
                <td>{s.coverage.covered}/{s.coverage.of} items</td><td className="inv-num">{s.deliveryLeadDays}</td><td>{s.reliability ? `${s.reliability.onTimePct ?? "—"}% on time · ${s.qualityCompliance ?? "—"}% quality (${s.reliability.receipts} receipts)` : <span className="inv-muted">No history</span>}</td><td>{dateShort(s.validUntil)} {s.expired && <Badge tone="red">expired</Badge>}</td>
                <td>{canWrite && !s.expired && <button type="button" className="inv-btn inv-btn-sm inv-btn-primary" onClick={() => setAsk({ kind: "award", s, title: `Award to ${s.supplierName}`, path: "award", label: "Why is this supplier selected?", confirmLabel: "Award" })}>Award</button>}</td></tr>))}</tbody>
          </table></div>
          <div className="inv-section">Price per item</div>
          <div className="inv-tablewrap"><table className="inv-table inv-cmp">
            <thead><tr><th>Item</th>{cmp.suppliers.map((s) => <th key={s.supplierId} className="inv-num">{s.supplierName}</th>)}</tr></thead>
            <tbody>{cmp.items.map((it) => {
              const prices = it.offers.filter((o) => !o.missing).map((o) => o.effectiveUnitPrice);
              const min = prices.length ? Math.min(...prices) : null;
              return (<tr key={it.itemId}><td>{it.itemName}<div className="inv-muted">{qty(it.qty)} {it.unit}</div></td>{it.offers.map((o) => (<td key={o.supplierId} className={`inv-num ${!o.missing && o.effectiveUnitPrice === min ? "inv-best" : ""}`}>{o.missing ? <span className="inv-muted">not quoted</span> : <>{money(o.effectiveUnitPrice)}<div className="inv-muted">after discount, before GST</div></>}</td>))}</tr>);
            })}</tbody>
          </table></div>
          <div className="inv-hint">Track record comes from posted goods receipts (on-time delivery and share of goods not rejected or held).</div>
        </Modal>
      )}

      {ask && <ReasonDialog title={ask.title} label={ask.label} danger={ask.danger} confirmLabel={ask.confirmLabel} busy={busy} onClose={() => setAsk(null)}
        onSubmit={(t) => (ask.kind === "quo" ? quoAct(ask.q, ask.path, t) : ask.kind === "award" ? act("award", { quotationId: ask.s.quotationId, reason: t }, "Awarded") : act(ask.path, { reason: t }, "Done"))} />}
    </div>
  );
}
