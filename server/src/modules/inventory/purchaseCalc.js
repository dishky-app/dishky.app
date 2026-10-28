/**
 * purchaseCalc.js — pure (no database) calculations and state machines for the
 * procurement workflow. Everything is integer math (see precision.js); nothing
 * here trusts a client-supplied total.
 *
 *   discount / GST rates are stored in BASIS POINTS (1% = 100 bp, 2.5% = 250 bp)
 *   money is paise; unit prices are micro-rupees per BASE unit
 */
const P = require("./precision");
const U = require("./units");

/** paise * bp / 10000, rounded half away from zero (BigInt, no overflow). */
function pctOf(paise, bp) {
  return Number(P.divRound(BigInt(paise) * BigInt(bp), 10000n));
}

const toBp = (rate, label = "rate") => {
  const n = Number(rate);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw Object.assign(new Error(`${label} must be between 0 and 100`), { name: "InventoryError", code: "BAD_RATE", status: 400 });
  return Math.round(n * 100);
};

/** One document line: gross -> discount -> taxable -> GST -> total. */
function calcLine({ qtyMilli, unitPriceMicro, discountBp = 0, gstBp = 0 }) {
  const grossPaise = P.valuePaise(qtyMilli, unitPriceMicro);
  const discountPaise = pctOf(grossPaise, discountBp);
  const taxablePaise = grossPaise - discountPaise;
  const taxPaise = pctOf(taxablePaise, gstBp);
  return { grossPaise, discountPaise, taxablePaise, taxPaise, totalPaise: taxablePaise + taxPaise };
}

/** Document totals. The grand total is rounded to the nearest whole rupee; roundOff records the difference. */
function calcTotals(lines, { freightPaise = 0, otherPaise = 0 } = {}) {
  const sum = (k) => lines.reduce((n, l) => n + (l[k] || 0), 0);
  const subtotalPaise = sum("grossPaise");
  const discountPaise = sum("discountPaise");
  const taxablePaise = sum("taxablePaise");
  const taxPaise = sum("taxPaise");
  const exactPaise = taxablePaise + taxPaise + freightPaise + otherPaise;
  const grandTotalPaise = Math.floor((exactPaise + 50) / 100) * 100; // nearest rupee, .50 rounds up
  return { subtotalPaise, discountPaise, taxablePaise, taxPaise, freightPaise, otherPaise, exactPaise, roundOffPaise: grandTotalPaise - exactPaise, grandTotalPaise };
}

/**
 * Intra-state supply -> CGST + SGST (half each); inter-state -> IGST. Decided from the first two
 * digits (state code) of the supplier's GSTIN and the restaurant's configured state code. When
 * either is missing the split is unknown and null is returned (the total tax is still exact).
 */
function taxSplit(taxPaise, supplierGstin, ownStateCode) {
  const sup = String(supplierGstin || "").slice(0, 2);
  const own = String(ownStateCode || "").padStart(2, "0").slice(0, 2);
  if (!/^\d{2}$/.test(sup) || !/^\d{2}$/.test(own) || own === "00") return null;
  if (sup === own) {
    const cgst = Math.floor(taxPaise / 2);
    return { type: "intra", cgstPaise: cgst, sgstPaise: taxPaise - cgst, igstPaise: 0 };
  }
  return { type: "inter", cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise };
}

/** price entered per `unit` -> micro-rupees per BASE unit of the item. */
function costPerBaseMicro(item, unit, price, customUnits = []) {
  const perEnteredMilli = U.toBaseMilli(1, unit || item.baseUnit, item, customUnits); // milli base units in one entered unit
  return Number(P.divRound(BigInt(P.toMicro(price, "unit price")) * 1000n, BigInt(perEnteredMilli)));
}

/* ── reorder planning ──────────────────────────────────────────────── */
/**
 * position  = available + on order (open PO lines) + on request (PRs not yet ordered)
 * level     = max(reorderPoint, safetyStock + average daily use x supplier lead time)
 * triggers when position <= level, or position < minStock
 * target    = maxStock if set, else level + reorderQty
 * quantity  = max(target - position, reorderQty), rounded UP to a whole pack
 * `available` already excludes reserved/quarantined/damaged/expired stock, so reserved
 * quantities are never subtracted twice; incoming quantities are counted exactly once.
 */
