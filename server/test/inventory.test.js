// Purchase & inventory — Phase 1 (inventory foundation).
// The test database (FerretDB) has no transactions, so these run with the explicit dev-only
// override. The 503 refusal test proves the module does NOT silently fall back otherwise.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");
const P = require("../src/modules/inventory/precision");
const U = require("../src/modules/inventory/units");

/* ───────────── pure unit tests ───────────── */
test("precision: decimal -> integer scaling is exact", () => {
  assert.equal(P.toMilli("1.25"), 1250);
  assert.equal(P.toMilli(0.1) + P.toMilli(0.2), P.toMilli(0.3)); // no float drift
  assert.equal(P.toMilli("0.0005"), 1); // half rounds away from zero
  assert.equal(P.toMilli("-2.5"), -2500);
  assert.equal(P.toPaise("12.50"), 1250);
  assert.throws(() => P.toMilli("abc"), /plain decimal/);
  assert.throws(() => P.toMilli(""), /required/);
  assert.throws(() => P.toMilli("1e3"), /plain decimal/);
});

test("precision: value and weighted average use BigInt and round once", () => {
  // 2.5 kg(base g -> 2500000 milli-g) at Rs 0.12/g (120000 micro) = Rs 300.00
  assert.equal(P.valuePaise(2500000, 120000), 30000);
  assert.equal(P.valuePaise(3, 1), 0);
  // 10 @ Rs 4 and 30 @ Rs 8 -> Rs 7 average
  assert.equal(P.weightedAverageMicro(10000, 4000000, 30000, 8000000), 7000000);
  // huge values do not overflow doubles
  assert.equal(P.valuePaise(9e12, 9e9) > 0, true);
});

test("units: system conversions and incompatible units", () => {
  const item = { baseUnit: "g", conversions: [{ unit: "carton", factor: 24 }] };
  assert.equal(U.toBaseMilli("1.5", "kg", item), 1500000); // 1.5 kg = 1500 g
  assert.equal(U.toBaseMilli(2, "g", item), 2000);
  assert.equal(U.toBaseMilli(2, "carton", item), 48000); // item-declared packaging
  assert.throws(() => U.toBaseMilli(1, "l", item), /Cannot convert volume/);
  assert.throws(() => U.toBaseMilli(1, "box", item), /Unknown unit/);
  const pcs = { baseUnit: "pcs", conversions: [] };
  assert.equal(U.toBaseMilli(2, "dozen", pcs), 24000);
  // packaging units are never built in
  assert.throws(() => U.toBaseMilli(1, "carton", pcs), /Unknown unit/);
});

test("units: item unit set validation", () => {
  assert.ok(U.validateItemUnits({ baseUnit: "kg", purchaseUnit: "g" }));
  assert.throws(() => U.validateItemUnits({ baseUnit: "kg", purchaseUnit: "l" }), /Add a conversion/);
  assert.throws(() => U.validateItemUnits({ baseUnit: "kg", conversions: [{ unit: "kg", factor: 1 }] }), /Duplicate/);
  assert.throws(() => U.validateItemUnits({ baseUnit: "kg", conversions: [{ unit: "bag", factor: 0 }] }), /Invalid conversion/);
  assert.throws(() => U.validateItemUnits({ baseUnit: "zzz" }), /Unknown base unit/);
});

/* ───────────── API integration ───────────── */
let app;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

