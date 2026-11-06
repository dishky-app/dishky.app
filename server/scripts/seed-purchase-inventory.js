#!/usr/bin/env node
/**
 * seed-purchase-inventory.js — Dishky server, demo-data script for Purchase & Inventory
 * ----------------------------------------------------------------------------------
 * Fills EVERY Purchase & Inventory page with realistic South-Indian restaurant data:
 * suppliers, storage locations, inventory items, opening stock, ledger movements (waste,
 * adjustments, quarantine), purchase requests, reorder suggestions, RFQs + quotations,
 * purchase orders in every status, goods receipts, supplier returns, supplier invoices
 * (matched / variance / disputed / overdue), supplier payments, stock audits, supplier
 * scorecards, forecast history and a WhatsApp send log.
 *
 * It talks to the RUNNING API over HTTP (so every business rule is enforced exactly as in the
 * app). Two things cannot be created through the public API and are done in an optional
 * DB phase (disable with --no-db): back-dated consumption history for Forecast & Usage, and
 * WhatsApp send-log rows (a real send needs AISENSY_API_KEY). Both are DEMO DATA ONLY.
 *
 * USAGE (from server/, API must be running)
 *   node scripts/seed-purchase-inventory.js --restaurant <slug>
 *   node scripts/seed-purchase-inventory.js --restaurant <slug> --venue "Sam Cafe"
 *   options: --api http://localhost:4000  --email you@x.com  --password ***  --no-db  --force
 *   env equivalents: SEED_API, SEED_RESTAURANT, SEED_EMAIL, SEED_PASSWORD, SEED_VENUE
 *   Missing restaurant / password are asked for interactively.
 *
 * Re-runnable: suppliers, locations, items and opening stock are looked up first; the document
 * block (requests, RFQs, orders, receipts, invoices, payments, audits) is skipped when a
 * purchase request named "Weekly vegetables (draft)" already exists (use --force to add another set).
 *
 * SUPPLIER BANK ACCOUNT NUMBERS need SETTINGS_ENCRYPTION_KEY in server/.env
 * (generate one with:  openssl rand -base64 48 ). Without it the suppliers are still created
 * (bank name / IFSC / UPI kept, account number skipped); set the key, restart, run again and the
 * numbers are filled in.
 */
require("dotenv").config();
const readline = require("readline");

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const flag = (n) => args.includes(`--${n}`);

/* ───────────────────────── tiny helpers ───────────────────────── */
const DAY = 864e5;
const iso = (d) => new Date(d).toISOString();
const ago = (days) => iso(Date.now() - days * DAY);
const ahead = (days) => iso(Date.now() + days * DAY);
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const round = (n, d = 2) => Number(Number(n).toFixed(d));
const sum = {};                                   // summary counters
const count = (k, what = "created") => { sum[k] = sum[k] || { created: 0, existed: 0, failed: 0 }; sum[k][what]++; };
const log = (m) => console.log(m);
const bad = (m) => console.log(`  ✗ ${m}`);
const ok = (m) => console.log(`  ✓ ${m}`);
const skip = (m) => console.log(`  – ${m}`);
const ask = (q, hidden) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) { rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); else rl.output.write("*"); }; }
  rl.question(q, (a) => { rl.close(); if (hidden) console.log(); res(a.trim()); });
});

/* ───────────────────────── HTTP client ───────────────────────── */
const cfg = { api: "", slug: "", venueId: "", cookie: "" };
let hints = { noEncKey: false };

async function call(method, path, body, { branch = true, key, query = {} } = {}) {
  const q = new URLSearchParams(query);
  if (branch && cfg.venueId) q.set("venueId", cfg.venueId);
  const url = `${cfg.api}${path}${q.toString() ? `?${q}` : ""}`;
  const headers = { "Content-Type": "application/json", "X-Requested-With": "fetch", "X-Restaurant": cfg.slug };
  if (cfg.cookie) headers.Cookie = cfg.cookie;
  if (key) headers["Idempotency-Key"] = key;
  try {
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of set) if (c.startsWith("dishkyid=")) cfg.cookie = c.split(";")[0];
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) return { ok: false, status: res.status, data, error: (data && data.error) || `HTTP ${res.status}`, code: data && data.code };
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: `Cannot reach ${url} (${e.message})`, code: "NETWORK" };
  }
}
const get = (p, query) => call("GET", p, undefined, { query });
const post = (p, b = {}, o) => call("POST", p, b, o);
const patch = (p, b = {}) => call("PATCH", p, b);
const list = async (p, query = {}) => { const r = await get(p, { limit: 200, ...query }); return r.ok ? (r.data.data || r.data) : []; };
/** call + log failure; returns the response (check .ok) */
async function step(what, p) { const r = await p; if (!r.ok) bad(`${what}: ${r.error}`); return r; }

