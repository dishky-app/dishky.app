/**
 * stockService.js — the ONLY code allowed to change stock.
 *
 * Every stock-changing action (opening stock, adjustment, waste, status move,
 * reversal — and later goods receipts, transfers, consumption, returns) goes
 * through postMovement() / changeStatus() / reverseEntry(), which guarantee:
 *
 *   1. ATOMIC      balance update + ledger insert happen in one MongoDB
 *                  transaction. If the deployment has no transactions (a
 *                  standalone mongod, FerretDB), posting is REFUSED with 503
 *                  TRANSACTIONS_REQUIRED — it never silently degrades. The one
 *                  escape hatch is INVENTORY_ALLOW_NO_TRANSACTIONS=true, meant
 *                  for local development/tests only (see withTransaction).
 *   2. IDEMPOTENT  every posting carries an idempotencyKey (the client may send
 *                  one; otherwise a random key is generated). The key has a
 *                  unique index on the ledger, so a repeated request returns
 *                  the original entry (`replayed: true`) and never posts twice.
 *   3. CONCURRENT  balances carry a `rev` token; updates are conditional on it
 *                  and retried, so two simultaneous postings can never both
 *                  succeed against the same stale balance.
 *   4. NO NEGATIVE stock cannot go below zero unless the item explicitly allows it.
 *   5. APPEND-ONLY the ledger is never edited; corrections are `reversal` entries.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const { StockBalance, StockLedger, nextNumber } = require("./models");
const P = require("./precision");

class InventoryError extends Error {
  constructor(message, code = "INVENTORY_ERROR", status = 400, details) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Post-commit hook, called (best effort, never throws) after every NEW stock posting.
 * ingredientBridge uses it to keep the legacy `ingredients.stockRemaining` in step.
 */
let postHook = null;
function setPostHook(fn) { postHook = fn; }
async function runPostHook(ctx, entry) {
  if (!postHook) return;
  try { await postHook(ctx, entry); } catch (e) { console.error("[inventory] post-posting hook failed:", e.message); }
}

const IN_TYPES = new Set(["opening", "receipt", "adjustment_in", "transfer_in"]);
const OUT_TYPES = new Set(["adjustment_out", "waste", "consumption", "supplier_return", "transfer_out"]);

/* ── transactions ─────────────────────────────────────────────────── */
function supportsTransactions() {
  try {
    const client = mongoose.connection.getClient();
    const type = client && client.topology && client.topology.description && client.topology.description.type;
    return ["ReplicaSetWithPrimary", "Sharded", "LoadBalanced"].includes(type);
  } catch {
    return false;
  }
}

let warnedNoTxn = false;
async function withTransaction(fn) {
  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let out;
      await session.withTransaction(async () => { out = await fn(session); });
      return out;
    } finally {
      await session.endSession();
    }
  }
  if (process.env.INVENTORY_ALLOW_NO_TRANSACTIONS === "true") {
    if (!warnedNoTxn) {
      warnedNoTxn = true;
      console.warn("[inventory] INVENTORY_ALLOW_NO_TRANSACTIONS=true: stock postings are NOT atomic. Never use this in production.");
    }
    return fn(null);
  }
  throw new InventoryError(
    "Stock posting requires a MongoDB replica set (transactions are not available on this deployment).",
    "TRANSACTIONS_REQUIRED",
    503
  );
}

const isDupKey = (e) => e && (e.code === 11000 || /E11000|duplicate key/i.test(String(e.message)));

/**
 * In-process serialisation per balance row. Defence in depth only: it removes
 * pointless retries inside one Node process. Correctness across processes and
 * instances comes from the `rev` compare-and-set below (and transactions).
 */
const locks = new Map();
async function withLocalLock(lockKey, fn) {
  const prev = locks.get(lockKey) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const tail = prev.then(() => mine);
  locks.set(lockKey, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(lockKey) === tail) locks.delete(lockKey);
  }
}
const lockKeyOf = (key) => `${key.venueId}|${key.itemId}|${key.locationId}|${key.batchNo}`;

/* ── balance mutation (optimistic concurrency) ────────────────────── */
const balanceKey = (venueId, itemId, locationId, batchNo) => ({ venueId, itemId, locationId, batchNo: batchNo || "" });

function recompute(next) {
  next.availableMilli = next.qtyOnHandMilli - next.reservedMilli - next.quarantinedMilli - next.damagedMilli;
  return next;
}

