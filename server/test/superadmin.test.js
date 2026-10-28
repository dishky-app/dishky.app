const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let ctx;
const PASSWORD = "correct horse battery";

test.before(async () => {
  ctx = await boot();
  const bcrypt = require("bcrypt");
  const { PlatformAdmin } = require("../src/modules/platform/models");
  await PlatformAdmin.create({ name: "Ops", email: "ops@dishky.test", password: await bcrypt.hash(PASSWORD, 4) });
  // two paying-ish clients
  for (const [i, plan] of [[1, "starter"], [2, "growth"]]) {
    const c = client(ctx.port);
    const r = await c.post("/platform/auth/signup", {
      name: `Owner ${i}`, email: `owner${i}@example.com`, password: "password123", restaurantName: `Resto ${i}`, planKey: plan,
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
});
test.after(async () => { await ctx.close(); });

test("every data route requires a super-admin session", async () => {
  const c = client(ctx.port);
  for (const p of ["/superadmin/overview", "/superadmin/restaurants", "/superadmin/clients", "/superadmin/auth/me", "/superadmin/export/restaurants.csv"]) {
    assert.equal((await c.get(p)).status, 401, p);
  }
});

test("a restaurant owner's or staff login is not a super-admin login", async () => {
  const c = client(ctx.port);
  assert.equal((await c.post("/superadmin/auth/login", { email: "owner1@example.com", password: "password123" })).status, 401);
  const owner = client(ctx.port);
  await owner.post("/platform/auth/login", { email: "owner1@example.com", password: "password123" });
  assert.equal((await owner.get("/superadmin/overview")).status, 401);
});

test("wrong password gives the same message as an unknown email", async () => {
  const c = client(ctx.port);
  const a = await c.post("/superadmin/auth/login", { email: "ops@dishky.test", password: "nope-nope-nope-nope" });
  const b = await c.post("/superadmin/auth/login", { email: "ghost@dishky.test", password: "nope-nope-nope-nope" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.data.message, b.data.message);
});

test("five wrong passwords lock the account, even for the right password", async () => {
  const { PlatformAdmin } = require("../src/modules/platform/models");
  const bcrypt = require("bcrypt");
  await PlatformAdmin.create({ name: "Lock", email: "lock@dishky.test", password: await bcrypt.hash(PASSWORD, 4) });
  const c = client(ctx.port);
  for (let i = 0; i < 5; i++) await c.post("/superadmin/auth/login", { email: "lock@dishky.test", password: "wrong-wrong-wrong" });
  assert.equal((await c.post("/superadmin/auth/login", { email: "lock@dishky.test", password: PASSWORD })).status, 401);
});

test("signed-in super admin sees clients, plans, expiry and storage", async () => {
  const c = client(ctx.port);
  const login = await c.post("/superadmin/auth/login", { email: "ops@dishky.test", password: PASSWORD });
  assert.equal(login.status, 200);

  const ov = await c.get("/superadmin/overview");
  assert.equal(ov.status, 200);
  assert.equal(ov.data.data.totals.clients, 2);
  assert.equal(ov.data.data.totals.restaurants, 2);
  assert.equal(ov.data.data.byPlan.starter, 1);
  assert.equal(ov.data.data.byPlan.growth, 1);
  assert.equal(ov.data.data.byStatus.trialing, 2);
  assert.ok(ov.data.data.storage.dataBytes >= 0);

  const list = await c.get("/superadmin/restaurants?sort=name&dir=asc");
  assert.equal(list.data.data.total, 2);
  const first = list.data.data.rows[0];
  assert.equal(first.name, "Resto 1");
  assert.equal(first.owner.email, "owner1@example.com");
  assert.equal(first.plan, "starter");
  assert.equal(first.subscriptionStatus, "trialing");
  assert.ok(first.expiresAt, "trial expiry date is reported");
  assert.ok(first.daysLeft >= 13 && first.daysLeft <= 14);
  assert.equal(typeof first.storageBytes, "number");
  assert.equal("password" in first.owner, false, "owner password never leaves the API");

  const filtered = await c.get("/superadmin/restaurants?plan=growth");
  assert.equal(filtered.data.data.total, 1);
  assert.equal((await c.get("/superadmin/restaurants?search=owner2@")).data.data.total, 1);

  const detail = await c.get(`/superadmin/restaurants/${first.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.data.slug, first.slug);
  assert.ok(Array.isArray(detail.data.data.storage.collections));
  assert.ok(detail.data.data.usage.venues >= 1);

  const clients = await c.get("/superadmin/clients");
  assert.equal(clients.data.data.total, 2);
  assert.equal(JSON.stringify(clients.data).includes("$2"), false, "no password hashes in responses");

  const csv = await c.get("/superadmin/export/restaurants.csv");
  assert.equal(csv.status, 200);
  assert.match(csv.data, /Restaurant,URL name,Owner/);
});

test("storage is attributed per restaurant", async () => {
  const c = client(ctx.port);
  await c.post("/superadmin/auth/login", { email: "ops@dishky.test", password: PASSWORD });
  const r = await c.post("/superadmin/storage/refresh");
  assert.equal(r.status, 200);
  const list = await c.get("/superadmin/restaurants");
  // Provisioning seeds staff, roles, permissions and a venue for each restaurant.
  for (const row of list.data.data.rows) assert.ok(row.storageDocs > 0, `${row.name} has stored documents`);
});

test("logout ends the session", async () => {
  const c = client(ctx.port);
  await c.post("/superadmin/auth/login", { email: "ops@dishky.test", password: PASSWORD });
  assert.equal((await c.get("/superadmin/auth/me")).status, 200);
  await c.post("/superadmin/auth/logout");
  assert.equal((await c.get("/superadmin/overview")).status, 401);
});

test("expiry and MRR rules", () => {
  const { expiryOf, mrrOf, csvCell } = require("../src/modules/platform/superadmin");
  const t = new Date("2030-01-01");
  assert.equal(expiryOf({ status: "trialing", trialEndsAt: t }), t);
  assert.equal(expiryOf({ status: "active", currentPeriodEnd: t }), t);
  assert.equal(expiryOf({ status: "active", comped: true, currentPeriodEnd: t }), null);
  assert.equal(mrrOf({ status: "active", billingCycle: "yearly" }, { monthlyPrice: 2999, yearlyPrice: 29990 }), 2499);
  assert.equal(mrrOf({ status: "trialing", billingCycle: "monthly" }, { monthlyPrice: 999, yearlyPrice: 9990 }), 0);
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
});
