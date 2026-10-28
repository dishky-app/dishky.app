// Option A: the stock ledger is the source of truth for linked ingredients; the legacy
// `ingredients.stockRemaining` (kg) is kept in step for the Stocks page and the menu.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let app, T, venueId, guest, flour, salt;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

test("setup: tenant with two legacy ingredients", async () => {
  const c = client(app.port);
  const r = await c.post("/platform/auth/signup", { name: "Bridge Owner", email: "bridge@example.com", password: "supersecret1", restaurantName: "Bridge Bistro", planKey: "growth", billingCycle: "monthly" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const slug = r.data.data.restaurant.slug;
  assert.equal((await c.post("/staff-auth/login", { restaurant: slug, email: "bridge@example.com", password: "supersecret1" })).status, 200);
  venueId = (await c.get("/venues")).data[0].id;
  T = c;
  guest = client(app.port, { "X-Restaurant": slug });
  await c.put("/tables/1", { id: 1, list: [1, 2, 3], venueId });
  const f = await c.post("/ingredients", { venueId, name: "Flour", stockRemaining: 10, pricePer100g: 5, stockMax: 50 });
  const s = await c.post("/ingredients", { venueId, name: "Salt", stockRemaining: 2, pricePer100g: 2 });
  assert.equal(f.status, 201, JSON.stringify(f.data));
  flour = f.data; salt = s.data;
});

const order = (name, grams, qty = 1, table = "1") => guest.post("/orders", {
  venueId, tableNo: table, userName: "Guest",
  items: [{ dishId: "__custom__", name: "Dish", quantity: qty, unitPrice: 100, totalPrice: 100 * qty, isCustomized: true, ingredients: [{ name, quantity: grams }] }],
});
const ing = async (id) => (await T.get(`/ingredients/${id}`)).data;
const ledger = async (q = "") => (await T.get(`/inventory/ledger?venueId=${venueId}&limit=200${q}`)).data.data;

test("import links ingredients, creates items and posts opening stock once", async () => {
  const r = await T.post(`/inventory/import-ingredients?venueId=${venueId}`, {});
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.created, 2); assert.equal(r.data.opened, 2); assert.deepEqual(r.data.skipped, []);
  const items = (await T.get("/inventory/items")).data.data;
  const fl = items.find((i) => i.name === "Flour");
  assert.equal(fl.baseUnit, "g"); assert.equal(fl.maxStock, 50000);
  const led = await ledger(`&itemId=${fl.id}`);
  assert.equal(led.length, 1);
  assert.equal(led[0].type, "opening"); assert.equal(led[0].qtyIn, 10000);
  assert.equal(led[0].unitCost, 0.05); // Rs 5 per 100 g
  assert.equal((await ing(flour.id)).stockRemaining, 10, "projection leaves the figure unchanged");
  // re-running is harmless
  const again = await T.post(`/inventory/import-ingredients?venueId=${venueId}`, {});
  assert.equal(again.data.linked + again.data.created + again.data.opened, 0);
  assert.equal((await ledger(`&itemId=${fl.id}`)).length, 1);
});

test("an order is consumed through the ledger and projected back to kg", async () => {
  const o = await order("Flour", 250, 2); // 250 g x 2 = 0.5 kg
  assert.equal(o.status, 201, JSON.stringify(o.data));
  const cons = (await ledger("&type=consumption"));
  assert.equal(cons.length, 1);
  assert.equal(cons[0].qtyOut, 500);
  assert.equal(cons[0].refType, "order");
  assert.equal(cons[0].refId.startsWith(o.data.id), true);
  assert.equal((await ing(flour.id)).stockRemaining, 9.5);
});

test("a second order appended to the same bill is booked separately", async () => {
  const o = await order("Flour", 1000, 1); // same table 1 -> appended to the open bill
  assert.equal(o.status, 201);
  assert.equal((await ledger("&type=consumption")).length, 2);
  assert.equal((await ing(flour.id)).stockRemaining, 8.5);
});

test("consumption never takes more than exists", async () => {
  const o = await order("Flour", 50000, 1, "2"); // 50 kg wanted, 8.5 kg exist
  assert.equal(o.status, 201);
  assert.equal((await ing(flour.id)).stockRemaining, 0);
  const rows = (await T.get(`/inventory/stock?venueId=${venueId}&includeEmpty=true`)).data.data.find((r) => r.itemName === "Flour");
  assert.equal(rows.onHand, 0, "ledger balance never goes negative");
  // the shortfall is remembered so the Alerts page can show it (Phase 5)
  const al = (await T.get(`/automation/alerts?venueId=${venueId}`)).data;
  assert.equal(al.consumptionIssues.length, 1, JSON.stringify(al.consumptionIssues));
  assert.equal(al.consumptionIssues[0].itemName, "Flour"); assert.equal(al.consumptionIssues[0].shortfall, 41500);
});

test("editing stock on the Stocks page becomes a ledger adjustment", async () => {
  const cur = await ing(flour.id);
  const put = await T.put(`/ingredients/${flour.id}`, { ...cur, stockRemaining: cur.stockRemaining + 4.5, venueId });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  assert.equal(put.data.stockRemaining, 4.5);
  const adj = await ledger("&type=adjustment_in");
  assert.equal(adj.length, 1); assert.equal(adj[0].qtyIn, 4500); assert.equal(adj[0].reason, "Stock edited on the Stocks page");
  assert.equal(adj[0].userName.length > 0, true, "attributed to the signed-in user");
  // lowering it works too
  const down = await T.patch(`/ingredients/${flour.id}`, { stockRemaining: 4, venueId });
  assert.equal(down.data.stockRemaining, 4);
  assert.equal((await ledger("&type=adjustment_out"))[0].qtyOut, 500);
});

test("manual ledger postings flow back to the Stocks figure", async () => {
  const item = (await T.get("/inventory/items?search=Flour")).data.data[0];
  const loc = (await T.get(`/inventory/locations?venueId=${venueId}`)).data[0];
  const w = await T.post(`/inventory/stock/waste?venueId=${venueId}`, { itemId: item.id, locationId: loc.id, qty: 1, unit: "kg", wasteReason: "spoilage" });
  assert.equal(w.status, 201, JSON.stringify(w.data));
  assert.equal((await ing(flour.id)).stockRemaining, 3);
});

test("unlinked ingredients keep the legacy behaviour", async () => {
  const sIng = await T.post("/ingredients", { venueId, name: "Pepper", stockRemaining: 1, pricePer100g: 9 });
  const o = await order("Pepper", 100, 1, "3");
  assert.equal(o.status, 201);
  assert.equal((await ing(sIng.data.id)).stockRemaining, 0.9);
  assert.equal((await ledger("&type=consumption")).filter((e) => e.itemName === "Pepper").length, 0);
});

test("ledger and projection agree", async () => {
  const items = (await T.get("/inventory/stock/items?venueId=" + venueId)).data.data;
  for (const [name, doc] of [["Flour", flour], ["Salt", salt]]) {
    const row = items.find((r) => r.name === name);
    assert.equal(row.available, (await ing(doc.id)).stockRemaining * 1000, `${name}: ledger grams == stockRemaining kg x 1000`);
  }
});
