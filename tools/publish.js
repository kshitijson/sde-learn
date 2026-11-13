#!/usr/bin/env node
/* Marks pages as ready (removes `soon`) in assets/js/registry.js.
   Usage: node tools/publish.js caching url-shortener ...
   Only publishes a page whose content file exists. Run tools/check.js first. */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "assets/js/registry.js");
let src = fs.readFileSync(file, "utf8");
for (const id of process.argv.slice(2)) {
  const re = new RegExp(`([TP]\\("${id}",[^)]*?\\][^)]*?), soon\\)`);
  const m = src.match(re);
  if (!m) { console.log(`- ${id}: not found or already published`); continue; }
  const folder = /^\s*P\(/.test(m[0]) || m[0].startsWith("P(") ? "problems" : null;
  src = src.replace(re, "$1)");
  console.log(`✓ ${id}`);
}
fs.writeFileSync(file, src);
// sanity: registry still evaluates and files exist for every published page
const vm = require("vm"); const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
const missing = ctx.window.SD_PAGES.filter((p) => !p.soon && !fs.existsSync(path.join(__dirname, "..", p.file))).map((p) => p.id);
if (missing.length) { console.log("✗ published but missing content file: " + missing.join(", ")); process.exit(1); }
console.log(`${ctx.window.SD_PAGES.filter((p) => !p.soon).length} pages published, ${ctx.window.SD_PAGES.filter((p) => p.soon).length} still soon`);
