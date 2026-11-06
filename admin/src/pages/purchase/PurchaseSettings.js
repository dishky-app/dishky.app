/**
 * PurchaseSettings.js — the one settings page of the Purchase & Inventory module.
 *   1. Approvals & invoice matching  (GET/PATCH /purchase/settings)
 *   2. Alerts & stock audits         (GET/PUT   /automation/settings)
 * Both are saved with a single button. Options that belong to features that are not part of the module any more
 * (purchase requests, reorder planning, forecast, WhatsApp lists) are not shown; their stored values are sent back
 * unchanged so nothing is lost.
 */
import React, { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Btn, Field, PageHead, errText } from "../pi-shared/InvUi";

export default function PurchaseSettings() {
  const { hasModulePermission } = useAuth();
  const { toast } = useToast();
  const canWrite = hasModulePermission("purchaseSettings", "write");
  const [p, setP] = useState(null);          // purchase settings (editable copy)
  const [a, setA] = useState(null);          // automation settings (editable copy)
  const [saved, setSaved] = useState("");    // JSON of what is on the server, to know when something changed
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([api.get("/purchase/settings"), api.get("/automation/settings")])
      .then(([pr, au]) => { if (!live) return; setP(pr.data); setA(au.data); setSaved(JSON.stringify([pr.data, au.data])); })
      .catch((e) => { if (live) setError(errText(e, "Could not load settings")); });
    return () => { live = false; };
  }, []);

  const setPurchase = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));
  const setAuto = (k) => (e) => setA((x) => ({ ...x, [k]: e.target.value }));
  const dirty = !!p && !!a && JSON.stringify([p, a]) !== saved;

  const save = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    let step = "Purchase settings";
    try {
      const pr = await api.patch("/purchase/settings", p);
      step = "Alert settings";
      const au = await api.put("/automation/settings", {
        expiryAlertDays: Number(a.expiryAlertDays), dueSoonDays: Number(a.dueSoonDays), forecastLookbackDays: Number(a.forecastLookbackDays),
        forecastHorizonDays: Number(a.forecastHorizonDays), whatsappHourlyLimit: Number(a.whatsappHourlyLimit),
        whatsappPurchaseTemplate: a.whatsappPurchaseTemplate, largeVarianceThreshold: a.largeVarianceThreshold,
      });
      setP(pr.data); setA(au.data); setSaved(JSON.stringify([pr.data, au.data]));
      toast.success("Settings saved");
    } catch (e) { toast.error(`${step}: ${errText(e)}`); }
    finally { setBusy(false); }
  };

  if (error) return <div className="inner-page inv-page"><PageHead title="Purchase settings" /><div className="inv-error" role="alert">{error}</div></div>;
  if (!p || !a) return <div className="inner-page inv-page"><PageHead title="Purchase settings" /><div className="inv-muted">Loading…</div></div>;

  const off = !canWrite;
  return (
    <div className="inner-page inv-page">
      <PageHead title="Purchase settings" />
      <div className="inv-settings">
        <form className="details-container inv-form" onSubmit={save} noValidate>
          <h3 className="inv-formtitle">Approvals &amp; invoice matching</h3>
          <div className="inv-grid">
            <Field label="Purchase order auto-approval limit (₹)" hint="Orders up to this value skip approval. 0 = every order needs approval.">
              <input inputMode="decimal" disabled={off} value={p.poApprovalLimit} onChange={setPurchase("poApprovalLimit")} />
            </Field>
            <Field label="Payment auto-approval limit (₹)" hint="Payments up to this amount skip approval. 0 = every payment needs approval.">
              <input inputMode="decimal" disabled={off} value={p.paymentApprovalLimit} onChange={setPurchase("paymentApprovalLimit")} />
            </Field>
            <Field label="Restaurant GST state code" hint="Two digits, e.g. 29 for Karnataka. Used to split GST into CGST + SGST or IGST.">
              <input maxLength={2} disabled={off} value={p.gstStateCode} onChange={setPurchase("gstStateCode")} />
            </Field>
            <Field label="Over-delivery tolerance (%)" hint="Extra quantity accepted above the ordered quantity. 0 = none.">
              <input inputMode="decimal" disabled={off} value={p.overReceiptPct} onChange={setPurchase("overReceiptPct")} />
            </Field>
            <Field label="Invoice quantity tolerance (%)" hint="Billing above the received quantity by up to this much still matches.">
              <input inputMode="decimal" disabled={off} value={p.matchQtyTolerancePct} onChange={setPurchase("matchQtyTolerancePct")} />
            </Field>
            <Field label="Invoice price tolerance (%)" hint="A price above the order price by up to this much still matches.">
              <input inputMode="decimal" disabled={off} value={p.matchPriceTolerancePct} onChange={setPurchase("matchPriceTolerancePct")} />
            </Field>
            <Field label="Invoice total tolerance (₹)" hint="Allowed difference between the printed and calculated total (rounding).">
              <input inputMode="decimal" disabled={off} value={p.invoiceTotalTolerance} onChange={setPurchase("invoiceTotalTolerance")} />
            </Field>
            <label className="inv-check inv-full">
              <input type="checkbox" disabled={off} checked={!!p.allowSelfApproval} onChange={(e) => setP({ ...p, allowSelfApproval: e.target.checked })} />
              Allow people to approve documents they created themselves (not recommended)
            </label>
          </div>

          <h3 className="inv-formtitle">Alerts &amp; stock audits</h3>
          <div className="inv-grid">
            <Field label="Expiry alert window (days)" hint="Batches expiring within this many days are flagged on Inventory alerts.">
              <input inputMode="numeric" disabled={off} value={a.expiryAlertDays} onChange={setAuto("expiryAlertDays")} />
            </Field>
            <Field label="Invoice due-soon window (days)" hint="Approved invoices due within this many days show as “due soon”.">
              <input inputMode="numeric" disabled={off} value={a.dueSoonDays} onChange={setAuto("dueSoonDays")} />
            </Field>
            <Field label="Large audit variance (₹)" hint="Count differences above this value are highlighted for the reviewer; approval is always required.">
              <input inputMode="decimal" disabled={off} value={a.largeVarianceThreshold} onChange={setAuto("largeVarianceThreshold")} />
            </Field>
          </div>

          {canWrite && (
            <div className="inv-btnrow inv-formfoot">
              <Btn type="submit" kind="primary" disabled={busy || !dirty}>{busy ? "Saving…" : "Save settings"}</Btn>
              {!dirty && !busy && <span className="inv-muted">No changes to save.</span>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
