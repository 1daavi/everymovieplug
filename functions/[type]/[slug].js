// Cloudflare Pages Function: serves /movie/603-the-matrix and /tv/1399-game-of-thrones
// with that title's TMDB poster, title and synopsis in the social-preview tags,
// then sends real visitors to the trending page popup.
// Setup: Pages project > Settings > Variables and Secrets > add TMDB_API_KEY.

const USE_BACKDROP = false; // true = wide backdrop image instead of the poster (crops less on X)

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequest({ params, env, request, next }) {
  const type = params.type, m = /^(\d+)(?:-.*)?$/.exec(params.slug || "");
  if (!["movie", "tv"].includes(type) || !m) return next();   // anything else: serve the normal file
  const id = m[1], origin = new URL(request.url).origin, key = env.TMDB_API_KEY || "";

  const api = new URL(`https://api.themoviedb.org/3/${type}/${id}`);
  api.searchParams.set("language", "en-US");
  const init = { cf: { cacheEverything: true, cacheTtl: 3600 } };
  if (key.startsWith("eyJ")) init.headers = { Authorization: "Bearer " + key }; else api.searchParams.set("api_key", key);

  let d;
  try { const r = await fetch(api, init); if (!r.ok) throw new Error(); d = await r.json(); }
  catch { return Response.redirect(origin + "/trending", 302); }

  const title = d.title || d.name || "Every Movie Plug";
  const year = (d.release_date || d.first_air_date || "").slice(0, 4);
  const name = year ? `${title} (${year})` : title;
  const desc = (d.overview || `Ratings, trailer and where to watch ${title}.`).replace(/\s+/g, " ").slice(0, 200);
  const path = (USE_BACKDROP && d.backdrop_path) || d.poster_path || d.backdrop_path;
  const img = path ? `https://image.tmdb.org/t/p/w780${path}` : `${origin}/og-image.jpg`;
  const self = origin + new URL(request.url).pathname, go = `/trending#${type}-${id}`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} | Every Movie Plug</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(self)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Every Movie Plug"><meta property="og:url" content="${esc(self)}">
<meta property="og:title" content="${esc(name)} | Every Movie Plug"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:alt" content="${esc(title)} poster">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@everymovieplug">
<meta name="twitter:title" content="${esc(name)} | Every Movie Plug"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<script>location.replace(${JSON.stringify(go)});</script></head>
<body style="background:#000;color:#f5f5f7;font-family:-apple-system,Helvetica,Arial,sans-serif;text-align:center;padding:2rem">
<noscript><h1>${esc(name)}</h1><p>${esc(desc)}</p></noscript>
<p><a href="${esc(go)}" style="color:#c4b5fd">Opening ${esc(title)} on Every Movie Plug…</a></p></body></html>`;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
