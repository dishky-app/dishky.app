#!/usr/bin/env node
/**
 * seedTrialDishes.js — Dishky server, one-time script
 * ----------------------------------------------------------------
 * Adds 10 realistic trial dishes (a cafe's new-menu pipeline) spread over every workflow state: pending, in progress,
 * under review, approved, rejected, on hold, one overdue, and one that has been sent for a retest (attempt 2). Each has
 * ingredients, costs, evaluations, comments, ingredient changes, attempt history and an activity log. Dates are relative
 * to today. Dish pictures are small generated plate illustrations (replace them by editing the trial).
 *
 * USAGE
 *   cd server
 *   node scripts/seedTrialDishes.js --restaurant <slug>                 # add the trials
 *   node scripts/seedTrialDishes.js --restaurant <slug> --venue <id>    # a specific venue (default: main branch)
 *   node scripts/seedTrialDishes.js --restaurant <slug> --dry-run
 *   node scripts/seedTrialDishes.js --restaurant <slug> --replace-existing   # deletes that venue's trial dishes first
 *
 * Chefs are taken from the venue's real staff (kitchen roles first). A trial whose name already exists is skipped.
 */
require("dotenv").config();
require("../src/core/tenancy");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { runInTenant, runAsPlatform } = require("../src/core/tenancy");
const { getModel } = require("../src/core/genericModel");
const { Restaurant } = require("../src/modules/platform/models");
const { Venue } = require("../src/modules/venues/venues");
const { Admin } = require("../src/modules/auth/auth");
const { Trial, overallScore } = require("../src/modules/trialDishes/trialDishes");

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(`--${n}`);
const uid = (p) => `${p}_${crypto.randomBytes(6).toString("hex")}`;

