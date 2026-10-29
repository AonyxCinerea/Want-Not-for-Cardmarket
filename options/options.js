const api = globalThis.browser ?? globalThis.chrome;
const { PRESETS, DEFAULT_SETTINGS, validatePattern, buildMatcher } = WantNotBlocklist;

let settings = { ...DEFAULT_SETTINGS };
let seen = [];
const $ = (id) => document.getElementById(id);

async function init() {
  settings = { ...DEFAULT_SETTINGS, ...(await api.storage.sync.get(DEFAULT_SETTINGS)) };
  seen = (await api.storage.local.get({ seenExpansions: [] })).seenExpansions;
  renderPresets();
  renderPatterns();
  renderExpansions();
  $("cleanExplicit").checked = settings.cleanExplicitEntries;
  $("cleanExplicit").onchange = (e) => save({ cleanExplicitEntries: e.target.checked });
  $("search").oninput = renderExpansions;
  $("onlyBlocked").onchange = renderExpansions;
  $("addPattern").onsubmit = addPattern;
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.seenExpansions) {
      seen = changes.seenExpansions.newValue || [];
      renderExpansions();
    }
  });
}

async function save(patch) {
  settings = { ...settings, ...patch };
  await api.storage.sync.set(patch);
  $("saved").textContent = "Saved";
  clearTimeout(save.t);
  save.t = setTimeout(() => ($("saved").textContent = ""), 1200);
  renderPatterns();
  renderExpansions();
}

function renderPresets() {
  $("presets").replaceChildren(
    ...PRESETS.map((p) => {
      const label = document.createElement("label");
      label.className = "inline";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!settings.presets?.[p.id];
      cb.onchange = () => save({ presets: { ...settings.presets, [p.id]: cb.checked } });
      label.append(cb, p.label);
      return label;
    })
  );
}

function addPattern(e) {
  e.preventDefault();
  const p = $("patternInput").value.trim();
  if (!p) return;
  const err = validatePattern(p);
  $("patternError").textContent = err ? `Invalid regex: ${err}` : "";
  if (err) return;
  $("patternInput").value = "";
  if (!settings.customPatterns.includes(p)) save({ customPatterns: [...settings.customPatterns, p] });
}

function renderPatterns() {
  $("patterns").replaceChildren(
    ...settings.customPatterns.map((p) => {
      const m = buildMatcher({ presets: {}, customPatterns: [p], excludedExpansions: [] });
      const hits = seen.filter((n) => m(n)).length;
      const li = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = p;
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = seen.length ? `${hits} match${hits === 1 ? "" : "es"}` : "";
      const rm = document.createElement("button");
      rm.textContent = "×";
      rm.title = "Remove";
      rm.onclick = () => save({ customPatterns: settings.customPatterns.filter((x) => x !== p) });
      li.append(code, n, rm);
      return li;
    })
  );
}

function renderExpansions() {
  // rule matcher = presets + patterns, without the exact list (those are the checkboxes)
  const byRule = buildMatcher({ ...settings, excludedExpansions: [] });
  const exact = new Set(settings.excludedExpansions);
  const q = $("search").value.trim().toLowerCase();
  const onlyBlocked = $("onlyBlocked").checked;
  const names = [...new Set([...seen, ...settings.excludedExpansions])].sort((a, b) => a.localeCompare(b));

  let blockedCount = 0;
  const items = [];
  for (const name of names) {
    const rule = byRule(name);
    const isBlocked = !!rule || exact.has(name);
    if (isBlocked) blockedCount++;
    if (q && !name.toLowerCase().includes(q)) continue;
    if (onlyBlocked && !isBlocked) continue;

    const li = document.createElement("li");
    li.className = isBlocked ? "blocked" : "";
    const label = document.createElement("label");
    label.className = "inline";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isBlocked;
    cb.disabled = !!rule;
    cb.onchange = () =>
      save({
        excludedExpansions: cb.checked
          ? [...settings.excludedExpansions, name]
          : settings.excludedExpansions.filter((x) => x !== name),
      });
    label.append(cb, name);
    if (rule) {
      const why = document.createElement("span");
      why.className = "why";
      why.textContent = rule;
      label.append(why);
    }
    li.append(label);
    items.push(li);
  }
  $("expansions").replaceChildren(...items);
  $("expCount").textContent = names.length
    ? `${blockedCount} of ${names.length} known expansions blocked`
    : "No expansions known yet — open a wants list and click Analyze.";
}

init();
