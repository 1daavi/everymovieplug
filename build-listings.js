#!/usr/bin/env node
/**
 * Every Movie Plug - paginated News and Articles listing pages
 *
 * Builds, for each section, 15 stories per page:
 *   /news/            (page 1)      /news/page/2/ ... /news/page/N/
 *   /articles/        (page 1)      /articles/page/2/ ... /articles/page/N/
 * and keeps <section>/search-index.json (the list of every story, used by the site search and as this
 * script's own memory of each story's title, thumbnail, tag, excerpt and date).
 *
 * New story? Just add its .html file to /news or /articles and run:   node build-listings.js
 * (the GitHub workflows do this for you). Stories are sorted newest first by their date.
 *
 * Options:  --only=news | --only=articles     build one section
 *           --refresh                         re-read title/excerpt/thumbnail/tag from every story page
 */
const fs = require("fs");
const path = require("path");
const { footerHTML, siteNavHTML } = require("./lib/site-nav");

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")));
const PER_PAGE = 16;
const SITE = "https://everymovieplug.com";
const ASSETS = "articleassets";
const SELF = /^https?:\/\/(www\.)?everymovieplug\.com\//i;
const ROOT = process.cwd();

/* ---------- helpers ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const decode = s => (s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = s => decode((s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const plain = s => String(s || "").replace(/\*+/g, "");                     // "*Star Wars*" -> "Star Wars"
const fmtDate = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const read = f => fs.readFileSync(f, "utf8");
const list = (arr) => arr.length < 3 ? arr.join(" and ") : arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];

function meta(html, keys) {
  for (const key of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*?content=(?:"([^"]*)"|'([^']*)')`, "i");
    const re2 = new RegExp(`<meta[^>]+content=(?:"([^"]*)"|'([^']*)')[^>]*?(?:property|name)=["']${key}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    const v = m && (m[1] ?? m[2]);
    if (v && v.trim()) return decode(v.trim());
  }
  return "";
}

/* ---------- reading a story page ---------- */
function wordCount(html) {
  let h = html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, "");
  const m = h.match(/<article[\s\S]*?<\/article>/i) || h.match(/<main[\s\S]*?<\/main>/i);
  return clean(m ? m[0] : h).split(" ").filter(Boolean).length;
}
function storyTitle(html) {
  let t = meta(html, ["og:title", "twitter:title"]);
  if (!t) { const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (m) t = clean(m[1]); }
  if (!t) { const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); if (m) t = clean(m[1]); }
  return t.replace(/\s*[|\-–—]\s*Every Movie Plug\s*$/i, "").trim();
}
function storyExcerpt(html, preferMeta) {
  let e = preferMeta ? meta(html, ["description", "og:description"]) : "";
  if (!e) { const s = html.match(/<p[^>]*class=["'][^"']*article-subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i); if (s) e = clean(s[1]); }
  if (!e) e = meta(html, ["description", "og:description", "twitter:description"]);
  if (!e) {
    const body = html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, "");
    for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) { const t = clean(m[1]); if (t.length > 60) { e = t; break; } }
  }
  return e.length > 200 ? e.slice(0, 197).replace(/\s+\S*$/, "") + "…" : e;
}
function storyImage(html, file) {
  const cands = [meta(html, ["og:image"]), meta(html, ["twitter:image"])];
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) cands.push(decode(m[1]));
  const found = cands.filter(Boolean).map(c => c.replace(SELF, "/"));
  if (!found.length) return "";
  const exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
  for (const src of found) {
    if (src.startsWith("data:") || /^(https?:)?\/\//i.test(src)) continue;
    let c = src.split(/[?#]/)[0]; try { c = decodeURIComponent(c); } catch (e) {}
    const hit = [c.startsWith("/") ? path.join(ROOT, c) : path.resolve(path.dirname(file), c), path.join(ROOT, ASSETS, path.basename(c))].find(exists);
    if (hit) return "/" + path.relative(ROOT, hit).split(path.sep).join("/");
  }
  const first = found[0];
  if (/^(https?:)?\/\//i.test(first) || first.startsWith("data:")) return first;
  return `/${ASSETS}/${decodeURIComponent(first.split(/[?#]/)[0].split("/").pop())}`;
}
function storyDate(html, file) {
  let d = meta(html, ["article:published_time", "datePublished", "date", "publish_date", "og:updated_time"]);
  if (!d) { const m = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (m) d = m[1]; }
  if (!d) { const m = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (m) d = m[1]; }
  let date = d ? new Date(d) : null;
  if (!date || isNaN(date)) {
    const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ");
    const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/);
    if (m) date = new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1]), +m[2]));
  }
  if (!date || isNaN(date)) date = fs.statSync(file).mtime;
  return date.toISOString().slice(0, 10);
}
function guessTag(html, title, excerpt, fallback) {
  const m = meta(html, ["category", "article:section"]);
  if (m) return m;
  if (fallback) return fallback;
  const t = (title + " " + excerpt).toLowerCase();
  if (/renew|casting/.test(t)) return "TV";
  if (/box office|opening weekend|opens with|debuts at|grossed|domestic|million/.test(t)) return "Box Office";
  if (/stream|peacock|netflix|disney\+|hulu|max\b|prime video|apple tv|what to watch/.test(t)) return "Streaming";
  if (/season|series|tv\b/.test(t)) return "TV";
  return "News";
}

