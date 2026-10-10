"""
Download TMDB images for the Every Movie Plug news posts and save them into articleassets/.

For each post it saves two files:
  <slug>.jpg       in-article image (1280x720)
  <slug>-full.jpg  1200x630 crop for og:image / twitter:image

Run it from the GitHub Action "Fetch TMDB images" (needs the TMDB_API_KEY secret), or locally:
  pip install requests pillow
  TMDB_API_KEY=your_key python scripts/fetch_tmdb_images.py

The images are saved as ordinary files in your repo, so your pages keep working after you
remove the TMDB key. Nothing on the live site calls TMDB for these images.

Notes
  * Posts whose two image files already exist are skipped. Set FORCE=1 to download them again.
  * To fix a wrong match, replace the title with the TMDB id, e.g. ("movie", 1234567, None).
    The id is the number in the TMDB page address (themoviedb.org/movie/1234567-name).
  * The title can be a list of alternatives; they are tried in order.
"""
import io
import os
import sys

import requests
from PIL import Image, ImageFilter

# slug: (movie|tv, title | [titles] | tmdb_id, year or None)
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
    # October 10 posts
    "other-mommy-box-office-opening": ("movie", "Other Mommy", 2026),
    "social-reckoning-box-office-opening": ("movie", "The Social Reckoning", 2026),
    "digger-second-weekend-box-office": ("movie", "Digger", 2026),
    "little-house-on-the-prairie-season-2-wraps": ("tv", "Little House on the Prairie", 2026),
    "netflix-garuda-carolina-caroline-never-surrender-dates": (
        "movie", ["Garuda: Dare to Dream", "Garuda di Dadaku"], None),
}

API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"
OUT_DIR = "articleassets"
W, H = 1280, 720          # in-article image
OG_W, OG_H = 1200, 630    # social card image


def _auth(key):
    # A v4 "Read Access Token" is a long JWT; a v3 API key is 32 characters.
    if len(key) > 40:
        return {"Authorization": f"Bearer {key}"}, {}
    return {}, {"api_key": key}


def api_get(path, key, **params):
    headers, base = _auth(key)
    r = requests.get(f"{API}{path}", params={**base, **params}, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def download(url):
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert("RGB")


def year_of(hit):
    d = hit.get("release_date") or hit.get("first_air_date") or ""
    return int(d[:4]) if d[:4].isdigit() else None


def find_hit(kind, query, year, key):
    """Return a TMDB result dict, or None."""
    if isinstance(query, int):
        d = api_get(f"/{kind}/{query}", key)
        return d if (d.get("backdrop_path") or d.get("poster_path")) else None
    candidates = query if isinstance(query, list) else [query]
    year_param = "primary_release_year" if kind == "movie" else "first_air_date_year"
    for title in candidates:
        for use_year in ([True, False] if year else [False]):
            params = {"query": title}
            if use_year:
                params[year_param] = year
            results = api_get(f"/search/{kind}", key, **params).get("results", [])
            results = [r for r in results if r.get("backdrop_path") or r.get("poster_path")]
            if results:
                return results[0]
    return None


def pick_backdrop(kind, tmdb_id, hit, key):
    """Prefer a clean (no text) backdrop with the best rating; fall back to the main one."""
    try:
        imgs = api_get(f"/{kind}/{tmdb_id}/images", key, include_image_language="en,null")
        clean = sorted((b for b in imgs.get("backdrops", []) if b.get("iso_639_1") is None),
                       key=lambda b: b.get("vote_average", 0), reverse=True)
        if clean:
            return clean[0]["file_path"]
    except requests.RequestException:
        pass
    return hit.get("backdrop_path")


def cover(img, w, h):
    """Scale and centre-crop to exactly w x h."""
    scale = max(w / img.width, h / img.height)
    img = img.resize((max(w, round(img.width * scale)), max(h, round(img.height * scale))), Image.LANCZOS)
    left, top = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((left, top, left + w, top + h))


def poster_on_blur(poster, w, h):
    """Posters are portrait: put one on a blurred, enlarged copy of itself so a wide slot still looks good."""
    bg = cover(poster, w, h).filter(ImageFilter.GaussianBlur(28))
    fg = poster.resize((round(poster.width * h / poster.height), h), Image.LANCZOS)
    bg.paste(fg, ((w - fg.width) // 2, 0))
    return bg


def save_pair(slug, wide):
    wide = cover(wide, W, H)
    wide.save(os.path.join(OUT_DIR, f"{slug}.jpg"), "JPEG", quality=88, optimize=True)
    cover(wide, OG_W, OG_H).save(os.path.join(OUT_DIR, f"{slug}-full.jpg"), "JPEG", quality=85, optimize=True)


def main():
    key = os.environ.get("TMDB_API_KEY")
    if not key:
        sys.exit("Set TMDB_API_KEY first (TMDB account > Settings > API).")
    force = os.environ.get("FORCE") == "1"
    os.makedirs(OUT_DIR, exist_ok=True)
    missing = []

    for slug, (kind, query, year) in TITLES.items():
        a = os.path.join(OUT_DIR, f"{slug}.jpg")
        b = os.path.join(OUT_DIR, f"{slug}-full.jpg")
        if not force and os.path.exists(a) and os.path.exists(b):
            print(f"[SKIP] {slug}: images already exist")
            continue
        try:
            hit = find_hit(kind, query, year, key)
            if not hit:
                raise LookupError(f"no TMDB match for {query!r} ({year})")
            name = hit.get("title") or hit.get("name")
            print(f"[OK]   {slug}: {name} ({year_of(hit)}) id={hit['id']}")
            path = pick_backdrop(kind, hit["id"], hit, key)
            if path:
                wide = cover(download(f"{IMG}/w1280{path}"), W, H)
            else:
                print(f"       only a poster exists for {name}; using it on a blurred background")
                wide = poster_on_blur(download(f"{IMG}/w780{hit['poster_path']}"), W, H)
            save_pair(slug, wide)
        except Exception as e:  # keep going so one bad title doesn't block the others
            print(f"[MISS] {slug}: {e}")
            print(f"::warning::{slug}: {e}")
            missing.append(slug)

    print()
    if missing:
        print("Missing images for:", ", ".join(missing))
        print("Fix those lines in TITLES (try the TMDB id) and run the workflow again.")
    else:
        print("Done. All images are in place.")


if __name__ == "__main__":
    main()
