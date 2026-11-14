// Cloudflare Pages Function: POST /api/share  - saves a shared Watchlist and its collage thumbnail.
// The browser sends the list (titles, poster paths) plus a 1200x630 JPEG collage it drew itself; this function stores
// both in Cloudflare KV under a random 8-character code and returns that code. The link is then  /w/<code>.
//
// Setup (one time): Cloudflare dashboard > Storage & databases > KV > Create a namespace (call it emp-watchlists).
//   Then Workers & Pages > your project > Settings > Bindings > Add > KV namespace:
//   Variable name  WATCHLISTS   -> choose that namespace.  Do it for Production (and Preview if you use it), then redeploy.
// Without that binding this function answers 501 and the site falls back to long links with no collage thumbnail.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const CODE_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no look-alike characters
const MAX_ITEMS = 200, MAX_IMAGE = 500000, KEEP_SECONDS = 60 * 60 * 24 * 400, PER_HOUR = 10;

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, x => CODE_CHARS[x % CODE_CHARS.length]).join("");
}
function cleanItem(i) {
  if (!i || (i.type !== "movie" && i.type !== "tv")) return null;
  const id = Number(i.id), title = String(i.title || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
  if (!Number.isInteger(id) || id < 1 || id > 99999999 || !title) return null;
  const rating = Number(i.rating);
  return {
    type: i.type, id, title,
    poster: /^\/[\w.-]{5,60}$/.test(i.poster || "") ? i.poster : "",
    year: /^\d{4}$/.test(String(i.year || "")) ? String(i.year) : "",
    rating: rating > 0 && rating <= 10 ? Math.round(rating * 10) / 10 : 0
  };
}

export async function onRequestPost({ request, env }) {
  const kv = env.WATCHLISTS;
  if (!kv) return json({ error: "no-storage" }, 501);

  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "forbidden" }, 403);

  // gentle limit: 10 new links per visitor per hour
  const ip = request.headers.get("cf-connecting-ip") || "unknown", slot = "rl:" + ip + ":" + Math.floor(Date.now() / 3600000);
  const used = Number(await kv.get(slot)) || 0;
  if (used >= PER_HOUR) return json({ error: "rate-limited" }, 429);

  let form, meta;
  try { form = await request.formData(); meta = JSON.parse(String(form.get("meta") || "")); } catch { return json({ error: "bad-request" }, 400); }
  const items = (Array.isArray(meta.items) ? meta.items : []).slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean);
  if (!items.length) return json({ error: "empty" }, 400);
  const name = String(meta.name || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

  let image = null;
  const file = form.get("image");
  if (file && typeof file !== "string") {
    if (file.size > MAX_IMAGE) return json({ error: "image-too-large" }, 413);
    const buf = await file.arrayBuffer(), b = new Uint8Array(buf);
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) image = buf;                // only real JPEG data is kept
  }

  let code = newCode();
  for (let n = 0; n < 3 && (await kv.get("wl:" + code)) !== null; n++) code = newCode();

  await kv.put("wl:" + code, JSON.stringify({ v: 1, name, items, created: Date.now(), img: !!image }), { expirationTtl: KEEP_SECONDS });
  if (image) await kv.put("wi:" + code, image, { expirationTtl: KEEP_SECONDS });
  await kv.put(slot, String(used + 1), { expirationTtl: 3700 });
  return json({ code });
}
