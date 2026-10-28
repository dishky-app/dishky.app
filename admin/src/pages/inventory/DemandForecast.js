/** DemandForecast.js — forecast from past consumption, plus a usage / waste report for a date range. */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useVenue } from "../../context/VenueContext";
import { Badge, DataTable, Field, PageHead, dateShort, errText, money, qty } from "./InvUi";

const RISK = { stockout_before_delivery: ["red", "Runs out before delivery"], stockout_within_horizon: ["amber", "Runs out in the period"], ok: ["green", "OK"] };
const CONF = { high: "green", medium: "amber", low: "grey" };

export default function DemandForecast() {
  const { venueId, venueParam, currentVenue } = useVenue();
  const nav = useNavigate();
  const [tab, setTab] = useState("forecast");
  const [fc, setFc] = useState({ rows: [], loading: true, error: "", note: "" });
  const [us, setUs] = useState({ rows: [], loading: true, error: "", meta: null });
  const [range, setRange] = useState({ from: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });

  const loadFc = useCallback(() => {
    setFc((s) => ({ ...s, loading: true, error: "" }));
    api.get("/automation/forecast", { params: venueParam() }).then(({ data }) => setFc({ rows: data.data, loading: false, error: "", note: data.note }))
      .catch((e) => setFc({ rows: [], loading: false, error: errText(e, "Could not load forecast"), note: "" }));
  }, [venueParam]);
  const loadUs = useCallback(() => {
    setUs((s) => ({ ...s, loading: true, error: "" }));
    api.get("/automation/consumption", { params: { ...venueParam(), from: range.from, to: `${range.to}T23:59:59` } }).then(({ data }) => setUs({ rows: data.data, loading: false, error: "", meta: data }))
      .catch((e) => setUs({ rows: [], loading: false, error: errText(e, "Could not load usage"), meta: null }));
  }, [venueParam, range]);
  useEffect(() => { loadFc(); }, [loadFc, venueId]);
  useEffect(() => { loadUs(); }, [loadUs, venueId]);

  const fcCols = [
    { key: "name", label: "Item", render: (r) => <><span className="inv-strong">{r.name}</span><div className="inv-muted">{r.sku}</div></> },
    { key: "risk", label: "Status", render: (r) => <Badge tone={RISK[r.risk][0]}>{RISK[r.risk][1]}</Badge> },
    { key: "available", label: "Available", num: true, render: (r) => `${qty(r.available)} ${r.unit}` },
    { key: "avgDailyUse", label: "Daily use", num: true, render: (r) => qty(r.avgDailyUse) },
    { key: "coverDays", label: "Lasts (days)", num: true, render: (r) => (r.coverDays === null ? "—" : r.coverDays) },
    { key: "stockoutDate", label: "Runs out", render: (r) => (r.stockoutDate ? dateShort(r.stockoutDate) : "—") },
    { key: "forecastUse", label: "Expected use", num: true, render: (r) => qty(r.forecastUse) },
    { key: "trendPct", label: "Trend (7d)", num: true, render: (r) => (r.trendPct === null ? "—" : `${r.trendPct > 0 ? "+" : ""}${r.trendPct}%`) },
    { key: "suggestedOrderQty", label: "Suggested order", num: true, render: (r) => `${qty(r.suggestedOrderQty)} ${r.unit}` },
    { key: "confidence", label: "Confidence", render: (r) => <Badge tone={CONF[r.confidence]}>{r.confidence}</Badge> },
  ];
  const usCols = [
    { key: "name", label: "Item", render: (r) => <><span className="inv-strong">{r.name}</span><div className="inv-muted">{r.sku}</div></> },
    { key: "usedByOrders", label: "Used by orders", num: true, render: (r) => `${qty(r.usedByOrders)} ${r.unit}` },
    { key: "orderCost", label: "Cost", num: true, render: (r) => money(r.orderCost) },
    { key: "wasted", label: "Wasted", num: true, render: (r) => `${qty(r.wasted)} ${r.unit}` },
    { key: "wasteCost", label: "Waste cost", num: true, render: (r) => money(r.wasteCost) },
    { key: "wastePct", label: "Waste %", num: true, render: (r) => `${r.wastePct}%` },
    { key: "adjustedOut", label: "Adjusted out", num: true, render: (r) => qty(r.adjustedOut) },
    { key: "adjustedIn", label: "Adjusted in", num: true, render: (r) => qty(r.adjustedIn) },
  ];
  const cov = us.meta?.coverage;
  return (
    <div className="inv-page">
      <PageHead title="Forecast & usage" crumb="Automation">
        <button type="button" className="inv-btn" onClick={() => nav("/purchase/reorder")}>Reorder planning</button>
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      <div className="inv-tabs" role="tablist">
        {[["forecast", "Forecast"], ["usage", "Usage & waste"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className="inv-tab" onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "forecast" ? (
        <>
          {fc.note && <div className="inv-banner">{fc.note}</div>}
          <div className="inv-card"><DataTable columns={fcCols} rows={fc.rows} loading={fc.loading} error={fc.error} onRetry={loadFc} rowKey={(r) => r.itemId} empty="No consumption has been recorded in the look-back period, so there is nothing to forecast yet." /></div>
        </>
      ) : (
        <>
          <div className="inv-card inv-toolbar">
            <Field label="From"><input className="inv-input" type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></Field>
            <Field label="To"><input className="inv-input" type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></Field>
            {us.meta && <span className="inv-muted">Order cost {money(us.meta.totals.orderCost)} · waste {money(us.meta.totals.wasteCost)}</span>}
          </div>
          {cov && cov.unlinkedCount > 0 && (
            <div className="inv-banner">{cov.unlinkedCount} of {cov.ingredients} ingredients are not linked to an inventory item, so their usage is missing here ({cov.unlinked.slice(0, 5).map((u) => u.name).join(", ")}{cov.unlinkedCount > 5 ? "…" : ""}). Link them from Inventory Items.</div>
          )}
          <div className="inv-card"><DataTable columns={usCols} rows={us.rows} loading={us.loading} error={us.error} onRetry={loadUs} rowKey={(r) => r.itemId} empty="No usage in this period." /></div>
          {us.meta && <div className="inv-muted">{us.meta.note}</div>}
        </>
      )}
    </div>
  );
}
