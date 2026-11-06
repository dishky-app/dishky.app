#!/usr/bin/env node
/**
 * strip-seed-labels.js — Dishky server, one-time clean-up script
 * ----------------------------------------------------------------
 * Removes the word "seed" from demo data that an earlier run of seed-purchase-inventory.js
 * already put in the database: the "SEED: " prefix on notes / reasons / titles / purposes /
 * comments, the "Seed script" user name, the "seed" reference type on usage history and the
 * "seed:" prefix on idempotency keys. The current seed script no longer writes any of these.
 *
 * It only touches Purchase & Inventory collections and only text that mentions "seed".
 * Safe to re-run (a second run finds nothing to change).
 *
 * USAGE
 *   cd server
 *   node scripts/strip-seed-labels.js            # applies the changes
 *   node scripts/strip-seed-labels.js --dry-run  # only reports what would change
 *
 * Requires the same .env (MONGO_URI) the main server uses.
 */
require("dotenv").config();

/** Returns the cleaned copy of any JSON-like value (strings, arrays, plain objects, everything else untouched). */
function clean(value, key = "") {
  if (typeof value === "string") {
    if (value === "seed") return key === "refType" ? "usage_history" : "system";
    if (value === "SEED") return "Approved";
    if (value === "Seed script") return "System";
    if (value.startsWith("seed:")) return `demo:${value.slice(5)}`;
    return value.replace(/\bSEED:\s*/g, "");
  }
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clean(v, k);
    return out;
  }
  return value;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  require("../src/core/tenancy"); // must load before any model so the models compile the same way as the server
  const mongoose = require("mongoose");
  const files = ["models", "purchaseModels", "receivingModels", "financeModels", "automationModels"];
  const collections = new Map();
  for (const f of files) {
    for (const v of Object.values(require(`../src/modules/inventory/${f}`))) {
      if (v && v.modelName && v.collection) collections.set(v.collection.collectionName, v.collection);
    }
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  let total = 0;
  try {
    for (const [name, coll] of collections) {
      let changed = 0;
      // Raw collection access on purpose: it bypasses the append-only stock-ledger hooks and the tenant filter,
      // and only the text of records that mention "seed" is rewritten.
      const cursor = coll.find({});
      for await (const doc of cursor) {
        if (!/seed/i.test(JSON.stringify(doc))) continue;
        const set = {};
        for (const [k, v] of Object.entries(doc)) {
          if (k === "_id") continue;
          const next = clean(v, k);
          if (JSON.stringify(next) !== JSON.stringify(v)) set[k] = next;
        }
        if (!Object.keys(set).length) continue;
        if (!dry) await coll.updateOne({ _id: doc._id }, { $set: set });
        changed++;
      }
      if (changed) console.log(`${name.padEnd(28)} ${dry ? "would change" : "changed"} ${changed}`);
      total += changed;
    }
  } finally {
    await mongoose.disconnect();
  }
  console.log(total ? `\n${dry ? "Would change" : "Changed"} ${total} record(s).` : "\nNothing to change.");
}

if (require.main === module) main().catch((e) => { console.error(`\n✗ ${e.message}`); process.exitCode = 1; });
module.exports = { clean };
