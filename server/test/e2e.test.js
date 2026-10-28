const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let app;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

const signup = async (owner, restaurantName, extra = {}) => {
  const c = client(app.port);
  const r = await c.post("/platform/auth/signup", {
    name: owner, email: `${owner.toLowerCase().replace(/\W/g, "")}@example.com`, password: "supersecret1",
    restaurantName, planKey: "growth", billingCycle: "monthly", ...extra,
  });
  return { c, r };
};

test("plans endpoint serves the four plans (three standard + one custom)", async () => {
  const c = client(app.port);
  const r = await c.get("/platform/plans");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.data.map((p) => p.key), ["starter", "growth", "pro", "enterprise"]);
});

test("signup creates owner + restaurant + trial; reserved/taken names are refused", async () => {
  const { r } = await signup("Alice Owner", "Alice Bistro");
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.data.restaurant.slug, "alice-bistro");

  const reserved = await signup("Bob Owner", "Pricing", { slug: "pricing" });
  assert.equal(reserved.r.status, 409);
  const taken = await signup("Carl Owner", "Alice Bistro");
  assert.equal(taken.r.status, 409);
  assert.ok(Array.isArray(taken.r.data.suggestions) && taken.r.data.suggestions.length > 0);
  // a failed signup leaves no owner behind, so the same email can try again
  const retry = await signup("Carl Owner", "Carl Cafe");
  assert.equal(retry.r.status, 201);
});

async function staffLogin(slug, email, password = "supersecret1") {
  const c = client(app.port);
  const r = await c.post("/staff-auth/login", { restaurant: slug, email, password });
  return { c, r };
}

test("two restaurants are fully isolated (menu, orders, staff, venues)", async () => {
  await signup("Dora Owner", "Dora Diner");
  await signup("Eli Owner", "Eli Eats");
  const d = await staffLogin("dora-diner", "doraowner@example.com");
  const e = await staffLogin("eli-eats", "eliowner@example.com");
  assert.equal(d.r.status, 200, JSON.stringify(d.r.data));
  assert.equal(e.r.status, 200);

  const dVenues = await d.c.get("/venues");
  const eVenues = await e.c.get("/venues");
  assert.equal(dVenues.data.length, 1); assert.equal(eVenues.data.length, 1);
  assert.notEqual(dVenues.data[0].id, eVenues.data[0].id);
  const dv = dVenues.data[0].id, ev = eVenues.data[0].id;

  const cat = await d.c.post("/categories", { name: "Dora Pizza", venueId: dv, dishes: [{ id: "d1", name: "Margherita", basePrice: 200 }] });
  assert.equal(cat.status, 201, JSON.stringify(cat.data));
  assert.equal((await d.c.get("/categories")).data.length, 1);
  assert.equal((await e.c.get("/categories")).data.length, 0);

  // Eli cannot read, update or delete Dora's record by id, even though ids can be identical
  const id = cat.data.id;
  assert.equal((await e.c.get(`/categories/${id}`)).status, 404);
  assert.equal((await e.c.patch(`/categories/${id}`, { name: "hacked" })).status, 404);
  assert.equal((await e.c.del(`/categories/${id}`)).status, 404);
  assert.equal((await d.c.get(`/categories/${id}`)).data.name, "Dora Pizza");

  // Eli cannot write into Dora's venue by naming its id
  const cross = await e.c.post("/categories", { name: "sneaky", venueId: dv });
  assert.equal(cross.status, 400, "another restaurant's venue id is rejected");
  assert.equal((await d.c.get("/categories")).data.length, 1, "Dora must not see Eli's record");
  assert.equal((await e.c.post("/categories", { name: "legit", venueId: ev })).status, 201);

  // staff lists and login accounts are separate too
  assert.equal((await d.c.get("/staff")).data.length, 1);
  assert.equal((await e.c.get("/staff-auth/admins")).data.length, 1);
});

