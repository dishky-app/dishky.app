// Phase 3: goods receipt, inspection, quarantine, supplier returns, supplier performance.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");

let app, O, chef, venueId, supA, flour, milk, loc, po, restId;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

const pv = () => `?venueId=${venueId}`;
const ledger = async (q = "") => (await O.get(`/inventory/ledger${pv()}&limit=200${q}`)).data.data;
const stock = async (itemId) => (await O.get(`/inventory/stock${pv()}&includeEmpty=true`)).data.data.filter((r) => r.itemId === itemId);

async function newPo(lines, { send = true } = {}) {
  const r = await O.post(`/purchase/orders${pv()}`, { supplierId: supA.id, expectedDate: new Date(Date.now() + 5 * 864e5).toISOString(), lines });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  if (send) {
    await O.post(`/purchase/orders/${r.data.id}/submit`, {});
    await O.post(`/purchase/orders/${r.data.id}/approve`, {});
    const s = await O.post(`/purchase/orders/${r.data.id}/send`, { via: "email" });
    assert.equal(s.data.status, "sent", JSON.stringify(s.data));
  }
  return r.data;
}
const getPo = async (id) => (await O.get(`/purchase/orders/${id}`)).data;

test("setup", async () => {
  O = client(app.port);
  const r = await O.post("/platform/auth/signup", { name: "Recv Owner", email: "recv@example.com", password: "supersecret1", restaurantName: "Recv Bistro", planKey: "growth", billingCycle: "monthly" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const slug = r.data.data.restaurant.slug;
  await O.post("/staff-auth/login", { restaurant: slug, email: "recv@example.com", password: "supersecret1" });
  venueId = (await O.get("/venues")).data[0].id;
  const bcrypt = require("bcrypt");
  const { runInTenant } = require("../src/core/tenancy");
  const { Restaurant } = require("../src/modules/platform/models");
  const { Admin } = require("../src/modules/auth/auth");
  const rest = await Restaurant.findOne({ slug }).lean();
  restId = rest.id;
  await runInTenant(rest.id, () => Admin.create({ id: "chef_recv", name: "Chef Recv", email: "chef@recv.example", password: bcrypt.hashSync("supersecret1", 4), roleGroup: "Manager", roleTitle: "Chef", venueId }));
  chef = client(app.port);
  await chef.post("/staff-auth/login", { restaurant: slug, email: "chef@recv.example", password: "supersecret1" });
  assert.equal((await O.patch("/purchase/settings", { allowSelfApproval: true, allowManualPo: true, gstStateCode: "29" })).status, 200);
  supA = (await O.post("/inventory/suppliers", { name: "Recv Traders", gstin: "29ABCDE1234F1Z5" })).data;
  flour = (await O.post("/inventory/items", { name: "Flour", baseUnit: "g", gstRate: 5 })).data;
  milk = (await O.post("/inventory/items", { name: "Milk", baseUnit: "ml", trackBatches: true, trackExpiry: true, gstRate: 0 })).data;
  loc = (await O.post(`/inventory/locations${pv()}`, { code: "DRY", name: "Dry store" })).data;
  assert.ok(supA.id && flour.id && milk.id && loc.id);
  po = await newPo([{ itemId: flour.id, qty: 100, unit: "kg", unitPrice: 40, gstRate: 5 }]);
});

test("receiving needs a sent order and consistent quantities", async () => {
  const draft = await newPo([{ itemId: flour.id, qty: 10, unit: "kg", unitPrice: 40 }], { send: false });
  const g = (poId, lines) => O.post("/receiving/grns", { poId, locationId: loc.id, lines });
  assert.equal((await g(draft.id, [{ itemId: flour.id, delivered: 10, unit: "kg" }])).data.code, "PO_NOT_RECEIVABLE");
  assert.equal((await g(po.id, [{ itemId: flour.id, delivered: 60, accepted: 50, rejected: 5, unit: "kg", reason: "x" }])).data.code, "QTY_MISMATCH");
  assert.equal((await g(po.id, [{ itemId: flour.id, delivered: 60, accepted: 55, rejected: 5, unit: "kg" }])).data.code, "REASON_REQUIRED");
  assert.equal((await g(po.id, [{ itemId: milk.id, delivered: 1, unit: "l" }])).data.code, "NOT_ON_PO");
  assert.equal((await g(po.id, [{ itemId: flour.id, delivered: 150, unit: "kg" }])).data.code, "OVER_RECEIPT");
});

let grn1;
test("partial delivery: accepted, quarantined and rejected are handled separately and posting is idempotent", async () => {
  const c = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, deliveryNoteNo: "DN-1", lines: [{ itemId: flour.id, delivered: 60, accepted: 55, quarantined: 3, rejected: 2, unit: "kg", reason: "damaged bags", checks: { packagingOk: false, tempC: 22 } }] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  grn1 = c.data;
  assert.match(grn1.grnNo, /^GRN-\d+$/);
  assert.equal(grn1.lines[0].unitCost, 0.04, "net of discount, before GST");
  assert.equal((await stock(flour.id)).length, 0, "nothing in stock before posting");

  const p = await O.post(`/receiving/grns/${grn1.id}/post`, {});
  assert.equal(p.status, 201, JSON.stringify(p.data));
  assert.equal(p.data.status, "posted"); assert.equal(typeof p.data.onTime, "boolean");
  const rows = await stock(flour.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].onHand, 58000, "55 kg + 3 kg kept; 2 kg rejected never enters stock");
  assert.equal(rows[0].quarantined, 3000); assert.equal(rows[0].available, 55000);
  const led = await ledger(`&itemId=${flour.id}`);
  assert.equal(led.filter((e) => e.type === "receipt").length, 1);
  assert.equal(led.find((e) => e.type === "receipt").refType, "grn");

  const again = await O.post(`/receiving/grns/${grn1.id}/post`, {});
  assert.equal(again.status, 200); assert.equal((await ledger(`&itemId=${flour.id}`)).length, led.length, "no second posting");
  const p2 = await getPo(po.id);
  assert.equal(p2.status, "partially_received");
  assert.equal(p2.lines[0].received, 58000); assert.equal(p2.lines[0].outstanding, 42000);
  assert.equal((await O.patch(`/receiving/grns/${grn1.id}`, { notes: "late" })).status, 409, "posted receipts are not editable");
});

test("a retried post resumes a partly posted receipt without double posting", async () => {
  const c = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: flour.id, delivered: 10, unit: "kg" }] });
  // simulate a crash after the stock entry but before the receipt was finalised
  const { runAsPlatform } = require("../src/core/tenancy");
  const { Grn } = require("../src/modules/inventory/receivingModels");
  const svc = require("../src/modules/inventory/stockService");
  const item = (await O.get(`/inventory/items/${flour.id}`)).data;
  const { runInTenant } = require("../src/core/tenancy");
  await runInTenant(restId, () => svc.postMovement({ venueId, user: { id: "x", name: "x" } }, { item, itemId: flour.id, locationId: loc.id, batchNo: "", type: "receipt", qtyMilli: 10000000, unitCostMicro: 40000, refType: "grn", refId: c.data.id, reason: "Goods receipt", idempotencyKey: `grn:${c.data.id}:0:in` }));
  await runAsPlatform(() => Grn.updateOne({ id: c.data.id }, { $set: { status: "posting" } }));
  const before = (await stock(flour.id))[0].onHand;
  const r = await O.post(`/receiving/grns/${c.data.id}/post`, {});
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal((await stock(flour.id))[0].onHand, before, "the existing entry was replayed, not repeated");
  assert.equal((await getPo(po.id)).lines[0].received, 68000);
  // put it back for the next tests: return those 10 kg is not needed; PO now 68 kg received
});