/* ---------- sections ---------- */
const SECTIONS = {
  news: {
    dir: "news", crumb: "News", label: "News", one: "story", many: "stories", more: "Read story", active: "news",
    h1: "Movie and TV News", subtitle: "Box office, streaming, renewals and casting, updated regularly.",
    desc: "The latest movie and TV news from Every Movie Plug: box office, streaming, renewals and casting.",
    title: "Movie and TV News", preferMeta: true, tagFallback: "",
  },
  articles: {
    dir: "articles", crumb: "Articles", label: "Articles", one: "article", many: "articles", more: "Read article", active: "articles",
    h1: "Movie and TV Articles", subtitle: "Insights, movie breakdowns and features.",
    desc: "Insights, movie breakdowns and features from Every Movie Plug.",
    title: "Latest Articles", preferMeta: false, tagFallback: "Article",
  },
};

/* ---------- the manifest (search-index.json) ---------- */
function seedFromListing(sec) {
  const f = path.join(sec.dir, "index.html");
  if (!fs.existsSync(f)) return [];
  const html = read(f), out = [];
  for (const m of html.matchAll(/<a class="tile" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const b = m[2], g = (re) => (b.match(re) || [])[1];
    let file; try { file = decodeURIComponent(path.basename(m[1])); } catch (e) { file = path.basename(m[1]); }
    out.push({
      f: file, title: clean(g(/<h2 class="tile-title">([\s\S]*?)<\/h2>/)), excerpt: clean(g(/<p class="tile-excerpt">([\s\S]*?)<\/p>/)),
      date: g(/datetime="([^"]+)"/), tag: clean(g(/class="tile-tag">([^<]*)</)), img: decode(g(/<img src="([^"]*)"/) || ""),
    });
  }
  return out;
}

function loadItems(sec) {
  const manifestFile = path.join(sec.dir, "search-index.json");
  let old = [];
  if (fs.existsSync(manifestFile)) { try { old = JSON.parse(read(manifestFile)).items || []; } catch (e) { console.warn("search-index.json unreadable, rebuilding"); } }
  if (!old.length) old = seedFromListing(sec);
  const byFile = new Map(old.map((it, i) => [it.f.toLowerCase(), { ...it, _pos: i }]));

  const files = fs.readdirSync(sec.dir).filter(f => f.toLowerCase().endsWith(".html") && f.toLowerCase() !== "index.html");
  const items = [];
  let added = 0;
  for (const f of files) {
    const file = path.join(sec.dir, f), html = read(file), prev = byFile.get(f.toLowerCase());
    let it;
    if (prev && !args.refresh) it = { ...prev, f };
    else {
      const title = storyTitle(html) || f.replace(/\.html$/, "").replace(/-/g, " ");
      const excerpt = storyExcerpt(html, sec.preferMeta);
      it = { f, title, excerpt, date: storyDate(html, file), tag: guessTag(html, title, excerpt, sec.tagFallback), img: storyImage(html, file), _pos: prev ? prev._pos : -1 };
      if (!prev) { added++; console.log(`[${sec.dir}] New: ${title}`); }
    }
    // the date printed on the story page is the authority; fixes stale or malformed dates in old tiles
    const shown = (html.match(/class="article-date">\s*([^<]+?)\s*</) || [])[1];
    const shownIso = shown && !isNaN(new Date(shown + " UTC")) ? new Date(shown + " UTC").toISOString().slice(0, 10) : "";
    if (shownIso && shownIso !== it.date) { console.log(`[${sec.dir}] Date fixed for ${f}: ${it.date} -> ${shownIso}`); it.date = shownIso; }
    it.words = wordCount(html);
    items.push(it);
  }
  const gone = old.filter(o => !files.some(f => f.toLowerCase() === o.f.toLowerCase()));
  gone.forEach(g => console.log(`[${sec.dir}] Removed (file gone): ${g.f}`));
  // newest first; same day: brand-new stories on top, then the order they already had
  items.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (a._pos === -1 ? -1 : b._pos === -1 ? 1 : a._pos - b._pos)));
  items.forEach(i => delete i._pos);
  return items;
}

