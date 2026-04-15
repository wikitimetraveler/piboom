/**
 * Centralized menu configuration for DevConnect Labs.
 * Single source of truth for domain grids, navbar dropdowns, and hub tool grids.
 * @see AGENTS.md, docs/FRONTEND_PATTERNS.md
 */
(function (global) {
  'use strict';

  /** Home page domain tiles. demoOnly: true = shown only in demo mode (?demo=1) */
  const DOMAIN_TILES = [
    { href: '/music/music-research.html', icon: 'bi-music-note-beamed', label: 'Music', domain: 'music', title: 'Music research, albums, Spotify, song ID', demoOnly: false },
    { href: '/finance/index.html', icon: 'bi-bank', label: 'Worksheets', domain: 'finance', title: 'Worksheets — Encompass, calculators, unit tests', demoOnly: true },
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub', domain: 'encompass', title: 'Encompass Hub, pipeline, loan APIs', demoOnly: true },
    { href: '/nature/nature-hub.html', icon: 'bi-tree-fill', label: 'Nature', domain: 'nature', title: 'Trees, critters, field guide', demoOnly: false },
    { href: '/bike-store-home.html', icon: 'bi-bicycle', label: 'Bike', domain: 'bike', title: 'Bike shop, peloton, discover', demoOnly: false },
    { href: '/ai/voice-dj.html', icon: 'bi-robot', label: 'AI & Voice', domain: 'ai', title: 'Wolfman Dave, Levi, voice guide', demoOnly: false },
    { href: '/entertainment/player.html', icon: 'bi-stars', label: 'Entertainment', domain: 'entertainment', title: 'Boombox, visualizer, posters', demoOnly: false },
    { href: '/local/local-spots.html', icon: 'bi-geo-alt-fill', label: 'Local', domain: 'local', title: 'Local spots map', demoOnly: false },
    { href: '/finds/index.html', icon: 'bi-search-heart', label: 'Finds', domain: 'finds', title: 'Thrift & vintage discovery', demoOnly: false },
    { href: '/family/genealogy.html', icon: 'bi-people-fill', label: 'D3 Family Tree', domain: 'family', title: 'D3.js Family Tree Visualization', demoOnly: false },
  ];

  /** Navbar Worksheets dropdown items (URLs under /finance/) */
  const NAV_FINANCE = [
    { href: '/finance/index.html', icon: 'bi-calculator', label: 'Worksheets Hub' },
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub' },
    { href: '/finance/loan-batch-update.html', icon: 'bi-layers-half', label: 'Loan batch update' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant' },
    { href: '/finance/unit-tests.html', icon: 'bi-check2-circle', label: 'Unit Tests' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk' },
    { divider: true },
    { href: '/finance/index.html', icon: 'bi-grid-3x3-gap', label: 'All Worksheets Tools' },
  ];

  /** Navbar Encompass dropdown items (under Worksheets or standalone) */
  const NAV_ENCOMPASS = [
    { href: '/finance/encompass-hub.html', icon: 'bi-cloud-arrow-down', label: 'Encompass Hub' },
    { href: '/finance/loan-batch-update.html', icon: 'bi-layers-half', label: 'Loan batch update' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk' },
    { href: '/finance/unit-tests.html', icon: 'bi-clipboard-check', label: 'Unit Tests' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test' },
    { href: '/finance/encompass-users.html', icon: 'bi-people', label: 'Users' },
    { href: '/finance/encompass-native-fields.html', icon: 'bi-list-columns', label: 'Native Fields' },
    { href: '/finance/encompass-custom-fields.html', icon: 'bi-sliders', label: 'Custom Fields' },
    { href: '/finance/tool2.html', icon: 'bi-code-slash', label: 'Parser' },
    { href: '/finance/tool3.html', icon: 'bi-globe', label: 'Mashup' },
    { href: '/finance/tool4.html', icon: 'bi-gear', label: 'Automator' },
    { href: '/finance/tool5.html', icon: 'bi-rulers', label: 'Ruler' },
    { href: '/finance/tool6.html', icon: 'bi-arrow-repeat', label: 'Transformer' },
    { href: '/finance/tool8.html', icon: 'bi-magic', label: 'Alchemist' },
  ];

  /** Navbar Music dropdown items */
  const NAV_MUSIC = [
    { href: '/music/music-research.html', icon: 'bi-search', label: 'Music Research' },
    { href: '/music/album-discovery.html', icon: 'bi-disc', label: 'Album Discovery' },
    { href: '/music/collection.html', icon: 'bi-collection-fill', label: 'My Collection' },
    { href: '/music/song-identifier.html', icon: 'bi-soundwave', label: 'Song Identifier' },
    { href: '/music/spotify-dashboard.html', icon: 'bi-spotify', label: 'Spotify' },
    { href: '/music/music-time-machine.html', icon: 'bi-clock-history', label: 'Time Machine' },
    { href: '/music/kml-viewer.html', icon: 'bi-globe2', label: 'KML Timeline' },
    { href: '/music/musical-google-earth-files.html', icon: 'bi-cloud-arrow-down', label: 'Google Earth KML' },
    { href: '/music/my-grateful-dead-shows.html', icon: 'bi-calendar-event', label: 'Grateful Dead Shows' },
    { href: '/music/sample-detector.html', icon: 'bi-magnet', label: 'Sample Detector' },
    { divider: true },
    { href: '/#headingMusic', icon: 'bi-grid-3x3-gap', label: 'All Music Tools' },
  ];

  /** Navbar Entertainment dropdown items */
  const NAV_ENTERTAINMENT = [
    { href: '/entertainment/player.html', icon: 'bi-volume-up', label: 'The Boombox' },
    { href: '/entertainment/visualizer.html', icon: 'bi-palette-fill', label: 'Psychedelic Visualizer' },
    { href: '/entertainment/blacklight.html', icon: 'bi-lightning', label: 'Black Light Zone' },
    { href: '/entertainment/poster-generator.html', icon: 'bi-palette', label: 'Poster Generator' },
    { href: '/entertainment/art-gallery.html', icon: 'bi-image', label: 'Art Gallery' },
    { href: '/entertainment/ouija-board.html', icon: 'bi-magic', label: 'Ouija Board' },
    { divider: true },
    { href: '/#headingEntertainment', icon: 'bi-grid-3x3-gap', label: 'All Entertainment' },
  ];

  /** Navbar More dropdown items */
  const NAV_MORE = [
    { href: '/bike-store-home.html', icon: 'bi-bicycle', label: 'Bike Store' },
    { href: '/ai/voice-dj.html', icon: 'bi-mic', label: 'Wolfman Dave' },
    { href: '/ai/assistant.html', icon: 'bi-chat-dots', label: 'Levi Assistant' },
    { href: '/ai/voice-guide.html', icon: 'bi-book', label: 'Voice Guide' },
    { href: '/family/genealogy.html', icon: 'bi-diagram-3', label: 'D3 Family Tree' },
    { href: '/nature/tree-discovery.html', icon: 'bi-tree-fill', label: 'Tree Discovery' },
    { href: '/nature/tree-collection.html', icon: 'bi-trees', label: 'Tree Collection' },
    { href: '/nature/critter-discovery.html', icon: 'bi-bug-fill', label: 'Critter Discovery' },
    { href: '/nature/critter-collection.html', icon: 'bi-bug', label: 'Critter Collection' },
    { href: '/local/local-spots.html', icon: 'bi-geo-alt-fill', label: 'Local Spots' },
    { href: '/finds/index.html', icon: 'bi-search-heart', label: 'Finds' },
    { divider: true },
    { href: '/', icon: 'bi-house', label: 'Hub (All Tools)' },
  ];

  /** Worksheets hub tool grid (calculators + disasters only) */
  const FINANCE_TOOLS = [
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub', title: 'Encompass Hub, pipeline, loan APIs' },
    { href: '/finance/fha-streamline-calculator.html', icon: 'bi-calculator', label: 'FHA Streamline', title: 'FHA Streamline refinance calculator' },
    { href: '/finance/asset-qualifier-calculator.html', icon: 'bi-wallet2', label: 'Asset Qualifier', title: 'Asset Qualifier Calculator' },
    { href: '/finance/fha-streamline-loan-amount-calculator.html', icon: 'bi-cash-coin', label: 'FHA Loan Amount', title: 'FHA Streamline Loan Amount' },
    { href: '/finance/fha-streamline-ntb-calculator.html', icon: 'bi-graph-up', label: 'FHA NTB', title: 'FHA Streamline NTB' },
    { href: '/finance/dti-calculator.html', icon: 'bi-percent', label: 'DTI Calculator', title: 'Debt-to-Income Calculator' },
    { href: '/finance/cashout-refinance-calculator.html', icon: 'bi-cash-coin', label: 'Cash-Out', title: 'Cash-Out Refinance' },
    { href: '/finance/amortization-schedule-calculator.html', icon: 'bi-calendar', label: 'Amortization', title: 'Amortization Schedule' },
    { href: '/finance/closing-cost-calculator.html', icon: 'bi-receipt', label: 'Closing Cost', title: 'Closing Cost Calculator' },
    { href: '/finance/ltv-calculator.html', icon: 'bi-house-door', label: 'LTV', title: 'Loan-to-Value Calculator' },
    { href: '/finance/va-irrrl-calculator.html', icon: 'bi-calculator', label: 'VA IRRRL', title: 'VA IRRRL Calculator' },
    { href: '/finance/disasters-unified.html', icon: 'bi-globe', label: 'Unified Disasters', title: 'Unified Disasters (90-day)' },
  ];

  /** Encompass hub tool grid (Encompass Assistant, pipeline, fields, tools) */
  const ENCOMPASS_TOOLS = [
    { href: '/finance/index.html', icon: 'bi-calculator', label: 'Worksheets Hub', title: 'Worksheets Hub, calculators, disasters' },
    { href: '/finance/encompass-hub.html', icon: 'bi-cloud-arrow-down', label: 'Encompass Hub', title: 'Encompass Hub' },
    { href: '/finance/loan-batch-update.html', icon: 'bi-layers-half', label: 'Loan batch update', title: 'Encompass loanBatch/updateRequests' },
    { href: '/finance/processor-assignment.html', icon: 'bi-people-fill', label: 'Processor assignment', title: 'Complexity scoring and processor assignment' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant', title: 'Encompass AI Assistant' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk', title: 'Pipeline Risk Dashboard' },
    { href: '/finance/unit-tests.html', icon: 'bi-check2-circle', label: 'Unit Tests', title: 'Unit Test Runner' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test', title: 'The Screen Test' },
    { href: '/finance/encompass-users.html', icon: 'bi-people', label: 'Users', title: 'Encompass Users' },
    { href: '/finance/encompass-native-fields.html', icon: 'bi-list-columns', label: 'Native Fields', title: 'Native Loan Fields' },
    { href: '/finance/encompass-custom-fields.html', icon: 'bi-sliders', label: 'Custom Fields', title: 'Custom Loan Fields' },
    { href: '/finance/encompass-hub-test.html', icon: 'bi-clipboard-check', label: 'Test Endpoints', title: 'Test API endpoints' },
    { href: '/finance/tool2.html', icon: 'bi-code-slash', label: 'Parser', title: 'The Parser' },
    { href: '/finance/tool3.html', icon: 'bi-globe', label: 'Mashup', title: 'The Mashup' },
    { href: '/finance/tool4.html', icon: 'bi-gear', label: 'Automator', title: 'The Automator' },
    { href: '/finance/tool5.html', icon: 'bi-rulers', label: 'Ruler', title: 'The Ruler' },
    { href: '/finance/tool6.html', icon: 'bi-arrow-repeat', label: 'Transformer', title: 'The Transformer' },
    { href: '/finance/tool8.html', icon: 'bi-magic', label: 'Alchemist', title: 'The Alchemist' },
  ];

  /** Nature hub tool grid */
  const NATURE_TOOLS = [
    { href: '/nature/tree-discovery.html', icon: 'bi-tree', label: 'Tree Discovery', title: 'Discover trees' },
    { href: '/nature/tree-collection.html', icon: 'bi-collection', label: 'Tree Collection', title: 'Your tree collection' },
    { href: '/nature/critter-discovery.html', icon: 'bi-bug', label: 'Critter Discovery', title: 'Discover critters' },
    { href: '/nature/critter-collection.html', icon: 'bi-collection', label: 'Critter Collection', title: 'Your critter collection' },
    { href: '/nature/fish-identification.html', icon: 'bi-droplet', label: 'Fish ID', title: 'Identify fish' },
    { href: '/nature/fish-collection.html', icon: 'bi-collection', label: 'Fish Collection', title: 'Your fish collection' },
    { href: '/nature/rock-discovery.html', icon: 'bi-gem', label: 'Rocky The Rock Star', title: 'Rubies, gems & meteorites — Rocky The Rock Star' },
    { href: '/nature/rock-collection.html', icon: 'bi-circle', label: 'Rock Collection', title: 'Your rock specimens' },
    { href: '/nature/share-collection.html', icon: 'bi-share', label: 'Share Collection', title: 'Share your collection' },
  ];

  /** Bike hub tool grid */
  const BIKE_TOOLS = [
    { href: '/bike-store-home.html', icon: 'bi-house', label: 'Store Home', title: 'Store home' },
    { href: '/bike-discover.html', icon: 'bi-search', label: 'Discover', title: 'Discover bikes' },
    { href: '/bike-collection.html', icon: 'bi-grid', label: 'The Peloton', title: 'The Peloton collection' },
    { href: '/bike-customers.html', icon: 'bi-people', label: 'Customers', title: 'Customers' },
  ];

  /** Music mini-nav items (used by music-mini-nav.js) */
  const MUSIC_TOOLS = [
    { href: '/music/music-research.html', icon: 'bi-search', label: 'Music Research', title: 'Search albums, artists, Spotify' },
    { href: '/music/album-discovery.html', icon: 'bi-disc', label: 'Album Discovery', title: 'Discover albums' },
    { href: '/music/collection.html', icon: 'bi-collection-fill', label: 'My Collection', title: 'Your music collection' },
    { href: '/music/song-identifier.html', icon: 'bi-music-note-beamed', label: 'Song ID', title: 'Identify songs' },
    { href: '/music/spotify-dashboard.html', icon: 'bi-spotify', label: 'Spotify', title: 'Spotify dashboard' },
    { href: '/music/music-time-machine.html', icon: 'bi-clock-history', label: 'Time Machine', title: 'Music time machine' },
    { href: '/music/kml-viewer.html', icon: 'bi-globe2', label: 'KML Timeline', title: 'Upload or load KML, map timeline, YouTube' },
    { href: '/music/musical-google-earth-files.html', icon: 'bi-cloud-arrow-down', label: 'Google Earth KML', title: 'Network links and downloads for Google Earth Pro' },
    { href: '/music/my-grateful-dead-shows.html', icon: 'bi-calendar-event', label: 'Grateful Dead Shows', title: 'Grateful Dead show archive' },
    { href: '/music/sample-detector.html', icon: 'bi-magnet', label: 'Sample Detector', title: 'Detect samples and covers' },
  ];

  /** Get home domain tiles, optionally filtered for demo mode */
  function getDomainTiles(demoMode) {
    if (demoMode) {
      return DOMAIN_TILES.filter(t => t.demoOnly);
    }
    return DOMAIN_TILES;
  }

  function makeToolId(item, href) {
    if (item && item.id) return String(item.id);
    const source = String(href || item?.href || item?.label || 'home');
    return source
      .toLowerCase()
      .replace(/[?#].*$/, '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'home';
  }

  function normalizeToolItem(item, options) {
    const basePath = (options && options.basePath) || '';
    const href = item.href.startsWith('/') ? item.href : basePath + item.href;
    return {
      id: makeToolId(item, href),
      href: href,
      icon: item.icon || 'bi-grid',
      label: item.label || 'Tool',
      title: item.title || item.label || 'Tool',
      category: item.category || (options && options.category) || 'General',
      domain: item.domain || ''
    };
  }

  function getAllTools(demoMode) {
    const groups = [
      { items: getDomainTiles(demoMode), category: 'Domain' },
      { items: FINANCE_TOOLS, category: 'Worksheets' },
      { items: ENCOMPASS_TOOLS, category: 'Encompass' },
      { items: NATURE_TOOLS, category: 'Nature' },
      { items: BIKE_TOOLS, category: 'Bike' },
      { items: MUSIC_TOOLS, category: 'Music' }
    ];
    const tools = [];
    groups.forEach((group) => {
      (group.items || []).forEach((item) => {
        if (item && !item.divider && item.href) {
          tools.push(normalizeToolItem(item, { category: group.category }));
        }
      });
    });
    return tools;
  }

  /** Render domain grid HTML from items array */
  function renderDomainGridItems(items, options) {
    return items.map(function (item) {
      const normalized = normalizeToolItem(item, options);
      const domain = normalized.domain ? ' data-domain="' + normalized.domain + '"' : '';
      const title = normalized.title.replace(/"/g, '&quot;');
      const label = normalized.label.replace(/"/g, '&quot;');
      const category = normalized.category.replace(/"/g, '&quot;');
      return '<a href="' + normalized.href + '" class="domain-tile"' + domain +
        ' title="' + title + '"' +
        ' data-tool-id="' + normalized.id + '"' +
        ' data-tool-url="' + normalized.href + '"' +
        ' data-tool-label="' + label + '"' +
        ' data-tool-category="' + category + '"' +
        ' data-tool-icon="' + normalized.icon + '">' +
        '<i class="bi ' + normalized.icon + '"></i><span>' + normalized.label + '</span>' +
        '</a>';
    }).join('');
  }

  const MENU_CONFIG = {
    DOMAIN_TILES,
    getDomainTiles,
    getAllTools,
    makeToolId,
    normalizeToolItem,
    renderDomainGridItems,
    NAV_FINANCE,
    NAV_ENCOMPASS,
    NAV_MUSIC,
    NAV_ENTERTAINMENT,
    NAV_MORE,
    FINANCE_TOOLS,
    ENCOMPASS_TOOLS,
    NATURE_TOOLS,
    BIKE_TOOLS,
    MUSIC_TOOLS,
  };

  global.MENU_CONFIG = MENU_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
