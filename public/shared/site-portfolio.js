/**
 * Portfolio sites — each property maps to its public domain.
 * @see public/index.html (ice landing), docs/FRONTEND_PATTERNS.md
 */
(function (global) {
  'use strict';

  /** Primary platform host (DevConnect Labs deployment). */
  const PRIMARY_HOST = 'devconnectlabs.com';

  /**
   * @typedef {Object} PortfolioSite
   * @property {string} id
   * @property {string} label
   * @property {string} tagline
   * @property {string} domain - display hostname (no protocol)
   * @property {string} [path] - path on that host
   * @property {string} [absoluteUrl] - full URL when host differs from path resolution
   * @property {string} icon - Bootstrap Icons class suffix
   * @property {boolean} [demoOnly]
   * @property {boolean} [authRequired] - show on home; login required before /finance access
   */

  /** @type {PortfolioSite[]} */
  const PORTFOLIO_SITES = [
    {
      id: 'music',
      label: 'Music',
      tagline: 'Research, pilgrimage atlas, song ID, time machine',
      domain: PRIMARY_HOST,
      path: '/music/music-research.html',
      icon: 'bi-music-note-beamed',
    },
    {
      id: 'disasters',
      label: 'Unified Disasters',
      tagline: 'FEMA, NASA FIRMS, hazard webcams, pipeline risk',
      domain: PRIMARY_HOST,
      path: '/finance/disasters-unified.html',
      icon: 'bi-shield-exclamation',
    },
    {
      id: 'unit-tests',
      label: 'Unit Tests',
      tagline: 'Custom field workbook, offline demo, highlight reel',
      domain: PRIMARY_HOST,
      path: '/finance/unit-tests.html',
      icon: 'bi-clipboard-check',
      authRequired: true,
    },
    {
      id: 'automator',
      label: 'Automator',
      tagline: 'Custom field automation and batch utilities',
      domain: PRIMARY_HOST,
      path: '/finance/tool4.html',
      icon: 'bi-gear',
      authRequired: true,
    },
    {
      id: 'encompass',
      label: 'Encompass Hub',
      tagline: 'Pipeline, loan APIs, processor assignment',
      domain: PRIMARY_HOST,
      path: '/finance/encompass-hub.html',
      icon: 'bi-columns-gap',
      authRequired: true,
    },
    {
      id: 'family',
      label: 'Lane Family',
      tagline: 'Genealogy, museum, memorial wall, plate gallery',
      domain: 'thelanefamily.us',
      absoluteUrl: 'https://www.thelanefamily.us',
      icon: 'bi-house-heart',
    },
    {
      id: 'worksheets',
      label: 'Worksheets',
      tagline: 'Encompass, calculators, unit tests, Screen Test',
      domain: PRIMARY_HOST,
      path: '/finance/index.html',
      icon: 'bi-bank',
      demoOnly: true,
    },
  ];

  const STACK_CHIPS = [
    { label: 'Node.js / Express', icon: 'bi-server' },
    { label: 'PostgreSQL', icon: 'bi-database' },
    { label: 'LangChain + OpenAI', icon: 'bi-robot' },
    { label: 'OpenAI Vision', icon: 'bi-eye' },
    { label: 'HeyGen', icon: 'bi-camera-reels' },
    { label: 'Encompass / ICE APIs', icon: 'bi-bank2' },
    { label: 'Bootstrap + vanilla JS', icon: 'bi-layout-text-window' },
    { label: 'AG Grid & DataTables', icon: 'bi-table' },
    { label: 'Google Maps & geocoding', icon: 'bi-geo-alt' },
    { label: 'FEMA / NASA / NOAA feeds', icon: 'bi-cloud-lightning-rain' },
  ];

  /** Grouped stack for /stack.html */
  const STACK_GROUPS = [
    {
      title: 'Platform',
      items: [
        { label: 'Node.js + Express', detail: 'API routes, services layer, static hosting', icon: 'bi-server' },
        { label: 'PostgreSQL', detail: 'Lane graph, disasters, Encompass config, chat memory', icon: 'bi-database' },
        { label: 'Jest CI', detail: 'Unit tests across finance, genealogy, ingest pipelines', icon: 'bi-check2-circle' },
      ],
    },
    {
      title: 'AI & assistants',
      items: [
        { label: 'LangChain + OpenAI', detail: 'Encompass Assistant, loan pipeline AI, Screen Test', icon: 'bi-robot' },
        { label: 'OpenAI Vision (GPT-4o)', detail: 'Automator field-image parsing, Screen Test, multimodal discovery', icon: 'bi-eye' },
        { label: 'ICE knowledge RAG', detail: 'Indexed Developer Connect docs and repos', icon: 'bi-journal-code' },
        { label: 'HeyGen', detail: 'Avatar video, QR guide popups, demo explainers', icon: 'bi-camera-reels' },
        { label: 'HyperFrames', detail: 'Guided story reels and narrative overlays', icon: 'bi-film' },
      ],
    },
    {
      title: 'Mortgage / Encompass',
      items: [
        { label: 'Encompass Hub APIs', detail: 'Loans, users, custom fields, pipeline', icon: 'bi-bank2' },
        { label: 'calculationEngine', detail: 'Shared worksheet math and GSE scenario ratios', icon: 'bi-calculator' },
        { label: 'Processor assignment', detail: 'Rules + optional AI scoring, capacity-aware', icon: 'bi-people' },
        { label: 'Unit Tests & Automator', detail: 'Custom field parsers, manifest review', icon: 'bi-clipboard-check' },
      ],
    },
    {
      title: 'Frontend',
      items: [
        { label: 'Bootstrap + vanilla JS', detail: 'No React — AG Grid and DataTables where needed', icon: 'bi-layout-text-window' },
        { label: 'Design tokens', detail: 'Zen palette, dark mode, Lane heritage accents', icon: 'bi-palette' },
        { label: 'Voice widget', detail: 'Sitewide speech commands and TTS', icon: 'bi-mic' },
      ],
    },
    {
      title: 'Data & maps',
      items: [
        { label: 'FEMA / NASA / NOAA', detail: 'Unified disasters, hazard webcams, pipeline risk', icon: 'bi-cloud-lightning-rain' },
        { label: 'Google Maps + geocoding', detail: 'Family maps, disaster layers, discovery pages', icon: 'bi-geo-alt' },
        { label: 'MusicBrainz + Wikimedia', detail: 'Music research, pilgrimage atlas, timelines', icon: 'bi-music-note-beamed' },
      ],
    },
  ];

  const DOCK_PAGES = [
    { id: 'home', href: '/', label: 'Home', icon: 'bi-house' },
    { id: 'about', href: '/about.html', label: 'About', icon: 'bi-person' },
    { id: 'stack', href: '/stack.html', label: 'Stack', icon: 'bi-layers' },
    { id: 'sites', href: '/sites.html', label: 'Sites', icon: 'bi-globe2' },
    { id: 'contact', href: '/contact.html', label: 'Contact', icon: 'bi-envelope' },
  ];

  const CONTACT_ITEMS = [
    {
      label: 'GitHub',
      value: 'wikitimetraveler / devconnect-labs',
      note: 'Source, issues, and project history',
      href: 'https://github.com/wikitimetraveler/devconnect-labs',
      icon: 'bi-github',
    },
    {
      label: 'Lane Family',
      value: 'thelanefamily.us',
      note: 'Genealogy, museum, and heritage tools',
      href: 'https://www.thelanefamily.us',
      icon: 'bi-house-heart',
    },
    {
      label: 'Voice guide',
      value: 'Sitewide voice commands',
      note: 'Microphone widget and command reference',
      href: '/voice-guide.html',
      icon: 'bi-mic',
    },
    {
      label: 'Platform',
      value: 'DevConnect Labs',
      note: 'Multi-domain tools — mortgage, disasters, music, nature',
      href: '/finance/index.html',
      icon: 'bi-grid-3x3-gap',
    },
  ];

  function hostMatchesPrimary() {
    const h = (global.location && global.location.hostname) || '';
    return !h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.onrender.com') || h === PRIMARY_HOST || h === 'www.' + PRIMARY_HOST;
  }

  /** Resolve live URL for a portfolio site. */
  function resolveSiteUrl(site) {
    if (site.absoluteUrl) return site.absoluteUrl;
    const path = site.path || '/';
    if (hostMatchesPrimary()) {
      try {
        return new URL(path, global.location.origin).href;
      } catch (_) {
        return path;
      }
    }
    const host = site.domain || PRIMARY_HOST;
    const base = host.startsWith('http') ? host : 'https://' + host.replace(/^www\./, 'www.');
    return base.replace(/\/$/, '') + path;
  }

  function getPortfolioSites(demoMode) {
    if (demoMode) {
      return PORTFOLIO_SITES.filter((s) => s.demoOnly);
    }
    return PORTFOLIO_SITES.filter((s) => !s.demoOnly);
  }

  function renderDock(activeId) {
    return DOCK_PAGES.map((page) => {
      const active = page.id === activeId;
      return (
        '<a class="ice-dock__item' +
        (active ? ' is-active' : '') +
        '" href="' +
        page.href +
        '"' +
        (active ? ' aria-current="page"' : '') +
        '><i class="bi ' +
        page.icon +
        '"></i>' +
        page.label +
        '</a>'
      );
    }).join('');
  }

  function renderStackChips() {
    return STACK_CHIPS.map(
      (item) =>
        '<div class="ice-stack-chip"><i class="bi ' +
        item.icon +
        '"></i><span>' +
        item.label +
        '</span></div>'
    ).join('');
  }

  function renderStackGroups() {
    return STACK_GROUPS.map((group) => {
      const cards = group.items
        .map(
          (item) =>
            '<article class="ice-stack-card">' +
            '<div class="ice-stack-card__icon"><i class="bi ' +
            item.icon +
            '"></i></div>' +
            '<div class="ice-stack-card__body">' +
            '<h3 class="ice-stack-card__title">' +
            item.label +
            '</h3>' +
            '<p class="ice-stack-card__detail">' +
            item.detail +
            '</p>' +
            '</div></article>'
        )
        .join('');
      return (
        '<section class="ice-stack-group">' +
        '<h2 class="ice-stack-group__title">' +
        group.title +
        '</h2>' +
        '<div class="ice-stack-group__grid">' +
        cards +
        '</div></section>'
      );
    }).join('');
  }

  function renderFeaturedSites(sites) {
    return sites
      .slice(0, 6)
      .map((site) => {
        const url = resolveSiteUrl(site);
        const domain = site.domain || PRIMARY_HOST;
        const external = !!site.absoluteUrl;
        const authRequired = !!site.authRequired;
        const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        const lockBadge = authRequired
          ? '<i class="bi bi-shield-lock ice-featured__lock" aria-hidden="true" title="Login required"></i>'
          : '';
        const authAttr = authRequired ? ' data-auth-required="1"' : '';
        const lockedClass = authRequired ? ' ice-featured__item--locked' : '';
        return (
          '<a class="ice-featured__item' +
          lockedClass +
          '" href="' +
          url +
          '"' +
          targetAttr +
          authAttr +
          ' data-site-id="' +
          site.id +
          '">' +
          '<i class="bi ' +
          site.icon +
          '"></i>' +
          '<span><span>' +
          site.label +
          '</span><span class="ice-featured__domain">' +
          domain +
          '</span></span>' +
          lockBadge +
          '</a>'
        );
      })
      .join('');
  }

  function renderContactCards() {
    return CONTACT_ITEMS.map((item) => {
      const inner =
        '<div class="ice-contact-card__icon"><i class="bi ' +
        item.icon +
        '"></i></div>' +
        '<div><p class="ice-contact-card__label">' +
        item.label +
        '</p><p class="ice-contact-card__value">' +
        item.value +
        '</p>' +
        (item.note ? '<p class="ice-contact-card__note">' + item.note + '</p>' : '') +
        '</div>';
      if (item.href) {
        const external = item.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
        return '<a class="ice-contact-card" href="' + item.href + '"' + external + '>' + inner + '</a>';
      }
      return '<div class="ice-contact-card">' + inner + '</div>';
    }).join('');
  }

  function renderSiteCards(sites) {
    return sites
      .map((site) => {
        const url = resolveSiteUrl(site);
        const domain = site.domain || PRIMARY_HOST;
        const title = (site.tagline || site.label).replace(/"/g, '&quot;');
        return (
          '<a class="ice-site-card" href="' +
          url +
          '" target="_blank" rel="noopener noreferrer" title="' +
          title +
          '" data-site-id="' +
          site.id +
          '">' +
          '<div class="ice-site-card__icon"><i class="bi ' +
          site.icon +
          '"></i></div>' +
          '<div class="ice-site-card__body">' +
          '<span class="ice-site-card__label">' +
          site.label +
          '</span>' +
          '<span class="ice-site-card__domain">' +
          domain +
          '</span>' +
          '<span class="ice-site-card__tagline">' +
          (site.tagline || '') +
          '</span>' +
          '</div>' +
          '<i class="bi bi-arrow-up-right ice-site-card__arrow"></i>' +
          '</a>'
        );
      })
      .join('');
  }

  global.SITE_PORTFOLIO = {
    PRIMARY_HOST,
    PORTFOLIO_SITES,
    STACK_CHIPS,
    STACK_GROUPS,
    DOCK_PAGES,
    CONTACT_ITEMS,
    getPortfolioSites,
    resolveSiteUrl,
    renderDock,
    renderFeaturedSites,
    renderContactCards,
    renderStackChips,
    renderStackGroups,
    renderSiteCards,
  };
})(typeof window !== 'undefined' ? window : globalThis);
