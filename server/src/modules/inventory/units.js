/**
 * units.js — units of measure and unit conversion.
 *
 * Two kinds of conversion exist and they are kept apart on purpose:
 *
 *  1. SYSTEM units whose relationship is physical and universal
 *     (mg/g/kg, ml/l, pcs/dozen). These live in the table below.
 *  2. PACKAGING units (carton, case, pack, bottle, bag, tray ...) whose size
 *     depends on the product and the supplier. These are NEVER built in: each
 *     item declares its own `conversions: [{ unit: "carton", factor: 24 }]`
 *     meaning 1 carton = 24 of the item's base unit.
 *
 * Every dimension has one canonical unit (factor 1). Each item picks a base
 * unit; a conversion is allowed only inside one dimension, or via an
 * item-declared packaging factor. Anything else throws UNIT_MISMATCH.
 */

// factor = how many of the dimension's canonical unit make up one of this unit.
const SYSTEM_UNITS = {
  mg: { name: "Milligram", dimension: "mass", factor: 0.001 },
  g: { name: "Gram", dimension: "mass", factor: 1 },
  kg: { name: "Kilogram", dimension: "mass", factor: 1000 },
  ml: { name: "Millilitre", dimension: "volume", factor: 1 },
  l: { name: "Litre", dimension: "volume", factor: 1000 },
  pcs: { name: "Piece", dimension: "count", factor: 1 },
  dozen: { name: "Dozen", dimension: "count", factor: 12 },
};

class UnitError extends Error {
  constructor(message, code = "UNIT_MISMATCH") {
    super(message);
    this.name = "UnitError";
    this.code = code;
    this.status = 400;
  }
}

const normalise = (u) => String(u || "").trim().toLowerCase();

function systemUnit(code) {
  return SYSTEM_UNITS[normalise(code)] || null;
}

/**
 * Resolve a unit code to { code, dimension, factor } using system units, then
 * tenant-defined custom units (array of { code, dimension, factor }).
 */
function resolveUnit(code, customUnits = []) {
  const c = normalise(code);
  if (SYSTEM_UNITS[c]) return { code: c, ...SYSTEM_UNITS[c] };
  const custom = customUnits.find((u) => normalise(u.code) === c);
  return custom ? { code: c, dimension: custom.dimension, factor: custom.factor, name: custom.name } : null;
}

/**
 * Convert `qty` (a Number or numeric string, NOT yet scaled) from `fromUnit` to
 * the item's base unit, returning an exact decimal STRING so the caller can
 * scale it to milli units without float drift.
 *
 * item = { baseUnit, conversions: [{ unit, factor }] }
 */
function factorToBase(fromUnit, item, customUnits = []) {
  const from = normalise(fromUnit);
  const base = normalise(item.baseUnit);
  if (!from) throw new UnitError("A unit is required");
  if (from === base) return { num: 1n, den: 1n };

  // packaging conversion declared on the item wins: it is the only valid
  // relationship for units whose size depends on the product.
  const packaged = (item.conversions || []).find((c) => normalise(c.unit) === from);
  if (packaged) return ratio(packaged.factor);

  const fromU = resolveUnit(from, customUnits);
  const baseU = resolveUnit(base, customUnits);
  if (!fromU) throw new UnitError(`Unknown unit "${fromUnit}" for this item`, "UNIT_UNKNOWN");
  if (!baseU) throw new UnitError(`Item base unit "${item.baseUnit}" is not a known unit`, "UNIT_UNKNOWN");
  if (fromU.dimension !== baseU.dimension) {
    throw new UnitError(
      `Cannot convert ${fromU.dimension} unit "${from}" to ${baseU.dimension} unit "${base}". ` +
      `Declare a packaging conversion on the item if one carton/pack/bottle holds a fixed amount.`
    );
  }
  // (fromFactor / baseFactor) as an exact rational
  const a = ratio(fromU.factor);
  const b = ratio(baseU.factor);
  return { num: a.num * b.den, den: a.den * b.num };
}

/** Decimal -> exact BigInt rational (up to 6 decimal places). */
function ratio(decimal) {
  const s = String(decimal);
  if (!/^\d+(\.\d{1,6})?$/.test(s) || Number(s) <= 0) throw new UnitError(`Invalid conversion factor "${decimal}"`, "UNIT_FACTOR");
  const [w, f = ""] = s.split(".");
  const den = 10n ** BigInt(f.length);
  return { num: BigInt(w + f), den };
}

/**
 * qty (decimal) in `fromUnit` -> integer milli base units, rounded half away
 * from zero once at the end.
 */
function toBaseMilli(qty, fromUnit, item, customUnits = []) {
  const { toMilli, divRound, PrecisionError } = require("./precision");
  const milliInUnit = BigInt(toMilli(qty, "quantity"));
  const r = factorToBase(fromUnit, item, customUnits);
  const out = divRound(milliInUnit * r.num, r.den);
  if (out > BigInt(Number.MAX_SAFE_INTEGER) || out < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PrecisionError("quantity is too large");
  }
  return Number(out);
}

/** Validate an item's own unit set: base unit known, conversions sane and unique. */
function validateItemUnits({ baseUnit, purchaseUnit, conversions = [] }, customUnits = []) {
  const base = resolveUnit(baseUnit, customUnits);
  if (!base) throw new UnitError(`Unknown base unit "${baseUnit}"`, "UNIT_UNKNOWN");
  const seen = new Set([normalise(baseUnit)]);
  for (const c of conversions) {
    const code = normalise(c.unit);
    if (!code) throw new UnitError("Each conversion needs a unit", "UNIT_UNKNOWN");
    if (seen.has(code)) throw new UnitError(`Duplicate or base-unit conversion "${c.unit}"`, "UNIT_DUPLICATE");
    seen.add(code);
    ratio(c.factor); // validates > 0 and shape
  }
  if (purchaseUnit) {
    const p = normalise(purchaseUnit);
    const known = seen.has(p) || resolveUnit(p, customUnits);
    if (!known) throw new UnitError(`Purchase unit "${purchaseUnit}" has no conversion to the base unit`, "UNIT_UNKNOWN");
    if (!seen.has(p)) {
      // a system/custom unit of another dimension is only valid with a declared factor
      const pu = resolveUnit(p, customUnits);
      if (pu.dimension !== base.dimension) {
        throw new UnitError(`Purchase unit "${purchaseUnit}" is ${pu.dimension}; base unit is ${base.dimension}. Add a conversion.`);
      }
    }
  }
  return true;
}

module.exports = { SYSTEM_UNITS, UnitError, resolveUnit, systemUnit, toBaseMilli, validateItemUnits, normalise };
