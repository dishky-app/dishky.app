/**
 * RecordView.js — generic details page for one Purchase or Inventory record, laid out like IngredientDetails / DishDetails
 * (details-container, details-header with back button, sections of data-tables).
 * Shared by the two modules: purchase/PurchaseRecordDetails.js (suppliers, orders, receipts, returns, invoices, payments)
 * and inventory/InventoryRecordDetails.js (items, audits). Each passes its own `cfg` and may add module-specific
 * sections (`extras`) and header buttons (`headerActions`).
 * Everything shown comes straight from the server's detail endpoint, so nothing is recalculated here.
 * Edits and workflow actions (approve, send, post …) stay on the list pages.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api";
import { useVenue } from "../../context/VenueContext";
import Button3D from "../../components/Button3D";
import PageLoader from "../../components/PageLoader";
import editIcon from "../../icon/edit-icon.png";
import { dateShort, dateTime, errText, money, qty } from "./InvUi";
import { StatusBadge, statusLabel } from "./PurchUi";
import "../IngredientDetails.css";


const HIDDEN = new Set(["id", "_id", "__v", "venueId", "restaurantId", "itemId", "supplierId", "locationId", "categoryId", "poId", "grnId", "createdBy", "updatedBy"]);
const MONEY = /(total|amount|price|cost|value|payable|paid|outstanding|pending|freight|charges|tax|taxable|credit|limit|minorder)/i;
const NOT_MONEY = /(pct|rate|date|no$|count|days|qty|quantity|number|status|terms)/i;
// Quantity fields get the record's own unit (a line's `unit`, or an item's `baseUnit`) so stock values never show as bare numbers.
const QTY_KEY = /^(qty|quantity|ordered|received|outstanding|delivered|accepted|rejected|quarantined|counted|system|variance|onHand|available|reserved|damaged|expired|qtyIn|qtyOut|balanceAfter|minStock|reorderPoint|safetyStock|maxStock|reorderQty|billable|invoiced|enteredQty|orderedQty|receivedQty)$/;
const label = (k) => k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();
const isoLike = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v);

function fmt(k, v, unit) {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" && unit && QTY_KEY.test(k)) return `${qty(v)} ${unit}`;
  if (typeof v === "number") return MONEY.test(k) && !NOT_MONEY.test(k) ? money(v) : /pct|rate/i.test(k) ? `${qty(v)}%` : qty(v);
  if (isoLike(v)) return /At$|time/i.test(k) ? dateTime(v) : dateShort(v);
  if (k === "status") return <StatusBadge status={v} />;
  if (typeof v === "string") return /status|type|reason|method|source|action/i.test(k) ? statusLabel(v) : v;
  return undefined;
}
const unitOf = (o) => (typeof o.unit === "string" && o.unit) || (typeof o.baseUnit === "string" && o.baseUnit) || "";
const scalars = (obj) => Object.entries(obj).filter(([k]) => !HIDDEN.has(k)).map(([k, v]) => [label(k), fmt(k, v, unitOf(obj))]).filter(([, v]) => v !== undefined);

function LinesTable({ rows }) {
  const keys = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!HIDDEN.has(k) && !keys.includes(k) && fmt(k, r[k], unitOf(r)) !== undefined) keys.push(k); }));
  const cols = keys.slice(0, 10);
  return (
    <div className="inv-tablewrap">
      <table className="data-table">
        <thead><tr>{cols.map((k) => <th key={k} className={rows.some((r) => typeof r[k] === "number") ? "inv-num" : ""}>{label(k)}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id || r.index || i}>{cols.map((k) => <td key={k} className={typeof r[k] === "number" ? "inv-num" : ""}>{fmt(k, r[k], unitOf(r)) ?? "—"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function KeyTable({ title, rows }) {
  return (
    <div className="section">
      <div className="section-title"><span>{title}</span></div>
      <table className="data-table">
        <tbody>{rows.map(([k, v]) => <tr key={k}><td><strong>{k}</strong></td><td>{v}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function RecordView({ kind, cfg, extras, headerActions, hideManage = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { venueParam, venueId } = useVenue();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setDoc((await api.get(`${cfg.api}/${id}`, { params: venueParam() })).data); }
    catch (e) { setDoc(null); setError(errText(e, "Could not load this record")); }
  }, [cfg.api, id, venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  if (error) {
    return (
      <div className="details-container">
        <div className="details-header"><button type="button" className="back-btn" aria-label="Back" onClick={() => navigate(cfg.list)} /><h2>{cfg.title}</h2></div>
        <div className="details-body"><div className="inv-error" role="alert">{error}<div style={{ marginTop: 10 }}><Button3D variant="cancel" onClick={load}>Retry</Button3D></div></div></div>
      </div>
    );
  }
  if (!doc) return <PageLoader fill label={`Loading ${cfg.title.toLowerCase()}…`} />;

  const arrays = Object.entries(doc).filter(([k, v]) => Array.isArray(v) && v.length && typeof v[0] === "object" && !/history|timeline/i.test(k) && !HIDDEN.has(k));
  const nested = Object.entries(doc).filter(([k, v]) => v && typeof v === "object" && !Array.isArray(v) && !HIDDEN.has(k) && !isoLike(v)).map(([k, v]) => [label(k), scalars(v)]).filter(([, r]) => r.length);
  const history = doc.history || doc.timeline;
  const manage = kind === "suppliers" || kind === "items" ? "Edit" : "Manage";
  const pairs = [[["Details", scalars(doc)], ...nested.slice(0, 1)], ...nested.slice(1).reduce((acc, n, i) => { if (i % 2 === 0) acc.push([n]); else acc[acc.length - 1].push(n); return acc; }, [])];

  return (
    <div className="details-container">
      <div className="details-header">
        <button type="button" className="back-btn" aria-label="Back" onClick={() => navigate(cfg.list)} />
        <h2>{`${cfg.title} ${doc[cfg.no] || doc.name || ""}`.trim()}</h2>
        {doc.status && <StatusBadge status={doc.status} />}
        {headerActions ? headerActions(doc, load) : null}
        {!hideManage && <Button3D variant="cancel" onClick={() => navigate(`${cfg.list}?open=${id}`)}><img src={editIcon} alt="" />{manage}</Button3D>}
      </div>

      <div className="details-body">
        {pairs.map((group, gi) => (
          <div className="horizontal-form-group" key={gi}>
            {group.map(([title, rows]) => <KeyTable key={title} title={title} rows={rows} />)}
          </div>
        ))}

        {arrays.map(([k, rows]) => (
          <div className="horizontal-form-group" key={k}>
            <div className="section">
              <div className="section-title"><span>{label(k)}</span></div>
              <LinesTable rows={rows} />
            </div>
          </div>
        ))}

        {extras ? extras(doc, load) : null}

        {Array.isArray(history) && history.length > 0 && (
          <div className="horizontal-form-group">
            <div className="section">
              <div className="section-title"><span>History</span></div>
              <ul className="inv-history">
                {history.map((h, i) => (
                  <li key={i}><b>{statusLabel(h.action)}</b> — {h.byName || "—"} <span className="inv-muted">{h.at ? dateTime(h.at) : ""}</span>{h.comment ? <div className="inv-muted">{h.comment}</div> : null}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
