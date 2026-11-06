// confirmGate.js - shared state for the global "are you sure?" prompt (no imports, so api.js and the UI can both use it).
let handler = null;          // set by <GlobalConfirm/>: (info) => Promise<boolean>
let lastConfirmClickAt = 0;  // the person just pressed Confirm / Yes in some confirmation dialog
let lastCancelAt = 0;        // the person just declined a global prompt

export const setConfirmHandler = (fn) => { handler = fn; };
export const getConfirmHandler = () => handler;
export const markConfirmClick = () => { lastConfirmClickAt = Date.now(); };
export const recentlyConfirmed = (ms = 15000) => Date.now() - lastConfirmClickAt < ms;
export const markCancelled = () => { lastCancelAt = Date.now(); };
/** Pages show "Couldn't delete" when a request is refused; after the person said No that message would be wrong. */
export const justCancelled = (ms = 1500) => Date.now() - lastCancelAt < ms;

// Changes that alter access, accounts or money. Every DELETE is confirmed as well.
const SENSITIVE = [
  { re: /\/change-password$/i, methods: ["patch", "post", "put"], title: "Change your password?", message: "You will use the new password the next time you sign in." },
];

/** { title, message, confirmLabel } when this request needs the person to confirm first, otherwise null. */
export function confirmInfoFor(config) {
  if (!config || config.confirmed === true || config.silent) return null;
  const { method, url } = config;
  const m = String(method || "GET").toLowerCase();
  const u = String(url || "");
  if (m === "delete") return { title: "Delete this?", message: "This will permanently delete it and cannot be undone.", confirmLabel: "Delete" };
  for (const s of SENSITIVE) if (s.methods.includes(m) && s.re.test(u)) return { title: s.title, message: s.message, confirmLabel: "Confirm" };
  return null;
}
