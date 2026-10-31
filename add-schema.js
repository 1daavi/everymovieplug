#!/usr/bin/env node
/**
 * Every Movie Plug - schema.org markup (JSON-LD) for Google
 *
 * Adds structured data to every page and refreshes it on re-runs (safe to run any time):
 *   news/<post>.html      NewsArticle + BreadcrumbList
 *   articles/<post>.html  Article     + BreadcrumbList
 *   news/index.html, articles/index.html   CollectionPage (+ list of the latest posts) + BreadcrumbList
 *   index.html            Organization + WebSite
 *
 * Everything is read from the page itself (title, description, date, image, canonical, category),
 * so nothing needs to be typed in. The author is Maccarthy Albin (a schema.org Person, see AUTHOR below);
 * the publisher is "Every Movie Plug". If a story shows an "Updated <date>" line, that date becomes dateModified.
 * Dates are written in ISO 8601 (2026-10-14, or 2026-10-14T14:35:00Z when the story has a publication time), which is what Google expects.
 *
 * Usage (from the site root):   node add-schema.js
 */
const fs = require("fs");
const path = require("path");

const SITE = "https://everymovieplug.com";
const NAME = "Every Movie Plug";
const LOGO = `${SITE}/web-app-manifest-512x512.png`;
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

const decode = s => (s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ").replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&amp;/g, "&");
const text = s => decode((s || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const meta = (html, attr, key) => {
  const m = html.match(new RegExp(`<meta[^>]*\\b${attr}=["']${key}["'][^>]*>`, "i"));
  const c = m && m[0].match(/content=("([^"]*)"|'([^']*)')/i);
  return c ? decode(c[2] ?? c[3]).trim() : "";
};
const isoDate = s => {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s || "");
  const mo = m && MONTHS.indexOf(m[1].toLowerCase());
  return m && mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}` : "";
};
const AUTHOR = {
  "@type": "Person", "@id": `${SITE}/author/maccarthy-albin.html#person`,
  name: "Maccarthy Albin", url: `${SITE}/author/maccarthy-albin.html`, email: "maccarthy@everymovieplug.com",
  description: "Film enthusiast, writer, and creator behind Every Movie Plug. Maccarthy Albin covers the latest cinema news, in-depth articles, iconic scene breakdowns, and movie history for film lovers around the globe.",
  sameAs: ["https://x.com/everymovieplug"],
  worksFor: { "@type": "Organization", name: NAME, url: `${SITE}/` },
};
const publisher = () => ({ "@type": "Organization", name: NAME, url: `${SITE}/`,
  logo: { "@type": "ImageObject", url: LOGO, width: 512, height: 512 } });
const crumbs = items => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) =>
  ({ "@type": "ListItem", position: i + 1, name, item: url })) });
// One <script> per item (no @graph wrapper): every checker and crawler reads this form, including
// simple third-party SEO tools that do not look inside @graph.
const block = graph => graph.map((item, n) => `<script type="application/ld+json" id="emp-schema-${n}">\n${
  JSON.stringify({ "@context": "https://schema.org", ...item }, null, 2).replace(/</g, "\\u003c")}\n    </script>`).join("\n    ");

function inject(file, graph) {
  const html = fs.readFileSync(file, "utf8");
  const tag = block(graph);
  const mine = /[ \t]*<script[^>]*id="emp-schema[^"]*"[^>]*>[\s\S]*?<\/script>[ \t]*\n?/gi;
  const clean = html.replace(mine, "");
  let out;
  // homepage: replace the old hand-written Organization block instead of adding a second one
  const old = /<script type="application\/ld\+json">\s*\{[^<]*"@type":\s*"Organization"[^<]*\}\s*<\/script>/i;
  if (old.test(clean)) out = clean.replace(old, () => tag);
  else if (/<\/head>/i.test(clean)) out = clean.replace(/<\/head>/i, () => `    ${tag}\n</head>`);
  else return false;
  if (out === html) return false;
  fs.writeFileSync(file, out);
  return true;
}

