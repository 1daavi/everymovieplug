#!/usr/bin/env node
/**
 * build-feeds.js - builds the RSS feeds from each section's search-index.json
 * (the list of stories that build-listings.js already keeps up to date).
 *
 *   node build-feeds.js                 -> /news.xml and /articles.xml
 *   node build-feeds.js --only=news     -> just /news.xml
 *   node build-feeds.js --only=articles -> just /articles.xml
 *
 * Run it AFTER build-listings.js. Output only changes when a story changes, so it never makes empty commits.
 */
const fs = require("fs");
const path = require("path");

const SITE = "https://everymovieplug.com";
const MAX_ITEMS = 20;
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")));

const FEEDS = {
  news: {
    dir: "news", file: "news.xml",
    title: "Every Movie Plug: Movie and TV News",
    desc: "The latest movie and TV news from Every Movie Plug: box office, streaming, renewals and casting.",
  },
  articles: {
    dir: "articles", file: "articles.xml",
    title: "Every Movie Plug: Movie and TV Articles",
    desc: "Insights, movie breakdowns and features from Every Movie Plug.",
  },
};

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = s => String(s || "").replace(/\*+/g, "");            // "*Star Wars*" -> "Star Wars"
const abs = u => !u ? "" : /^https?:\/\//i.test(u) ? u : SITE + (u.startsWith("/") ? "" : "/") + u;
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

// Real timestamp when the story has one; otherwise noon UTC on its date (never in the future).
function pubDate(it, now) {
  let d = it.ts ? new Date(it.ts) : new Date(it.date + "T12:00:00Z");
  if (isNaN(d)) d = new Date(it.date + "T00:00:00Z");
  if (isNaN(d)) return null;
  return d > now ? now : d;
}

function build(feed) {
  const manifest = path.join(feed.dir, "search-index.json");
  if (!fs.existsSync(manifest)) { console.error(`Missing ${manifest} - run build-listings.js first`); return 1; }
  const all = (JSON.parse(fs.readFileSync(manifest, "utf8")).items || []);
  const now = new Date();

  const items = all
    .map(it => ({ it, d: pubDate(it, now) }))
    .filter(x => x.d && x.it.f && x.it.title)
    .sort((a, b) => b.d - a.d)
    .slice(0, MAX_ITEMS);
  if (!items.length) { console.error(`No stories in ${manifest}`); return 1; }

  const newest = items[0].d;   // lastBuildDate = newest story, so the file only changes when a story does
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    "<channel>",
    `<title>${esc(feed.title)}</title>`,
    `<link>${SITE}/${feed.dir}/</link>`,
    `<description>${esc(feed.desc)}</description>`,
    "<language>en-us</language>",
    `<lastBuildDate>${newest.toUTCString()}</lastBuildDate>`,
    `<atom:link href="${SITE}/${feed.file}" rel="self" type="application/rss+xml"/>`,
    `<image><url>${SITE}/favicon-96x96.png</url><title>${esc(feed.title)}</title><link>${SITE}/${feed.dir}/</link></image>`,
  ];

  for (const { it, d } of items) {
    const url = `${SITE}/${feed.dir}/${encodeURI(it.f)}`;
    out.push("<item>");
    out.push(`<title>${esc(plain(it.title))}</title>`);
    out.push(`<link>${esc(url)}</link>`);
    out.push(`<guid isPermaLink="true">${esc(url)}</guid>`);
    out.push(`<pubDate>${d.toUTCString()}</pubDate>`);
    if (it.tag) out.push(`<category>${esc(it.tag)}</category>`);
    if (it.excerpt) out.push(`<description>${esc(plain(it.excerpt))}</description>`);
    if (it.img) {
      const img = abs(it.img);
      const ext = (img.split("?")[0].split(".").pop() || "").toLowerCase();
      out.push(`<media:thumbnail url="${esc(img)}"/>`);
      out.push(`<media:content url="${esc(img)}" medium="image"${MIME[ext] ? ` type="${MIME[ext]}"` : ""}/>`);
    }
    out.push("</item>");
  }
  out.push("</channel>", "</rss>", "");

  fs.writeFileSync(feed.file, out.join("\n"));
  console.log(`[${feed.dir}] ${items.length} items -> ${feed.file}`);
  return 0;
}

const targets = args.only ? [args.only] : Object.keys(FEEDS);
if (targets.some(t => !FEEDS[t])) { console.error("--only must be news or articles"); process.exit(1); }
let failed = 0;
targets.forEach(t => { failed += build(FEEDS[t]); });
process.exit(failed ? 1 : 0);
