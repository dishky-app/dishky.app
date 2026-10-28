// All calls go to the Dishky platform API (the `/platform` router of the main
// backend).
//
//  - Production: set VITE_API_ORIGIN to the API's origin (e.g. https://api.dishky.com).
//    The owner session cookie is then set by the API itself; api.dishky.com and
//    www.dishky.com are the same site, so browsers never treat it as third-party.
//  - Development: leave it empty; Vite proxies /api -> http://localhost:4000
//    (see vite.config.js).
//
// Set VITE_API_ORIGIN=off to run the marketing pages with no backend at all:
// forms and pricing use their built-in fallbacks.
const ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";
const API_ENABLED = ORIGIN !== "off";
const API_URL = ORIGIN && ORIGIN !== "off" ? `${ORIGIN.replace(/\/$/, "")}/platform` : "/api/platform";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body || null;
  }
}

async function request(path, { method = "GET", body } = {}) {
  if (!API_ENABLED) throw new ApiError("API is disabled (VITE_API_ORIGIN=off).", 0);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        // Required by the backend's CSRF defence on cookie-authenticated writes.
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach Dishky right now. Check your connection and try again.", 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || "Something went wrong. Please try again.", res.status, data);
  }
  return data;
}

/* ───────── public ───────── */

// Pricing appears on the homepage AND the pricing page; share one request per page load.
// Plan names were renamed (Starter/Sizzle/Pro/Banquet -> Essential/Professional/Premium/Custom). A server
// that hasn't been restarted with the new names yet would still send the old ones, so they are mapped here too.
const PLAN_RENAMES = [[/\bStarter\b/g, "Essential"], [/\bSizzle\b/g, "Professional"], [/\bPro\b/g, "Premium"], [/\bBanquet\b/g, "Custom"]];
const renameText = (t) => (typeof t === "string" ? PLAN_RENAMES.reduce((acc, [re, to]) => acc.replace(re, to), t) : t);
const renamePlan = (pl) => (pl && typeof pl === "object"
  ? { ...pl, name: renameText(pl.name), ctaLabel: renameText(pl.ctaLabel), tagline: renameText(pl.tagline), features: Array.isArray(pl.features) ? pl.features.map(renameText) : pl.features }
  : pl);

let plansRequest = null;
export const getPlans = () => {
  if (!plansRequest) plansRequest = request("/plans").then((res) => (Array.isArray(res?.data) ? { ...res, data: res.data.map(renamePlan) } : res));
  return plansRequest;
};

export const submitDemoRequest = (payload) => request("/demo", { method: "POST", body: payload });
export const submitContact = (payload) => request("/contact", { method: "POST", body: payload });
export const subscribeNewsletter = (email) => request("/newsletter", { method: "POST", body: { email } });

export const checkSlug = (name) => request(`/slug-check?name=${encodeURIComponent(name)}`);

/* ───────── owner account ───────── */

export const signup = (payload) => request("/auth/signup", { method: "POST", body: payload });
export const login = (email, password) => request("/auth/login", { method: "POST", body: { email, password } });
export const logout = () => request("/auth/logout", { method: "POST" });
export const getMe = () => request("/auth/me");
export const updateMe = (payload) => request("/auth/me", { method: "PATCH", body: payload });
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/change-password", { method: "PATCH", body: { currentPassword, newPassword } });
export const forgotPassword = (email) => request("/auth/forgot-password", { method: "POST", body: { email } });
export const resetPassword = (token, newPassword) =>
  request("/auth/reset-password", { method: "POST", body: { token, newPassword } });

/* ───────── restaurants & billing ───────── */

export const listRestaurants = () => request("/restaurants");
export const createRestaurant = (payload) => request("/restaurants", { method: "POST", body: payload });
export const updateRestaurant = (id, payload) => request(`/restaurants/${id}`, { method: "PATCH", body: payload });
export const getDashboardLink = (id) => request(`/restaurants/${id}/dashboard-link`, { method: "POST" });

export const getBilling = (id) =>
  request(`/restaurants/${id}/billing`).then((res) =>
    res?.data?.plans ? { ...res, data: { ...res.data, plans: res.data.plans.map(renamePlan) } } : res
  );
export const startCheckout = (id, planKey, billingCycle) =>
  request(`/restaurants/${id}/billing/checkout`, { method: "POST", body: { planKey, billingCycle } });
export const confirmCheckout = (id, providerSubscriptionId, payload) =>
  request(`/restaurants/${id}/billing/confirm`, { method: "POST", body: { providerSubscriptionId, payload } });
export const cancelSubscription = (id) => request(`/restaurants/${id}/billing/cancel`, { method: "POST" });
export const resumeSubscription = (id) => request(`/restaurants/${id}/billing/resume`, { method: "POST" });
export const cancelPendingChange = (id) => request(`/restaurants/${id}/billing/pending-change`, { method: "DELETE" });