test("batch / expiry rules and expired goods", async () => {
  const mpo = await newPo([{ itemId: milk.id, qty: 50, unit: "l", unitPrice: 60 }]);
  const g = (l) => O.post("/receiving/grns", { poId: mpo.id, locationId: loc.id, lines: [{ itemId: milk.id, delivered: 10, unit: "l", ...l }] });
  assert.equal((await g({})).data.code, "BATCH_REQUIRED");
  assert.equal((await g({ batchNo: "M1" })).data.code, "EXPIRY_REQUIRED");
  assert.equal((await g({ batchNo: "M1", expiryDate: "2020-01-01" })).data.code, "EXPIRED");
  const ok = await g({ batchNo: "M1", expiryDate: new Date(Date.now() + 7 * 864e5).toISOString() });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  await O.post(`/receiving/grns/${ok.data.id}/post`, {});
  const rows = await stock(milk.id);
  assert.equal(rows[0].batchNo, "M1"); assert.equal(rows[0].onHand, 10000);
  assert.equal((await O.post(`/receiving/grns/${ok.data.id}/cancel`, { reason: "x" })).data.code, "INVALID_STATE");
});

test("over-receipt tolerance, completing the order, and cancelling a draft", async () => {
  const c = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: flour.id, delivered: 33, unit: "kg" }] });
  assert.equal(c.data.code, "OVER_RECEIPT", "only 32 kg outstanding");
  assert.equal((await O.patch("/purchase/settings", { overReceiptPct: 2 })).status, 200);
  const ok = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: flour.id, delivered: 33, unit: "kg" }] });
  assert.equal(ok.status, 201, "2% of 100 kg tolerance allows 34 kg");
  assert.equal((await O.post(`/receiving/grns/${ok.data.id}/cancel`, { reason: "wrong PO" })).data.status, "cancelled");
  const done = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: flour.id, delivered: 32, unit: "kg" }] });
  await O.post(`/receiving/grns/${done.data.id}/post`, {});
  assert.equal((await getPo(po.id)).status, "received");
  assert.equal((await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: flour.id, delivered: 1, unit: "kg" }] })).data.code, "PO_NOT_RECEIVABLE");
  await O.patch("/purchase/settings", { overReceiptPct: 0 });
});

