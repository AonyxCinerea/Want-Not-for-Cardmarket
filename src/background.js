// Scryfall price lookup, only used when a card has more than 20 allowed versions.
// Input: Cardmarket product ids of one card. Output: { [idProduct]: eurTrendPrice }.
const api = globalThis.browser ?? globalThis.chrome;
const cache = new Map();
let lastCall = 0;

async function politeFetch(url) {
  const wait = Math.max(0, lastCall + 120 - Date.now()); // Scryfall: max ~10 req/s
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw Object.assign(new Error(`Scryfall ${res.status}`), { status: res.status });
  return res.json();
}

async function pricesForProducts(productIds) {
  const key = [...productIds].sort().join(",");
  if (cache.has(key)) return cache.get(key);

  // Find the card on Scryfall via any of its Cardmarket ids.
  let card = null;
  for (const id of productIds.slice(0, 5)) {
    try {
      card = await politeFetch(`https://api.scryfall.com/cards/cardmarket/${id}`);
      break;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  const out = {};
  let url = card?.prints_search_uri;
  while (url) {
    const page = await politeFetch(url);
    for (const c of page.data) {
      if (c.cardmarket_id == null) continue;
      const p = c.prices?.eur ?? c.prices?.eur_foil;
      out[c.cardmarket_id] = p != null ? Number(p) : null;
    }
    url = page.has_more ? page.next_page : null;
  }
  cache.set(key, out);
  return out;
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "prices") {
    pricesForProducts(msg.productIds)
      .then((prices) => sendResponse({ ok: true, prices }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === "openSettings") {
    api.runtime.openOptionsPage();
  }
});
