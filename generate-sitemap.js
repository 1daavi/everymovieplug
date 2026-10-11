// Generates sitemap.xml for everymovieplug.com by scanning the repo for .html files.
// Run: node generate-sitemap.js
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SITE = "https://everymovieplug.com";
const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", ".github", "_site", "assets", "includes", "partials", "templates"]);
const SKIP_FILES = new Set(["404.html"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".html") && !SKIP_FILES.has(entry.name) && !/^google[0-9a-f]+\.html$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function lastMod(file) {
  try {
    const d = execSync(`git log -1 --format=%cI -- "${file}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (d) return d.slice(0, 10);
  } catch (_) {}
  return fs.statSync(file).mtime.toISOString().slice(0, 10);
}

function toUrl(file) {
  let rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (rel === "index.html") return SITE + "/";
  if (rel.endsWith("/index.html")) rel = rel.slice(0, -"index.html".length);
  return SITE + "/" + rel.split("/").map(encodeURIComponent).join("/");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const urls = walk(ROOT)
  .map((f) => ({ loc: toUrl(f), lastmod: lastMod(f) }))
  .sort((a, b) => a.loc.localeCompare(b.loc));

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join("\n") +
  `\n</urlset>\n`;

fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
console.log(`sitemap.xml written with ${urls.length} URLs`);