/* ───────────────────────── seed catalogue ───────────────────────── */
const SUPPLIERS = [
  { name: "Madurai Fresh Farms", type: "farmer", contactPerson: "Murugan K", phone: "9842011101", whatsapp: "9842011101", email: "orders@maduraifresh.in", gstin: "33AABCM1234F1Z5", pan: "AABCM1234F", city: "Madurai", pincode: "625001", paymentTerms: "Net 7", creditLimit: 150000, leadTimeDays: 1, minOrderValue: 1500, bank: { accountName: "Madurai Fresh Farms", bankName: "State Bank of India", branch: "Anna Nagar, Madurai", ifsc: "SBIN0001234", accountType: "current", upi: "maduraifresh@sbi", accountNumber: "31245678901" } },
  { name: "Sri Annapoorna Provisions", type: "wholesaler", contactPerson: "Ramesh S", phone: "9884022202", whatsapp: "9884022202", email: "sales@annapoorna.in", gstin: "33AAECS5678K1Z2", pan: "AAECS5678K", city: "Madurai", pincode: "625002", paymentTerms: "Net 15", creditLimit: 400000, leadTimeDays: 2, minOrderValue: 5000, bank: { accountName: "Sri Annapoorna Provisions", bankName: "HDFC Bank", branch: "Periyar, Madurai", ifsc: "HDFC0000456", accountType: "current", upi: "annapoorna@hdfcbank", accountNumber: "50200012345678" } },
  { name: "Meenakshi Dairy Products", type: "distributor", contactPerson: "Lakshmi V", phone: "9790033303", whatsapp: "9790033303", email: "dairy@meenakshidairy.in", gstin: "33AAGCM9012P1Z8", pan: "AAGCM9012P", city: "Madurai", pincode: "625003", paymentTerms: "Net 7", creditLimit: 200000, leadTimeDays: 1, minOrderValue: 2000, bank: { accountName: "Meenakshi Dairy Products", bankName: "Indian Bank", branch: "Simmakkal, Madurai", ifsc: "IDIB000M123", accountType: "current", upi: "meenakshidairy@indianbank", accountNumber: "6234567890" } },
  { name: "Pandian Oil Mills", type: "manufacturer", contactPerson: "Pandian R", phone: "9943044404", whatsapp: "9943044404", email: "info@pandianoil.in", gstin: "33AAHCP3456Q1Z1", pan: "AAHCP3456Q", city: "Dindigul", pincode: "624001", paymentTerms: "Advance", creditLimit: 0, leadTimeDays: 3, minOrderValue: 8000, bank: { accountName: "Pandian Oil Mills Pvt Ltd", bankName: "ICICI Bank", branch: "Dindigul", ifsc: "ICIC0001122", accountType: "current", upi: "pandianoil@icici", accountNumber: "112233445566" } },
  { name: "Kovai Spice Traders", type: "wholesaler", contactPerson: "Senthil N", phone: "9655055505", whatsapp: "9655055505", email: "kovaispice@gmail.com", gstin: "33AAJFK7890L1Z9", pan: "AAJFK7890L", city: "Coimbatore", pincode: "641001", paymentTerms: "Net 15", creditLimit: 250000, leadTimeDays: 4, minOrderValue: 4000, bank: { accountName: "Kovai Spice Traders", bankName: "Axis Bank", branch: "RS Puram, Coimbatore", ifsc: "UTIB0000789", accountType: "current", upi: "kovaispice@axisbank", accountNumber: "917020012345678" } },
  { name: "Coastal Seafoods & Meats", type: "distributor", contactPerson: "Antony J", phone: "9500066606", whatsapp: "9500066606", email: "coastal.meats@gmail.com", gstin: "33AAKCC2345M1Z4", pan: "AAKCC2345M", city: "Thoothukudi", pincode: "628001", paymentTerms: "Net 7", creditLimit: 180000, leadTimeDays: 1, minOrderValue: 3000, bank: { accountName: "Coastal Seafoods and Meats", bankName: "Canara Bank", branch: "Harbour Road", ifsc: "CNRB0002345", accountType: "current", upi: "coastalmeats@canara", accountNumber: "1234567890123" } },
  { name: "Southern Packaging Co.", type: "manufacturer", contactPerson: "Vignesh P", phone: "9751077707", whatsapp: "9751077707", email: "sales@southernpack.in", gstin: "33AAMCS6789N1Z6", pan: "AAMCS6789N", city: "Madurai", pincode: "625016", paymentTerms: "Net 30", creditLimit: 300000, leadTimeDays: 5, minOrderValue: 6000, bank: { accountName: "Southern Packaging Co", bankName: "Kotak Mahindra Bank", branch: "KK Nagar", ifsc: "KKBK0000567", accountType: "current", upi: "southernpack@kotak", accountNumber: "7412589630" } },
  { name: "SparkClean Supplies", type: "retailer", contactPerson: "Fathima B", phone: "9626088808", whatsapp: "9626088808", email: "hello@sparkclean.in", gstin: "33AANCS4567R1Z3", pan: "AANCS4567R", city: "Madurai", pincode: "625009", paymentTerms: "Net 15", creditLimit: 80000, leadTimeDays: 2, minOrderValue: 1000, bank: { accountName: "SparkClean Supplies", bankName: "Union Bank of India", branch: "Goripalayam", ifsc: "UBIN0534567", accountType: "savings", upi: "sparkclean@unionbank", accountNumber: "345601000012345" } },
  { name: "Kerala Beverage Distributors", type: "distributor", contactPerson: "Thomas M", phone: "9447099909", whatsapp: "9447099909", email: "orders@keralabev.in", gstin: "33AAPCK8901S1Z7", pan: "AAPCK8901S", city: "Theni", pincode: "625531", paymentTerms: "Net 15", creditLimit: 220000, leadTimeDays: 3, minOrderValue: 5000, bank: { accountName: "Kerala Beverage Distributors", bankName: "Federal Bank", branch: "Theni", ifsc: "FDRL0001234", accountType: "current", upi: "keralabev@federal", accountNumber: "12345678901234" } },
];
const EXTRA_SUPPLIERS = [
  { name: "Old Town Traders", type: "retailer", contactPerson: "Gopal", phone: "9360044120", paymentTerms: "Advance", status: "blocked", reason: "Repeated short deliveries and unreturned crates" },
];
const LOCATIONS = [
  { code: "DRY-01", name: "Dry store", type: "dry_store" }, { code: "COLD-01", name: "Cold room", type: "cold_room" },
  { code: "FRZ-01", name: "Deep freezer", type: "freezer" }, { code: "KIT-01", name: "Main kitchen shelf", type: "kitchen" },
  { code: "BAR-01", name: "Bar store", type: "bar" }, { code: "RCV-01", name: "Receiving bay", type: "receiving" },
  { code: "QUA-01", name: "Quarantine shelf", type: "quarantine" },
];
const CATEGORIES = ["Grains & Staples", "Dairy & Eggs", "Oils & Fats", "Spices & Masalas", "Meat & Seafood", "Vegetables & Fruits", "Packaging", "Cleaning", "Beverages"];
// keyword → [supplier, category, location code, price per kg/l/pc]
const RULES = [
  [/oil|ghee|vanaspati|dalda/i, "Pandian Oil Mills", "Oils & Fats", "DRY-01", 150],
  [/milk|butter|cheese|curd|paneer|cream|yogh?urt/i, "Meenakshi Dairy Products", "Dairy & Eggs", "COLD-01", 340],
  [/chicken|mutton|fish|prawn|beef|crab|egg|meat|squid|lamb/i, "Coastal Seafoods & Meats", "Meat & Seafood", "FRZ-01", 360],
  [/pepper|masala|turmeric|cumin|cardamom|clove|cinnamon|mustard|fenugreek|spice|saffron|fennel|chilli powder|chili powder|garam|curry powder|bay leaf|asafoetida/i, "Kovai Spice Traders", "Spices & Masalas", "DRY-01", 520],
  [/foil|container|box|bag|cover|tissue|napkin|cup|straw|plate|wrap|packag|roll|spoon|leaf plate|banana leaf/i, "Southern Packaging Co.", "Packaging", "DRY-01", 14],
  [/soap|detergent|sanitiz|cleaner|clean|bleach|wash|mop|disinfect/i, "SparkClean Supplies", "Cleaning", "DRY-01", 95],
  [/tea|coffee|cola|juice|soda|water|drink|syrup|squash|beverage/i, "Kerala Beverage Distributors", "Beverages", "BAR-01", 160],
  [/carrot|onion|tomato|potato|chilli|chili|coriander|mint|curry leaf|lemon|ginger|garlic|cabbage|bean|capsicum|cucumber|brinjal|spinach|beetroot|vegetable|fruit|banana|coconut|drumstick|pumpkin|cauliflower|peas/i, "Madurai Fresh Farms", "Vegetables & Fruits", "KIT-01", 60],
  [/./, "Sri Annapoorna Provisions", "Grains & Staples", "DRY-01", 88],
];
const rule = (name) => RULES.find((r) => r[0].test(name));
const BUY_UNIT = { g: "kg", mg: "g", ml: "l" };
const buyUnit = (it) => BUY_UNIT[it.baseUnit] || it.baseUnit;
const perBase = (it) => ({ g: 1000, ml: 1000, mg: 1000 }[it.baseUnit] || 1);   // base units in one buy unit
const priceFor = (it, bump = 1) => { const r = rule(it.name); return round(r[4] * (0.85 + (hash(it.name) % 30) / 100) * bump, 2); };

/* ───────────────────────── main ───────────────────────── */
async function main() {
  cfg.api = (opt("api") || process.env.SEED_API || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "");
  cfg.slug = (opt("restaurant") || process.env.SEED_RESTAURANT || "").trim().toLowerCase();
  if (!cfg.slug) cfg.slug = (await ask("Restaurant slug: ")).toLowerCase();
  const email = opt("email") || process.env.SEED_EMAIL || "qwertyzender@gmail.com";
  const password = opt("password") || process.env.SEED_PASSWORD || (await ask(`Password for ${email}: `, true));
  if (!cfg.slug || !password) throw new Error("Restaurant slug and password are required");

  const login = await call("POST", "/staff-auth/login", { email, password }, { branch: false });
  if (!login.ok) throw new Error(`Login failed: ${login.error}`);
  const me = login.data.admin;
  log(`Logged in as ${me.email || email}`);

  // branch
  const venues = (await call("GET", "/venues", undefined, { branch: false })).data || [];
  const want = (opt("venue") || process.env.SEED_VENUE || "").toLowerCase();
  let venue = want ? venues.find((v) => v.id === want || String(v.name).toLowerCase() === want) : null;
  if (want && !venue) throw new Error(`No branch "${want}". Branches: ${venues.map((v) => v.name).join(", ")}`);
  if (!venue) venue = venues.find((v) => v.isMainBranch) || venues.find((v) => v.id === me.venueId) || venues[0];
  if (!venue) throw new Error("This restaurant has no branch");
  cfg.venueId = venue.id;
  log(`Branch: ${venue.name} (${venue.id})`);

  // temporarily relax approval policy (restored in finally)
  const origSettings = (await get("/purchase/settings")).data;
  const origAuto = (await get("/automation/settings")).data;
  try {
    if (origSettings) {
      await step("purchase settings", patch("/purchase/settings", { allowSelfApproval: true, allowManualPo: true, gstStateCode: origSettings.gstStateCode || "33", matchQtyTolerancePct: 2, matchPriceTolerancePct: 2, invoiceTotalTolerance: 1, paymentApprovalLimit: 0 }));
    }
    if (origAuto && !origAuto.whatsappPurchaseTemplate) await call("PUT", "/automation/settings", { whatsappPurchaseTemplate: "purchase_list_v1" });

    const ctx = {};
    await seedSuppliers(ctx);
    await seedLocationsAndItems(ctx);
    await seedStock(ctx);
    if (flag("force") || !(await alreadySeeded())) {
      await seedProcurement(ctx);
      await seedAudits(ctx);
    } else skip("Documents already created (the 'Weekly vegetables (draft)' purchase request exists). Use --force to add another set.");
    if (!flag("no-db")) await seedDb(ctx);
  } finally {
    if (origSettings) {
      await patch("/purchase/settings", { allowSelfApproval: origSettings.allowSelfApproval, allowManualPo: origSettings.allowManualPo, gstStateCode: origSettings.gstStateCode, matchQtyTolerancePct: origSettings.matchQtyTolerancePct, matchPriceTolerancePct: origSettings.matchPriceTolerancePct, invoiceTotalTolerance: origSettings.invoiceTotalTolerance, paymentApprovalLimit: origSettings.paymentApprovalLimit });
      log("Purchase settings restored to their previous values.");
    }
  }
  summary(venue);
}

