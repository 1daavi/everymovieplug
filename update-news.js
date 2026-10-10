#!/usr/bin/env node
/**
 * Every Movie Plug – auto news tiles
 *
 * Scans the /news folder, and for every .html file that is NOT already
 * linked in news/index.html, reads its title, thumbnail, excerpt, category and date
 * and adds a tile to the top of the grid. Existing tiles are never touched.
 *
 * Usage (run from your site root):   node update-news.js
 */
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, "").split("="))
);
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

function getExcerpt(html, preferMeta) {
  // 1) the subtitle shown under the headline (news: the meta description, which is what the tiles show)
  let e = preferMeta ? meta(html, ["description", "og:description"]) : "";
  if (e) return e.length > 200 ? e.slice(0, 197).replace(/\s+\S*$/, "…") : e;
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

/* ---------- section settings ---------- */
// news tiles get a small label: set <meta name="category" content="Box Office"> in a story to choose it,
// otherwise it is guessed from the headline and description.
function getTag(html, title, excerpt) {
  const m = meta(html, ["category", "article:section"]);
  if (m) return m;
  const t = (title + " " + excerpt).toLowerCase();
  if (/renew|casting/.test(t)) return "TV";
  if (/box office|opening weekend|opens with|debuts at|grossed|domestic|million/.test(t)) return "Box Office";
  if (/stream|peacock|netflix|disney\+|hulu|max\b|prime video|apple tv|what to watch/.test(t)) return "Streaming";
  if (/season|series|casting|renew|tv\b/.test(t)) return "TV";
  return "News";
}

const newsTile = c => `            <!-- ${esc(c.title)} -->
            <a class="tile" href="/${c.dir}/${encodeURI(c.f)}" style="--i:0">
                <div class="tile-thumb">
                    ${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
                    <span class="tile-tag">${esc(c.tag)}</span>
                </div>
                <div class="tile-body">
                    <time class="tile-date" datetime="${c.date.toISOString().slice(0, 10)}">${fmtDate(c.date)}</time>
                    <h2 class="tile-title">${esc(c.title)}</h2>
                    <p class="tile-excerpt">${esc(c.excerpt)}</p>
                    <span class="tile-more">Read story <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                </div>
            </a>
`;

const NEWS = {
  dir: "news", listing: "news/index.html", card: newsTile, preferMeta: true,
  linked: /<a[^>]*class=["']tile["'][^>]*href=["']([^"']+)["']/g,
  open: /<div[^>]*class=["']tiles["'][^>]*>\s*/i,
  openHint: '<div class="tiles" id="tiles">',
};

/* ---------- main ---------- */
function run(sec) {
  const { dir: DIR, listing: LISTING } = sec;
  if (!fs.existsSync(LISTING)) { console.error(`Can't find ${LISTING}`); return 1; }
  if (!fs.existsSync(DIR)) { console.error(`Can't find folder ${DIR}/`); return 1; }

  let listing = fs.readFileSync(LISTING, "utf8");
  const linked = new Set([...listing.matchAll(sec.linked)]
    .map(m => decodeURIComponent(path.basename(m[1])).toLowerCase()));

  const fresh = fs.readdirSync(DIR)
    .filter(f => f.toLowerCase().endsWith(".html") && !SKIP.includes(f.toLowerCase()))
    .filter(f => !linked.has(f.toLowerCase()));

  if (!fresh.length) { console.log(`[${DIR}] No new items found.`); return 0; }

  const cards = fresh.map(f => {
    const file = path.join(DIR, f);
    const html = fs.readFileSync(file, "utf8");
    const title = getTitle(html) || f.replace(/\.html$/, "").replace(/-/g, " ");
    const excerpt = getExcerpt(html, sec.preferMeta);
    return { f, dir: DIR, title, excerpt, date: getDate(html, file), img: getImage(html, file), tag: getTag(html, title, excerpt) };
  }).sort((a, b) => b.date - a.date);

  if (!sec.open.test(listing)) { console.error(`Could not find ${sec.openHint} in ${LISTING}`); return 1; }
  listing = listing.replace(sec.open, m => m + "\n" + cards.map(sec.card).join("\n") + "\n");
  // keep the staggered entrance animation in order (news tiles)
  let n = 0;
  listing = listing.replace(/(<a class="tile"[^>]*style="--i:)\d+(")/g, (_, a, b) => a + (n++) + b);

  fs.writeFileSync(LISTING, listing);
  cards.forEach(c => console.log(`[${DIR}] Added: ${c.title}  (${fmtDate(c.date)})${c.img ? "" : "  [no thumbnail found]"}`));
  return 0;
}

process.exit(run(NEWS));
