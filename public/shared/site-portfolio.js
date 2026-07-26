/**
 * Portfolio sites — each property maps to its public domain.
 * @see public/index.html (portfolio home), docs/FRONTEND_PATTERNS.md
 */
(function (global) {
  'use strict';

  /** DevConnect Labs marketing host. */
  const PRIMARY_HOST = 'devconnectlabs.com';
  /** Public platform name (replaces “DevConnect Labs” on portfolio pages). */
  const PLATFORM_NAME = 'LOS AI Labs';
  /** Lane family production host (same app deployment). */
  const LANE_FAMILY_HOST = 'thelanefamily.us';
  /** Portfolio contact — update Calendly when you have a booking link. */
  const PORTFOLIO_EMAIL = 'david@devconnectlabs.com';
  const PORTFOLIO_CALENDLY_URL = '';

  function normalizeHostname(hostname) {
    return String(hostname || '')
      .toLowerCase()
      .replace(/^www\./, '');
  }

  function isLaneFamilyHost(hostname) {
    const h = normalizeHostname(hostname);
    return h === LANE_FAMILY_HOST || h.endsWith('.' + LANE_FAMILY_HOST);
  }

  function isDeploymentHost(hostname) {
    const h = normalizeHostname(hostname);
    if (!h || h === 'localhost' || h === '127.0.0.1') return true;
    if (h.endsWith('.onrender.com')) return true;
    if (h === PRIMARY_HOST || h.endsWith('.' + PRIMARY_HOST)) return true;
    if (isLaneFamilyHost(h)) return true;
    return false;
  }

  function currentHostname() {
    return (global.location && global.location.hostname) || '';
  }

  /** Same-origin static app — links stay on whichever host served the page. */
  function hostMatchesDeployment() {
    return isDeploymentHost(currentHostname());
  }

  function resolveDisplayDomain(site) {
    if (hostMatchesDeployment()) {
      const h = normalizeHostname(currentHostname());
      if (h && h !== 'localhost' && h !== '127.0.0.1') {
        return h;
      }
    }
    return site.domain || PRIMARY_HOST;
  }

  function isCrossOriginUrl(url) {
    try {
      return new URL(url, global.location.origin).origin !== global.location.origin;
    } catch (_) {
      return false;
    }
  }

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
      id: 'heygen-hub',
      label: 'HeyGen Hub',
      tagline: 'Avatar clips and HyperFrames narrated reels',
      domain: PRIMARY_HOST,
      path: '/heygen-hub.html',
      icon: 'bi-film',
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
      domain: LANE_FAMILY_HOST,
      path: '/family/lane-family.html',
      icon: 'bi-house-heart',
    },
    {
      id: 'worksheets',
      label: 'Worksheets',
      tagline: 'Encompass, calculators, unit tests, Screen Test',
      domain: PRIMARY_HOST,
      path: '/finance/index.html',
      icon: 'bi-bank',
    },
  ];

  const STACK_CHIPS = [
    { label: 'Node.js / Express', icon: 'bi-server' },
    { label: 'Python / FastAPI', icon: 'bi-code-slash' },
    { label: 'PostgreSQL', icon: 'bi-database' },
    { label: 'LangChain + OpenAI', icon: 'bi-robot' },
    { label: 'OpenAI Vision', icon: 'bi-eye' },
    { label: 'HeyGen', icon: 'bi-camera-reels' },
    { label: 'Encompass / ICE APIs', icon: 'bi-bank2' },
    { label: 'Brownfield: Bootstrap + vanilla JS', icon: 'bi-layout-text-window' },
    { label: 'Greenfield: React + TypeScript', icon: 'bi-filetype-tsx' },
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
        { label: 'Python/FastAPI', detail: 'PostGIS spatial queries, disaster PostgreSQL feed, Encompass RAG (keyword + vector search), text processing, data analytics', icon: 'bi-code-slash' },
        { label: 'PostgreSQL', detail: 'Lane graph, disasters, Encompass config, chat memory', icon: 'bi-database' },
        { label: 'Jest CI', detail: 'Unit tests across finance, genealogy, ingest pipelines', icon: 'bi-check2-circle' },
      ],
    },
    {
      title: 'AI & assistants',
      items: [
        { label: 'LangChain + OpenAI', detail: 'Encompass Assistant, loan pipeline AI, Screen Test', icon: 'bi-robot' },
        { label: 'OpenAI Vision (GPT-4o)', detail: 'Automator field-image parsing, Screen Test, multimodal discovery', icon: 'bi-eye' },
        { label: 'ICE knowledge RAG', detail: 'Python pgvector semantic search + Encompass docs', icon: 'bi-journal-code' },
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
        { label: 'Brownfield (Encompass)', detail: 'Bootstrap + vanilla JS · AG Grid and DataTables', icon: 'bi-layout-text-window' },
        { label: 'Greenfield apps', detail: 'React + TypeScript preferred for new product UIs', icon: 'bi-filetype-tsx' },
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

  /**
   * @typedef {Object} PortfolioProject
   * @property {string} id
   * @property {string} label
   * @property {string} tagline
   * @property {string} path
   * @property {string} icon
   * @property {'encompass'|'ai'|'disasters'|'other'} category
   * @property {boolean} [featured]
   * @property {number} [featuredOrder]
   * @property {boolean} [authRequired]
   * @property {boolean} [demoOnly]
   * @property {string} consultingBlurb
   * @property {string} problem
   * @property {string[]} stack
   * @property {string} [domain]
   * @property {PortfolioCaseStudy} [caseStudy]
   */

  /**
   * @typedef {Object} PortfolioCaseStudy
   * @property {string} role
   * @property {string} outcome
   * @property {string[]} highlights
   * @property {{src:string,caption:string}[]} screenshots
   * @property {string} [reel]
   */

  /** @type {PortfolioProject[]} */
  const PORTFOLIO_PROJECTS = [
    {
      id: 'unit-tests',
      label: 'Unit Test Library',
      tagline: 'Custom field workbook, parser, AG Grid compare, offline demo',
      path: '/finance/unit-tests.html',
      icon: 'bi-clipboard-check',
      category: 'encompass',
      featured: true,
      featuredOrder: 1,
      authRequired: true,
      problem: 'Validate custom field calculations and business rules before they reach production loans.',
      consultingBlurb: 'Parser-driven unit test library with workbook ingest, grid compare, highlight reel, and CI-friendly regression flows.',
      stack: ['Encompass', 'AG Grid', 'Jest', 'Custom field parser'],
      caseStudy: {
        role: 'Sole engineer — parser, grid UI, offline demo, and Jest regression suite.',
        outcome:
          'Admins can import calculation workbooks, generate tests from field definitions, compare expected vs actual in AG Grid, and export TypeScript for CI.',
        highlights: [
          'Custom field calc parser with IIf/date/cascade coverage',
          'Generate-from-field modal and editable grid cells',
          'Run/compare pass-fail with highlight reel and Story Mode offline demo',
          'Export/import and AI assistant for test authoring',
        ],
        screenshots: [
          { src: '/assets/portfolio/unit-tests-overview.svg', caption: 'Unit test workspace — toolbar and AG Grid' },
          { src: '/assets/portfolio/unit-tests-run-results.svg', caption: 'Run results with pass/fail compare' },
          { src: '/assets/portfolio/unit-tests-story-mode.svg', caption: 'Story Mode guided highlight reel' },
        ],
        reel: '/finance/assets/video/unit-tests-reel.mp4',
      },
    },
    {
      id: 'disasters',
      label: 'Unified Disasters',
      tagline: 'FEMA, NASA FIRMS, USGS, NWS — map, loans, hazard webcams',
      path: '/finance/disasters-unified.html',
      icon: 'bi-shield-exclamation',
      category: 'disasters',
      featured: true,
      featuredOrder: 2,
      problem: 'Surface multi-source hazard intelligence with county-scoped views and pipeline risk context.',
      consultingBlurb: 'Postgres-backed ingest, Leaflet county gate, AG Grid, PostGIS nearby search, and live API pull workflows.',
      stack: ['Python/FastAPI', 'PostGIS', 'FEMA / NOAA APIs', 'AG Grid', 'Google Maps'],
      caseStudy: {
        role: 'Full-stack — ingest services, PostGIS schema, map UX, and pipeline risk views.',
        outcome:
          'Operations teams pick a county, pull multi-source hazard feeds, inspect disasters in AG Grid, and relate events to loan pipeline context.',
        highlights: [
          'FEMA, NASA FIRMS, USGS, and NWS ingest with unified normalization',
          'County choropleth hazard lens and selection context strip',
          'PostGIS nearby search and loan pipeline overlays',
          'Hazard webcams tab and consolidated pull-all-sources workflow',
        ],
        screenshots: [
          { src: '/assets/portfolio/disasters-overview.svg', caption: 'Map, stats, and disaster grid layout' },
          { src: '/assets/portfolio/disasters-hazard-lens.svg', caption: 'County hazard lens and source legend' },
        ],
        reel: '/finance/assets/video/unified-disasters-reel.mp4',
      },
    },
    {
      id: 'processor-assignment',
      label: 'Processor Assignment',
      tagline: 'Rules engine, capacity, optional AI scoring',
      path: '/finance/processor-assignment.html',
      icon: 'bi-people',
      category: 'encompass',
      featured: true,
      featuredOrder: 3,
      authRequired: true,
      problem: 'Route loans to processors using configurable rules and operational capacity.',
      consultingBlurb: 'Service-layer assignment with Postgres config, Encompass pipeline context, and optional AI-assisted scoring.',
      stack: ['Encompass', 'PostgreSQL', 'LangChain', 'Rules config'],
      caseStudy: {
        role: 'Backend + UI — rules engine, Encompass associates API, Postgres config persistence.',
        outcome:
          'Ops configures processor capacity and complexity rules per environment, dry-runs scoring, then assigns Processor associate slots via hub APIs.',
        highlights: [
          'Rule-based and optional AI complexity scoring',
          'Processor picker from Encompass company users',
          'Per-env config in Postgres (correspondent / retail)',
          'Dry run before live associate assignment',
        ],
        screenshots: [
          { src: '/assets/portfolio/processor-assignment-overview.svg', caption: 'Processors, rules, and assignment grid' },
        ],
        reel: '/finance/assets/video/mortgage-tools-reel.mp4',
      },
    },
    {
      id: 'encompass',
      label: 'Encompass Hub',
      tagline: 'Pipeline, loan APIs, users, custom fields',
      path: '/finance/encompass-hub.html',
      icon: 'bi-columns-gap',
      category: 'encompass',
      authRequired: true,
      problem: 'Central entry for ICE OAuth-backed loan and field APIs.',
      consultingBlurb: 'Hub UI over encompass-hub.service — loans, pipeline, native/custom field browsers.',
      stack: ['ICE OAuth', 'Encompass APIs', 'Express'],
    },
    {
      id: 'encompass-assistant',
      label: 'Encompass Assistant',
      tagline: 'AI chat grounded in ICE knowledge and loan context',
      path: '/finance/encompass-assistant.html',
      icon: 'bi-robot',
      category: 'ai',
      authRequired: true,
      problem: 'Answer Encompass integration questions with indexed ICE docs and live context.',
      consultingBlurb: 'LangChain + OpenAI assistant with ICE knowledge RAG and persistent memory.',
      stack: ['LangChain', 'OpenAI', 'Python/FastAPI RAG', 'ICE knowledge'],
    },
    {
      id: 'automator',
      label: 'Automator',
      tagline: 'Custom field automation and batch utilities',
      path: '/finance/tool4.html',
      icon: 'bi-gear',
      category: 'encompass',
      authRequired: true,
      problem: 'Accelerate custom field manifest review and batch automation.',
      consultingBlurb: 'Vision-assisted field parsing and automation workflows for Encompass admins.',
      stack: ['OpenAI Vision', 'Encompass', 'Manifest review'],
    },
    {
      id: 'screen-test',
      label: 'Screen Test',
      tagline: 'AI manifest and form review for Encompass screens',
      path: '/finance/tool9.html',
      icon: 'bi-window-stack',
      category: 'ai',
      authRequired: true,
      problem: 'Review Encompass screen manifests with AI-assisted validation.',
      consultingBlurb: 'Reviewer AI controller with structured manifest feedback for ICE admins.',
      stack: ['OpenAI', 'Python text processing', 'Encompass manifests'],
    },
    {
      id: 'gse-analyzer',
      label: 'GSE Scenario Analyzer',
      tagline: 'Shared calc engine ratios and scenario compare',
      path: '/gse-analyzer.html',
      icon: 'bi-calculator',
      category: 'encompass',
      featured: true,
      featuredOrder: 4,
      problem: 'Model GSE scenario ratios with shared calculationEngine helpers.',
      consultingBlurb: 'Pure calcMath helpers and scenario UI for mortgage worksheet workflows.',
      stack: ['calculationEngine', 'calcMath', 'Bootstrap'],
    },
    {
      id: 'loan-batch',
      label: 'Loan Batch Update',
      tagline: 'AG Grid bulk edit with Encompass batch API',
      path: '/finance/loan-batch-update.html',
      icon: 'bi-table',
      category: 'encompass',
      authRequired: true,
      problem: 'Batch-update loan fields through Encompass hub APIs.',
      consultingBlurb: 'SheetJS import + AG Grid + encompass-hub batch update requests.',
      stack: ['AG Grid', 'Encompass Hub', 'SheetJS'],
    },
    {
      id: 'worksheets',
      label: 'Worksheets Hub',
      tagline: 'FHA, VA, DTI calculators and finance tool index',
      path: '/finance/index.html',
      icon: 'bi-bank',
      category: 'encompass',
      featured: true,
      featuredOrder: 5,
      problem: 'Curated calculator and Encompass tool entry point.',
      consultingBlurb: 'Bootstrap hub with shared calculationEngine and finance auth guard.',
      stack: ['calculationEngine', 'Bootstrap', 'Worksheets'],
    },
    {
      id: 'glazed',
      label: 'Glazed',
      tagline: 'Baker’s dozen flip cards, Pip guide, Savy on Harbor',
      path: '/donuts/',
      icon: 'bi-hearts',
      category: 'other',
      featured: true,
      featuredOrder: 6,
      authRequired: false,
      problem: 'A playful public bakery gallery with recipes, history, and an AI baker guide.',
      consultingBlurb:
        'Bootstrap + vanilla Glazed page — flip cards, HyperFrame highlight reel, HeyGen Pip intro, Google Maps shop pin, and TTS chat. Fully public — no login.',
      stack: ['Bootstrap', 'HeyGen', 'Google Maps', 'Google TTS'],
    },
    {
      id: 'heygen-hub',
      label: 'HeyGen Hub',
      tagline: 'Avatar clips and HyperFrames narrated reels',
      path: '/heygen-hub.html',
      icon: 'bi-film',
      category: 'other',
      problem: 'Demo and explain complex tools with presenter-led video.',
      consultingBlurb: 'HeyGen integration for product walkthroughs and QR-triggered guide popups.',
      stack: ['HeyGen API', 'HyperFrames', 'Video library'],
    },
    {
      id: 'disaster-graph',
      label: 'Disaster Impact Graph',
      tagline: 'County → disaster → loan graph prototype',
      path: '/disaster-impact-graph.html',
      icon: 'bi-diagram-3',
      category: 'disasters',
      problem: 'Multi-hop graph model complementing spatial disaster search.',
      consultingBlurb: 'graph_nodes / graph_edges prototype seeded from Postgres spatial data.',
      stack: ['PostgreSQL', 'Python/FastAPI', 'Graph model', 'PostGIS seed'],
    },
    {
      id: 'music',
      label: 'Music Research',
      tagline: 'Pilgrimage atlas, time machine, song ID',
      path: '/music/music-research.html',
      icon: 'bi-music-note-beamed',
      category: 'other',
      domain: PRIMARY_HOST,
      problem: 'Personal music history research tools.',
      consultingBlurb: 'MusicBrainz-backed research UI — outside mortgage focus.',
      stack: ['MusicBrainz', 'Maps', 'Vanilla JS'],
    },
    {
      id: 'family',
      label: 'Lane Family',
      tagline: 'Genealogy, museum, memorial wall',
      path: '/family/lane-family.html',
      icon: 'bi-house-heart',
      category: 'other',
      domain: LANE_FAMILY_HOST,
      problem: 'Heritage and genealogy presentation.',
      consultingBlurb: 'Separate heritage domain — thelanefamily.us.',
      stack: ['Postgres graph', 'Google Maps', 'Lane shell'],
    },
  ];

  const CAPABILITIES = [
    {
      title: 'ICE / Encompass integration',
      icon: 'bi-bank2',
      detail: 'OAuth hub APIs, custom and native fields, pipeline, batch update, processor workflows.',
    },
    {
      title: 'Loan ops tooling',
      icon: 'bi-clipboard-check',
      detail: 'Unit test library, Automator, worksheets, Screen Test, and production-grade AG Grid UIs.',
    },
    {
      title: 'AI on the loan stack',
      icon: 'bi-robot',
      detail: 'ICE knowledge RAG, Encompass Assistant, vision parsing, LangChain memory, optional AI scoring.',
    },
  ];

  const PORTFOLIO_NAV = [
    { id: 'home', href: '/', label: 'Home', icon: 'bi-house' },
    { id: 'work', href: '/work.html', label: 'Work', icon: 'bi-briefcase' },
    { id: 'about', href: '/about.html', label: 'About', icon: 'bi-person' },
    { id: 'stack', href: '/stack.html', label: 'Stack', icon: 'bi-layers' },
    { id: 'contact', href: '/contact.html', label: 'Contact', icon: 'bi-envelope' },
  ];

  /** @deprecated use PORTFOLIO_NAV — kept for ice-landing-shell */
  const DOCK_PAGES = [
    { id: 'home', href: '/', label: 'Home', icon: 'bi-house' },
    { id: 'work', href: '/work.html', label: 'Work', icon: 'bi-briefcase' },
    { id: 'about', href: '/about.html', label: 'About', icon: 'bi-person' },
    { id: 'stack', href: '/stack.html', label: 'Stack', icon: 'bi-layers' },
    { id: 'contact', href: '/contact.html', label: 'Contact', icon: 'bi-envelope' },
  ];

  const CONTACT_ITEMS = [
    {
      label: 'Email',
      value: PORTFOLIO_EMAIL,
      note: 'Encompass roles, contract consulting, and demo access',
      href: 'mailto:' + PORTFOLIO_EMAIL,
      icon: 'bi-envelope',
    },
    ...(PORTFOLIO_CALENDLY_URL
      ? [
          {
            label: 'Schedule a call',
            value: 'Calendly',
            note: '30-minute intro — mortgage tech and Encompass work',
            href: PORTFOLIO_CALENDLY_URL,
            icon: 'bi-calendar-check',
          },
        ]
      : []),
    {
      label: 'GitHub',
      value: 'wikitimetraveler / piboom',
      note: 'Repositories, issues, and implementation history',
      href: 'https://github.com/wikitimetraveler/piboom',
      icon: 'bi-github',
    },
    {
      label: 'Mortgage tools',
      value: 'Worksheets & Encompass demos',
      note: 'Live calculators and ICE-integrated tools',
      href: '/finance/index.html',
      icon: 'bi-bank',
    },
    {
      label: 'Engagement',
      value: 'FTE and contract consulting',
      note: 'Encompass admin/dev, ICE integrations, AI on the loan stack',
      href: '/about.html',
      icon: 'bi-briefcase',
    },
    {
      label: 'Lane Family',
      value: 'thelanefamily.us',
      note: 'Heritage site — separate from mortgage portfolio',
      href: 'https://www.thelanefamily.us',
      icon: 'bi-house-heart',
    },
  ];

  /** Resolve live URL for a portfolio site. */
  function resolveSiteUrl(site) {
    const path = site.path || '/';
    if (hostMatchesDeployment()) {
      try {
        return new URL(path, global.location.origin).href;
      } catch (_) {
        return path;
      }
    }
    if (site.absoluteUrl) {
      const base = site.absoluteUrl.replace(/\/$/, '');
      return path === '/' ? base : base + path;
    }
    const host = site.domain || PRIMARY_HOST;
    const base = host.startsWith('http') ? host : 'https://www.' + host.replace(/^www\./, '');
    return base.replace(/\/$/, '') + path;
  }

  /** href for anchors — relative on current deployment (thelanefamily.us, devconnectlabs, localhost). */
  function resolveSiteHref(site) {
    const path = site.path || '/';
    if (hostMatchesDeployment()) {
      return path;
    }
    return resolveSiteUrl(site);
  }

  function getPortfolioSites(demoMode, options) {
    const opts = options || {};
    let list;
    if (demoMode) {
      list = PORTFOLIO_SITES.filter((s) => s.demoOnly);
    } else {
      list = PORTFOLIO_SITES.filter((s) => !s.demoOnly);
    }
    const loggedIn =
      typeof opts.loggedIn === 'boolean'
        ? opts.loggedIn
        : typeof global.isLoggedIn === 'function' && !!global.isLoggedIn();
    if (!loggedIn && opts.hideAuthRequired !== false) {
      list = list.filter((s) => !s.authRequired);
    }
    return list;
  }

  function getPortfolioProjects(options) {
    const opts = options || {};
    let list = PORTFOLIO_PROJECTS.slice();
    if (opts.demoMode) {
      list = list.filter((p) => p.demoOnly);
    } else if (!opts.includeDemo) {
      list = list.filter((p) => !p.demoOnly);
    }
    if (opts.category && opts.category !== 'all') {
      list = list.filter((p) => p.category === opts.category);
    }
    if (opts.featuredOnly) {
      list = list.filter((p) => p.featured);
    }
    if (opts.excludeOther) {
      list = list.filter((p) => p.category !== 'other');
    }
    const loggedIn =
      typeof opts.loggedIn === 'boolean'
        ? opts.loggedIn
        : typeof global.isLoggedIn === 'function' && !!global.isLoggedIn();
    if (!loggedIn && opts.hideAuthRequired !== false) {
      list = list.filter((p) => !p.authRequired);
    }
    return list.sort((a, b) => {
      if (a.featured && b.featured) return (a.featuredOrder || 0) - (b.featuredOrder || 0);
      if (a.featured) return -1;
      if (b.featured) return 1;
      return a.label.localeCompare(b.label);
    });
  }

  function resolveProjectHref(project) {
    const site = { path: project.path, domain: project.domain };
    return resolveSiteHref(site);
  }

  function resolveCaseStudyHref(project) {
    return '/work/case-study.html?id=' + encodeURIComponent(project.id);
  }

  function getPortfolioProjectById(id) {
    return PORTFOLIO_PROJECTS.find((p) => p.id === id) || null;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPortfolioNav(activeId) {
    return PORTFOLIO_NAV.map((page) => {
      const active = page.id === activeId;
      return (
        '<a class="portfolio-nav__link' +
        (active ? ' is-active' : '') +
        '" href="' +
        page.href +
        '"' +
        (active ? ' aria-current="page"' : '') +
        '><i class="bi ' +
        page.icon +
        '" aria-hidden="true"></i>' +
        page.label +
        '</a>'
      );
    }).join('');
  }

  function renderCapabilities() {
    return CAPABILITIES.map(
      (cap) =>
        '<article class="portfolio-cap-card">' +
        '<div class="portfolio-cap-card__icon"><i class="bi ' +
        cap.icon +
        '" aria-hidden="true"></i></div>' +
        '<h3 class="portfolio-cap-card__title">' +
        escapeHtml(cap.title) +
        '</h3>' +
        '<p class="portfolio-cap-card__detail">' +
        escapeHtml(cap.detail) +
        '</p></article>'
    ).join('');
  }

  function renderStackTags(stack) {
    return (stack || [])
      .map((tag) => '<span class="portfolio-tag">' + escapeHtml(tag) + '</span>')
      .join('');
  }

  function renderFeaturedCaseStudies(options) {
    const opts = options || {};
    const showThumbs = opts.showThumbs === true;
    return getPortfolioProjects({ featuredOnly: true })
      .map((project) => {
        const demoHref = resolveProjectHref(project);
        const studyHref = project.caseStudy ? resolveCaseStudyHref(project) : demoHref;
        const thumb =
          showThumbs &&
          project.caseStudy &&
          project.caseStudy.screenshots &&
          project.caseStudy.screenshots[0]
            ? '<a class="portfolio-case-card__thumb" href="' +
              studyHref +
              '"><img src="' +
              escapeHtml(project.caseStudy.screenshots[0].src) +
              '" alt="" loading="lazy" width="960" height="540"/></a>'
            : '';
        const authBadge = project.authRequired
          ? '<span class="portfolio-badge portfolio-badge--auth"><i class="bi bi-shield-lock" aria-hidden="true"></i> Login</span>'
          : '<span class="portfolio-badge portfolio-badge--live"><i class="bi bi-play-circle" aria-hidden="true"></i> Live demo</span>';
        const ctas =
          project.caseStudy
            ? '<div class="portfolio-case-card__actions">' +
              '<a class="portfolio-btn portfolio-btn--primary portfolio-case-card__cta" href="' +
              studyHref +
              '">Case study <i class="bi bi-journal-text" aria-hidden="true"></i></a>' +
              '<a class="portfolio-btn portfolio-btn--outline portfolio-case-card__cta" href="' +
              demoHref +
              '">Open demo <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>'
            : '<a class="portfolio-btn portfolio-btn--primary portfolio-case-card__cta" href="' +
              demoHref +
              '">Open demo <i class="bi bi-arrow-right" aria-hidden="true"></i></a>';
        return (
          '<article class="portfolio-case-card">' +
          thumb +
          '<div class="portfolio-case-card__head">' +
          '<i class="bi ' +
          project.icon +
          ' portfolio-case-card__icon" aria-hidden="true"></i>' +
          authBadge +
          '</div>' +
          '<h3 class="portfolio-case-card__title">' +
          escapeHtml(project.label) +
          '</h3>' +
          '<p class="portfolio-case-card__problem">' +
          escapeHtml(project.problem) +
          '</p>' +
          '<p class="portfolio-case-card__blurb">' +
          escapeHtml(project.consultingBlurb) +
          '</p>' +
          '<div class="portfolio-case-card__tags">' +
          renderStackTags(project.stack) +
          '</div>' +
          ctas +
          '</article>'
        );
      })
      .join('');
  }

  function renderProjectCards(projects, options) {
    const opts = options || {};
    const showThumbs = opts.showThumbs !== false;
    return (projects || [])
      .map((project) => {
        const demoHref = resolveProjectHref(project);
        const href = project.caseStudy ? resolveCaseStudyHref(project) : demoHref;
        const external = /^https?:\/\//i.test(href) && isCrossOriginUrl(href);
        const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        const badges = [];
        if (project.caseStudy) {
          badges.push('<span class="portfolio-badge portfolio-badge--cat">Case study</span>');
        }
        if (project.authRequired) {
          badges.push('<span class="portfolio-badge portfolio-badge--auth">Login required</span>');
        } else {
          badges.push('<span class="portfolio-badge portfolio-badge--live">Public demo</span>');
        }
        badges.push(
          '<span class="portfolio-badge portfolio-badge--cat">' +
            escapeHtml(project.category) +
            '</span>'
        );
        const thumb =
          showThumbs &&
          project.caseStudy &&
          project.caseStudy.screenshots &&
          project.caseStudy.screenshots[0]
            ? '<div class="portfolio-project-card__thumb"><img src="' +
              escapeHtml(project.caseStudy.screenshots[0].src) +
              '" alt="" loading="lazy" width="960" height="540"/></div>'
            : '';
        return (
          '<a class="portfolio-project-card' +
          (project.caseStudy && showThumbs ? ' portfolio-project-card--has-study' : '') +
          '" href="' +
          href +
          '"' +
          targetAttr +
          ' data-project-id="' +
          project.id +
          '" data-category="' +
          project.category +
          '">' +
          thumb +
          '<div class="portfolio-project-card__icon"><i class="bi ' +
          project.icon +
          '" aria-hidden="true"></i></div>' +
          '<div class="portfolio-project-card__body">' +
          '<h3 class="portfolio-project-card__title">' +
          escapeHtml(project.label) +
          '</h3>' +
          '<p class="portfolio-project-card__tagline">' +
          escapeHtml(project.tagline) +
          '</p>' +
          '<div class="portfolio-project-card__badges">' +
          badges.join('') +
          '</div></div>' +
          '<i class="bi bi-arrow-up-right portfolio-project-card__arrow" aria-hidden="true"></i></a>'
        );
      })
      .join('');
  }

  function renderCaseStudyPage(project) {
    if (!project || !project.caseStudy) return '';
    const cs = project.caseStudy;
    const demoHref = resolveProjectHref(project);
    const shots = (cs.screenshots || [])
      .map(
        (shot) =>
          '<figure class="portfolio-study-shot">' +
          '<img src="' +
          escapeHtml(shot.src) +
          '" alt="' +
          escapeHtml(shot.caption) +
          '" loading="lazy" width="960" height="540"/>' +
          '<figcaption>' +
          escapeHtml(shot.caption) +
          '</figcaption></figure>'
      )
      .join('');
    const highlights = (cs.highlights || [])
      .map((item) => '<li>' + escapeHtml(item) + '</li>')
      .join('');
    const reelBlock = cs.reel
      ? '<div class="portfolio-study-reel"><video controls preload="metadata" poster="' +
        escapeHtml((cs.screenshots && cs.screenshots[0] && cs.screenshots[0].src) || '') +
        '"><source src="' +
        escapeHtml(cs.reel) +
        '" type="video/mp4"/>Your browser does not support video.</video></div>'
      : '';
    const authNote = project.authRequired
      ? '<p class="portfolio-study-note"><i class="bi bi-shield-lock" aria-hidden="true"></i> Live demo requires finance login on this host.</p>'
      : '';
    return (
      '<nav class="portfolio-study-back"><a href="/work.html"><i class="bi bi-arrow-left" aria-hidden="true"></i> All work</a></nav>' +
      '<header class="portfolio-study-hero">' +
      '<p class="portfolio-kicker">' +
      escapeHtml(project.category) +
      '</p>' +
      '<h1 class="portfolio-study-hero__title">' +
      escapeHtml(project.label) +
      '</h1>' +
      '<p class="portfolio-study-hero__tagline">' +
      escapeHtml(project.tagline) +
      '</p>' +
      '<div class="portfolio-study-hero__tags">' +
      renderStackTags(project.stack) +
      '</div>' +
      '<div class="portfolio-study-hero__cta">' +
      '<a class="portfolio-btn portfolio-btn--primary" href="' +
      demoHref +
      '">Open live demo <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>' +
      '<a class="portfolio-btn portfolio-btn--ghost" href="/contact.html">Contact <i class="bi bi-envelope" aria-hidden="true"></i></a>' +
      '</div>' +
      authNote +
      '</header>' +
      (cs.screenshots && cs.screenshots[0]
        ? '<div class="portfolio-study-hero-shot"><img src="' +
          escapeHtml(cs.screenshots[0].src) +
          '" alt="" loading="eager" width="960" height="540"/></div>'
        : '') +
      reelBlock +
      '<div class="portfolio-study-grid">' +
      '<section class="portfolio-study-block">' +
      '<h2>Problem</h2><p>' +
      escapeHtml(project.problem) +
      '</p></section>' +
      '<section class="portfolio-study-block">' +
      '<h2>Outcome</h2><p>' +
      escapeHtml(cs.outcome) +
      '</p></section>' +
      '<section class="portfolio-study-block">' +
      '<h2>My role</h2><p>' +
      escapeHtml(cs.role) +
      '</p></section>' +
      '<section class="portfolio-study-block portfolio-study-block--wide">' +
      '<h2>Highlights</h2><ul>' +
      highlights +
      '</ul></section>' +
      '</div>' +
      (shots
        ? '<section class="portfolio-study-gallery"><h2>Screenshots</h2><div class="portfolio-study-gallery__grid">' +
          shots +
          '</div></section>'
        : '')
    );
  }

  function renderPortfolioContactCards() {
    return CONTACT_ITEMS.map((item) => {
      const inner =
        '<div class="portfolio-contact-card__icon"><i class="bi ' +
        item.icon +
        '" aria-hidden="true"></i></div>' +
        '<div><p class="portfolio-contact-card__label">' +
        escapeHtml(item.label) +
        '</p><p class="portfolio-contact-card__value">' +
        escapeHtml(item.value) +
        '</p>' +
        (item.note ? '<p class="portfolio-contact-card__note">' + escapeHtml(item.note) + '</p>' : '') +
        '</div>';
      if (item.href) {
        const external = item.href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '';
        return '<a class="portfolio-contact-card" href="' + item.href + '"' + external + '>' + inner + '</a>';
      }
      return '<div class="portfolio-contact-card">' + inner + '</div>';
    }).join('');
  }

  function renderPortfolioStackChips() {
    return STACK_CHIPS.map(
      (item) =>
        '<span class="portfolio-stack-chip"><i class="bi ' +
        item.icon +
        '" aria-hidden="true"></i>' +
        escapeHtml(item.label) +
        '</span>'
    ).join('');
  }

  function renderPortfolioStackGroups() {
    return STACK_GROUPS.map((group) => {
      const cards = group.items
        .map(
          (item) =>
            '<article class="portfolio-stack-item">' +
            '<div class="portfolio-stack-item__icon"><i class="bi ' +
            item.icon +
            '" aria-hidden="true"></i></div>' +
            '<div><h3 class="portfolio-stack-item__title">' +
            escapeHtml(item.label) +
            '</h3>' +
            '<p class="portfolio-stack-item__detail">' +
            escapeHtml(item.detail) +
            '</p></div></article>'
        )
        .join('');
      return (
        '<section class="portfolio-stack-group">' +
        '<h2 class="portfolio-stack-group__title">' +
        escapeHtml(group.title) +
        '</h2>' +
        '<div class="portfolio-stack-group__grid">' +
        cards +
        '</div></section>'
      );
    }).join('');
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
    const loggedIn = typeof global.isLoggedIn === 'function' && !!global.isLoggedIn();
    const visible = (sites || []).filter((site) => loggedIn || !site.authRequired);
    return visible
      .slice(0, 8)
      .map((site) => {
        const href = resolveSiteHref(site);
        const domain = resolveDisplayDomain(site);
        const external = /^https?:\/\//i.test(href) && isCrossOriginUrl(href);
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
          href +
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
        const href = resolveSiteHref(site);
        const domain = resolveDisplayDomain(site);
        const title = (site.tagline || site.label).replace(/"/g, '&quot;');
        const external = /^https?:\/\//i.test(href) && isCrossOriginUrl(href);
        const targetAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return (
          '<a class="ice-site-card" href="' +
          href +
          '"' +
          targetAttr +
          ' title="' +
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
    LANE_FAMILY_HOST,
    PLATFORM_NAME,
    PORTFOLIO_EMAIL,
    PORTFOLIO_CALENDLY_URL,
    PORTFOLIO_SITES,
    PORTFOLIO_PROJECTS,
    CAPABILITIES,
    PORTFOLIO_NAV,
    STACK_CHIPS,
    STACK_GROUPS,
    DOCK_PAGES,
    CONTACT_ITEMS,
    getPortfolioSites,
    getPortfolioProjects,
    getPortfolioProjectById,
    resolveSiteUrl,
    resolveSiteHref,
    resolveProjectHref,
    resolveCaseStudyHref,
    resolveDisplayDomain,
    hostMatchesDeployment,
    renderDock,
    renderPortfolioNav,
    renderCapabilities,
    renderFeaturedCaseStudies,
    renderCaseStudyPage,
    renderProjectCards,
    renderPortfolioContactCards,
    renderPortfolioStackChips,
    renderPortfolioStackGroups,
    renderFeaturedSites,
    renderContactCards,
    renderStackChips,
    renderStackGroups,
    renderSiteCards,
  };
})(typeof window !== 'undefined' ? window : globalThis);
