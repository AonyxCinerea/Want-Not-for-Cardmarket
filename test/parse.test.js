// Parses the saved Cardmarket pages in test/fixtures (needs: npm install).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { parseWantsList, parseEditPage, buildEditBody } = require("../src/parse.js");

const load = (f) => new JSDOM(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8")).window.document;

test("wants list: finds entries, edit links and Any/explicit state", () => {
  const entries = parseWantsList(load("wants-list.html"));
  assert.equal(entries.length, 10);
  const aeth = entries.find((e) => e.name === "Aetherize");
  assert.equal(aeth.isAny, true);
  assert.match(aeth.editUrl, /^\/en\/Magic\/Wants\/11111111\/[0-9a-f]{24}$/);
  assert.equal(entries.filter((e) => !e.isAny).length, 5);
});

test("edit page: options and form fields", () => {
  const edit = parseEditPage(load("edit-page.html"));
  assert.equal(edit.action, "/en/Magic/PostGetAction/WantsList_EditWant");
  assert.deepEqual(edit.options.map((o) => o.name), [
    "Commander: The Lost Caverns of Ixalan",
    "Core 2020: Extras",
    "Ravnica Allegiance: Extras",
    "Ravnica Allegiance",
  ]);
  assert.ok(edit.options.every((o) => !o.selected && /^\d+$/.test(o.id)));
  const f = Object.fromEntries(edit.fields.filter(([k]) => !k.endsWith("[]")));
  assert.equal(f.__cmtkn, "TEST_TOKEN");
  assert.equal(f.amount, "1");
  assert.equal(f.minCondition, "6"); // last selected wins, disabled "Any" skipped
  assert.equal(f.isFoil, "0");
  assert.equal(f.mailAlert, undefined); // unchecked
  assert.deepEqual(edit.fields.filter(([k]) => k === "idLanguage[]").map(([, v]) => v), ["1"]);
});

test("edit body: replaces idProduct[] and keeps everything else", () => {
  const edit = parseEditPage(load("edit-page.html"));
  const body = buildEditBody(edit.fields, ["368318", "379740"]);
  assert.deepEqual(body.getAll("idProduct[]"), ["368318", "379740"]);
  assert.equal(body.get("idMetacard"), "267652");
  assert.equal(body.get("minCondition"), "6");
  assert.deepEqual(body.getAll("idLanguage[]"), ["1"]);
});
