/**
 * Live US disaster awareness — fetches public feeds and consolidates a daily briefing.
 * No database required; suitable for MCP and standalone API use.
 */
import { crawlDisasterWeb, topCrawlHeadlines } from './disaster-web-crawler.service.js';

const USER_AGENT = 'DevConnectLabs-DisasterBriefing/1.0';
const FETCH_TIMEOUT_MS = 20_000;

const NWS_URL = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert';
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const FEMA_URL = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
const FIRMS_PUBLIC_URL = 'https://firms.modaps.eosdis.nasa.gov/api/country/v3/viirs/USA/1';

const HURRICANE_PATTERN = /\b(hurricane|tropical storm|tropical depression|typhoon|cyclone|post-tropical|storm surge)\b/i;

const SEVERITY_RANK = {
  extreme: 5,
  severe: 4,
  moderate: 3,
  minor: 2,
  unknown: 1,
};

function isUsCoordinate(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  return la >= 24 && la <= 50 && ln >= -125 && ln <= -66;
}

function parseAreaDesc(areaDesc = '') {
  const area = String(areaDesc).trim();
  const stateMatch = area.match(/Count(?:y|ies),\s*([A-Z]{2})\s*$/);
  if (!stateMatch) return { county: null, state: null };
  const state = stateMatch[1];
  const beforeCounties = area.slice(0, area.indexOf(stateMatch[0])).trim();
  const county = beforeCounties.split(/[;]/)[0].trim().replace(/\s+Count(?:y|ies)?\s*$/i, '');
  return { county, state };
}

