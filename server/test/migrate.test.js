const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { MongoClient } = require("mongodb");

test("migration adopts a legacy single-restaurant database", async () => {
  const uri = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017";
  const dbName = `dishky_mig_${Date.now()}`;
  const cli = await MongoClient.connect(uri);
  const db = cli.db(dbName);
  await db.collection("admins").createIndex({ email: 1 }, { unique: true });
  await db.collection("admins").insertOne({ id: "admin_1", name: "Legacy GM", email: "gm@legacy.example", password: "$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz012345", roleGroup: "Super Admin", roleTitle: "General Manager", venueId: null });
  await db.collection("venues").insertMany([{ id: "v1", name: "Main Branch", address: "a", area: "b" }, { id: "v2", name: "Anna Nagar", address: "a", area: "b" }]);
  await db.collection("orders").insertMany([{ id: "order_00001", venueId: "v1" }, { id: "order_00002", venueId: "v2" }]);
  const env = { ...process.env, MONGO_URI: `${uri}/${dbName}`, NODE_ENV: "test" };
  const run = (extra) => execFileSync("node", ["scripts/migrate-to-multitenant.js", "--slug", "legacy-cafe", "--name", "Legacy Cafe", ...extra], { env, cwd: require("path").join(__dirname, ".."), encoding: "utf8" });

  const dry = run([]);
  assert.match(dry, /Dry run only/);
  assert.equal(await db.collection("orders").countDocuments({ restaurantId: { $exists: true } }), 0, "dry run changes nothing");

  const out = run(["--apply"]);
  assert.match(out, /Migration complete/);
  const rest = await db.collection("restaurants").findOne({ slug: "legacy-cafe" });
  assert.ok(rest && rest.internal);
  assert.equal(await db.collection("orders").countDocuments({ restaurantId: rest.id }), 2);
  assert.equal(await db.collection("admins").countDocuments({ restaurantId: rest.id }), 1);
  const slugs = (await db.collection("venues").find({}).toArray()).map((v) => v.slug).sort();
  assert.deepEqual(slugs, ["anna-nagar", "main-branch"]);
  const sub = await db.collection("subscriptions").findOne({ restaurantId: rest.id });
  assert.equal(sub.planKey, "enterprise"); assert.equal(sub.comped, true);
  const idx = (await db.collection("admins").indexes()).filter((i) => i.unique && !i.key.restaurantId);
  assert.equal(idx.length > 0 && idx.some((i) => i.name !== "_id_"), false, "legacy unique email index is gone");

  const again = run(["--apply"]); // idempotent
  assert.match(again, /already exists/);
  assert.equal(await db.collection("restaurants").countDocuments({ slug: "legacy-cafe" }), 1);
  await db.dropDatabase();
  await cli.close();
});

test("migration survives a pre-existing (restaurantId, slug) venue index", async () => {
  const uri = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017";
  const dbName = `dishky_mig2_${Date.now()}`;
  const cli = await MongoClient.connect(uri);
  const db = cli.db(dbName);
  // The API had already booted against this DB and built the new index.
  await db.collection("venues").createIndex({ restaurantId: 1, slug: 1 }, { unique: true });
  await db.collection("venues").insertMany([{ id: "v1", name: "Sam Cafe" }, { id: "v2", name: "Meat And Eatt" }]);
  await db.collection("admins").insertOne({ id: "admin_1", name: "GM", email: "gm@x.example", password: "$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz012345", roleGroup: "Super Admin", roleTitle: "GM", venueId: null });
  const env = { ...process.env, MONGO_URI: `${uri}/${dbName}`, NODE_ENV: "test" };
  const out = execFileSync("node", ["scripts/migrate-to-multitenant.js", "--slug", "samcafe", "--name", "Sam Cafe", "--apply"], { env, cwd: require("path").join(__dirname, ".."), encoding: "utf8" });
  assert.match(out, /Migration complete/);
  const v = (await db.collection("venues").find({}).toArray()).map((x) => x.slug).sort();
  assert.deepEqual(v, ["meat-and-eatt", "sam-cafe"]);
  assert.equal(await db.collection("admins").countDocuments({ restaurantId: { $exists: true } }), 1);
  await db.dropDatabase();
  await cli.close();
});
