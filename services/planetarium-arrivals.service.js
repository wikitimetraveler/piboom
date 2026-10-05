/**
 * Upcoming ISS arrivals from Launch Library 2 (The Space Devs), mapped to a
 * station port and a docking or berthing sequence for the planetarium scene.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'planetarium', 'iss-arrivals.json');

export const LL2_UPCOMING_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=60';
const CACHE_MS = 60 * 60 * 1000;
const MAX_ARRIVALS = 6;

/**
 * Order matters: first match wins. Ports are scene module ids.
 * LL2 tags most ISS flights "LEO", so the vehicle name is the signal.
 */
const VEHICLES = [
  {
    test: /starliner/i,
    vehicle: 'Starliner',
    kind: 'docking',
    port: 'ida2',
    portLabel: 'IDA-2 on Harmony forward',
    mechanism: 'NASA Docking System',
  },
  {
    test: /\b(crew-\d+|crew dragon|axiom|ax-\d+|vast)\b/i,
    vehicle: 'Crew Dragon',
    kind: 'docking',
    port: 'ida2',
    portLabel: 'IDA-2 on Harmony forward',
    mechanism: 'NASA Docking System',
  },
  {
    test: /\b(dragon|spx-\d+)\b/i,
    vehicle: 'Cargo Dragon',
    kind: 'docking',
    port: 'ida3',
    portLabel: 'IDA-3 on Harmony zenith',
    mechanism: 'NASA Docking System',
  },
  {
    test: /\bsoyuz ms-\d+/i,
    vehicle: 'Soyuz',
    kind: 'docking',
    port: 'rassvet',
    portLabel: 'Rassvet (MRM-1)',
    mechanism: 'probe-and-drogue',
  },
  {
    test: /\bprogress ms-\d+/i,
    vehicle: 'Progress',
    kind: 'docking',
    port: 'zvezda',
    portLabel: 'Zvezda aft port',
    mechanism: 'probe-and-drogue',
  },
  {
    test: /\b(cygnus|ng-\d+)\b/i,
    vehicle: 'Cygnus',
    kind: 'berthing',
    port: 'unity',
    portLabel: 'Unity nadir (Canadarm2 berth)',
    mechanism: 'Common Berthing Mechanism',
  },
  {
    test: /\bhtv-x\d*/i,
    vehicle: 'HTV-X',
    kind: 'berthing',
    port: 'harmony',
    portLabel: 'Harmony nadir (Canadarm2 berth)',
    mechanism: 'Common Berthing Mechanism',
  },
  {
    test: /dream chaser/i,
    vehicle: 'Dream Chaser',
    kind: 'berthing',
    port: 'harmony',
    portLabel: 'a nadir berthing port (Canadarm2)',
    mechanism: 'Common Berthing Mechanism',
  },
];

const EXCLUDE = /\b(shenzhou|tianzhou|tiangong)\b/i;

let cache = null;

export function classifyVehicle(name) {
  const text = String(name || '');
  if (!text || EXCLUDE.test(text)) return null;
  const hit = VEHICLES.find((row) => row.test.test(text));
  if (!hit) return null;
  const { test: _test, ...rest } = hit;
  return rest;
}

function trimText(value, max = 280) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

export function normalizeLaunch(row) {
  if (!row || typeof row !== 'object') return null;
  const missionName = String(row.mission?.name || '').trim();
  const fullName = String(row.name || '').trim();
  const match = classifyVehicle(`${missionName} ${fullName}`);
  if (!match) return null;
  return {
    id: String(row.id || ''),
    name: missionName || fullName,
    rocket: String(row.rocket?.configuration?.full_name || row.rocket?.configuration?.name || fullName.split('|')[0] || '').trim(),
    net: row.net || null,
    netPrecision: String(row.net_precision?.name || '').trim(),
    status: String(row.status?.abbrev || row.status?.name || '').trim(),
    statusName: String(row.status?.name || '').trim(),
    provider: String(row.launch_service_provider?.name || '').trim(),
    pad: String(row.pad?.name || '').trim(),
    padLocation: String(row.pad?.location?.name || '').trim(),
    description: trimText(row.mission?.description),
    ...match,
  };
}

export function selectArrivals(results, now = Date.now()) {
  const rows = Array.isArray(results) ? results : [];
  const cutoff = Number(now) - 6 * 60 * 60 * 1000;
  return rows
    .map(normalizeLaunch)
    .filter(Boolean)
    .filter((row) => !row.net || Date.parse(row.net) >= cutoff)
    .sort((a, b) => Date.parse(a.net || 0) - Date.parse(b.net || 0))
    .slice(0, MAX_ARRIVALS);
}

export function loadSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch (_) {
    return { fetchedAt: null, arrivals: [] };
  }
}

export function resetArrivalsCache() {
  cache = null;
}

/**
 * @returns {Promise<{ source: 'live'|'snapshot', fetchedAt: string|null, arrivals: object[], note?: string }>}
 */
export async function getIssArrivals(fetchImpl = globalThis.fetch, now = Date.now()) {
  if (cache && Number(now) - cache.at < CACHE_MS) return cache.payload;
  try {
    if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
    const res = await fetchImpl(LL2_UPCOMING_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Launch Library ${res.status}`);
    const body = await res.json();
    const arrivals = selectArrivals(body?.results, now);
    const payload = { source: 'live', fetchedAt: new Date(Number(now)).toISOString(), arrivals };
    cache = { at: Number(now), payload };
    return payload;
  } catch (err) {
    const snap = loadSnapshot();
    return {
      source: 'snapshot',
      fetchedAt: snap.fetchedAt || null,
      arrivals: Array.isArray(snap.arrivals) ? snap.arrivals : [],
      note: `Live Launch Library unavailable (${err.message}); showing the bundled snapshot.`,
    };
  }
}

export default {
  classifyVehicle,
  normalizeLaunch,
  selectArrivals,
  loadSnapshot,
  resetArrivalsCache,
  getIssArrivals,
};
