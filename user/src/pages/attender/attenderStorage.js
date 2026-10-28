/**
 * attenderStorage.js — remembers an attender's open tables (and each table's
 * unplaced bag) across page reloads, so a refresh in the middle of service
 * doesn't wipe the carts of every table they are serving.
 *
 * Keyed by restaurant + venue + attender id, so state never leaks between
 * venues or between two attenders sharing a device. Every access is wrapped in
 * try/catch (private mode / full storage must never break ordering).
 */
import tenant from "../../tenant";

const stateKey = (attenderId) => `attenderState:${tenant.restaurant}:${tenant.venue}:${attenderId}`;

// Hint that this device has an attender session (avoids a pointless 401 on
// every customer page load). The real check is always the server-side cookie.
const HINT_KEY = `attenderHint:${tenant.restaurant}`;

export const attenderHint = {
  get: () => {
    try { return localStorage.getItem(HINT_KEY) || ""; } catch { return ""; }
  },
  set: (attenderId) => {
    try { localStorage.setItem(HINT_KEY, attenderId); } catch { /* ignore */ }
  },
  clear: () => {
    try { localStorage.removeItem(HINT_KEY); } catch { /* ignore */ }
  },
};

const EMPTY = { tables: [], active: null, bags: {} };

export function loadAttenderState(attenderId) {
  try {
    const raw = JSON.parse(localStorage.getItem(stateKey(attenderId)) || "null");
    if (!raw || typeof raw !== "object") return { ...EMPTY };
    const tables = Array.isArray(raw.tables)
      ? raw.tables.filter((t) => t && t.tableNo !== undefined && t.tableNo !== null && String(t.tableNo) !== "")
          .map((t) => ({ tableNo: String(t.tableNo), guestName: String(t.guestName || "") }))
      : [];
    const bags = raw.bags && typeof raw.bags === "object" ? raw.bags : {};
    const active = raw.active && tables.some((t) => t.tableNo === String(raw.active)) ? String(raw.active) : null;
    return { tables, active, bags };
  } catch {
    return { ...EMPTY };
  }
}

export function saveAttenderState(attenderId, state) {
  try { localStorage.setItem(stateKey(attenderId), JSON.stringify(state)); } catch { /* ignore */ }
}

export function clearAttenderState(attenderId) {
  try { localStorage.removeItem(stateKey(attenderId)); } catch { /* ignore */ }
}
