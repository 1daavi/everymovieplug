/**
 * Every Movie Plug - site-wide motion and gestures (one shared file, loaded on every page).
 *
 * It only ADDS to the pages: it never rewrites their markup, and each feature fails quietly if a page does not have
 * the element it looks for. Put data-fx="off" on any element to keep it out of the effects.
 *
 *  Motion        page fade in/out, scroll progress bar, back-to-top ring,
 *                soft cursor glow, gliding highlight on the top menu
 *  Cards         no JS motion at all: cards keep the simple CSS hover lift/press that each page defines, nothing wobbles or tilts,
 *                and rows only scroll when you scroll them (wheel, trackpad, swipe or the arrow buttons - never by grabbing a card)
 *  Touch         swipe left/right to change page on News / Articles, swipe a popup down to close it,
 *                light vibration on taps (where the phone allows it)
 *  Images        tap an article picture to zoom it open (flies out of the page), swipe it away or press Esc
 *
 * People who ask their device for reduced motion get the calm version: no movement, only instant state changes.
 */
(function () {
  "use strict";
  if (window.EMPFx) return;
  var doc = document, root = doc.documentElement;
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var finePointer = !!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches);
  var SPRING = "cubic-bezier(.34,1.56,.64,1)", EASE = "cubic-bezier(.16,1,.3,1)";

  /* what gets which effect */
  var REVEAL_SEL = ".glass-card,.glass,.mcard,.gcard,.post-card,.feat,.article-figure,.quick-facts,.key-points,.qa,.author-box,.site-footer,.seo-text";
  var NO_FX = "[data-fx=off],.modal,.emx-lightbox";

  /* ---------------------------------------------------------------- styles */
  var css = [
    "html{scrollbar-color:#6d28d9 transparent}",
    "::selection{background:rgba(168,85,247,.45);color:#fff}",
    "@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}",
    /* page out (the fade IN is a tiny <style id=\"emx-enter\"> in each page head, so it runs before the first paint) */
    "html.emx-leaving body{opacity:0;transition:opacity .24s ease}",
    /* progress bar */
    "#emx-progress{position:fixed;left:0;top:0;height:3px;width:100%;z-index:2147482000;pointer-events:none;transform:scaleX(0);transform-origin:0 50%;",
    "background:linear-gradient(90deg,#6366f1,#a855f7,#ec4899);box-shadow:0 0 12px rgba(168,85,247,.8);opacity:0;transition:opacity .3s ease}",
    "#emx-progress.on{opacity:1}",
    /* back to top */
    ".emx-top{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:2147481000;width:48px;height:48px;border-radius:50%;border:0;padding:0;cursor:pointer;",
    "display:grid;place-items:center;color:#fff;background:rgba(18,16,30,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);",
    "opacity:0;pointer-events:none;scale:.4;translate:0 24px;transition:opacity .3s ease,scale .45s " + SPRING + ",translate .45s " + SPRING + ",box-shadow .3s ease,background .3s ease}",
    ".emx-top.on{opacity:1;pointer-events:auto;scale:1;translate:0 0}",
    ".emx-top svg{grid-area:1/1;width:48px;height:48px;overflow:visible}",
    ".emx-top .ring-bg{fill:none;stroke:rgba(255,255,255,.12);stroke-width:2.5}",
    ".emx-top .ring{fill:none;stroke:#a855f7;stroke-width:2.5;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%;filter:drop-shadow(0 0 4px rgba(168,85,247,.9))}",
    ".emx-top .arr{grid-area:1/1;width:18px;height:18px;transition:translate .3s " + SPRING + "}",
    "@media (hover:hover){.emx-top:hover{background:#7c3aed;box-shadow:0 12px 34px rgba(124,58,237,.6),0 0 0 1px rgba(255,255,255,.25)}.emx-top:hover .arr{translate:0 -3px}}",
    ".emx-top:active{scale:.9}",
    ".emx-top:focus-visible{outline:2px solid #c4b5fd;outline-offset:3px}",
    /* reveals (individual transform properties, so hover transforms keep working) */
    ".emx-rv{opacity:0;translate:0 14px}",
    ".emx-rv.emx-in{opacity:1;translate:0 0;transition:opacity .5s " + EASE + ",translate .55s " + EASE + ";transition-delay:var(--emx-d,0ms)}",
    /* images fade in once loaded */
    "img.emx-img{opacity:0;scale:1.04;filter:blur(6px)}",
    "img.emx-img.emx-done{opacity:1;scale:1;filter:none;transition:opacity .6s ease,scale .8s " + EASE + ",filter .6s ease}",
    /* cursor glow */
    ".emx-aura{position:fixed;left:0;top:0;width:560px;height:560px;margin:-280px 0 0 -280px;border-radius:50%;z-index:1;pointer-events:none;opacity:0;transition:opacity .5s ease;",
    "background:radial-gradient(circle,rgba(139,92,246,.11),rgba(99,102,241,.05) 40%,rgba(0,0,0,0) 70%);will-change:transform}",
    ".emx-aura.on{opacity:1}",
    /* gliding highlight on the top menu */
    ".sitenav,.topbar-in{position:relative}",
    ".emx-glide{position:absolute;left:0;top:0;z-index:3;border-radius:9999px;pointer-events:none;opacity:0;border:1px solid rgba(216,180,254,.9);",
    "background:rgba(168,85,247,.16);box-shadow:0 0 22px rgba(168,85,247,.55),inset 0 0 12px rgba(168,85,247,.25);transition:transform .45s " + SPRING + ",width .45s " + SPRING + ",height .45s " + SPRING + ",opacity .25s ease}",
    ".emx-glide.on{opacity:1}",
    /* rows: a mouse wheel over a card must always scroll the PAGE, never get caught by the row */
    ".rail{overflow-y:hidden;overscroll-behavior-y:auto}",
    /* swipe-to-change-page hint */
    ".emx-edge{position:fixed;top:50%;z-index:2147481500;display:grid;place-items:center;width:54px;height:54px;border-radius:50%;color:#fff;pointer-events:none;opacity:0;",
    "background:linear-gradient(135deg,#6366f1,#a855f7);box-shadow:0 10px 30px rgba(124,58,237,.6)}",
    ".emx-edge svg{width:22px;height:22px}",
    ".emx-edge.l{left:0;translate:-70px -50%}.emx-edge.r{right:0;translate:70px -50%}",
    ".emx-edge.l.on{opacity:1;translate:12px -50%;transition:translate .35s " + SPRING + ",opacity .2s}",
    ".emx-edge.r.on{opacity:1;translate:-12px -50%;transition:translate .35s " + SPRING + ",opacity .2s}",
    /* image zoom */
    ".emx-lightbox{position:fixed;inset:0;z-index:2147483200;background:rgba(5,4,12,0);-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0);transition:background .4s ease,backdrop-filter .4s ease,-webkit-backdrop-filter .4s ease;touch-action:none;cursor:zoom-out}",
    ".emx-lightbox.on{background:rgba(5,4,12,.9);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}",
    ".emx-lightbox img{position:fixed;margin:0;max-width:none;border-radius:14px;object-fit:cover;box-shadow:0 30px 90px rgba(0,0,0,.7);transform-origin:0 0;will-change:transform}",
    "img.emx-zoomable{cursor:zoom-in}",
    /* touch press */
    "@media (prefers-reduced-motion:reduce){.emx-top,.emx-rv.emx-in,img.emx-img.emx-done{transition:none}.emx-aura,.emx-glide{display:none}}"
  ].join("");
  var st = doc.createElement("style"); st.id = "emx-css"; st.textContent = css;
  (doc.head || root).appendChild(st);
  root.classList.add("emx");

  function raf(f) { return requestAnimationFrame(f); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  function off(n) { return !!(n.closest && n.closest(NO_FX)); }

  /* ------------------------------------------------- page leaving + coming back */
  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download") || a.closest("[data-fx=off]")) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return;
    if (u.pathname === location.pathname && u.search === location.search) return;       /* same page: #anchors, modals */
    if (/\.(xml|pdf|zip|jpg|png|txt)$/i.test(u.pathname)) return;
    if (reduce) return;
    root.classList.add("emx-leaving");
    setTimeout(function () { root.classList.remove("emx-leaving"); }, 1500);               /* if the navigation never happens */
  });
  addEventListener("pageshow", function (e) { if (e.persisted) root.classList.remove("emx-leaving"); });

  /* ------------------------------------------------------ logo: plug-in pop on click (and a smooth scroll to top when already on the homepage) */
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".brand"); if (!b) return;
    b.classList.remove("plugged"); void b.offsetWidth; b.classList.add("plugged");
    setTimeout(function () { b.classList.remove("plugged"); }, 650);
    vibrate(8);
    var home = location.pathname.replace(/index\.html$/, "") === "/" && !location.search && !location.hash;
    if (home && !reduce && !e.defaultPrevented && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); }
  });

  /* ------------------------------------------------------ progress + back to top */
  var bar = el("div"); bar.id = "emx-progress"; bar.setAttribute("aria-hidden", "true");
  var topBtn = el("button", "emx-top", '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-bg" cx="24" cy="24" r="21"/><circle class="ring" cx="24" cy="24" r="21" stroke-dasharray="131.95" stroke-dashoffset="131.95"/></svg>' +
    '<svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>');
  topBtn.type = "button"; topBtn.setAttribute("aria-label", "Back to top");
  var ring = topBtn.querySelector(".ring"), ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    raf(function () {
      ticking = false;
      var h = root.scrollHeight - innerHeight, y = pageYOffset, p = h > 0 ? clamp(y / h, 0, 1) : 0;
      var long = h > innerHeight * 0.8;
      bar.style.transform = "scaleX(" + p + ")"; bar.classList.toggle("on", long && y > 4);
      ring.style.strokeDashoffset = String(131.95 * (1 - p));
      topBtn.classList.toggle("on", y > 700);
    });
  }
  topBtn.addEventListener("click", function () {
    vibrate(8);
    scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
  addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);

  /* ------------------------------------------------------------ scroll reveals */
  var revealed = 0, io = null, queue = [], flushT = 0;
  function flush() {
    flushT = 0;
    var batch = queue.splice(0, queue.length);
    batch.sort(function (a, b) { var A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return (A.top - B.top) || (A.left - B.left); });
    batch.forEach(function (n, i) {
      n.style.setProperty("--emx-d", Math.min(i, 6) * 70 + "ms");
      n.classList.add("emx-in");
      setTimeout(function () { n.classList.remove("emx-rv", "emx-in"); n.style.removeProperty("--emx-d"); }, 1100 + Math.min(i, 6) * 70);
    });
  }
  function watch(n) {
    if (!io) io = new IntersectionObserver(function (list) {
      list.forEach(function (it) { if (it.isIntersecting) { io.unobserve(it.target); queue.push(it.target); } });
      if (queue.length && !flushT) flushT = setTimeout(flush, 30);
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    io.observe(n);
  }
  function prepReveal(n, initial) {
    if (n.__fxr || off(n) || n.closest(".emx-rv")) return; n.__fxr = 1;
    var cs = getComputedStyle(n);
    if (cs.animationName !== "none" || cs.display === "none" || cs.position === "fixed") return;         /* it already animates itself */
    if (initial) { var r = n.getBoundingClientRect(); if (r.top < innerHeight * 0.96 && r.bottom > 0) return; }     /* first screen: no flash */
    n.style.transition = "none"; n.classList.add("emx-rv"); void n.offsetWidth; n.style.transition = "";
    watch(n);
  }

  /* ------------------------------------------------------------ image fade-ins */
  function prepImg(img) {
    if (img.__fxi || img.complete || off(img) || img.closest(".emx-rv")) return; img.__fxi = 1;
    if (getComputedStyle(img).opacity !== "1") return;
    img.classList.add("emx-img");
    var done = function () { img.classList.add("emx-done"); setTimeout(function () { img.classList.remove("emx-img", "emx-done"); }, 900); };
    img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true });
    setTimeout(done, 6000);
  }

  /* ---------------------------------------------------- soft cursor glow (the only pointer effect left) */
  var mx = 0, my = 0, moveQ = false, auraEl = null, ax = 0, ay = 0, aTx = 0, aTy = 0, auraLoop = false;
  function auraTick() {
    ax += (aTx - ax) * 0.12; ay += (aTy - ay) * 0.12;
    auraEl.style.transform = "translate3d(" + ax.toFixed(1) + "px," + ay.toFixed(1) + "px,0)";
    if (Math.abs(aTx - ax) + Math.abs(aTy - ay) > 0.5) raf(auraTick); else auraLoop = false;
  }
  function onMove(e) {
    mx = e.clientX; my = e.clientY;
    if (moveQ) return; moveQ = true;
    raf(function () {
      moveQ = false;
      if (auraEl) { aTx = mx; aTy = my; auraEl.classList.add("on"); if (!auraLoop) { auraLoop = true; raf(auraTick); } }
    });
  }
  if (!reduce && finePointer) {
    auraEl = el("div", "emx-aura"); auraEl.setAttribute("aria-hidden", "true");
    doc.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") onMove(e); }, { passive: true });
    doc.addEventListener("mouseleave", function () { if (auraEl) auraEl.classList.remove("on"); });
  }

  /* finds a sideways-scrolling row under a finger (used so a page swipe never fights a row swipe) */
  function hScroller(n) {
    for (; n && n !== doc.body && n !== root; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 4) return n;
    }
    return null;
  }

  /* ----------------------------------------------- gliding highlight on the top menu */
  function bindNav(nav, sel) {
    if (nav.__fxn || reduce || !finePointer) return; nav.__fxn = 1; sel = sel || "a";
    var g = el("span", "emx-glide"); g.setAttribute("aria-hidden", "true"); nav.appendChild(g);
    function pick(t) { var a = t.closest && t.closest(sel); return a && nav.contains(a) ? a : null; }
    function to(a) {
      var r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
      g.style.width = r.width + "px"; g.style.height = r.height + "px";
      g.style.transform = "translate(" + (r.left - n.left) + "px," + (r.top - n.top) + "px)"; g.classList.add("on");
    }
    nav.addEventListener("pointerover", function (e) { var a = pick(e.target); if (a) to(a); });
    nav.addEventListener("focusin", function (e) { var a = pick(e.target); if (a) to(a); });
    nav.addEventListener("pointerleave", function () { g.classList.remove("on"); });
    nav.addEventListener("focusout", function () { g.classList.remove("on"); });
    addEventListener("scroll", function () { g.classList.remove("on"); }, { passive: true });
    var row = nav.querySelector(".navrow"); if (row) row.addEventListener("scroll", function () { g.classList.remove("on"); }, { passive: true });
  }

  /* ----------------------------------- swipe left / right to change page (News + Articles lists) */
  function edge(side) {
    var e = el("div", "emx-edge " + side, side === "l"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
    doc.body.appendChild(e); void e.offsetWidth; e.classList.add("on"); return e;
  }
  var sw = null;
  if (!reduce) {
    doc.addEventListener("touchstart", function (e) {
      sw = null; if (e.touches.length !== 1 || off(e.target) || e.target.closest(".hero") || hScroller(e.target) || e.target.closest("input,textarea,select,.emx-lightbox")) return;
      var t = e.touches[0]; sw = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });
    doc.addEventListener("touchend", function (e) {
      if (!sw) return; var s = sw; sw = null;
      var t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y, dt = Date.now() - s.t;
      if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 2.2 || dt > 700) return;
      if (doc.body.classList.contains("searching")) return;
      var link = doc.querySelector('a.pg-step[rel="' + (dx < 0 ? "next" : "prev") + '"]');
      if (!link) return;
      vibrate(10); var ed = edge(dx < 0 ? "r" : "l");
      root.classList.add("emx-leaving");
      setTimeout(function () { location.href = link.href; }, 180);
      setTimeout(function () { ed.remove(); root.classList.remove("emx-leaving"); }, 1800);
    }, { passive: true });
  }

  /* ------------------------------ swipe a popup (homepage preview) down to close it */
  function bindSheet() {
    var box = doc.querySelector(".m-box"), modal = doc.getElementById("modal");
    if (!box || !modal || box.__fxs || reduce) return; box.__fxs = 1;
    var y0 = 0, x0 = 0, dy = 0, on = false, t0 = 0;
    box.style.overscrollBehavior = "contain";
    box.addEventListener("touchstart", function (e) {
      on = false; if (box.scrollTop > 0 || e.touches.length !== 1) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now(); on = "maybe";
    }, { passive: true });
    box.addEventListener("touchmove", function (e) {
      if (!on) return; var t = e.touches[0]; dy = t.clientY - y0;
      if (on === "maybe") { if (dy > 8 && Math.abs(t.clientX - x0) < dy) on = true; else if (dy < -4 || Math.abs(t.clientX - x0) > 12) { on = false; return; } else return; box.style.transition = "none"; }
      if (e.cancelable) e.preventDefault();
      var d = Math.max(0, dy); box.style.translate = "0 " + d * 0.9 + "px"; box.style.scale = String(1 - Math.min(d, 400) / 4000);
      modal.style.background = "rgba(0,0,0," + (0.72 * (1 - Math.min(d, 320) / 360)).toFixed(3) + ")";
    }, { passive: false });
    box.addEventListener("touchend", function () {
      if (on !== true) { on = false; return; } on = false;
      var v = dy / Math.max(1, Date.now() - t0);
      box.style.transition = "translate .35s " + EASE + ",scale .35s " + EASE;
      if (dy > 120 || v > 0.6) {
        vibrate(8); box.style.translate = "0 110vh"; modal.style.background = "rgba(0,0,0,0)";
        setTimeout(function () { try { window.closeModal && window.closeModal(); } catch (e) {} reset(); }, 300);
      } else { box.style.translate = "0 0"; box.style.scale = "1"; modal.style.background = ""; setTimeout(reset, 380); }
    }, { passive: true });
    function reset() { box.style.transition = ""; box.style.translate = ""; box.style.scale = ""; modal.style.background = ""; }
  }

  /* ----------------------------------------------- tap a picture to zoom it open (and swipe it away) */
  var lb = null;
  function openZoom(img) {
    if (lb || !img.naturalWidth) return;
    var r0 = img.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, ar = img.naturalWidth / img.naturalHeight;
    var w = Math.min(vw * 0.94, vh * 0.88 * ar), h = w / ar, l = (vw - w) / 2, t = (vh - h) / 2;
    var box = el("div", "emx-lightbox"), big = el("img"); big.src = img.currentSrc || img.src; big.alt = img.alt || "";
    big.style.cssText = "left:" + l + "px;top:" + t + "px;width:" + w + "px;height:" + h + "px";
    var s0 = r0.width / w, tx0 = r0.left - l, ty0 = r0.top - t;
    big.style.transform = "translate(" + tx0 + "px," + ty0 + "px) scale(" + s0 + "," + (r0.height / h) + ")";
    box.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
    box.appendChild(big); doc.body.appendChild(box); img.style.visibility = "hidden";
    big.getBoundingClientRect(); lb = { box: box, big: big, img: img, l: l, t: t, w: w, h: h, y: pageYOffset };
    raf(function () { box.classList.add("on"); big.style.transition = "transform .5s " + EASE; big.style.transform = "translate(0,0) scale(1,1)"; });
    var y0 = 0, dy = 0, drag = false;
    box.addEventListener("pointerdown", function (e) { drag = true; y0 = e.clientY; dy = 0; box.setPointerCapture(e.pointerId); big.style.transition = "none"; });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return; dy = e.clientY - y0;
      big.style.transform = "translate(0," + dy + "px) scale(" + (1 - Math.min(Math.abs(dy), 500) / 2200) + ")";
      box.style.background = "rgba(5,4,12," + (0.9 * (1 - Math.min(Math.abs(dy), 360) / 420)).toFixed(3) + ")";
    });
    box.addEventListener("pointerup", function () {
      if (!drag) return; drag = false;
      if (Math.abs(dy) > 90) closeZoom(); else if (Math.abs(dy) < 6) closeZoom(); else { big.style.transition = "transform .4s " + SPRING; big.style.transform = "translate(0,0) scale(1,1)"; box.style.background = ""; }
    });
    vibrate(8);
  }
  function closeZoom() {
    if (!lb) return; var z = lb; lb = null;
    var r = z.img.getBoundingClientRect(), s = r.width / z.w;
    z.box.classList.remove("on"); z.box.style.background = "";
    z.big.style.transition = "transform .42s " + EASE;
    z.big.style.transform = "translate(" + (r.left - z.l) + "px," + (r.top - z.t) + "px) scale(" + s + "," + (r.height / z.h) + ")";
    setTimeout(function () { z.img.style.visibility = ""; z.box.remove(); }, 430);
  }
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && lb) closeZoom(); });
  addEventListener("scroll", function () { if (lb && Math.abs(pageYOffset - lb.y) > 80) closeZoom(); }, { passive: true });  /* small browser-bar jiggles must not close it */
  doc.addEventListener("click", function (e) {
    var img = e.target.closest && e.target.closest(".article-figure img");
    if (!img || e.defaultPrevented || reduce || img.closest("a")) return;
    e.preventDefault(); openZoom(img);
  });
  function prepZoom(img) { if (!reduce && !img.closest("a")) img.classList.add("emx-zoomable"); }

  /* ------------------------------------------------------------------ boot */
  function scan(node, initial) {
    if (!node.querySelectorAll) return;
    var i, l;
    /* scroll reveals and image fade-ins are switched off on purpose: everything is visible as soon as the page loads */
    l = node.querySelectorAll(".article-figure img"); for (i = 0; i < l.length; i++) prepZoom(l[i]);
    l = node.querySelectorAll(".sitenav"); for (i = 0; i < l.length; i++) bindNav(l[i]);
    l = node.querySelectorAll(".topbar-in"); for (i = 0; i < l.length; i++) if (l[i].querySelector(".navrow")) bindNav(l[i], ".navrow .chip,.top-actions .chip");
    bindSheet();
  }
  function init() {
    doc.body.appendChild(bar); doc.body.appendChild(topBtn); if (auraEl) doc.body.appendChild(auraEl);
    scan(doc.body, true); onScroll();
    if (window.MutationObserver) {
      var pend = [], t = 0;
      new MutationObserver(function (ms) {
        ms.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) { var n = m.addedNodes[i]; if (n.nodeType === 1 && !(n.classList && (n.classList.contains("emx-edge") || n.classList.contains("emx-glide")))) pend.push(n); } });
        if (pend.length && !t) t = setTimeout(function () { t = 0; var p = pend.splice(0, pend.length); p.forEach(function (n) { if (n.isConnected) scan(n, false); }); }, 40);
      }).observe(doc.body, { childList: true, subtree: true });
    }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
  window.EMPFx = { version: 1 };
})();
