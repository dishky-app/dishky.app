// Phase 4: supplier invoices, three-way match, payments, credit notes, cost reports.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");
const F = require("../src/modules/inventory/financeCalc");

test("calc: duplicate key, payment terms, aging buckets", () => {
  assert.equal(F.invoiceKey("s1", "inv-001"), F.invoiceKey("s1", "INV 001"));
  assert.notEqual(F.invoiceKey("s1", "INV-001"), F.invoiceKey("s2", "INV-001"));
  assert.equal(F.termsDays("Net 30"), 30); assert.equal(F.termsDays("15 days credit"), 15); assert.equal(F.termsDays("advance"), null);
  const now = Date.parse("2026-06-30");
  assert.equal(F.agingBucket("2026-07-05", now), "current"); assert.equal(F.agingBucket("2026-06-20", now), "d1_30");
  assert.equal(F.agingBucket("2026-04-15", now), "d61_90"); assert.equal(F.agingBucket("2026-01-01", now), "d90_plus");
});

test("calc: three-way match flags quantity, price, tax and missing receipts", () => {
  const po = { lines: [{ itemId: "a", qtyMilli: 100000, receivedMilli: 60000, taxablePaise: 400000, gstBp: 500 }, { itemId: "b", qtyMilli: 10000, receivedMilli: 0, taxablePaise: 10000, gstBp: 0 }] };
  const mk = (l, extra = {}) => ({ lines: [l], totals: { grandTotalPaise: 100 }, statedTotalPaise: null, ...extra });
  const base = { itemId: "a", qtyMilli: 60000, taxablePaise: 240000, gstBp: 500 };
  assert.equal(F.threeWayMatch({ invoice: mk(base), po }).status, "matched");
  assert.equal(F.threeWayMatch({ invoice: mk({ ...base, qtyMilli: 70000, taxablePaise: 280000 }), po }).lines[0].status, "over_billed");
  assert.equal(F.threeWayMatch({ invoice: mk({ ...base, taxablePaise: 270000 }), po }).lines[0].status, "price_high");
  assert.equal(F.threeWayMatch({ invoice: mk({ ...base, gstBp: 1200 }), po }).lines[0].status, "tax_mismatch");
  assert.equal(F.threeWayMatch({ invoice: mk({ itemId: "b", qtyMilli: 1000, taxablePaise: 1000, gstBp: 0 }), po }).lines[0].status, "not_received");
  assert.equal(F.threeWayMatch({ invoice: mk({ itemId: "z", qtyMilli: 1, taxablePaise: 1, gstBp: 0 }), po }).lines[0].status, "not_on_po");
  assert.equal(F.threeWayMatch({ invoice: mk(base), po, othersQty: new Map([["a", 50000]]) }).lines[0].status, "over_billed", "quantity already invoiced elsewhere is not billable again");
  assert.equal(F.threeWayMatch({ invoice: mk(base), po: null }).status, "unmatched");
  assert.ok(F.threeWayMatch({ invoice: mk(base, { statedTotalPaise: 5000 }), po }).flags.includes("stated_total_mismatch"));
});

let app, O, chef, venueId, sup, flour, loc, po, inv1, grnId;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });
const pv = () => `?venueId=${venueId}`;
const today = () => new Date().toISOString().slice(0, 10);
const invBody = (over = {}) => ({ poId: po.id, invoiceNo: "INV-001", invoiceDate: today(), lines: [{ itemId: flour.id, qty: 60, unit: "kg", unitPrice: 40, gstRate: 5 }], ...over });

