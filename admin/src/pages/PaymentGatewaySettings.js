import { useEffect, useState } from "react";
import api from "../api";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import "./PaymentGatewaySettings.css";

// The restaurant's own Razorpay account — customer UPI payments settle there,
// not with Dishky. Secrets are write-only: the server never sends them back.
const PaymentGatewaySettings = () => {
  const { toast } = useToast();
  const [info, setInfo] = useState(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get("/payments/gateway")
      .then((res) => { setInfo(res.data); setKeyId(res.data.keyId || ""); })
      .catch(() => setInfo({ error: true }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!keyId.trim()) { toast.error("Enter the Razorpay Key ID."); return; }
    if (!info.hasKeySecret && !keySecret) { toast.error("Enter the Razorpay Key secret."); return; }
    setSaving(true);
    try {
      const body = { keyId: keyId.trim() };
      if (keySecret) body.keySecret = keySecret;
      if (webhookSecret) body.webhookSecret = webhookSecret;
      const res = await api.put("/payments/gateway", body);
      setInfo((prev) => ({ ...prev, ...res.data }));
      setKeySecret("");
      setWebhookSecret("");
      setOpen(false);
      toast.success("Payment gateway saved.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't save the gateway settings");
    } finally {
      setSaving(false);
    }
  };

  if (!info || info.error) return null;

  return (
    <section className="pg-card">
      <div className="pg-head">
        <div>
          <h3 className="pg-title">Online payments (Razorpay)</h3>
          <p className="pg-sub">
            {info.configured
              ? <>Connected{info.keyId ? <> · key <code>{info.keyId}</code></> : null}</>
              : "Not connected. Customers can't pay by UPI until you add your Razorpay keys."}
          </p>
        </div>
        <button type="button" className="pg-link" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : info.configured ? "Change keys" : "Connect"}
        </button>
      </div>

      {open && (
        <form className="pg-form" onSubmit={save} noValidate>
          <div className="mat">
            <input className="mat-input" placeholder=" " value={keyId} onChange={(e) => setKeyId(e.target.value)} required autoComplete="off" />
            <label className="mat-label">Key ID<span className="rf-req">*</span></label>
            <span className="mat-bar" />
          </div>
          <AuthPasswordField label="Key secret" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} required={!info.hasKeySecret} autoComplete="new-password" />
          <AuthPasswordField label="Webhook secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} required={false} autoComplete="new-password" />
          {info.hasKeySecret && <p className="pg-hint">Leave a secret blank to keep the saved one.</p>}
          {info.webhookUrl && (
            <p className="pg-hint">In Razorpay → Webhooks, add <code>{info.webhookUrl}</code> for the <em>payment.captured</em> event.</p>
          )}
          <div className="pg-actions">
            <Button3D type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button3D>
          </div>
        </form>
      )}
    </section>
  );
};

export default PaymentGatewaySettings;
