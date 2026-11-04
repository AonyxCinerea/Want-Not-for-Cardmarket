// Optimizer model: which offers can fill which wants, shipping tiers per seller,
// the MILP (CPLEX LP format, solved by HiGHS) and decoding of the solution into a plan.
(function (root) {
  const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"];
  const TRACKED_ABOVE = 25; // Cardmarket: shipments worth more than this must be tracked
  // Cardmarket: "You may not add more than 8 items of the same product to your cart from different sellers".
  // More than 8 copies of one product are only possible from a single seller.
  const MAX_SAME_PRODUCT_MULTI_SELLER = 8;

  const normName = (n) => String(n || "").replace(/\s*\(V\.\d+\)\s*$/, "").trim().toLowerCase();

  function offerFits(want, offer) {
    if (normName(offer.name) !== normName(want.name)) return false;
    if (want.expansions?.length && !want.expansions.includes(offer.expansion)) return false;
    if (want.languages?.length && offer.language && !want.languages.includes(offer.language)) return false;
    if (want.minCondition && CONDITIONS.includes(offer.condition) && CONDITIONS.indexOf(offer.condition) > CONDITIONS.indexOf(want.minCondition)) return false;
    for (const k of ["foil", "signed", "altered"]) {
      if (want[k] === "Yes" && !offer[k]) return false;
      if (want[k] === "No" && offer[k]) return false;
    }
    return true;
  }

  // Cards per weight class (Cardmarket help: 4 cards <= 20 g, 17 <= 50 g, 40 <= 100 g; beyond: ~2.5 g/card + 50 g packing)
  function cardsForWeight(grams, letter) {
    if (letter) return grams >= 100 ? 40 : grams >= 50 ? 17 : grams >= 20 ? 4 : 0;
    return Math.max(0, Math.floor((grams - 50) / 2.5));
  }

  // Shipping methods -> tiers {maxCards, maxValue, tracked, price, name}; drops dominated tiers.
  function shippingTiers(methods, { trackedOnly = false } = {}) {
    const tiers = (methods || [])
      .filter((m) => !trackedOnly || m.tracked)
      .map((m) => ({
        name: m.name,
        tracked: !!m.tracked,
        price: m.price,
        maxCards: cardsForWeight(m.maxWeight, m.letter),
        maxValue: m.tracked ? m.maxValue : Math.min(m.maxValue, TRACKED_ABOVE),
      }))
      .filter((t) => t.maxCards > 0 && t.price >= 0);
    // keep a tier only if no cheaper-or-equal tier covers at least as many cards and as much value
    return tiers
      .filter((t, i) => !tiers.some((u, j) => j !== i && u.price <= t.price && u.maxCards >= t.maxCards && u.maxValue >= t.maxValue && (u.price < t.price || j < i)))
      .sort((a, b) => a.price - b.price);
  }

  const RATINGS = ["outstanding", "very good", "good", "average", "bad"];

  /**
   * data: collected data (wants, sellers{name:{country, info, offers}}, shipping{country: methods}, wizard)
   * returns { wants, sellers:[{name, country, tiers, trackedOnly}], offers:[{...offer, seller, wantIdx:[...]}], missing:[want], excluded:[{name, reason}] }
   */
  function buildProblem(data, { excludeRatings = ["bad"] } = {}) {
    const wants = data.wants.map((w) => ({ ...w, amount: Number(w.amount) || 1 }));
    const sellers = [];
    const offers = [];
    const excluded = [];
    const seenArticles = new Set();

    const add = (sellerIdx, offer) => {
      if (seenArticles.has(offer.idArticle) || !(offer.price > 0)) return;
      const wantIdx = wants.map((w, i) => (offerFits(w, offer) ? i : -1)).filter((i) => i >= 0);
      if (!wantIdx.length) return;
      seenArticles.add(offer.idArticle);
      offers.push({ ...offer, seller: sellerIdx, wantIdx });
    };

    for (const [name, s] of Object.entries(data.sellers || {})) {
      const rating = (s.info?.rating || "").toLowerCase();
      if (excludeRatings.includes(rating)) { excluded.push({ name, reason: `rating ${s.info.rating}` }); continue; }
      const methods = data.shipping?.[s.country];
      if (!methods) { excluded.push({ name, reason: `no shipping prices for ${s.country || "unknown country"}` }); continue; }
      const trackedOnly = (s.offers || []).some((o) => o.trackedOnly);
      const tiers = shippingTiers(methods, { trackedOnly });
      if (!tiers.length) { excluded.push({ name, reason: "no usable shipping method" }); continue; }
      const idx = sellers.push({ name, country: s.country, tiers, trackedOnly, info: s.info }) - 1;
      for (const o of s.offers || []) add(idx, o);
    }
    // the Wizard's own picks are always candidates (in case an inventory page could not be loaded)
    for (const r of data.wizard?.sellers || []) {
      const idx = sellers.findIndex((s) => s.name === r.seller.name);
      if (idx < 0) continue;
      for (const a of r.articles) add(idx, { idArticle: a.idArticle, name: a.name, price: a.price, available: a.amount, condition: a.condition });
    }
    const missing = wants.filter((_, i) => !offers.some((o) => o.wantIdx.includes(i)));
    return { wants, sellers, offers, missing, excluded };
  }

  const num = (x) => Number(x.toFixed(4)).toString();

  // CPLEX LP text for HiGHS. Variables: x{o}_{w} pieces of offer o for want w, t{s}_{k} tier k used by seller s.
  function buildLp(problem) {
    const { wants, sellers, offers, missing } = problem;
    const obj = [], cons = [], bounds = [], ints = [], bins = [];
    const x = (o, w) => `x${o}_${w}`;
    const t = (s, k) => `t${s}_${k}`;

    offers.forEach((o, oi) => {
      for (const w of o.wantIdx) {
        if (missing.includes(wants[w])) continue;
        obj.push(`${num(o.price)} ${x(oi, w)}`);
        bounds.push(`0 <= ${x(oi, w)} <= ${o.available}`);
        ints.push(x(oi, w));
      }
    });
    sellers.forEach((s, si) => {
      const own = offers.map((o, oi) => [o, oi]).filter(([o]) => o.seller === si);
      const xs = own.flatMap(([o, oi]) => o.wantIdx.filter((w) => !missing.includes(wants[w])).map((w) => [o, x(oi, w)]));
      if (!xs.length) return;
      s.tiers.forEach((tier, k) => { obj.push(`${num(tier.price)} ${t(si, k)}`); bins.push(t(si, k)); });
      const tierSum = (f) => s.tiers.map((tier, k) => `${num(f(tier))} ${t(si, k)}`).join(" - ");
      cons.push(`one${si}: ${s.tiers.map((_, k) => t(si, k)).join(" + ")} <= 1`);
      cons.push(`cards${si}: ${xs.map(([, v]) => v).join(" + ")} - ${tierSum((tier) => tier.maxCards)} <= 0`);
      cons.push(`value${si}: ${xs.map(([o, v]) => `${num(o.price)} ${v}`).join(" + ")} - ${tierSum((tier) => tier.maxValue)} <= 0`);
    });
    offers.forEach((o, oi) => {
      const vs = o.wantIdx.filter((w) => !missing.includes(wants[w])).map((w) => x(oi, w));
      if (vs.length > 1) cons.push(`stock${oi}: ${vs.join(" + ")} <= ${o.available}`);
    });
    // same-product limit (see MAX_SAME_PRODUCT_MULTI_SELLER)
    const products = new Map();
    offers.forEach((o, oi) => {
      if (!o.idProduct) return;
      const vs = o.wantIdx.filter((w) => !missing.includes(wants[w])).map((w) => x(oi, w));
      if (!vs.length) return;
      if (!products.has(o.idProduct)) products.set(o.idProduct, new Map());
      const bySeller = products.get(o.idProduct);
      if (!bySeller.has(o.seller)) bySeller.set(o.seller, { vars: [], cap: 0 });
      const e = bySeller.get(o.seller);
      e.vars.push(...vs);
      e.cap += o.available;
    });
    let pi = 0;
    for (const [, bySeller] of products) {
      const total = [...bySeller.values()].reduce((a, e) => a + e.cap, 0);
      if (bySeller.size < 2 || total <= MAX_SAME_PRODUCT_MULTI_SELLER) continue;
      const single = `single${pi}`;
      bins.push(single);
      const ys = [];
      [...bySeller.values()].forEach((e, k) => {
        const y = `uses${pi}_${k}`;
        bins.push(y);
        ys.push(y);
        cons.push(`prodseller${pi}_${k}: ${e.vars.join(" + ")} - ${e.cap} ${y} <= 0`);
      });
      // single = 1: at most one seller for this product; single = 0: at most 8 copies in total
      cons.push(`prodsingle${pi}: ${ys.join(" + ")} + ${ys.length - 1} ${single} <= ${ys.length}`);
      cons.push(`prodmax${pi}: ${[...bySeller.values()].flatMap((e) => e.vars).join(" + ")} - ${total} ${single} <= ${MAX_SAME_PRODUCT_MULTI_SELLER}`);
      pi++;
    }

    wants.forEach((w, wi) => {
      if (missing.includes(w)) return;
      const vs = offers.map((o, oi) => (o.wantIdx.includes(wi) ? x(oi, wi) : null)).filter(Boolean);
      cons.push(`want${wi}: ${vs.join(" + ")} = ${w.amount}`);
    });
    return [
      "Minimize",
      ` obj: ${obj.join(" + ")}`,
      "Subject To",
      ...cons.map((c) => ` ${c}`),
      "Bounds",
      ...bounds.map((b) => ` ${b}`),
      "General",
      ` ${ints.join(" ")}`,
      "Binary",
      ` ${bins.join(" ")}`,
      "End",
    ].join("\n");
  }

  // columns: { name: value } from HiGHS -> plan grouped by seller
  function decode(problem, columns) {
    const { wants, sellers, offers } = problem;
    const val = (n) => Math.round(columns[n] || 0);
    const bySeller = new Map();
    offers.forEach((o, oi) => {
      for (const w of o.wantIdx) {
        const n = val(`x${oi}_${w}`);
        if (!n) continue;
        if (!bySeller.has(o.seller)) bySeller.set(o.seller, { items: [], value: 0 });
        const e = bySeller.get(o.seller);
        e.items.push({ idArticle: o.idArticle, amount: n, price: o.price, name: o.name, expansion: o.expansion, condition: o.condition, language: o.language, foil: o.foil, want: wants[w].name });
        e.value += n * o.price;
      }
    });
    const shipments = [...bySeller.entries()].map(([si, e]) => {
      const s = sellers[si];
      const k = s.tiers.findIndex((_, k) => val(`t${si}_${k}`));
      const shipping = s.tiers[k] || null;
      const cards = e.items.reduce((a, i) => a + i.amount, 0);
      return { seller: s.name, country: s.country, info: s.info, items: e.items, cards, value: round2(e.value), shipping, total: round2(e.value + (shipping?.price || 0)) };
    });
    shipments.sort((a, b) => b.cards - a.cards || b.total - a.total);
    const value = round2(shipments.reduce((a, s) => a + s.value, 0));
    const shipping = round2(shipments.reduce((a, s) => a + (s.shipping?.price || 0), 0));
    return { shipments, value, shipping, total: round2(value + shipping) };
  }

  const round2 = (x) => Math.round(x * 100) / 100;

  const api = { MAX_SAME_PRODUCT_MULTI_SELLER, CONDITIONS, offerFits, cardsForWeight, shippingTiers, buildProblem, buildLp, decode };
  if (typeof module !== "undefined") module.exports = api;
  else root.WantNotModel = api;
})(this);