test("setup: PO of 100 kg, 60 kg received", async () => {
  O = client(app.port);
  const r = await O.post("/platform/auth/signup", { name: "Fin Owner", email: "fin@example.com", password: "supersecret1", restaurantName: "Fin Bistro", planKey: "growth", billingCycle: "monthly" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const slug = r.data.data.restaurant.slug;
  await O.post("/staff-auth/login", { restaurant: slug, email: "fin@example.com", password: "supersecret1" });
  venueId = (await O.get("/venues")).data[0].id;
  const bcrypt = require("bcrypt");
  const { runInTenant } = require("../src/core/tenancy");
  const { Restaurant } = require("../src/modules/platform/models");
  const { Admin } = require("../src/modules/auth/auth");
  const rest = await Restaurant.findOne({ slug }).lean();
  await runInTenant(rest.id, () => Admin.create({ id: "chef_fin", name: "Chef Fin", email: "chef@fin.example", password: bcrypt.hashSync("supersecret1", 4), roleGroup: "Manager", roleTitle: "Chef", venueId }));
  chef = client(app.port);
  await chef.post("/staff-auth/login", { restaurant: slug, email: "chef@fin.example", password: "supersecret1" });
  assert.equal((await O.patch("/purchase/settings", { allowSelfApproval: true, allowManualPo: true, gstStateCode: "29" })).status, 200);
  sup = (await O.post("/inventory/suppliers", { name: "Fin Traders", gstin: "29ABCDE1234F1Z5", paymentTerms: "Net 15" })).data;
  flour = (await O.post("/inventory/items", { name: "Flour", baseUnit: "g", gstRate: 5 })).data;
  loc = (await O.post(`/inventory/locations${pv()}`, { code: "DRY", name: "Dry" })).data;
  const p = await O.post(`/purchase/orders${pv()}`, { supplierId: sup.id, lines: [{ itemId: flour.id, qty: 100, unit: "kg", unitPrice: 40, gstRate: 5 }] });
  po = p.data;
  await O.post(`/purchase/orders/${po.id}/submit`, {}); await O.post(`/purchase/orders/${po.id}/approve`, {}); await O.post(`/purchase/orders/${po.id}/send`, { via: "email" });
  const g = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: flour.id, delivered: 60, unit: "kg" }] });
  grnId = g.data.id;
  assert.equal((await O.post(`/receiving/grns/${g.data.id}/post`, {})).status, 201);
});

test("billable quantities come from receipts, prices from the order", async () => {
  const b = (await O.get(`/finance/orders/${po.id}/billable`)).data;
  assert.equal(b.lines[0].billable, 60000); assert.equal(b.lines[0].unitPrice, 0.04); assert.equal(b.paymentTerms, "Net 15");
});

