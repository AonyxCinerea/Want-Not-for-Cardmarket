// In-page panel on a Cardmarket wants list: Analyze -> preview -> Apply.
(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  if (!/^\/[a-z]{2}\/Magic\/Wants\/\d+\/?$/.test(location.pathname)) return;

  const { buildMatcher, DEFAULT_SETTINGS } = WantNotBlocklist;
  const { planEntry, split, CAP } = WantNotSelection;
  const { parseWantsList, parseEditPage, buildEditBody } = WantNotParse;

  // Firefox: content.fetch behaves like a page request (cookies, origin).
  const pageFetch = typeof content !== "undefined" && content.fetch ? content.fetch.bind(content) : fetch.bind(window);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DELAY_MS = 900; // be gentle with Cardmarket

  let plans = [];
  let busy = false;

  // ---------- UI ----------
  const panel = document.createElement("section");
  panel.id = "want-not-panel";
  panel.innerHTML = `
    <div class="wn-head">
      <strong>Want-Not</strong>
      <span class="wn-summary"></span>
      <span class="wn-spacer"></span>
      <button type="button" class="btn btn-sm btn-link wn-settings">Settings</button>
      <button type="button" class="btn btn-sm btn-outline-primary wn-analyze">Analyze</button>
      <button type="button" class="btn btn-sm btn-success wn-apply" disabled>Apply</button>
      <span class="wn-sep"></span>
      <button type="button" class="btn btn-sm btn-outline-danger wn-reset" title="Set every entry back to &quot;Any&quot; expansion">Reset all to Any</button>
      <button type="button" class="btn btn-sm btn-outline-secondary wn-undo" hidden>Undo reset</button>
    </div>
    <div class="wn-status"></div>
    <div class="wn-results"></div>`;
  const anchor = document.querySelector(".page-title-container") || document.querySelector("main h1");
  (anchor?.parentNode || document.body).insertBefore(panel, anchor?.nextSibling || null);

  const $ = (sel) => panel.querySelector(sel);
  const setStatus = (t) => ($(".wn-status").textContent = t);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  $(".wn-settings").onclick = () => api.runtime.sendMessage({ type: "openSettings" });
  $(".wn-analyze").onclick = () => run(analyze);
  $(".wn-apply").onclick = () => run(apply);
  $(".wn-reset").onclick = () => run(resetAll);
  $(".wn-undo").onclick = () => run(undoReset);

  const listId = location.pathname.match(/\/Wants\/(\d+)/)[1];
  const backupKey = `resetBackup:${listId}`;
  const analysisKey = `analysis:${listId}`;
  const ANALYSIS_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  let analyzedAt = null;

  // Keep only what the results table and saving need (no form tokens).
  const slimPlan = (p) => ({
    entry: p.entry,
    error: p.error || null,
    done: !!p.done,
    plan: p.plan && (p.plan.action === "none" ? { action: "none" } : p.plan),
  });

  async function persistAnalysis() {
    if (plans.length) await api.storage.local.set({ [analysisKey]: { at: analyzedAt, plans: plans.map(slimPlan) } });
    else await api.storage.local.remove(analysisKey);
  }

  async function restoreAnalysis() {
    const saved = (await api.storage.local.get(analysisKey))[analysisKey];
    if (!saved?.plans?.length || Date.now() - saved.at > ANALYSIS_MAX_AGE_MS) return;
    plans = saved.plans;
    analyzedAt = saved.at;
    renderResults();
    $(".wn-apply").disabled = !plans.some((p) => p.plan?.action === "set" && !p.done);
    const time = new Date(saved.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setStatus(`Results from ${time}. Analyze again to refresh.`);
  }
  refreshUndo();

  async function run(fn) {
    if (busy) return;
    busy = true;
    panel.querySelectorAll("[data-apply], .wn-analyze, .wn-apply, .wn-reset, .wn-undo").forEach((b) => (b.disabled = true));
    try {
      await fn();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      console.error("[Want-Not]", e);
    } finally {
      busy = false;
      $(".wn-analyze").disabled = false;
      $(".wn-reset").disabled = false;
      $(".wn-undo").disabled = false;
      $(".wn-apply").disabled = !plans.some((p) => p.plan?.action === "set" && !p.done);
      renderResults();
    }
  }

  // ---------- data ----------
  async function loadSettings() {
    const s = await api.storage.sync.get(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...s };
  }

  async function rememberExpansions(names) {
    const { seenExpansions = [] } = await api.storage.local.get("seenExpansions");
    const set = new Set(seenExpansions);
    let changed = false;
    for (const n of names) if (!set.has(n)) { set.add(n); changed = true; }
    if (changed) await api.storage.local.set({ seenExpansions: [...set].sort((a, b) => a.localeCompare(b)) });
  }

  async function fetchEdit(url) {
    const res = await pageFetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    return parseEditPage(doc);
  }

  async function getPrices(productIds) {
    const r = await api.runtime.sendMessage({ type: "prices", productIds });
    return r?.ok ? r.prices : {};
  }

  // ---------- analyze ----------
  async function analyze() {
    const settings = await loadSettings();
    const matcher = buildMatcher(settings);
    const entries = parseWantsList(document);
    plans = [];
    analyzedAt = Date.now();
    renderResults();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setStatus(`Analyzing ${i + 1}/${entries.length}: ${entry.name}`);
      // Fast path: "Any" entries must be fetched (we need the versions); explicit ones too (selection may contain blocked sets).
      try {
        const edit = await fetchEdit(entry.editUrl);
        await rememberExpansions(edit.options.map((o) => o.name));
        const { allowed, blocked } = split(edit.options, matcher);
        let prices = {};
        if (blocked.length && allowed.length > CAP) prices = await getPrices(edit.options.map((o) => o.id));
        const plan = planEntry(edit.options, matcher, { prices, cleanExplicit: settings.cleanExplicitEntries });
        plans.push({ entry, edit, plan });
      } catch (e) {
        plans.push({ entry, error: e.message });
      }
      renderResults();
      await persistAnalysis();
      if (i < entries.length - 1) await sleep(DELAY_MS);
    }
    const n = plans.filter((p) => p.plan?.action === "set").length;
    setStatus(n ? `${n} entries will be changed. Review below, then Apply.` : "Nothing to change.");
  }

  // ---------- apply ----------
  // Saves an entry with the given product ids ([] = "Any").
  // Re-fetches the edit page first (unless given) so we never overwrite newer changes.
  async function saveSelection(editUrl, productIds, fresh) {
    if (!fresh) {
      fresh = await fetchEdit(editUrl);
      await sleep(DELAY_MS / 2);
    }
    const body = buildEditBody(fresh.fields, productIds);
    const res = await pageFetch(new URL(fresh.action, location.href), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const html = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const err = new DOMParser().parseFromString(html, "text/html").querySelector("#AlertContainer .alert-danger");
    if (err) throw new Error(err.textContent.trim());
  }

  async function saveEntry(p) {
    await saveSelection(p.entry.editUrl, p.plan.select.map((o) => o.id));
    p.done = true;
    p.error = null;
  }

  // ---------- reset / undo ----------
  async function refreshUndo() {
    const backup = (await api.storage.local.get(backupKey))[backupKey];
    const btn = $(".wn-undo");
    btn.hidden = !backup?.entries?.length;
    if (backup) btn.title = `Restore ${backup.entries.length} entries reset on ${new Date(backup.at).toLocaleString()}`;
  }

  async function resetAll() {
    const entries = parseWantsList(document).filter((e) => !e.isAny);
    if (!entries.length) {
      setStatus("Every entry is already set to Any.");
      return;
    }
    if (!confirm(`Reset ${entries.length} entries to "Any" expansion?\n\nYour current selections are backed up and can be restored with "Undo reset".`)) return;

    const backup = { at: Date.now(), entries: [] };
    const failed = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setStatus(`Resetting ${i + 1}/${entries.length}: ${entry.name}`);
      try {
        const fresh = await fetchEdit(entry.editUrl);
        const ids = fresh.options.filter((o) => o.selected).map((o) => o.id);
        if (ids.length) {
          // back up before changing anything, so a crash mid-run is still recoverable
          backup.entries.push({ name: entry.name, editUrl: entry.editUrl, ids });
          await api.storage.local.set({ [backupKey]: backup });
          await sleep(DELAY_MS / 2);
          await saveSelection(entry.editUrl, [], fresh);
        }
      } catch (e) {
        failed.push(`${entry.name}: ${e.message}`);
      }
      if (i < entries.length - 1) await sleep(DELAY_MS);
    }
    plans = [];
    await persistAnalysis();
    await refreshUndo();
    setStatus(
      `Reset ${backup.entries.length - failed.length} entries to Any. Reload the page to see it.` +
        (failed.length ? ` Failed: ${failed.join("; ")}` : "")
    );
  }

  async function undoReset() {
    const backup = (await api.storage.local.get(backupKey))[backupKey];
    if (!backup?.entries?.length) return;
    if (!confirm(`Restore the expansion selections of ${backup.entries.length} entries?`)) return;
    const failed = [];
    for (let i = 0; i < backup.entries.length; i++) {
      const b = backup.entries[i];
      setStatus(`Restoring ${i + 1}/${backup.entries.length}: ${b.name}`);
      try {
        await saveSelection(b.editUrl, b.ids);
      } catch (e) {
        failed.push(b);
      }
      if (i < backup.entries.length - 1) await sleep(DELAY_MS);
    }
    if (failed.length) await api.storage.local.set({ [backupKey]: { ...backup, entries: failed } });
    else await api.storage.local.remove(backupKey);
    plans = [];
    await persistAnalysis();
    await refreshUndo();
    setStatus(
      `Restored ${backup.entries.length - failed.length} entries. Reload the page to see it.` +
        (failed.length ? ` ${failed.length} failed; "Undo reset" will retry them.` : "")
    );
  }

  async function apply() {
    const todo = plans.filter((p) => p.plan?.action === "set" && !p.done);
    if (!todo.length) return;
    if (!confirm(`Update ${todo.length} wants entries on Cardmarket?`)) return;
    let ok = 0;
    for (let i = 0; i < todo.length; i++) {
      const p = todo[i];
      setStatus(`Saving ${i + 1}/${todo.length}: ${p.entry.name}`);
      try {
        await saveEntry(p);
        ok++;
      } catch (e) {
        p.error = `Save failed: ${e.message}`;
      }
      renderResults();
      await persistAnalysis();
      if (i < todo.length - 1) await sleep(DELAY_MS);
    }
    setStatus(`Saved ${ok}/${todo.length}. Reload the page to see the new expansions; Analyze again to verify.`);
  }

  async function applyOne(index) {
    const p = plans[index];
    if (!p || p.done || p.plan?.action !== "set") return;
    setStatus(`Saving ${p.entry.name}…`);
    try {
      await saveEntry(p);
      setStatus(`Saved ${p.entry.name}.`);
    } catch (e) {
      p.error = `Save failed: ${e.message}`;
      setStatus("");
    }
    renderResults();
    await persistAnalysis();
  }

  $(".wn-results").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-apply]");
    if (btn) run(() => applyOne(Number(btn.dataset.apply)));
  });

  // ---------- results table ----------
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const tip = (text, names) => `<span class="wn-tip" title="${esc(names.join("\n"))}">${esc(text)}</span>`;

  function describe(plan) {
    const blocked = tip(plural(plan.blocked.length, "blocked version"), plan.blocked.map((o) => o.name));
    let text = plan.isAny ? `Excludes ${blocked}` : `Removes ${blocked} from your selection`;
    if (plan.dropped.length) {
      const remaining = plan.select.length + plan.dropped.length;
      text +=
        ". " +
        tip(`${CAP} cheapest of the ${remaining} remaining`, [
          `Cardmarket allows max. ${CAP} versions per card. Left out:`,
          ...plan.dropped.map((o) => o.name),
        ]) +
        " are kept";
    }
    return text;
  }

  function renderResults() {
    const changed = plans.filter((p) => p.plan?.action === "set").length;
    const flagged = plans.filter((p) => p.plan?.action === "flag" || p.error).length;
    $(".wn-summary").textContent = plans.length ? `${plans.length} checked · ${changed} to change · ${flagged} need attention` : "";

    const rows = plans
      .map((p, i) => [p, i])
      .filter(([p]) => p.error || p.plan?.action !== "none")
      .map(([p, i]) => {
        const { entry, plan } = p;
        let action, detail;
        if (p.error) {
          action = `<span class="badge bg-danger">error</span>`;
          detail = esc(p.error);
        } else if (plan.action === "flag") {
          action = `<span class="badge bg-warning text-dark">check</span>`;
          detail = `Every version is blocked (${esc(plan.blocked.map((o) => o.name).join(", "))}) — left unchanged`;
        } else {
          action = p.done
            ? `<span class="badge bg-success">saved</span>`
            : `<button type="button" class="btn btn-sm btn-outline-success py-0" data-apply="${i}" title="Apply only this card"${busy ? " disabled" : ""}>Apply</button>`;
          detail = describe(plan);
        }
        return `<tr><td class="wn-action">${action}</td><td><a href="${esc(entry.editUrl)}">${esc(entry.name)}</a></td><td>${detail}</td></tr>`;
      })
      .join("");
    $(".wn-results").innerHTML = rows ? `<table class="table table-sm mb-0"><tbody>${rows}</tbody></table>` : "";
  }

  restoreAnalysis();
})();
