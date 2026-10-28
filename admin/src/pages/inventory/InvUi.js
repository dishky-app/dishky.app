/**
 * InvUi.js — small shared building blocks for the Purchase & Inventory pages.
 * Plain React + the `inv-` classes in inventory.css; no new dependencies.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../api";
import { useVenue } from "../../context/VenueContext";
import "./inventory.css";

export const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n) || 0);
export const qty = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(Number(n) || 0);
export const dateShort = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const dateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export const errText = (e, fallback = "Something went wrong") =>
  e?.response?.data?.error || e?.message || fallback;

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Paged list loader: re-fetches when path/params/venue change; ignores stale responses. */
export function usePagedList(path, params = {}, { pageSize = 25 } = {}) {
  const { venueParam, venueId } = useVenue();
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: "", extra: null });
  const seq = useRef(0);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const { data } = await api.get(path, { params: { ...venueParam(), ...JSON.parse(key), page, limit: pageSize } });
      if (mine !== seq.current) return;
      setState({ rows: data.data, total: data.total, loading: false, error: "", extra: data });
    } catch (e) {
      if (mine !== seq.current) return;
      setState((s) => ({ ...s, loading: false, error: errText(e, "Could not load data") }));
    }
  }, [path, key, page, pageSize, venueParam]);

  useEffect(() => { setPage(1); }, [key, venueId]);
  useEffect(() => { load(); }, [load, venueId]);
  return { ...state, page, setPage, pageSize, reload: load };
}

export function Pager({ page, setPage, total, pageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="inv-pager">
      <span className="inv-muted">{total === 0 ? "No records" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}</span>
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="inv-btn inv-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} / {pages}</span>
        <button type="button" className="inv-btn inv-btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </span>
    </div>
  );
}

/** Generic table: columns = [{ key, label, render?, num? }] */
export function DataTable({ columns, rows, loading, error, empty = "Nothing here yet", onRetry, rowKey }) {
  if (error) {
    return (
      <div className="inv-error" role="alert">
        {error}
        {onRetry && <div style={{ marginTop: 10 }}><button type="button" className="inv-btn inv-btn-sm" onClick={onRetry}>Retry</button></div>}
      </div>
    );
  }
  return (
    <div className="inv-tablewrap">
      <table className="inv-table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? "inv-num" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>
          {loading && rows.length === 0
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="inv-skel">{columns.map((c) => <td key={c.key}><div /></td>)}</tr>
              ))
            : rows.map((r, i) => (
                <tr key={rowKey ? rowKey(r) : r.id || i}>
                  {columns.map((c) => <td key={c.key} className={c.num ? "inv-num" : ""}>{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <div className="inv-empty">{empty}</div>}
    </div>
  );
}

export function Badge({ tone = "grey", children }) {
  return <span className={`inv-badge inv-badge-${tone}`}>{children}</span>;
}

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("input,select,textarea,button")?.focus();
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="inv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="inv-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={wide ? { maxWidth: 880 } : undefined}>
        <div className="inv-modal-head">
          <h2>{title}</h2>
          <button type="button" className="inv-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="inv-modal-body">{children}</div>
        {footer && <div className="inv-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, required, error, hint, full, children, htmlFor }) {
  return (
    <div className={`inv-field${full ? " inv-full" : ""}`}>
      <label htmlFor={htmlFor}>{label}{required && <span className="inv-req" aria-hidden="true">*</span>}</label>
      {children}
      {error ? <span className="inv-err" role="alert">{error}</span> : hint ? <span className="inv-hint">{hint}</span> : null}
    </div>
  );
}

export function PageHead({ title, crumb, children }) {
  return (
    <div className="inv-head">
      <div>
        <div className="inv-crumbs">Purchase &amp; Inventory{crumb ? ` / ${crumb}` : ""}</div>
        <h1>{title}</h1>
      </div>
      <div className="inv-actions">{children}</div>
    </div>
  );
}

/** Loads a small reference list once (locations, items, suppliers, units ...). */
export function useRef_(path, params, pick = (d) => d) {
  const { venueParam, venueId } = useVenue();
  const [rows, setRows] = useState([]);
  const key = JSON.stringify(params || {});
  useEffect(() => {
    let live = true;
    api.get(path, { params: { ...venueParam(), ...JSON.parse(key) } })
      .then(({ data }) => { if (live) setRows(pick(data)); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, venueId]);
  return rows;
}
