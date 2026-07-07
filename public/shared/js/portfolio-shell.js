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
    const caps = document.getElementById('portfolioCapabilities');
    if (caps) caps.innerHTML = pf.renderCapabilities();
    const featured = document.getElementById('portfolioFeatured');
    if (featured) featured.innerHTML = pf.renderFeaturedCaseStudies();
    const more = document.getElementById('portfolioMoreProjects');
    if (more) {
      const projects = pf.getPortfolioProjects({ excludeOther: true, includeDemo: true }).filter((p) => !p.featured);
      more.innerHTML = pf.renderProjectCards(projects);
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

  function init() {
    initNav();
    initThemeToggle();
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
})();