/**
 * Read the balance row (creating an empty one if `create`), let `compute(bal)`
 * return the new field values, and write them only if nobody changed the row in
 * between. Retries on a lost race.
 */
async function mutateBalance(session, key, { create, compute }) {
  for (let attempt = 0; attempt < 12; attempt++) {
    let bal = await StockBalance.findOne(key).session(session).lean();
    if (!bal) {
      // Let the caller refuse first (e.g. insufficient stock) so nothing is created for a doomed request.
      compute(null);
      if (!create) throw new InventoryError("No stock record found", "NO_STOCK", 409);
      const seed = {
        qtyOnHandMilli: 0, reservedMilli: 0, quarantinedMilli: 0, damagedMilli: 0, availableMilli: 0,
        unitCostMicro: 0, rev: 0, mfgDate: null, expiryDate: null,
      };
      await StockBalance.updateOne(key, { $setOnInsert: seed }, { upsert: true, session });
      bal = await StockBalance.findOne(key).session(session).lean();
      if (!bal) continue;
    }
    const next = compute(bal);
    const res = await StockBalance.updateOne(
      { ...key, rev: bal.rev },
      { $set: next, $inc: { rev: 1 } },
      { session }
    );
    if (res.modifiedCount === 1) return { before: bal, after: { ...bal, ...next, rev: bal.rev + 1 } };
  }
  throw new InventoryError("Stock was changed by another request; please retry.", "CONCURRENT_UPDATE", 409);
}

const insufficient = (have, need, what = "available") =>
  new InventoryError(
    `Insufficient ${what} stock: ${P.fromMilli(have)} on hand, ${P.fromMilli(need)} requested.`,
    "INSUFFICIENT_STOCK",
    409,
    { haveMilli: have, needMilli: need }
  );

/* ── ledger helpers ───────────────────────────────────────────────── */
async function findReplay(session, key) {
  return StockLedger.findOne({ idempotencyKey: key }).session(session).lean();
}

function assertReplayMatches(prior, m, ctx) {
  const same =
    prior.venueId === ctx.venueId && prior.itemId === m.itemId && prior.locationId === m.locationId &&
    (prior.batchNo || "") === (m.batchNo || "");
  if (!same) {
    throw new InventoryError("This idempotency key was already used for a different stock movement.", "IDEMPOTENCY_CONFLICT", 409);
  }
}

async function insertLedger(session, doc) {
  const [created] = await StockLedger.create([doc], { session });
  return created.toObject();
}

/**
 * Runs a posting. If a unique index rejects it: when the idempotency key already
 * exists the request is a replay (return the winner); otherwise the transaction
 * number collided, so take a fresh one and try again (bounded).
 */
async function runWithRetry(lockKey, idempotencyKey, run, renumber) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withLocalLock(lockKey, run);
    } catch (e) {
      if (!isDupKey(e)) throw e;
      const winner = await StockLedger.findOne({ idempotencyKey }).lean();
      if (winner) return { entry: winner, replayed: true };
      if (attempt >= 5) throw e;
      await renumber();
    }
  }
}

/* ── public: post a quantity movement ─────────────────────────────── */
/**
 * ctx = { venueId, user: { id, name } }
 * m   = { item (lean doc), itemId, locationId, batchNo, type, direction?, qtyMilli (>0),
 *         unitCostMicro?, mfgDate?, expiryDate?, fromBucket?, refType?, refId?, reason?,
 *         idempotencyKey?, approvalRef?, reversalOf?, meta? }
 * Returns { entry, replayed }.
 */
