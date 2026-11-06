/**
 * DashboardInsights.js — Dishky Admin Panel
 * Data + small cards for the Sales tab of the Dashboard (class prefix `dx-`):
 *   useDashboardData(from, to)  → closings (cash / UPI / card split, wastage, shortage, EB, gas), memos, tickets and the
 *                                  cost of goods (inventory ledger) for the selected dates
 *   <DxTip>                     → custom hover tooltip (no bootstrap)
 *   <ClosingCard/> <MemosCard/> <TicketsCard/>
 * Everything follows the Dashboard's From / To dates. When the filter is exactly "today" the closing card shows
 * YESTERDAY's closing instead (today's is normally not filled in until the end of the day).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api";
import { useVenue } from "../context/VenueContext";
import { toLocalISO, todayStr } from "../utils/dateRangeUtils";

const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const startOf = (s) => new Date(`${s}T00:00:00`);
const endOf = (s) => new Date(`${s}T23:59:59.999`);
const MAX_DAYS = 399; // the cost report is limited to 400 days

export const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toLocalISO(d); };

/* ── data ─────────────────────────────────────────────────────────── */
export function useDashboardData(fromDate, toDate) {
  const { venueParam, venueId } = useVenue();
  const [state, setState] = useState({ closings: null, opsClosings: null, memos: null, tickets: null, cost: null, costNote: "" });
  const seq = useRef(0);
  const isToday = fromDate === todayStr() && toDate === todayStr();
  const opsDay = yesterdayStr();

  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const vp = venueParam();
      const ok = (p) => p.then((r) => r.data).catch(() => null);
      let from = startOf(fromDate); const to = endOf(toDate);
      let costNote = "";
      const minFrom = new Date(+to - MAX_DAYS * 864e5);
      if (from < minFrom) { from = minFrom; costNote = "Cost covers the last 400 days only."; }
      const [closings, opsClosings, memos, tickets, cost] = await Promise.all([
        ok(api.get("/closing", { params: { ...vp, from: fromDate, to: toDate } })),
        isToday ? ok(api.get("/closing", { params: { ...vp, from: opsDay, to: opsDay } })) : Promise.resolve(null),
        ok(api.get("/memos", { params: { fromDate, toDate } })),
        ok(api.get("/support/tickets", { params: { limit: 100, sort: "createdAt", dir: "desc" } })),
        ok(api.get("/automation/consumption", { params: { ...vp, from: from.toISOString(), to: to.toISOString() } })),
      ]);
      if (mine !== seq.current) return;
      setState({ closings, opsClosings, memos, tickets: tickets && Array.isArray(tickets.rows) ? tickets.rows : null, cost: cost && cost.totals ? cost : null, costNote });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, venueId]);

  return { ...state, isToday, opsDay };
}

/** Cash / UPI / card / other collected over a list of closing checklists. */
export function sumTally(closings) {
  const t = { cash: 0, upi: 0, card: 0, other: 0, pos: 0, days: 0 };
  (closings || []).forEach((c) => {
    const x = c.tally || {};
    t.cash += Number(x.cash) || 0; t.upi += Number(x.upi) || 0; t.card += Number(x.card) || 0; t.other += Number(x.other) || 0; t.pos += Number(x.systemSales) || 0; t.days += 1;
  });
  Object.keys(t).forEach((k) => { t[k] = r2(t[k]); });
  t.collected = r2(t.cash + t.upi + t.card + t.other);
  return t;
}

/* ── tooltip ──────────────────────────────────────────────────────── */
export function DxTip({ tip, children, className = "" }) {
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState({ left: 0, top: 0, visibility: "hidden" });

  // The tip is drawn in a portal at fixed coordinates, so cards that scroll or clip their content never cut it off.
  useLayoutEffect(() => {
    if (!open || !hostRef.current || !tipRef.current) return;
    const h = hostRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(h.left + h.width / 2 - t.width / 2, vw - t.width - 8));
    let top = h.bottom + 8;
    if (top + t.height > vh - 8) top = Math.max(8, h.top - t.height - 8);
    setStyle({ left, top, visibility: "visible" });
  }, [open, tip]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  const show = () => { setStyle({ left: 0, top: 0, visibility: "hidden" }); setOpen(true); };
  return (
    <div ref={hostRef} className={`dx-tip-host ${className}`.trim()} tabIndex={0}
      onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)}>
      {children}
      {open && createPortal(<div ref={tipRef} className="dx-tip" role="tooltip" style={style}>{tip}</div>, document.body)}
    </div>
  );
}

/** Same look as DxTip, for chart tooltips drawn by recharts.  rows: [label, value, tone?]  (tone: "good" | "bad") */
export function TipBox({ title, subtitle, rows = [], foot, accent }) {
  return (
    <div className="dx-tip dx-tip-static" role="tooltip">
      {title && <div className="dx-tip-head">{accent && <i style={{ background: accent }} />}<span>{title}</span></div>}
      {subtitle && <div className="dx-tip-sub">{subtitle}</div>}
      {rows.map(([l, v, tone], i) => (<div key={i} className="dx-tip-row"><span>{l}</span><b className={tone === "good" ? "dx-good" : tone === "bad" ? "dx-bad" : ""}>{v}</b></div>))}
      {foot && <div className="dx-tip-foot">{foot}</div>}
    </div>
  );
}

