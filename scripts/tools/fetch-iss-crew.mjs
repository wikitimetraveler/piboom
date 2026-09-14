/**
 * Snapshot ISS crew from Launch Library 2 (The Space Devs).
 *
 * Usage:
 *   node scripts/tools/fetch-iss-crew.mjs
 *
 * Writes data/planetarium/iss-crew.json
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'data/planetarium/iss-crew.json');
const MODULES = path.join(ROOT, 'data/planetarium/iss-modules.json');

const LL2 = 'https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=40';

const SOYUZ_QUARTERS = ['rassvet', 'poisk', 'zvezda'];

function agencyAbbrev(raw) {
  if (!raw || typeof raw !== 'object') return '';
  const abbrev = String(raw.abbrev || '').trim();
  if (abbrev === 'RFSA') return 'Roscosmos';
  if (abbrev === 'SpX') return 'SpaceX';
  return abbrev || String(raw.name || '').trim();
}

function isIssPerson(row) {
  const name = String(row?.name || '');
  if (/starman/i.test(name)) return false;
  const abbrev = String(row?.agency?.abbrev || '');
  const agencyName = String(row?.agency?.name || '');
  if (abbrev === 'CNSA' || /china/i.test(agencyName)) return false;
  const nationality = String(row?.nationality || '');
  if (/^chinese$/i.test(nationality)) return false;
  return Boolean(row?.in_space);
}

export function craftFromGroup(people) {
  const n = people.length;
  const ros = people.filter((p) => /roscosmos|rfsa/i.test(p.agency)).length;
  if (ros >= Math.ceil(n / 2) && n <= 3) return 'Soyuz';
  return 'Crew Dragon';
}

export function assignQuarters(people) {
  const byArrival = new Map();
  for (const person of people) {
    const key = String(person.arrival || '').slice(0, 16) || 'unknown';
    if (!byArrival.has(key)) byArrival.set(key, []);
    byArrival.get(key).push(person);
  }
  const soyuzSlots = [...SOYUZ_QUARTERS];
  for (const group of byArrival.values()) {
    const craft = craftFromGroup(group);
    for (const person of group) {
      person.craft = craft;
      if (craft === 'Soyuz') {
        person.quartersModuleId = soyuzSlots.shift() || 'zvezda';
      } else {
        person.quartersModuleId = 'harmony';
      }
    }
  }
  return people;
}

function knownModuleIds() {
  try {
    const catalog = JSON.parse(fs.readFileSync(MODULES, 'utf8'));
    return new Set((catalog.modules || []).map((m) => m.id));
  } catch (_) {
    return new Set(SOYUZ_QUARTERS.concat('harmony'));
  }
}

export function toCrewRecord(row) {
  return {
    id: row.id,
    name: String(row.name || '').trim(),
    agency: agencyAbbrev(row.agency),
    nationality: String(row.nationality || '').trim(),
    role: 'Flight engineer',
    craft: '',
    arrival: row.last_flight || null,
    photo: row.profile_image_thumbnail || row.profile_image || '',
    wiki: row.wiki || '',
    quartersModuleId: '',
  };
}

async function fetchAstronauts(fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(LL2, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`ISS crew HTTP ${res.status}`);
    err.code = 'ISS_CREW_UPSTREAM';
    throw err;
  }
  return res.json();
}

export async function buildCrewSnapshot(fetchImpl = globalThis.fetch) {
  const payload = await fetchAstronauts(fetchImpl);
  const rows = Array.isArray(payload?.results) ? payload.results : [];
  const people = assignQuarters(rows.filter(isIssPerson).map(toCrewRecord));
  people.sort((a, b) => String(a.arrival || '').localeCompare(String(b.arrival || '')) || a.name.localeCompare(b.name));
  const ids = knownModuleIds();
  for (const person of people) {
    if (!ids.has(person.quartersModuleId)) person.quartersModuleId = 'harmony';
  }
  return {
    station: 'ISS',
    expedition: 'Current increment',
    fetchedAt: new Date().toISOString(),
    source: 'Launch Library 2',
    sourceUrl: 'https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true',
    credit:
      'The Space Devs Launch Library 2 — quarters mapped by craft, not official sleep-station assignments.',
    note: 'Tiangong crew and non-human entries (Starman) are excluded. Sleep modules are planetarium estimates: Crew Dragon → Harmony, Soyuz → Rassvet / Poisk / Zvezda.',
    people,
  };
}

async function main() {
  const snapshot = await buildCrewSnapshot();
  if (!snapshot.people.length) {
    console.error('No ISS crew rows returned; leaving existing snapshot.');
    process.exit(1);
  }
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
  console.log('Wrote', OUT, '·', snapshot.people.length, 'people');
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
