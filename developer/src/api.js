// Calls the Dishky API's /dev routes. The session lives in an httpOnly cookie set by the API;
// this app never sees or stores a token or password.
const ORIGIN = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
const BASE = ORIGIN ? `${ORIGIN}/dev` : "/api/dev";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const PUBLIC_PATHS = ["/auth/login", "/auth/forgot-password", "/auth/reset-password", "/auth/reset-password/validate"];

// ---- Save / error toasts -----------------------------------------------
// Every create / edit / delete reports its outcome here once; ToastProvider
// (useToast.js) listens and shows a success or error toast, skipping it when
// the page already showed its own.
const resultListeners = new Set();
export function onApiResult(listener) {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
}
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Calls whose outcome the page already explains itself (sign-in, reset flows, read receipts).
const SILENT_PATHS = ["/auth/login", "/auth/logout", "/auth/forgot-password", "/auth/reset-password", "/notifications/read", "/chat"];

async function request(path, opts = {}) {
  const method = String(opts.method || "GET").toUpperCase();
  const tracked = WRITE_METHODS.has(method) && !opts.raw && !SILENT_PATHS.some((x) => path.includes(x));
  try {
    const out = await rawRequest(path, opts);
    if (tracked) {
      resultListeners.forEach((l) => l({
        ok: true, method,
        message: method === "POST" ? "Created successfully" : method === "DELETE" ? "Deleted successfully" : "Saved successfully",
      }));
    }
    return out;
  } catch (err) {
    if (tracked && err && err.status !== 401) {
      resultListeners.forEach((l) => l({
        ok: false, method,
        message: err.message || (method === "DELETE" ? "Couldn't delete. Please try again." : "Couldn't save. Please try again."),
      }));
    }
    throw err;
  }
}

async function rawRequest(path, { method = "GET", body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the Dishky API.", 0);
  }
  if (raw && res.ok) return res.blob();
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    if (res.status === 401 && !PUBLIC_PATHS.some((p) => path.startsWith(p)) && path !== "/auth/me") onUnauthorized();
    throw new ApiError(data?.message || "Request failed.", res.status, data?.code);
  }
  return data?.data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const login = (email, password) => request("/auth/login", { method: "POST", body: { email, password } });
export const logout = () => request("/auth/logout", { method: "POST" });
export const me = () => request("/auth/me");
export const forgotPassword = (email) => request("/auth/forgot-password", { method: "POST", body: { email } });
export const validateResetToken = (token) => request(`/auth/reset-password/validate${qs({ token })}`);
export const resetPassword = (token, password, confirmPassword) =>
  request("/auth/reset-password", { method: "POST", body: { token, password, confirmPassword } });
export const updateProfile = (body) => request("/auth/me", { method: "PATCH", body });
export const changePassword = (currentPassword, newPassword, confirmPassword) =>
  request("/auth/change-password", { method: "PATCH", body: { currentPassword, newPassword, confirmPassword } });

export const dashboard = (params) => request(`/dashboard${qs(params)}`);

// Ticket API used by the shared ticket components (src/tickets/*).
export const ticketApi = {
  meta: () => request("/meta"),
  tickets: (params) => request(`/tickets${qs(params)}`),
  ticket: (id) => request(`/tickets/${encodeURIComponent(id)}`),
  action: (id, action, body) => request(`/tickets/${encodeURIComponent(id)}/action`, { method: "POST", body: { action, ...body } }),
  comment: (id, c) => request(`/tickets/${encodeURIComponent(id)}/comments`, { method: "POST", body: c }),
  attach: (id, attachments, internal) => request(`/tickets/${encodeURIComponent(id)}/attachments`, { method: "POST", body: { attachments, internal } }),
  download: (id, attId) => request(`/tickets/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attId)}`, { raw: true }),
  assignable: (kind) => request(`/staff/assignable${qs({ kind })}`),
  notifications: () => request("/notifications"),
  markRead: (ids) => request("/notifications/read", { method: "POST", body: { ids } }),
};
