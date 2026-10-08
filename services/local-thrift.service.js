/**
 * Thrift stores within 30 miles of Fountain Valley.
 * OpenStreetMap Overpass fills gaps; the Local Spots page also searches Google Places in the browser.
 * Development work by David Lane
 */

export const FOUNTAIN_VALLEY = {
  id: 'fountain-valley',
  name: 'Fountain Valley',
  lat: 33.7095,
  lng: -117.9537,
};

export const RADIUS_MILES = 30;
export const RADIUS_M = Math.round(RADIUS_MILES * 1609.344);

const CACHE_MS = 6 * 60 * 60 * 1000;
const EARTH_MILES = 3958.7613;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

let memoryCache = null;

export function milesBetween(aLat, aLng, bLat, bLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withinThriftRadius(lat, lng, radiusMiles = RADIUS_MILES) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return milesBetween(FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng, lat, lng) <= radiusMiles + 0.25;
}

export function overpassThriftQuery(lat = FOUNTAIN_VALLEY.lat, lng = FOUNTAIN_VALLEY.lng, radiusM = RADIUS_M) {
  const around = `(around:${radiusM},${lat},${lng})`;
  return (
    `[out:json][timeout:25];(` +
    `node["shop"="second_hand"]${around};` +
    `way["shop"="second_hand"]${around};` +
    `node["shop"="charity"]${around};` +
    `way["shop"="charity"]${around};` +
    `);out center tags;`
  );
}

function elementLatLng(el) {
  if (Number.isFinite(el?.lat) && Number.isFinite(el?.lon)) return { lat: el.lat, lng: el.lon };
  if (Number.isFinite(el?.center?.lat) && Number.isFinite(el?.center?.lon)) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function formatAddress(tags) {
  if (!tags) return '';
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = [tags['addr:city'], tags['addr:state']].filter(Boolean).join(', ');
  return [street, city].filter(Boolean).join(', ');
}

export function normalizeOverpassElement(el) {
  const name = String(el?.tags?.name || '').trim();
  const loc = elementLatLng(el);
  if (!name || !loc || !withinThriftRadius(loc.lat, loc.lng)) return null;
  const miles = milesBetween(FOUNTAIN_VALLEY.lat, FOUNTAIN_VALLEY.lng, loc.lat, loc.lng);
  return {
    id: `osm-${el.type || 'n'}-${el.id}`,
    name,
    address: formatAddress(el.tags),
    lat: loc.lat,
    lng: loc.lng,
    miles: Math.round(miles * 10) / 10,
    source: 'osm',
  };
}

function nameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function isSameStore(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (!Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return false;
  if (milesBetween(a.lat, a.lng, b.lat, b.lng) > 0.2) return false;
  const na = nameKey(a.name);
  const nb = nameKey(b.name);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function dedupeStores(stores) {
  const out = [];
  for (const store of stores || []) {
    if (!store?.name || !withinThriftRadius(store.lat, store.lng)) continue;
    if (out.some((existing) => isSameStore(existing, store))) continue;
    out.push(store);
  }
  return out.sort((a, b) => a.miles - b.miles || a.name.localeCompare(b.name));
}

export function clearThriftCache() {
  memoryCache = null;
}

async function fetchOverpassElements(fetchFn) {
  const body = overpassThriftQuery();
  let lastErr = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'DevConnectLabs-LocalSpots/1.0',
        },
        body,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.elements)) throw new Error(data.remark || 'Overpass empty');
      return data.elements;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Overpass failed');
}

export async function getThriftNearFountainValley(fetchFn = fetch) {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_MS) return memoryCache.value;

  let elements = [];
  let error = '';
  try {
    elements = await fetchOverpassElements(fetchFn);
  } catch (err) {
    error = err.message || 'Overpass failed';
  }

  const stores = dedupeStores(elements.map(normalizeOverpassElement).filter(Boolean));
  const value = {
    home: FOUNTAIN_VALLEY,
    radiusMiles: RADIUS_MILES,
    stores,
    fetchedAt: new Date().toISOString(),
    source: 'osm',
    error: error || undefined,
  };
  if (!error) memoryCache = { at: Date.now(), value };
  return value;
}

export default {
  FOUNTAIN_VALLEY,
  RADIUS_MILES,
  RADIUS_M,
  milesBetween,
  withinThriftRadius,
  overpassThriftQuery,
  normalizeOverpassElement,
  isSameStore,
  dedupeStores,
  getThriftNearFountainValley,
  clearThriftCache,
};
