/**
 * precision.js — number representation for the purchase & inventory module.
 *
 * Floating point must never touch stock or money, so everything persisted is
 * an INTEGER:
 *
 *   quantity   "milli" units   1.250 kg of a kg-based item  -> 1250   (qty * 1000)
 *              of the item's BASE unit. Field names end in `Milli`.
 *   unit cost  "micro" rupees  Rs 0.125 per g               -> 125000 (rupees * 1e6)
 *              per BASE unit. Field names end in `Micro`.
 *   money      paise           Rs 12.50                     -> 1250
 *              Field names end in `Paise`.
 *
 * Quantity x cost products can exceed 2^53, so valuePaise() does that
 * multiplication in BigInt and rounds half away from zero ONCE, at the end.
 * Rounding rule everywhere: half away from zero, applied only when a value is
 * converted into a coarser unit (never in the middle of a calculation).
 */

const MILLI = 1000;
const MICRO = 1000000;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

class PrecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrecisionError";
    this.status = 400;
  }
}

/** Decimal-ish input (number or numeric string) -> integer scaled by `scale`. */
function toScaled(input, scale, label) {
  if (input === null || input === undefined || input === "") {
    throw new PrecisionError(`${label} is required`);
  }
  if (typeof input !== "number" && typeof input !== "string") {
    throw new PrecisionError(`${label} must be a number`);
  }
  const str = String(input).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new PrecisionError(`${label} must be a plain decimal number`);
  const negative = str.startsWith("-");
  const [whole, frac = ""] = str.replace("-", "").split(".");
  const digits = String(scale).length - 1; // 1000 -> 3
  const padded = (frac + "0".repeat(digits)).slice(0, digits);
  const roundUp = frac.length > digits && Number(frac[digits]) >= 5;
  let n = BigInt(whole) * BigInt(scale) + BigInt(padded || 0) + (roundUp ? 1n : 0n);
  if (negative) n = -n;
  if (n > BigInt(MAX_SAFE) || n < -BigInt(MAX_SAFE)) throw new PrecisionError(`${label} is too large`);
  return Number(n);
}

const toMilli = (v, label = "quantity") => toScaled(v, MILLI, label);
const toMicro = (v, label = "unit cost") => toScaled(v, MICRO, label);
const toPaise = (v, label = "amount") => toScaled(v, 100, label);

const fromMilli = (n) => (Number.isFinite(n) ? n / MILLI : 0);
const fromMicro = (n) => (Number.isFinite(n) ? n / MICRO : 0);
const fromPaise = (n) => (Number.isFinite(n) ? n / 100 : 0);

/** Round-half-away-from-zero integer division for BigInt. */
function divRound(numerator, denominator) {
  const neg = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let q = n / d;
  if ((n % d) * 2n >= d) q += 1n;
  return neg ? -q : q;
}

/** Value in paise of `qtyMilli` base units at `unitCostMicro` rupees per base unit. */
function valuePaise(qtyMilli, unitCostMicro) {
  // qty = qtyMilli/1e3 ; cost = unitCostMicro/1e6 rupees ; paise = qty*cost*100
  const p = divRound(BigInt(qtyMilli) * BigInt(unitCostMicro) * 100n, BigInt(MILLI) * BigInt(MICRO));
  return Number(p);
}

/** Weighted-average unit cost (micro rupees) after receiving into existing stock. */
function weightedAverageMicro(oldQtyMilli, oldCostMicro, inQtyMilli, inCostMicro) {
  const total = BigInt(oldQtyMilli) + BigInt(inQtyMilli);
  if (total <= 0n) return Number(inCostMicro);
  const num = BigInt(oldQtyMilli) * BigInt(oldCostMicro) + BigInt(inQtyMilli) * BigInt(inCostMicro);
  return Number(divRound(num, total));
}

module.exports = {
  MILLI, MICRO, PrecisionError,
  toMilli, toMicro, toPaise, fromMilli, fromMicro, fromPaise,
  valuePaise, weightedAverageMicro, divRound,
};
