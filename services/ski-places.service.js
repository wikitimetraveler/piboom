/**
 * Live on-the-way shop listings via Google Places, OSM Overpass fallback.
 * Development work by David Lane
 */
import { getGoogleServerApiKey } from '../lib/google-api-key.js';
import {
  loadOnTheWaySeed,
  loadRoutes,
  mergeStops,
  filterStops,
} from './ski-topo.service.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
const LIVE_KINDS = ['thrift'];
const PER_KIND_CAP = 8;
const RADIUS_M = 5000;

const PLACE_QUERIES = {
  thrift: 'thrift store',
};

const OVERPASS_SHOPS = {
  thrift: ['second_hand', 'charity'],
};

const memoryCache = new Map();

export function placesQueryForKind(kind) {
  return PLACE_QUERIES[kind] || kind;
}

export function overpassShopsForKind(kind) {
  return OVERPASS_SHOPS[kind] || [];
}

function cacheGet(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  memoryCache.set(key, { at: Date.now(), value });
  return value;
}

export function clearPlacesCache() {
  memoryCache.clear();
}

function mapPlace(result, kind, route, town) {
  const loc = result.geometry?.location || {};
  return {
    id: result.place_id || `live-${kind}-${town}-${result.name}`,
    name: result.name,
    route,
    kind,
    town,
    note: result.vicinity || result.formatted_address || town,
    lat: loc.lat,
    lng: loc.lng,
    placeId: result.place_id || null,
    source: 'live',
  };
}

export async function fetchGooglePlacesAtWaypoint(waypoint, kind, route, fetchFn = fetch) {
  const key = getGoogleServerApiKey();
  if (!key) return [];
  const q = placesQueryForKind(kind);
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${waypoint.lat},${waypoint.lng}&radius=${RADIUS_M}` +
    `&keyword=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Places ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, PER_KIND_CAP).map((r) => mapPlace(r, kind, route, waypoint.name));
}

function overpassQuery(waypoint, kind) {
  const shops = overpassShopsForKind(kind)
    .map((shop) => `node["shop"="${shop}"](around:${RADIUS_M},${waypoint.lat},${waypoint.lng});`)
    .join('');
  return `[out:json][timeout:15];(${shops});out center 20;`;
}

export async function fetchOverpassAtWaypoint(waypoint, kind, route, fetchFn = fetch) {
  const body = overpassQuery(waypoint, kind);
  const res = await fetchFn('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': 'DevConnectLabs-SkiTopo/1.0' },
    body,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();
  const elements = Array.isArray(data.elements) ? data.elements : [];
  return elements.slice(0, PER_KIND_CAP).map((el) => ({
    id: `osm-${el.id}`,
    name: el.tags?.name || `${kind} shop`,
    route,
    kind,
    town: waypoint.name,
    note: el.tags?.['addr:street'] || waypoint.name,
    lat: el.lat,
    lng: el.lon,
    placeId: `osm:${el.id}`,
    source: 'live',
  }));
}

export async function fetchLiveStopsForRoute(routeId, fetchFn = fetch) {
  const cacheKey = `live:${routeId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const routes = await loadRoutes();
  const route = routes[routeId];
  if (!route) return cacheSet(cacheKey, []);

  const live = [];
  const hasKey = Boolean(getGoogleServerApiKey());

  for (const waypoint of route.waypoints || []) {
    for (const kind of LIVE_KINDS) {
      try {
        const batch = hasKey
          ? await fetchGooglePlacesAtWaypoint(waypoint, kind, routeId, fetchFn)
          : await fetchOverpassAtWaypoint(waypoint, kind, routeId, fetchFn);
        live.push(...batch);
      } catch (_) {
        if (hasKey) {
          try {
            live.push(...(await fetchOverpassAtWaypoint(waypoint, kind, routeId, fetchFn)));
          } catch (__) {
            /* skip waypoint */
          }
        }
      }
    }
  }

  return cacheSet(cacheKey, live);
}

export async function getStops({ route, kind, fetchFn = fetch } = {}) {
  const seed = await loadOnTheWaySeed();
  const live = route ? await fetchLiveStopsForRoute(route, fetchFn) : [];
  const merged = mergeStops(seed, live);
  return filterStops(merged, { route, kind });
}

export default {
  placesQueryForKind,
  overpassShopsForKind,
  fetchLiveStopsForRoute,
  getStops,
  clearPlacesCache,
  LIVE_KINDS,
};