test("a matching invoice is calculated by the server and matched", async () => {
  const r = await O.post("/finance/invoices", invBody({ statedTotal: 2520, totals: { grandTotal: 1 } }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  inv1 = r.data;
  assert.match(inv1.docNo, /^SINV-\d+$/);
  assert.equal(inv1.totals.grandTotal, 2520, "60 kg x Rs40 = 2400 + 5% GST");
  assert.equal(inv1.match.status, "matched", JSON.stringify(inv1.match));
  assert.equal(inv1.taxSplit.type, "intra");
  assert.equal(inv1.dueDate.slice(0, 10), new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10), "due date from Net 15");
});

test("duplicates, over-billing and price variances are caught", async () => {
  assert.equal((await O.post(`/finance/invoices/${inv1.id}/submit`, {})).data.status, "pending_approval"); // a submitted invoice uses up the billable quantity
  assert.equal((await O.post("/finance/invoices", invBody({ invoiceNo: "inv 001" }))).data.code, "DUPLICATE_INVOICE");
  assert.equal((await O.post("/finance/invoices", invBody({ invoiceNo: "" }))).data.code, "INVOICE_NO_REQUIRED");
  assert.equal((await O.post("/finance/invoices", invBody({ invoiceNo: "F1", invoiceDate: "2999-01-01" }))).status, 400);
  const over = await O.post("/finance/invoices", invBody({ invoiceNo: "INV-002", lines: [{ itemId: flour.id, qty: 10, unit: "kg", unitPrice: 40, gstRate: 5 }] }));
  assert.equal(over.data.match.lines[0].status, "over_billed", "all 60 kg is already on INV-001 (pending)");
  assert.equal((await O.post("/finance/invoices", { ...invBody({ invoiceNo: "INV-003", lines: [{ itemId: flour.id, qty: 10, unit: "kg", unitPrice: 45, gstRate: 5 }] }), poId: null, supplierId: sup.id, venueId })).data.match.status, "unmatched");
  const wrongTotal = await O.post("/finance/invoices", invBody({ invoiceNo: "INV-004", statedTotal: 3000, lines: [{ itemId: flour.id, qty: 0.001, unit: "kg", unitPrice: 40, gstRate: 5 }] }));
  assert.ok(wrongTotal.data.match.flags.includes("stated_total_mismatch"));
});

test("approval: variance needs an override reason; maker-checker applies", async () => {
  await O.patch("/purchase/settings", { allowSelfApproval: false });
  assert.equal((await O.post(`/finance/invoices/${inv1.id}/approve`, {})).data.code, "SELF_APPROVAL");
  await O.patch("/purchase/settings", { allowSelfApproval: true });
  const ap = await O.post(`/finance/invoices/${inv1.id}/approve`, {});
  assert.equal(ap.data.status, "approved", JSON.stringify(ap.data));
  assert.equal(ap.data.paymentStatus, "unpaid"); assert.equal(ap.data.outstanding, 2520);

  const v = await O.post("/finance/invoices", invBody({ invoiceNo: "INV-010", lines: [{ itemId: flour.id, qty: 1, unit: "kg", unitPrice: 50, gstRate: 5 }] })); // different supplier-invoice, would be over-billed too
  await O.post(`/finance/invoices/${v.data.id}/submit`, {});
  const blocked = await O.post(`/finance/invoices/${v.data.id}/approve`, {});
  assert.equal(blocked.status, 409); assert.equal(blocked.data.code, "MATCH_VARIANCE");
  assert.equal((await O.post(`/finance/invoices/${v.data.id}/reject`, {})).data.code, "REASON_REQUIRED");
  const forced = await O.post(`/finance/invoices/${v.data.id}/approve`, { overrideReason: "Supplier agreed to bill the extra kilo at a higher rate" });
  assert.equal(forced.data.status, "approved"); assert.equal(forced.data.overrideReason.length > 0, true);
  const rep = (await O.get("/finance/reports/invoice-variance")).data;
  assert.equal(rep.rows.some((r) => r.invoiceNo === "INV-010"), true);
});

let pay1;
test("payments: only approved invoices, no over-payment, approval, idempotency, duplicates", async () => {
  const draft = await O.post("/finance/invoices", invBody({ invoiceNo: "INV-020", lines: [{ itemId: flour.id, qty: 0.001, unit: "kg", unitPrice: 40, gstRate: 5 }] }));
  const unapproved = await O.post("/finance/payments", { supplierId: sup.id, venueId, method: "upi", reference: "U0", amount: 1, allocations: [{ invoiceId: draft.data.id, amount: 1 }] });
  assert.equal(unapproved.data.code, "INVOICE_NOT_APPROVED");
  assert.equal((await O.post("/finance/payments", { supplierId: sup.id, venueId, method: "upi", amount: 5 })).data.code, "REFERENCE_REQUIRED");
  const over = await O.post("/finance/payments", { supplierId: sup.id, venueId, method: "upi", reference: "U1", amount: 3000, allocations: [{ invoiceId: inv1.id, amount: 2600 }] });
  assert.equal(over.data.code, "OVER_PAYMENT");
  const body = { supplierId: sup.id, venueId, method: "bank_transfer", reference: "UTR111", amount: 1000, allocations: [{ invoiceId: inv1.id, amount: 1000 }] };
  const r = await O.post("/finance/payments", body);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  pay1 = r.data;
  assert.equal(pay1.status, "pending_approval", "limit 0 = every payment needs approval");
  assert.equal((await O.post("/finance/payments", body)).data.code, "DUPLICATE_PAYMENT");
  const k = await O.post("/finance/payments", { ...body, reference: "UTR222", amount: 10, allocations: [] }, ); // no allocations -> advance
  assert.equal(k.data.advance, 10);
  let inv = (await O.get(`/finance/invoices/${inv1.id}`)).data;
  assert.equal(inv.pending, 1000); assert.equal(inv.paid, 0); assert.equal(inv.payableNow, 1520);
  assert.equal((await O.post("/finance/payments", { ...body, reference: "UTR333", amount: 1600, allocations: [{ invoiceId: inv1.id, amount: 1600 }] })).data.code, "OVER_PAYMENT", "pending payments count against the invoice");
  assert.equal((await O.post(`/finance/payments/${pay1.id}/approve`, {})).data.status, "completed");
  inv = (await O.get(`/finance/invoices/${inv1.id}`)).data;
  assert.equal(inv.paid, 1000); assert.equal(inv.paymentStatus, "partially_paid"); assert.equal(inv.outstanding, 1520);
  assert.equal((await O.post(`/finance/payments/${pay1.id}/approve`, {})).status, 409, "cannot approve twice");
});

test("settling, replay, reversal, advance allocation and the cancel guard", async () => {
  const idem = { "Idempotency-Key": "pay-key-1" };
  const rest = { supplierId: sup.id, venueId, method: "cash", amount: 1520, allocations: [{ invoiceId: inv1.id, amount: 1520 }] };
  const a = await O.post("/finance/payments", rest, idem);
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal(a.data.warnings.length, 0, "small cash payment: no tax warning");
  const again = await O.post("/finance/payments", rest, idem);
  assert.equal(again.status, 200); assert.equal(again.data.replayed, true); assert.equal(again.data.id, a.data.id);
  await O.post(`/finance/payments/${a.data.id}/approve`, {});
  let inv = (await O.get(`/finance/invoices/${inv1.id}`)).data;
  assert.equal(inv.paymentStatus, "paid"); assert.equal(inv.outstanding, 0);
  assert.equal((await O.post(`/finance/invoices/${inv1.id}/cancel`, { reason: "x" })).data.code, "HAS_PAYMENTS");
  assert.equal((await O.post(`/finance/payments/${pay1.id}/reverse`, {})).data.code, "REASON_REQUIRED");
  assert.equal((await O.post(`/finance/payments/${pay1.id}/reverse`, { reason: "bounced" })).data.status, "reversed");
  inv = (await O.get(`/finance/invoices/${inv1.id}`)).data;
  assert.equal(inv.paid, 1520); assert.equal(inv.outstanding, 1000); assert.equal(inv.paymentStatus, "partially_paid");
  // a completed payment with an unallocated remainder can be allocated later
  const adv = await O.post("/finance/payments", { supplierId: sup.id, venueId, method: "upi", reference: "UTR900", amount: 1200, allocations: [{ invoiceId: inv1.id, amount: 200 }] });
  await O.post(`/finance/payments/${adv.data.id}/approve`, {});
  assert.equal(adv.data.advance, 1000);
  const al = await O.post(`/finance/payments/${adv.data.id}/allocate`, { allocations: [{ invoiceId: inv1.id, amount: 800 }] });
  assert.equal(al.status, 200, JSON.stringify(al.data));
  assert.equal((await O.get(`/finance/invoices/${inv1.id}`)).data.outstanding, 0);
  assert.equal((await O.post(`/finance/payments/${adv.data.id}/allocate`, { allocations: [{ invoiceId: inv1.id, amount: 1 }] })).data.code, "OVER_PAYMENT");
});

test("credit notes from supplier returns reduce what is payable", async () => {
  const inv2 = (await O.get("/finance/invoices?search=INV-010")).data.data[0];
  assert.equal(inv2.status, "approved");
  // return 2 kg from stock, credited at Rs 100
  const ret = await O.post("/receiving/returns", { poId: po.id, reasonCategory: "quality", lines: [{ itemId: flour.id, qty: 2, unit: "kg", source: "stock", locationId: loc.id, batchNo: "" }] });
  assert.equal(ret.status, 201, JSON.stringify(ret.data));
  await O.post(`/receiving/returns/${ret.data.id}/submit`, {}); await O.post(`/receiving/returns/${ret.data.id}/approve`, {}); await O.post(`/receiving/returns/${ret.data.id}/dispatch`, {});
  assert.equal((await O.post(`/finance/invoices/${inv2.id}/apply-credit`, { returnId: ret.data.id })).data.code, "INVALID_STATE", "no credit note yet");
  await O.post(`/receiving/returns/${ret.data.id}/credit`, { creditNoteNo: "CN-1", amount: 40 });
  const big = await O.post(`/finance/invoices/${inv1.id}/apply-credit`, { returnId: ret.data.id });
  assert.equal(big.data.code, "CREDIT_TOO_LARGE", "inv1 is fully paid");
  const ok = await O.post(`/finance/invoices/${inv2.id}/apply-credit`, { returnId: ret.data.id });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.creditsApplied, 40); assert.equal(ok.data.payable, inv2.totals.grandTotal - 40);
  assert.equal((await O.post(`/finance/invoices/${inv2.id}/apply-credit`, { returnId: ret.data.id })).data.code, "ALREADY_APPLIED");
});