async function postMovementCore(ctx, m) {
  const direction = m.direction || (IN_TYPES.has(m.type) ? "in" : OUT_TYPES.has(m.type) ? "out" : null);
  if (!direction) throw new InventoryError(`Unsupported movement type "${m.type}"`, "BAD_TYPE");
  if (!Number.isSafeInteger(m.qtyMilli) || m.qtyMilli <= 0) throw new InventoryError("Quantity must be greater than zero", "BAD_QTY");
  const item = m.item;
  if (!item) throw new InventoryError("Item is required", "BAD_ITEM");

  const idempotencyKey = m.idempotencyKey || `auto:${crypto.randomUUID()}`;
  const batchNo = m.batchNo || "";
  const key = balanceKey(ctx.venueId, m.itemId, m.locationId, batchNo);

  // Fast replay path (outside any transaction).
  const prior = await StockLedger.findOne({ idempotencyKey }).lean();
  if (prior) {
    assertReplayMatches(prior, { ...m, batchNo }, ctx);
    return { entry: prior, replayed: true };
  }

  let txnNo = await nextNumber("ledger", "TXN", 7);
  const fromBucket = m.fromBucket || "available";
  const allowNegative = !!item.allowNegativeStock;
  const unitCostIn = direction === "in" ? Math.max(0, m.unitCostMicro || 0) : 0;
  const now = Date.now();

  const run = () => withTransaction(async (session) => {
    const again = await findReplay(session, idempotencyKey);
    if (again) { assertReplayMatches(again, { ...m, batchNo }, ctx); return { entry: again, replayed: true }; }

    const { before, after } = await mutateBalance(session, key, {
      create: direction === "in" || allowNegative,
      compute: (bal) => {
        if (direction === "in") {
          const b = bal || { qtyOnHandMilli: 0, reservedMilli: 0, quarantinedMilli: 0, damagedMilli: 0, unitCostMicro: 0, mfgDate: null, expiryDate: null };
          const onHand = b.qtyOnHandMilli + m.qtyMilli;
          const baseQty = Math.max(0, b.qtyOnHandMilli);
          const next = {
            qtyOnHandMilli: onHand,
            reservedMilli: b.reservedMilli,
            quarantinedMilli: b.quarantinedMilli,
            damagedMilli: b.damagedMilli,
            unitCostMicro: P.weightedAverageMicro(baseQty, b.unitCostMicro, m.qtyMilli, unitCostIn),
            mfgDate: b.mfgDate || m.mfgDate || null,
            expiryDate: b.expiryDate || m.expiryDate || null,
          };
          if (b.qtyOnHandMilli > 0 && m.expiryDate && b.expiryDate && +new Date(b.expiryDate) !== +new Date(m.expiryDate)) {
            throw new InventoryError("This batch already exists with a different expiry date. Use a new batch number.", "BATCH_DATE_MISMATCH", 409);
          }
          return recompute(next);
        }
        // direction === "out"
        if (!bal && !allowNegative) throw insufficient(0, m.qtyMilli, fromBucket);
        const b = bal || { qtyOnHandMilli: 0, reservedMilli: 0, quarantinedMilli: 0, damagedMilli: 0, availableMilli: 0, unitCostMicro: 0, expiryDate: null };
        if (m.type === "consumption" && b.expiryDate && +new Date(b.expiryDate) < now) {
          throw new InventoryError("This batch is expired and cannot be consumed. Write it off as waste instead.", "EXPIRED_STOCK", 409);
        }
        const next = {
          qtyOnHandMilli: b.qtyOnHandMilli - m.qtyMilli,
          reservedMilli: b.reservedMilli,
          quarantinedMilli: b.quarantinedMilli,
          damagedMilli: b.damagedMilli,
          unitCostMicro: b.unitCostMicro,
        };
        if (fromBucket === "available") {
          if (b.availableMilli < m.qtyMilli && !allowNegative) throw insufficient(b.availableMilli, m.qtyMilli);
        } else if (fromBucket === "quarantined") {
          if (b.quarantinedMilli < m.qtyMilli) throw insufficient(b.quarantinedMilli, m.qtyMilli, "quarantined");
          next.quarantinedMilli -= m.qtyMilli;
        } else if (fromBucket === "damaged") {
          if (b.damagedMilli < m.qtyMilli) throw insufficient(b.damagedMilli, m.qtyMilli, "damaged");
          next.damagedMilli -= m.qtyMilli;
        } else {
          throw new InventoryError(`Unknown stock bucket "${fromBucket}"`, "BAD_BUCKET");
        }
        return recompute(next);
      },
    });

    const costMicro = direction === "in" ? unitCostIn : before.unitCostMicro;
    const value = P.valuePaise(m.qtyMilli, costMicro);
    try {
      const entry = await insertLedger(session, {
        txnNo, venueId: ctx.venueId, locationId: m.locationId, itemId: m.itemId, batchNo,
        type: m.type,
        refType: m.refType || "", refId: m.refId || "",
        qtyInMilli: direction === "in" ? m.qtyMilli : 0,
        qtyOutMilli: direction === "out" ? m.qtyMilli : 0,
        unit: item.baseUnit,
        balanceAfterMilli: after.qtyOnHandMilli,
        unitCostMicro: costMicro,
        valueImpactPaise: direction === "in" ? value : -value,
        reason: m.reason || "",
        meta: m.meta,
        userId: ctx.user && ctx.user.id ? ctx.user.id : null,
        userName: (ctx.user && ctx.user.name) || "",
        approvalRef: m.approvalRef || "",
        reversalOf: m.reversalOf || "",
        idempotencyKey,
        postedAt: new Date(),
      });
      return { entry, replayed: false, balance: after };
    } catch (e) {
      if (!supportsTransactions() && isDupKey(e)) {
        // Non-transactional dev mode only: the balance was already changed, undo it.
        await mutateBalance(null, key, {
          create: true,
          compute: (bal) => recompute({
            qtyOnHandMilli: bal.qtyOnHandMilli + (direction === "in" ? -m.qtyMilli : m.qtyMilli),
            reservedMilli: bal.reservedMilli, quarantinedMilli: bal.quarantinedMilli, damagedMilli: bal.damagedMilli,
            unitCostMicro: bal.unitCostMicro,
          }),
        });
      }
      throw e;
    }
  });

  return runWithRetry(lockKeyOf(key), idempotencyKey, run, async () => { txnNo = await nextNumber("ledger", "TXN", 7); });
}

