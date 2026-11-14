/**
 * Every Movie Plug - Read Later for news and articles (saved in this browser only, nothing is sent to the server).
 *
 * Storage:  localStorage key "emp_readlater_v1"  ->  [{url, kind, title, img, date, added}, ...] newest first.
 *
 * What it adds (loaded on every page by consent.js, or directly by /readlater.html):
 *   - a small clock button on every news / article card (listing pages, home, trending, search results)
 *   - a "Read later" button next to Share on every story page
 *   - a round floating button with the saved count, above the Watchlist button, shown only when something is saved
 *   - the /readlater.html page itself (filter, remove, clear all with undo)
 *
 * Public API:  EMPReadLater.list() .has(url) .add(item) .remove(url) .toggle(item) .clear() .count()
 *              document event "emp:readlater" fires whenever the list changes (also when another tab changes it).
 */
(function () {
  "use strict";
  if (window.EMPReadLater) return;
  var doc = document, KEY = "emp_readlater_v1", MAX = 300, fallback = null;
  var STORY = /^\/(news|articles)\/([^\/.]+)(?:\.html)?$/;

  /* ------------------------------------------------------------ storage */
  function cleanUrl(u) {                                   // "/news/slug.html" and "https://site/news/slug" are the same story
    try { u = new URL(u, location.href).pathname; } catch (e) { return ""; }
    var m = STORY.exec(u);
    return m && m[2] !== "index" ? "/" + m[1] + "/" + m[2] : "";
  }
  function valid(i) { return i && typeof i.url === "string" && STORY.test(i.url) && typeof i.title === "string" && i.title; }
  function read() {
    if (fallback) return fallback.slice();
    var a = [];
    try { var raw = localStorage.getItem(KEY); if (raw) a = JSON.parse(raw); } catch (e) { return []; }
    return Array.isArray(a) ? a.filter(valid) : [];
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); fallback = null; return true; }
    catch (e) { fallback = list.slice(); return false; }
  }
  function norm(i) {
    return {
      url: i.url, kind: /^\/news\//.test(i.url) ? "news" : "article", title: String(i.title).slice(0, 240),
      img: typeof i.img === "string" && /^https?:\/\//.test(i.img) ? i.img.slice(0, 500) : "",
      date: String(i.date || "").slice(0, 40), added: isFinite(+i.added) && +i.added > 0 ? +i.added : Date.now()
    };
  }
  function changed() {
    refresh();
    try { doc.dispatchEvent(new CustomEvent("emp:readlater", { detail: { count: read().length } })); } catch (e) {}
  }
  var api = {
    list: read,
    count: function () { return read().length; },
    has: function (url) { url = cleanUrl(url); return !!url && read().some(function (i) { return i.url === url; }); },
    add: function (item) {
      if (!item) return false; item.url = cleanUrl(item.url); if (!valid(item)) return false;
      var list = read();
      for (var x = 0; x < list.length; x++) if (list[x].url === item.url) return true;
      if (list.length >= MAX) { toast("Your Read Later list is full (" + MAX + " stories)."); return false; }
      list.unshift(norm(item));
      if (!write(list)) toast("This browser is blocking storage, so your list will be lost when you close the tab.");
      changed(); return true;
    },
    remove: function (url) {
      url = cleanUrl(url); var list = read(), out = list.filter(function (i) { return i.url !== url; });
      if (out.length === list.length) return false;
      write(out); changed(); return true;
    },
    clear: function () { write([]); changed(); },
    toggle: function (item) {
      var url = cleanUrl(item.url);
      if (api.has(url)) { var old = read().filter(function (i) { return i.url === url; })[0]; api.remove(url); return { saved: false, old: old }; }
      return { saved: api.add(item) };
    }
  };

  /* ------------------------------------------------------------ helpers */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(tag, attrs, html) { var n = doc.createElement(tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (html != null) n.innerHTML = html; return n; }
  function squish(t) { return String(t || "").replace(/\s+/g, " ").trim(); }
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  var toastEl = null, toastTimer = 0;
  function toast(msg, actionLabel, action) {
    if (!toastEl) { toastEl = el("div", { id: "emr-toast", role: "status", "aria-live": "polite", "data-fx": "off" }); doc.body.appendChild(toastEl); }
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

  /* ------------------------------------------------------------ styles */
  var css = [
    ".emr-save{position:absolute;right:.5rem;bottom:.5rem;z-index:4;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.62);border:1px solid rgba(255,255,255,.22);color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);cursor:pointer;transition:background .2s ease,transform .12s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    ".emr-save.top{top:.6rem;right:.6rem;bottom:auto}",
    ".emr-save svg,.emr-btn svg,.emr-fab svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;flex:none}",
    ".emr-save[aria-pressed=true],.emr-fab.has{background:linear-gradient(135deg,#6366f1,#a855f7);border-color:transparent}",
    ".emr-save:active{transform:scale(.9)}",
    "@media (hover:hover),(any-hover:hover){.emr-save:hover{background:rgba(168,85,247,.6)}.emr-save[aria-pressed=true]:hover{background:linear-gradient(135deg,#7476f3,#b26cf8)}}",
    ".emr-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1.1rem;border-radius:9999px;border:1px solid var(--pill-edge,rgba(124,58,237,.35));background:var(--pill-bg,rgba(124,58,237,.08));color:var(--pill-fg,#6d28d9);font:600 .9rem/1 -apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s,transform .15s}",
    ".emr-btn:hover{background:var(--pill-edge,rgba(124,58,237,.35))}.emr-btn:active{transform:scale(.96)}",
    ".emr-btn[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7)}",
    ".emr-fab{position:fixed;z-index:2147481000;right:max(16px,env(safe-area-inset-right));bottom:calc(78px + env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#fff;text-decoration:none;background:rgba(14,14,22,.9);border:1px solid rgba(255,255,255,.2);box-shadow:0 10px 30px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);opacity:0;pointer-events:none;scale:.4;translate:0 24px;transition:opacity .3s ease,scale .45s cubic-bezier(.34,1.56,.64,1),translate .45s cubic-bezier(.34,1.56,.64,1),transform .12s ease,background .2s ease}",
    ".emr-fab.on{opacity:1;pointer-events:auto;scale:1;translate:0 0}",
    "html:has(.emw-fab.on) .emr-fab{bottom:calc(138px + env(safe-area-inset-bottom))}",
    ".emr-fab:active{transform:scale(.94)}",
    ".emr-fab svg{width:20px;height:20px}",
    ".emr-count{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#8b5cf6;color:#fff;font:700 .68rem/1 -apple-system,BlinkMacSystemFont,sans-serif}",
    ".emr-count[hidden]{display:none}",
    ".emr-fab .emr-count{position:absolute;top:-4px;right:-4px;border:2px solid #060609;box-sizing:content-box}",
    "#emr-toast{position:fixed;left:50%;bottom:max(1.5rem,env(safe-area-inset-bottom));transform:translate(-50%,16px);z-index:2147482400;display:flex;align-items:center;gap:.9rem;max-width:calc(100vw - 32px);padding:.7rem 1.1rem;border-radius:9999px;background:#18181f;border:1px solid rgba(255,255,255,.14);color:#f5f5f7;font:500 .82rem/1.3 -apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease}",
    "#emr-toast.show{opacity:1;pointer-events:auto;transform:translate(-50%,0)}",
    "#emr-toast button{appearance:none;background:none;border:0;padding:0;font:inherit;font-weight:700;color:#c4b5fd;cursor:pointer}",
    /* ---- the /readlater.html page ---- */
    ".emr-page h1{font-size:clamp(1.8rem,4.6vw,2.8rem);font-weight:800;letter-spacing:-.025em;line-height:1.1}",
    ".emr-sub{margin-top:.5rem;color:#86868b;font-size:.9rem;max-width:60ch}",
    ".emr-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:1.6rem 0 1.2rem}",
    ".emr-tabs{display:flex;flex-wrap:wrap;gap:.45rem;margin-right:auto}",
    ".emr-tab,.emr-pbtn{appearance:none;cursor:pointer;display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .95rem;border-radius:9999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#d4d4d8;font:500 .8rem/1 inherit;text-decoration:none;transition:background .2s ease,transform .12s ease}",
    ".emr-tab:hover,.emr-pbtn:hover{background:rgba(168,85,247,.18)}",
    ".emr-tab[aria-pressed=true]{color:#fff;border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7)}",
    ".emr-pbtn.danger[data-sure]{background:rgba(239,68,68,.22);border-color:rgba(248,113,113,.6);color:#fecaca}",
    ".emr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem}",
    ".emr-card{position:relative;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.4);transition:transform .35s cubic-bezier(.16,1,.3,1),border-color .25s ease}",
    "@media (hover:hover),(any-hover:hover){.emr-card:hover{transform:translateY(-4px);border-color:rgba(168,85,247,.5)}}",
    ".emr-card a{color:inherit;text-decoration:none;display:block}",
    ".emr-thumb{position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#1b1033,#0b0b12 60%,#2a1250);overflow:hidden}",
    ".emr-thumb img{width:100%;height:100%;object-fit:cover;display:block}",
    ".emr-kind{position:absolute;left:.6rem;top:.6rem;padding:.2rem .55rem;border-radius:9999px;font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.2)}",
    ".emr-body{padding:.8rem .95rem .95rem}",
    ".emr-body b{display:block;font-size:.92rem;line-height:1.35;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}",
    ".emr-body span{display:block;margin-top:.35rem;font-size:.74rem;color:#86868b}",
    ".emr-rm{position:absolute;right:.6rem;top:.6rem;z-index:2;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;padding:0;appearance:none;cursor:pointer;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:1.15rem;line-height:1}",
    ".emr-rm:hover{background:rgba(239,68,68,.75)}",
    ".emr-empty{padding:3.5rem 1rem;text-align:center;border-radius:24px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.16)}",
    ".emr-empty svg{width:42px;height:42px;fill:none;stroke:#a78bfa;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;margin-bottom:.8rem}",
    ".emr-empty p{color:#86868b;font-size:.92rem;margin:0 auto 1.2rem;max-width:44ch}",
    ".emr-empty .row{display:flex;flex-wrap:wrap;justify-content:center;gap:.6rem}",
    "@media (prefers-reduced-motion:reduce){.emr-card,.emr-save,.emr-fab,#emr-toast{transition-duration:.01ms!important}}"
  ].join("\n");
  function addStyle() { if (doc.getElementById("emr-style")) return; var s = el("style", { id: "emr-style" }); s.textContent = css; doc.head.appendChild(s); }

  /* ------------------------------------------------------------ the button on story cards */
  function fromCard(a) {
    var url = cleanUrl(a.getAttribute("href") || ""), img = a.querySelector("img");
    var t = a.querySelector(".tile-title, .mmeta b, h2, h3, b"), title = t ? squish(t.textContent) : "";
    if (!title) title = squish(a.getAttribute("aria-label")).replace(/^Preview\s+/i, "");
    var d = a.querySelector("time, .tile-date, .mmeta span");
    return { url: url, title: title, img: img ? (img.currentSrc || img.src || "") : "", date: d ? squish(d.textContent) : "" };
  }
  function label(it, saved) { return (saved ? "Remove " : "Save ") + it.title + (saved ? " from Read Later" : " to Read Later"); }
  function decorate(a) {
    if (a.getAttribute("data-emr") || a.closest("#hero, #emr-page, .article-content")) return;
    var url = cleanUrl(a.getAttribute("href") || ""); if (!url) return;
    var host = a.querySelector(".tile-thumb, .poster") || (a.querySelector("img") && a.querySelector("img").parentElement);
    if (!host) return;
    var it = fromCard(a); if (!it.title) return;
    a.setAttribute("data-emr", url);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    var saved = api.has(url);
    host.appendChild(el("span", { "class": "emr-save" + (host.classList.contains("tile-thumb") ? " top" : ""), role: "button", tabindex: "-1", "data-u": url, "aria-pressed": saved ? "true" : "false", "aria-label": label(it, saved), title: saved ? "Saved to Read Later" : "Read later" }, ICON));
  }
  function decorateAll() {
    var list = doc.querySelectorAll('a[href^="/news/"], a[href^="/articles/"]');
    for (var i = 0; i < list.length; i++) decorate(list[i]);
  }
  doc.addEventListener("click", function (e) {            // capture: runs first, so the card underneath never opens
    var b = e.target.closest && e.target.closest(".emr-save"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var a = b.closest("[data-emr]"); if (!a) return;
    flip(fromCard(a));
  }, true);
  function flip(item) {
    var r = api.toggle(item);
    if (r.saved) toast("Saved to Read Later", "View", function () { location.href = "/readlater.html"; });
    else if (r.old) toast("Removed from Read Later", "Undo", function () { api.add(r.old); });
  }

  /* ------------------------------------------------------------ the button on a story page */
  function pageItem() {
    var h1 = doc.querySelector(".article-header h1"), og = doc.querySelector('meta[property="og:image"]'), dt = doc.querySelector(".article-date");
    return { url: location.pathname, title: squish(h1 && h1.textContent) || squish(doc.title.replace(/\s*\|\s*Every Movie Plug\s*$/i, "")), img: og ? og.content : "", date: squish(dt && dt.textContent) };
  }
  function btnHTML(saved) { return ICON + "<span>" + (saved ? "Saved" : "Read later") + "</span>"; }
  function mountStoryButton() {
    var header = doc.querySelector(".article-header"); if (!header || !cleanUrl(location.pathname)) return;
    if (header.querySelector(".emr-btn")) return;
    var saved = api.has(location.pathname);
    var b = el("button", { type: "button", "class": "emr-btn", "data-u": cleanUrl(location.pathname), "aria-pressed": saved ? "true" : "false" }, btnHTML(saved));
    b.addEventListener("click", function () { flip(pageItem()); });
    var row = header.querySelector(".emp-actions");
    if (row) row.appendChild(b);
    else {                                                // share.js has not built its row yet: wait for it briefly, then fall back to the header
      var tries = 0, t = setInterval(function () {
        var r = header.querySelector(".emp-actions"); tries++;
        if (r && !b.parentNode) { r.appendChild(b); clearInterval(t); }
        else if (tries > 20) { clearInterval(t); if (!b.parentNode) { var w = el("div", { "class": "emp-actions", style: "display:flex;gap:.5rem;margin-top:1rem" }); w.appendChild(b); header.appendChild(w); } }
      }, 150);
    }
  }

  /* ------------------------------------------------------------ floating button */
  function addFab() {
    if (doc.getElementById("emr-page") || doc.querySelector(".emr-fab")) return;
    doc.body.appendChild(el("a", { "class": "emr-fab", href: "/readlater.html", "aria-label": "Your Read Later list", title: "Your Read Later list", "data-fx": "off" }, ICON + '<span class="emr-count" hidden></span>'));
  }

  /* update every button / count after any change */
  function refresh() {
    var list = read(), n = list.length, have = {};
    list.forEach(function (i) { have[i.url] = 1; });
    var all = doc.querySelectorAll(".emr-save, .emr-btn");
    for (var i = 0; i < all.length; i++) {
      var b = all[i], saved = !!have[b.getAttribute("data-u")];
      b.setAttribute("aria-pressed", saved ? "true" : "false");
      if (b.classList.contains("emr-btn")) b.innerHTML = btnHTML(saved);
      else { b.title = saved ? "Saved to Read Later" : "Read later"; var a = b.closest("[data-emr]"); if (a) b.setAttribute("aria-label", label(fromCard(a), saved)); }
    }
    var cs = doc.querySelectorAll(".emr-count");
    for (var j = 0; j < cs.length; j++) { cs[j].textContent = n > 99 ? "99+" : String(n); cs[j].hidden = n === 0; }
    var fb = doc.querySelectorAll(".emr-fab");
    for (var z = 0; z < fb.length; z++) { fb[z].classList.toggle("on", n > 0); fb[z].classList.toggle("has", n > 0); }
    if (doc.getElementById("emr-page")) renderPage();
  }

  /* ------------------------------------------------------------ /readlater.html */
  var view = { filter: "all" }, sure = false;
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function renderPage() {
    var root = doc.getElementById("emr-page"); if (!root) return;
    var all = read(), news = all.filter(function (i) { return i.kind === "news"; }).length, arts = all.length - news;
    var list = all.filter(function (i) { return view.filter === "all" || i.kind === view.filter; });
    var focus = doc.activeElement && doc.activeElement.getAttribute && doc.activeElement.getAttribute("data-f");
    var html = '<h1>Read Later</h1><p class="emr-sub">News and articles you saved to read later. They are kept in this browser on this device only, so clearing your browser data or switching device will not carry them over.</p>';
    if (!all.length) {
      html += '<div class="emr-empty" style="margin-top:1.6rem">' + ICON + '<p>Nothing saved yet. Tap the clock on any news story or article, or press &ldquo;Read later&rdquo; at the top of a story, and it will show up here.</p><div class="row"><a class="emr-pbtn" href="/news/">Browse news</a><a class="emr-pbtn" href="/articles/">Browse articles</a></div></div>';
    } else {
      var tabs = [["all", "All", all.length], ["news", "News", news], ["article", "Articles", arts]].map(function (t) { return '<button type="button" class="emr-tab" data-f="' + t[0] + '" aria-pressed="' + (view.filter === t[0]) + '">' + t[1] + " (" + t[2] + ")</button>"; }).join("");
      html += '<div class="emr-bar"><div class="emr-tabs" role="group" aria-label="Filter">' + tabs + '</div><button type="button" class="emr-pbtn danger"' + (sure ? " data-sure" : "") + ' data-a="clear">' + (sure ? "Tap again to clear all" : "Clear all") + "</button></div>";
      if (!list.length) html += '<div class="emr-empty"><p>No ' + (view.filter === "news" ? "news stories" : "articles") + " saved yet.</p></div>";
      else html += '<div class="emr-grid">' + list.map(function (i) {
        return '<article class="emr-card"><a href="' + esc(i.url) + '" aria-label="' + esc(i.title) + '"><div class="emr-thumb">' + (i.img ? '<img src="' + esc(i.img) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
          '<span class="emr-kind">' + (i.kind === "news" ? "News" : "Article") + '</span></div><div class="emr-body"><b>' + esc(i.title) + "</b>" + (i.date ? "<span>" + esc(i.date) + "</span>" : "") + '</div></a>' +
          '<button type="button" class="emr-rm" data-rm="' + esc(i.url) + '" aria-label="Remove ' + esc(i.title) + ' from Read Later">&times;</button></article>';
      }).join("") + "</div>";
    }
    root.innerHTML = html;
    if (focus) { var f = root.querySelector('[data-f="' + focus + '"]'); if (f) f.focus(); }
  }
  function bindPage() {
    var root = doc.getElementById("emr-page"); if (!root) return;
    root.addEventListener("click", function (e) {
      var t = e.target.closest("button"); if (!t) return;
      if (t.hasAttribute("data-f")) { view.filter = t.getAttribute("data-f"); renderPage(); }
      else if (t.hasAttribute("data-rm")) {
        var u = t.getAttribute("data-rm"), old = read().filter(function (i) { return i.url === u; })[0];
        api.remove(u); if (old) toast("Removed from Read Later", "Undo", function () { api.add(old); });
      } else if (t.getAttribute("data-a") === "clear") {
        if (!sure) { sure = true; renderPage(); setTimeout(function () { if (sure) { sure = false; renderPage(); } }, 4000); }
        else { sure = false; var saved = read(); api.clear(); toast("Read Later cleared", "Undo", function () { saved.slice().reverse().forEach(function (i) { api.add(i); }); }); }
      }
    });
  }

  /* ------------------------------------------------------------ start */
  window.EMPReadLater = api;
  var queued = 0;
  function scan() { queued = 0; decorateAll(); }
  function queue() { if (!queued) queued = requestAnimationFrame(scan); }

  function start() {
    addStyle(); addFab(); bindPage(); mountStoryButton(); scan(); refresh();
    if (window.MutationObserver) new MutationObserver(queue).observe(doc.body, { childList: true, subtree: true });
    window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === null) changed(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
