/**
 * Force-replace generic Shenango stand-ins with known Commons files (local places).
 * Development work by David Lane
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'DevConnectLabs-Shenango/1.2 (real media refresh)';
const ROOT = process.cwd();
const ASSETS = path.join(ROOT, 'public', 'nature', 'assets', 'shenango');
const CREDITS_PATH = path.join(ROOT, 'public', 'nature', 'data', 'shenango-photo-credits.json');
const THUMB = 1280;
const SLEEP = 900;

/** Local / regional replacements — prefer exact place names over generic atmosphere. */
const REPLACEMENTS = [
  {
    id: 'buhl-park',
    file: 'park/buhl-park.jpg',
    title: 'Hermitage Avenue of Flags.jpg',
    note: 'Hermitage, PA — park-city civic green near Buhl Farm Drive'
  },
  {
    id: 'buhl-farm-drive',
    file: 'park/buhl-farm-drive.jpg',
    title:
      '2022-06-05 16 12 36 View north along Pennsylvania State Route 418 (Mercer Avenue) at Buhl Farm Drive in Hermitage, Mercer County, Pennsylvania.jpg',
    note: 'Buhl Farm Drive / Mercer Ave, Hermitage'
  },
  {
    id: 'farrell-steel',
    file: 'steel/farrell-steel.jpg',
    title:
      'Hopper car belonging to the Carnegie Steel Company, Sharon Works at the Ralston Steel Car Company - DPLA - 2eed2d23b7e170faddb4101fdf31cf88.jpg',
    note: 'Carnegie Steel Sharon Works hopper — actual Sharon steel rail traffic'
  },
  {
    id: 'farrell-street',
    file: 'steel/farrell-street.jpg',
    title: 'PA 718 sb in Farrell, June 2024.jpg',
    note: 'PA 718 in Farrell, PA (2024)'
  },
  {
    id: 'farrell-industry',
    file: 'steel/farrell-industry.jpg',
    title: 'Independent Draft Gear and its neighbors, Farrell.jpg',
    note: 'Industrial Farrell neighbors'
  },
  {
    id: 'sharpsville-lock',
    file: 'steel/sharpsville-lock.jpg',
    title: 'Erie Extension Canal in Sadsbury Township.jpg',
    note: 'Erie Extension Canal remnant (correct canal system)'
  },
  {
    id: 'sharpsville-1901',
    file: 'steel/sharpsville-1901.jpg',
    title: 'Sharpsville, Mercer County Pennsylvania, 1901 LCCN2003681828.jpg',
    note: 'Sharpsville bird’s-eye 1901'
  },
  {
    id: 'youngstown-skyline',
    file: 'mob/youngstown-skyline.jpg',
    title: 'Downtown Youngstown Skyline.JPG',
    note: 'Downtown Youngstown skyline'
  },
  {
    id: 'youngstown-federal',
    file: 'mob/youngstown-federal.jpg',
    title: 'Youngstown, Ohio Central Square West Federal Street.jpg',
    note: 'Central Square / West Federal Street, Youngstown'
  },
  {
    id: 'yst-1915',
    file: 'mob/yst-1915.jpg',
    title: 'Youngstown Sheet and Tube Company 1915.jpg',
    note: 'Youngstown Sheet & Tube 1915'
  },
  {
    id: 'yst-ore',
    file: 'mob/yst-ore-yard.jpg',
    title: 'Ore yard - Youngstown Sheet and Tube 1930.jpg',
    note: 'YST ore yard 1930'
  },
  {
    id: 'mercer-courthouse',
    file: 'music/mercer-courthouse.jpg',
    title: 'Mercer County Courthouse Pennsylvania 2010.jpg',
    note: 'Mercer County Courthouse — Reznor hometown county seat'
  },
  {
    id: 'football',
    file: 'sports/football-stadium.jpg',
    title: 'Celina High School, Friday Night Football.jpg',
    note: 'Midwest Friday-night lights (atmosphere closer than college Army game)'
  },
  {
    id: 'quaker-steak',
    file: 'food/quaker-steak.jpg',
    title: 'Buffalo wings-01.jpg',
    note: 'Buffalo / chicken wings plate — QSL signature food (no Commons Sharon storefront)'
  },
  {
    id: 'pizza',
    file: 'food/pizza.jpg',
    title: 'Homemade cheese pizza.jpg',
    note: 'Cheese pizza — valley table stand-in if file exists; fallback below'
  },
  {
    id: 'radio',
    file: 'music/radio.jpg',
    title: 'Radio tower.jpg',
    note: 'Radio tower fallback'
  }
];

const FALLBACKS = {
  pizza: ['Cheese pizza.jpg', 'Pizza Margherita.jpg', 'New York-style pizza.jpg'],
  radio: [
    'AM radio tower.jpg',
    'Broadcast tower.jpg',
    'Radio masts and towers.jpg',
    'Nbc studio tour bookmark 1935.JPG'
  ]
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  let wait = 1200;
  for (let i = 0; i < 6; i += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status === 503) {
      await sleep(wait);
      wait *= 1.7;
      continue;
    }
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }
  throw new Error('API rate limited');
}

function strip(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveTitle(title) {
  const data = await api({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: String(THUMB),
    titles: title.startsWith('File:') ? title : `File:${title}`
  });
  const page = data.query?.pages?.[0];
  const ii = page?.imageinfo?.[0];
  if (!ii?.url && !ii?.thumburl) return null;
  return {
    title: page.title,
    thumbUrl: ii.thumburl || ii.url,
    license: strip(ii.extmetadata?.LicenseShortName?.value) || 'Unknown',
    licenseUrl: strip(ii.extmetadata?.LicenseUrl?.value),
    artist: strip(ii.extmetadata?.Artist?.value) || 'Unknown',
    descriptionUrl: ii.descriptionurl,
    caption: strip(ii.extmetadata?.ImageDescription?.value).slice(0, 280)
  };
}

async function download(url, dest) {
  let wait = 1500;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      return buf.length;
    }
    if (res.status !== 429 && res.status !== 503) throw new Error(`DL ${res.status}`);
    await sleep(wait);
    wait *= 1.8;
  }
  throw new Error('download rate limited');
}

async function main() {
  let credits = {};
  try {
    credits = JSON.parse(await readFile(CREDITS_PATH, 'utf8')).credits || {};
  } catch (_) {
    /* empty */
  }

  for (const job of REPLACEMENTS) {
    await sleep(SLEEP);
    const candidates = [job.title, ...(FALLBACKS[job.id] || [])];
    let meta = null;
    let used = null;
    for (const title of candidates) {
      meta = await resolveTitle(title);
      if (meta?.thumbUrl) {
        used = title;
        break;
      }
      await sleep(400);
    }
    if (!meta) {
      console.log(`✗ ${job.id} — no file`);
      continue;
    }
    const dest = path.join(ASSETS, job.file.replace(/\//g, path.sep));
    const bytes = await download(meta.thumbUrl, dest);
    credits[job.id] = {
      image: `/nature/assets/shenango/${job.file}`,
      source: meta.descriptionUrl,
      title: meta.title,
      artist: meta.artist,
      license: meta.license,
      licenseUrl: meta.licenseUrl,
      caption: meta.caption,
      note: job.note,
      commonsFile: used
    };
    console.log(`✓ ${job.id.padEnd(22)} ${meta.license.padEnd(16)} ${bytes}b ← ${used}`);
  }

  await writeFile(
    CREDITS_PATH,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), credits }, null, 2)}\n`
  );
  console.log('credits updated');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
