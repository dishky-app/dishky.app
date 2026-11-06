/**
 * ItemBatches.js — batchwise stock of one inventory item, shown on the item details page.
 * One row per purchase (goods-receipt line). Expiry and the other batch details are entered here for each purchase;
 * quantities come from the stock balances and are read-only.
 */
import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DateInput, ExportBtn, Field, Modal, Select, dateShort, errText, money, qty } from "../pi-shared/InvUi";

const STATE = { expired: ["red", "Expired"], near_expiry: ["amber", "Expiring soon"], ok: ["green", "In date"], no_expiry: ["grey", "No expiry"] };
const COND = { "": "—", ambient: "Ambient", chilled: "Chilled", frozen: "Frozen" };
const day = (d) => (d ? String(d).slice(0, 10) : "");

export default function ItemBatches({ item }) {
  const { hasModulePermission } = useAuth();
  const { venueId, venueParam } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("inventoryItems", "write");
  const [state, setState] = useState({ rows: [], loading: true, error: "" });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/inventory/items/${item.id}/batches`, { params: venueParam() }); setState({ rows: data.data, loading: false, error: "" }); }
    catch (e) { setState({ rows: [], loading: false, error: errText(e, "Could not load batches") }); }
  }, [item.id, venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  const edit = (b) => setForm({ id: b.id, batchNo: b.batchNo, trackExpiry: item.trackExpiry, mfgDate: day(b.mfgDate), expiryDate: day(b.expiryDate), supplierLotNo: b.supplierLotNo, storageCondition: b.storageCondition, qualityGrade: b.qualityGrade, notes: b.notes, err: "" });
  const save = async (ev) => {
    ev.preventDefault();
    if (form.trackExpiry && !form.expiryDate) { setForm({ ...form, err: "This item tracks expiry — enter the expiry date" }); return; }
    if (form.mfgDate && form.expiryDate && form.mfgDate > form.expiryDate) { setForm({ ...form, err: "Manufacturing date is after the expiry date" }); return; }
    setBusy(true);
    try {
      await api.patch(`/inventory/items/${item.id}/batches/${encodeURIComponent(form.id)}`, {
        mfgDate: form.mfgDate || null, expiryDate: form.expiryDate || null, supplierLotNo: form.supplierLotNo, storageCondition: form.storageCondition, qualityGrade: form.qualityGrade, notes: form.notes,
      }, { params: venueParam() });
      toast.success("Batch details saved"); setForm(null); load();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const unit = item.baseUnit;
  const cols = [
    { key: "batchNo", label: "Batch no." }, { key: "receivedDate", label: "Received", exp: (b) => (b.receivedDate ? dateShort(b.receivedDate) : "") },
    { key: "supplierName", label: "Supplier" }, { key: "grnNo", label: "Receipt" }, { key: "poNo", label: "Order" },
    { key: "received", label: `Received qty (${unit})`, num: true }, { key: "onHand", label: `On hand (${unit})`, num: true }, { key: "unitCost", label: "Unit cost", num: true },
    { key: "mfgDate", label: "Mfg date", exp: (b) => (b.mfgDate ? dateShort(b.mfgDate) : "") }, { key: "expiryDate", label: "Expiry", exp: (b) => (b.expiryDate ? dateShort(b.expiryDate) : "") },
    { key: "state", label: "Expiry status", exp: (b) => STATE[b.state][1] }, { key: "supplierLotNo", label: "Supplier lot" }, { key: "storageCondition", label: "Storage", exp: (b) => COND[b.storageCondition] },
    { key: "qualityGrade", label: "Quality grade" }, { key: "notes", label: "Notes" },
  ];
  return (
    <div className="horizontal-form-group">
      <div className="section" style={{ width: "100%" }}>
        <div className="section-title"><span>Batches</span></div>
        <div style={{ padding: "0 0 10px" }}><ExportBtn rows={state.rows} columns={cols} name={`batches_${item.sku || item.id}`} sheet="Batches" /></div>
        {state.error ? <div className="inv-error" role="alert">{state.error}</div> : (
          <div className="inv-tablewrap">
            <table className="data-table">
              <thead><tr><th>Batch no.</th><th>Received</th><th>Supplier / receipt</th><th className="inv-num">Received</th><th className="inv-num">On hand</th><th className="inv-num">Unit cost</th><th>Mfg</th><th>Expiry</th><th>Lot / storage / grade</th><th /></tr></thead>
              <tbody>
                {state.loading ? <tr><td colSpan={10}>Loading…</td></tr> : state.rows.length === 0 ? <tr><td colSpan={10}>No stock or purchases of this item yet. Batches appear when goods are received.</td></tr> : state.rows.map((b) => (
                  <tr key={b.id}>
                    <td><b>{b.batchNo || "(no batch)"}</b>{b.source === "stock" && !b.persisted && <div className="inv-muted">opening / older stock</div>}</td>
                    <td>{b.receivedDate ? dateShort(b.receivedDate) : "—"}</td>
                    <td>{b.supplierName || "—"}{(b.grnNo || b.poNo) && <div className="inv-muted">{[b.grnNo, b.poNo].filter(Boolean).join(" · ")}</div>}</td>
                    <td className="inv-num">{b.source === "grn" ? `${qty(b.received)} ${b.unit}` : "—"}</td>
                    <td className="inv-num">{qty(b.onHand)} {b.unit}{b.quarantined > 0 && <div className="inv-muted">{qty(b.quarantined)} held</div>}</td>
                    <td className="inv-num">{b.unitCost ? money(b.unitCost) : "—"}</td>
                    <td>{b.mfgDate ? dateShort(b.mfgDate) : "—"}</td>
                    <td>{b.expiryDate ? <Badge tone={STATE[b.state][0]}>{dateShort(b.expiryDate)}</Badge> : b.detailsMissing ? <Badge tone="amber">Enter expiry</Badge> : "—"}</td>
                    <td>{[b.supplierLotNo && `Lot ${b.supplierLotNo}`, b.storageCondition && COND[b.storageCondition], b.qualityGrade && `Grade ${b.qualityGrade}`].filter(Boolean).join(" · ") || "—"}{b.notes && <div className="inv-muted">{b.notes}</div>}</td>
                    <td>{canWrite && <Btn type="button" kind="plain" sm onClick={() => edit(b)}>Edit</Btn>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {form && (
        <Modal title={`Batch ${form.batchNo || "(no batch)"} — ${item.name}`} onClose={() => setForm(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setForm(null)}>Cancel</Btn><Btn type="submit" form="batch-form" kind="primary" disabled={busy}>Save</Btn></>}>
          <form id="batch-form" onSubmit={save}>
            {form.err && <div className="field-error-msg" role="alert">{form.err}</div>}
            <div className="inv-grid">
              <Field label="Manufacturing date"><DateInput value={form.mfgDate} max={form.expiryDate || undefined} onChange={(e) => setForm({ ...form, mfgDate: e.target.value, err: "" })} /></Field>
              <Field label="Expiry date" required={form.trackExpiry}><DateInput value={form.expiryDate} min={form.mfgDate || undefined} onChange={(e) => setForm({ ...form, expiryDate: e.target.value, err: "" })} /></Field>
              <Field label="Supplier lot no."><input className="inv-input" maxLength={60} value={form.supplierLotNo} onChange={(e) => setForm({ ...form, supplierLotNo: e.target.value })} /></Field>
              <Field label="Storage condition"><Select value={form.storageCondition} onChange={(e) => setForm({ ...form, storageCondition: e.target.value })}><option value="">—</option><option value="ambient">Ambient</option><option value="chilled">Chilled</option><option value="frozen">Frozen</option></Select></Field>
              <Field label="Quality grade"><input className="inv-input" maxLength={40} value={form.qualityGrade} onChange={(e) => setForm({ ...form, qualityGrade: e.target.value })} /></Field>
              <Field label="Notes" full><textarea className="inv-textarea" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <div className="inv-hint">Changing the dates also updates the stock held in this batch (expiry alerts and first-expiry-first-out use them).</div>
          </form>
        </Modal>
      )}
    </div>
  );
}