/* ───────────────────────── suppliers ───────────────────────── */
async function seedSuppliers(ctx) {
  log("Suppliers…");
  const existing = await list("/inventory/suppliers");
  ctx.sup = {};
  for (const s of existing) ctx.sup[s.name] = s;
  for (const def of [...SUPPLIERS, ...EXTRA_SUPPLIERS]) {
    const found = ctx.sup[def.name];
    const { status, reason, ...body } = def;
    if (found) {
      count("Suppliers", "existed");
      if (def.bank && def.bank.accountNumber && found.bank && !found.bank.hasAccountNumber) {
        const r = await patch(`/inventory/suppliers/${found.id}`, { bank: { accountNumber: def.bank.accountNumber } });
        if (r.ok) ok(`bank account number saved for ${def.name}`); else if (r.code === "NO_ENC_KEY") hints.noEncKey = true; else bad(`bank number for ${def.name}: ${r.error}`);
      }
      continue;
    }
    let r = await post("/inventory/suppliers", body, { branch: false });
    if (!r.ok && r.code === "NO_ENC_KEY") {            // the failure the original run hit
      hints.noEncKey = true;
      const { accountNumber, ...bank } = body.bank || {};
      r = await post("/inventory/suppliers", { ...body, bank }, { branch: false });
    }
    if (!r.ok) { bad(`supplier ${def.name}: ${r.error}`); count("Suppliers", "failed"); continue; }
    ctx.sup[def.name] = r.data; count("Suppliers"); ok(`${r.data.code} ${def.name}`);
    if (status === "blocked") await step(`block ${def.name}`, post(`/inventory/suppliers/${r.data.id}/status`, { status, reason }, { branch: false }));
  }
  // one inactive supplier for the filter demo
  if (!ctx.sup["Sunrise Wholesale Mart"]) {
    const r = await post("/inventory/suppliers", { name: "Sunrise Wholesale Mart", type: "wholesaler", phone: "9360099911", paymentTerms: "Net 7", city: "Madurai" }, { branch: false });
    if (r.ok) { ctx.sup["Sunrise Wholesale Mart"] = r.data; count("Suppliers"); await post(`/inventory/suppliers/${r.data.id}/status`, { status: "inactive" }, { branch: false }); }
  }
}

/* ───────────────────────── locations, categories, items ───────────────────────── */
async function seedLocationsAndItems(ctx) {
  log("Categories and storage locations…");
  const cats = await list("/inventory/categories");
  ctx.cat = Object.fromEntries(cats.map((c) => [c.name, c]));
  for (const name of CATEGORIES) {
    if (ctx.cat[name]) { count("Categories", "existed"); continue; }
    const r = await step(`category ${name}`, post("/inventory/categories", { name }, { branch: false }));
    if (r.ok) { ctx.cat[name] = r.data; count("Categories"); }
  }
  const locs = await list("/inventory/locations");
  ctx.loc = Object.fromEntries(locs.map((l) => [l.code, l]));
  for (const def of LOCATIONS) {
    if (ctx.loc[def.code]) { count("Storage locations", "existed"); continue; }
    const r = await step(`location ${def.code}`, post("/inventory/locations", def));
    if (r.ok) { ctx.loc[def.code] = r.data; count("Storage locations"); }
  }

  log("Inventory items…");
  const imp = await post("/inventory/import-ingredients", {});
  if (imp.ok) ok(`import from Ingredients: ${JSON.stringify(imp.data).slice(0, 120)}`); else skip(`import from Ingredients: ${imp.error}`);
  ctx.items = (await list("/inventory/items")).filter((i) => i.status === "active");
  if (!ctx.items.length) { // branch has no ingredients — create a starter set so the module is usable
    const starter = [["Basmati Rice (Premium)", "g"], ["Sunflower Oil", "ml"], ["Onion", "g"], ["Tomato", "g"], ["Chicken (Whole)", "g"], ["Full Cream Milk", "ml"], ["Black Pepper", "g"], ["Aluminium Foil Roll 72 m", "pcs"], ["Toor Dal", "g"], ["Butter (Unsalted)", "g"], ["Tea Powder", "g"], ["Dish Wash Liquid", "ml"]];
    for (const [name, baseUnit] of starter) await post("/inventory/items", { name, baseUnit, itemType: "ingredient" }, { branch: false });
    ctx.items = (await list("/inventory/items")).filter((i) => i.status === "active");
  }
  let n = 0;
  for (const it of ctx.items) {
    const [supName, catName, locCode] = rule(it.name);
    const set = {};
    const sup = ctx.sup[supName];
    if (sup && !it.preferredSupplierId) set.preferredSupplierId = sup.id;
    if (ctx.cat[catName] && !it.categoryId) set.categoryId = ctx.cat[catName].id;
    if (ctx.loc[locCode] && !it.defaultLocationId) set.defaultLocationId = ctx.loc[locCode].id;
    if (it.gstRate === undefined || it.gstRate === null || it.gstRate === 0) set.gstRate = /milk|curd|paneer|rice|dal|flour|onion|tomato|potato|vegetable|egg|chicken|fish|mutton/i.test(it.name) ? 0 : /oil|butter|ghee|cheese/i.test(it.name) ? 5 : /soap|detergent|clean|foil|box|container|cup|plate|bag|cover/i.test(it.name) ? 18 : 5;
    if (!it.purchaseUnit && BUY_UNIT[it.baseUnit]) set.purchaseUnit = BUY_UNIT[it.baseUnit];
    if (!(it.reorderPoint > 0)) {
      const base = { g: 10000, ml: 5000, pcs: 50 }[it.baseUnit] || 20;
      Object.assign(set, { reorderPoint: base, minStock: round(base * 0.6, 0), safetyStock: round(base * 0.3, 0), maxStock: base * 6, reorderQty: base * 3 });
    }
    if (Object.keys(set).length) {
      const r = await patch(`/inventory/items/${it.id}`, set);
      if (r.ok) Object.assign(it, r.data); else if (n++ < 5) bad(`item ${it.name}: ${r.error}`);
    }
  }
  count("Inventory items", "existed"); sum["Inventory items"].existed = ctx.items.length;
  ok(`${ctx.items.length} items ready (supplier, category, location, GST and reorder levels filled where missing)`);
}

