const test = require("node:test");
const assert = require("node:assert");
const { buildMatcher, validatePattern, DEFAULT_SETTINGS } = require("../src/blocklist.js");
const { planEntry, CAP } = require("../src/selection.js");

const opt = (id, name, selected = false) => ({ id: String(id), name, selected });
const matcher = buildMatcher(DEFAULT_SETTINGS);

test("default presets block Marvel and TMNT", () => {
  assert.ok(matcher("Marvel's Spider-Man"));
  assert.ok(matcher("Teenage Mutant Ninja Turtles: Extras"));
  assert.equal(matcher("Dominaria United"), null);
});

test("custom patterns, regex and exact names", () => {
  const m = buildMatcher({ presets: {}, customPatterns: ["re:^Secret Lair"], excludedExpansions: ["The List"] });
  assert.ok(m("Secret Lair Drop Series"));
  assert.equal(m("Commander: Secret Lair"), null);
  assert.ok(m("the list"));
  assert.ok(validatePattern("re:(")); // invalid regex reported
  assert.equal(validatePattern("re:^ok$"), null);
});

test("Any entry without blocked versions stays Any", () => {
  const p = planEntry([opt(1, "Dominaria"), opt(2, "Core 2020")], matcher);
  assert.equal(p.action, "none");
});

test("Any entry with a blocked version gets all other versions", () => {
  const p = planEntry([opt(1, "Dominaria"), opt(2, "Marvel's Spider-Man"), opt(3, "Core 2020")], matcher);
  assert.equal(p.action, "set");
  assert.deepEqual(p.select.map((o) => o.id), ["1", "3"]);
});

test("over the cap keeps the cheapest, unknown prices last", () => {
  const options = Array.from({ length: 30 }, (_, i) => opt(i, `Set ${i}`));
  options.push(opt(99, "Marvel's Spider-Man"));
  const prices = Object.fromEntries(options.map((o, i) => [o.id, 30 - i])); // later = cheaper
  delete prices["29"]; // unknown
  const p = planEntry(options, matcher, { prices });
  assert.equal(p.select.length, CAP);
  assert.ok(!p.select.some((o) => o.id === "99"));
  assert.ok(p.dropped.some((o) => o.id === "29"));
  assert.ok(p.select.some((o) => o.id === "28")); // cheapest known
});

test("explicit selection only loses blocked sets", () => {
  const p = planEntry([opt(1, "Dominaria", true), opt(2, "Marvel's Spider-Man", true), opt(3, "Core 2020")], matcher);
  assert.equal(p.action, "set");
  assert.deepEqual(p.select.map((o) => o.id), ["1"]);
  const off = planEntry([opt(1, "Dominaria", true), opt(2, "Marvel's Spider-Man", true)], matcher, { cleanExplicit: false });
  assert.equal(off.action, "none");
});

test("all versions blocked gets flagged, not emptied", () => {
  const p = planEntry([opt(1, "Marvel's Spider-Man")], matcher);
  assert.equal(p.action, "flag");
});
