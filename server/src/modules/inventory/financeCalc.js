/**
 * financeCalc.js — pure helpers for supplier invoices: due dates, duplicate keys, three-way match, aging.
 * Order (PO) -> goods receipt (the PO line's receivedMilli, derived from posted receipts) -> invoice.
 */
const P = require("./precision");

const invoiceKey = (supplierId, invoiceNo) => `${supplierId}|${String(invoiceNo || "").toUpperCase().replace(/[^A-Z0-9]/g, "")}`;

/** "Net 30", "30 days" -> 30; anything else -> null */
function termsDays(text) {
  const m = /(?:net\s*(\d{1,3}))|(?:(\d{1,3})\s*days?)/i.exec(String(text || ""));
  return m ? parseInt(m[1] || m[2], 10) : null;
}
function dueDateFrom(invoiceDate, terms) {
  const n = termsDays(terms);
  return n === null ? null : new Date(+new Date(invoiceDate) + n * 864e5);
}

/** net (after discount, before GST) price per base unit, micro-rupees */
const netMicro = (taxablePaise, qtyMilli) => (qtyMilli > 0 ? Number(P.divRound(BigInt(taxablePaise) * 10000000n, BigInt(qtyMilli))) : 0);

/**
 * invoice: { poId, lines, totals, statedTotalPaise }
 * po: purchase order (lean) or null. othersQty: Map(itemId -> milli already billed on other live invoices of the PO).
 * tol: { qtyPct, pricePct, totalPaise }
 * Returns { status: matched|variance|unmatched, flags: [], lines: [...] }.
 */
function threeWayMatch({ invoice, po, othersQty = new Map(), tol = {} }) {
  const qtyPct = tol.qtyPct || 0, pricePct = tol.pricePct || 0, totalPaise = tol.totalPaise ?? 100;
  const flags = [];
  if (!po) return { status: "unmatched", flags: ["no_purchase_order"], lines: [] };
  const lines = invoice.lines.map((l) => {
    const pl = po.lines.find((x) => x.itemId === l.itemId);
    if (!pl) return { itemId: l.itemId, status: "not_on_po" };
    const billable = Math.max(0, pl.receivedMilli - (othersQty.get(l.itemId) || 0));
    const qtyVar = l.qtyMilli - billable;
    const allowedQty = Math.floor((billable * qtyPct) / 100);
    const poNet = netMicro(pl.taxablePaise, pl.qtyMilli), invNet = netMicro(l.taxablePaise, l.qtyMilli);
    const priceHigh = invNet > poNet + Math.floor((poNet * pricePct) / 100);
    const priceVarianceMicro = invNet - poNet;
    const out = {
      itemId: l.itemId, billableMilli: billable, invoicedMilli: l.qtyMilli, qtyVarianceMilli: qtyVar,
      poNetMicro: poNet, invoiceNetMicro: invNet, priceVarianceMicro, priceVariancePaise: P.valuePaise(l.qtyMilli, priceVarianceMicro),
      poGstBp: pl.gstBp, invoiceGstBp: l.gstBp,
    };
    if (pl.receivedMilli <= 0) out.status = "not_received";
    else if (qtyVar > allowedQty) out.status = "over_billed";
    else if (priceHigh) out.status = "price_high";
    else if (l.gstBp !== pl.gstBp) out.status = "tax_mismatch";
    else out.status = "ok";
    return out;
  });
  if (lines.some((l) => l.status !== "ok")) flags.push("line_variance");
  if (invoice.statedTotalPaise !== null && invoice.statedTotalPaise !== undefined && Math.abs(invoice.statedTotalPaise - invoice.totals.grandTotalPaise) > totalPaise) flags.push("stated_total_mismatch");
  return { status: flags.length ? "variance" : "matched", flags, lines };
}

/** days past due -> bucket */
function agingBucket(dueDate, now = Date.now()) {
  if (!dueDate) return "no_due_date";
  const days = Math.floor((now - +new Date(dueDate)) / 864e5);
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

module.exports = { invoiceKey, termsDays, dueDateFrom, netMicro, threeWayMatch, agingBucket };
