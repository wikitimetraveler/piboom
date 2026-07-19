/**
 * David Lane portfolio shell — nav, theme, page init.
 */
(function () {
  'use strict';

  const THEME_KEY = 'portfolioTheme';

  function getPortfolio() {
    return window.SITE_PORTFOLIO || null;
  }

  function initThemeToggle() {
    const btn = document.getElementById('portfolioThemeToggle');
    if (!btn) return;

    function applyTheme(mode) {
      const dark = mode === 'dark';
      document.body.classList.toggle('portfolio-dark', dark);
      btn.textContent = mode === 'auto' ? 'AUTO' : mode === 'dark' ? 'DARK' : 'LIGHT';
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch (_) {}
      if (window.ICE_OCEAN_SCENE && typeof window.ICE_OCEAN_SCENE.setNight === 'function') {
        window.ICE_OCEAN_SCENE.setNight(dark ? 1 : 0);
      }
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

  function initNav() {
    const nav = document.getElementById('portfolioNav');
    const pf = getPortfolio();
    const pageId = document.body.getAttribute('data-portfolio-page');
    if (nav && pf && pageId) {
      nav.innerHTML = pf.renderPortfolioNav(pageId);
    }
    const platformEl = document.querySelector('.portfolio-brand__sub');
    if (platformEl && pf) {
      platformEl.textContent = pf.PLATFORM_NAME;
    }
    const footerPlatform = document.querySelectorAll('[data-platform-name]');
    footerPlatform.forEach((el) => {
      if (pf) el.textContent = pf.PLATFORM_NAME;
    });
    const yearEl = document.getElementById('portfolioYear');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  function initHome() {
    const pf = getPortfolio();
    if (!pf) return;
    const loggedIn = typeof window.isLoggedIn === 'function' && window.isLoggedIn();

    const caps = document.getElementById('portfolioCapabilities');
    if (caps) caps.innerHTML = pf.renderCapabilities();

    const featuredSection = document.getElementById('portfolioFeaturedSection');
    const featured = document.getElementById('portfolioFeatured');
    const featuredTitle = document.getElementById('featuredTitle');
    const featuredLead = document.getElementById('portfolioFeaturedLead');
    if (featured) {
      const html = pf.renderFeaturedCaseStudies({ showThumbs: false });
      featured.innerHTML = html;
      if (featuredSection) {
        featuredSection.classList.toggle('is-empty', !html.trim());
      }
      if (featuredTitle) {
        featuredTitle.textContent = loggedIn ? 'Live demos' : 'Public live demos';
      }
      if (featuredLead) {
        featuredLead.textContent = loggedIn
          ? 'Featured Encompass and hazard tools — open a demo or read the case study.'
          : 'Open these without login. Encompass tools unlock after you pass through the ice.';
      }
    }

    const moreSection = document.getElementById('portfolioMoreSection');
    const more = document.getElementById('portfolioMoreProjects');
    if (more) {
      const projects = pf
        .getPortfolioProjects({ excludeOther: true, includeDemo: true })
        .filter((p) => !p.featured);
      const html = pf.renderProjectCards(projects, { showThumbs: false });
      more.innerHTML = html;
      if (moreSection) {
        moreSection.classList.toggle('is-empty', !html.trim());
      }
    }

    const chips = document.getElementById('portfolioStackChips');
    if (chips) chips.innerHTML = pf.renderPortfolioStackChips();
  }

  function initWork() {
    const pf = getPortfolio();
    if (!pf) return;
    const grid = document.getElementById('portfolioWorkGrid');
    const filterBar = document.getElementById('portfolioFilterBar');
    if (!grid) return;

    const params = new URLSearchParams(window.location.search);
    let activeFilter = params.get('filter') || 'mortgage';

    function mortgageCategories() {
      return ['encompass', 'ai', 'disasters'];
    }

    function renderFilters() {
      if (!filterBar) return;
      const filters = [
        { id: 'mortgage', label: 'All mortgage' },
        { id: 'encompass', label: 'Encompass' },
        { id: 'ai', label: 'AI' },
        { id: 'disasters', label: 'Disasters' },
        { id: 'other', label: 'Other' },
        { id: 'all', label: 'Everything' },
      ];
      filterBar.innerHTML = filters
        .map(
          (f) =>
            '<button type="button" class="portfolio-filter-btn' +
            (f.id === activeFilter ? ' is-active' : '') +
            '" data-filter="' +
            f.id +
            '">' +
            f.label +
            '</button>'
        )
        .join('');
      filterBar.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeFilter = btn.getAttribute('data-filter');
          const url = new URL(window.location.href);
          if (activeFilter === 'mortgage') url.searchParams.delete('filter');
          else url.searchParams.set('filter', activeFilter);
          window.history.replaceState({}, '', url);
          renderFilters();
          renderGrid();
        });
      });
    }

    function renderGrid() {
      let projects;
      if (activeFilter === 'mortgage') {
        projects = pf.getPortfolioProjects({ includeDemo: true }).filter((p) =>
          mortgageCategories().includes(p.category)
        );
      } else if (activeFilter === 'all') {
        projects = pf.getPortfolioProjects({ includeDemo: true });
      } else {
        projects = pf.getPortfolioProjects({ category: activeFilter, includeDemo: true });
      }
      grid.innerHTML = pf.renderProjectCards(projects);
    }

    renderFilters();
    renderGrid();
  }

  function initStack() {
    const pf = getPortfolio();
    if (!pf) return;
    const chips = document.getElementById('portfolioStackChips');
    if (chips) chips.innerHTML = pf.renderPortfolioStackChips();
    const groups = document.getElementById('portfolioStackGroups');
    if (groups) groups.innerHTML = pf.renderPortfolioStackGroups();
  }

  function initContact() {
    const pf = getPortfolio();
    const grid = document.getElementById('portfolioContactGrid');
    if (grid && pf) grid.innerHTML = pf.renderPortfolioContactCards();
    const heroCta = document.getElementById('portfolioContactHeroCta');
    if (heroCta && pf && pf.PORTFOLIO_EMAIL) {
      let html =
        '<a class="portfolio-btn portfolio-btn--primary" href="mailto:' +
        pf.PORTFOLIO_EMAIL +
        '">Email ' +
        pf.PORTFOLIO_EMAIL +
        ' <i class="bi bi-envelope" aria-hidden="true"></i></a>';
      if (pf.PORTFOLIO_CALENDLY_URL) {
        html +=
          '<a class="portfolio-btn portfolio-btn--outline" href="' +
          pf.PORTFOLIO_CALENDLY_URL +
          '" target="_blank" rel="noopener noreferrer">Schedule on Calendly <i class="bi bi-calendar-check" aria-hidden="true"></i></a>';
      }
      heroCta.innerHTML = html;
    }
  }

  function initCaseStudy() {
    const pf = getPortfolio();
    const root = document.getElementById('portfolioCaseStudy');
    if (!pf || !root) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const project = id ? pf.getPortfolioProjectById(id) : null;

    if (!project || !project.caseStudy) {
      root.innerHTML =
        '<nav class="portfolio-study-back"><a href="/work.html"><i class="bi bi-arrow-left" aria-hidden="true"></i> All work</a></nav>' +
        '<h1 class="portfolio-section__title">Case study not found</h1>' +
        '<p class="portfolio-section__lead">Pick a project from the <a href="/work.html">work page</a>.</p>';
      document.title = 'Case study — David Lane';
      return;
    }

    document.title = project.label + ' — Case study · David Lane';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', project.problem);
    root.innerHTML = pf.renderCaseStudyPage(project);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
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
  }

  function ensureAuthScripts() {
    const tasks = [];
    if (!window.DEMO_USERS) tasks.push(loadScript('/shared/demo-users.js'));
    if (typeof window.isLoggedIn !== 'function') tasks.push(loadScript('/shared/user-login.js'));
    if (typeof window.verifyUserPassword !== 'function') tasks.push(loadScript('/shared/user-passwords.js'));
    return Promise.all(tasks);
  }

  function isPortfolioLoggedIn() {
    return typeof window.isLoggedIn === 'function' && !!window.isLoggedIn();
  }

  function renderAuthButton() {
    const actions = document.querySelector('.portfolio-header__actions');
    if (!actions) return null;

    let btn = document.getElementById('portfolioAuthBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'portfolioAuthBtn';
      btn.className = 'portfolio-auth-btn';
      const themeBtn = document.getElementById('portfolioThemeToggle');
      if (themeBtn && themeBtn.parentNode === actions) {
        actions.insertBefore(btn, themeBtn);
      } else {
        actions.prepend(btn);
      }
      btn.addEventListener('click', onAuthButtonClick);
    }

    if (isPortfolioLoggedIn() && typeof window.getLoggedInUser === 'function') {
      const user = window.getLoggedInUser();
      const name = user && user.name ? user.name.split(' ').slice(-1)[0] : 'Account';
      btn.classList.add('portfolio-auth-btn--out');
      btn.setAttribute('aria-label', 'Log out as ' + name);
      btn.innerHTML =
        (user && user.avatar
          ? '<img class="portfolio-auth-btn__avatar" src="' + user.avatar + '" alt="" />'
          : '<i class="bi bi-person-check" aria-hidden="true"></i>') +
        '<span>' + name + ' · Log out</span>';
    } else {
      btn.classList.remove('portfolio-auth-btn--out');
      btn.setAttribute('aria-label', 'Log in');
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i><span>Log in</span>';
    }
    return btn;
  }

  function onAuthButtonClick(event) {
    event.preventDefault();
    ensureAuthScripts()
      .then(() => {
        if (isPortfolioLoggedIn()) {
          if (typeof window.logout === 'function') {
            window.logout();
          }
          return;
        }
        if (typeof window.showLoginPopup === 'function') {
          window.showLoginPopup();
        }
      })
      .catch((err) => {
        console.error('Portfolio auth scripts failed', err);
      });
  }

  function initAuthControls() {
    renderAuthButton();
  }

  function init() {
    initNav();
    initThemeToggle();
    initAuthControls();
    const page = document.body.getAttribute('data-portfolio-page');
    if (page === 'home') initHome();
    else if (page === 'work') {
      if (document.getElementById('portfolioCaseStudy')) initCaseStudy();
      else initWork();
    }
    else if (page === 'stack') initStack();
    else if (page === 'contact') initContact();
    else if (page === 'finance') {
      /* grid populated inline on finance/index.html */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('user-logged-in', () => {
    renderAuthButton();
    const page = document.body.getAttribute('data-portfolio-page');
    if (page === 'home') initHome();
    else if (page === 'work' && !document.getElementById('portfolioCaseStudy')) initWork();
  });
})();
