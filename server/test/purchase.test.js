// Phase 2: purchase requests, approvals, reorder planning, RFQ/quotations, purchase orders.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");
const C = require("../src/modules/inventory/purchaseCalc");

test("calc: line, totals, round-off, tax split are exact integer math", () => {
  const l = C.calcLine({ qtyMilli: 10000, unitPriceMicro: 3000000, discountBp: 500, gstBp: 1800 }); // 10 x Rs3 = 30, -5%, +18%
  assert.deepEqual(l, { grossPaise: 3000, discountPaise: 150, taxablePaise: 2850, taxPaise: 513, totalPaise: 3363 });
  const t = C.calcTotals([l], { freightPaise: 500 });
  assert.equal(t.exactPaise, 3863); assert.equal(t.grandTotalPaise, 3900); assert.equal(t.roundOffPaise, 37);
  assert.deepEqual(C.taxSplit(513, "29ABCDE1234F1Z5", "29"), { type: "intra", cgstPaise: 256, sgstPaise: 257, igstPaise: 0 });
  assert.equal(C.taxSplit(513, "27ABCDE1234F1Z5", "29").type, "inter");
  assert.equal(C.taxSplit(513, "", "29"), null);
  assert.equal(C.canMove(C.PO_FLOW, "draft", "sent"), false);
});

test("calc: reorder suggestion counts incoming once and rounds up to a pack", () => {
  const item = { reorderPointMilli: 5000000, safetyStockMilli: 1000000, reorderQtyMilli: 20000000, maxStockMilli: 0, minStockMilli: 0 };
  assert.equal(C.reorderSuggestion({ item, availableMilli: 9000000 }), null);
  const s = C.reorderSuggestion({ item, availableMilli: 4000000, onOrderMilli: 0, packMilli: 25000000 });
  assert.equal(s.qtyMilli, 25000000); // 20 kg needed -> one 25 kg bag
  assert.equal(C.reorderSuggestion({ item, availableMilli: 4000000, onOrderMilli: 30000000 }), null, "an open order covers it");
  assert.equal(C.reorderSuggestion({ item, availableMilli: 0 }).priority, "urgent");
});

let app, O, slug, venueId, chef, flour, sugar, supA, supB, supBlocked;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });

