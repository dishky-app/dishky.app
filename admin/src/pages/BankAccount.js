/**
 * BankAccount.js  —  Dishky Admin Panel
 * Restaurant's own bank account details — where customer payments settle.
 * Super Admin only. Singleton settings form (one record for the
 * restaurant), following the same masked-until-revealed pattern as any
 * sensitive-field settings page: the account number stays masked
 * (••••1234) until "Edit" is clicked, which fetches the unmasked value
 * from the dedicated /bank-account/reveal endpoint.
 */

import React, { useState, useEffect } from "react";

import api from "../api";
import { allowTextInput } from "../App";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import PageLoader from "../components/PageLoader";
import useAnimatedModal from "../hooks/useAnimatedModal";
import closeIcon from "../icon/close-icon.png";

import PaymentGatewaySettings from "./PaymentGatewaySettings";
import "./BankAccount.css";
import "./ModalCSS.css";
import { toTitleCase } from "../utils/formUtils";

const EMPTY_FORM = {
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  branchName: "",
  upiVpa: "",
};

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Same pattern as bankAccount.js's isValidUpiVpa server-side — kept in
// sync deliberately so a value that passes here never gets rejected by
// the server's own check (and vice versa), which would otherwise show
// as a confusing "saved successfully" client-side followed by a 400.
const UPI_VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

