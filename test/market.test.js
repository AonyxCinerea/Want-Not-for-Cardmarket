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

test("wants details: amount, expansions, languages, condition, extras", () => {
  const w = M.parseWantsDetails(load("wants-rows.html"));
  assert.equal(w.length, 5);
  const aeth = w.find((x) => x.name === "Aetherize");
  assert.deepEqual(
    { amount: aeth.amount, expansions: aeth.expansions, languages: aeth.languages, minCondition: aeth.minCondition, foil: aeth.foil },
    { amount: 1, expansions: [], languages: ["English"], minCondition: "PL", foil: "Any" }
  );
  const hi = w.find((x) => x.name === "Heroic Intervention");
  assert.ok(hi.expansions.includes("Aether Revolt") && hi.expansions.length >= 10);
  assert.ok(w.every((x) => x.idWant && x.cardUrl));
});

test("wants details ignore the mobile list's checkboxes", () => {
  const html = require("node:fs")
    .readFileSync(require("node:path").join(__dirname, "fixtures/optimizer/wants-rows.html"), "utf8")
    .replace("</main>", '<div id="MobileWantsList"><h3><input type="checkbox" name="mobileCheckWant" data-id-want="abc"></h3></div></main>');
  const w = M.parseWantsDetails(new JSDOM(html).window.document);
  assert.equal(w.length, 5);
});

test("seller offers: language and foil from plain title attributes (fetched HTML)", () => {
  const html = require("node:fs")
    .readFileSync(require("node:path").join(__dirname, "fixtures/optimizer/seller-offers.html"), "utf8")
    // before Bootstrap initialises tooltips, the server HTML only has title=""
    .replace(/ aria-label="([^"]*)" data-bs-original-title="[^"]*"/g, ' title="$1"');
  const r = M.parseSellerOffers(new JSDOM(html).window.document);
  assert.ok(r.offers.every((o) => o.language), "language missing");
  assert.equal(r.offers.find((o) => o.idArticle === "664707273").language, "English");
});

test("sellers table ignores the placeholder shown before the AJAX load", () => {
  const html = '<div id="SellersWithMostWantsWrapper"><table id="DummySellersTable"><tbody><tr><td><span class="seller-info"><a href="/en/Magic/Users/Me">Me</a></span></td></tr></tbody></table></div>';
  assert.equal(M.parseSellersWithMostCards(new JSDOM(html).window.document).length, 0);
});

test("seller offers: price next to a tracked-shipping-only icon", () => {
  // trimmed from a real professional seller row (server HTML, tooltips not initialised)
  const row = `<div id="stockRow2169194684" class="row g-0 article-row"><div class="col-thumbnail col-icon"><span data-bs-title="&lt;img src=&quot;https://product-images.s3.cardmarket.com/1/FDN/796530/796530.jpg&quot; alt=&quot;Aetherize&quot;&gt;" class="thumbnail-icon icon is-24x24 is-magic"></span></div><div class="col-sellerProductInfo col"><div class="col-seller"><a href="/en/Magic/Products/Singles/Magic-The-Gathering-Foundations/Aetherize">Aetherize</a></div><div class="product-attributes col"><a href="/en/Magic/Expansions/Magic-The-Gathering-Foundations" title="Magic: The Gathering Foundations" class="expansion-symbol is-magic icon"></a><a href="https://help.cardmarket.com/en/CardCondition" title="Near Mint" class="article-condition condition-nm me-1"><span class="badge ">NM</span></a><span title="English" class="icon me-2"></span><span title="Foil" class="icon mr-1"></span></div></div><div class="col-offer col-auto"><div class="price-container d-none d-md-flex justify-content-end"><div class="d-flex flex-column"><div class="d-flex align-items-center justify-content-end"><span title="Only &lt;strong&gt;tracked shipping&lt;/strong&gt; to Germany." class="fonticon-check-circle extra-small color-primary me-2 me-md-1"></span><span class="color-primary small text-end text-nowrap fw-bold ">0,94 €</span></div></div></div><div class="amount-container"><span class="item-count small text-end">1</span></div></div></div>`;
  const [o] = M.parseSellerOffers(new JSDOM(`<main>${row}</main>`).window.document).offers;
  assert.deepEqual(
    { price: o.price, trackedOnly: o.trackedOnly, foil: o.foil, language: o.language, expansion: o.expansion, idProduct: o.idProduct },
    { price: 0.94, trackedOnly: true, foil: true, language: "English", expansion: "Magic: The Gathering Foundations", idProduct: "796530" }
  );
});

test("shopping cart totals from the per-seller data attributes", () => {
  const html = `<main>
    <section><h2><a href="/en/Magic/Users/SellerA">SellerA</a></h2><div data-article-count="1" data-item-value="1.99" data-total-price="3.19" data-shipping-price="1.2"></div></section>
    <section><h2><a href="/en/Magic/Users/SellerB">SellerB</a></h2><div data-article-count="3" data-item-value="5.05" data-total-price="6.8" data-shipping-price="1.75"></div></section>
  </main>`;
  const c = M.parseCart(new JSDOM(html).window.document);
  assert.deepEqual(c.shipments.map((s) => [s.seller, s.articles]), [["SellerA", 1], ["SellerB", 3]]);
  assert.deepEqual([c.articles, c.value, c.shipping, c.total], [4, 7.04, 2.95, 9.99]);
});

test("shopping cart: summaries rendered twice (desktop + mobile) are counted once", () => {
  const seller = (id, name, n, value, ship) => `
    <div id="seller${id}" data-article-count="${n}" data-item-value="${value}" data-ship-cost="${ship}" data-service-cost="0">
      <h2><a href="/en/Magic/Users/${name}">${name}</a></h2>
      <div class="d-none d-lg-block"><div data-article-count="${n}" data-item-value="${value}" data-total-price="${value + ship}" data-shipping-price="${ship}"></div></div>
      <div class="d-lg-none"><div data-article-count="${n}" data-item-value="${value}" data-total-price="${value + ship}" data-shipping-price="${ship}"></div></div>
    </div>`;
  const c = M.parseCart(new JSDOM(`<main>${seller(1, "SellerA", 1, 1.99, 1.2)}${seller(2, "SellerB", 3, 5.05, 1.75)}</main>`).window.document);
  assert.deepEqual(c.shipments.map((s) => [s.seller, s.articles, s.total]), [["SellerA", 1, 3.19], ["SellerB", 3, 6.8]]);
  assert.equal(c.total, 9.99);
});

test("wizard history: list name, card count, date and result id", () => {
  const h = M.parseWizardHistory(load("wizard-history.html"));
  assert.equal(h.length, 3);
  assert.deepEqual(
    { id: h[0].id, listName: h[0].listName, cards: h[0].cards },
    { id: "2026-11-993144655-6ae9e7dd444fd", listName: "Test List", cards: 15 }
  );
  assert.equal(new Date(h[2].date).getDate(), 2);
});

test("wants list name from the page title", () => {
  const doc = new JSDOM('<main><div class="page-title-container"><div><h1>Explorers Upgrade 100</h1></div></div></main>').window.document;
  assert.equal(M.parseWantsListName(doc), "Explorers Upgrade 100");
});
