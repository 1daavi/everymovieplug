"""
Download TMDB images for the Every Movie Plug news posts.

Setup (once):   pip install requests pillow
Run:            TMDB_API_KEY=your_key python fetch_tmdb_images.py
Windows (PS):   $env:TMDB_API_KEY="your_key"; python fetch_tmdb_images.py

For each post it saves into ./articleassets/:
  <slug>.jpg       in-article image (TMDB backdrop, 1280 px wide)
  <slug>-full.jpg  1200x630 crop for og:image / twitter:image
Check the printed matches. If one is the wrong title, fix it and re-run.

NEW STORIES NEED NO EDITS HERE. Put one line in the story's <head>:
    <meta name="tmdb" content="movie|Animals|2026">      (kind | title | year)
    <meta name="tmdb" content="tv|The White Lotus|">     (year can be left empty)
and this script fetches images for every news page that does not have them yet.
Stories that already have both images are skipped; use  --force  to re-download all.
The TITLES list below only covers the older stories that have no <meta name="tmdb"> line.
"""
import glob, io, os, re, sys
import requests
from PIL import Image

KEY = os.environ.get("TMDB_API_KEY")
if not KEY:
    sys.exit("Set TMDB_API_KEY first (TMDB account > Settings > API).")

# slug: (movie|tv, title, year)
TITLES = {
    "verity-box-office-opening": ("movie", "Verity", 2026),
    "digger-opening-weekend-box-office": ("movie", "Digger", 2026),
    "endgame-encore-second-weekend-drop": ("movie", "Avengers: Endgame", 2019),
    "spider-man-brand-new-day-domestic-total": ("movie", "Spider-Man: Brand New Day", 2026),
    "holdovers-resident-evil-heart-of-the-beast": ("movie", "Resident Evil", 2026),
    "disclosure-day-streaming-peacock": ("movie", "Disclosure Day", 2026),
    "netflix-renews-a-different-world-crew-girl": ("tv", "A Different World", 2026),
    "tv-casting-roundup-white-lotus-darkwing-duck": ("tv", "The White Lotus", None),
    "october-2026-what-to-watch-tv-streaming": ("tv", "The Diplomat", None),
}

FORCE = "--force" in sys.argv
META = re.compile(r'<meta[^>]+name=["\']tmdb["\'][^>]*content=["\']([^"\']+)["\']', re.I)
for page in sorted(glob.glob("news/*.html")):
    slug = os.path.splitext(os.path.basename(page))[0]
    if slug == "index":
        continue
    m = META.search(open(page, encoding="utf-8").read())
    if not m:
        continue
    kind, _, rest = m.group(1).partition("|")
    title, _, year = rest.partition("|")
    TITLES[slug] = (kind.strip(), title.strip(), int(year) if year.strip().isdigit() else None)

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"
auth = {"Authorization": f"Bearer {KEY}"} if len(KEY) > 40 else {}
base = {} if auth else {"api_key": KEY}
os.makedirs("articleassets", exist_ok=True)

def get(path, **params):
    r = requests.get(f"{API}{path}", params={**base, **params}, headers=auth, timeout=30)
    r.raise_for_status()
    return r.json()

def pick_backdrop(kind, tmdb_id, fallback):
    imgs = get(f"/{kind}/{tmdb_id}/images", include_image_language="en,null")
    # prefer clean backdrops with no text (language null), highest rated
    clean = sorted([b for b in imgs.get("backdrops", []) if b.get("iso_639_1") is None],
                   key=lambda b: b.get("vote_average", 0), reverse=True)
    return (clean[0]["file_path"] if clean else fallback)

def crop_og(img, w=1200, h=630):
    img = img.convert("RGB")
    scale = max(w / img.width, h / img.height)
    img = img.resize((int(img.width * scale) + 1, int(img.height * scale) + 1), Image.LANCZOS)
    left, top = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))

for slug, (kind, title, year) in TITLES.items():
    if not FORCE and os.path.exists(f"articleassets/{slug}.jpg") and os.path.exists(f"articleassets/{slug}-full.jpg"):
        print(f"[skip] {slug}: images already exist")
        continue
    params = {"query": title}
    if year:
        params["primary_release_year" if kind == "movie" else "first_air_date_year"] = year
    results = get(f"/search/{kind}", **params).get("results", [])
    results = [r for r in results if r.get("backdrop_path") or r.get("poster_path")]
    if not results:
        print(f"[MISS] {slug}: no TMDB match for {title!r} ({year})")
        continue
    hit = results[0]
    name = hit.get("title") or hit.get("name")
    date = hit.get("release_date") or hit.get("first_air_date")
    print(f"[OK]   {slug}: {name} ({date}) id={hit['id']}")
    path = pick_backdrop(kind, hit["id"], hit.get("backdrop_path") or hit.get("poster_path"))
    data = requests.get(f"{IMG}/w1280{path}", timeout=60).content
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.save(f"articleassets/{slug}.jpg", "JPEG", quality=88, optimize=True)
    crop_og(img).save(f"articleassets/{slug}-full.jpg", "JPEG", quality=85, optimize=True)

print("\nDone. Upload the articleassets/ folder to your site.")
