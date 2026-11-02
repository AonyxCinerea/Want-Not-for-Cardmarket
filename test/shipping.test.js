const test = require("node:test");
const assert = require("node:assert");
const S = require("../src/optimizer/shipping.js");
const methods = S.parseMethods(require("./fixtures/optimizer/shipping-be-de.json"));

test("shipping URL uses Cardmarket country ids", () => {
  assert.equal(S.shippingUrl("Belgium", "Germany"), "https://help.cardmarket.com/api/shippingCosts?locale=en&fromCountry=2&toCountry=7&preview=false");
  assert.equal(S.shippingUrl("Atlantis", "Germany"), null);
});

test("parses methods, drops virtual and courier estimates", () => {
  assert.equal(methods.length, 6);
  assert.deepEqual(methods[0], { name: "Priority Letter", tracked: false, letter: true, maxValue: 25, maxWeight: 50, price: 3.37 });
});

test("cheapest method follows weight and the tracked threshold", () => {
  assert.equal(S.cheapestMethod(methods, { cards: 3, value: 5 }).price, 3.37); // letter
  assert.equal(S.cheapestMethod(methods, { cards: 30, value: 20 }).price, 9.71); // 100 g letter
  assert.equal(S.cheapestMethod(methods, { cards: 3, value: 30 }).price, 22.65); // > 25 € must be tracked
});
