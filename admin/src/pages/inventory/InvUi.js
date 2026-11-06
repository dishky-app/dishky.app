/**
 * InvUi.js — shared building blocks for the Purchase & Inventory pages.
 *
 * Everything here is a thin layer over the admin panel's own components and classes so these pages look
 * and behave like the rest of the app: Button3D, CustomDropdown, CustomDatePicker, the `.header` /
 * `.filter-bar` / `.table-wrapper` page layout, `.modal-overlay` + `.admin-modal` dialogs, `.admin-form-group`
 * + `.mat` floating-label fields and the `.status` pills. Only layout bits that have no global equivalent
 * live in inventory.css (prefix `inv-`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api";
import { useVenue } from "../../context/VenueContext";
import Button3D from "../../components/Button3D";
import CollapseChevron from "../../components/CollapseChevron";
import CustomDropdown from "../../components/CustomDropdown";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import { EmptyRow } from "../../App";
import useServerInfinite from "../../hooks/useServerInfinite";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../../components/InfiniteScrollLoader";
import closeIcon from "../../icon/close-icon.png";
import "../ModalCSS.css";
import "../Todo.css"; // supplies the floating-label (.mat) styles used by page-level forms inside .details-container
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

/**
 * Infinite list loader: fetches page 1, then the next page each time the sentinel at the end of the table
 * scrolls into view. Restarts from page 1 when path / params / branch change. `extra` is the first page's raw
 * response (totals etc.). Pass the returned object to <DataTable more={list} /> to render the loader row.
 */
export function usePagedList(path, params = {}, { pageSize = 25 } = {}) {
  const { venueParam, venueId } = useVenue();
  const key = JSON.stringify(params);
  const [extra, setExtra] = useState(null);
  const vp = useRef(venueParam);
  vp.current = venueParam;
  const fetchPage = useCallback(async (page, limit) => {
    try {
      const { data } = await api.get(path, { params: { ...vp.current(), ...JSON.parse(key), page, limit } });
      if (page === 1) setExtra(data);
      return { rows: data.data || [], total: data.total || 0 };
    } catch (e) {
      throw new Error(errText(e, "Could not load data"));
    }
  }, [path, key]);
  const l = useServerInfinite(fetchPage, `${path}|${key}|${venueId}`, { pageSize });
  return { ...l, loading: l.busy || !l.loaded, extra, reload: l.refresh };
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

/* ── buttons ───────────────────────────────────────────────────── */
/** The panel's 3-D button. kind: "primary" (green save), "plain" (neutral, default) or "danger" (red). */
export function Btn({ kind = "plain", sm = false, className = "", children, ...rest }) {
  const variant = kind === "primary" ? "save" : kind === "danger" ? "danger" : "cancel";
  return <Button3D variant={variant} className={`${sm ? "inv-sm" : ""} ${className}`.trim()} {...rest}>{children}</Button3D>;
}

/* ── page layout ───────────────────────────────────────────── */
/**
 * Same markup as the Payments / Dishes headers: collapse chevron, title, optional result count, actions on the
 * right. The chevron collapses the page's filter bars, tabs, KPI strips and notes (CSS keyed on `data-collapsed`
 * on the surrounding `.inv-page`, see inventory.css).
 */
export function PageHead({ title, count, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const page = ref.current?.closest(".inv-page");
    if (page) page.setAttribute("data-collapsed", String(collapsed));
  }, [collapsed]);
  return (
    <div className="header" ref={ref}>
      <div className="header-title-row">
        <div className="header-collapse-col">
          <button type="button" className="header-collapse-btn" onClick={() => setCollapsed((c) => !c)}
            data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={collapsed ? "Expand filters" : "Collapse filters"} aria-expanded={!collapsed}>
            <CollapseChevron collapsed={collapsed} />
          </button>
        </div>
        <div className="header-title-col">
          <div className="header-title-with-count">
            <h2 className="title">{title}</h2>
            {count !== undefined && count !== null && <span className="result-count">{count}</span>}
          </div>
        </div>
      </div>
      {children ? <div className="inv-head-actions">{children}</div> : null}
    </div>
  );
}