const DAY = 864e5;
const now = Date.now();
const at = (offset, hour = 11, min = 0) => { const d = new Date(now + offset * DAY); d.setHours(hour, min, 0, 0); return d; };
const dstr = (offset) => { const d = new Date(now + offset * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** A simple plate illustration (SVG data URL) so the list is not full of blanks. */
function plate(bg1, bg2, food, garnish) {
  const dots = garnish.map((c, i) => `<circle cx="${70 + ((i * 37) % 60)}" cy="${68 + ((i * 29) % 56)}" r="${5 + (i % 3) * 2}" fill="${c}" opacity=".9"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><ellipse cx="100" cy="108" rx="78" ry="74" fill="#000" opacity=".12"/><circle cx="100" cy="100" r="76" fill="#fafafa"/><circle cx="100" cy="100" r="60" fill="#f0f0f0"/><ellipse cx="100" cy="100" rx="44" ry="38" fill="${food}"/>${dots}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// scores: taste, presentation, texture, portion, prepTime, ingredientCost, customerAppeal
const S = (a, b, c, d, e, f, g) => ({ taste: a, presentation: b, texture: c, portion: d, prepTime: e, ingredientCost: f, customerAppeal: g });

const SPECS = [
  {
    name: "Peri Peri Paneer Wrap", category: "Wraps", priority: "high", status: "in_progress", progress: 60, start: -6, due: 4,
    img: plate("#fde7c8", "#f6b26b", "#d9822b", ["#2e7d32", "#c62828", "#fbc02d"]),
    description: "Grilled paneer tossed in house peri peri sauce, rolled in a whole-wheat wrap with crunchy slaw and mint mayo. Aimed at the evening snack menu.",
    ingredients: [["Paneer", "120", "g"], ["Whole-wheat wrap", "1", "pc"], ["Peri peri sauce", "30", "ml"], ["Red cabbage", "40", "g"], ["Capsicum", "30", "g"], ["Mint mayo", "20", "g"]],
    method: "Marinate paneer in peri peri sauce for 30 min. Grill 3–4 min per side. Warm the wrap, spread mint mayo, add slaw and paneer, roll tightly and toast 1 min each side.",
    cost: 62, price: 169, remarks: "Check wrap does not tear when rolled hot.",
    evals: [{ attempt: 1, day: -3, scores: S(8, 7, 7, 7, 8, 8, 8), rating: 4, feedback: "Good heat level and the paneer stays soft. Wrap edge dries out if left on the pass.", actual: 66 }],
    comments: [{ day: -5, kind: "observation", text: "Paneer releases water if marinated longer than 40 minutes — keep it to 30." }, { day: -2, kind: "comment", text: "Customer tasting on Saturday liked it, a few asked for a cheese option." }],
    mods: [{ day: -4, ingredient: "Peri peri sauce", change: "changed", from: "40 ml", to: "30 ml", reason: "Too sharp with the mint mayo" }],
  },
  {
    name: "Smoked Chicken Alfredo Pasta", category: "Pasta", priority: "high", status: "under_review", progress: 90, start: -12, due: 2,
    img: plate("#fff3d6", "#f1d9a3", "#f3e2b3", ["#8d6e63", "#43a047", "#fafafa"]),
    description: "Penne in a light smoked-chicken cream sauce finished with parmesan and parsley. Lunch combo candidate.",
    ingredients: [["Penne", "90", "g"], ["Smoked chicken", "80", "g"], ["Fresh cream", "70", "ml"], ["Parmesan", "15", "g"], ["Garlic", "6", "g"], ["Butter", "10", "g"], ["Parsley", "2", "g"]],
    method: "Boil penne al dente. Sauté garlic in butter, add chicken, then cream; reduce 2 min. Toss pasta, add parmesan and loosen with pasta water. Garnish with parsley.",
    cost: 94, price: 289, remarks: "Smoked chicken supplier lead time is 2 days.",
    evals: [
      { attempt: 1, day: -8, scores: S(7, 7, 6, 8, 7, 6, 8), rating: 3, feedback: "Sauce a little heavy and splits on holding.", actual: 101 },
      { attempt: 1, day: -2, scores: S(9, 8, 8, 8, 8, 7, 9), rating: 5, feedback: "Much better after reducing cream and adding pasta water. Holds well for 10 minutes.", actual: 96 },
    ],
    comments: [{ day: -9, kind: "observation", text: "Sauce splits when held on the hot plate over 8 minutes." }, { day: -1, kind: "comment", text: "Ready for manager tasting. Plating photo uploaded to the kitchen group." }],
    mods: [{ day: -7, ingredient: "Fresh cream", change: "changed", from: "90 ml", to: "70 ml", reason: "Sauce too heavy, split on holding" }, { day: -7, ingredient: "Pasta water", change: "added", from: "", to: "30 ml", reason: "Helps the sauce stay glossy" }],
    submitted: -1,
  },
  {
    name: "Millet Banana Pancakes", category: "Breakfast", priority: "medium", status: "approved", progress: 100, start: -28, due: -14,
    img: plate("#f8e5c6", "#e8c28a", "#d8a35a", ["#fbc02d", "#6d4c41", "#fafafa"]),
    description: "Ragi and foxtail millet pancakes sweetened with ripe banana, served with jaggery syrup and toasted seeds.",
    ingredients: [["Ragi flour", "60", "g"], ["Foxtail millet flour", "40", "g"], ["Ripe banana", "1", "pc"], ["Milk", "120", "ml"], ["Egg", "1", "pc"], ["Jaggery syrup", "25", "ml"], ["Mixed seeds", "5", "g"]],
    method: "Whisk flours, mashed banana, milk and egg into a thick batter; rest 10 min. Cook on a lightly greased pan, 2 min per side. Serve three stacked with jaggery syrup and seeds.",
    cost: 38, price: 149, remarks: "Healthy-menu launch item.",
    evals: [{ attempt: 1, day: -20, scores: S(8, 8, 8, 9, 9, 9, 8), rating: 4, feedback: "Soft, not dry. Banana sweetness is enough — syrup can be served on the side.", actual: 36 }, { attempt: 1, day: -16, scores: S(9, 9, 8, 9, 9, 9, 9), rating: 5, feedback: "Excellent. Consistent over three batches.", actual: 37 }],
    comments: [{ day: -22, kind: "comment", text: "Resting the batter 10 minutes fixed the dense texture." }],
    mods: [{ day: -24, ingredient: "Wheat flour", change: "removed", from: "30 g", to: "", reason: "Keeping it fully millet-based" }, { day: -24, ingredient: "Foxtail millet flour", change: "added", from: "", to: "40 g", reason: "Better fluffiness than ragi alone" }],
    decision: { day: -15, decision: "approved", remarks: "Approved for the breakfast menu from next week at ₹149. Serve syrup on the side." },
  },
  {
    name: "Korean Spicy Chicken Rice Bowl", category: "Rice Bowls", priority: "medium", status: "rejected", progress: 100, start: -30, due: -16,
    img: plate("#fbd0cc", "#e57373", "#c62828", ["#fafafa", "#2e7d32", "#fbc02d"]),
    description: "Gochujang-glazed chicken over steamed rice with pickled radish, sesame and a fried egg.",
    ingredients: [["Chicken thigh", "150", "g"], ["Gochujang", "25", "g"], ["Steamed rice", "180", "g"], ["Pickled radish", "30", "g"], ["Egg", "1", "pc"], ["Sesame seeds", "3", "g"], ["Spring onion", "5", "g"]],
    method: "Marinate chicken in gochujang, soy and honey for 1 hr. Sear and glaze. Serve over rice with radish, fried egg, sesame and spring onion.",
    cost: 118, price: 249, remarks: "Gochujang is imported — cost risk.",
    evals: [{ attempt: 1, day: -22, scores: S(6, 7, 6, 7, 5, 3, 5), rating: 2, feedback: "Heat is too strong for most guests and ingredient cost is too high at ₹118 for the price point.", actual: 124 }],
    comments: [{ day: -23, kind: "observation", text: "Three of five tasters found it too spicy even after reducing gochujang." }, { day: -20, kind: "comment", text: "Local substitute for gochujang gave flat flavour." }],
    mods: [{ day: -25, ingredient: "Gochujang", change: "changed", from: "40 g", to: "25 g", reason: "Too spicy" }],
    decision: { day: -18, decision: "rejected", remarks: "Food cost is above 48% and the flavour does not suit the local menu.", recommendations: "Revisit with a milder local chilli paste and a cheaper cut; aim for food cost under 35%." },
  },
  {
    name: "Tandoori Mushroom Pizza", category: "Pizza", priority: "medium", status: "pending", progress: 0, start: 3, due: 12,
    img: plate("#fbe0c2", "#e6b17a", "#d68b3c", ["#8d6e63", "#2e7d32", "#fafafa", "#c62828"]),
    description: "Thin-crust pizza with tandoori-marinated button mushrooms, onion, capsicum and mozzarella.",
    ingredients: [["Pizza base", "1", "pc"], ["Button mushroom", "80", "g"], ["Tandoori marinade", "30", "g"], ["Mozzarella", "80", "g"], ["Pizza sauce", "40", "ml"], ["Onion", "30", "g"], ["Capsicum", "30", "g"]],
    method: "Marinate mushrooms 20 min and char in a hot pan. Spread sauce on the base, add cheese and toppings, bake at 250°C for 7–8 minutes.",
    cost: 88, price: 259, remarks: "Start once the new oven shelf is installed.", evals: [], comments: [], mods: [],
  },
  {
    name: "Filter Coffee Tiramisu", category: "Desserts", priority: "high", status: "in_progress", progress: 35, start: -9, due: 6, attempt: 2,
    img: plate("#efe0d3", "#c19a7b", "#6d4c41", ["#fafafa", "#3e2723"]),
    description: "Tiramisu made with South Indian filter coffee decoction instead of espresso, set in individual glass jars.",
    ingredients: [["Mascarpone", "100", "g"], ["Filter coffee decoction", "60", "ml"], ["Ladyfinger biscuits", "4", "pc"], ["Cream", "50", "ml"], ["Powdered sugar", "20", "g"], ["Cocoa powder", "3", "g"]],
    method: "Whip mascarpone, cream and sugar to soft peaks. Dip biscuits briefly in cooled decoction, layer with cream in a jar, chill 6 hours, dust with cocoa before serving.",
    cost: 72, price: 199, remarks: "Retest scheduled after reducing sweetness.",
    evals: [{ attempt: 1, day: -6, scores: S(6, 8, 5, 7, 8, 7, 7), rating: 3, feedback: "Biscuits turned soggy and the decoction was too bitter.", actual: 75 }],
    comments: [{ day: -7, kind: "observation", text: "Soak time of 5 seconds is too long — biscuits collapse." }],
    mods: [{ day: -5, ingredient: "Filter coffee decoction", change: "changed", from: "Strong decoction", to: "Diluted 1:1 with milk", reason: "Bitterness" }],
    retest: { day: -4, reason: "Texture and bitterness need correcting before approval.", recommendations: "Soak biscuits 2 seconds, dilute decoction with milk, chill overnight." },
    next: 2,
  },
  {
    name: "Avocado Hummus Toast", category: "Breakfast", priority: "low", status: "pending", progress: 0, start: 6, due: 15,
    img: plate("#e7efd8", "#b5cc8a", "#7cb342", ["#fafafa", "#c62828", "#fbc02d"]),
    description: "Sourdough toast with beetroot hummus, smashed avocado, cherry tomato and microgreens.",
    ingredients: [["Sourdough slice", "2", "pc"], ["Avocado", "½", "pc"], ["Beetroot hummus", "40", "g"], ["Cherry tomato", "3", "pc"], ["Microgreens", "5", "g"], ["Olive oil", "5", "ml"]],
    method: "Toast sourdough, spread hummus, top with smashed avocado, halved tomatoes and microgreens; finish with olive oil and chilli flakes.",
    cost: 96, price: 229, remarks: "Avocado price fluctuates — confirm supplier rate before the trial.", evals: [], comments: [], mods: [],
  },
  {
    name: "Mango Cheesecake Jar", category: "Desserts", priority: "medium", status: "on_hold", progress: 40, start: -14, due: 7,
    img: plate("#fff0c2", "#ffd54f", "#ffb300", ["#fafafa", "#fbc02d"]),
    description: "No-bake mango cheesecake layered in a jar with a digestive-biscuit base, for the summer dessert range.",
    ingredients: [["Cream cheese", "90", "g"], ["Alphonso mango pulp", "70", "g"], ["Digestive biscuit", "40", "g"], ["Butter", "15", "g"], ["Whipping cream", "40", "ml"], ["Sugar", "15", "g"]],
    method: "Crush biscuits with melted butter for the base. Beat cream cheese, cream and sugar, fold in mango pulp, layer over the base and chill 4 hours.",
    cost: 79, price: 189, remarks: "Seasonal item.",
    evals: [], comments: [{ day: -4, kind: "comment", text: "Waiting for mango season pricing to settle; supplier quoting double right now." }], mods: [],
    hold: "Mango pulp supply is too expensive out of season — resume when pulp cost drops below ₹300/kg.",
  },
  {
    name: "Butter Garlic Prawn Skewers", category: "Starters", priority: "high", status: "in_progress", progress: 45, start: -20, due: -3,
    img: plate("#fde2cf", "#f4a261", "#e76f51", ["#fafafa", "#2e7d32", "#fbc02d"]),
    description: "Marinated prawns grilled on skewers, basted with garlic butter and finished with lemon and coriander.",
    ingredients: [["Prawns (medium)", "6", "pc"], ["Garlic", "10", "g"], ["Butter", "20", "g"], ["Lemon juice", "10", "ml"], ["Coriander", "3", "g"], ["Kashmiri chilli powder", "2", "g"]],
    method: "Marinate prawns 15 min. Thread on skewers and grill 2 min per side, basting with garlic butter. Rest 1 min and finish with lemon and coriander.",
    cost: 142, price: 329, remarks: "Overdue — waiting for a reliable prawn supplier.",
    evals: [{ attempt: 1, day: -12, scores: S(7, 8, 5, 6, 8, 4, 7), rating: 3, feedback: "Prawns overcook quickly and portion of six looks small for the price.", actual: 148 }],
    comments: [{ day: -13, observation: true, kind: "observation", text: "Frozen prawns lose texture; fresh ones are better but supply is unreliable." }],
    mods: [{ day: -11, ingredient: "Prawns", change: "changed", from: "Frozen 6 pc", to: "Fresh 6 pc", reason: "Texture" }],
  },
  {
    name: "Cold Brew Tonic", category: "Beverages", priority: "low", status: "approved", progress: 100, start: -35, due: -25,
    img: plate("#e9ecef", "#adb5bd", "#4e342e", ["#fafafa", "#fbc02d"]),
    description: "Slow-steeped cold brew poured over ice and tonic water with an orange peel twist.",
    ingredients: [["Cold brew concentrate", "60", "ml"], ["Tonic water", "120", "ml"], ["Ice", "100", "g"], ["Orange peel", "1", "pc"]],
    method: "Fill a tall glass with ice, add tonic water, then slowly float cold brew on top. Express orange peel over the glass and drop it in.",
    cost: 31, price: 139, remarks: "Fast seller for the summer beverage menu.",
    evals: [{ attempt: 1, day: -30, scores: S(8, 9, 9, 8, 10, 9, 9), rating: 5, feedback: "Refreshing, quick to make and looks great. Serve immediately.", actual: 30 }],
    comments: [{ day: -31, kind: "comment", text: "Brew 18 hours for best balance; 12 hours is too weak." }],
    mods: [],
    decision: { day: -27, decision: "approved", remarks: "Approved at ₹139. Prepare concentrate in 5-litre batches." },
  },
];

async function main() {
  const slug = String(opt("restaurant") || "").trim().toLowerCase();
  if (!slug) throw new Error("Pass --restaurant <slug>");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  await mongoose.connect(process.env.MONGO_URI);
  const restaurant = await runAsPlatform(() => Restaurant.findOne({ slug }).lean());
  if (!restaurant) throw new Error(`No restaurant with slug "${slug}"`);

  await runInTenant(restaurant.id, async () => {
    const venue = opt("venue")
      ? await Venue.findOne({ id: opt("venue") }).lean()
      : (await Venue.findOne({ isMainBranch: true }).lean()) || (await Venue.findOne({}).lean());
    if (!venue) throw new Error("No venue found (pass --venue <id>)");

    const staff = await getModel("staff").find({ venueId: venue.id }).lean();
    if (!staff.length) throw new Error("This venue has no staff. Add staff first — trials are assigned to real staff.");
    const kitchen = staff.filter((s) => /chef|cook|kitchen|commis|sous/i.test(`${s.role} ${s.department || ""}`));
    const chefs = kitchen.length ? kitchen : staff;
    const reviewer = (await Admin.findOne({ roleGroup: { $in: ["Super Admin", "Manager"] } }).lean()) || {};
    const rv = { id: reviewer.id || reviewer._id?.toString() || "", name: reviewer.name || "Management" };

    if (flag("replace-existing")) {
      if (flag("dry-run")) console.log("[dry-run] would delete this venue's trial dishes");
      else console.log(`Deleted ${(await Trial.deleteMany({ venueId: venue.id })).deletedCount} trial dishes.`);
    }
    const existing = new Set((await Trial.find({ venueId: venue.id }).select("name").lean()).map((t) => t.name));
    const last = await Trial.findOne().sort({ seq: -1 }).select("seq").lean();
    let seq = last ? last.seq : 0;
    let added = 0;

    for (let i = 0; i < SPECS.length; i++) {
      const sp = SPECS[i];
      if (existing.has(sp.name)) { console.log(`skip (exists): ${sp.name}`); continue; }
      const chef = chefs[i % chefs.length];
      const by = { byId: chef.id, byName: chef.name };
      const rby = { byId: rv.id, byName: rv.name };
      const act = [];
      const A = (action, day, detail, who = by, extra = {}) => act.push({ id: uid("ac"), action, detail, ...extra, ...who, at: at(day, 10 + (act.length % 6), 5 * (act.length % 10)) });

      A("created", sp.start - 1, `Trial ${sp.name} created`, rby);
      if (sp.status !== "pending") A("in_progress", sp.start, "Trial started");
      const attempts = [{ attempt: 1, startedAt: at(sp.start), endedAt: null, outcome: "", reason: "", recommendations: "" }];

      const evaluations = sp.evals.map((e) => ({
        id: uid("ev"), attempt: e.attempt, scores: e.scores, weights: {}, overall: overallScore(e.scores), rating: e.rating,
        feedback: e.feedback, actualCost: e.actual, ...by, at: at(e.day, 15),
      }));
      sp.evals.forEach((e, n) => A("evaluated", e.day, `Overall ${evaluations[n].overall}/100`));
      const comments = sp.comments.map((c) => ({ id: uid("cm"), kind: c.kind, text: c.text, attempt: sp.attempt || 1, ...by, at: at(c.day, 12) }));
      sp.comments.forEach((c) => A(c.kind, c.day, c.text.slice(0, 80)));
      const modifications = sp.mods.map((m) => ({ id: uid("md"), ingredient: m.ingredient, change: m.change, from: m.from, to: m.to, reason: m.reason, attempt: sp.attempt || 1, ...by, at: at(m.day, 13) }));
      sp.mods.forEach((m) => A("modification", m.day, `${m.ingredient}: ${m.change}`));

      let finalDecision = null, holdReason = "", nextTrialDate = "";
      if (sp.submitted !== undefined) A("under_review", sp.submitted, "Submitted for review");
      if (sp.decision) {
        A("under_review", sp.decision.day - 1, "Submitted for review");
        A(sp.decision.decision, sp.decision.day, sp.decision.remarks.slice(0, 80), rby, { from: "under_review", to: sp.decision.decision });
        attempts[0].endedAt = at(sp.decision.day);
        attempts[0].outcome = sp.decision.decision;
        attempts[0].reason = sp.decision.decision === "rejected" ? sp.decision.remarks : "";
        attempts[0].recommendations = sp.decision.recommendations || "";
        finalDecision = { decision: sp.decision.decision, remarks: sp.decision.remarks, recommendations: sp.decision.recommendations || "", ...rby, at: at(sp.decision.day) };
      }
      if (sp.retest) {
        A("under_review", sp.retest.day - 1, "Submitted for review");
        A("retest", sp.retest.day, sp.retest.reason, rby, { from: "under_review", to: "in_progress" });
        attempts[0].endedAt = at(sp.retest.day); attempts[0].outcome = "retest"; attempts[0].reason = sp.retest.reason; attempts[0].recommendations = sp.retest.recommendations;
        attempts.push({ attempt: 2, startedAt: at(sp.retest.day), endedAt: null, outcome: "", reason: "", recommendations: "" });
        nextTrialDate = dstr(sp.next);
      }
      if (sp.hold) { holdReason = sp.hold; A("on_hold", -4, sp.hold, rby, { from: "in_progress", to: "on_hold" }); }
      act.sort((a, b) => a.at - b.at);

      seq += 1;
      const doc = {
        id: uid("td"), seq, trialId: `TD-${String(seq).padStart(4, "0")}`, venueId: venue.id,
        name: sp.name, image: sp.img, description: sp.description, category: sp.category,
        ingredients: sp.ingredients.map(([name, quantity, unit]) => ({ name, quantity, unit })),
        preparationMethod: sp.method, assignedStaffId: chef.id, assignedStaffName: chef.name,
        estimatedCost: sp.cost, sellingPrice: sp.price, trialStartDate: dstr(sp.start), expectedCompletion: dstr(sp.due),
        priority: sp.priority, remarks: sp.remarks, status: sp.status, progressPct: sp.progress, attempt: sp.attempt || 1, attempts,
        nextTrialDate, holdReason, finalDecision, evaluations, comments, modifications, activity: act,
        createdById: rv.id, createdByName: rv.name, createdAt: at(sp.start - 1, 9), updatedAt: act[act.length - 1].at,
      };
      if (flag("dry-run")) console.log(`[dry-run] ${doc.trialId}  ${doc.status.padEnd(12)} ${doc.name} → ${chef.name}`);
      else { await Trial.create(doc); added++; console.log(`added: ${doc.trialId}  ${doc.status.padEnd(12)} ${doc.name} → ${chef.name}`); }
    }
    console.log(flag("dry-run") ? "Dry run complete." : `Done — ${added} trial dish(es) added to ${venue.name}.`);
  });
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
