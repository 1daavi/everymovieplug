// Cloudflare Pages Function: /api/poster/w342/<file>.jpg - serves a TMDB poster from your own domain.
// The Watchlist page needs this to draw the share-collage on a canvas (images from another domain would block saving it).

export async function onRequestGet({ params }) {
  const size = params.size, file = params.file;
  if (!["w185", "w342", "w500"].includes(size) || !/^[\w.-]{5,60}\.jpg$/.test(file || "")) return new Response("Not found", { status: 404 });
  let r;
  try { r = await fetch(`https://image.tmdb.org/t/p/${size}/${file}`, { cf: { cacheEverything: true, cacheTtl: 60 * 60 * 24 * 30 } }); }
  catch { return new Response("Bad gateway", { status: 502 }); }
  if (!r.ok) return new Response("Not found", { status: 404 });
  return new Response(r.body, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=2592000, immutable" } });
}