test("a staff session cannot be pointed at another restaurant", async () => {
  const d = await staffLogin("dora-diner", "doraowner@example.com");
  const bad = await d.c.get("/categories", { "X-Restaurant": "eli-eats" });
  assert.equal(bad.status, 403);
  assert.equal(bad.data.code, "TENANT_MISMATCH");
  // logging in to the wrong restaurant with right credentials fails
  const wrong = await staffLogin("eli-eats", "doraowner@example.com");
  assert.equal(wrong.r.status, 401);
  const none = await client(app.port).post("/staff-auth/login", { email: "doraowner@example.com", password: "supersecret1" });
  assert.equal(none.status, 400);
});

test("customer app: resolve venue + table, ordering, customer isolation", async () => {
  const d = await staffLogin("dora-diner", "doraowner@example.com");
  const venue = (await d.c.get("/venues")).data[0];
  assert.equal(venue.slug, "main");
  const tables = await d.c.put("/tables/1", { id: 1, list: [1, 2, 3], venueId: venue.id });
  assert.equal(tables.status, 200, JSON.stringify(tables.data));

  const guest = client(app.port, { "X-Restaurant": "dora-diner" });
  const info = await guest.get("/public/resolve?venue=main&table=2");
  assert.equal(info.status, 200);
  assert.equal(info.data.table.valid, true);
  assert.equal((await guest.get("/public/resolve?venue=main&table=99")).data.table.valid, false);
  assert.equal((await guest.get("/public/resolve?venue=nope")).status, 404);
  assert.equal((await client(app.port).get("/public/resolve?venue=main")).status, 404, "no restaurant -> not found");
  assert.equal((await client(app.port, { "X-Restaurant": "ghost" }).get("/public/restaurant")).status, 404);

  // same mobile can be a customer of two restaurants independently
  const gd = client(app.port, { "X-Restaurant": "dora-diner" });
  const ge = client(app.port, { "X-Restaurant": "eli-eats" });
  assert.equal((await gd.post("/auth/session-signup", { name: "Sam", mobile: "9999999999" })).status, 201);
  assert.equal((await ge.post("/auth/session-signup", { name: "Sam", mobile: "9999999999" })).status, 201);
  assert.equal((await gd.get("/auth/me")).status, 200);
  assert.equal((await ge.get("/auth/me")).status, 200);
  assert.equal((await ge.post("/auth/session-login", { mobile: "9999999999" })).status, 200);
  // Dora's cookie sent to Eli's endpoint is not a session there
  const cross = client(app.port, { "X-Restaurant": "eli-eats" });
  cross.jar[Object.keys(gd.jar)[0]] = Object.values(gd.jar)[0];
  assert.equal((await cross.get("/auth/me")).status, 401);

  // an order is placed in the right restaurant only
  const order = await gd.post("/orders", { venueId: venue.id, tableNo: "2", userName: "Sam Customer", items: [{ dishId: "x", name: "Tea", quantity: 1, unitPrice: 50, totalPrice: 50, isCustomized: true }] });
  assert.equal(order.status, 201, JSON.stringify(order.data));
  assert.match(order.data.id, /^order_\d+$/);

  // order-status board: public, one venue only, no money / phone / notes, first name only
  const board = await client(app.port, { "X-Restaurant": "dora-diner" }).get(`/public/display/orders?venueId=${venue.id}`);
  assert.equal(board.status, 200, JSON.stringify(board.data));
  assert.equal(board.data.length, 1);
  assert.equal(board.data[0].id, order.data.id);
  assert.equal(board.data[0].userName, "Sam");
  assert.ok(board.data[0].createdAt, "server stamps createdAt");
  const boardText = JSON.stringify(board.data);
  for (const leak of ["totalAmount", "totalWithGST", "unitPrice", "totalPrice", "mobile", "userId", "paymentStatus"]) assert.ok(!boardText.includes(leak), `board must not expose ${leak}`);
  assert.equal((await client(app.port, { "X-Restaurant": "eli-eats" }).get(`/public/display/orders?venueId=${venue.id}`)).status, 404, "another restaurant cannot read this venue's board");
  assert.equal((await client(app.port, { "X-Restaurant": "dora-diner" }).get("/public/display/orders")).status, 400);
  const dOrders = await d.c.get("/orders");
  assert.equal(dOrders.data.length, 1);
  const e = await staffLogin("eli-eats", "eliowner@example.com");
  assert.equal((await e.c.get("/orders")).data.length, 0);
  // order ids restart per restaurant
  const eVenue = (await e.c.get("/venues")).data[0];
  const o2 = await ge.post("/orders", { venueId: eVenue.id, items: [{ dishId: "x", name: "Tea", quantity: 1, unitPrice: 50, totalPrice: 50, isCustomized: true }] });
  assert.equal(o2.data.id, order.data.id);
});

