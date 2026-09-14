/**
 * Development work by David Lane
 */
/**
 * Global tool search index - name, url, category, keywords for fuzzy search.
 * Used by global-tool-search.js for Ctrl+K / search overlay.
 */
(function (global) {
  'use strict';

  /** Keep in sync with lib/finance-session.js FINANCE_PUBLIC_PAGES (disaster suite only). */
  const FINANCE_PUBLIC_PATHS = {
    '/finance/disasters-unified.html': true,
    '/finance/disasters-webcams.html': true,
    '/finance/disasters-encompass-map.html': true,
  };

  function pathRequiresAuth(url) {
    if (!url) return false;
    let path = String(url).split('?')[0].split('#')[0].toLowerCase();
    if (!path.startsWith('/finance/')) return false;
    return !FINANCE_PUBLIC_PATHS[path];
  }

  const TOOL_INDEX = [
    // Worksheets (calculators & disasters; paths remain /finance/)
    { name: 'Worksheets Hub', url: '/finance/index.html', category: 'Worksheets', keywords: 'calculator hub worksheets', requiresAuth: true },
    { name: 'Encompass Assistant', url: '/finance/encompass-assistant.html', category: 'Encompass', keywords: 'AI robot mortgage API', requiresAuth: true },
    { name: 'Encompass Hub', url: '/finance/encompass-hub.html', category: 'Encompass', keywords: 'pipeline loans API', requiresAuth: true },
    { name: 'Loan batch update', url: '/finance/loan-batch-update.html', category: 'Encompass', keywords: 'batch update loanBatch custom fields filter', requiresAuth: true },
    { name: 'Processor assignment', url: '/finance/processor-assignment-mock.html', category: 'Encompass', keywords: 'processor assign complexity capacity associates mock demo synthetic offline', requiresAuth: true },
    { name: 'Processor assignment (live Encompass)', url: '/finance/processor-assignment.html', category: 'Encompass', keywords: 'processor assign live encompass pipeline associates PUT', requiresAuth: true },
    { name: 'Encompass Analytics', url: '/finance/encompass-analytics.html', category: 'Encompass', keywords: 'analytics charts pipeline metrics', requiresAuth: true },
    { name: 'Test Endpoints', url: '/finance/encompass-hub-test.html', category: 'Encompass', keywords: 'API test', requiresAuth: true },
    { name: 'Pipeline Risk Dashboard', url: '/finance/pipeline-risk-dashboard.html', category: 'Encompass', keywords: 'disaster FEMA risk', requiresAuth: true },
    { name: 'Risk Analysis Dashboard', url: '/finance/risk-analysis-dashboard.html', category: 'Encompass', keywords: 'risk analysis dashboard', requiresAuth: true },
    { name: 'Unit Tests', url: '/finance/unit-tests.html', category: 'Encompass', keywords: 'excel test runner', requiresAuth: true },
    { name: 'The Screen Test', url: '/finance/tool9.html', category: 'Encompass', keywords: 'form manifest XML', requiresAuth: true },
    { name: 'Encompass Users', url: '/finance/encompass-users.html', category: 'Encompass', keywords: 'users directory', requiresAuth: true },
    { name: 'Native Loan Fields', url: '/finance/encompass-native-fields.html', category: 'Encompass', keywords: 'field definitions', requiresAuth: true },
    { name: 'Custom Loan Fields', url: '/finance/encompass-custom-fields.html', category: 'Encompass', keywords: 'custom fields', requiresAuth: true },
    { name: 'Condition Manager', url: '/finance/condition-manager.html', category: 'Encompass', keywords: 'conditions CDO enhanced conditions migration templates personas', requiresAuth: true },
    { name: 'Enhanced Conditions', url: '/finance/enhanced-conditions.html', category: 'Encompass', keywords: 'enhanced conditions CRUD types templates loan conditions personas live API', requiresAuth: true },
    { name: 'Enhanced Conditions Expert', url: '/finance/enhanced-conditions-expert.html', category: 'Encompass', keywords: 'enhanced conditions expert AI types templates personas handoff postman', requiresAuth: true },
    { name: 'TPO Connect', url: '/finance/tpo-connect.html', category: 'Encompass', keywords: 'TPO third party originator correspondent wholesale SSF guest LoanContractTPO iframe token exchange postman externalOrganizations tpoFees externalUsers', requiresAuth: true },
    { name: 'FHA Streamline', url: '/finance/fha-streamline-calculator.html', category: 'Worksheets', keywords: 'FHA refinance', requiresAuth: true },
    { name: 'FHA Loan Amount', url: '/finance/fha-streamline-loan-amount-calculator.html', category: 'Worksheets', keywords: 'FHA streamline loan amount', requiresAuth: true },
    { name: 'FHA NTB', url: '/finance/fha-streamline-ntb-calculator.html', category: 'Worksheets', keywords: 'FHA streamline net tangible benefit', requiresAuth: true },
    { name: 'Asset Qualifier', url: '/finance/asset-qualifier-calculator.html', category: 'Worksheets', keywords: 'asset retirement', requiresAuth: true },
    { name: 'DTI Calculator', url: '/finance/dti-calculator.html', category: 'Worksheets', keywords: 'debt income ratio', requiresAuth: true },
    { name: 'Cash-Out Refinance', url: '/finance/cashout-refinance-calculator.html', category: 'Worksheets', keywords: 'cash out refinance', requiresAuth: true },
    { name: 'Amortization Schedule', url: '/finance/amortization-schedule-calculator.html', category: 'Worksheets', keywords: 'amortization schedule', requiresAuth: true },
    { name: 'Closing Cost Calculator', url: '/finance/closing-cost-calculator.html', category: 'Worksheets', keywords: 'closing fees', requiresAuth: true },
    { name: 'LTV Calculator', url: '/finance/ltv-calculator.html', category: 'Worksheets', keywords: 'loan to value', requiresAuth: true },
    { name: 'VA IRRRL', url: '/finance/va-irrrl-calculator.html', category: 'Worksheets', keywords: 'VA refinance', requiresAuth: true },
    { name: 'Disasters Unified', url: '/finance/disasters-unified.html', category: 'Worksheets', keywords: 'FEMA disaster', requiresAuth: false },
    { name: 'Encompass map', url: '/finance/disasters-encompass-map.html', category: 'Worksheets', keywords: 'disaster encompass map loans proximity', requiresAuth: false },
    { name: 'The Parser', url: '/finance/tool2.html', category: 'Encompass', keywords: 'JSON parser', requiresAuth: true },
    { name: 'The Mashup', url: '/finance/tool3.html', category: 'Encompass', keywords: 'FEMA disaster data', requiresAuth: true },
    { name: 'The Automator', url: '/finance/tool4.html', category: 'Encompass', keywords: 'automation workflow', requiresAuth: true },
    { name: 'The Ruler', url: '/finance/tool5.html', category: 'Encompass', keywords: 'field analyzer', requiresAuth: true },
    { name: 'The Transformer', url: '/finance/tool6.html', category: 'Encompass', keywords: 'XML JSON converter', requiresAuth: true },
    { name: 'The Alchemist', url: '/finance/tool8.html', category: 'Encompass', keywords: 'code converter', requiresAuth: true },
    // Music
    { name: 'Studio', url: '/studio/', category: 'Music', keywords: 'daw record mix livekit websocket bounce wav listening room' },
    { name: 'Music Research', url: '/music/music-research.html', category: 'Music', keywords: 'artist search' },
    { name: 'Album Discovery', url: '/music/album-discovery.html', category: 'Music', keywords: 'albums covers' },
    { name: 'My Collection', url: '/music/collection.html', category: 'Music', keywords: 'album collection' },
    { name: 'Music Graph', url: '/music/music-graph.html', category: 'Music', keywords: 'graph artist album member show venue collection musicbrainz' },
    { name: 'Song Identifier', url: '/music/song-identifier.html', category: 'Music', keywords: 'Shazam identify' },
    { name: 'Spotify', url: '/music/spotify-dashboard.html', category: 'Music', keywords: 'spotify dashboard' },
    { name: 'Time Machine', url: '/music/music-time-machine.html', category: 'Music', keywords: 'history date' },
    { name: 'Pilgrimage Atlas', url: '/music/music-pilgrimage-atlas.html', category: 'Music', keywords: 'grateful dead tour map journey venues pilgrimage' },
    { name: 'Grateful Dead Shows', url: '/music/my-grateful-dead-shows.html', category: 'Music', keywords: 'dead shows' },
    { name: 'Sample Detector', url: '/music/sample-detector.html', category: 'Music', keywords: 'sample cover' },
    { name: 'Music KML', url: '/music/kml-viewer.html', category: 'Music', keywords: 'map timeline geographic upload' },
    { name: 'Google Earth KML Files', url: '/music/musical-google-earth-files.html', category: 'Music', keywords: 'kml google earth network link download beatles dylan dead venues' },
    // Entertainment
    { name: 'Entertainment Hub', url: '/entertainment/index.html', category: 'Entertainment', keywords: 'hub entertainment boombox visualizer gallery posters' },
    { name: 'Watch together', url: '/watch-together/', category: 'Entertainment', keywords: 'youtube watch together sync theater chat draw map couches open no code' },
    { name: 'Coffee Dreams', url: '/entertainment/coffee-dreams.html', category: 'Entertainment', keywords: 'coffee cafe gallery password vietnamese coffee shop girls glam' },
    { name: 'The Boombox', url: '/entertainment/player.html', category: 'Entertainment', keywords: 'player audio' },
    { name: 'Psychedelic Visualizer', url: '/entertainment/visualizer.html', category: 'Entertainment', keywords: 'visualizer trippy' },
    { name: 'Planetarium', url: '/planetarium/', category: 'Entertainment', keywords: 'stars sky constellations planets astronomy moon theater dome' },
    { name: 'Planetarium Field', url: '/planetarium/field.html', category: 'Entertainment', keywords: 'stars sky field mobile outdoor compass night vision observing ISS Carl' },
    { name: 'SpaceX rockets', url: '/planetarium/spacex.html', category: 'Entertainment', keywords: 'spacex falcon 9 falcon heavy starship launch dates rockets elon musk' },
    { name: 'ISS station', url: '/planetarium/station.html', category: 'Entertainment', keywords: 'ISS space station modules crew Destiny Cupola Harmony Columbus Kibo Zigzag Carl orbit' },
    { name: 'Astrology', url: '/entertainment/astrology.html', category: 'Entertainment', keywords: 'zodiac signs horoscope aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces birthday wheel' },
    { name: 'Black Light Zone', url: '/entertainment/blacklight.html', category: 'Entertainment', keywords: 'cosmic neon' },
    { name: 'Black Light Poster', url: '/entertainment/blacklight-poster.html', category: 'Entertainment', keywords: 'sound reactive uv poster webgpu' },
    { name: 'Poster Generator', url: '/entertainment/poster-generator.html', category: 'Entertainment', keywords: 'AI poster art' },
    { name: 'Art Gallery', url: '/entertainment/art-gallery.html', category: 'Entertainment', keywords: 'gallery art' },
    { name: 'Ouija Board', url: '/entertainment/ouija-board.html', category: 'Entertainment', keywords: 'spirit Houdini' },
    // More
    { name: 'Bike Store', url: '/bike-store-home.html', category: 'Bike', keywords: 'bikes shop' },
    { name: 'Bike Discover', url: '/bike-discover.html', category: 'Bike', keywords: 'browse bikes' },
    { name: 'The Peloton', url: '/bike-collection.html', category: 'Bike', keywords: 'collection map' },
    { name: 'Wolfman Dave', url: '/ai/voice-dj.html', category: 'AI', keywords: 'voice DJ search' },
    { name: 'Levi Assistant', url: '/ai/assistant.html', category: 'AI', keywords: 'AI chat' },
    { name: 'Voice Guide', url: '/ai/voice-guide.html', category: 'AI', keywords: 'voice commands' },
    { name: 'Lane Family', url: '/family/lane-family.html', category: 'Family', keywords: 'lane genealogy museum hub family exhibits' },
    { name: 'Scientific Lane', url: '/family/lane-scientific-lane.html', category: 'Family', keywords: 'jonathan homer lane astrophysicist crater homer cousin branch' },
    { name: 'Nature Hub', url: '/nature/nature-hub.html', category: 'Nature', keywords: 'map gallery field guide share trees critters' },
    { name: 'Tree Discovery', url: '/nature/tree-discovery.html', category: 'Nature', keywords: 'tree Smokey identify' },
    { name: 'Tree Collection', url: '/nature/tree-collection.html', category: 'Nature', keywords: 'trees forest' },
    { name: 'Critter Discovery', url: '/nature/critter-discovery.html', category: 'Nature', keywords: 'animal wildlife identify photo' },
    { name: 'Critter Collection', url: '/nature/critter-collection.html', category: 'Nature', keywords: 'critters wildlife collection' },
    { name: 'The Valley', url: '/nature/shenango-valley.html', category: 'Nature', keywords: 'shenango valley buhl park hermitage sharon farrell steel amish new wilmington sports lettermen tony butala trent reznor nine inch nails music quaker steak lube luigi pizza david heygen atlas photos video youngstown mahoning mob organized crime east ohio west pennsylvania hyperframes reel story mode museum events concert buhl day river market acoustic sunday' },
    { name: 'Local Spots', url: '/local/local-spots.html', category: 'Local', keywords: 'thrift spots map' },
    { name: 'Finds', url: '/finds/index.html', category: 'Local', keywords: 'thrift flea vintage collection AI' },
    { name: 'Home', url: '/', category: 'Hub', keywords: 'hub index' },
  ];

  function toolRequiresAuth(tool) {
    if (!tool) return false;
    if (typeof tool.requiresAuth === 'boolean') return tool.requiresAuth;
    return pathRequiresAuth(tool.url);
  }

  function getVisibleToolIndex(loggedIn) {
    const authed = typeof loggedIn === 'boolean'
      ? loggedIn
      : (typeof global.isLoggedIn === 'function' && !!global.isLoggedIn());
    if (authed) return TOOL_INDEX.slice();
    return TOOL_INDEX.filter((tool) => !toolRequiresAuth(tool));
  }

  global.TOOL_INDEX = TOOL_INDEX;
  global.getVisibleToolIndex = getVisibleToolIndex;
  global.toolRequiresAuth = toolRequiresAuth;
})(typeof window !== 'undefined' ? window : globalThis);