/* ---------- pieces of markup ---------- */
const tile = (it, sec, i) => `            <a class="tile" href="/${sec.dir}/${encodeURI(it.f)}" style="--i:${i}">
                <div class="tile-thumb">
                    ${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
                    <span class="tile-tag">${esc(it.tag)}</span>
                </div>
                <div class="tile-body">
                    <time class="tile-date" datetime="${it.date}">${fmtDate(it.date)}</time>
                    <h2 class="tile-title">${esc(plain(it.title))}</h2>
                    <p class="tile-excerpt">${esc(plain(it.excerpt))}</p>
                    <span class="tile-more">${sec.more} ${ARROW}</span>
                </div>
            </a>`;

const pageUrl = (sec, n) => n === 1 ? `/${sec.dir}/` : `/${sec.dir}/page/${n}/`;

function pageWindow(cur, total) {
  const s = new Set([1, total, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach(n => s.add(n));
  if (cur >= total - 2) [total - 1, total - 2, total - 3].forEach(n => s.add(n));
  const nums = [...s].filter(n => n >= 1 && n <= total).sort((a, b) => a - b), out = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push("gap"); out.push(n); });
  return out;
}
function pagerHTML(sec, cur, total, from, to, count) {
  if (total <= 1) return "";
  const prevSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const prev = cur > 1 ? `<a class="pg pg-step" href="${pageUrl(sec, cur - 1)}" rel="prev">${prevSvg}<span>Previous</span></a>` : `<span class="pg pg-step off" aria-disabled="true">${prevSvg}<span>Previous</span></span>`;
  const next = cur < total ? `<a class="pg pg-step" href="${pageUrl(sec, cur + 1)}" rel="next"><span>Next</span>${ARROW}</a>` : `<span class="pg pg-step off" aria-disabled="true"><span>Next</span>${ARROW}</span>`;
  const nums = pageWindow(cur, total).map(n => n === "gap" ? '<li class="gap" aria-hidden="true">&hellip;</li>'
    : n === cur ? `<li><span class="pg cur" aria-current="page" aria-label="Page ${n}, current page">${n}</span></li>`
    : `<li><a class="pg" href="${pageUrl(sec, n)}" aria-label="Page ${n}">${n}</a></li>`).join("");
  return `<nav class="pager" id="pager" data-paged aria-label="${sec.label} pages">
            ${prev}
            <span class="pg-count">Page ${cur} of ${total}</span>
            <ol class="pg-list">${nums}</ol>
            ${next}
        </nav>
        <p class="pg-status" data-paged>Page ${cur} of ${total} &middot; ${sec.many} ${from}&ndash;${to} of ${count}</p>`;
}

/* ---------- original text for each page ---------- */
const byTag = items => { const m = new Map(); items.forEach(i => { if (!m.has(i.tag)) m.set(i.tag, []); m.get(i.tag).push(i); }); return m; };
const link = (sec, it) => `<a href="/${sec.dir}/${encodeURI(it.f)}">${esc(plain(it.title))}</a>`;

