/**
 * Blog plugin for Docsify.
 * Owns route-level enhancements only: page state, reader chrome, and footer.
 */
(function () {
  'use strict';

  function isHome(vm) {
    var p = (vm.route.path || '').replace(/^\//, '');
    return p === '' || p === 'home.md' || p === 'README.md';
  }

  var tocScrollHandler = null;

  function setPageType(vm) {
    var body = document.body;
    body.classList.toggle('home-page', isHome(vm));
    body.classList.toggle('article-page', !isHome(vm));
  }

  function clearTocTracking() {
    if (tocScrollHandler) {
      window.removeEventListener('scroll', tocScrollHandler);
      tocScrollHandler = null;
    }
  }

  function clearReaderChrome() {
    clearTocTracking();

    // Docsify reuses the content container between routes. Restore its normal
    // shape before rendering the home page, otherwise the old article TOC can
    // survive beside the new home Markdown.
    document.querySelectorAll('.blog-reading-layout').forEach(function (layout) {
      var section = layout.querySelector('.markdown-section');
      if (section && layout.parentNode) {
        layout.parentNode.insertBefore(section, layout);
      }
      layout.remove();
    });

    document.querySelectorAll('.article-breadcrumb, .article-toc').forEach(function (element) {
      element.remove();
    });
  }

  function createFooter() {
    document.querySelectorAll('.blog-footer').forEach(function (footer) {
      footer.remove();
    });

    var footer = document.createElement('footer');
    footer.className = 'blog-footer';
    footer.innerHTML = [
      '<div class="blog-footer__contacts" aria-label="联系我">',
      '  <a class="blog-footer__icon" href="mailto:zexi@zexi.me" aria-label="发送邮件至 zexi@zexi.me" title="zexi@zexi.me">',
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 3.24-8 5-8-5V6l8 5 8-5v1.24Z"/></svg>',
      '  </a>',
      '  <a class="blog-footer__icon" href="https://x.com/zexi_me" target="_blank" rel="noopener" aria-label="在 X 关注 @zexi_me" title="@zexi_me">',
      '    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.24l-4.89-6.4L6.47 22H3.36l7.25-8.29L2.96 2h6.4l4.42 5.84L18.9 2Zm-1.09 18h1.72L8.42 3.9H6.58L17.81 20Z"/></svg>',
      '  </a>',
      '</div>',
      '<a class="blog-footer__icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">京ICP备2022027945号-3</a>'
    ].join('\n');

    var main = document.querySelector('.content') || document.getElementById('app');
    if (main) main.appendChild(footer);
  }

  function createBreadcrumb(section, pageTitle) {
    var existing = section.querySelector('.article-breadcrumb');
    if (existing) existing.remove();

    var breadcrumb = document.createElement('nav');
    breadcrumb.className = 'article-breadcrumb';
    breadcrumb.setAttribute('aria-label', '面包屑导航');

    var home = document.createElement('a');
    home.href = '#/';
    home.textContent = '首页';

    var separator = document.createElement('span');
    separator.className = 'article-breadcrumb__separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '/';

    var current = document.createElement('span');
    current.className = 'article-breadcrumb__current';
    current.setAttribute('aria-current', 'page');
    current.textContent = pageTitle || '文章';

    breadcrumb.appendChild(home);
    breadcrumb.appendChild(separator);
    breadcrumb.appendChild(current);
    section.insertBefore(breadcrumb, section.firstChild);
  }

  function createTableOfContents(section) {
    var headings = Array.prototype.slice.call(section.querySelectorAll('h2, h3'));
    if (headings.length === 0) return null;

    var route = window.location.hash.split('?')[0] || '#/';
    var toc = document.createElement('aside');
    toc.className = 'article-toc';
    toc.setAttribute('aria-label', '文章目录');

    var title = document.createElement('strong');
    title.className = 'article-toc__title';
    title.textContent = '文章目录';

    var list = document.createElement('ol');
    list.className = 'article-toc__list';

    headings.forEach(function (heading, index) {
      var id = heading.id || ('section-' + (index + 1));
      heading.id = id;

      var item = document.createElement('li');
      item.className = 'article-toc__item article-toc__item--' + heading.tagName.toLowerCase();

      var link = document.createElement('a');
      link.className = 'article-toc__link';
      link.href = route + '?id=' + encodeURIComponent(id);
      link.setAttribute('data-target', id);
      link.textContent = heading.textContent.trim();

      item.appendChild(link);
      list.appendChild(item);
    });

    toc.appendChild(title);
    toc.appendChild(list);

    return { element: toc, headings: headings };
  }

  function trackTableOfContents(reader) {
    clearTocTracking();
    if (!reader) return;

    var links = Array.prototype.slice.call(reader.element.querySelectorAll('.article-toc__link'));
    function updateActiveLink() {
      var activeId = reader.headings[0].id;
      reader.headings.forEach(function (heading) {
        if (heading.getBoundingClientRect().top <= 150) activeId = heading.id;
      });
      links.forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('data-target') === activeId);
      });
    }

    tocScrollHandler = updateActiveLink;
    window.addEventListener('scroll', tocScrollHandler, { passive: true });
    updateActiveLink();
  }

  function createReaderChrome(pageTitle) {
    clearTocTracking();

    var section = document.querySelector('.markdown-section');
    if (!section) return;

    var layout = section.parentElement;
    if (!layout || !layout.classList.contains('blog-reading-layout')) {
      layout = document.createElement('div');
      layout.className = 'blog-reading-layout';
      section.parentNode.insertBefore(layout, section);
      layout.appendChild(section);
    }

    layout.querySelectorAll('.article-toc').forEach(function (toc) { toc.remove(); });
    createBreadcrumb(section, pageTitle);

    var reader = createTableOfContents(section);
    if (reader) {
      layout.appendChild(reader.element);
      trackTableOfContents(reader);
    }
  }

  var plugin = function (hook, vm) {
    hook.beforeEach(function (content) {
      setPageType(vm);

      // Strip YAML frontmatter
      var reg = /^---\n([\s\S]*?)\n---\n/;
      var match = content.match(reg);
      return match ? content.replace(reg, '') : content;
    });

    hook.doneEach(function () {
      setPageType(vm);

      // Page title
      var h1 = document.querySelector('.markdown-section h1');
      var pageTitle = h1 ? h1.textContent.trim() : '';
      document.title = isHome(vm) ? "Zexi's Blog" : ((pageTitle || "Zexi's Blog") + " · Zexi's Blog");

      if (isHome(vm)) clearReaderChrome();
      else createReaderChrome(pageTitle);

      // Footer keeps contact methods independent, compact, and accessible.
      createFooter();

      // Strip year prefix from timeline dates
      document.querySelectorAll('.tl-date').forEach(function(el) {
        var m = el.textContent.match(/^(\d{4})-(.+)$/);
        if (m) el.textContent = m[2];
      });

      // Lazy-load mermaid
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
          'import mermaid from "/assets/mermaid/mermaid.esm.min.mjs";',
          'mermaid.initialize({ startOnLoad: false });',
          'mermaid.run({ nodes: document.querySelectorAll(".mermaid") });',
        ].join('\n');
        document.head.appendChild(s);
      })();
    });
  };

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(plugin);
})();
