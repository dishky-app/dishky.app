/** SupplierCredit.js — credit position of one supplier (limit, owed, settlement due) for the supplier details page. */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { Badge, Btn, dateShort, money } from "../pi-shared/InvUi";

export const REASON_TEXT = { limit_reached: "Fund limit reached — settle now", month_overdue: "Monthly settlement overdue", month_end_grace: "Month ended — settle within the grace days" };

export default function SupplierCredit({ supplier }) {
  const nav = useNavigate();
  const [a, setA] = useState(null);
  useEffect(() => { api.get(`/finance/credit/accounts/${supplier.id}`).then(({ data }) => setA(data)).catch(() => setA(false)); }, [supplier.id]);
  if (!a || (!a.creditEnabled && !a.outstanding)) return null;
  return (
    <div className="horizontal-form-group">
      <div className="section">
        <div className="section-title"><span>Credit account</span></div>
        <div className="inv-kpis">
          <div className="inv-card inv-kpi"><span>Fund limit</span><b>{money(a.limit)}</b></div>
          <div className="inv-card inv-kpi"><span>Owed</span><b>{money(a.outstanding)}</b></div>
          <div className="inv-card inv-kpi"><span>Available</span><b>{money(a.available)}</b></div>
          <div className="inv-card inv-kpi"><span>Settle by</span><b>{a.dueDate ? dateShort(a.dueDate) : "—"}</b></div>
        </div>
        {a.settleNow && <div className="inv-banner" role="alert">{REASON_TEXT[a.reason] || "Settlement due"}</div>}
        <div style={{ paddingBottom: 8 }}>{a.settleNow ? <Badge tone="red">Settlement due</Badge> : <Badge tone="green">Within limit</Badge>} <Btn type="button" kind="plain" sm onClick={() => nav(`/purchase/credit?supplier=${supplier.id}`)}>Open credit account</Btn></div>
      </div>
    </div>
  );
}
