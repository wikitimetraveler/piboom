/**
 * Fetch venue photos for HyperFrames plates.
 * Uses Wikipedia pageimages + direct upload.wikimedia.org URLs (Commons API rate-limits aggressively).
 *
 * Usage: node fetch-venue-images.mjs
 */
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('assets/venues');
const UA = 'DevConnectLabs/1.0 (endless-tour video)';
const DELAY_MS = 2500;

/** @type {{ out: string, wikiTitle?: string, directUrl?: string, iaUrl?: string }[]} */
const SOURCES = [
  { out: 'fillmore.jpg', wikiTitle: 'Fillmore_West' },
  { out: 'be-in.jpg', wikiTitle: 'Golden_Gate_Park' },
  { out: 'veneta.jpg', wikiTitle: 'Veneta,_Oregon' },
  { out: 'winterland.jpg', wikiTitle: 'Winterland_Ballroom' },
  {
    out: 'barton-hall.jpg',
    directUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Barton_Hall_from_Schoellkopf_Field.jpg/1280px-Barton_Hall_from_Schoellkopf_Field.jpg'
  },
  {
    out: 'giza.jpg',
    directUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Great_Pyramid_of_Giza.jpg/1280px-Great_Pyramid_of_Giza.jpg'
  },
  {
    out: 'alpine-valley.jpg',
    directUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/01/Atreyu_at_Alpine_Valley_Music_Theatre_in_East_Troy_2006.jpg'
  },
  { out: 'soldier-field.jpg', wikiTitle: 'Soldier_Field' }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isJpeg(buf) {
  return buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function wikiThumb(title) {
  const api =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pithumbsize=1280&titles=' +
    encodeURIComponent(title);
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wiki API ${res.status}`);
  const json = await res.json();
  const page = Object.values(json?.query?.pages || {})[0];
  const url = page?.thumbnail?.source;
  if (!url) throw new Error(`No image on ${title}`);
  return url;
}

await mkdir(OUT, { recursive: true });

for (const src of SOURCES) {
  const dest = path.join(OUT, src.out);
  try {
    let url = src.directUrl;
    if (!url && src.wikiTitle) url = await wikiThumb(src.wikiTitle);
    if (!url && src.iaUrl) url = src.iaUrl;
    if (!url) throw new Error('No source URL');

    const buf = await download(url);
    if (!isJpeg(buf)) throw new Error('Not a JPEG');
    await writeFile(dest, buf);
    console.log(`OK ${src.out} (${buf.length} bytes)`);
  } catch (e) {
    console.warn(`Skip ${src.out}: ${e.message}`);
    try {
      await unlink(dest);
    } catch {
      /* ignore */
    }
  }
  await sleep(DELAY_MS);
}

console.log('Done. cornell-ticket.jpg is fetched separately from Internet Archive.');
