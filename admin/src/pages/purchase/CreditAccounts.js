/**
 * CreditAccounts.js — suppliers bought from on credit: fund limit, amount owed, when settlement is due, and the
 * repayment ("settle") action. Settlements are recorded as supplier payments with purpose "credit settlement", so they go
 * through the same approval as any payment. A settlement falls due at the end of the month (plus grace days) or as soon
 * as the fund limit is reached, whichever comes first.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, DateInput, ExportBtn, Field, Modal, PageHead, Select, Toolbar, dateShort, errText, money } from "../pi-shared/InvUi";
import { StatusBadge, statusLabel } from "../pi-shared/PurchUi";
import { REASON_TEXT } from "./SupplierCredit";

const METHODS = ["bank_transfer", "upi", "cheque", "cash", "card", "other"];
const today = () => new Date().toISOString().slice(0, 10);

export default function CreditAccounts() {
  const { hasModulePermission } = useAuth();
  const { venueId, venueParam } = useVenue();
  const { toast } = useToast();
  const canPay = hasModulePermission("purchasePayments", "write");
  const [sp, setSp] = useSearchParams();
  const [state, setState] = useState({ rows: [], summary: null, loading: true, error: "" });
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(null); // statement of one supplier
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/finance/credit/accounts", { params: venueParam() }); setState({ rows: data.data, summary: data.summary, loading: false, error: "" }); }
    catch (e) { setState({ rows: [], summary: null, loading: false, error: errText(e, "Could not load credit accounts") }); }
  }, [venueParam]);
  useEffect(() => { load(); }, [load, venueId]);

  const show = useCallback(async (supplierId) => {
    try { setOpen((await api.get(`/finance/credit/accounts/${supplierId}`)).data); } catch (e) { toast.error(errText(e)); }
  }, [toast]);
  useEffect(() => { const id = sp.get("supplier"); if (id) { show(id); const n = new URLSearchParams(sp); n.delete("supplier"); setSp(n, { replace: true }); } /* eslint-disable-next-line */ }, []);

  const startPay = (a) => setPay({ supplierId: a.supplierId, name: a.name, outstanding: a.outstanding, amount: String(a.outstanding), method: "bank_transfer", reference: "", paymentDate: today(), notes: "" });
  const submit = async (ev) => {
    ev.preventDefault();
    const amount = Number(pay.amount);
    if (!(amount > 0)) { toast.error("Enter the amount being settled"); return; }
    if (amount > pay.outstanding + 0.001) { toast.error(`Only ${money(pay.outstanding)} is owed`); return; }
    if (pay.method !== "cash" && !pay.reference.trim()) { toast.error("Enter the transaction / cheque reference"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/finance/payments", { supplierId: pay.supplierId, purpose: "credit_settlement", amount, method: pay.method, reference: pay.reference, paymentDate: pay.paymentDate, notes: pay.notes }, { params: venueParam() });
      toast.success(data.status === "completed" ? "Credit settled" : "Settlement recorded — it reduces the balance once approved");
      setPay(null); setOpen(null); load();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const rows = state.rows.filter((r) => (filter === "due" ? r.settleNow : filter === "owing" ? r.outstanding > 0 : true));
  const columns = [
    { key: "name", label: "Supplier", render: (r) => <><span className="inv-strong">{r.name}</span><div className="inv-muted">{r.code}</div></> },
    { key: "limit", label: "Fund limit", num: true, render: (r) => money(r.limit) },
    { key: "outstanding", label: "Owed", num: true, render: (r) => money(r.outstanding) },
    { key: "available", label: "Available", num: true, render: (r) => money(r.available) },
    { key: "utilizationPct", label: "Used", num: true, render: (r) => (r.utilizationPct === null ? "—" : `${r.utilizationPct}%`) },
    { key: "dueDate", label: "Settle by", render: (r) => (r.outstanding > 0 && r.dueDate ? dateShort(r.dueDate) : "—") },
    { key: "settleNow", label: "Status", sortValue: (r) => (r.settleNow ? 1 : 0), render: (r) => r.settleNow ? <Badge tone="red">{r.limitReached ? "Limit reached" : "Overdue"}</Badge> : r.outstanding > 0 ? <Badge tone="amber">Owing</Badge> : <Badge tone="green">Clear</Badge>, exp: (r) => (r.settleNow ? (r.limitReached ? "Limit reached" : "Overdue") : r.outstanding > 0 ? "Owing" : "Clear") },
    { key: "act", label: "", render: (r) => (
      <span style={{ display: "flex", gap: 6 }}>
        <Btn type="button" kind="plain" sm onClick={() => show(r.supplierId)}>Statement</Btn>
        {canPay && r.outstanding > 0 && <Btn type="button" kind={r.settleNow ? "primary" : "plain"} sm onClick={() => startPay(r)}>Settle</Btn>}
      </span>) },
  ];
  const stCols = [
    { key: "poNo", label: "Order" }, { key: "orderDate", label: "Ordered", render: (r) => dateShort(r.orderDate) }, { key: "status", label: "Order status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "value", label: "Value", num: true, render: (r) => money(r.value) }, { key: "settled", label: "Settled", num: true, render: (r) => money(r.settled) },
    { key: "remaining", label: "Remaining", num: true, render: (r) => money(r.remaining) }, { key: "dueDate", label: "Due", render: (r) => (r.remaining > 0 ? dateShort(r.dueDate) : "—") },
  ];
  const s = state.summary;
  return (
    <div className="inner-page inv-page">
      <PageHead title="Credit accounts" count={`${rows.length} supplier(s)`}>
        <ExportBtn rows={rows} columns={columns} name="credit_accounts" sheet="Credit accounts" />
      </PageHead>
      <Toolbar>
        <Select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All credit suppliers</option><option value="owing">Owing money</option><option value="due">Settlement due</option></Select>
      </Toolbar>
      {s && <div className="inv-kpis">
        <div className="inv-card inv-kpi"><span>Total owed on credit</span><b>{money(s.outstanding)}</b></div>
        <div className="inv-card inv-kpi"><span>Settlements due</span><b style={{ color: s.settlementsDue ? "#dc2626" : undefined }}>{s.settlementsDue}</b></div>
        <div className="inv-card inv-kpi"><span>Amount due now</span><b>{money(s.dueAmount)}</b></div>
      </div>}
      <div className="inv-stack">
        <DataTable columns={columns} rows={rows} loading={state.loading} error={state.error} onRetry={load} rowKey={(r) => r.supplierId} empty="No supplier is on credit yet. Turn on “Allow purchases on credit” and set a fund limit on a supplier, then choose Credit when raising a purchase order." />
        <div className="inv-hint">Credit is repaid monthly: a month's purchases fall due at month end plus the supplier's grace days. Settlement is also due the moment the fund limit is reached, and new credit orders are blocked until it is paid.</div>
      </div>

      {open && !pay && (
        <Modal wide title={`Credit statement — ${open.name}`} onClose={() => setOpen(null)}
          footer={<>{canPay && open.outstanding > 0 && <Btn type="button" kind="primary" onClick={() => startPay({ ...open, supplierId: open.supplierId })}>Settle</Btn>}<Btn type="button" kind="plain" onClick={() => setOpen(null)}>Close</Btn></>}>
          <div className="inv-kpis">
            <div className="inv-card inv-kpi"><span>Fund limit</span><b>{money(open.limit)}</b></div><div className="inv-card inv-kpi"><span>Owed</span><b>{money(open.outstanding)}</b></div>
            <div className="inv-card inv-kpi"><span>Available</span><b>{money(open.available)}</b></div>
          </div>
          {open.settleNow && <div className="inv-banner" role="alert">{REASON_TEXT[open.reason] || "Settlement due"}</div>}
          <DataTable columns={stCols} rows={open.statement} rowKey={(r) => r.id} empty="No credit orders yet." />
          <div className="inv-section">Settlements</div>
          <DataTable columns={[{ key: "payNo", label: "Payment" }, { key: "paymentDate", label: "Date", render: (r) => dateShort(r.paymentDate) }, { key: "method", label: "Method", render: (r) => statusLabel(r.method) }, { key: "reference", label: "Reference", render: (r) => r.reference || "—" }, { key: "amount", label: "Amount", num: true, render: (r) => money(r.amount) }, { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> }]} rows={open.settlements} rowKey={(r) => r.id} empty="No settlements yet." />
        </Modal>
      )}
      {pay && (
        <Modal title={`Settle credit — ${pay.name}`} onClose={() => setPay(null)}
          footer={<><Btn type="button" kind="plain" onClick={() => setPay(null)}>Back</Btn><Btn type="submit" form="credit-pay" kind="primary" disabled={busy}>Record settlement</Btn></>}>
          <form id="credit-pay" onSubmit={submit}>
            <div className="inv-hint">Owed now: <b>{money(pay.outstanding)}</b>. Settlements are applied to the oldest orders first and, like any payment, may need approval.</div>
            <div className="inv-grid">
              <Field label="Amount (₹)" required><input className="inv-input" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
              <Field label="Payment date"><DateInput value={pay.paymentDate} max={today()} onChange={(e) => setPay({ ...pay, paymentDate: e.target.value })} /></Field>
              <Field label="Method"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{statusLabel(m)}</option>)}</Select></Field>
              <Field label="Reference" required={pay.method !== "cash"} hint="UTR / cheque / transaction number"><input className="inv-input" maxLength={80} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
              <Field label="Notes" full><textarea className="inv-textarea" maxLength={1000} value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></Field>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
