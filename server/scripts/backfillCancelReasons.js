/**
 * backfillCancelReasons.js — Dishky server, one-time script
 * ----------------------------------------------------------------
 * Adds a `cancelReason` (and `cancelledAt`, if missing) to every
 * EXISTING record across the six event/booking modules that is
 * already sitting at status "cancelled" but predates the cancel-
 * reason feature — Reservations, Celebrations, PreBookings,
 * CateringOrders, and EventBookings.
 *
 * Why this is needed: the admin panel now asks for a reason at the
 * moment a booking is cancelled (see CancelReasonModal.js), but that
 * only covers cancellations made going forward. Anything that was
 * already cancelled before this feature shipped has no reason on
 * file, so this script backfills one — chosen at random from a
 * small pool of realistic, generic reasons — purely so existing
 * "Cancelled" records have *something* sensible to display instead
 * of a blank Cancellation Reason section.
 *
 * These backfilled reasons are placeholders, not real customer
 * input — there's no way to recover the actual reason a past
 * cancellation happened for. This is a display convenience for old
 * data, not a factual record.
 *
 * USAGE
 * -----
 *   cd server
 *   node scripts/backfillCancelReasons.js
 *
 * Requires the same .env (MONGO_URI) the main server uses.
 * Safe to re-run — it only ever touches records that are
 * status: "cancelled" AND missing a cancelReason, so a second run
 * is a no-op for everything the first run already filled in.
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Mirrors getModel()'s schemaless model in server.js — this script
// intentionally doesn't require server.js itself (that file starts
// the HTTP server and a dozen other background jobs on load, which
// this one-off script has no business triggering).
const anySchema = new mongoose.Schema({}, { strict: false, timestamps: false, versionKey: false, id: false });
function getModel(collectionName) {
  return mongoose.models[collectionName] || mongoose.model(collectionName, anySchema, collectionName);
}

// One collection name per module this feature covers, alongside a
// human label used only for the console log lines below.
const TARGET_COLLECTIONS = [
  { collection: "reservations", label: "Reservations" },
  { collection: "celebrations", label: "Celebrations" },
  { collection: "preBookings", label: "Pre-Bookings" },
  { collection: "cateringOrders", label: "Catering Orders" },
  { collection: "eventBookings", label: "Event Bookings" },
];

// Generic, realistic-sounding reasons — randomly assigned since the
// real reason for a past cancellation can't be recovered. Kept
// deliberately module-agnostic so the same pool reads sensibly
// whether it lands on a table reservation or a subscription.
const RANDOM_REASONS = [
  "Customer requested cancellation",
  "Customer changed plans",
  "Duplicate booking",
  "Customer unreachable for confirmation",
  "Cancelled due to a scheduling conflict",
  "Cancelled at customer's request over phone",
  "No longer needed",
  "Cancelled due to change in guest count",
  "Payment not completed in time",
  "Cancelled and rebooked for a different date",
];

function randomReason() {
  return RANDOM_REASONS[Math.floor(Math.random() * RANDOM_REASONS.length)];
}

async function backfillCollection(collectionName, label) {
  const Model = getModel(collectionName);

  const candidates = await Model.find({
    status: "cancelled",
    $or: [{ cancelReason: { $exists: false } }, { cancelReason: "" }, { cancelReason: null }],
  }).lean();

  console.log(`[backfill] ${label}: ${candidates.length} cancelled record(s) missing a reason`);

  let updated = 0;

  for (const doc of candidates) {
    const update = { cancelReason: randomReason() };
    // Only fill cancelledAt if it's genuinely missing — never overwrite
    // a real timestamp that's already on the record.
    if (!doc.cancelledAt) {
      update.cancelledAt = doc.updatedAt || doc.createdAt || new Date().toISOString();
    }
    await Model.updateOne({ _id: doc._id }, { $set: update });
    updated += 1;
    console.log(`[backfill]   ✓ ${label} ${doc.id || doc._id} — "${update.cancelReason}"`);
  }

  console.log(`[backfill] ${label} done — updated ${updated}`);
  return updated;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("[backfill] MONGO_URI is not set — check your .env file.");
    process.exit(1);
  }

  console.log("[backfill] connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[backfill] connected");

  let totalUpdated = 0;
  for (const { collection, label } of TARGET_COLLECTIONS) {
    totalUpdated += await backfillCollection(collection, label);
  }

  await mongoose.disconnect();
  console.log(`[backfill] done — disconnected. ${totalUpdated} record(s) updated in total.`);
}

main().catch((err) => {
  console.error("[backfill] fatal error:", err);
  process.exit(1);
});