function newsAbout(sec, ctx) {
  return `<section class="seo-text" aria-labelledby="about-heading">
            <h2 id="about-heading">About Every Movie Plug News</h2>
            <p>Every Movie Plug News is where we report on what is happening in film and television: weekend box office results, release-date changes, streaming premieres, casting announcements, renewals and cancellations, trailers, and the business moves behind the projects people are waiting for. Each story starts with the facts &mdash; what happened, who is involved and when you can watch it &mdash; and then adds the context that explains why it matters. This archive currently holds ${ctx.count} stories across ${ctx.pages} pages, with the newest first.</p>

            <h3>What we cover</h3>
            <ul>
                <li><strong>Box office.</strong> Opening weekends, second-weekend drops, running domestic totals and how a result compares with the studio&rsquo;s expectations.</li>
                <li><strong>Streaming and TV.</strong> Premiere dates, season renewals, episode schedules, finales and what is arriving on the major services.</li>
                <li><strong>Casting and development.</strong> Who has joined a project, which films and series are moving into production, and which have been delayed or paused.</li>
                <li><strong>Franchises, games and comics.</strong> Adaptations of video games and comics, sequels, spin-offs and the shared universes that connect them.</li>
                <li><strong>Industry and awards.</strong> Studio mergers, festival and awards-season news, and the people and companies shaping what reaches screens.</li>
            </ul>

            <h3>How we report</h3>
            <p>News stories name the outlets they draw on and list them at the bottom of the page, so you can read the original reporting for yourself. When reports conflict, we say so instead of picking a side. When a story develops, we update the original page with the latest facts and mark it &ldquo;Updated&rdquo; rather than publishing near-duplicates. If you spot a mistake, email <a href="mailto:contact@everymovieplug.com">contact@everymovieplug.com</a> and we will review it and fix it. We are not paid to feature a title. Analysis and opinion live in our <a href="/articles/">Articles</a> section, and our full <a href="/about.html">editorial standards</a> are on the About page.</p>

            <h3>How to use this page</h3>
            <p>Stories are shown ${PER_PAGE} to a page, newest first. Use the numbered links under the stories to move back through older coverage, or type a name, title or topic into the search box at the top to search every story on the site at once &mdash; not only the page you are on. Each tile shows its category and publication date, so you can tell at a glance whether it is a box office report, a streaming update or a casting scoop.</p>

            <h3>Frequently asked questions</h3>
            <h4>Where can I find older news?</h4>
            <p>Use the page numbers beneath the stories. Every story we have published stays available in this archive, and the search box looks through all of them.</p>
            <h4>What is the difference between News and Articles?</h4>
            <p>News reports what has just happened. <a href="/articles/">Articles</a> are longer pieces &mdash; timelines, explainers, craft breakdowns and film history &mdash; that are written to stay useful for longer.</p>
            <h4>Where do you get your movie and TV information?</h4>
            <p>Stories cite their sources. Film and TV data elsewhere on the site, such as cast lists and ratings, comes from TMDB, and streaming availability comes from JustWatch.</p>
            <h4>How do I report an error or suggest a story?</h4>
            <p>Email <a href="mailto:contact@everymovieplug.com">contact@everymovieplug.com</a> with a link to the story and what you think should change.</p>
        </section>`;
}

function articlesAbout(sec, ctx) {
  return `<section class="seo-text" aria-labelledby="about-heading">
            <h2 id="about-heading">About Every Movie Plug Articles</h2>
            <p>Articles are the longer work on Every Movie Plug: the pieces that do not fit in a headline. We write timelines that put a complicated film or franchise in order, explainers that unpack an ending or a twist, breakdowns of how directors and crews achieved a particular effect, and analysis of what box office numbers and industry decisions mean. This archive currently holds ${ctx.count} articles across ${ctx.pages} pages, with the newest first.</p>

            <h3>What you will find here</h3>
            <ul>
                <li><strong>Timelines and explainers.</strong> Chronologies for sprawling franchises and plain-English explanations of films with tangled plots.</li>
                <li><strong>Craft and production.</strong> Sound design, set building, camerawork and the practical problems behind famous scenes.</li>
                <li><strong>Industry and box office analysis.</strong> Why a studio strategy worked or failed, and how the biggest films compare.</li>
                <li><strong>Film history and legacy.</strong> How landmark films and series changed what came after them.</li>
                <li><strong>Previews and lists.</strong> The releases worth watching next and rankings built around a clear question.</li>
            </ul>

            <h3>How we write articles</h3>
            <p>Each article carries a named author and a publication date. We explain our reasoning and show the facts it rests on, and we keep opinion clearly separate from reporting: breaking news belongs in <a href="/news/">News</a>, while articles give you analysis and context. When facts change, we update the article instead of leaving it out of date. Mistakes can be reported to <a href="mailto:contact@everymovieplug.com">contact@everymovieplug.com</a>. Read more on our <a href="/about.html">About page</a>.</p>

            <h3>How to use this page</h3>
            <p>Articles are shown ${PER_PAGE} to a page, newest first. Use the numbered links beneath the articles to browse older pieces, or use the search box to search every article at once. The digest below the list tells you roughly how long each article on the page takes to read.</p>

            <h3>Frequently asked questions</h3>
            <h4>How often do you publish new articles?</h4>
            <p>New articles are added to page 1 as they are published. Older ones move back one place at a time and stay in the archive.</p>
            <h4>Are the articles spoiler-free?</h4>
            <p>Not always. Breakdowns and endings explained discuss plot details, so check the headline and opening paragraph before you read a film you have not yet seen.</p>
            <h4>Can I suggest a topic?</h4>
            <p>Yes. Email <a href="mailto:contact@everymovieplug.com">contact@everymovieplug.com</a> with the film, series or question you would like us to cover.</p>
        </section>`;
}