/* ───────────────────────── stock: opening, waste, adjustments, quarantine ───────────────────────── */
async function seedStock(ctx) {
  log("Opening stock…");
  const L = (code) => ctx.loc[code] || Object.values(ctx.loc)[0];
  if (!L("DRY-01")) { bad("No storage location available — stock steps skipped"); return; }
  ctx.stocked = [];
  let tracked = 0;
  for (const [i, it] of ctx.items.entries()) {
    const m = i % 9 === 0 ? 0 : i % 7 === 0 ? 0.5 : 2.5 + (i % 4) * 0.6;       // some out of stock, some low
    if (m === 0) continue;
    const rp = it.reorderPoint > 0 ? it.reorderPoint : { g: 10000, ml: 5000, pcs: 50 }[it.baseUnit] || 20;
    const qty = round(rp * m, 3);
    const unitCost = round(priceFor(it) / perBase(it), 6);
    const loc = (it.defaultLocationId && Object.values(ctx.loc).find((l) => l.id === it.defaultLocationId)) || L("DRY-01");
    const body = { itemId: it.id, locationId: loc.id, qty, unit: it.baseUnit, unitCost, reason: "opening balance" };
    if (it.trackBatches) body.batchNo = `OPN-${it.sku}`;
    if (it.trackExpiry) { tracked++; body.expiryDate = ahead(tracked === 1 ? 3 : 45 + (i % 60)); body.mfgDate = ago(10); }
    const r = await call("POST", "/inventory/stock/opening", body, { key: `demo:${cfg.venueId}:open:${it.id}` });
    if (r.ok) { count("Opening stock", r.data.replayed ? "existed" : "created"); ctx.stocked.push({ it, loc, body }); }
    else { count("Opening stock", "failed"); if (sum["Opening stock"].failed <= 5) bad(`opening ${it.name}: ${r.error}`); }
  }
  // one expired batch to light up the Expired view and alerts
  const expTarget = ctx.stocked.find((s) => s.it.trackExpiry);
  if (expTarget) await step("expired batch", post("/inventory/stock/opening", { ...expTarget.body, batchNo: `OPN-OLD-${expTarget.it.sku}`, qty: round(expTarget.body.qty * 0.05, 3), expiryDate: ago(4), mfgDate: ago(60), reason: "old batch" }, { key: `demo:${cfg.venueId}:expired:${expTarget.it.id}` }));

  log("Waste, adjustments and quarantine…");
  const pick = (k) => ctx.stocked[(k * 3 + 1) % Math.max(1, ctx.stocked.length)];
  const reasons = ["spoilage", "preparation_loss", "spillage", "damaged", "expired", "other"];
  for (let k = 0; k < 6 && ctx.stocked.length; k++) {
    const s = pick(k);
    const q = round(s.body.qty * (0.01 + k * 0.004), 3);
    const base = { itemId: s.it.id, locationId: s.loc.id, qty: q, unit: s.it.baseUnit };
    if (s.body.batchNo) base.batchNo = s.body.batchNo;
    const r = await call("POST", "/inventory/stock/waste", { ...base, wasteReason: reasons[k], reason: "logged during service" }, { key: `demo:${cfg.venueId}:waste:${k}` });
    r.ok ? count("Waste entries") : (count("Waste entries", "failed"), bad(`waste ${s.it.name}: ${r.error}`));
  }
  for (let k = 0; k < 4 && ctx.stocked.length; k++) {
    const s = pick(k + 6);
    const base = { itemId: s.it.id, locationId: s.loc.id, qty: round(s.body.qty * 0.02, 3), unit: s.it.baseUnit };
    if (s.body.batchNo) base.batchNo = s.body.batchNo;
    const dir = k % 2 ? "in" : "out";
    const extra = dir === "in" ? { unitCost: s.body.unitCost, ...(s.body.expiryDate ? { expiryDate: s.body.expiryDate } : {}) } : {};
    const r = await call("POST", "/inventory/stock/adjust", { ...base, ...extra, direction: dir, reason: dir === "in" ? "stock found during count" : "shelf shortage found" }, { key: `demo:${cfg.venueId}:adj:${k}` });
    r.ok ? count("Adjustments") : (count("Adjustments", "failed"), bad(`adjust ${s.it.name}: ${r.error}`));
  }
  for (let k = 0; k < 2 && ctx.stocked.length; k++) {
    const s = pick(k + 12);
    const body = { itemId: s.it.id, locationId: s.loc.id, qty: round(s.body.qty * 0.05, 3), unit: s.it.baseUnit, action: "quarantine", reason: "held for quality check" };
    if (s.body.batchNo) body.batchNo = s.body.batchNo;
    const r = await call("POST", "/inventory/stock/status", body, { key: `demo:${cfg.venueId}:quar:${k}` });
    r.ok ? count("Quarantine moves") : (count("Quarantine moves", "failed"), bad(`quarantine ${s.it.name}: ${r.error}`));
  }
}

/* ───────────────────────── procurement ───────────────────────── */
async function alreadySeeded() {
  const r = await get("/purchase/requests", { search: "Weekly vegetables (draft)", limit: 1 });
  return r.ok && (r.data.total || 0) > 0;
}

const itemsFor = (ctx, supName, n = 4, from = 0) => {
  const mine = ctx.items.filter((i) => rule(i.name)[2] === supName);
  const pool = mine.length >= 2 ? mine : ctx.items;
  return pool.slice(from, from + n).length ? pool.slice(from, from + n) : pool.slice(0, n);
};
const qtyFor = (it, k = 0) => { const u = buyUnit(it); return u === "pcs" ? 100 + ((hash(it.name) + k) % 8) * 50 : 5 + ((hash(it.name) + k) % 20); };
const poLines = (items, { bump = 1, k = 0 } = {}) => items.map((it) => ({ itemId: it.id, qty: qtyFor(it, k), unit: buyUnit(it), unitPrice: priceFor(it, bump), gstRate: it.gstRate ?? 0 }));
const prLines = (items, k = 0) => items.map((it) => ({ itemId: it.id, qty: qtyFor(it, k), unit: buyUnit(it), estUnitCost: priceFor(it) }));

