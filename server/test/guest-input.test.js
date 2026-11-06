const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanBellPayload, sanitizeOrderIngredients, MAX_INGREDIENT_GRAMS_PER_PORTION, MAX_INGREDIENTS_PER_ITEM } = require("../src/core/guestInput");

test("bell payload: only short plain table numbers survive", () => {
  assert.deepEqual(cleanBellPayload({ tableNo: 7 }), { tableNo: "7", venueId: null });
  assert.deepEqual(cleanBellPayload({ tableNo: " T-12 ", venueId: "v1" }), { tableNo: "T-12", venueId: "v1" });
  assert.equal(cleanBellPayload({ tableNo: { $ne: 1 } }), null, "objects are never re-broadcast");
  assert.equal(cleanBellPayload({ tableNo: ["1"] }), null);
  assert.equal(cleanBellPayload({ tableNo: "a|b" }), null, "pipe would corrupt the bell key");
  assert.equal(cleanBellPayload({ tableNo: "x".repeat(21) }), null);
  assert.equal(cleanBellPayload({ tableNo: "  " }), null);
  assert.equal(cleanBellPayload(null), null);
  assert.equal(cleanBellPayload("5"), null);
  assert.equal(cleanBellPayload({ tableNo: 1, venueId: { a: 1 } }).venueId, null);
  assert.equal(cleanBellPayload({ tableNo: 1, venueId: "a|b" }).venueId, null);
});

test("order ingredients: bounded, typed, positive", () => {
  assert.deepEqual(sanitizeOrderIngredients("nope"), []);
  assert.deepEqual(sanitizeOrderIngredients(undefined), []);
  const out = sanitizeOrderIngredients([
    { name: "Flour", quantity: 120 },
    { name: "Sugar", quantity: 1e12 },
    { name: "Rice", quantity: 50000 },
    { name: "Salt", quantity: -5 },
    { name: "Oil", quantity: "abc" },
    { name: { $gt: "" }, quantity: 3 },
    null,
    { name: "  Milk ", quantity: "250" },
  ]);
  assert.deepEqual(out.map((i) => [i.name, i.quantity]), [["Flour", 120], ["Sugar", MAX_INGREDIENT_GRAMS_PER_PORTION], ["Rice", 50000], ["Milk", 250]]);
  const many = Array.from({ length: 500 }, (_, i) => ({ name: `i${i}`, quantity: 1 }));
  assert.equal(sanitizeOrderIngredients(many).length, MAX_INGREDIENTS_PER_ITEM);
});
