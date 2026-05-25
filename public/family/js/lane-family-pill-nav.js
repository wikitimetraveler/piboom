/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Injects a compact pill nav below the site navbar on Lane /family/* pages.
 */
(function () {
  const LINKS = [
    { href: '/family/lane-family.html', label: 'Hub' },
    { href: '/family/lane-magazine.html', label: 'Issue 1', issue: '01' },
    { href: '/family/lane-magazine.html?issue=02', label: 'Issue 2', issue: '02' },
    { href: '/family/lane-major-achievers.html', label: 'Achievers' },
    { href: '/family/lane-historians.html', label: 'Historians' },
    { href: '/family/lane-museum.html', label: 'Museum' },
    { href: '/family/lane-trading-cards.html', label: 'Cards' },
    { href: '/family/lane-was-he-an-idiot.html', label: 'PS 1884' },
    { href: '/family/lane-war-history.html', label: 'War' },
    { href: '/family/lane-memorial-wall.html', label: 'Memorial' },
    { href: '/family/lane-occupations.html', label: 'Work' },
    { href: '/family/lane-pdf-gallery.html', label: 'Plates' },
    { href: '/family/lane-direct-ancestor-story.html', label: 'Line' },
    { href: '/family/genealogy-import.html', label: 'Import' }
  ];

  function normalizePath(p) {
    if (!p) return '/';
    let s = p.split('?')[0].split('#')[0];
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s || '/';
  }

  function mount() {
    if (document.getElementById('lanePillNav')) return;

    const path = normalizePath(window.location.pathname);
    const issueParam = new URLSearchParams(window.location.search).get('issue') || '01';
    const isFamily =
      path === '/family' || path.startsWith('/family/');
    if (!isFamily) return;

    const nav = document.createElement('nav');
    nav.id = 'lanePillNav';
    nav.className = 'lane-pill-nav';
    nav.setAttribute('aria-label', 'Lane family pages');
    nav.setAttribute('data-lane-tts-ignore', '');

    const inner = document.createElement('div');
    inner.className = 'lane-pill-nav__inner';

    const lab = document.createElement('span');
    lab.className = 'lane-pill-nav__label';
    lab.textContent = 'Lane';
    inner.appendChild(lab);

    LINKS.forEach((item) => {
      const a = document.createElement('a');
      a.className = 'lane-pill';
      a.href = item.href;
      a.textContent = item.label;
      const itemPath = normalizePath(item.href);
      const itemIssue = item.issue || null;
      const isMagazine = path === '/family/lane-magazine.html';
      const active =
        itemIssue && isMagazine
          ? itemIssue === issueParam || (itemIssue === '01' && issueParam === '1')
          : path === itemPath;
      if (active) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }
      inner.appendChild(a);
    });

    nav.appendChild(inner);

    const host = document.querySelector('modern-navbar');
    if (host && host.parentNode) {
      host.parentNode.insertBefore(nav, host.nextSibling);
    } else {
      document.body.insertBefore(nav, document.body.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
