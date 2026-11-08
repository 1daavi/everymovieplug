/* Banner + search bar for /movies/ and /tv-shows/.
   Needs <section id="hubTop" data-type="movie|tv"> in the page (see the markup in movies/index.html).
   - Banner: new, popular TMDB titles of that one type only (6 slides).
   - Search bar under it: searches TMDB for that one type and shows the results right under the bar.
   Everything goes through the site's own /api/tmdb proxy, so no API key is exposed in the browser. */
(function () {
  "use strict";
  var root = document.getElementById("hubTop"); if (!root) return;
  var TYPE = root.getAttribute("data-type") === "tv" ? "tv" : "movie";
  var NOUN = TYPE === "tv" ? "TV shows" : "movies";
  var COUNT = 6, SLIDE_MS = 6500, IMGB = "https://image.tmdb.org/t/p/";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var fx = document.getElementById("hubFx"), stage = document.getElementById("hubStage"), dotsEl = document.getElementById("hubDots"), sk = document.getElementById("hubSk");
  var slides = [], dots = [], cur = 0, timer = null, touchX = null;

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var slugify = function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
  var pageUrl = function (i) { return "/" + TYPE + "/" + i.id + "-" + (slugify(i.title || i.name) || "title"); };
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var ago = function (n) { return new Date(Date.now() - n * 864e5); };

  var MG = { 28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western" };
  var TG = { 10759: "Action & Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 10762: "Kids", 9648: "Mystery", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10768: "War & Politics", 37: "Western" };
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---- tiny cached TMDB helper (30 min, same idea as the homepage) ---- */
  function tmdb(path, params) {
    var u = new URL("/api/tmdb" + path, location.origin);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    var ck = "emp_hub_" + u.pathname + u.search;
    try { var c = JSON.parse(sessionStorage.getItem(ck)); if (c && Date.now() - c.t < 18e5) return Promise.resolve(c.d); } catch (e) {}
    return fetch(u).then(function (r) { if (!r.ok) throw new Error("TMDB " + r.status); return r.json(); }).then(function (d) {
      try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    });
  }

  /* ================= BANNER ================= */
  /* newest releases, most popular first; widen the window until there are enough titles with a backdrop */
  function pull() {
    var windows = [60, 120, 365], k = 0;
    function next(out) {
      if (out.length >= COUNT || k >= windows.length) return Promise.resolve(out.slice(0, COUNT));
      var w = windows[k++];
      var p = { sort_by: "popularity.desc", include_adult: false, language: "en-US", "vote_count.gte": 5 };
      if (TYPE === "movie") { p["primary_release_date.gte"] = iso(ago(w)); p["primary_release_date.lte"] = iso(new Date()); }
      else { p["first_air_date.gte"] = iso(ago(w + 30)); p["first_air_date.lte"] = iso(new Date()); p.without_genres = "10767,10763,10766"; }
      return tmdb("/discover/" + TYPE, p).then(function (d) { return (d.results || []).filter(function (i) { return i.backdrop_path; }); }, function () { return []; }).then(next);
    }
    return next([]);
  }

  function votes(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n); }

  function slide(i, n, total) {
    var title = i.title || i.name || "Untitled", date = i.release_date || i.first_air_date || "", yr = date.slice(0, 4);
    var s = i.vote_average || 0, col = s >= 7 ? "#34d399" : s >= 5 ? "#fbbf24" : "#f87171";
    var map = TYPE === "tv" ? TG : MG, genres = (i.genre_ids || []).map(function (g) { return map[g]; }).filter(Boolean).slice(0, 3).join(" · ");
    var fresh = date && (Date.now() - Date.parse(date)) < 21 * 864e5;
    var rating = s && i.vote_count ? '<span class="hub-fx-rate" style="color:' + col + '">&#9733; ' + s.toFixed(1) + ' <small>/10 · ' + votes(i.vote_count) + ' votes</small></span>' : '<span class="hub-fx-rate" style="color:#c4b5fd">No rating yet</span>';
    var a = document.createElement("a");
    a.className = "hub-fx-slide"; a.href = pageUrl(i);
    a.setAttribute("role", "group"); a.setAttribute("aria-roledescription", "slide");
    a.setAttribute("aria-label", title + (yr ? " (" + yr + ")" : "") + (s ? ", rated " + s.toFixed(1) + " out of 10" : "") + ". Open full page");
    a.innerHTML =
      '<img class="hub-fx-img" alt="" decoding="async" loading="' + (n === 0 ? "eager" : "lazy") + '" src="' + IMGB + 'w1280' + i.backdrop_path + '" srcset="' + IMGB + 'w780' + i.backdrop_path + ' 780w, ' + IMGB + 'w1280' + i.backdrop_path + ' 1280w" sizes="(max-width:1200px) 100vw, 1200px">' +
      '<div class="hub-fx-info">' +
        '<div class="hub-fx-badges"><span class="hub-fx-type' + (TYPE === "tv" ? " tv" : "") + '">' + (TYPE === "tv" ? "TV Show" : "Movie") + '</span>' + (fresh ? '<span class="hub-fx-new">New</span>' : "") + '</div>' +
        '<h2 class="hub-fx-title">' + esc(title) + '</h2>' +
        '<div class="hub-fx-meta">' + rating + (yr ? '<span>' + esc(yr) + '</span>' : "") + (genres ? '<i class="hub-fx-sep"></i><span>' + esc(genres) + '</span>' : "") + '</div>' +
        '<p class="hub-fx-ov">' + esc(i.overview || "Popular right now on Every Movie Plug.") + '</p>' +
        '<span class="hub-fx-cta">View full page ' + ARROW + '</span>' +
      '</div>';
    var img = a.querySelector(".hub-fx-img"); img.onerror = function () { this.remove(); a.classList.add("noimg"); };
    return a;
  }

  function show(n) {
    cur = (n + slides.length) % slides.length;
    slides.forEach(function (s, k) { var on = k === cur; s.classList.toggle("on", on); s.tabIndex = on ? 0 : -1; s.setAttribute("aria-hidden", on ? "false" : "true"); });
    dots.forEach(function (d, k) { d.classList.remove("on"); void d.offsetWidth; if (k === cur) d.classList.add("on"); d.setAttribute("aria-selected", k === cur ? "true" : "false"); });
  }
  function schedule() { clearTimeout(timer); if (reduce || fx.hidden || fx.classList.contains("paused") || slides.length < 2) return; timer = setTimeout(function () { show(cur + 1); schedule(); }, SLIDE_MS); }
  function go(n) { show(n); schedule(); }
  function pause() { fx.classList.add("paused"); clearTimeout(timer); }
  function resume() { if (fx.hidden) return; fx.classList.remove("paused"); show(cur); schedule(); }

  pull().then(function (items) {
    if (!items.length) { fx.hidden = true; return; }
    items.forEach(function (it, n) {
      var a = slide(it, n, items.length); stage.appendChild(a); slides.push(a);
      var b = document.createElement("button");
      b.type = "button"; b.className = "hub-fx-dot"; b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Show " + (it.title || it.name)); b.innerHTML = "<i></i>";
      b.addEventListener("click", function () { go(n); });
      dotsEl.appendChild(b); dots.push(b);
    });
    fx.style.setProperty("--hub-fx-dur", SLIDE_MS + "ms");
    fx.classList.toggle("static", reduce);
    if (sk) sk.remove();
    show(0); schedule();
    if (items.length < 2) fx.querySelector(".hub-fx-nav").hidden = true;
  });

  document.getElementById("hubPrev").addEventListener("click", function () { go(cur - 1); });
  document.getElementById("hubNext").addEventListener("click", function () { go(cur + 1); });
  fx.addEventListener("mouseenter", pause); fx.addEventListener("mouseleave", resume);
  fx.addEventListener("focusin", function (e) { if (e.target.matches(":focus-visible")) pause(); });
  fx.addEventListener("focusout", function () { setTimeout(function () { if (!fx.contains(document.activeElement)) resume(); }, 0); });
  fx.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") go(cur - 1); else if (e.key === "ArrowRight") go(cur + 1); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else resume(); });
  fx.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  fx.addEventListener("touchend", function (e) { if (touchX === null) return; var dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); }, { passive: true });

  /* ================= SEARCH ================= */
  var form = document.getElementById("hubSearch"), input = document.getElementById("hubQ"), clearBtn = document.getElementById("hubClear"), goBtn = document.getElementById("hubGo");
  var box = document.getElementById("hubResults"), head = document.getElementById("hubResHead"), grid = document.getElementById("hubResGrid");
  var tok = 0, debounce = null;

  function card(i) {
    var t = i.title || i.name, y = (i.release_date || i.first_air_date || "").slice(0, 4), s = i.vote_average;
    return '<a href="' + esc(pageUrl(i)) + '" class="glass-card glass-card-interactive rounded-2xl overflow-hidden block no-underline">' +
      '<div class="relative aspect-[2/3] bg-white/5">' + (i.poster_path ? '<img src="' + IMGB + 'w342' + i.poster_path + '" alt="' + esc(t) + ' poster" loading="lazy" class="w-full h-full object-cover">' : '<div class="w-full h-full flex items-center justify-center text-xs text-slate-500">No poster</div>') +
      (s ? '<span class="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-black/70 text-amber-400">&#9733; ' + s.toFixed(1) + '</span>' : "") + '</div>' +
      '<div class="p-3"><p class="text-sm font-bold text-white leading-snug">' + esc(t) + '</p><p class="text-xs text-slate-400 mt-0.5">' + esc(y) + '</p></div></a>';
  }

  function reset() {
    tok++; clearTimeout(debounce);
    box.hidden = true; grid.innerHTML = ""; head.innerHTML = "";
    clearBtn.hidden = true; goBtn.hidden = false;
  }

  function run(q) {
    var my = ++tok;
    box.hidden = false; clearBtn.hidden = false; goBtn.hidden = true;
    head.innerHTML = '<h2>Searching ' + esc(NOUN) + '…</h2>';
    grid.innerHTML = new Array(11).join("<div class='glass-card rounded-2xl aspect-[2/3] animate-pulse'></div>");
    tmdb("/search/" + TYPE, { query: q, include_adult: false, language: "en-US", page: 1 }).then(function (d) {
      if (my !== tok) return;
      var r = (d.results || []).filter(function (i) { return i.id; });
      /* most popular first, so the title most people mean is on top */
      r.sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
      r = r.slice(0, 20);
      if (!r.length) {
        head.innerHTML = '<h2>No ' + esc(NOUN) + ' found</h2>';
        grid.innerHTML = '<p class="hub-note" style="grid-column:1/-1">Nothing matched “' + esc(q) + '”. Check the spelling or try fewer words.</p>';
        return;
      }
      head.innerHTML = '<h2>Results for “' + esc(q) + '”</h2><span>' + r.length + (r.length === 1 ? " title" : " titles") + '</span>';
      grid.innerHTML = r.map(card).join("");
    }).catch(function () {
      if (my !== tok) return;
      head.innerHTML = '<h2>Search is unavailable</h2>';
      grid.innerHTML = '<p class="hub-note" style="grid-column:1/-1">The search could not be loaded right now. Please try again in a moment.</p>';
    });
  }

  function onInput() {
    var q = input.value.trim();
    clearTimeout(debounce);
    if (q.length < 2) { if (!q) reset(); return; }
    debounce = setTimeout(function () { run(q); }, 350);
  }
  input.addEventListener("input", onInput);
  form.addEventListener("submit", function (e) { e.preventDefault(); var q = input.value.trim(); clearTimeout(debounce); if (q.length >= 1) run(q); });
  clearBtn.addEventListener("click", function () { input.value = ""; reset(); input.focus(); });
  input.addEventListener("keydown", function (e) { if (e.key === "Escape" && input.value) { input.value = ""; reset(); } });
})();
