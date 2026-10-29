/** PurchaseOrders.js — purchase orders: edit drafts, approve, record sending, revise, cancel, short-close. */
import React, { useCallback, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, DateInput, Field, Modal, PageHead, SearchBox, Select, Toolbar, dateShort, errText, money, qty, useDebounced, usePagedList, useRef_ } from "./InvUi";
import { History, KeyVals, LineEditor, ReasonDialog, StatusBadge, linesPayload, statusLabel } from "./PurchUi";

const STATUSES = ["draft", "pending_approval", "approved", "rejected", "sent", "partially_received", "received", "closed", "cancelled"];
const VIA = [["whatsapp", "WhatsApp"], ["email", "Email"], ["phone", "Phone"], ["in_person", "In person"], ["print", "Printed"]];

export default function PurchaseOrders() {
  const { hasModulePermission } = useAuth();
  const { venueId } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseOrders", "write");
  const canApprove = hasModulePermission("purchaseApprovals", "write");
  const [status, setStatus] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/purchase/orders", { status, supplierId, search: dSearch, ...(overdue ? { overdue: "true" } : {}) });
  const items = useRef_("/inventory/items", { status: "active", limit: 200 }, (d) => d.data);
  const suppliers = useRef_("/inventory/suppliers", { limit: 200 }, (d) => d.data);
  const settings = useRef_("/purchase/settings", {}, (d) => [d]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [ask, setAsk] = useState(null);
  const [sendDlg, setSendDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const manualOk = settings[0]?.allowManualPo;

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);
  const open = async (id) => { try { setDetail((await api.get(`/purchase/orders/${id}`)).data); } catch (e) { toast.error(errText(e)); } };
  const act = async (po, path, body = {}, msg) => {
    const r = await run(() => api.post(`/purchase/orders/${po.id}/${path}`, body), msg);
    if (r) { setAsk(null); setSendDlg(null); setDetail(r.data); }
  };
  const edit = (po) => setForm({
    id: po.id, supplierId: po.supplierId, expectedDate: po.expectedDate ? po.expectedDate.slice(0, 10) : "", paymentTerms: po.paymentTerms, deliveryTerms: po.deliveryTerms, deliveryAddress: po.deliveryAddress, notes: po.notes,
    freight: po.totals.freight || "", otherCharges: po.totals.other || "",
    // edited in base units so the price column always means "per base unit"
    lines: po.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, discountPct: l.discountPct || "", gstRate: l.gstRate })),
  });

  const save = async (ev) => {
    ev.preventDefault();
    let lines;
    try { lines = linesPayload(form.lines, { price: true }); } catch (e) { toast.error(e.message); return; }
    if (!form.id && !form.supplierId) { toast.error("Choose a supplier"); return; }
    const body = { expectedDate: form.expectedDate || null, paymentTerms: form.paymentTerms, deliveryTerms: form.deliveryTerms, deliveryAddress: form.deliveryAddress, notes: form.notes, freight: Number(form.freight) || 0, otherCharges: Number(form.otherCharges) || 0, lines };
    const r = await run(() => (form.id ? api.patch(`/purchase/orders/${form.id}`, body) : api.post("/purchase/orders", { ...body, supplierId: form.supplierId, venueId, source: "manual" })), "Order saved");
    if (r) { setForm(null); setDetail(r.data); }
  };

  const columns = [
    { key: "poNo", label: "PO no.", render: (r) => <span className="clickable" onClick={() => open(r.id)}>{r.poNo}{r.version > 1 ? ` (v${r.version})` : ""}</span> },
    { key: "supplierName", label: "Supplier" },
    { key: "orderDate", label: "Ordered", render: (r) => dateShort(r.orderDate) },
    { key: "expectedDate", label: "Expected", render: (r) => <>{dateShort(r.expectedDate)} {r.overdue && <Badge tone="red">overdue</Badge>}</> },
    { key: "total", label: "Total", num: true, render: (r) => money(r.totals.grandTotal) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Purchase orders" count={`${list.total} order(s)`}>
        {canWrite && manualOk && <Btn type="button" kind="primary" onClick={() => setForm({ supplierId: "", expectedDate: "", paymentTerms: "", deliveryTerms: "", deliveryAddress: "", notes: "", freight: "", otherCharges: "", lines: [] })}>+ Manual order</Btn>}
      </PageHead>
      <div className="inv-stack">
        <Toolbar>
          <SearchBox placeholder=" Search PO no. or supplier" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select>
          <Select aria-label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">All suppliers</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <label className="checkbox-item inv-check"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Overdue only</label>
        </Toolbar>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No purchase orders yet. Create one from an approved request or an awarded RFQ." more={list} />
      </div>

      {form && (
        <Modal wide title={form.id ? "Edit draft order" : "New manual order"} onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="po-form" kind="primary" disabled={busy}>Save draft</Btn></>}>
          <form id="po-form" onSubmit={save}>
            <div className="inv-grid">
              {!form.id && <Field label="Supplier" required><Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.filter((s) => s.status === "active").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
              <Field label="Expected delivery"><DateInput value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></Field>
              <Field label="Payment terms"><input className="inv-input" maxLength={200} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
              <Field label="Delivery terms"><input className="inv-input" maxLength={200} value={form.deliveryTerms} onChange={(e) => setForm({ ...form, deliveryTerms: e.target.value })} /></Field>
              <Field label="Delivery address" full><input className="inv-input" maxLength={500} value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} /></Field>
            </div>
            <div className="inv-section">Items (price is per selected unit, before discount and GST)</div>
            <LineEditor items={items} value={form.lines} price onChange={(lines) => setForm({ ...form, lines })} />
            <div className="inv-grid">
              <Field label="Freight (₹)"><input className="inv-input" inputMode="decimal" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} /></Field>
              <Field label="Other charges (₹)"><input className="inv-input" inputMode="decimal" value={form.otherCharges} onChange={(e) => setForm({ ...form, otherCharges: e.target.value })} /></Field>
              <Field label="Notes" full><textarea className="inv-textarea" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <div className="inv-hint">Tax, round-off and totals are calculated by the server when you save.</div>
          </form>
        </Modal>
      )}

      {detail && !form && (
        <Modal wide title={`${detail.poNo}${detail.version > 1 ? ` — version ${detail.version}` : ""}`} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            <Btn type="button" kind="plain" onClick={() => window.print()}>Print</Btn>
            {detail.status === "draft" && canWrite && <>
              <Btn type="button" kind="plain" onClick={() => edit(detail)}>Edit</Btn>
              <Btn type="button" kind="primary" disabled={busy} onClick={() => act(detail, "submit", {}, "Submitted")}>Submit</Btn></>}
            {detail.status === "pending_approval" && canApprove && <>
              <Btn type="button" kind="primary" disabled={busy} onClick={() => act(detail, "approve", {}, "Approved")}>Approve</Btn>
              <Btn type="button" kind="danger" onClick={() => setAsk({ title: "Reject order", path: "reject", label: "Reason for rejection", danger: true })}>Reject</Btn></>}
            {detail.status === "approved" && canWrite && <Btn type="button" kind="primary" onClick={() => setSendDlg({ via: "whatsapp" })}>Mark as sent</Btn>}
            {["approved", "sent"].includes(detail.status) && canWrite && <Btn type="button" kind="plain" onClick={() => setAsk({ title: "Revise order", path: "revise", label: "Why is it being revised?", confirmLabel: "Revise" })}>Revise</Btn>}
            {["sent", "partially_received", "received"].includes(detail.status) && canWrite && <Btn type="button" kind="plain" onClick={() => setAsk({ title: "Close order (short-close)", path: "close", label: "Why is the remaining quantity no longer expected?" })}>Close order</Btn>}
            {["draft", "pending_approval", "rejected", "approved", "sent"].includes(detail.status) && canWrite && !detail.lines.some((l) => l.received > 0) && <Btn type="button" kind="danger" onClick={() => setAsk({ title: "Cancel order", path: "cancel", label: "Reason for cancelling", danger: true })}>Cancel order</Btn>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Supplier", `${detail.supplierName}${detail.supplierGstin ? ` · GSTIN ${detail.supplierGstin}` : ""}`], ["Buyer", detail.buyerName], ["Ordered", dateShort(detail.orderDate)], ["Expected", dateShort(detail.expectedDate)], ["Payment terms", detail.paymentTerms], ["Delivery terms", detail.deliveryTerms], ["Deliver to", detail.deliveryAddress], ["Sent", detail.sentAt ? `${dateShort(detail.sentAt)} via ${statusLabel(detail.sentVia)}` : undefined], ["Notes", detail.notes]]} />
          <div className="inv-tablewrap"><table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Ordered</th><th className="inv-num">Received</th><th className="inv-num">Outstanding</th><th className="inv-num">Price / {"base unit"}</th><th className="inv-num">Disc</th><th className="inv-num">GST</th><th className="inv-num">Total</th></tr></thead>
            <tbody>{detail.lines.map((l) => (<tr key={l.itemId}><td>{l.itemName}</td><td className="inv-num">{qty(l.qty)} {l.unit}</td><td className="inv-num">{qty(l.received)}</td><td className="inv-num">{qty(l.outstanding)}</td><td className="inv-num">{money(l.unitPrice)}</td><td className="inv-num">{l.discountPct}%</td><td className="inv-num">{l.gstRate}%</td><td className="inv-num">{money(l.total)}</td></tr>))}</tbody>
          </table></div>
          <div className="inv-totals">
            <div><span>Subtotal</span><span>{money(detail.totals.subtotal)}</span></div>
            <div><span>Discount</span><span>−{money(detail.totals.discount)}</span></div>
            <div><span>Taxable value</span><span>{money(detail.totals.taxable)}</span></div>
            {detail.taxSplit?.type === "intra" ? <><div><span>CGST</span><span>{money(detail.taxSplit.cgst)}</span></div><div><span>SGST</span><span>{money(detail.taxSplit.sgst)}</span></div></>
              : detail.taxSplit?.type === "inter" ? <div><span>IGST</span><span>{money(detail.taxSplit.igst)}</span></div>
              : <div><span>GST</span><span>{money(detail.totals.tax)}</span></div>}
            {detail.totals.freight > 0 && <div><span>Freight</span><span>{money(detail.totals.freight)}</span></div>}
            {detail.totals.other > 0 && <div><span>Other charges</span><span>{money(detail.totals.other)}</span></div>}
            <div><span>Round-off</span><span>{money(detail.totals.roundOff)}</span></div>
            <div className="inv-grand"><span>Grand total</span><span>{money(detail.totals.grandTotal)}</span></div>
          </div>
          {!detail.taxSplit && <div className="inv-hint">CGST/SGST/IGST split unavailable — set the restaurant GST state code in Purchase settings and the supplier GSTIN.</div>}
          <History entries={detail.approvals} />
          {detail.revisions?.length > 0 && <div><div className="inv-section">Earlier versions</div><ul className="inv-history">{detail.revisions.map((r) => <li key={r.version}>Version {r.version} replaced by {r.byName} — {r.reason}</li>)}</ul></div>}
        </Modal>
      )}

      {ask && <ReasonDialog {...ask} busy={busy} onClose={() => setAsk(null)} onSubmit={(t) => act(detail, ask.path, { reason: t, comment: t }, "Done")} />}
      {sendDlg && (
        <Modal title="Record that the order was sent" onClose={() => setSendDlg(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setSendDlg(null)}>Back</Btn><Btn type="button" kind="primary" disabled={busy} onClick={() => act(detail, "send", { via: sendDlg.via }, "Marked as sent")}>Mark as sent</Btn></>}>
          <div className="inv-hint">Dishky does not send the order for you. Send it yourself (print it, or share it by WhatsApp or email), then record how.</div>
          <Field label="Sent via"><Select value={sendDlg.via} onChange={(e) => setSendDlg({ via: e.target.value })}>{VIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </Modal>
      )}
    </div>
  );
}
