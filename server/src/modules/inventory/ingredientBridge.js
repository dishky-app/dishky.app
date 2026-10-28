/**
 * ingredientBridge.js — makes the stock ledger the single source of truth for
 * ingredient stock, while the existing screens that read/write the legacy
 * `ingredients` collection (Stocks page, menu availability) keep working.
 *
 *   linked ingredient  = an `ingredients` record (per branch) tied to an inventory
 *                        item through invIngredientLinks.
 *   ORDERS             consumption is posted to the ledger (FEFO) instead of
 *                      decrementing `stockRemaining` directly.
 *   STOCKS PAGE EDITS  a changed `stockRemaining` on a linked ingredient becomes a
 *                      ledger adjustment for the difference.
 *   PROJECTION         after every posting for a linked item, `stockRemaining`
 *                      (kg) is rewritten from the ledger balances (available,
 *                      non-expired stock in that branch).
 *
 * Units: the legacy field is KILOGRAMS (the server has always deducted grams/1000);
 * imported items use grams as their base unit.
 *
 * Unlinked ingredients are untouched and keep the old behaviour.
 */
const M = require("./models");
const P = require("./precision");
const U = require("./units");
const svc = require("./stockService");
const { getModel } = require("../../core/genericModel");

let emitChange = () => {};
function init({ emitChange: emit }) {
  if (typeof emit === "function") emitChange = emit;
  svc.setPostHook(projectAfterPosting);
}

const SYSTEM = (label) => ({ id: null, name: label });
const kgString = (kg) => Number(kg).toFixed(6);

/* ── helpers ───────────────────────────────────────────────────────── */
async function defaultLocation(venueId, { create = false } = {}) {
  let loc = await M.StorageLocation.findOne({ venueId, status: "active" }).sort({ createdAt: 1 }).lean();
  if (!loc && create) loc = (await M.StorageLocation.create({ venueId, code: "MAIN", name: "Main store", type: "dry_store" })).toObject();
  return loc;
}

/** kg of available, non-expired stock of an item in a branch. */
async function availableKg(venueId, itemId) {
  const rows = await M.StockBalance.find({ venueId, itemId }).lean();
  const now = Date.now();
  const milli = rows.reduce((n, r) => n + (r.expiryDate && +new Date(r.expiryDate) < now ? 0 : Math.max(0, r.availableMilli)), 0);
  return milli;
}

function milliToKg(item, milli) {
  // convert milli base units -> kg via the item's own conversion rules
  const perKgMilli = U.toBaseMilli(1, "kg", item); // milli base units in 1 kg
  return Number((milli / perKgMilli).toFixed(6));
}

/* ── projection (post-posting hook) ────────────────────────────────── */
async function projectItem(venueId, itemId) {
  const links = await M.IngredientLink.find({ venueId, itemId }).lean();
  if (!links.length) return;
  const item = await M.InventoryItem.findOne({ id: itemId }).lean();
  if (!item) return;
  let kg;
  try { kg = milliToKg(item, await availableKg(venueId, itemId)); } catch { return; } // non-mass item: nothing to project
  for (const l of links) {
    const doc = await getModel("ingredients").findOneAndUpdate(
      { id: l.ingredientId, venueId }, { $set: { stockRemaining: kg } }, { returnDocument: "after" }
    ).lean();
    if (doc) { const { _id, __v, ...pub } = doc; emitChange("ingredients", "updated", pub); }
  }
}
async function projectAfterPosting(_ctx, entry) { await projectItem(entry.venueId, entry.itemId); }

/* ── import / link ─────────────────────────────────────────────────── */
async function importIngredients({ venueId, user }) {
  const ctx = { venueId, user: user || SYSTEM("Ingredient import") };
  const ingredients = await getModel("ingredients").find({ venueId }).lean();
  const links = await M.IngredientLink.find({ venueId }).lean();
  const linked = new Set(links.map((l) => l.ingredientId));
  const loc = await defaultLocation(venueId, { create: true });
  const summary = { total: ingredients.length, alreadyLinked: linked.size, linked: 0, created: 0, opened: 0, skipped: [] };

  for (const ing of ingredients) {
    if (linked.has(ing.id) || !ing.name) continue;
    try {
      const name = String(ing.name).trim();
      let item = await M.InventoryItem.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).lean();
      if (item && (await M.IngredientLink.exists({ venueId, itemId: item.id }))) item = null; // that item already serves another ingredient here
      if (item) {
        U.toBaseMilli(1, "kg", item); // must be a mass item
        summary.linked++;
      } else {
        const maxKg = Number(ing.stockMax) || 0;
        item = (await M.InventoryItem.create({
          sku: await M.nextNumber("item", "ITM"), name, itemType: "ingredient", baseUnit: "g", purchaseUnit: "kg",
          maxStockMilli: maxKg > 0 ? P.toMilli(String(maxKg * 1000)) : 0, createdBy: null,
        })).toObject();
        summary.created++;
      }
      await M.IngredientLink.create({ venueId, ingredientId: ing.id, itemId: item.id });

      const kg = Number(ing.stockRemaining) || 0;
      if (kg > 0) {
        const perG = (Number(ing.pricePer100g) || 0) / 100; // Rs per gram
        const qtyMilli = U.toBaseMilli(kgString(kg), "kg", item);
        await svc.postMovement(ctx, {
          item, itemId: item.id, locationId: loc.id, batchNo: "", type: "opening", qtyMilli,
          unitCostMicro: P.toMicro(perG.toFixed(6)),
          expiryDate: ing.expiryDate ? new Date(ing.expiryDate) : null,
          reason: "Opening stock imported from Ingredients", refType: "ingredient", refId: ing.id,
          idempotencyKey: `opening:ingredient:${venueId}:${ing.id}`,
        });
        summary.opened++;
      }
      await projectItem(venueId, item.id);
    } catch (e) {
      summary.skipped.push({ name: ing.name, reason: e.message });
    }
  }
  return summary;
}

