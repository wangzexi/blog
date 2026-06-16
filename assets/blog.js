/**
 * Blog plugin for Docsify.
 * Strips frontmatter, sets page type class, injects footer.
 */
(function () {
  'use strict';

  function isHome(vm) {
    var p = (vm.route.path || '').replace(/^\//, '');
    return p === '' || p === 'home.md' || p === 'README.md';
  }

  var plugin = function (hook, vm) {
    hook.beforeEach(function (content) {
      var body = document.body;
      if (isHome(vm)) {
        body.classList.add('home-page');
        body.classList.remove('article-page');
      } else {
        body.classList.add('article-page');
        body.classList.remove('home-page');
      }

      // Strip YAML frontmatter
      var reg = /^---\n([\s\S]*?)\n---\n/;
      var match = content.match(reg);
      return match ? content.replace(reg, '') : content;
    });

    hook.doneEach(function () {
      var body = document.body;
      if (isHome(vm)) {
        body.classList.add('home-page');
        body.classList.remove('article-page');
      } else {
        body.classList.add('article-page');
        body.classList.remove('home-page');
      }

      // Page title
      var h1 = document.querySelector('.markdown-section h1');
      var pageTitle = h1 ? h1.textContent.trim() : '';
      document.title = isHome(vm) ? "Zexi's Blog" : ((pageTitle || "Zexi's Blog") + " · Zexi's Blog");

      // Footer (ICP)
      if (!document.querySelector('.blog-footer')) {
        var f = document.createElement('div');
        f.className = 'blog-footer';
        f.innerHTML = '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">京ICP备2022027945号-3</a>';
        var main = document.querySelector('.content') || document.getElementById('app');
        if (main) main.appendChild(f);
      }

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
          'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";',
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
