/**
 * Split disasters-unified.js into core + ingest + grid + map + app (global scope).
 * Run: node scripts/tools/split-disasters-unified.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('public/finance/js/disasters-unified');
const SRC = path.resolve('public/finance/js/disasters-unified.js');

const MODULE_FUNCS = {
  ingest: new Set([
    'normalizeSourceKeyForDeck', 'createSourceBadgeHtml', 'renderSourceDeckCounts',
    'refreshSourceStatsFromApi', 'updateSourceFreshnessDots', 'updateSourceHealthLine',
    'syncSourceChipsFromSelect', 'updateFirmsDeferredAlert', 'toggleUnifiedSourceChip',
    'readDisasterFilterInputs', 'applyEventTypeFilter', 'finishDisastersLoad', 'loadDisasters',
    'loadFloodZones', 'setSourcePullStatus', 'setPullButtonsBusy', 'formatIngestSummary',
    'refreshDisasters', 'getDisasterStats',
  ]),
  grid: new Set([
    'isDuShowNwsInGridEnabled', 'updateNwsGridFilterUi', 'refreshNwsGridExternalFilter',
    'applyNwsGridFilterFromSelection', 'clearNwsGridFilter', 'disastersGridExternalFilterPresent',
    'disastersGridExternalFilterPass', 'htmlCellRenderer', 'disasterMatchKey',
    'handleDisastersGridRowSelect', 'bindDisastersGridEvents', 'highlightSelectedDisasterInGrid',
    'buildDisasterGridRow', 'initDisastersGrid', 'maybeNudgeFirmsForQuickFilter',
    'buildEncompassLoanGridRow', 'initEncompassLoansGrid', 'setEncompassLoansGridRows',
    'setDisastersGridRows', 'refreshDisastersGridLayout', 'bindEncompassLoansGridEvents',
    'renderTable', 'calculateDisasterRiskScore', 'getRiskBadge', 'formatDominantEventType',
    'hotspotKeyForRow', 'aggregateRiskHotspots', 'getTopRiskEvents', 'renderRiskIntelligencePanel',
    'updateHotspotFilterUi', 'initHotspotFilterBadge', 'applyHotspotGridFilter',
    'clearHotspotGridFilter', 'applyHotspotSelection', 'updateStats', 'animateNumber',
  ]),
  map: new Set([
    'initDisastersMap', 'focusMapOnDisaster', 'renderMap', 'getDisasterMarkerIconForRisk',
    'updateMapWithLoans', 'loadAllLoansOnMap', 'loadYouTubeBrowserApiKey',
    'searchYouTubeForDisaster', 'displayYouTubeResults', 'getEventIcon',
  ]),
};

const CORE_FUNCS = new Set([
  'showLoading', 'hideLoading', 'setDashboardStatus', 'updateLoadingStatusDisaster',
]);

function parseFunctions(source) {
  const lines = source.split('\n');
  const funcs = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^      (async )?function (\w+)\s*\(/);
    if (m) {
      const start = i;
      let depth = 0;
      let started = false;
      let j = i;
      for (; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === '{') { depth++; started = true; }
          else if (ch === '}') depth--;
        }
        if (started && depth === 0) {
          funcs.push({ name: m[2], start, end: j, lines: lines.slice(start, j + 1) });
          break;
        }
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return { lines, funcs };
}

function unindent(block) {
  if (Array.isArray(block)) {
    return block.map((line) => (line.startsWith('      ') ? line.slice(6) : line)).join('\n');
  }
  return block;
}

function extractBalancedBlock(lines, startIdx, openChar = '{', closeChar = '}') {
  let depth = 0;
  let started = false;
  for (let j = startIdx; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === openChar) { depth++; started = true; }
      else if (ch === closeChar) depth--;
    }
    if (started && depth === 0) return lines.slice(startIdx, j + 1);
  }
  return [];
}

function extractInitBlock(lines) {
  const start = lines.findIndex((l) => l.includes('$(function init()'));
  if (start < 0) return '';
  return unindent(extractBalancedBlock(lines, start));
}

function extractTrailing(lines) {
  const start = lines.findIndex((l) => l.match(/^      \$\(document\)\.on\('click', '\.camera-view-btn'/));
  if (start < 0) return '';
  return unindent(extractBalancedBlock(lines, start));
}

function fileHeader(title) {
  return `/**
 * Development work by David Lane
 */
