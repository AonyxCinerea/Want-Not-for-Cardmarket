// Parsers for Cardmarket market pages used by the optimizer.
// All functions take a Document (DOMParser in the browser, jsdom in tests).
(function (root) {
  // "1.234,56 €" -> 1234.56
  function parseEuro(text) {
    if (text == null) return null;
    const m = String(text).replace(/\s/g, "").match(/-?[\d.]+(,\d+)?/);
    if (!m) return null;
    return Number(m[0].replace(/\./g, "").replace(",", "."));
  }

  // Bootstrap moves "title" to data-bs-original-title once tooltips are initialised.
  const tip = (el) =>
    el ? el.getAttribute("data-bs-original-title") || el.getAttribute("title") || el.getAttribute("aria-label") || "" : "";

  const RATINGS = ["outstanding", "very good", "good", "average", "bad"];

  // Lower is better; unknown ratings sort last.
  function ratingRank(rating) {
    const i = RATINGS.indexOf((rating || "").toLowerCase());
    return i === -1 ? RATINGS.length : i;
  }

  // Shared ".seller-info" block (wizard results, seller lists, product pages).
  function parseSellerInfo(el) {
    if (!el) return null;
    const link = el.querySelector('a[href*="/Users/"]');
    const ratingEl = el.querySelector('[class*="fonticon-seller-rating-"]');
    const salesTitle = tip(el.querySelector(".sell-count"));
    const locationEl = el.querySelector('[aria-label^="Item location:"], [data-bs-original-title^="Item location:"], [title^="Item location:"]');
    const typeEl = el.querySelector('[class*="fonticon-users-"]');
    const days = el.querySelector(".shippingTime-info");
    return {
      name: link ? link.textContent.trim() : null,
      url: link ? link.getAttribute("href") : null,
      rating: ratingEl ? tip(ratingEl).trim() : null,
      sales: salesTitle ? Number((salesTitle.match(/(\d+)\s*(?:&nbsp;| |\s)*Sales/) || [])[1]) || null : null,
      country: locationEl ? tip(locationEl).replace(/^Item location:\s*/, "").trim() : null,
      type: typeEl ? tip(typeEl).trim() : null,
      deliveryDays: days ? Number(days.textContent.trim()) || null : null,
    };
  }

  // "Sellers with the Most Cards" on a wants list page (professional sellers only).
  function parseSellersWithMostCards(doc) {
    const rows = doc.querySelectorAll("#SellersWithMostWantsWrapper tbody tr");
    return [...rows]
      .filter((tr) => tr.querySelector('a[href*="/Offers/Singles?idWantslist="]') && !tr.closest("#DummySellersTable"))
      .map((tr) => {
      const offersLink = tr.querySelector('a[href*="/Offers/Singles?idWantslist="]');
      return {
        ...parseSellerInfo(tr.querySelector(".seller-info") || tr),
        idSeller: tr.querySelector('input[name="idSeller"]')?.getAttribute("value") || null,
        offersUrl: offersLink ? offersLink.getAttribute("href") : null,
        wantedCount: offersLink ? Number(offersLink.textContent.trim()) : null,
      };
    });
  }

  function dlValue(dl, label) {
    for (const dt of dl.querySelectorAll("dt")) {
      if (dt.textContent.trim() === label) return dt.nextElementSibling?.textContent.trim() ?? null;
    }
    return null;
  }

  // Shopping Wizard result page.
  function parseWizardResult(doc) {
    const summaryDl = doc.querySelector("section dl");
    const sellers = [...doc.querySelectorAll(".detailed-result-card")].map((card) => {
      const dl = card.querySelector("dl");
      const articles = [...card.querySelectorAll("table tbody tr")].map((tr) => {
        const tds = tr.querySelectorAll("td");
        return {
          idArticle: tr.querySelector("[data-id-article]")?.getAttribute("data-id-article"),
          amount: Number(tds[2]?.textContent.trim()) || 1,
          name: tds[3]?.textContent.trim(),
          condition: tr.querySelector(".article-condition .badge, .badge")?.textContent.trim() || null,
          price: parseEuro(tds[tds.length - 1]?.textContent),
        };
      });
      return {
        seller: parseSellerInfo(card.querySelector(".seller-info")),
        idCalculation: card.querySelector('input[name="idCalculation"]')?.getAttribute("value") || null,
        articles,
        articlesValue: dl ? parseEuro(dlValue(dl, "Articles Value")) : null,
        shipping: dl ? parseEuro(dlValue(dl, "Shipping Cost")) : null,
        total: dl ? parseEuro(dlValue(dl, "Total")) : null,
      };
    });
    return {
      articlesValue: summaryDl ? parseEuro(dlValue(summaryDl, "Articles Value")) : null,
      shipping: summaryDl ? parseEuro(dlValue(summaryDl, "Shipping Cost")) : null,
      shipments: summaryDl ? Number(dlValue(summaryDl, "Shipments")) || null : null,
      total: summaryDl ? parseEuro(dlValue(summaryDl, "Total")) : null,
      sellers,
    };
  }

  // A seller's offers filtered by a wants list: /Users/<name>/Offers/Singles?idWantslist=<id>[&site=N]
  function parseSellerOffers(doc) {
    const h1 = doc.querySelector(".page-title-container h1");
    const countryEl = h1?.querySelector("[aria-label], [data-bs-original-title], [title]");
    const pageText = [...doc.querySelectorAll("span")].map((s) => s.textContent).find((t) => /^Page \d+ of \d+$/.test(t.trim()));
    const [, page, pages] = (pageText || "").match(/Page (\d+) of (\d+)/) || [];
    const next = doc.querySelector('a[aria-label="Next page"]:not(.disabled)');

    const offers = [...doc.querySelectorAll('[id^="stockRow"]')].map((row) => {
      const cardLink = row.querySelector(".col-seller a");
      const thumb = row.querySelector(".thumbnail-icon");
      const thumbHtml = thumb?.getAttribute("data-bs-title") || thumb?.getAttribute("title") || "";
      const attrs = row.querySelector(".product-attributes");
      const labels = attrs ? [...attrs.querySelectorAll("[aria-label], [title], [data-bs-original-title]")].map(tip) : [];
      const conditionEl = row.querySelector(".article-condition");
      const langEl = attrs?.querySelector("span.icon[aria-label], span.icon[data-bs-original-title], span.icon[title]");
      // The price is the text that contains "€" (icons like the tracked-shipping check share the same class).
      const priceBox = row.querySelector(".price-container") || row;
      const priceEl = [...priceBox.querySelectorAll("span")].find((e) => /\d.*€/.test(e.textContent) && !e.querySelector("span"));
      const trackedHint = priceBox.querySelector('[title*="tracked shipping"], [data-bs-original-title*="tracked shipping"], [aria-label*="tracked shipping"]');
      return {
        idArticle: row.id.replace("stockRow", ""),
        name: cardLink?.textContent.trim() || null,
        productUrl: cardLink?.getAttribute("href") || null,
        idProduct: (thumbHtml.match(/\/(\d+)\/\d+\.jpg/) || [])[1] || null,
        expansion: tip(row.querySelector("a.expansion-symbol")) || null,
        condition: conditionEl?.querySelector(".badge")?.textContent.trim() || null,
        language: langEl ? tip(langEl) : null,
        foil: labels.includes("Foil"),
        signed: labels.includes("Signed"),
        altered: labels.includes("Altered"),
        price: parseEuro(priceEl?.textContent),
        available: Number(row.querySelector(".item-count")?.textContent.trim()) || 1,
        trackedOnly: !!trackedHint,
      };
    });

    return {
      country: countryEl ? tip(countryEl).trim() : null,
      page: Number(page) || 1,
      pages: Number(pages) || 1,
      nextUrl: next ? next.getAttribute("href") : null,
      offers,
    };
  }


  const hidden = (el) => (el ? [...el.querySelectorAll(".visually-hidden")].map((x) => x.textContent.trim()).filter(Boolean) : []);

  // Wants list rows with the filters the optimizer needs.
  // expansions: [] means "Any"; languages: [] means "Any"; foil/signed/altered: "Any" | "Yes" | "No"
  function parseWantsDetails(doc) {
    // Only table rows: the page also has a mobile list with the same data-id-want checkboxes.
    const rows = [...doc.querySelectorAll("tr input[data-id-want]")].map((cb) => [cb, cb.closest("tr")]);
    return rows.map(([cb, row]) => {
      const cell = (sel) => row.querySelector(sel);
      const ternary = [...row.querySelectorAll("td.ternary-header")].map((td) => hidden(td)[0] || "Any");
      const expansions = hidden(cell("td.expansion")).filter((x) => x !== "Any");
      const languages = hidden(cell("td.languages")).filter((x) => x !== "Any");
      const amountCell = cell("td.amount");
      return {
        idWant: cb.getAttribute("data-id-want"),
        name: cell("td.name a")?.textContent.trim() || null,
        cardUrl: cell("td.name a")?.getAttribute("href") || null,
        amount: Number(amountCell?.getAttribute("data-amount") || amountCell?.textContent.trim()) || 1,
        expansions,
        languages,
        minCondition: cell("td.condition .badge")?.textContent.trim() || null,
        foil: ternary[0] || "Any",
        signed: ternary[1] || "Any",
        altered: ternary[2] || "Any",
        buyPrice: parseEuro(cell("td.buyPrice")?.textContent) || null,
      };
    });
  }


  // Shopping cart page. Each seller has one container (id="seller<id>") with data-* totals;
  // the summary inside it is rendered twice (desktop and mobile), so it must not be counted.
  function parseCart(doc) {
    const n = (el, a) => Number(el.getAttribute(a)) || 0;
    let blocks = [...doc.querySelectorAll('[id^="seller"][data-article-count]')].map((el) => ({
      el,
      articles: n(el, "data-article-count"),
      value: n(el, "data-item-value"),
      shipping: n(el, "data-ship-cost") + n(el, "data-service-cost"),
    }));
    if (!blocks.length) {
      // fallback: summary blocks, de-duplicated per seller container
      const seen = new Set();
      blocks = [...doc.querySelectorAll("[data-total-price]")]
        .filter((el) => {
          const key = el.closest('[id^="seller"], section') || el.parentElement;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((el) => ({ el, articles: n(el, "data-article-count"), value: n(el, "data-item-value"), shipping: n(el, "data-shipping-price") }));
    }
    const r2 = (x) => Math.round(x * 100) / 100;
    const shipments = blocks.map(({ el, articles, value, shipping }) => {
      const link = el.querySelector('a[href*="/Users/"]') || el.closest("section")?.querySelector('a[href*="/Users/"]');
      return { seller: link ? link.textContent.trim() : null, articles, value: r2(value), shipping: r2(shipping), total: r2(value + shipping) };
    });
    const sum = (k) => r2(shipments.reduce((a, s) => a + s[k], 0));
    return { shipments, articles: sum("articles"), value: sum("value"), shipping: sum("shipping"), total: sum("total") };
  }


  // Shopping Wizard results history (/Magic/Wants/ShoppingWizard/Results): earlier runs, newest first.
  function parseWizardHistory(doc) {
    return [...doc.querySelectorAll('a[href*="/ShoppingWizard/Results/"]')]
      .filter((a) => a.querySelector("span"))
      .map((a) => {
        const title = a.querySelector("span").textContent.trim();
        const [, listName, cards] = title.match(/^(.*)\s+\((\d+)\s+\S+\)$/) || [, title, null];
        const [, d, m, y, hh, mm] = (a.querySelector("p")?.textContent || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/) || [];
        return {
          id: a.getAttribute("href").split("/Results/")[1].replace(/[#?].*$/, ""),
          url: a.getAttribute("href"),
          listName: listName.trim(),
          cards: cards ? Number(cards) : null,
          date: d ? new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)).toISOString() : null,
        };
      });
  }

  // Name of a wants list (page title of /Magic/Wants/<id>)
  function parseWantsListName(doc) {
    return (doc.querySelector(".page-title-container h1, main h1")?.firstChild?.textContent || "").trim() || null;
  }

  const api = { parseEuro, ratingRank, RATINGS, parseSellerInfo, parseSellersWithMostCards, parseWizardResult, parseSellerOffers, parseWantsDetails, parseCart, parseWizardHistory, parseWantsListName };
  if (typeof module !== "undefined") module.exports = api;
  else root.WantNotMarket = api;
})(this);