function reorderSuggestion({ item, availableMilli, onOrderMilli = 0, onRequestMilli = 0, avgDailyMilli = 0, leadTimeDays = 0, packMilli = 0 }) {
  const position = availableMilli + onOrderMilli + onRequestMilli;
  const demandMilli = Math.round(avgDailyMilli * leadTimeDays);
  const level = Math.max(item.reorderPointMilli || 0, (item.safetyStockMilli || 0) + demandMilli);
  const belowMin = (item.minStockMilli || 0) > 0 && position < item.minStockMilli;
  const hasPolicy = level > 0 || (item.minStockMilli || 0) > 0;
  if (!hasPolicy || !(position <= level || belowMin)) return null;
  const target = item.maxStockMilli > 0 ? item.maxStockMilli : level + (item.reorderQtyMilli || 0);
  let qty = Math.max(target - position, item.reorderQtyMilli || 0);
  if (qty <= 0) return null;
  if (packMilli > 0) qty = Math.ceil(qty / packMilli) * packMilli;
  const priority = availableMilli <= 0 ? "urgent" : position <= (item.safetyStockMilli || 0) ? "high" : "normal";
  return { qtyMilli: qty, positionMilli: position, levelMilli: level, demandMilli, priority };
}

/* ── status machines ───────────────────────────────────────────────── */
const PR_FLOW = {
  draft: ["pending_approval", "approved", "cancelled"],
  pending_approval: ["approved", "rejected", "changes_requested", "cancelled"],
  changes_requested: ["pending_approval", "approved", "cancelled"],
  approved: ["rfq_issued", "ordered", "cancelled"],
  rfq_issued: ["approved", "ordered"], // back to approved only when its RFQ is cancelled
  rejected: [], ordered: [], cancelled: [],
};
const RFQ_FLOW = {
  draft: ["sent", "cancelled"],
  sent: ["responses_received", "evaluation", "cancelled"],
  responses_received: ["evaluation", "awarded", "cancelled"],
  evaluation: ["awarded", "cancelled"],
  awarded: ["closed"],
  closed: [], cancelled: [],
};
const PO_FLOW = {
  draft: ["pending_approval", "approved", "cancelled"],
  pending_approval: ["approved", "rejected", "draft", "cancelled"],
  rejected: ["draft", "cancelled"],
  approved: ["sent", "draft", "cancelled"],
  sent: ["partially_received", "received", "closed", "draft", "cancelled"],
  partially_received: ["received", "closed"],
  received: ["closed", "partially_received"], // back when a return reopens quantity
  closed: [], cancelled: [],
};
const RETURN_FLOW = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled"],
  rejected: ["draft", "pending_approval", "cancelled"],
  approved: ["dispatched", "cancelled"],
  dispatched: ["credited"],
  credited: [], cancelled: [],
};
const GRN_FLOW = { draft: ["posting", "cancelled"], posting: ["posted"], posted: [], cancelled: [] };

/** PO status implied by its line quantities (only for statuses that can receive goods). */
function derivePoStatus(lines, current) {
  if (!["sent", "partially_received", "received"].includes(current)) return current;
  const recv = lines.some((l) => l.receivedMilli > 0);
  const open = lines.some((l) => l.qtyMilli - l.receivedMilli - (l.closedMilli || 0) > 0);
  if (!recv) return "sent";
  return open ? "partially_received" : "received";
}
const canMove = (flow, from, to) => !!(flow[from] && flow[from].includes(to));
const statusesThatCanMoveTo = (flow, to) => Object.keys(flow).filter((s) => flow[s].includes(to));

module.exports = {
  pctOf, toBp, calcLine, calcTotals, taxSplit, costPerBaseMicro, reorderSuggestion,
  PR_FLOW, RFQ_FLOW, PO_FLOW, RETURN_FLOW, GRN_FLOW, derivePoStatus, canMove, statusesThatCanMoveTo,
};
