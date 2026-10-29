/**
 * WhatsappPurchaseList.js — send a purchase list to a supplier on WhatsApp. Every send is a deliberate click, goes
 * through a WhatsApp-approved template, is rate-limited and is logged. Delivery receipts are not tracked.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import { Badge, Btn, DataTable, Field, PageHead, Select, dateTime, errText, usePagedList, useRef_ } from "./InvUi";
import { LineEditor, linesPayload } from "./PurchUi";

export default function WhatsappPurchaseList() {
  const { hasModulePermission } = useAuth();
  const { venueParam } = useVenue();
  const { toast } = useToast();
  const canSend = hasModulePermission("purchaseWhatsapp", "write");
  const suppliers = useRef_("/inventory/suppliers", { status: "active", limit: 200 }, (d) => d.data);
  const items = useRef_("/inventory/items", { status: "active", limit: 200 }, (d) => d.data);
  const log = usePagedList("/automation/whatsapp/log", {});
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPreview(null); }, [supplierId, lines]);
  const body = useCallback(() => ({ supplierId, lines: linesPayload(lines).map((l) => ({ itemId: l.itemId, qty: l.qty, unit: l.unit })) }), [supplierId, lines]);

  const doPreview = async () => {
    if (!supplierId) { toast.error("Choose a supplier"); return; }
    try { setBusy(true); setPreview((await api.post("/automation/whatsapp/purchase-list/preview", body(), { params: venueParam() })).data); }
    catch (e) { toast.error(e.response ? errText(e) : e.message); } finally { setBusy(false); }
  };
  const send = async (force = false) => {
    setBusy(true);
    try {
      await api.post("/automation/whatsapp/purchase-list/send", { ...body(), force }, { params: venueParam() });
      toast.success("Handed to WhatsApp"); setPreview(null); log.reload();
    } catch (e) {
      const code = e.response?.data?.code;
      if (code === "DUPLICATE_SEND") { toast.confirm("This exact list was sent to this supplier a few minutes ago. Send it again?", () => send(true)); return; }
      toast.error(errText(e)); log.reload();
    } finally { setBusy(false); }
  };

  const cols = [
    { key: "createdAt", label: "When", render: (r) => dateTime(r.createdAt) },
    { key: "supplierName", label: "Supplier" }, { key: "phoneMasked", label: "Number" },
    { key: "itemCount", label: "Items", num: true },
    { key: "status", label: "Result", render: (r) => <Badge tone={r.status === "sent" ? "green" : r.status === "failed" ? "red" : "amber"}>{r.status}</Badge> },
    { key: "error", label: "Detail", render: (r) => r.error || "" },
    { key: "sentByName", label: "Sent by" },
  ];
  return (
    <div className="inner-page inv-page">
      <PageHead title="WhatsApp purchase list" />
      <div className="inv-banner">Sending needs the server's WhatsApp (AiSensy) key and an approved template name — set it in <Link to="/purchase/automation">Automation settings</Link>. This sends a message only; it does not create or approve a purchase order.</div>
      <div className="details-container inv-form">
        <div className="inv-grid">
          <Field label="Supplier" required><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
        <div className="inv-section">Items to order</div>
        <LineEditor items={items} value={lines} onChange={setLines} />
        <div className="inv-btnrow">
          <Btn type="button" kind="plain" disabled={busy || !lines.length} onClick={doPreview}>Preview</Btn>
          {canSend && <Btn type="button" kind="primary" disabled={busy || !preview || !preview.phoneValid || !preview.templateConfigured || !preview.apiConfigured} onClick={() => send(false)}>Send on WhatsApp</Btn>}
        </div>
        {preview && (
          <div className="inv-preview">
            <div><b>{preview.supplier.name}</b> · {preview.phoneValid ? preview.phoneMasked : <Badge tone="red">no valid mobile number on file</Badge>} · {preview.itemCount} item(s)</div>
            <div className="inv-muted" style={{ marginTop: 6 }}>{preview.variables[2]}</div>
            {!preview.templateConfigured && <div className="inv-banner" style={{ marginTop: 8 }}>No template name is set.</div>}
            {!preview.apiConfigured && <div className="inv-banner" style={{ marginTop: 8 }}>WhatsApp is not configured on the server.</div>}
            <div className="inv-muted" style={{ marginTop: 6 }}>{preview.templateHelp}</div>
          </div>
        )}
      </div>
      <div className="inv-card inv-logcard">
        <div className="inv-panel-title"><b>Send log</b></div>
        <DataTable columns={cols} rows={log.rows} loading={log.loading} error={log.error} onRetry={log.reload} rowKey={(r) => r.id} empty="Nothing sent yet." more={log} />
      </div>
    </div>
  );
}
