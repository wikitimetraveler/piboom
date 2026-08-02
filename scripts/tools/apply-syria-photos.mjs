#!/usr/bin/env node
/**
 * Stamp fetched Commons photographs onto the Syria atlas content.
 *
 *   node scripts/tools/apply-syria-photos.mjs
 *
 * Reads data/syria-photo-manifest.json plus the credits written by
 * fetch-syria-photos.mjs, then sets `image` and `photoId` on the matching
 * era / site / food / music / hookah / living entry. Run it after any fetch.
 *
 * Development work by David Lane
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data/syria-photo-manifest.json');
const CREDITS_PATH = path.join(ROOT, 'public/syria/data/syria-photo-credits.json');
const CONTENT_PATH = path.join(ROOT, 'public/syria/data/syria-content.json');
const ASSET_ROOT = path.join(ROOT, 'public/syria/assets');

const SECTION_KEY = {
  era: 'eras',
  site: 'sites',
  food: 'foods',
  music: 'music',
  hookah: 'hookah',
  living: 'living'
};

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const credits = JSON.parse(await readFile(CREDITS_PATH, 'utf8')).credits || {};
const content = JSON.parse(await readFile(CONTENT_PATH, 'utf8'));

let applied = 0;
const problems = [];

for (const entry of manifest.photos) {
  const key = SECTION_KEY[entry.section];
  if (!key) continue;

  const credit = credits[entry.id];
  if (!credit) {
    problems.push(`${entry.id}: no credit recorded — run --fetch first`);
    continue;
  }
  const rel = `${entry.section}/${entry.id}.jpg`;
  if (!existsSync(path.join(ASSET_ROOT, rel))) {
    problems.push(`${entry.id}: ${rel} is missing on disk`);
    continue;
  }

  const targetId = entry.target || entry.id;
  const item = (content[key] || []).find((row) => row.id === targetId);
  if (!item) {
    problems.push(`${entry.id}: no ${key} entry with id "${targetId}"`);
    continue;
  }

  item.image = `/syria/assets/${rel}`;
  item.photoId = entry.id;
  applied += 1;
}

content.photoCredits = '/syria/data/syria-photo-credits.json';

await writeFile(CONTENT_PATH, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
console.log(`Applied ${applied} photographs to ${path.relative(ROOT, CONTENT_PATH)}`);

if (problems.length) {
  console.log('\nProblems:');
  for (const p of problems) console.log(`  ! ${p}`);
  process.exitCode = 1;
}
