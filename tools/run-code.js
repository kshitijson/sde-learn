#!/usr/bin/env node
/* Compiles and runs every code sample on the given pages in all 5 languages.
   Usage: node tools/run-code.js caching url-shortener      (page ids)
          node tools/run-code.js --all                       (every page that is not `soon`)
   Needs: javac/java (uses the JDK bundled with the SonarLint VS Code extension if none is on PATH),
          g++, go, node, python3. Work files go to $TMPDIR/sdn-code and are removed afterwards. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/registry.js"), "utf8"), ctx);
const pages = ctx.window.SD_PAGES;
const args = process.argv.slice(2);
const targets = args.includes("--all") ? pages.filter((p) => !p.soon) : pages.filter((p) => args.includes(p.id));
if (!targets.length) { console.log("Usage: node tools/run-code.js <page-id ...> | --all"); process.exit(1); }

function findJdk() {
  if (spawnSync("javac", ["-version"]).status === 0) return "";
  const ext = path.join(os.homedir(), ".vscode/extensions");
  try {
    for (const d of fs.readdirSync(ext).filter((x) => x.startsWith("sonarsource.sonarlint"))) {
      const jre = path.join(ext, d, "jre");
      for (const v of fs.readdirSync(jre)) { const bin = path.join(jre, v, "bin"); if (fs.existsSync(path.join(bin, "javac"))) return bin + "/"; }
    }
  } catch (e) {}
  return null;
}
const JDK = findJdk();
const work = fs.mkdtempSync(path.join(os.tmpdir(), "sdn-code-"));
const run = (cmd, a, cwd) => spawnSync(cmd, a, { cwd, encoding: "utf8", timeout: 60000 });
const unraw = (s) => s.replace(/\\`/g, "`").replace(/\\\$\{/g, "${");

const LANGS = {
  java: (dir, src) => {
    if (JDK === null) return { skip: "no JDK found" };
    const m = src.match(/public\s+(?:final\s+)?class\s+(\w+)/), cls = m ? m[1] : "Main";
    fs.writeFileSync(path.join(dir, cls + ".java"), src);
    const c = run(JDK + "javac", ["-d", ".", cls + ".java"], dir); if (c.status) return { err: c.stderr };
    return run(JDK + "java", ["-cp", ".", cls], dir);
  },
  python: (dir, src) => { fs.writeFileSync(path.join(dir, "main.py"), src); return run("python3", ["-I", "main.py"], dir); },
  cpp: (dir, src) => {
    fs.writeFileSync(path.join(dir, "main.cpp"), src);
    const c = run("g++", ["-std=c++17", "-O1", "-pthread", "-Wall", "-o", "main", "main.cpp"], dir); if (c.status) return { err: c.stderr };
    return run("./main", [], dir);
  },
  javascript: (dir, src) => { fs.writeFileSync(path.join(dir, "main.js"), src); return run("node", ["main.js"], dir); },
  go: (dir, src) => { fs.writeFileSync(path.join(dir, "main.go"), src); return run("go", ["run", "main.go"], dir); },
};

let ok = 0, fail = 0, skip = 0;
for (const p of targets) {
  let def; const sb = { SD: { register: (o) => (def = o) } };
  vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(root, p.file), "utf8"), sb);
  for (const [key, entry] of Object.entries(def.code || {})) {
    const line = [];
    for (const lang of Object.keys(LANGS)) {
      const dir = path.join(work, `${p.id}__${key}__${lang}`); fs.mkdirSync(dir, { recursive: true });
      const r = LANGS[lang](dir, unraw(entry[lang] || ""));
      if (r.skip) { skip++; line.push(`${lang}:skip`); continue; }
      if (r.err || r.status !== 0 || r.error) {
        fail++; line.push(`${lang}:FAIL`);
        console.log(`\n✗ ${p.id}/${key} [${lang}]\n${(r.err || r.stderr || String(r.error || "exit " + r.status)).split("\n").slice(0, 12).join("\n")}`);
      } else { ok++; line.push(`${lang}:ok`); }
    }
    console.log(`${p.id}/${key}: ${line.join("  ")}`);
  }
}
fs.rmSync(work, { recursive: true, force: true });
console.log(`\n${ok} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