async function tenant(name) {
  const c = client(app.port);
  const email = `${name.toLowerCase().replace(/\W/g, "")}@example.com`;
  const r = await c.post("/platform/auth/signup", {
    name, email, password: "supersecret1", restaurantName: `${name} Kitchen`, planKey: "growth", billingCycle: "monthly",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const slug = r.data.data.restaurant.slug;
  const l = await c.post("/staff-auth/login", { restaurant: slug, email, password: "supersecret1" });
  assert.equal(l.status, 200, JSON.stringify(l.data));
  const venues = await c.get("/venues");
  const v = `?venueId=${venues.data[0].id}`;
  return { c, slug, venueId: venues.data[0].id, v };
}

let A, B, loc, flour, ghee;
test("setup: tenants, location and items", async () => {
  A = await tenant("Inv Alpha");
  B = await tenant("Inv Beta");
  const l = await A.c.post(`/inventory/locations${A.v}`, { code: "dry1", name: "Dry store" });
  assert.equal(l.status, 201, JSON.stringify(l.data));
  loc = l.data;
  assert.equal(loc.code, "DRY1");
  assert.equal((await A.c.post(`/inventory/locations${A.v}`, { code: "DRY1", name: "dup" })).status, 409);
  assert.equal((await A.c.post("/inventory/locations", { code: "X", name: "x" })).status, 400, "Super Admin must name a branch");

  const f = await A.c.post("/inventory/items", { name: "Wheat flour", baseUnit: "g", conversions: [{ unit: "bag", factor: 25000 }], purchaseUnit: "bag", reorderPoint: 5000, minStock: 2000 });
  assert.equal(f.status, 201, JSON.stringify(f.data));
  flour = f.data;
  assert.match(flour.sku, /^ITM-\d{5}$/);
  const g = await A.c.post("/inventory/items", { name: "Ghee", baseUnit: "ml", trackBatches: true, trackExpiry: true, barcode: "8901234" });
  assert.equal(g.status, 201, JSON.stringify(g.data));
  ghee = g.data;
});

test("items: unit and barcode rules", async () => {
  const bad = await A.c.post("/inventory/items", { name: "Bad", baseUnit: "g", purchaseUnit: "l" });
  assert.equal(bad.status, 400);
  assert.equal((await A.c.post("/inventory/items", { name: "Dup barcode", baseUnit: "pcs", barcode: "8901234" })).status, 409);
  const look = await A.c.get("/inventory/items/lookup?barcode=8901234");
  assert.equal(look.data.id, ghee.id);
  assert.equal((await A.c.get("/inventory/items/lookup?barcode=nope")).status, 404);
  const list = await A.c.get("/inventory/items?search=flour");
  assert.equal(list.data.total, 1);
});

test("suppliers: validation, masking, blocking", async () => {
  const s = await A.c.post("/inventory/suppliers", {
    name: "Sharma Traders", gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", creditLimit: "50000.50",
    bank: { accountName: "Sharma", bankName: "SBI", branch: "MG Road", ifsc: "sbin0001234", accountType: "current", accountNumber: "1234 5678 9012 3456" },
  });
  assert.equal(s.status, 201, JSON.stringify(s.data));
  assert.match(s.data.code, /^SUP-\d{5}$/);
  assert.equal(s.data.bank.accountLast4, "3456");
  assert.equal(s.data.bank.ifsc, "SBIN0001234");
  assert.equal(s.data.bank.hasAccountNumber, true);
  assert.equal(JSON.stringify(s.data).includes("1234567890123456"), false, "list/detail responses never carry the account number");
  assert.equal(JSON.stringify((await A.c.get(`/inventory/suppliers/${s.data.id}`)).data).includes("1234567890123456"), false);
  // stored encrypted, not in clear
  const { Supplier } = require("../src/modules/inventory/models");
  const { runAsPlatform } = require("../src/core/tenancy");
  const raw = await runAsPlatform(() => Supplier.findOne({ id: s.data.id }).lean());
  assert.equal(JSON.stringify(raw).includes("1234567890123456"), false, "encrypted at rest");
  const full = await A.c.get(`/inventory/suppliers/${s.data.id}/bank`);
  assert.equal(full.data.accountNumber, "1234567890123456");
  assert.equal((await A.c.post("/inventory/suppliers", { name: "Bad acct", bank: { accountNumber: "12ab" } })).status, 400);
  assert.equal((await A.c.post("/inventory/suppliers", { name: "Bad ifsc", bank: { ifsc: "XYZ" } })).status, 400);
  assert.equal((await B.c.get(`/inventory/suppliers/${s.data.id}/bank`)).status, 404, "other tenant cannot reveal it");
  assert.equal(s.data.creditLimit, 50000.5);
  assert.equal((await A.c.post("/inventory/suppliers", { name: "x", gstin: "BAD" })).status, 400);
  assert.equal((await A.c.post("/inventory/suppliers", { name: "Same code", code: s.data.code.toLowerCase() })).status, 409);
  assert.equal((await A.c.post(`/inventory/suppliers/${s.data.id}/status`, { status: "blocked" })).status, 400, "reason required");
  const blocked = await A.c.post(`/inventory/suppliers/${s.data.id}/status`, { status: "blocked", reason: "Quality" });
  assert.equal(blocked.status, 200, JSON.stringify(blocked.data));
  assert.equal(blocked.data.status, "blocked");
  assert.equal((await B.c.get(`/inventory/suppliers/${s.data.id}`)).status, 404, "other tenant cannot read it");
});

const post = (t, path, body, h) => t.c.post(`/inventory${path}${t.v}`, body, h);

test("opening stock: converts units, is replay-safe, derives value", async () => {
  const body = { itemId: flour.id, locationId: loc.id, qty: 2, unit: "bag", unitCost: 900 }; // Rs 900 per bag
  const r1 = await post(A, "/stock/opening", body);
  assert.equal(r1.status, 201, JSON.stringify(r1.data));
  assert.equal(r1.data.entry.qtyIn, 50000); // 2 bags * 25 kg = 50000 g
  assert.equal(r1.data.entry.unit, "g");
  assert.equal(r1.data.entry.unitCost, 0.036); // Rs 900 / 25000 g
  assert.equal(r1.data.entry.valueImpact, 1800);
  const r2 = await post(A, "/stock/opening", body);
  assert.equal(r2.status, 200);
  assert.equal(r2.data.replayed, true);
  assert.equal(r2.data.entry.id, r1.data.entry.id);
  const stock = await A.c.get(`/inventory/stock${A.v}`);
  assert.equal(stock.data.data.length, 1);
  assert.equal(stock.data.data[0].onHand, 50000);
  assert.equal(stock.data.data[0].stockValue, 1800);
});

test("batch/expiry rules are enforced for tracked items", async () => {
  const base = { itemId: ghee.id, locationId: loc.id, qty: 10, unit: "ml", unitCost: 0.5 };
  assert.equal((await post(A, "/stock/opening", base)).status, 400, "batch required");
  assert.equal((await post(A, "/stock/opening", { ...base, batchNo: "B1" })).status, 400, "expiry required");
  const past = new Date(Date.now() - 864e5).toISOString();
  const soon = new Date(Date.now() + 3 * 864e5).toISOString();
  assert.equal((await post(A, "/stock/opening", { ...base, batchNo: "OLD", expiryDate: past, qty: 100 })).status, 201);
  assert.equal((await post(A, "/stock/opening", { ...base, batchNo: "NEW", expiryDate: soon, qty: 200 })).status, 201);
  const exp = await A.c.get(`/inventory/stock${A.v}&view=expired`);
  assert.deepEqual(exp.data.data.map((r) => r.batchNo), ["OLD"]);
  assert.equal(exp.data.data[0].available, 0, "expired stock is never available");
  const near = await A.c.get(`/inventory/stock${A.v}&view=near_expiry&days=7`);
  assert.deepEqual(near.data.data.map((r) => r.batchNo), ["NEW"]);
  // same batch, different expiry -> refused
  const clash = await post(A, "/stock/adjust", { ...base, batchNo: "NEW", direction: "in", reason: "recount", expiryDate: past });
  assert.equal(clash.status, 409);
});

test("adjustments: reason required, no negative stock, balances & cost", async () => {
  const key = { itemId: flour.id, locationId: loc.id, unit: "g" };
  assert.equal((await post(A, "/stock/adjust", { ...key, qty: 1, direction: "out" })).status, 400, "reason required");
  const tooMuch = await post(A, "/stock/adjust", { ...key, qty: 50001, direction: "out", reason: "count" });
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.data.code, "INSUFFICIENT_STOCK");
  const out = await post(A, "/stock/adjust", { ...key, qty: 10, unit: "kg", direction: "out", reason: "Found short" });
  assert.equal(out.status, 201);
  assert.equal(out.data.entry.balanceAfter, 40000);
  assert.equal(out.data.entry.valueImpact, -360);
  // weighted average: 40000 g @0.036 + 10000 g @0.06 -> 0.0408
  const inn = await post(A, "/stock/adjust", { ...key, qty: 10000, direction: "in", reason: "Found", unitCost: 0.06 });
  assert.equal(inn.status, 201);
  const row = (await A.c.get(`/inventory/stock${A.v}&itemId=${flour.id}`)).data.data[0];
  assert.equal(row.onHand, 50000);
  assert.equal(row.unitCost, 0.0408);
});

test("waste, quarantine and release move the right buckets", async () => {
  const key = { itemId: flour.id, locationId: loc.id, unit: "g" };
  assert.equal((await post(A, "/stock/waste", { ...key, qty: 1 })).status, 400, "wasteReason required");
  assert.equal((await post(A, "/stock/waste", { ...key, qty: 1000, wasteReason: "spillage" })).status, 201);
  const q = await post(A, "/stock/status", { ...key, qty: 5000, action: "quarantine", reason: "Inspection pending" });
  assert.equal(q.status, 201);
  assert.equal(q.data.entry.qtyIn + q.data.entry.qtyOut, 0);
  let row = (await A.c.get(`/inventory/stock${A.v}&itemId=${flour.id}`)).data.data[0];
  assert.equal(row.onHand, 49000); assert.equal(row.quarantined, 5000); assert.equal(row.available, 44000);
  // quarantined stock cannot be taken as available
  assert.equal((await post(A, "/stock/adjust", { ...key, qty: 45000, direction: "out", reason: "x" })).status, 409);
  assert.equal((await post(A, "/stock/status", { ...key, qty: 5000, action: "release", reason: "Passed" })).status, 201);
  row = (await A.c.get(`/inventory/stock${A.v}&itemId=${flour.id}`)).data.data[0];
  assert.equal(row.quarantined, 0); assert.equal(row.available, 49000);
  assert.equal((await A.c.get(`/inventory/stock${A.v}&view=quarantined`)).data.total, 0);
});

test("concurrency: parallel withdrawals can never overdraw", async () => {
  const it = (await A.c.post("/inventory/items", { name: "Saffron", baseUnit: "g" })).data;
  const key = { itemId: it.id, locationId: loc.id, unit: "g" };
  assert.equal((await post(A, "/stock/opening", { ...key, qty: 5, unitCost: 100 })).status, 201);
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) => post(A, "/stock/adjust", { ...key, qty: 1, direction: "out", reason: `r${i}`, idempotencyKey: `k${i}` }))
  );
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 5, `exactly 5 may succeed, got ${ok}: ${JSON.stringify(results.map((r) => [r.status, r.data.code || r.data.error]))}`);
  assert.ok(results.every((r) => [201, 409].includes(r.status)));
  const row = (await A.c.get(`/inventory/stock${A.v}&itemId=${it.id}&view=all&includeEmpty=true`)).data.data[0];
  assert.equal(row.onHand, 0);
  // the ledger agrees with the balance
  const led = (await A.c.get(`/inventory/ledger${A.v}&itemId=${it.id}`)).data.data;
  const net = led.reduce((s, e) => s + e.qtyIn - e.qtyOut, 0);
  assert.equal(net, 0);
});