/** Animated wrapper (same grid-rows trick as CollapseSection) that closes when the page header is collapsed. */
function Collapsible({ children }) {
  return <div className="inv-collapsible"><div className="inv-collapsible-inner">{children}</div></div>;
}

/** Filter bar container; put SearchBox / Select / DateInput / Btn inside. */
export function Toolbar({ children }) {
  return <Collapsible><div className="filter-bar"><div className="filter-groups">{children}</div></div></Collapsible>;
}
/** Tab switcher drawn with the filter pills used by every other page. tabs = [[key, label], ...] */
export function Tabs({ tabs, value, onChange, inline = false }) {
  const group = (
    <div className="filter-group">
      {tabs.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={`filter-pill${value === k ? " active" : ""}`} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
  return inline ? group : <Collapsible><div className="filter-bar"><div className="filter-groups">{group}</div></div></Collapsible>;
}
export function SearchBox({ value, onChange, placeholder = " Search…", ...rest }) {
  return <input className="search-input" placeholder={placeholder} value={value} onChange={onChange} {...rest} />;
}

/**
 * Generic table in the panel's table style (`more` = an infinite list from usePagedList).
 * columns = [{ key, label, render?, num?, sortValue?, sort?: false }]
 *  - Sortable headers behave exactly like the Dishes page (▲ / ▼, click to toggle). A column sorts on r[key], or on
 *    sortValue(r); columns with no data of their own (buttons, computed cells) are left unsortable.
 *  - `detail="purchase/orders"`: clicking any cell opens /purchase/orders/<row id>, like clicking a dish name opens
 *    the dish. The first column is drawn as the blue `.clickable` link; buttons / inputs inside a row keep their own action.
 */
export function DataTable({ columns, rows, loading, error, empty = "Nothing here yet", onRetry, rowKey, more, detail }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const NO_SORT = ["act", "pick", "x"];
  const canSort = (c) => c.sort !== false && !NO_SORT.includes(c.key) && c.label !== "" &&
    (!!c.sortValue || rows.some((r) => r[c.key] !== undefined && r[c.key] !== null && typeof r[c.key] !== "object"));
  const toggle = (key) => setSort((p) => (p.key === key ? { key, direction: p.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  const sorted = useMemo(() => {
    const c = columns.find((x) => x.key === sort.key);
    if (!c) return rows;
    const dir = sort.direction === "asc" ? 1 : -1;
    const val = (r) => (c.sortValue ? c.sortValue(r) : r[c.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if ((x === undefined || x === null) && (y === undefined || y === null)) return 0;
      if (x === undefined || x === null) return 1;
      if (y === undefined || y === null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [rows, columns, sort]);
  const span = columns.length;

  if (error) {
    return (
      <div className="inv-error" role="alert">
        {error}
        {onRetry && <div style={{ marginTop: 10 }}><Btn sm onClick={onRetry}>Retry</Btn></div>}
      </div>
    );
  }
  const go = (e, r) => {
    if (!detail || !r.id) return;
    if (e.target.closest("button, a, input, select, textarea, label")) return;
    navigate(`/${detail}/${r.id}`);
  };
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map((c) => canSort(c) ? (
              <th key={c.key} onClick={() => toggle(c.key)} className={`${c.num ? "inv-num" : ""}${sort.key === c.key ? " sorted" : ""}`.trim()}>
                <span className="th-content sort-th">
                  <span>{c.label}</span>
                  <span className="sort-arrow">{sort.key === c.key ? (sort.direction === "asc" ? "▲" : "▼") : ""}</span>
                </span>
              </th>
            ) : <th key={c.key} className={c.num ? "inv-num" : ""}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0
            ? <EmptyRow colSpan={span} message="Loading…" />
            : rows.length === 0
              ? <EmptyRow colSpan={span} message={empty} />
              : sorted.map((r, i) => (
                <tr key={rowKey ? rowKey(r, i) : r.id || i}>
                  {columns.map((c, ci) => {
                    const content = c.render ? c.render(r) : r[c.key] ?? "—";
                    const link = detail && r.id && ci === 0;
                    return (
                      <td key={c.key} className={`${c.num ? "inv-num" : ""}${detail && r.id ? " inv-rowlink" : ""}`.trim()} onClick={detail ? (e) => go(e, r) : undefined}>
                        {link ? <span className="clickable">{content}</span> : content}
                      </td>
                    );
                  })}
                </tr>
              ))}
          {more && rows.length > 0 && <InfiniteScrollLoader sentinelRef={more.sentinelRef} hasMore={more.hasMore} colSpan={span} />}
        </tbody>
      </table>
      {more && <InfiniteScrollOverlay isLoading={!!(more.loadingMore || (more.busy && rows.length > 0))} label={more.busy ? "Updating…" : undefined} />}
    </div>
  );
}

/** Opens a record's manage dialog when the page is reached as /list?open=<id> (the "Manage" button on a details page). */
export function useOpenParam(fn) {
  const [sp, setSp] = useSearchParams();
  const ran = useRef(false);
  useEffect(() => {
    const id = sp.get("open");
    if (!id || ran.current) return;
    ran.current = true;
    fn(id);
    const next = new URLSearchParams(sp); next.delete("open"); setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Today as YYYY-MM-DD in local time (date filters never offer future dates unless the field is a due / deadline date). */
export const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/**
 * Client-side filters for lists whose API only filters by status / search: an optional Supplier dropdown (built from the
 * loaded rows) and an optional From / To date range. Returns the filtered rows and the controls to drop into <Toolbar>.
 */
export function useRowFilters(rows, { supplier, date, dateLabel = "", future = false } = {}) {
  const [sup, setSup] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const options = useMemo(() => (supplier ? [...new Set(rows.map((r) => r[supplier]).filter(Boolean))].sort() : []), [rows, supplier]);
  const filtered = useMemo(() => rows.filter((r) => {
    if (supplier && sup && r[supplier] !== sup) return false;
    if (date) {
      const d = r[date] ? String(r[date]).slice(0, 10) : "";
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
    }
    return true;
  }), [rows, supplier, sup, date, from, to]);
  const controls = (
    <>
      {supplier && <Select aria-label="Supplier" value={sup} onChange={(e) => setSup(e.target.value)}><option value="">All suppliers</option>{options.map((n) => <option key={n} value={n}>{n}</option>)}</Select>}
      {date && <><DateInput label={`${dateLabel} from`.trim()} value={from} max={to || (future ? undefined : localToday())} onChange={(e) => { const v = e.target.value; setFrom(v); if (v && to && v > to) setTo(v); }} /><DateInput label={`${dateLabel} to`.trim()} value={to} min={from || undefined} max={future ? undefined : localToday()} onChange={(e) => setTo(e.target.value)} /></>}
    </>
  );
  return { filtered, controls };
}

/** Same pill the Orders / Support pages use. */
const BADGE_CLASS = { green: "status-completed", amber: "status-pending", red: "status-cancelled", blue: "status-scheduled", grey: "inv-status-grey" };
export function Badge({ tone = "grey", children }) {
  return <span className={`status ${BADGE_CLASS[tone] || BADGE_CLASS.grey}`}>{children}</span>;
}

/* ── dialogs ─────────────────────────────────────────────────── */
const modalStack = [];
/** `.modal-overlay` + `.admin-modal` dialog with the panel's enter / exit animation. Nestable. */
export function Modal({ title, onClose, children, footer, wide }) {
  const [closing, setClosing] = useState(false);
  const idRef = useRef(Symbol("modal"));
  const closeRef = useRef(null);
  const close = useCallback(() => {
    if (closeRef.current) return;
    setClosing(true);
    closeRef.current = setTimeout(() => { closeRef.current = null; onClose(); }, 200);
  }, [onClose]);
  useEffect(() => () => { if (closeRef.current) clearTimeout(closeRef.current); }, []);
  useEffect(() => {
    const id = idRef.current;
    modalStack.push(id);
    const onKey = (e) => { if (e.key === "Escape" && modalStack[modalStack.length - 1] === id) close(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); const i = modalStack.indexOf(id); if (i >= 0) modalStack.splice(i, 1); };
  }, [close]);
  const anim = closing ? "modal-anim-out" : "modal-anim-in";
  return (
    <div className={`modal-overlay ${anim}`}>
      <div className={`admin-modal ${anim}`} role="dialog" aria-modal="true" aria-label={title} style={wide ? { width: "min(940px, 96vw)" } : undefined}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <Button3D variant="cancel" iconOnly aria-label="Close" onClick={close}><img alt="" src={closeIcon} /></Button3D>
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ── form controls ────────────────────────────────────────────── */
/**
 * Drop-in for a native <select>: pass <option> children and an onChange that reads e.target.value.
 * Renders the panel's CustomDropdown. A leading <option value=""> becomes the "clear" row.
 */
export function Select({ value, onChange, children, label, required, hasError, disabled, className = "", placeholder, ...rest }) {
  const options = [];
  let blank = null;
  React.Children.forEach(children, (c) => {
    if (!c || c.type !== "option") return;
    const v = c.props.value === undefined ? String(React.Children.toArray(c.props.children).join("")) : c.props.value;
    const text = React.Children.toArray(c.props.children).join("");
    if (v === "" && blank === null && options.length === 0) blank = text;
    else options.push({ value: v, label: text });
  });
  return (
    <CustomDropdown
      value={value ?? ""} label={label !== undefined ? label : (rest["aria-label"] || blank || undefined)} required={required} hasError={hasError} disabled={disabled} className={className}
      options={options} placeholder={blank !== null ? blank : placeholder !== undefined ? placeholder : null}
      onChange={(v) => onChange && onChange({ target: { value: v } })}
    />
  );
}

/** Drop-in for <input type="date">: value is "YYYY-MM-DD"; onChange receives { target: { value } }. */
export function DateInput({ value, onChange, min, max, placeholder, disabled, label }) {
  return (
    <CustomDatePicker label={label} value={value || ""} min={min || undefined} max={max || undefined} placeholder={placeholder}
      onChange={(v) => !disabled && onChange && onChange({ target: { value: v } })} />
  );
}

const withClass = (child, extra) => React.cloneElement(child, { className: [extra, child.props.className].filter(Boolean).join(" ").replace(/\binv-(input|textarea|invalid)\b/g, "").trim() });

/**
 * Labelled field. A text / number / textarea child becomes a floating-label `.mat` field; a Select becomes a
 * labelled CustomDropdown; anything else (DateInput, checkboxes, custom controls) gets a normal label above it.
 */
export function Field({ label, required, error, hint, full, children }) {
  const only = React.Children.count(children) === 1 ? React.Children.toArray(children)[0] : null;
  const isEl = React.isValidElement(only);
  const ph = isEl && typeof only.props.placeholder === "string" && only.props.placeholder.trim() ? only.props.placeholder : "";
  const msg = error ? <div className="field-error-msg" role="alert">{error}</div> : (hint || ph) ? <div className="inv-hint">{hint || ph}</div> : null;
  const wrap = `admin-form-group${full ? " inv-full" : ""}`;
  const req = required ? <span className="rf-req">*</span> : null;

  if (isEl && only.type === Select) {
    return <div className={wrap}>{React.cloneElement(only, { label, required, hasError: !!error })}{msg}</div>;
  }
  if (isEl && (only.type === "input" || only.type === "textarea") && !["checkbox", "radio", "file"].includes(only.props.type)) {
    const cls = `mat-input${only.type === "textarea" ? " mat-textarea" : ""}${error ? " mat-error" : ""}`;
    return (
      <div className={wrap}>
        <div className="mat">
          {React.cloneElement(withClass(only, cls), { placeholder: " " })}
          <label className={`mat-label${error ? " mat-label-error" : ""}`}>{label}{req}</label>
          <span className={`mat-bar${error ? " mat-bar-error" : ""}`} />
        </div>
        {msg}
      </div>
    );
  }
  return (
    <div className={wrap}>
      <label>{label}{req}</label>
      {children}
      {msg}
    </div>
  );
}
