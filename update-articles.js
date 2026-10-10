#!/usr/bin/env node
/**
 * Every Movie Plug – auto article cards
 *
 * Scans the /articles folder, and for every .html file that is NOT already
 * linked in articles/index.html, reads its title, thumbnail, excerpt and date and
 * adds a card to the top of the list. Existing cards are never touched.
 *
 * Usage (run from your site root):   node update-articles.js
 * Options:  --listing=articles/index.html   --dir=articles
 */
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, "").split("="))
);
const LISTING = args.listing || "articles/index.html"; // page that shows the cards
const DIR = args.dir || "articles";               // folder with your articles
const ASSETS = args.assets || "articleassets";   // folder with your images
const SKIP = ["index.html"];                     // files to ignore
const SITE = /^https?:\/\/(www\.)?everymovieplug\.com\//i; // your own domain

/* ---------- helpers ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const decode = s => (s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = s => decode((s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function meta(html, keys) {
  for (const key of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decode(m[1].trim());
  }
  return "";
}

function getTitle(html) {
  let t = meta(html, ["og:title", "twitter:title"]);
  if (!t) { const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); if (m) t = clean(m[1]); }
  if (!t) { const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); if (m) t = clean(m[1]); }
  return t.replace(/\s*[|\-–—]\s*Every Movie Plug\s*$/i, "").trim();
}

function getExcerpt(html) {
  // 1) the subtitle shown under the headline
  let e = "";
  const sub = html.match(/<p[^>]*class=["'][^"']*article-subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  if (sub) e = clean(sub[1]);
  // 2) meta description  3) first long paragraph in the body
  if (!e) e = meta(html, ["description", "og:description", "twitter:description"]);
  if (!e) {
    const body = html.replace(/<(script|style|nav|header|footer)[\s\S]*?<\/\1>/gi, "");
    for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const txt = clean(m[1]);
      if (txt.length > 60) { e = txt; break; }
    }
  }
  return e.length > 200 ? e.slice(0, 197).replace(/\s+\S*$/, "") + "…" : e;
}

function getImage(html, file) {
  const root = path.resolve("."); // site root (run the script from there)
  const cands = [meta(html, ["og:image"]), meta(html, ["twitter:image"])];
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) cands.push(decode(m[1]));
  const list = cands.filter(Boolean).map(c => c.replace(SITE, "/"));
  if (!list.length) return "";

  const toListing = abs => "/" + path.relative(root, abs).split(path.sep).join("/"); // root-absolute
  const exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

  for (const src of list) {
    if (src.startsWith("data:") || /^(https?:)?\/\//i.test(src)) continue; // external: handled below
    let clean = src.split(/[?#]/)[0];
    try { clean = decodeURIComponent(clean); } catch (e) {}
    const tries = [
      clean.startsWith("/") ? path.join(root, clean) : path.resolve(path.dirname(file), clean), // as written
      path.resolve(root, clean.replace(/^\//, "")),                                           // from site root
      path.join(root, ASSETS, path.basename(clean)),                                          // by file name in articleassets/
    ];
    const hit = tries.find(exists);
    if (hit) return toListing(hit);
  }
  // nothing found on disk: use the first image as a site-root path, never an articles/ path
  const first = list[0];
  if (/^(https?:)?\/\//i.test(first) || first.startsWith("data:")) return first;
  const base = decodeURIComponent(first.split(/[?#]/)[0].split("/").pop());
  console.warn(`  ! Image not found on disk for ${path.basename(file)}; using /${ASSETS}/${base}`);
  return `/${ASSETS}/${base}`;
}

function getDate(html, file) {
  let d = meta(html, ["article:published_time", "datePublished", "date", "publish_date", "og:updated_time"]);
  if (!d) { const m = html.match(/"datePublished"\s*:\s*"([^"]+)"/); if (m) d = m[1]; }
  if (!d) { const m = html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if (m) d = m[1]; }
  let date = d ? new Date(d) : null;
  if (!date || isNaN(date)) {
    // fallback: the date written on the page, e.g. "October 7, 2026"
    const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ");
    const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/);
    if (m) date = new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1]), +m[2]));
  }
  if (!date || isNaN(date)) date = fs.statSync(file).mtime; // last resort: file date
  return date;
}

const fmtDate = d => d.toLocaleDateString("en-US",
  { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/* ---------- main ---------- */
if (!fs.existsSync(LISTING)) { console.error(`Can't find ${LISTING}`); process.exit(1); }
if (!fs.existsSync(DIR)) { console.error(`Can't find folder ${DIR}/`); process.exit(1); }

let listing = fs.readFileSync(LISTING, "utf8");
const linked = new Set(
  [...listing.matchAll(/class="article-card"[^>]*>/g)].length
    ? [...listing.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*class=["']article-card["']/g)]
        .map(m => decodeURIComponent(path.basename(m[1])).toLowerCase())
    : []
);

const fresh = fs.readdirSync(DIR)
  .filter(f => f.toLowerCase().endsWith(".html") && !SKIP.includes(f.toLowerCase()))
  .filter(f => !linked.has(f.toLowerCase()));

if (!fresh.length) { console.log("No new articles found."); process.exit(0); }

const cards = fresh.map(f => {
  const file = path.join(DIR, f);
  const html = fs.readFileSync(file, "utf8");
  const title = getTitle(html) || f.replace(/\.html$/, "").replace(/-/g, " ");
  const date = getDate(html, file);
  return { f, title, date, excerpt: getExcerpt(html), img: getImage(html, file) };
}).sort((a, b) => b.date - a.date);

const cardHtml = c => `  <!-- ${esc(c.title)} -->
  <a href="/${DIR}/${encodeURI(c.f)}" class="article-card">
    <div class="article-thumbnail">
      ${c.img ? `<img src="${esc(c.img)}" alt="${esc(c.title)}" loading="lazy">` : ""}
    </div>
    <div class="article-content">
      <div class="article-date">${fmtDate(c.date)}</div>
      <h2 class="article-title">${esc(c.title)}</h2>
      <p class="article-excerpt">${esc(c.excerpt)}</p>
    </div>
  </a>
`;

const open = /<main[^>]*class=["'][^"']*articles-grid[^"']*["'][^>]*>\s*/i;
if (!open.test(listing)) { console.error('Could not find <main class="articles-grid">'); process.exit(1); }
listing = listing.replace(open, m => m + "\n" + cards.map(cardHtml).join("\n") + "\n");

fs.writeFileSync(LISTING, listing);
cards.forEach(c => console.log(`Added: ${c.title}  (${fmtDate(c.date)})${c.img ? "" : "  [no thumbnail found]"}`));
