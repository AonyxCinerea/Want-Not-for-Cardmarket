// Blocklist: presets, custom patterns and exact expansion names,
// matched against Cardmarket expansion names (e.g. "Marvel's Spider-Man").
(function (root) {
  const PRESETS = [
    { id: "marvel", label: "Marvel", patterns: ["Marvel"] },
    { id: "tmnt", label: "Teenage Mutant Ninja Turtles", patterns: ["Teenage Mutant Ninja Turtles"] },
    { id: "avatar", label: "Avatar: The Last Airbender", patterns: ["Avatar: The Last Airbender"] },
    { id: "finalfantasy", label: "Final Fantasy", patterns: ["Final Fantasy"] },
    { id: "lotr", label: "The Lord of the Rings", patterns: ["Lord of the Rings"] },
    { id: "warhammer", label: "Warhammer 40,000", patterns: ["Warhammer 40,000"] },
    { id: "doctorwho", label: "Doctor Who", patterns: ["Doctor Who"] },
    { id: "fallout", label: "Fallout", patterns: ["Fallout"] },
    { id: "assassins", label: "Assassin's Creed", patterns: ["Assassin's Creed"] },
    { id: "jurassic", label: "Jurassic World", patterns: ["Jurassic World"] },
    { id: "transformers", label: "Transformers", patterns: ["Transformers"] },
  ];

  const DEFAULT_SETTINGS = {
    presets: { marvel: true, tmnt: true },
    customPatterns: [], // substring, or "re:<regex>"
    excludedExpansions: [], // exact Cardmarket expansion names
    cleanExplicitEntries: true, // also strip blocked sets from entries with specific expansions
  };

  // Returns null if the pattern is valid, otherwise an error message.
  function validatePattern(p) {
    if (!p.startsWith("re:")) return null;
    try {
      new RegExp(p.slice(3), "i");
      return null;
    } catch (e) {
      return e.message;
    }
  }

  function compilePattern(p) {
    if (p.startsWith("re:")) {
      if (validatePattern(p)) return null;
      const re = new RegExp(p.slice(3), "i");
      return (s) => re.test(s);
    }
    const needle = p.toLowerCase();
    return (s) => s.toLowerCase().includes(needle);
  }

  // Returns matcher(name) -> reason string or null.
  function buildMatcher(settings) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    const rules = [];
    for (const preset of PRESETS) {
      if (s.presets?.[preset.id]) {
        for (const p of preset.patterns) {
          const fn = compilePattern(p);
          if (fn) rules.push({ fn, reason: `preset: ${preset.label}` });
        }
      }
    }
    for (const raw of s.customPatterns || []) {
      const p = raw.trim();
      if (!p) continue;
      const fn = compilePattern(p);
      if (fn) rules.push({ fn, reason: `pattern: ${p}` });
    }
    const exact = new Set((s.excludedExpansions || []).map((n) => n.toLowerCase()));
    return (name) => {
      if (exact.has(name.toLowerCase())) return "selected expansion";
      for (const r of rules) if (r.fn(name)) return r.reason;
      return null;
    };
  }

  const api = { PRESETS, DEFAULT_SETTINGS, validatePattern, buildMatcher };
  if (typeof module !== "undefined") module.exports = api;
  else root.WantNotBlocklist = api;
})(this);
