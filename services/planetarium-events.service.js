/**
 * Planetarium sky events — meteor peaks, eclipses, conjunctions (static JSON).
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'planetarium');

function readJson(name) {
  const file = path.join(DATA_DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

let _skyEvents;
let _meteorShowers;
let _catalogIndex;

export function loadSkyEvents() {
  if (!_skyEvents) _skyEvents = readJson('sky-events.json');
  return _skyEvents;
}

export function loadMeteorShowers() {
  if (!_meteorShowers) _meteorShowers = readJson('meteor-showers.json');
  return _meteorShowers;
}

export function loadCatalogIndex() {
  if (!_catalogIndex) _catalogIndex = readJson('catalog-index.json');
  return _catalogIndex;
}

function parseIsoDate(s) {
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Upcoming sky events within [from, to] inclusive by calendar date. */
export function filterSkyEvents({ from, to, limit = 8 } = {}) {
  const events = loadSkyEvents();
  const start = from ? parseIsoDate(from) : new Date();
  const end = to ? parseIsoDate(to) : new Date(start.getTime() + 120 * 86400000);
  if (!start || !end) return [];

  return events
    .map((ev) => ({ ...ev, when: parseIsoDate(ev.date) }))
    .filter((ev) => ev.when && ev.when >= start && ev.when <= end)
    .sort((a, b) => a.when - b.when)
    .slice(0, limit)
    .map(({ when, ...rest }) => rest);
}

/** Meteor shower peaks in the next `days` days from anchor date. */
export function upcomingMeteorPeaks(anchorDate = new Date(), days = 120) {
  const showers = loadMeteorShowers();
  const anchor = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
  const year = anchor.getFullYear();
  const endMs = anchor.getTime() + days * 86400000;

  const peaks = [];
  for (const yearOffset of [0, 1]) {
    const y = year + yearOffset;
    for (const shower of showers) {
      const peak = parseIsoDate(`${y}-${shower.peak}`);
      if (!peak || peak < anchor || peak.getTime() > endMs) continue;
      peaks.push({
        ...shower,
        peakDate: `${y}-${shower.peak}`,
        daysUntil: Math.round((peak - anchor) / 86400000),
      });
    }
  }
  return peaks.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);
}

export function searchCatalogIndex(query, limit = 12) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const index = loadCatalogIndex();
  return index
    .filter((item) => {
      const hay = [item.id, item.name, item.nick, item.hip, item.type].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q) || q.split(/\s+/).every((tok) => hay.includes(tok));
    })
    .slice(0, limit);
}

export default {
  loadSkyEvents,
  loadMeteorShowers,
  loadCatalogIndex,
  filterSkyEvents,
  upcomingMeteorPeaks,
  searchCatalogIndex,
};
