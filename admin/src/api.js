import axios from "axios";
import { getVenueIdForRequest } from "./venueStore";
import { getRestaurant } from "./tenant";

// In production, calls go through the /api/* rewrite defined in
// vercel.json, which proxies to the Render backend server-side. This
// makes every request same-origin from the browser's point of view
// (still dishky-dashboard.vercel.app), so the session cookie is
// never treated as third-party — avoiding Chrome's third-party cookie
// blocking (and Safari's ITP) entirely, regardless of the visitor's
// browser settings. Locally, Vercel's rewrite doesn't exist, so dev
// still talks directly to localhost:4000 as before.
const baseURL =
  import.meta.env.PROD
    ? "/api"
    : import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const api = axios.create({
  baseURL,
  // withCredentials is still required: even same-origin-from-the-browser's-
  // view requests need this for the httpOnly cookie to be included, and it's
  // a harmless no-op difference locally where the cookie is same-site anyway.
  withCredentials: true,
  // Required by the backend's CSRF defense (see server.js): the session
  // cookie is SameSite=None in production (needed because the backend
  // can't tell which frontend/origin is calling), which offers no CSRF
  // protection by itself. A plain HTML form has no way to add a custom
  // header, so requiring one blocks the classic CSRF vector while
  // costing nothing here — axios sends it on every request automatically.
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

// Dozens of pages call api.post/put/patch (directly, or via the
// createRecord/updateRecord helpers in crudUtils.js) without building a
// venueId param themselves. The backend requires Super Admin to specify
// which branch a write belongs to — without this, every one of those
// calls 400s the moment Super Admin has a specific branch selected (or
// succeeds "by accident" against the wrong branch if the backend ever
// defaulted instead of rejecting). Injecting it here, once, covers every
// write call in the app automatically instead of requiring each page to
// remember venueParam() by hand.
//
// Only applied to write methods — GET requests already build their own
// venueId param explicitly per-page via venueParam() where relevant, and
// leaving GET alone avoids surprising a page that intentionally omits it.
// Only applied when the caller hasn't already set venueId themselves
// (either in params or in the request body) — an explicit value always
// wins over this automatic one.
const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

// Every request names its restaurant. The server cross-checks this against the
// signed-in session (a mismatch is rejected), so it can't be used to reach
// another restaurant's data.
api.interceptors.request.use((config) => {
  const restaurant = getRestaurant();
  if (restaurant) config.headers["X-Restaurant"] = restaurant;
  return config;
});

api.interceptors.request.use((config) => {
  const method = (config.method || "").toLowerCase();
  if (!WRITE_METHODS.has(method)) return config;

  const venueId = getVenueIdForRequest();
  if (!venueId) return config;

  const alreadyInParams = config.params && config.params.venueId;
  const alreadyInBody =
    config.data && typeof config.data === "object" && !Array.isArray(config.data) && config.data.venueId;
  if (alreadyInParams || alreadyInBody) return config;

  config.params = { ...(config.params || {}), venueId };
  return config;
});

// ---- Session-expiry handling -------------------------------------------
// AuthContext only confirms the session once, on mount (GET /staff-auth/me).
// If the httpOnly session cookie expires or is invalidated later — mid-
// session, after an idle period, or after a backend restart — nothing
// previously reacted to that: `admin` stayed set in React state, so every
// page kept rendering as if logged in while every single API call quietly
// 401'd in the background (flooding the console, leaving pages blank/broken
// with zero explanation to the person using it).
//
// This lets AuthContext register a callback (once, when it mounts) that
// runs whenever ANY request — from any page, any component — comes back
// 401. A plain subscriber list avoids api.js importing from AuthContext
// (which would create a circular import, since AuthContext imports api).
const sessionExpiredListeners = new Set();
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// The login/logout/me/my-permissions endpoints are all part of the
// auth flow's own request sequence (my-permissions fires immediately
// after a successful login, as part of loadPermissionsFor) and already
// handle their own errors locally — treating a 401 from any of them as
// a "session expired, log out" event was actually undoing a login that
// had just succeeded, if that follow-up permissions call landed before
// the browser had fully committed the new session cookie. None of
// these should trigger the global session-expiry handling.
const AUTH_ENDPOINTS = [
  "/staff-auth/sso",
  "/staff-auth/subscription",
  "/staff-auth/login",
  "/staff-auth/logout",
  "/staff-auth/me",
  "/staff-auth/my-permissions",
];

// Extra safety net on top of the endpoint exclusion above: for a brief
// window right after any successful login or session confirmation,
// ignore 401s entirely. A cookie set by the login response isn't
// guaranteed to be attached to a request that fires immediately after
// in every browser/timing scenario — without this grace period, that
// kind of transient race could still look identical to a genuinely
// expired session and boot the person right back to the login screen
// seconds after they successfully logged in.
let authConfirmedAt = 0;
export function markAuthConfirmed() {
  authConfirmedAt = Date.now();
  recentFailureTimestamps.length = 0;
}
const AUTH_GRACE_PERIOD_MS = 8000;

// A single 401 among a large parallel batch (fetchAllData hits ~29
// endpoints via Promise.allSettled) isn't a trustworthy signal on its
// own — a role-specific quirk, a backend hiccup on one particular
// route, or any other one-off issue on a single endpoint would
// otherwise look identical to "the whole session just died" and log
// someone out over a problem confined to one page's data. Only treat
// this as a real expired-session event once several 401s land within
// a short window — a pattern across the app, not one unlucky request.
const recentFailureTimestamps = [];
const FAILURE_WINDOW_MS = 5000;
const FAILURE_THRESHOLD = 3;

// Subscription / plan problems reported by the server (HTTP 402) are
// broadcast so one banner can explain them, instead of every page showing a
// bare "request failed". Codes: PLAN_LIMIT, PLAN_UPGRADE_REQUIRED,
// SUBSCRIPTION_INACTIVE. 403 ACCOUNT_BLOCKED means the subscription ended.
const subscriptionListeners = new Set();
export function onSubscriptionProblem(listener) {
  subscriptionListeners.add(listener);
  return () => subscriptionListeners.delete(listener);
}

// ---- Save / error toasts -----------------------------------------------
// Every create / edit / delete (from any form or details page) reports its
// outcome here once; ToastProvider listens and shows a success or error toast
// (skipping it when the page already showed its own). A call can opt out with
// `api.post(url, body, { silent: true })`.
const resultListeners = new Set();
export function onApiResult(listener) {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
}
const SILENT_URLS = [
  "/staff-auth/login", "/staff-auth/logout", "/staff-auth/me", "/staff-auth/sso",
  "/staff-auth/my-permissions", "/chat", "/tablePreferences", "/theme",
  "bill-printed", "Activity", "/read",
];
function emitResult(ok, config, response, error) {
  if (!config || config.silent) return;
  const method = (config.method || "").toLowerCase();
  if (!WRITE_METHODS.has(method)) return;
  const url = config.url || "";
  if (SILENT_URLS.some((p) => url.includes(p))) return;
  const data = response?.data;
  let message;
  if (ok) {
    message = typeof data?.message === "string" && data.message.length < 140
      ? data.message
      : method === "post" ? "Created successfully" : method === "delete" ? "Deleted successfully" : "Saved successfully";
  } else if (!error.response) {
    message = "Can't reach the server. Check your connection and try again.";
  } else if (error.response.status === 401) {
    return; // session expiry has its own handling
  } else {
    const d = error.response.data;
    message = (typeof d?.error === "string" && d.error) || (typeof d?.message === "string" && d.message)
      || (method === "delete" ? "Couldn't delete. Please try again." : "Couldn't save. Please try again.");
  }
  resultListeners.forEach((l) => l({ ok, method, message }));
}

api.interceptors.response.use(
  (response) => { emitResult(true, response.config, response); return response; },
  (error) => {
    emitResult(false, error.config, null, error);
    const data = error.response?.data;
    const status = error.response?.status;
    if ((status === 402 || (status === 403 && data?.code === "ACCOUNT_BLOCKED")) && data?.code) {
      subscriptionListeners.forEach((l) => l({ status, ...data }));
    }
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url.includes(path));
      const withinGracePeriod = Date.now() - authConfirmedAt < AUTH_GRACE_PERIOD_MS;
      if (!isAuthEndpoint && !withinGracePeriod) {
        const now = Date.now();
        recentFailureTimestamps.push(now);
        while (recentFailureTimestamps.length && now - recentFailureTimestamps[0] > FAILURE_WINDOW_MS) {
          recentFailureTimestamps.shift();
        }
        if (recentFailureTimestamps.length >= FAILURE_THRESHOLD) {
          recentFailureTimestamps.length = 0;
          sessionExpiredListeners.forEach((listener) => listener());
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

//------------------------------------admin panel---------------------------------------------