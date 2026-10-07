/* Read-aloud for Every Movie Plug articles. Uses the browser's built-in speech (no API, no cost). */
(function () {
  "use strict";
  if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) return;
  var synth = window.speechSynthesis;
  var root = document.querySelector(".article-content");
  var header = document.querySelector(".article-header");
  if (!root || !header) return;

  /* ---------- styles (injected so no CSS file needs editing) ---------- */
  var css = [
    ".ra-btn{display:inline-flex;align-items:center;gap:.5rem;margin-top:1rem;padding:.6rem 1.1rem;border-radius:9999px;border:1px solid rgba(128,128,128,.4);background:rgba(128,128,128,.12);color:inherit;font:500 .9rem/1 -apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}.ra-btn:hover{background:rgba(128,128,128,.22)}",
    ".ra-btn:active{transform:scale(.97)}",
    ".ra-bar{position:fixed;left:50%;bottom:max(.75rem,env(safe-area-inset-bottom));transform:translateX(-50%) translateY(150%);width:calc(100% - 1.5rem);max-width:560px;z-index:1000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.5rem;padding:.6rem .75rem;border-radius:20px;background:rgba(18,18,28,.94);border:1px solid rgba(255,255,255,.15);box-shadow:0 12px 40px rgba(0,0,0,.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#f5f5f7;font:500 .8rem/1 -apple-system,BlinkMacSystemFont,sans-serif;transition:transform .35s cubic-bezier(.16,1,.3,1)}",
    ".ra-bar.on{transform:translateX(-50%) translateY(0)}",
    ".ra-bar button{width:44px;height:44px;padding:0;border-radius:50%;border:0;background:transparent;color:inherit;font-size:1.45rem;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:background .2s,transform .15s}.ra-bar button:hover{background:rgba(255,255,255,.1)}.ra-bar button:active{transform:scale(.9)}",
    ".ra-bar button.main{width:50px;height:50px;font-size:1.7rem}",
    ".ra-bar select{height:36px;max-width:9.5rem;padding:0 .6rem;border-radius:9999px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#f5f5f7;font-size:.78rem;outline:none}",
    ".ra-bar select option{background:#12121c;color:#f5f5f7}",
    ".ra-count{flex-basis:100%;text-align:center;font-size:.7rem;opacity:.6}",
    ".ra-current{background:rgba(168,85,247,.18);box-shadow:-.6rem 0 0 rgba(168,85,247,.18),.6rem 0 0 rgba(168,85,247,.18);border-radius:4px;transition:background .25s}",
    "body.ra-active .article-content p,body.ra-active .article-content li,body.ra-active .article-content h2,body.ra-active .article-content h3{cursor:pointer}",
    "body.ra-active{padding-bottom:6rem}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- build the list of things to read ---------- */
  var clean = function (t) {
    return String(t || "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u25B6]/gu, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ").trim();
  };
  var chunkText = function (text) {
    var s = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text], out = [], cur = "";
    s.forEach(function (x) {
      if ((cur + x).length > 220 && cur) { out.push(cur.trim()); cur = x; } else cur += x;
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  var units = [];
  function build() {
    units = [];
    var q = function (sel) { var e = document.querySelector(sel); return e ? clean(e.textContent) : ""; };
    var intro = [q(".article-header h1"), q(".article-subtitle"), q(".article-date") ? "Published " + q(".article-date") : ""].filter(Boolean)
      .map(function (t) { return /[.!?:]$/.test(t) ? t : t + "."; }).join(" ");
    if (intro) units.push({ el: null, chunks: chunkText(intro) });
    var skip = ".twitter-tweet,.instagram-media,table,figure,.video-wrapper,.image-credit,.watch-links,script,style,iframe";
    root.querySelectorAll("p,h2,h3,h4,h5,h6,li,cite").forEach(function (el) {
      if (el.closest(skip)) return;
      var t = clean(el.textContent); if (t.length < 2) return;
      if (/^H\d$/.test(el.tagName) && !/[.!?:;]$/.test(t)) t += ".";
      units.push({ el: el, chunks: chunkText(t) });
    });
  }

  /* ---------- state ---------- */
  var ui = 0, ci = 0, playing = false, paused = false, active = false, token = 0, current = null;
  var rate = 1, voice = null, voices = [];
  try { rate = parseFloat(localStorage.getItem("ra_rate")) || 1; } catch (e) {}

  /* ---------- UI ---------- */
  var words = clean(root.textContent).split(" ").length, mins = Math.max(1, Math.round(words / 160));
  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "ra-btn";
  var sub = header.querySelector(".article-subtitle");
  (sub && sub.parentNode === header) ? sub.insertAdjacentElement("afterend", btn) : header.appendChild(btn);

  var bar = document.createElement("div");
  bar.className = "ra-bar"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Read aloud controls");
  bar.innerHTML =
    '<button type="button" data-a="prev" aria-label="Previous paragraph">\u23EE\uFE0F</button>' +
    '<button type="button" data-a="toggle" class="main" aria-label="Play or pause"></button>' +
    '<button type="button" data-a="next" aria-label="Next paragraph">\u23ED\uFE0F</button>' +
    '<button type="button" data-a="stop" aria-label="Stop reading">\u23F9\uFE0F</button>' +
    '<select data-a="rate" aria-label="Reading speed"><option value="0.8">0.8x</option><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="1.75">1.75x</option><option value="2">2x</option></select>' +
    '<select data-a="voice" aria-label="Voice" hidden></select>' +
    '<div class="ra-count" aria-live="polite"></div>';
  document.body.appendChild(bar);
  var mainBtn = bar.querySelector('[data-a="toggle"]'), rateSel = bar.querySelector('[data-a="rate"]'),
      voiceSel = bar.querySelector('[data-a="voice"]'), countEl = bar.querySelector(".ra-count");
  rateSel.value = String(rate); if (rateSel.value !== String(rate)) { rate = 1; rateSel.value = "1"; }

  function paint() {
    btn.textContent = playing ? "\u23F8\uFE0F Pause reading" : (paused ? "\u25B6\uFE0F Resume reading" : "\uD83D\uDD0A Listen to this article \u00B7 " + mins + " min");
    mainBtn.textContent = playing ? "\u23F8\uFE0F" : "\u25B6\uFE0F";
    countEl.textContent = active ? "Part " + (Math.min(ui, units.length - 1) + 1) + " of " + units.length + " \u00B7 tap any paragraph to start there" : "";
    bar.classList.toggle("on", active);
    document.body.classList.toggle("ra-active", active);
  }
  function highlight() {
    var old = root.querySelector(".ra-current"); if (old) old.classList.remove("ra-current");
    var u = units[ui];
    if (u && u.el) {
      u.el.classList.add("ra-current");
      try { u.el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    }
  }

  /* ---------- voices ---------- */
  function loadVoices() {
    var lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
    var all = synth.getVoices() || [];
    voices = all.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(lang) === 0; });
    if (!voices.length) voices = all;
    var rank = function (v) { return /natural|neural|enhanced|premium|siri/i.test(v.name) ? 0 : /google|samantha|daniel|karen|aaron/i.test(v.name) ? 1 : 2; };
    voices.sort(function (a, b) { return rank(a) - rank(b) || a.name.localeCompare(b.name); });
    var saved = ""; try { saved = localStorage.getItem("ra_voice") || ""; } catch (e) {}
    voice = voices.filter(function (v) { return v.name === saved; })[0] || voices.filter(function (v) { return /^en[-_]us/i.test(v.lang); })[0] || voices[0] || null;
    voiceSel.innerHTML = voices.map(function (v) { return '<option value="' + v.name.replace(/"/g, "&quot;") + '">' + v.name.replace(/</g, "&lt;") + "</option>"; }).join("");
    if (voice) voiceSel.value = voice.name;
    voiceSel.hidden = voices.length < 2;
  }
  loadVoices();
  if (synth.addEventListener) synth.addEventListener("voiceschanged", loadVoices); else synth.onvoiceschanged = loadVoices;

  /* ---------- playback ---------- */
  function speakCurrent() {
    if (!playing) return;
    if (ui >= units.length) { stop(); return; }
    var u = units[ui];
    if (ci === 0) highlight();
    var ut = new SpeechSynthesisUtterance(u.chunks[ci]);
    ut.rate = rate; ut.lang = (voice && voice.lang) || document.documentElement.lang || "en";
    if (voice) ut.voice = voice;
    var my = ++token; current = ut; // keep a reference so the browser doesn't garbage-collect it mid-speech
    ut.onend = function () {
      if (my !== token || !playing) return;
      ci++; if (ci >= u.chunks.length) { ui++; ci = 0; }
      paint(); speakCurrent();
    };
    ut.onerror = function (e) {
      if (my !== token || !playing) return;
      if (e && (e.error === "canceled" || e.error === "interrupted")) return;
      ci++; if (ci >= u.chunks.length) { ui++; ci = 0; }
      speakCurrent();
    };
    synth.speak(ut);
    paint();
  }
  function restart() { token++; synth.cancel(); setTimeout(speakCurrent, 80); }
  function play() { if (!units.length) build(); if (!units.length) return; active = true; playing = true; paused = false; paint(); restart(); }
  function pause() { playing = false; paused = true; token++; synth.cancel(); paint(); }
  function stop() {
    token++; synth.cancel(); playing = false; paused = false; active = false; ui = 0; ci = 0;
    var old = root.querySelector(".ra-current"); if (old) old.classList.remove("ra-current");
    paint();
  }
  function skip(d) {
    if (!units.length) return;
    ui = Math.max(0, Math.min(units.length - 1, ui + d)); ci = 0;
    if (playing) restart(); else { highlight(); paint(); }
  }
  function toggle() { playing ? pause() : play(); }

  btn.addEventListener("click", toggle);
  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-a]"); if (!b) return;
    var a = b.getAttribute("data-a");
    if (a === "toggle") toggle(); else if (a === "stop") stop(); else if (a === "prev") skip(-1); else if (a === "next") skip(1);
  });
  rateSel.addEventListener("change", function () {
    rate = parseFloat(rateSel.value) || 1; try { localStorage.setItem("ra_rate", String(rate)); } catch (e) {}
    if (playing) restart();
  });
  voiceSel.addEventListener("change", function () {
    voice = voices.filter(function (v) { return v.name === voiceSel.value; })[0] || voice;
    try { localStorage.setItem("ra_voice", voiceSel.value); } catch (e) {}
    if (playing) restart();
  });
  root.addEventListener("click", function (e) {
    if (!active || e.target.closest("a")) return;
    var el = e.target.closest("p,h2,h3,h4,li"); if (!el) return;
    for (var i = 0; i < units.length; i++) if (units[i].el === el) { ui = i; ci = 0; playing = true; paused = false; paint(); restart(); return; }
  });
  window.addEventListener("pagehide", function () { synth.cancel(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && active) stop(); });
  paint();
})();
