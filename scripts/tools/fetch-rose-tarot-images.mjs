#!/usr/bin/env node
/**
 * Fetch public-domain Rider–Waite–Smith tarot scans into public/entertainment/assets/tarot/.
 *
 *   node scripts/tools/fetch-rose-tarot-images.mjs
 *   node scripts/tools/fetch-rose-tarot-images.mjs --force
 *
 * Development work by David Lane
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public/entertainment/assets/tarot');
const UA = 'DevConnectLabs-RoseTarot/1.0 (https://thelanefamily.us; local-dev)';
const WIDTH = 480;
const force = process.argv.includes('--force');

async function loadManifest() {
  const arcanaPath = path.join(ROOT, 'public/entertainment/js/astrology-arcana.js');
  await import(pathToFileURL(arcanaPath).href);
  const Arc = globalThis.AstrologyArcana;
  if (!Arc?.imageManifest) throw new Error('AstrologyArcana.imageManifest missing');
  return Arc.imageManifest();
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function downloadOne(entry) {
  const dest = path.join(ROOT, 'public', entry.local.replace(/^\//, ''));
  if (!force && (await exists(dest))) {
    process.stdout.write(`  skip ${entry.id}\n`);
    return { id: entry.id, status: 'skip' };
  }
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(entry.commonsFile)}?width=${WIDTH}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${entry.id}: ${res.status} ${entry.commonsFile}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) throw new Error(`${entry.id}: response too small (${buf.length})`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  process.stdout.write(`  ok ${entry.id} (${buf.length} bytes)\n`);
  return { id: entry.id, status: 'ok', bytes: buf.length };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const manifest = await loadManifest();
  await mkdir(OUT, { recursive: true });
  console.log(`Fetching ${manifest.length} tarot images → ${OUT}`);
  const credits = {
    attribution: 'Pamela Colman Smith / Rider–Waite–Smith deck (public domain). Scans via Wikimedia Commons.',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck',
    fetchedAt: new Date().toISOString(),
    cards: [],
  };
  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const entry of manifest) {
    try {
      const result = await downloadOne(entry);
      if (result.status === 'ok') ok += 1;
      else skip += 1;
      credits.cards.push({
        id: entry.id,
        file: entry.commonsFile,
        local: entry.local,
        status: result.status,
      });
    } catch (err) {
      fail += 1;
      console.error(`  FAIL ${entry.id}: ${err.message}`);
      credits.cards.push({ id: entry.id, file: entry.commonsFile, local: entry.local, status: 'fail', error: err.message });
    }
    await sleep(450);
  }
  await writeFile(path.join(OUT, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`);
  console.log(`Done. ok=${ok} skip=${skip} fail=${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
