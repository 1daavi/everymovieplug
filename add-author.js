#!/usr/bin/env node
/**
 * Every Movie Plug - adds the author to every news story and article.
 *
 * What it adds (and refreshes on every run, so it is safe to run any time):
 *   - <meta name="author" content="Maccarthy Albin"> in the <head>
 *   - a byline under the date:  "By Maccarthy Albin"  (links to the author page)
 *   - an author box at the end of the story: short bio + contact email
 * The schema.org author (Person) is written by add-schema.js.
 *
 * Usage (from the site root):   node add-author.js
 *   node add-author.js news       only the news folder
 *   node add-author.js articles   only the articles folder
 */
const fs = require("fs");
const path = require("path");

const AUTHOR = {
  name: "Maccarthy Albin",
  email: "maccarthy@everymovieplug.com",
  page: "/author/maccarthy-albin.html",
  bio: "Film enthusiast, writer, and creator behind Every Movie Plug. Maccarthy Albin covers the latest cinema news, in-depth articles, iconic scene breakdowns, and movie history for film lovers around the globe.",
};
const initials = AUTHOR.name.split(/\s+/).map(w => w[0]).join("").toUpperCase();

const byline = `<p class="article-byline">By <a href="${AUTHOR.page}" rel="author">${AUTHOR.name}</a></p>`;
const box = `    <aside class="author-box" aria-label="About the author">
        <div class="author-avatar" aria-hidden="true">${initials}</div>
        <div class="author-info">
            <p class="author-label">Written by</p>
            <p class="author-name"><a href="${AUTHOR.page}" rel="author">${AUTHOR.name}</a></p>
            <p class="author-bio">${AUTHOR.bio}</p>
            <p class="author-contact">Contact: <a href="mailto:${AUTHOR.email}">${AUTHOR.email}</a> &middot; <a href="https://x.com/everymovieplug" target="_blank" rel="noopener noreferrer">@everymovieplug on X</a></p>
        </div>
    </aside>
`;

const sections = process.argv.slice(2).length ? process.argv.slice(2) : ["news", "articles"];
let changed = 0, total = 0, skipped = 0;
for (const dir of sections) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".html") || f === "index.html") continue;
    const file = path.join(dir, f);
    const html = fs.readFileSync(file, "utf8");
    if (!/class="article-header"/.test(html) || !/<\/main>/i.test(html)) { skipped++; continue; }
    total++;
    let out = html
      .replace(/[ \t]*<meta name="author"[^>]*>\s*\n?/gi, "")
      .replace(/[ \t]*<p class="article-byline">[\s\S]*?<\/p>\s*\n?/g, "")
      .replace(/[ \t]*<aside class="author-box"[\s\S]*?<\/aside>\s*\n?/g, "");
    out = out.replace(/<\/title>/i, m => `${m}\n    <meta name="author" content="${AUTHOR.name}">`);
    out = out.replace(/(<p class="article-date">[^<]*<\/p>(?:\s*<p class="article-updated">[^<]*<\/p>)?)/,
      (m) => `${m}\n            ${byline}`);
    out = out.replace(/([ \t]*)<\/main>/i, (m) => `${box}${m}`);
    if (out !== html) { fs.writeFileSync(file, out); changed++; }
  }
}
console.log(`Author: checked ${total} page(s), updated ${changed}${skipped ? `, skipped ${skipped} (no article header)` : ""}.`);
