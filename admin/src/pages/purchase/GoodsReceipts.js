/** GoodsReceipts.js — receive goods against purchase orders, inspect, quarantine and post to stock. */
import React, { useCallback, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, DateInput, Field, Modal, PageHead, SearchBox, Select, Toolbar, dateShort, errText, money, qty, useDebounced, usePagedList, useOpenParam, useRowFilters, useRef_, ExportBtn } from "../pi-shared/InvUi";
import { History, KeyVals, ReasonDialog, StatusBadge, statusLabel } from "../pi-shared/PurchUi";
import { downloadReceiptPdf } from "../pi-shared/docPdf";
import { DocAutofill, bestMatch, similarity, pickUnit, numStr } from "../pi-shared/docExtract";

const today = () => new Date().toISOString().slice(0, 10);

export default function GoodsReceipts() {
  const { hasModulePermission } = useAuth();
  const { venueId } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseReceiving", "write");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const list = usePagedList("/receiving/grns", { status, search: dSearch });
  const rf = useRowFilters(list.rows, { supplier: "supplierName", date: "receivedDate", dateLabel: "Received" });
  const locations = useRef_("/inventory/locations", {}, (d) => d.filter((l) => l.status === "active"));
  const items = useRef_("/inventory/items", { limit: 200 }, (d) => d.data);
  const [pos, setPos] = useState([]);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [docNotes, setDocNotes] = useState([]);

  const run = useCallback(async (fn, msg) => {
    setBusy(true);
    try { const r = await fn(); if (msg) toast.success(msg); list.reload(); return r; }
    catch (e) { toast.error(errText(e)); list.reload(); return null; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.reload, toast]);

  const openNew = async () => {
    try {
      const [a, b] = await Promise.all(["sent", "partially_received"].map((s) => api.get("/purchase/orders", { params: { status: s, limit: 200, ...(venueId ? { venueId } : {}) } })));
      setPos([...a.data.data, ...b.data.data]);
      setDocNotes([]);
      setForm({ poId: "", deliveryNoteNo: "", supplierInvoiceNo: "", vehicleNo: "", receivedDate: today(), notes: "", lines: [] });
    } catch (e) { toast.error(errText(e)); }
  };
  const linesOf = (po) => (po ? po.lines.filter((l) => l.outstanding > 0).map((l) => ({ itemId: l.itemId, name: l.itemName, unit: l.unit, ordered: l.qty, outstanding: l.outstanding, delivered: String(l.outstanding), accepted: "", quarantined: "", rejected: "", locationId: locations[0]?.id || "", batchNo: "", expiryDate: "", reason: "", tempC: "" })) : []);
  const pickPo = (poId) => {
    const po = pos.find((p) => p.id === poId);
    setDocNotes([]);
    setForm((f) => ({ ...f, poId, lines: linesOf(po) }));
  };

  // Fill the form from a receipt / delivery note that was uploaded: find the order, then the delivered quantities per line.
  const applyDoc = async (x) => {
    const notes = [];
    let po = form.poId ? pos.find((p) => p.id === form.poId) : null;
    if (!po) {
      const scored = pos.map((p) => {
        const hit = x.poNo && String(p.poNo).toLowerCase() === x.poNo.toLowerCase();
        const matched = x.lines.filter((l) => bestMatch(l.description, p.lines, (pl) => pl.itemName, 0.6)).length;
        return { p, score: (hit ? 100 : 0) + similarity(x.supplierName, p.supplierName) * 3 + matched };
      }).sort((a, b) => b.score - a.score);
      if (scored[0] && scored[0].score >= 2.5) po = scored[0].p;
    }
    if (!po) notes.push("Could not tell which purchase order this belongs to — choose it above, then upload again to fill the lines.");
    let lines = po ? linesOf(po) : [];
    if (po) {
      lines = lines.map((l) => ({ ...l, delivered: "" })); // the paper is the truth: lines not on it were not delivered
      x.lines.forEach((dl) => {
        const m = bestMatch(dl.description, lines, (l) => l.name, 0.6);
        if (!m) { notes.push(`"${dl.description}"${dl.qty ? ` (${dl.qty}${dl.unit ? " " + dl.unit : ""})` : ""} is not on this order — a new product. Add it to the order / inventory first, then receive it.`); return; }
        const i = lines.indexOf(m);
        if (dl.unit && !pickUnit(dl.unit, [m.unit], null)) notes.push(`Check the unit for ${m.name}: the document says ${dl.qty} ${dl.unit}, the order is in ${m.unit}.`);
        lines[i] = { ...m, delivered: numStr(dl.qty), batchNo: dl.batchNo || m.batchNo, expiryDate: dl.expiryDate || m.expiryDate };
      });
    }
    setForm((f) => ({ ...f, poId: po ? po.id : f.poId, deliveryNoteNo: x.deliveryNoteNo || f.deliveryNoteNo, supplierInvoiceNo: x.invoiceNo || f.supplierInvoiceNo, vehicleNo: x.vehicleNo || f.vehicleNo, receivedDate: x.date || f.receivedDate, lines: po ? lines : f.lines }));
    setDocNotes(notes);
    toast.success(po ? "Form filled from the document — please check every line." : "Header details filled from the document.");
  };

  const setLine = (i, p) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const info = (id) => items.find((i) => i.id === id) || {};

  const save = async (ev) => {
    ev.preventDefault();
    if (!form.poId) { toast.error("Choose the purchase order"); return; }
    const lines = form.lines.filter((l) => l.delivered !== "" && Number(l.delivered) > 0).map((l) => {
      const o = { itemId: l.itemId, unit: l.unit, delivered: Number(l.delivered), locationId: l.locationId, batchNo: l.batchNo, expiryDate: l.expiryDate || null, reason: l.reason };
      if (l.accepted !== "") o.accepted = Number(l.accepted);
      if (l.quarantined !== "") o.quarantined = Number(l.quarantined);
      if (l.rejected !== "") o.rejected = Number(l.rejected);
      if (l.tempC !== "") o.checks = { tempC: Number(l.tempC) };
      return o;
    });
    if (!lines.length) { toast.error("Enter what was delivered on at least one line"); return; }
    const r = await run(() => api.post("/receiving/grns", { poId: form.poId, deliveryNoteNo: form.deliveryNoteNo, supplierInvoiceNo: form.supplierInvoiceNo, vehicleNo: form.vehicleNo, receivedDate: form.receivedDate, notes: form.notes, lines }), "Receipt saved as a draft. Post it to add the goods to stock.");
    if (r) { setForm(null); setDetail(r.data); }
  };
  const open = async (id) => { try { setDetail((await api.get(`/receiving/grns/${id}`)).data); } catch (e) { toast.error(errText(e)); } };
  const post = async () => { const r = await run(() => api.post(`/receiving/grns/${detail.id}/post`, {}), "Posted to stock"); if (r) setDetail(r.data); };
  const cancel = async (reason) => { const r = await run(() => api.post(`/receiving/grns/${detail.id}/cancel`, { reason }), "Cancelled"); if (r) { setAsk(false); setDetail(r.data); } };

  const columns = [
    { key: "grnNo", label: "GRN no.", render: (r) => <>{r.grnNo}</> },
    { key: "poNo", label: "Order" }, { key: "supplierName", label: "Supplier" },
    { key: "receivedDate", label: "Received", render: (r) => dateShort(r.receivedDate) },
    { key: "deliveryNoteNo", label: "Delivery note", render: (r) => r.deliveryNoteNo || "—" },
    { key: "rej", label: "Rejected / held", render: (r) => { const parts = r.lines.flatMap((l) => [l.rejected > 0 && `${qty(l.rejected)} ${l.unit} rejected`, l.quarantined > 0 && `${qty(l.quarantined)} ${l.unit} held`]).filter(Boolean); return parts.length ? <Badge tone="amber">{parts.join(", ")}</Badge> : "—"; } },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  useOpenParam(open);
  return (
    <div className="inner-page inv-page">
      <PageHead title="Goods receipts" count={`${list.total} receipt(s)`}>
        <ExportBtn list={list} apply={rf.apply} columns={columns} name="goods_receipts" sheet="Goods receipts" />
        {canWrite && <Btn type="button" kind="primary" onClick={openNew}>+ Receive goods</Btn>}
      </PageHead>
      <div className="inv-stack">
        <Toolbar>
          <SearchBox placeholder=" Search GRN, order or delivery note" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["draft", "posting", "posted", "cancelled"].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select>
          {rf.controls}
        </Toolbar>
        <DataTable detail="purchase/receipts" columns={columns} rows={rf.filtered} loading={list.loading} error={list.error} onRetry={list.reload} empty="No goods receipts yet. Receive goods against a sent purchase order." more={list} />
      </div>

      {form && (
        <Modal wide title="Receive goods" onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="grn-form" kind="primary" disabled={busy}>Save draft</Btn></>}>
          <form id="grn-form" onSubmit={save}>
            <DocAutofill kind="receipt" toast={toast} disabled={busy} onExtracted={applyDoc} />
            {docNotes.length > 0 && <div className="inv-banner" role="status">{docNotes.map((n, i) => <div key={i}>{n}</div>)}</div>}
            <div className="inv-grid">
              <Field label="Purchase order" required full><Select value={form.poId} onChange={(e) => pickPo(e.target.value)}><option value="">Choose a sent order</option>{pos.map((p) => <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName}</option>)}</Select></Field>
              <Field label="Received on"><DateInput value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} /></Field>
              <Field label="Delivery note no."><input className="inv-input" maxLength={60} value={form.deliveryNoteNo} onChange={(e) => setForm({ ...form, deliveryNoteNo: e.target.value })} /></Field>
              <Field label="Supplier invoice no."><input className="inv-input" maxLength={60} value={form.supplierInvoiceNo} onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })} /></Field>
              <Field label="Vehicle no."><input className="inv-input" maxLength={60} value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} /></Field>
            </div>
            {locations.length === 0 && <div className="inv-banner">Create a storage location first (Storage Locations).</div>}
            {form.lines.length > 0 && <>
              <div className="inv-hint">Delivered = accepted + held in quarantine + rejected. Leave accepted blank to accept everything not held or rejected. Rejected goods never enter stock. Give a reason whenever goods are held or rejected.</div>
              {form.lines.map((l, i) => { const it = info(l.itemId); return (
                <div key={i} className="inv-card" style={{ padding: 12 }}>
                  <div className="inv-strong">{l.name} <span className="inv-muted">ordered {qty(l.ordered)} {l.unit}, outstanding {qty(l.outstanding)} {l.unit}</span></div>
                  <div className="inv-grid" style={{ marginTop: 8 }}>
                    <Field label={`Delivered (${l.unit})`}><input className="inv-input" inputMode="decimal" value={l.delivered} onChange={(e) => setLine(i, { delivered: e.target.value })} /></Field>
                    <Field label={`Accepted (${l.unit})`}><input className="inv-input" inputMode="decimal" value={l.accepted} onChange={(e) => setLine(i, { accepted: e.target.value })} /></Field>
                    <Field label={`Hold in quarantine (${l.unit})`}><input className="inv-input" inputMode="decimal" value={l.quarantined} onChange={(e) => setLine(i, { quarantined: e.target.value })} /></Field>
                    <Field label={`Rejected (${l.unit})`}><input className="inv-input" inputMode="decimal" value={l.rejected} onChange={(e) => setLine(i, { rejected: e.target.value })} /></Field>
                    <Field label="Storage location"><Select value={l.locationId} onChange={(e) => setLine(i, { locationId: e.target.value })}>{locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
                    <Field label={`Batch no.${it.trackBatches ? " *" : ""}`}><input className="inv-input" maxLength={60} value={l.batchNo} onChange={(e) => setLine(i, { batchNo: e.target.value })} /></Field>
                    <Field label={`Expiry date${it.trackExpiry ? " *" : ""}`}><DateInput value={l.expiryDate} onChange={(e) => setLine(i, { expiryDate: e.target.value })} /></Field>
                    <Field label="Temperature °C" hint="For chilled / frozen goods"><input className="inv-input" inputMode="decimal" value={l.tempC} onChange={(e) => setLine(i, { tempC: e.target.value })} /></Field>
                    <Field label="Reason (if held or rejected)" full><input className="inv-input" maxLength={300} value={l.reason} onChange={(e) => setLine(i, { reason: e.target.value })} /></Field>
                  </div>
                </div>); })}
            </>}
          </form>
        </Modal>
      )}

      {detail && !form && (
        <Modal wide title={detail.grnNo} onClose={() => setDetail(null)}
          footer={<div className="inv-btnrow">
            <Btn type="button" kind="plain" onClick={() => downloadReceiptPdf(detail).catch((e) => toast.error(errText(e, "Could not create the PDF")))}>Download PDF</Btn>
            {["draft", "posting"].includes(detail.status) && canWrite && <Btn type="button" kind="primary" disabled={busy} onClick={post}>{detail.status === "posting" ? "Resume posting" : "Post to stock"}</Btn>}
            {detail.status === "draft" && canWrite && <Btn type="button" kind="danger" onClick={() => setAsk(true)}>Cancel receipt</Btn>}
          </div>}>
          <KeyVals rows={[["Status", <StatusBadge key="s" status={detail.status} />], ["Order", detail.poNo], ["Supplier", detail.supplierName], ["Received", dateShort(detail.receivedDate)], ["On time", detail.onTime === null ? undefined : detail.onTime ? "Yes" : "Late"], ["Delivery note", detail.deliveryNoteNo], ["Supplier invoice", detail.supplierInvoiceNo], ["Vehicle", detail.vehicleNo], ["Received by", detail.receivedByName], ["Notes", detail.notes]]} />
          {detail.status === "posting" && <div className="inv-banner">This receipt is partly posted. Press “Resume posting” — nothing is posted twice.</div>}
          <div className="inv-tablewrap"><table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Delivered</th><th className="inv-num">Accepted</th><th className="inv-num">Held</th><th className="inv-num">Rejected</th><th>Batch / expiry</th><th className="inv-num">Value kept</th></tr></thead>
            <tbody>{detail.lines.map((l, i) => (<tr key={i}><td>{l.itemName}{l.reason && <div className="inv-muted">{l.reason}</div>}</td><td className="inv-num">{qty(l.delivered)} {l.unit}</td><td className="inv-num">{qty(l.accepted)} {l.unit}</td><td className="inv-num">{qty(l.quarantined)} {l.unit}</td><td className="inv-num">{qty(l.rejected)} {l.unit}</td><td>{l.batchNo || "—"}{l.expiryDate ? ` · ${dateShort(l.expiryDate)}` : ""}</td><td className="inv-num">{money(l.value)}</td></tr>))}</tbody>
          </table></div>
          <div className="inv-hint">Stock is valued at the order price after discount and before GST (GST is treated as recoverable input tax). Freight is not added to stock cost.</div>
          <History entries={detail.history} />
        </Modal>
      )}
      {ask && <ReasonDialog title="Cancel receipt" label="Reason for cancelling" danger busy={busy} onClose={() => setAsk(false)} onSubmit={cancel} />}
    </div>
  );
}
