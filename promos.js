/* =====================================================================================================
   EVERY MOVIE PLUG: PROMO SLOTS
   =====================================================================================================
   This is the ONE file you edit when you have an indie movie, an indie TV show, an article or a news
   story to promote. Add an item to the list for the slot you want, save, and push. Nothing else to touch.
   While a list is empty ( [] ) the slot stays completely invisible to visitors.

   THE 5 SLOTS
     homeBanner      Big rotating banner at the top of the homepage. Sits in front of the TMDB movies/shows.
                     Accepts news, articles, indie titles or anything else.
     homeMovies      "Trending Movies" row on the homepage: promo posters appear first (use for indie movies).
     homeTv          "Trending TV Shows" row on the homepage: promo posters appear first (use for indie shows).
     articlesBanner  Banner at the top of /articles/ (page 1): promo slides appear first.
     newsBanner      Banner at the top of /news/ (page 1): promo slides appear first.

   (The banners on /movies/ and /tv-shows/ are automatic: new, popular TMDB titles only.)

   THE SMALL LABEL IN THE TOP-LEFT CORNER OF EACH BANNER ("New & Popular", "Featured Stories", ...)
     The LABELS list just below the slots sets the normal label. The rotating TMDB movies/shows always use it.
     To give ONE of your own slides a different corner label, add  cornerLabel: "Partner Spotlight"  to that item
     (use  cornerLabel: ""  to show no corner label on that slide). Slides without cornerLabel use the normal label.

   COLOUR WORDS IN A TITLE OR DESCRIPTION
     Put curly braces around the word(s) you want coloured:
       title: "{Advertise} With Us!"                       "Advertise" in the site's purple (HIGHLIGHT_COLOR below)
       title: "{gold|Advertise} {#22c55e|With} Us!"        pick the colour first, then a | bar, then the words
       description: "Reach {purple|movie fans} every {gold|day}."     works in descriptions too
     A colour is a name from the COLORS list below (purple, gold, yellow, orange, red, pink, green, teal, blue, white)
     or any hex code like #22c55e. Words without braces keep the normal white / grey.

   WHAT AN ITEM LOOKS LIKE
     {
       type:        "news" | "article" | "indie" | "movie" | "tv"   (sets the badge colour and the button wording)
       cornerLabel: "Partner Spotlight" optional (banners only): the corner label while THIS slide is showing
       label:       "Indie Film"        optional: replaces the badge text (e.g. "Indie Film", "World Premiere").
                                        Use  label: ""  to show no badge at all.
       title:       "My Indie Movie"
       description: "One or two sentences."            (banners only)
       image:       "/promos/my-movie.jpg"            Banners: wide image (16:9, ~1280px). Poster rows: tall poster (2:3).
       url:         "https://example.com/trailer"     Where a click goes. Site pages can be "/news/xyz.html".
                    "mailto:contact@everymovieplug.com"     an email link works too (add ?subject=Hello after the address
                                                            for a ready-made subject). "tel:+233..." works for phone numbers.
       cta:         "Watch the trailer"               optional button text
       year:        "2026"                            optional, shown under poster cards / in banners
       sponsored:   true                              use this for PAID promos: adds a "Sponsored" tag and
                                                      rel="sponsored" on the link (recommended by Google/FTC)
       newTab:      true                              optional (links to other websites open in a new tab anyway)
       start:       "2026-11-10"                      optional: promo switches ON this day
       end:         "2026-12-01"                      optional: promo switches OFF after this day
     }

   SHORTCUT FOR STORIES ON YOUR OWN SITE (news / articles)
     Give only the story file and the title, picture and summary are filled in for you:
       { type: "news",    story: "/news/godzilla-minus-zero-breaks-24-year-old-box-office-record.html" }
       { type: "article", story: "/articles/most-anticipated-movies-of-2027.html" }
     Anything you write yourself (title, image, ...) wins over the automatic value.

   IMAGES
     Upload promo pictures into the /promos/ folder and refer to them like  image: "/promos/my-movie.jpg"
     (a full https:// picture address works too).

   SEE IT WORKING BEFORE YOU ADD ANYTHING
     Open any page with  ?promo-preview=1  on the end (for example  https://everymovieplug.com/?promo-preview=1 )
     and every slot shows a sample promo. It only affects your own browser tab.
   ===================================================================================================== */

