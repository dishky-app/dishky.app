#!/usr/bin/env node
/**
 * One-time migration: turn an existing single-restaurant (Dishky) database
 * into the first tenant of the multi-tenant Dishky platform.
 *
 *   node scripts/migrate-to-multitenant.js --slug dishky --name "Dishky"           # dry run
 *   node scripts/migrate-to-multitenant.js --slug dishky --name "Dishky" --apply   # do it
 *
 * What it does (idempotent — safe to run twice):
 *   1. Creates the platform Owner (from your existing Super Admin account) and the
 *      Restaurant record, flagged `internal`, with a complimentary Custom (top-tier)
 *      subscription (no billing, all modules, unlimited venues).
 *   2. Stamps restaurantId on EVERY document of every existing collection.
 *   3. Gives every venue a URL name (slug) if it has none.
 *   4. Drops the old single-field unique indexes (e.g. admins.email_1) that would stop
 *      a second restaurant from reusing an email / id, then builds the per-restaurant ones.
 *
 * BACK UP THE DATABASE FIRST (mongodump). Existing staff and customer sessions are
 * signed out (cookie names changed); everyone just logs in again.
 */
require("dotenv").config();
require("../src/core/tenancy");
const mongoose = require("mongoose");
const slugs = require("../src/modules/platform/slugs");

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const PLATFORM_COLLECTIONS = new Set([
  "restaurants", "plans", "subscriptions", "platformOwners", "platformOwnerSessions", "platformOwnerResets",
  "platformInvoices", "platformWebhookEvents", "platformSsoTokens", "contacts", "demoRequests", "newsletters",
]);

(async () => {
  const slug = slugs.slugify(opt("slug", ""));
  const name = opt("name", "");
  const apply = flag("apply");
  if (!slug || !name) { console.error('Usage: --slug <url-name> --name "<Restaurant Name>" [--apply]'); process.exit(1); }
  const reason = slugs.validateRestaurantSlug(slug);
  if (reason) { console.error(`Invalid slug "${slug}": ${reason}`); process.exit(1); }
  if (!process.env.MONGO_URI) { console.error("MONGO_URI is not set"); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const log = (m) => console.log(`${apply ? "" : "[dry-run] "}${m}`);
  const { Owner, Restaurant, Subscription } = require("../src/modules/platform/models");
  const { runAsPlatform } = require("../src/core/tenancy");

  let restaurant = await runAsPlatform(() => Restaurant.findOne({ slug }).lean());
  if (!restaurant) {
    const sa = await db.collection("admins").findOne(
      { roleGroup: "Super Admin", restaurantId: { $exists: false } }, { sort: { roleTitle: -1, createdAt: 1 } }
    ) || await db.collection("admins").findOne({ roleGroup: "Super Admin" });
    if (!sa) { console.error("No Super Admin account found to become the owner."); process.exit(1); }
    log(`Owner will be ${sa.email} (${sa.name})`);
    if (apply) {
      let owner = await runAsPlatform(() => Owner.findOne({ email: sa.email }).lean());
      if (!owner) owner = (await runAsPlatform(() => Owner.create({ name: sa.name, email: sa.email, phone: sa.phone || "", password: sa.password }))).toObject();
      restaurant = (await runAsPlatform(() => Restaurant.create({ slug, name, ownerId: owner.id, internal: true }))).toObject();
      await runAsPlatform(() => Subscription.create({
        restaurantId: restaurant.id, ownerId: owner.id, planKey: "enterprise", billingCycle: "yearly",
        status: "active", provider: "internal", comped: true,
        currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 3650 * 864e5),
      }));
      log(`Created restaurant ${restaurant.id} (${slug}) with a complimentary Custom (top-tier) subscription`);
    }
  } else {
    log(`Restaurant "${slug}" already exists (${restaurant.id}) — continuing`);
  }
  const rid = restaurant ? restaurant.id : "<new>";

  const colls = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name).filter((n) => !n.startsWith("system.") && !PLATFORM_COLLECTIONS.has(n));

  // Venue URL names FIRST: the (restaurantId, slug) unique index would reject
  // several slug-less venues once they are stamped with the same restaurantId.
  if (colls.includes("venues")) {
    const venues = await db.collection("venues").find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }] }).toArray();
    const taken = new Set((await db.collection("venues").find({ slug: { $type: "string", $ne: "" } }).toArray()).map((v) => v.slug));
    for (const v of venues) {
      let base = slugs.slugify(v.name) || "venue";
      if (slugs.validateVenueSlug(base)) base = `${base}-venue`;
      let candidate = base, i = 2;
      while (taken.has(candidate)) candidate = `${base}-${i++}`;
      taken.add(candidate);
      log(`venues: "${v.name}" -> /${slug}/${candidate}`);
      if (apply) await db.collection("venues").updateOne({ _id: v._id }, { $set: { slug: candidate } });
    }
  }

  for (const c of colls) {
    const coll = db.collection(c);
    const missing = await coll.countDocuments({ restaurantId: { $exists: false } });
    if (missing) {
      log(`${c}: stamping restaurantId on ${missing} document(s)`);
      if (apply) await coll.updateMany({ restaurantId: { $exists: false } }, { $set: { restaurantId: rid } });
    }
    // Old single-field unique indexes would block a second restaurant.
    for (const ix of await coll.indexes()) {
      const keys = Object.keys(ix.key);
      if (ix.unique && ix.name !== "_id_" && !keys.includes("restaurantId") && !("expireAfterSeconds" in ix)) {
        log(`${c}: dropping legacy unique index ${ix.name}`);
        if (apply) await coll.dropIndex(ix.name);
      }
    }
  }

  if (apply) {
    // Build the new per-restaurant indexes declared on the Mongoose models.
    require("../server");
    for (const m of Object.values(mongoose.models)) {
      if (PLATFORM_COLLECTIONS.has(m.collection.name)) continue;
      try { await m.syncIndexes(); } catch (e) { console.warn(`index sync for ${m.collection.name}: ${e.message}`); }
    }
  }

  console.log(apply ? "\nMigration complete." : "\nDry run only — re-run with --apply to make these changes.");
  console.log(`Customer URL: https://www.dishky.com/${slug}/<venue>/<table>`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
