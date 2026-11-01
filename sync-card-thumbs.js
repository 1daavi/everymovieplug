#!/usr/bin/env node
/**
 * Every Movie Plug - keep the "Latest on Every Movie Plug" card thumbnails in sync
 *
 * The related-story cards (<a class="emp-card" href="...">) inside news/ and articles/ stories each hold
 * an <img>. This sets that image to the og:image (falling back to twitter:image) of the story the card
 * links to, so a card can never point at a guessed or outdated file name.
 *
 * Run:   node sync-card-thumbs.js            (rewrites the story files in place)
 *        node sync-card-thumbs.js --check    (changes nothing, lists what would change, exits 1 if any)
 *        node sync-card-thumbs.js news       (only that folder; also: articles)
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SELF = /^https?:\/\/(www\.)?everymovieplug\.com\//i;
const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const dirs = argv.filter(a => !a.startsWith("--"));
const DIRS = dirs.length ? dirs : ["news", "articles"];

const decode = s => (s || "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

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

const ogCache = new Map();
function ogImageFor(href) {
  let p = decode(href).replace(SELF, "/").split(/[?#]/)[0];
  if (!p.startsWith("/")) return "";                       // external or relative-odd link: leave alone
  if (ogCache.has(p)) return ogCache.get(p);
  let img = "";
  try {
    const html = fs.readFileSync(path.join(ROOT, decodeURIComponent(p)), "utf8");
    img = meta(html, ["og:image", "twitter:image"]).replace(SELF, "/");
  } catch (e) { /* target page not in this checkout */ }
  ogCache.set(p, img);
  return img;
}

const CARD = /(<a\s+[^>]*class="emp-card"[^>]*href="([^"]+)"[^>]*>)([\s\S]*?)(<\/a>)/g;
const IMG_SRC = /(<img\b[^>]*?\bsrc=")([^"]*)(")/i;

let changed = 0, cards = 0, missing = [];
for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith(".html") || f === "index.html") continue;
    const file = path.join(abs, f);
    const src = fs.readFileSync(file, "utf8");
    if (!src.includes('class="emp-card"')) continue;
    const out = src.replace(CARD, (whole, open, href, inner, close) => {
      cards++;
      const og = ogImageFor(href);
      if (!og) { missing.push(`${dir}/${f} -> ${href}`); return whole; }
      const m = inner.match(IMG_SRC);
      if (!m) return whole;
      if (decode(m[2]).replace(SELF, "/") === og) return whole;   // same file, just a different URL form
      console.log(`${dir}/${f}\n   ${href}\n   ${m[2]}\n   -> ${og}`);
      return open + inner.replace(IMG_SRC, (_, a, __, c) => a + escAttr(og) + c) + close;
    });
    if (out !== src) { changed++; if (!CHECK) fs.writeFileSync(file, out); }
  }
}
console.log(`\n${cards} cards checked, ${changed} file(s) ${CHECK ? "need updating" : "updated"}.`);
if (missing.length) console.log("No og:image found for:\n  " + missing.join("\n  "));
if (CHECK && changed) process.exit(1);
