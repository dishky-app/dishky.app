// Phase 5: alerts, stock audits, forecasting, supplier scorecards, WhatsApp purchase lists, consumption report.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");
const FC = require("../src/modules/inventory/forecastCalc");

test("forecast calc: weekday pattern, flat fallback, cover days", () => {
  const now = Date.UTC(2026, 9, 27, 6);
  const ev = [];
  for (let i = 1; i <= 28; i++) ev.push({ at: now - i * 864e5, qtyMilli: 1000 + (i % 7 === 0 ? 5000 : 0) });
  const f = FC.forecast({ events: ev, now });
  assert.equal(f.method, "weekday_average"); assert.equal(f.forecastMilli, 12000); assert.equal(f.confidence, "high"); assert.equal(f.trendPct, 0);
  const few = FC.forecast({ events: ev.slice(0, 5), now });
  assert.equal(few.method, "flat_average"); assert.equal(few.confidence, "low");
  assert.equal(FC.forecast({ events: [], now }).forecastMilli, 0);
  assert.equal(FC.coverDays(10000, 2000), 5); assert.equal(FC.coverDays(10000, 0), null);
});

let app, O, chef, venueId, sup, flour, rice, loc, rest, runInTenant, audit1;
test.before(async () => { app = await boot(); });
test.after(async () => { global.fetch = realFetch; await app.close(); });
const realFetch = global.fetch;
const pv = () => `?venueId=${venueId}`;
const days = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test("setup: owner, chef, supplier, items, stock", async () => {
  O = client(app.port);
  const r = await O.post("/platform/auth/signup", { name: "Auto Owner", email: "auto@example.com", password: "supersecret1", restaurantName: "Auto Bistro", planKey: "growth", billingCycle: "monthly" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const slug = r.data.data.restaurant.slug;
  await O.post("/staff-auth/login", { restaurant: slug, email: "auto@example.com", password: "supersecret1" });
  venueId = (await O.get("/venues")).data[0].id;
  const bcrypt = require("bcrypt");
  ({ runInTenant } = require("../src/core/tenancy"));
  const { Restaurant } = require("../src/modules/platform/models");
  const { Admin } = require("../src/modules/auth/auth");
  rest = await Restaurant.findOne({ slug }).lean();
  await runInTenant(rest.id, () => Admin.create({ id: "chef_auto", name: "Chef Auto", email: "chef@auto.example", password: bcrypt.hashSync("supersecret1", 4), roleGroup: "Manager", roleTitle: "Chef", venueId }));
  chef = client(app.port);
  await chef.post("/staff-auth/login", { restaurant: slug, email: "chef@auto.example", password: "supersecret1" });
  sup = (await O.post("/inventory/suppliers", { name: "Auto Traders", phone: "9876543210", paymentTerms: "Net 15" })).data;
  flour = (await O.post("/inventory/items", { name: "Flour", baseUnit: "g", reorderPoint: 20000, minStock: 5000, trackBatches: true, trackExpiry: true, preferredSupplierId: sup.id })).data;
  rice = (await O.post("/inventory/items", { name: "Rice", baseUnit: "g" })).data;
  loc = (await O.post(`/inventory/locations${pv()}`, { code: "DRY", name: "Dry" })).data;
  const op = (item, qty, extra = {}) => O.post(`/inventory/stock/opening${pv()}`, { itemId: item.id, locationId: loc.id, qty, unit: "kg", unitCost: 40, ...extra });
  assert.equal((await op(flour, 10, { batchNo: "F1", expiryDate: days(3) })).status, 201);
  assert.equal((await op(rice, 8)).status, 201);
});

test("alerts: low stock and near expiry, permission and branch required", async () => {
  const a = await O.get(`/automation/alerts${pv()}`);
  assert.equal(a.status, 200, JSON.stringify(a.data));
  assert.ok(a.data.lowStock.some((x) => x.name === "Flour"), "10 kg is under the 20 kg reorder point");
  assert.ok(!a.data.lowStock.some((x) => x.name === "Rice"), "rice has no policy");
  assert.equal(a.data.nearExpiry[0].batchNo, "F1"); assert.ok(a.data.nearExpiry[0].daysLeft <= 3);
  assert.equal((await O.get("/automation/alerts")).data.code, "VENUE_REQUIRED");
  assert.equal((await chef.get("/automation/alerts")).status, 200, "chefs may read alerts for their own branch");
  const { ConsumptionIssue } = require("../src/modules/inventory/automationModels");
  await runInTenant(rest.id, () => ConsumptionIssue.create({ venueId, orderId: "o1", itemId: flour.id, itemName: "Flour", kind: "shortfall", shortfallMilli: 500, unit: "g" }));
  const b = (await O.get(`/automation/alerts${pv()}`)).data;
  assert.equal(b.consumptionIssues.length, 1);
  assert.equal((await O.post(`/automation/alerts/consumption-issues/${b.consumptionIssues[0].id}/resolve${pv()}`, {})).status, 200);
  assert.equal((await O.get(`/automation/alerts${pv()}`)).data.consumptionIssues.length, 0);
});

test("settings are validated and audited", async () => {
  assert.equal((await O.put("/automation/settings", { expiryAlertDays: 0 })).status, 400);
  const s = await O.put("/automation/settings", { expiryAlertDays: 2, whatsappPurchaseTemplate: "purchase_list_v1" });
  assert.equal(s.status, 200); assert.equal(s.data.expiryAlertDays, 2); assert.equal(s.data.whatsappConfigured, false, "no API key yet");
  assert.equal((await O.get(`/automation/alerts${pv()}`)).data.nearExpiry.length, 0, "3-day expiry is outside the 2-day window");
  assert.equal((await chef.put("/automation/settings", { expiryAlertDays: 30 })).status, 403);
  await O.put("/automation/settings", { expiryAlertDays: 7 });
});

test("stock audit: blind count, variance, maker-checker, idempotent posting", async () => {
  const c = await chef.post(`/automation/audits`, { title: "Weekly dry store", locationId: loc.id });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  audit1 = c.data;
  assert.equal(audit1.lines.length, 2); assert.equal(audit1.lines[0].system, null, "blind count hides the system quantity");
  assert.equal((await chef.post(`/automation/audits`, { locationId: loc.id })).data.code, "AUDIT_OPEN");
  const fi = audit1.lines.find((l) => l.itemName === "Flour").index, ri = audit1.lines.find((l) => l.itemName === "Rice").index;
  assert.equal((await chef.post(`/automation/audits/${audit1.id}/submit`, {})).data.code, "UNCOUNTED");
  assert.equal((await chef.put(`/automation/audits/${audit1.id}/counts`, { counts: [{ index: fi, qty: 9.5, unit: "kg" }, { index: ri, qty: 8, unit: "kg" }] })).status, 200);
  assert.equal((await chef.post(`/automation/audits/${audit1.id}/submit`, {})).data.code, "REASON_REQUIRED");
  await chef.put(`/automation/audits/${audit1.id}/counts`, { counts: [{ index: fi, qty: 9.5, unit: "kg", reason: "spillage during decanting" }] });
  const sub = await chef.post(`/automation/audits/${audit1.id}/submit`, {});
  assert.equal(sub.status, 200, JSON.stringify(sub.data)); assert.equal(sub.data.status, "pending_approval");
  const fl = sub.data.lines.find((l) => l.index === fi);
  assert.equal(fl.system, 10000); assert.equal(fl.variance, -500); assert.equal(fl.varianceValue, -20, "500 g at Rs40/kg");
  assert.equal(sub.data.shrink, 20);
  assert.equal((await chef.post(`/automation/audits/${audit1.id}/approve`, {})).status, 403, "chef lacks purchase approval permission");
  assert.equal((await O.post(`/automation/audits/${audit1.id}/post`, {})).data.code, "BAD_STATE", "cannot post before approval");
  const ap = await O.post(`/automation/audits/${audit1.id}/approve`, {});
  assert.equal(ap.status, 200, JSON.stringify(ap.data)); assert.equal(ap.data.status, "approved");
  const p = await O.post(`/automation/audits/${audit1.id}/post`, {});
  assert.equal(p.status, 200, JSON.stringify(p.data)); assert.equal(p.data.posted, 1, "only the variance line is posted");
  assert.equal((await O.post(`/automation/audits/${audit1.id}/post`, {})).data.code, "BAD_STATE");
  const stock = (await O.get(`/inventory/stock/items${pv()}`)).data.data.find((r) => r.name === "Flour");
  assert.equal(stock.onHand, 9500);
  const led = (await O.get(`/inventory/ledger${pv()}&itemId=${flour.id}`)).data.data.find((e) => e.type === "adjustment_out");
  assert.match(led.reason, /Stock audit AUD-\d+: spillage/);
  const again = await O.post(`/automation/audits${pv()}`, { locationId: loc.id });
  assert.equal(again.status, 201, JSON.stringify(again.data) + " a new audit can open once the old one is posted");
});

test("self-approval of an audit is blocked unless the purchase settings allow it", async () => {
  const list = (await O.get(`/automation/audits?status=counting`)).data.data;
  const a = (await O.get(`/automation/audits/${list[0].id}`)).data;
  await O.put(`/automation/audits/${a.id}/counts`, { counts: a.lines.map((l) => ({ index: l.index, qty: 0, reason: "recount" })) });
  assert.equal((await O.post(`/automation/audits/${a.id}/submit`, {})).status, 200);
  assert.equal((await O.post(`/automation/audits/${a.id}/approve`, {})).data.code, "SELF_APPROVAL");
  assert.equal((await O.post(`/automation/audits/${a.id}/reject`, { reason: "count again" })).data.status, "counting");
  assert.equal((await O.post(`/automation/audits/${a.id}/cancel`, {})).data.status, "cancelled");
});

test("supplier scorecards stay unrated without enough receipts", async () => {
  const r = await O.get("/automation/suppliers/performance");
  assert.equal(r.status, 200);
  const row = r.data.data.find((x) => x.supplierId === sup.id);
  assert.equal(row.grade, "unrated"); assert.equal(row.score, null); assert.equal(r.data.weights.onTimePct, 30);
  assert.equal((await chef.get("/automation/suppliers/performance")).status, 200, "chefs may read scorecards");
  assert.equal((await chef.put("/automation/settings", { dueSoonDays: 5 })).status, 403);
});

test("forecast and consumption endpoints respond with honest empty data", async () => {
  const f = await O.get(`/automation/forecast${pv()}`);
  assert.equal(f.status, 200); assert.deepEqual(f.data.data, []); assert.match(f.data.note, /reservations/);
  const c = await O.get(`/automation/consumption${pv()}`);
  assert.equal(c.status, 200); assert.equal(c.data.coverage.unlinkedCount, 0);
  assert.equal((await O.get(`/automation/consumption${pv()}&from=2026-01-01&to=2025-01-01`)).status, 400);
});

test("WhatsApp purchase list: preview, config checks, send, duplicate guard, log", async () => {
  const body = { supplierId: sup.id, lines: [{ itemId: flour.id, qty: 25, unit: "kg" }, { itemId: rice.id, qty: 10, unit: "kg" }] };
  const pre = await O.post(`/automation/whatsapp/purchase-list/preview${pv()}`, body);
  assert.equal(pre.status, 200, JSON.stringify(pre.data));
  assert.equal(pre.data.itemCount, 2); assert.equal(pre.data.phoneValid, true); assert.match(pre.data.variables[2], /Flour 25 kg; Rice 10 kg/);
  assert.ok(!JSON.stringify(pre.data).includes("9876543210"), "phone number is masked");
  delete process.env.AISENSY_API_KEY;
  assert.equal((await O.post(`/automation/whatsapp/purchase-list/send${pv()}`, body)).data.code, "NOT_CONFIGURED");
  process.env.AISENSY_API_KEY = "test-key";
  const calls = [];
  global.fetch = async (url, opts) => {
    if (String(url).includes("aisensy")) { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: 1 }) }; }
    return realFetch(url, opts);
  };
  const s = await O.post(`/automation/whatsapp/purchase-list/send${pv()}`, body);
  assert.equal(s.status, 201, JSON.stringify(s.data));
  assert.equal(calls.length, 1); assert.equal(calls[0].destination, "919876543210"); assert.equal(calls[0].campaignName, "purchase_list_v1");
  assert.equal((await O.post(`/automation/whatsapp/purchase-list/send${pv()}`, body)).data.code, "DUPLICATE_SEND");
  assert.equal(calls.length, 1, "the duplicate was not sent");
  global.fetch = async (url, opts) => (String(url).includes("aisensy") ? { ok: false, status: 500, text: async () => "boom" } : realFetch(url, opts));
  const bad = await O.post(`/automation/whatsapp/purchase-list/send${pv()}`, { ...body, force: true });
  assert.equal(bad.status, 502); assert.equal(bad.data.code, "SEND_FAILED");
  const log = (await O.get(`/automation/whatsapp/log${pv()}`)).data;
  assert.deepEqual(log.data.map((l) => l.status).sort(), ["failed", "sent"]);
  assert.equal((await chef.post(`/automation/whatsapp/purchase-list/send${pv()}`, body)).status, 403);
  const noPhone = (await O.post("/inventory/suppliers", { name: "No Phone Co" })).data;
  assert.equal((await O.post(`/automation/whatsapp/purchase-list/send${pv()}`, { ...body, supplierId: noPhone.id })).data.code, "NO_PHONE");
  delete process.env.AISENSY_API_KEY;
});
