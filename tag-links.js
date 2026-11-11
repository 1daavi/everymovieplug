/**
 * Every Movie Plug - clickable tags (shared by every page).
 *
 *  - Story pages: the category label on each "Related" card (Film News, Gaming Guide, ...) becomes a link
 *    to /news/?tag=... or /articles/?tag=..., which shows every story with that tag.
 *  - Home page: any <a class="tag-link" href="/news/?tag=..."> gets the same hover + click animation.
 *  - Listing pages (/news/, /articles/): build-listings.js handles the tags itself, and uses EMPTag.burst() from here.
 *
 * Tags are never underlined. Hover: lift, glow, shimmer sweep, "#" slides in. Click: pop + ring + sparks, page fades out.
 */
(function () {
  if (window.EMPTag) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var css = [
    ".emp-taglink{cursor:pointer;overflow:hidden;text-decoration:none!important;-webkit-tap-highlight-color:transparent;",
    "transition:transform .35s cubic-bezier(.34,1.56,.64,1),background .3s ease,color .3s ease,border-color .3s ease,box-shadow .3s ease}",
    "a.emp-taglink{position:relative;display:inline-block}",
    ".emp-taglink::before{content:'#';display:inline-block;max-width:0;margin-right:0;opacity:0;overflow:hidden;vertical-align:top;transform:translateX(-4px);",
    "transition:max-width .3s ease,margin .3s ease,opacity .3s ease,transform .3s ease}",
    ".emp-taglink::after{content:'';position:absolute;top:0;bottom:0;left:0;width:100%;pointer-events:none;",
    "background:linear-gradient(100deg,transparent 25%,rgba(255,255,255,.5) 50%,transparent 75%);transform:translateX(-130%) skewX(-20deg)}",
    ".emp-card-tag.emp-taglink{z-index:4}",
    "@media (hover:hover){",
    ".emp-taglink:hover{transform:translateY(-2px) scale(1.09);background:linear-gradient(135deg,#a855f7,#7c3aed)!important;color:#fff!important;",
    "box-shadow:0 8px 20px rgba(168,85,247,.55),0 0 0 4px rgba(168,85,247,.2)}",
    ".emp-taglink:hover::before{max-width:1em;margin-right:3px;opacity:1;transform:none}",
    ".emp-taglink:hover::after{transform:translateX(130%) skewX(-20deg);transition:transform .7s ease}}",
    ".emp-taglink:active{transform:scale(.9);transition-duration:.1s}",
    ".emp-taglink:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}",
    ".emp-tag-pop{animation:emp-pop .5s cubic-bezier(.34,1.56,.64,1)}",
    "@keyframes emp-pop{0%{transform:scale(1)}35%{transform:scale(.84)}70%{transform:scale(1.16)}100%{transform:scale(1)}}",
    ".emp-burst{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none}",
    ".emp-burst b{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:2px solid #c4b5fd;animation:emp-ring .7s ease-out forwards}",
    ".emp-burst i{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#c4b5fd;box-shadow:0 0 10px #a855f7;animation:emp-spark .65s cubic-bezier(.2,.8,.2,1) forwards}",
    "@keyframes emp-ring{from{transform:scale(.3);opacity:.95}to{transform:scale(4.6);opacity:0}}",
    "@keyframes emp-spark{0%{opacity:1;transform:rotate(var(--a)) translateX(6px) scale(1)}100%{opacity:0;transform:rotate(var(--a)) translateX(50px) scale(.2)}}",
    "html.emp-tag-leaving body{opacity:0;filter:blur(3px);transition:opacity .32s ease,filter .32s ease}",
    "@media (prefers-reduced-motion:reduce){.emp-burst{display:none}.emp-taglink,.emp-taglink::before{transition-duration:.01ms!important}.emp-tag-pop{animation:none}html.emp-tag-leaving body{transition:none}}"
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  /* ring + sparks that fly out from the tag that was clicked */
  function burst(el) {
    if (reduce || !el || !el.getBoundingClientRect) return;
    var r = el.getBoundingClientRect(), b = document.createElement("span"), html = "<b></b>";
    b.className = "emp-burst";
    b.style.left = (r.left + r.width / 2) + "px";
    b.style.top = (r.top + r.height / 2) + "px";
    for (var i = 0; i < 8; i++) html += '<i style="--a:' + (i * 45) + 'deg"></i>';
    b.innerHTML = html;
    document.body.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 800);
  }
  function pop(el) {
    el.classList.remove("emp-tag-pop"); void el.offsetWidth; el.classList.add("emp-tag-pop");
  }
  function go(url, el) {
    burst(el); pop(el);
    if (reduce) { location.href = url; return; }
    document.documentElement.classList.add("emp-tag-leaving");
    setTimeout(function () { location.href = url; }, 340);
  }
  function tagUrl(section, tag) {
    return "/" + section + "/?tag=" + encodeURIComponent(tag).replace(/%20/g, "+");
  }
  function plainClick(e) {
    return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }

  /* related-story cards on a story page: the label is inside the card's own <a>, so it is a role="link" span */
  function bindCardTag(el) {
    if (el.classList.contains("emp-taglink") || el.hasAttribute("data-tag")) return;
    var tag = el.textContent.trim(), card = el.closest("a[href]");
    if (!tag || !card || /^sponsored/i.test(tag)) return;
    var href = card.getAttribute("href") || "";
    var section = href.indexOf("/articles/") > -1 ? "articles" : href.indexOf("/news/") > -1 ? "news" : "";
    if (!section) return;
    var url = tagUrl(section, tag);
    el.classList.add("emp-taglink");
    el.setAttribute("role", "link"); el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", "See all " + tag + " stories");
    el.addEventListener("click", function (e) {
      if (!plainClick(e)) return;
      e.preventDefault(); e.stopPropagation(); go(url, el);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); go(url, el); }
    });
  }
  /* real links: <a class="tag-link" href="/news/?tag=Film+News"> */
  function bindLink(a) {
    if (a.classList.contains("emp-taglink")) return;
    a.classList.add("emp-taglink");
    a.addEventListener("click", function (e) {
      if (!plainClick(e)) return;
      e.preventDefault(); go(a.href, a);
    });
  }
  function scan(root) {
    root = root || document;
    var cards = root.querySelectorAll ? root.querySelectorAll(".emp-card-tag") : [];
    for (var i = 0; i < cards.length; i++) bindCardTag(cards[i]);
    var links = root.querySelectorAll ? root.querySelectorAll("a.tag-link") : [];
    for (var j = 0; j < links.length; j++) bindLink(links[j]);
  }

  window.EMPTag = { burst: burst, pop: pop, url: tagUrl, scan: scan };

  function init() {
    scan();
    if (window.MutationObserver) {                       /* cards / popups that are added after the page loads */
      var t;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 60); }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  /* coming back with the Back button: undo the fade-out */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) document.documentElement.classList.remove("emp-tag-leaving");
  });
})();
