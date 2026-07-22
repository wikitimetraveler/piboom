/**
 * Shared ice landing shell — dock, theme, page init.
 */
(function () {
  'use strict';

  const THEME_KEY = 'iceLandingTheme';

  function initThemeToggle() {
    const btn = document.getElementById('iceThemeToggle');
    if (!btn) return;

    function applyTheme(mode) {
      const dark = mode === 'dark';
      document.body.classList.toggle('dark-mode', dark);
      btn.textContent = mode === 'auto' ? 'AUTO' : mode === 'dark' ? 'DARK' : 'LIGHT';
      if (window.ICE_OCEAN_SCENE && window.ICE_OCEAN_SCENE.setNight) {
        window.ICE_OCEAN_SCENE.setNight(dark ? 1 : 0);
      }
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch (_) {}
    }

    function systemDark() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function resolveAuto() {
      try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') {
          applyTheme(saved);
          return;
        }
        if (saved === 'auto') {
          applyTheme(systemDark() ? 'dark' : 'light');
          btn.textContent = 'AUTO';
          return;
        }
      } catch (_) {}
      applyTheme(systemDark() ? 'dark' : 'light');
      btn.textContent = 'AUTO';
      try {
        localStorage.setItem(THEME_KEY, 'auto');
      } catch (_) {}
    }

    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      if (label === 'AUTO') applyTheme('light');
      else if (label === 'LIGHT') applyTheme('dark');
      else {
        try {
          localStorage.setItem(THEME_KEY, 'auto');
        } catch (_) {}
        applyTheme(systemDark() ? 'dark' : 'light');
        btn.textContent = 'AUTO';
      }
    });

    resolveAuto();
  }

  function initDock() {
    const dock = document.getElementById('iceDock');
    const active = document.body.getAttribute('data-ice-page');
    if (dock && window.SITE_PORTFOLIO && active) {
      dock.innerHTML = window.SITE_PORTFOLIO.renderDock(active);
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Split text into staggered character spans — handwriting reveal on load.
   * @returns {number} seconds until the write animation finishes
   */
  function initWriteOn(el, options) {
    const opts = options || {};
    const baseDelay = opts.baseDelay || 0;
    const charDelay = opts.charDelay || 0.07;
    const charDuration = opts.charDuration || 0.52;
    const text = (el.getAttribute('data-ice-write-text') || el.textContent || '').trim();
    if (!text) return baseDelay;

    el.setAttribute('data-ice-write-text', text);
    el.setAttribute('aria-label', text);
    el.textContent = '';
    el.classList.add('ice-write-on');

    const chars = [...text];
    chars.forEach((char, i) => {
      const span = document.createElement('span');
      span.className = 'ice-write-char';
      span.textContent = char === ' ' ? '\u00a0' : char;
      span.style.animationDelay = `${baseDelay + i * charDelay}s`;
      span.style.animationDuration = `${charDuration}s`;
      if (char === ' ') span.setAttribute('aria-hidden', 'true');
      el.appendChild(span);
    });

    const cursor = document.createElement('span');
    cursor.className = 'ice-write-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    el.appendChild(cursor);

    const finishAt = baseDelay + Math.max(chars.length - 1, 0) * charDelay + charDuration;
    window.setTimeout(() => {
      cursor.classList.add('ice-write-cursor--done');
      el.classList.add('ice-write-on--done');
    }, finishAt * 1000);

    return finishAt;
  }

  function initHeroWriteOn() {
    if (document.body.getAttribute('data-ice-page') !== 'home') return;

    const title = document.querySelector('[data-ice-write].ice-title');
    const firstLine = document.querySelector('.ice-scroll-line[data-ice-write]');
    const track = document.getElementById('iceRoleTrack');

    if (prefersReducedMotion()) {
      if (track) track.classList.add('is-scrolling');
      return;
    }

    if (track) track.style.animationPlayState = 'paused';

    let nextDelay = 0.35;
    if (title) {
      title.classList.add('ice-write-on--hero');
      nextDelay = initWriteOn(title, { baseDelay: nextDelay, charDelay: 0.17, charDuration: 0.72 });
    }

    if (firstLine) {
      const lineEnd = initWriteOn(firstLine, { baseDelay: nextDelay + 0.4, charDelay: 0.05 });
      if (track) {
        window.setTimeout(() => {
          track.style.animationPlayState = 'running';
          track.classList.add('is-scrolling');
        }, (lineEnd + 0.9) * 1000);
      }
    } else if (track) {
      track.style.animationPlayState = 'running';
      track.classList.add('is-scrolling');
    }
  }

  function initEasterEgg() {
    const title = document.querySelector('[data-easter-egg]');
    if (!title) return;
    let clickCount = 0;
    let clickTimer = null;
    title.addEventListener('click', () => {
      clickCount += 1;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 1000);
      if (clickCount >= 5) {
        document.body.style.transition = 'opacity 1.2s ease-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
          window.location.href = '/finance/encompass-hub.html';
        }, 1200);
        clickCount = 0;
      }
    });
  }

  function isDemoMode() {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '1') {
      try {
        localStorage.setItem('demoMode', '1');
      } catch (_) {}
      return true;
    }
    if (q === '0') {
      try {
        localStorage.removeItem('demoMode');
      } catch (_) {}
      return false;
    }
    try {
      return localStorage.getItem('demoMode') === '1';
    } catch (_) {
      return false;
    }
  }

  function initFeaturedAuth() {
    const links = document.querySelectorAll('.ice-featured__item[data-auth-required]');
    if (!links.length) return;

    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(script);
      });

    const ensureAuthScripts = () => {
      if (window.__featuredAuthScriptsReady) {
        return Promise.resolve();
      }
      return Promise.all([
        window.DEMO_USERS ? Promise.resolve() : loadScript('/shared/demo-users.js'),
        typeof window.isLoggedIn === 'function' ? Promise.resolve() : loadScript('/shared/user-login.js'),
      ]).then(() => {
        window.__featuredAuthScriptsReady = true;
      });
    };

    const toFinancePath = (href) => {
      try {
        const u = new URL(href, window.location.origin);
        return u.pathname + u.search + u.hash;
      } catch (_) {
        return href || '';
      }
    };

    const isFeaturedAuthed = () =>
      typeof window.isLoggedIn === 'function' &&
      window.isLoggedIn() &&
      typeof window.hasFinanceSessionCookie === 'function' &&
      window.hasFinanceSessionCookie();

    const setFeaturedReturnTo = (destPath) => {
      try {
        sessionStorage.setItem('featuredAuthReturnTo', destPath);
      } catch (_) {}
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('returnTo', destPath);
        url.searchParams.set('financeLogin', '1');
        history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString());
      } catch (_) {}
    };

    const openLoginForDest = (destPath) => {
      setFeaturedReturnTo(destPath);
      ensureAuthScripts()
        .then(() => {
          if (isFeaturedAuthed()) {
            window.location.assign(destPath);
            return;
          }
          if (typeof window.showLoginPopup === 'function') {
            window.showLoginPopup();
          }
        })
        .catch((err) => {
          console.error('Featured auth scripts failed to load', err);
        });
    };

    const PUBLIC_FINANCE_PATHS = {
      '/finance': true,
      '/finance/': true,
      '/finance/index.html': true,
      '/finance/fha-streamline-calculator.html': true,
      '/finance/fha-streamline-loan-amount-calculator.html': true,
      '/finance/fha-streamline-ntb-calculator.html': true,
      '/finance/asset-qualifier-calculator.html': true,
      '/finance/dti-calculator.html': true,
      '/finance/cashout-refinance-calculator.html': true,
      '/finance/amortization-schedule-calculator.html': true,
      '/finance/closing-cost-calculator.html': true,
      '/finance/ltv-calculator.html': true,
      '/finance/va-irrrl-calculator.html': true,
      '/finance/disasters-unified.html': true,
      '/finance/disasters-webcams.html': true,
    };

    const isPublicFinancePath = (pathOnly) => {
      const path = String(pathOnly || '').toLowerCase();
      if (PUBLIC_FINANCE_PATHS[path]) return true;
      if (window.MENU_CONFIG && typeof window.MENU_CONFIG.pathRequiresAuth === 'function') {
        return !window.MENU_CONFIG.pathRequiresAuth(path);
      }
      return false;
    };

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        const destPath = toFinancePath(link.getAttribute('href') || '');
        if (!destPath.startsWith('/finance')) return;

        const pathOnly = destPath.split('?')[0].split('#')[0];
        if (isPublicFinancePath(pathOnly)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (isFeaturedAuthed()) {
          window.location.assign(destPath);
          return;
        }

        openLoginForDest(destPath);
      });
    });

    ensureAuthScripts().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('financeLogin') === '1' && params.get('returnTo') && !isFeaturedAuthed()) {
        if (typeof window.showLoginPopup === 'function') {
          window.showLoginPopup();
        }
      }
    });

    window.addEventListener('user-logged-in', () => {
      let pending = null;
      try {
        pending = sessionStorage.getItem('featuredAuthReturnTo');
      } catch (_) {}
      if (!pending) {
        pending = new URLSearchParams(window.location.search).get('returnTo');
      }
      if (!pending || !isFeaturedAuthed()) return;
      try {
        const dest = new URL(pending, window.location.origin);
        if (dest.pathname.startsWith('/finance')) {
          try {
            sessionStorage.removeItem('featuredAuthReturnTo');
          } catch (_) {}
          window.location.assign(dest.pathname + dest.search + dest.hash);
        }
      } catch (_) {}
    });
  }

  function initPlatformBranding() {
    const p = window.SITE_PORTFOLIO;
    if (!p || !p.PLATFORM_NAME) return;
    document.querySelectorAll('.ice-platform-name').forEach((el) => {
      el.textContent = p.PLATFORM_NAME;
    });
  }

  function initPageModules() {
    const page = document.body.getAttribute('data-ice-page');
    const p = window.SITE_PORTFOLIO;
    if (!p) return;

    if (page === 'home') {
      const featured = document.getElementById('featuredSites');
      if (featured) {
        featured.innerHTML = p.renderFeaturedSites(p.getPortfolioSites(isDemoMode()));
        initFeaturedAuth();
      }
    }

    if (page === 'sites') {
      const grid = document.getElementById('sitesGrid');
      const hint = document.getElementById('sitesHint');
      const showAll = document.getElementById('showAllWrap');
      const demo = isDemoMode();
      if (grid) grid.innerHTML = p.renderSiteCards(p.getPortfolioSites(demo));
      if (demo && hint) hint.textContent = 'Demo focus — Worksheets and Encompass on this site';
      if (showAll) showAll.style.display = demo ? 'block' : 'none';
    }

    if (page === 'contact') {
      const grid = document.getElementById('contactGrid');
      if (grid) grid.innerHTML = p.renderContactCards();
    }

    if (page === 'stack') {
      const chips = document.getElementById('stackChips');
      const groups = document.getElementById('stackGroups');
      if (chips) chips.innerHTML = p.renderStackChips();
      if (groups) groups.innerHTML = p.renderStackGroups();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDock();
    initThemeToggle();
    initHeroWriteOn();
    initEasterEgg();
    initPlatformBranding();
    initPageModules();
  });

  window.ICE_LANDING = { isDemoMode };
})();
