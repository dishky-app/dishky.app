/** InventoryAlerts.js — live alert board: stock, expiry, overdue orders and invoices, failed consumption. Computed on the server on every load. */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, PageHead, dateShort, errText, money, qty } from "./InvUi";

const SECTIONS = [
  ["outOfStock", "Out of stock", "red"], ["expired", "Expired stock", "red"], ["consumptionIssues", "Orders that could not be fully deducted", "amber"],
  ["lowStock", "Low stock", "amber"], ["nearExpiry", "Expiring soon", "amber"], ["overduePurchaseOrders", "Overdue purchase orders", "amber"],
  ["invoicesOverdue", "Overdue supplier invoices", "amber"], ["quarantined", "In quarantine", "blue"], ["invoicesDueSoon", "Invoices due soon", "blue"],
];

export default function InventoryAlerts() {
  const { hasModulePermission } = useAuth();
  const { venueId, venueParam, currentVenue } = useVenue();
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
    outOfStock: [["name", "Item"], ["available", "Available", (r) => `${qty(r.available)} ${r.unit}`], ["reorderPoint", "Reorder point", (r) => qty(r.reorderPoint)]],
    lowStock: [["name", "Item"], ["available", "Available", (r) => `${qty(r.available)} ${r.unit}`], ["reorderPoint", "Reorder point", (r) => qty(r.reorderPoint)], ["minStock", "Minimum", (r) => qty(r.minStock)]],
    expired: [["name", "Item"], ["batchNo", "Batch"], ["onHand", "On hand", (r) => `${qty(r.onHand)} ${r.unit}`], ["expiryDate", "Expired on", (r) => dateShort(r.expiryDate)], ["value", "Value", (r) => money(r.value)]],
    nearExpiry: [["name", "Item"], ["batchNo", "Batch"], ["onHand", "On hand", (r) => `${qty(r.onHand)} ${r.unit}`], ["expiryDate", "Expires", (r) => `${dateShort(r.expiryDate)} (${r.daysLeft}d)`], ["value", "Value", (r) => money(r.value)]],
    quarantined: [["name", "Item"], ["batchNo", "Batch"], ["quarantined", "Quarantined", (r) => `${qty(r.quarantined)} ${r.unit}`]],
    overduePurchaseOrders: [["poNo", "PO"], ["supplierName", "Supplier"], ["expectedDate", "Expected", (r) => dateShort(r.expectedDate)], ["daysLate", "Days late"]],
    invoicesOverdue: [["docNo", "Invoice"], ["supplierName", "Supplier"], ["dueDate", "Due", (r) => dateShort(r.dueDate)], ["pending", "Pending", (r) => money(r.pending)], ["daysOverdue", "Days overdue"]],
    invoicesDueSoon: [["docNo", "Invoice"], ["supplierName", "Supplier"], ["dueDate", "Due", (r) => dateShort(r.dueDate)], ["pending", "Pending", (r) => money(r.pending)]],
    consumptionIssues: [["itemName", "Item"], ["orderId", "Order"], ["kind", "Problem", (r) => (r.kind === "shortfall" ? `Short by ${qty(r.shortfall)} ${r.unit}` : "Ledger posting failed")], ["at", "When", (r) => dateShort(r.at)]],
  };
  const mk = (key) => [
    ...cols[key].map(([k, label, render]) => ({ key: k, label, render })),
    ...(key === "consumptionIssues" && canWrite ? [{ key: "x", label: "", render: (r) => <button type="button" className="inv-btn inv-btn-sm" onClick={() => resolve(r.id)}>Resolve</button> }] : []),
  ];
  const pa = data?.pendingApprovals;

  return (
    <div className="inv-page">
      <PageHead title="Inventory alerts" crumb="Automation">
        <button type="button" className="inv-btn" onClick={load} disabled={loading}>Refresh</button>
      </PageHead>
      {currentVenue && <div className="inv-muted">Branch: {currentVenue.name}{data ? ` · updated ${new Date(data.generatedAt).toLocaleTimeString("en-IN")}` : ""}</div>}
      {error && <div className="inv-banner" role="alert">{error}</div>}
      {data && (
        <>
          <div className="inv-kpis">
            {SECTIONS.slice(0, 6).map(([k, label, tone]) => (
              <div key={k} className="inv-card inv-kpi"><span>{label}</span><b style={{ color: data.counts[k] ? (tone === "red" ? "#dc2626" : "#b45309") : undefined }}>{data.counts[k]}</b></div>
            ))}
          </div>
          {pa && (pa.purchaseRequests + pa.purchaseOrders + pa.supplierReturns + pa.payments + pa.stockAudits + pa.draftGoodsReceipts > 0) && (
            <div className="inv-card" style={{ padding: 14 }}>
              <b>Waiting for someone</b>
              <div className="inv-muted" style={{ marginTop: 6 }}>
                {[[pa.purchaseRequests, "purchase requests", "/purchase/requests"], [pa.purchaseOrders, "purchase orders", "/purchase/orders"], [pa.supplierReturns, "supplier returns", "/purchase/returns"], [pa.payments, "payments", "/purchase/payments"], [pa.stockAudits, "stock audits", "/inventory/audits"], [pa.draftGoodsReceipts, "draft goods receipts", "/purchase/receipts"]]
                  .filter((x) => x[0] > 0).map((x) => <Link key={x[2]} to={x[2]} style={{ marginRight: 14 }}>{x[0]} {x[1]}</Link>)}
              </div>
            </div>
          )}
          {SECTIONS.filter(([k]) => data[k].length).map(([k, label, tone]) => (
            <div key={k} className="inv-card">
              <div className="inv-toolbar"><b>{label}</b> <Badge tone={tone}>{data[k].length}</Badge></div>
              <DataTable columns={mk(k)} rows={data[k]} rowKey={(r, i) => r.id || `${r.itemId}-${r.batchNo || ""}-${i}`} />
            </div>
          ))}
          {SECTIONS.every(([k]) => !data[k].length) && <div className="inv-card" style={{ padding: 20 }}>Nothing needs attention right now.</div>}
          <div className="inv-muted">Alerts are worked out each time this page loads; they are not pushed to phones. Expiry window: {data.settings.expiryAlertDays} days.</div>
        </>
      )}
    </div>
  );
}
