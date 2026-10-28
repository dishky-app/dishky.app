/**
 * eventBookingCrud.js
 * ───────────────────
 * Single, unified CRUD layer for every user-facing event booking type:
 *
 *   Endpoint         ID prefix   Form            Status on create
 *   ──────────────   ──────────  ──────────────  ────────────────
 *   /reservations    res_        ReservationForm  "pending"
 *   /celebrations    cele_       CelebrationForm  "pending"
 *   /preBookings     pre_        PreBooking        "scheduled"
 *   /cateringOrders  cater_      CateringForm      "pending"
 *   /eventBookings   bk_         EventsPage        "pending"
 *
 * Usage
 * ─────
 *   import { bookingCrud } from "../shared/eventBookingCrud";
 *
 *   // Create
 *   const saved = await bookingCrud.create("reservations", payload);
 *
 *   // Read one
 *   const record = await bookingCrud.getById("reservations", id);
 *
 *   // Read all (optionally filtered)
 *   const all = await bookingCrud.getAll("reservations");
 *
 *   // Update
 *   const updated = await bookingCrud.update("reservations", id, patch);
 *
 *   // Cancel  (sets status → "cancelled", stamps cancelledAt)
 *   const cancelled = await bookingCrud.cancel("eventBookings", id, existingRecord);
 *
 *   // Delete
 *   await bookingCrud.remove("reservations", id);
 *
 *   // Resolve logged-in user details
 *   const { name, mobile, email } = await bookingCrud.resolveUser();
 *
 *   // Generate a short human-readable booking reference  →  e.g. "A3F9B2"
 *   const ref = bookingCrud.makeRef(id);
 *
 * Each function throws on API failure so the caller can catch and show a toast.
 */

import api from "../../api";

// ─── Config table ─────────────────────────────────────────────────────────────

/** Maps every booking type to its REST endpoint and the id-prefix used when
 *  creating new records.  Keys are the `endpoint` strings passed to every
 *  bookingCrud function (no leading slash). */
