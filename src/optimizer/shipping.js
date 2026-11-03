// Shipping cost model based on Cardmarket's public shipping table
// (help.cardmarket.com/api/shippingCosts?fromCountry=<id>&toCountry=<id>).
(function (root) {
  const COUNTRY_IDS = {
    Austria: 1, Belgium: 2, Bulgaria: 3, Switzerland: 4, Cyprus: 5, "Czech Republic": 6, Germany: 7, Denmark: 8,
    Estonia: 9, Spain: 10, Finland: 11, France: 12, "United Kingdom": 13, Greece: 14, Hungary: 15, Ireland: 16,
    Italy: 17, Liechtenstein: 18, Lithuania: 19, Luxembourg: 20, Latvia: 21, Malta: 22, Netherlands: 23, Norway: 24,
    Poland: 25, Portugal: 26, Romania: 27, Sweden: 28, Singapore: 29, Slovenia: 30, Slovakia: 31, Croatia: 35,
    Japan: 36, Iceland: 37,
  };

  // Above this order value Cardmarket requires a tracked shipping method.
  const TRACKED_ABOVE = 25;

  const euro = (s) => Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));

  function shippingUrl(fromCountry, toCountry) {
    const from = COUNTRY_IDS[fromCountry];
    const to = COUNTRY_IDS[toCountry];
    if (!from || !to) return null;
    return `https://help.cardmarket.com/api/shippingCosts?locale=en&fromCountry=${from}&toCountry=${to}&preview=false`;
  }

  // API response -> usable methods (drops virtual delivery and courier estimates)
  function parseMethods(json) {
    return (json || [])
      .filter((m) => !m.isVirtual && !/ESTIMATION/i.test(m.name))
      .map((m) => ({
        name: m.name,
        tracked: !!m.isTracked,
        letter: !!m.isLetter,
        maxValue: euro(m.maxValue),
        maxWeight: Number(m.maxWeight),
        price: euro(m.price),
      }))
      .sort((a, b) => a.price - b.price);
  }

  // Weight classes from Cardmarket's help page: 4 cards <= 20 g, 17 <= 50 g, 40 <= 100 g.
  function estimateWeight(cards) {
    if (cards <= 4) return 20;
    if (cards <= 17) return 50;
    if (cards <= 40) return 100;
    return Math.ceil(cards * 2.5) + 50; // beyond a letter: rough parcel estimate
  }

  // Cheapest method for a shipment, or null if none fits.
  function cheapestMethod(methods, { cards, value }) {
    const weight = estimateWeight(cards);
    const mustTrack = value > TRACKED_ABOVE;
    return (
      methods.find((m) => m.maxWeight >= weight && m.maxValue >= value && (!mustTrack || m.tracked)) || null
    );
  }

  const api = { COUNTRY_IDS, TRACKED_ABOVE, shippingUrl, parseMethods, estimateWeight, cheapestMethod };
  if (typeof module !== "undefined") module.exports = api;
  else root.WantNotShipping = api;
})(this);
