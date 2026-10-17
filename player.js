/*!
 * Every Movie Plug video player
 * Turns every <div class="emp-player"><video src="..."></video></div> on a page into a themed player.
 * No libraries, no settings. Styles are injected by this file, so /player.js is the only thing to upload.
 * Works without JavaScript too: the plain <video controls> inside keeps working.
 *
 * Keys (click the player first): Space/K play, ←/→ 5s, J/L 10s, ↑/↓ volume, M mute, F fullscreen, C captions, 0-9 jump.
 */
(function () {
  if (window.__empPlayer) return;
  window.__empPlayer = true;

  var CSS = `
.emp-player-figure{margin:2rem 0;padding:0}
.emp-player-figure figcaption{margin-top:.7rem;font-size:.88rem;color:var(--muted,#a1a1a6);text-align:center}
.emp-player{--emp-a:#6366f1;--emp-b:#a855f7;--emp-grad:linear-gradient(90deg,#6366f1,#a855f7);
  position:relative;width:100%;aspect-ratio:16/9;max-height:82vh;margin:0 auto;background:#000;color:#f5f5f7;
  border-radius:16px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,.12));
  box-shadow:0 18px 50px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.02);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;
  -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;outline:0;isolation:isolate}
.emp-player:focus-visible{box-shadow:0 0 0 2px #a855f7,0 18px 50px rgba(0,0,0,.45)}
.emp-player video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;display:block}
.emp-player.emp-fs{max-height:none;border-radius:0;border:0;aspect-ratio:auto;width:100%;height:100%}
.emp-player *{box-sizing:border-box}
.emp-player button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  width:38px;height:38px;border-radius:10px;color:#f5f5f7;transition:background .18s,color .18s,transform .18s}
.emp-player button:hover{background:rgba(255,255,255,.14)}
.emp-player button:active{transform:scale(.92)}
.emp-player button:focus-visible{box-shadow:0 0 0 2px #a855f7}
.emp-player button[aria-pressed="true"]{color:#c4b5fd}
.emp-player svg{width:22px;height:22px;fill:currentColor;pointer-events:none}

/* big centre button */
.emp-player .emp-big{position:absolute;left:50%;top:50%;width:84px!important;height:84px!important;margin:-42px 0 0 -42px;border-radius:50%!important;
  background:var(--emp-grad)!important;box-shadow:0 10px 40px rgba(99,102,241,.55),0 0 0 8px rgba(168,85,247,.16);
  transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .25s,box-shadow .25s!important;z-index:3}
.emp-player .emp-big svg{width:38px;height:38px;margin-left:4px}
.emp-player .emp-big:hover{transform:scale(1.08);background:var(--emp-grad)!important;box-shadow:0 12px 48px rgba(99,102,241,.7),0 0 0 12px rgba(168,85,247,.2)}
.emp-player .emp-big::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(168,85,247,.55);animation:emp-ring 2.4s ease-out infinite}
@keyframes emp-ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.7);opacity:0}}
.emp-player.emp-playing .emp-big,.emp-player.emp-started:not(.emp-ended):not(.emp-paused-flash) .emp-big{opacity:0;pointer-events:none;transform:scale(.7)}
.emp-player.emp-ended .emp-big{opacity:1;pointer-events:auto}
.emp-shade{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 30%,rgba(0,0,0,.45) 100%);pointer-events:none;transition:opacity .3s}
.emp-player.emp-started .emp-shade{opacity:0}
.emp-title{position:absolute;left:0;right:0;top:0;padding:16px 18px 40px;font-size:15px;font-weight:600;letter-spacing:.01em;
  background:linear-gradient(rgba(0,0,0,.7),transparent);z-index:2;transition:opacity .3s,transform .3s;pointer-events:none;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* controls */
.emp-controls{position:absolute;left:0;right:0;bottom:0;padding:44px 12px 10px;z-index:4;
  background:linear-gradient(transparent,rgba(0,0,0,.55) 45%,rgba(0,0,0,.88));
  transition:opacity .3s,transform .3s}
.emp-player:not(.emp-started) .emp-controls,.emp-player:not(.emp-started) .emp-title{opacity:0;pointer-events:none}
.emp-player.emp-idle .emp-controls{opacity:0;transform:translateY(8px);pointer-events:none}
.emp-player.emp-idle .emp-title{opacity:0;transform:translateY(-6px)}
.emp-player.emp-idle{cursor:none}
.emp-row{display:flex;align-items:center;gap:2px}
.emp-time{font-variant-numeric:tabular-nums;font-size:13px;color:#e5e5ea;padding:0 8px;white-space:nowrap}
.emp-time span{color:#a1a1a6}
.emp-spacer{flex:1}

/* progress */
.emp-progress{position:relative;height:22px;margin:0 6px 2px;cursor:pointer;touch-action:none;display:flex;align-items:center}
.emp-track{position:relative;width:100%;height:5px;border-radius:99px;background:rgba(255,255,255,.2);transition:height .15s}
.emp-progress:hover .emp-track,.emp-progress.emp-drag .emp-track{height:8px}
.emp-buf,.emp-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px;width:0}
.emp-buf{background:rgba(255,255,255,.28)}
.emp-fill{background:var(--emp-grad)}
.emp-thumb{position:absolute;top:50%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;background:#fff;
  box-shadow:0 0 0 4px rgba(168,85,247,.35),0 2px 8px rgba(0,0,0,.5);transform:scale(0);transition:transform .15s;left:0}
.emp-progress:hover .emp-thumb,.emp-progress.emp-drag .emp-thumb,.emp-progress:focus-visible .emp-thumb{transform:scale(1)}
.emp-tip{position:absolute;bottom:26px;padding:4px 8px;border-radius:8px;background:rgba(17,17,22,.95);border:1px solid rgba(255,255,255,.14);
  font-size:12px;font-variant-numeric:tabular-nums;transform:translateX(-50%);opacity:0;pointer-events:none;transition:opacity .15s;white-space:nowrap}
.emp-progress:hover .emp-tip,.emp-progress.emp-drag .emp-tip{opacity:1}

/* volume */
.emp-vol{display:flex;align-items:center}
.emp-vol input{-webkit-appearance:none;appearance:none;width:0;opacity:0;height:5px;border-radius:99px;margin:0;cursor:pointer;outline:0;
  background:linear-gradient(90deg,#a855f7 var(--v,100%),rgba(255,255,255,.22) var(--v,100%));transition:width .2s,opacity .2s,margin .2s}
.emp-vol:hover input,.emp-vol:focus-within input{width:76px;opacity:1;margin:0 8px 0 4px}
.emp-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.5)}
.emp-vol input::-moz-range-thumb{width:13px;height:13px;border:0;border-radius:50%;background:#fff}
@media (hover:none){.emp-vol input{display:none}}

/* speed menu */
.emp-menuwrap{position:relative}
.emp-player .emp-speedbtn{width:auto!important;padding:0 9px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.emp-menu{position:absolute;right:0;bottom:46px;min-width:112px;padding:6px;border-radius:12px;background:rgba(17,17,22,.96);
  border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 40px rgba(0,0,0,.6);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  opacity:0;transform:translateY(6px) scale(.97);pointer-events:none;transition:opacity .16s,transform .16s;transform-origin:bottom right}
.emp-menu.emp-open{opacity:1;transform:none;pointer-events:auto}
.emp-menu button{width:100%;height:34px;justify-content:space-between;padding:0 10px;border-radius:8px;font-size:13px}
.emp-menu button[aria-checked="true"]{background:rgba(99,102,241,.22);color:#c4b5fd}
.emp-menu button[aria-checked="true"]::after{content:"✓";margin-left:10px}

/* feedback */
.emp-toast{position:absolute;left:50%;top:50%;padding:9px 16px;border-radius:99px;background:rgba(17,17,22,.82);border:1px solid rgba(255,255,255,.14);
  font-weight:600;font-size:15px;transform:translate(-50%,-50%) scale(.9);opacity:0;pointer-events:none;z-index:5;transition:opacity .2s,transform .2s}
.emp-toast.emp-show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.emp-spin{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid rgba(255,255,255,.18);
  border-top-color:#a855f7;animation:emp-rot .8s linear infinite;opacity:0;pointer-events:none;transition:opacity .2s;z-index:3}
.emp-player.emp-wait .emp-spin{opacity:1}
@keyframes emp-rot{to{transform:rotate(360deg)}}
.emp-err{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:24px;
  background:rgba(0,0,0,.85);z-index:6;color:#d2d2d7}
.emp-err strong{color:#f5f5f7;font-size:16px}
.emp-player.emp-failed .emp-err{display:flex}
.emp-player.emp-failed .emp-big,.emp-player.emp-failed .emp-controls{display:none}

@media (max-width:560px){
  .emp-player{border-radius:12px}
  .emp-big{width:68px!important;height:68px!important;margin:-34px 0 0 -34px}
  .emp-time{font-size:12px;padding:0 4px}
  .emp-player button{width:36px;height:36px}
  .emp-pipbtn{display:none!important}
}
@media (prefers-reduced-motion:reduce){.emp-player *,.emp-player *::before{transition:none!important;animation:none!important}}
`;

  var I = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.6-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6l4.6 3.9a.6.6 0 0 0 1-.46V6.06a.6.6 0 0 0-1-.46L7.6 9.5z"/><path d="M16 8.6a5 5 0 0 1 0 6.8M18.4 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    low: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6l4.6 3.9a.6.6 0 0 0 1-.46V6.06a.6.6 0 0 0-1-.46L7.6 9.5z"/><path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6l4.6 3.9a.6.6 0 0 0 1-.46V6.06a.6.6 0 0 0-1-.46L7.6 9.5z"/><path d="m16.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    cc: '<svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm2.6 4.2A2.6 2.6 0 0 0 7.6 14.8c.8 0 1.4-.3 1.8-.9l-1-.7a1.2 1.2 0 1 1 0-2.1l1-.7c-.4-.6-1-.9-1.8-.9zm6.6 0a2.6 2.6 0 0 0 0 5.6c.8 0 1.4-.3 1.8-.9l-1-.7a1.2 1.2 0 1 1 0-2.1l1-.7c-.4-.6-1-.9-1.8-.9z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5V11H20V6.5H4v11h6V19H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 5zm8 8h8.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M11 4h2v8.2l2.9-2.9 1.4 1.4L12 16.1l-5.3-5.4 1.4-1.4 2.9 2.9zM5 18h14v2H5z"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path d="M4 9V5a1 1 0 0 1 1-1h4v2H6v3zm16 0V5a1 1 0 0 0-1-1h-4v2h3v3zM4 15v4a1 1 0 0 0 1 1h4v-2H6v-3zm16 0v4a1 1 0 0 1-1 1h-4v-2h3v-3z"/></svg>',
    fsx: '<svg viewBox="0 0 24 24"><path d="M9 4v4a1 1 0 0 1-1 1H4V7h3V4zm6 0v4a1 1 0 0 0 1 1h4V7h-3V4zM9 20v-4a1 1 0 0 0-1-1H4v2h3v3zm6 0v-4a1 1 0 0 1 1-1h4v2h-3v3z"/></svg>'
  };

  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var all = [];
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; }

  function init(box) {
    if (box.__emp) return;
    var v = box.querySelector("video");
    if (!v) return;
    box.__emp = true;
    v.controls = false; v.removeAttribute("controls");
    v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    if (!v.getAttribute("preload")) v.preload = "metadata";
    var title = box.getAttribute("data-title") || "";
    box.setAttribute("tabindex", "0");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", (title ? title + ": " : "") + "video player");

    var big = el("button", "emp-big", I.play); big.type = "button"; big.setAttribute("aria-label", "Play video");
    var shade = el("div", "emp-shade");
    var spin = el("div", "emp-spin");
    var toast = el("div", "emp-toast");
    var err = el("div", "emp-err", "<strong>This video couldn't be loaded</strong><span>Check your connection and try again.</span>");
    var ttl = title ? el("div", "emp-title") : null; if (ttl) ttl.textContent = title;

    var hasCC = v.querySelector("track");
    var controls = el("div", "emp-controls");
    controls.innerHTML =
      '<div class="emp-progress" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<div class="emp-track"><div class="emp-buf"></div><div class="emp-fill"></div><div class="emp-thumb"></div></div><div class="emp-tip">0:00</div></div>' +
      '<div class="emp-row">' +
        '<button type="button" class="emp-pp" aria-label="Play">' + I.play + '</button>' +
        '<div class="emp-vol"><button type="button" class="emp-mutebtn" aria-label="Mute">' + I.vol + '</button>' +
          '<input type="range" min="0" max="1" step="0.02" value="1" aria-label="Volume"></div>' +
        '<div class="emp-time">0:00 <span>/ 0:00</span></div><div class="emp-spacer"></div>' +
        (hasCC ? '<button type="button" class="emp-ccbtn" aria-label="Captions" aria-pressed="false">' + I.cc + '</button>' : '') +
        (box.hasAttribute("data-download") ? '<button type="button" class="emp-dlbtn" aria-label="Download video" title="Download video">' + I.dl + '</button>' : '') +
        '<div class="emp-menuwrap"><button type="button" class="emp-speedbtn" aria-label="Playback speed" aria-haspopup="true" aria-expanded="false">1×</button>' +
          '<div class="emp-menu" role="menu"></div></div>' +
        ((document.pictureInPictureEnabled || v.webkitSupportsPresentationMode) ? '<button type="button" class="emp-pipbtn" aria-label="Picture in picture">' + I.pip + '</button>' : '') +
        '<button type="button" class="emp-fsbtn" aria-label="Fullscreen">' + I.fs + '</button>' +
      '</div>';

    box.appendChild(shade); if (ttl) box.appendChild(ttl);
    box.appendChild(spin); box.appendChild(toast); box.appendChild(err); box.appendChild(big); box.appendChild(controls);

    var q = function (s) { return controls.querySelector(s); };
    var prog = q(".emp-progress"), fill = q(".emp-fill"), buf = q(".emp-buf"), thumb = q(".emp-thumb"), tip = q(".emp-tip");
    var pp = q(".emp-pp"), muteBtn = q(".emp-mutebtn"), volIn = q(".emp-vol input"), timeEl = q(".emp-time");
    var speedBtn = q(".emp-speedbtn"), menu = q(".emp-menu"), fsBtn = q(".emp-fsbtn"), pipBtn = q(".emp-pipbtn"), ccBtn = q(".emp-ccbtn");

    SPEEDS.forEach(function (s) {
      var b = el("button", "", s + "×"); b.type = "button"; b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", s === 1 ? "true" : "false"); b.setAttribute("data-s", s);
      b.onclick = function () { setSpeed(s); closeMenu(); };
      menu.appendChild(b);
    });

    var toastT, idleT, clickT, drag = false;
    function say(txt) { toast.textContent = txt; toast.classList.add("emp-show"); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove("emp-show"); }, 750); }
    function setSpeed(s) {
      v.playbackRate = s; speedBtn.textContent = s + "×";
      [].forEach.call(menu.children, function (b) { b.setAttribute("aria-checked", +b.getAttribute("data-s") === s ? "true" : "false"); });
      say(s + "× speed");
    }
    function closeMenu() { menu.classList.remove("emp-open"); speedBtn.setAttribute("aria-expanded", "false"); }
    speedBtn.onclick = function (e) { e.stopPropagation(); var o = menu.classList.toggle("emp-open"); speedBtn.setAttribute("aria-expanded", o); };
    document.addEventListener("click", function (e) { if (!menu.contains(e.target) && e.target !== speedBtn) closeMenu(); });

    function toggle() {
      if (v.ended) { v.currentTime = 0; }
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
    }
    function seekBy(d) { if (isFinite(v.duration)) { v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + d)); say((d > 0 ? "+" : "") + d + "s"); } }
    function setVol(x) { v.muted = x === 0; v.volume = Math.max(0, Math.min(1, x)); }

    function wake() {
      box.classList.remove("emp-idle"); clearTimeout(idleT);
      if (!v.paused && !drag && !menu.classList.contains("emp-open") && !controls.matches(":focus-within:not(:hover)")) {
        idleT = setTimeout(function () { if (!v.paused && !menu.classList.contains("emp-open")) box.classList.add("emp-idle"); }, 2600);
      }
    }
    box.addEventListener("pointermove", wake);
    box.addEventListener("pointerdown", wake);
    box.addEventListener("pointerleave", function () { if (!v.paused && !drag) box.classList.add("emp-idle"); });
    box.addEventListener("focusin", wake);

    // clicks on the picture: one click toggles, a double click goes fullscreen
    v.addEventListener("click", function () {
      clearTimeout(clickT);
      clickT = setTimeout(toggle, 210);
    });
    v.addEventListener("dblclick", function () { clearTimeout(clickT); toggleFs(); });
    big.onclick = function (e) { e.stopPropagation(); toggle(); };
    pp.onclick = toggle;
    muteBtn.onclick = function () { v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 0.6; };
    volIn.addEventListener("input", function () { setVol(+volIn.value); });

    function paintVol() {
      var val = v.muted ? 0 : v.volume;
      volIn.value = val; volIn.style.setProperty("--v", (val * 100) + "%");
      muteBtn.innerHTML = val === 0 ? I.mute : val < 0.5 ? I.low : I.vol;
      muteBtn.setAttribute("aria-label", val === 0 ? "Unmute" : "Mute");
    }
    function paintTime() {
      var d = v.duration, c = v.currentTime, pct = isFinite(d) && d ? (c / d) * 100 : 0;
      fill.style.width = pct + "%"; thumb.style.left = pct + "%";
      prog.setAttribute("aria-valuenow", Math.round(pct));
      prog.setAttribute("aria-valuetext", fmt(c) + " of " + fmt(d));
      timeEl.innerHTML = fmt(c) + ' <span>/ ' + fmt(d) + "</span>";
    }
    function paintBuf() {
      try { var d = v.duration, b = v.buffered; if (isFinite(d) && b.length) buf.style.width = (b.end(b.length - 1) / d) * 100 + "%"; } catch (e) {}
    }
    function paintState() {
      var playing = !v.paused && !v.ended;
      box.classList.toggle("emp-playing", playing);
      box.classList.toggle("emp-ended", v.ended);
      pp.innerHTML = v.ended ? I.replay : playing ? I.pause : I.play;
      pp.setAttribute("aria-label", playing ? "Pause" : v.ended ? "Replay" : "Play");
      big.innerHTML = v.ended ? I.replay : I.play;
      big.setAttribute("aria-label", v.ended ? "Replay video" : "Play video");
      wake();
    }

    v.addEventListener("play", function () {
      box.classList.add("emp-started");
      all.forEach(function (o) { if (o.v !== v && !o.v.paused) o.v.pause(); });
      paintState();
    });
    ["pause", "ended", "playing"].forEach(function (e) { v.addEventListener(e, paintState); });
    v.addEventListener("timeupdate", function () { if (!drag) paintTime(); });
    v.addEventListener("progress", paintBuf);
    v.addEventListener("loadedmetadata", function () {
      paintTime(); paintBuf();
      if (v.videoWidth && v.videoHeight && !box.hasAttribute("data-ratio")) box.style.aspectRatio = v.videoWidth + " / " + v.videoHeight;
    });
    v.addEventListener("durationchange", paintTime);
    v.addEventListener("volumechange", function () { paintVol(); store.set("emp-vol", v.muted ? "0" : String(v.volume)); });
    v.addEventListener("waiting", function () { box.classList.add("emp-wait"); });
    ["playing", "canplay", "seeked", "pause"].forEach(function (e) { v.addEventListener(e, function () { box.classList.remove("emp-wait"); }); });
    v.addEventListener("error", function () { box.classList.add("emp-failed"); box.classList.remove("emp-wait"); });
    v.addEventListener("ratechange", function () { /* keep in sync if changed elsewhere */ });

    // seeking by dragging or clicking the bar
    function frac(e) { var r = prog.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
    function showTip(e) {
      var f = frac(e), r = prog.getBoundingClientRect(), w = tip.offsetWidth / 2 + 4;
      tip.textContent = fmt(f * (v.duration || 0));
      tip.style.left = Math.max(w, Math.min(r.width - w, f * r.width)) + "px";
    }
    prog.addEventListener("pointermove", function (e) { showTip(e); if (drag) scrub(e); });
    function scrub(e) {
      if (!isFinite(v.duration)) return;
      var f = frac(e); fill.style.width = f * 100 + "%"; thumb.style.left = f * 100 + "%";
      timeEl.innerHTML = fmt(f * v.duration) + ' <span>/ ' + fmt(v.duration) + "</span>";
      v.currentTime = f * v.duration;
    }
    prog.addEventListener("pointerdown", function (e) {
      drag = true; prog.classList.add("emp-drag"); prog.setPointerCapture(e.pointerId); showTip(e); scrub(e);
    });
    function endDrag() { if (!drag) return; drag = false; prog.classList.remove("emp-drag"); paintTime(); wake(); }
    prog.addEventListener("pointerup", endDrag); prog.addEventListener("pointercancel", endDrag);
    prog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { seekBy(5); e.preventDefault(); e.stopPropagation(); }
      if (e.key === "ArrowLeft") { seekBy(-5); e.preventDefault(); e.stopPropagation(); }
    });

    var dlBtn = q(".emp-dlbtn");
    if (dlBtn) dlBtn.onclick = function () {
      var href = v.currentSrc || v.getAttribute("src") || "", name = box.getAttribute("data-download") || decodeURIComponent(href.split("?")[0].split("/").pop() || "video.mp4");
      var a = document.createElement("a"); a.href = href; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      say("Downloading…");
    };

    // fullscreen, picture in picture, captions
    function isFs() { return document.fullscreenElement === box || document.webkitFullscreenElement === box; }
    function toggleFs() {
      if (isFs()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var rq = box.requestFullscreen || box.webkitRequestFullscreen;
      if (rq) rq.call(box); else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();   // iPhone
    }
    function paintFs() { var on = isFs(); box.classList.toggle("emp-fs", on); fsBtn.innerHTML = on ? I.fsx : I.fs; fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen"); }
    document.addEventListener("fullscreenchange", paintFs); document.addEventListener("webkitfullscreenchange", paintFs);
    fsBtn.onclick = toggleFs;
    if (pipBtn) pipBtn.onclick = function () {
      try { if (document.pictureInPictureElement) document.exitPictureInPicture(); else if (v.requestPictureInPicture) v.requestPictureInPicture(); } catch (e) {}
    };
    if (ccBtn) {
      var tracks = v.textTracks, setCC = function (on) {
        for (var i = 0; i < tracks.length; i++) tracks[i].mode = on && i === 0 ? "showing" : "disabled";
        ccBtn.setAttribute("aria-pressed", on); say(on ? "Captions on" : "Captions off");
      };
      for (var i = 0; i < tracks.length; i++) tracks[i].mode = "disabled";
      ccBtn.onclick = function () { setCC(ccBtn.getAttribute("aria-pressed") !== "true"); };
      box.__cc = function () { ccBtn.click(); };
    }

    // keyboard
    box.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, k = e.key, onBtn = t && (t.tagName === "BUTTON" || t.tagName === "INPUT");
      if ((k === " " || k === "Enter") && onBtn) return;
      var used = true;
      if (k === " " || k === "k" || k === "K") toggle();
      else if (k === "ArrowRight") seekBy(5);
      else if (k === "ArrowLeft") seekBy(-5);
      else if (k === "l" || k === "L") seekBy(10);
      else if (k === "j" || k === "J") seekBy(-10);
      else if (k === "ArrowUp" && !(t && t.tagName === "INPUT")) { setVol(v.volume + 0.1); say("Volume " + Math.round(v.volume * 100) + "%"); }
      else if (k === "ArrowDown" && !(t && t.tagName === "INPUT")) { setVol(v.volume - 0.1); say("Volume " + Math.round(v.volume * 100) + "%"); }
      else if (k === "m" || k === "M") { v.muted = !v.muted; say(v.muted ? "Muted" : "Sound on"); }
      else if (k === "f" || k === "F") toggleFs();
      else if ((k === "c" || k === "C") && box.__cc) box.__cc();
      else if (/^[0-9]$/.test(k) && isFinite(v.duration)) v.currentTime = v.duration * (+k / 10);
      else if (k === "Escape") closeMenu();
      else used = false;
      if (used) { e.preventDefault(); wake(); }
    });

    var saved = store.get("emp-vol");
    if (saved !== null && saved !== "") { var n = parseFloat(saved); if (n === 0) v.muted = true; else if (n > 0) v.volume = n; }
    paintVol(); paintTime(); paintState();
    all.push({ box: box, v: v });
    if (v.readyState >= 1) v.dispatchEvent(new Event("loadedmetadata"));
  }

  function boot() {
    if (!document.getElementById("emp-player-css")) {
      var s = document.createElement("style"); s.id = "emp-player-css"; s.textContent = CSS; document.head.appendChild(s);
    }
    [].forEach.call(document.querySelectorAll(".emp-player"), init);
  }
  window.EMPPlayer = { init: boot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
