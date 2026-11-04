// Optimizer on the Shopping Wizard results page: collects the market data, computes the cheapest
// plan including shipping (HiGHS in the background) and can put that plan into the shopping cart.
// Also remembers the last wants list the user opened, because the results page doesn't name it.
(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  const M = WantNotMarket;
  const Model = WantNotModel;
  const path = location.pathname;
  const lang = (path.match(/^\/([a-z]{2})\//) || [])[1] || "en";

  // Remember the wants list (list page or wizard start page with ?idWantsList=)
  const listId = (path.match(/\/Magic\/Wants\/(\d+)\/?$/) || [])[1] || new URLSearchParams(location.search).get("idWantsList");
  if (listId) {
    api.storage.local.set({ lastWantsListId: listId });
    return;
  }
  if (!/\/Magic\/Wants\/ShoppingWizard\/Results(\/|$)/.test(path)) return;

  const pageFetch = typeof content !== "undefined" && content.fetch ? content.fetch.bind(content) : fetch.bind(window);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DELAY_MS = 1500;
  const MAX_PAGES_PER_SELLER = 15;
  let cancelled = false;

  // ---------- UI ----------
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children.filter((c) => c != null));
    return e;
  };
  const btn = (cls, text) => el("button", { type: "button", className: `btn btn-sm ${cls}`, textContent: text });
  const euro = (x) => `${x.toFixed(2).replace(".", ",")} €`;

  const panel = el("section", { id: "want-not-panel" });
  const listInput = el("input", { type: "text", size: 10, className: "form-control form-control-sm d-inline-block w-auto" });
  const optimizeBtn = btn("btn-primary", "Optimize incl. shipping");
  const cancelBtn = btn("btn-outline-secondary", "Cancel");
  const downloadBtn = el("button", { type: "button", className: "btn btn-link btn-sm wn-debug", textContent: "Debug: download data", title: "Saves everything that was loaded, for bug reports" });
  cancelBtn.hidden = true;
  downloadBtn.hidden = true;
  panel.append(
    el(
      "div",
      { className: "wn-head" },
      el("strong", { textContent: "Want-Not optimizer" }),
      el("label", { className: "wn-summary", textContent: "Wants list ID " }, listInput),
      el("span", { className: "wn-spacer" }),
      cancelBtn,
      optimizeBtn
    ),
    el("div", {
      className: "wn-summary",
      textContent:
        "Looks at everything the Wizard's sellers (from this and earlier runs on the same list, plus the sellers with the most cards) have from your list and finds the cheapest combination including shipping. Loading takes a few minutes.",
    })
  );
  const status = el("div", { className: "wn-status" });
  const results = el("div", { className: "wn-plan" });
  panel.append(status, results, downloadBtn);
  // Directly below the page title; fall back to the top of <main>.
  const h1 = document.querySelector("main h1");
  if (h1) h1.after(panel);
  else (document.querySelector("main") || document.body).prepend(panel);
  const setStatus = (t) => (status.textContent = t);

  api.storage.local.get("lastWantsListId").then(({ lastWantsListId }) => {
    if (lastWantsListId) listInput.value = lastWantsListId;
  });

  let lastData = null;
  let busy = false;
  async function run(fn) {
    if (busy) return;
    busy = true;
    cancelled = false;
    panel.querySelectorAll("button").forEach((b) => (b.disabled = b !== cancelBtn));
    cancelBtn.hidden = false;
    try {
      await fn();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      console.error("[Want-Not]", e);
    } finally {
      busy = false;
      panel.querySelectorAll("button").forEach((b) => (b.disabled = b.dataset.off === "1"));
      cancelBtn.hidden = true;
      downloadBtn.hidden = !lastData;
    }
  }
  cancelBtn.onclick = () => (cancelled = true);
  optimizeBtn.onclick = () => run(optimize);
  downloadBtn.onclick = () => lastData && download(lastData);

  function stage(what, fn) {
    try {
      return fn();
    } catch (e) {
      throw new Error(`${what}: ${e.message}`);
    }
  }

  // Cardmarket loads this table with an AJAX action after the page has loaded.
  async function loadSellersWithMostCards(wantsDoc) {
    const direct = M.parseSellersWithMostCards(wantsDoc);
    if (direct.length) return direct;
    const form = wantsDoc.querySelector("#SellersWithMostWantsWrapper form[data-ajax-action]");
    if (!form) throw new Error("loader form not found");
    const html = await ajaxAction(wantsDoc, form, "sellersWithMostWantsContent");
    const doc = new DOMParser().parseFromString(`<div id="SellersWithMostWantsWrapper">${html}</div>`, "text/html");
    const sellers = M.parseSellersWithMostCards(doc);
    if (!sellers.length && !doc.querySelector(".noResults")) throw new Error("no sellers in the AJAX response");
    return sellers;
  }

  // Cardmarket's form-to-AJAX convention: name[key] -> object, name[] -> array, else plain value.
  function formParams(form) {
    const params = {};
    for (const el of form.querySelectorAll("input[name], select[name], textarea[name]")) {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if ((type === "checkbox" || type === "radio") && !el.hasAttribute("checked")) continue;
      const value = el.getAttribute("value") ?? el.textContent ?? "";
      if (value === "") continue;
      const name = el.getAttribute("name");
      const m = name.match(/^(.*)\[(.*)\]$/);
      if (!m) params[name] = value;
      else if (m[2]) (params[m[1]] ||= {})[m[2]] = value;
      else (params[m[1]] ||= []).push(value);
    }
    return params;
  }

  // Mirrors Cardmarket's AjaxRequest: multipart fields (objects as JSON), XML response with base64 values.
  async function ajaxPost(action, params, { timeoutMs = 120000 } = {}) {
    const base = document.querySelector("#ajaxUrl")?.getAttribute("data-url") || `/${lang}/Magic/AjaxAction`;
    const body = new FormData();
    for (const [k, v] of Object.entries(params)) body.append(k, typeof v === "object" ? JSON.stringify(v) : v);
    const url = new URL(`${base}/${action}`, location.href).href;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await pageFetch(url, { method: "POST", body, credentials: "include", signal: ctrl.signal });
    } catch (e) {
      throw new Error(ctrl.signal.aborted ? `no answer from Cardmarket within ${timeoutMs / 1000} s` : e.message);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${action}`);
    const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
    const b64 = (k) => {
      const node = xml.getElementsByTagName(k)[0];
      if (!node) return null;
      const bytes = Uint8Array.from(atob(node.textContent.trim()), (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    };
    const message = [b64("resultsMessage"), b64("systemMessage")].filter(Boolean).join(" ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { b64, code: b64("resultsCode"), message };
  }

  async function ajaxAction(pageDoc, form, key) {
    const action = form.getAttribute("data-ajax-action");
    const r = await ajaxPost(action, formParams(form));
    const value = r.b64(key);
    if (value == null) {
      const why = [r.code, r.message].filter(Boolean).join(" / ");
      throw new Error(`"${key}" missing in the response of ${action}${why ? ` (${why})` : ""}`);
    }
    return value;
  }

  // Cardmarket answers 403/429 when requests come too fast: back off and retry before giving up.
  const BACKOFF_MS = [15000, 45000];
  let blockedInARow = 0;
  const HISTORY_MAX_RUNS = 3;
  const HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  async function loadWizardHistory(wantsDoc) {
    const listName = M.parseWantsListName(wantsDoc);
    if (!listName) return [];
    const currentId = location.pathname.split("/Results/")[1]?.replace(/\/.*$/, "");
    const runs = M.parseWizardHistory(await getDoc(`/${lang}/Magic/Wants/ShoppingWizard/Results`))
      .filter((r) => r.id !== currentId && r.listName === listName)
      .filter((r) => !r.date || Date.now() - new Date(r.date).getTime() < HISTORY_MAX_AGE_MS)
      .slice(0, HISTORY_MAX_RUNS);
    const out = [];
    for (const r of runs) {
      if (cancelled) throw new Error("Cancelled.");
      setStatus(`Reading earlier Wizard run from ${r.date ? new Date(r.date).toLocaleString() : "?"}…`);
      await sleep(DELAY_MS);
      const result = M.parseWizardResult(await getDoc(r.url));
      out.push({ id: r.id, date: r.date, cards: r.cards, total: result.total, shipments: result.shipments, sellers: result.sellers });
    }
    return out;
  }

  async function getDoc(url) {
    for (let attempt = 0; ; attempt++) {
      const res = await pageFetch(new URL(url, location.href).href, { credentials: "include" });
      if (res.ok) {
        blockedInARow = 0;
        return new DOMParser().parseFromString(await res.text(), "text/html");
      }
      if ((res.status === 403 || res.status === 429) && attempt < BACKOFF_MS.length && !cancelled) {
        setStatus(`Cardmarket is rate limiting (HTTP ${res.status}), waiting ${BACKOFF_MS[attempt] / 1000} s…`);
        await sleep(BACKOFF_MS[attempt]);
        continue;
      }
      if (res.status === 403 || res.status === 429) {
        if (++blockedInARow >= 3) {
          cancelled = true;
          throw new Error(`Stopped: Cardmarket keeps refusing requests (HTTP ${res.status}). Try again later.`);
        }
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
  }

  // ---------- collection ----------
  async function collect(wantsListId) {
    if (!/^\d+$/.test(wantsListId)) throw new Error("Enter the ID of the wants list you ran the Wizard on (the number in its URL).");
    const { destinationCountry = "Germany" } = await api.storage.sync.get("destinationCountry");
    const data = {
      format: "want-not-optimizer-data/1",
      collectedAt: new Date().toISOString(),
      destinationCountry,
      wantsListId,
      wizard: stage("reading the Wizard result", () => M.parseWizardResult(document)),
      wants: [],
      sellersWithMostCards: [],
      sellers: {},
      shipping: {},
      errors: [],
    };

    setStatus("Loading wants list…");
    const wantsDoc = await getDoc(`/${lang}/Magic/Wants/${wantsListId}`);
    data.wants = stage("reading the wants list", () => M.parseWantsDetails(wantsDoc));
    setStatus("Loading sellers with the most cards… (Cardmarket can take a minute or two for this)");
    try {
      data.sellersWithMostCards = await loadSellersWithMostCards(wantsDoc);
    } catch (e) {
      data.errors.push(`Sellers with the most cards: ${e.message}`);
    }
    if (!data.wants.length) throw new Error("Wants list is empty or not readable.");

    // Earlier Wizard runs on the same list (e.g. "reduce shipments"): more sellers at no extra Wizard run.
    data.history = [];
    try {
      setStatus("Looking for earlier Wizard runs on this list…");
      data.history = await loadWizardHistory(wantsDoc);
    } catch (e) {
      data.errors.push(`Earlier Wizard runs: ${e.message}`);
    }

    // candidate sellers: Wizard result + earlier runs + sellers with the most cards
    const candidates = new Map();
    for (const s of data.wizard.sellers) candidates.set(s.seller.name, { info: s.seller, sources: ["wizard"] });
    for (const run of data.history) {
      for (const s of run.sellers) {
        const c = candidates.get(s.seller.name);
        if (c) c.sources.includes("history") || c.sources.push("history");
        else candidates.set(s.seller.name, { info: s.seller, sources: ["history"] });
      }
    }
    for (const s of data.sellersWithMostCards) {
      const c = candidates.get(s.name);
      if (c) c.sources.push("mostCards");
      else candidates.set(s.name, { info: s, sources: ["mostCards"] });
    }

    let i = 0;
    for (const [name, c] of candidates) {
      if (cancelled) throw new Error("Cancelled.");
      i++;
      const seller = { ...c, country: c.info.country, offers: [], pages: 0 };
      let url = `/${lang}/Magic/Users/${encodeURIComponent(name)}/Offers/Singles?idWantslist=${wantsListId}`;
      try {
        while (url && seller.pages < MAX_PAGES_PER_SELLER) {
          if (cancelled) throw new Error("Cancelled.");
          setStatus(`Seller ${i}/${candidates.size}: ${name}, page ${seller.pages + 1}`);
          await sleep(DELAY_MS);
          const offersDoc = await getDoc(url);
          const r = M.parseSellerOffers(offersDoc);
          const unpriced = r.offers.find((o) => !(o.price > 0));
          if (unpriced && !seller.debugRowHtml) {
            seller.debugRowHtml = offersDoc.getElementById(`stockRow${unpriced.idArticle}`)?.outerHTML.slice(0, 6000) || null;
          }
          seller.offers.push(...r.offers);
          seller.country ||= r.country;
          seller.pages++;
          url = r.nextUrl;
        }
        seller.truncated = !!url;
      } catch (e) {
        if (cancelled) throw e;
        seller.error = e.message;
        data.errors.push(`${name}: ${e.message}`);
      }
      data.sellers[name] = seller;
    }

    // shipping tables per origin country
    const countries = [...new Set(Object.values(data.sellers).map((s) => s.country).filter(Boolean))];
    for (const country of countries) {
      setStatus(`Shipping prices: ${country} → ${destinationCountry}`);
      const r = await api.runtime.sendMessage({ type: "shippingCosts", from: country, to: destinationCountry });
      if (r?.ok) data.shipping[country] = r.methods;
      else {
        data.shipping[country] = null;
        data.errors.push(`Shipping ${country}: ${r?.error || "no response"}`);
      }
    }

    return data;
  }

  // ---------- optimize ----------
  let plan = null;
  async function optimize() {
    results.replaceChildren();
    plan = null;
    const access = await api.runtime.sendMessage({ type: "shippingAccess" });
    if (!access?.ok) {
      const open = btn("btn-outline-primary", "Open settings");
      open.onclick = () => api.runtime.sendMessage({ type: "openSettings" });
      setStatus("");
      results.replaceChildren(
        el(
          "div",
          { className: "wn-headline" },
          el("span", { textContent: 'The optimizer needs Cardmarket\'s shipping price table. In the settings, click "Allow shipping prices" once, then try again.' }),
          open
        )
      );
      return;
    }
    const data = await collect(listInput.value.trim());
    lastData = data;
    setStatus("Calculating the cheapest combination…");
    const problem = Model.buildProblem(data);
    if (!problem.offers.length) throw new Error("No usable offers found (see Download data for details).");
    const r = await api.runtime.sendMessage({ type: "solve", lp: Model.buildLp(problem) });
    if (!r?.ok) throw new Error(r?.error || "solver did not answer");
    plan = Model.decode(problem, r.columns);
    setStatus("");
    renderPlan(data, problem, plan);
  }

  function renderPlan(data, problem, plan) {
    const wiz = data.wizard;
    const saving = Math.round((wiz.total - plan.total) * 100) / 100;
    const headline =
      saving > 0.009
        ? `${euro(plan.total)} instead of ${euro(wiz.total)}: saves ${euro(saving)} (${Math.round((100 * saving) / wiz.total)} %)`
        : `No cheaper combination found: ${euro(plan.total)} vs. the Wizard's ${euro(wiz.total)}.`;
    const rows = plan.shipments.map((s) =>
      el(
        "tr",
        {},
        el("td", {}, el("a", { href: `/${lang}/Magic/Users/${encodeURIComponent(s.seller)}`, textContent: s.seller, target: "_blank" })),
        el("td", { textContent: s.country || "" }),
        el(
          "td",
          {},
          el(
            "details",
            {},
            el("summary", { textContent: `${s.cards} card${s.cards === 1 ? "" : "s"}` }),
            el(
              "ul",
              { className: "wn-items" },
              ...s.items.map((i) =>
                el("li", { textContent: `${i.amount}× ${i.name} · ${[i.expansion, i.condition, i.language, i.foil ? "Foil" : null].filter(Boolean).join(", ")} · ${euro(i.price)}` })
              )
            )
          )
        ),
        el("td", { className: "text-end", textContent: euro(s.value) }),
        el("td", { className: "text-end", textContent: `${euro(s.shipping?.price || 0)}`, title: s.shipping?.name || "" }),
        el("td", { className: "text-end fw-bold", textContent: euro(s.total) })
      )
    );
    const head = el(
      "tr",
      {},
      ...["Seller", "From", "Cards", "Cards €", "Shipping", "Total"].map((t, i) => el("th", { className: i > 2 ? "text-end" : "", textContent: t }))
    );
    const foot = el(
      "tr",
      {},
      el("th", { colSpan: 3, textContent: `${plan.shipments.length} shipments (Wizard: ${wiz.shipments})` }),
      el("th", { className: "text-end", textContent: euro(plan.value) }),
      el("th", { className: "text-end", textContent: euro(plan.shipping) }),
      el("th", { className: "text-end", textContent: euro(plan.total) })
    );
    const notes = [];
    if (problem.missing.length) notes.push(`Not available from these sellers (not in the plan): ${problem.missing.map((w) => w.name).join(", ")}.`);
    if (problem.excluded.length) notes.push(`Not considered: ${problem.excluded.map((x) => `${x.name} (${x.reason})`).join(", ")}.`);
    if (data.errors.length) notes.push(`Problems while loading: ${data.errors.join("; ")}.`);
    notes.push("Shipping is estimated from Cardmarket's public price table; the shopping cart shows the final amount.");

    const cartBtn = btn("btn-success", "Add plan to cart");
    if (!(saving > 0.009)) {
      cartBtn.dataset.off = "1";
      cartBtn.title = "The Wizard's result is already as cheap; use its own buttons.";
    }
    cartBtn.onclick = () => run(() => addToCart(plan));
    results.replaceChildren(
      el("div", { className: "wn-headline" }, el("strong", { textContent: headline }), el("span", { className: "wn-spacer" }), cartBtn),
      el("table", { className: "table table-sm mb-1" }, el("thead", {}, head), el("tbody", {}, ...rows), el("tfoot", {}, foot)),
      ...notes.map((n) => el("div", { className: "wn-summary", textContent: n }))
    );
  }

  // ---------- shopping cart ----------
  async function readCart() {
    return M.parseCart(await getDoc(`/${lang}/Magic/ShoppingCart`));
  }

  async function addToCart(plan) {
    const token = document.querySelector('input[name="__cmtkn"]')?.value;
    if (!token) throw new Error("Session token not found on this page. Reload the page and try again.");

    setStatus("Checking your shopping cart…");
    const before = await readCart();
    const cards = plan.shipments.reduce((a, s) => a + s.cards, 0);
    const intro = `Add ${cards} card${cards === 1 ? "" : "s"} from ${plan.shipments.length} seller${plan.shipments.length === 1 ? "" : "s"} to your shopping cart?`;
    const warn = before.articles
      ? `\n\nYour cart already contains ${before.articles} article(s) from ${before.shipments.length} seller(s). They stay in the cart.`
      : "";
    if (!confirm(intro + warn)) return setStatus("");

    const failed = [];
    for (let i = 0; i < plan.shipments.length; i++) {
      if (cancelled) throw new Error("Cancelled. Some sellers may already be in your cart.");
      const s = plan.shipments[i];
      setStatus(`Adding to cart ${i + 1}/${plan.shipments.length}: ${s.seller}`);
      const idArticle = {}, amount = {};
      for (const it of s.items) {
        idArticle[it.idArticle] = it.idArticle;
        amount[it.idArticle] = String((Number(amount[it.idArticle]) || 0) + it.amount);
      }
      try {
        const r = await ajaxPost("ShoppingCart_Add_AddArticlesFromUserOffers", { __cmtkn: token, idArticle, amount }, { timeoutMs: 30000 });
        if (r.code && !/ok/i.test(r.code)) failed.push(`${s.seller}: ${r.message || r.code}`);
      } catch (e) {
        failed.push(`${s.seller}: ${e.message}`);
      }
      await sleep(DELAY_MS);
    }

    setStatus("Reading the shopping cart…");
    const after = await readCart();
    const added = Math.round((after.total - before.total) * 100) / 100;
    const missingSellers = plan.shipments.filter((s) => !after.shipments.some((c) => c.seller === s.seller && c.articles >= s.cards)).map((s) => s.seller);
    const lines = [
      `Cart total now ${euro(after.total)} (${after.shipments.length} shipments)` +
        (before.total ? `, of which ${euro(added)} from this plan.` : ".") +
        ` Estimated: ${euro(plan.total)}.`,
    ];
    if (failed.length) lines.push(`Problems: ${failed.join("; ")}`);
    if (missingSellers.length) lines.push(`Check these sellers in the cart, not all cards arrived: ${missingSellers.join(", ")}.`);
    setStatus(lines.join(" "));
    results.prepend(el("div", { className: "wn-cartlink" }, el("a", { href: `/${lang}/Magic/ShoppingCart`, className: "btn btn-sm btn-outline-success", textContent: "Open shopping cart" })));
  }

  function download(data) {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `want-not-data-${data.wantsListId}-${data.collectedAt.slice(0, 16).replace(/[:T]/g, "-")}.json`,
    });
    document.body.append(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
  }
})();
