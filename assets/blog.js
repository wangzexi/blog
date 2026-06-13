/**
 * Blog plugin for Docsify.
 * Handles: frontmatter meta bar, breadcrumb, footer, sidebar on right.
 */
(function () {
  'use strict';

  function isHome(vm) {
    var p = (vm.route.path || '').replace(/^\//, '');
    return p === '' || p === 'home.md' || p === 'README.md';
  }

  function getPageTitle(html) {
    var m = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    return m ? m[1].trim() : '';
  }

  var plugin = function (hook, vm) {
    // --- Frontmatter → meta bar ---
    hook.beforeEach(function (content) {
      var reg = /^---\n([\s\S]*?)\n---\n/;
      var match = content.match(reg);
      if (!match) return content;

      var meta = {};
      match[1].trim().split('\n').forEach(function (line) {
        var p = line.match(/^([^:]+):\s*(.*)$/);
        if (!p) return;
        var k = p[1].trim(), v = p[2].trim().replace(/^"|"$/g, '');
        if (k && v) meta[k] = v;
      });

      var created = meta.created_at || meta.careted_at || meta.create_at;
      var updated = meta.updated_at || meta.update_at || meta.updateat;
      if (!created && !updated) return content.replace(reg, '');

      var fmt = function (s) { return s.replace(/\s*[+-]\d{4}$/, ''); };
      var blocks = [];
      if (created) blocks.push('创建 ' + fmt(created));
      if (updated) blocks.push('更新 ' + fmt(updated));
      var metaHtml = '<div class="blog-meta"><span>' + blocks.join('</span><span>') + '</span></div>';
      return content.replace(reg, metaHtml + '\n');
    });

    // --- After render: page type class, footer, breadcrumb ---
    hook.doneEach(function () {
      var main = document.querySelector('.content');
      if (!main) return;

      var app = document.getElementById('app');

      // Page type: home hides sidebar; article shows it on the right
      if (isHome(vm)) {
        app.classList.add('home-page');
        app.classList.remove('article-page');
        document.title = "Zexi's Blog";
      } else {
        app.classList.add('article-page');
        app.classList.remove('home-page');
        document.title = getPageTitle(main.innerHTML) + " · Zexi's Blog";
      }

      // Footer
      if (!document.querySelector('.blog-footer')) {
        var f = document.createElement('div');
        f.className = 'blog-footer';
        f.innerHTML = '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">京ICP备2022027945号-3</a>';
        main.appendChild(f);
      }

      // Breadcrumb on article pages
      if (!isHome(vm)) {
        var old = document.querySelector('.blog-breadcrumb');
        if (old) old.remove();
        var title = getPageTitle(main.innerHTML);
        var bc = document.createElement('div');
        bc.className = 'blog-breadcrumb';
        bc.innerHTML = '<a href="#/">首页</a><span class="sep"> / </span><span class="current">' + title + '</span>';
        main.insertBefore(bc, main.firstElementChild);
      }
    });
  };

  // Push plugin into docsify's plugin array
  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(plugin);
})();
