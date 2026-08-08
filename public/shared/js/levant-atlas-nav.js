/**
 * Inject sibling nav: Home · Jordan · Syria · Palestine · Israel · Oman · Iran · Iraq · Lebanon · Egypt
 * Development work by David Lane
 */
(function () {
  'use strict';

  const LINKS = [
    { id: 'home', href: '/', label: 'Home', ar: null, home: true },
    { id: 'jordan', href: '/jordan/', label: 'Jordan', ar: 'الأردن' },
    { id: 'syria', href: '/syria/', label: 'Syria', ar: 'سوريا' },
    { id: 'holy-land', href: '/holy-land/', label: 'Palestine · Israel', ar: 'فلسطين · إسرائيل' },
    { id: 'oman', href: '/oman/', label: 'Oman', ar: 'عُمان' },
    { id: 'iran', href: '/iran/', label: 'Iran', ar: 'إيران' },
    { id: 'iraq', href: '/iraq/', label: 'Iraq', ar: 'العراق' },
    { id: 'lebanon', href: '/lebanon/', label: 'Lebanon', ar: 'لبنان' },
    { id: 'egypt', href: '/egypt/', label: 'Egypt', ar: 'مصر' }
  ];

  function activeId() {
    const path = String(window.location.pathname || '').toLowerCase();
    if (path.startsWith('/jordan')) return 'jordan';
    if (path.startsWith('/syria')) return 'syria';
    if (path.startsWith('/holy-land')) return 'holy-land';
    if (path.startsWith('/oman')) return 'oman';
    if (path.startsWith('/iran')) return 'iran';
    if (path.startsWith('/iraq')) return 'iraq';
    if (path.startsWith('/lebanon')) return 'lebanon';
    if (path.startsWith('/egypt')) return 'egypt';
    return 'home';
  }

  function build() {
    if (document.getElementById('levantAtlasNav')) return;

    const current = activeId();
    const nav = document.createElement('nav');
    nav.id = 'levantAtlasNav';
    nav.className = 'levant-atlas-nav';
    nav.setAttribute('aria-label', 'Atlas pages');

    const parts = [];
    LINKS.forEach((link, index) => {
      if (index === 1) parts.push('<span class="levant-atlas-nav__sep" aria-hidden="true"></span>');
      const active = link.id === current ? ' is-active' : '';
      const homeClass = link.home ? ' levant-atlas-nav__link--home' : '';
      const ar = link.ar
        ? `<span class="levant-atlas-nav__ar" lang="ar" dir="rtl">${link.ar}</span>`
        : '';
      const icon = link.home ? '<i class="bi bi-house-door-fill" aria-hidden="true"></i> ' : '';
      const ariaCurrent = link.id === current ? ' aria-current="page"' : '';
      parts.push(
        `<a class="levant-atlas-nav__link${homeClass}${active}" href="${link.href}"${ariaCurrent}>${icon}<span>${link.label}</span>${ar}</a>`
      );
    });

    nav.innerHTML = parts.join('');

    const navbar = document.querySelector('modern-navbar');
    if (navbar && navbar.parentNode) {
      navbar.insertAdjacentElement('afterend', nav);
      return;
    }
    document.body.insertAdjacentElement('afterbegin', nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
