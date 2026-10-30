# everymovieplug

## News and Articles pages (15 per page)

`/news/` and `/articles/` are page 1; older stories live at `/news/page/2/`, `/news/page/3/` ... (same for articles).

**To publish a new story:** add its `.html` file to `news/` or `articles/` and push. The GitHub workflow runs
`node build-listings.js`, which re-sorts everything newest-first and rebuilds every listing page.
You can also run it yourself: `node build-listings.js` (or `--only=news`, `--only=articles`).

* `templates/` - the page layouts the builder fills in (edit these to change the look of the listing pages).
* `news/search-index.json`, `articles/search-index.json` - generated list of every story (also powers the search box).
  Use `node build-listings.js --refresh` to re-read titles, excerpts and thumbnails from the story files.
* `lib/site-nav.js` - the one place that defines the top menu and footer links. `node fix-nav.js` applies the footer to every story.
* `update-news.js` / `update-articles.js` are retired stubs that call the builder.
