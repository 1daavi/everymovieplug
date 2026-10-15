#!/usr/bin/env node
/**
 * Every Movie Plug - adds the Google AdSense loader to the <head> of every page.
 *
 * Safe to run any time: a page that already has the code is left alone, so it never doubles up.
 * The GitHub workflows run it after each new news post or article, so new pages get the code automatically.
 *
 * Usage (from the site root):
 *   node add-adsense.js              every page on the site
 *   node add-adsense.js news         only the news folder (what the news workflow uses)
 *   node add-adsense.js articles     only the articles folder
 */
const fs = require("fs");
const path = require("path");

const CLIENT = "ca-pub-4564573478126357";
const TAG = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}"
     crossorigin="anonymous"></script>`;

// Folders that are not web pages.
const SKIP_DIRS = new Set([".git", ".github", "node_modules", "functions", "scripts"]);
// Pages that should not carry ads: the placeholder countdown page has no content, and title.html is the
// template that draws every /movie/ and /tv/ page from TMDB data (no original content of its own, and noindex).
const SKIP_FILES = new Set(["time/count/down.html", "title.html"]);

const root = process.cwd();
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["."];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) yield* walk(full); }
    else if (/\.html?$/i.test(entry.name)) yield full;
  }
}

let added = 0, already = 0, skipped = 0, problems = 0;
for (const t of targets) {
  const start = path.resolve(root, t);
  if (!fs.existsSync(start)) { console.warn(`Not found: ${t}`); continue; }
  const files = fs.statSync(start).isDirectory() ? [...walk(start)] : [start];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (SKIP_FILES.has(rel)) { skipped++; continue; }
    const html = fs.readFileSync(file, "utf8");
    if (html.includes(CLIENT)) { already++; continue; }
    if (!/<\/head>/i.test(html)) { console.warn(`No </head> found, skipped: ${rel}`); problems++; continue; }
    fs.writeFileSync(file, html.replace(/<\/head>/i, () => `    ${TAG}\n</head>`));
    added++;
  }
}
console.log(`AdSense code: added to ${added} page(s), already present on ${already}, skipped ${skipped}${problems ? `, ${problems} problem(s)` : ""}.`);
