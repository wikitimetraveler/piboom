/**
 * HeyGen script builders for Unified Disasters — schema walkthrough + live event briefings.
 * Spoken scripts align with docs/UNIFIED_DISASTERS_DB_SCHEMA_VIDEO_SCRIPT.md.
 */

/** ~2 min schema explainer (spoken-speed cut from the video script doc). */
export const SCHEMA_WALKTHROUGH_SCRIPT = [
  'This is Unified Disasters—one screen for FEMA declarations, wildfires, earthquakes, hurricanes, and weather alerts, plus the loans and hazard webcams around them.',
  'Under the hood there is no separate Unified Disasters table. Everything lives in shared Postgres: disasters for rolling events, fire_cameras for fixed webcam mounts, and loans for pipeline properties with risk scores and flood data.',
  'disasters is one row per event—source, event type, county FIPS, start time, coordinates, and the raw JSON from FEMA, FIRMS, USGS, NWS, or NHC. We keep about ninety days and refresh daily with npm run refresh-disasters.',
  'fire_cameras is different—those are stable mounts, not events. ALERTCalifornia, USGS river and volcano cams, FAA weather cams, coastal WebCOOS—each row has lat, lng, hazard tags, and snapshot URLs. That catalog is its own ingest: refresh:hazard-webcams.',
  'When you pick a disaster on the map, GET /api/disasters/near asks: what loans and cameras are within this radius? With PostGIS, that is ST_DWithin on geography points. Without PostGIS, we fall back to Haversine—the same API shape either way.',
  'We also run a second model—the impact graph. graph_nodes and graph_edges are derived: county, disaster, zip, loan, milestone, processor. Edges like HAS_DECLARATION, CONTAINS, and NEAR—where NEAR comes from the same spatial join at seed time. A recursive SQL walk answers: which loans are reachable from this disaster, not just how many miles away?',
  'Unified Disasters uses the spatial path live. The graph is for relationship analytics and the prototype impact-graph page—it reseeds when you rebuild it.',
  'Full schema reference is in docs/UNIFIED_DISASTERS_DB_SCHEMA.md—DDL, indexes, and sample SQL to count rows by source.'
].join(' ');

export const SCHEMA_WALKTHROUGH_TITLE = 'Unified Disasters Schema';

function pickDisasterField(disaster, keys, fallback = '') {
  if (!disaster || typeof disaster !== 'object') return fallback;
  for (const key of keys) {
    const val = disaster[key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return fallback;
}

function formatBriefingDate(disaster) {
  const raw =
    pickDisasterField(disaster, ['started_at', 'start_time', 'declarationDate', 'event_date']) || '';
  if (!raw) return 'an unlisted date';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Build a ~30–45s spoken briefing for the currently selected disaster row.
 * @param {object} disaster
 * @param {{ loanCount?: number, cameraCount?: number, radiusMiles?: number }} [ctx]
 */
export function buildDisasterBriefingScript(disaster, { loanCount = 0, cameraCount = 0, radiusMiles = 50 } = {}) {
  const title = pickDisasterField(disaster, ['title', 'declarationTitle', 'event_name'], 'this event');
  const source = pickDisasterField(disaster, ['source', 'data_source'], 'multi-source').toUpperCase();
  const eventType = pickDisasterField(disaster, ['event_type', 'incidentType', 'type'], 'hazard event');
  const county = pickDisasterField(disaster, ['county_name', 'county'], 'the affected county');
  const state = pickDisasterField(disaster, ['state_abbr', 'state'], '');
  const location = state ? `${county}, ${state}` : county;
  const when = formatBriefingDate(disaster);
  const loansPhrase =
    loanCount === 1 ? 'one pipeline loan' : `${loanCount} pipeline loans`;
  const camerasPhrase =
    cameraCount === 1 ? 'one hazard webcam' : `${cameraCount} hazard webcams`;

  return [
    `Unified Disasters briefing.`,
    `You are looking at ${title}—a ${eventType} event from ${source}, centered in ${location}.`,
    `Reporting started ${when}.`,
    `Within ${radiusMiles} miles we currently track ${loansPhrase} and ${camerasPhrase}.`,
    `On the command deck, review nearby exposure, export a Google Earth tour, or ask the processor expert for loan-level guidance.`,
    `Data model details live in the Data model and graph panel on Unified Disasters.`
  ].join(' ');
}

export function buildDisasterBriefingTitle(disaster) {
  const title = pickDisasterField(disaster, ['title', 'declarationTitle', 'event_name'], 'Disaster briefing');
  const state = pickDisasterField(disaster, ['state_abbr', 'state'], '');
  return state ? `${title} (${state})` : title;
}

export function getSchemaWalkthrough() {
  return {
    title: SCHEMA_WALKTHROUGH_TITLE,
    script: SCHEMA_WALKTHROUGH_SCRIPT,
    aspectRatio: '16:9'
  };
}

export function getDisasterBriefingPayload(disaster, ctx = {}) {
  return {
    title: buildDisasterBriefingTitle(disaster),
    script: buildDisasterBriefingScript(disaster, ctx),
    aspectRatio: '16:9'
  };
}