async function postMovement(ctx, m) {
  const r = await postMovementCore(ctx, m);
  if (!r.replayed) await runPostHook(ctx, r.entry);
  return r;
}

/* ── public: move quantity between stock buckets (no on-hand change) ─ */
const STATUS_ACTIONS = {
  quarantine: { from: "available", to: "quarantined" },
  release: { from: "quarantined", to: "available" },
  damage: { from: "available", to: "damaged" },
  damage_quarantined: { from: "quarantined", to: "damaged" },
};

async function changeStatusCore(ctx, m) {
  const action = STATUS_ACTIONS[m.action];
  if (!action) throw new InventoryError(`Unknown status action "${m.action}"`, "BAD_ACTION");
  if (!Number.isSafeInteger(m.qtyMilli) || m.qtyMilli <= 0) throw new InventoryError("Quantity must be greater than zero", "BAD_QTY");
  const batchNo = m.batchNo || "";
  const key = balanceKey(ctx.venueId, m.itemId, m.locationId, batchNo);
  const idempotencyKey = m.idempotencyKey || `auto:${crypto.randomUUID()}`;

  const prior = await StockLedger.findOne({ idempotencyKey }).lean();
  if (prior) { assertReplayMatches(prior, { ...m, batchNo }, ctx); return { entry: prior, replayed: true }; }
  let txnNo = await nextNumber("ledger", "TXN", 7);

  const run = () => withTransaction(async (session) => {
    const again = await findReplay(session, idempotencyKey);
    if (again) return { entry: again, replayed: true };
    const { before, after } = await mutateBalance(session, key, {
      create: false,
      compute: (bal) => {
        if (!bal) throw insufficient(0, m.qtyMilli, action.from);
        const next = {
          qtyOnHandMilli: bal.qtyOnHandMilli, reservedMilli: bal.reservedMilli,
          quarantinedMilli: bal.quarantinedMilli, damagedMilli: bal.damagedMilli, unitCostMicro: bal.unitCostMicro,
        };
        const bucketField = { quarantined: "quarantinedMilli", damaged: "damagedMilli" };
        if (action.from === "available") {
          if (bal.availableMilli < m.qtyMilli) throw insufficient(bal.availableMilli, m.qtyMilli);
        } else {
          const f = bucketField[action.from];
          if (bal[f] < m.qtyMilli) throw insufficient(bal[f], m.qtyMilli, action.from);
          next[f] -= m.qtyMilli;
        }
        if (action.to !== "available") next[bucketField[action.to]] += m.qtyMilli;
        return recompute(next);
      },
    });
    const entry = await insertLedger(session, {
      txnNo, venueId: ctx.venueId, locationId: m.locationId, itemId: m.itemId, batchNo,
      type: "status_change", refType: m.refType || "", refId: m.refId || "",
      qtyInMilli: 0, qtyOutMilli: 0, unit: m.item.baseUnit,
      balanceAfterMilli: after.qtyOnHandMilli, unitCostMicro: before.unitCostMicro, valueImpactPaise: 0,
      reason: m.reason || "", meta: { action: m.action, from: action.from, to: action.to, qtyMilli: m.qtyMilli },
      userId: ctx.user && ctx.user.id ? ctx.user.id : null, userName: (ctx.user && ctx.user.name) || "",
      idempotencyKey, postedAt: new Date(),
    });
    return { entry, replayed: false, balance: after };
  });

  return runWithRetry(lockKeyOf(key), idempotencyKey, run, async () => { txnNo = await nextNumber("ledger", "TXN", 7); });
}

