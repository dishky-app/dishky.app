/**
 * PurchUi.js — shared pieces for the procurement pages (requests, RFQs, orders).
 * Totals shown here come from the server; the editor never calculates money that gets saved.
 */
import React, { useState } from "react";
import { Badge, Field, Modal, qty } from "./InvUi";

const TONES = {
  draft: "grey", pending_approval: "amber", changes_requested: "amber", approved: "green", rejected: "red", cancelled: "grey",
  rfq_issued: "blue", ordered: "blue", sent: "blue", responses_received: "blue", evaluation: "blue", awarded: "green", closed: "grey",
  partially_received: "amber", received: "green", received_: "green", shortlisted: "blue", selected: "green", revision_requested: "amber",
};
export const statusLabel = (s) => String(s || "").replace(/_/g, " ");
export function StatusBadge({ status }) {
  return <Badge tone={TONES[status] || "grey"}>{statusLabel(status)}</Badge>;
}

/** Units an item can be entered in: its base unit, purchase unit and packaging conversions. */
export function unitsFor(item) {
  if (!item) return [];
  const set = new Set([item.baseUnit, item.purchaseUnit, ...(item.conversions || []).map((c) => c.unit)].filter(Boolean));
  return [...set];
}

/**
 * Line editor. `columns` picks which price fields show.
 * value: [{ itemId, qty, unit, unitPrice?, discountPct?, gstRate?, remarks? }]
 */
export function LineEditor({ items, value, onChange, price = false, disabled = false }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const set = (idx, patch) => onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const add = () => {
    const taken = new Set(value.map((l) => l.itemId));
    const next = items.find((i) => !taken.has(i.id));
    if (!next) return;
    onChange([...value, { itemId: next.id, qty: "", unit: next.purchaseUnit || next.baseUnit, unitPrice: "", discountPct: "", gstRate: next.gstRate ?? "" }]);
  };
  return (
    <div className="inv-lines">
      <div className="inv-tablewrap">
        <table className="inv-table">
          <thead><tr>
            <th>Item</th><th className="inv-num">Qty</th><th>Unit</th>
            {price && <><th className="inv-num">Price / unit</th><th className="inv-num">Disc %</th><th className="inv-num">GST %</th></>}
            <th />
          </tr></thead>
          <tbody>
            {value.map((l, idx) => {
              const item = byId.get(l.itemId);
              return (
                <tr key={idx}>
                  <td style={{ minWidth: 180 }}>
                    <select className="inv-select" aria-label="Item" disabled={disabled} value={l.itemId}
                      onChange={(e) => { const n = byId.get(e.target.value); set(idx, { itemId: e.target.value, unit: n?.purchaseUnit || n?.baseUnit, gstRate: n?.gstRate ?? "" }); }}>
                      {items.filter((i) => i.id === l.itemId || !value.some((v) => v.itemId === i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td className="inv-num"><input className="inv-input inv-w80" aria-label="Quantity" inputMode="decimal" disabled={disabled} value={l.qty} onChange={(e) => set(idx, { qty: e.target.value })} /></td>
                  <td><select className="inv-select inv-w90" aria-label="Unit" disabled={disabled} value={l.unit} onChange={(e) => set(idx, { unit: e.target.value })}>{unitsFor(item).map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                  {price && <>
                    <td className="inv-num"><input className="inv-input inv-w90" aria-label="Unit price" inputMode="decimal" disabled={disabled} value={l.unitPrice} onChange={(e) => set(idx, { unitPrice: e.target.value })} /></td>
                    <td className="inv-num"><input className="inv-input inv-w60" aria-label="Discount percent" inputMode="decimal" disabled={disabled} value={l.discountPct} onChange={(e) => set(idx, { discountPct: e.target.value })} /></td>
                    <td className="inv-num"><input className="inv-input inv-w60" aria-label="GST percent" inputMode="decimal" disabled={disabled} value={l.gstRate} onChange={(e) => set(idx, { gstRate: e.target.value })} /></td>
                  </>}
                  <td>{!disabled && <button type="button" className="inv-btn inv-btn-sm inv-btn-danger" aria-label="Remove line" onClick={() => onChange(value.filter((_, i) => i !== idx))}>Remove</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {value.length === 0 && <div className="inv-empty">No lines yet. Add an item.</div>}
      </div>
      {!disabled && <div><button type="button" className="inv-btn inv-btn-sm" onClick={add} disabled={value.length >= items.length}>+ Add line</button></div>}
    </div>
  );
}

/** Convert editor lines to the API shape. Throws a readable Error when a line is incomplete. */
export function linesPayload(lines, { price = false } = {}) {
  if (!lines.length) throw new Error("Add at least one line");
  return lines.map((l) => {
    const q = Number(l.qty);
    if (!(q > 0)) throw new Error("Every line needs a quantity greater than zero");
    const out = { itemId: l.itemId, qty: q, unit: l.unit };
    if (price) {
      if (l.unitPrice === "" || !(Number(l.unitPrice) >= 0)) throw new Error("Every line needs a unit price");
      out.unitPrice = Number(l.unitPrice);
      if (l.discountPct !== "") out.discountPct = Number(l.discountPct);
      if (l.gstRate !== "") out.gstRate = Number(l.gstRate);
    }
    return out;
  });
}

/** A small "reason / comment" dialog used for reject, cancel, revise, award and similar. */
export function ReasonDialog({ title, label = "Reason", required = true, confirmLabel = "Confirm", danger, onSubmit, onClose, busy }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (required && !text.trim()) { setErr(`${label} is required`); return; }
    onSubmit(text.trim());
  };
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button type="button" className="inv-btn" onClick={onClose}>Back</button><button type="submit" form="purch-reason" className={`inv-btn ${danger ? "inv-btn-danger" : "inv-btn-primary"}`} disabled={busy}>{confirmLabel}</button></>}>
      <form id="purch-reason" onSubmit={submit}>
        <Field label={label} required={required} error={err} full>
          <textarea className="inv-textarea" autoFocus maxLength={500} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} />
        </Field>
      </form>
    </Modal>
  );
}

export function KeyVals({ rows }) {
  return (
    <dl className="inv-kv">
      {rows.filter((r) => r[1] !== undefined && r[1] !== null && r[1] !== "").map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>))}
    </dl>
  );
}

export function History({ entries }) {
  if (!entries?.length) return null;
  return (
    <div>
      <div className="inv-section">History</div>
      <ul className="inv-history">
        {entries.map((h, i) => (
          <li key={i}><b>{statusLabel(h.action)}</b> — {h.byName || "—"} <span className="inv-muted">{new Date(h.at).toLocaleString("en-IN")}</span>{h.comment ? <div className="inv-muted">{h.comment}</div> : null}</li>
        ))}
      </ul>
    </div>
  );
}

export const qtyUnit = (q, u) => `${qty(q)} ${u || ""}`.trim();
