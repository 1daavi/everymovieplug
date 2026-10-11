// Cloudflare Pages Function: a small proxy that keeps your API keys on the server.
// The browser calls /api/tmdb/..., /api/omdb and /api/watchmode/... and this function adds the real key.
//
// Setup: Cloudflare dashboard > Workers & Pages > your project > Settings > Variables and Secrets
//   add these as *Secrets* (Production AND Preview):  TMDB_API_KEY, OMDB_API_KEY, WATCHMODE_API_KEY
// Local testing: put the same three lines in a file called .dev.vars (it is git-ignored) and run `npx wrangler pages dev .`

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });

// Only these TMDB endpoints can be reached through the proxy (stops strangers using your key for anything else).
const TMDB_ALLOWED =
  /^(trending\/(all|movie|tv)\/(day|week)|discover\/(movie|tv)|search\/(multi|movie|tv)|genre\/(movie|tv)\/list|(movie|tv)\/\d+)$/;

async function forward(target, init, ttl) {
  let r;
  try { r = await fetch(target, { ...init, cf: { cacheEverything: true, cacheTtl: ttl } }); }
  catch { return json({ error: "Upstream request failed" }, 502); }
  const headers = new Headers({ "content-type": r.headers.get("content-type") || "application/json" });
  if (r.ok) headers.set("cache-control", `public, max-age=${Math.min(ttl, 900)}`);
  return new Response(r.body, { status: r.status, headers });
}

export async function onRequest({ request, env, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);

  const segs = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [service, ...rest] = segs;
  const path = rest.join("/");
  const incoming = new URL(request.url).searchParams;

  // ---- TMDB ----
  if (service === "tmdb") {
    const key = env.TMDB_API_KEY;
    if (!key) return json({ error: "TMDB_API_KEY is not set on the server" }, 500);
    if (!TMDB_ALLOWED.test(path)) return json({ error: "Not allowed" }, 404);
    const url = new URL("https://api.themoviedb.org/3/" + path);
    for (const [k, v] of incoming) if (k.toLowerCase() !== "api_key") url.searchParams.set(k, v);
    const init = {};
    if (key.startsWith("eyJ")) init.headers = { Authorization: "Bearer " + key };   // v4 read token
    else url.searchParams.set("api_key", key);                                       // v3 key
    return forward(url, init, 600);
  }

  // ---- OMDb (IMDb / Rotten Tomatoes / Metacritic scores) ----
  if (service === "omdb" && !path) {
    const key = env.OMDB_API_KEY;
    if (!key) return json({ error: "OMDB_API_KEY is not set on the server" }, 500);
    const imdb = incoming.get("i") || "";
    if (!/^tt\d+$/.test(imdb)) return json({ error: "Bad imdb id" }, 400);
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("i", imdb);
    url.searchParams.set("apikey", key);
    return forward(url, {}, 86400);
  }

  // ---- Watchmode (deep links into streaming apps) ----
  if (service === "watchmode") {
    const key = env.WATCHMODE_API_KEY;
    if (!key) return json({ error: "WATCHMODE_API_KEY is not set on the server" }, 500);
    const url = new URL("https://api.watchmode.com/v1/" + path + "/");
    if (path === "search") {
      const field = incoming.get("search_field"), value = incoming.get("search_value");
      if (!["tmdb_movie_id", "tmdb_tv_id"].includes(field) || !/^\d+$/.test(value || "")) return json({ error: "Bad search" }, 400);
      url.searchParams.set("search_field", field);
      url.searchParams.set("search_value", value);
    } else if (/^title\/\d+\/sources$/.test(path)) {
      const regions = incoming.get("regions");
      if (regions) {
        if (!/^[A-Za-z]{2}(,[A-Za-z]{2})*$/.test(regions)) return json({ error: "Bad regions" }, 400);
        url.searchParams.set("regions", regions);
      }
    } else return json({ error: "Not allowed" }, 404);
    url.searchParams.set("apiKey", key);
    return forward(url, {}, 3600);
  }

  return json({ error: "Not found" }, 404);
}
