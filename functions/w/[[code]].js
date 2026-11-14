// Cloudflare Pages Function: shared Watchlists.
//   /w/<code>          the shared list as a page (the /watchlist.html template, filled with the list and social-preview tags)
//   /w/<code>/og.jpg   the collage thumbnail drawn when the list was shared
//   /w/~<ids>          fallback link used when KV is not set up: just movie / TV ids, no stored data and no collage
// Setup: see functions/api/share.js (KV binding named WATCHLISTS). TMDB_API_KEY is only needed for the fallback links.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function decodeIds(payload) {
  try {
    const txt = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const items = txt.split(",").slice(0, 200).map(p => /^([mt])(\d{1,9})$/.exec(p)).filter(Boolean)
      .map(m => ({ type: m[1] === "m" ? "movie" : "tv", id: +m[2] }));
    return items.length ? items : null;
  } catch { return null; }
}

async function firstPoster(item, env) {
  const key = env.TMDB_API_KEY || "";
  if (!item || !key) return "";
  const api = new URL(`https://api.themoviedb.org/3/${item.type}/${item.id}`);
  const init = { cf: { cacheEverything: true, cacheTtl: 3600 } };
  if (key.startsWith("eyJ")) init.headers = { Authorization: "Bearer " + key }; else api.searchParams.set("api_key", key);
  try { const r = await fetch(api, init); if (!r.ok) return ""; const d = await r.json(); return d.poster_path || ""; } catch { return ""; }
}

export async function onRequest({ params, env, request }) {
  const parts = Array.isArray(params.code) ? params.code : [params.code].filter(Boolean);
  const origin = new URL(request.url).origin, code = parts[0] || "";
  const isKv = /^[A-Za-z0-9]{8}$/.test(code), isIds = /^~[A-Za-z0-9_-]{2,2000}$/.test(code);
  if (!isKv && !isIds) return Response.redirect(origin + "/watchlist.html", 302);

  /* ---- thumbnail ---- */
  if (parts.length === 2) {
    if (parts[1] !== "og.jpg" || !isKv || !env.WATCHLISTS) return Response.redirect(origin + "/og-image.jpg", 302);
    const buf = await env.WATCHLISTS.get("wi:" + code, { type: "arrayBuffer" });
    if (!buf) return Response.redirect(origin + "/og-image.jpg", 302);
    return new Response(buf, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" } });
  }
  if (parts.length !== 1) return Response.redirect(origin + "/watchlist.html", 302);

  /* ---- the list ---- */
  let data = null, status = 200;
  if (isKv && env.WATCHLISTS) {
    const raw = await env.WATCHLISTS.get("wl:" + code);
    if (raw) { try { data = JSON.parse(raw); } catch {} }
  } else if (isIds) {
    const items = decodeIds(code.slice(1));
    if (items) data = { name: "", items, idsOnly: true };
  }
  const shared = data ? { name: data.name || "", items: data.items, idsOnly: !!data.idsOnly } : { missing: true };
  if (!data) status = 404;

  /* ---- social-preview tags ---- */
  const self = origin + "/w/" + code, n = data ? data.items.length : 0;
  const name = data && data.name ? data.name : "A shared Watchlist";
  const titles = data && !data.idsOnly ? data.items.slice(0, 3).map(i => i.title).join(", ") : "";
  const desc = data
    ? (titles ? `${n} movies and shows, including ${titles}. Open the full list on Every Movie Plug.` : `A shared list of ${n} movies and shows. Open it on Every Movie Plug.`)
    : "This shared Watchlist is no longer available.";
  let img = origin + "/og-image.jpg", wide = false;
  if (data && data.img) { img = `${origin}/w/${code}/og.jpg`; wide = true; }
  else if (data) {
    const p = (data.items[0] && data.items[0].poster) || await firstPoster(data.items[0], env);
    if (p) img = "https://image.tmdb.org/t/p/w780" + p;
  }
  const pageTitle = `${name} | Every Movie Plug`;
  const meta = `<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${esc(self)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Every Movie Plug"><meta property="og:url" content="${esc(self)}">
<meta property="og:title" content="${esc(name)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">${wide ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ""}<meta property="og:image:alt" content="${esc(name)}, a shared Watchlist">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@everymovieplug">
<meta name="twitter:title" content="${esc(name)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">`;

  let page;
  try {
    let r = await env.ASSETS.fetch(new URL("/watchlist.html", request.url));
    for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.headers.get("location"); i++) r = await env.ASSETS.fetch(new URL(r.headers.get("location"), request.url));
    if (!r.ok) throw new Error();
    page = await r.text();
  } catch { return Response.redirect(origin + "/watchlist.html", 302); }

  const blob = `<script type="application/json" id="emp-shared">${JSON.stringify(shared).replace(/</g, "\\u003c")}</script>`;
  page = page
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(pageTitle)}</title>`)
    .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta name="robots"[^>]*>\s*/, "")
    .replace(/<link rel="canonical"[^>]*>\s*/, "")
    .replace("<!--EMP_META-->", () => meta)
    .replace("<!--EMP_SHARED-->", () => blob);

  return new Response(page, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": status === 200 ? "public, max-age=300" : "no-store", "x-robots-tag": "noindex, nofollow" } });
}
