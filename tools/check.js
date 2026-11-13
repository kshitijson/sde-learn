#!/usr/bin/env node
/* Validates content files against the registry and the authoring spec.
   Usage: node tools/check.js            (all pages that are not `soon`)
          node tools/check.js caching    (specific page ids) */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/registry.js"), "utf8"), ctx);
const pages = ctx.window.SD_PAGES;

const LANGS = ["java", "python", "cpp", "javascript", "go"];
const WIDGETS = ["estimator", "latency", "nines", "lb-sim", "cache-sim", "rate-limiter", "hash-ring", "snowflake", "base62", "fanout", "handshake", "polling", "quorum", "sharding"];
const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "wbr", "col", "source"]);
const SVG_SELF = /\/\s*>$/;

const ids = process.argv.slice(2);
const targets = pages.filter((p) => (ids.length ? ids.includes(p.id) : !p.soon));
let errors = 0, warnings = 0;
const err = (id, m) => { errors++; console.log(`  ✗ [${id}] ${m}`); };
const warn = (id, m) => { warnings++; console.log(`  ! [${id}] ${m}`); };

function checkTags(id, html) {
  const stack = [];
  const re = /<\/?([a-zA-Z][\w-]*)\b[^>]*?>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    const full = m[0];
    if (full.startsWith("</")) {
      const top = stack.pop();
      if (top !== tag) { err(id, `tag mismatch: expected </${top}> but found </${tag}> near: ${html.slice(Math.max(0, m.index - 60), m.index + 20).replace(/\s+/g, " ")}`); return; }
    } else if (!VOID.has(tag) && !SVG_SELF.test(full)) stack.push(tag);
  }
  if (stack.length) err(id, `unclosed tags: ${stack.join(", ")}`);
}

for (const p of targets) {
  const file = path.join(root, p.file);
  if (!fs.existsSync(file)) { err(p.id, `missing file ${p.file}`); continue; }
  let reg = [];
  const sandbox = { SD: { register: (o) => reg.push(o) } };
  vm.createContext(sandbox);
  try { vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: p.file }); }
  catch (e) { err(p.id, `JS error: ${e.message}`); continue; }
  if (reg.length !== 1) { err(p.id, `expected 1 SD.register call, got ${reg.length}`); continue; }
  const d = reg[0];
  if (d.id !== p.id) err(p.id, `id mismatch: file registers "${d.id}"`);
  if (typeof d.html !== "string" || d.html.length < 500) { err(p.id, "html missing or too short"); continue; }
  const html = d.html;
  if (/<h1[\s>]/i.test(html)) err(p.id, "do not use <h1>");
  if (!/^\s*<p class="lead">/.test(html)) warn(p.id, 'page should start with <p class="lead">');
  if (/`/.test(html.replace(/\\`/g, ""))) warn(p.id, "raw backtick in html (use <code>)");
  checkTags(p.id, html);

  const code = d.code || {}, diagrams = d.diagrams || {};
  const usedCode = [...html.matchAll(/data-code="([^"]+)"/g)].map((x) => x[1]);
  const usedDiag = [...html.matchAll(/data-diagram="([^"]+)"/g)].map((x) => x[1]);
  const usedWidgets = [...html.matchAll(/data-widget="([^"]+)"/g)].map((x) => x[1]);
  usedCode.forEach((k) => { if (!code[k]) err(p.id, `data-code="${k}" has no code entry`); });
  Object.keys(code).forEach((k) => {
    if (!usedCode.includes(k)) warn(p.id, `code.${k} is never placed`);
    LANGS.forEach((l) => { if (!code[k][l] || !code[k][l].trim()) err(p.id, `code.${k} missing ${l}`); });
  });
  usedDiag.forEach((k) => { if (!diagrams[k]) err(p.id, `data-diagram="${k}" has no diagram entry`); });
  Object.keys(diagrams).forEach((k) => {
    if (!usedDiag.includes(k)) warn(p.id, `diagrams.${k} is never placed`);
    if (/%%\{init/.test(diagrams[k])) warn(p.id, `diagrams.${k} sets init/theme (remove it)`);
  });
  usedWidgets.forEach((w) => { if (!WIDGETS.includes(w)) err(p.id, `unknown widget "${w}"`); });
  if (!usedDiag.length && !/<svg/.test(html)) warn(p.id, "no diagram or SVG on the page");
  if (/fill="#|stroke="#|style="[^"]*(color|fill)/i.test(html)) warn(p.id, "inline colours found (use s-* classes)");
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  console.log(`✓ ${p.id.padEnd(28)} ${String(words).padStart(5)} words, ${usedDiag.length} diagrams, ${Object.keys(code).length} code blocks, ${usedWidgets.length} widgets`);
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
