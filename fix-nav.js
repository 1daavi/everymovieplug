#!/usr/bin/env node
/**
 * Every Movie Plug - keeps the footer links identical on every news story and article.
 *
 * Rewrites the <div class="footer-links"> block of each story to the site-wide list in lib/site-nav.js
 * (Home, Movies, TV Shows, News, Articles, About Us, Contact, Privacy Policy, Terms of Service), and turns
 * old relative links such as ../index.html into root-absolute ones. Also makes sure every story's <head> has the
 * RSS feed <link rel="alternate"> tags, so new stories get the footer RSS links and feed tags automatically.
 * Also adds <script src="/tag-links.js"> to stories that have "Related" cards, so their category labels are clickable tags.
 * Safe to run any time.
 *
 * Usage (from the site root):   node fix-nav.js            news + articles
 *                               node fix-nav.js news       only that folder
 */
const fs = require("fs");
const path = require("path");
const { footerLinksHTML, FEED_LINK_TAGS } = require("./lib/site-nav");

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["news", "articles"];
const block = /(<div class="footer-links">)[\s\S]*?(<\/div>)/;
let changed = 0, checked = 0;
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith(".html") || f === "index.html") continue;
    const file = path.join(d, f), html = fs.readFileSync(file, "utf8");
    if (!block.test(html)) { console.log(`no footer-links block: ${file}`); continue; }
    checked++;
    // keep a story's own contact address if it deliberately uses a different one
    const mail = (html.match(block)[0].match(/href="(mailto:[^"]+)"/) || [])[1];
    let links = footerLinksHTML();
    if (mail) links = links.replace("mailto:contact@everymovieplug.com", mail);
    let out = html.replace(block, (m, a, b) => `${a}\n${links}\n        ${b}`);
    if (!/type="application\/rss\+xml"/i.test(out)) {          // feed auto-discovery tags in <head>
      const canon = out.match(/^([ \t]*)<link rel="canonical"[^>]*>[ \t]*\r?\n/m);
      if (canon) {
        const tags = FEED_LINK_TAGS.map(t => canon[1] + t + "\n").join("");
        out = out.slice(0, canon.index + canon[0].length) + tags + out.slice(canon.index + canon[0].length);
      } else if (/<\/head>/i.test(out)) {
        out = out.replace(/<\/head>/i, m => FEED_LINK_TAGS.map(t => "    " + t + "\n").join("") + m);
      }
    }
    // clickable tags: stories with "Related" cards need the shared tag script (the card labels link to /news/?tag=... or /articles/?tag=...)
    if (/emp-card-tag/.test(out) && !/src="\/tag-links\.js"/.test(out) && /<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, m => '    <script src="/tag-links.js" defer></script>\n' + m);
    }
    if (out !== html) { fs.writeFileSync(file, out); changed++; }
  }
}
console.log(`Footer navigation checked on ${checked} page(s), updated ${changed}.`);