async function seedProcurement(ctx) {
  const S = (n) => ctx.sup[n];
  const need = ["Sri Annapoorna Provisions", "Madurai Fresh Farms", "Meenakshi Dairy Products", "Pandian Oil Mills", "Coastal Seafoods & Meats", "Kovai Spice Traders"];
  if (need.some((n) => !S(n) || S(n).status !== "active")) { bad("Core suppliers are missing or not active — procurement documents skipped"); return; }
  if (!ctx.items.length) { bad("No inventory items — procurement documents skipped"); return; }

  /* ── purchase requests ── */
  log("Purchase requests…");
  const pr = async (tag, supName, flow, extra = {}) => {
    const r = await step(`PR ${tag}`, post("/purchase/requests", { department: extra.department || "Kitchen", priority: extra.priority || "normal", requiredDate: ahead(extra.days ?? 5), purpose: `${tag}`, preferredSupplierId: S(supName).id, lines: prLines(itemsFor(ctx, supCategory(supName), 3, extra.from || 0), extra.k || 0) }));
    if (!r.ok) { count("Purchase requests", "failed"); return null; }
    count("Purchase requests");
    let doc = r.data;
    for (const [action, body] of flow) {
      const x = await step(`PR ${tag} ${action}`, post(`/purchase/requests/${doc.id}/${action}`, body || {}));
      if (!x.ok) break; doc = x.data;
    }
    return doc;
  };
  const supCategory = (n) => (RULES.find((r) => r[1] === n) || [])[2];
  await pr("Weekly vegetables (draft)", "Madurai Fresh Farms", [], { priority: "normal" });
  await pr("Festival dairy order (awaiting approval)", "Meenakshi Dairy Products", [["submit"]], { priority: "high", days: 3 });
  await pr("Monthly grocery (approved)", "Sri Annapoorna Provisions", [["submit"], ["approve"]], { k: 2 });
  await pr("Gas-station sweets (rejected)", "Sri Annapoorna Provisions", [["submit"], ["reject", { comment: "Over budget this month" }]], { priority: "low", from: 1 });
  await pr("Oil for fryers (changes requested)", "Pandian Oil Mills", [["submit"], ["request-changes", { comment: "Please add quantity per pack size" }]], { priority: "urgent", days: 2 });
  await pr("Duplicate spice order (cancelled)", "Kovai Spice Traders", [["cancel", { reason: "Raised twice by mistake" }]]);
  const prRfq = await pr("Seafood price comparison (to RFQ)", "Coastal Seafoods & Meats", [["submit"], ["approve"]], { k: 4 });
  const prPo = await pr("Spice restock (ordered)", "Kovai Spice Traders", [["submit"], ["approve"]], { k: 5, priority: "high" });
  await pr("Reserve grocery (approved, open)", "Sri Annapoorna Provisions", [["submit"], ["approve"]], { k: 7, from: 2 });

  /* ── reorder planning → draft requests ── */
  const sug = await get("/purchase/reorder/suggestions");
  if (sug.ok && sug.data.data.length) {
    const lines = sug.data.data.slice(0, 4).map((s) => ({ itemId: s.itemId, qty: s.suggestedQty, unit: s.unit, suggestedMilli: s.suggestedMilli }));
    const r = await post("/purchase/reorder/create-requests", { lines });
    r.ok ? (count("Reorder requests"), ok(`${r.data.data.length} reorder request(s) created from suggestions`)) : bad(`reorder requests: ${r.error}`);
  } else skip("No reorder suggestions yet (all items above their reorder level)");

  /* ── RFQs & quotations ── */
  log("RFQs and quotations…");
  const rfqSuppliers = [S("Sri Annapoorna Provisions"), S("Madurai Fresh Farms"), S("Coastal Seafoods & Meats")].map((s) => s.id);
  const quote = async (rfqId, supName, bump, lead, items) => step(`quotation ${supName}`, post(`/purchase/rfqs/${rfqId}/quotations`, {
    supplierId: S(supName).id, supplierRef: `Q-${hash(supName + rfqId) % 9000 + 1000}`, validUntil: ahead(10), paymentTerms: S(supName).paymentTerms, remarks: "quotation received on WhatsApp",
    freight: 150, lines: items.map((it) => ({ itemId: it.id, unit: buyUnit(it), unitPrice: priceFor(it, bump), gstRate: it.gstRate ?? 0, leadTimeDays: lead, availability: "In stock", brand: "Standard" })),
  }));
  let awardedPoSource = null;
  if (prRfq) {
    const r = await step("convert request to RFQ", post(`/purchase/requests/${prRfq.id}/convert-to-rfq`, { supplierIds: rfqSuppliers, deadline: ahead(3), paymentTerms: "Net 7", deliveryTerms: "Delivery at kitchen door", notes: "seafood price comparison" }));
    if (r.ok) {
      count("RFQs");
      const rfq = r.data, items = rfq.lines.map((l) => ctx.items.find((i) => i.id === l.itemId)).filter(Boolean);
      await step("send RFQ", post(`/purchase/rfqs/${rfq.id}/send`, {}));
      const q1 = await quote(rfq.id, "Sri Annapoorna Provisions", 1.04, 2, items);
      const q2 = await quote(rfq.id, "Madurai Fresh Farms", 0.97, 1, items);
      const q3 = await quote(rfq.id, "Coastal Seafoods & Meats", 1.0, 1, items);
      count("Quotations"); count("Quotations"); count("Quotations");
      await step("start evaluation", post(`/purchase/rfqs/${rfq.id}/evaluate`, {}));
      if (q1.ok) await step("shortlist", post(`/purchase/quotations/${q1.data.id}/shortlist`, {}));
      if (q3.ok) await step("award", post(`/purchase/rfqs/${rfq.id}/award`, { quotationId: q2.ok ? q2.data.id : q3.data.id, reason: "Lowest full-coverage price with next-day delivery" }));
      const po = q2.ok ? await step("PO from awarded quotation", post("/purchase/orders", { source: "quotation", quotationId: q2.data.id, orderDate: ago(9) })) : { ok: false };
      if (po.ok) { count("Purchase orders"); awardedPoSource = po.data; }
    }
  }
  // RFQ in draft, one with a single response, one cancelled
  const rfqItems = itemsFor(ctx, "Grains & Staples", 3);
  const mkRfq = async (tag, ids) => step(`RFQ ${tag}`, post("/purchase/rfqs", { supplierIds: ids, deadline: ahead(4), requiredDate: ahead(7), paymentTerms: "Net 15", notes: `${tag}`, lines: rfqItems.map((it) => ({ itemId: it.id, qty: qtyFor(it), unit: buyUnit(it) })) }));
  const rD = await mkRfq("Rice and dal quote (draft)", rfqSuppliers.slice(0, 2)); if (rD.ok) count("RFQs");
  const rS = await mkRfq("Rice and dal quote (one reply)", rfqSuppliers.slice(0, 2));
  if (rS.ok) { count("RFQs"); await post(`/purchase/rfqs/${rS.data.id}/send`, {}); await quote(rS.data.id, "Sri Annapoorna Provisions", 1.02, 2, rfqItems); count("Quotations"); }
  const rC = await mkRfq("Old quote (cancelled)", rfqSuppliers.slice(0, 2));
  if (rC.ok) { count("RFQs"); await post(`/purchase/rfqs/${rC.data.id}/send`, {}); await post(`/purchase/rfqs/${rC.data.id}/cancel`, { reason: "Menu changed; no longer needed" }); }

  /* ── purchase orders ── */
  log("Purchase orders, receipts, invoices, payments…");
  const po = async (supName, tag, { flow = ["submit", "approve", "send"], k = 0, bump = 1, orderDays = 6, expectedIn = 3, from = 0, n = 3, notes } = {}) => {
    const items = itemsFor(ctx, supCategory(supName), n, from);
    const r = await step(`PO ${tag}`, post("/purchase/orders", { source: "manual", supplierId: S(supName).id, orderDate: ago(orderDays), expectedDate: ahead(expectedIn), paymentTerms: S(supName).paymentTerms || "Net 7", deliveryTerms: "Deliver to receiving bay", notes: notes || `${tag}`, freight: 100, lines: poLines(items, { bump, k }) }));
    if (!r.ok) { count("Purchase orders", "failed"); return null; }
    count("Purchase orders");
    let doc = r.data;
    for (const act of flow) {
      const body = act === "reject" ? { comment: "Prices not agreed" } : act === "cancel" ? { reason: "Supplier out of stock" } : act === "send" ? { via: "whatsapp" } : {};
      const x = await step(`PO ${tag} ${act}`, post(`/purchase/orders/${doc.id}/${act}`, body));
      if (!x.ok) break; doc = x.data;
    }
    return doc;
  };
  await po("Madurai Fresh Farms", "Vegetables (draft)", { flow: [] });
  await po("Meenakshi Dairy Products", "Dairy (awaiting approval)", { flow: ["submit"] });
  await po("Pandian Oil Mills", "Oil (approved, not sent)", { flow: ["submit", "approve"] });
  await po("Kovai Spice Traders", "Spices (rejected)", { flow: ["submit", "reject"] });
  await po("Sri Annapoorna Provisions", "Grocery (cancelled)", { flow: ["cancel"], from: 3 });
  const overdue = await po("Coastal Seafoods & Meats", "Meat (sent, overdue)", { orderDays: 12, expectedIn: -5 });
  if (prPo) {                                                         // request → PO conversion
    const r = await step("convert request to PO", post(`/purchase/requests/${prPo.id}/convert-to-po`, { supplierId: S("Kovai Spice Traders").id, expectedDate: ahead(4) }));
    if (r.ok) { count("Purchase orders"); for (const a of ["submit", "approve", "send"]) await post(`/purchase/orders/${r.data.id}/${a}`, a === "send" ? { via: "email" } : {}); }
  }
  if (awardedPoSource) for (const a of ["submit", "approve", "send"]) await post(`/purchase/orders/${awardedPoSource.id}/${a}`, a === "send" ? { via: "whatsapp" } : {});

  /* received sets: 3 receipts for each of 5 suppliers (scorecards need ≥ 3) */
  const received = [];
  const plans = [
    ["Sri Annapoorna Provisions", [{ ratio: 1, late: 0 }, { ratio: 1, late: 0 }, { ratio: 0.9, late: 2, reject: true }]],
    ["Madurai Fresh Farms", [{ ratio: 1, late: 0 }, { ratio: 1, late: 1 }, { ratio: 0.75, late: 0, quarantine: true }]],
    ["Meenakshi Dairy Products", [{ ratio: 1, late: 0 }, { ratio: 1, late: 0 }, { ratio: 1, late: 0 }]],
    ["Pandian Oil Mills", [{ ratio: 1, late: 3 }, { ratio: 0.8, late: 2 }, { ratio: 1, late: 4 }]],
    ["Coastal Seafoods & Meats", [{ ratio: 1, late: 0 }, { ratio: 0.85, late: 0, reject: true }, { ratio: 1, late: 1 }]],
  ];
  let seq = 0;
  for (const [supName, shapes] of plans) {
    for (const [j, sh] of shapes.entries()) {
      seq++;
      const doc = await po(supName, `${supName.split(" ")[0]} delivery ${j + 1}`, { orderDays: 24 - seq, expectedIn: -sh.late - 1 + 1, from: j, n: 3, k: seq, bump: 0.96 + j * 0.03 });
      if (!doc || doc.status !== "sent") continue;
      const grn = await receive(ctx, doc, sh);
      if (grn) received.push({ po: doc, sh, supName, grn });
    }
  }
  // partially received, fully received then closed, short-closed
  const partial = await po("Sri Annapoorna Provisions", "Grocery (partly received)", { orderDays: 4, expectedIn: 2, k: 11, from: 1 });
  if (partial) await receive(ctx, partial, { ratio: 0.5 });
  const closed = await po("Meenakshi Dairy Products", "Dairy (short-closed)", { orderDays: 8, expectedIn: -1, k: 12, from: 1 });
  if (closed) { await receive(ctx, closed, { ratio: 0.6 }); await step("short-close PO", post(`/purchase/orders/${closed.id}/close`, { reason: "Supplier could not deliver the balance" })); }
  if (overdue) skip("1 order left 'sent' with a past expected date so Alerts shows it overdue");
  // a receipt left as draft, and one cancelled
  const draftPo = await po("Madurai Fresh Farms", "Vegetables (receipt draft)", { orderDays: 2, expectedIn: 1, k: 13 });
  if (draftPo) await receive(ctx, draftPo, { ratio: 1 }, { postIt: false });
  const cancelPo = await po("Pandian Oil Mills", "Oil (receipt cancelled)", { orderDays: 2, expectedIn: 1, k: 14 });
  if (cancelPo) { const g = await receive(ctx, cancelPo, { ratio: 1 }, { postIt: false }); if (g) await step("cancel receipt", post(`/receiving/grns/${g.id}/cancel`, { reason: "Wrong delivery note — goods refused" })); }

  await seedReturns(ctx, received);
  await seedFinance(ctx, received);
}

