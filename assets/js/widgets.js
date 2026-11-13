/* ===================================================================
   Interactive widgets. Each is mounted on <div data-widget="name">.
   =================================================================== */
(function () {
  "use strict";
  const $ = (s, r) => r.querySelector(s);
  const $$ = (s, r) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function frame(el, title, body) {
    el.classList.add("widget");
    el.innerHTML = `<div class="widget-head"><span class="badge">Try it</span><h4>${title}</h4></div><div class="widget-body">${body}</div>`;
    return $(".widget-body", el);
  }
  // Remove timers when the widget leaves the page
  function onDetach(el, fn) {
    const t = setInterval(() => { if (!el.isConnected) { clearInterval(t); fn(); } }, 1000);
  }
  function fmtNum(n, d = 1) {
    if (!isFinite(n)) return "∞";
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(d).replace(/\.0+$/, "") + "T";
    if (a >= 1e9) return (n / 1e9).toFixed(d).replace(/\.0+$/, "") + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(d).replace(/\.0+$/, "") + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(d).replace(/\.0+$/, "") + "K";
    return a < 10 && a % 1 ? n.toFixed(2) : Math.round(n).toString();
  }
  function fmtBytes(b) {
    const u = ["B", "KB", "MB", "GB", "TB", "PB", "EB"]; let i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return (b >= 100 ? Math.round(b) : b.toFixed(1).replace(/\.0$/, "")) + " " + u[i];
  }
  function fmtDur(sec) {
    if (sec < 1) return Math.round(sec * 1000) + " ms";
    if (sec < 60) return sec.toFixed(1).replace(/\.0$/, "") + " s";
    if (sec < 3600) return (sec / 60).toFixed(1).replace(/\.0$/, "") + " min";
    if (sec < 86400) return (sec / 3600).toFixed(1).replace(/\.0$/, "") + " h";
    return (sec / 86400).toFixed(1).replace(/\.0$/, "") + " days";
  }
  const slider = (id, label, min, max, step, val) =>
    `<label class="w-field"><span class="w-field-top"><span>${label}</span><span class="w-val" data-out="${id}"></span></span><input type="range" data-in="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;

  const W = (window.SDWidgets = {});

  /* ---------------- 1. Estimator ---------------- */
  W.estimator = function (el) {
    const presets = {
      "Twitter-like": { dau: 200e6, writes: 2, ratio: 100, size: 1, years: 5, peak: 3 },
      "WhatsApp-like": { dau: 500e6, writes: 40, ratio: 1, size: 0.1, years: 1, peak: 2 },
      "URL shortener": { dau: 10e6, writes: 1, ratio: 100, size: 0.5, years: 5, peak: 2 },
      "Instagram-like": { dau: 500e6, writes: 0.2, ratio: 50, size: 2000, years: 5, peak: 3 },
    };
    const b = frame(el, "Back-of-the-envelope calculator", `
      <div class="w-row">${Object.keys(presets).map((k, i) => `<button class="chip" data-preset="${k}" aria-pressed="${i === 0}">${k}</button>`).join("")}</div>
      <div class="w-controls">
        <label class="w-field">Daily active users<input class="w-input" data-k="dau" type="number" min="1"></label>
        <label class="w-field">Writes per user per day<input class="w-input" data-k="writes" type="number" min="0" step="0.1"></label>
        <label class="w-field">Read : write ratio<input class="w-input" data-k="ratio" type="number" min="0"></label>
        <label class="w-field">Size per write (KB)<input class="w-input" data-k="size" type="number" min="0" step="0.1"></label>
        <label class="w-field">Keep data for (years)<input class="w-input" data-k="years" type="number" min="0" step="1"></label>
        <label class="w-field">Peak ÷ average traffic<input class="w-input" data-k="peak" type="number" min="1" step="0.5"></label>
      </div>
      <div class="w-stats" data-out></div>
      <div class="w-note">Uses 1 day ≈ 86,400 s (round to 10⁵ in an interview), a cache sized for 20% of a day's reads (80/20 rule), and ~1,000 QPS per app server. Storage excludes replication; multiply by 3 for three copies.</div>`);
    const v = Object.assign({}, presets["Twitter-like"]);
    const ins = $$("[data-k]", b);
    const fill = () => ins.forEach((i) => (i.value = v[i.dataset.k]));
    function calc() {
      const wq = (v.dau * v.writes) / 86400, rq = wq * v.ratio;
      const bytesDay = v.dau * v.writes * v.size * 1000;
      const total = bytesDay * 365 * v.years;
      const cache = bytesDay * v.ratio * 0.2;
      const peak = (wq + rq) * v.peak;
      $("[data-out]", b).innerHTML = [
        ["Write QPS", fmtNum(wq), `peak ≈ ${fmtNum(wq * v.peak)}`],
        ["Read QPS", fmtNum(rq), `peak ≈ ${fmtNum(rq * v.peak)}`, true],
        ["New data / day", fmtBytes(bytesDay), `${fmtNum(v.dau * v.writes)} writes`],
        [`Storage (${v.years} yr)`, fmtBytes(total), `× 3 replicas = ${fmtBytes(total * 3)}`, true],
        ["Ingress bandwidth", fmtBytes(bytesDay / 86400) + "/s", "writes coming in"],
        ["Egress bandwidth", fmtBytes((bytesDay * v.ratio) / 86400) + "/s", "reads going out"],
        ["Cache memory", fmtBytes(cache), "20% of daily read volume"],
        ["App servers @ peak", fmtNum(Math.max(1, Math.ceil(peak / 1000))), `${fmtNum(peak)} peak QPS ÷ 1K`],
      ].map(([k, val, s, hl]) => `<div class="w-stat${hl ? " hl" : ""}"><div class="k">${k}</div><div class="v">${val}</div><div class="s">${s}</div></div>`).join("");
    }
    ins.forEach((i) => i.addEventListener("input", () => { const n = parseFloat(i.value); if (!isNaN(n) && n >= 0) { v[i.dataset.k] = n; calc(); $$("[data-preset]", b).forEach((c) => c.setAttribute("aria-pressed", "false")); } }));
    $$("[data-preset]", b).forEach((c) => c.addEventListener("click", () => {
      Object.assign(v, presets[c.dataset.preset]); fill(); calc();
      $$("[data-preset]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    }));
    fill(); calc();
  };

  /* ---------------- 2. Latency numbers ---------------- */
  W.latency = function (el) {
    const ops = [
      ["L1 cache reference", 0.5], ["Branch mispredict", 5], ["L2 cache reference", 7], ["Mutex lock/unlock", 25],
      ["Main memory reference", 100], ["Compress 1 KB (fast codec)", 2000], ["Send 1 KB over 1 Gbps network", 10000],
      ["Read 4 KB randomly from SSD", 100000], ["Read 1 MB sequentially from memory", 250000], ["Round trip within same datacenter", 500000],
      ["Read 1 MB sequentially from SSD", 1000000], ["Redis GET over network", 1000000], ["Disk (HDD) seek", 10000000],
      ["Read 1 MB sequentially from HDD", 20000000], ["Round trip Mumbai ↔ Singapore", 60000000], ["Round trip Mumbai ↔ California", 230000000],
    ];
    const b = frame(el, "Latency numbers, on a log scale", `
      <div class="w-row"><button class="chip" data-mode="real" aria-pressed="true">Real time</button><button class="chip" data-mode="human" aria-pressed="false">Humanised (L1 = 1 second)</button></div>
      <div class="lat-list" data-list></div>
      <div class="w-note">Approximate figures for modern hardware. Each bar's length is on a log scale, so every step right is ~10× slower. Hover a row to compare it with a memory read.</div>`);
    const max = Math.log10(ops[ops.length - 1][1] / 0.5);
    let mode = "real";
    const human = (ns) => {
      const s = ns / 0.5; // scale: 0.5 ns -> 1 s
      if (s < 60) return s.toFixed(0) + " s";
      if (s < 3600) return (s / 60).toFixed(0) + " min";
      if (s < 86400) return (s / 3600).toFixed(1) + " hours";
      if (s < 86400 * 365) return (s / 86400).toFixed(0) + " days";
      return (s / 86400 / 365).toFixed(1) + " years";
    };
    const real = (ns) => ns < 1000 ? ns + " ns" : ns < 1e6 ? ns / 1000 + " µs" : ns / 1e6 + " ms";
    function draw() {
      $("[data-list]", b).innerHTML = ops.map(([n, ns]) => {
        const w = 4 + (Math.log10(ns / 0.5) / max) * 96;
        const cls = ns < 1000 ? "fast" : ns < 1e6 ? "mid" : "slow";
        return `<div class="lat-row" title="${(ns / 100).toLocaleString()}× a main memory reference"><span class="lat-name">${n}</span><span class="lat-bar"><i class="${cls}" style="width:${w}%"></i></span><span class="lat-val">${mode === "real" ? real(ns) : human(ns)}</span></div>`;
      }).join("");
    }
    $$("[data-mode]", b).forEach((c) => c.addEventListener("click", () => { mode = c.dataset.mode; $$("[data-mode]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c))); draw(); }));
    draw();
  };

  /* ---------------- 3. Nines / availability ---------------- */
  W.nines = function (el) {
    const levels = [90, 99, 99.5, 99.9, 99.95, 99.99, 99.999];
    const b = frame(el, "Availability: downtime budget & redundancy", `
      <div class="w-row" data-levels>${levels.map((l, i) => `<button class="chip" data-l="${l}" aria-pressed="${i === 3}">${l}%</button>`).join("")}</div>
      <div class="w-stats" data-down></div>
      <hr style="border:0;border-top:1px solid var(--border)">
      <div class="w-controls">
        ${slider("a", "Each component's availability", 95, 99.99, 0.01, 99.9)}
        ${slider("n", "Components in series (each request needs all of them)", 1, 10, 1, 3)}
        ${slider("k", "Redundant copies of each component", 1, 4, 1, 1)}
      </div>
      <div class="w-stats" data-comp></div>
      <div class="w-note">Series: A = a<sup>n</sup>. A component with k copies in parallel: 1 − (1 − a)<sup>k</sup>. This assumes independent failures, which real systems rarely have exactly.</div>`);
    const down = (pct) => {
      const f = 1 - pct / 100;
      return [["Per year", fmtDur(f * 365.25 * 86400)], ["Per month", fmtDur(f * 30 * 86400)], ["Per week", fmtDur(f * 7 * 86400)], ["Per day", fmtDur(f * 86400)]];
    };
    const ninesOf = (p) => (p >= 100 ? "∞" : (-Math.log10(1 - p / 100)).toFixed(1));
    function drawDown(l) { $("[data-down]", b).innerHTML = down(l).map(([k, v], i) => `<div class="w-stat${i === 0 ? " hl" : ""}"><div class="k">Allowed downtime ${k.toLowerCase()}</div><div class="v">${v}</div></div>`).join(""); }
    function drawComp() {
      const g = (id) => +$(`[data-in="${id}"]`, b).value;
      const a = g("a") / 100, n = g("n"), k = g("k");
      $('[data-out="a"]', b).textContent = (a * 100).toFixed(2) + "%"; $('[data-out="n"]', b).textContent = n; $('[data-out="k"]', b).textContent = k;
      const one = 1 - Math.pow(1 - a, k), sys = Math.pow(one, n), pct = sys * 100;
      $("[data-comp]", b).innerHTML = `
        <div class="w-stat"><div class="k">One component with ${k} cop${k > 1 ? "ies" : "y"}</div><div class="v">${(one * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%</div></div>
        <div class="w-stat hl"><div class="k">Whole system</div><div class="v ${pct < a * 100 ? "bad" : "ok"}">${pct.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%</div><div class="s">≈ ${ninesOf(pct)} nines</div></div>
        <div class="w-stat"><div class="k">Downtime per year</div><div class="v">${fmtDur((1 - sys) * 365.25 * 86400)}</div></div>`;
    }
    $$("[data-l]", b).forEach((c) => c.addEventListener("click", () => { $$("[data-l]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c))); drawDown(+c.dataset.l); }));
    $$("[data-in]", b).forEach((i) => i.addEventListener("input", drawComp));
    drawDown(99.9); drawComp();
  };

  /* ---------------- 4. Load balancer simulator ---------------- */
  W["lb-sim"] = function (el) {
    const algos = { rr: "Round robin", wrr: "Weighted round robin", lc: "Least connections", hash: "IP hash", p2c: "Power of two choices" };
    const b = frame(el, "Load balancer simulator", `
      <div class="w-row" data-algos>${Object.entries(algos).map(([k, n], i) => `<button class="chip" data-a="${k}" aria-pressed="${i === 0}">${n}</button>`).join("")}</div>
      <div class="lb-stage"><div class="lb-lb"><b>Load balancer</b><span data-desc></span></div><div class="lb-servers" data-servers></div></div>
      <div class="w-row"><button class="btn sm primary" data-send>Send request</button><button class="btn sm" data-burst>Send 10</button>
        <label class="switch"><input type="checkbox" data-auto><span class="switch-track"><span class="switch-thumb"></span></span><span>Steady traffic</span></label>
        <button class="btn sm" data-reset>Reset</button></div>
      <div class="w-log" data-log><div class="w-note">Click a server to take it down (simulates a failed health check). Requests take a random 1–6 s; slow requests pile up as active connections.</div></div>`);
    const desc = {
      rr: "Takes turns: 1 → 2 → 3 → 4 → 1… Ignores how busy each server is.",
      wrr: "Takes turns in proportion to weight (bigger servers get more).",
      lc: "Sends to the server with the fewest requests in progress.",
      hash: "hash(client IP) % servers: the same client always lands on the same server.",
      p2c: "Picks two servers at random and uses the less busy one. Cheap and surprisingly good.",
    };
    let algo = "rr", rr = 0, wrrState = null, servers, auto = null, reqNo = 0;
    const IPS = ["49.36.12.7", "103.21.4.88", "157.48.9.1", "27.60.3.14", "122.161.0.9"];
    function reset() { servers = [1, 1, 2, 4].map((w, i) => ({ id: i + 1, w, active: 0, served: 0, up: true })); rr = 0; wrrState = servers.map(() => 0); draw(); }
    function draw() {
      $("[data-desc]", b).textContent = desc[algo];
      const maxServed = Math.max(1, ...servers.map((s) => s.served));
      $("[data-servers]", b).innerHTML = servers.map((s) => `
        <button class="lb-server${s.up ? "" : " down"}" data-s="${s.id - 1}" title="${s.up ? "Click to fail this server" : "Click to bring it back"}">
          <span class="lb-name">Server ${s.id}${algo === "wrr" ? ` <small>w=${s.w}</small>` : ""}</span>
          <span class="lb-dots">${Array.from({ length: Math.min(s.active, 12) }, () => "<i></i>").join("")}${s.active > 12 ? `<em>+${s.active - 12}</em>` : ""}</span>
          <span class="lb-meta">${s.up ? `${s.active} active · ${s.served} served` : "DOWN · health check failing"}</span>
          <span class="bar"><i style="width:${(s.served / maxServed) * 100}%"></i></span>
        </button>`).join("");
    }
    function pick(ip) {
      const up = servers.filter((s) => s.up);
      if (!up.length) return null;
      if (algo === "rr") { for (let i = 0; i < servers.length; i++) { const s = servers[rr++ % servers.length]; if (s.up) return s; } }
      if (algo === "wrr") { // smooth weighted round robin (nginx)
        let total = 0, best = null;
        servers.forEach((s, i) => { if (!s.up) return; wrrState[i] += s.w; total += s.w; if (!best || wrrState[i] > wrrState[best.id - 1]) best = s; });
        wrrState[best.id - 1] -= total; return best;
      }
      if (algo === "lc") return up.reduce((a, s) => (s.active < a.active ? s : a));
      if (algo === "hash") { let h = 0; for (const c of ip) h = (h * 31 + c.charCodeAt(0)) >>> 0; return up[h % up.length]; }
      if (algo === "p2c") { const a = up[Math.floor(Math.random() * up.length)], c = up[Math.floor(Math.random() * up.length)]; return a.active <= c.active ? a : c; }
    }
    function log(html) { const l = $("[data-log]", b); const n = l.querySelector(".w-note"); if (n) n.remove(); l.insertAdjacentHTML("afterbegin", `<div>${html}</div>`); while (l.children.length > 40) l.lastChild.remove(); }
    function send() {
      const ip = IPS[Math.floor(Math.random() * IPS.length)], s = pick(ip), n = ++reqNo;
      if (!s) { log(`<span class="bad">#${n} from ${ip} → 503: no healthy servers</span>`); return; }
      s.active++; s.served++;
      const dur = 1000 + Math.random() * 5000;
      log(`#${n} from ${ip} → <b>Server ${s.id}</b> <span class="w-note">(${(dur / 1000).toFixed(1)} s)</span>`);
      setTimeout(() => { s.active = Math.max(0, s.active - 1); if (el.isConnected) draw(); }, dur);
      draw();
    }
    $$("[data-a]", b).forEach((c) => c.addEventListener("click", () => { algo = c.dataset.a; $$("[data-a]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c))); draw(); }));
    $("[data-send]", b).onclick = send;
    $("[data-burst]", b).onclick = () => { for (let i = 0; i < 10; i++) send(); };
    $("[data-reset]", b).onclick = () => { reset(); $("[data-log]", b).innerHTML = ""; };
    $("[data-auto]", b).onchange = (e) => { clearInterval(auto); auto = e.target.checked ? setInterval(send, 450) : null; };
    $("[data-servers]", b).addEventListener("click", (e) => {
      const s = e.target.closest("[data-s]"); if (!s) return;
      const sv = servers[+s.dataset.s]; sv.up = !sv.up;
      log(sv.up ? `<span class="ok">Server ${sv.id} passed health check: back in rotation</span>` : `<span class="warnc">Server ${sv.id} failed health check: removed from rotation</span>`);
      draw();
    });
    onDetach(el, () => clearInterval(auto));
    reset();
  };

  /* ---------------- 5. Cache eviction (LRU vs LFU) ---------------- */
  W["cache-sim"] = function (el) {
    const b = frame(el, "Cache eviction: LRU vs LFU side by side", `
      <div class="w-controls">${slider("cap", "Cache capacity (slots)", 2, 6, 1, 3)}</div>
      <div class="w-row">${"ABCDEF".split("").map((k) => `<button class="chip" data-key="${k}">GET ${k}</button>`).join("")}
        <button class="btn sm" data-play>▶ Play sample pattern</button><button class="btn sm" data-reset>Reset</button></div>
      <div class="grid-2" data-caches></div>
      <div class="w-note" data-explain>Click keys to read them. On a miss the key is loaded into the cache; if it's full, one key is evicted. LRU evicts the key used <b>longest ago</b>; LFU evicts the key used <b>least often</b>.</div>`);
    let cap = 3, lru, lfu, tick, playing = null;
    function reset() { lru = { items: [], hit: 0, miss: 0, ev: null }; lfu = { items: [], hit: 0, miss: 0, ev: null }; tick = 0; draw(); }
    function access(k) {
      tick++;
      // LRU: array ordered most-recent first
      let i = lru.items.findIndex((x) => x.k === k); lru.ev = null; lru.last = k;
      if (i >= 0) { lru.hit++; lru.lastHit = true; lru.items.unshift(lru.items.splice(i, 1)[0]); }
      else { lru.miss++; lru.lastHit = false; if (lru.items.length >= cap) lru.ev = lru.items.pop().k; lru.items.unshift({ k }); }
      // LFU: track freq, tie → least recent
      i = lfu.items.findIndex((x) => x.k === k); lfu.ev = null; lfu.last = k;
      if (i >= 0) { lfu.hit++; lfu.lastHit = true; lfu.items[i].f++; lfu.items[i].t = tick; }
      else {
        lfu.miss++; lfu.lastHit = false;
        if (lfu.items.length >= cap) { let v = 0; lfu.items.forEach((x, j) => { const y = lfu.items[v]; if (x.f < y.f || (x.f === y.f && x.t < y.t)) v = j; }); lfu.ev = lfu.items.splice(v, 1)[0].k; }
        lfu.items.push({ k, f: 1, t: tick });
      }
      draw();
    }
    function panel(name, c, sub, items) {
      const total = c.hit + c.miss;
      return `<div class="card cs-panel"><h4>${name} <span class="w-note">· ${sub}</span></h4>
        <div class="cs-slots">${Array.from({ length: cap }, (_, i) => { const it = items[i]; return `<span class="cs-slot${it ? "" : " empty"}${it && it.k === c.last ? (c.lastHit ? " hit" : " new") : ""}">${it ? `<b>${it.k}</b>${it.f ? `<small>×${it.f}</small>` : ""}` : "–"}</span>`; }).join("")}</div>
        <div class="w-row cs-meta"><span class="ok">Hits ${c.hit}</span><span class="bad">Misses ${c.miss}</span><span>Hit rate ${total ? Math.round((c.hit / total) * 100) : 0}%</span>${c.ev ? `<span class="warnc">Evicted ${c.ev}</span>` : ""}</div></div>`;
    }
    function draw() {
      $('[data-out="cap"]', b).textContent = cap;
      const lfuSorted = lfu.items.slice().sort((a, c) => c.f - a.f || c.t - a.t);
      $("[data-caches]", b).innerHTML = panel("LRU", lru, "most recent → least recent", lru.items) + panel("LFU", lfu, "most used → least used", lfuSorted);
    }
    $$("[data-key]", b).forEach((c) => c.addEventListener("click", () => access(c.dataset.key)));
    $('[data-in="cap"]', b).addEventListener("input", (e) => { cap = +e.target.value; reset(); });
    $("[data-reset]", b).onclick = () => { clearInterval(playing); reset(); };
    $("[data-play]", b).onclick = () => {
      clearInterval(playing); reset();
      const seq = "AABACDAEAFBAGA".replace(/G/g, "B").split(""); // A is hot; LFU keeps it, LRU may not
      let i = 0; playing = setInterval(() => { if (i >= seq.length || !el.isConnected) return clearInterval(playing); access(seq[i++]); }, 650);
    };
    onDetach(el, () => clearInterval(playing));
    reset();
  };

  /* ---------------- 6. Rate limiter ---------------- */
  W["rate-limiter"] = function (el) {
    const names = { tb: "Token bucket", fw: "Fixed window", swl: "Sliding window log", swc: "Sliding window counter" };
    const b = frame(el, "Rate limiter playground: limit 5 requests / 2 seconds", `
      <div class="w-row">${Object.entries(names).map(([k, n], i) => `<button class="chip" data-algo="${k}" aria-pressed="${i === 0}">${n}</button>`).join("")}</div>
      <div class="rl-state" data-state></div>
      <div class="rl-track" data-track><span class="rl-now">now</span></div>
      <div class="w-row"><button class="btn sm primary" data-one>Send 1 request</button><button class="btn sm" data-burst>Burst of 8</button>
        <label class="switch"><input type="checkbox" data-auto><span class="switch-track"><span class="switch-thumb"></span></span><span>Steady 4 req/s</span></label></div>
      <div class="w-note" data-desc></div>`);
    const LIMIT = 5, WIN = 2000, SPAN = 10000;
    const desc = {
      tb: "Bucket holds up to 5 tokens and refills at 2.5 tokens/s. Each request spends a token. It allows short bursts, then steadies to the refill rate.",
      fw: "Counts requests in fixed 2-second slots (0–2 s, 2–4 s…). Simple, but a burst at the end of one window plus the start of the next can let through 2× the limit.",
      swl: "Stores a timestamp for every request and counts those in the last 2 s. Exact, but memory grows with traffic.",
      swc: "Estimates the last 2 s as: current window count + previous window count × overlap. Nearly exact with only 2 counters.",
    };
    let algo = "tb", events = [], st, auto = null, raf = null;
    function resetState() { st = { tokens: LIMIT, last: performance.now(), log: [], win: -1, cnt: 0, prev: 0 }; }
    function allow(now) {
      if (algo === "tb") {
        st.tokens = Math.min(LIMIT, st.tokens + ((now - st.last) / 1000) * (LIMIT / (WIN / 1000))); st.last = now;
        if (st.tokens >= 1) { st.tokens -= 1; return true; } return false;
      }
      const w = Math.floor(now / WIN);
      if (algo === "fw") { if (w !== st.win) { st.win = w; st.cnt = 0; } if (st.cnt < LIMIT) { st.cnt++; return true; } return false; }
      if (algo === "swl") { st.log = st.log.filter((t) => now - t < WIN); if (st.log.length < LIMIT) { st.log.push(now); return true; } return false; }
      if (algo === "swc") {
        if (w !== st.win) { st.prev = w === st.win + 1 ? st.cnt : 0; st.win = w; st.cnt = 0; }
        const overlap = 1 - (now % WIN) / WIN, est = st.cnt + st.prev * overlap;
        if (est < LIMIT) { st.cnt++; return true; } return false;
      }
    }
    function send() { const now = performance.now(); events.push({ t: now, ok: allow(now) }); }
    function stateText(now) {
      if (algo === "tb") {
        const t = Math.min(LIMIT, st.tokens + ((now - st.last) / 1000) * (LIMIT / (WIN / 1000)));
        return `<span class="rl-k">Tokens</span><span class="rl-tokens">${Array.from({ length: LIMIT }, (_, i) => `<i class="${i < Math.floor(t) ? "on" : ""}"></i>`).join("")}</span><span class="w-val">${t.toFixed(1)} / ${LIMIT}</span>`;
      }
      const w = Math.floor(now / WIN);
      if (algo === "fw") { const c = w === st.win ? st.cnt : 0; return `<span class="rl-k">This window</span><span class="w-val">${c} / ${LIMIT}</span><span class="w-note">resets in ${((WIN - (now % WIN)) / 1000).toFixed(1)} s</span>`; }
      if (algo === "swl") { const c = st.log.filter((t) => now - t < WIN).length; return `<span class="rl-k">Timestamps in last 2 s</span><span class="w-val">${c} / ${LIMIT}</span><span class="w-note">stored: ${st.log.length}</span>`; }
      const cur = w === st.win ? st.cnt : 0, prev = w === st.win ? st.prev : w === st.win + 1 ? st.cnt : 0, ov = 1 - (now % WIN) / WIN;
      return `<span class="rl-k">Estimate</span><span class="w-val">${cur} + ${prev} × ${ov.toFixed(2)} = ${(cur + prev * ov).toFixed(1)} / ${LIMIT}</span>`;
    }
    function frameLoop() {
      if (!el.isConnected) { clearInterval(auto); return; }
      const now = performance.now();
      events = events.filter((e) => now - e.t < SPAN);
      const track = $("[data-track]", b);
      let html = '<span class="rl-now">now</span>';
      if (algo === "fw" || algo === "swc") {
        for (let w = Math.floor((now - SPAN) / WIN); w <= Math.floor(now / WIN); w++) {
          const x = 100 - ((now - w * WIN) / SPAN) * 100; if (x > -20) html += `<span class="rl-win" style="left:${Math.max(0, x)}%"></span>`;
        }
      }
      if (algo === "swl" || algo === "swc") html += `<span class="rl-slide" style="left:${100 - (WIN / SPAN) * 100}%;width:${(WIN / SPAN) * 100}%"></span>`;
      html += events.map((e) => `<i class="rl-dot ${e.ok ? "ok" : "no"}" style="left:${100 - ((now - e.t) / SPAN) * 100}%"></i>`).join("");
      track.innerHTML = html;
      const okN = events.filter((e) => e.ok).length;
      $("[data-state]", b).innerHTML = stateText(now) + `<span class="rl-sum"><span class="ok">● ${okN} allowed</span> <span class="bad">● ${events.length - okN} rejected (429)</span> <span class="w-note">last 10 s</span></span>`;
      raf = requestAnimationFrame(frameLoop);
    }
    $$("[data-algo]", b).forEach((c) => c.addEventListener("click", () => {
      algo = c.dataset.algo; $$("[data-algo]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      events = []; resetState(); $("[data-desc]", b).textContent = desc[algo];
    }));
    $("[data-one]", b).onclick = send;
    $("[data-burst]", b).onclick = () => { for (let i = 0; i < 8; i++) setTimeout(send, i * 40); };
    $("[data-auto]", b).onchange = (e) => { clearInterval(auto); auto = e.target.checked ? setInterval(send, 250) : null; };
    resetState(); $("[data-desc]", b).textContent = desc[algo]; frameLoop();
    onDetach(el, () => { clearInterval(auto); cancelAnimationFrame(raf); });
  };

  /* ---------------- 7. Consistent hashing ring ---------------- */
  W["hash-ring"] = function (el) {
    const b = frame(el, "Consistent hashing ring", `
      <div class="w-controls">${slider("v", "Virtual nodes per server", 1, 40, 1, 1)}</div>
      <div class="w-row"><button class="btn sm primary" data-add>+ Add server</button><button class="btn sm" data-rm>− Remove last server</button><button class="btn sm" data-reset>Reset</button></div>
      <div class="hr-wrap"><svg viewBox="0 0 340 340" class="hr-svg" data-svg></svg><div class="hr-side"><div data-dist></div><div class="w-stats" data-moved></div></div></div>
      <div class="w-note">60 keys (small dots) each go to the first server marker clockwise from them. Add or remove a server and compare how many keys move against plain <code>hash % N</code>. Then raise the virtual nodes to even out the load.</div>`);
    const KEYS = 60, names = ["A", "B", "C", "D", "E", "F"];
    let n = 3, v = 1, prevRing = null, prevMod = null, moved = null;
    function h(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15; return (x >>> 0) / 4294967296; }
    const keys = Array.from({ length: KEYS }, (_, i) => ({ id: "user:" + (i * 7919 + 13), pos: h("key-" + i) }));
    function ring() {
      const pts = [];
      for (let s = 0; s < n; s++) for (let r = 0; r < v; r++) pts.push({ s, pos: h(names[s] + "#" + r) });
      return pts.sort((a, c) => a.pos - c.pos);
    }
    function assign(pts) { return keys.map((k) => { const p = pts.find((x) => x.pos >= k.pos) || pts[0]; return p.s; }); }
    function modAssign() { return keys.map((k) => Math.floor(k.pos * 4294967296) % n); }
    function draw() {
      $('[data-out="v"]', b).textContent = v;
      const pts = ring(), a = assign(pts), m = modAssign(), cx = 170, cy = 170, R = 130;
      const xy = (p, r) => [cx + r * Math.sin(p * 2 * Math.PI), cy - r * Math.cos(p * 2 * Math.PI)];
      let svg = `<circle cx="${cx}" cy="${cy}" r="${R}" class="hr-ring"/>`;
      keys.forEach((k, i) => { const [x, y] = xy(k.pos, R - 16); svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="hr-key c${a[i]}${moved && moved[i] ? " moved" : ""}"><title>${k.id} → ${names[a[i]]}</title></circle>`; });
      pts.forEach((p) => { const [x, y] = xy(p.pos, R); svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${v > 10 ? 5 : 9}" class="hr-node c${p.s}"/>${v <= 10 ? `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="hr-label">${names[p.s]}</text>` : ""}`; });
      svg += `<text x="${cx}" y="${cy - 4}" class="hr-center">${n} servers</text><text x="${cx}" y="${cy + 16}" class="hr-center small">${n * v} points on ring</text>`;
      $("[data-svg]", b).innerHTML = svg;
      const counts = names.slice(0, n).map((_, s) => a.filter((x) => x === s).length), ideal = KEYS / n;
      $("[data-dist]", b).innerHTML = `<div class="w-field-top" style="font-size:13px;font-weight:600;margin-bottom:6px"><span>Keys per server</span><span class="w-note">ideal ≈ ${ideal.toFixed(0)}</span></div>` +
        counts.map((c, s) => `<div class="hr-bar"><span class="hr-sw c${s}"></span><span>${names[s]}</span><span class="bar"><i class="c${s}" style="width:${(c / KEYS) * 100 * Math.min(n, 3)}%"></i></span><b>${c}</b></div>`).join("");
      if (prevRing) {
        const ringMoved = a.filter((x, i) => x !== prevRing[i]).length, modMoved = m.filter((x, i) => x !== prevMod[i]).length;
        $("[data-moved]", b).innerHTML = `<div class="w-stat hl"><div class="k">Moved (consistent hashing)</div><div class="v">${ringMoved} / ${KEYS}</div><div class="s">${Math.round((ringMoved / KEYS) * 100)}% of keys</div></div>
          <div class="w-stat"><div class="k">Moved (hash % N)</div><div class="v bad">${modMoved} / ${KEYS}</div><div class="s">${Math.round((modMoved / KEYS) * 100)}% of keys</div></div>`;
      } else $("[data-moved]", b).innerHTML = `<div class="w-note">Add or remove a server to see how many keys move.</div>`;
    }
    function change(fn) { const before = assign(ring()), beforeMod = modAssign(); fn(); prevRing = before; prevMod = beforeMod; const after = assign(ring()); moved = after.map((x, i) => x !== before[i]); draw(); }
    $("[data-add]", b).onclick = () => { if (n < names.length) change(() => n++); };
    $("[data-rm]", b).onclick = () => { if (n > 1) change(() => n--); };
    $("[data-reset]", b).onclick = () => { n = 3; v = 1; $('[data-in="v"]', b).value = 1; prevRing = moved = null; draw(); };
    $('[data-in="v"]', b).addEventListener("input", (e) => { v = +e.target.value; prevRing = moved = null; draw(); });
    draw();
  };

  /* ---------------- 8. Snowflake ID ---------------- */
  W.snowflake = function (el) {
    const EPOCH = 1288834974657n; // Twitter epoch (Nov 2010)
    const b = frame(el, "Snowflake ID anatomy (64 bits)", `
      <div class="w-controls">
        <label class="w-field">Datacenter ID (0–31)<input class="w-input" type="number" min="0" max="31" value="3" data-dc></label>
        <label class="w-field">Worker ID (0–31)<input class="w-input" type="number" min="0" max="31" value="17" data-wk></label>
      </div>
      <div class="w-row"><button class="btn sm primary" data-gen>Generate ID</button><button class="btn sm" data-gen5>Generate 5 in the same ms</button></div>
      <div class="sf-id" data-id></div>
      <div class="sf-bits" data-bits></div>
      <div class="sf-legend"><span><i class="sf-sign"></i>1 bit sign (always 0)</span><span><i class="sf-ts"></i>41 bits timestamp (ms since epoch, about 69 years)</span><span><i class="sf-dc"></i>5 bits datacenter</span><span><i class="sf-wk"></i>5 bits worker</span><span><i class="sf-seq"></i>12 bits sequence (4,096 IDs/ms per worker)</span></div>
      <label class="w-field">Decode any Snowflake ID<input class="w-input" data-decode placeholder="Paste an ID, e.g. 1859384822103134208"></label>
      <div class="w-stats" data-dec></div>`);
    let lastMs = -1n, seq = 0n;
    function gen() {
      let ms = BigInt(Date.now()) - EPOCH;
      if (ms === lastMs) { seq = (seq + 1n) & 4095n; } else { seq = 0n; lastMs = ms; }
      const dc = BigInt(Math.min(31, Math.max(0, +$("[data-dc]", b).value | 0))), wk = BigInt(Math.min(31, Math.max(0, +$("[data-wk]", b).value | 0)));
      return (ms << 22n) | (dc << 17n) | (wk << 12n) | seq;
    }
    function show(id) {
      const bits = id.toString(2).padStart(64, "0");
      const seg = [["sf-sign", 0, 1], ["sf-ts", 1, 42], ["sf-dc", 42, 47], ["sf-wk", 47, 52], ["sf-seq", 52, 64]];
      $("[data-id]", b).innerHTML = `<span class="w-note">ID</span> <b>${id}</b>`;
      $("[data-bits]", b).innerHTML = seg.map(([c, s, e]) => `<span class="${c}">${bits.slice(s, e)}</span>`).join("");
      $("[data-decode]", b).value = id.toString(); decode();
    }
    function decode() {
      const raw = $("[data-decode]", b).value.trim();
      if (!/^\d{1,20}$/.test(raw)) { $("[data-dec]", b).innerHTML = raw ? '<div class="w-note bad">Enter a positive integer.</div>' : ""; return; }
      const id = BigInt(raw), ts = (id >> 22n) + EPOCH;
      const d = new Date(Number(ts));
      $("[data-dec]", b).innerHTML = [["Created at", isNaN(d) ? "invalid" : d.toLocaleString()], ["Datacenter", ((id >> 17n) & 31n).toString()], ["Worker", ((id >> 12n) & 31n).toString()], ["Sequence", (id & 4095n).toString()]]
        .map(([k, v], i) => `<div class="w-stat${i === 0 ? " hl" : ""}"><div class="k">${k}</div><div class="v" style="font-size:${i === 0 ? 15 : 22}px">${esc(v)}</div></div>`).join("");
    }
    $("[data-gen]", b).onclick = () => show(gen());
    $("[data-gen5]", b).onclick = () => { let id; for (let i = 0; i < 5; i++) id = gen(); show(id); };
    $("[data-decode]", b).addEventListener("input", decode);
    show(gen());
  };

  /* ---------------- 9. Base62 ---------------- */
  W.base62 = function (el) {
    const AL = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const b = frame(el, "Base62 encoder: from database ID to short code", `
      <div class="w-controls">
        <label class="w-field">Numeric ID (e.g. auto-increment counter)<input class="w-input" data-num value="125"></label>
        <label class="w-field">Short code<input class="w-input" data-code></label>
      </div>
      <div class="b62-steps" data-steps></div>
      <div class="w-controls">${slider("len", "Code length", 4, 10, 1, 7)}</div>
      <div class="w-stats" data-cap></div>`);
    function enc(n) { if (n === 0n) return "0"; let s = ""; while (n > 0n) { s = AL[Number(n % 62n)] + s; n /= 62n; } return s; }
    function dec(s) { let n = 0n; for (const c of s) { const i = AL.indexOf(c); if (i < 0) return null; n = n * 62n + BigInt(i); } return n; }
    function steps(n) {
      if (n === 0n) return '<div class="w-note">0 encodes to "0"</div>';
      const rows = []; let x = n;
      while (x > 0n) { rows.push(`<div class="b62-row"><span>${x} ÷ 62</span><span>= ${x / 62n}</span><span>remainder <b>${x % 62n}</b> → <code>${AL[Number(x % 62n)]}</code></span></div>`); x /= 62n; }
      return rows.join("") + `<div class="w-note">Read the remainders bottom-up: <b>${enc(n)}</b></div>`;
    }
    function fromNum() {
      const r = $("[data-num]", b).value.trim();
      if (!/^\d{1,30}$/.test(r)) { $("[data-steps]", b).innerHTML = '<div class="w-note bad">Enter a non-negative integer.</div>'; return; }
      const n = BigInt(r); $("[data-code]", b).value = enc(n); $("[data-steps]", b).innerHTML = steps(n);
    }
    function fromCode() {
      const s = $("[data-code]", b).value.trim(), n = dec(s);
      if (!s || n === null) { $("[data-steps]", b).innerHTML = '<div class="w-note bad">Use only 0–9, a–z, A–Z.</div>'; return; }
      $("[data-num]", b).value = n.toString(); $("[data-steps]", b).innerHTML = steps(n);
    }
    function cap() {
      const L = +$('[data-in="len"]', b).value; $('[data-out="len"]', b).textContent = L + " chars";
      const total = Math.pow(62, L), perDay = 100e6;
      $("[data-cap]", b).innerHTML = `<div class="w-stat hl"><div class="k">Unique codes (62^${L})</div><div class="v">${fmtNum(total, 2)}</div></div>
        <div class="w-stat"><div class="k">Lasts at 100M new URLs/day</div><div class="v">${fmtDur((total / perDay) * 86400)}</div><div class="s">${(total / perDay / 365).toFixed(1)} years</div></div>`;
    }
    $("[data-num]", b).addEventListener("input", fromNum);
    $("[data-code]", b).addEventListener("input", fromCode);
    $('[data-in="len"]', b).addEventListener("input", cap);
    fromNum(); cap();
  };

  /* ---------------- 10. Fan-out cost ---------------- */
  W.fanout = function (el) {
    const b = frame(el, "Fan-out on write vs on read vs hybrid", `
      <div class="w-controls">
        ${slider("posts", "New posts per second", 1000, 20000, 1000, 6000)}
        ${slider("reads", "Feed loads per second", 10000, 1000000, 10000, 300000)}
        ${slider("avg", "Average followers per author", 50, 1000, 50, 200)}
        ${slider("follows", "Accounts each user follows", 50, 1000, 50, 300)}
        ${slider("celeb", "Share of posts from celebrities (%)", 0, 10, 0.5, 2)}
        ${slider("cf", "Followers per celebrity", 1000000, 100000000, 1000000, 30000000)}
      </div>
      <div class="fo-bars" data-bars></div>
      <div class="w-note">Write cost = feed-cache inserts per second. Read cost = posts fetched and merged per feed load. Hybrid pushes normal authors' posts but pulls celebrities' posts at read time (assumes each user follows ~5 celebrities).</div>`);
    const g = (id) => +$(`[data-in="${id}"]`, b).value;
    function draw() {
      const P = g("posts"), R = g("reads"), A = g("avg"), F = g("follows"), c = g("celeb") / 100, CF = g("cf");
      $('[data-out="posts"]', b).textContent = fmtNum(P); $('[data-out="reads"]', b).textContent = fmtNum(R); $('[data-out="avg"]', b).textContent = A;
      $('[data-out="follows"]', b).textContent = F; $('[data-out="celeb"]', b).textContent = g("celeb") + "%"; $('[data-out="cf"]', b).textContent = fmtNum(CF);
      const pushW = P * (1 - c) * A + P * c * CF, pushR = R * 1;
      const pullW = P, pullR = R * F;
      const hybW = P * (1 - c) * A, hybR = R * (1 + 5);
      const rows = [["Fan-out on write (push)", pushW, pushR, "Celebrity posts explode the writes."], ["Fan-out on read (pull)", pullW, pullR, "Every feed load hits hundreds of timelines."], ["Hybrid", hybW, hybR, "Push for most authors, pull for celebrities."]];
      const maxW = Math.max(...rows.map((r) => r[1])), maxR = Math.max(...rows.map((r) => r[2]));
      $("[data-bars]", b).innerHTML = rows.map(([n, w, r, note], i) => `<div class="fo-row${i === 2 ? " best" : ""}"><div class="fo-name"><b>${n}</b><span class="w-note">${note}</span></div>
        <div class="fo-metric"><span>Writes/s</span><span class="bar"><i style="width:${Math.max(1, (Math.log10(w + 1) / Math.log10(maxW + 1)) * 100)}%"></i></span><b>${fmtNum(w)}</b></div>
        <div class="fo-metric"><span>Reads/s</span><span class="bar"><i style="width:${Math.max(1, (Math.log10(r + 1) / Math.log10(maxR + 1)) * 100)}%"></i></span><b>${fmtNum(r)}</b></div></div>`).join("");
    }
    $$("[data-in]", b).forEach((i) => i.addEventListener("input", draw));
    draw();
  };

  /* ---------------- 11. Connection set-up cost (DNS + TCP + TLS + HTTP) ---------------- */
  W.handshake = function (el) {
    const protos = { tls12: "HTTPS · TLS 1.2", tls13: "HTTPS · TLS 1.3", quic: "HTTP/3 · QUIC", zrtt: "HTTP/3 · 0-RTT resume" };
    const rtts = [["Same city", 10], ["4G mobile", 80], ["Mumbai → Singapore", 60], ["Mumbai → US west", 230]];
    const b = frame(el, "How long before the first byte arrives?", `
      <div class="w-row">${Object.entries(protos).map(([k, n], i) => `<button class="chip" data-p="${k}" aria-pressed="${i === 1}">${n}</button>`).join("")}</div>
      <div class="w-controls">${slider("rtt", "Round-trip time (RTT)", 5, 300, 5, 80)}${slider("srv", "Server think time", 0, 300, 10, 50)}</div>
      <div class="w-row">${rtts.map(([n, v]) => `<button class="chip" data-rtt="${v}">${n} · ${v} ms</button>`).join("")}</div>
      <div class="w-row">
        <label class="switch"><input type="checkbox" data-dns><span class="switch-track"><span class="switch-thumb"></span></span><span>DNS already cached</span></label>
        <label class="switch"><input type="checkbox" data-reuse><span class="switch-track"><span class="switch-thumb"></span></span><span>Reuse open connection (keep-alive)</span></label>
      </div>
      <div class="hs-bar" data-bar></div>
      <div class="hs-legend" data-legend></div>
      <div class="w-stats" data-stats></div>
      <div class="table-wrap"><table class="hs-table" data-table></table></div>
      <div class="w-note">Simplified: DNS costs one round trip to a nearby resolver when not cached, TCP costs 1 RTT, TLS 1.2 costs 2 RTT, TLS 1.3 costs 1, QUIC does transport and TLS together in 1, and a resumed QUIC session can send the request in the very first packet (0-RTT).</div>`);
    let proto = "tls13";
    const g = (id) => +$(`[data-in="${id}"]`, b).value;
    function steps(p, rtt, srv, dnsCached, reuse) {
      const s = [];
      if (!reuse) {
        if (!dnsCached) s.push(["DNS lookup", rtt, "dns"]);
        if (p === "tls12") { s.push(["TCP handshake", rtt, "tcp"]); s.push(["TLS 1.2 handshake", 2 * rtt, "tls"]); }
        if (p === "tls13") { s.push(["TCP handshake", rtt, "tcp"]); s.push(["TLS 1.3 handshake", rtt, "tls"]); }
        if (p === "quic") s.push(["QUIC + TLS handshake", rtt, "tls"]);
      }
      s.push(["HTTP request → response", rtt, "http"]);
      if (srv) s.push(["Server work", srv, "srv"]);
      return s;
    }
    function draw() {
      const rtt = g("rtt"), srv = g("srv"), dns = $("[data-dns]", b).checked, reuse = $("[data-reuse]", b).checked;
      $('[data-out="rtt"]', b).textContent = rtt + " ms"; $('[data-out="srv"]', b).textContent = srv + " ms";
      const s = steps(proto, rtt, srv, dns, reuse), total = s.reduce((a, x) => a + x[1], 0);
      $("[data-bar]", b).innerHTML = s.map(([n, ms, c]) => `<span class="hs-seg hs-${c}" style="flex:${ms}" title="${n}: ${ms} ms"><b>${ms} ms</b></span>`).join("");
      $("[data-legend]", b).innerHTML = s.map(([n, ms, c]) => `<span><i class="hs-${c}"></i>${n}</span>`).join("");
      const trips = s.filter((x) => x[2] !== "srv").reduce((a, x) => a + x[1] / rtt, 0);
      $("[data-stats]", b).innerHTML = `<div class="w-stat hl"><div class="k">Time to first byte</div><div class="v">${total} ms</div></div>
        <div class="w-stat"><div class="k">Network round trips</div><div class="v">${trips}</div></div>
        <div class="w-stat"><div class="k">Spent on set-up</div><div class="v">${total ? Math.round(((total - rtt - srv) / total) * 100) : 0}%</div><div class="s">before the request is even sent</div></div>`;
      const rows = Object.entries(protos).map(([k, n]) => {
        const t = steps(k, rtt, srv, dns, reuse).reduce((a, x) => a + x[1], 0);
        return `<tr${k === proto ? ' class="hs-cur"' : ""}><td>${n}</td><td>${t} ms</td></tr>`;
      });
      $("[data-table]", b).innerHTML = `<thead><tr><th>Protocol</th><th>Time to first byte at ${rtt} ms RTT</th></tr></thead><tbody>${rows.join("")}</tbody>`;
    }
    $$("[data-p]", b).forEach((c) => c.addEventListener("click", () => {
      proto = c.dataset.p; $$("[data-p]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
      if (proto === "zrtt") { $("[data-dns]", b).checked = true; }
      draw();
    }));
    $$("[data-rtt]", b).forEach((c) => c.addEventListener("click", () => { $('[data-in="rtt"]', b).value = c.dataset.rtt; draw(); }));
    $$("[data-in], [data-dns], [data-reuse]", b).forEach((i) => i.addEventListener("input", draw));
    draw();
  };

  /* ---------------- 12. Polling vs long polling vs SSE vs WebSocket ---------------- */
  W.polling = function (el) {
    const b = frame(el, "Same live updates, four ways to receive them", `
      <div class="w-controls">${slider("int", "Short-polling interval", 1, 10, 1, 3)}${slider("ev", "Server events in 30 seconds", 1, 15, 1, 6)}</div>
      <div class="w-row"><button class="btn sm" data-new>New random events</button><span class="w-note">◆ event happens on the server · | request sent by the client · ● update reaches the client</span></div>
      <div class="pl-wrap" data-svg></div>
      <div class="table-wrap"><table data-table></table></div>
      <div class="w-note">Assumes a 100 ms round trip. A short-polling update waits until the next poll; the other three push it in about half a round trip. Long polling re-opens a request after every update, while SSE and WebSockets keep one connection open.</div>`);
    const SPAN = 30, HALF = 0.05;
    let seed = 7, events = [];
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    function gen() { const n = +$('[data-in="ev"]', b).value; events = Array.from({ length: n }, () => +(1 + rnd() * (SPAN - 2)).toFixed(2)).sort((a, c) => a - c); }
    function model(kind, P) {
      if (kind === "short") {
        const reqs = []; for (let t = 0; t <= SPAN; t += P) reqs.push(t);
        const del = events.map((e) => { const nxt = reqs.find((r) => r >= e); return nxt == null ? null : nxt + HALF * 2; });
        const empty = reqs.filter((r, i) => !events.some((e) => e <= r && e > (i ? reqs[i - 1] : -1))).length;
        return { reqs, del, empty };
      }
      if (kind === "long") {
        const reqs = [0]; events.forEach((e) => reqs.push(+(e + HALF * 2).toFixed(2)));
        return { reqs, del: events.map((e) => e + HALF), empty: 0 };
      }
      return { reqs: [0], del: events.map((e) => e + HALF), empty: 0 };
    }
    function draw() {
      const P = +$('[data-in="int"]', b).value;
      $('[data-out="int"]', b).textContent = P + " s"; $('[data-out="ev"]', b).textContent = events.length;
      const kinds = [["short", "Short polling"], ["long", "Long polling"], ["sse", "Server-Sent Events"], ["ws", "WebSocket"]];
      const W0 = 120, W1 = 660, x = (t) => W0 + (t / SPAN) * (W1 - W0), rowH = 48;
      let svg = `<svg viewBox="0 0 680 ${40 + kinds.length * rowH}" class="pl-svg">`;
      svg += `<text x="${W0}" y="14" class="s-muted">0 s</text><text x="${W1}" y="14" class="s-muted" text-anchor="end">${SPAN} s</text>`;
      events.forEach((e) => { svg += `<path d="M${x(e)},20 l5,6 l-5,6 l-5,-6z" class="pl-ev"/><line x1="${x(e)}" y1="32" x2="${x(e)}" y2="${32 + kinds.length * rowH}" class="pl-guide"/>`; });
      const rows = [];
      kinds.forEach(([k, n], i) => {
        const m = model(k, P), y = 40 + i * rowH + rowH / 2;
        svg += `<text x="0" y="${y + 4}" class="s-text pl-name">${n}</text><line x1="${W0}" y1="${y}" x2="${W1}" y2="${y}" class="s-line pl-axis"/>`;
        if (k === "sse" || k === "ws") svg += `<rect x="${W0}" y="${y - 5}" width="${W1 - W0}" height="10" rx="5" class="pl-conn"/>`;
        m.reqs.forEach((r) => { svg += `<line x1="${x(r)}" y1="${y - 10}" x2="${x(r)}" y2="${y + 10}" class="pl-req"/>`; });
        m.del.forEach((d) => { if (d != null && d <= SPAN) svg += `<circle cx="${x(d)}" cy="${y}" r="5" class="pl-del"/>`; });
        const delays = m.del.map((d, j) => (d == null ? null : d - events[j])).filter((d) => d != null);
        const avg = delays.length ? delays.reduce((a, c) => a + c, 0) / delays.length : 0;
        rows.push(`<tr><td>${n}</td><td>${m.reqs.length}</td><td>${m.empty}</td><td>${avg < 1 ? Math.round(avg * 1000) + " ms" : avg.toFixed(1) + " s"}</td><td>${k === "ws" ? "Both ways" : k === "sse" ? "Server → client" : "Client asks"}</td></tr>`);
      });
      $("[data-svg]", b).innerHTML = svg + "</svg>";
      $("[data-table]", b).innerHTML = `<thead><tr><th>Method</th><th>HTTP requests</th><th>Empty responses</th><th>Avg delay</th><th>Direction</th></tr></thead><tbody>${rows.join("")}</tbody>`;
    }
    $('[data-in="int"]', b).addEventListener("input", draw);
    $('[data-in="ev"]', b).addEventListener("input", () => { gen(); draw(); });
    $("[data-new]", b).onclick = () => { seed = Math.floor(Math.random() * 1e6) + 1; gen(); draw(); };
    gen(); draw();
  };

  /* ---------------- 13. Quorum reads & writes ---------------- */
  W.quorum = function (el) {
    const b = frame(el, "Quorums: when can a read return stale data?", `
      <div class="w-controls">${slider("n", "Replicas (N)", 1, 7, 1, 3)}${slider("w", "Write acks needed (W)", 1, 3, 1, 2)}${slider("r", "Replicas read (R)", 1, 3, 1, 2)}</div>
      <div class="w-row"><button class="chip" data-preset="1,1">Fast (R=1, W=1)</button><button class="chip" data-preset="q">Quorum (majority)</button><button class="chip" data-preset="all">Write all (W=N, R=1)</button></div>
      <div class="qr-replicas" data-reps></div>
      <div class="w-row"><button class="btn sm primary" data-write>Write a new version</button><button class="btn sm" data-read>Read</button><button class="btn sm" data-worst>Worst-case read</button></div>
      <div class="qr-result" data-res></div>
      <div class="w-stats" data-stats></div>`);
    let ver = [], cur = 1, lastRead = [], lastWrite = [];
    const g = (id) => +$(`[data-in="${id}"]`, b).value;
    const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
    function clamp() {
      const n = g("n");
      ["w", "r"].forEach((k) => { const i = $(`[data-in="${k}"]`, b); i.max = n; if (+i.value > n) i.value = n; });
      if (ver.length !== n) { ver = Array(n).fill(cur); lastRead = []; lastWrite = []; $("[data-res]", b).innerHTML = ""; }
    }
    function pick(k, n) { const idx = [...Array(n).keys()]; for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx.slice(0, k); }
    function draw() {
      clamp();
      const n = g("n"), w = g("w"), r = g("r");
      $('[data-out="n"]', b).textContent = n; $('[data-out="w"]', b).textContent = w; $('[data-out="r"]', b).textContent = r;
      $("[data-reps]", b).innerHTML = ver.map((v, i) => `<div class="qr-rep${v === cur ? " fresh" : " stale"}${lastRead.includes(i) ? " read" : ""}${lastWrite.includes(i) ? " wrote" : ""}">
        <span class="qr-name">Replica ${i + 1}</span><b>v${v}</b><small>${v === cur ? "latest" : "stale"}</small></div>`).join("");
      const overlap = r + w > n, pStale = C(n - w, r) / C(n, r);
      $("[data-stats]", b).innerHTML = `
        <div class="w-stat${overlap ? " hl" : ""}"><div class="k">R + W vs N</div><div class="v ${overlap ? "ok" : "bad"}">${r} + ${w} ${overlap ? ">" : "≤"} ${n}</div><div class="s">${overlap ? "read and write sets always overlap" : "a read can miss every fresh copy"}</div></div>
        <div class="w-stat"><div class="k">Chance a random read is stale</div><div class="v">${(pStale * 100).toFixed(pStale && pStale < 0.01 ? 2 : 0)}%</div><div class="s">right after a write</div></div>
        <div class="w-stat"><div class="k">Writes survive</div><div class="v">${n - w} down</div></div>
        <div class="w-stat"><div class="k">Reads survive</div><div class="v">${n - r} down</div></div>`;
    }
    function write() {
      const n = g("n"), w = g("w"); cur++; lastWrite = pick(w, n); lastRead = [];
      lastWrite.forEach((i) => (ver[i] = cur));
      $("[data-res]", b).innerHTML = `<span>Wrote <b>v${cur}</b> to ${w} of ${n} replicas and acknowledged the client. The other ${n - w} still hold old data (they'd catch up later via read repair or anti-entropy).</span>`;
      draw();
    }
    function read(worst) {
      const n = g("n"), r = g("r");
      if (worst) { const order = [...Array(n).keys()].sort((a, c) => ver[a] - ver[c]); lastRead = order.slice(0, r); } else lastRead = pick(r, n);
      lastWrite = [];
      const best = Math.max(...lastRead.map((i) => ver[i])), ok = best === cur;
      $("[data-res]", b).innerHTML = `<span class="${ok ? "ok" : "bad"}"><b>${ok ? "✓ Fresh read" : "✗ Stale read"}</b>: asked replicas ${lastRead.map((i) => i + 1).join(", ")} and took the highest version, v${best}${ok ? "" : `, but the latest is v${cur}`}.</span>`;
      draw();
    }
    $$("[data-in]", b).forEach((i) => i.addEventListener("input", draw));
    $$("[data-preset]", b).forEach((c) => c.addEventListener("click", () => {
      const n = g("n"), p = c.dataset.preset, q = Math.floor(n / 2) + 1;
      const [w, r] = p === "q" ? [q, q] : p === "all" ? [n, 1] : [1, 1];
      $('[data-in="w"]', b).value = w; $('[data-in="r"]', b).value = r; draw();
    }));
    $("[data-write]", b).onclick = write;
    $("[data-read]", b).onclick = () => read(false);
    $("[data-worst]", b).onclick = () => read(true);
    draw();
  };

  /* ---------------- 14. Sharding strategies & hot keys ---------------- */
  W.sharding = function (el) {
    const b = frame(el, "Sharding: where does the load land?", `
      <div class="w-row">${[["range", "Range (by user ID)"], ["hash", "Hash (hash % 4)"], ["dir", "Directory (lookup table)"]].map(([k, n], i) => `<button class="chip" data-s="${k}" aria-pressed="${i === 0}">${n}</button>`).join("")}</div>
      <div class="w-row">
        <label class="switch"><input type="checkbox" data-hot checked><span class="switch-track"><span class="switch-thumb"></span></span><span>Celebrity key: user 42 gets 30% of traffic</span></label>
        <label class="switch"><input type="checkbox" data-new><span class="switch-track"><span class="switch-thumb"></span></span><span>Most traffic is from new sign-ups</span></label>
      </div>
      <div class="w-row" data-fix></div>
      <div class="sh-shards" data-shards></div>
      <div class="w-stats" data-stats></div>
      <div class="w-note" data-note></div>`);
    const N = 4, USERS = 1000, HOT = 42;
    let strat = "range", salted = false, isolated = false;
    const h = (k) => { let x = (k * 2654435761) >>> 0; x ^= x >>> 15; return x >>> 0; };
    function shardOf(u) {
      if (strat === "range") return Math.min(N - 1, Math.floor((u - 1) / (USERS / N)));
      if (strat === "hash") return h(u) % N;
      if (u === HOT && isolated) return N; // dedicated shard
      return h(u) % N;
    }
    function draw() {
      const hot = $("[data-hot]", b).checked, fresh = $("[data-new]", b).checked;
      const shards = strat === "dir" && isolated ? N + 1 : N;
      const load = Array(shards).fill(0), keys = Array(shards).fill(0);
      for (let u = 1; u <= USERS; u++) {
        let w = fresh ? (u > USERS * 0.9 ? 8 : 0.2) : 1;
        keys[shardOf(u)]++;
        if (u === HOT && hot) continue;
        load[shardOf(u)] += w;
      }
      const base = load.reduce((a, c) => a + c, 0);
      if (hot) {
        const hotLoad = (base * 0.3) / 0.7;
        if (strat === "hash" && salted) for (let i = 0; i < N; i++) load[i] += hotLoad / N;
        else load[shardOf(HOT)] += hotLoad;
      }
      const total = load.reduce((a, c) => a + c, 0), max = Math.max(...load), avg = total / shards;
      $("[data-shards]", b).innerHTML = load.map((l, i) => {
        const pct = (l / total) * 100, over = l / avg;
        return `<div class="sh-shard${over > 1.6 ? " hot" : ""}"><div class="sh-name">${i === N ? "Shard 5 (dedicated)" : "Shard " + (i + 1)}</div>
          <div class="sh-meter"><i style="height:${Math.max(3, (l / max) * 100)}%"></i></div>
          <div class="sh-pct">${pct.toFixed(0)}%</div><div class="w-note">${keys[i]} users${strat === "range" && i < N ? `<br>IDs ${i * 250 + 1}–${(i + 1) * 250}` : ""}</div></div>`;
      }).join("");
      $("[data-stats]", b).innerHTML = `<div class="w-stat${max / avg > 1.6 ? "" : " hl"}"><div class="k">Busiest shard vs average</div><div class="v ${max / avg > 1.6 ? "bad" : "ok"}">${(max / avg).toFixed(2)}×</div><div class="s">1.00× = perfectly even</div></div>`;
      const fix = $("[data-fix]", b);
      fix.innerHTML = strat === "hash" ? `<label class="switch"><input type="checkbox" data-salt ${salted ? "checked" : ""}><span class="switch-track"><span class="switch-thumb"></span></span><span>Salt the hot key (42#0…42#3 spread over all shards)</span></label>`
        : strat === "dir" ? `<button class="btn sm" data-iso>${isolated ? "Undo: put user 42 back" : "Move user 42 to its own shard"}</button>` : "";
      const s = $("[data-salt]", fix); if (s) s.onchange = (e) => { salted = e.target.checked; draw(); };
      const iso = $("[data-iso]", fix); if (iso) iso.onclick = () => { isolated = !isolated; draw(); };
      $("[data-note]", b).textContent = {
        range: "Range sharding keeps nearby IDs together, which makes range queries easy, but new sign-ups all land on the last shard and a hot key overloads its whole range.",
        hash: "Hashing spreads users evenly and fixes the new-sign-up hotspot, but range queries must hit every shard, and one celebrity key still lands on a single shard unless you salt it.",
        dir: "A lookup table can place any key anywhere, so you can give a celebrity its own shard. The cost: every request needs a lookup, and the directory must be highly available and cached.",
      }[strat];
    }
    $$("[data-s]", b).forEach((c) => c.addEventListener("click", () => { strat = c.dataset.s; $$("[data-s]", b).forEach((x) => x.setAttribute("aria-pressed", String(x === c))); draw(); }));
    $$("[data-hot], [data-new]", b).forEach((i) => i.addEventListener("change", draw));
    draw();
  };
})();
