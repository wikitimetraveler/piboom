/**
 * Shared switcher for the public Open Lender Suite.
 * Development work by David Lane
 */
(function () {
  'use strict';

  var ITEMS = [
    { href: '/open/', label: 'Lender Suite', test: function (path) { return path === '/open' || path === '/open/'; } },
    { href: '/finance/disasters-unified.html', label: 'Disasters', test: function (path) { return path.indexOf('/finance/disasters-') === 0; } },
    { href: '/gse-analyzer.html', label: 'GSE analyzer', test: function (path) { return path === '/gse-analyzer.html'; } },
    { href: '/finance/calc-engine-webgpu.html', label: 'Graph calc', test: function (path) { return path === '/finance/calc-engine-webgpu.html'; } },
    { href: '/finance/loan-flight-sim.html', label: 'Flight sim', test: function (path) { return path === '/finance/loan-flight-sim.html'; } },
    { href: '/ead/', label: 'FHA EAD', test: function (path) { return path === '/ead' || path === '/ead/' || path.indexOf('/ead/') === 0; } },
    { href: '/finance/encompass-assistant.html', label: 'Encompass Expert', test: function (path) { return path === '/finance/encompass-assistant.html'; } }
  ];

  function ensureCss() {
    if (document.querySelector('link[href="/shared/css/open-suite-bar.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/shared/css/open-suite-bar.css';
    document.head.appendChild(link);
  }

  function mount() {
    ensureCss();
    if (document.querySelector('.open-suite-bar')) return;
    var path = (location.pathname || '').toLowerCase();
    var bar = document.createElement('nav');
    bar.className = 'open-suite-bar';
    bar.setAttribute('aria-label', 'Open Lender Suite');
    ITEMS.forEach(function (item) {
      var link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.label;
      if (item.test(path)) link.setAttribute('aria-current', 'page');
      bar.appendChild(link);
    });
    var navbar = document.querySelector('modern-navbar');
    if (navbar && navbar.parentNode) {
      navbar.insertAdjacentElement('afterend', bar);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