/** create (and optionally post) a goods receipt for a sent PO. */
async function receive(ctx, poDoc, sh, { postIt = true } = {}) {
  const locDefault = Object.values(ctx.loc).find((l) => l.code === "RCV-01") || Object.values(ctx.loc)[0];
  const quar = ctx.loc["QUA-01"];
  const lines = poDoc.lines.map((l, i) => {
    const it = ctx.items.find((x) => x.id === l.itemId) || {};
    const delivered = round(l.qty * (sh.ratio || 1), 3);
    let rejected = 0, quarantined = 0, reason = "";
    if (sh.reject && i === 0) { rejected = round(delivered * 0.1, 3); reason = "Damaged in transit"; }
    if (sh.quarantine && i === 0) { quarantined = round(delivered * 0.2, 3); reason = "Temperature check pending"; }
    const loc = (it.defaultLocationId && Object.values(ctx.loc).find((x) => x.id === it.defaultLocationId)) || locDefault;
    const line = { itemId: l.itemId, delivered, rejected, quarantined, accepted: round(delivered - rejected - quarantined, 3), locationId: loc.id, reason, checks: { packagingOk: true, labelOk: true, qualityOk: !rejected } };
    if (it.trackBatches) line.batchNo = `${poDoc.poNo}-${it.sku || i}`;
    if (it.trackExpiry) { line.expiryDate = ahead(40 + i * 10); line.mfgDate = ago(5); }
    return line;
  });
  const r = await step(`receipt for ${poDoc.poNo}`, post("/receiving/grns", { poId: poDoc.id, lines, deliveryNoteNo: `DN-${hash(poDoc.poNo) % 90000 + 10000}`, vehicleNo: `TN 58 ${String.fromCharCode(65 + (hash(poDoc.poNo) % 26))}${(hash(poDoc.poNo) % 9000) + 1000}`, receivedDate: iso(Date.now()), notes: "delivered at the kitchen gate" }));
  void quar;
  if (!r.ok) { count("Goods receipts", "failed"); return null; }
  count("Goods receipts");
  if (!postIt) return r.data;
  const p = await step(`post receipt ${r.data.grnNo}`, post(`/receiving/grns/${r.data.id}/post`, {}));
  return p.ok ? p.data : null;
}

/* ───────────────────────── returns & quarantine ───────────────────────── */
async function findBalance(itemId, bucket = "available") {
  const r = await get("/inventory/stock", { itemId, limit: 20 });
  return r.ok ? (r.data.data || []).find((b) => (bucket === "quarantined" ? b.quarantined > 0 : b.available > 0 && !b.isExpired)) : null;
}
async function seedReturns(ctx, received) {
  log("Supplier returns…");
  const withSup = (n, k = 0) => received.filter((r) => r.supName === n)[k] || received.find((r) => r.supName === n);
  const mk = async (tag, supName, source, reasonCategory, flow, { rec: k = 0, lineIdx } = {}) => {
    const rec = withSup(supName, k); if (!rec) return null;
    let line;
    if (source === "rejected_at_gate") {
      const gl = rec.grn.lines.find((l) => l.rejected > 0); if (!gl) return null;
      line = { itemId: gl.itemId, qty: gl.rejected, source, grnId: rec.grn.id, reason: gl.reason || "Damaged in transit" };
    } else {
      const poLine = rec.po.lines[lineIdx ?? (source === "quarantine" ? 0 : 1)] || rec.po.lines[0];
      const bal = await findBalance(poLine.itemId, source === "quarantine" ? "quarantined" : "available");
      if (!bal) { skip(`return ${tag}: no ${source} stock to return`); return null; }
      line = { itemId: poLine.itemId, qty: round(Math.min(source === "quarantine" ? bal.quarantined : bal.available, 1 + (bal.available || 1) * 0.02), 3), unit: bal.unit, source, locationId: bal.locationId, batchNo: bal.batchNo, reason: tag };
    }
    const r = await step(`return ${tag}`, post("/receiving/returns", { poId: source === "rejected_at_gate" || source === "stock" ? rec.po.id : undefined, supplierId: S_id(ctx, supName), reasonCategory, notes: `${tag}`, vehicleNo: "TN 58 AZ 4321", lines: [line] }));
    if (!r.ok) { count("Supplier returns", "failed"); return null; }
    count("Supplier returns");
    let doc = r.data;
    for (const [a, b] of flow) { const x = await step(`return ${tag} ${a}`, post(`/receiving/returns/${doc.id}/${a}`, (typeof b === "function" ? b(doc) : b) || {})); if (!x.ok) break; doc = x.data; }
    return doc;
  };
  await mk("damaged stock (draft)", "Sri Annapoorna Provisions", "stock", "damaged", []);
  await mk("short shelf life (pending approval)", "Madurai Fresh Farms", "stock", "short_shelf_life", [["submit"]]);
  await mk("quality complaint (approved)", "Meenakshi Dairy Products", "stock", "quality", [["submit"], ["approve"]]);
  await mk("wrong item (dispatched)", "Pandian Oil Mills", "stock", "wrong_item", [["submit"], ["approve"], ["dispatch"]]);
  const credited = await mk("excess delivery (credited)", "Coastal Seafoods & Meats", "stock", "excess", [["submit"], ["approve"], ["dispatch"], ["credit", { creditNoteNo: "CN-2610-77", amount: 450 }]]);
  // more returns so the Returns page shows every status and refund outcome (full refund, part refund, awaiting refund)
  const full = (no) => (d) => ({ creditNoteNo: no, amount: d.total });
  const part = (no, f) => (d) => ({ creditNoteNo: no, amount: Math.round(d.total * f * 100) / 100 });
  await mk("expired on delivery (refunded in full)", "Meenakshi Dairy Products", "stock", "expired", [["submit"], ["approve"], ["dispatch"], ["credit", full("CN-2610-81")]], { rec: 1, lineIdx: 0 });
  await mk("below agreed quality (part refund)", "Madurai Fresh Farms", "stock", "quality", [["submit"], ["approve"], ["dispatch"], ["credit", part("CN-2610-84", 0.8)]], { rec: 1, lineIdx: 0 });
  await mk("wrong pack size (refunded in full)", "Sri Annapoorna Provisions", "stock", "wrong_item", [["submit"], ["approve"], ["dispatch"], ["credit", full("CN-2610-88")]], { rec: 1, lineIdx: 0 });
  await mk("excess oil delivered (awaiting refund)", "Pandian Oil Mills", "stock", "excess", [["submit"], ["approve"], ["dispatch"]], { rec: 1, lineIdx: 0 });
  await mk("short shelf life seafood (awaiting refund)", "Coastal Seafoods & Meats", "stock", "short_shelf_life", [["submit"], ["approve"], ["dispatch"]], { rec: 2, lineIdx: 0 });
  await mk("damaged cartons (pending approval)", "Pandian Oil Mills", "stock", "damaged", [["submit"]], { rec: 2, lineIdx: 0 });
  await mk("quality complaint (rejected)", "Coastal Seafoods & Meats", "stock", "quality", [["submit"], ["reject", { reason: "Quality was within the agreed range" }]], { rec: 1, lineIdx: 0 });
  await mk("quarantined goods (rejected request)", "Madurai Fresh Farms", "quarantine", "quality", [["submit"], ["reject", { reason: "Release after re-test instead" }]]);
  await mk("gate rejection (draft)", "Sri Annapoorna Provisions", "rejected_at_gate", "damaged", []);
  await mk("duplicate return (cancelled)", "Meenakshi Dairy Products", "stock", "other", [["cancel", { reason: "Raised by mistake" }]]);
  ctx.creditedReturn = credited;
}
const S_id = (ctx, name) => ctx.sup[name] && ctx.sup[name].id;