test("idempotency: same key twice posts once; key reuse on another item is refused", async () => {
  const key = { itemId: flour.id, locationId: loc.id, unit: "g", qty: 100, direction: "out", reason: "dup test" };
  const gheeKey = { ...key, itemId: ghee.id, unit: "ml", batchNo: "NEW" };
  const [a, b] = await Promise.all([
    post(A, "/stock/adjust", { ...key, idempotencyKey: "same" }),
    post(A, "/stock/adjust", { ...key, idempotencyKey: "same" }),
  ]);
  assert.equal([a, b].filter((r) => r.data.replayed === false).length, 1, JSON.stringify([a, b]));
  assert.equal(a.data.entry.id, b.data.entry.id);
  const other = await post(A, "/stock/adjust", { ...gheeKey, idempotencyKey: "same" });
  assert.equal(other.status, 409);
  assert.equal(other.data.code, "IDEMPOTENCY_CONFLICT");
});

test("ledger: reversal posts once, links to the original, is not re-reversible", async () => {
  const key = { itemId: flour.id, locationId: loc.id, unit: "g" };
  const before = (await A.c.get(`/inventory/stock${A.v}&itemId=${flour.id}`)).data.data[0].onHand;
  const out = await post(A, "/stock/adjust", { ...key, qty: 700, direction: "out", reason: "mistake" });
  const id = out.data.entry.id;
  assert.equal((await A.c.post(`/inventory/ledger/${id}/reverse${A.v}`, {})).status, 400, "reason required");
  const rev = await A.c.post(`/inventory/ledger/${id}/reverse${A.v}`, { reason: "Entered in error" });
  assert.equal(rev.status, 201, JSON.stringify(rev.data));
  assert.equal(rev.data.entry.type, "reversal");
  assert.equal(rev.data.entry.reversalOf, id);
  assert.equal(rev.data.entry.qtyIn, 700);
  const again = await A.c.post(`/inventory/ledger/${id}/reverse${A.v}`, { reason: "twice" });
  assert.equal(again.data.replayed, true, "second reversal replays the first");
  assert.equal((await A.c.get(`/inventory/stock${A.v}&itemId=${flour.id}`)).data.data[0].onHand, before);
  assert.equal((await A.c.post(`/inventory/ledger/${rev.data.entry.id}/reverse${A.v}`, { reason: "undo undo" })).status, 409);
});

