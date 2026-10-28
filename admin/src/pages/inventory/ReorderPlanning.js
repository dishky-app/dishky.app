/** ReorderPlanning.js — items at or below their reorder level, turned into draft purchase requests. */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, PageHead, errText, money, qty } from "./InvUi";

export default function ReorderPlanning() {
  const { hasModulePermission } = useAuth();
  const { venueId, venueParam, currentVenue } = useVenue();
  const { toast } = useToast();
  const nav = useNavigate();
  const canWrite = hasModulePermission("purchaseRequests", "write");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [sel, setSel] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/purchase/reorder/suggestions", { params: venueParam() });
      setRows(data.data); setMeta(data); setSel(Object.fromEntries(data.data.map((r) => [r.itemId, r.suggestedQty])));
    } catch (e) { setError(errText(e, "Could not load suggestions")); setRows([]); }
    finally { setLoading(false); }
  }, [venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  const picked = rows.filter((r) => sel[r.itemId] !== undefined && sel[r.itemId] !== "" && Number(sel[r.itemId]) > 0 && sel[`on_${r.itemId}`] !== false);
  const create = async () => {
    setBusy(true);
    try {
      const lines = picked.map((r) => ({ itemId: r.itemId, qty: Number(sel[r.itemId]), unit: r.unit }));
      const { data } = await api.post("/purchase/reorder/create-requests", { lines }, { params: venueParam() });
      toast.success(`${data.data.length} draft request(s) created: ${data.data.map((d) => d.prNo).join(", ")}`, "medium");
      nav("/purchase/requests");
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const columns = [
    ...(canWrite ? [{ key: "pick", label: "", render: (r) => <input type="checkbox" aria-label={`Include ${r.name}`} checked={sel[`on_${r.itemId}`] !== false} onChange={(e) => setSel({ ...sel, [`on_${r.itemId}`]: e.target.checked })} /> }] : []),
    { key: "name", label: "Item", render: (r) => <><span className="inv-strong">{r.name}</span><div className="inv-muted">{r.sku}</div></> },
    { key: "priority", label: "Priority", render: (r) => <Badge tone={r.priority === "urgent" ? "red" : r.priority === "high" ? "amber" : "blue"}>{r.priority}</Badge> },
    { key: "available", label: "Available", num: true, render: (r) => `${qty(r.available)} ${r.unit}` },
    { key: "onOrder", label: "On order", num: true, render: (r) => qty(r.onOrder) },
    { key: "onRequest", label: "Requested", num: true, render: (r) => qty(r.onRequest) },
    { key: "reorderLevel", label: "Reorder level", num: true, render: (r) => qty(r.reorderLevel) },
    { key: "avgDailyUse", label: "Avg daily use", num: true, render: (r) => qty(r.avgDailyUse) },
    { key: "supplier", label: "Supplier", render: (r) => r.supplier ? `${r.supplier.name} (${r.supplier.leadTimeDays}d)` : <span className="inv-muted">{r.supplierWarning}</span> },
    { key: "suggestedQty", label: `Order qty`, num: true, render: (r) => canWrite
      ? <><input className="inv-input inv-w90" aria-label={`Quantity for ${r.name}`} inputMode="decimal" value={sel[r.itemId] ?? ""} onChange={(e) => setSel({ ...sel, [r.itemId]: e.target.value })} /> <span className="inv-muted">{r.unit}</span></>
      : `${qty(r.suggestedQty)} ${r.unit}` },
    { key: "estTotal", label: "Est. value", num: true, render: (r) => money(Number(sel[r.itemId] || 0) * r.estUnitCost) },
  ];

  return (
    <div className="inv-page">
      <PageHead title="Reorder planning" crumb="Procurement">
        {canWrite && <button type="button" className="inv-btn inv-btn-primary" disabled={busy || picked.length === 0} onClick={create}>Create draft requests ({picked.length})</button>}
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}</div>}
      {meta && <div className="inv-banner">{meta.note} Average daily use is taken from the last {meta.lookbackDays} days of consumption. Suggested quantities are rounded up to whole packs.</div>}
      <div className="inv-card">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={load} rowKey={(r) => r.itemId} empty="Nothing needs reordering. Items appear here when stock plus open orders falls to the reorder level." />
      </div>
    </div>
  );
}