test("reports: purchase summary, aging, price trend, consumption cost, csv", async () => {
  const rec = (await O.get("/finance/reports/purchase-summary?basis=received&groupBy=supplier")).data;
  assert.equal(rec.rows[0].name, "Fin Traders"); assert.equal(rec.rows[0].total, 2400); assert.equal(rec.rows[0].returns, 80, "2 kg returned at Rs40");
  const invd = (await O.get("/finance/reports/purchase-summary?basis=invoiced&groupBy=month")).data;
  assert.equal(invd.rows.length, 1); assert.equal(invd.totals.total > 2520, true);
  const ag = (await O.get("/finance/reports/payables-aging?detail=true")).data;
  assert.equal(ag.totals.total, ag.rows.reduce((n, r) => n + r.total, 0));
  assert.equal(ag.invoices.every((i) => i.outstanding > 0), true);
  const pt = (await O.get(`/finance/reports/price-trend?itemId=${flour.id}`)).data;
  assert.equal(pt.series.length, 1); assert.equal(pt.series[0].avgUnitCost, 0.04);
  await O.post(`/inventory/stock/waste${pv()}`, { itemId: flour.id, locationId: loc.id, qty: 1, unit: "kg", wasteReason: "spoilage" });
  const cc = (await O.get("/finance/reports/consumption-cost")).data;
  assert.equal(cc.rows[0].wasteValue, 40);
  const csv = await O.get("/finance/reports/purchase-summary?basis=received&groupBy=supplier&format=csv");
  assert.equal(csv.status, 200); assert.equal(typeof csv.data, "string"); assert.match(csv.data.split("\n")[0], /^key,name,taxable/);
  assert.match(csv.data, /Fin Traders/);
});

