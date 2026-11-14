// Cloudflare Pages Function: GET /api/share/<code>  - returns a saved shared Watchlist as JSON.
// Used by watchlist.js as a backup when the /w/<code> page did not come with the list embedded.
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 ? "public, max-age=300" : "no-store" } });

export async function onRequestGet({ params, env }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  if (!env.WATCHLISTS || !/^[A-Za-z0-9]{8}$/.test(code || "")) return json({ error: "not-found" }, 404);
  const raw = await env.WATCHLISTS.get("wl:" + code);
  if (!raw) return json({ error: "not-found" }, 404);
  try { const d = JSON.parse(raw); return json({ name: d.name || "", items: d.items || [] }); }
  catch { return json({ error: "bad-data" }, 500); }
}
