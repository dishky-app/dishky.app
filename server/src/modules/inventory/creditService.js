/**
 * creditService.js — database side of credit purchasing. The maths lives in creditCalc.js.
 * The position is always derived from live credit orders and completed settlements; nothing is incremented.
 */
const M = require("./models");
const PM = require("./purchaseModels");
const FM = require("./financeModels");
const CC = require("./creditCalc");

// one at a time per supplier, so two orders cannot both squeeze under the limit
const locks = new Map();
async function withCreditLock(supplierId, fn) {
  const key = `credit:${supplierId}`;
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const tail = prev.then(() => mine);
  locks.set(key, tail);
  await prev;
  try { return await fn(); } finally { release(); if (locks.get(key) === tail) locks.delete(key); }
}

/** Position of one supplier across all branches (suppliers are restaurant-wide). */
async function positionFor(supplier, { excludeId = null, now = new Date() } = {}) {
  const [orders, settlements] = await Promise.all([
    PM.PurchaseOrder.find({ supplierId: supplier.id, purchaseMode: "credit", status: { $in: CC.CREDIT_STATUSES } }).select("id poNo orderDate status totals lines venueId").lean(),
    FM.SupplierPayment.find({ supplierId: supplier.id, purpose: "credit_settlement", status: "completed" }).select("amountPaise").lean(),
  ]);
  const settledPaise = settlements.reduce((n, p) => n + p.amountPaise, 0);
  return CC.creditPosition({ orders, settledPaise, limitPaise: supplier.creditLimitPaise || 0, graceDays: supplier.creditGraceDays ?? 5, now, excludeId });
}

/** Throws unless the credit order may go ahead. Call it inside withCreditLock. */
async function assertCreditAllowed(po, { bad, fmt }) {
  if (po.purchaseMode !== "credit") return null;
  const supplier = await M.Supplier.findOne({ id: po.supplierId }).lean();
  if (!supplier) throw bad("Supplier not found", "NO_SUPPLIER", 404);
  const position = await positionFor(supplier, { excludeId: po.id });
  const r = CC.checkCredit({ enabled: !!supplier.creditEnabled, limitPaise: supplier.creditLimitPaise || 0, position, valuePaise: (po.totals && po.totals.grandTotalPaise) || 0, fmt });
  if (!r.ok) throw bad(r.message, r.code, 409, { outstandingPaise: position.outstandingPaise, limitPaise: supplier.creditLimitPaise || 0 });
  return position;
}

module.exports = { withCreditLock, positionFor, assertCreditAllowed };
