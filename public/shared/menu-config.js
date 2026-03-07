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
    { href: '/finance/index.html', icon: 'bi-bank', label: 'Finance', domain: 'finance', title: 'Encompass, calculators, unit tests', demoOnly: true },
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub', domain: 'encompass', title: 'Encompass Hub, pipeline, loan APIs', demoOnly: true },
    { href: '/nature/nature-hub.html', icon: 'bi-tree-fill', label: 'Nature', domain: 'nature', title: 'Trees, critters, field guide', demoOnly: false },
    { href: '/bike-store-home.html', icon: 'bi-bicycle', label: 'Bike', domain: 'bike', title: 'Bike shop, peloton, discover', demoOnly: false },
    { href: '/ai/voice-dj.html', icon: 'bi-robot', label: 'AI & Voice', domain: 'ai', title: 'Wolfman Dave, Levi, voice guide', demoOnly: false },
    { href: '/entertainment/player.html', icon: 'bi-stars', label: 'Entertainment', domain: 'entertainment', title: 'Boombox, visualizer, posters', demoOnly: false },
    { href: '/local/local-spots.html', icon: 'bi-geo-alt-fill', label: 'Local', domain: 'local', title: 'Local spots map', demoOnly: false },
    { href: '/family/genealogy.html', icon: 'bi-people-fill', label: 'Family', domain: 'family', title: 'Family tree', demoOnly: false },
  ];

  /** Navbar Finance dropdown items */
  const NAV_FINANCE = [
    { href: '/finance/index.html', icon: 'bi-calculator', label: 'Finance Hub' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant' },
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk Dashboard' },
    { href: '/finance/unit-tests.html', icon: 'bi-clipboard-check', label: 'Unit Tests' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'The Screen Test' },
  ];

  /** Navbar Music dropdown items */
  const NAV_MUSIC = [
    { href: '/music/music-research.html', icon: 'bi-search', label: 'Music Research' },
    { href: '/music/album-discovery.html', icon: 'bi-disc', label: 'Album Discovery' },
    { href: '/music/collection.html', icon: 'bi-collection-fill', label: 'My Collection' },
    { href: '/music/song-identifier.html', icon: 'bi-soundwave', label: 'Song Identifier' },
    { href: '/music/spotify-dashboard.html', icon: 'bi-spotify', label: 'Spotify' },
    { href: '/music/music-time-machine.html', icon: 'bi-clock-history', label: 'Time Machine' },
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
    { href: '/family/genealogy.html', icon: 'bi-diagram-3', label: 'Family' },
    { href: '/nature/tree-discovery.html', icon: 'bi-tree-fill', label: 'Tree Discovery' },
    { href: '/nature/tree-collection.html', icon: 'bi-trees', label: 'Tree Collection' },
    { href: '/nature/critter-discovery.html', icon: 'bi-bug-fill', label: 'Critter Discovery' },
    { href: '/nature/critter-collection.html', icon: 'bi-bug', label: 'Critter Collection' },
    { href: '/local/local-spots.html', icon: 'bi-geo-alt-fill', label: 'Local Spots' },
    { divider: true },
    { href: '/', icon: 'bi-house', label: 'Hub (All Tools)' },
  ];

  /** Finance hub tool grid (domain-grid-sm) */
  const FINANCE_TOOLS = [
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
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk', title: 'Pipeline Risk Dashboard' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant', title: 'Encompass AI Assistant' },
    { href: '/finance/encompass-hub.html', icon: 'bi-cloud-arrow-down', label: 'Encompass Hub', title: 'Encompass Hub' },
    { href: '/finance/encompass-users.html', icon: 'bi-people', label: 'Encompass Users', title: 'Encompass Users' },
    { href: '/finance/encompass-native-fields.html', icon: 'bi-list-columns', label: 'Native Fields', title: 'Native Loan Fields' },
    { href: '/finance/encompass-custom-fields.html', icon: 'bi-sliders', label: 'Custom Fields', title: 'Custom Loan Fields' },
    { href: '/finance/unit-tests.html', icon: 'bi-check2-circle', label: 'Unit Tests', title: 'Unit Test Runner' },
    { href: '/finance/tool2.html', icon: 'bi-code-slash', label: 'Parser', title: 'The Parser' },
    { href: '/finance/tool3.html', icon: 'bi-globe', label: 'Mashup', title: 'The Mashup' },
    { href: '/finance/tool4.html', icon: 'bi-gear', label: 'Automator', title: 'The Automator' },
    { href: '/finance/tool5.html', icon: 'bi-rulers', label: 'Ruler', title: 'The Ruler' },
    { href: '/finance/tool6.html', icon: 'bi-arrow-repeat', label: 'Transformer', title: 'The Transformer' },
    { href: '/finance/tool8.html', icon: 'bi-magic', label: 'Alchemist', title: 'The Alchemist' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test', title: 'The Screen Test' },
  ];

  /** Nature hub tool grid */
  const NATURE_TOOLS = [
    { href: '/nature/tree-discovery.html', icon: 'bi-tree', label: 'Tree Discovery', title: 'Discover trees' },
    { href: '/nature/tree-collection.html', icon: 'bi-collection', label: 'Tree Collection', title: 'Your tree collection' },
    { href: '/nature/critter-discovery.html', icon: 'bi-bug', label: 'Critter Discovery', title: 'Discover critters' },
    { href: '/nature/critter-collection.html', icon: 'bi-collection', label: 'Critter Collection', title: 'Your critter collection' },
    { href: '/nature/fish-identification.html', icon: 'bi-droplet', label: 'Fish ID', title: 'Identify fish' },
    { href: '/nature/fish-collection.html', icon: 'bi-collection', label: 'Fish Collection', title: 'Your fish collection' },
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
  ];

  /** Get home domain tiles, optionally filtered for demo mode */
  function getDomainTiles(demoMode) {
    if (demoMode) {
      return DOMAIN_TILES.filter(t => t.demoOnly);
    }
    return DOMAIN_TILES;
  }

  /** Render domain grid HTML from items array */
  function renderDomainGridItems(items, options) {
    const basePath = (options && options.basePath) || '';
    return items.map(function (item) {
      const href = item.href.startsWith('/') ? item.href : basePath + item.href;
      const domain = item.domain ? ' data-domain="' + item.domain + '"' : '';
      const title = (item.title || item.label).replace(/"/g, '&quot;');
      return '<a href="' + href + '" class="domain-tile"' + domain + ' title="' + title + '">' +
        '<i class="bi ' + item.icon + '"></i><span>' + item.label + '</span></a>';
    }).join('');
  }

  const MENU_CONFIG = {
    DOMAIN_TILES,
    getDomainTiles,
    renderDomainGridItems,
    NAV_FINANCE,
    NAV_MUSIC,
    NAV_ENTERTAINMENT,
    NAV_MORE,
    FINANCE_TOOLS,
    NATURE_TOOLS,
    BIKE_TOOLS,
    MUSIC_TOOLS,
  };

  global.MENU_CONFIG = MENU_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