function digest(sec, ctx) {
  const { page, pages, items, count, from, to } = ctx;
  const d1 = fmtDate(items[items.length - 1].date), d2 = fmtDate(items[0].date);
  const range = d1 === d2 ? `on ${d1}` : `between ${d1} and ${d2}`;
  let body = "";
  if (sec.dir === "news") {
    const groups = [...byTag(items)].sort((a, b) => b[1].length - a[1].length);
    body = `<p>This page collects ${items.length} ${sec.many} published ${range}. Their topics: ${list(groups.map(([t, a]) => `${a.length} in ${esc(t)}`))}.</p>
            <ul>
${groups.map(([t, a]) => `                <li><strong>${esc(t)}</strong> &mdash; ${a.map(i => link(sec, i)).join("; ")}</li>`).join("\n")}
            </ul>`;
  } else {
    const mins = i => Math.max(1, Math.round(i.words / 220));
    const total = items.reduce((s, i) => s + mins(i), 0);
    const quick = items.filter(i => mins(i) < 6), long = items.filter(i => mins(i) >= 6);
    body = `<p>This page collects ${items.length} ${sec.many} published ${range}, about ${total} minutes of reading in all.</p>
            <ul>
${long.length ? `                <li><strong>Longer reads (6 minutes or more)</strong> &mdash; ${long.map(i => `${link(sec, i)} (${mins(i)} min)`).join("; ")}</li>\n` : ""}${quick.length ? `                <li><strong>Quick reads (under 6 minutes)</strong> &mdash; ${quick.map(i => `${link(sec, i)} (${mins(i)} min)`).join("; ")}</li>\n` : ""}            </ul>`;
  }
  const nav = [];
  if (page > 1) nav.push(`<a href="${pageUrl(sec, page - 1)}">${page === 2 ? "newer " + sec.many + " on page 1" : "newer " + sec.many + " on page " + (page - 1)}</a>`);
  if (page < pages) nav.push(`<a href="${pageUrl(sec, page + 1)}">older ${sec.many} on page ${page + 1}</a>`);
  return `<section class="seo-text" aria-labelledby="digest-heading">
            <h2 id="digest-heading">Page Contents</h2>
            ${body}
            <p>This is page ${page} of ${pages} (${sec.many} ${from}&ndash;${to} of ${count}). ${nav.length ? "Keep reading: " + nav.join(" or ") + "." : ""} All ${sec.many} follow the standards described on our <a href="/about.html">About page</a>${page > 1 ? `, and the <a href="/${sec.dir}/">first page</a> explains how this section works` : ""}.</p>
        </section>`;
}

