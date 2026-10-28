// Calls the Dishky API's /superadmin routes. The session lives in an httpOnly
// cookie set by the API; this app never sees or stores a token.
const ORIGIN = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
const BASE = ORIGIN ? `${ORIGIN}/superadmin` : "/api/superadmin";

export class ApiError extends Error {
  constructor(message, status, code, tickets) {
    super(message);
    this.status = status;
    this.code = code;
    this.tickets = tickets;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

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
    // A 401 on anything except the sign-in call itself means the session ended.
    if (res.status === 401 && path !== "/auth/login") onUnauthorized();
    throw new ApiError(data?.message || "Request failed.", res.status, data?.code, data?.tickets);
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
export const updateProfile = (body) => request("/auth/me", { method: "PATCH", body });
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/change-password", { method: "PATCH", body: { currentPassword, newPassword } });

export const overview = () => request("/overview");
export const restaurants = (params) => request(`/restaurants${qs(params)}`);
export const restaurant = (id) => request(`/restaurants/${encodeURIComponent(id)}`);
export const clients = (params) => request(`/clients${qs(params)}`);
export const refreshStorage = () => request("/storage/refresh", { method: "POST" });
export const exportCsv = (params) => request(`/export/restaurants.csv${qs(params)}`, { raw: true });

// ── Developer Support & Ticket Management ──
const S = "/support";
const enc = encodeURIComponent;
export const supportDashboard = () => request(`${S}/dashboard`);
export const supportRestaurants = () => request(`${S}/restaurants`);
export const createTicketFor = (body) => request(`${S}/tickets`, { method: "POST", body });
export const ticketApi = {
  meta: () => request(`${S}/meta`),
  tickets: (params) => request(`${S}/tickets${qs(params)}`),
  ticket: (id) => request(`${S}/tickets/${enc(id)}`),
  action: (id, action, body) => request(`${S}/tickets/${enc(id)}/action`, { method: "POST", body: { action, ...body } }),
  comment: (id, c) => request(`${S}/tickets/${enc(id)}/comments`, { method: "POST", body: c }),
  attach: (id, attachments, internal) => request(`${S}/tickets/${enc(id)}/attachments`, { method: "POST", body: { attachments, internal } }),
  download: (id, attId) => request(`${S}/tickets/${enc(id)}/attachments/${enc(attId)}`, { raw: true }),
  assignable: (kind) => request(`${S}/staff/assignable${qs({ kind })}`),
  notifications: () => request(`${S}/notifications`),
  markRead: (ids) => request(`${S}/notifications/read`, { method: "POST", body: { ids } }),
};

// Dishky staff directory + role permissions
export const staffList = (params) => request(`${S}/staff${qs(params)}`);
export const staffDetail = (id) => request(`${S}/staff/${enc(id)}`);
export const staffCreate = (body) => request(`${S}/staff`, { method: "POST", body });
export const staffUpdate = (id, body) => request(`${S}/staff/${enc(id)}`, { method: "PATCH", body });
export const staffDeactivate = (id, body) => request(`${S}/staff/${enc(id)}/deactivate`, { method: "POST", body });
export const staffReactivate = (id) => request(`${S}/staff/${enc(id)}/reactivate`, { method: "POST" });
export const staffResendInvite = (id) => request(`${S}/staff/${enc(id)}/resend-invite`, { method: "POST" });
export const staffRoles = () => request(`${S}/staff/roles`);
export const staffRolesSave = (body) => request(`${S}/staff/roles`, { method: "PUT", body });
export const staffRolesReset = () => request(`${S}/staff/roles/reset`, { method: "POST" });
