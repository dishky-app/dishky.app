/** SupplierScorecards.js — delivery, fill, quality and invoice-accuracy scores per supplier. */
import React, { useEffect, useState } from "react";
import api from "../../api";
import { Badge, Btn, DataTable, PageHead, SearchBox, Select, Toolbar, errText, money, ExportBtn } from "../pi-shared/InvUi";

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
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const shown = state.rows.filter((r) => (!grade || r.grade === grade) &&
    (!search.trim() || `${r.name} ${r.code}`.toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="inner-page inv-page">
      <PageHead title="Supplier scorecards" count={`${shown.length} supplier(s)`}>
        <ExportBtn rows={shown} columns={columns} name="supplier_scorecards" sheet="Scorecards" /><Btn type="button" kind="plain" onClick={load}>Refresh</Btn></PageHead>
      {state.meta && <div className="inv-banner">{state.meta.note}</div>}
      <div className="inv-stack">
        <Toolbar>
          <SearchBox placeholder=" Search supplier or code" aria-label="Search suppliers" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">All grades</option>{["A", "B", "C", "D", "unrated"].map((g) => <option key={g} value={g}>{g === "unrated" ? "Not rated" : `Grade ${g}`}</option>)}</Select>
        </Toolbar>
        <DataTable columns={columns} rows={shown} loading={state.loading} error={state.error} onRetry={load} rowKey={(r) => r.supplierId} empty="No suppliers yet." /></div>
    </div>
  );
}