/* ---------- search (reads <section>/search-index.json, falls back to the tiles on the page) ---------- */
const searchScript = sec => `<script>
    (function () {
        var DIR = "${sec.dir}", ONE = "${sec.one}", MANY = "${sec.many}", MORE = "${sec.more}", LIMIT = 60;
        var q = document.getElementById("q"), box = document.getElementById("search"), clearBtn = document.getElementById("clear");
        var count = document.getElementById("count"), empty = document.getElementById("empty"), results = document.getElementById("results");
        var data = null, loading = null, timer, seq = 0;
        var ARROW = '${ARROW}';

        function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
        function fmt(iso) { var d = new Date(iso + "T00:00:00Z"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); }
        function tileHTML(it, i) {
            return '<a class="tile" href="/' + DIR + '/' + encodeURI(it.f) + '" style="--i:' + Math.min(i, 14) + '">' +
                '<div class="tile-thumb">' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") + '<span class="tile-tag">' + esc(it.tag) + '</span></div>' +
                '<div class="tile-body"><time class="tile-date" datetime="' + esc(it.date) + '">' + esc(fmt(it.date)) + '</time>' +
                '<h2 class="tile-title">' + esc(String(it.title).replace(/\\*+/g, "")) + '</h2><p class="tile-excerpt">' + esc(String(it.excerpt).replace(/\\*+/g, "")) + '</p>' +
                '<span class="tile-more">' + MORE + ' ' + ARROW + '</span></div></a>';
        }
        /* every story on the site, or - if the file cannot be fetched - at least the tiles on this page */
        function load() {
            if (data) return Promise.resolve(data);
            if (!loading) loading = fetch("/" + DIR + "/search-index.json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
                .then(function (j) { data = j.items || []; return data; })
                .catch(function () {
                    data = [].slice.call(document.querySelectorAll("#tiles .tile")).map(function (t) {
                        var im = t.querySelector(".tile-thumb img"), g = function (s) { var e = t.querySelector(s); return e ? e.textContent.trim() : ""; };
                        return { f: decodeURIComponent(t.getAttribute("href").split("/").pop()), title: g(".tile-title"), excerpt: g(".tile-excerpt"), tag: g(".tile-tag"), date: (t.querySelector("time") || {}).dateTime || "", img: im ? im.getAttribute("src") : "" };
                    });
                    return data;
                });
            return loading;
        }
        function filter() {
            var raw = q.value, terms = raw.toLowerCase().split(/\\s+/).filter(Boolean), my = ++seq;
            box.classList.toggle("has-text", raw.length > 0);
            if (!terms.length) {
                document.body.classList.remove("searching"); results.innerHTML = ""; empty.classList.remove("show"); count.textContent = ""; return;
            }
            load().then(function (items) {
                if (my !== seq) return;
                var hits = items.filter(function (it) { var s = (it.title + " " + it.excerpt + " " + it.tag).toLowerCase(); return terms.every(function (w) { return s.indexOf(w) > -1; }); });
                document.body.classList.add("searching");
                results.innerHTML = hits.slice(0, LIMIT).map(tileHTML).join("");
                empty.classList.toggle("show", hits.length === 0);
                count.textContent = hits.length + " " + (hits.length === 1 ? ONE : MANY) + " found" + (hits.length > LIMIT ? " (showing the newest " + LIMIT + " - add a word to narrow it down)" : "");
            });
        }
        q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(filter, 100); });
        q.addEventListener("focus", function () { load(); }, { once: true });
        clearBtn.addEventListener("click", function () { q.value = ""; filter(); q.focus(); });
        q.addEventListener("keydown", function (e) { if (e.key === "Escape") { q.value = ""; filter(); } });
        document.addEventListener("keydown", function (e) {
            if (e.key === "/" && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
        });

        /* click: ripple from the tap point, then fade into the page (works for page tiles and search results) */
        document.addEventListener("click", function (e) {
            var t = e.target.closest && e.target.closest("a.tile");
            if (!t || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            var r = t.getBoundingClientRect(), d = document.createElement("span");
            d.className = "ripple";
            d.style.left = (e.clientX ? e.clientX - r.left : r.width / 2) + "px";
            d.style.top = (e.clientY ? e.clientY - r.top : r.height / 2) + "px";
            t.appendChild(d); t.classList.add("go"); document.body.classList.add("leaving");
            var href = t.href;
            setTimeout(function () { location.href = href; }, 280);
        });
        /* coming back with the browser Back button: undo the exit animation */
        window.addEventListener("pageshow", function (e) {
            if (e.persisted) {
                document.body.classList.remove("leaving");
                [].forEach.call(document.querySelectorAll(".tile"), function (t) { t.classList.remove("go"); var rp = t.querySelector(".ripple"); if (rp) rp.remove(); });
            }
        });
    })();
    </script>`;