export function SalesSplitTip({ closings, loading }) {
  const t = sumTally(closings);
  if (loading) return <div className="dx-tip-title">Collected by mode</div>;
  if (!t.days) return (<><div className="dx-tip-title">Collected by mode</div><div className="dx-tip-empty">No daily closing recorded for these dates, so the cash / GPay / card split is not available.</div></>);
  return (
    <>
      <div className="dx-tip-title">Collected by mode</div>
      <div className="dx-tip-row"><span>Cash</span><b>{inr(t.cash)}</b></div>
      <div className="dx-tip-row"><span>GPay / UPI</span><b>{inr(t.upi)}</b></div>
      <div className="dx-tip-row"><span>Card</span><b>{inr(t.card)}</b></div>
      {t.other > 0 && <div className="dx-tip-row"><span>Other</span><b>{inr(t.other)}</b></div>}
      <div className="dx-tip-row dx-tip-total"><span>Total collected</span><b>{inr(t.collected)}</b></div>
      <div className="dx-tip-foot">From {t.days} daily closing{t.days > 1 ? "s" : ""}</div>
    </>
  );
}

/* ── profit ───────────────────────────────────────────────────────── */
export function profitOf(totalSales, cost) {
  if (!cost || !cost.totals) return null;
  const goods = r2((cost.totals.orderCost || 0) + (cost.totals.wasteCost || 0));
  const profit = r2(totalSales - goods);
  const margin = totalSales > 0 ? r2((profit / totalSales) * 100) : 0;
  return { goods, profit, margin };
}

/* ── cards ────────────────────────────────────────────────────────── */
const Card = ({ title, badge, onClick, children }) => (
  <section className={`dx-card${onClick ? " dx-card-link" : ""}`} onClick={onClick}>
    <header className="dx-card-head"><h4>{title}</h4>{badge && <span className="dx-badge">{badge}</span>}</header>
    {children}
  </section>
);
const Stat = ({ label, value, tone, sub }) => (
  <div className="dx-stat"><span>{label}</span><b className={tone ? `dx-${tone}` : ""}>{value}</b>{sub && <small>{sub}</small>}</div>
);

