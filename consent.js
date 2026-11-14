/**
 * Every Movie Plug - cookie consent banner (one shared file, loaded on every page).
 *
 * Choices are saved in this browser only (localStorage + a first-party "emp_consent" cookie) and asked again after 12 months.
 *   Essential    always on: remembers this choice, your country, and the titles you save to your Watchlist on this device
 *   Advertising  off until you accept: Google AdSense cookies for personalised ads
 *
 * Google Consent Mode: the inline <script id="emp-consent-init"> in every <head> (written by inject-shared.js) sets the
 * defaults BEFORE the AdSense tag runs; this file sends the "update" when the visitor chooses.
 *
 * Public API:  EMPConsent.open()  re-open the settings panel     EMPConsent.get()  -> {ads, t} or null
 *              EMPConsent.allows("ads")                          document event "emp:consent" fires on every change
 * Any link to  #cookie-settings  (or an element with data-cookie-settings) re-opens the panel.
 */
(function () {
  "use strict";
  if (window.EMPConsent) return;
  var doc = document, KEY = "emp_consent_v1", COOKIE = "emp_consent", MAX_DAYS = 365, VERSION = 1;
  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ------------------------------------------------------------ storage */
  function read() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) { var m = doc.cookie.match(/(?:^|;\s*)emp_consent=([^;]+)/); if (m) raw = decodeURIComponent(m[1]); }
    if (!raw) return null;
    try {
      var c = JSON.parse(raw);
      if (!c || c.v !== VERSION || typeof c.t !== "number") return null;
      if (Date.now() - c.t > MAX_DAYS * 864e5) return null;           // choice is older than 12 months: ask again
      return c;
    } catch (e) { return null; }
  }
  function write(ads) {
    var c = { v: VERSION, ads: !!ads, t: Date.now() }, s = JSON.stringify(c);
    try { localStorage.setItem(KEY, s); } catch (e) {}
    try {
      doc.cookie = COOKIE + "=" + encodeURIComponent(s) + "; max-age=" + MAX_DAYS * 86400 + "; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    } catch (e) {}
    return c;
  }

  /* ------------------------------------------------------------ Google consent mode */
  function tellGoogle(ads) {
    var w = window, dl = w.dataLayer = w.dataLayer || [];
    function gtag() { dl.push(arguments); }
    var s = ads ? "granted" : "denied";
    gtag("consent", "update", { ad_storage: s, ad_user_data: s, ad_personalization: s, analytics_storage: "denied" });
    (w.adsbygoogle = w.adsbygoogle || []).requestNonPersonalizedAds = ads ? 0 : 1;
  }

  /* ------------------------------------------------------------ styles */
  var css = [
    "#emc-bar,#emc-modal{--emc-bg:rgba(14,14,22,.97);--emc-line:rgba(255,255,255,.14);--emc-tx:#f5f5f7;--emc-mute:#a1a1aa;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;color:var(--emc-tx);line-height:1.5;-webkit-font-smoothing:antialiased}",
    "#emc-bar *,#emc-modal *{box-sizing:border-box}",
    "#emc-bar{position:fixed;z-index:2147482500;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));width:min(440px,calc(100vw - 32px));padding:20px;border-radius:22px;background:var(--emc-bg);border:1px solid var(--emc-line);box-shadow:0 24px 60px rgba(0,0,0,.65),0 0 0 1px rgba(139,92,246,.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}",
    "#emc-bar h2{margin:0 0 6px;font-size:1rem;font-weight:700;letter-spacing:-.01em}",
    "#emc-bar p{margin:0;font-size:.82rem;color:var(--emc-mute)}",
    "#emc-bar a,#emc-modal a{color:#c4b5fd;text-decoration:underline;text-underline-offset:2px}",
    ".emc-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}",
    ".emc-btn{appearance:none;cursor:pointer;font:inherit;font-size:.82rem;font-weight:600;padding:.6rem 1rem;border-radius:9999px;border:1px solid var(--emc-line);background:rgba(255,255,255,.06);color:var(--emc-tx);transition:background .2s ease,border-color .2s ease,transform .12s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    ".emc-btn:hover{background:rgba(255,255,255,.12)}",
    ".emc-btn:active{transform:scale(.97)}",
    ".emc-btn:focus-visible,.emc-sw:focus-visible+.emc-track{outline:2px solid #a855f7;outline-offset:3px}",
    ".emc-btn.pri{border-color:transparent;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff}",
    ".emc-btn.pri:hover{background:linear-gradient(135deg,#7476f3,#b26cf8)}",
    "#emc-bar .emc-row .emc-btn{flex:1 1 auto;text-align:center}",
    "#emc-bar .emc-link{flex-basis:100%;background:none;border:0;padding:.3rem;color:var(--emc-mute);font-weight:500;text-decoration:underline;text-underline-offset:3px}",
    "#emc-bar .emc-link:hover{background:none;color:var(--emc-tx)}",
    "#emc-modal{position:fixed;inset:0;z-index:2147482600;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}",
    "#emc-modal.open{display:flex}",
    ".emc-box{position:relative;width:100%;max-width:520px;max-height:90vh;overflow:auto;padding:26px 24px 22px;border-radius:26px;background:var(--emc-bg);border:1px solid var(--emc-line);box-shadow:0 30px 80px rgba(0,0,0,.8)}",
    ".emc-box h2{margin:0 0 6px;font-size:1.2rem;font-weight:700;letter-spacing:-.01em;padding-right:36px}",
    ".emc-box>p{margin:0 0 16px;font-size:.84rem;color:var(--emc-mute)}",
    ".emc-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:1px solid var(--emc-line);background:rgba(255,255,255,.06);color:var(--emc-tx);font-size:1.2rem;line-height:1;cursor:pointer}",
    ".emc-x:hover{background:rgba(255,255,255,.14)}",
    ".emc-cat{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 16px;margin-bottom:10px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--emc-line)}",
    ".emc-cat b{display:block;font-size:.92rem;margin-bottom:2px}",
    ".emc-cat span.d{display:block;font-size:.78rem;color:var(--emc-mute)}",
    ".emc-sw{position:absolute;opacity:0;width:1px;height:1px}",
    ".emc-tg{position:relative;flex:none;display:inline-block;margin-top:2px}",
    ".emc-track{display:block;width:46px;height:28px;border-radius:9999px;background:rgba(255,255,255,.18);transition:background .2s ease;cursor:pointer}",
    ".emc-track::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .2s ease}",
    ".emc-sw:checked+.emc-track{background:#8b5cf6}",
    ".emc-sw:checked+.emc-track::after{transform:translateX(18px)}",
    ".emc-sw:disabled+.emc-track{opacity:.55;cursor:default}",
    ".emc-box .emc-row{margin-top:18px;justify-content:flex-end}",
    "@media (max-width:520px){#emc-bar{left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));width:auto;padding:16px}}",
    "@media (prefers-reduced-motion:no-preference){#emc-bar.show{animation:emc-in .45s cubic-bezier(.16,1,.3,1) backwards}@keyframes emc-in{from{opacity:0;transform:translateY(14px)}}#emc-modal.open .emc-box{animation:emc-pop .3s cubic-bezier(.16,1,.3,1) backwards}@keyframes emc-pop{from{opacity:0;transform:scale(.97)}}}",
    ".emc-foot{display:inline;background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;text-decoration:none}"
  ].join("\n");

  /* ------------------------------------------------------------ UI */
  var bar = null, modal = null, lastFocus = null;
  function el(tag, attrs, html) {
    var n = doc.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function addStyle() {
    if (doc.getElementById("emc-style")) return;
    var s = el("style", { id: "emc-style" }); s.textContent = css; doc.head.appendChild(s);
  }

  function decide(ads) {
    var c = write(ads);
    tellGoogle(c.ads);
    closeBar(); closeModal(true);
    try { doc.dispatchEvent(new CustomEvent("emp:consent", { detail: { ads: c.ads } })); } catch (e) {}
  }

  function showBar() {
    if (bar || modal && modal.classList.contains("open")) return;
    addStyle();
    bar = el("section", { id: "emc-bar", role: "region", "aria-labelledby": "emc-bar-h", "data-fx": "off" },
      '<h2 id="emc-bar-h">Your privacy choices</h2>' +
      '<p>We use cookies to keep the site working and to remember your Watchlist on this device. With your OK, Google also uses cookies to show personalised ads. Read our <a href="/privacy-policy.html">Privacy Policy</a>.</p>' +
      '<div class="emc-row">' +
      '<button type="button" class="emc-btn pri" data-a="all">Accept all</button>' +
      '<button type="button" class="emc-btn" data-a="none">Reject non-essential</button>' +
      '<button type="button" class="emc-btn emc-link" data-a="custom">Customise</button>' +
      '</div>');
    bar.classList.add("show");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "all") decide(true); else if (a === "none") decide(false); else openModal();
    });
    doc.body.appendChild(bar);
  }
  function closeBar() { if (bar) { bar.remove(); bar = null; } }

  function buildModal() {
    addStyle();
    modal = el("div", { id: "emc-modal", "data-fx": "off" },
      '<div class="emc-box" role="dialog" aria-modal="true" aria-labelledby="emc-h">' +
      '<button type="button" class="emc-x" data-a="close" aria-label="Close">&times;</button>' +
      '<h2 id="emc-h">Cookie settings</h2>' +
      '<p>Choose what Every Movie Plug may store on this device. You can change this at any time from &ldquo;Cookie Settings&rdquo; in the page footer.</p>' +
      '<div class="emc-cat"><div><b>Essential</b><span class="d">Needed for the site to work: remembers this choice, your selected country, and the movies and shows you save to your Watchlist. Stays on this device and is never sent to us.</span></div>' +
      '<label class="emc-tg"><input class="emc-sw" type="checkbox" checked disabled aria-label="Essential, always on"><span class="emc-track" aria-hidden="true"></span></label></div>' +
      '<div class="emc-cat"><div><b>Advertising</b><span class="d">Lets Google AdSense and its partners use cookies to show ads based on your interests. If you leave this off we still show ads, but without cookie-based personalisation.</span></div>' +
      '<label class="emc-tg"><input class="emc-sw" id="emc-ads" type="checkbox" aria-label="Advertising cookies"><span class="emc-track" aria-hidden="true"></span></label></div>' +
      '<div class="emc-row">' +
      '<button type="button" class="emc-btn" data-a="none">Reject non-essential</button>' +
      '<button type="button" class="emc-btn" data-a="save">Save choices</button>' +
      '<button type="button" class="emc-btn pri" data-a="all">Accept all</button>' +
      '</div></div>');
    modal.addEventListener("click", function (e) {
      if (e.target === modal) return closeModal();
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "all") decide(true);
      else if (a === "none") decide(false);
      else if (a === "save") decide(doc.getElementById("emc-ads").checked);
      else closeModal();
    });
    doc.body.appendChild(modal);
  }
  function openModal() {
    if (!modal) buildModal();
    var c = read();
    doc.getElementById("emc-ads").checked = !!(c && c.ads);
    lastFocus = doc.activeElement;
    modal.classList.add("open");
    var f = modal.querySelector("#emc-ads"); if (f) f.focus();
  }
  function closeModal(silent) {
    if (!modal || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    if (!silent && !read()) showBar();
    if (!silent && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  doc.addEventListener("keydown", function (e) {
    if (!modal || !modal.classList.contains("open")) return;
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key === "Tab") {                                              // keep focus inside the panel
      var f = modal.querySelectorAll("button:not([disabled]),input:not([disabled]),a[href]");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ------------------------------------------------------------ footer link */
  function addFooterLink() {
    if (doc.querySelector("[data-cookie-settings]")) return;
    // Try the most specific place first. One combined selector returns the outer <footer> before the link row inside it,
    // which put the link after the copyright line and left it unstyled.
    var host = null, picks = [".footer-links", "nav[aria-label='Footer']", "footer nav", "nav.links", ".site-footer", "footer"];
    for (var i = 0; i < picks.length && !host; i++) host = doc.querySelector(picks[i]);
    if (!host) return;
    var sample = host.querySelector("a"), a = el("a", { href: "#cookie-settings", "data-cookie-settings": "" }, "Cookie Settings");
    if (sample && sample.className) a.className = sample.className;
    host.appendChild(a);
  }
  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-cookie-settings],a[href='#cookie-settings']");
    if (!t) return;
    e.preventDefault(); openModal();
  });

  /* ------------------------------------------------------------ start */
  window.EMPConsent = {
    open: openModal,
    get: read,
    allows: function (what) { var c = read(); return !!(c && (what === "ads" ? c.ads : what === "essential")) || what === "essential"; }
  };
  function loadReadLater() {                                             // Read Later (news / articles) rides along with this script so every page gets it
    if (window.EMPReadLater || doc.querySelector('script[src*="readlater.js"]')) return;
    var s = doc.createElement("script"); s.src = "/readlater.js"; s.defer = true; doc.head.appendChild(s);
  }
  function start() {
    loadReadLater();
    addFooterLink();
    var c = read();
    if (c) tellGoogle(c.ads);                                           // keep Google in step with a saved choice
    else setTimeout(showBar, 350);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
