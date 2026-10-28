/** SupplierScorecards.js — delivery, fill, quality and invoice-accuracy scores per supplier. */
import React, { useEffect, useState } from "react";
import api from "../../api";
import { Badge, DataTable, PageHead, errText, money } from "./InvUi";

const TONE = { A: "green", B: "green", C: "amber", D: "red", unrated: "grey" };
const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

export default function SupplierScorecards() {
  const [state, setState] = useState({ rows: [], loading: true, error: "", meta: null });
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    api.get("/automation/suppliers/performance").then(({ data }) => setState({ rows: data.data, loading: false, error: "", meta: data }))
      .catch((e) => setState((s) => ({ ...s, loading: false, error: errText(e, "Could not load scorecards") })));
  };
  useEffect(load, []);
  const columns = [
    { key: "name", label: "Supplier", render: (r) => <><span className="inv-strong">{r.name}</span><div className="inv-muted">{r.code}</div></> },
    { key: "grade", label: "Grade", render: (r) => <Badge tone={TONE[r.grade]}>{r.grade === "unrated" ? "Not rated" : r.grade}</Badge> },
    { key: "score", label: "Score", num: true, render: (r) => (r.score === null ? "—" : r.score) },
    { key: "onTimePct", label: "On time", num: true, render: (r) => pct(r.onTimePct) },
    { key: "fillRatePct", label: "Fill rate", num: true, render: (r) => pct(r.fillRatePct) },
    { key: "qualityCompliancePct", label: "Quality", num: true, render: (r) => pct(r.qualityCompliancePct) },
    { key: "invoiceAccuracyPct", label: "Clean invoices", num: true, render: (r) => pct(r.invoiceAccuracyPct) },
    { key: "receipts", label: "Receipts", num: true },
    { key: "returns", label: "Returns", num: true, render: (r) => (r.returns ? `${r.returns} (${money(r.returnValue)})` : "0") },
    { key: "disputedInvoices", label: "Disputed", num: true },
  ];
  return (
    <div className="inv-page">
      <PageHead title="Supplier scorecards" crumb="Automation"><button type="button" className="inv-btn" onClick={load}>Refresh</button></PageHead>
      {state.meta && <div className="inv-banner">{state.meta.note}</div>}
      <div className="inv-card"><DataTable columns={columns} rows={state.rows} loading={state.loading} error={state.error} onRetry={load} rowKey={(r) => r.supplierId} empty="No suppliers yet." /></div>
    </div>
  );
}