export function ClosingCard({ closings, isToday, opsDay, fromDate, toDate, navigate }) {
  const rows = useMemo(() => [...(closings || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))), [closings]);
  const latest = rows[rows.length - 1];
  const sum = (fn) => r2(rows.reduce((t, c) => t + fn(c), 0));
  const wasteItems = rows.flatMap((c) => c.foodWastage || []);
  const shortage = sum((c) => Math.max(0, -(Number(c.cash?.variance) || 0)));
  const tallyShort = sum((c) => Math.max(0, -(Number(c.tally?.difference) || 0)));
  const ebUsed = sum((c) => (c.electricity || []).reduce((t, m) => t + (Number(m.consumption) || 0), 0));
  const label = isToday ? `Yesterday · ${opsDay}` : fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`;
  return (
    <Card title={isToday ? "Yesterday's closing" : "Closing summary"} badge={label} onClick={() => navigate("/daily-closing")}>
      {closings === null ? <div className="dx-empty">Loading…</div> : !rows.length ? <div className="dx-empty">No daily closing recorded {isToday ? "yesterday" : "for these dates"}.</div> : (
        <>
          <div className="dx-stats">
            <Stat label="Food wastage" value={wasteItems.length ? `${wasteItems.length} item${wasteItems.length > 1 ? "s" : ""}` : "None"} sub={wasteItems.slice(0, 3).map((w) => `${w.dish} ${w.quantity}${w.unit}`).join(", ") + (wasteItems.length > 3 ? ` +${wasteItems.length - 3}` : "")} />
            <Stat label="Money shortage" value={inr(shortage)} tone={shortage ? "bad" : "good"} sub={tallyShort ? `Tally short ${inr(tallyShort)}` : "Cash counted vs expected"} />
            <Stat label="Electricity" value={`${ebUsed} units`} sub={latest && (latest.electricity || []).length ? (latest.electricity || []).slice(0, 2).map((m) => `${m.label || "EB"}: ${m.reading ?? "—"}`).join(" · ") : "No reading"} />
            <Stat label="Gas left" value={`${sum(() => 0) + r2((latest?.cylinders || []).reduce((t, c) => t + (Number(c.remainingKg) || 0), 0))} kg`} sub={(latest?.cylinders || []).slice(0, 2).map((c) => `${c.label || "Cyl."}: ${c.remainingKg}kg`).join(" · ") || "No reading"} />
          </div>
          {rows.length > 1 && <div className="dx-foot">Totals over {rows.length} closings · readings are from the latest ({latest.date})</div>}
        </>
      )}
    </Card>
  );
}

const countBy = (list, key) => { const m = new Map(); list.forEach((x) => m.set(x[key] || "—", (m.get(x[key] || "—") || 0) + 1)); return [...m.entries()]; };
const CLOSED_MEMO = new Set(["Resolved", "Closed", "Cancelled"]);

export function MemosCard({ memos, navigate }) {
  const list = memos || [];
  const open = list.filter((m) => !CLOSED_MEMO.has(m.status));
  return (
    <Card title="Memos" badge={memos ? `${list.length} total` : ""} onClick={() => navigate("/memos")}>
      {memos === null ? <div className="dx-empty">No memo data available.</div> : !list.length ? <div className="dx-empty">No memos in these dates.</div> : (
        <>
          <div className="dx-chips">{countBy(list, "status").map(([s, n]) => <span key={s} className={`dx-chip${CLOSED_MEMO.has(s) ? "" : " dx-chip-open"}`}>{s} <b>{n}</b></span>)}</div>
          <ul className="dx-list">
            {open.slice(0, 3).map((m) => (
              <li key={m.id}><span className="dx-li-title">{m.title || m.id}</span><span className={`dx-pri dx-pri-${String(m.priority || "").toLowerCase()}`}>{m.priority}</span><span className="dx-li-status">{m.resolutionStatus || m.status}</span></li>
            ))}
            {!open.length && <li className="dx-li-none">Nothing open.</li>}
          </ul>
        </>
      )}
    </Card>
  );
}

export function TicketsCard({ tickets, fromDate, toDate, navigate }) {
  const list = useMemo(() => (tickets || []).filter((t) => { const d = String(t.createdAt || "").slice(0, 10); return d >= fromDate && d <= toDate; }), [tickets, fromDate, toDate]);
  const done = (t) => ["resolved", "closed"].includes(t.status);
  const open = list.filter((t) => !done(t));
  return (
    <Card title="Complaints & tickets" badge={tickets ? `${list.length} total` : ""} onClick={() => navigate("/support")}>
      {tickets === null ? <div className="dx-empty">No ticket data available.</div> : !list.length ? <div className="dx-empty">No tickets raised in these dates.</div> : (
        <>
          <div className="dx-chips">{countBy(list.map((t) => ({ s: t.statusLabel || t.status })), "s").map(([s, n]) => <span key={s} className="dx-chip dx-chip-open">{s} <b>{n}</b></span>)}</div>
          <ul className="dx-list">
            {open.slice(0, 3).map((t) => (
              <li key={t.ticketId}><span className="dx-li-title">{t.title}</span><span className={`dx-pri dx-pri-${String(t.priority || "").toLowerCase()}`}>{t.priority}</span><span className="dx-li-status">{t.statusLabel || t.status}</span></li>
            ))}
            {!open.length && <li className="dx-li-none">All resolved.</li>}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Per-day money shortage: counted cash against expected, and collected money against POS sales. */
export function MoneyShortageCard({ closings, isToday, opsDay, navigate }) {
  const rows = useMemo(() => [...(closings || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))), [closings]);
  const cashShort = r2(rows.reduce((t, c) => t + Math.max(0, -(Number(c.cash?.variance) || 0)), 0));
  const tallyShort = r2(rows.reduce((t, c) => t + Math.max(0, -(Number(c.tally?.difference) || 0)), 0));
  const surplus = r2(rows.reduce((t, c) => t + Math.max(0, Number(c.cash?.variance) || 0), 0));
  const tone = (v) => (v < 0 ? "bad" : v > 0 ? "good" : "");
  return (
    <Card title="Money shortage" badge={isToday ? `Yesterday · ${opsDay}` : `${rows.length} closing${rows.length === 1 ? "" : "s"}`} onClick={() => navigate("/daily-closing")}>
      {closings === null ? <div className="dx-empty">Loading…</div> : !rows.length ? <div className="dx-empty">No daily closing recorded {isToday ? "yesterday" : "for these dates"}.</div> : (
        <>
          <div className="dx-stats dx-stats-3">
            <Stat label="Cash short" value={inr(cashShort)} tone={cashShort ? "bad" : "good"} sub="Counted below expected" />
            <Stat label="Tally short" value={inr(tallyShort)} tone={tallyShort ? "bad" : "good"} sub="Collected below POS sales" />
            <Stat label="Cash surplus" value={inr(surplus)} sub="Counted above expected" />
          </div>
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead><tr><th>Date</th><th className="dx-num">Expected cash</th><th className="dx-num">Counted</th><th className="dx-num">Cash variance</th><th className="dx-num">Tally diff.</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id || c.date}>
                    <td>{c.date}{c.status !== "submitted" && <span className="dx-draft">draft</span>}</td>
                    <td className="dx-num">{inr(c.cash?.expectedCash)}</td>
                    <td className="dx-num">{inr(c.cash?.cashInHand)}</td>
                    <td className={`dx-num dx-${tone(Number(c.cash?.variance) || 0)}`}>{inr(c.cash?.variance)}</td>
                    <td className={`dx-num dx-${tone(Number(c.tally?.difference) || 0)}`}>{inr(c.tally?.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
