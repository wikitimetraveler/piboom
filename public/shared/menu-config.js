/**
 * Centralized menu configuration for DevConnect Labs.
 * Single source of truth for domain grids, navbar dropdowns, and hub tool grids.
 * @see AGENTS.md, docs/FRONTEND_PATTERNS.md
 */
(function (global) {
  'use strict';

  /** Home page domain tiles. demoOnly: true = shown only in demo mode (?demo=1) */
  const DOMAIN_TILES = [
    { href: '/music/music-research.html', icon: 'bi-music-note-beamed', label: 'Music', domain: 'music', title: 'Field research: artist dossiers, members, birthplaces', demoOnly: false },
    { href: '/finance/disasters-unified.html', icon: 'bi-shield-exclamation', label: 'Unified Disasters', domain: 'disasters', title: 'Unified Disasters — hazard monitoring and pipeline risk', demoOnly: false },
    { href: '/nature/nature-hub.html', icon: 'bi-tree-fill', label: 'Nature', domain: 'nature', title: 'Trees, critters, field guide', demoOnly: false },
    { href: '/family/lane-family.html', icon: 'bi-house-heart', label: 'Lane Family', domain: 'family', title: 'Lane Family hub — tree, museum, and tools', demoOnly: false },
    { href: '/finance/index.html', icon: 'bi-bank', label: 'Worksheets', domain: 'finance', title: 'Worksheets — Encompass, calculators, unit tests', demoOnly: false, requiresAuth: true },
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub', domain: 'encompass', title: 'Encompass Hub, pipeline, loan APIs', demoOnly: true },
  ];

  /** Navbar Worksheets dropdown items (URLs under /finance/) */
  const NAV_FINANCE = [
    { href: '/finance/index.html', icon: 'bi-calculator', label: 'Worksheets Hub' },
    { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub' },
    { href: '/finance/disasters-unified.html', icon: 'bi-globe', label: 'Unified Disasters' },
    { href: '/finance/disasters-encompass-map.html', icon: 'bi-geo-alt', label: 'Encompass map' },
    { href: '/finance/loan-batch-update.html', icon: 'bi-layers-half', label: 'Loan batch update' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant' },
    { href: '/finance/unit-tests.html', icon: 'bi-check2-circle', label: 'Unit Tests' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk' },
    { href: '/gse-analyzer.html', icon: 'bi-graph-up-arrow', label: 'GSE scenario analyzer' },
    { divider: true },
    { href: '/finance/index.html', icon: 'bi-grid-3x3-gap', label: 'All Worksheets Tools' },
  ];

  /** Navbar Encompass items — full catalog when logged in (Worksheets dropdown expands to this). */
  const NAV_ENCOMPASS = [
    { href: '/finance/encompass-hub.html', icon: 'bi-cloud-arrow-down', label: 'Encompass Hub' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant' },
    { href: '/finance/encompass-analytics.html', icon: 'bi-bar-chart-line', label: 'Analytics' },
    { href: '/finance/loan-batch-update.html', icon: 'bi-layers-half', label: 'Loan batch update' },
    { href: '/finance/processor-assignment.html', icon: 'bi-people-fill', label: 'Processor assignment' },
    { href: '/finance/processor-assignment-mock.html', icon: 'bi-people', label: 'Processor assignment (demo)' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk' },
    { href: '/finance/risk-analysis-dashboard.html', icon: 'bi-graph-up', label: 'Risk Analysis' },
    { href: '/finance/unit-tests.html', icon: 'bi-clipboard-check', label: 'Unit Tests' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test' },
    { href: '/finance/encompass-users.html', icon: 'bi-people', label: 'Users' },
    { href: '/finance/encompass-native-fields.html', icon: 'bi-list-columns', label: 'Native Fields' },
    { href: '/finance/encompass-custom-fields.html', icon: 'bi-sliders', label: 'Custom Fields' },
    { href: '/finance/condition-manager.html', icon: 'bi-clipboard-check', label: 'Condition Manager' },
    { href: '/finance/enhanced-conditions.html', icon: 'bi-ui-checks-grid', label: 'Enhanced Conditions' },
    { href: '/finance/enhanced-conditions-expert.html', icon: 'bi-journal-richtext', label: 'EC Expert' },
    { href: '/finance/tpo-connect.html', icon: 'bi-people', label: 'TPO Connect' },
    { href: '/finance/encompass-hub-test.html', icon: 'bi-plug', label: 'Test Endpoints' },
    { href: '/finance/tool2.html', icon: 'bi-code-slash', label: 'Parser' },
    { href: '/finance/tool3.html', icon: 'bi-globe', label: 'Mashup' },
    { href: '/finance/tool4.html', icon: 'bi-gear', label: 'Automator' },
    { href: '/finance/tool5.html', icon: 'bi-rulers', label: 'Ruler' },
    { href: '/finance/tool6.html', icon: 'bi-arrow-repeat', label: 'Transformer' },
    { href: '/finance/tool8.html', icon: 'bi-magic', label: 'Alchemist' },
    { href: '/finance/disasters-unified.html', icon: 'bi-globe2', label: 'Unified Disasters' },
    { href: '/gse-analyzer.html', icon: 'bi-graph-up-arrow', label: 'GSE scenario analyzer' },
    { divider: true },
    { href: '/finance/index.html', icon: 'bi-calculator', label: 'Worksheets Hub' },
  ];

  /** Navbar Music dropdown items */
  const NAV_MUSIC = [
    { href: '/studio/', icon: 'bi-cassette', label: 'Studio' },
    { href: '/music/music-research.html', icon: 'bi-search', label: 'Music Research' },
    { href: '/music/album-discovery.html', icon: 'bi-disc', label: 'Album Discovery' },
    { href: '/music/collection.html', icon: 'bi-collection-fill', label: 'My Collection' },
    { href: '/music/song-identifier.html', icon: 'bi-soundwave', label: 'Song Identifier' },
    { href: '/music/spotify-dashboard.html', icon: 'bi-spotify', label: 'Spotify' },
    { href: '/music/music-time-machine.html', icon: 'bi-clock-history', label: 'Time Machine' },
    { href: '/music/music-pilgrimage-atlas.html', icon: 'bi-compass', label: 'Pilgrimage Atlas' },
    { href: '/music/kml-viewer.html', icon: 'bi-globe2', label: 'KML Timeline' },
    { href: '/music/musical-google-earth-files.html', icon: 'bi-cloud-arrow-down', label: 'Google Earth KML' },
    { href: '/music/my-grateful-dead-shows.html', icon: 'bi-calendar-event', label: 'Grateful Dead Shows' },
    { href: '/music/sample-detector.html', icon: 'bi-magnet', label: 'Sample Detector' },
    { href: '/mountain-high/', icon: 'bi-mountain', label: 'Mountain High', title: 'Mountain High Medicinals — 21+ type cards, Sage, locksmith Long Beach & L.A.' },
    { divider: true },
    { href: '/#headingMusic', icon: 'bi-grid-3x3-gap', label: 'All Music Tools' },
  ];

  /** Navbar Entertainment dropdown items */
  const NAV_ENTERTAINMENT = [
    { href: '/watch-together/', icon: 'bi-play-btn', label: 'Watch together' },
    { href: '/entertainment/coffee-dreams.html', icon: 'bi-cup-hot', label: 'Coffee Dreams' },
    { href: '/entertainment/player.html', icon: 'bi-volume-up', label: 'The Boombox' },
    { href: '/entertainment/visualizer.html', icon: 'bi-palette-fill', label: 'Psychedelic Visualizer' },
    { href: '/planetarium/', icon: 'bi-stars', label: 'Planetarium' },
    { href: '/planetarium/worlds/', icon: 'bi-globe2', label: 'Planet worlds', title: 'NASA globe home pages — research desk + Carl' },
    { href: '/entertainment/blacklight.html', icon: 'bi-lightning', label: 'Black Light Zone' },
    { href: '/entertainment/blacklight-poster.html', icon: 'bi-lightbulb', label: 'Black Light Poster' },
    { href: '/mountain-high/', icon: 'bi-mountain', label: 'Mountain High', title: 'Mountain High Medicinals — 21+ type cards, Sage, locksmith Long Beach & L.A.' },
    { href: '/entertainment/poster-generator.html', icon: 'bi-palette', label: 'Poster Generator' },
    { href: '/entertainment/art-gallery.html', icon: 'bi-image', label: 'Art Gallery' },
    { href: '/entertainment/ouija-board.html', icon: 'bi-magic', label: 'Ouija Board' },
    { divider: true },
    { href: '/entertainment/index.html', icon: 'bi-grid-3x3-gap', label: 'Entertainment Hub' },
  ];

  /** Entertainment hub tool grid */
  const ENTERTAINMENT_TOOLS = [
    { href: '/watch-together/', icon: 'bi-play-btn', label: 'Watch together', title: 'Open watch-together theater for up to 10 people — synced YouTube, chat, draw, viewer map. No code.' },
    { href: '/entertainment/coffee-dreams.html', icon: 'bi-cup-hot', label: 'Coffee Dreams', title: 'Private coffee photo gallery' },
    { href: '/entertainment/player.html', icon: 'bi-volume-up', label: 'The Boombox', title: 'Boombox audio player' },
    { href: '/entertainment/visualizer.html', icon: 'bi-palette-fill', label: 'Psychedelic Visualizer', title: 'Psychedelic visualizer' },
    { href: '/planetarium/', icon: 'bi-stars', label: 'Planetarium', title: 'Full-sky planetarium — stars, planets, constellations' },
    { href: '/planetarium/worlds/', icon: 'bi-globe2', label: 'Planet worlds', title: 'NASA globe home pages — research desk + Carl AstroAI' },
    { href: '/entertainment/blacklight.html', icon: 'bi-lightning', label: 'Black Light Zone', title: 'Black light neon scene' },
    { href: '/entertainment/blacklight-poster.html', icon: 'bi-lightbulb', label: 'Black Light Poster', title: 'Sound-reactive black-light poster' },
    { href: '/mountain-high/', icon: 'bi-mountain', label: 'Mountain High', title: 'Mountain High Medicinals — 21+ type cards, Sage, locksmith Long Beach & L.A.' },
    { href: '/entertainment/poster-generator.html', icon: 'bi-palette', label: 'Poster Generator', title: 'Generate psychedelic posters' },
    { href: '/entertainment/art-gallery.html', icon: 'bi-image', label: 'Art Gallery', title: 'Entertainment art gallery' },
    { href: '/entertainment/ouija-board.html', icon: 'bi-magic', label: 'Ouija Board', title: 'Spirit board experience' },
  ];

  /** Navbar More dropdown items */
  const NAV_MORE = [
    { href: '/heygen-hub.html', icon: 'bi-collection-play', label: 'HeyGen & HyperFrames', title: 'All HeyGen avatar videos and HyperFrames reels (public)' },
    { href: '/donuts/', icon: 'bi-hearts', label: 'Glazed', title: 'Glazed — public donut gallery with Pip (no login)' },
    { href: '/jordan/', icon: 'bi-globe-central-south-asia', label: 'Jordan', title: 'Jordan — bilingual history, food, music, argileh and living culture atlas with Rami (no login)' },
    { href: '/syria/', icon: 'bi-globe-central-south-asia', label: 'Syria', title: 'Syria — bilingual history, food, music, argileh and living culture atlas with Niqula (no login)' },
    { href: '/holy-land/', icon: 'bi-globe-central-south-asia', label: 'Palestine · Israel', title: 'Palestine · Israel — one bilingual cultural atlas (no login)' },
    { href: '/oman/', icon: 'bi-globe-central-south-asia', label: 'Oman', title: 'Oman — bilingual history, food, music, majlis and living culture atlas with Salim (no login)' },
    { href: '/iran/', icon: 'bi-globe-central-south-asia', label: 'Iran', title: 'Iran — bilingual history, food, music, café and living culture atlas with Nima (no login)' },
    { href: '/iraq/', icon: 'bi-globe-central-south-asia', label: 'Iraq', title: 'Iraq — bilingual history, food, music, café and living culture atlas with Zayd (no login)' },
    { href: '/lebanon/', icon: 'bi-globe-central-south-asia', label: 'Lebanon', title: 'Lebanon — bilingual history, food, music, café and living culture atlas with Karim (no login)' },
    { href: '/egypt/', icon: 'bi-globe-central-south-asia', label: 'Egypt', title: 'Egypt — bilingual history, food, music, café and living culture atlas with Omar (no login)' },
    { href: '/nature/shenango-valley.html', icon: 'bi-geo-alt', label: 'The Valley', title: 'West PA & East Ohio history gallery — Buhl Park hub, happening-now events, HyperFrames reel, Youngstown corridor, AI expert David' },
    { href: '/gse-analyzer.html', icon: 'bi-graph-up-arrow', label: 'GSE scenario analyzer' },
    { href: '/bike-store-home.html', icon: 'bi-bicycle', label: 'Bike Store' },
    { href: '/ai/voice-dj.html', icon: 'bi-mic', label: 'Wolfman Dave' },
    { href: '/ai/wolfman-booth.html', icon: 'bi-broadcast', label: 'Wolfman booth', title: 'LiveKit booth for Wolfman Dave — shared voice room' },
    { href: '/ai/assistant.html', icon: 'bi-chat-dots', label: 'Levi Assistant' },
    { href: '/ai/voice-guide.html', icon: 'bi-book', label: 'Voice Guide' },
    { href: '/family/lane-family.html', icon: 'bi-house-heart', label: 'Lane Family' },
    { href: '/nature/tree-discovery.html', icon: 'bi-tree-fill', label: 'Tree Discovery' },
    { href: '/nature/tree-collection.html', icon: 'bi-trees', label: 'Tree Collection' },
    { href: '/nature/critter-discovery.html', icon: 'bi-bug-fill', label: 'Critter Discovery' },
    { href: '/nature/critter-collection.html', icon: 'bi-bug', label: 'Critter Collection' },
    { href: '/local/local-spots.html', icon: 'bi-geo-alt-fill', label: 'Local Spots' },
    { href: '/finds/index.html', icon: 'bi-search-heart', label: 'Finds' },
    { divider: true },
    { href: '/', icon: 'bi-house', label: 'Home' },
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
    { href: '/finance/disasters-encompass-map.html', icon: 'bi-geo-alt', label: 'Encompass map', title: 'Encompass map — live proximity loan pins' },
  ];

  /** Encompass hub / AI Assistant tool grid — full catalog when logged in. */
  const ENCOMPASS_TOOLS = [
    { href: '/finance/index.html', icon: 'bi-calculator', label: 'Worksheets Hub', title: 'Worksheets Hub, calculators, disasters' },
    { href: '/gse-analyzer.html', icon: 'bi-graph-up-arrow', label: 'GSE scenario analyzer', title: 'Fannie / Freddie / FHFA public rules — research only' },
    { href: '/finance/encompass-hub.html', icon: 'bi-cloud-arrow-down', label: 'Encompass Hub', title: 'Encompass Hub' },
    { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass Assistant', title: 'Encompass AI Assistant' },
    { href: '/finance/encompass-analytics.html', icon: 'bi-bar-chart-line', label: 'Analytics', title: 'Encompass Analytics' },
    { href: '/finance/disasters-unified.html', icon: 'bi-globe', label: 'Unified Disasters', title: 'Unified Disasters (90-day)' },
    { href: '/finance/disasters-encompass-map.html', icon: 'bi-geo-alt', label: 'Encompass map', title: 'Encompass map — live proximity loan pins' },
    { href: '/finance/loan-batch-update.html', icon: 'bi-layers-half', label: 'Loan batch update', title: 'Encompass loanBatch/updateRequests' },
    { href: '/finance/processor-assignment.html', icon: 'bi-people-fill', label: 'Processor assignment', title: 'Live processor assignment against Encompass pipeline' },
    { href: '/finance/processor-assignment-mock.html', icon: 'bi-people', label: 'Processor assignment (demo)', title: 'Processor assignment demo with synthetic loans' },
    { href: '/finance/pipeline-risk-dashboard.html', icon: 'bi-shield-check', label: 'Pipeline Risk', title: 'Pipeline Risk Dashboard' },
    { href: '/finance/risk-analysis-dashboard.html', icon: 'bi-graph-up', label: 'Risk Analysis', title: 'Risk Analysis Dashboard' },
    { href: '/finance/unit-tests.html', icon: 'bi-check2-circle', label: 'Unit Tests', title: 'Unit Test Runner' },
    { href: '/finance/tool9.html', icon: 'bi-camera-reels', label: 'Screen Test', title: 'The Screen Test' },
    { href: '/finance/encompass-users.html', icon: 'bi-people', label: 'Users', title: 'Encompass Users' },
    { href: '/finance/encompass-native-fields.html', icon: 'bi-list-columns', label: 'Native Fields', title: 'Native Loan Fields' },
    { href: '/finance/encompass-custom-fields.html', icon: 'bi-sliders', label: 'Custom Fields', title: 'Custom Loan Fields' },
    { href: '/finance/condition-manager.html', icon: 'bi-clipboard-check', label: 'Condition Manager', title: 'Convert the legacy Conditions CDO into Enhanced Conditions' },
    { href: '/finance/enhanced-conditions.html', icon: 'bi-ui-checks-grid', label: 'Enhanced Conditions', title: 'Live Enhanced Conditions CRUD — types, templates, loan conditions' },
    { href: '/finance/enhanced-conditions-expert.html', icon: 'bi-journal-richtext', label: 'EC Expert', title: 'Enhanced Conditions AI expert — APIs, personas, handoff pack' },
    { href: '/finance/tpo-connect.html', icon: 'bi-people', label: 'TPO Connect', title: 'TPO Connect — guest apps, SSF objects, LoanContractTPO fields' },
    { href: '/finance/encompass-hub-test.html', icon: 'bi-plug', label: 'Test Endpoints', title: 'Test API endpoints' },
    { href: '/finance/tool2.html', icon: 'bi-code-slash', label: 'Parser', title: 'The Parser' },
    { href: '/finance/tool3.html', icon: 'bi-globe', label: 'Mashup', title: 'The Mashup' },
    { href: '/finance/tool4.html', icon: 'bi-gear', label: 'Automator', title: 'The Automator' },
    { href: '/finance/tool5.html', icon: 'bi-rulers', label: 'Ruler', title: 'The Ruler' },
    { href: '/finance/tool6.html', icon: 'bi-arrow-repeat', label: 'Transformer', title: 'The Transformer' },
    { href: '/finance/tool8.html', icon: 'bi-magic', label: 'Alchemist', title: 'The Alchemist' },
  ];

  /** Drop duplicate hrefs; keep the first label/icon and tidy dividers. */
  function dedupeMenuItems(items) {
    const seen = new Set();
    const out = [];
    (items || []).forEach(function (item) {
      if (!item) return;
      if (item.divider) {
        if (out.length && !out[out.length - 1].divider) out.push(item);
        return;
      }
      const key = normalizeHrefPath(item.href);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    if (out.length && out[out.length - 1].divider) out.pop();
    return out;
  }

  /**
   * Worksheets navbar: disaster suite only when logged out; every mortgage app
   * (Encompass Hub, AI Assistant, tools, calculators) when logged in.
   */
  function getFinanceNavItems(loggedIn) {
    const authed = typeof loggedIn === 'boolean' ? loggedIn : isUserLoggedIn();
    if (!authed) return filterToolsByAuth(NAV_FINANCE, false);
    return dedupeMenuItems([
      { href: '/finance/encompass-hub.html', icon: 'bi-columns-gap', label: 'Encompass Hub' },
      { href: '/finance/encompass-assistant.html', icon: 'bi-robot', label: 'Encompass AI Assistant' },
      ...NAV_ENCOMPASS,
      { divider: true },
      ...FINANCE_TOOLS,
      { divider: true },
      { href: '/finance/index.html', icon: 'bi-grid-3x3-gap', label: 'All Worksheets Tools' },
    ]);
  }

  /**
   * Worksheets hub tile grid: calculators when logged out; full mortgage catalog
   * (Encompass + calculators) when logged in.
   */
  function getMortgageTools(loggedIn) {
    const authed = typeof loggedIn === 'boolean' ? loggedIn : isUserLoggedIn();
    if (!authed) return filterToolsByAuth(FINANCE_TOOLS, false);
    return dedupeMenuItems([...ENCOMPASS_TOOLS, { divider: true }, ...FINANCE_TOOLS])
      .filter(function (item) { return item && !item.divider; });
  }

  /** Nature hub tool grid */
  const NATURE_TOOLS = [
    { href: '/mountain-high/', icon: 'bi-mountain', label: 'Mountain High', title: 'Mountain High Medicinals — 21+ type cards, Sage, embedded origins map' },
    { href: '/nature/cannabis-origins.html', icon: 'bi-globe2', label: 'Cannabis Origins', title: 'Password-gated landrace map (standalone)' },
    { href: '/nature/tree-discovery.html', icon: 'bi-tree', label: 'Tree Discovery', title: 'Discover trees' },
    { href: '/nature/tree-collection.html', icon: 'bi-collection', label: 'Tree Collection', title: 'Your tree collection' },
    { href: '/nature/critter-discovery.html', icon: 'bi-bug', label: 'Critter Discovery', title: 'Discover critters' },
    { href: '/nature/critter-collection.html', icon: 'bi-collection', label: 'Critter Collection', title: 'Your critter collection' },
    { href: '/nature/fish-identification.html', icon: 'bi-droplet', label: 'Fish ID', title: 'Identify fish' },
    { href: '/nature/newport-pier.html', icon: 'bi-water', label: 'Newport Pier Guide', title: 'Newport Beach Pier fish walk' },
    { href: '/nature/fish-collection.html', icon: 'bi-collection', label: 'Fish Collection', title: 'Your fish collection' },
    { href: '/nature/rock-discovery.html', icon: 'bi-gem', label: 'Rocky The Rock Star', title: 'Rubies, gems & meteorites — Rocky The Rock Star' },
    { href: '/nature/rock-collection.html', icon: 'bi-circle', label: 'Rock Collection', title: 'Your rock specimens' },
    { href: '/nature/share-collection.html', icon: 'bi-share', label: 'Share Collection', title: 'Share your collection' },
    { href: '/nature/shenango-valley.html', icon: 'bi-geo-alt', label: 'The Valley', title: 'West PA & East Ohio gallery — happening-now events, HyperFrames, Youngstown mob history, AI expert' },
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
    { href: '/studio/', icon: 'bi-cassette', label: 'Studio', title: 'Browser studio — record, LiveKit, listening room' },
    { href: '/music/music-research.html', icon: 'bi-search', label: 'Music Research', title: 'Field research: artists, members, birthplaces' },
    { href: '/music/album-discovery.html', icon: 'bi-disc', label: 'Album Discovery', title: 'Discover albums' },
    { href: '/music/collection.html', icon: 'bi-collection-fill', label: 'My Collection', title: 'Your music collection' },
    { href: '/music/music-graph.html', icon: 'bi-diagram-3', label: 'Music Graph', title: 'Collection graph explorer (artist, album, show, member)' },
    { href: '/music/song-identifier.html', icon: 'bi-music-note-beamed', label: 'Song ID', title: 'Identify songs' },
    { href: '/music/spotify-dashboard.html', icon: 'bi-spotify', label: 'Spotify', title: 'Spotify dashboard' },
    { href: '/music/music-time-machine.html', icon: 'bi-clock-history', label: 'Time Machine', title: 'Music time machine' },
    { href: '/music/music-pilgrimage-atlas.html', icon: 'bi-compass', label: 'Pilgrimage Atlas', title: 'Grateful Dead map journey and saved routes' },
    { href: '/music/kml-viewer.html', icon: 'bi-globe2', label: 'KML Timeline', title: 'Upload or load KML, map timeline, YouTube' },
    { href: '/music/musical-google-earth-files.html', icon: 'bi-cloud-arrow-down', label: 'Google Earth KML', title: 'Network links and downloads for Google Earth Pro' },
    { href: '/music/my-grateful-dead-shows.html', icon: 'bi-calendar-event', label: 'Grateful Dead Shows', title: 'Grateful Dead show archive' },
    { href: '/music/sample-detector.html', icon: 'bi-magnet', label: 'Sample Detector', title: 'Detect samples and covers' },
    { href: '/mountain-high/', icon: 'bi-mountain', label: 'Mountain High', title: 'Mountain High Medicinals — 21+ type cards, Sage, locksmith Long Beach & L.A.' },
  ];

  /** Public /finance pages (no login). Keep in sync with lib/finance-session.js FINANCE_PUBLIC_PAGES. */
  const FINANCE_PUBLIC_PATHS = [
    '/finance/disasters-unified.html',
    '/finance/disasters-webcams.html',
    '/finance/disasters-encompass-map.html',
  ];

  /** Get home domain tiles, optionally filtered for demo mode + login */
  function getDomainTiles(demoMode, loggedIn) {
    const authed = typeof loggedIn === 'boolean' ? loggedIn : isUserLoggedIn();
    let tiles;
    if (demoMode) {
      tiles = DOMAIN_TILES.filter(t => t.demoOnly);
    } else {
      tiles = DOMAIN_TILES.filter(t => !t.demoOnly);
    }
    return filterToolsByAuth(tiles, authed);
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

  function normalizeHrefPath(href) {
    if (!href) return '';
    try {
      return new URL(href, 'http://local').pathname.toLowerCase();
    } catch (_) {
      return String(href).split('?')[0].split('#')[0].toLowerCase();
    }
  }

  /** True when href is under /finance/ and not a public disaster page. */
  function pathRequiresAuth(href) {
    const path = normalizeHrefPath(href);
    if (!path.startsWith('/finance/')) return false;
    return FINANCE_PUBLIC_PATHS.indexOf(path) === -1;
  }

  function itemRequiresAuth(item) {
    if (!item || item.divider) return false;
    if (typeof item.requiresAuth === 'boolean') return item.requiresAuth;
    return pathRequiresAuth(item.href);
  }

  /**
   * Hide login-required finance/Encompass tools when logged out.
   * Preserves dividers only when they still separate visible items.
   */
  function filterToolsByAuth(items, loggedIn) {
    if (!items || !items.length) return [];
    if (loggedIn) return items.slice();
    const filtered = [];
    items.forEach(function (item) {
      if (!item) return;
      if (item.divider) {
        filtered.push(item);
        return;
      }
      if (!itemRequiresAuth(item)) {
        filtered.push(item);
      }
    });
    const cleaned = [];
    filtered.forEach(function (item) {
      if (item.divider) {
        if (!cleaned.length || cleaned[cleaned.length - 1].divider) return;
        cleaned.push(item);
        return;
      }
      cleaned.push(item);
    });
    if (cleaned.length && cleaned[cleaned.length - 1].divider) cleaned.pop();
    return cleaned;
  }

  function isUserLoggedIn() {
    return typeof global.isLoggedIn === 'function' && !!global.isLoggedIn();
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
      domain: item.domain || '',
      requiresAuth: itemRequiresAuth(Object.assign({}, item, { href: href }))
    };
  }

  function getAllTools(demoMode, options) {
    const opts = options || {};
    const loggedIn = typeof opts.loggedIn === 'boolean' ? opts.loggedIn : isUserLoggedIn();
    const groups = [
      { items: getDomainTiles(demoMode, loggedIn), category: 'Domain' },
      { items: FINANCE_TOOLS, category: 'Worksheets' },
      { items: ENCOMPASS_TOOLS, category: 'Encompass' },
      { items: ENTERTAINMENT_TOOLS, category: 'Entertainment' },
      { items: NATURE_TOOLS, category: 'Nature' },
      { items: BIKE_TOOLS, category: 'Bike' },
      { items: MUSIC_TOOLS, category: 'Music' }
    ];
    const tools = [];
    groups.forEach((group) => {
      filterToolsByAuth(group.items || [], loggedIn).forEach((item) => {
        if (item && !item.divider && item.href) {
          tools.push(normalizeToolItem(item, { category: group.category }));
        }
      });
    });
    return tools;
  }

  /** Render domain grid HTML from items array */
  function renderDomainGridItems(items, options) {
    const opts = options || {};
    const loggedIn = typeof opts.loggedIn === 'boolean' ? opts.loggedIn : isUserLoggedIn();
    const visible = filterToolsByAuth(items || [], loggedIn);
    return visible.map(function (item) {
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
    FINANCE_PUBLIC_PATHS,
    getDomainTiles,
    getAllTools,
    getFinanceNavItems,
    getMortgageTools,
    dedupeMenuItems,
    makeToolId,
    normalizeToolItem,
    pathRequiresAuth,
    itemRequiresAuth,
    filterToolsByAuth,
    renderDomainGridItems,
    NAV_FINANCE,
    NAV_ENCOMPASS,
    NAV_MUSIC,
    NAV_ENTERTAINMENT,
    NAV_MORE,
    FINANCE_TOOLS,
    ENCOMPASS_TOOLS,
    ENTERTAINMENT_TOOLS,
    NATURE_TOOLS,
    BIKE_TOOLS,
    MUSIC_TOOLS,
  };

  global.MENU_CONFIG = MENU_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
