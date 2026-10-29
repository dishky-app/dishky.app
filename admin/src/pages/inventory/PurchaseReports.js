/** PurchaseReports.js — purchase summary, payables aging, price trend, consumption cost, invoice variances. */
import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Btn, DataTable, DateInput, Field, PageHead, Select, Tabs, Toolbar, dateShort, errText, money, qty, useRef_ } from "./InvUi";

const TABS = [["purchase-summary", "Purchases"], ["payables-aging", "Payables aging"], ["price-trend", "Price trend"], ["consumption-cost", "Usage & waste cost"], ["invoice-variance", "Invoice variances"]];
const iso = (d) => d.toISOString().slice(0, 10);

const TOTAL_LABELS = { taxable: "Taxable value", tax: "Tax (GST)", total: "Total", returns: "Returns", net: "Net purchases" };

export default function PurchaseReports() {
  const { venueParam, venueId } = useVenue();
  const { toast } = useToast();
  const items = useRef_("/inventory/items", { limit: 200 }, (d) => d.data);
  const [tab, setTab] = useState("purchase-summary");
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const [basis, setBasis] = useState("received");
  const [groupBy, setGroupBy] = useState("supplier");
  const [itemId, setItemId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useCallback((extra = {}) => ({ ...venueParam(), from, to, ...(tab === "purchase-summary" ? { basis, groupBy } : {}), ...(tab === "price-trend" ? { itemId } : {}), ...(tab === "payables-aging" ? { detail: "true" } : {}), ...extra }), [venueParam, from, to, tab, basis, groupBy, itemId]);
  const load = useCallback(async () => {
    if (tab === "price-trend" && !itemId) { setData(null); setLoading(false); return; }
    setLoading(true); setError("");
    try { setData((await api.get(`/finance/reports/${tab}`, { params: params() })).data); }
    catch (e) { setError(errText(e, "Could not load the report")); setData(null); }
    finally { setLoading(false); }
  }, [tab, itemId, params]);
  useEffect(() => { load(); }, [load, venueId]);

  const download = async () => {
    try {
      const r = await api.get(`/finance/reports/${tab}`, { params: params({ format: "csv" }), responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a"); a.href = url; a.download = `${tab}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(errText(e)); }
  };

  const cols = {
    "purchase-summary": [{ key: "name", label: groupBy === "month" ? "Month" : groupBy === "item" ? "Item" : "Supplier" }, { key: "taxable", label: "Value", num: true, render: (r) => money(r.taxable) }, { key: "tax", label: "GST", num: true, render: (r) => money(r.tax) }, { key: "total", label: "Total", num: true, render: (r) => money(r.total) }, { key: "returns", label: "Returned", num: true, render: (r) => money(r.returns) }, { key: "net", label: "Net", num: true, render: (r) => money(r.net) }],
    "payables-aging": [{ key: "supplier", label: "Supplier" }, { key: "current", label: "Not yet due", num: true, render: (r) => money(r.current) }, { key: "d1_30", label: "1–30 days", num: true, render: (r) => money(r.d1_30) }, { key: "d31_60", label: "31–60", num: true, render: (r) => money(r.d31_60) }, { key: "d61_90", label: "61–90", num: true, render: (r) => money(r.d61_90) }, { key: "d90_plus", label: "90+", num: true, render: (r) => money(r.d90_plus) }, { key: "no_due_date", label: "No due date", num: true, render: (r) => money(r.no_due_date) }, { key: "total", label: "Total owed", num: true, render: (r) => money(r.total) }],
    "price-trend": [{ key: "month", label: "Month" }, { key: "supplier", label: "Supplier" }, { key: "qty", label: "Qty received", num: true, render: (r) => qty(r.qty) }, { key: "avgUnitCost", label: "Avg cost / base unit", num: true, render: (r) => money(r.avgUnitCost) }],
    "consumption-cost": [{ key: "name", label: "Item" }, { key: "consumedQty", label: "Used", num: true, render: (r) => `${qty(r.consumedQty)} ${r.unit}` }, { key: "consumedValue", label: "Cost of use", num: true, render: (r) => money(r.consumedValue) }, { key: "wasteQty", label: "Wasted", num: true, render: (r) => `${qty(r.wasteQty)} ${r.unit}` }, { key: "wasteValue", label: "Cost of waste", num: true, render: (r) => money(r.wasteValue) }, { key: "wastePct", label: "Waste %", num: true, render: (r) => `${r.wastePct}%` }],
    "invoice-variance": [{ key: "docNo", label: "Ref" }, { key: "supplier", label: "Supplier" }, { key: "item", label: "Item" }, { key: "issue", label: "Issue", render: (r) => r.issue.replace(/_/g, " ") }, { key: "priceVariance", label: "Price impact", num: true, render: (r) => money(r.priceVariance) }, { key: "qtyVariance", label: "Qty over", num: true, render: (r) => qty(r.qtyVariance) }, { key: "invoiceStatus", label: "Invoice", render: (r) => r.invoiceStatus.replace(/_/g, " ") }, { key: "override", label: "Override reason", render: (r) => r.override || "—" }],
  }[tab];
  const rows = data ? data.rows || data.series || [] : [];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Purchase & cost reports">
        <Btn type="button" kind="plain" onClick={download} disabled={!rows.length}>Download CSV</Btn>
      </PageHead>
      <Tabs tabs={TABS} value={tab} onChange={(k) => { setTab(k); setData(null); }} />
      <div className="inv-stack">
        <Toolbar>
          {tab !== "payables-aging" && <><DateInput label="From" value={from} onChange={(e) => setFrom(e.target.value)} /><DateInput label="To" value={to} onChange={(e) => setTo(e.target.value)} /></>}
          {tab === "purchase-summary" && <>
            <Field label="Based on"><Select value={basis} onChange={(e) => setBasis(e.target.value)}><option value="received">Goods received</option><option value="invoiced">Approved invoices</option></Select></Field>
            <Field label="Group by"><Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="supplier">Supplier</option><option value="item">Item</option><option value="month">Month</option></Select></Field></>}
          {tab === "price-trend" && <Field label="Item"><Select value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">Choose item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>}
        </Toolbar>
        {data && data.note && <div className="inv-hint inv-note">{data.note}</div>}
        {tab === "price-trend" && !itemId ? <div className="inv-empty">Choose an item to see what you paid over time.</div> : (
          <DataTable columns={cols} rows={rows} loading={loading} error={error} onRetry={load} rowKey={(r) => r.key || r.supplierId ? `${r.key || r.supplierId}${r.month || ""}` : `${r.docNo}${r.item}${r.issue}`} empty="No data for this period." />)}
        {data && data.totals && tab !== "payables-aging" && <div className="inv-card inv-totals">{Object.entries(data.totals).map(([k, v]) => <div key={k} className={k === "net" || k === "total" ? "inv-grand" : ""}><span>{TOTAL_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span><span>{money(v)}</span></div>)}</div>}
        {data && tab === "payables-aging" && <div className="inv-card inv-totals"><div className="inv-grand"><span>Total owed</span><span>{money(data.totals.total)}</span></div></div>}
        {data && tab === "price-trend" && data.changePct !== null && data.changePct !== undefined && <div className="inv-card inv-note">Change from first to last month: {data.changePct}%. Lowest {money(data.min)}, highest {money(data.max)}.</div>}
        {data && tab === "payables-aging" && data.invoices && <div className="inv-card inv-note"><div className="inv-section">Invoices owed</div><ul className="inv-history">{data.invoices.map((i) => <li key={i.docNo}>{i.docNo} ({i.invoiceNo}) — {i.supplier} — due {dateShort(i.dueDate)} — {money(i.outstanding)}</li>)}</ul></div>}
      </div>
    </div>
  );
}
