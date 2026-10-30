#!/usr/bin/env node
/**
 * Every Movie Plug - keeps the footer links identical on every news story and article.
 *
 * Rewrites the <div class="footer-links"> block of each story to the site-wide list in lib/site-nav.js
 * (Home, Movies, TV Shows, News, Articles, About Us, Contact, Privacy Policy, Terms of Service), and turns
 * old relative links such as ../index.html into root-absolute ones. Safe to run any time.
 *
 * Usage (from the site root):   node fix-nav.js            news + articles
 *                               node fix-nav.js news       only that folder
 */
const fs = require("fs");
const path = require("path");
const { footerLinksHTML } = require("./lib/site-nav");

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
    const out = html.replace(block, (m, a, b) => `${a}\n${links}\n        ${b}`);
    if (out !== html) { fs.writeFileSync(file, out); changed++; }
  }
}
console.log(`Footer navigation checked on ${checked} page(s), updated ${changed}.`);
