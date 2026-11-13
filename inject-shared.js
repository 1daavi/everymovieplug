#!/usr/bin/env node
/**
 * Every Movie Plug - adds the cookie consent banner (consent.js) to every page, and the Watchlist (watchlist.js) to the
 * pages that show movie / TV cards. Safe to run any time: it only adds what is missing.
 *
 *   <head>   inline Google consent defaults, placed BEFORE the AdSense tag so ads respect the visitor's choice
 *   <body>   <script src="/consent.js" defer>   on every page
 *            <script src="/watchlist.js" defer> on WATCHLIST_PAGES only
 *
 * Usage:  node inject-shared.js              every .html file in the project (including templates/)
 *         node inject-shared.js news         only that folder
 * fix-nav.js calls injectInto() for every story, so new news / articles get the banner automatically.
 */
const fs = require("fs");
const path = require("path");

const WATCHLIST_PAGES = ["index.html", "title.html", "trending.html", "watchlist.html", "movies/index.html", "tv-shows/index.html"];

const INIT_SNIPPET =
  '<script id="emp-consent-init">(function(){var w=window,d=w.dataLayer=w.dataLayer||[];function g(){d.push(arguments)}var a=0;try{var c=JSON.parse(localStorage.getItem("emp_consent_v1"));a=c&&c.ads?1:0}catch(e){}var s=a?"granted":"denied";g("consent","default",{ad_storage:s,ad_user_data:s,ad_personalization:s,analytics_storage:"denied",wait_for_update:500});(w.adsbygoogle=w.adsbygoogle||[]).requestNonPersonalizedAds=a?0:1})();</script>';

function injectInto(html, rel) {
  let out = html;
  if (!/id="emp-consent-init"/.test(out)) {
    const ads = out.match(/^([ \t]*)<script[^>]*adsbygoogle\.js/m);
    if (ads) out = out.slice(0, ads.index) + ads[1] + INIT_SNIPPET + "\n" + out.slice(ads.index);
    else if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, m => "    " + INIT_SNIPPET + "\n" + m);
  }
  const add = [];
  if (!/src="\/consent\.js"/.test(out)) add.push('<script src="/consent.js" defer></script>');
  if (WATCHLIST_PAGES.includes(rel) && !/src="\/watchlist\.js"/.test(out)) add.push('<script src="/watchlist.js" defer></script>');
  if (add.length && /<\/body>/i.test(out)) out = out.replace(/<\/body>/i, m => add.map(t => "    " + t + "\n").join("") + m);
  return out;
}

function walk(dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list); else if (e.name.endsWith(".html")) list.push(p);
  }
  return list;
}

module.exports = { injectInto };

if (require.main === module) {
  const root = process.cwd(), dirs = process.argv.slice(2);
  const files = (dirs.length ? dirs : ["."]).flatMap(d => fs.existsSync(d) ? walk(d) : []);
  let changed = 0;
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join("/");
    const html = fs.readFileSync(f, "utf8"), out = injectInto(html, rel);
    if (out !== html) { fs.writeFileSync(f, out); changed++; }
  }
  console.log(`Consent banner / watchlist scripts checked on ${files.length} page(s), updated ${changed}.`);
}
