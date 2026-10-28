/** PurchaseSettings.js — approval limits and procurement policy. */
import React, { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Field, PageHead, errText } from "./InvUi";

export default function PurchaseSettings() {
  const { hasModulePermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseSettings", "write");
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/purchase/settings").then((r) => setF(r.data)).catch((e) => setError(errText(e))); }, []);

  const save = async (ev) => {
    ev.preventDefault(); setBusy(true);
    try { setF((await api.patch("/purchase/settings", f)).data); toast.success("Settings saved"); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  if (error) return <div className="inv-page"><div className="inv-error" role="alert">{error}</div></div>;
  if (!f) return <div className="inv-page"><div className="inv-muted">Loading…</div></div>;
  return (
    <div className="inv-page">
      <PageHead title="Purchase settings" crumb="Procurement" />
      <form className="inv-card" style={{ padding: 20, maxWidth: 720 }} onSubmit={save}>
        <div className="inv-grid">
          <Field label="Purchase request auto-approval limit (₹)" hint="Requests up to this value skip approval. 0 = every request needs approval."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.prApprovalLimit} onChange={(e) => setF({ ...f, prApprovalLimit: e.target.value })} /></Field>
          <Field label="Purchase order auto-approval limit (₹)" hint="Orders up to this value skip approval. 0 = every order needs approval."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.poApprovalLimit} onChange={(e) => setF({ ...f, poApprovalLimit: e.target.value })} /></Field>
          <Field label="Restaurant GST state code" hint="Two digits, e.g. 29 for Karnataka. Used to split GST into CGST+SGST or IGST."><input className="inv-input" maxLength={2} disabled={!canWrite} value={f.gstStateCode} onChange={(e) => setF({ ...f, gstStateCode: e.target.value })} /></Field>
          <Field label="Reorder look-back (days)" hint="How many days of consumption set the average daily use."><input className="inv-input" inputMode="numeric" disabled={!canWrite} value={f.reorderLookbackDays} onChange={(e) => setF({ ...f, reorderLookbackDays: e.target.value })} /></Field>
          <Field label="Invoice quantity tolerance (%)" hint="Billing above the received quantity by up to this much still matches."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.matchQtyTolerancePct} onChange={(e) => setF({ ...f, matchQtyTolerancePct: e.target.value })} /></Field>
          <Field label="Invoice price tolerance (%)" hint="A price above the order price by up to this much still matches."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.matchPriceTolerancePct} onChange={(e) => setF({ ...f, matchPriceTolerancePct: e.target.value })} /></Field>
          <Field label="Invoice total tolerance (₹)" hint="Allowed difference between the printed and calculated total (rounding)."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.invoiceTotalTolerance} onChange={(e) => setF({ ...f, invoiceTotalTolerance: e.target.value })} /></Field>
          <Field label="Payment auto-approval limit (₹)" hint="Payments up to this amount skip approval. 0 = every payment needs approval."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.paymentApprovalLimit} onChange={(e) => setF({ ...f, paymentApprovalLimit: e.target.value })} /></Field>
          <Field label="Over-delivery tolerance (%)" hint="Extra quantity accepted above the ordered quantity. 0 = none."><input className="inv-input" inputMode="decimal" disabled={!canWrite} value={f.overReceiptPct} onChange={(e) => setF({ ...f, overReceiptPct: e.target.value })} /></Field>
          <label className="inv-check inv-full"><input type="checkbox" disabled={!canWrite} checked={!!f.allowSelfApproval} onChange={(e) => setF({ ...f, allowSelfApproval: e.target.checked })} />Allow people to approve documents they created themselves (not recommended)</label>
          <label className="inv-check inv-full"><input type="checkbox" disabled={!canWrite} checked={!!f.allowManualPo} onChange={(e) => setF({ ...f, allowManualPo: e.target.checked })} />Allow purchase orders without a purchase request or quotation</label>
        </div>
        {canWrite && <div style={{ marginTop: 16 }}><button type="submit" className="inv-btn inv-btn-primary" disabled={busy}>Save settings</button></div>}
      </form>
    </div>
  );
}