const EXTRA_CSS = `
        /* ===== Site navigation, pagination and page text (added by build-listings.js) ===== */
        .sitenav { display: flex; flex-wrap: wrap; gap: 8px; max-width: none; margin: 0 0 28px; }
        .sitenav a { display: inline-flex; align-items: center; color: #c4b5fd; text-decoration: none; font-size: .8rem; font-weight: 600; padding: .45rem .9rem; border-radius: 9999px; border: 1px solid rgba(168,85,247,.35); background: rgba(168,85,247,.1); white-space: nowrap; transition: transform .3s cubic-bezier(.16,1,.3,1), background .3s; }
        .sitenav a:hover, .sitenav a:focus-visible { background: rgba(168,85,247,.22); color: #fff; }
        .sitenav a:active { transform: scale(.96); }
        .sitenav a[aria-current="page"] { background: var(--accent); border-color: var(--accent); color: #fff; }
        .page-lead { color: var(--muted); font-size: .95rem; margin: -14px 0 22px; max-width: 760px; }

        #results { display: none; }
        body.searching #results { display: grid; }
        body.searching [data-paged], body.searching .seo-text, body.searching #tiles, body.searching .page-lead { display: none; }

        .pager { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; max-width: none; margin: 44px 0 10px; }
        .pg-list { display: flex; align-items: center; gap: 6px; list-style: none; margin: 0; padding: 0; }
        .pg-list .gap { color: var(--muted); padding: 0 4px; }
        .pg { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 42px; height: 42px; padding: 0 14px; border-radius: 9999px; border: 1px solid var(--edge); background: var(--card); color: var(--heading); font-size: .9rem; font-weight: 600; text-decoration: none; transition: background .25s ease, border-color .25s ease, transform .25s ease, box-shadow .25s ease; }
        .pg svg { width: 16px; height: 16px; flex: none; }
        a.pg:hover, a.pg:focus-visible { background: rgba(168,85,247,.2); border-color: var(--accent-soft); box-shadow: 0 0 22px rgba(168,85,247,.25); transform: translateY(-2px); outline: none; }
        a.pg:active { transform: scale(.95); }
        .pg.cur { background: var(--accent); border-color: var(--accent); color: #fff; box-shadow: 0 6px 20px rgba(168,85,247,.4); }
        .pg.off { opacity: .35; cursor: not-allowed; }
        .pg-count { display: none; color: var(--muted); font-size: .9rem; font-weight: 600; }
        .pg-status { text-align: center; color: var(--muted); font-size: .82rem; margin-bottom: 8px; }
        @media (max-width: 640px) { .pg-list { display: none; } .pg-count { display: inline; } .pager { gap: 14px; } }

        .seo-text { max-width: 820px; margin: 56px auto 0; padding: 32px 0 0; border-top: 1px solid var(--edge); color: var(--text); line-height: 1.75; }
        .seo-text h2 { font-size: 1.5rem; line-height: 1.3; color: var(--heading); margin-bottom: 14px; }
        .seo-text h3 { font-size: 1.12rem; color: var(--heading); margin: 28px 0 8px; }
        .seo-text h4 { font-size: 1rem; color: var(--heading); margin: 18px 0 4px; }
        .seo-text p, .seo-text li { font-size: .97rem; color: var(--text); }
        .seo-text p { margin-bottom: 12px; }
        .seo-text ul { margin: 6px 0 14px 1.25rem; }
        .seo-text li { margin-bottom: 8px; }
        .seo-text a { color: #c4b5fd; text-decoration: underline; text-underline-offset: 3px; }
        .seo-text a:hover { color: #fff; }
`;