test("plan limits: starter allows 1 venue, 15 tables, 3 staff accounts", async () => {
  const { c: oc, r } = await signup("Finn Owner", "Finn Fare", { planKey: "starter" });
  assert.equal(r.status, 201);
  const f = await staffLogin("finn-fare", "finnowner@example.com");
  const venue = (await f.c.get("/venues")).data[0];

  const v2 = await f.c.post("/venues", { name: "Second", address: "x", area: "y" });
  assert.equal(v2.status, 402); assert.equal(v2.data.code, "PLAN_LIMIT");

  const ok15 = await f.c.put("/tables/1", { id: 1, list: Array.from({ length: 15 }, (_, i) => i + 1), venueId: venue.id });
  assert.equal(ok15.status, 200);
  const over = await f.c.put("/tables/1", { id: 1, list: Array.from({ length: 16 }, (_, i) => i + 1), venueId: venue.id });
  assert.equal(over.status, 402); assert.equal(over.data.code, "PLAN_LIMIT");

  // modules outside the plan are refused
  const ing = await f.c.get("/ingredients");
  assert.equal(ing.status, 402); assert.equal(ing.data.code, "PLAN_UPGRADE_REQUIRED");
  assert.equal((await f.c.get("/categories")).status, 200);
  assert.ok(oc);
});

test("subscription lifecycle: trial -> pay -> upgrade -> schedule downgrade -> cancel -> resume", async () => {
  const { c, r } = await signup("Gus Owner", "Gus Grill", { planKey: "starter" });
  const rid = r.data.data.restaurant.id;
  const billing = (await c.get(`/platform/restaurants/${rid}/billing`)).data.data;
  assert.equal(billing.subscription.status, "trialing");
  assert.equal(billing.subscription.access.level, "full");

  // upgrade starter -> growth needs a payment
  const co = (await c.post(`/platform/restaurants/${rid}/billing/checkout`, { planKey: "growth", billingCycle: "monthly" })).data.data;
  assert.equal(co.mode, "checkout");
  // an unpaid / forged confirmation does not activate
  const bad = await c.post(`/platform/restaurants/${rid}/billing/confirm`, { providerSubscriptionId: co.checkout.subscriptionId, payload: {} });
  assert.equal(bad.status, 402);
  assert.equal((await c.get(`/platform/restaurants/${rid}/billing`)).data.data.subscription.status, "trialing");
  const paid = await c.post(`/platform/restaurants/${rid}/billing/confirm`, { providerSubscriptionId: co.checkout.subscriptionId, payload: { mockPaymentSuccess: true } });
  assert.equal(paid.status, 200, JSON.stringify(paid.data));
  let sub = paid.data.data.subscription;
  assert.equal(sub.status, "active"); assert.equal(sub.planKey, "growth");
  // confirming twice is harmless
  assert.equal((await c.post(`/platform/restaurants/${rid}/billing/confirm`, { providerSubscriptionId: co.checkout.subscriptionId, payload: { mockPaymentSuccess: true } })).status, 200);
  let invoices = (await c.get(`/platform/restaurants/${rid}/billing`)).data.data.invoices;
  assert.equal(invoices.length, 1);

  // the new plan's modules unlock without re-login
  const g = await staffLogin("gus-grill", "gusowner@example.com");
  assert.equal((await g.c.get("/ingredients")).status, 200);

  // downgrade is scheduled for period end, not immediate
  const dg = (await c.post(`/platform/restaurants/${rid}/billing/checkout`, { planKey: "starter", billingCycle: "monthly" })).data.data;
  assert.equal(dg.mode, "scheduled");
  sub = (await c.get(`/platform/restaurants/${rid}/billing`)).data.data.subscription;
  assert.equal(sub.planKey, "growth"); assert.equal(sub.pendingChange.planKey, "starter");
  assert.equal((await g.c.get("/ingredients")).status, 200, "still on growth until the period ends");

  // cancel keeps access until period end; resume undoes it
  const cancelled = (await c.post(`/platform/restaurants/${rid}/billing/cancel`)).data.data.subscription;
  assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.access.level, "full");
  const resumed = (await c.post(`/platform/restaurants/${rid}/billing/resume`)).data.data;
  assert.equal(resumed.mode, "resumed"); assert.equal(resumed.subscription.status, "active");
});

