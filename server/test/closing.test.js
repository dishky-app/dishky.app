// Daily closing checklist: cylinders, food wastage, EB readings, cash in hand and tally.
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let app, O, venueId;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

const body = (over = {}) => ({
  date: "2026-10-30", venueId,
  cylinders: [{ label: "Kitchen 1", type: "LPG 19 kg", remainingKg: 12.5, inUse: true }, { label: "Kitchen 2", remainingKg: 19 }],
  foodWastage: [{ dish: "Biryani", quantity: 1.5, unit: "kg", reason: "Unsold" }, { dish: "Paneer Tikka", quantity: 6, unit: "portion" }],
  electricity: [{ label: "Main EB", serviceNo: "0123", reading: 1000 }, { label: "AC board", reading: 400 }],
  tally: { systemSales: 10000, cash: 4000, upi: 5000, card: 900, other: 0 },
  cash: { openingFloat: 2000, cashExpenses: 500, cashInHand: 5450 },
  checks: [{ label: "Gas off", done: true }, { label: "Doors locked", done: true }],
  ...over,
});

test("setup", async () => {
  O = client(app.port);
  const su = await O.post("/platform/auth/signup", { name: "Cl Owner", email: "cl@example.com", password: "supersecret1", restaurantName: "Cl Cafe", planKey: "growth", billingCycle: "monthly" });
  assert.equal(su.status, 201, JSON.stringify(su.data));
  await O.post("/staff-auth/login", { restaurant: su.data.data.restaurant.slug, email: "cl@example.com", password: "supersecret1" });
  venueId = (await O.get("/venues")).data[0].id;
});

test("create computes tally, cash variance and keeps multiple rows", async () => {
  const r = await O.post("/closing", body());
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.cylinders.length, 2); assert.equal(r.data.foodWastage.length, 2); assert.equal(r.data.electricity.length, 2);
  assert.equal(r.data.tally.collected, 9900); assert.equal(r.data.tally.difference, -100, "Rs 100 short of POS sales");
  assert.equal(r.data.cash.expectedCash, 5500); assert.equal(r.data.cash.variance, -50);
  assert.equal(r.data.electricity[0].consumption, null, "first reading has nothing to subtract");
  assert.equal((await O.post("/closing", body())).data.code, "EXISTS");
  assert.equal((await O.post("/closing", body({ date: "2999-01-01" }))).status, 400);
  assert.equal((await O.post("/closing", body({ date: "2026-10-29", cylinders: [{ label: "x" }] }))).status, 400, "cylinder balance required");
});

test("submit needs every check ticked, then locks; manager reopens", async () => {
  const id = `closing_${venueId}_2026-10-30`;
  const open = await O.put(`/closing/${id}`, body({ checks: [{ label: "Gas off", done: true }, { label: "Doors locked", done: false }] }));
  assert.equal(open.status, 200);
  assert.equal((await O.post(`/closing/${id}/submit`, {})).data.code, "CHECKS_OPEN");
  await O.put(`/closing/${id}`, body());
  assert.equal((await O.post(`/closing/${id}/submit`, {})).status, 200);
  assert.equal((await O.put(`/closing/${id}`, body())).data.code, "LOCKED");
  assert.equal((await O.del(`/closing/${id}`)).data.code, "LOCKED");
  assert.equal((await O.post(`/closing/${id}/reopen`, {})).status, 200);
});

test("next day: prefill carries cylinders and meters, consumption is reading minus last reading", async () => {
  const p = (await O.get(`/closing/prefill?date=2026-10-31&venueId=${venueId}`)).data;
  assert.deepEqual(p.cylinders.map((c) => c.label), ["Kitchen 1", "Kitchen 2"]);
  assert.equal(p.electricity[0].previousReading, 1000);
  assert.ok(p.checks.length >= 6);
  const b = body({ date: "2026-10-31", electricity: [{ label: "Main EB", reading: 1042.5 }, { label: "AC board", reading: 399 }] });
  const low = await O.post("/closing", b);
  assert.equal(low.data.code, "READING_LOWER");
  b.electricity[1] = { label: "AC board", reading: 399, meterReset: true };
  const ok = await O.post("/closing", b);
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.electricity[0].consumption, 42.5);
  assert.equal(ok.data.electricity[1].consumption, null, "replaced meter has no consumption");
  const list = (await O.get(`/closing?from=2026-10-01&to=2026-10-31&venueId=${venueId}`)).data;
  assert.equal(list.length, 2); assert.equal(list[0].date, "2026-10-31");
});
