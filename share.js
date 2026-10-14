/* Share button for Every Movie Plug articles and news.
   Adds a "Share" button under the headline (next to "Listen") and another at the end of the story.
   On phones it opens the native share sheet; on desktop it opens a small menu (copy link, X, WhatsApp, ...).
   Whatever is shared always carries the story's title along with the link.
   To use it on a page, add:  <script src="/share.js" defer></script>  (after read-aloud.js). */
(function () {
  "use strict";
  var header = document.querySelector(".article-header");
  var container = document.querySelector(".article-container") || document.querySelector("main");
  if (!header || !container) return;

  /* ---------- what gets shared ---------- */
  function squish(t) { return String(t || "").replace(/\s+/g, " ").trim(); }
  function getTitle() {
    var h1 = header.querySelector("h1");
    var t = squish(h1 && h1.textContent);
    if (!t) { var og = document.querySelector('meta[property="og:title"]'); t = squish(og && og.content); }
    return t || squish(document.title.replace(/\s*\|\s*Every Movie Plug\s*$/i, ""));
  }
  function getUrl() {
    var u = location.origin + location.pathname.replace(/\.html$/i, "");   // same clean links the site uses elsewhere
    return u === "null" ? location.href.split("#")[0] : u;
  }
  function kind() { return /^\/news(\/|$)/.test(location.pathname) ? "news" : "article"; }

  /* ---------- styles ---------- */
  var css = [
    ".emp-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-top:1rem}",
    ".emp-actions .ra-btn{margin-top:0}",
    ".emp-share-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1.1rem;border-radius:9999px;border:1px solid var(--pill-edge,rgba(124,58,237,.35));background:var(--pill-bg,rgba(124,58,237,.08));color:var(--pill-fg,#6d28d9);font:600 .9rem/1 -apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s,transform .15s}",
    ".emp-share-btn:hover{background:var(--pill-edge,rgba(124,58,237,.35))}.emp-share-btn:active{transform:scale(.96)}",
    ".emp-share-btn:focus-visible{outline:2px solid var(--pill-fg,#6d28d9);outline-offset:2px}",
    ".emp-share-btn svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
    ".emp-share-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1rem;margin-top:2.25rem;padding-top:1.25rem;border-top:1px solid var(--border,rgba(128,128,128,.3))}",
    ".emp-share-foot p{margin:0;font-size:.95rem;color:var(--muted,#57606a)}",
    ".emp-menu{position:fixed;z-index:1100;min-width:230px;max-width:calc(100vw - 24px);padding:.4rem;border-radius:16px;background:var(--surface,#fff);color:var(--heading,#0f1419);border:1px solid var(--border,rgba(128,128,128,.3));box-shadow:0 18px 50px rgba(0,0,0,.35);opacity:0;transform:translateY(6px) scale(.98);pointer-events:none;transition:opacity .16s,transform .2s cubic-bezier(.16,1,.3,1)}",
    ".emp-menu.on{opacity:1;transform:none;pointer-events:auto}",
    ".emp-menu-title{margin:0;padding:.55rem .7rem .45rem;font-size:.72rem;line-height:1.35;color:var(--muted,#57606a);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".emp-menu a,.emp-menu button{display:flex;align-items:center;gap:.7rem;width:100%;padding:.65rem .7rem;border:0;border-radius:10px;background:transparent;color:inherit;font:500 .92rem/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".emp-menu a:hover,.emp-menu button:hover,.emp-menu a:focus-visible,.emp-menu button:focus-visible{background:var(--pill-bg,rgba(124,58,237,.1));outline:none}",
    ".emp-menu svg{width:20px;height:20px;flex:none;fill:currentColor}",
    ".emp-menu svg.line{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
    ".emp-scrim{position:fixed;inset:0;z-index:1090;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .2s;display:none}",
    ".emp-toast{position:fixed;left:50%;bottom:max(1.25rem,env(safe-area-inset-bottom));z-index:1200;transform:translate(-50%,20px);padding:.7rem 1.1rem;border-radius:9999px;background:#18181f;color:#f5f5f7;border:1px solid rgba(255,255,255,.15);font:500 .85rem/1 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s,transform .25s cubic-bezier(.16,1,.3,1)}",
    ".emp-toast.on{opacity:1;transform:translate(-50%,0)}",
    "@media (max-width:600px){.emp-menu{left:0!important;right:0!important;top:auto!important;bottom:0;max-width:none;min-width:0;border-radius:20px 20px 0 0;padding:.5rem .5rem max(.75rem,env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .3s cubic-bezier(.16,1,.3,1)}.emp-menu.on{transform:none}.emp-menu a,.emp-menu button{padding:.85rem .8rem}.emp-scrim{display:block}.emp-scrim.on{opacity:1;pointer-events:auto}.emp-share-foot{flex-direction:column;align-items:flex-start}}",
    "@media (prefers-reduced-motion:reduce){.emp-menu,.emp-toast,.emp-scrim{transition:none}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- icons ---------- */
  var I = {
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15V3.5M7.5 7.5 12 3l4.5 4.5M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>',
    link: '<svg class="line" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.2 15.02l-.3-.18-3.1.82.83-3.03-.2-.32A8.1 8.1 0 0 1 12.04 3.8zM8.6 7.6c-.2 0-.5.07-.75.35-.26.28-1 .98-1 2.4s1.03 2.78 1.17 2.97c.14.2 2 3.2 4.94 4.36 2.44.96 2.94.77 3.47.72.53-.05 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.55-.34-.28-.15-1.7-.84-1.96-.93-.27-.1-.46-.15-.65.14-.2.28-.75.93-.92 1.12-.17.2-.34.22-.62.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.7-1.6-1.99-.17-.28-.02-.44.12-.58.13-.13.29-.34.43-.5.14-.17.2-.29.29-.48.1-.2.05-.36-.02-.5-.07-.15-.64-1.58-.9-2.16-.23-.5-.47-.5-.65-.51z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.9 4.1 2.8 11.4c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.6.1.8.8.8.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8L22.9 5.5c.3-1.3-.5-1.9-1-1.4zM8.4 13.8l9.4-5.9c.4-.3.8-.1.5.2l-7.8 7-.3 3.9-1.8-5.2z"/></svg>',
    mail: '<svg class="line" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>'
  };

  /* ---------- toast ---------- */
  var toast = document.createElement("div"); toast.className = "emp-toast"; toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite");
  var tt;
  function say(m) { toast.textContent = m; toast.classList.add("on"); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove("on"); }, 2200); }

  /* ---------- copy ---------- */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      try {
        var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var good = document.execCommand("copy"); document.body.removeChild(ta); good ? ok() : no();
      } catch (e) { no(e); }
    });
  }

  /* ---------- fallback menu (desktop) ---------- */
  var menu = document.createElement("div"); menu.className = "emp-menu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Share this " + kind());
  var scrim = document.createElement("div"); scrim.className = "emp-scrim";
  var menuBtn = null;
  function buildMenu() {
    var t = getTitle(), u = getUrl(), eu = encodeURIComponent(u), et = encodeURIComponent(t);
    var item = function (href, icon, label, ext) {
      return '<a role="menuitem" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ' data-share="' + label + '">' + icon + "<span>" + label + "</span></a>";
    };
    menu.innerHTML =
      '<p class="emp-menu-title"></p>' +
      '<button type="button" role="menuitem" data-copy>' + I.link + "<span>Copy link</span></button>" +
      item("https://x.com/intent/post?text=" + et + "&url=" + eu + "&via=everymovieplug", I.x, "Post on X", true) +
      item("https://wa.me/?text=" + encodeURIComponent(t + "\n" + u), I.wa, "WhatsApp", true) +
      item("https://www.facebook.com/sharer/sharer.php?u=" + eu + "&quote=" + et, I.fb, "Facebook", true) +
      item("https://t.me/share/url?url=" + eu + "&text=" + et, I.tg, "Telegram", true) +
      item("mailto:?subject=" + et + "&body=" + encodeURIComponent(t + "\n\n" + u), I.mail, "Email", false);
    menu.querySelector(".emp-menu-title").textContent = t;
  }
  function placeMenu(btn) {
    if (window.innerWidth <= 600) return;
    var r = btn.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
    var left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    var top = r.bottom + 8; if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
    menu.style.left = left + "px"; menu.style.top = top + "px";
  }
  function openMenu(btn) {
    buildMenu(); menuBtn = btn; btn.setAttribute("aria-expanded", "true");
    document.body.appendChild(scrim); document.body.appendChild(menu);
    placeMenu(btn);
    requestAnimationFrame(function () { menu.classList.add("on"); scrim.classList.add("on"); });
    var first = menu.querySelector("[data-copy]"); if (first) first.focus({ preventScroll: true });
  }
  function closeMenu(refocus) {
    if (!menuBtn) return;
    menu.classList.remove("on"); scrim.classList.remove("on");
    menuBtn.setAttribute("aria-expanded", "false");
    if (refocus) menuBtn.focus({ preventScroll: true });
    menuBtn = null;
  }
  menu.addEventListener("click", function (e) {
    if (e.target.closest("[data-copy]")) {
      copy(getTitle() + "\n" + getUrl()).then(function () { say("Link copied ✓"); closeMenu(true); }, function () { window.prompt("Copy this link", getTitle() + "\n" + getUrl()); closeMenu(true); });
      return;
    }
    if (e.target.closest("a")) setTimeout(function () { closeMenu(false); }, 50);
  });
  scrim.addEventListener("click", function () { closeMenu(true); });
  document.addEventListener("click", function (e) { if (menuBtn && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (!menuBtn) return;
    if (e.key === "Escape") { closeMenu(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      var items = [].slice.call(menu.querySelectorAll("[role=menuitem]")), i = items.indexOf(document.activeElement);
      i = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i].focus(); e.preventDefault();
    }
  });
  window.addEventListener("resize", function () { if (menuBtn) placeMenu(menuBtn); });
  window.addEventListener("scroll", function () { if (menuBtn && window.innerWidth > 600) closeMenu(false); }, { passive: true });

  /* ---------- share ---------- */
  function share(btn) {
    var data = { title: getTitle(), text: getTitle(), url: getUrl() };   // title goes in both fields: some apps only read "text"
    if (menuBtn) { closeMenu(false); return; }
    if (navigator.share) {
      navigator.share(data).catch(function (err) { if (err && err.name === "AbortError") return; openMenu(btn); });
      return;
    }
    openMenu(btn);
  }
  function makeBtn() {
    var b = document.createElement("button");
    b.type = "button"; b.className = "emp-share-btn";
    b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", "Share this " + kind());
    b.innerHTML = I.share + "<span>Share</span>";
    b.addEventListener("click", function () { share(b); });
    return b;
  }

  /* ---------- place the buttons ---------- */
  function mount() {
    if (document.querySelector(".emp-share-btn")) return;
    var row = document.createElement("div"); row.className = "emp-actions";
    var ra = header.querySelector(".ra-btn");
    var sub = header.querySelector(".article-subtitle");
    if (ra && ra.parentNode === header) { ra.insertAdjacentElement("beforebegin", row); row.appendChild(ra); }
    else if (sub && sub.parentNode === header) sub.insertAdjacentElement("afterend", row);
    else header.appendChild(row);
    row.appendChild(makeBtn());

    var body = container.querySelector(".article-content");
    if (body) {
      var foot = document.createElement("div"); foot.className = "emp-share-foot";
      foot.innerHTML = "<p>Enjoyed this " + kind() + "? Pass it on.</p>";
      foot.appendChild(makeBtn());
      body.insertAdjacentElement("afterend", foot);
    }
    document.body.appendChild(toast);
  }
  mount();
})();