function postGraph(file, section, kind) {
  const html = fs.readFileSync(file, "utf8");
  const url = meta(html, "rel", "canonical") || (html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i) || [])[1]
    || `${SITE}/${section}/${path.basename(file)}`;
  const h1 = text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
  const headline = meta(html, "property", "og:title") || h1 || text((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const sub = text((html.match(/class="article-subtitle"[^>]*>([\s\S]*?)<\/p>/i) || [])[1]);
  const firstP = text((html.match(/class="article-content"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1]).slice(0, 200);
  const desc = meta(html, "name", "description") || meta(html, "property", "og:description") || sub || firstP;
  // older pages without social tags: fall back to the first picture in the post, then the site image
  const firstImg = (html.match(/<img[^>]*\bsrc=["']([^"']+)["']/i) || [])[1];
  const abs = u => { try { return u ? new URL(u, `${SITE}/${section}/x.html`).href : ""; } catch { return ""; } };
  const image = meta(html, "property", "og:image") || meta(html, "name", "twitter:image") || abs(firstImg) || `${SITE}/og-image.jpg`;
  // the date line may carry a publication time (data-published, stored in GMT) and a visible time span
  const dateTag = (html.match(/<p[^>]*class="article-date"[^>]*>/i) || [])[0] || "";
  const stamped = (dateTag.match(/data-published="([^"]+)"/) || [])[1];
  const dateText = text(((html.match(/class="article-date"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "").replace(/<span class="article-time">[\s\S]*?<\/span>/i, ""));
  const date = (stamped && !isNaN(new Date(stamped)) ? stamped : "") || isoDate(dateText);
  const updated = isoDate(text((html.match(/class="article-updated"[^>]*>([\s\S]*?)<\/p>/i) || [])[1]).replace(/^Updated\s+/i, ""));
  const cat = meta(html, "name", "category");
  const crumbName = section === "news" ? "News" : "Articles";
  const art = {
    "@type": kind, "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: headline.slice(0, 110), description: desc, url,
    author: AUTHOR,
    publisher: publisher(), isPartOf: { "@id": `${SITE}/#website` }, inLanguage: "en",
  };
  if (image) art.image = [image];
  if (date) { art.datePublished = date; art.dateModified = updated || date; }
  if (cat && kind === "NewsArticle") art.articleSection = cat;
  for (const k of Object.keys(art)) if (art[k] === "" ) delete art[k];
  // videos made with the site player (<div class="emp-player">): one VideoObject each, so Google can list them as video results
  const videos = [];
  for (const m of html.matchAll(/<div[^>]*class="emp-player"[^>]*>[\s\S]*?<video\b([^>]*)>/gi)) {
    const attr = (src, n) => (src.match(new RegExp(`\\b${n}=["']([^"']*)["']`, "i")) || [])[1] || "";
    const tag = m[0], vsrc = attr(m[1], "src"), poster = attr(m[1], "poster");
    if (!vsrc || !date) continue;
    const ttl = decode(attr(tag, "data-title")) || headline;
    const at = u => { try { return new URL(u, url).href; } catch { return ""; } };
    videos.push({ "@type": "VideoObject", name: ttl.slice(0, 110), description: desc || ttl,
      thumbnailUrl: [at(poster) || image], uploadDate: date, contentUrl: at(vsrc),
      publisher: { "@type": "Organization", name: NAME, url: `${SITE}/` } });
  }
  return [art, crumbs([["Home", `${SITE}/`], [crumbName, `${SITE}/${section}/`], [headline, url]]), ...videos];
}

function listGraph(file, section) {
  const html = fs.readFileSync(file, "utf8");
  const url = `${SITE}/${section}/`;
  const title = section === "news" ? "Movie and TV News" : "Movie and TV Articles";
  const desc = meta(html, "name", "description");
  const hrefs = [...new Set([...html.matchAll(new RegExp(`href=["'](?:${SITE.replace(/\./g, "\\.")})?/${section}/([^"'#?/]+\\.html)["']`, "g"))].map(m => m[1]))]
    .filter(h => h !== "index.html").slice(0, 20);
  return [{
    "@type": "CollectionPage", "@id": `${url}#page`, url, name: `${title} | ${NAME}`,
    ...(desc && { description: desc }), isPartOf: { "@id": `${SITE}/#website` }, inLanguage: "en",
    mainEntity: { "@type": "ItemList", itemListElement: hrefs.map((h, i) =>
      ({ "@type": "ListItem", position: i + 1, url: `${SITE}/${section}/${h}` })) },
  }, crumbs([["Home", `${SITE}/`], [section === "news" ? "News" : "Articles", url]])];
}

const homeGraph = () => [
  { "@type": "Organization", "@id": `${SITE}/#organization`, name: NAME, url: `${SITE}/`,
    logo: { "@type": "ImageObject", url: LOGO, width: 512, height: 512 }, sameAs: ["https://x.com/everymovieplug"] },
  { "@type": "WebSite", "@id": `${SITE}/#website`, name: NAME, url: `${SITE}/`,
    publisher: { "@id": `${SITE}/#organization` }, inLanguage: "en" },
];

let changed = 0, total = 0;
const run = (file, graph) => { total++; if (inject(file, graph)) { changed++; console.log("schema:", file); } };

if (fs.existsSync("index.html")) run("index.html", homeGraph());
for (const [section, kind] of [["news", "NewsArticle"], ["articles", "Article"]]) {
  if (!fs.existsSync(section)) continue;
  for (const f of fs.readdirSync(section).sort()) {
    if (!f.endsWith(".html")) continue;
    const file = path.join(section, f);
    try { run(file, f === "index.html" ? listGraph(file, section) : postGraph(file, section, kind)); }
    catch (e) { console.log(`::warning::${file}: ${e.message}`); }
  }
}
console.log(`Schema checked on ${total} pages, updated ${changed}.`);