/** Remember consumption that did not fully reach the ledger so the Alerts page can show it. Never throws. */
async function recordIssue({ venueId, orderId, item, kind, shortfallMilli = 0, detail = "" }) {
  try {
    const { ConsumptionIssue } = require("./automationModels");
    await ConsumptionIssue.updateOne(
      { orderId, itemId: item.id, kind },
      { $setOnInsert: { id: M.newId("cis"), venueId, itemName: item.name, unit: item.baseUnit || "", shortfallMilli, detail } },
      { upsert: true }
    );
  } catch (e) { console.error("[inventory] could not record consumption issue:", e.message); }
}

/* ── order consumption ─────────────────────────────────────────────── */
/**
 * usedKgByName: Map(ingredient name -> kg used by this order's new dishes).
 * Returns the Set of names fully handled through the ledger; the caller applies
 * the legacy decrement to everything else. Never throws: an order must not fail
 * because of stock bookkeeping.
 */
async function consumeForOrder({ venueId, orderId, tag, usedKgByName }) {
  const handled = new Set();
  try {
    if (!venueId || !usedKgByName.size) return handled;
    const names = [...usedKgByName.keys()];
    const ings = await getModel("ingredients").find({ venueId, name: { $in: names } }).lean();
    if (!ings.length) return handled;
    const links = await M.IngredientLink.find({ venueId, ingredientId: { $in: ings.map((i) => i.id) } }).lean();
    if (!links.length) return handled;
    const ctx = { venueId, user: SYSTEM(`Order ${orderId}`) };
    const refId = `${orderId}:${tag}`;

    for (const ing of ings) {
      const link = links.find((l) => l.ingredientId === ing.id);
      if (!link) continue;
      try {
        const item = await M.InventoryItem.findOne({ id: link.itemId }).lean();
        if (!item) continue;
        const qtyMilli = U.toBaseMilli(kgString(usedKgByName.get(ing.name)), "kg", item);
        if (qtyMilli <= 0) { handled.add(ing.name); continue; }
        // already booked for this order/bill state (defensive; makes the whole step replay-safe)
        if (await M.StockLedger.exists({ refType: "order", refId, itemId: item.id })) { handled.add(ing.name); continue; }
        const fallback = await defaultLocation(venueId);
        const r = await svc.consumeFefo(ctx, {
          item, qtyMilli, type: "consumption", clamp: true, refType: "order", refId,
          reason: `Order ${orderId}`, keyBase: `order:${refId}:${item.id}`, fallbackLocationId: fallback && fallback.id,
        });
        if (r.shortfallMilli > 0) {
          console.warn(`[inventory] order ${orderId}: ${item.name} short by ${P.fromMilli(r.shortfallMilli)} ${item.baseUnit}; consumed what was available`);
          await recordIssue({ venueId, orderId, item, kind: "shortfall", shortfallMilli: r.shortfallMilli, detail: `Needed more than was in stock for order ${orderId}` });
        }
        handled.add(ing.name);
      } catch (e) {
        console.error(`[inventory] order ${orderId}: ledger consumption failed for "${ing.name}" — falling back to legacy deduction:`, e.message);
        await recordIssue({ venueId, orderId, item: { id: link.itemId, name: ing.name, baseUnit: "" }, kind: "ledger_failed", detail: String(e.message).slice(0, 300) });
      }
    }
  } catch (e) {
    console.error("[inventory] consumeForOrder failed:", e.message);
  }
  return handled;
}

/* ── Stocks-page edits ─────────────────────────────────────────────── */
/** Call after a write to `ingredients`. Posts the difference as a ledger adjustment. */
async function reconcileEdit({ venueId, ingredient, user }) {
  try {
    if (!ingredient || !ingredient.id) return;
    const link = await M.IngredientLink.findOne({ venueId, ingredientId: ingredient.id }).lean();
    if (!link) return;
    const item = await M.InventoryItem.findOne({ id: link.itemId }).lean();
    if (!item) return;
    const wantedKg = Number(ingredient.stockRemaining);
    if (!Number.isFinite(wantedKg) || wantedKg < 0) return;
    const currentKg = milliToKg(item, await availableKg(venueId, item.id));
    const delta = Number((wantedKg - currentKg).toFixed(6));
    if (Math.abs(delta) < 0.000001) return;
    const ctx = { venueId, user: user || SYSTEM("Stocks page") };
    const reason = "Stock edited on the Stocks page";
    const key = `stocks-edit:${ingredient.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    if (delta > 0) {
      const loc = await defaultLocation(venueId, { create: true });
      const perG = (Number(ingredient.pricePer100g) || 0) / 100;
      await svc.postMovement(ctx, {
        item, itemId: item.id, locationId: loc.id, batchNo: "", type: "adjustment_in",
        qtyMilli: U.toBaseMilli(kgString(delta), "kg", item), unitCostMicro: P.toMicro(perG.toFixed(6)),
        reason, refType: "ingredient", refId: ingredient.id, idempotencyKey: key,
      });
    } else {
      await svc.consumeFefo(ctx, {
        item, qtyMilli: U.toBaseMilli(kgString(-delta), "kg", item), type: "adjustment_out", clamp: true,
        reason, refType: "ingredient", refId: ingredient.id, keyBase: key,
      });
    }
    await projectItem(venueId, item.id); // make stockRemaining exactly the ledger's figure
  } catch (e) {
    console.error("[inventory] reconcileEdit failed:", e.message);
  }
}

module.exports = { init, importIngredients, consumeForOrder, reconcileEdit, projectItem };