test("setup: owner, chef, supplier, items, stock", async () => {
  O = client(app.port);
  const r = await O.post("/platform/auth/signup", { name: "Buy Owner", email: "buy@example.com", password: "supersecret1", restaurantName: "Buy Bistro", planKey: "growth", billingCycle: "monthly" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  slug = r.data.data.restaurant.slug;
  assert.equal((await O.post("/staff-auth/login", { restaurant: slug, email: "buy@example.com", password: "supersecret1" })).status, 200);
  venueId = (await O.get("/venues")).data[0].id;

  const bcrypt = require("bcrypt");
  const { runInTenant } = require("../src/core/tenancy");
  const { Restaurant } = require("../src/modules/platform/models");
  const { Admin } = require("../src/modules/auth/auth");
  const rest = await Restaurant.findOne({ slug }).lean();
  await runInTenant(rest.id, () => Admin.create({ id: "chef_buy", name: "Chef Buy", email: "chef@buy.example", password: bcrypt.hashSync("supersecret1", 4), roleGroup: "Manager", roleTitle: "Chef", venueId }));
  chef = client(app.port);
  assert.equal((await chef.post("/staff-auth/login", { restaurant: slug, email: "chef@buy.example", password: "supersecret1" })).status, 200);

  supA = (await O.post("/inventory/suppliers", { name: "Alpha Traders", gstin: "29ABCDE1234F1Z5", leadTimeDays: 2, paymentTerms: "Net 15" })).data;
  supB = (await O.post("/inventory/suppliers", { name: "Beta Foods", gstin: "27ABCDE1234F1Z5", leadTimeDays: 5 })).data;
  supBlocked = (await O.post("/inventory/suppliers", { name: "Gamma Ltd" })).data;
  assert.ok(supA.id && supB.id && supBlocked.id, JSON.stringify(supA));
  flour = (await O.post("/inventory/items", { name: "Flour", baseUnit: "g", conversions: [{ unit: "bag", factor: 25000 }], purchaseUnit: "bag", reorderPoint: 5000, safetyStock: 1000, reorderQty: 20000, gstRate: 5, preferredSupplierId: supA.id })).data;
  sugar = (await O.post("/inventory/items", { name: "Sugar", baseUnit: "g", gstRate: 5 })).data;
  assert.ok(flour.id && sugar.id, JSON.stringify(flour));
  const loc = (await O.post(`/inventory/locations?venueId=${venueId}`, { code: "DRY", name: "Dry" })).data;
  const open = await O.post(`/inventory/stock/opening?venueId=${venueId}`, { itemId: flour.id, locationId: loc.id, qty: 2, unit: "kg", unitCost: 0.04 });
  assert.equal(open.status, 201, JSON.stringify(open.data));
  await O.post(`/inventory/suppliers/${supBlocked.id}/status`, { status: "blocked", reason: "quality" }).catch(() => {});
});

const pv = `?venueId=`;
const post = (c, p, b) => c.post(`/purchase${p}`, b);

test("settings default to strict and validate input", async () => {
  const s = (await O.get("/purchase/settings")).data;
  assert.equal(s.allowSelfApproval, false); assert.equal(s.allowManualPo, false); assert.equal(s.prApprovalLimit, 0);
  assert.equal((await O.patch("/purchase/settings", { gstStateCode: "ABC" })).status, 400);
  assert.equal((await O.patch("/purchase/settings", { poApprovalLimit: -1 })).status, 400);
  assert.equal((await O.patch("/purchase/settings", { gstStateCode: "29" })).status, 200);
});

let pr;
test("PR: server calculates, chef cannot approve, owner approves, double-approval is refused", async () => {
  const bad = await chef.post("/purchase/requests", { lines: [{ itemId: flour.id, qty: 0, unit: "kg" }] });
  assert.equal(bad.status, 400);
  const dup = await chef.post("/purchase/requests", { lines: [{ itemId: flour.id, qty: 1, unit: "kg" }, { itemId: flour.id, qty: 1, unit: "kg" }] });
  assert.equal(dup.data.code, "DUPLICATE_ITEM");
  const r = await chef.post("/purchase/requests", { purpose: "weekly", priority: "high", total: 1, lines: [{ itemId: flour.id, qty: 2, unit: "bag", estUnitCost: 1250 }] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  pr = r.data;
  assert.match(pr.prNo, /^PR-\d+$/);
  assert.equal(pr.lines[0].qty, 50000); // 2 bags = 50 kg = 50000 g
  assert.equal(pr.total, 2500, "50000 g x Rs0.05 = Rs2500; client-sent total ignored");
  assert.equal(pr.status, "draft");
  const sub = await chef.post(`/purchase/requests/${pr.id}/submit`, {});
  assert.equal(sub.data.status, "pending_approval");
  assert.equal(sub.data.lines[0].available, 2000, "available snapshot taken on submit");
  assert.equal((await chef.post(`/purchase/requests/${pr.id}/approve`, {})).status, 403, "Chef has no approval right");
  assert.equal((await O.post(`/purchase/requests/${pr.id}/reject`, {})).data.code, "REASON_REQUIRED");
  const [a, b] = await Promise.all([O.post(`/purchase/requests/${pr.id}/approve`, {}), O.post(`/purchase/requests/${pr.id}/approve`, {})]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await O.post(`/purchase/requests/${pr.id}/cancel`, { reason: "x" })).data.status, "cancelled", "approved but unordered can be cancelled");
});

test("maker-checker: nobody approves their own document unless the policy allows it", async () => {
  const mk = async (c) => { const r = await c.post(`/purchase/requests${pv}${venueId}`, { lines: [{ itemId: sugar.id, qty: 1, unit: "kg", estUnitCost: 50 }] }); await c.post(`/purchase/requests/${r.data.id}/submit`, {}); return r.data.id; };
  const id = await mk(O);
  const self = await O.post(`/purchase/requests/${id}/approve`, {});
  assert.equal(self.status, 403); assert.equal(self.data.code, "SELF_APPROVAL");
  await O.patch("/purchase/settings", { allowSelfApproval: true });
  assert.equal((await O.post(`/purchase/requests/${id}/approve`, {})).status, 200);
  await O.patch("/purchase/settings", { allowSelfApproval: false });
});

test("approval limit auto-approves small requests only", async () => {
  await O.patch("/purchase/settings", { prApprovalLimit: 100 });
  const small = await O.post(`/purchase/requests${pv}${venueId}`, { lines: [{ itemId: sugar.id, qty: 1, unit: "kg", estUnitCost: 50 }] }); // Rs50
  assert.equal((await O.post(`/purchase/requests/${small.data.id}/submit`, {})).data.status, "approved");
  const big = await O.post(`/purchase/requests${pv}${venueId}`, { lines: [{ itemId: sugar.id, qty: 10, unit: "kg", estUnitCost: 50 }] }); // Rs500
  assert.equal((await O.post(`/purchase/requests/${big.data.id}/submit`, {})).data.status, "pending_approval");
  await O.patch("/purchase/settings", { prApprovalLimit: 0 });
  const back = await chef.post("/purchase/requests", { lines: [{ itemId: sugar.id, qty: 1, unit: "kg" }] });
  await chef.post(`/purchase/requests/${back.data.id}/submit`, {});
  const ch = await O.post(`/purchase/requests/${back.data.id}/request-changes`, { comment: "need more" });
  assert.equal(ch.data.status, "changes_requested");
  assert.equal((await chef.patch(`/purchase/requests/${back.data.id}`, { purpose: "fixed" })).status, 200, "requester can edit after changes are requested");
});

test("reorder planning suggests from stock, groups requests by preferred supplier, skips covered items", async () => {
  const s = await O.get(`/purchase/reorder/suggestions${pv}${venueId}`);
  assert.equal(s.status, 200, JSON.stringify(s.data));
  const row = s.data.data.find((r) => r.name === "Flour");
  assert.ok(row, "flour 2 kg is below its 5 kg reorder point");
  assert.equal(row.suggestedQty, 25000, "20 kg rounded up to one 25 kg bag");
  assert.equal(row.supplier.id, supA.id);
  const c = await O.post(`/purchase/reorder/create-requests${pv}${venueId}`, { lines: [{ itemId: flour.id, qty: row.suggestedQty, unit: "g" }] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  assert.equal(c.data.data[0].source, "reorder"); assert.equal(c.data.data[0].preferredSupplierId, supA.id);
  const again = (await O.get(`/purchase/reorder/suggestions${pv}${venueId}`)).data.data.find((r) => r.name === "Flour");
  assert.equal(again, undefined, "the open request now counts as incoming stock");
});

let rfq, qA, qB, po;
test("RFQ: blocked suppliers cannot be invited; quotations are server-calculated; award needs a reason", async () => {
  await O.patch("/purchase/settings", { allowSelfApproval: true });
  const r = await O.post(`/purchase/requests${pv}${venueId}`, { lines: [{ itemId: flour.id, qty: 50, unit: "kg" }, { itemId: sugar.id, qty: 10, unit: "kg" }] });
  await O.post(`/purchase/requests/${r.data.id}/submit`, {});
  await O.post(`/purchase/requests/${r.data.id}/approve`, {});
  const blocked = await O.post(`/purchase/requests/${r.data.id}/convert-to-rfq`, { supplierIds: ["nope"] });
  assert.equal(blocked.status, 404);
  const c = await O.post(`/purchase/requests/${r.data.id}/convert-to-rfq`, { supplierIds: [supA.id, supB.id] });
  assert.equal(c.status, 201, JSON.stringify(c.data));
  rfq = c.data;
  assert.equal((await O.get(`/purchase/requests/${r.data.id}`)).data.status, "rfq_issued");
  assert.equal((await O.post(`/purchase/rfqs/${rfq.id}/quotations`, { supplierId: supA.id, lines: [] })).status, 409, "RFQ not sent yet");
  assert.equal((await O.post(`/purchase/rfqs/${rfq.id}/send`, {})).data.status, "sent");

  const qa = await O.post(`/purchase/rfqs/${rfq.id}/quotations`, { supplierId: supA.id, freight: 50, lines: [
    { itemId: flour.id, qty: 50, unit: "kg", unitPrice: 40, discountPct: 5, gstRate: 5, leadTimeDays: 2 },
    { itemId: sugar.id, unit: "kg", unitPrice: 45, gstRate: 5 }] });
  assert.equal(qa.status, 201, JSON.stringify(qa.data));
  qA = qa.data;
  assert.equal(qA.lines[0].total, 1995, "50 kg x Rs40 = 2000, -5% = 1900, +5% GST");
  const t = qA.totals;
  assert.equal(t.grandTotal % 1, 0, "grand total is whole rupees");
  assert.equal(Math.round((t.grandTotal - t.roundOff) * 100), Math.round((t.taxable + t.tax + t.freight) * 100));

  assert.equal((await O.post(`/purchase/rfqs/${rfq.id}/quotations`, { supplierId: supBlocked.id, lines: [{ itemId: flour.id, qty: 1, unit: "kg", unitPrice: 1 }] })).data.code, "NOT_INVITED");
  const qb = await O.post(`/purchase/rfqs/${rfq.id}/quotations`, { supplierId: supB.id, validUntil: new Date(Date.now() + 864e5).toISOString(), lines: [{ itemId: flour.id, qty: 50, unit: "kg", unitPrice: 30, gstRate: 5 }] });
  qB = qb.data; // cheapest total but covers only one of two items
  const cmp = (await O.get(`/purchase/rfqs/${rfq.id}/comparison`)).data;
  assert.equal(cmp.suppliers.length, 2);
  assert.equal(cmp.suppliers.find((s) => s.supplierId === supB.id).coverage.covered, 1);
  assert.equal(cmp.lowestFullCoverageSupplierId, supA.id, "partial quotation is not 'lowest'");
  assert.equal(cmp.suppliers[0].reliability, null, "no performance history yet; not invented");

  assert.equal((await O.post(`/purchase/rfqs/${rfq.id}/award`, { quotationId: qA.id })).data.code, "REASON_REQUIRED");
  assert.equal((await O.post(`/purchase/orders`, { source: "quotation", quotationId: qA.id })).data.code, "NOT_AWARDED");
});

test("award selects one quotation, rejects the others, and the order inherits it", async () => {
  const aw = await O.post(`/purchase/rfqs/${rfq.id}/award`, { quotationId: qA.id, reason: "Only full-coverage quote, 2-day lead" });
  assert.equal(aw.status, 200, JSON.stringify(aw.data));
  assert.equal(aw.data.status, "awarded");
  assert.equal((await O.post(`/purchase/rfqs/${rfq.id}/award`, { quotationId: qB.id, reason: "again" })).status, 409);
  const detail = (await O.get(`/purchase/rfqs/${rfq.id}`)).data;
  assert.equal(detail.quotations.find((q) => q.id === qB.id).status, "rejected");
  const p = await O.post("/purchase/orders", { source: "quotation", quotationId: qA.id });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  po = p.data;
  assert.equal(po.supplierId, supA.id); assert.equal(po.totals.grandTotal, qA.totals.grandTotal);
  assert.equal(po.taxSplit.type, "intra", "supplier GSTIN 29 and restaurant state 29");
  assert.equal(po.taxSplit.cgst + po.taxSplit.sgst, po.totals.tax);
  assert.equal((await O.post("/purchase/orders", { source: "quotation", quotationId: qA.id })).data.code, "ALREADY_ORDERED");
  assert.equal((await O.get(`/purchase/requests/${detail.prId}`)).data.status, "ordered");
});

test("PO lifecycle: approval, sent record, versioned revision, cancel/close rules", async () => {
  assert.equal((await O.post(`/purchase/orders/${po.id}/send`, {})).status, 409, "must be approved first");
  assert.equal((await O.post(`/purchase/orders/${po.id}/submit`, {})).data.status, "pending_approval");
  assert.equal((await O.post(`/purchase/orders/${po.id}/approve`, {})).data.status, "approved");
  const sent = await O.post(`/purchase/orders/${po.id}/send`, { via: "whatsapp" });
  assert.equal(sent.data.status, "sent"); assert.equal(sent.data.sentVia, "whatsapp");
  assert.equal((await O.post(`/purchase/orders/${po.id}/revise`, {})).data.code, "REASON_REQUIRED");
  const rev = await O.post(`/purchase/orders/${po.id}/revise`, { reason: "supplier price change" });
  assert.equal(rev.data.status, "draft"); assert.equal(rev.data.version, 2); assert.equal(rev.data.revisions.length, 1);
  const edit = await O.patch(`/purchase/orders/${po.id}`, { lines: [{ itemId: flour.id, qty: 40, unit: "kg", unitPrice: 41, gstRate: 5 }] });
  assert.equal(edit.status, 200, JSON.stringify(edit.data));
  assert.equal(edit.data.lines.length, 1); assert.equal(edit.data.totals.taxable, 1640);
  await O.post(`/purchase/orders/${po.id}/submit`, {});
  await O.post(`/purchase/orders/${po.id}/approve`, {});
  await O.post(`/purchase/orders/${po.id}/send`, { via: "email" });

  // simulate a goods receipt (Phase 3 will do this): goods already received -> no cancel / revise, close instead
  const { runAsPlatform } = require("../src/core/tenancy");
  const { PurchaseOrder } = require("../src/modules/inventory/purchaseModels");
  await runAsPlatform(() => PurchaseOrder.updateOne({ id: po.id }, { $set: { "lines.0.receivedMilli": 10000000, status: "partially_received" } }));
  assert.equal((await O.post(`/purchase/orders/${po.id}/cancel`, { reason: "x" })).data.code, "HAS_RECEIPTS");
  assert.equal((await O.post(`/purchase/orders/${po.id}/revise`, { reason: "x" })).status, 409);
  const closed = await O.post(`/purchase/orders/${po.id}/close`, { reason: "supplier short-supplied" });
  assert.equal(closed.data.status, "closed");
  assert.equal(closed.data.lines[0].outstanding, 0);
  assert.equal(closed.data.lines[0].closed, 30000);
  assert.equal((await O.post(`/purchase/orders/${po.id}/close`, { reason: "again" })).status, 409);
});

test("cancelling an order releases its request; manual orders are off by default", async () => {
  const r = await O.post(`/purchase/requests${pv}${venueId}`, { lines: [{ itemId: sugar.id, qty: 5, unit: "kg", estUnitCost: 50 }] });
  await O.post(`/purchase/requests/${r.data.id}/submit`, {}); await O.post(`/purchase/requests/${r.data.id}/approve`, {});
  assert.equal((await O.post(`/purchase/requests/${r.data.id}/convert-to-po`, {})).data.code, "NO_SUPPLIER");
  const p = await O.post(`/purchase/requests/${r.data.id}/convert-to-po`, { supplierId: supB.id });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  assert.equal(p.data.taxSplit.type, "inter");
  assert.equal((await O.post(`/purchase/orders/${p.data.id}/cancel`, { reason: "changed mind" })).data.status, "cancelled");
  assert.equal((await O.get(`/purchase/requests/${r.data.id}`)).data.status, "approved");
  const m = await O.post(`/purchase/orders${pv}${venueId}`, { supplierId: supA.id, lines: [{ itemId: sugar.id, qty: 1, unit: "kg", unitPrice: 40 }] });
  assert.equal(m.data.code, "MANUAL_PO_DISABLED");
  await O.patch("/purchase/settings", { allowManualPo: true });
  const ok = await O.post(`/purchase/orders${pv}${venueId}`, { venueId, supplierId: supA.id, lines: [{ itemId: sugar.id, qty: 1, unit: "kg", unitPrice: 40, gstRate: 5 }] });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.totals.grandTotal, 42);
  assert.equal((await O.get("/purchase/orders?status=draft")).data.total >= 1, true);
});

test("tenant isolation and access control", async () => {
  const X = client(app.port);
  const r = await X.post("/platform/auth/signup", { name: "Other", email: "other-buy@example.com", password: "supersecret1", restaurantName: "Other Buy", planKey: "growth", billingCycle: "monthly" });
  await X.post("/staff-auth/login", { restaurant: r.data.data.restaurant.slug, email: "other-buy@example.com", password: "supersecret1" });
  assert.equal((await X.get("/purchase/orders")).data.total, 0);
  assert.equal((await X.get(`/purchase/orders/${po.id}`)).status, 404);
  assert.equal((await X.post(`/purchase/rfqs/${rfq.id}/award`, { quotationId: qA.id, reason: "x" })).status, 404);
  assert.equal((await client(app.port).get("/purchase/orders")).status, 401);
  assert.equal((await chef.get("/purchase/settings")).status, 403, "settings are Super Admin until granted");
  assert.equal((await chef.post("/purchase/orders", { source: "quotation", quotationId: "x" })).status, 403, "chef can view but not create orders");
  const t = client(app.port);
  const s = await t.post("/platform/auth/signup", { name: "Tiny", email: "tiny-buy@example.com", password: "supersecret1", restaurantName: "Tiny Buy", planKey: "starter", billingCycle: "monthly" });
  await t.post("/staff-auth/login", { restaurant: s.data.data.restaurant.slug, email: "tiny-buy@example.com", password: "supersecret1" });
  assert.equal((await t.get("/purchase/orders")).status, 402);
});
