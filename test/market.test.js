const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const M = require("../src/optimizer/market.js");

const load = (f) => new JSDOM(fs.readFileSync(path.join(__dirname, "fixtures/optimizer", f), "utf8")).window.document;

test("parseEuro handles German number format", () => {
  assert.equal(M.parseEuro("1,99 €"), 1.99);
  assert.equal(M.parseEuro("2.500,00 €"), 2500);
  assert.equal(M.parseEuro(""), null);
});

test("wizard result: totals, sellers and articles", () => {
  const r = M.parseWizardResult(load("wizard-result.html"));
  assert.equal(r.articlesValue, 17.47);
  assert.equal(r.shipping, 13.5);
  assert.equal(r.shipments, 9);
  assert.equal(r.total, 30.97);
  assert.equal(r.sellers.length, 9);
  const articles = r.sellers.flatMap((s) => s.articles);
  assert.equal(articles.length, 15);
  assert.ok(articles.every((a) => /^\d+$/.test(a.idArticle) && a.price > 0 && a.name));
  // per-seller sums match the summary
  const sum = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  assert.equal(sum(r.sellers.map((s) => s.shipping)), 13.5);
  assert.equal(sum(articles.map((a) => a.price * a.amount)), 17.47);
  const first = r.sellers[0];
  assert.equal(first.seller.rating, "Outstanding");
  assert.equal(first.seller.country, "Germany");
  assert.equal(first.seller.type, "Powerseller");
  assert.equal(first.shipping, 1.2);
  assert.equal(first.idCalculation, "TEST_CALC");
});

test("sellers with the most cards", () => {
  const s = M.parseSellersWithMostCards(load("sellers-most-cards.html"));
  assert.equal(s.length, 20);
  assert.ok(s.every((x) => x.name && x.offersUrl && x.idSeller && x.country && x.rating));
  assert.equal(s[0].wantedCount, 15);
  assert.equal(s[0].country, "Belgium");
  assert.equal(s[0].sales, 116603);
  assert.match(s[0].offersUrl, /\/Offers\/Singles\?idWantslist=11111111$/);
});

test("seller offers filtered by wants list", () => {
  const r = M.parseSellerOffers(load("seller-offers.html"));
  assert.equal(r.country, "Belgium");
  assert.equal(r.page, 1);
  assert.equal(r.pages, 3);
  assert.match(r.nextUrl, /site=2$/);
  assert.equal(r.offers.length, 6);
  const lambholt = r.offers.find((o) => o.idArticle === "664707273");
  assert.deepEqual(
    { name: lambholt.name, idProduct: lambholt.idProduct, expansion: lambholt.expansion, condition: lambholt.condition, language: lambholt.language, price: lambholt.price, available: lambholt.available, foil: lambholt.foil },
    { name: "Champion of Lambholt", idProduct: "254423", expansion: "Avacyn Restored", condition: "NM", language: "English", price: 4.59, available: 4, foil: false }
  );
  assert.ok(r.offers.every((o) => o.idProduct && o.price > 0 && o.condition && o.language));
});

test("rating rank orders reputation", () => {
  assert.ok(M.ratingRank("Outstanding") < M.ratingRank("Average"));
  assert.ok(M.ratingRank("Average") < M.ratingRank("Bad"));
  assert.equal(M.ratingRank(undefined), M.RATINGS.length);
});
