// Pure planning logic for one wants entry.
// options: [{ id, name, selected }] from the edit page (id = Cardmarket idProduct)
(function (root) {
  const CAP = 20; // Cardmarket allows at most 20 expansions per wants entry

  // Which versions are relevant and which of them are blocked.
  function split(options, matcher) {
    const selected = options.filter((o) => o.selected);
    const isAny = selected.length === 0;
    const pool = isAny ? options : selected;
    const blocked = pool.filter((o) => matcher(o.name));
    const allowed = pool.filter((o) => !matcher(o.name));
    return { isAny, pool, blocked, allowed };
  }

  // Returns { action: "none" | "set" | "flag", select, blocked, dropped, reason }
  function planEntry(options, matcher, { cap = CAP, prices = {}, cleanExplicit = true } = {}) {
    const { isAny, blocked, allowed } = split(options, matcher);
    const base = { isAny, blocked, dropped: [], select: [] };

    if (blocked.length === 0) return { ...base, action: "none", reason: "nothing blocked" };
    if (!isAny && !cleanExplicit) return { ...base, action: "none", reason: "specific expansions kept" };
    if (allowed.length === 0) return { ...base, action: "flag", reason: "every version is blocked" };
    if (allowed.length <= cap) return { ...base, action: "set", select: allowed, reason: "" };

    // Over the cap: keep the cheapest by Cardmarket trend price, unknown prices last.
    const price = (o) => (prices[o.id] ?? Infinity);
    const ranked = [...allowed].sort((a, b) => price(a) - price(b) || a.name.localeCompare(b.name));
    return {
      ...base,
      action: "set",
      select: ranked.slice(0, cap),
      dropped: ranked.slice(cap),
      reason: `capped to ${cap} cheapest`,
    };
  }

  const api = { CAP, split, planEntry };
  if (typeof module !== "undefined") module.exports = api;
  else root.WantNotSelection = api;
})(this);