/**
 * Unified Disasters — ${title}
 * Loaded in global scope after prior scripts (see disasters-unified.html).
 */

`;
}

const raw = fs.readFileSync(SRC, 'utf8');
const { lines, funcs } = parseFunctions(raw);

const stateBlock = lines.slice(8, 37).map((l) => l.replace(/^      let /, 'var ')).join('\n');
const initBlock = extractInitBlock(lines);
const trailing = extractTrailing(lines);

const buckets = { core: [], ingest: [], grid: [], map: [], app: [] };
for (const fn of funcs) {
  if (CORE_FUNCS.has(fn.name)) buckets.core.push(fn);
  else if (MODULE_FUNCS.ingest.has(fn.name)) buckets.ingest.push(fn);
  else if (MODULE_FUNCS.grid.has(fn.name)) buckets.grid.push(fn);
  else if (MODULE_FUNCS.map.has(fn.name)) buckets.map.push(fn);
  else buckets.app.push(fn);
}

fs.mkdirSync(ROOT, { recursive: true });

const coreBody = [
  stateBlock,
  'var cameraIndex = 0;',
  '',
  ...buckets.core.map((f) => unindent(f.lines)),
].join('\n\n');

const ingestBody = [
  "const UNIFIED_SOURCE_KEYS = ['fema', 'firms', 'usgs', 'nws', 'nhc', 'floodzones'];",
  '',
  ...buckets.ingest.map((f) => unindent(f.lines)),
  '',
  'window.duRefreshAllSources = refreshDisasters;',
].join('\n\n');

const mapBody = [
  ...buckets.map.map((f) => unindent(f.lines)),
  '',
  'window.cameraDataStore = window.cameraDataStore || {};',
].join('\n\n');

const appExtras = `
window.selectNearbyWeatherAlert = function selectNearbyWeatherAlert(index) {
  const alert = lastNearbyWeatherAlerts[index];
  if (!alert) return;
  selectDisaster(null, alert);
};

window.exportCinematicDisasterKml = exportCinematicDisasterKml;
window.openDisasterHeygenBriefing = openDisasterHeygenBriefing;
`;

const appBody = [
  ...buckets.app.map((f) => unindent(f.lines)),
  appExtras,
  initBlock,
  trailing,
].join('\n\n');

fs.writeFileSync(path.join(ROOT, 'core.js'), fileHeader('shared state + loading UI') + coreBody + '\n');
fs.writeFileSync(path.join(ROOT, 'ingest.js'), fileHeader('API pull, source deck, loadDisasters') + ingestBody + '\n');
fs.writeFileSync(path.join(ROOT, 'grid.js'), fileHeader('AG Grid, risk intel, NWS filters') + buckets.grid.map((f) => unindent(f.lines)).join('\n\n') + '\n');
fs.writeFileSync(path.join(ROOT, 'map.js'), fileHeader('Google Maps markers + YouTube') + mapBody + '\n');
fs.writeFileSync(path.join(ROOT, 'app.js'), fileHeader('selection, AI, shell, bootstrap') + appBody + '\n');

fs.writeFileSync(
  path.join(ROOT, 'README.md'),
  `# Unified Disasters JS modules

Load **in this order** from \`disasters-unified.html\`:

1. \`core.js\` — shared \`var\` state + loading helpers
2. \`ingest.js\` — pull APIs, \`loadDisasters\`, source deck
3. \`grid.js\` — AG Grid + risk intelligence
4. \`map.js\` — map markers + YouTube
5. \`app.js\` — selection, AI, bootstrap

Regenerate from monolith: \`node scripts/tools/split-disasters-unified.mjs\`
`,
);

console.log('OK', { ingest: buckets.ingest.length, grid: buckets.grid.length, map: buckets.map.length, app: buckets.app.length });
