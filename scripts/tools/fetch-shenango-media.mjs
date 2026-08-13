#!/usr/bin/env node
/**
 * Fetch Wikimedia Commons photos + build a video catalog for Shenango Valley atlas.
 * Usage: node scripts/tools/fetch-shenango-media.mjs
 * Development work by David Lane
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'DevConnectLabs-Shenango/1.0 (atlas media; atlas@devconnectlabs.example)';
const ROOT = process.cwd();
const THUMB_WIDTH = 1200;
const SLEEP_MS = 450;
const ALLOWED_LICENSE = /^(cc0|cc[- ]?by([- ]?sa)?([- ]?\d(\.\d)?)?|public domain|pd\b|no restrictions)/i;

const ASSETS = path.join(ROOT, 'public', 'nature', 'assets', 'shenango');
const CREDITS_PATH = path.join(ROOT, 'public', 'nature', 'data', 'shenango-photo-credits.json');
const VIDEOS_PATH = path.join(ROOT, 'public', 'nature', 'data', 'shenango-videos.json');

const PHOTO_JOBS = [
  {
    id: 'buhl-park',
    file: 'park/buhl-park.jpg',
    queries: [
      'Buhl Farm Park Hermitage',
      'Buhl Park Sharon Pennsylvania',
      'Lake Julia Buhl Farm',
      'Hermitage Pennsylvania park'
    ]
  },
  {
    id: 'buhl-casino',
    file: 'park/buhl-casino.jpg',
    queries: ['Buhl Farm Casino Sharon', 'Buhl Park Casino Pennsylvania', 'Lake Julia Casino postcard']
  },
  {
    id: 'sharon-downtown',
    file: 'steel/sharon-downtown.jpg',
    queries: ['Sharon Pennsylvania downtown', 'Sharon PA State Street', 'Shenango River Sharon']
  },
  {
    id: 'farrell-steel',
    file: 'steel/farrell-steel.jpg',
    queries: [
      'Sharon Steel Farrell Pennsylvania',
      'Farrell Pennsylvania mill',
      'steel mill Pennsylvania Shenango',
      'blast furnace Pennsylvania'
    ]
  },
  {
    id: 'sharpsville-lock',
    file: 'steel/sharpsville-lock.jpg',
    queries: [
      'Sharpsville Lock 10',
      'Erie Extension Canal lock Pennsylvania',
      'canal lock Sharpsville',
      'Beaver and Erie Canal lock'
    ]
  },
  {
    id: 'buhl-mansion',
    file: 'steel/buhl-mansion.jpg',
    queries: ['Buhl Mansion Sharon', 'Buhl Mansion Pennsylvania', 'Romanesque mansion Sharon PA']
  },
  {
    id: 'new-wilmington',
    file: 'amish/new-wilmington.jpg',
    queries: [
      'New Wilmington Pennsylvania',
      'Amish buggy Pennsylvania western',
      'Lawrence County Amish farm',
      'Pennsylvania Amish countryside barn'
    ]
  },
  {
    id: 'volant',
    file: 'amish/volant.jpg',
    queries: ['Volant Pennsylvania', 'Volant PA main street', 'Amish country Pennsylvania mill']
  },
  {
    id: 'football',
    file: 'sports/football-stadium.jpg',
    queries: [
      'high school football stadium Pennsylvania',
      'American football stadium night lights',
      'WPA stadium Pennsylvania'
    ]
  },
  {
    id: 'basketball',
    file: 'sports/basketball.jpg',
    queries: ['high school basketball gymnasium', 'basketball court Pennsylvania', 'school gymnasium interior']
  },
  {
    id: 'golf',
    file: 'sports/golf.jpg',
    queries: ['public golf course Pennsylvania', 'nine hole golf course', 'golf green park']
  },
  {
    id: 'lettermen',
    file: 'music/lettermen.jpg',
    queries: [
      'The Lettermen 1964',
      'The Lettermen vocal group',
      'Lettermen Tony Butala',
      'The Lettermen Capitol Records'
    ]
  },
  {
    id: 'reznor',
    file: 'music/trent-reznor.jpg',
    queries: [
      'Trent Reznor 2008',
      'Nine Inch Nails Trent Reznor',
      'Trent Reznor live',
      'Mercer County Pennsylvania courthouse'
    ]
  },
  {
    id: 'maennerchor',
    file: 'music/maennerchor.jpg',
    queries: [
      'German singing society hall',
      'Maennerchor',
      'German American club hall',
      'Festhalle'
    ]
  },
  {
    id: 'radio',
    file: 'music/radio.jpg',
    queries: ['vintage radio studio microphone', 'AM radio transmitter tower', '1950s record hop dance']
  },
  {
    id: 'concert',
    file: 'music/outdoor-concert.jpg',
    queries: ['outdoor summer concert park', 'band shell park concert', 'community band outdoor']
  },
  {
    id: 'quaker-steak',
    file: 'food/quaker-steak.jpg',
    queries: [
      'Quaker Steak and Lube Sharon',
      'Quaker Steak Lube restaurant',
      'chicken wings restaurant neon'
    ]
  },
  {
    id: 'pizza',
    file: 'food/pizza.jpg',
    queries: ['pizza parlor Pennsylvania', 'cheese pizza close up', 'Italian pizzeria neon']
  },
  {
    id: 'shenango-river',
    file: 'park/shenango-river.jpg',
    queries: ['Shenango River Pennsylvania', 'Shenango River Sharon', 'Mercer County river']
  },
  {
    id: 'frank-buhl',
    file: 'steel/frank-buhl.jpg',
    queries: ['Frank H Buhl', 'Frank Henry Buhl portrait', 'steel industrialist Pennsylvania']
  }
];

/** Curated embeddable videos — official/archival/documentary clips (watch on YouTube). */
const VIDEO_CATALOG = {
  id: 'shenango-valley-videos',
  note: 'External embeds — play on YouTube. Prefer official / archival / fair-use documentary clips. No downloads of copyrighted streams.',
  themes: {
    park: [
      {
        id: 'buhl-park-tour',
        title: 'Buhl Park — living legacy (search)',
        youtubeSearch: 'Buhl Park Hermitage summer concert',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Buhl+Park+Hermitage+Pennsylvania',
        blurb: 'Search results for park tours and summer concert series footage.'
      }
    ],
    steel: [
      {
        id: 'sharon-steel-history',
        title: 'Sharon Steel / Farrell mill history',
        youtubeSearch: 'Sharon Steel Farrell Pennsylvania',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Sharon+Steel+Farrell+Pennsylvania+history',
        blurb: 'Industrial history clips of the Farrell works and valley steel era.'
      },
      {
        id: 'lock-10',
        title: 'Sharpsville Lock 10 visit',
        youtubeSearch: 'Sharpsville Lock 10 Erie Extension Canal',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Sharpsville+Lock+10+canal',
        blurb: 'On-site visits to the surviving Erie Extension Canal lock.'
      }
    ],
    amish: [
      {
        id: 'new-wilmington-drive',
        title: 'New Wilmington Amish country',
        youtubeSearch: 'New Wilmington Pennsylvania Amish',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=New+Wilmington+Pennsylvania+Amish',
        blurb: 'Countryside drives — use respectfully; avoid filming people without permission.'
      }
    ],
    sports: [
      {
        id: 'steel-bowl',
        title: 'Sharon–Farrell Steel Bowl / rivalry',
        youtubeSearch: 'Sharon Farrell Steel Bowl football',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Sharon+Farrell+Steel+Bowl+football',
        blurb: 'Highlight clips from the valley football rivalry.'
      },
      {
        id: 'farrell-basketball',
        title: 'Farrell Steelers basketball',
        youtubeSearch: 'Farrell Steelers basketball District 10',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Farrell+Steelers+basketball+District+10',
        blurb: 'District title and playoff coverage.'
      }
    ],
    music: [
      {
        id: 'lettermen-way-you-look',
        title: 'The Lettermen — The Way You Look Tonight',
        youtubeId: 'GKc3YfJk8o0',
        url: 'https://www.youtube.com/watch?v=GKc3YfJk8o0',
        blurb: 'Classic Lettermen harmony (Tony Butala, Sharon native). Verify embed availability.'
      },
      {
        id: 'lettermen-when-i-fall',
        title: 'The Lettermen — When I Fall in Love',
        youtubeSearch: 'The Lettermen When I Fall in Love',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=The+Lettermen+When+I+Fall+in+Love+official',
        blurb: 'Signature close-harmony hit.'
      },
      {
        id: 'reznor-sax-1982',
        title: 'Trent Reznor sax solo — Mercer HS Jazz Band 1982',
        youtubeId: 'SiDAyGkC-LY',
        url: 'https://www.youtube.com/watch?v=SiDAyGkC-LY',
        blurb: 'Pressure Cooker — early Reznor on Mercer PA high school jazz record.'
      },
      {
        id: 'nin-head-like-a-hole',
        title: 'Nine Inch Nails — Head Like a Hole (official)',
        youtubeSearch: 'Nine Inch Nails Head Like a Hole official',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Nine+Inch+Nails+Head+Like+a+Hole+official+video',
        blurb: 'National career after Mercer — link out; prefer official channel.'
      },
      {
        id: 'butala-interview',
        title: 'Tony Butala / Lettermen interviews',
        youtubeSearch: 'Tony Butala Sharon Lettermen interview',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Tony+Butala+Sharon+Pennsylvania+Lettermen',
        blurb: 'Hometown interviews and Vocal Group Hall of Fame stories.'
      }
    ],
    food: [
      {
        id: 'qsl-50',
        title: 'Original Quaker Steak & Lube — 50 years',
        youtubeSearch: 'Quaker Steak Lube Sharon 50 years',
        youtubeId: null,
        url: 'https://www.youtube.com/results?search_query=Quaker+Steak+Lube+Sharon+50+years',
        blurb: 'Local news coverage of the original Sharon location.'
      }
    ]
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function api(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

function readMeta(page) {
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  return {
    title: page.title,
    thumbUrl: info.thumburl || info.url,
    license: stripHtml(meta.LicenseShortName?.value) || 'Unknown',
    licenseUrl: stripHtml(meta.LicenseUrl?.value),
    artist: stripHtml(meta.Artist?.value) || 'Unknown',
    descriptionUrl: info.descriptionurl,
    caption: stripHtml(meta.ImageDescription?.value).slice(0, 240)
  };
}

async function search(query, limit = 8) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH)
  });
  return (data.query?.pages || []).map(readMeta).filter(Boolean);
}