(function () {
  "use strict";

  var PROMOS = {

    /* ---------- Homepage: big banner at the top (news, articles, indie titles, anything) ---------- */
    homeBanner: [
      //{ type: "indie", cornerLabel: "Public Announcement", label: "Advertisement", title: "{Advertise} With Us!", description: "For ad placements & sponsorship opportunities", image: "/promos/advertisement-placement.jpg", url: "mailto:contact@everymovieplug.com?subject=Ad%20Placement%20Inquiry", cta: "Book Now!", end: "2027-12-31" },
      { type: "article",    story: "/articles/how-to-film-direct-and-produce-your-own-movie.html", end: "2026-12-13" },
      // { type: "news", story: "/news/your-article-file.html" },
    ],

    /* ---------- Homepage: "Trending Movies" row (indie movies) ---------- */
    homeMovies: [
      // { type: "indie", title: "Indie Movie", year: "2026", image: "/promos/indie-movie-poster.jpg", url: "https://example.com", sponsored: true },
    ],

    /* ---------- Homepage: "Trending TV Shows" row (indie TV shows) ---------- */
    homeTv: [
      // { type: "indie", title: "Indie Series", year: "2026", image: "/promos/indie-series-poster.jpg", url: "https://example.com", sponsored: true },
    ],

    /* ---------- /articles/ page: banner at the top ---------- */
    articlesBanner: [
      // { type: "article", story: "/articles/your-article-file.html" },
      // { type: "article", title: "Partner article", description: "Short pitch.", image: "/promos/partner.jpg", url: "https://example.com/post", sponsored: true },
    ],

    /* ---------- /news/ page: banner at the top ---------- */
    newsBanner: [
      // { type: "news", story: "/news/your-story-file.html" },
      // { type: "news", title: "Partner news", description: "Short pitch.", image: "/promos/partner.jpg", url: "https://example.com/press", sponsored: true },
    ]
  };

  /* ---------- Small label in the top-left corner of each banner ----------
     The normal label (always used for the TMDB slides). Edit the words, or use "" to hide it.
     A single promo can show different words by adding cornerLabel: "..." to that item. */
  var LABELS = {
    homeBanner:     "New & Popular",       // homepage banner
    articlesBanner: "Featured Articles",   // top of /articles/
    newsBanner:     "Featured Stories"     // top of /news/
  };

  /* Colour used for words wrapped in { } with no colour given, e.g. {Advertise} (the site's purple). */
  var HIGHLIGHT_COLOR = "#a855f7";

  /* Colour names you can use inside the braces, e.g. {gold|Advertise}. Add your own names if you like. */
  var COLORS = {
    purple: "#a855f7", gold: "#fbbf24", yellow: "#facc15", orange: "#fb923c", red: "#f87171",
    pink: "#f472b6", green: "#34d399", teal: "#2dd4bf", blue: "#60a5fa", white: "#ffffff"
  };

  /* =================================================================================================
     Nothing below this line needs editing.
     ================================================================================================= */

  var MAX = { homeBanner: 6, homeMovies: 5, homeTv: 5, articlesBanner: 4, newsBanner: 4 };
  var PREVIEW = /[?&]promo-preview(=1|=true|&|$)/.test(location.search);

  function svg(c1, c2, w, h, label, x, y) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/><text x="' + (x || "50%") + '" y="' + (y || "50%") + '" fill="rgba(255,255,255,.55)" font-family="Arial,sans-serif" font-size="' + Math.round(w / 14) + '" font-weight="700" text-anchor="middle" dominant-baseline="middle">' + label + '</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }
  var wide = function (a, b, t) { return svg(a, b, 1280, 720, t, "74%", "30%"); };
  var tall = function (a, b, t) { return svg(a, b, 400, 600, t); };

  /* sample items shown by ?promo-preview=1 */
  var DEMO = {
    homeBanner: [
      { type: "indie", label: "Indie Film", cornerLabel: "Partner Spotlight", title: "Sample: Your Indie Movie Here", description: "This is a preview of the homepage banner slot. Add a real promo in promos.js and it replaces this.", image: wide("#4c1d95", "#0f172a", "BANNER SLOT"), url: "#", cta: "Watch the trailer", sponsored: true },
      { type: "news", title: "Sample: A News Story Promo", description: "News stories can be pinned into the homepage banner too.", image: wide("#7c2d12", "#0f172a", "NEWS PROMO"), url: "#" },
      { type: "article", title: "Sample: An Article Promo", description: "Articles can be pinned into the homepage banner as well.", image: wide("#134e4a", "#0f172a", "ARTICLE PROMO"), url: "#" }
    ],
    homeMovies: [{ type: "indie", title: "Sample Indie Movie", year: "2026", image: tall("#6d28d9", "#0f172a", "INDIE MOVIE"), url: "#", sponsored: true }],
    homeTv: [{ type: "indie", title: "Sample Indie Series", year: "2026", image: tall("#1d4ed8", "#0f172a", "INDIE TV"), url: "#" }],
    articlesBanner: [{ type: "article", title: "Sample: Article Promo Slot", description: "This is a preview of the articles banner slot.", image: wide("#134e4a", "#0f172a", "ARTICLE PROMO"), url: "#" }],
    newsBanner: [{ type: "news", title: "Sample: News Promo Slot", description: "This is a preview of the news banner slot.", image: wide("#7c2d12", "#0f172a", "NEWS PROMO"), url: "#" }]
  };

  var TYPE_LABEL = { news: "News", article: "Article", indie: "Indie", movie: "Movie", tv: "TV Show" };
  var TYPE_CTA = { news: "Read the story", article: "Read the article", indie: "Learn more", movie: "View movie", tv: "View show" };

  /* is today inside the item's start/end window? (dates are YYYY-MM-DD, compared as whole days) */
  function live(it) {
    var today = new Date().toISOString().slice(0, 10);
    if (it.start && today < String(it.start).slice(0, 10)) return false;
    if (it.end && today > String(it.end).slice(0, 10)) return false;
    return true;
  }

  var indexCache = {};
  function loadIndex(dir) {
    if (!indexCache[dir]) {
      indexCache[dir] = fetch("/" + dir + "/search-index.json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { return d.items || []; })
        .catch(function () { return []; });
    }
    return indexCache[dir];
  }

  /* fill title / picture / summary / date for { story: "/news/file.html" } items */
  function fillStory(it) {
    var m = /^\/?(news|articles)\/([^?#]+\.html)/.exec(String(it.story || ""));
    if (!m) return Promise.resolve(it);
    return loadIndex(m[1]).then(function (items) {
      var hit = items.filter(function (x) { return x.f === m[2]; })[0], o = {}, k;
      for (k in it) o[k] = it[k];
      o.url = o.url || "/" + m[1] + "/" + m[2];
      if (!o.type) o.type = m[1] === "news" ? "news" : "article";
      if (hit) {
        o.title = o.title || hit.title;
        o.description = o.description || hit.excerpt;
        o.image = o.image || hit.img;
        o.date = o.date || hit.date;
        if (o.label === undefined) o.label = hit.tag;   /* label: "" means "no badge" */
      }
      return o;
    });
  }

  /* only normal links are allowed: web addresses, site paths, mailto: and tel: (anything else, like javascript:, is dropped) */
  function safeUrl(u) {
    u = String(u == null ? "" : u).trim();
    var m = /^([a-z][a-z0-9+.-]*):/i.exec(u);
    return (m && !/^(https?|mailto|tel)$/i.test(m[1])) ? "" : u;
  }

  /* a colour name from COLORS, or a #hex code; anything else is not a colour */
  function colorOf(c) {
    c = String(c || "").trim();
    if (COLORS.hasOwnProperty(c.toLowerCase())) return COLORS[c.toLowerCase()];
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : "";
  }

  var escHtml = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* "Reach {gold|movie fans} {Today}"  ->  { html: safe HTML with the coloured words, text: the same words with no markup } */
  function rich(raw) {
    raw = String(raw == null ? "" : raw);
    var html = "", text = "", last = 0, m, re = /\{([^{}]+)\}/g;
    while ((m = re.exec(raw))) {
      var pre = raw.slice(last, m.index), inner = m[1], color = HIGHLIGHT_COLOR, i = inner.indexOf("|");
      if (i > 0) { var c = colorOf(inner.slice(0, i)); if (c) { color = c; inner = inner.slice(i + 1); } }
      html += escHtml(pre) + '<span style="color:' + color + '">' + escHtml(inner) + '</span>';
      text += pre + inner;
      last = re.lastIndex;
    }
    var rest = raw.slice(last);
    return { html: html + escHtml(rest), text: (text + rest).replace(/[{}]/g, "") };
  }

  function clean(it) {
    var o = {}, k;
    for (k in it) o[k] = it[k];
    var rt = rich(o.title), rd = rich(o.description);
    o.titleHtml = rt.html;  o.title = rt.text;                               /* html = what the banner shows (coloured words); text = plain, for labels / alt text */
    o.descriptionHtml = rd.html;  o.description = rd.text;
    o.url = safeUrl(o.url);
    o.type = TYPE_LABEL[o.type] ? o.type : "indie";
    o.mail = /^(mailto|tel):/i.test(o.url);
    o.cta = o.cta || (o.mail ? "Contact us" : TYPE_CTA[o.type]);
    o.badge = (o.label !== undefined && o.label !== null) ? String(o.label) : TYPE_LABEL[o.type];   /* label: "" = no badge */
    o.external = /^https?:\/\//i.test(o.url || "") && o.url.indexOf(location.origin) !== 0;
    return o;
  }

  /* resolve(slot) -> Promise of the items that should be on screen right now (never rejects) */
  function resolve(slot) {
    var list = (PREVIEW ? DEMO[slot] : PROMOS[slot]) || [];
    list = list.filter(function (it) { return it && live(it); }).slice(0, MAX[slot] || 5);
    if (!list.length) return Promise.resolve([]);
    return Promise.all(list.map(fillStory)).then(function (all) {
      return all.map(clean).filter(function (it) { return it.title && it.url; });   /* clean() first: it empties unsafe links, which then drop out */
    }).catch(function () { return []; });
  }

  /* put the right link attributes on an <a> element */
  function linkAttrs(a, it) {
    a.href = it.url;
    var rel = [];
    if (it.sponsored && !it.mail) rel.push("sponsored");
    if ((it.external || it.newTab) && !it.mail) { a.target = "_blank"; rel.push("noopener", "noreferrer"); }
    if (rel.length) a.rel = rel.join(" ");
  }

  /* the same thing as an HTML attribute string, for pages that build cards with template strings */
  function attrString(it) {
    var q = function (v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
    var out = 'href="' + q(it.url) + '"', rel = [];
    if (it.sponsored && !it.mail) rel.push("sponsored");
    if ((it.external || it.newTab) && !it.mail) { out += ' target="_blank"'; rel.push("noopener", "noreferrer"); }
    return rel.length ? out + ' rel="' + rel.join(" ") + '"' : out;
  }

  /* put the LABELS text for a banner into its label element (keeps the little glowing dot); "" hides the label */
  function applyLabel(slot, el, override) {
    if (!el) return;
    var t = (override !== undefined && override !== null) ? String(override) : LABELS[slot];   /* a slide's own cornerLabel wins over LABELS */
    if (typeof t !== "string") return;
    t = t.trim();
    if (!t) { el.hidden = true; el.style.display = "none"; return; }
    el.hidden = false; el.style.display = "";
    var dot = el.querySelector("i");
    el.textContent = "";
    if (dot) el.appendChild(dot);
    el.appendChild(document.createTextNode(" " + t));
  }

  window.EMP_PROMOS = { resolve: resolve, linkAttrs: linkAttrs, attrString: attrString, applyLabel: applyLabel, preview: PREVIEW };
})();