test("quarantine list and a supplier return of quarantined goods reopens the order", async () => {
  const q = (await O.get(`/receiving/quarantine${pv()}`)).data.data;
  assert.equal(q.length, 1); assert.equal(q[0].quarantined, 3000);
  const body = { poId: po.id, reasonCategory: "damaged", lines: [{ itemId: flour.id, qty: 3, unit: "kg", source: "quarantine", locationId: loc.id, batchNo: "", reopenPo: true, reason: "torn bags" }] };
  assert.equal((await chef.post("/receiving/returns", body)).status, 403, "chef may only view returns by default");
  const over = await O.post("/receiving/returns", { ...body, lines: [{ ...body.lines[0], qty: 4 }] });
  assert.equal(over.data.code, "INSUFFICIENT_STOCK");
  const r = await O.post("/receiving/returns", body);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.total, 120, "3 kg x Rs40");
  assert.equal((await O.post(`/receiving/returns/${r.data.id}/dispatch`, {})).data.code, "INVALID_STATE", "must be approved first");
  await O.post(`/receiving/returns/${r.data.id}/submit`, {});
  await O.patch("/purchase/settings", { allowSelfApproval: false });
  assert.equal((await O.post(`/receiving/returns/${r.data.id}/approve`, {})).data.code, "SELF_APPROVAL");
  await O.patch("/purchase/settings", { allowSelfApproval: true });
  assert.equal((await O.post(`/receiving/returns/${r.data.id}/approve`, {})).data.status, "approved");
  const d = await O.post(`/receiving/returns/${r.data.id}/dispatch`, { vehicleNo: "KA01" });
  assert.equal(d.status, 200, JSON.stringify(d.data));
  const row = (await stock(flour.id))[0];
  assert.equal(row.quarantined, 0); assert.equal(row.onHand, 97000, "100 kg received, 3 kg sent back");
  assert.equal((await ledger("&type=supplier_return")).length, 1);
  assert.equal((await O.post(`/receiving/returns/${r.data.id}/dispatch`, {})).data.code, "INVALID_STATE", "cannot dispatch twice");
  const p = await getPo(po.id);
  assert.equal(p.lines[0].received, 100000 - 3000); assert.equal(p.status, "partially_received", "returned quantity is outstanding again");
  const cr = await O.post(`/receiving/returns/${r.data.id}/credit`, { creditNoteNo: "CN-77", amount: 115 });
  assert.equal(cr.data.status, "credited"); assert.equal(cr.data.creditVariance, -5);
});

test("goods rejected at the gate can be returned once, never exceeding what was rejected", async () => {
  const mk = (qty) => O.post("/receiving/returns", { poId: po.id, reasonCategory: "damaged", lines: [{ itemId: flour.id, qty, unit: "kg", source: "rejected_at_gate", grnId: grn1.id }] });
  assert.equal((await mk(3)).data.code, "OVER_RETURN", "only 2 kg were rejected");
  const r = await mk(2);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal((await mk(1)).data.code, "OVER_RETURN", "the 2 kg is already on a return");
  await O.post(`/receiving/returns/${r.data.id}/submit`, {}); await O.post(`/receiving/returns/${r.data.id}/approve`, {});
  const before = (await ledger("&type=supplier_return")).length;
  assert.equal((await O.post(`/receiving/returns/${r.data.id}/dispatch`, {})).data.status, "dispatched");
  assert.equal((await ledger("&type=supplier_return")).length, before, "rejected goods never entered stock, so nothing is deducted");
});

test("supplier performance comes from posted receipts and feeds the RFQ comparison", async () => {
  const p = (await O.get(`/receiving/suppliers/${supA.id}/performance`)).data;
  assert.equal(p.receipts >= 3, true);
  assert.equal(p.rejectionPct > 0, true); assert.equal(p.returns >= 2, true);
  assert.equal((await O.get("/receiving/suppliers/nope/performance")).status, 404);
});

test("tenant isolation and access control", async () => {
  const X = client(app.port);
  const r = await X.post("/platform/auth/signup", { name: "Other", email: "other-recv@example.com", password: "supersecret1", restaurantName: "Other Recv", planKey: "growth", billingCycle: "monthly" });
  await X.post("/staff-auth/login", { restaurant: r.data.data.restaurant.slug, email: "other-recv@example.com", password: "supersecret1" });
  assert.equal((await X.get(`/receiving/grns/${grn1.id}`)).status, 404);
  assert.equal((await X.post(`/receiving/grns/${grn1.id}/post`, {})).status, 404);
  assert.equal((await X.get("/receiving/grns")).data.total, 0);
  assert.equal((await client(app.port).get("/receiving/grns")).status, 401);
  assert.equal((await chef.get("/receiving/grns")).status, 200);
  const t = client(app.port);
  const s = await t.post("/platform/auth/signup", { name: "Tiny", email: "tiny-recv@example.com", password: "supersecret1", restaurantName: "Tiny Recv", planKey: "starter", billingCycle: "monthly" });
  await t.post("/staff-auth/login", { restaurant: s.data.data.restaurant.slug, email: "tiny-recv@example.com", password: "supersecret1" });
  assert.equal((await t.get("/receiving/grns")).status, 402);
});
