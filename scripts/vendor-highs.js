// Copies the HiGHS WebAssembly build from node_modules into vendor/ (committed, shipped in the extension).
// Run after changing the highs version in package.json: npm install && npm run vendor
const fs = require("node:fs");
const path = require("node:path");
const src = path.dirname(require.resolve("highs/package.json"));
const dst = path.join(__dirname, "..", "vendor", "highs");
fs.mkdirSync(dst, { recursive: true });
for (const [from, to] of [["build/highs.js", "highs.js"], ["build/highs.wasm", "highs.wasm"], ["LICENSE", "LICENSE"]]) {
  fs.copyFileSync(path.join(src, from), path.join(dst, to));
}
console.log("HiGHS", require("highs/package.json").version, "->", dst);
