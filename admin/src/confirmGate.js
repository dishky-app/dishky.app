// confirmGate.js — shared state for the global "are you sure?" prompt (no imports, so api.js and the UI can both use it).
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

const DELETE_SKIP = ["/staff-auth/logout", "/chat", "/read", "Activity", "/tablePreferences", "/theme", "bill-printed", "/memos/", "/todos"];
// Workflow steps and stock changes that alter money, stock or access. Reject / cancel already ask for a reason elsewhere.
const SENSITIVE = [
  { re: /\/(permissions|roles)(\/|$)/i, methods: ["put", "patch", "post"], title: "Change access permissions?", message: "This changes what staff in this role can see and do." },
  { re: /salary/i, methods: ["put", "patch", "post"], title: "Update salary details?", message: "Salary records affect payroll. Please confirm the change." },
  { re: /\/staff-auth\/(admins\/[^/]+\/(reset|password)|reset-password|force-reset)/i, methods: ["put", "patch", "post"], title: "Reset this password?", message: "The person will be asked to set a new password at next sign in." },
  { re: /\/(purchase|receiving|finance|inventory|automation|closing)\/.*\/(approve|post|dispatch|credit|reopen|short-close)$/i, methods: ["post"], title: "Confirm this action?", message: "This updates stock, orders or payments and may not be reversible." },
  { re: /\/inventory\/stock\/(adjust|waste|opening|status)/i, methods: ["post", "put", "patch"], title: "Change stock?", message: "This posts a stock movement to the ledger." },
];

/** { title, message, confirmLabel } when this request needs the person to confirm first, otherwise null. */
export function confirmInfoFor(config) {
  if (!config || config.confirmed === true || config.silent) return null;
  const method = (config.method || "").toLowerCase();
  const url = String(config.url || "");
  if (method === "delete") {
    if (DELETE_SKIP.some((p) => url.includes(p))) return null;
    return { title: "Delete this?", message: "This will permanently delete it and cannot be undone.", confirmLabel: "Delete" };
  }
  for (const s of SENSITIVE) if (s.methods.includes(method) && s.re.test(url)) return { title: s.title, message: s.message, confirmLabel: "Confirm" };
  return null;
}
