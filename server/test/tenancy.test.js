const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/core/tenancy");
const mongoose = require("mongoose");
const { runInTenant, runAsPlatform, TenantContextError } = require("../src/core/tenancy");

const URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017";
const DB = `dishky_t_${Date.now()}`;

const itemSchema = new mongoose.Schema({ id: { type: String, unique: true }, name: String, n: Number }, { versionKey: false });
const Item = mongoose.model("TItem", itemSchema, "titems");
const anySchema = new mongoose.Schema({}, { strict: false, versionKey: false, id: false });
const Any = mongoose.model("tany", anySchema, "tany");
const Global = mongoose.model("TGlobal", new mongoose.Schema({ k: String }, { tenantScoped: false }), "tglobal");

test.before(async () => {
  await mongoose.connect(URI, { dbName: DB });
  await Item.init();
});
test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("fails closed without tenant context", async () => {
  await assert.rejects(() => Item.find({}), TenantContextError);
  await assert.rejects(() => Item.create({ id: "x" }), TenantContextError);
  await assert.rejects(() => Any.countDocuments({}), TenantContextError);
});

test("create stamps and reads are isolated", async () => {
  await runInTenant("A", () => Item.create({ id: "i1", name: "a1" }));
  await runInTenant("B", () => Item.create({ id: "i1", name: "b1" })); // same id, different tenant: allowed
  const a = await runInTenant("A", () => Item.find({}).lean());
  const b = await runInTenant("B", () => Item.find({}).lean());
  assert.equal(a.length, 1); assert.equal(a[0].name, "a1"); assert.equal(a[0].restaurantId, "A");
  assert.equal(b.length, 1); assert.equal(b[0].name, "b1");
  assert.equal(await runInTenant("A", () => Item.countDocuments({})), 1);
});

test("unique id is per-tenant, still unique inside a tenant", async () => {
  await assert.rejects(() => runInTenant("A", () => Item.create({ id: "i1", name: "dup" })), /duplicate|E11000/i);
});

test("cannot read/update/delete another tenant's doc", async () => {
  assert.equal(await runInTenant("A", () => Item.findOne({ id: "i1", name: "b1" })), null);
  const r = await runInTenant("A", () => Item.updateMany({}, { $set: { n: 5 } }));
  assert.equal(r.modifiedCount, 1);
  const b = await runInTenant("B", () => Item.findOne({ id: "i1" }).lean());
  assert.equal(b.n, undefined);
  await runInTenant("A", () => Item.deleteMany({}));
  assert.equal(await runInTenant("B", () => Item.countDocuments({})), 1);
});

test("restaurantId in a filter cannot redirect scope", async () => {
  await assert.rejects(() => runInTenant("A", () => Item.find({ restaurantId: "B" })), TenantContextError);
});

test("restaurantId cannot be changed via update", async () => {
  await runInTenant("B", () => Item.findOneAndUpdate({ id: "i1" }, { $set: { restaurantId: "A", name: "renamed" } }));
  const b = await runInTenant("B", () => Item.findOne({ id: "i1" }).lean());
  assert.equal(b.restaurantId, "B"); assert.equal(b.name, "renamed");
});

test("upsert and replace upsert are stamped", async () => {
  await runInTenant("C", () => Any.findOneAndUpdate({ id: "s1" }, { $set: { v: 1 } }, { upsert: true }));
  await runInTenant("C", () => Any.findOneAndReplace({ id: "s2" }, { id: "s2", v: 2 }, { upsert: true }));
  const docs = await runAsPlatform(() => Any.find({}).lean());
  assert.equal(docs.length, 2);
  for (const d of docs) assert.equal(d.restaurantId, "C");
  assert.equal(await runInTenant("A", () => Any.countDocuments({})), 0);
});

test("insertMany and aggregate are scoped", async () => {
  await runInTenant("D", () => Any.insertMany([{ id: "m1" }, { id: "m2" }]));
  const agg = await runInTenant("D", () => Any.aggregate([{ $count: "c" }]));
  assert.equal(agg[0].c, 2);
  const aggOther = await runInTenant("A", () => Any.aggregate([{ $count: "c" }]));
  assert.equal(aggOther.length, 0);
});

test("save() on existing doc from another tenant is refused", async () => {
  const doc = await runInTenant("B", () => Item.findOne({ id: "i1" }));
  await assert.rejects(() => runInTenant("A", async () => { doc.name = "x"; await doc.save(); }), TenantContextError);
});

test("platform models are unscoped; platform context sees everything", async () => {
  await Global.create({ k: "plan" });
  assert.equal(await Global.countDocuments({}), 1);
  const all = await runAsPlatform(() => Item.find({}).lean());
  assert.ok(all.length >= 1);
});

test("context survives awaits and parallel requests do not bleed", async () => {
  const run = (id) => runInTenant(id, async () => {
    await new Promise((r) => setTimeout(r, Math.random() * 20));
    await Any.create({ id: `p_${id}` });
    await new Promise((r) => setTimeout(r, Math.random() * 20));
    return Any.find({ id: `p_${id}` }).lean();
  });
  const res = await Promise.all(["P1", "P2", "P3", "P4"].map(run));
  res.forEach((docs, i) => { assert.equal(docs.length, 1); assert.equal(docs[0].restaurantId, `P${i + 1}`); });
});
