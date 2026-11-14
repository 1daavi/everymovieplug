// Cloudflare Pages Function: /watchlist
// A normal visit just gets the static /watchlist.html page. A long share link (/watchlist?l=...) gets the same page with
// social-preview tags added, so pasting it into WhatsApp, X, Discord etc. shows the FIRST poster of the list, the number of
// titles and the first few names. (A collage needs the KV setup described in functions/api/share.js.)
// Needs the TMDB_API_KEY secret you already added for the other functions.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function decodeIds(payload) {
  try {
    const txt = atob(payload.replace(/^~/, "").replace(/-/g, "+").replace(/_/g, "/"));
    const items = txt.split(",").slice(0, 200).map(p => /^([mt])(\d{1,9})$/.exec(p)).filter(Boolean)
      .map(m => ({ type: m[1] === "m" ? "movie" : "tv", id: +m[2] }));
    return items.length ? items : null;
  } catch { return null; }
}

async function details(item, env) {
  const key = env.TMDB_API_KEY || "";
  if (!item || !key) return null;
  const api = new URL(`https://api.themoviedb.org/3/${item.type}/${item.id}`);
  api.searchParams.set("language", "en-US");
  const init = { cf: { cacheEverything: true, cacheTtl: 3600 } };
  if (key.startsWith("eyJ")) init.headers = { Authorization: "Bearer " + key }; else api.searchParams.set("api_key", key);
  try { const r = await fetch(api, init); return r.ok ? await r.json() : null; } catch { return null; }
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url), payload = url.searchParams.get("l") || "";
  if (request.method !== "GET" || !/^[A-Za-z0-9_~-]{2,2000}$/.test(payload)) return next();   // ordinary visit: serve the normal page
  const items = decodeIds(payload);
  if (!items) return next();

  const first = await Promise.all(items.slice(0, 3).map(i => details(i, env)));
  const titles = first.filter(Boolean).map(d => d.title || d.name).filter(Boolean);
  const poster = first[0] && first[0].poster_path ? "https://image.tmdb.org/t/p/w780" + first[0].poster_path : url.origin + "/og-image.jpg";
  const n = items.length;
  const name = "A shared Watchlist";
  const desc = titles.length
    ? `${n} movie${n === 1 ? "" : "s"} and shows, starting with ${titles.join(", ")}. Open the full list on Every Movie Plug.`
    : `A shared list of ${n} movies and shows. Open it on Every Movie Plug.`;
  const self = url.origin + "/watchlist?l=" + payload;
  const meta = `<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${esc(self)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Every Movie Plug"><meta property="og:url" content="${esc(self)}">
<meta property="og:title" content="${esc(name)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(poster)}"><meta property="og:image:alt" content="${esc(titles[0] || name)} poster">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@everymovieplug">
<meta name="twitter:title" content="${esc(name)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(poster)}">`;

  let page;
  try {
    let r = await env.ASSETS.fetch(new URL("/watchlist.html", request.url));
    for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.headers.get("location"); i++) r = await env.ASSETS.fetch(new URL(r.headers.get("location"), request.url));
    if (!r.ok) throw new Error();
    page = await r.text();
  } catch { return next(); }

  page = page
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(name)} | Every Movie Plug</title>`)
    .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta name="robots"[^>]*>\s*/, "")
    .replace(/<link rel="canonical"[^>]*>\s*/, "")
    .replace("<!--EMP_META-->", () => meta);

  return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-robots-tag": "noindex, nofollow" } });
}
