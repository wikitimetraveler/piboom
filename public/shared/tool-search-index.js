/**
 * Global tool search index - name, url, category, keywords for fuzzy search.
 * Used by global-tool-search.js for Ctrl+K / search overlay.
 */
(function (global) {
  'use strict';

  const TOOL_INDEX = [
    // Worksheets (calculators & disasters; paths remain /finance/)
    { name: 'Worksheets Hub', url: '/finance/index.html', category: 'Worksheets', keywords: 'calculator hub worksheets' },
    { name: 'Encompass Assistant', url: '/finance/encompass-assistant.html', category: 'Encompass', keywords: 'AI robot mortgage API' },
    { name: 'Encompass Hub', url: '/finance/encompass-hub.html', category: 'Encompass', keywords: 'pipeline loans API' },
    { name: 'Loan batch update', url: '/finance/loan-batch-update.html', category: 'Encompass', keywords: 'batch update loanBatch custom fields filter' },
    { name: 'Processor assignment', url: '/finance/processor-assignment.html', category: 'Encompass', keywords: 'processor assign complexity capacity associates' },
    { name: 'Test Endpoints', url: '/finance/encompass-hub-test.html', category: 'Encompass', keywords: 'API test' },
    { name: 'Pipeline Risk Dashboard', url: '/finance/pipeline-risk-dashboard.html', category: 'Encompass', keywords: 'disaster FEMA risk' },
    { name: 'Unit Tests', url: '/finance/unit-tests.html', category: 'Encompass', keywords: 'excel test runner' },
    { name: 'The Screen Test', url: '/finance/tool9.html', category: 'Encompass', keywords: 'form manifest XML' },
    { name: 'Encompass Users', url: '/finance/encompass-users.html', category: 'Encompass', keywords: 'users directory' },
    { name: 'Native Loan Fields', url: '/finance/encompass-native-fields.html', category: 'Encompass', keywords: 'field definitions' },
    { name: 'Custom Loan Fields', url: '/finance/encompass-custom-fields.html', category: 'Encompass', keywords: 'custom fields' },
    { name: 'FHA Streamline', url: '/finance/fha-streamline-calculator.html', category: 'Worksheets', keywords: 'FHA refinance' },
    { name: 'Asset Qualifier', url: '/finance/asset-qualifier-calculator.html', category: 'Worksheets', keywords: 'asset retirement' },
    { name: 'DTI Calculator', url: '/finance/dti-calculator.html', category: 'Worksheets', keywords: 'debt income ratio' },
    { name: 'Closing Cost Calculator', url: '/finance/closing-cost-calculator.html', category: 'Worksheets', keywords: 'closing fees' },
    { name: 'VA IRRRL', url: '/finance/va-irrrl-calculator.html', category: 'Worksheets', keywords: 'VA refinance' },
    { name: 'Disasters Unified', url: '/finance/disasters-unified.html', category: 'Worksheets', keywords: 'FEMA disaster' },
    { name: 'The Parser', url: '/finance/tool2.html', category: 'Encompass', keywords: 'JSON parser' },
    { name: 'The Mashup', url: '/finance/tool3.html', category: 'Encompass', keywords: 'FEMA disaster data' },
    { name: 'The Automator', url: '/finance/tool4.html', category: 'Encompass', keywords: 'automation workflow' },
    { name: 'The Ruler', url: '/finance/tool5.html', category: 'Encompass', keywords: 'field analyzer' },
    { name: 'The Transformer', url: '/finance/tool6.html', category: 'Encompass', keywords: 'XML JSON converter' },
    { name: 'The Alchemist', url: '/finance/tool8.html', category: 'Encompass', keywords: 'code converter' },
    // Music
    { name: 'Music Research', url: '/music/music-research.html', category: 'Music', keywords: 'artist search' },
    { name: 'Album Discovery', url: '/music/album-discovery.html', category: 'Music', keywords: 'albums covers' },
    { name: 'My Collection', url: '/music/collection.html', category: 'Music', keywords: 'album collection' },
    { name: 'Song Identifier', url: '/music/song-identifier.html', category: 'Music', keywords: 'Shazam identify' },
    { name: 'Spotify', url: '/music/spotify-dashboard.html', category: 'Music', keywords: 'spotify dashboard' },
    { name: 'Time Machine', url: '/music/music-time-machine.html', category: 'Music', keywords: 'history date' },
    { name: 'Grateful Dead Shows', url: '/music/my-grateful-dead-shows.html', category: 'Music', keywords: 'dead shows' },
    { name: 'Sample Detector', url: '/music/sample-detector.html', category: 'Music', keywords: 'sample cover' },
    { name: 'Music KML', url: '/music/kml-viewer.html', category: 'Music', keywords: 'map timeline geographic upload' },
    { name: 'Google Earth KML Files', url: '/music/musical-google-earth-files.html', category: 'Music', keywords: 'kml google earth network link download beatles dylan dead venues' },
    // Entertainment
    { name: 'The Boombox', url: '/entertainment/player.html', category: 'Entertainment', keywords: 'player audio' },
    { name: 'Psychedelic Visualizer', url: '/entertainment/visualizer.html', category: 'Entertainment', keywords: 'visualizer trippy' },
    { name: 'Black Light Zone', url: '/entertainment/blacklight.html', category: 'Entertainment', keywords: 'cosmic neon' },
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
    { name: 'D3.js Family Tree Visualization', url: '/family/genealogy.html', category: 'Family', keywords: 'genealogy tree d3 family visualization' },
    { name: 'Nature Hub', url: '/nature/nature-hub.html', category: 'Nature', keywords: 'map gallery field guide share trees critters' },
    { name: 'Tree Discovery', url: '/nature/tree-discovery.html', category: 'Nature', keywords: 'tree Smokey identify' },
    { name: 'Tree Collection', url: '/nature/tree-collection.html', category: 'Nature', keywords: 'trees forest' },
    { name: 'Critter Discovery', url: '/nature/critter-discovery.html', category: 'Nature', keywords: 'animal wildlife identify photo' },
    { name: 'Critter Collection', url: '/nature/critter-collection.html', category: 'Nature', keywords: 'critters wildlife collection' },
    { name: 'Local Spots', url: '/local/local-spots.html', category: 'Local', keywords: 'thrift spots map' },
    { name: 'Finds', url: '/finds/index.html', category: 'Local', keywords: 'thrift flea vintage collection AI' },
    { name: 'Home', url: '/', category: 'Hub', keywords: 'hub index' },
  ];

  global.TOOL_INDEX = TOOL_INDEX;
})(typeof window !== 'undefined' ? window : globalThis);