/* ───────────────────────── invoices & payments ───────────────────────── */
async function seedFinance(ctx, received) {
  log("Supplier invoices…");
  let n = 0;
  const invFor = async (rec, tag, { days, bump = 1, flow = ["submit", "approve"], override, lineN = 3 }) => {
    const po = (await get(`/purchase/orders/${rec.po.id}`)).data;
    if (!po) return null;
    const lines = po.lines.filter((l) => l.received > 0).slice(0, lineN).map((l) => ({ itemId: l.itemId, qty: l.received, unit: l.unit, unitPrice: round(l.unitPrice * bump, 6), discountPct: l.discountPct, gstRate: l.gstRate }));
    if (!lines.length) return null;
    n++;
    const r = await step(`invoice ${tag}`, post("/finance/invoices", { poId: po.id, invoiceNo: `INV/2610/${100 + n}`, invoiceDate: ago(days), freight: 0, notes: `${tag}`, lines }));
    if (!r.ok) { count("Supplier invoices", "failed"); return null; }
    count("Supplier invoices");
    let doc = r.data;
    for (const a of flow) {
      let x = await post(`/finance/invoices/${doc.id}/${a}`, a === "approve" ? { comment: "Approved" } : a === "reject" || a === "dispute" || a === "cancel" ? { reason: override || "price differs from the order" } : {});
      if (!x.ok && x.code === "MATCH_VARIANCE") x = await post(`/finance/invoices/${doc.id}/approve`, { overrideReason: "supplier price increase accepted by the owner" });
      if (!x.ok) { bad(`invoice ${tag} ${a}: ${x.error}`); break; }
      doc = x.data;
    }
    return doc;
  };
  const by = (name, i = 0) => received.filter((r) => r.supName === name)[i];
  const approved = [];
  const push = (d) => d && d.status === "approved" && approved.push(d);
  push(await invFor(by("Sri Annapoorna Provisions", 0), "matched, overdue", { days: 22 }));
  push(await invFor(by("Madurai Fresh Farms", 0), "matched, due soon", { days: 5 }));
  push(await invFor(by("Meenakshi Dairy Products", 0), "matched, partly paid", { days: 12 }));
  push(await invFor(by("Meenakshi Dairy Products", 1), "matched, paid in full", { days: 9 }));
  push(await invFor(by("Pandian Oil Mills", 0), "price variance, approved with override", { days: 14, bump: 1.08 }));
  push(await invFor(by("Coastal Seafoods & Meats", 0), "matched, unpaid", { days: 3 }));
  push(await invFor(by("Madurai Fresh Farms", 1), "matched, for advance allocation", { days: 6 }));
  await invFor(by("Sri Annapoorna Provisions", 1), "draft", { days: 4, flow: [] });
  await invFor(by("Coastal Seafoods & Meats", 1), "pending approval", { days: 2, flow: ["submit"] });
  await invFor(by("Pandian Oil Mills", 1), "disputed", { days: 10, bump: 1.15, flow: ["submit", "dispute"], override: "billed above agreed price" });
  await invFor(by("Meenakshi Dairy Products", 2), "rejected", { days: 8, bump: 1.2, flow: ["submit", "reject"], override: "wrong quantity billed" });
  await invFor(by("Sri Annapoorna Provisions", 2), "cancelled", { days: 7, flow: ["cancel"], override: "duplicate entry" });

  // apply a supplier credit note to a matching invoice, if one was credited
  if (ctx.creditedReturn && ctx.creditedReturn.status === "credited") {
    const target = approved.find((a) => a.supplierId === ctx.creditedReturn.supplierId);
    if (target) await step("apply credit note", post(`/finance/invoices/${target.id}/apply-credit`, { returnId: ctx.creditedReturn.id }));
  }

  log("Supplier payments…");
  const fresh = async (inv) => (await get(`/finance/invoices/${inv.id}`)).data;
  const pay = async (tag, inv, method, amountOf, { approve = true, then, reference } = {}) => {
    if (!inv) return null;
    const cur = await fresh(inv); if (!cur) return null;
    const amount = round(typeof amountOf === "function" ? amountOf(cur) : amountOf, 2);
    const body = { supplierId: cur.supplierId, method, amount: amount.valueOf(), paymentDate: ago(1), notes: `${tag}`, allocations: [{ invoiceId: cur.id, amount }] };
    if (method !== "cash") body.reference = reference || `${method.toUpperCase().slice(0, 4)}${hash(tag + cur.docNo) % 900000 + 100000}`;
    const r = await call("POST", "/finance/payments", body, { key: `demo:${cfg.venueId}:pay:${cur.docNo}:${tag}` });
    if (!r.ok) { bad(`payment ${tag}: ${r.error}`); count("Supplier payments", "failed"); return null; }
    count("Supplier payments", r.data.replayed ? "existed" : "created");
    let doc = r.data;
    if (approve && doc.status === "pending_approval") { const a = await step(`approve payment ${tag}`, post(`/finance/payments/${doc.id}/approve`, { comment: "Approved" })); if (a.ok) doc = a.data; }
    if (then) { const t = await step(`payment ${tag} ${then.action}`, post(`/finance/payments/${doc.id}/${then.action}`, then.body)); if (t.ok) doc = t.data; }
    return doc;
  };
  await pay("full payment by bank transfer", approved[2 + 1], "bank_transfer", (i) => i.outstanding);
  await pay("part payment by UPI", approved[2], "upi", (i) => round(i.outstanding * 0.4, 2));
  await pay("cheque payment", approved[0], "cheque", (i) => round(i.outstanding * 0.5, 2), { reference: "CHQ 004512" });
  await pay("cash payment", approved[5], "cash", (i) => Math.min(8500, round(i.outstanding * 0.3, 2)));
  await pay("waiting for approval", approved[1], "bank_transfer", (i) => round(i.outstanding * 0.5, 2), { approve: false });
  await pay("reversed (bounced)", approved[4], "bank_transfer", (i) => round(i.outstanding * 0.3, 2), { then: { action: "reverse", body: { reason: "bank returned the transfer" } } });
  await pay("cancelled before approval", approved[4], "upi", (i) => round(i.outstanding * 0.2, 2), { approve: false, then: { action: "cancel", body: { reason: "wrong UPI id" } } });
  // advance: pay more than allocated, then allocate the remainder to another invoice
  const adv = approved[6];
  if (adv) {
    const cur = await fresh(adv);
    if (cur) {
      const r = await call("POST", "/finance/payments", { supplierId: cur.supplierId, method: "bank_transfer", reference: `ADV${hash(cur.docNo) % 900000 + 100000}`, amount: round(cur.outstanding + 2000, 2), paymentDate: ago(1), notes: "advance with remainder", allocations: [{ invoiceId: cur.id, amount: round(cur.outstanding, 2) }] }, { key: `demo:${cfg.venueId}:advance:${cur.docNo}` });
      if (r.ok) { count("Supplier payments", r.data.replayed ? "existed" : "created"); if (r.data.status === "pending_approval") await step("approve advance", post(`/finance/payments/${r.data.id}/approve`, {})); }
      else bad(`advance payment: ${r.error}`);
    }
  }
}

