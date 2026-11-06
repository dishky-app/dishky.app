/**
 * creditCalc.js — pure maths for credit-based purchasing (no database access, unit-testable).
 *
 * A supplier can be put on credit with a fund limit. Purchase orders raised in "credit" mode draw on that limit;
 * the balance is repaid by "credit settlement" payments. Nothing here is stored: the position is DERIVED every
 * time from the credit orders and the completed settlement payments (same rule as paid amounts on invoices).
 *
 *   outstanding = value of live credit orders − completed credit settlements
 *   available   = limit − outstanding
 *
 * Settlements are applied oldest order first. The oldest order that is still (even partly) unpaid decides the
 * monthly due date: the end of the calendar month it was raised in, plus the supplier's grace days. A settlement is
 * therefore due either at that monthly date or as soon as the limit is touched, whichever comes first.
 */

// order statuses that hold a claim on the limit (drafts, rejected and cancelled orders do not)
const CREDIT_STATUSES = ["pending_approval", "approved", "sent", "partially_received", "received", "closed"];

/** What a credit order costs the account. A short-closed order only counts what was actually kept. */
function creditValuePaise(po) {
  const total = (po.totals && po.totals.grandTotalPaise) || 0;
  if (po.status !== "closed") return total;
  const lines = po.lines || [];
  const kept = lines.reduce((n, l) => (l.qtyMilli > 0 ? n + Math.round(l.totalPaise * ((l.qtyMilli - (l.closedMilli || 0)) / l.qtyMilli)) : n), 0);
  const anyReceived = lines.some((l) => l.receivedMilli > 0);
  const charges = anyReceived ? ((po.totals && po.totals.freightPaise) || 0) + ((po.totals && po.totals.otherPaise) || 0) : 0;
  return Math.max(0, kept + charges);
}

/** Last instant of the calendar month `d` falls in (server-local), then + graceDays. */
function cycleDueDate(d, graceDays = 0) {
  const x = new Date(d);
  const end = new Date(x.getFullYear(), x.getMonth() + 1, 0, 23, 59, 59, 999);
  end.setDate(end.getDate() + (Number(graceDays) || 0));
  return end;
}

const cycleKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };

/**
 * orders: [{ id, poNo, orderDate, status, totals, lines, venueId }] (credit orders of ONE supplier)
 * settledPaise: total of completed credit settlements
 * Returns the account position and a per-order statement (oldest first).
 */
function creditPosition({ orders, settledPaise = 0, limitPaise = 0, graceDays = 0, now = new Date(), excludeId = null }) {
  const live = orders.filter((o) => CREDIT_STATUSES.includes(o.status) && o.id !== excludeId)
    .sort((a, b) => +new Date(a.orderDate) - +new Date(b.orderDate) || String(a.poNo).localeCompare(String(b.poNo)));
  let pool = Math.max(0, settledPaise);
  let used = 0, firstOpen = null;
  const statement = live.map((o) => {
    const value = creditValuePaise(o);
    const paid = Math.min(value, pool); pool -= paid;
    const remaining = value - paid;
    used += value;
    if (remaining > 0 && !firstOpen) firstOpen = o;
    return { id: o.id, poNo: o.poNo, venueId: o.venueId, orderDate: o.orderDate, status: o.status, valuePaise: value, settledPaise: paid, remainingPaise: remaining, cycle: cycleKey(o.orderDate), dueDate: cycleDueDate(o.orderDate, graceDays) };
  });
  const outstanding = Math.max(0, used - Math.max(0, settledPaise));
  const advance = Math.max(0, Math.max(0, settledPaise) - used); // paid ahead of any order
  const dueDate = firstOpen ? cycleDueDate(firstOpen.orderDate, graceDays) : null;
  const overdue = !!(dueDate && +now > +dueDate);
  const limitReached = limitPaise > 0 && outstanding >= limitPaise;
  const monthEnd = !!(firstOpen && +now > +cycleDueDate(firstOpen.orderDate, 0)); // month is over (grace days may still apply)
  const settleNow = outstanding > 0 && (limitReached || overdue);
  return {
    limitPaise, outstandingPaise: outstanding, availablePaise: Math.max(0, limitPaise - outstanding), advancePaise: advance,
    utilizationPct: limitPaise > 0 ? Math.round((outstanding / limitPaise) * 1000) / 10 : null,
    dueDate, overdue, limitReached, cycleEnded: monthEnd, settleNow,
    reason: !outstanding ? null : limitReached ? "limit_reached" : overdue ? "month_overdue" : monthEnd ? "month_end_grace" : null,
    statement,
  };
}

/**
 * Can an order worth `valuePaise` go on credit? Returns { ok, code, message }.
 * `position` must be computed EXCLUDING the order itself (excludeId), otherwise it would count twice.
 */
function checkCredit({ enabled, limitPaise, position, valuePaise, fmt = (p) => `₹${(p / 100).toFixed(2)}` }) {
  if (!enabled) return { ok: false, code: "CREDIT_NOT_ENABLED", message: "This supplier is not set up for credit purchases. Enable credit on the supplier, or buy on cash." };
  if (!(limitPaise > 0)) return { ok: false, code: "CREDIT_NO_LIMIT", message: "Set a credit (fund) limit on the supplier before buying on credit." };
  if (position.overdue) return { ok: false, code: "CREDIT_OVERDUE", message: `The monthly credit settlement for this supplier was due on ${new Date(position.dueDate).toLocaleDateString("en-IN")}. Settle the outstanding ${fmt(position.outstandingPaise)} before buying more on credit.` };
  if (position.outstandingPaise + valuePaise > limitPaise) {
    return {
      ok: false, code: "CREDIT_LIMIT_EXCEEDED",
      message: `This order (${fmt(valuePaise)}) would take the supplier's credit to ${fmt(position.outstandingPaise + valuePaise)}, above the limit of ${fmt(limitPaise)}. Available: ${fmt(position.availablePaise)}. Settle part of the balance first.`,
    };
  }
  return { ok: true };
}

module.exports = { CREDIT_STATUSES, creditValuePaise, cycleDueDate, cycleKey, creditPosition, checkCredit };
