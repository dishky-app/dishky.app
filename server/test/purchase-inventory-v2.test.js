// Credit purchasing, item batches, return reason, supplier memos, audit -> kitchen schedule link.
process.env.INVENTORY_ALLOW_NO_TRANSACTIONS = "true";
const test = require("node:test");
const assert = require("node:assert/strict");
const { boot, client } = require("./helpers");
const C = require("../src/modules/inventory/creditCalc");

test("calc: credit position, FIFO settlement, month-end and limit rules", () => {
  const po = (id, date, total, status = "approved") => ({ id, poNo: id, orderDate: date, status, totals: { grandTotalPaise: total }, lines: [] });
  const orders = [po("a", "2026-01-10", 600000), po("b", "2026-02-05", 300000), po("x", "2026-02-06", 999999, "draft")];
  const p = C.creditPosition({ orders, settledPaise: 700000, limitPaise: 1000000, graceDays: 5, now: new Date("2026-02-10") });
  assert.equal(p.outstandingPaise, 200000);
  assert.equal(p.statement[0].remainingPaise, 0);
  assert.equal(p.statement[1].remainingPaise, 200000, "settlement clears the oldest order first");
  assert.equal(p.overdue, false, "Feb order is due 28 Feb + 5 days grace");
  const late = C.creditPosition({ orders, settledPaise: 0, limitPaise: 1000000, graceDays: 5, now: new Date("2026-02-10") });
  assert.equal(late.overdue, true, "January order unpaid past 31 Jan + 5 days");
  assert.equal(late.settleNow, true);
  const lim = C.creditPosition({ orders: [po("a", "2026-02-01", 1000000)], limitPaise: 1000000, now: new Date("2026-02-02") });
  assert.equal(lim.limitReached, true); assert.equal(lim.reason, "limit_reached");
  assert.equal(C.checkCredit({ enabled: false, limitPaise: 1, position: p, valuePaise: 1 }).code, "CREDIT_NOT_ENABLED");
  assert.equal(C.checkCredit({ enabled: true, limitPaise: 0, position: p, valuePaise: 1 }).code, "CREDIT_NO_LIMIT");
  assert.equal(C.checkCredit({ enabled: true, limitPaise: 1000000, position: p, valuePaise: 900000 }).code, "CREDIT_LIMIT_EXCEEDED");
  assert.equal(C.checkCredit({ enabled: true, limitPaise: 1000000, position: p, valuePaise: 100000 }).ok, true);
});

let app, O, venueId, sup, item, loc;
test.before(async () => { app = await boot(); });
test.after(async () => { await app.close(); });
const pv = () => `?venueId=${venueId}`;

