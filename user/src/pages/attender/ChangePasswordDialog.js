import { useState } from "react";
import api from "../../api";
import { useToast } from "../../components/Usetoast";
import ModalTransition from "../shared/ModalTransition";
import MatField from "../shared/MatField";
import Button3D from "../shared/Button3D";

/**
 * ChangePasswordDialog — a signed-in attender changes their own password.
 * Accounts are created by the restaurant, so this is the only credential the attender manages themselves.
 */
const ChangePasswordDialog = ({ open, onClose }) => {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const close = () => { setCurrent(""); setNext(""); setConfirm(""); setErrors({}); onClose(); };

  const submit = async () => {
    const e = {};
    if (!current) e.current = "Enter your current password.";
    if (next.length < 6) e.next = "Password must be at least 6 characters.";
    else if (next === current) e.next = "Choose a different password.";
    if (confirm !== next) e.confirm = "Passwords don't match.";
    if (Object.keys(e).length) return setErrors(e);
    try {
      setLoading(true);
      await api.post("/attender-auth/change-password", { currentPassword: current, newPassword: next });
      toast.success("Password changed");
      close();
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't change the password. Please try again.";
      if (err.response?.status === 401) setErrors({ current: msg });
      else setErrors({ next: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalTransition open={open} onClose={close} overlayClassName="att-sheet-overlay" panelClassName="att-sheet" panelProps={{ onClick: (e) => e.stopPropagation() }}>
      <button type="button" className="att-sheet-close" onClick={close} aria-label="Close">✕</button>
      <div className="att-panel-name" style={{ marginBottom: 12 }}>Change password</div>
      <MatField label="Current Password" type="password" autoComplete="current-password" maxLength={72} value={current} onChange={(e) => { setCurrent(e.target.value); setErrors((p) => ({ ...p, current: "" })); }} error={errors.current} wrapperClassName="" />
      <MatField label="New Password" type="password" autoComplete="new-password" maxLength={72} value={next} onChange={(e) => { setNext(e.target.value); setErrors((p) => ({ ...p, next: "" })); }} error={errors.next} wrapperClassName="" />
      <MatField label="Confirm New Password" type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: "" })); }} onKeyDown={(e) => e.key === "Enter" && submit()} error={errors.confirm} wrapperClassName="" />
      <Button3D className="btn-3d red at-auth-btn" onClick={submit} disabled={loading}>Change password</Button3D>
    </ModalTransition>
  );
};

export default ChangePasswordDialog;
