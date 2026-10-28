import React, { useEffect, useState } from "react";
import CollapseChevron from "./components/CollapseChevron.js";
import CollapseSection from "./components/CollapseSection.js";
import Button3D from "./components/Button3D.js";
import { useToast } from "./useToast.js";
import { PLAN_LABEL, STATUS_LABEL, STATUS_TONE, daysLabel } from "./format.js";

// Tone -> Admin Panel status pill (Common.css .status-*)
const TONE_CLASS = {
  ok: "status-confirmed",
  info: "status-scheduled",
  warn: "status-pending",
  bad: "status-cancelled",
  muted: "status-muted",
};

export function Badge({ tone = "muted", children }) {
  return <span className={`status ${TONE_CLASS[tone] || TONE_CLASS.muted}`}>{children}</span>;
}

const Dash = () => <span className="subtitle">—</span>;

export const StatusBadge = ({ status }) =>
  status ? <Badge tone={STATUS_TONE[status] || "muted"}>{STATUS_LABEL[status] || status}</Badge> : <Dash />;

export const PlanBadge = ({ plan }) =>
  plan ? <Badge tone={plan === "enterprise" ? "info" : plan === "growth" || plan === "pro" ? "ok" : "muted"}>{PLAN_LABEL[plan] || plan}</Badge> : <Dash />;

// Page header — same structure as the Admin Panel (.header / .title / .result-count).
// Pass `collapsed` + `onToggle` to get the Admin Panel's round collapse chevron in front of the title
// (state lives in the page; wrap the content to hide in <Collapsible collapsed={...}>).
export function PageHeader({ title, count, subtitle, back, children, collapsed, onToggle, collapseLabel = "filters" }) {
  return (
    <div className="header">
      <div className="header-title-row">
        {onToggle && (
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={onToggle}
              title={collapsed ? `Expand ${collapseLabel}` : `Collapse ${collapseLabel}`}
              aria-label={collapsed ? `Expand ${collapseLabel}` : `Collapse ${collapseLabel}`}
              aria-expanded={!collapsed}
            >
              <CollapseChevron collapsed={collapsed} />
            </button>
          </div>
        )}
        <div className="header-title-col">
          {back && <div className="header-back">{back}</div>}
          <div className="header-title-with-count">
            <h2 className="title">{title}</h2>
            {count !== undefined && count !== null && <span className="result-count">{count}</span>}
          </div>
          {subtitle && <div className="subtitle">{subtitle}</div>}
        </div>
      </div>
      {children && <div className="header-btn-container">{children}</div>}
    </div>
  );
}

/** Tiny state helper: const [collapsed, toggle] = useCollapse(); <PageHeader collapsed={collapsed} onToggle={toggle} /> */
export function useCollapse(initial = false) {
  const [collapsed, setCollapsed] = useState(initial);
  return [collapsed, () => setCollapsed((c) => !c)];
}

/** Admin Panel CollapseSection, laid out as a normal block so any content (tables, cards, KPI grids) keeps its own layout. */
export function Collapsible({ collapsed, children, className = "" }) {
  return <CollapseSection collapsed={collapsed} className={`cs-block ${className}`.trim()}>{children}</CollapseSection>;
}

// KPI card — Admin dashboard .kpi-card
export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`kpi-card${tone ? ` ${tone}` : ""}`}>
      <p>{label}</p>
      <h3>{value}</h3>
      {hint && <div className="subtitle">{hint}</div>}
    </div>
  );
}

export function Meter({ value, max, label }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="sa-meter" role="img" aria-label={label || `${Math.round(pct)}%`}>
      <div className={`sa-meter-fill${pct > 85 ? " sa-meter-hot" : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Expiry({ row }) {
  const { daysLeft } = row;
  const tone = daysLeft === null ? "" : daysLeft < 0 ? "sa-bad-text" : daysLeft <= 7 ? "sa-warn-text" : "";
  return <span className={tone}>{daysLabel(daysLeft)}</span>;
}

// Errors are shown through the toast system (no inline note any more).
export function ErrorNote({ error }) {
  const { toast } = useToast();
  useEffect(() => { if (error) toast.error(error); }, [error, toast]);
  return null;
}

// Same empty row as the Admin Panel's EmptyRow
export const EmptyRow = ({ colSpan, message = "No data available" }) => (
  <tr>
    <td colSpan={colSpan} style={{ textAlign: "center", padding: "20px", color: "#777", fontSize: "14px", fontWeight: 500 }}>
      {message}
    </td>
  </tr>
);

/** Result count shown under an infinite-scroll table (replaces the old Previous / Next pager). */
export function ResultCount({ total, shown }) {
  const text = shown !== undefined && shown < total ? `Showing ${shown} of ${total} results` : `${total} result${total === 1 ? "" : "s"}`;
  return <div className="result-count sa-count">{text}</div>;
}

/**
 * Details page shell — the Admin Panel's DishDetails / IngredientDetails layout:
 *   .details-container > .details-header (back button · title · actions) + .details-body + .details-footer
 * `footer` is optional; when given it renders in the sticky .details-footer (right-aligned buttons).
 */
export function DetailsPage({ title, meta, onBack, actions, footer, subtitle, children }) {
  return (
    <div className="details-container">
      <div className="details-header">
        <button type="button" className="back-btn" aria-label="Back" title="Back" onClick={onBack} />
        <h2>{title}</h2>
        {meta && <div className="details-header-meta">{meta}</div>}
        {actions && <div className="details-header-actions">{actions}</div>}
      </div>
      {subtitle && <div className="details-subtitle">{subtitle}</div>}
      <div className="details-body">{children}</div>
      {footer && <div className="details-footer">{footer}</div>}
    </div>
  );
}

/** One labelled value — the admin's `.section > .section-title + <p>` pair. */
export function Section({ title, children, wide, className = "", hint }) {
  return (
    <div className={`section${wide ? " is-wide" : ""} ${className}`.trim()}>
      <div className="section-title"><span>{title}</span></div>
      {children}
      {hint && <span className="section-hint">{hint}</span>}
    </div>
  );
}

/** Text value inside a Section; shows an em-dash when empty. */
export const Value = ({ children }) => <p>{children === undefined || children === null || children === "" || children === false ? "—" : children}</p>;