test("ledger is append-only at the model level", async () => {
  const { StockLedger } = require("../src/modules/inventory/models");
  const { runInTenant } = require("../src/core/tenancy");
  const rid = (await A.c.get("/staff-auth/me")).data.restaurantId;
  await assert.rejects(() => runInTenant(rid || "x", () => StockLedger.updateOne({}, { $set: { reason: "tamper" } })), /append-only/);
  await assert.rejects(() => runInTenant(rid || "x", () => StockLedger.deleteMany({})), /append-only/);
});

test("stock overview by item flags low and out-of-stock", async () => {
  const r = await A.c.get(`/inventory/stock/items${A.v}`);
  assert.equal(r.status, 200);
  const by = Object.fromEntries(r.data.data.map((x) => [x.name, x.reorderStatus]));
  assert.equal(by["Saffron"], "out_of_stock");
  assert.equal(by["Wheat flour"], "ok");
  const low = await A.c.get(`/inventory/stock/items${A.v}&view=out_of_stock`);
  assert.ok(low.data.data.every((x) => x.reorderStatus === "out_of_stock"));
});

test("tenant isolation: another restaurant sees none of this", async () => {
  assert.equal((await B.c.get("/inventory/items")).data.total, 0);
  assert.equal((await B.c.get(`/inventory/ledger${B.v}`)).data.total, 0);
  assert.equal((await B.c.get(`/inventory/stock${B.v}`)).data.total, 0);
  assert.equal((await B.c.get(`/inventory/items/${flour.id}`)).status, 404);
  // cannot post against another tenant's item or location
  const x = await B.c.post(`/inventory/stock/opening${B.v}`, { itemId: flour.id, locationId: loc.id, qty: 1 });
  assert.equal(x.status, 404);
});

test("posting is refused (503) rather than unsafe when transactions are unavailable", async () => {
  process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "false";
  try {
    const r = await post(A, "/stock/adjust", { itemId: flour.id, locationId: loc.id, qty: 1, unit: "g", direction: "out", reason: "x" });
    assert.equal(r.status, 503);
    assert.equal(r.data.code, "TRANSACTIONS_REQUIRED");
  } finally {
    process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
  }
});

test("unauthenticated and plan-gated access is refused", async () => {
  assert.equal((await client(app.port).get("/inventory/items")).status, 401);
  const c = client(app.port);
  const r = await c.post("/platform/auth/signup", { name: "Tiny Owner", email: "tiny@example.com", password: "supersecret1", restaurantName: "Tiny Cafe", planKey: "starter", billingCycle: "monthly" });
  await c.post("/staff-auth/login", { restaurant: r.data.data.restaurant.slug, email: "tiny@example.com", password: "supersecret1" });
  const res = await c.get("/inventory/items");
  assert.equal(res.status, 402);
  assert.equal(res.data.code, "PLAN_UPGRADE_REQUIRED");
});
