/**
 * venues.js — Dishky Phase-4 Venue (Branch) Module
 *
 * A "venue" is a physical branch of the restaurant. Every piece of
 * operational data (staff, orders, KMS/SMS activity, menus, bookings,
 * etc.) belongs to exactly one venue via a `venueId` field, giving each
 * branch its own isolated slice of data. Super Admins are the only
 * accounts without a venueId — they're global and can see/manage every
 * venue.
 *
 * Only Super Admins may create, edit, or delete venues. Any logged-in
 * admin may list venues (needed to render names/labels, and for the
 * Super Admin venue switcher).
 */

const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { safeErrorMessage } = require("../../core/validation");
const slugs = require("../platform/slugs");
const { assertWithinLimit, sendLimitError } = require("../platform/limits");

const router = express.Router();

/* ─────────────────────────────────────────
   SCHEMA
───────────────────────────────────────── */
const venueSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    name: { type: String, required: true, trim: true }, // branch name
    // URL name: dishky.com/<restaurant>/<venue-slug>. Unique per restaurant
    // (tenancy.js turns this into a (restaurantId, slug) unique index).
    slug: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    address: { type: String, required: true, trim: true }, // branch address
    area: { type: String, required: true, trim: true }, // generalized location / branch area
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    // Shared secret for this venue's print-bridge (server.js printer:register).
    printerToken: { type: String, select: false },
    isMainBranch: { type: Boolean, default: false }, // exactly one venue may be true at a time — see PATCH /venues/:id/set-main
    createdBy: { type: String, default: null }, // admin id
  },
  { timestamps: true, versionKey: false }
);

const Venue = mongoose.model("Venue", venueSchema, "venues");