/* ───────────────────────── stock audits ───────────────────────── */
async function seedAudits(ctx) {
  log("Stock audits…");
  const existing = await get("/automation/audits", { limit: 50 });
  if (existing.ok && (existing.data.data || []).some((a) => String(a.title) === "Cold room count (in progress)")) { skip("Audits already seeded"); return; }
  const locs = Object.values(ctx.loc);
  const byCode = (c) => locs.find((l) => l.code === c);
  const mk = async (tag, loc, blind) => {
    if (!loc) return null;
    const r = await post("/automation/audits", { title: `${tag}`, locationId: loc.id, blind });
    if (!r.ok) { skip(`audit ${tag}: ${r.error}`); return null; }
    count("Stock audits"); return r.data;
  };
  const count_ = async (a, variance) => {
    const full = (await get(`/automation/audits/${a.id}`)).data; if (!full) return false;
    const counts = full.lines.map((l, i) => {
      const sys = l.system ?? 0;
      const diff = variance && i % 3 === 0 ? -round(sys * 0.04, 3) : 0;
      return { index: l.index, qty: round(Math.max(0, sys + diff), 3), ...(diff ? { reason: "Spillage not recorded" } : {}) };
    });
    return (await step("enter counts", call("PUT", `/automation/audits/${a.id}/counts`, { counts }))).ok;
  };
  await mk("Cold room count (in progress)", byCode("COLD-01"), true);
  const a2 = await mk("Dry store monthly count (awaiting approval)", byCode("DRY-01"), false);
  if (a2 && (await count_(a2, true))) await step("submit audit", post(`/automation/audits/${a2.id}/submit`, {}));
  const a3 = await mk("Kitchen shelf count (posted)", byCode("KIT-01"), false);
  if (a3 && (await count_(a3, true))) {
    for (const a of ["submit", "approve", "post"]) { const x = await step(`audit ${a}`, post(`/automation/audits/${a3.id}/${a}`, {})); if (!x.ok) break; }
  }
  const a4 = await mk("Freezer count (cancelled)", byCode("FRZ-01"), true);
  if (a4) await step("cancel audit", post(`/automation/audits/${a4.id}/cancel`, { reason: "Defrost scheduled; recount next week" }));
}

/* ───────────────────────── DB phase: forecast history + WhatsApp log ───────────────────────── */
async function seedDb(ctx) {
  log("Forecast history and WhatsApp log (DB phase)…");
  if (!process.env.MONGO_URI) { skip("MONGO_URI not set — skipped (use --no-db to silence)"); return; }
  let mongoose;
  try {
    require("../src/core/tenancy");
    mongoose = require("mongoose");
    const { runInTenant, runAsPlatform } = require("../src/core/tenancy");
    const { Restaurant } = require("../src/modules/platform/models");
    const M = require("../src/modules/inventory/models");
    const svc = require("../src/modules/inventory/stockService");
    const A = require("../src/modules/inventory/automationModels");
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    const restaurant = await runAsPlatform(() => Restaurant.findOne({ slug: cfg.slug }).lean());
    if (!restaurant) throw new Error(`no restaurant "${cfg.slug}"`);
    await runInTenant(restaurant.id, async () => {
      const venueId = cfg.venueId;
      const user = { id: "system", name: "System" };
      /* consumption history */
      const already = await M.StockLedger.countDocuments({ venueId, type: "consumption", refType: "usage_history" });
      if (already) skip(`${already} seeded consumption entries already exist`);
      else {
        const bals = (await M.StockBalance.find({ venueId, availableMilli: { $gt: 0 } }).lean()).filter((b) => !(b.expiryDate && +new Date(b.expiryDate) < Date.now()));
        const seenItems = new Set(), chosen = [];
        for (const b of bals) if (!seenItems.has(b.itemId) && chosen.length < 14) { seenItems.add(b.itemId); chosen.push(b); }
        const items = new Map((await M.InventoryItem.find({ id: { $in: chosen.map((c) => c.itemId) } }).lean()).map((i) => [i.id, i]));
        const days = []; for (let d = 1; d <= 26; d++) if (d % 7 !== 3 && d % 11 !== 0) days.push(d);
        let made = 0;
        for (const d of days) {
          for (const [ci, b] of chosen.entries()) {
            const weekdayBoost = [0, 6].includes(new Date(Date.now() - d * DAY).getDay()) ? 1.5 : 1;
            const qtyMilli = Math.max(1, Math.floor(b.availableMilli * 0.004 * weekdayBoost * (0.7 + ((d * 7 + ci * 3) % 7) / 10)));
            try {
              const r = await svc.postMovement({ venueId, user }, { item: items.get(b.itemId), itemId: b.itemId, locationId: b.locationId, batchNo: b.batchNo, type: "consumption", qtyMilli, refType: "usage_history", refId: `day-${d}`, reason: "order consumption", idempotencyKey: `demo:${venueId}:cons:${d}:${b.itemId}` });
              if (r.replayed) continue;
              // DELIBERATE: back-date the demo entry by writing to the raw collection (bypasses the append-only hooks).
              await M.StockLedger.collection.updateOne({ id: r.entry.id }, { $set: { postedAt: new Date(Date.now() - d * DAY - (ci % 5) * 36e5) } });
              made++;
            } catch (e) { if (made === 0) { bad(`consumption: ${e.message}`); break; } }
          }
        }
        made ? (ok(`${made} back-dated consumption entries over ${days.length} days`), count("Consumption history entries", "created")) : skip("no consumption entries created");
        sum["Consumption history entries"] && (sum["Consumption history entries"].created = made);
      }
      /* WhatsApp log */
      const hasLog = await A.WhatsappLog.countDocuments({ venueId, template: "purchase_list_v1", refType: "purchaseList" });
      if (hasLog) skip("WhatsApp log rows already exist");
      else {
        const names = Object.keys(ctx.sup).filter((n) => ctx.sup[n].status === "active").slice(0, 5);
        const rows = [
          ["Sri Annapoorna Provisions", "Basmati Rice 50 kg; Toor Dal 20 kg; Sugar 25 kg", 3, 1, "sent"],
          ["Madurai Fresh Farms", "Onion 40 kg; Tomato 30 kg; Carrot 15 kg", 3, 0.5, "sent"],
          ["Meenakshi Dairy Products", "Milk 60 l; Butter 10 kg; Paneer 8 kg", 3, 2, "sent"],
          ["Coastal Seafoods & Meats", "Chicken 40 kg; Prawns 10 kg", 2, 3, "failed"],
          ["Kovai Spice Traders", "Black Pepper 5 kg; Turmeric 4 kg", 2, 5, "sent"],
        ].filter((r) => ctx.sup[r[0]]);
        for (const [name, text, n, daysAgo, status] of rows) {
          const sup = ctx.sup[name], ph = String(sup.whatsapp || sup.phone || "9000000000");
          const doc = await A.WhatsappLog.create({ venueId, supplierId: sup.id, supplierName: name, phoneMasked: `${ph.slice(0, 2)}******${ph.slice(-2)}`, template: "purchase_list_v1", refType: "purchaseList", itemCount: n, listText: `${text}`, status, error: status === "failed" ? "AiSensy: template not approved for this number" : "", sentBy: me_id(), sentByName: user.name });
          await A.WhatsappLog.collection.updateOne({ id: doc.id }, { $set: { createdAt: new Date(Date.now() - daysAgo * DAY), updatedAt: new Date(Date.now() - daysAgo * DAY) } });
          count("WhatsApp log rows");
        }
        void names;
      }
    });
  } catch (e) { skip(`DB phase skipped: ${e.message}`); }
  finally { try { await mongoose.disconnect(); } catch { /* not connected */ } }
}
const me_id = () => "system";

/* ───────────────────────── summary ───────────────────────── */
function summary(venue) {
  console.log("\n──────────── Summary ────────────");
  for (const [k, v] of Object.entries(sum)) console.log(`${k.padEnd(28)} created ${String(v.created).padStart(3)}   existed ${String(v.existed).padStart(3)}   failed ${String(v.failed).padStart(3)}`);
  console.log("\nNext steps");
  if (hints.noEncKey) console.log("  • Supplier bank ACCOUNT NUMBERS were skipped: add SETTINGS_ENCRYPTION_KEY=<output of: openssl rand -base64 48> to server/.env, restart the server and run this script again.");
  console.log(`  • In the admin panel pick the branch "${venue.name}" in the top bar (data is per branch). To seed another branch run with --venue "<branch name>".`);
  console.log("  • Purchase settings were put back exactly as they were before the run.");
}

main().catch((e) => { console.error(`\n✗ ${e.message}`); process.exitCode = 1; });
