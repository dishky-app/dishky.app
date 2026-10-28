/**
 * provision.js — create (and, if needed, remove) a restaurant tenant.
 *
 * provisionRestaurant() is what "Sign up" on dishky.com ends in: it creates the
 * tenant record, starts the trial, and seeds the tenant's own data — a first
 * venue, the owner's staff record and Super Admin login, the default
 * permission matrix and role registry — so the owner can open the dashboard
 * immediately.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const { Restaurant, Subscription, Owner } = require("./models");
const slugs = require("./slugs");
const subs = require("./subscriptions");
const { runInTenant, runAsPlatform } = require("../../core/tenancy");
const { getModel } = require("../../core/genericModel");

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function isSlugAvailable(slug) {
  const reason = slugs.validateRestaurantSlug(slug);
  if (reason) return { available: false, reason };
  const taken = await runAsPlatform(() => Restaurant.exists({ slug }));
  return taken ? { available: false, reason: "That name is already taken" } : { available: true };
}

/** Suggest alternatives when a slug is taken. */
async function suggestSlugs(base) {
  const out = [];
  for (const suffix of ["", "-restaurant", "-cafe", "-co", "-2", "-3"]) {
    const candidate = slugs.slugify(`${base}${suffix}`);
    if ((await isSlugAvailable(candidate)).available) out.push(candidate);
    if (out.length >= 3) break;
  }
  return out;
}

async function seedTenant({ restaurant, owner }) {
  const { Venue, newVenueId } = require("../venues/venues");
  const { Admin } = require("../auth/auth");
  const permissions = require("../auth/permissions");
  const roles = require("../auth/roles");

  return runInTenant(restaurant.id, async () => {
    const venue = await Venue.create({
      id: newVenueId(),
      name: "Main Branch",
      slug: "main",
      address: "Not yet set — update in Venues",
      area: "Not yet set",
      isMainBranch: true,
    });

    const staffId = `staff_${crypto.randomBytes(6).toString("hex")}`;
    await getModel("staff").create({
      id: staffId,
      name: owner.name,
      role: "Proprietor",
      venueId: venue.id,
      contact: owner.phone || "",
      workType: "full-time",
      employmentType: "permanent",
      joiningDate: new Date().toISOString().slice(0, 10),
      previousExperience: [],
      bank: { name: "", account: "", ifsc: "" },
    });

    const admin = await Admin.create({
      id: `admin_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      name: owner.name,
      email: owner.email,
      password: owner.password, // same bcrypt hash: the owner signs in with the password they chose on dishky.com
      roleGroup: "Super Admin",
      roleTitle: "Proprietor",
      venueId: null,
      staffId,
      phone: owner.phone || "",
      mustResetPassword: false,
    });

    await permissions.seedDefaultPermissions();
    await roles.ensureDefaultRoles();
    return { venueId: venue.id, adminId: admin.id };
  });
}

async function provisionRestaurant({ owner, name, slug, planKey, cycle, contact }) {
  name = String(name || "").trim();
  if (name.length < 2 || name.length > 80) throw httpError(400, "Restaurant name must be 2-80 characters");
  slug = slugs.slugify(slug || name);
  const avail = await isSlugAvailable(slug);
  if (!avail.available) throw httpError(409, avail.reason);

  let restaurant;
  try {
    restaurant = await runAsPlatform(() =>
      Restaurant.create({ slug, name, ownerId: owner.id, contact: contact || {} })
    );
  } catch (e) {
    if (e && e.code === 11000) throw httpError(409, "That name is already taken");
    throw e;
  }

  try {
    const subscription = await subs.startTrial({ restaurantId: restaurant.id, ownerId: owner.id, planKey, cycle });
    const seeded = await seedTenant({ restaurant, owner });
    return { restaurant, subscription, ...seeded };
  } catch (err) {
    await purgeTenant(restaurant.id).catch((e) => console.error("[provision] rollback failed:", e.message));
    throw err;
  }
}

/** Delete EVERYTHING belonging to a tenant. Irreversible. */
async function purgeTenant(restaurantId) {
  const db = mongoose.connection.db;
  const colls = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of colls) {
    if (name.startsWith("system.")) continue;
    await db.collection(name).deleteMany({ restaurantId });
  }
  await runAsPlatform(async () => {
    await Subscription.deleteMany({ restaurantId });
    await Restaurant.deleteOne({ id: restaurantId });
  });
  subs.invalidate(restaurantId);
}

module.exports = { provisionRestaurant, seedTenant, purgeTenant, isSlugAvailable, suggestSlugs };