function newVenueId() {
  return `venue_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * Turns a requested name into a URL slug that is valid and unused within the
 * current restaurant. If the caller passed an explicit slug that is taken we
 * reject it; if it was derived from the name we append -2, -3...
 */
async function uniqueVenueSlug(input, { explicit = false, excludeId = null } = {}) {
  const base = slugs.slugify(input);
  const reason = slugs.validateVenueSlug(base);
  if (reason) return { error: reason };
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const clash = await Venue.findOne({ slug: candidate, ...(excludeId ? { id: { $ne: excludeId } } : {}) }).lean();
    if (!clash) return { value: candidate };
    if (explicit) return { error: "That venue URL name is already used by another venue" };
  }
  return { error: "Could not find a free venue URL name" };
}

function safeVenue(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj._id;
  delete obj.printerToken;
  return obj;
}

/* ─────────────────────────────────────────
   ROUTES
   Mounted at /venues in server.js. Guards (requireAuth, requireRole)
   are injected from auth.js/server.js at mount time to avoid a
   circular require between auth.js and venues.js.
───────────────────────────────────────── */
function buildRouter({ requireAuth, requireRole, logAudit }) {
  // GET /venues/public — minimal, unauthenticated list (id + name only) so
  // the pre-login Signup form can offer a venue picker. Deliberately omits
  // address/area/status to avoid leaking internal details publicly.
  router.get("/public", async (_req, res) => {
    try {
      const venues = await Venue.find({ status: "active" }).select("id name slug").lean();
      res.json(venues.map((v) => ({ id: v.id, name: v.name, slug: v.slug || null })));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /venues — any logged-in admin (needed for labels + venue switcher)
  router.get("/", requireAuth, async (_req, res) => {
    try {
      const venues = await Venue.find().sort({ name: 1 }).lean();
      res.json(venues.map(safeVenue));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /venues/:id
  router.get("/:id", requireAuth, async (req, res) => {
    try {
      const venue = await Venue.findOne({ id: req.params.id }).lean();
      if (!venue) return res.status(404).json({ error: "Venue not found" });
      res.json(safeVenue(venue));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /venues — Super Admin only
  router.post("/", requireAuth, requireRole("Super Admin"), async (req, res) => {
    try {
      const { name, address, area } = req.body;
      if (!name || !address || !area) {
        return res.status(400).json({ error: "name, address, and area are required" });
      }
      if (typeof name !== "string" || typeof address !== "string" || typeof area !== "string") {
        return res.status(400).json({ error: "name, address, and area must be strings" });
      }
      await assertWithinLimit("venues");
      const slug = await uniqueVenueSlug(req.body.slug || name, { explicit: !!req.body.slug });
      if (slug.error) return res.status(400).json({ error: slug.error });
      const venue = await Venue.create({
        id: newVenueId(),
        name,
        slug: slug.value,
        address,
        area,
        createdBy: req.admin.id,
      });
      const result = safeVenue(venue);
      logAudit(req, { action: "create", resource: "venues", targetId: result.id, after: result });
      res.status(201).json(result);
    } catch (err) {
      if (err.code === "PLAN_LIMIT") return sendLimitError(res, err);
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // GET /venues/:id/printer-token — Super Admin only. The token the venue's
  // print-bridge registers with (together with the restaurant URL name and
  // venue id). Created on first request.
  router.get("/:id/printer-token", requireAuth, requireRole("Super Admin"), async (req, res) => {
    try {
      let venue = await Venue.findOne({ id: req.params.id }).select("+printerToken").lean();
      if (!venue) return res.status(404).json({ error: "Venue not found" });
      if (!venue.printerToken) {
        const token = crypto.randomBytes(24).toString("hex");
        await Venue.updateOne({ id: venue.id }, { $set: { printerToken: token } });
        venue = { ...venue, printerToken: token };
      }
      res.json({ venueId: venue.id, restaurant: req.tenant ? req.tenant.restaurant.slug : null, token: venue.printerToken });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // POST /venues/:id/printer-token/rotate — invalidates the old token.
  router.post("/:id/printer-token/rotate", requireAuth, requireRole("Super Admin"), async (req, res) => {
    try {
      const token = crypto.randomBytes(24).toString("hex");
      const r = await Venue.updateOne({ id: req.params.id }, { $set: { printerToken: token } });
      if (!r.matchedCount) return res.status(404).json({ error: "Venue not found" });
      logAudit(req, { action: "update", resource: "venues", targetId: req.params.id, after: { event: "printer_token_rotated" } });
      res.json({ venueId: req.params.id, restaurant: req.tenant ? req.tenant.restaurant.slug : null, token });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // PATCH /venues/:id/set-main — Super Admin only. Marks this venue as the
  // main branch and unsets isMainBranch on every other venue, so exactly
  // one venue is ever the main branch at a time. Non-main branches are
  // displayed on the frontend as "<Branch Name> (<Main Branch Name>)",
  // with the parenthetical rendered at lower opacity.
  router.patch("/:id/set-main", requireAuth, requireRole("Super Admin"), async (req, res) => {
    try {
      const target = await Venue.findOne({ id: req.params.id });
      if (!target) return res.status(404).json({ error: "Venue not found" });

      await Venue.updateMany({ id: { $ne: req.params.id } }, { $set: { isMainBranch: false } });
      target.isMainBranch = true;
      await target.save();

      const result = safeVenue(target);
      logAudit(req, { action: "update", resource: "venues", targetId: result.id, after: { isMainBranch: true } });
      const venues = await Venue.find().sort({ name: 1 }).lean();
      res.json(venues.map(safeVenue));
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // PATCH /venues/:id — Super Admin only
  router.patch("/:id", requireAuth, requireRole("Super Admin"), async (req, res) => {
    try {
      const before = await Venue.findOne({ id: req.params.id }).lean();
      if (!before) return res.status(404).json({ error: "Venue not found" });

      const { name, address, area, status, slug } = req.body;
      // Mongoose does NOT run schema validators (enum/required/etc) on
      // findOneAndUpdate by default — only on .create()/.save() — so
      // `status`'s enum constraint must be enforced explicitly here,
      // the same way documents.js checks DEPARTMENTS.includes(...).
      if (status !== undefined && !["active", "inactive"].includes(status)) {
        return res.status(400).json({ error: 'status must be "active" or "inactive"' });
      }
      if (name !== undefined && (typeof name !== "string" || !name.trim())) {
        return res.status(400).json({ error: "name must be a non-empty string" });
      }
      if (address !== undefined && (typeof address !== "string" || !address.trim())) {
        return res.status(400).json({ error: "address must be a non-empty string" });
      }
      if (area !== undefined && (typeof area !== "string" || !area.trim())) {
        return res.status(400).json({ error: "area must be a non-empty string" });
      }
      const update = {};
      if (name !== undefined) update.name = name;
      if (address !== undefined) update.address = address;
      if (area !== undefined) update.area = area;
      if (status !== undefined) update.status = status;
      if (slug !== undefined) {
        const checked = await uniqueVenueSlug(slug, { explicit: true, excludeId: req.params.id });
        if (checked.error) return res.status(400).json({ error: checked.error });
        update.slug = checked.value;
      }

      const venue = await Venue.findOneAndUpdate(
        { id: req.params.id },
        { $set: update },
        { returnDocument: "after" }
      ).lean();
      const result = safeVenue(venue);
      logAudit(req, {
        action: "update",
        resource: "venues",
        targetId: result.id,
        before: safeVenue(before),
        after: result,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  // DELETE /venues/:id — Super Admin only. Blocked if any admin/staff is
  // still assigned to this venue, to avoid orphaning accounts.
  router.delete("/:id", requireAuth, requireRole("Super Admin"), async (req, res) => {
    try {
      const { Admin } = require("../auth/auth");
      const stillInUse = await Admin.exists({ venueId: req.params.id });
      if (stillInUse) {
        return res.status(409).json({
          error: "Cannot delete a venue that still has staff assigned to it. Reassign them first.",
        });
      }
      const before = await Venue.findOneAndDelete({ id: req.params.id }).lean();
      if (!before) return res.status(404).json({ error: "Venue not found" });
      logAudit(req, { action: "delete", resource: "venues", targetId: req.params.id, before: safeVenue(before) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: safeErrorMessage(err) });
    }
  });

  return router;
}

module.exports = { buildRouter, Venue, safeVenue, newVenueId, uniqueVenueSlug };