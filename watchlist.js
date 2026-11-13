/**
 * Every Movie Plug - Watchlist (saved in this browser only, nothing is sent to the server).
 *
 * Storage:  localStorage key "emp_watchlist_v1"  ->  [{type, id, title, poster, year, rating, added}, ...] newest first.
 *
 * What it adds (it never rewrites the pages' own markup, and every part fails quietly if a page lacks the element):
 *   - a small bookmark button on the poster of every movie / TV card (cards that open the popup or /title.html)
 *   - a "Save to Watchlist" chip inside the details popup and on the full title page (/title.html)
 *   - a "Watchlist" chip with a live count in the header (or a round floating button on pages without a header menu)
 *   - the /watchlist.html page itself (filter, sort, remove, export / import, clear)
 *
 * Public API:  EMPWatchlist.list() .has(type,id) .add(item) .remove(type,id) .toggle(item) .clear() .count()
 *              document event "emp:watchlist" fires whenever the list changes (also when another tab changes it).
 */
(function () {
  "use strict";
  if (window.EMPWatchlist) return;
  var doc = document, KEY = "emp_watchlist_v1", MAX = 500, IMG = "https://image.tmdb.org/t/p/";
  var fallback = null;                                  // used only when the browser blocks localStorage

  /* ------------------------------------------------------------ storage */
  function valid(i) { return i && (i.type === "movie" || i.type === "tv") && isFinite(+i.id) && +i.id > 0 && typeof i.title === "string" && i.title; }
  function read() {
    if (fallback) return fallback.slice();
    var a = [];
    try { var raw = localStorage.getItem(KEY); if (raw) a = JSON.parse(raw); } catch (e) { return fallback ? fallback.slice() : []; }
    return Array.isArray(a) ? a.filter(valid) : [];
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); fallback = null; return true; }
    catch (e) { fallback = list.slice(); return false; }
  }
  function keyOf(type, id) { return type + "-" + (+id); }
  function norm(i) {
    var poster = typeof i.poster === "string" && /^\/[\w.-]+$/.test(i.poster) ? i.poster : "";
    return {
      type: i.type, id: +i.id, title: String(i.title).slice(0, 200), poster: poster,
      year: /^\d{4}$/.test(String(i.year || "")) ? String(i.year) : "", rating: isFinite(+i.rating) ? Math.round(+i.rating * 10) / 10 : 0,
      added: isFinite(+i.added) && +i.added > 0 ? +i.added : Date.now()
    };
  }
  function changed() {
    refresh();
    try { doc.dispatchEvent(new CustomEvent("emp:watchlist", { detail: { count: read().length } })); } catch (e) {}
  }
  var api = {
    list: read,
    count: function () { return read().length; },
    has: function (type, id) { var k = keyOf(type, id); return read().some(function (i) { return keyOf(i.type, i.id) === k; }); },
    add: function (item) {
      if (!item || !valid(item)) return false;
      var list = read(), k = keyOf(item.type, item.id), n = norm(item);
      for (var x = 0; x < list.length; x++) {
        if (keyOf(list[x].type, list[x].id) === k) {                                  // already saved: only fill in blanks
          var o = list[x]; if (!o.poster && n.poster) o.poster = n.poster; if (!o.year && n.year) o.year = n.year; if (!o.rating && n.rating) o.rating = n.rating;
          write(list); changed(); return true;
        }
      }
      if (list.length >= MAX) { toast("Your Watchlist is full (" + MAX + " titles)."); return false; }
      list.unshift(n);
      if (!write(list)) toast("This browser is blocking storage, so your Watchlist will be lost when you close the tab.");
      changed(); return true;
    },
    remove: function (type, id) {
      var k = keyOf(type, id), list = read(), out = list.filter(function (i) { return keyOf(i.type, i.id) !== k; });
      if (out.length === list.length) return false;
      write(out); changed(); return true;
    },
    clear: function () { write([]); changed(); },
    toggle: function (item) {
      if (api.has(item.type, item.id)) { var old = read().filter(function (i) { return keyOf(i.type, i.id) === keyOf(item.type, item.id); })[0]; api.remove(item.type, item.id); return { saved: false, old: old }; }
      return { saved: api.add(item) };
    }
  };

  /* ------------------------------------------------------------ small helpers */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(tag, attrs, html) { var n = doc.createElement(tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (html != null) n.innerHTML = html; return n; }
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/></svg>';

  var toastEl = null, toastTimer = 0;
  function toast(msg, actionLabel, action) {
    if (!toastEl) { toastEl = el("div", { id: "emw-toast", role: "status", "aria-live": "polite", "data-fx": "off" }); doc.body.appendChild(toastEl); }
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>";
    if (actionLabel) {
      var b = el("button", { type: "button" }, esc(actionLabel));
      b.addEventListener("click", function () { toastEl.classList.remove("show"); if (action) action(); });
      toastEl.appendChild(b);
    }
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, actionLabel ? 6000 : 2800);
  }

  /* fetch the poster / year / rating for a title through the site's own TMDB proxy (no key in the browser) */
  var enriching = {};
  function enrich(type, id) {
    var k = keyOf(type, id); if (enriching[k] || !window.fetch) return; enriching[k] = 1;
    fetch("/api/tmdb/" + type + "/" + (+id) + "?language=en-US").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      delete enriching[k]; if (!d) return;
      var list = read(), hit = null;
      list.forEach(function (i) { if (keyOf(i.type, i.id) === k) hit = i; });
      if (!hit) return;
      if (d.poster_path) hit.poster = d.poster_path;
      var y = (d.release_date || d.first_air_date || "").slice(0, 4); if (/^\d{4}$/.test(y)) hit.year = y;
      if (d.vote_average) hit.rating = Math.round(d.vote_average * 10) / 10;
      write(list); changed();
    }).catch(function () { delete enriching[k]; });
  }

  /* ------------------------------------------------------------ styles */
  var css = [
    ".emw-save{position:absolute;right:.5rem;bottom:.5rem;z-index:3;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.62);border:1px solid rgba(255,255,255,.22);color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);cursor:pointer;transition:background .2s ease,border-color .2s ease,transform .12s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    ".emw-save svg,.emw-chip svg,.emw-nav svg,.emw-fab svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;flex:none}",
    ".emw-save[aria-pressed=true],.emw-fab.has{background:linear-gradient(135deg,#6366f1,#a855f7);border-color:transparent}",
    ".emw-save[aria-pressed=true] svg,.emw-chip[aria-pressed=true] svg,.emw-nav.has svg{fill:currentColor}",
    ".emw-save:active{transform:scale(.9)}",
    "@media (hover:hover),(any-hover:hover){.emw-save:hover{background:rgba(168,85,247,.6);border-color:rgba(216,180,254,.5)}.emw-save[aria-pressed=true]:hover{background:linear-gradient(135deg,#7476f3,#b26cf8)}}",
    ".emw-chip svg,.emw-nav svg{width:15px;height:15px}",
    ".fx-slide>.emw-save{top:16px;right:22px;bottom:auto;width:38px;height:38px;z-index:5}",
    ".fx-slide>.emw-save svg{width:18px;height:18px}",
    ".emw-chip[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7)}",
    ".emw-count{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#8b5cf6;color:#fff;font-size:.68rem;font-weight:700;line-height:1}",
    ".emw-count[hidden]{display:none}",
    ".emw-fab{position:fixed;z-index:90;right:max(16px,env(safe-area-inset-right));bottom:calc(82px + env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#fff;text-decoration:none;background:rgba(14,14,22,.9);border:1px solid rgba(255,255,255,.2);box-shadow:0 10px 30px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:transform .12s ease,background .2s ease}",
    ".emw-fab:active{transform:scale(.94)}",
    ".emw-fab .emw-count{position:absolute;top:-4px;right:-4px;border:2px solid #060609;box-sizing:content-box}",
    ".emw-fab svg{width:20px;height:20px}",
    "#emw-toast{position:fixed;left:50%;bottom:max(1.5rem,env(safe-area-inset-bottom));transform:translate(-50%,16px);z-index:2147482400;display:flex;align-items:center;gap:.9rem;max-width:calc(100vw - 32px);padding:.7rem 1.1rem;border-radius:9999px;background:#18181f;border:1px solid rgba(255,255,255,.14);color:#f5f5f7;font:500 .82rem/1.3 -apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease}",
    "#emw-toast.show{opacity:1;pointer-events:auto;transform:translate(-50%,0)}",
    "#emw-toast button{appearance:none;background:none;border:0;padding:0;font:inherit;font-weight:700;color:#c4b5fd;cursor:pointer}",
    /* ---- the /watchlist.html page ---- */
    ".emw-page h1{font-size:clamp(1.8rem,4.6vw,2.8rem);font-weight:800;letter-spacing:-.025em;line-height:1.1}",
    ".emw-sub{margin-top:.5rem;color:#86868b;font-size:.9rem;max-width:60ch}",
    ".emw-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:1.6rem 0 1.2rem}",
    ".emw-tabs{display:flex;flex-wrap:wrap;gap:.45rem;margin-right:auto}",
    ".emw-tab,.emw-btn{appearance:none;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .95rem;border-radius:9999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#d4d4d8;font:500 .8rem/1 inherit;text-decoration:none;transition:background .2s ease,border-color .2s ease,transform .12s ease}",
    ".emw-tab:hover,.emw-btn:hover{background:rgba(168,85,247,.18)}",
    ".emw-tab:active,.emw-btn:active{transform:scale(.96)}",
    ".emw-tab[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7)}",
    ".emw-btn.danger[data-sure]{background:rgba(239,68,68,.22);border-color:rgba(248,113,113,.6);color:#fecaca}",
    ".emw-menu{position:relative}",
    ".emw-menu summary{list-style:none}.emw-menu summary::-webkit-details-marker{display:none}",
    ".emw-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:5;min-width:200px;padding:.4rem;border-radius:16px;background:#14141c;border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 40px rgba(0,0,0,.6)}",
    ".emw-pop button{display:block;width:100%;text-align:left;appearance:none;background:none;border:0;cursor:pointer;padding:.6rem .8rem;border-radius:10px;color:#e4e4e7;font:500 .82rem/1.2 inherit}",
    ".emw-pop button:hover{background:rgba(168,85,247,.2)}",
    ".emw-sort{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:9999px;padding:.45rem .8rem;font-size:.78rem;color:#d4d4d8;outline:none}",
    ".emw-sort option{background:#0e0e16}",
    ".emw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:1rem}",
    "@media (max-width:640px){.emw-grid{grid-template-columns:repeat(2,1fr);gap:.75rem}}",
    ".emw-card{position:relative;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.4);transition:transform .35s cubic-bezier(.16,1,.3,1),border-color .25s ease,box-shadow .35s ease}",
    "@media (hover:hover),(any-hover:hover){.emw-card:hover{transform:translateY(-4px);border-color:rgba(168,85,247,.5);box-shadow:0 18px 40px rgba(0,0,0,.6),0 0 24px rgba(139,92,246,.2)}}",
    ".emw-card:active{transform:scale(.97)}",
    ".emw-card a{color:inherit;text-decoration:none;display:block}",
    ".emw-poster{position:relative;aspect-ratio:2/3;background:linear-gradient(160deg,#1a1a26,#0c0c12);overflow:hidden}",
    ".emw-poster img{width:100%;height:100%;object-fit:cover;display:block}",
    ".emw-poster .ph{position:absolute;inset:0;display:grid;place-items:center;padding:1rem;text-align:center;font-size:.8rem;color:#86868b}",
    ".emw-type{position:absolute;left:.5rem;top:.5rem;padding:.2rem .55rem;border-radius:9999px;font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.2)}",
    ".emw-meta{padding:.7rem .85rem .85rem}",
    ".emw-meta b{display:block;font-size:.88rem;line-height:1.3;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}",
    ".emw-meta span{display:block;margin-top:.25rem;font-size:.74rem;color:#86868b}",
    ".emw-rm{position:absolute;right:.5rem;top:.5rem;z-index:2;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;padding:0;appearance:none;cursor:pointer;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:1.15rem;line-height:1;transition:background .2s ease}",
    ".emw-rm:hover{background:rgba(239,68,68,.75)}",
    ".emw-empty{padding:3.5rem 1rem;text-align:center;border-radius:24px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.16)}",
    ".emw-empty svg{width:42px;height:42px;fill:none;stroke:#a78bfa;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;margin-bottom:.8rem}",
    ".emw-empty p{color:#86868b;font-size:.92rem;margin:0 auto 1.2rem;max-width:44ch}",
    ".emw-empty .row{display:flex;flex-wrap:wrap;justify-content:center;gap:.6rem}",
    ".emw-note{margin-top:1.4rem;font-size:.72rem;color:#6b6b73}",
    "@media (prefers-reduced-motion:reduce){.emw-card,.emw-save,.emw-tab,.emw-btn,#emw-toast{transition-duration:.01ms!important}}"
  ].join("\n");
  function addStyle() { if (doc.getElementById("emw-style")) return; var s = el("style", { id: "emw-style" }); s.textContent = css; doc.head.appendChild(s); }

  /* ------------------------------------------------------------ reading titles off the page's own cards */
  function posterPath(src) { var m = /image\.tmdb\.org\/t\/p\/\w+(\/[\w.-]+)/.exec(src || ""); return m ? m[1] : ""; }
  function ident(n) {
    var type, id, m;
    if (n.tagName === "A") {
      try {
        var u = new URL(n.getAttribute("href") || "", location.href);
        if (/\/title\.html$/.test(u.pathname) && /^(movie|tv)$/.test(u.searchParams.get("type") || "") && /^\d+$/.test(u.searchParams.get("id") || "")) { type = u.searchParams.get("type"); id = +u.searchParams.get("id"); }
      } catch (e) {}
    } else if ((m = /openModal\(\s*['"](movie|tv)['"]\s*,\s*(\d+)/.exec(n.getAttribute("onclick") || ""))) { type = m[1]; id = +m[2]; }
    return type ? { type: type, id: id } : null;
  }
  function fromCard(n, who) {
    var img = n.querySelector("img"), t = n.querySelector(".mmeta b, b, h3, h2"), title = t ? t.textContent.trim() : "";
    if (!title && img) title = (img.getAttribute("alt") || "").replace(/\s*poster\s*$/i, "").trim();
    if (!title) title = (n.getAttribute("aria-label") || "").replace(/\s*\((TV show|movie)\).*$/i, "").replace(/^View details for\s*/i, "").trim();
    var year = "", yn = n.querySelector(".mmeta span, .gx-pill"); if (yn && /^\d{4}$/.test(yn.textContent.trim())) year = yn.textContent.trim();
    var rn = n.querySelector(".score, .gx-rate b"), rating = rn ? parseFloat(rn.textContent.replace(/[^\d.]/g, "")) : 0;
    return { type: who.type, id: who.id, title: title, poster: img && !n.classList.contains("fx-slide") ? posterPath(img.currentSrc || img.src) : "", year: year, rating: rating || 0 };
  }

  /* ------------------------------------------------------------ the save button on cards */
  function label(it, saved) { return (saved ? "Remove " : "Add ") + it.title + (saved ? " from your Watchlist" : " to your Watchlist"); }
  function decorate(n) {
    if (n.getAttribute("data-emw")) return;
    var who = ident(n); if (!who) return;
    var host = n.querySelector(".poster") || (n.querySelector("img") && n.querySelector("img").parentElement);
    if (!host) return;
    var it = fromCard(n, who); if (!it.title) return;
    var k = keyOf(who.type, who.id); n.setAttribute("data-emw", k);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    var saved = api.has(who.type, who.id);
    host.appendChild(el("span", { "class": "emw-save", role: "button", tabindex: "-1", "data-k": k, "aria-pressed": saved ? "true" : "false", "aria-label": label(it, saved), title: saved ? "Saved to Watchlist" : "Save to Watchlist" }, ICON));
  }
  function decorateAll(root) {
    var list = (root || doc).querySelectorAll('a[href*="title.html"], button[onclick*="openModal("]');
    for (var i = 0; i < list.length; i++) decorate(list[i]);
  }
  /* click: runs first (capture) so the card underneath never opens */
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".emw-save"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var card = b.closest("[data-emw]"), who = card && ident(card); if (!who) return;
    flip(fromCard(card, who));
  }, true);

  function flip(item) {
    var r = api.toggle(item);
    if (r.saved) { toast("Added to your Watchlist", "View", function () { location.href = "/watchlist.html"; }); if (!item.poster || !item.year) enrich(item.type, item.id); }
    else if (r.old) toast("Removed from your Watchlist", "Undo", function () { api.add(r.old); });
  }

  /* ------------------------------------------------------------ chips: popup, title page, header */
  function chipHTML(saved) { return ICON + "<span>" + (saved ? "In your Watchlist" : "Save to Watchlist") + "</span>"; }
  function addChip(row, cls, item, before) {
    if (row.querySelector(".emw-chip")) return;
    var k = keyOf(item.type, item.id), saved = api.has(item.type, item.id);
    var b = el("button", { type: "button", "class": (cls ? cls + " " : "") + "emw-chip", "data-k": k, "aria-pressed": saved ? "true" : "false" }, chipHTML(saved));
    b.__item = item;
    b.addEventListener("click", function () { flip(b.__item); });
    row.insertBefore(b, before || row.firstChild);
  }
  function scanDetails() {
    /* the popup on the home page and Trending */
    var mb = doc.getElementById("mBody");
    if (mb && !mb.querySelector(".emw-chip")) {
      var tm = mb.querySelector('a[href*="themoviedb.org/"]'), m = tm && /themoviedb\.org\/(movie|tv)\/(\d+)/.exec(tm.getAttribute("href")), h = mb.querySelector("h3, h2, h1");
      if (m && h) {
        var meta = mb.querySelector(".m-title p, p"), ym = meta && /\b((?:19|20)\d\d)\b/.exec(meta.textContent);
        var known = doc.querySelector('[data-emw="' + m[1] + "-" + m[2] + '"]'), cardIt = known && fromCard(known, { type: m[1], id: +m[2] });
        var it = { type: m[1], id: +m[2], title: h.textContent.trim(), poster: cardIt ? cardIt.poster : "", year: ym ? ym[1] : "", rating: cardIt ? cardIt.rating : 0 };
        addChip(tm.parentElement, tm.className.replace(/\bprimary\b/, "").trim(), it);
      }
    }
    /* the full title page */
    var tb = doc.querySelector(".titleblock .actions");
    if (tb && !tb.querySelector(".emw-chip")) {
      var q = new URLSearchParams(location.search), h1 = doc.querySelector(".titleblock h1"), pi = doc.querySelector(".head .poster img"), mt = doc.querySelector(".titleblock .meta"), rt = doc.querySelector(".titleblock .rate");
      var tp = (q.get("type") || ""), tid = +q.get("id");
      if (!tid) { var rm = doc.querySelector('link[rel="canonical"]'), mm = rm && /\/(movie|tv)\/(\d+)/.exec(rm.href); if (mm) { tp = mm[1]; tid = +mm[2]; } }
      if (h1 && /^(movie|tv)$/.test(tp) && tid) {
        var yy = mt && /\b((?:19|20)\d\d)\b/.exec(mt.textContent);
        addChip(tb, "chip", { type: tp, id: tid, title: h1.textContent.trim(), poster: pi ? posterPath(pi.src) : "", year: yy ? yy[1] : "", rating: rt ? parseFloat(rt.textContent.replace(/[^\d.]/g, "")) || 0 : 0 });
      }
    }
  }
  function navChip(extra) {
    return '<a class="' + extra + ' emw-nav" href="/watchlist.html" aria-label="Your Watchlist">' + ICON + '<span class="lbl">Watchlist</span> <span class="emw-count" hidden></span></a>';
  }
  function addNav() {
    if (doc.querySelector(".emw-nav, .emw-fab") || doc.getElementById("emw-page")) return;
    var row = doc.querySelector("nav.navrow"), top = doc.querySelector(".topbar-in");
    if (row) { var d = el("div", {}, navChip("chip")); row.appendChild(d.firstChild); }
    else if (top) {
      var share = doc.getElementById("shareTop"), d2 = el("div", {}, navChip("chip")); top.insertBefore(d2.firstChild, share || null);
    } else {
      var f = el("a", { "class": "emw-fab", href: "/watchlist.html", "aria-label": "Your Watchlist", title: "Your Watchlist", "data-fx": "off" }, ICON + '<span class="emw-count" hidden></span>');
      doc.body.appendChild(f);
    }
  }

  /* update every button / count after any change */
  function refresh() {
    var n = read().length, have = {};
    read().forEach(function (i) { have[keyOf(i.type, i.id)] = 1; });
    var all = doc.querySelectorAll(".emw-save, .emw-chip");
    for (var i = 0; i < all.length; i++) {
      var b = all[i], saved = !!have[b.getAttribute("data-k")];
      b.setAttribute("aria-pressed", saved ? "true" : "false");
      if (b.classList.contains("emw-chip")) { b.innerHTML = chipHTML(saved); }
      else {
        var card = b.closest("[data-emw]"), w = card && ident(card);
        b.title = saved ? "Saved to Watchlist" : "Save to Watchlist";
        if (card && w) { var it = fromCard(card, w); b.setAttribute("aria-label", label(it, saved)); }
      }
    }
    var cs = doc.querySelectorAll(".emw-count");
    for (var j = 0; j < cs.length; j++) { cs[j].textContent = n > 99 ? "99+" : String(n); cs[j].hidden = n === 0; }
    var nv = doc.querySelectorAll(".emw-nav, .emw-fab");
    for (var q = 0; q < nv.length; q++) nv[q].classList.toggle("has", n > 0);
    if (doc.getElementById("emw-page")) renderPage();
  }

  /* ------------------------------------------------------------ /watchlist.html */
  var view = { filter: "all", sort: "added" }, sure = false;
  function sortList(list) {
    var s = view.sort, out = list.slice();
    if (s === "title") out.sort(function (a, b) { return a.title.localeCompare(b.title); });
    else if (s === "year") out.sort(function (a, b) { return (b.year || "0").localeCompare(a.year || "0"); });
    else if (s === "rating") out.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    else out.sort(function (a, b) { return b.added - a.added; });
    return out;
  }
  function renderPage() {
    var root = doc.getElementById("emw-page"); if (!root) return;
    var all = read(), movies = all.filter(function (i) { return i.type === "movie"; }).length, tv = all.length - movies;
    var list = sortList(all.filter(function (i) { return view.filter === "all" || i.type === view.filter; }));
    var focus = doc.activeElement && doc.activeElement.getAttribute && doc.activeElement.getAttribute("data-f");
    var html = '<h1>Your Watchlist</h1><p class="emw-sub">Movies and shows you saved to watch later. They are kept in this browser on this device only, so clearing your browser data or switching device will not carry them over (use Download list to keep a copy).</p>';
    if (!all.length) {
      html += '<div class="emw-empty" style="margin-top:1.6rem">' + ICON + '<p>Nothing saved yet. Tap the bookmark on any movie or show poster, or press &ldquo;Save to Watchlist&rdquo; on a title page, and it will show up here.</p>' +
        '<div class="row"><a class="emw-btn" href="/trending">Browse trending</a><a class="emw-btn" href="/movies/">Movies</a><a class="emw-btn" href="/tv-shows/">TV shows</a><button type="button" class="emw-btn" data-a="import">Import a list</button></div></div>';
    } else {
      html += '<div class="emw-bar"><div class="emw-tabs" role="group" aria-label="Filter">' +
        [["all", "All", all.length], ["movie", "Movies", movies], ["tv", "TV shows", tv]].map(function (t) { return '<button type="button" class="emw-tab" data-f="' + t[0] + '" aria-pressed="' + (view.filter === t[0]) + '">' + t[1] + " (" + t[2] + ")</button>"; }).join("") + "</div>" +
        '<label class="emw-sr" style="position:absolute;left:-9999px" for="emw-sort">Sort by</label><select class="emw-sort" id="emw-sort"><option value="added">Recently added</option><option value="title">Title A to Z</option><option value="year">Newest release</option><option value="rating">Highest rated</option></select>' +
        '<details class="emw-menu"><summary class="emw-btn">Download list</summary><div class="emw-pop"><button type="button" data-a="export-csv">Spreadsheet (.csv)</button><button type="button" data-a="export-txt">Text list (.txt)</button><button type="button" data-a="export-json">Backup file (.json)</button></div></details><button type="button" class="emw-btn" data-a="import">Import</button>' +
        '<button type="button" class="emw-btn danger"' + (sure ? " data-sure" : "") + ' data-a="clear">' + (sure ? "Tap again to clear all" : "Clear all") + "</button></div>";
      if (!list.length) html += '<div class="emw-empty"><p>No ' + (view.filter === "tv" ? "TV shows" : "movies") + " in your Watchlist yet.</p></div>";
      else html += '<div class="emw-grid">' + list.map(function (i) {
        var href = "/title.html?type=" + i.type + "&id=" + i.id, meta = [i.year, i.rating ? "★ " + i.rating.toFixed(1) : ""].filter(Boolean).join(" · ");
        return '<article class="emw-card"><a href="' + href + '" aria-label="' + esc(i.title) + '. Open full page"><div class="emw-poster">' +
          (i.poster ? '<img src="' + IMG + 'w342' + i.poster + '" alt="" loading="lazy">' : '<div class="ph">' + esc(i.title) + "</div>") +
          '<span class="emw-type">' + (i.type === "tv" ? "TV" : "Movie") + '</span></div><div class="emw-meta"><b>' + esc(i.title) + "</b><span>" + esc(meta || (i.type === "tv" ? "TV show" : "Movie")) + "</span></div></a>" +
          '<button type="button" class="emw-rm" data-rm="' + i.type + "-" + i.id + '" aria-label="Remove ' + esc(i.title) + ' from your Watchlist">&times;</button></article>';
      }).join("") + "</div>";
      html += '<p class="emw-note">Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>';
    }
    root.innerHTML = html;
    var sel = doc.getElementById("emw-sort"); if (sel) sel.value = view.sort;
    if (focus) { var f = root.querySelector('[data-f="' + focus + '"]'); if (f) f.focus(); }
    all.forEach(function (i) { if (!i.poster) enrich(i.type, i.id); });
  }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var a = el("a", { href: URL.createObjectURL(blob), download: name }); doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fullLink(i) { return location.origin + "/title.html?type=" + i.type + "&id=" + i.id; }
  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/^[=+\-@]/.test(v)) v = "'" + v;                                          // stop spreadsheets treating a title as a formula
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportList(kind) {
    var list = read(), day = new Date().toISOString().slice(0, 10);
    if (kind === "csv") {
      var rows = [["Title", "Type", "Year", "Rating", "Date added", "Link"]].concat(list.map(function (i) {
        return [i.title, i.type === "tv" ? "TV show" : "Movie", i.year, i.rating || "", new Date(i.added).toISOString().slice(0, 10), fullLink(i)];
      }));
      download("my-watchlist-" + day + ".csv", "\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"), "text/csv;charset=utf-8");
    } else if (kind === "txt") {
      download("my-watchlist-" + day + ".txt", "My Watchlist - Every Movie Plug\r\n\r\n" + list.map(function (i, n) {
        return (n + 1) + ". " + i.title + (i.year ? " (" + i.year + ")" : "") + " - " + (i.type === "tv" ? "TV show" : "Movie") + "\r\n   " + fullLink(i);
      }).join("\r\n"), "text/plain;charset=utf-8");
    } else {
      download("my-watchlist-" + day + ".json", JSON.stringify({ app: "everymovieplug", version: 1, exported: new Date().toISOString(), items: list }, null, 2), "application/json");
    }
  }
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, i = 0;
    text = text.replace(/^\ufeff/, "");
    for (; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function itemsFromCSV(text) {
    var rows = parseCSV(text), head = (rows.shift() || []).map(function (h) { return h.trim().toLowerCase(); });
    var ti = head.indexOf("title"), yi = head.indexOf("year"), ri = head.indexOf("rating"), li = head.indexOf("link"), di = head.indexOf("date added");
    if (ti < 0 || li < 0) throw 0;
    return rows.map(function (r) {
      var m = /[?&]type=(movie|tv)&id=(\d+)/.exec(r[li] || ""); if (!m) return null;
      return { type: m[1], id: +m[2], title: String(r[ti] || "").replace(/^'(?=[=+\-@])/, ""), year: r[yi] || "", rating: parseFloat(r[ri]) || 0, added: Date.parse(r[di] || "") || Date.now() };
    }).filter(Boolean);
  }
  function importList() {
    var inp = el("input", { type: "file", accept: ".csv,.json,text/csv,application/json", style: "display:none" });
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var txt = String(r.result), items, add = 0;
          if (/\.csv$/i.test(f.name)) items = itemsFromCSV(txt);
          else { var d = JSON.parse(txt); items = Array.isArray(d) ? d : d.items; }
          if (!Array.isArray(items)) throw 0;
          items.slice(0, MAX).forEach(function (i) { if (valid(i) && !api.has(i.type, i.id) && api.add(i)) add++; });
          toast(add ? "Imported " + add + " title" + (add > 1 ? "s" : "") : "Nothing new to import");
        } catch (e) { toast("That file is not a Watchlist export."); }
      };
      r.readAsText(f); inp.remove();
    });
    doc.body.appendChild(inp); inp.click();
  }
  function bindPage() {
    var root = doc.getElementById("emw-page"); if (!root) return;
    root.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.hasAttribute("data-f")) { view.filter = t.getAttribute("data-f"); renderPage(); }
      else if (t.hasAttribute("data-rm")) {
        var p = t.getAttribute("data-rm").split("-"), old = read().filter(function (i) { return i.type === p[0] && i.id === +p[1]; })[0];
        api.remove(p[0], +p[1]); if (old) toast("Removed from your Watchlist", "Undo", function () { api.add(old); });
      } else if (/^export-/.test(t.getAttribute("data-a") || "")) { exportList(t.getAttribute("data-a").slice(7)); var dm = t.closest("details"); if (dm) dm.open = false; }
      else if (t.getAttribute("data-a") === "import") importList();
      else if (t.getAttribute("data-a") === "clear") {
        if (!sure) { sure = true; renderPage(); setTimeout(function () { if (sure) { sure = false; renderPage(); } }, 4000); }
        else { sure = false; var saved = read(); api.clear(); toast("Watchlist cleared", "Undo", function () { saved.slice().reverse().forEach(function (i) { api.add(i); }); }); }
      }
    });
    root.addEventListener("change", function (e) { if (e.target.id === "emw-sort") { view.sort = e.target.value; renderPage(); } });
  }

  /* ------------------------------------------------------------ start */
  window.EMPWatchlist = api;
  var queued = 0;
  function scan() { queued = 0; decorateAll(); scanDetails(); }
  function queue() { if (!queued) queued = requestAnimationFrame(scan); }
  function start() {
    addStyle(); addNav(); bindPage(); scan(); refresh();
    if (window.MutationObserver) new MutationObserver(queue).observe(doc.body, { childList: true, subtree: true });
    window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === null) changed(); });   // another tab changed it
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
