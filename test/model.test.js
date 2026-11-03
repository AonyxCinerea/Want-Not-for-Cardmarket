const test = require("node:test");
const assert = require("node:assert");
const Model = require("../src/optimizer/model.js");

const letterDE = [
  { name: "Standardbrief", tracked: false, letter: true, maxValue: 25, maxWeight: 20, price: 1.25 },
  { name: "Kompaktbrief", tracked: false, letter: true, maxValue: 25, maxWeight: 50, price: 1.4 },
  { name: "Kompaktbrief + Einschreiben", tracked: true, letter: true, maxValue: 100, maxWeight: 50, price: 3.95 },
];

const want = (name, extra = {}) => ({ idWant: name, name, amount: 1, expansions: [], languages: ["English"], minCondition: "LP", foil: "Any", signed: "Any", altered: "Any", ...extra });
const offer = (id, name, price, extra = {}) => ({ idArticle: id, name, price, available: 1, expansion: "Set", condition: "NM", language: "English", foil: false, signed: false, altered: false, ...extra });

test("offerFits: name variants, expansions, language, condition, foil", () => {
  const w = want("Sol Ring", { expansions: ["Commander"] });
  assert.ok(Model.offerFits(w, offer("1", "Sol Ring (V.2)", 1, { expansion: "Commander" })));
  assert.ok(!Model.offerFits(w, offer("1", "Sol Ring", 1, { expansion: "Marvel" })));
  assert.ok(!Model.offerFits(want("X"), offer("1", "X", 1, { language: "German" })));
  assert.ok(!Model.offerFits(want("X"), offer("1", "X", 1, { condition: "PL" }))); // worse than LP
  assert.ok(Model.offerFits(want("X"), offer("1", "X", 1, { condition: "LP" })));
  assert.ok(!Model.offerFits(want("X", { foil: "No" }), offer("1", "X", 1, { foil: true })));
});

test("shipping tiers: card capacity, 25 € rule, tracked-only sellers", () => {
  const tiers = Model.shippingTiers(letterDE);
  assert.deepEqual(tiers.map((t) => [t.maxCards, t.maxValue, t.price]), [[4, 25, 1.25], [17, 25, 1.4], [17, 100, 3.95]]);
  const tracked = Model.shippingTiers(letterDE, { trackedOnly: true });
  assert.deepEqual(tracked.map((t) => t.price), [3.95]);
});

test("buildProblem: matches offers, reports missing wants and excluded sellers", () => {
  const data = {
    wants: [want("A"), want("B"), want("C")],
    shipping: { Germany: letterDE },
    sellers: {
      s1: { country: "Germany", info: { rating: "Outstanding" }, offers: [offer("1", "A", 1), offer("2", "B", 2), offer("3", "B", 0)] },
      s2: { country: "Atlantis", info: { rating: "Outstanding" }, offers: [offer("4", "C", 1)] },
      s3: { country: "Germany", info: { rating: "Bad" }, offers: [offer("5", "C", 1)] },
    },
    wizard: { sellers: [] },
  };
  const p = Model.buildProblem(data);
  assert.deepEqual(p.offers.map((o) => o.idArticle), ["1", "2"]); // price 0 dropped
  assert.deepEqual(p.missing.map((w) => w.name), ["C"]);
  assert.deepEqual(p.excluded.map((x) => x.name).sort(), ["s2", "s3"]);
  const lp = Model.buildLp(p);
  assert.match(lp, /^Minimize/);
  assert.match(lp, /want0: x0_0 = 1/);
  assert.ok(!/want2/.test(lp), "missing want must not be constrained");
});

// End-to-end with the real solver when it is installed (npm install).
let highsFactory = null;
try { highsFactory = require("highs"); } catch {}

test("solver: consolidating beats the cheapest card per seller", { skip: !highsFactory && "highs not installed" }, async () => {
  const highs = await highsFactory();
  // A: 1.00 at s1 or 0.80 at s2; B only at s1 (1.00). Cheapest cards = 1.80 + 2 letters (2.50) = 4.30,
  // all at s1 = 2.00 + 1 letter (1.25) = 3.25
  const data = {
    wants: [want("A"), want("B")],
    shipping: { Germany: letterDE },
    sellers: {
      s1: { country: "Germany", info: { rating: "Outstanding" }, offers: [offer("1", "A", 1), offer("2", "B", 1)] },
      s2: { country: "Germany", info: { rating: "Outstanding" }, offers: [offer("3", "A", 0.8)] },
    },
    wizard: { sellers: [] },
  };
  const p = Model.buildProblem(data);
  const r = highs.solve(Model.buildLp(p));
  assert.equal(r.Status, "Optimal");
  const plan = Model.decode(p, Object.fromEntries(Object.entries(r.Columns).map(([k, v]) => [k, v.Primal])));
  assert.equal(plan.total, 3.25);
  assert.deepEqual(plan.shipments.map((s) => s.seller), ["s1"]);
  assert.equal(plan.shipments[0].shipping.name, "Standardbrief");
});

test("solver: more than 25 € forces tracked shipping", { skip: !highsFactory && "highs not installed" }, async () => {
  const highs = await highsFactory();
  const data = {
    wants: [want("A"), want("B")],
    shipping: { Germany: letterDE },
    sellers: { s1: { country: "Germany", info: {}, offers: [offer("1", "A", 20), offer("2", "B", 10)] } },
    wizard: { sellers: [] },
  };
  const p = Model.buildProblem(data);
  const r = highs.solve(Model.buildLp(p));
  const plan = Model.decode(p, Object.fromEntries(Object.entries(r.Columns).map(([k, v]) => [k, v.Primal])));
  assert.equal(plan.shipping, 3.95);
  assert.equal(plan.total, 33.95);
});
