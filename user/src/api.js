import axios from "axios";
import tenant, { resolved } from "./tenant";

// In production, calls go through the /api/* rewrite defined in
// vercel.json, which proxies to the Render backend server-side. This
// makes every request same-origin from the browser's point of view, so
// the customer session cookie (dishkyid_cust_<restaurantId>) is never treated as
// third-party — avoiding Chrome's third-party cookie blocking (and
// Safari's ITP) regardless of the visitor's browser settings. Locally,
// Vercel's rewrite doesn't exist, so dev still talks directly to
// localhost:4000 as before.
const baseURL =
  import.meta.env.PROD
    ? "/api"
    : import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const api = axios.create({
  baseURL,
  withCredentials: true, // required so the httpOnly customer session cookie (dishkyid_cust_<restaurantId>) is sent/received
  // Required by the backend's CSRF defense — see the matching comment
  // in the admin panel's api.js for why SameSite=None alone isn't
  // sufficient protection here.
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    // Which restaurant this page belongs to (from dishky.com/<restaurant>/...).
    ...(tenant.restaurant ? { "X-Restaurant": tenant.restaurant } : {}),
  },
});

// Public menu data is per venue: add ?venueId= to every /public/* read except
// the two endpoints that resolve the venue in the first place.
api.interceptors.request.use((config) => {
  const url = config.url || "";
  if (
    resolved.venueId &&
    url.startsWith("/public/") &&
    !url.startsWith("/public/resolve") &&
    !url.startsWith("/public/restaurant")
  ) {
    config.params = { venueId: resolved.venueId, ...(config.params || {}) };
  }
  return config;
});

// ---- Save / error toasts -----------------------------------------------
// Every create / edit / delete reports its outcome here once; ToastProvider
// (components/Usetoast.js) listens and shows a success or error toast, skipping
// it when the page already showed its own. A call can opt out with
// `api.post(url, body, { silent: true })`.
const resultListeners = new Set();
export function onApiResult(listener) {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
}
const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);
// Sign-in / sign-up flows and order placement explain their own outcome on screen.
const SILENT_URLS = ["/auth/", "/attender-auth/", "/orders", "/chat", "/call", "/bell"];

function emitResult(ok, config, response, error) {
  if (!config || config.silent) return;
  const method = String(config.method || "").toLowerCase();
  if (!WRITE_METHODS.has(method)) return;
  const url = config.url || "";
  if (SILENT_URLS.some((x) => url.includes(x))) return;
  let message;
  if (ok) {
    const d = response?.data;
    message = typeof d?.message === "string" && d.message.length < 140
      ? d.message
      : method === "post" ? "Created successfully" : method === "delete" ? "Deleted successfully" : "Saved successfully";
  } else if (!error?.response) {
    message = "Can't reach the server. Check your connection and try again.";
  } else if (error.response.status === 401) {
    return; // the app handles an ended session itself
  } else {
    const d = error.response.data;
    message = (typeof d?.error === "string" && d.error) || (typeof d?.message === "string" && d.message)
      || (method === "delete" ? "Couldn't delete. Please try again." : "Couldn't save. Please try again.");
  }
  resultListeners.forEach((l) => l({ ok, method, message }));
}

api.interceptors.response.use(
  (response) => { emitResult(true, response.config, response); return response; },
  (error) => { emitResult(false, error.config, null, error); return Promise.reject(error); }
);

export default api;

//------------------------------------user panel---------------------------------------------