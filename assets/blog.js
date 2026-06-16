/**
 * Blog plugin for Docsify.
 * Handles: frontmatter meta bar, breadcrumb, footer, sidebar on right.
 */
(function () {
  'use strict';

  // Store frontmatter dates keyed by path
  var _metaStore = {};

  function isHome(vm) {
    var p = (vm.route.path || '').replace(/^\//, '');
    return p === '' || p === 'home.md' || p === 'README.md';
  }

  function getPageTitle(html) {
    var m = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    return m ? m[1].trim() : '';
  }

  function parseFrontmatterDates(content) {
    var created = '', updated = '';
    var mCreated = content.match(/^created_at:\s*"?([^"\n]+)"?/m);
    var mUpdated = content.match(/^updated_at:\s*"?([^"\n]+)"?/m);
    if (mCreated) created = mCreated[1].trim();
    if (mUpdated) updated = mUpdated[1].trim();
    return { created: created, updated: updated || created };
  }

  function fmtDate(dateStr) {
    // e.g. "2026-06-12 17:33:57 +0800" → "2026-06-12"
    if (!dateStr) return '';
    return dateStr.substring(0, 10);
  }

  var plugin = function (hook, vm) {
    // --- Frontmatter → meta bar ---
    hook.beforeEach(function (content) {
      var body = document.body;
      var scopedRoot = document.getElementById('app') || document.querySelector('.content') || body;

      // Set page type class as early as possible to avoid first-frame flash.
      if (isHome(vm)) {
        body.classList.add('home-page');
        body.classList.remove('article-page');
        if (scopedRoot) {
          scopedRoot.classList.add('home-page');
          scopedRoot.classList.remove('article-page');
        }
      } else {
        body.classList.add('article-page');
        body.classList.remove('home-page');
        if (scopedRoot) {
          scopedRoot.classList.add('article-page');
          scopedRoot.classList.remove('home-page');
        }
      }

      // Frontmatter meta bar: extract dates, render on article pages
      var reg = /^---\n([\s\S]*?)\n---\n/;
      var match = content.match(reg);
      if (match) {
        var frontmatter = match[1];
        var dates = parseFrontmatterDates(frontmatter);
        _metaStore[vm.route.path] = dates;
      }
      if (!match) return content;
      return content.replace(reg, '');
    });

    // --- After render: page type class, footer, breadcrumb ---
    hook.doneEach(function () {
      var main = document.querySelector('.content');
      if (!main) return;

      var body = document.body;
      var scopedRoot = document.getElementById('app') || document.querySelector('.content') || body;

      // Page type: home hides sidebar; article shows it on the right
      if (isHome(vm)) {
        if (scopedRoot) scopedRoot.classList.add('home-page');
        if (scopedRoot) scopedRoot.classList.remove('article-page');
        body.classList.add('home-page');
        body.classList.remove('article-page');
      } else {
        if (scopedRoot) scopedRoot.classList.add('article-page');
        if (scopedRoot) scopedRoot.classList.remove('home-page');
        body.classList.add('article-page');
        body.classList.remove('home-page');
      }

      // Footer
      if (!document.querySelector('.blog-footer')) {
        var f = document.createElement('div');
        f.className = 'blog-footer';
        f.innerHTML = '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">京ICP备2022027945号-3</a>';
        main.appendChild(f);
      }

      var applyChrome = function () {
        var currentMain = document.querySelector('.content');
        if (!currentMain) return;
        var currentH1 = currentMain.querySelector('.markdown-section h1');
        var pageTitle = currentH1 ? currentH1.textContent.trim() : getPageTitle(currentMain.innerHTML);

        document.title = isHome(vm) ? "Zexi's Blog" : ((pageTitle || "Zexi's Blog") + " · Zexi's Blog");

        // Hide article page h1 (title already shown in breadcrumb)
        if (!isHome(vm) && currentH1) {
          currentH1.style.display = 'none';
        }

        // Replace sidebar "首页" with h1 title on article pages, make it clickable to scroll top
        if (!isHome(vm) && pageTitle) {
          var firstNavItem = document.querySelector('.sidebar-nav > ul > li');
          var firstNavLink = firstNavItem ? firstNavItem.querySelector(':scope > a, :scope > p > a') : null;
          if (firstNavLink && firstNavLink.textContent.trim() === '首页') {
            firstNavLink.textContent = pageTitle;
            firstNavLink.setAttribute('href', 'javascript:void(0)');
            firstNavLink.onclick = function(e) {
              e.preventDefault();
              e.stopPropagation();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return false;
            };
          }

          // Scroll spy: activate h1 when at top, otherwise let docsify handle h2/h3
          var scrollSpy = function() {
            var scrollTop = window.scrollY || document.documentElement.scrollTop;
            if (scrollTop < 100) {
              if (firstNavItem) firstNavItem.classList.add('active');
              document.querySelectorAll('.app-sub-sidebar li').forEach(function(li) {
                li.classList.remove('active');
              });
            } else {
              if (firstNavItem) firstNavItem.classList.remove('active');
            }
          };
          window.removeEventListener('scroll', scrollSpy);
          window.addEventListener('scroll', scrollSpy);
          scrollSpy();
        }

        var oldBc = document.querySelector('.blog-breadcrumb');
        if (oldBc) oldBc.remove();
        var oldMeta = document.querySelector('.blog-meta');
        if (oldMeta) oldMeta.remove();
        if (!isHome(vm) && pageTitle) {
          var bc = document.createElement('div');
          bc.className = 'blog-breadcrumb';
          bc.innerHTML = '<a href="#/">Zexi\'s Blog</a><span class="sep"> / </span><span class="current">' + pageTitle + '</span>';
          currentMain.insertBefore(bc, currentMain.firstElementChild);

          // Insert meta bar (dates) between breadcrumb and markdown-section
          var dates = _metaStore[vm.route.path];
          if (dates && (dates.created || dates.updated)) {
            var meta = document.createElement('div');
            meta.className = 'blog-meta';
            var parts = [];
            if (dates.updated) {
              parts.push('<span>' + fmtDate(dates.updated) + '</span>');
            }
            if (parts.length) {
              meta.innerHTML = parts.join('');
              // Insert after breadcrumb (bc was just inserted before firstElementChild)
              var nextSibling = bc.nextSibling;
              if (nextSibling) {
                currentMain.insertBefore(meta, nextSibling);
              } else {
                currentMain.appendChild(meta);
              }
            }
          }
        }
      };

      applyChrome();
      setTimeout(applyChrome, 60);
      setTimeout(applyChrome, 300);
      setTimeout(applyChrome, 1000);

      // Lazy-load mermaid only on pages that have diagrams
      (function lazyMermaid() {
        var blocks = document.querySelectorAll('.markdown-section pre > code.language-mermaid');
        if (blocks.length === 0) return;
        blocks.forEach(function(block) {
          var pre = block.parentElement;
          var div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = block.textContent;
          pre.parentElement.replaceChild(div, pre);
        });
        var s = document.createElement('script');
        s.type = 'module';
        s.textContent = [
          'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";',
          'mermaid.initialize({ startOnLoad: false });',
          'mermaid.run({ nodes: document.querySelectorAll(".mermaid") });',
        ].join('\n');
        document.head.appendChild(s);
      })();
    });
  };

  // Push plugin into docsify's plugin array
  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(plugin);
})();