async function changeStatus(ctx, m) {
  const r = await changeStatusCore(ctx, m);
  if (!r.replayed) await runPostHook(ctx, r.entry);
  return r;
}

/**
 * Take `qtyMilli` of an item out of a branch, first-expiry-first-out: soonest-expiring
 * non-expired rows first, rows without expiry last. Expired, quarantined, damaged and
 * reserved stock is never touched. Each row is its own ledger entry.
 *
 * clamp=true  (order consumption): take what exists, never fail, return the shortfall.
 * clamp=false: throw INSUFFICIENT_STOCK before posting anything if stock is short.
 * Items with allowNegativeStock post any remainder against their first row/location.
 */
async function consumeFefo(ctx, { item, qtyMilli, type = "consumption", reason, refType = "", refId = "", keyBase, clamp = false, fallbackLocationId }) {
  const now = new Date();
  const rows = await StockBalance.find({ venueId: ctx.venueId, itemId: item.id, availableMilli: { $gt: 0 } }).lean();
  const usable = rows
    .filter((r) => !(r.expiryDate && +new Date(r.expiryDate) < +now))
    .sort((a, b) => {
      const ea = a.expiryDate ? +new Date(a.expiryDate) : Infinity;
      const eb = b.expiryDate ? +new Date(b.expiryDate) : Infinity;
      return ea - eb || String(a.batchNo).localeCompare(String(b.batchNo));
    });
  const total = usable.reduce((n, r) => n + r.availableMilli, 0);
  if (!clamp && !item.allowNegativeStock && total < qtyMilli) throw insufficient(total, qtyMilli);

  let remaining = qtyMilli;
  const entries = [];
  for (const r of usable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, r.availableMilli);
    try {
      const res = await postMovement(ctx, {
        item, itemId: item.id, locationId: r.locationId, batchNo: r.batchNo, type, qtyMilli: take,
        reason, refType, refId, idempotencyKey: `${keyBase}:${r.locationId}:${r.batchNo}`,
      });
      entries.push(res.entry);
      remaining -= take;
    } catch (e) {
      if (e.code !== "INSUFFICIENT_STOCK" && e.code !== "EXPIRED_STOCK") throw e; // lost a race: try the next row
    }
  }
  if (remaining > 0 && item.allowNegativeStock) {
    const loc = usable[0]?.locationId || rows[0]?.locationId || fallbackLocationId;
    if (loc) {
      const res = await postMovement(ctx, {
        item, itemId: item.id, locationId: loc, batchNo: usable[0]?.batchNo || "", type, qtyMilli: remaining,
        reason, refType, refId, idempotencyKey: `${keyBase}:negative`,
      });
      entries.push(res.entry);
      remaining = 0;
    }
  }
  return { entries, shortfallMilli: Math.max(0, remaining) };
}

/* ── public: reverse a posted entry ───────────────────────────────── */
const NON_REVERSIBLE = new Set(["reversal", "status_change"]);

/**
 * Posts the exact opposite movement and links it to the original. The
 * deterministic idempotency key `reversal:<entryId>` means an entry can be
 * reversed at most once, even under concurrent requests.
 */
async function reverseEntry(ctx, entry, item, reason) {
  if (NON_REVERSIBLE.has(entry.type)) {
    throw new InventoryError(`A ${entry.type.replace("_", " ")} entry cannot be reversed.`, "NOT_REVERSIBLE", 409);
  }
  const wasIn = entry.qtyInMilli > 0;
  const qtyMilli = wasIn ? entry.qtyInMilli : entry.qtyOutMilli;
  return postMovement(ctx, {
    item, itemId: entry.itemId, locationId: entry.locationId, batchNo: entry.batchNo,
    type: "reversal", direction: wasIn ? "out" : "in",
    qtyMilli,
    // putting stock back (reversing an OUT) restores it at the cost it left at
    unitCostMicro: wasIn ? 0 : entry.unitCostMicro,
    reason: reason || `Reversal of ${entry.txnNo}`,
    refType: "ledger", refId: entry.id,
    reversalOf: entry.id,
    idempotencyKey: `reversal:${entry.id}`,
    meta: { reverses: entry.txnNo },
  });
}

module.exports = {
  InventoryError, IN_TYPES, OUT_TYPES, STATUS_ACTIONS,
  supportsTransactions, withTransaction,
  postMovement, changeStatus, reverseEntry, balanceKey, consumeFefo, setPostHook,
};
