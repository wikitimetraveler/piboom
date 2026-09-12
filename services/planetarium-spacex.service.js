/**
 * SpaceX rocket and launch catalog (Launch Library 2 snapshot).
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'planetarium', 'spacex-catalog.json');

let _catalog;

export function loadCatalog() {
  if (!_catalog) {
    _catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  }
  return _catalog;
}

export function resetCatalogCache() {
  _catalog = null;
}

export function isUpcoming(launch, now = new Date()) {
  const t = Date.parse(launch?.net);
  return Number.isFinite(t) && t >= now.getTime();
}

export function parseSpacexQuery(query = {}) {
  const rocket = String(query.rocket || query.rocketId || '').trim();
  const q = String(query.q || '').trim();
  const whenRaw = String(query.when || 'all').trim().toLowerCase();
  const when = whenRaw === 'upcoming' || whenRaw === 'past' ? whenRaw : 'all';
  const year = String(query.year || '').trim();
  const status = String(query.status || '').trim();
  return { rocket, q, when, year, status };
}

export function filterLaunches(launches, query = {}, now = new Date()) {
  const params = parseSpacexQuery(query);
  const needle = params.q.toLowerCase();
  let rows = Array.isArray(launches) ? launches : [];
  if (params.rocket && params.rocket !== 'all') {
    rows = rows.filter((row) => row.rocketId === params.rocket);
  }
  if (params.status) {
    const want = params.status.toLowerCase();
    rows = rows.filter((row) => String(row.status || '').toLowerCase() === want);
  }
  if (/^\d{4}$/.test(params.year)) {
    rows = rows.filter((row) => String(row.net || '').startsWith(params.year));
  }
  if (params.when === 'upcoming') {
    rows = rows.filter((row) => isUpcoming(row, now));
  } else if (params.when === 'past') {
    rows = rows.filter((row) => !isUpcoming(row, now));
  }
  if (needle) {
    rows = rows.filter((row) => {
      const hay = [
        row.mission,
        row.rocket,
        row.variant,
        row.pad,
        row.location,
        row.orbit,
        row.missionType,
        row.status,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }
  return rows;
}

export function summarizeCatalog(catalog, now = new Date()) {
  const launches = Array.isArray(catalog?.launches) ? catalog.launches : [];
  const upcoming = launches.filter((row) => isUpcoming(row, now));
  const past = launches.filter((row) => !isUpcoming(row, now));
  return {
    rocketCount: Array.isArray(catalog?.rockets) ? catalog.rockets.length : 0,
    launchCount: launches.length,
    pastCount: past.length,
    upcomingCount: upcoming.length,
    successCount: past.filter((row) => row.status === 'Success').length,
    nextLaunch: upcoming[0] || null,
  };
}

export function getSpacexPage(query = {}, now = new Date()) {
  const catalog = loadCatalog();
  const params = parseSpacexQuery(query);
  return {
    source: catalog.source,
    sourceUrl: catalog.sourceUrl,
    credit: catalog.credit,
    fetchedAt: catalog.fetchedAt,
    rockets: catalog.rockets,
    summary: summarizeCatalog(catalog, now),
    launches: filterLaunches(catalog.launches, params, now),
    params,
  };
}

export default {
  loadCatalog,
  resetCatalogCache,
  isUpcoming,
  parseSpacexQuery,
  filterLaunches,
  summarizeCatalog,
  getSpacexPage,
};
