/**
 * Snapshot SpaceX rockets + launches from Launch Library 2 (The Space Devs).
 *
 * Usage:
 *   node scripts/tools/fetch-spacex-catalog.mjs
 *
 * Writes data/planetarium/spacex-catalog.json
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'data/planetarium/spacex-catalog.json');

const LL2 = 'https://ll.thespacedevs.com/2.2.0';
const SPACEX_ID = 121;
const PAGE_SIZE = 100;
const DELAY_MS = 2500;

const ROCKET_META = [
  {
    id: 'falcon-1',
    name: 'Falcon 1',
    family: 'Falcon',
    status: 'retired',
    maidenLabel: 'First flight',
    description:
      'SpaceX’s first orbital rocket. Five flights from Omelek Island (2006–2009). Flight 4, 28 September 2008, was the first privately funded liquid-fueled rocket to reach Earth orbit.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Falcon_1',
    milestones: [{ date: '2008-09-28', label: 'First orbit' }],
  },
  {
    id: 'falcon-9',
    name: 'Falcon 9',
    family: 'Falcon',
    status: 'active',
    maidenLabel: 'First flight',
    description:
      'Two-stage workhorse for Starlink, Crew Dragon, and commercial payloads. First flight 4 June 2010. Block 5 is the current reusable version, landing boosters for rapid reuse.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Falcon_9',
    milestones: [{ date: '2015-12-21', label: 'First booster landing' }],
  },
  {
    id: 'falcon-heavy',
    name: 'Falcon Heavy',
    family: 'Falcon',
    status: 'active',
    maidenLabel: 'First flight',
    description:
      'Three Falcon 9 cores strapped together for heavy GEO and planetary missions. First flight 6 February 2018 from Kennedy LC-39A, carrying a Tesla Roadster.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Falcon_Heavy',
    milestones: [{ date: '2018-02-06', label: 'Tesla Roadster' }],
  },
  {
    id: 'starship',
    name: 'Starship',
    family: 'Starship',
    status: 'development',
    maidenLabel: 'First hop',
    description:
      'Fully reusable Super Heavy booster plus Starship upper stage. Hopper tests from 2019; integrated flight tests from Starbase, Texas, beginning 20 April 2023.',
    wikiUrl: 'https://en.wikipedia.org/wiki/SpaceX_Starship',
    milestones: [{ date: '2023-04-20', label: 'First integrated flight' }],
  },
];

export function classifyRocket(name) {
  const vehicle = String(name || '').split('|')[0].trim();
  const lower = vehicle.toLowerCase();
  if (lower.includes('falcon 1')) return { id: 'falcon-1', name: 'Falcon 1', variant: vehicle };
  if (lower.includes('falcon heavy')) {
    return { id: 'falcon-heavy', name: 'Falcon Heavy', variant: vehicle };
  }
  if (lower.includes('falcon 9')) return { id: 'falcon-9', name: 'Falcon 9', variant: vehicle };
  if (lower.includes('starship') || lower.includes('super heavy')) {
    return { id: 'starship', name: 'Starship', variant: vehicle };
  }
  return { id: 'other', name: vehicle || 'Unknown', variant: vehicle };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') || 20);
    process.stderr.write(`Rate limited — waiting ${retryAfter}s\n`);
    await sleep(retryAfter * 1000);
    return fetchJson(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function compactLaunch(raw) {
  const rocket = classifyRocket(raw.name);
  const mission =
    raw.mission ||
    String(raw.name || '')
      .split('|')
      .slice(1)
      .join('|')
      .trim() ||
    raw.name;
  return {
    id: raw.id,
    mission,
    rocket: rocket.name,
    rocketId: rocket.id,
    variant: rocket.variant,
    net: raw.net,
    status: raw.status?.abbrev || raw.status?.name || 'Unknown',
    pad: raw.pad || '',
    location: raw.location || '',
    orbit: raw.orbit || '',
    missionType: raw.mission_type || '',
  };
}

function buildRockets(launches) {
  return ROCKET_META.map((meta) => {
    const flights = launches.filter((l) => l.rocketId === meta.id);
    const dated = flights
      .filter((l) => l.net)
      .slice()
      .sort((a, b) => String(a.net).localeCompare(String(b.net)));
    const first = dated[0];
    const variants = [...new Set(flights.map((l) => l.variant).filter(Boolean))].sort();
    return {
      ...meta,
      maidenFlight: first ? first.net.slice(0, 10) : null,
      launchCount: flights.length,
      variants,
    };
  });
}

async function fetchAllLaunches() {
  const launches = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url =
      `${LL2}/launch/?lsp__id=${SPACEX_ID}&mode=list&limit=${PAGE_SIZE}` +
      `&offset=${offset}&ordering=net`;
    process.stdout.write(`Fetching launches offset ${offset}…\n`);
    const page = await fetchJson(url);
    total = Number(page.count) || 0;
    const rows = Array.isArray(page.results) ? page.results : [];
    launches.push(...rows.map(compactLaunch));
    offset += PAGE_SIZE;
    if (!rows.length) break;
    if (offset < total) await sleep(DELAY_MS);
  }
  return launches;
}

async function main() {
  const rebuild = process.argv.includes('--rebuild');
  let launches;
  if (rebuild && fs.existsSync(OUT)) {
    const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    launches = Array.isArray(existing.launches) ? existing.launches : [];
    process.stdout.write(`Rebuilding rockets from ${launches.length} cached launches\n`);
  } else {
    launches = await fetchAllLaunches();
  }
  const rockets = buildRockets(launches);
  const catalog = {
    source: 'Launch Library 2 (The Space Devs)',
    sourceUrl: 'https://ll.thespacedevs.com/',
    credit: 'https://thespacedevs.com/',
    fetchedAt: new Date().toISOString(),
    rockets,
    launches,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(catalog));
  process.stdout.write(
    `Wrote ${rockets.length} rockets and ${launches.length} launches to ${path.relative(ROOT, OUT)}\n`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
