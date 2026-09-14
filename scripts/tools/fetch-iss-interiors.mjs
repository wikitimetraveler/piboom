/**
 * Download NASA public-domain ISS interior stills for the station world.
 *
 * Usage:
 *   npm run fetch:iss-interiors
 *   npm run fetch:iss-interiors -- --force
 *
 * Writes public/planetarium/assets/station/interiors/*.jpg
 * and data/planetarium/iss-interior-credits.json
 * Development work by David Lane
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'public/planetarium/assets/station/interiors');
const CREDITS = path.join(ROOT, 'data/planetarium/iss-interior-credits.json');
const FORCE = process.argv.includes('--force');
const MAX_EDGE = 1600;

const ASSETS = [
  {
    id: 'destiny',
    nasaId: 'iss007e11800',
    file: 'destiny.jpg',
    title: 'View into the Destiny laboratory',
    credit: 'NASA — iss007e11800',
  },
  {
    id: 'harmony',
    nasaId: 'iss018e013808',
    file: 'harmony.jpg',
    title: 'Node 2 crew quarters maintenance',
    credit: 'NASA — iss018e013808',
  },
  {
    id: 'columbus',
    nasaId: 'iss023e048576',
    file: 'columbus.jpg',
    title: 'ERNObox installation in Columbus',
    credit: 'NASA — iss023e048576',
  },
  {
    id: 'kibo',
    nasaId: 'iss038e000257',
    file: 'kibo.jpg',
    title: 'Station view including Kibo / Cupola vicinity',
    credit: 'NASA — iss038e000257',
  },
  {
    id: 'cupola',
    nasaId: 'iss042e099123',
    file: 'cupola.jpg',
    title: 'Interior view from Cupola',
    credit: 'NASA — iss042e099123 (ISS042-E-099123)',
  },
  {
    id: 'zvezda',
    nasaId: 'iss010e24914',
    file: 'zvezda.jpg',
    title: 'Interior view of Zvezda Service Module',
    credit: 'NASA — iss010e24914',
  },
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveMediumUrl(nasaId) {
  const collectionUrl = `https://images-assets.nasa.gov/image/${nasaId}/collection.json`;
  const res = await fetch(collectionUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'piBoom-iss-interiors/1.0' },
  });
  if (!res.ok) throw new Error(`collection ${nasaId} HTTP ${res.status}`);
  const list = await res.json();
  const medium = list.find((u) => String(u).includes('~medium.jpg'));
  const large = list.find((u) => String(u).includes('~large.jpg'));
  const pick = medium || large || list.find((u) => String(u).endsWith('.jpg'));
  if (!pick) throw new Error(`no jpg for ${nasaId}`);
  return String(pick).replace(/^http:/, 'https:');
}

async function downloadOne(asset) {
  const out = path.join(OUT_DIR, asset.file);
  if (!FORCE && (await exists(out))) {
    console.log('skip', asset.file);
    return { ...asset, path: `/planetarium/assets/station/interiors/${asset.file}`, skipped: true };
  }
  const url = await resolveMediumUrl(asset.nasaId);
  const res = await fetch(url, { headers: { 'User-Agent': 'piBoom-iss-interiors/1.0' } });
  if (!res.ok) throw new Error(`${asset.nasaId} download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const jpeg = await sharp(buf)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(out, jpeg);
  console.log('wrote', asset.file, Math.round(jpeg.length / 1024) + 'KB');
  return {
    ...asset,
    path: `/planetarium/assets/station/interiors/${asset.file}`,
    sourceUrl: url,
    bytes: jpeg.length,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];
  for (const asset of ASSETS) {
    results.push(await downloadOne(asset));
  }
  const credits = {
    fetchedAt: new Date().toISOString(),
    policy: 'NASA public domain (US Government work) unless otherwise noted.',
    guide: 'https://www.nasa.gov/wp-content/uploads/2017/09/np-2015-05-022-jsc-iss-guide-2015-update-111015-508c.pdf',
    assets: results.map((row) => ({
      id: row.id,
      nasaId: row.nasaId,
      file: row.file,
      path: row.path,
      title: row.title,
      credit: row.credit,
      sourceUrl: row.sourceUrl || null,
    })),
  };
  await writeFile(CREDITS, JSON.stringify(credits, null, 2) + '\n');
  console.log('Wrote', CREDITS);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { ASSETS, resolveMediumUrl };