const BankAccount = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(null); // masked record as last saved/loaded
  const [isEditing, setIsEditing] = useState(false);
  const editModal = useAnimatedModal("bankAccount-edit");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/bank-account");
      setSaved(res.data && res.data.accountHolderName ? res.data : null);
    } catch (err) {
      console.error("Failed to load bank account:", err);
      toast.error("Failed to load bank account details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) { setIsLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const startEdit = async () => {
    setFormErrors({});
    try {
      // Pull the unmasked account number only when actually editing.
      const res = await api.get("/bank-account/reveal");
      setForm({ ...EMPTY_FORM, ...res.data });
    } catch (err) {
      console.error("Failed to load bank account for editing:", err);
      toast.error("Failed to load account details for editing");
      return;
    }
    setIsEditing(true);
    editModal.open();
  };

  const cancelEdit = () => {
    editModal.close(() => setIsEditing(false));
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validate = () => {
    const e = {};
    if (!form.accountHolderName.trim()) e.accountHolderName = true;
    if (!form.accountNumber.trim() || !/^\d{9,18}$/.test(form.accountNumber.trim())) e.accountNumber = true;
    if (!IFSC_PATTERN.test(form.ifscCode.trim().toUpperCase())) e.ifscCode = true;
    if (!form.bankName.trim()) e.bankName = true;
    // Required — the Direct UPI QR Payment System (Orders page) reads
    // this to build every order's payment QR. A missing/malformed value
    // here would otherwise surface as a confusing failure later, on the
    // Orders page, disconnected from where it actually needs fixing.
    if (!UPI_VPA_PATTERN.test(form.upiVpa.trim())) e.upiVpa = true;
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setFormErrors(e); return; }

    setSaving(true);
    try {
      const res = await api.put("/bank-account", {
        ...form,
        ifscCode: form.ifscCode.trim().toUpperCase(),
      });
      setSaved(res.data);
      editModal.close(() => setIsEditing(false));
      setForm(EMPTY_FORM);
      toast.success("Bank account details saved");
    } catch (err) {
      console.error("Failed to save bank account:", err);
      toast.error(err?.response?.data?.error || "Failed to save bank account details");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can view bank account details.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading bank account details…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Bank Accounts</h2>
            </div>
          </div>
        </div>
        <Button3D onClick={startEdit}>{saved ? "Edit Details" : "+ Add Bank Account"}</Button3D>
      </div>

      <p className="ba-subtitle">
        Where customer payments settle. Every order's Razorpay UPI QR is generated against your Razorpay account, not this VPA directly — this record is for reference and bank transfers. Visible to Super Admin only.
      </p>

      {saved ? (
        <div className="ba-layout">
          {/* Bank-card style summary: the account number stays masked here too */}
          <div className="ba-visual" aria-label="Bank account summary">
            <div className="ba-visual-top">
              <span className="ba-visual-bank">{saved.bankName}</span>
              <svg className="ba-visual-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 10 12 4l9 6" />
                <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
                <path d="M3 21h18" />
              </svg>
            </div>
            <div className="ba-visual-number">•••• •••• {String(saved.accountNumber || "").slice(-4)}</div>
            <div className="ba-visual-bottom">
              <div>
                <span className="ba-visual-label">Account holder</span>
                <span className="ba-visual-value">{saved.accountHolderName}</span>
              </div>
              <div className="ba-visual-right">
                <span className="ba-visual-label">IFSC</span>
                <span className="ba-visual-value">{saved.ifscCode}</span>
              </div>
            </div>
          </div>

          <div className="ba-card">
            <div className="ba-grid">
              <div className="ba-item"><span className="ba-label">Account Holder Name</span><span className="ba-value">{saved.accountHolderName}</span></div>
              <div className="ba-item"><span className="ba-label">Account Number</span><span className="ba-value ba-masked">{saved.accountNumber}</span></div>
              <div className="ba-item"><span className="ba-label">IFSC Code</span><span className="ba-value">{saved.ifscCode}</span></div>
              <div className="ba-item"><span className="ba-label">Bank Name</span><span className="ba-value">{saved.bankName}</span></div>
              {saved.branchName && (
                <div className="ba-item"><span className="ba-label">Branch</span><span className="ba-value">{saved.branchName}</span></div>
              )}
              {/* A record saved before UPI VPA became required can still have an empty value;
                  that no longer blocks payment QRs (they come from Razorpay), so it is just "Not set". */}
              <div className="ba-item ba-item-wide"><span className="ba-label">UPI VPA</span><span className="ba-value">{saved.upiVpa || "Not set"}</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="ba-empty">No bank account on file yet.</div>
      )}

      {editModal.shouldRender && (
        <div className={`modal-overlay ${editModal.overlayClass}`}>
          <form
            className={`admin-modal ${editModal.modalClass}`}
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <div className="admin-modal-header">
              <h3>{saved ? "Edit Bank Account" : "Add Bank Account"}</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close"
                onClick={cancelEdit}><img alt="" src={closeIcon} /></Button3D>
            </div>
            <div className="admin-modal-body">
          <div className="admin-form-group">
            <div className="mat">
              <input
                className={`mat-input${formErrors.accountHolderName ? " mat-error" : ""}`}
                placeholder=" "
                autoFocus
                type="text"
                value={form.accountHolderName}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    accountHolderName: allowTextInput(p.accountHolderName, e.target.value, 100, 5),
                  }))
                }
              />
              <label className={`mat-label${formErrors.accountHolderName ? " mat-label-error" : ""}`}>
                Account Holder Name<span className="rf-req">*</span>
              </label>
              <span className={`mat-bar${formErrors.accountHolderName ? " mat-bar-error" : ""}`} />
            </div>
            {formErrors.accountHolderName && <div className="field-error-msg">Account holder name is required</div>}
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className={`mat-input${formErrors.accountNumber ? " mat-error" : ""}`}
                placeholder=" "
                type="text"
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 18);
                  setForm((p) => ({ ...p, accountNumber: digits }));
                }}
              />
              <label className={`mat-label${formErrors.accountNumber ? " mat-label-error" : ""}`}>
                Account Number<span className="rf-req">*</span>
              </label>
              <span className={`mat-bar${formErrors.accountNumber ? " mat-bar-error" : ""}`} />
            </div>
            {formErrors.accountNumber && <div className="field-error-msg">Enter a valid account number (9–18 digits)</div>}
          </div>

          <div className="horizontal-form-group">
            <div className="admin-form-group">
              <div className="mat">
                <input
                  className={`mat-input${formErrors.ifscCode ? " mat-error" : ""}`}
                  placeholder=" "
                  type="text"
                  value={form.ifscCode}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ifscCode: e.target.value.toUpperCase().slice(0, 11) }))
                  }
                />
                <label className={`mat-label${formErrors.ifscCode ? " mat-label-error" : ""}`}>
                  IFSC Code<span className="rf-req">*</span>
                </label>
                <span className={`mat-bar${formErrors.ifscCode ? " mat-bar-error" : ""}`} />
              </div>
              {formErrors.ifscCode && <div className="field-error-msg">Enter a valid IFSC code (e.g. HDFC0001234)</div>}
            </div>

            <div className="admin-form-group">
              <div className="mat">
                <input
                  className={`mat-input${formErrors.bankName ? " mat-error" : ""}`}
                  placeholder=" "
                  type="text"
                  value={form.bankName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, bankName: allowTextInput(p.bankName, e.target.value, 100, 5) }))
                  }
                />
                <label className={`mat-label${formErrors.bankName ? " mat-label-error" : ""}`}>
                  Bank Name<span className="rf-req">*</span>
                </label>
                <span className={`mat-bar${formErrors.bankName ? " mat-bar-error" : ""}`} />
              </div>
              {formErrors.bankName && <div className="field-error-msg">Bank name is required</div>}
            </div>
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className="mat-input"
                placeholder=" "
                type="text"
                value={form.branchName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, branchName: toTitleCase(allowTextInput(p.branchName, e.target.value, 100, 5)) }))
                }
              />
              <label className="mat-label">Branch Name</label>
              <span className="mat-bar" />
            </div>
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className={`mat-input${formErrors.upiVpa ? " mat-error" : ""}`}
                placeholder=" "
                type="text"
                value={form.upiVpa}
                onChange={(e) => setForm((p) => ({ ...p, upiVpa: allowTextInput(p.upiVpa, e.target.value.trim(), 100, 5) }))}
              />
              <label className={`mat-label${formErrors.upiVpa ? " mat-label-error" : ""}`}>
                UPI VPA<span className="rf-req">*</span>
              </label>
              <span className={`mat-bar${formErrors.upiVpa ? " mat-bar-error" : ""}`} />
            </div>
            {formErrors.upiVpa && <div className="field-error-msg">Enter a valid UPI ID (e.g. yourname@okhdfcbank)</div>}
            <div className="field-hint">
              For reference and bank transfers. Order payment QRs are generated via Razorpay, not this UPI ID directly.
            </div>
          </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={cancelEdit}>Cancel</Button3D>
              <Button3D type="submit" disabled={saving}>{saving ? "Saving…" : "Save Bank Account"}</Button3D>
            </div>
          </form>
        </div>
      )}
      <PaymentGatewaySettings />
    </div>
  );
};

export default BankAccount;