test("setup", async () => {
  O = client(app.port);
  const r = await O.post("/platform/auth/signup", { name: "V2 Owner", email: "v2@example.com", password: "supersecret1", restaurantName: "V2 Bistro", planKey: "growth", billingCycle: "monthly" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  await O.post("/staff-auth/login", { restaurant: r.data.data.restaurant.slug, email: "v2@example.com", password: "supersecret1" });
  venueId = (await O.get("/venues")).data[0].id;
  assert.equal((await O.patch("/purchase/settings", { allowSelfApproval: true, allowManualPo: true, gstStateCode: "29" })).status, 200);
  sup = (await O.post("/inventory/suppliers", { name: "Credit Co", paymentTerms: "Net 15" })).data;
  item = (await O.post("/inventory/items", { name: "Rice", baseUnit: "g", gstRate: 0 })).data;
  loc = (await O.post(`/inventory/locations${pv()}`, { code: "DRY", name: "Dry" })).data;
});

const mkPo = async (qty, mode = "credit") => {
  const p = await O.post(`/purchase/orders${pv()}`, { supplierId: sup.id, purchaseMode: mode, lines: [{ itemId: item.id, qty, unit: "kg", unitPrice: 50, gstRate: 0 }] });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  return p.data;
};

test("credit: refused until the supplier is on credit with a limit", async () => {
  const po = await mkPo(10);
  assert.equal((await O.post(`/purchase/orders/${po.id}/submit`, {})).data.code, "CREDIT_NOT_ENABLED");
  assert.equal((await O.patch(`/inventory/suppliers/${sup.id}`, { name: "Credit Co", creditEnabled: true, creditLimit: 0 })).status < 300, true);
  assert.equal((await O.post(`/purchase/orders/${po.id}/submit`, {})).data.code, "CREDIT_NO_LIMIT");
});

test("credit: limit is enforced, settlement frees it", async () => {
  const up = await O.patch(`/inventory/suppliers/${sup.id}`, { name: "Credit Co", creditEnabled: true, creditLimit: 1000, creditGraceDays: 5 });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  const a = await mkPo(10); // Rs 500
  assert.equal((await O.post(`/purchase/orders/${a.id}/submit`, {})).status, 200);
  assert.equal((await O.post(`/purchase/orders/${a.id}/approve`, {})).status, 200);
  const b = await mkPo(14); // Rs 700 -> 1200 > 1000
  assert.equal((await O.post(`/purchase/orders/${b.id}/submit`, {})).data.code, "CREDIT_LIMIT_EXCEEDED");
  let acc = (await O.get(`/finance/credit/accounts/${sup.id}`)).data;
  assert.equal(acc.outstanding, 500);
  const over = await O.post("/finance/payments", { supplierId: sup.id, venueId, purpose: "credit_settlement", amount: 600, method: "upi", reference: "S1" });
  assert.equal(over.data.code, "OVER_SETTLEMENT");
  const pay = await O.post("/finance/payments", { supplierId: sup.id, venueId, purpose: "credit_settlement", amount: 300, method: "upi", reference: "S2" });
  assert.equal(pay.status, 201, JSON.stringify(pay.data));
  await O.post(`/finance/payments/${pay.data.id}/approve`, {});
  acc = (await O.get(`/finance/credit/accounts/${sup.id}`)).data;
  assert.equal(acc.outstanding, 200, "Rs 300 settled against Rs 500");
  assert.equal((await O.post(`/purchase/orders/${b.id}/submit`, {})).status, 200, "Rs 200 + Rs 700 fits in Rs 1000");
});

test("batches: GRN auto-numbers a batch, details are editable, expiry syncs to stock", async () => {
  const po = await mkPo(10, "cash");
  await O.post(`/purchase/orders/${po.id}/submit`, {}); await O.post(`/purchase/orders/${po.id}/approve`, {}); await O.post(`/purchase/orders/${po.id}/send`, { via: "email" });
  const g = await O.post("/receiving/grns", { poId: po.id, locationId: loc.id, lines: [{ itemId: item.id, delivered: 10, unit: "kg" }] });
  assert.equal(g.status, 201, JSON.stringify(g.data));
  const posted = await O.post(`/receiving/grns/${g.data.id}/post`, {});
  assert.equal(posted.status, 201, JSON.stringify(posted.data));
  const rows = (await O.get(`/inventory/items/${item.id}/batches`)).data;
  const list = rows.data || rows;
  const row = list.find((r) => String(r.batchNo).startsWith(g.data.grnNo));
  assert.ok(row, "batch row for the receipt");
  assert.equal(row.supplierName, "Credit Co");
  const exp = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const ed = await O.patch(`/inventory/items/${item.id}/batches/${row.id}`, { expiryDate: exp, supplierLotNo: "LOT-9", storageCondition: "ambient", qualityGrade: "A" });
  assert.equal(ed.status, 200, JSON.stringify(ed.data));
  const after = (await O.get(`/inventory/items/${item.id}/batches`)).data;
  const r2 = (after.data || after).find((r) => r.batchNo === row.batchNo);
  assert.equal(r2.supplierLotNo, "LOT-9");
  assert.equal(String(r2.expiryDate).slice(0, 10), exp);
});

test("return reason is required", async () => {
  const po = (await O.get("/purchase/orders?status=received&limit=1")).data.data[0] || (await O.get("/purchase/orders?limit=50")).data.data.find((p) => p.receivedAny || p.status === "received" || p.status === "partially_received");
  assert.ok(po, "a received order");
  const stock = (await O.get(`/inventory/stock${pv()}&limit=200`)).data.data.find((r) => r.itemId === item.id && r.available >= 1);
  const line = { itemId: item.id, qty: 1, unit: "kg", source: "stock", locationId: loc.id, batchNo: stock.batchNo, unitCost: 0.05 };
  const none = await O.post("/receiving/returns", { poId: po.id, reasonCategory: "quality", lines: [line] });
  assert.equal(none.data.code, "REASON_REQUIRED");
  const ok = await O.post("/receiving/returns", { poId: po.id, reasonCategory: "quality", returnReason: "Weevils found", lines: [line] });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.returnReason, "Weevils found");
  assert.equal((await O.patch(`/receiving/returns/${ok.data.id}`, { returnReason: "  " })).status, 400);

  // a return can never exceed what was received on the order, less what is already being returned
  const cap = (await O.get(`/receiving/returns/returnable?poId=${po.id}`)).data.find((c) => c.itemId === item.id);
  assert.equal(cap.unit, "g"); assert.equal(cap.received, 10000); assert.equal(cap.returned, 1000); assert.equal(cap.max, 9000);
  const tooMany = await O.post("/receiving/returns", { poId: po.id, reasonCategory: "quality", returnReason: "Too much", lines: [{ ...line, qty: 9.5 }] });
  assert.equal(tooMany.data.code, "OVER_RETURN");
  assert.equal((await O.post("/receiving/returns", { poId: po.id, reasonCategory: "quality", returnReason: "Rest of it", lines: [{ ...line, qty: 9 }] })).status, 201);
  assert.equal((await O.post("/receiving/returns", { poId: po.id, reasonCategory: "quality", returnReason: "More", lines: [{ ...line, qty: 0.5 }] })).data.code, "OVER_RETURN");
});

test("supplier memos are linked and appear on the memo timeline", async () => {
  const m = await O.post("/memos", { title: "Short delivery", memoType: "Supplier Issue", priority: "Normal", venueId, supplierId: sup.id, department: "Purchase", description: "Delivered 8 of 10 kg" });
  assert.equal(m.status, 201, JSON.stringify(m.data));
  const memo = m.data.memo || m.data;
  assert.equal(memo.supplierName, "Credit Co");
  assert.ok((memo.timeline || []).some((t) => /Supplier/i.test(t.action || "") || /Credit Co/.test(t.newValue || "")), "timeline records the supplier link");
  const list = (await O.get(`/memos?supplierId=${sup.id}`)).data;
  assert.equal((list.data || list).length, 1);
  assert.equal((await O.post("/memos", { title: "x", memoType: "Supplier Issue", venueId, supplierId: "nope" })).status, 400);
});

test("stock audit appears in kitchen schedules and follows its lifecycle", async () => {
  await O.post(`/inventory/stock/opening${pv()}`, { itemId: item.id, locationId: loc.id, qty: 5, unit: "kg", unitCost: 0.05, batchNo: "OPEN-1" });
  const a = await O.post(`/automation/audits${pv()}`, { title: "Weekly count", locationId: loc.id });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  const sch = async () => { const r = (await O.get("/kitchenSchedules")).data; return (r.data || r).filter((s) => s.refId === a.data.id); };
  let s = await sch();
  assert.equal(s.length, 1); assert.equal(s[0].department, "Stock Audit"); assert.equal(s[0].status, "Scheduled");
  assert.equal((await O.post(`/automation/audits/${a.data.id}/cancel${pv()}`, {})).status, 200);
  assert.equal((await sch()).length, 0, "cancelled audit leaves the schedule");
});