/* ---------- build one section ---------- */
function build(sec) {
  if (!fs.existsSync(sec.dir)) { console.error(`Can't find folder ${sec.dir}/`); return 1; }
  const tpl = read(path.join("templates", `${sec.dir}-listing.html`));
  const heroHTML = read(path.join("templates", `${sec.dir}-hero.html`)).trim();
  const heroJS = read(path.join("templates", `${sec.dir}-hero.js.html`)).trim();

  const items = loadItems(sec), count = items.length, pages = Math.max(1, Math.ceil(count / PER_PAGE));
  if (!count) { console.error(`No stories found in ${sec.dir}/`); return 1; }

  fs.writeFileSync(path.join(sec.dir, "search-index.json"),
    JSON.stringify({ generated: "build-listings.js - do not edit by hand", perPage: PER_PAGE, items: items.map(({ words, ...r }) => ({ ...r, words })) }, null, 1) + "\n");

  const schemaBlock = graph => graph.map((g, n) => `<script type="application/ld+json" id="emp-schema-${n}">\n${JSON.stringify({ "@context": "https://schema.org", ...g }, null, 2).replace(/</g, "\\u003c")}\n    </script>`).join("\n    ");

  // clear page folders that no longer exist
  const pageRoot = path.join(sec.dir, "page");
  if (fs.existsSync(pageRoot)) for (const d of fs.readdirSync(pageRoot)) if (/^\d+$/.test(d) && +d > pages) fs.rmSync(path.join(pageRoot, d), { recursive: true, force: true });

  for (let page = 1; page <= pages; page++) {
    const start = (page - 1) * PER_PAGE, slice = items.slice(start, start + PER_PAGE), from = start + 1, to = start + slice.length;
    const url = SITE + pageUrl(sec, page);
    const d1 = fmtDate(slice[slice.length - 1].date), d2 = fmtDate(slice[0].date);
    const title = page === 1 ? `${sec.title} | Every Movie Plug` : `${sec.title} - Page ${page} | Every Movie Plug`;
    const desc = page === 1 ? sec.desc : `Page ${page} of ${pages} of Every Movie Plug ${sec.label.toLowerCase()}, published ${d1 === d2 ? "on " + d1 : "between " + d1 + " and " + d2}, including ${plain(slice[0].title)}.`;
    const ctx = { page, pages, items: slice, count, from, to };

    const prevNext = [page > 1 ? `<link rel="prev" href="${SITE + pageUrl(sec, page - 1)}">` : "", page < pages ? `<link rel="next" href="${SITE + pageUrl(sec, page + 1)}">` : ""].filter(Boolean).join("\n    ");
    const graph = [{
      "@type": "CollectionPage", "@id": `${url}#page`, url, name: title, description: desc,
      isPartOf: { "@id": `${SITE}/#website` }, inLanguage: "en",
      mainEntity: { "@type": "ItemList", itemListElement: slice.map((it, i) => ({ "@type": "ListItem", position: start + i + 1, url: `${SITE}/${sec.dir}/${encodeURI(it.f)}` })) },
    }, {
      "@type": "BreadcrumbList", itemListElement: [["Home", `${SITE}/`], [sec.crumb, `${SITE}/${sec.dir}/`], ...(page > 1 ? [[`Page ${page}`, url]] : [])]
        .map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
    }];

    const lead = page === 1
      ? `Newest ${sec.many} first. Search the box above to look through every ${sec.one} on the site, or use the page numbers below to move back through older coverage.`
      : `Page ${page} of ${pages} &middot; ${sec.many} published ${d1 === d2 ? "on " + d1 : "between " + d1 + " and " + d2}.`;

    const tiles = `<div class="tiles" id="tiles">\n${slice.map((it, i) => tile(it, sec, i)).join("\n")}\n        </div>\n        <div class="tiles" id="results" aria-live="polite"></div>\n        `;
    const text = (page === 1 ? (sec.dir === "news" ? newsAbout : articlesAbout)(sec, ctx) : "") + (page === 1 ? "\n        " : "") + digest(sec, ctx);

    let html = tpl
      .replace(/\{\{TITLE\}\}/g, () => esc(title)).replace(/\{\{DESC\}\}/g, () => esc(desc)).replace(/\{\{CANON\}\}/g, () => url)
      .replace("{{PREVNEXT}}", () => prevNext).replace("{{SCHEMA}}", () => schemaBlock(graph))
      .replace("{{SITENAV}}", () => siteNavHTML(sec.active)).replace("{{HERO}}", () => page === 1 ? heroHTML : "")
      .replace("{{H1}}", () => esc(sec.h1))
      .replace("{{SUBTITLE}}", () => sec.subtitle)
      .replace("{{LIST}}", () => tiles)
      .replace("{{PAGER}}", () => pagerHTML(sec, page, pages, from, to, count))
      .replace("{{TEXT}}", () => text)
      .replace("{{FOOTER}}", () => footerHTML())
      .replace("{{SEARCH_SCRIPT}}", () => searchScript(sec))
      .replace("{{HERO_SCRIPT}}", () => page === 1 ? heroJS : "")
      .replace("</style>", () => EXTRA_CSS + "    </style>");
    // the lead line and the result counter sit right under the page header
    html = html.replace('<p class="result-count" id="count" aria-live="polite"></p>', () => `<p class="page-lead">${lead}</p>\n    <p class="result-count" id="count" aria-live="polite"></p>`);
    html = html.replace('<strong>No stories found</strong>Try a different title, show or keyword.', () => `<strong>No ${sec.many} found</strong>Try a different title, show or keyword.`);

    const out = page === 1 ? path.join(sec.dir, "index.html") : path.join(sec.dir, "page", String(page), "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }
  console.log(`[${sec.dir}] ${count} ${sec.many} -> ${pages} page(s) of up to ${PER_PAGE}`);
  return 0;
}

const only = args.only, targets = only ? [only] : Object.keys(SECTIONS);
if (targets.some(t => !SECTIONS[t])) { console.error("--only must be news or articles"); process.exit(1); }
let failed = 0;
targets.forEach(t => { failed += build(SECTIONS[t]); });
process.exit(failed ? 1 : 0);
