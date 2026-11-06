/** InventoryAlerts.js — live alert board: stock, expiry, overdue orders and invoices, failed consumption. Computed on the server on every load. */
import React, { useCallback, useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Btn, DataTable, PageHead, SearchBox, Tabs, Toolbar, dateShort, errText, money, qty, ExportBtn } from "../pi-shared/InvUi";

// [key, KPI label, tone, filter-pill label]
const SECTIONS = [
  ["outOfStock", "Out of stock", "red", "Out of stock"], ["expired", "Expired stock", "red", "Expired stock"], ["consumptionIssues", "Orders that could not be fully deducted", "amber", "Deduction issues"],
  ["lowStock", "Low stock", "amber", "Low stock"], ["nearExpiry", "Expiring soon", "amber", "Expiring soon"], ["overduePurchaseOrders", "Overdue purchase orders", "amber", "Overdue orders"],
  ["invoicesOverdue", "Overdue supplier invoices", "amber", "Overdue invoices"], ["quarantined", "In quarantine", "blue", "In quarantine"], ["invoicesDueSoon", "Invoices due soon", "blue", "Invoices due soon"],
];

export default function InventoryAlerts() {
  const { hasModulePermission } = useAuth();
  const { venueId, venueParam } = useVenue();
  const { toast } = useToast();
  const canWrite = hasModulePermission("inventoryAlerts", "write");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData((await api.get("/automation/alerts", { params: venueParam() })).data); }
    catch (e) { setError(errText(e, "Could not load alerts")); setData(null); }
    finally { setLoading(false); }
  }, [venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  const resolve = async (id) => {
    try { await api.post(`/automation/alerts/consumption-issues/${id}/resolve`, {}, { params: venueParam() }); toast.success("Marked as resolved"); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  const cols = {
    outOfStock: [["name", "Item"], ["available", "Available", (r) => `${qty(r.available)} ${r.unit}`], ["reorderPoint", "Reorder point", (r) => `${qty(r.reorderPoint)} ${r.unit}`]],
    lowStock: [["name", "Item"], ["available", "Available", (r) => `${qty(r.available)} ${r.unit}`], ["reorderPoint", "Reorder point", (r) => `${qty(r.reorderPoint)} ${r.unit}`], ["minStock", "Minimum", (r) => `${qty(r.minStock)} ${r.unit}`]],
    expired: [["name", "Item"], ["batchNo", "Batch"], ["onHand", "On hand", (r) => `${qty(r.onHand)} ${r.unit}`], ["expiryDate", "Expired on", (r) => dateShort(r.expiryDate)], ["value", "Value", (r) => money(r.value)]],
    nearExpiry: [["name", "Item"], ["batchNo", "Batch"], ["onHand", "On hand", (r) => `${qty(r.onHand)} ${r.unit}`], ["expiryDate", "Expires", (r) => `${dateShort(r.expiryDate)} (${r.daysLeft}d)`], ["value", "Value", (r) => money(r.value)]],
    quarantined: [["name", "Item"], ["batchNo", "Batch"], ["quarantined", "Quarantined", (r) => `${qty(r.quarantined)} ${r.unit}`]],
    overduePurchaseOrders: [["poNo", "PO"], ["supplierName", "Supplier"], ["expectedDate", "Expected", (r) => dateShort(r.expectedDate)], ["daysLate", "Days late"]],
    invoicesOverdue: [["docNo", "Invoice"], ["supplierName", "Supplier"], ["dueDate", "Due", (r) => dateShort(r.dueDate)], ["pending", "Pending", (r) => money(r.pending)], ["daysOverdue", "Days overdue"]],
    invoicesDueSoon: [["docNo", "Invoice"], ["supplierName", "Supplier"], ["dueDate", "Due", (r) => dateShort(r.dueDate)], ["pending", "Pending", (r) => money(r.pending)]],
    consumptionIssues: [["itemName", "Item"], ["orderId", "Order"], ["kind", "Problem", (r) => (r.kind === "shortfall" ? `Short by ${qty(r.shortfall)} ${r.unit}` : "Ledger posting failed")], ["at", "When", (r) => dateShort(r.at)]],
  };
  const mk = (key) => [
    ...(cols[key] || []).map(([k, label, render]) => ({ key: k, label, render })),
    ...(key === "consumptionIssues" && canWrite ? [{ key: "x", label: "", render: (r) => <Btn type="button" kind="plain" sm onClick={() => resolve(r.id)}>Resolve</Btn> }] : []),
  ];
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const match = (rows) => (search.trim() ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.trim().toLowerCase())) : rows);
  // one table: the filter pill picks which alert list it shows (defaults to the first type that has anything in it)
  const active = data ? (section || (SECTIONS.find(([k]) => data[k]?.length) || SECTIONS[0])[0]) : "";
  const activeRows = data ? match(data[active] || []) : [];

  return (
    <div className="inner-page inv-page">
      <PageHead title="Inventory alerts">
        <ExportBtn rows={activeRows} columns={mk(active)} name={`inventory_alerts_${active}`} sheet="Alerts" />
        <Btn type="button" kind="plain" onClick={load} disabled={loading}>Refresh</Btn>
      </PageHead>
      {error && <div className="inv-banner" role="alert">{error}</div>}
      {data && (
        <>
          <div className="inv-stack">
          <Toolbar>
            <SearchBox placeholder=" Search alerts" aria-label="Search alerts" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Tabs inline value={active} onChange={setSection} tabs={SECTIONS.map(([k, , , pill]) => [k, `${pill} (${(data.counts || {})[k] ?? 0})`])} />
          </Toolbar>
          <div className="inv-kpis">
            {SECTIONS.slice(0, 6).map(([k, label, tone]) => (
              <div key={k} className="inv-card inv-kpi"><span>{label}</span><b style={{ color: (data.counts || {})[k] ? (tone === "red" ? "#dc2626" : "#b45309") : undefined }}>{(data.counts || {})[k] ?? 0}</b></div>
            ))}
          </div>
          <DataTable columns={mk(active)} rows={activeRows} rowKey={(r, i) => r.id || `${r.itemId}-${r.batchNo || ""}-${i}`} empty={SECTIONS.every(([k]) => !(data[k] || []).length) ? "Nothing needs attention right now." : "No alerts of this type."} />
          <div className="inv-muted">Alerts are worked out each time this page loads; they are not pushed to phones. Expiry window: {data.settings?.expiryAlertDays ?? 0} days. Updated {new Date(data.generatedAt || Date.now()).toLocaleTimeString("en-IN")}.</div>
          </div>
        </>
      )}
    </div>
  );
}