async function download(url, destination) {
  let wait = 1500;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, buffer);
      return buffer.length;
    }
    if (res.status !== 429 && res.status !== 503) throw new Error(`Download ${res.status}`);
    await sleep(wait);
    wait *= 2;
  }
  throw new Error(`Rate-limited: ${url}`);
}

async function pickLicensed(queries) {
  for (const query of queries) {
    const results = await search(query);
    await sleep(SLEEP_MS);
    const ok = results.find((r) => ALLOWED_LICENSE.test(r.license) && r.thumbUrl);
    if (ok) return { meta: ok, query };
  }
  return null;
}

async function resolveYoutubeIds() {
  // Keep known good IDs; leave search URLs for the rest (no unofficial scraping of YT API keys).
  const known = {
    'lettermen-way-you-look': null, // will try oEmbed discovery below
    'reznor-sax-1982': 'SiDAyGkC-LY'
  };
  // Probe a few classic Lettermen uploads via oEmbed (no API key)
  const probes = [
    { id: 'lettermen-way-you-look', urls: [
      'https://www.youtube.com/watch?v=YKk8QeZ5v5E',
      'https://www.youtube.com/watch?v=GKc3YfJk8o0',
      'https://www.youtube.com/watch?v=9bZkp7q19f0'
    ]},
    { id: 'lettermen-when-i-fall', urls: [
      'https://www.youtube.com/watch?v=0Vsy5KzsieQ',
      'https://www.youtube.com/watch?v=ihhEl-N3waE'
    ]}
  ];
  for (const probe of probes) {
    for (const url of probe.urls) {
      try {
        const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const res = await fetch(oembed, { headers: { 'User-Agent': UA } });
        if (!res.ok) continue;
        const data = await res.json();
        const m = String(url).match(/[?&]v=([\w-]{6,})/);
        if (m && data.title) {
          known[probe.id] = m[1];
          console.log(`✓ youtube ${probe.id} ← ${data.title.slice(0, 60)}`);
          break;
        }
      } catch (_) {
        /* try next */
      }
      await sleep(200);
    }
  }
  return known;
}