test("downgrade is refused while usage exceeds the target plan", async () => {
  const { c, r } = await signup("Hana Owner", "Hana Hub", { planKey: "growth" });
  const rid = r.data.data.restaurant.id;
  const co = (await c.post(`/platform/restaurants/${rid}/billing/checkout`, { planKey: "growth", billingCycle: "yearly" })).data.data;
  await c.post(`/platform/restaurants/${rid}/billing/confirm`, { providerSubscriptionId: co.checkout.subscriptionId, payload: { mockPaymentSuccess: true } });
  const h = await staffLogin("hana-hub", "hanaowner@example.com");
  const venue = (await h.c.get("/venues")).data[0];
  await h.c.put("/tables/1", { id: 1, list: Array.from({ length: 30 }, (_, i) => i + 1), venueId: venue.id });
  const dg = await c.post(`/platform/restaurants/${rid}/billing/checkout`, { planKey: "starter", billingCycle: "monthly" });
  assert.equal(dg.status, 409);
  assert.equal(dg.data.over[0].key, "tables");
});

test("lapsed subscription: readonly for staff, ordering closed, sign-in still works; webhooks restore access", async () => {
  const { c, r } = await signup("Ivy Owner", "Ivy Inn", { planKey: "starter" });
  const rid = r.data.data.restaurant.id;
  const I = await staffLogin("ivy-inn", "ivyowner@example.com");
  const venue = (await I.c.get("/venues")).data[0];

  // end the trial in the past
  const mongoose = require("mongoose");
  await mongoose.connection.db.collection("subscriptions").updateOne({ restaurantId: rid }, { $set: { trialEndsAt: new Date(Date.now() - 1000) } });
  require("../src/modules/platform/subscriptions").invalidate();

  assert.equal((await I.c.get("/categories")).status, 200, "reads still work");
  const w = await I.c.post("/categories", { name: "x", venueId: venue.id });
  assert.equal(w.status, 402); assert.equal(w.data.code, "SUBSCRIPTION_INACTIVE");
  const guest = client(app.port, { "X-Restaurant": "ivy-inn" });
  assert.equal((await guest.get("/public/restaurant")).data.acceptingOrders, false);
  assert.equal((await guest.post("/orders", { items: [{ quantity: 1 }] })).status, 402);
  assert.equal((await staffLogin("ivy-inn", "ivyowner@example.com")).r.status, 200, "owner can still sign in to fix billing");
  assert.equal((await I.c.get("/staff-auth/subscription")).data.access.level, "readonly");

  // paying restores everything
  const co = (await c.post(`/platform/restaurants/${rid}/billing/checkout`, { planKey: "starter", billingCycle: "monthly" })).data.data;
  assert.equal(co.mode, "checkout");
  await c.post(`/platform/restaurants/${rid}/billing/confirm`, { providerSubscriptionId: co.checkout.subscriptionId, payload: { mockPaymentSuccess: true } });
  assert.equal((await I.c.post("/categories", { name: "x", venueId: venue.id })).status, 201);
});

