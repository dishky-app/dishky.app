/** StockLedger.js — append-only movement history with filters and authorised reversals. */
import React, { useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import { Badge, DataTable, Field, Modal, PageHead, Pager, dateTime, errText, money, qty, usePagedList, useRef_ } from "./InvUi";

const TYPES = ["opening", "receipt", "adjustment_in", "adjustment_out", "waste", "consumption", "supplier_return", "transfer_in", "transfer_out", "status_change", "reversal"];
const TONE = { opening: "blue", receipt: "green", adjustment_in: "green", transfer_in: "green", reversal: "amber", status_change: "grey" };

export default function StockLedger() {
  const { hasModulePermission } = useAuth();
  const { toast } = useToast();
  const canReverse = hasModulePermission("stockLedger", "write");
  const [itemId, setItemId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const items = useRef_("/inventory/items", { limit: 200 }, (d) => d.data);
  const params = {
    itemId, type,
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
  };
  const list = usePagedList("/inventory/ledger", params, { pageSize: 50 });
  const [rev, setRev] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const doReverse = async (ev) => {
    ev.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/inventory/ledger/${rev.id}/reverse`, { reason });
      toast.success(data.replayed ? "Already reversed" : `Reversal ${data.entry.txnNo} posted`);
      setRev(null); setReason(""); list.reload();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };

  const columns = [
    { key: "postedAt", label: "Date", render: (e) => dateTime(e.postedAt) },
    { key: "txnNo", label: "Txn", render: (e) => <span className="inv-strong">{e.txnNo}</span> },
    { key: "type", label: "Type", render: (e) => <Badge tone={TONE[e.type] || "grey"}>{e.type.replace(/_/g, " ")}</Badge> },
    { key: "item", label: "Item", render: (e) => <div><div className="inv-strong">{e.itemName}</div><div className="inv-muted">{e.locationName}{e.batchNo ? ` · ${e.batchNo}` : ""}</div></div> },
    { key: "in", label: "In", num: true, render: (e) => (e.qtyIn ? qty(e.qtyIn) : "") },
    { key: "out", label: "Out", num: true, render: (e) => (e.qtyOut ? qty(e.qtyOut) : "") },
    { key: "bal", label: "Balance", num: true, render: (e) => `${qty(e.balanceAfter)} ${e.unit}` },
    { key: "val", label: "Value impact", num: true, render: (e) => (e.valueImpact ? money(e.valueImpact) : "—") },
    { key: "reason", label: "Reason", render: (e) => e.reason || "—" },
    { key: "user", label: "By", render: (e) => e.userName || "—" },
    ...(canReverse ? [{ key: "act", label: "", render: (e) => (
      !["reversal", "status_change"].includes(e.type) && <button type="button" className="inv-btn inv-btn-sm inv-btn-danger" onClick={() => setRev(e)}>Reverse</button>) }] : []),
  ];

  return (
    <div className="inv-page">
      <PageHead title="Stock ledger" crumb="Inventory" />
      <div className="inv-card">
        <div className="inv-toolbar">
          <select className="inv-select" aria-label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">All items</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <select className="inv-select" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
          <input className="inv-input" type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="inv-input" type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <DataTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No stock movements match these filters." />
        <Pager page={list.page} setPage={list.setPage} total={list.total} pageSize={list.pageSize} />
      </div>
      {rev && (
        <Modal title={`Reverse ${rev.txnNo}`} onClose={() => setRev(null)}
          footer={<><button type="button" className="inv-btn" onClick={() => setRev(null)}>Cancel</button><button type="submit" form="inv-rev-form" className="inv-btn inv-btn-danger" disabled={busy || !reason.trim()}>{busy ? "Posting…" : "Post reversal"}</button></>}>
          <form id="inv-rev-form" onSubmit={doReverse}>
            <p style={{ margin: 0 }}>This posts an equal and opposite entry. The original stays in the ledger and can only be reversed once.</p>
            <Field label="Reason" required><textarea className="inv-textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