async function main() {
  await mkdir(ASSETS, { recursive: true });
  let credits = {};
  try {
    credits = JSON.parse(await readFile(CREDITS_PATH, 'utf8')).credits || {};
  } catch (_) {
    /* first run */
  }

  let downloaded = 0;
  let cached = 0;
  let missed = 0;
  const problems = [];

  for (const job of PHOTO_JOBS) {
    const dest = path.join(ASSETS, job.file.replace(/\//g, path.sep));
    const publicPath = `/nature/assets/shenango/${job.file}`;
    if (existsSync(dest)) {
      console.log(`· ${job.id.padEnd(22)} cached`);
      cached += 1;
      continue;
    }
    try {
      const hit = await pickLicensed(job.queries);
      if (!hit) {
        console.log(`✗ ${job.id.padEnd(22)} no licensed hit`);
        missed += 1;
        problems.push(job.id);
        continue;
      }
      await download(hit.meta.thumbUrl, dest);
      credits[job.id] = {
        image: publicPath,
        source: hit.meta.descriptionUrl,
        title: hit.meta.title,
        artist: hit.meta.artist,
        license: hit.meta.license,
        licenseUrl: hit.meta.licenseUrl,
        query: hit.query,
        caption: hit.meta.caption
      };
      console.log(`✓ ${job.id.padEnd(22)} ${hit.meta.license} ← ${hit.query}`);
      downloaded += 1;
    } catch (err) {
      console.log(`✗ ${job.id.padEnd(22)} ${err.message}`);
      missed += 1;
      problems.push(job.id);
    }
  }

  const ytKnown = await resolveYoutubeIds();
  for (const theme of Object.values(VIDEO_CATALOG.themes)) {
    for (const clip of theme) {
      if (ytKnown[clip.id]) {
        clip.youtubeId = ytKnown[clip.id];
        clip.url = `https://www.youtube.com/watch?v=${clip.youtubeId}`;
      }
    }
  }

  // Verify Reznor sax ID still resolves
  try {
    const url = 'https://www.youtube.com/watch?v=SiDAyGkC-LY';
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { 'User-Agent': UA } }
    );
    if (res.ok) {
      const data = await res.json();
      console.log(`✓ youtube reznor-sax-1982 ← ${String(data.title || '').slice(0, 60)}`);
    }
  } catch (_) {
    /* keep catalog id anyway */
  }

  await writeFile(
    CREDITS_PATH,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), credits }, null, 2)}\n`
  );
  await writeFile(VIDEOS_PATH, `${JSON.stringify(VIDEO_CATALOG, null, 2)}\n`);

  console.log(
    `\nshenango media: downloaded=${downloaded} cached=${cached} missed=${missed} problems=${problems.join(',') || 'none'}`
  );
  console.log(`credits → ${CREDITS_PATH}`);
  console.log(`videos  → ${VIDEOS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
