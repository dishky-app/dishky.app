import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import "./Toast.css";

/**
 * Dishky toast. One store, usable anywhere:
 *   import { toast } from "../components/Toast/Toast.js";   toast.success("Saved")
 *   const { toast } = useToast();                           (same object, for components)
 * Durations: number (ms), "short" 5s (default) | "medium" 10s | "long" 30s | "permanent".
 * toast.confirm(message, opts) -> Promise<boolean> replaces window.confirm.
 * Modelled on the admin panel's useToast API.
 */
export const TOAST_DURATIONS = { short: 5000, medium: 10000, long: 30000, permanent: Infinity };
const resolve = (d, fallback) =>
  d == null ? fallback : typeof d === "string" ? TOAST_DURATIONS[d] ?? fallback : Number.isFinite(d) ? d : fallback;

let list = [];
let confirmState = null;
let seq = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

const dismiss = (id) => {
  list = list.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => {
    list = list.filter((t) => t.id !== id);
    emit();
  }, 260);
};

const push = (type, message, duration) => {
  if (!message) return;
  const text = String(message);
  if (list.some((t) => t.message === text && t.type === type && !t.leaving)) return; // no duplicates stacking
  const id = ++seq;
  const ms = resolve(duration, type === "error" ? 7000 : TOAST_DURATIONS.short);
  list = [...list, { id, type, message: text, ms }].slice(-4);
  emit();
  if (Number.isFinite(ms)) setTimeout(() => dismiss(id), ms);
};

export const toast = {
  success: (m, d) => push("success", m, d),
  error: (m, d) => push("error", m, d),
  warning: (m, d) => push("warning", m, d),
  info: (m, d) => push("info", m, d),
  confirm: (message, opts = {}) =>
    new Promise((res) => {
      confirmState = { message, ...opts, res };
      emit();
    }),
};

const ICON = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info };

function Item({ t }) {
  const Icon = ICON[t.type] || Info;
  return (
    <div role={t.type === "error" ? "alert" : "status"} className={`dk-toast dk-toast--${t.type} ${t.leaving ? "is-leaving" : ""}`}>
      <Icon size={20} className="dk-toast__icon" aria-hidden="true" />
      <p className="dk-toast__msg">{t.message}</p>
      <button type="button" aria-label="Dismiss" className="dk-toast__x" onClick={() => dismiss(t.id)}>
        <X size={16} />
      </button>
      {Number.isFinite(t.ms) && <span className="dk-toast__bar" style={{ animationDuration: `${t.ms}ms` }} />}
    </div>
  );
}

function ConfirmModal({ c }) {
  const close = (v) => {
    confirmState = null;
    emit();
    c.res(v);
  };
  return (
    <div className="dk-confirm" onClick={() => close(false)}>
      <div className="dk-confirm__card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h4>{c.title || "Are you sure?"}</h4>
        <p>{c.message}</p>
        <div className="dk-confirm__row">
          <button type="button" className="btn-secondary !min-h-[44px]" onClick={() => close(false)}>{c.cancelLabel || "Cancel"}</button>
          <button type="button" className="btn-primary !min-h-[44px]" autoFocus onClick={() => close(true)}>{c.confirmLabel || "Yes, continue"}</button>
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return (
    <>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="dk-toasts" aria-label="Notifications">
              {list.map((t) => <Item key={t.id} t={t} />)}
            </div>
            {confirmState && <ConfirmModal c={confirmState} />}
          </>,
          document.body
        )}
    </>
  );
}

export const useToast = () => ({ toast });

/** Convenience: toast the first validation message and focus the first failing field. */
export function useFieldToast() {
  return useCallback((first, fieldIds = []) => {
    toast.error(first);
    const el = fieldIds.length && document.getElementById(fieldIds[0]);
    if (el && el.focus) el.focus({ preventScroll: false });
  }, []);
}

export default useToast;
