/**
 * Every Movie Plug - one definition of the site-wide navigation.
 * Used by build-listings.js (listing pages) and fix-nav.js (every story page), so a link is changed in ONE place.
 * All links are root-absolute (start with "/") so they work from any folder depth, e.g. /news/page/3/.
 */
const FOOTER_LINKS = [
  ["Home", "/"],
  ["Movies", "/movies/"],
  ["TV Shows", "/tv-shows/"],
  ["News", "/news/"],
  ["Articles", "/articles/"],
  ["About Us", "/about.html"],
  ["Contact", "mailto:contact@everymovieplug.com"],
  ["Privacy Policy", "/privacy-policy.html"],
  ["Terms of Service", "/terms-of-service.html"],
];

const TOP_LINKS = [
  ["&larr; Home", "/", "home"],
  ["Trending", "/trending", "trending"],
  ["Movies", "/movies/", "movies"],
  ["TV Shows", "/tv-shows/", "tv"],
  ["News", "/news/", "news"],
  ["Articles", "/articles/", "articles"],
  ["About", "/about.html", "about"],
];

const footerLinksHTML = (indent = "            ") =>
  FOOTER_LINKS.map(([t, h]) => `${indent}<a href="${h}">${t}</a>`).join("\n");

const footerHTML = () => `<footer class="site-footer">
        <div class="footer-links">
${footerLinksHTML()}
        </div>
        <p>&copy; Every Movie Plug</p>
    </footer>`;

const siteNavHTML = active => `<nav class="sitenav" aria-label="Site">
        ${TOP_LINKS.map(([t, h, k]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ""}>${t}</a>`).join("\n        ")}
    </nav>`;

module.exports = { FOOTER_LINKS, TOP_LINKS, footerLinksHTML, footerHTML, siteNavHTML };