function severityRank(value) {
  const key = String(value || 'unknown').toLowerCase();
  return SEVERITY_RANK[key] ?? 1;
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeNwsAlert(feature, { hurricanesOnly = false } = {}) {
  const props = feature?.properties || {};
  const text = `${props.event || ''} ${props.headline || ''}`;
  if (hurricanesOnly && !HURRICANE_PATTERN.test(text)) return null;

  const { county, state } = parseAreaDesc(props.areaDesc);
  return {
    source: hurricanesOnly ? 'nhc' : 'nws',
    eventType: String(props.event || 'alert').toLowerCase(),
    title: props.headline || props.event || 'Weather alert',
    location: [county, state].filter(Boolean).join(', ') || props.areaDesc || 'United States',
    state: state || null,
    severity: props.severity || null,
    urgency: props.urgency || null,
    startedAt: props.effective || props.onset || props.sent || null,
    endsAt: props.ends || null,
    priority: severityRank(props.severity) + (hurricanesOnly ? 2 : 0),
  };
}

function normalizeUsgsQuake(feature) {
  const props = feature?.properties || {};
  const coords = feature?.geometry?.coordinates || [];
  const lng = coords[0];
  const lat = coords[1];
  if (!isUsCoordinate(lat, lng)) return null;

  const mag = props.mag != null ? Number(props.mag) : null;
  return {
    source: 'usgs',
    eventType: 'earthquake',
    title: props.title || 'Earthquake',
    location: props.place || 'United States',
    state: null,
    severity: mag != null ? String(mag) : null,
    magnitude: mag,
    startedAt: props.time ? new Date(props.time).toISOString() : null,
    endsAt: null,
    priority: mag != null ? Math.min(6, Math.max(1, Math.round(mag))) : 1,
  };
}

function normalizeFemaDeclaration(item) {
  return {
    source: 'fema',
    eventType: String(item.incidentType || 'disaster').toLowerCase(),
    title: item.declarationTitle || item.title || 'FEMA disaster declaration',
    location: [item.county, item.state].filter(Boolean).join(', '),
    state: item.state || null,
    severity: item.iaProgramDeclared === 'true' || item.iaProgramDeclared === true ? 'ia-declared' : null,
    startedAt: item.incidentBeginDate || item.declarationDate || null,
    endsAt: item.incidentEndDate || null,
    disasterNumber: item.disasterNumber || null,
    priority: 4,
  };
}

function normalizeFirmsFeature(feature) {
  const props = feature?.properties || {};
  const coords = feature?.geometry?.coordinates || [];
  const lng = coords[0];
  const lat = coords[1];
  if (!isUsCoordinate(lat, lng)) return null;

  return {
    source: 'firms',
    eventType: 'wildfire',
    title: 'Active fire detection',
    location: [props.state, props.country].filter(Boolean).join(', ') || 'United States',
    state: props.state || null,
    severity: props.confidence || props.frp != null ? String(props.frp ?? props.confidence) : null,
    startedAt: props.acq_date || props.acq_datetime || null,
    endsAt: null,
    priority: 3,
  };
}

async function fetchNwsAlerts() {
  const data = await fetchJson(NWS_URL, { Accept: 'application/geo+json' });
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map((f) => normalizeNwsAlert(f)).filter(Boolean);
}

async function fetchNhcAlerts() {
  const data = await fetchJson(NWS_URL, { Accept: 'application/geo+json' });
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map((f) => normalizeNwsAlert(f, { hurricanesOnly: true })).filter(Boolean);
}

async function fetchUsgsQuakes({ minMagnitude = 2.5 } = {}) {
  const data = await fetchJson(USGS_URL);
  const features = Array.isArray(data?.features) ? data.features : [];
  return features
    .map(normalizeUsgsQuake)
    .filter(Boolean)
    .filter((q) => q.magnitude == null || q.magnitude >= minMagnitude);
}

async function fetchFemaDeclarations({ days = 7 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];
  const filter = `incidentBeginDate ge ${sinceStr}`;
  const url = `${FEMA_URL}?$filter=${encodeURIComponent(filter)}&$top=200&$orderby=incidentBeginDate desc`;
  const data = await fetchJson(url);
  const rows = Array.isArray(data?.DisasterDeclarationsSummaries) ? data.DisasterDeclarationsSummaries : [];
  return rows.map(normalizeFemaDeclaration);
}

async function fetchFirmsFires() {
  const apiKey = (
    process.env.MAP_KEY ||
    process.env.FIRMS_MAP_KEY ||
    process.env.NASA_API_KEY ||
    process.env.NASA_FIRMS_API_KEY ||
    process.env.FIRMS_API_KEY ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');

  if (apiKey) {
    const bbox = '-125.0,24.396308,-66.93457,49.384358';
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/${bbox}/1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
      const text = await res.text();
      if (!res.ok || text.includes('Invalid MAP_KEY')) {
        throw new Error('FIRMS authenticated feed unavailable');
      }
      const lines = text.trim().split('\n');
      if (lines.length < 2) return [];
      const headers = lines[0].split(',').map((h) => h.trim());
      const latIdx = headers.indexOf('latitude');
      const lngIdx = headers.indexOf('longitude');
      const stateIdx = headers.indexOf('state');
      const dateIdx = headers.indexOf('acq_date');
      const out = [];
      for (const line of lines.slice(1)) {
        const cols = line.split(',');
        const lat = Number(cols[latIdx]);
        const lng = Number(cols[lngIdx]);
        if (!isUsCoordinate(lat, lng)) continue;
        out.push({
          source: 'firms',
          eventType: 'wildfire',
          title: 'Active fire detection',
          location: cols[stateIdx] ? `${cols[stateIdx]}, US` : 'United States',
          state: cols[stateIdx] || null,
          severity: null,
          startedAt: cols[dateIdx] || null,
          endsAt: null,
          priority: 3,
        });
      }
      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  const data = await fetchJson(FIRMS_PUBLIC_URL);
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map(normalizeFirmsFeature).filter(Boolean);
}

async function runSource(label, fn) {
  const startedAt = Date.now();
  try {
    const items = await fn();
    return {
      source: label,
      ok: true,
      count: items.length,
      items,
      elapsedMs: Date.now() - startedAt,
      error: null,
    };
  } catch (err) {
    return {
      source: label,
      ok: false,
      count: 0,
      items: [],
      elapsedMs: Date.now() - startedAt,
      error: err.message || String(err),
    };
  }
}

function topItems(items, limit = 8) {
  return [...items]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, limit);
}

function countByState(items) {
  const map = new Map();
  for (const item of items) {
    const st = item.state || '—';
    map.set(st, (map.get(st) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([state, count]) => ({ state, count }));
}

function formatItemLine(item) {
  const when = item.startedAt ? new Date(item.startedAt).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC' : 'time unknown';
  const severity = item.severity ? ` · ${item.severity}` : '';
  return `- **${item.title}** (${item.source.toUpperCase()}) — ${item.location}${severity} · ${when}`;
}

/**
 * Fetch live US disaster feeds and return structured briefing data.
 * @param {{ days?: number, minMagnitude?: number, includeFirms?: boolean }} [options]
 */
export async function collectLiveDisasterAwareness(options = {}) {
  const days = Number.isFinite(options.days) ? options.days : 7;
  const minMagnitude = Number.isFinite(options.minMagnitude) ? options.minMagnitude : 2.5;
  const includeFirms = options.includeFirms !== false;

  const sourceFns = [
    ['nws', fetchNwsAlerts],
    ['nhc', fetchNhcAlerts],
    ['usgs', () => fetchUsgsQuakes({ minMagnitude })],
    ['fema', () => fetchFemaDeclarations({ days })],
  ];
  if (includeFirms) sourceFns.push(['firms', fetchFirmsFires]);

  const sourceResults = await Promise.all(sourceFns.map(([label, fn]) => runSource(label, fn)));
  const allItems = sourceResults.flatMap((r) => r.items);
  const highlights = topItems(allItems, 10);

  const failures = sourceResults.filter((r) => !r.ok).map((r) => ({ source: r.source, error: r.error }));
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    windowDays: days,
    summary: {
      totalEvents: allItems.length,
      bySource: Object.fromEntries(sourceResults.map((r) => [r.source, r.count])),
      topStates: countByState(allItems),
      sourceStatus: sourceResults.map(({ source, ok, count, elapsedMs, error }) => ({
        source,
        ok,
        count,
        elapsedMs,
        error,
      })),
      failures,
    },
    highlights,
    sources: Object.fromEntries(sourceResults.map((r) => [r.source, r.items])),
  };
}

/**
 * Render a markdown daily briefing from collected awareness data.
 * @param {Awaited<ReturnType<typeof collectLiveDisasterAwareness>>} data
 */
export function renderDailyBriefingMarkdown(data) {
  const dateLabel = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const lines = [
    `# US Disaster Daily Briefing`,
    ``,
    `**Date:** ${dateLabel} (UTC)`,
    `**Generated:** ${data.generatedAt}`,
    `**Window:** last ${data.windowDays} days (FEMA) · live feeds (NWS, USGS, NHC, FIRMS)`,
    ``,
    `## Executive summary`,
    ``,
    `- **${data.summary.totalEvents}** tracked events across **${Object.keys(data.summary.bySource).length}** sources`,
  ];

  for (const [source, count] of Object.entries(data.summary.bySource)) {
    lines.push(`- **${source.toUpperCase()}:** ${count}`);
  }

  if (data.summary.topStates.length) {
    lines.push('');
    lines.push('**Most affected states:** ' + data.summary.topStates.map((s) => `${s.state} (${s.count})`).join(', '));
  }

  if (data.summary.failures.length) {
    lines.push('');
    lines.push('**Source warnings:**');
    for (const f of data.summary.failures) {
      lines.push(`- ${f.source}: ${f.error}`);
    }
  }

  lines.push('', '## Top highlights', '');
  if (!data.highlights.length) {
    lines.push('_No major events in the current window._');
  } else {
    for (const item of data.highlights) lines.push(formatItemLine(item));
  }

  for (const [source, items] of Object.entries(data.sources)) {
    if (!items.length) continue;
    lines.push('', `## ${source.toUpperCase()} (${items.length})`, '');
    for (const item of topItems(items, 6)) lines.push(formatItemLine(item));
    if (items.length > 6) lines.push(`- _…and ${items.length - 6} more_`);
  }

  lines.push(
    '',
    '---',
    '_Sources: FEMA Open API, NOAA/NWS CAP, USGS Earthquake feeds, NASA FIRMS (when configured). For mortgage pipeline exposure, open Unified Disasters in DevConnect Labs._',
  );

  return lines.join('\n');
}

function speakableHeadline(title = '') {
  return String(title)
    .replace(/\s+issued\s+.+$/i, '')
    .replace(/\s+by\s+NWS\s+.+$/i, '')
    .trim();
}

function speakMagnitude(value) {
  const mag = Number(value);
  if (!Number.isFinite(mag)) return '';
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const whole = Math.floor(mag);
  const frac = Math.round((mag - whole) * 10);
  const wholeSpoken = whole < words.length ? words[whole] : String(whole);
  if (!frac) return wholeSpoken;
  const fracSpoken = frac < words.length ? words[frac] : String(frac);
  return `${wholeSpoken} point ${fracSpoken}`;
}

function summarizeNwsThemes(nwsItems = []) {
  const themes = { flood: 0, heat: 0, fire: 0, marine: 0, other: 0 };
  for (const item of nwsItems) {
    const et = String(item.eventType || '').toLowerCase();
    if (/flood/.test(et)) themes.flood += 1;
    else if (/heat/.test(et)) themes.heat += 1;
    else if (/fire|red flag/.test(et)) themes.fire += 1;
    else if (/craft|beach|rip current|marine/.test(et)) themes.marine += 1;
    else themes.other += 1;
  }
  const parts = [];
  if (themes.flood) parts.push(`${themes.flood} flood-related alerts`);
  if (themes.heat) parts.push(`${themes.heat} heat advisories or warnings`);
  if (themes.fire) parts.push(`${themes.fire} fire-weather alerts`);
  if (themes.marine) parts.push(`${themes.marine} marine or coastal advisories`);
  return { themes, phrase: parts.length ? parts.join(', ') : 'mixed weather hazards' };
}

function highlightSpeakLine(item, index) {
  if (!item) return '';
  if (item.source === 'usgs' && item.magnitude != null) {
    const mag = speakMagnitude(item.magnitude);
    const place = item.location || 'the United States';
    return `Earthquake ${index}: magnitude ${mag} near ${place}.`;
  }
  if (item.source === 'fema') {
    const where = item.location || item.state || 'the United States';
    return `FEMA declaration ${index}: ${item.title} in ${where}.`;
  }
  const headline = speakableHeadline(item.title) || item.eventType || 'active alert';
  const where = item.location && item.location !== 'United States' ? ` in ${item.location}` : '';
  return `Alert ${index}: ${headline}${where}.`;
}

/**
 * ~60–90s plain-speech script for Google TTS / browser narration.
 * @param {Awaited<ReturnType<typeof collectLiveDisasterAwareness>>} data
 */
export function buildDailyBriefingSpokenScript(data) {
  const dateLabel = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const bySource = data.summary?.bySource || {};
  const total = data.summary?.totalEvents || 0;
  const nwsCount = bySource.nws || 0;
  const nhcCount = bySource.nhc || 0;
  const usgsCount = bySource.usgs || 0;
  const femaCount = bySource.fema || 0;
  const firmsCount = bySource.firms || 0;

  const { phrase: weatherPhrase } = summarizeNwsThemes(data.sources?.nws || []);
  const lines = [
    `United States disaster daily briefing for ${dateLabel}.`,
    `We are tracking ${total} active events across federal and live hazard feeds.`,
  ];

  if (nwsCount) {
    lines.push(`Weather is the main story today, with ${nwsCount} National Weather Service alerts, including ${weatherPhrase}.`);
  }
  if (nhcCount) {
    lines.push(`There ${nhcCount === 1 ? 'is' : 'are'} ${nhcCount} active tropical or hurricane-related alert${nhcCount === 1 ? '' : 's'}.`);
  } else {
    lines.push('There are no active hurricane or tropical storm warnings at this time.');
  }
  if (femaCount) {
    lines.push(`FEMA reports ${femaCount} disaster declaration${femaCount === 1 ? '' : 's'} in the recent window.`);
  }
  if (usgsCount) {
    lines.push(`The USGS recorded ${usgsCount} earthquake${usgsCount === 1 ? '' : 's'} in the past day over magnitude two point five in U.S. coordinates.`);
  }
  if (firmsCount) {
    lines.push(`NASA FIRMS shows ${firmsCount} active wildfire detection${firmsCount === 1 ? '' : 's'}.`);
  }

  const highlights = (data.highlights || []).slice(0, 4);
  if (highlights.length) {
    lines.push('Top concerns right now.');
    highlights.forEach((item, i) => lines.push(highlightSpeakLine(item, i + 1)));
  } else {
    lines.push('No major highlights in the current window.');
  }

  if (data.summary?.failures?.length) {
    const names = data.summary.failures.map((f) => f.source.toUpperCase()).join(', ');
    lines.push(`Note: ${names} feed${data.summary.failures.length === 1 ? ' was' : 's were'} unavailable for this briefing.`);
  }

  const webHeadlines = topCrawlHeadlines(data.webCrawl, 3);
  if (webHeadlines.length) {
    lines.push('From official web and news feeds.');
    webHeadlines.forEach((item, i) => {
      const pub = item.publisher ? ` (${item.publisher})` : '';
      lines.push(`Headline ${i + 1}${pub}: ${speakableHeadline(item.title)}.`);
    });
  }

  lines.push('Open Unified Disasters in DevConnect Labs for county-level detail, pipeline exposure, and hazard webcams. End of briefing.');
  return lines.join(' ');
}

export function buildDailyBriefingSpokenTitle(data) {
  const dateLabel = new Date(data.generatedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `US Disaster Daily Briefing — ${dateLabel}`;
}

/**
 * Build full daily briefing payload (structured + markdown + spoken script).
 */
export async function buildDailyBriefing(options = {}) {
  const data = await collectLiveDisasterAwareness(options);
  let webCrawl = null;
  if (options.includeWebCrawl) {
    webCrawl = await crawlDisasterWeb({
      maxAgeHours: Number.isFinite(options.crawlMaxAgeHours) ? options.crawlMaxAgeHours : 72,
      feedIds: options.crawlFeedIds,
    });
    data.webCrawl = webCrawl;
  }
  return {
    ...data,
    briefingMarkdown: renderDailyBriefingMarkdown(data),
    spokenTitle: buildDailyBriefingSpokenTitle(data),
    spokenScript: buildDailyBriefingSpokenScript(data),
  };
}

export default {
  collectLiveDisasterAwareness,
  renderDailyBriefingMarkdown,
  buildDailyBriefingSpokenScript,
  buildDailyBriefingSpokenTitle,
  buildDailyBriefing,
};