const BOOKING_CONFIG = {
  reservations: { idPrefix: "res_", defaultStatus: "pending" },
  celebrations: { idPrefix: "cele_", defaultStatus: "pending" },
  preBookings: { idPrefix: "pre_", defaultStatus: "scheduled" },
  cateringOrders: { idPrefix: "cater_", defaultStatus: "pending" },
  eventBookings: { idPrefix: "bk_", defaultStatus: "pending" },
  // Read-only reference data used by booking forms
  tablePreferences: { idPrefix: null, defaultStatus: null },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates that `endpoint` is one of the supported booking types.
 * Throws a clear error early so callers don't get a cryptic API 404.
 */
const assertEndpoint = (endpoint) => {
  if (!BOOKING_CONFIG[endpoint]) {
    throw new Error(
      `[eventBookingCrud] Unknown endpoint "${endpoint}". ` +
      `Valid options: ${Object.keys(BOOKING_CONFIG).join(", ")}`
    );
  }
};

/**
 * Returns the config entry for an endpoint (safe – assertEndpoint first).
 */
const cfg = (endpoint) => BOOKING_CONFIG[endpoint];

// ─── Public API ───────────────────────────────────────────────────────────────

export const bookingCrud = {

  // ── CREATE ─────────────────────────────────────────────────────────────────

  /**
   * Posts a new booking record.
   *
   * Automatically adds:
   *   • id           – "<prefix><timestamp>"  (unless already in payload)
   *   • status       – default for this type  (unless already in payload)
   *   • source       – "User App"             (unless already in payload)
   *   • createdAt    – ISO timestamp          (unless already in payload)
   *   • updatedAt    – ISO timestamp
   *
   * @param {string} endpoint   - one of the BOOKING_CONFIG keys
   * @param {object} payload    - form data / booking fields
   * @returns {Promise<object>} the saved record as returned by the API
   */
  async create(endpoint, payload) {
    assertEndpoint(endpoint);
    const { idPrefix, defaultStatus } = cfg(endpoint);
    if (!idPrefix) throw new Error(`[eventBookingCrud] "${endpoint}" is read-only — create() not supported.`);
    const now = new Date().toISOString();
    const id = payload.id ?? `${idPrefix}${Date.now()}`;

    const body = {
      status: defaultStatus,
      source: "User App",
      createdAt: now,
      ...payload,          // caller values override defaults (except id below)
      id,                  // always use the generated/passed-in id
      updatedAt: now,
    };

    const res = await api.post(`/${endpoint}`, body);
    return res.data;
  },

  // ── READ ALL ───────────────────────────────────────────────────────────────

  /**
   * Fetches all records for an endpoint.
   *
   * @param {string}   endpoint
   * @param {object}   [filter={}]  - optional key/value pairs to filter client-side
   * @returns {Promise<Array>}
   */
  async getAll(endpoint, filter = {}) {
    assertEndpoint(endpoint);
    const res = await api.get(`/${endpoint}`);
    const records = Array.isArray(res.data) ? res.data : [];
    if (!Object.keys(filter).length) return records;

    return records.filter((r) =>
      Object.entries(filter).every(([k, v]) => r[k] === v)
    );
  },

  // ── READ ONE ───────────────────────────────────────────────────────────────

  /**
   * Fetches a single record by id.
   *
   * @param {string} endpoint
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(endpoint, id) {
    assertEndpoint(endpoint);
    const res = await api.get(`/${endpoint}/${id}`);
    return res.data;
  },

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  /**
   * Merges `patch` into an existing record and PUTs the result.
   * Always stamps `updatedAt`.
   *
   * @param {string} endpoint
   * @param {string} id
   * @param {object} patch     - fields to merge / overwrite
   * @param {object} [existing=null]  - pass the record you already have to
   *                                    avoid a redundant GET (optional)
   * @returns {Promise<object>} the updated record
   */
  async update(endpoint, id, patch, existing = null) {
    assertEndpoint(endpoint);
    const base = existing ?? (await this.getById(endpoint, id));
    const updated = { ...base, ...patch, updatedAt: new Date().toISOString() };
    const res = await api.put(`/${endpoint}/${id}`, updated);
    return res.data ?? updated;
  },

  // ── CANCEL ─────────────────────────────────────────────────────────────────

  /**
   * Soft-cancels a booking by setting status → "cancelled" and stamping
   * `cancelledAt`.  Does NOT delete the record so the admin panel can still
   * see it.
   *
   * @param {string} endpoint
   * @param {string} id
   * @param {object} [existing=null]
   * @returns {Promise<object>} the updated record
   */
  async cancel(endpoint, id, existing = null) {
    return this.update(
      endpoint,
      id,
      { status: "cancelled", cancelledAt: new Date().toISOString() },
      existing
    );
  },

  // ── DELETE ─────────────────────────────────────────────────────────────────

  /**
   * Hard-deletes a record.  Use `cancel` instead unless the admin explicitly
   * chose to permanently remove it.
   *
   * @param {string} endpoint
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(endpoint, id) {
    assertEndpoint(endpoint);
    await api.delete(`/${endpoint}/${id}`);
  },

  // ── RESOLVE USER ───────────────────────────────────────────────────────────

  /**
   * Looks up the logged-in user's name / mobile / email from the API,
   * or returns safe empty strings if no user is logged in or the request
   * fails.  Used by every form to pre-fill contact fields.
   *
   * @returns {Promise<{ name: string, mobile: string, email: string, userId: string|null }>}
   */
  async resolveUser() {
    const userId = localStorage.getItem("userId");
    const empty = { name: "", mobile: "", email: "", userId: null };
    if (!userId) return empty;

    try {
      const res = await api.get(`/users/me`);
      return {
        name: res.data?.name ?? "",
        mobile: res.data?.mobile ?? "",
        email: res.data?.email ?? "",
        userId,
      };
    } catch {
      return empty;
    }
  },

  // ── BOOKING REFERENCE ──────────────────────────────────────────────────────

  /**
   * Derives a short, uppercase booking reference from a full id string.
   * e.g.  "res_1718123456789"  →  "456789"  then returned as "456789"
   *
   * Falls back to a random 6-char hex string if id is empty.
   *
   * @param {string} id
   * @returns {string}  6-character uppercase reference
   */
  makeRef(id = "") {
    const tail = String(id).slice(-6).toUpperCase();
    return tail || Math.random().toString(16).slice(2, 8).toUpperCase();
  },
};