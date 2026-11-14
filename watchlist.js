/**
 * Every Movie Plug - Watchlist (saved in this browser only, nothing is sent to the server).
 *
 * Storage:  localStorage key "emp_watchlist_v1"  ->  [{type, id, title, poster, year, rating, added}, ...] newest first.
 *
 * What it adds (it never rewrites the pages' own markup, and every part fails quietly if a page lacks the element):
 *   - a small bookmark button on the poster of every movie / TV card (cards that open the popup or /title.html)
 *   - a "Save to Watchlist" chip inside the details popup and on the full title page (/title.html)
 *   - a "Watchlist" chip with a live count in the header (or a round floating button on pages without a header menu)
 *   - the /watchlist.html page itself (filter, sort, remove, download, import, clear)
 *   - Share: a link (/w/<code>) to a snapshot of the list, with a collage thumbnail of the first posters (see functions/w and functions/api/share.js)
 *     When someone opens a shared link the same page shows it read-only, with 'Save all to my Watchlist'.
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
    addMany: function (items) {                                                         // one write for many titles; returns how many were new
      var list = read(), have = {}, added = 0;
      list.forEach(function (i) { have[keyOf(i.type, i.id)] = 1; });
      for (var x = items.length - 1; x >= 0; x--) {
        var it = items[x]; if (!valid(it) || have[keyOf(it.type, it.id)] || list.length >= MAX) continue;
        var n = norm(it); n.added = Date.now() - x; list.unshift(n); have[keyOf(it.type, it.id)] = 1; added++;
      }
      if (added) { write(list); changed(); }
      return added;
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
    ".fx-slide>.emw-save,.hub-fx-slide>.emw-save{top:16px;right:22px;bottom:auto;width:38px;height:38px;z-index:5}",
    ".fx-slide>.emw-save svg,.hub-fx-slide>.emw-save svg{width:18px;height:18px}",
    ".emw-chip[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7)}",
    ".emw-count{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#8b5cf6;color:#fff;font-size:.68rem;font-weight:700;line-height:1}",
    ".emw-count[hidden]{display:none}",
    ".emw-fab{position:fixed;z-index:2147481000;right:max(16px,env(safe-area-inset-right));bottom:calc(78px + env(safe-area-inset-bottom));opacity:0;pointer-events:none;scale:.4;translate:0 24px;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#fff;text-decoration:none;background:rgba(14,14,22,.9);border:1px solid rgba(255,255,255,.2);box-shadow:0 10px 30px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:opacity .3s ease,scale .45s cubic-bezier(.34,1.56,.64,1),translate .45s cubic-bezier(.34,1.56,.64,1),transform .12s ease,background .2s ease}",
    ".emw-fab.on{opacity:1;pointer-events:auto;scale:1;translate:0 0}",
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
    ".emw-btn.pri{color:#fff;border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7)}",
    ".emw-btn.pri:hover{background:linear-gradient(135deg,#7476f3,#b26cf8)}",
    "#emw-share{position:fixed;inset:0;z-index:2147482600;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.74);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
    "#emw-share.open{display:flex}",
    ".emw-sbox{position:relative;width:100%;max-width:520px;max-height:92vh;overflow:auto;padding:24px;border-radius:26px;background:rgba(14,14,22,.98);border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.8);color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif}",
    ".emw-sbox h2{margin:0 0 .4rem;font-size:1.25rem;font-weight:700;letter-spacing:-.01em;padding-right:34px}",
    ".emw-sbox p{margin:0 0 1rem;font-size:.84rem;line-height:1.5;color:#a1a1aa}",
    ".emw-sbox label{display:block;font-size:.78rem;font-weight:600;margin-bottom:.4rem;color:#d4d4d8}",
    ".emw-sbox input[type=text]{width:100%;padding:.7rem .9rem;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:.9rem;outline:none}",
    ".emw-sbox input[type=text]:focus{border-color:#a855f7}",
    ".emw-sx{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font-size:1.2rem;line-height:1;cursor:pointer}",
    ".emw-srow{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}",
    ".emw-sprev{display:block;width:100%;aspect-ratio:1200/630;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,.14);margin:0 0 1rem;background:#0c0c12}",
    ".emw-sstat{min-height:1.2em;margin-top:.8rem;font-size:.8rem;color:#c4b5fd}",
    ".emw-sbox .emw-small{font-size:.74rem;color:#86868b;margin:.9rem 0 0}",
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
        var u = new URL(n.getAttribute("href") || "", location.href), pm = /^\/(movie|tv)\/(\d+)(?:-|\/|$)/.exec(u.pathname);
        if (pm) return { type: pm[1], id: +pm[2] };
        if (/\/title\.html$/.test(u.pathname) && /^(movie|tv)$/.test(u.searchParams.get("type") || "") && /^\d+$/.test(u.searchParams.get("id") || "")) { type = u.searchParams.get("type"); id = +u.searchParams.get("id"); }
      } catch (e) {}
    } else if ((m = /openModal\(\s*['"](movie|tv)['"]\s*,\s*(\d+)/.exec(n.getAttribute("onclick") || ""))) { type = m[1]; id = +m[2]; }
    return type ? { type: type, id: id } : null;
  }
  function fromCard(n, who) {
    var img = n.querySelector("img"), t = n.querySelector(".mmeta b, b, h3, h2, p.font-bold, p"), title = t ? t.textContent.trim() : "";
    if (!title && img) title = (img.getAttribute("alt") || "").replace(/\s*poster\s*$/i, "").trim();
    if (!title) title = (n.getAttribute("aria-label") || "").replace(/\s*\((TV show|movie)\).*$/i, "").replace(/^View details for\s*/i, "").trim();
    var year = "", yn = n.querySelector(".mmeta span, .gx-pill"); if (yn && /^\d{4}$/.test(yn.textContent.trim())) year = yn.textContent.trim();
    var rn = n.querySelector(".score, .gx-rate b"), rating = rn ? parseFloat(rn.textContent.replace(/[^\d.]/g, "")) : 0;
    return { type: who.type, id: who.id, title: title, poster: img && !n.classList.contains("fx-slide") && !n.classList.contains("hub-fx-slide") ? posterPath(img.currentSrc || img.src) : "", year: year, rating: rating || 0 };
  }

  /* ------------------------------------------------------------ the save button on cards */
  function label(it, saved) { return (saved ? "Remove " : "Add ") + it.title + (saved ? " from your Watchlist" : " to your Watchlist"); }
  function decorate(n) {
    if (n.getAttribute("data-emw") || (!SHARED && n.closest("#emw-page"))) return;
    var who = ident(n); if (!who) return;
    var host = n.querySelector(".poster") || (n.querySelector("img") && n.querySelector("img").parentElement) || n.querySelector('[class*="aspect-"]');
    if (!host) return;
    var it = fromCard(n, who); if (!it.title) return;
    var k = keyOf(who.type, who.id); n.setAttribute("data-emw", k);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    var saved = api.has(who.type, who.id);
    host.appendChild(el("span", { "class": "emw-save", role: "button", tabindex: "-1", "data-k": k, "aria-pressed": saved ? "true" : "false", "aria-label": label(it, saved), title: saved ? "Saved to Watchlist" : "Save to Watchlist" }, ICON));
  }
  function decorateAll(root) {
    var list = (root || doc).querySelectorAll('a[href*="title.html"], a[href^="/movie/"], a[href^="/tv/"], button[onclick*="openModal("]');
    for (var i = 0; i < list.length; i++) decorate(list[i]);
  }
  /* click: runs first (capture) so the card underneath never opens */
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".emw-save"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.__item) { flip(b.__item); return; }
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
        var tItem = { type: tp, id: tid, title: h1.textContent.trim(), poster: pi ? posterPath(pi.src) : "", year: yy ? yy[1] : "", rating: rt ? parseFloat(rt.textContent.replace(/[^\d.]/g, "")) || 0 : 0 };
        addChip(tb, "chip", tItem);
        var ph = doc.querySelector(".head .poster");
        if (ph && !ph.querySelector(".emw-save")) {
          var sv = el("span", { "class": "emw-save", role: "button", tabindex: "-1", "data-k": keyOf(tp, tid), "aria-pressed": api.has(tp, tid) ? "true" : "false", "aria-label": "Save " + tItem.title + " to your Watchlist", title: "Save to Watchlist" }, ICON);
          sv.__item = tItem; ph.style.position = "relative"; ph.appendChild(sv);
        }
      }
    }
  }
  function navChip(extra) {
    return '<a class="' + extra + ' emw-nav" href="/watchlist.html" aria-label="Your Watchlist">' + ICON + '<span class="lbl">Watchlist</span> <span class="emw-count" hidden></span></a>';
  }
  function addNav() {
    if (doc.getElementById("emw-page")) return;
    if (!doc.querySelector(".emw-fab")) doc.body.appendChild(el("a", { "class": "emw-fab", href: "/watchlist.html", "aria-label": "Your Watchlist", title: "Your Watchlist", "data-fx": "off" }, ICON + '<span class="emw-count" hidden></span>'));
    if (doc.querySelector(".emw-nav")) return;
    var row = doc.querySelector("nav.navrow"), top = doc.querySelector(".topbar-in");
    if (row) { var d = el("div", {}, navChip("chip")); row.appendChild(d.firstChild); }
    else if (top) {
      var share = doc.getElementById("shareTop"), d2 = el("div", {}, navChip("chip")); top.insertBefore(d2.firstChild, share || null);
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
    var fb = doc.querySelectorAll(".emw-fab");
    for (var z = 0; z < fb.length; z++) fb[z].classList.toggle("on", n > 0);
    if (doc.getElementById("emw-page")) renderPage();
  }

  /* ------------------------------------------------------------ /watchlist.html */
  var view = { filter: "all", sort: "added" }, sure = false, SHARED = null, sharedItems = [], sharedMissing = false, pendingCode = "";
  function sortList(list) {
    var s = view.sort, out = list.slice();
    if (s === "title") out.sort(function (a, b) { return a.title.localeCompare(b.title); });
    else if (s === "year") out.sort(function (a, b) { return (b.year || "0").localeCompare(a.year || "0"); });
    else if (s === "rating") out.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    else out.sort(function (a, b) { return b.added - a.added; });
    return out;
  }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function renderPage() {
    var root = doc.getElementById("emw-page"); if (!root) return;
    if (SHARED && sharedMissing) {
      root.innerHTML = '<h1>This list is not available</h1><p class="emw-sub">The link may have expired or been copied incorrectly. You can still build your own Watchlist.</p><div class="emw-bar"><a class="emw-btn pri" href="/watchlist.html">Go to my Watchlist</a><a class="emw-btn" href="/trending">Browse trending</a></div>';
      return;
    }
    var all = SHARED ? sharedItems : read(), movies = all.filter(function (i) { return i.type === "movie"; }).length, tv = all.length - movies;
    var list = sortList(all.filter(function (i) { return view.filter === "all" || i.type === view.filter; }));
    var focus = doc.activeElement && doc.activeElement.getAttribute && doc.activeElement.getAttribute("data-f");
    var html = SHARED
      ? '<h1>' + esc(SHARED.name || "Shared Watchlist") + '</h1><p class="emw-sub">' + plural(all.length, "title") + ' shared with you. Tap the bookmark on a poster to add it to your own Watchlist, or save them all at once.</p>'
      : '<h1>Your Watchlist</h1><p class="emw-sub">Movies and shows you saved to watch later. They are kept in this browser on this device only until you choose to share them, so clearing your browser data or switching device will not carry them over (use Download list to keep a copy).</p>';
    if (!all.length) {
      html += '<div class="emw-empty" style="margin-top:1.6rem">' + ICON + '<p>Nothing saved yet. Tap the bookmark on any movie or show poster, or press &ldquo;Save to Watchlist&rdquo; on a title page, and it will show up here.</p>' +
        '<div class="row"><a class="emw-btn" href="/trending">Browse trending</a><a class="emw-btn" href="/movies/">Movies</a><a class="emw-btn" href="/tv-shows/">TV shows</a><button type="button" class="emw-btn" data-a="import">Import a list</button></div></div>';
    } else {
      var tabs = [["all", "All", all.length], ["movie", "Movies", movies], ["tv", "TV shows", tv]].map(function (t) { return '<button type="button" class="emw-tab" data-f="' + t[0] + '" aria-pressed="' + (view.filter === t[0]) + '">' + t[1] + " (" + t[2] + ")</button>"; }).join("");
      var sortSel = '<label style="position:absolute;left:-9999px" for="emw-sort">Sort by</label><select class="emw-sort" id="emw-sort"><option value="added">' + (SHARED ? "Shared order" : "Recently added") + '</option><option value="title">Title A to Z</option><option value="year">Newest release</option><option value="rating">Highest rated</option></select>';
      html += '<div class="emw-bar"><div class="emw-tabs" role="group" aria-label="Filter">' + tabs + "</div>" + sortSel +
        (SHARED
          ? '<button type="button" class="emw-btn pri" data-a="saveall">Save all to my Watchlist</button><a class="emw-btn" href="/watchlist.html">My Watchlist</a>'
          : '<button type="button" class="emw-btn pri" data-a="share">Share</button>' +
            '<details class="emw-menu"><summary class="emw-btn">Download list</summary><div class="emw-pop"><button type="button" data-a="export-csv">Spreadsheet (.csv)</button><button type="button" data-a="export-txt">Text list (.txt)</button><button type="button" data-a="export-json">Backup file (.json)</button></div></details>' +
            '<button type="button" class="emw-btn" data-a="import">Import</button>' +
            '<button type="button" class="emw-btn danger"' + (sure ? " data-sure" : "") + ' data-a="clear">' + (sure ? "Tap again to clear all" : "Clear all") + "</button>") + "</div>";
      if (!list.length) html += '<div class="emw-empty"><p>No ' + (view.filter === "tv" ? "TV shows" : "movies") + " in this list yet.</p></div>";
      else html += '<div class="emw-grid">' + list.map(function (i) {
        var href = "/title.html?type=" + i.type + "&id=" + i.id, meta = [i.year, i.rating ? "★ " + i.rating.toFixed(1) : ""].filter(Boolean).join(" · ");
        return '<article class="emw-card"><a href="' + href + '" aria-label="' + esc(i.title || "Open full page") + '"><div class="emw-poster">' +
          (i.poster ? '<img src="' + IMG + 'w342' + i.poster + '" alt="" loading="lazy">' : '<div class="ph">' + esc(i.title) + "</div>") +
          '<span class="emw-type">' + (i.type === "tv" ? "TV" : "Movie") + '</span></div><div class="emw-meta"><b>' + (i.title ? esc(i.title) : "&nbsp;") + "</b><span>" + esc(meta || (i.type === "tv" ? "TV show" : "Movie")) + "</span></div></a>" +
          (SHARED ? "" : '<button type="button" class="emw-rm" data-rm="' + i.type + "-" + i.id + '" aria-label="Remove ' + esc(i.title) + ' from your Watchlist">&times;</button>') + "</article>";
      }).join("") + "</div>";
      html += '<p class="emw-note">Film and TV data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>';
    }
    root.innerHTML = html;
    var sel = doc.getElementById("emw-sort"); if (sel) sel.value = view.sort;
    if (focus) { var f = root.querySelector('[data-f="' + focus + '"]'); if (f) f.focus(); }
    if (!SHARED) all.forEach(function (i) { if (!i.poster) enrich(i.type, i.id); });
  }

  /* a shared link that only carries ids: fetch titles and posters here, six at a time */
  function loadSharedMeta() {
    var todo = sharedItems.filter(function (i) { return !i.title; }), idx = 0, active = 0, t = 0;
    function paint() { clearTimeout(t); t = setTimeout(renderPage, 200); }
    function next() {
      while (active < 6 && idx < todo.length) {
        (function (it) {
          active++;
          fetch("/api/tmdb/" + it.type + "/" + it.id + "?language=en-US").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            if (d) { it.title = d.title || d.name || "Untitled"; it.poster = d.poster_path || ""; var y = (d.release_date || d.first_air_date || "").slice(0, 4); it.year = /^\d{4}$/.test(y) ? y : ""; it.rating = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0; }
            else it.title = "Unavailable";
          }).catch(function () { it.title = "Unavailable"; }).then(function () { active--; paint(); next(); });
        })(todo[idx++]);
      }
    }
    next();
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
  /* ------------------------------------------------------------ Share */
  function b64url(str) { return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function loadImg(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; }); }
  function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function wrapLines(x, text, max, lines) {
    var words = text.split(/\s+/), out = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + " " + words[i] : words[i];
      if (x.measureText(t).width > max && cur) { out.push(cur); cur = words[i]; } else cur = t;
    }
    if (cur) out.push(cur);
    if (out.length > lines) { out = out.slice(0, lines); out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, "") + "…"; }
    return out;
  }
  /* 1200x630 thumbnail: the first posters of the list as a collage, plus the list name */
  function buildCollage(items, name) {
    var pick = items.filter(function (i) { return i.poster; }).slice(0, 8);
    return Promise.all(pick.map(function (i) { return loadImg("/api/poster/w342" + i.poster); })).then(function (imgs) {
      imgs = imgs.filter(Boolean);
      var W = 1200, H = 630, c = doc.createElement("canvas"); c.width = W; c.height = H;
      var x = c.getContext("2d"), font = '-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif';
      var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#08080f"); g.addColorStop(1, "#22123f"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      var rg = x.createRadialGradient(900, 140, 10, 900, 140, 560); rg.addColorStop(0, "rgba(139,92,246,.38)"); rg.addColorStop(1, "rgba(139,92,246,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
      var n = imgs.length;
      if (n) {
        var cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), gap = 12, ax = 420, aw = 740, ay = 40, ah = 550;
        var tw = Math.min((aw - (cols - 1) * gap) / cols, (ah - (rows - 1) * gap) / rows / 1.5), th = tw * 1.5;
        var gh = rows * th + (rows - 1) * gap, y0 = ay + (ah - gh) / 2;
        imgs.forEach(function (im, k) {
          var r = Math.floor(k / cols), col = k % cols, inRow = r === rows - 1 ? n - r * cols : cols;
          var gw = inRow * tw + (inRow - 1) * gap, px = ax + (aw - gw) / 2 + col * (tw + gap), py = y0 + r * (th + gap);
          x.save(); x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 24; x.shadowOffsetY = 8; rrect(x, px, py, tw, th, 14); x.fillStyle = "#111"; x.fill(); x.restore();
          x.save(); rrect(x, px, py, tw, th, 14); x.clip(); x.drawImage(im, px, py, tw, th); x.restore();
          x.save(); rrect(x, px + .5, py + .5, tw - 1, th - 1, 14); x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 1; x.stroke(); x.restore();
        });
      }
      x.fillStyle = "#c4b5fd"; x.font = "700 22px " + font; x.textBaseline = "alphabetic"; x.fillText("WATCHLIST", 56, 120);
      x.fillStyle = "#ffffff"; x.font = "800 56px " + font;
      var lines = wrapLines(x, name || "My Watchlist", 330, 4);
      lines.forEach(function (ln, k) { x.fillText(ln, 56, 190 + k * 64); });
      x.fillStyle = "#a1a1aa"; x.font = "500 26px " + font; x.fillText(plural(items.length, "title"), 56, 190 + lines.length * 64 + 18);
      x.fillStyle = "#e9d5ff"; x.font = "700 22px " + font; x.fillText("everymovieplug.com", 56, H - 48);
      return new Promise(function (res) {
        c.toBlob(function (b) { if (b && b.size > 480000) c.toBlob(res, "image/jpeg", .7); else res(b); }, "image/jpeg", .84);
      });
    });
  }

  var shareEl = null, shareBlobUrl = "";
  function openShare() {
    var items = sortList(read());
    if (!items.length) { toast("Save a few titles first, then share."); return; }
    var trimmed = items.length > 200; items = items.slice(0, 200);
    if (!shareEl) {
      shareEl = el("div", { id: "emw-share", "data-fx": "off" });
      shareEl.addEventListener("click", function (e) { if (e.target === shareEl || e.target.closest(".emw-sx")) closeShare(); });
      doc.body.appendChild(shareEl);
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && shareEl.classList.contains("open")) closeShare(); });
    }
    shareEl.innerHTML = '<div class="emw-sbox" role="dialog" aria-modal="true" aria-labelledby="emw-sh"><button type="button" class="emw-sx" aria-label="Close">&times;</button>' +
      '<h2 id="emw-sh">Share your Watchlist</h2>' +
      '<p>Anyone with the link can open these ' + plural(items.length, "title") + (trimmed ? " (the 200 newest)" : "") + ' and add them to their own Watchlist. It is a snapshot, so to share later changes just make a new link.</p>' +
      '<div id="emw-sform"><label for="emw-sname">Name your list (optional)</label><input type="text" id="emw-sname" maxlength="40" placeholder="e.g. Weekend picks" autocomplete="off">' +
      '<div class="emw-srow"><button type="button" class="emw-btn pri" id="emw-smake">Create link</button></div></div>' +
      '<div id="emw-sres" hidden></div><div class="emw-sstat" id="emw-sstat" role="status" aria-live="polite"></div></div>';
    shareEl.classList.add("open");
    var inp = doc.getElementById("emw-sname"); inp.focus();
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") makeLink(items); });
    doc.getElementById("emw-smake").addEventListener("click", function () { makeLink(items); });
  }
  function closeShare() { if (shareEl) shareEl.classList.remove("open"); if (shareBlobUrl) { URL.revokeObjectURL(shareBlobUrl); shareBlobUrl = ""; } }
  function makeLink(items) {
    var name = doc.getElementById("emw-sname").value.replace(/\s+/g, " ").trim(), btn = doc.getElementById("emw-smake"), stat = doc.getElementById("emw-sstat");
    btn.disabled = true; stat.textContent = "Making your thumbnail…";
    var blob = null;
    buildCollage(items, name).catch(function () { return null; }).then(function (b) {
      blob = b; stat.textContent = "Creating your link…";
      var fd = new FormData();
      fd.append("meta", JSON.stringify({ name: name, items: items }));
      if (blob) fd.append("image", blob, "collage.jpg");
      return fetch("/api/share", { method: "POST", body: fd }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }).then(function (res) {
      var link, note = "";
      if (res && res.code) link = location.origin + "/w/" + res.code;
      else {                                                                                        // no storage set up (or offline): a longer link that holds just the ids
        link = location.origin + "/w/~" + b64url(items.map(function (i) { return (i.type === "tv" ? "t" : "m") + i.id; }).join(","));
        note = "This is a longer link without the collage thumbnail (it shows the first poster instead).";
      }
      showResult(link, blob, name, items.length, note);
    });
  }
  function showResult(link, blob, name, count, note) {
    var res = doc.getElementById("emw-sres"), form = doc.getElementById("emw-sform"); form.hidden = true;
    if (blob) { shareBlobUrl = URL.createObjectURL(blob); }
    res.innerHTML = (shareBlobUrl && !note ? '<img class="emw-sprev" alt="Preview of the thumbnail people will see when you share the link" src="' + shareBlobUrl + '">' : "") +
      '<label for="emw-slink">Your link</label><input type="text" id="emw-slink" readonly value="' + esc(link) + '">' +
      '<div class="emw-srow"><button type="button" class="emw-btn pri" id="emw-scopy">Copy link</button>' +
      (navigator.share ? '<button type="button" class="emw-btn" id="emw-snative">Share…</button>' : "") + '</div>' +
      (note ? '<p class="emw-small">' + esc(note) + "</p>" : "");
    res.hidden = false; doc.getElementById("emw-sstat").textContent = "";
    var li = doc.getElementById("emw-slink"); li.addEventListener("focus", function () { li.select(); });
    doc.getElementById("emw-scopy").addEventListener("click", function () {
      function ok() { doc.getElementById("emw-sstat").textContent = "Link copied."; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, function () { li.select(); doc.execCommand("copy"); ok(); });
      else { li.select(); doc.execCommand("copy"); ok(); }
    });
    var nb = doc.getElementById("emw-snative");
    if (nb) nb.addEventListener("click", function () { navigator.share({ title: name || "My Watchlist", text: (name || "My Watchlist") + " - " + plural(count, "title") + " on Every Movie Plug", url: link }).catch(function () {}); });
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
      else if (t.getAttribute("data-a") === "share") openShare();
      else if (t.getAttribute("data-a") === "saveall") {
        var added = api.addMany(sharedItems.filter(function (i) { return i.title && i.title !== "Unavailable"; }));
        toast(added ? "Added " + plural(added, "title") + " to your Watchlist" : "Everything here is already in your Watchlist", "View", function () { location.href = "/watchlist.html"; });
      }
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
    addStyle();
    var tag = doc.getElementById("emp-shared");
    if (!tag && /^\/w\//.test(location.pathname)) {                     // opened as /w/<code> but the server did not fill in the list
      var code = decodeURIComponent(location.pathname.slice(3).split("/")[0] || ""), ids = [];
      if (code.charAt(0) === "~") {                                      // long link: the ids are in the link itself, so read them here
        try {
          atob(code.slice(1).replace(/-/g, "+").replace(/_/g, "/")).split(",").slice(0, 200).forEach(function (p) { var m = /^([mt])(\d{1,9})$/.exec(p); if (m) ids.push({ type: m[1] === "m" ? "movie" : "tv", id: +m[2] }); });
        } catch (e) {}
      }
      if (ids.length) tag = { textContent: JSON.stringify({ name: "", items: ids, idsOnly: true }) };
      else if (/^[A-Za-z0-9]{8}$/.test(code) && window.fetch) {           // short link: ask the server for the saved list
        tag = { textContent: JSON.stringify({ name: "", items: [] }) }; pendingCode = code;
      } else tag = { textContent: JSON.stringify({ missing: true }) };
    }
    if (tag) {
      try { SHARED = JSON.parse(tag.textContent); } catch (e) { SHARED = { missing: true }; }
      if (SHARED.missing) sharedMissing = true;
      else {
        var cnt = SHARED.items.length;
        sharedItems = SHARED.items.map(function (i, k) { return { type: i.type === "tv" ? "tv" : "movie", id: +i.id, title: i.title || "", poster: i.poster || "", year: i.year || "", rating: +i.rating || 0, added: cnt - k }; });
      }
    }
    addNav(); bindPage(); scan(); refresh();
    if (SHARED && SHARED.idsOnly) loadSharedMeta();
    if (pendingCode) fetch("/api/share/" + pendingCode).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && Array.isArray(d.items) && d.items.length) {
        SHARED.name = d.name || ""; var c = d.items.length;
        sharedItems = d.items.map(function (i, k) { return { type: i.type === "tv" ? "tv" : "movie", id: +i.id, title: i.title || "", poster: i.poster || "", year: i.year || "", rating: +i.rating || 0, added: c - k }; });
      } else sharedMissing = true;
      renderPage();
    }).catch(function () { sharedMissing = true; renderPage(); });
    if (window.MutationObserver) new MutationObserver(queue).observe(doc.body, { childList: true, subtree: true });
    window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === null) changed(); });   // another tab changed it
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
