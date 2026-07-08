/**
 * Download fish plate images from Wikimedia Commons for Newport Pier catalog.
 * Usage: node scripts/tools/download-newport-pier-fish-images.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'public/nature/assets/newport-pier/fish');
const DATA_PATH = path.join(ROOT, 'data/newport-pier-fish.json');

const SPECIES = [
  { id: 'barred-surfperch', search: 'Barred Surfperch', file: 'Barred_Surfperch.jpg' },
  { id: 'california-corbina', search: 'Menticirrhus undulatus', file: 'California_corbina.JPG' },
  { id: 'pacific-mackerel', search: 'Scomber japonicus', file: 'Scomber_japonicus.png' },
  { id: 'pacific-sardine', search: 'Sardinops sagax', file: 'Pacific_sardine_(Sardinops_sagax)_01.jpg' },
  { id: 'pacific-bonito', search: 'Sarda chiliensis', file: 'Sarda_chiliensis.jpg' },
  { id: 'california-halibut', search: 'Paralichthys californicus', file: 'Halibut_300.jpg' },
  { id: 'white-seabass', search: 'Atractoscion nobilis', file: 'Atractoscion_nobilis_mspc096.jpg' },
  { id: 'shovelnose-guitarfish', search: 'Pseudobatos productus', file: 'Shovelnose_guitarfish.JPG' },
  { id: 'leopard-shark', search: 'Triakis semifasciata', file: 'Triakis_semifasciata_Gratwicke.jpg' }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function commonsThumb(search) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('generator', 'search');
  api.searchParams.set('gsrsearch', search);
  api.searchParams.set('gsrnamespace', '6');
  api.searchParams.set('gsrlimit', '5');
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url');
  api.searchParams.set('iiurlwidth', '800');
  api.searchParams.set('format', 'json');
  api.searchParams.set('origin', '*');

  const res = await fetch(api, {
    headers: { 'User-Agent': 'DevConnectLabs/1.0 (newport-pier-fish; educational)' }
  });
  const json = await res.json();
  const pages = json?.query?.pages || {};
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (url && !url.endsWith('.svg')) return { url, title: page.title };
  }
  return null;
}

async function download(url, dest) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DevConnectLabs/1.0 (newport-pier-fish; educational)' }
    });
    if (res.status === 429) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    return;
  }
  throw new Error(`Rate limited: ${url}`);
}

async function resolveImage(sp) {
  if (sp.file) {
    const direct = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(sp.file)}?width=800`;
    return { url: direct, title: `File:${sp.file.replace(/_/g, ' ')}` };
  }
  return commonsThumb(sp.search);
}

await mkdir(OUT_DIR, { recursive: true });
const catalog = JSON.parse(await readFile(DATA_PATH, 'utf8'));
const credits = [];

for (const sp of SPECIES) {
  let hit = await resolveImage(sp);
  if (!hit) hit = await commonsThumb(sp.search);
  if (!hit) {
    console.warn(`No image found for ${sp.id} (${sp.search})`);
    continue;
  }
  const ext = path.extname(new URL(hit.url).pathname) || '.jpg';
  const filename = `${sp.id}${ext.toLowerCase() === '.jpeg' ? '.jpg' : ext}`;
  const dest = path.join(OUT_DIR, filename);
  try {
    await download(hit.url, dest);
  } catch (e) {
    const fallback = await commonsThumb(sp.search);
    if (!fallback) throw e;
    await download(fallback.url, dest);
    hit = fallback;
  }
  await sleep(1500);
  const rel = `/nature/assets/newport-pier/fish/${filename}`;
  const fish = catalog.fish?.find((f) => f.id === sp.id);
  if (fish) {
    fish.imageUrl = rel;
    fish.imageCredit = `Wikimedia Commons: ${hit.title?.replace('File:', '') || sp.search}`;
  }
  credits.push({ id: sp.id, file: filename, source: hit.title });
  console.log(`${sp.id} ← ${hit.title}`);
}

await writeFile(DATA_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
await writeFile(
  path.join(OUT_DIR, 'CREDITS.json'),
  `${JSON.stringify({ license: 'See individual Wikimedia Commons file pages', images: credits }, null, 2)}\n`
);
console.log('Updated data/newport-pier-fish.json');
