// Scryfall price lookup, only used when a card has more than 20 allowed versions.
// Input: Cardmarket product ids of one card. Output: { [idProduct]: eurTrendPrice }.
// Chrome runs this as a service worker (one file); Firefox loads these via manifest "scripts".
if (typeof importScripts === "function") {
  if (typeof WantNotShipping === "undefined") importScripts("optimizer/shipping.js");
  if (typeof Module === "undefined") importScripts("../vendor/highs/highs.js");
}

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
  if (msg?.type === "shippingCosts") {
    shippingCosts(msg.from, msg.to)
      .then((methods) => sendResponse({ ok: true, methods }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg?.type === "solve") {
    solve(msg.lp)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg?.type === "shippingAccess") {
    api.permissions
      .contains(SHIPPING_ORIGIN)
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg?.type === "openSettings") {
    api.runtime.openOptionsPage();
  }
});

// Public shipping table from Cardmarket's help site (optional permission, granted in the settings).
const SHIPPING_ORIGIN = { origins: ["https://help.cardmarket.com/*"] };
const shippingCache = new Map();

async function shippingCosts(from, to) {
  const url = WantNotShipping.shippingUrl(from, to);
  if (!url) throw new Error(`Unknown country: ${from} → ${to}`);
  if (!(await api.permissions.contains(SHIPPING_ORIGIN))) {
    throw new Error("No access to help.cardmarket.com. Allow it in the Want-Not settings (Optimizer section).");
  }
  if (shippingCache.has(url)) return shippingCache.get(url);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Shipping table HTTP ${res.status}`);
  const methods = WantNotShipping.parseMethods(await res.json());
  shippingCache.set(url, methods);
  return methods;
}

// HiGHS MILP solver (WebAssembly, vendor/highs). Loaded on first use.
const HighsFactory = globalThis.Module;
let highsPromise = null;

async function solve(lp) {
  highsPromise ||= HighsFactory({ locateFile: (file) => api.runtime.getURL(`vendor/highs/${file}`) });
  let highs;
  try {
    highs = await highsPromise;
    const r = highs.solve(lp, { time_limit: 30, mip_rel_gap: 0.0005, output_flag: false });
    const columns = Object.fromEntries(Object.entries(r.Columns || {}).map(([k, v]) => [k, v.Primal]));
    const usable = r.Status === "Optimal" || (r.Status === "Time limit reached" && Object.keys(columns).length);
    if (!usable) throw new Error(`Solver: ${r.Status}`);
    return { status: r.Status, objective: r.ObjectiveValue, columns };
  } catch (e) {
    highsPromise = null; // a crashed WASM instance is not reused
    throw e;
  }
}