test("access control, tenant isolation and plan gate", async () => {
  assert.equal((await chef.get("/finance/invoices")).status, 403, "finance stays with Super Admin until granted");
  assert.equal((await chef.get("/finance/reports/payables-aging")).status, 403);
  const X = client(app.port);
  const r = await X.post("/platform/auth/signup", { name: "Other", email: "other-fin@example.com", password: "supersecret1", restaurantName: "Other Fin", planKey: "growth", billingCycle: "monthly" });
  await X.post("/staff-auth/login", { restaurant: r.data.data.restaurant.slug, email: "other-fin@example.com", password: "supersecret1" });
  assert.equal((await X.get(`/finance/invoices/${inv1.id}`)).status, 404);
  assert.equal((await X.get("/finance/invoices")).data.total, 0);
  assert.equal((await X.post(`/finance/payments/${pay1.id}/approve`, {})).status, 404);
  assert.equal((await client(app.port).get("/finance/invoices")).status, 401);
  const t = client(app.port);
  const s = await t.post("/platform/auth/signup", { name: "Tiny", email: "tiny-fin@example.com", password: "supersecret1", restaurantName: "Tiny Fin", planKey: "starter", billingCycle: "monthly" });
  await t.post("/staff-auth/login", { restaurant: s.data.data.restaurant.slug, email: "tiny-fin@example.com", password: "supersecret1" });
  assert.equal((await t.get("/finance/invoices")).status, 402);
});
