import React, { useState } from "react";
import * as api from "../api.js";
import { useAuth } from "../auth.js";
import Button3D from "../components/Button3D.js";
import AuthPasswordField from "../components/AuthPasswordField.js";
import { Collapsible, ErrorNote, PageHeader, useCollapse } from "../components.js";
import { useToast } from "../useToast.js";
import MediaPicker from "../components/MediaPicker.js";
import Modal, { Field } from "../tickets/Modal.js";
import { fileToAvatar } from "../imageUtils.js";
import { toTitleCase, digitsOnly10, isValidMobile, MOBILE_ERROR } from "../formUtils.js";

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// 0-4 score used by the strength meter (length + character variety).
function strengthOf(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.max(1, score);
}
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function EditProfileModal({ initial, onClose, onSaved }) {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [photo, setPhoto] = useState(initial.photo || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const letter = (name || "?").trim().charAt(0).toUpperCase();

  const save = async () => {
    if (name.trim().length < 2) { toast.error("Enter your full name (at least 2 characters)."); return; }
    if (phone && !isValidMobile(phone)) { toast.error(MOBILE_ERROR); return; }
    setBusy(true); setError("");
    try { await updateProfile({ name: name.trim(), phone: phone.trim(), photo: photo }); onSaved(); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Modal title="Edit profile" onClose={onClose} onSubmit={save} submitLabel="Save changes" busy={busy}>
      <div className="ac-edit-photo">
        <div className="ac-avatar">{photo ? <img src={photo} alt="" /> : letter}</div>
        <div className="ac-edit-photo-actions">
          <MediaPicker
            label={photo ? "Change picture" : "Upload picture"} accept="image/png,image/jpeg,image/webp"
            onPick={async ([f]) => { try { setPhoto(await fileToAvatar(f)); setError(""); } catch (e) { setError(e.message); } }}
          />
          {photo && <button type="button" className="details-link clickable" onClick={() => setPhoto("")}>Remove picture</button>}
        </div>
      </div>
      <Field label="Full name" required><input value={name} onChange={(e) => setName(toTitleCase(e.target.value))} maxLength={80} autoComplete="name" /></Field>
      <Field label="Phone"><input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(digitsOnly10(e.target.value))} maxLength={10} placeholder="10-digit mobile number" autoComplete="tel" /></Field>
      <ErrorNote error={error} />
    </Modal>
  );
}

export default function Settings() {
  const { admin, signOut } = useAuth();
  const { toast } = useToast();
  const logout = () => toast.confirm("You will need to sign in again to continue.", () => signOut(), undefined, { title: "Log out?", confirmLabel: "Log out" });
  const [collapsed, toggleCollapsed] = useCollapse();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setDone(false);
    if (!cur) { toast.error("Enter your current password."); return; }
    if (next.length < 12) { toast.error("The new password must be at least 12 characters."); return; }
    if (next !== again) { toast.error("The new passwords don't match."); return; }
    setBusy(true);
    try {
      await api.changePassword(cur, next);
      setCur(""); setNext(""); setAgain("");
      setDone(true);
      toast.success("Password updated. Other devices were signed out.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const score = strengthOf(next);
  const initial = (admin.name || admin.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="inner-page">
      <PageHeader title="My Profile" subtitle={`Signed in as ${admin.name} (${admin.email})`} collapsed={collapsed} onToggle={toggleCollapsed} collapseLabel="details" />
      <Collapsible collapsed={collapsed}>
      <div className="ac-grid">
        <aside className="ac-card ac-profile">
          <div className="ac-avatar" aria-hidden="true">{admin.photo ? <img src={admin.photo} alt="" /> : initial}</div>
          <h3 className="ac-name">{admin.name}</h3>
          <p className="ac-email">{admin.email}</p>
          <span className="ac-role">Super Admin</span>
          <dl className="ac-meta">
            <div className="ac-meta-row"><dt>Phone</dt><dd>{admin.phone || "—"}</dd></div>
          </dl>
          <div className="ac-profile-actions">
            <Button3D onClick={() => setEditing(true)}>Edit profile</Button3D>
            <Button3D variant="danger" onClick={logout}>Log out</Button3D>
          </div>
        </aside>

        <section className="ac-card tk-form">
          <div className="ac-section-head">
            <span className="ac-section-icon"><LockIcon /></span>
            <div>
              <h4>Change password</h4>
              <p>Use a strong, unique password. Other devices are signed out after you change it.</p>
            </div>
          </div>
          <form onSubmit={submit} className="ac-form">
            <div className="admin-form-group form-group"><AuthPasswordField id="pw-cur" label="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></div>
            <div className="admin-form-group form-group"><AuthPasswordField id="pw-new" label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></div>
            <div className="admin-form-group form-group"><AuthPasswordField id="pw-again" label="Repeat new password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></div>
            {next && (
              <div className="ac-strength" aria-live="polite">
                <div className="ac-strength-track">
                  {[1, 2, 3, 4].map((n) => <span key={n} className={score >= n ? `on-${score}` : ""} />)}
                </div>
                <span className="ac-strength-label">Strength: {STRENGTH_LABELS[score]}</span>
              </div>
            )}
            <ul className="ac-rules">
              <li className={next.length >= 12 ? "ok" : ""}>At least 12 characters</li>
              <li className={again && next === again ? "ok" : ""}>Both new passwords match</li>
            </ul>
            <ErrorNote error={error} />
            <div className="ac-actions">
              <Button3D type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button3D>
            </div>
          </form>
        </section>
      </div>
      </Collapsible>
      {editing && <EditProfileModal initial={admin} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast.success("Profile updated."); }} />}
    </div>
  );
}