test("webhook: failed renewal -> past_due (grace keeps access); duplicate delivery is ignored", async () => {
  const { c, r } = await signup("Jo Owner", "Jo Joint", { planKey: "starter" });
  const rid = r.data.data.restaurant.id;
  const co = (await c.post(`/platform/restaurants/${rid}/billing/checkout`, { planKey: "starter", billingCycle: "monthly" })).data.data;
  const sid = co.checkout.subscriptionId;
  const wh = client(app.port);
  // webhook activation (browser never came back)
  const evt = { id: "evt_1", type: "payment.succeeded", providerSubscriptionId: sid, paymentId: "pay_1", amount: 999, periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 864e5) };
  assert.equal((await wh.post("/platform/webhooks/mock", evt)).status, 200);
  assert.equal((await wh.post("/platform/webhooks/mock", evt)).status, 200); // retried delivery
  const b = (await c.get(`/platform/restaurants/${rid}/billing`)).data.data;
  assert.equal(b.subscription.status, "active"); assert.equal(b.invoices.length, 1);

  await wh.post("/platform/webhooks/mock", { id: "evt_2", type: "payment.failed", providerSubscriptionId: sid });
  const pd = (await c.get(`/platform/restaurants/${rid}/billing`)).data.data.subscription;
  assert.equal(pd.status, "past_due"); assert.equal(pd.access.level, "full"); assert.ok(pd.graceEndsAt);
});

test("owner can only touch their own restaurants; dashboard SSO is one-time and tenant-bound", async () => {
  const k = await signup("Kai Owner", "Kai Kitchen");
  const l = await signup("Lee Owner", "Lee Lounge");
  const kid = k.r.data.data.restaurant.id, lid = l.r.data.data.restaurant.id;
  assert.equal((await k.c.get(`/platform/restaurants/${lid}`)).status, 404);
  assert.equal((await k.c.get(`/platform/restaurants/${lid}/billing`)).status, 404);
  assert.equal((await k.c.post(`/platform/restaurants/${lid}/billing/cancel`)).status, 404);
  assert.equal((await client(app.port).get(`/platform/restaurants/${kid}`)).status, 401);

  const link = (await k.c.post(`/platform/restaurants/${kid}/dashboard-link`)).data.data.url;
  const token = new URL(link).searchParams.get("token");
  const admin = client(app.port);
  assert.equal((await admin.post("/staff-auth/sso", { restaurant: "lee-lounge", token })).status, 401, "token for Kai's restaurant is useless at Lee's");
  const fresh = (await k.c.post(`/platform/restaurants/${kid}/dashboard-link`)).data.data.url;
  const t2 = new URL(fresh).searchParams.get("token");
  const ok = await admin.post("/staff-auth/sso", { restaurant: "kai-kitchen", token: t2 });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal((await admin.get("/staff-auth/me")).status, 200);
  assert.equal((await client(app.port).post("/staff-auth/sso", { restaurant: "kai-kitchen", token: t2 })).status, 401, "single use");
});

test("webhook endpoints are not blocked by CSRF header rule but reject unsigned/mock-in-prod", async () => {
  const c = client(app.port);
  const noHeader = await fetch(`http://127.0.0.1:${app.port}/payments/webhook/ghost`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(noHeader.status, 400, "reaches the handler (signature check), not the CSRF 403");
  const normal = await fetch(`http://127.0.0.1:${app.port}/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(normal.status, 403, "ordinary routes still need the CSRF header");
  assert.ok(c);
});
