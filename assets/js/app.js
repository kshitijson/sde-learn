/* ===================================================================
   System Design Notes: app shell
   Router · sidebar · search · progress · code tabs · diagrams · TOC
   =================================================================== */
(function () {
  "use strict";

  const VERSION = "1";
  const PAGES = window.SD_PAGES;
  const SECTIONS = window.SD_SECTIONS;
  const GROUPS = window.SD_GROUPS;
  const byId = Object.fromEntries(PAGES.map((p) => [p.id, p]));
  const sectionById = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
  const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const available = () => PAGES.filter((p) => !p.soon);

  const LANGS = [
    { id: "java", name: "Java", prism: "java" },
    { id: "python", name: "Python", prism: "python" },
    { id: "cpp", name: "C++", prism: "cpp" },
    { id: "javascript", name: "JavaScript", short: "JS", prism: "javascript" },
    { id: "go", name: "Go", prism: "go" },
  ];

  const CDN = {
    prism: "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/",
    mermaid: "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js",
  };

  /* ---------------- tiny helpers ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const unraw = (s) => (typeof s === "string" ? s.replace(/\\`/g, "`").replace(/\\\$\{/g, "${") : s);
  const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  let uid = 0;

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="M5 12h14M13 5l7 7-7 7"/>',
    left: '<path d="M19 12H5M11 19l-7-7 7-7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    zoom: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
    play: '<path d="m7 4 13 8-13 8z"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2v4l5 6-5 6v4M17 2v4l-5 6 5 6v4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  const icon = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const hydrateIcons = (root = document) => $$("[data-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });

  /* ---------------- persistent state ---------------- */
  const KEY = "sdn:v1";
  let state = { done: {}, lang: "java", theme: null, level: "all", showSoon: true, collapsed: {}, last: null };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  if (!LANGS.some((l) => l.id === state.lang)) state.lang = "java";

  /* ---------------- script loader ---------------- */
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src; s.async = false;
        s.onload = () => res();
        s.onerror = () => { delete loaded[src]; s.remove(); rej(new Error("Failed to load " + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  let prismReady = null;
  function loadPrism() {
    if (!prismReady) {
      window.Prism = window.Prism || { manual: true };
      window.Prism.manual = true;
      const c = CDN.prism + "components/";
      prismReady = loadScript(CDN.prism + "prism.min.js")
        .then(() => Promise.all(["prism-clike", "prism-c", "prism-java", "prism-python", "prism-javascript", "prism-go"].map((n) => loadScript(c + n + ".min.js"))))
        .then(() => loadScript(c + "prism-cpp.min.js"))
        .catch(() => null);
    }
    return prismReady;
  }

  let mermaidReady = null;
  function loadMermaid() {
    if (!mermaidReady) mermaidReady = loadScript(CDN.mermaid).then(() => { configureMermaid(); return window.mermaid; });
    return mermaidReady;
  }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function configureMermaid() {
    if (!window.mermaid) return;
    const v = (n) => cssVar("--" + n);
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "Inter, system-ui, sans-serif",
      flowchart: { curve: "basis", padding: 14, nodeSpacing: 46, rankSpacing: 52, htmlLabels: true },
      sequence: { mirrorActors: false, actorMargin: 60, boxMargin: 8, messageMargin: 38, noteMargin: 10, useMaxWidth: true },
      class: { useMaxWidth: true },
      er: { useMaxWidth: true },
      themeVariables: {
        darkMode: document.documentElement.dataset.theme === "dark",
        fontSize: "14px",
        background: v("surface"),
        primaryColor: v("accent-soft"), primaryBorderColor: v("accent"), primaryTextColor: v("text"),
        secondaryColor: v("surface-2"), secondaryBorderColor: v("border-strong"), secondaryTextColor: v("text"),
        tertiaryColor: v("surface-2"), tertiaryBorderColor: v("border-strong"), tertiaryTextColor: v("text"),
        mainBkg: v("accent-soft"), nodeBorder: v("accent"), nodeTextColor: v("text"),
        lineColor: v("text-2"), textColor: v("text"), titleColor: v("text"),
        clusterBkg: v("surface-2"), clusterBorder: v("border-strong"), edgeLabelBackground: v("surface"),
        actorBkg: v("accent-soft"), actorBorder: v("accent"), actorTextColor: v("text"), actorLineColor: v("border-strong"),
        signalColor: v("text-2"), signalTextColor: v("text"),
        labelBoxBkgColor: v("surface-2"), labelBoxBorderColor: v("border-strong"), labelTextColor: v("text"), loopTextColor: v("text"),
        noteBkgColor: v("amber-soft"), noteBorderColor: v("amber"), noteTextColor: v("text"),
        activationBkgColor: v("surface-3"), activationBorderColor: v("accent"), sequenceNumberColor: v("surface"),
        classText: v("text"), attributeBackgroundColorOdd: v("surface"), attributeBackgroundColorEven: v("surface-2"),
        labelColor: v("text"), altBackground: v("surface-2"),
      },
    });
  }

  /* ---------------- content registry ---------------- */
  const content = {};
  const waiting = {};
  window.SD = {
    register(def) {
      ["html"].forEach((k) => (def[k] = unraw(def[k])));
      Object.values(def.code || {}).forEach((c) => LANGS.forEach((l) => (c[l.id] = unraw(c[l.id]))));
      Object.keys(def.diagrams || {}).forEach((k) => (def.diagrams[k] = unraw(def.diagrams[k])));
      content[def.id] = def;
      if (waiting[def.id]) { waiting[def.id].forEach((f) => f(def)); delete waiting[def.id]; }
    },
  };
  function fetchContent(page) {
    if (content[page.id]) return Promise.resolve(content[page.id]);
    return new Promise((res, rej) => {
      (waiting[page.id] = waiting[page.id] || []).push(res);
      loadScript(page.file + "?v=" + VERSION).then(() => {
        setTimeout(() => { if (!content[page.id]) rej(new Error("Content file did not register " + page.id)); }, 50);
      }, rej);
    });
  }

  /* ---------------- theme ---------------- */
  function applyTheme(t, persist) {
    document.documentElement.dataset.theme = t;
    const meta = $("#theme-color"); if (meta) meta.content = t === "dark" ? "#0b0d13" : "#f7f7fb";
    $("#theme-btn").innerHTML = icon(t === "dark" ? "sun" : "moon");
    if (persist) { state.theme = t; save(); }
  }
  function toggleTheme() { setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true); }
  function setTheme(t, persist) {
    if (document.documentElement.dataset.theme === t) return;
    applyTheme(t, persist);
    if (window.mermaid) { configureMermaid(); renderDiagrams($("#view"), true); }
    document.dispatchEvent(new CustomEvent("sd:theme"));
  }

  /* ---------------- progress ---------------- */
  const isDone = (id) => !!state.done[id];
  function setDone(id, val) {
    if (val) state.done[id] = Date.now(); else delete state.done[id];
    save(); updateProgressUI();
  }
  function stats(filter = () => true) {
    const av = available().filter(filter);
    const done = av.filter((p) => isDone(p.id)).length;
    const total = PAGES.filter(filter).length;
    return { done, av: av.length, total, pct: av.length ? Math.round((done / av.length) * 100) : 0 };
  }
  function updateProgressUI() {
    const s = stats();
    $("#pill-text").textContent = `${s.done} / ${s.av}`;
    const r = $("#pill-ring"), C = 2 * Math.PI * 15;
    r.style.strokeDasharray = C; r.style.strokeDashoffset = C * (1 - (s.av ? s.done / s.av : 0));
    $("#progress-pill").title = `${s.done} of ${s.av} available pages complete (${s.total} planned)`;
    $$(".nav-item[data-id]").forEach((li) => {
      const d = $(".status-dot", li);
      if (d && !li.classList.contains("soon")) d.classList.toggle("done", isDone(li.dataset.id));
    });
    $$(".nav-section").forEach((sec) => {
      const st = stats((p) => p.section === sec.dataset.section);
      const c = $(".nav-count", sec); if (c) c.textContent = st.av ? `${st.done}/${st.av}` : "soon";
    });
  }

  /* ---------------- sidebar ---------------- */
  function levelMatch(p) { return state.level === "all" || p.level === state.level; }
  function renderNav() {
    const nav = $("#nav");
    let html = "";
    GROUPS.forEach((g) => {
      let gHtml = "";
      SECTIONS.filter((s) => s.group === g.id).forEach((s) => {
        const items = PAGES.filter((p) => p.section === s.id && levelMatch(p) && (state.showSoon || !p.soon));
        if (!items.length) return;
        const hasAvail = PAGES.some((p) => p.section === s.id && !p.soon);
        const collapsed = s.id in state.collapsed ? state.collapsed[s.id] : !hasAvail;
        gHtml += `<div class="nav-section" data-section="${s.id}" data-collapsed="${collapsed}">
          <button class="nav-section-btn" aria-expanded="${!collapsed}">${icon("chevron", "chev")}<span>${esc(s.title)}</span><span class="nav-count"></span></button>
          <ul class="nav-items">${items.map((p) => `
            <li class="nav-item${p.soon ? " soon" : ""}" data-id="${p.id}">
              <a href="#/p/${p.id}"><span class="status-dot${p.soon ? " soon" : ""}"></span><span class="nav-label">${esc(p.title)}</span>${
                p.soon ? '<span class="mini-tag soon">soon</span>' : p.difficulty ? `<span class="mini-tag ${p.difficulty}">${p.difficulty[0].toUpperCase()}</span>` : ""
              }</a></li>`).join("")}</ul></div>`;
      });
      if (gHtml) html += `<div class="nav-group"><div class="nav-group-title">${icon(g.icon)}<a href="#/g/${g.id}">${esc(g.title)}</a></div>${gHtml}</div>`;
    });
    nav.innerHTML = html || '<div class="nav-empty">Nothing matches this filter.</div>';
    $$("#level-filter button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === state.level)));
    $("#show-soon").checked = state.showSoon;
    updateProgressUI(); markActiveNav();
  }
  function markActiveNav() {
    const id = current.page;
    $$(".nav-item a").forEach((a) => {
      const on = a.parentElement.dataset.id === id;
      a.classList.toggle("active", on);
      if (on) {
        a.setAttribute("aria-current", "page");
        const sec = a.closest(".nav-section");
        if (sec && sec.dataset.collapsed === "true") { sec.dataset.collapsed = "false"; }
        const sb = $("#sidebar"), r = a.getBoundingClientRect(), sr = sb.getBoundingClientRect();
        if (r.top < sr.top + 80 || r.bottom > sr.bottom - 40) sb.scrollTop += r.top - sr.top - sr.height / 3;
      } else a.removeAttribute("aria-current");
    });
  }
  function bindSidebar() {
    $("#nav").addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-section-btn");
      if (btn) {
        const sec = btn.parentElement, c = sec.dataset.collapsed !== "true";
        sec.dataset.collapsed = String(c); btn.setAttribute("aria-expanded", String(!c));
        state.collapsed[sec.dataset.section] = c; save();
      } else if (e.target.closest("a")) closeNav();
    });
    $("#level-filter").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.level = b.dataset.level; save(); renderNav();
    });
    $("#show-soon").addEventListener("change", (e) => { state.showSoon = e.target.checked; save(); renderNav(); });
    $("#menu-btn").addEventListener("click", () => (document.body.classList.contains("nav-open") ? closeNav() : openNav()));
    $("#scrim").addEventListener("click", closeNav);
  }
  function openNav() { document.body.classList.add("nav-open"); $("#menu-btn").setAttribute("aria-expanded", "true"); }
  function closeNav() { document.body.classList.remove("nav-open"); $("#menu-btn").setAttribute("aria-expanded", "false"); }

  /* ---------------- router ---------------- */
  const current = { page: null, route: null };
  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [kind, id, anchor] = h.split("/");
    return { kind: kind || "home", id, anchor };
  }
  function route() {
    const r = parseHash();
    if (r.kind === "p" && current.page === r.id && current.route === "p") {
      if (r.anchor) scrollToAnchor(r.anchor);
      return;
    }
    current.route = r.kind;
    current.page = r.kind === "p" ? r.id : null;
    teardownPage();
    if (r.kind === "home") renderHome();
    else if (r.kind === "p" && byId[r.id]) renderPage(byId[r.id], r.anchor);
    else if (r.kind === "g" && groupById[r.id]) renderGroup(r.id);
    else if (r.kind === "s" && sectionById[r.id]) renderGroup(sectionById[r.id].group, r.id);
    else renderNotFound();
    markActiveNav();
  }
  function setView(html, title) {
    const v = $("#view");
    v.innerHTML = html;
    v.firstElementChild && v.firstElementChild.classList.add("view-enter");
    document.title = title ? `${title} · System Design Notes` : "System Design Notes";
    hydrateIcons(v);
  }
  function scrollTopNow() { window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" }); }

  /* ---------------- home ---------------- */
  const PATHS = {
    s1: ["interview-framework", "requirements", "estimation", "scaling", "load-balancers", "caching", "api-gateway-rate-limiting", "object-storage",
      "sql-vs-nosql", "realtime", "oop", "solid", "url-shortener", "rate-limiter", "parking-lot", "lru-cache-lld"],
    s2: ["latency-throughput", "availability", "message-queues", "consistent-hashing", "unique-ids", "replication", "sharding", "cap-theorem",
      "idempotency", "distributed-transactions", "chat-system", "news-feed", "payment-system", "ticket-booking", "splitwise"],
  };
  function itemCard(p) {
    const lvl = p.level ? `<span class="tag ${p.level}">${p.level === "s1" ? "SDE 1" : "SDE 2"}</span>` : '<span class="tag gtk">Good to know</span>';
    const diff = p.difficulty ? `<span class="tag ${p.difficulty}">${p.difficulty[0].toUpperCase() + p.difficulty.slice(1)}</span>` : "";
    const kind = p.kind === "problem" ? `<span class="tag kind">${p.section === "problems-lld" ? "LLD" : "HLD"}</span>` : "";
    return `<a class="item-card${p.soon ? " soon" : ""}" href="#/p/${p.id}">
      ${isDone(p.id) ? `<span class="done-mark">${icon("check")}</span>` : ""}
      <div class="tags">${diff}${kind}${lvl}${p.soon ? '<span class="tag gtk">Coming soon</span>' : ""}</div>
      <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></a>`;
  }
  function renderHome() {
    const s = stats();
    const last = state.last && byId[state.last] && !byId[state.last].soon ? byId[state.last] : null;
    const firstUndone = available().find((p) => !isDone(p.id)) || available()[0];
    const C = 2 * Math.PI * 88;
    const groupDesc = {
      hld: "Architecture building blocks: scaling, caching, queues, databases and distributed systems.",
      lld: "OOP, SOLID, design patterns and how to model classes in a machine-coding round.",
      problems: "Classic interview problems solved end to end, with code in 5 languages.",
    };
    const pathList = (ids) => ids.map((id, i) => {
      const p = byId[id]; if (!p) return "";
      return `<li class="${p.soon ? "soon" : ""} ${isDone(id) ? "done" : ""}"><a href="#/p/${id}"><span class="num">${isDone(id) ? icon("check") : i + 1}</span>${esc(p.title)}${p.soon ? '<span class="mini-tag soon">soon</span>' : ""}</a></li>`;
    }).join("");
    const problems = PAGES.filter((p) => p.kind === "problem").sort((a, b) => !!a.soon - !!b.soon);

    setView(`<div class="home">
      <section class="hero">
        <div class="hero-grid-bg"></div>
        <div>
          <div class="eyebrow">SDE 1 · SDE 2 interview prep</div>
          <h1>Master the <span>system design</span> round.</h1>
          <p>Visual, interactive notes on High-Level and Low-Level Design, plus practice problems solved step by step, with code in Java, Python, C++, JavaScript and Go.</p>
          <div class="hero-actions">
            <a class="btn primary" href="#/p/${(last || firstUndone).id}">${icon("play")}${last ? "Continue learning" : "Start learning"}</a>
            <a class="btn" href="#/g/problems">${icon("target")}Practice problems</a>
            <button class="btn" data-open-search>${icon("search")}Search</button>
          </div>
        </div>
        <div class="ring-big" aria-label="${s.pct}% complete">
          <svg viewBox="0 0 200 200"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="ring-stop-a"/><stop offset="1" class="ring-stop-b"/></linearGradient></defs>
            <circle cx="100" cy="100" r="88" class="ring-bg"/><circle cx="100" cy="100" r="88" class="ring-fg" id="home-ring" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
          <div class="ring-center"><b>${s.pct}%</b><span>${s.done} of ${s.av} done</span></div>
        </div>
      </section>
      ${last ? `<a class="resume-card" href="#/p/${last.id}"><span class="ri">${icon("book")}</span><span><small>Pick up where you left off</small><b>${esc(last.title)}</b></span><span class="go">${icon("right")}</span></a>` : ""}

      <section class="home-section">
        <div class="home-section-head"><div><h2>Choose a track</h2><p>${s.av} pages ready now, ${s.total - s.av} more on the way.</p></div></div>
        <div class="group-cards">${GROUPS.map((g) => {
          const st = stats((p) => p.group === g.id);
          return `<a class="group-card" href="#/g/${g.id}"><span class="group-icon">${icon(g.icon)}</span><h3>${esc(g.title)}</h3><p>${groupDesc[g.id]}</p>
            <div class="bar-label"><span>${st.av ? `${st.done}/${st.av} done` : "Coming in batch 3"}</span><span>${st.total} planned</span></div><div class="bar"><i data-w="${st.av ? (st.done / st.av) * 100 : 0}"></i></div></a>`;
        }).join("")}</div>
      </section>

      <section class="home-section">
        <div class="home-section-head"><div><h2>Study paths</h2><p>A suggested order for your target level. Dimmed items arrive in later batches.</p></div></div>
        <div class="paths">
          <div class="path-card"><h3><span class="tag s1">SDE 1</span> Core path</h3><p>Fundamentals, building blocks and the classic easy problems.</p><ol class="path-list">${pathList(PATHS.s1)}</ol></div>
          <div class="path-card"><h3><span class="tag s2">SDE 2</span> Depth path</h3><p>Do the SDE 1 path first, then go deeper into distributed systems.</p><ol class="path-list">${pathList(PATHS.s2)}</ol></div>
        </div>
      </section>

      <section class="home-section" id="problems">
        <div class="home-section-head"><div><h2>Practice problems</h2><p>Try each one yourself first. Every problem has hints before the full solution.</p></div>
          <div class="filter-row" id="prob-filter">
            ${["All", "Easy", "Medium", "Hard", "HLD", "LLD"].map((f, i) => `<button class="chip" data-f="${f}" aria-pressed="${i === 0}">${f}</button>`).join("")}
          </div></div>
        <div class="item-grid" id="prob-grid">${problems.map(itemCard).join("")}</div>
      </section>
    </div>`);

    requestAnimationFrame(() => {
      const ring = $("#home-ring"); if (ring) setTimeout(() => (ring.style.strokeDashoffset = C * (1 - s.pct / 100)), 60);
      $$(".bar > i").forEach((b) => setTimeout(() => (b.style.width = b.dataset.w + "%"), 60));
    });
    $("#prob-filter").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      $$("#prob-filter .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      const f = b.dataset.f;
      const list = problems.filter((p) => f === "All" || (f === "HLD" && p.section === "problems-hld") || (f === "LLD" && p.section === "problems-lld") || p.difficulty === f.toLowerCase());
      $("#prob-grid").innerHTML = list.map(itemCard).join("");
    });
    scrollTopNow();
  }

  /* ---------------- group / section listing ---------------- */
  function renderGroup(gid, onlySection) {
    const g = groupById[gid];
    const secs = SECTIONS.filter((s) => s.group === gid && (!onlySection || s.id === onlySection));
    const st = stats((p) => p.group === gid);
    setView(`<div class="home">
      <div class="breadcrumb"><a href="#/">Home</a><span class="sep">/</span><span>${esc(g.title)}</span></div>
      <h1 class="page-title">${esc(onlySection ? sectionById[onlySection].title : g.title)}</h1>
      <div class="page-meta"><span class="meta-item">${st.av} ready · ${st.done} done · ${st.total} planned</span></div>
      ${secs.map((s) => {
        const items = PAGES.filter((p) => p.section === s.id).sort((a, b) => !!a.soon - !!b.soon);
        return `<section class="home-section" style="margin-top:28px"><div class="home-section-head"><div><h2>${esc(s.title)}</h2></div></div>
          <div class="item-grid">${items.map(itemCard).join("")}</div></section>`;
      }).join("")}</div>`, g.title);
    scrollTopNow();
  }

  function renderNotFound() {
    setView(`<div class="home"><div class="soon-page"><div class="big">🧭</div><h2>Page not found</h2><p>That link doesn't match any topic. Try searching instead.</p>
      <button class="btn primary" data-open-search>${icon("search")}Search</button></div></div>`, "Not found");
  }

  /* ---------------- topic / problem page ---------------- */
  function neighbours(p) {
    const av = available(); const i = av.findIndex((x) => x.id === p.id);
    return { prev: i > 0 ? av[i - 1] : null, next: i >= 0 && i < av.length - 1 ? av[i + 1] : null };
  }
  function pageHeader(p) {
    const sec = sectionById[p.section], g = groupById[p.group];
    const lvl = p.level ? `<span class="tag ${p.level}">${p.level === "s1" ? "SDE 1 core" : "SDE 2 depth"}</span>` : '<span class="tag gtk">Good to know</span>';
    const diff = p.difficulty ? `<span class="tag ${p.difficulty}">${p.difficulty[0].toUpperCase() + p.difficulty.slice(1)}</span>` : "";
    const kind = p.kind === "problem" ? `<span class="tag kind">${p.section === "problems-lld" ? "LLD problem" : "HLD problem"}</span>` : "";
    return `<div class="breadcrumb"><a href="#/">Home</a><span class="sep">/</span><a href="#/g/${g.id}">${esc(g.title)}</a><span class="sep">/</span><a href="#/s/${sec.id}">${esc(sec.title)}</a></div>
      <h1 class="page-title">${esc(p.title)}</h1>
      <div class="page-meta">${diff}${kind}${lvl}<span class="meta-item" id="read-time"></span><span class="meta-spacer"></span>
      ${p.soon ? "" : `<button class="btn sm done-btn" data-done aria-pressed="${isDone(p.id)}">${icon("check")}<span>${isDone(p.id) ? "Completed" : "Mark complete"}</span></button>`}</div>`;
  }
  function renderPage(p, anchor) {
    state.last = p.soon ? state.last : p.id; save();
    const { prev, next } = neighbours(p);
    const pager = `<nav class="pager" aria-label="Pagination">
      ${prev ? `<a class="prev" href="#/p/${prev.id}"><small>← Previous</small><b>${esc(prev.title)}</b></a>` : ""}
      ${next ? `<a class="next" href="#/p/${next.id}"><small>Next →</small><b>${esc(next.title)}</b></a>` : ""}</nav>`;

    if (p.soon) {
      setView(`<div class="page no-toc"><article class="article">${pageHeader(p)}
        <div class="soon-page"><div class="big">🛠️</div><h2>Coming in a later batch</h2><p>${esc(p.summary)} This page is on the roadmap but hasn't been written yet.</p>
        <a class="btn primary" href="#/">${icon("left")}Back to home</a></div>${pager}</article></div>`, p.title);
      scrollTopNow(); return;
    }

    setView(`<div class="page"><article class="article">${pageHeader(p)}
      <div class="prose" id="prose"><div class="skeleton"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="done-panel" id="done-panel"></div>${pager}</article>
      <aside class="toc" id="toc" aria-label="On this page"></aside></div>`, p.title);
    scrollTopNow();

    fetchContent(p).then((def) => {
      if (current.page !== p.id) return;
      const prose = $("#prose");
      prose.innerHTML = def.html;
      enhance(prose, def);
      const words = prose.textContent.trim().split(/\s+/).length;
      $("#read-time").innerHTML = `${icon("clock")}${Math.max(1, Math.round(words / 210))} min read`;
      renderDonePanel(p);
      buildToc(prose, p);
      if (anchor) setTimeout(() => scrollToAnchor(anchor), 60);
      updateReadProgress();
    }).catch((err) => {
      if (current.page !== p.id) return;
      $("#prose").innerHTML = `<div class="callout warn"><strong>Couldn't load this page</strong><p>${esc(err.message)}. If you opened the site directly from disk, try running <code>python3 -m http.server</code> in the project folder.</p></div>`;
    });
  }
  function renderDonePanel(p) {
    const el = $("#done-panel"); if (!el) return;
    const d = isDone(p.id);
    el.innerHTML = `<p>${d ? "✅ You've completed this page. Nice work!" : "Finished reading and tried the questions? Mark it complete to track your progress."}</p>
      <button class="btn ${d ? "" : "primary"} done-btn" data-done aria-pressed="${d}">${icon("check")}<span>${d ? "Completed" : "Mark complete"}</span></button>`;
  }
  function toggleDone() {
    const id = current.page; if (!id || byId[id].soon) return;
    const v = !isDone(id); setDone(id, v);
    $$("[data-done]").forEach((b) => { b.setAttribute("aria-pressed", String(v)); $("span", b).textContent = v ? "Completed" : "Mark complete"; });
    renderDonePanel(byId[id]);
    const s = stats();
    toast(v ? `🎉 Marked complete · ${s.done}/${s.av} done` : "Marked as not complete");
  }

  /* ---------------- content enhancement ---------------- */
  function enhance(root, def) {
    // headings → ids + anchors
    const seen = {};
    $$("h2, h3", root).forEach((h) => {
      if (h.closest(".quiz, .card, .ptabs, .callout")) return;
      let id = h.id || slug(h.textContent) || "section";
      if (seen[id]) id += "-" + ++seen[id]; else seen[id] = 1;
      h.id = id;
      const a = document.createElement("a");
      a.className = "anchor"; a.href = `#/p/${current.page}/${id}`; a.textContent = "#"; a.setAttribute("aria-label", "Link to this section");
      h.prepend(a);
    });
    // tables
    $$("table", root).forEach((t) => {
      if (t.parentElement.classList.contains("table-wrap")) return;
      const w = document.createElement("div"); w.className = "table-wrap"; t.replaceWith(w); w.appendChild(t);
      const row = t.rows[0]; if (row) t.style.setProperty("--cols", Math.max(2, row.cells.length));
    });
    // prose tabs
    $$(".tabs", root).forEach(buildProseTabs);
    // code
    $$("[data-code]", root).forEach((el) => buildCode(el, def.code && def.code[el.dataset.code]));
    // diagrams
    $$("[data-diagram]", root).forEach((el) => {
      const src = def.diagrams && def.diagrams[el.dataset.diagram];
      const fig = document.createElement("figure");
      fig.className = "figure"; fig.dataset.src = src || "";
      fig.innerHTML = `<div class="figure-canvas loading"><span class="spinner"></span> Drawing diagram…</div>
        <div class="fig-scroll-hint">← Swipe to see the whole diagram, or tap Expand →</div>
        ${el.dataset.caption ? `<figcaption>${esc(el.dataset.caption)}</figcaption>` : ""}
        <button class="fig-zoom" type="button">${icon("zoom")}Expand</button>`;
      el.replaceWith(fig);
    });
    $$("figure.svg-fig", root).forEach((fig) => {
      if ($(".fig-zoom", fig)) return;
      const b = document.createElement("button"); b.className = "fig-zoom"; b.type = "button"; b.innerHTML = icon("zoom") + "Expand"; fig.appendChild(b);
      const hint = document.createElement("div"); hint.className = "fig-scroll-hint"; hint.textContent = "← Swipe to see the whole diagram, or tap Expand →";
      const cap = $("figcaption", fig); if (cap) fig.insertBefore(hint, cap); else fig.appendChild(hint);
    });
    requestAnimationFrame(() => $$("figure.svg-fig", root).forEach(fitSvgFig));
    renderDiagrams(root);
    // widgets
    $$("[data-widget]", root).forEach((el) => {
      const w = window.SDWidgets && window.SDWidgets[el.dataset.widget];
      if (w) { try { w(el); } catch (e) { console.error(e); el.innerHTML = `<div class="callout warn">Widget failed to load.</div>`; } }
    });
    // external links
    $$("a[href^='http']", root).forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
  }

  function buildProseTabs(box) {
    const secs = $$(":scope > section[data-tab]", box);
    if (!secs.length) return;
    const id = "pt" + ++uid;
    const wrap = document.createElement("div");
    wrap.className = "ptabs";
    const bar = document.createElement("div"); bar.className = "ptabs-bar"; bar.setAttribute("role", "tablist");
    wrap.appendChild(bar);
    secs.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = s.dataset.tab; b.setAttribute("role", "tab"); b.id = `${id}-t${i}`;
      b.setAttribute("aria-selected", String(i === 0)); b.setAttribute("aria-controls", `${id}-p${i}`); b.tabIndex = i === 0 ? 0 : -1;
      bar.appendChild(b);
      const panel = document.createElement("div");
      panel.className = "ptabs-panel"; panel.id = `${id}-p${i}`; panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", b.id);
      panel.hidden = i !== 0;
      while (s.firstChild) panel.appendChild(s.firstChild);
      wrap.appendChild(panel);
    });
    const select = (i) => {
      $$("button", bar).forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      $$(".ptabs-panel", wrap).forEach((p, j) => (p.hidden = i !== j));
      $$(".figure[data-src]", wrap).forEach((f) => { if (!f.dataset.done) renderDiagrams(wrap); });
    };
    bar.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) select($$("button", bar).indexOf(b)); });
    bar.addEventListener("keydown", (e) => {
      const bs = $$("button", bar), i = bs.indexOf(document.activeElement);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const n = (i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length; select(n); bs[n].focus(); e.preventDefault();
      }
    });
    box.replaceWith(wrap);
  }

  /* ---- code tabs ---- */
  const LONG = 30;
  function buildCode(el, entry) {
    if (!entry) { el.innerHTML = '<div class="callout warn">Code sample missing.</div>'; return; }
    const block = document.createElement("div");
    block.className = "code-block"; block._entry = entry;
    const tabs = LANGS.map((l) => `<button class="code-tab" role="tab" data-lang="${l.id}" type="button"><span class="lang-dot"></span>${l.short ? `<span class="lang-name-long">${l.name}</span><span class="only-short">${""}</span>` : l.name}</button>`).join("");
    block.innerHTML = `<div class="code-head"><div class="code-tabs" role="tablist" aria-label="Code language">${tabs}</div>
      <div class="code-actions"><button class="code-btn" data-copy type="button" title="Copy code">${icon("copy")}<span>Copy</span></button></div></div>
      ${entry.title ? `<div class="code-caption">${esc(entry.title)}</div>` : ""}
      <div class="code-body"><pre class="code-pre"><code></code></pre></div><div class="code-expand" hidden><button class="code-btn" data-expand type="button"></button></div>`;
    $$(".code-tab", block).forEach((b) => { if (b.dataset.lang === "javascript") b.lastChild.textContent = ""; });
    el.replaceWith(block);
    paintCode(block, state.lang);
    block.addEventListener("click", (e) => {
      const tab = e.target.closest(".code-tab");
      if (tab) { setLang(tab.dataset.lang, block); return; }
      if (e.target.closest("[data-copy]")) copyCode(block, e.target.closest("[data-copy]"));
      if (e.target.closest("[data-expand]")) { block.dataset.expanded = block.dataset.expanded === "1" ? "0" : "1"; layoutCode(block); }
    });
    $(".code-tabs", block).addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const i = LANGS.findIndex((l) => l.id === block.dataset.lang);
      const n = LANGS[(i + (e.key === "ArrowRight" ? 1 : -1) + LANGS.length) % LANGS.length].id;
      setLang(n, block); $(`.code-tab[data-lang="${n}"]`, block).focus(); e.preventDefault();
    });
    loadPrism().then(() => paintCode(block, block.dataset.lang));
  }
  function splitLines(html) {
    const open = [];
    return html.split("\n").map((line) => {
      const prefix = open.join("");
      const re = /<span[^>]*>|<\/span>/g; let m;
      while ((m = re.exec(line))) { if (m[0] === "</span>") open.pop(); else open.push(m[0]); }
      return `<span class="line">${prefix}${line}${"</span>".repeat(open.length)}</span>`;
    }).join("");
  }
  function paintCode(block, lang) {
    const L = LANGS.find((l) => l.id === lang);
    const src = (block._entry[lang] || "").replace(/^\n+|\s+$/g, "");
    const P = window.Prism && window.Prism.languages && window.Prism.languages[L.prism];
    const html = P ? window.Prism.highlight(src, P, L.prism) : esc(src);
    const code = $("code", block);
    code.className = "language-" + L.prism;
    code.innerHTML = splitLines(html);
    block.dataset.lang = lang;
    $$(".code-tab", block).forEach((t) => { const on = t.dataset.lang === lang; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    block._lines = src.split("\n").length;
    layoutCode(block);
  }
  function layoutCode(block) {
    const long = block._lines > LONG, exp = block.dataset.expanded === "1";
    $(".code-body", block).classList.toggle("collapsed", long && !exp);
    const ex = $(".code-expand", block); ex.hidden = !long;
    if (long) $("[data-expand]", block).textContent = exp ? "Collapse" : `Show all ${block._lines} lines`;
  }
  function setLang(lang, anchorBlock) {
    const before = anchorBlock ? anchorBlock.getBoundingClientRect().top : 0;
    state.lang = lang; save();
    $$(".code-block").forEach((b) => paintCode(b, lang));
    $("#lang-select").value = lang;
    if (anchorBlock) window.scrollBy(0, anchorBlock.getBoundingClientRect().top - before); // keep the clicked block steady
  }
  function copyCode(block, btn) {
    const text = block._entry[block.dataset.lang] || "";
    const done = () => { const s = $("span", btn); s.textContent = "Copied!"; setTimeout(() => (s.textContent = "Copy"), 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, cb) {
    const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); try { document.execCommand("copy"); cb(); } catch (e) {} t.remove();
  }

  /* ---- diagrams ---- */
  async function renderDiagrams(root, force) {
    const figs = $$(".figure[data-src]", root).filter((f) => force || !f.dataset.done);
    if (!figs.length) return;
    let mm;
    try { mm = await loadMermaid(); } catch (e) {
      figs.forEach((f) => { const c = $(".figure-canvas", f); c.classList.remove("loading"); c.innerHTML = `<pre class="diagram-error">${esc(f.dataset.src)}</pre>`; });
      return;
    }
    for (const f of figs) {
      if (!f.isConnected) continue;
      if (f.offsetParent === null && !force) continue; // hidden (inside an inactive tab): render when shown
      const c = $(".figure-canvas", f), id = "mmd" + ++uid;
      try {
        const out = await mm.render(id, f.dataset.src);
        c.classList.remove("loading"); c.innerHTML = out.svg; f.dataset.done = "1"; fitFigure(c);
      } catch (e) {
        const stray = document.getElementById("d" + id); if (stray) stray.remove();
        c.classList.remove("loading");
        c.innerHTML = `<pre class="diagram-error">Diagram could not be drawn.\n\n${esc(f.dataset.src)}</pre>`;
        f.dataset.done = "1";
      }
    }
  }

  // On narrow screens a wide diagram shrunk to fit becomes unreadable: keep a readable minimum
  // width and let it scroll sideways inside its own box instead.
  function fitFigure(c) {
    const svg = $("svg", c); if (!svg) return;
    const vb = svg.viewBox && svg.viewBox.baseVal, natural = vb && vb.width ? vb.width : 0;
    const avail = c.clientWidth;
    svg.style.minWidth = "";
    if (natural && avail && natural * 0.62 > avail) {
      svg.style.minWidth = Math.min(natural, avail * 2.2) + "px"; svg.style.maxWidth = "none";
      c.classList.add("scrolls");
    } else { svg.style.maxWidth = ""; c.classList.remove("scrolls"); }
  }
  function fitSvgFig(fig) {
    const svg = $(":scope > svg", fig); if (!svg) return;
    const vb = svg.viewBox && svg.viewBox.baseVal, natural = vb && vb.width ? vb.width : 0, avail = fig.clientWidth - 16;
    const wide = !!(natural && avail && natural * 0.62 > avail);
    svg.style.minWidth = wide ? Math.min(natural, avail * 2.2) + "px" : "";
    fig.classList.toggle("scrolls", wide);
  }
  let fitT = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitT);
    fitT = setTimeout(() => { $$(".figure[data-done] .figure-canvas").forEach(fitFigure); $$("figure.svg-fig").forEach(fitSvgFig); }, 150);
  });

  /* ---------------- TOC + scroll spy ---------------- */
  let spy = null;
  function buildToc(prose, p) {
    const toc = $("#toc"); if (!toc) return;
    const hs = $$("h2[id], h3[id]", prose).filter((h) => !h.closest(".takeaways") || h.tagName === "H2");
    if (!hs.length) { toc.remove(); $(".page").classList.add("no-toc"); return; }
    toc.innerHTML = `<div class="toc-title">On this page</div><ul>${hs.map((h) =>
      `<li class="${h.tagName === "H3" ? "l3" : "l2"}"><a href="#/p/${p.id}/${h.id}" data-target="${h.id}">${esc(h.textContent.replace(/^#/, ""))}</a></li>`).join("")}</ul>
      <div class="toc-actions"><button class="btn sm done-btn" data-done aria-pressed="${isDone(p.id)}">${icon("check")}<span>${isDone(p.id) ? "Completed" : "Mark complete"}</span></button>
      <button class="btn sm" data-top>${icon("chevron")} Back to top</button></div>`;
    $("[data-top] .ic", toc).style.transform = "rotate(180deg)";
    toc.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-target]");
      if (a) { e.preventDefault(); scrollToAnchor(a.dataset.target); history.replaceState(null, "", a.getAttribute("href")); }
      if (e.target.closest("[data-top]")) window.scrollTo({ top: 0, behavior: "smooth" });
    });
    // mobile bottom sheet mirrors the TOC
    $("#toc-sheet-body").innerHTML = $("ul", toc).outerHTML;
    $("#toc-fab").hidden = false;
    const links = Object.fromEntries($$("a[data-target]", toc).map((a) => [a.dataset.target, a]));
    const visible = new Set();
    spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? visible.add(en.target.id) : visible.delete(en.target.id)));
      let active = null;
      for (const h of hs) { if (h.getBoundingClientRect().top < window.innerHeight * 0.35) active = h.id; }
      if (!active && hs[0]) active = hs[0].id;
      Object.values(links).forEach((a) => a.classList.toggle("active", a.dataset.target === active));
      $$("#toc-sheet-body a").forEach((a) => a.classList.toggle("active", a.dataset.target === active));
    }, { rootMargin: "-10% 0px -60% 0px", threshold: [0, 1] });
    hs.forEach((h) => spy.observe(h));
  }
  function scrollToAnchor(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function teardownPage() { if (spy) { spy.disconnect(); spy = null; } closeNav(); $("#toc-fab").hidden = true; }

  function updateReadProgress() {
    const bar = $("#read-progress");
    if (current.route !== "p") { bar.style.width = "0"; return; }
    const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0) + "%";
  }

  /* ---------------- search palette ---------------- */
  const searchIndex = PAGES.map((p) => ({
    p, title: p.title.toLowerCase(),
    hay: [p.title, p.summary, p.tags.join(" "), sectionById[p.section].title, groupById[p.group].title, p.difficulty || "", p.level === "s1" ? "sde1 sde 1" : p.level === "s2" ? "sde2 sde 2" : ""].join(" ").toLowerCase(),
    tags: p.tags.join(" ").toLowerCase(),
  }));
  let results = [], sel = 0;
  function search(q) {
    const toks = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!toks.length) {
      const recent = state.last && byId[state.last] ? [byId[state.last]] : [];
      return recent.concat(available().filter((p) => p.id !== state.last)).slice(0, 9);
    }
    return searchIndex.map((x) => {
      let score = 0;
      for (const t of toks) {
        if (!x.hay.includes(t)) return null;
        if (x.title.startsWith(t)) score += 12;
        else if (new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(x.title)) score += 9;
        else if (x.title.includes(t)) score += 6;
        if (x.tags.includes(t)) score += 5;
        score += 1;
      }
      if (!x.p.soon) score += 3;
      return { p: x.p, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 14).map((x) => x.p);
  }
  function hl(text, q) {
    let out = esc(text);
    q.toLowerCase().trim().split(/\s+/).filter((t) => t.length > 1).forEach((t) => {
      out = out.replace(new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    });
    return out;
  }
  function renderResults() {
    const q = $("#search-input").value;
    results = search(q); sel = 0;
    const box = $("#search-results");
    if (!results.length) { box.innerHTML = `<div class="res-empty">No results for “${esc(q)}”.<br/>Try a broader term like “cache” or “queue”.</div>`; return; }
    let lastG = null, html = q.trim() ? "" : '<div class="res-group">Jump to</div>';
    results.forEach((p, i) => {
      const g = q.trim() ? (p.kind === "problem" ? "Problems" : groupById[p.group].title) : null;
      if (g && g !== lastG) { html += `<div class="res-group">${g}</div>`; lastG = g; }
      html += `<a class="res" role="option" id="res-${i}" href="#/p/${p.id}" data-i="${i}" aria-selected="${i === 0}">
        <span class="res-icon">${icon(p.soon ? "hourglass" : p.kind === "problem" ? "target" : p.group === "lld" ? "code" : "file")}</span>
        <span class="res-main"><div class="res-title">${hl(p.title, q)}</div><div class="res-sub">${esc(sectionById[p.section].title)} · ${esc(p.summary)}</div></span>
        ${p.soon ? '<span class="mini-tag soon">soon</span>' : isDone(p.id) ? `<span class="status-dot done"></span>` : ""}</a>`;
    });
    // regroup order to match visual grouping
    box.innerHTML = html;
    const order = $$(".res", box).map((a) => +a.dataset.i);
    results = order.map((i) => results[i]);
    $$(".res", box).forEach((a, i) => { a.dataset.i = i; a.id = "res-" + i; a.setAttribute("aria-selected", String(i === 0)); });
  }
  function moveSel(d) {
    if (!results.length) return;
    sel = (sel + d + results.length) % results.length;
    $$(".res").forEach((a, i) => a.setAttribute("aria-selected", String(i === sel)));
    const el = $("#res-" + sel); el && el.scrollIntoView({ block: "nearest" });
    $("#search-input").setAttribute("aria-activedescendant", "res-" + sel);
  }
  function openSearch() {
    openModal("#search-modal");
    const i = $("#search-input"); i.value = ""; renderResults(); setTimeout(() => i.focus(), 10);
  }

  /* ---------------- modals ---------------- */
  let lastFocus = null;
  function openModal(sel) { lastFocus = document.activeElement; $(sel).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal(m) {
    m.hidden = true;
    if (!$$(".modal").some((x) => !x.hidden)) document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function bindModals() {
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(m); }));
    $("#search-input").addEventListener("input", renderResults);
    $("#search-input").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { moveSel(1); e.preventDefault(); }
      else if (e.key === "ArrowUp") { moveSel(-1); e.preventDefault(); }
      else if (e.key === "Enter" && results[sel]) { location.hash = "#/p/" + results[sel].id; closeModal($("#search-modal")); }
    });
    $("#search-results").addEventListener("click", (e) => { if (e.target.closest(".res")) closeModal($("#search-modal")); });
    $("#search-results").addEventListener("mousemove", (e) => {
      const a = e.target.closest(".res"); if (!a || +a.dataset.i === sel) return;
      sel = +a.dataset.i; $$(".res").forEach((x, i) => x.setAttribute("aria-selected", String(i === sel)));
    });
  }

  /* ---------------- lightbox ---------------- */
  const lb = { s: 1, x: 0, y: 0, w: 0, h: 0 };
  function openLightbox(fig) {
    const svg = $("svg", fig); if (!svg) return;
    const clone = svg.cloneNode(true);
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const box = svg.getBoundingClientRect();
    lb.w = vb && vb.width ? vb.width : box.width; lb.h = vb && vb.height ? vb.height : box.height;
    clone.setAttribute("width", lb.w); clone.setAttribute("height", lb.h); clone.style.maxWidth = "none";
    const inner = $("#lightbox-inner"); inner.innerHTML = ""; inner.appendChild(clone);
    const cap = $("figcaption", fig);
    $("#lightbox-title").textContent = cap ? cap.textContent : "Diagram";
    openModal("#lightbox");
    requestAnimationFrame(fitLightbox);
  }
  function fitLightbox() {
    const st = $("#lightbox-stage").getBoundingClientRect();
    lb.s = Math.min((st.width - 40) / (lb.w + 48), (st.height - 40) / (lb.h + 48), 2.5);
    lb.x = (st.width - (lb.w + 48) * lb.s) / 2; lb.y = (st.height - (lb.h + 48) * lb.s) / 2; applyLb();
  }
  function applyLb() { $("#lightbox-inner").style.cssText = `left:0;top:0;transform:translate(${lb.x}px,${lb.y}px) scale(${lb.s})`; }
  function zoomLb(f, cx, cy) {
    const st = $("#lightbox-stage").getBoundingClientRect();
    cx = cx == null ? st.width / 2 : cx; cy = cy == null ? st.height / 2 : cy;
    const ns = Math.min(8, Math.max(0.2, lb.s * f));
    lb.x = cx - ((cx - lb.x) * ns) / lb.s; lb.y = cy - ((cy - lb.y) * ns) / lb.s; lb.s = ns; applyLb();
  }
  function bindLightbox() {
    const stage = $("#lightbox-stage");
    stage.addEventListener("wheel", (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomLb(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    // one finger / mouse = pan, two fingers = pinch-zoom, double-tap = zoom
    const pts = new Map(); let drag = null, pinch = null;
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
    stage.addEventListener("pointerdown", (e) => {
      stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { pinch = mid(); drag = null; } else if (pts.size === 1) drag = { x: e.clientX - lb.x, y: e.clientY - lb.y };
    });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const m = mid(), r = stage.getBoundingClientRect();
        lb.x += m.x - pinch.x; lb.y += m.y - pinch.y;
        if (pinch.d > 0) zoomLb(m.d / pinch.d, m.x - r.left, m.y - r.top); else applyLb();
        pinch = m;
      } else if (drag) { lb.x = e.clientX - drag.x; lb.y = e.clientY - drag.y; applyLb(); }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = null; if (pts.size === 1) { const q = [...pts.values()][0]; drag = { x: q.x - lb.x, y: q.y - lb.y }; } else drag = null; };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("dblclick", () => zoomLb(lb.s < 2 ? 2 : 0.5));
    $("#lb-zoom-in").onclick = () => zoomLb(1.25);
    $("#lb-zoom-out").onclick = () => zoomLb(0.8);
    $("#lb-zoom-reset").onclick = fitLightbox;
  }

  /* ---------------- toast ---------------- */
  let toastT = null;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------------- keyboard ---------------- */
  let gPending = false;
  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#search-modal").hidden ? openSearch() : closeModal($("#search-modal")); return; }
      if (e.key === "Escape") { const m = $$(".modal").find((x) => !x.hidden); if (m) closeModal(m); else closeNav(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || $$(".modal").some((x) => !x.hidden)) return;
      const k = e.key.toLowerCase();
      if (gPending) { gPending = false; if (k === "h") { location.hash = "#/"; return; } }
      if (k === "/") { e.preventDefault(); openSearch(); }
      else if (k === "?") openModal("#shortcuts-modal");
      else if (k === "t") toggleTheme();
      else if (k === "m") toggleDone();
      else if (k === "g") { gPending = true; setTimeout(() => (gPending = false), 900); }
      else if ((k === "n" || k === "p") && current.page) {
        const nb = neighbours(byId[current.page]); const t = k === "n" ? nb.next : nb.prev;
        if (t) location.hash = "#/p/" + t.id;
      } else if (/^[1-5]$/.test(k)) { setLang(LANGS[+k - 1].id); toast(`Code language: ${LANGS[+k - 1].name}`); }
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    hydrateIcons();
    applyTheme(document.documentElement.dataset.theme || "light", false);
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $("#search-kbd").textContent = "⌘ K";
    const ls = $("#lang-select");
    ls.innerHTML = LANGS.map((l) => `<option value="${l.id}">${l.name}</option>`).join("");
    ls.value = state.lang;
    ls.addEventListener("change", () => { setLang(ls.value); toast(`Code language: ${LANGS.find((l) => l.id === ls.value).name}`); });
    $("#theme-btn").addEventListener("click", toggleTheme);
    $("#search-btn").addEventListener("click", openSearch);
    $("#shortcuts-btn").addEventListener("click", () => openModal("#shortcuts-modal"));
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-search]")) openSearch();
      if (e.target.closest("[data-done]")) toggleDone();
      const z = e.target.closest(".fig-zoom"); if (z) openLightbox(z.closest("figure"));
    });
    window.addEventListener("scroll", updateReadProgress, { passive: true });
    window.addEventListener("hashchange", route);
    $("#toc-fab").addEventListener("click", () => openModal("#toc-sheet"));
    $("#toc-sheet-body").addEventListener("click", (e) => {
      const a = e.target.closest("a[data-target]"); if (!a) return;
      e.preventDefault(); closeModal($("#toc-sheet"));
      setTimeout(() => scrollToAnchor(a.dataset.target), 30); history.replaceState(null, "", a.getAttribute("href"));
    });
    // swipe left on the open drawer to close it
    let sx = null, sy = null;
    $("#sidebar").addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    $("#sidebar").addEventListener("touchend", (e) => {
      if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (dx < -60 && Math.abs(dy) < 50) closeNav(); sx = null;
    }, { passive: true });
    // follow the OS theme until the user picks one with the toggle
    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mq && mq.addEventListener) mq.addEventListener("change", (e) => { if (!state.theme) setTheme(e.matches ? "dark" : "light", false); });
    bindSidebar(); bindModals(); bindLightbox(); bindKeys();
    renderNav(); route();
  }
  boot();
})();
