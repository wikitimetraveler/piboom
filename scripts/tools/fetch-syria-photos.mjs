#!/usr/bin/env node
/**
 * Syria atlas photography — search Wikimedia Commons and cache freely licensed images.
 *
 *   node scripts/tools/fetch-syria-photos.mjs --search "Krak des Chevaliers"
 *   node scripts/tools/fetch-syria-photos.mjs --fetch            (reads the manifest)
 *   node scripts/tools/fetch-syria-photos.mjs --fetch --only palmyra,ugarit
 *
 * Only public-domain and CC (BY / BY-SA / CC0) files are accepted; anything else is
 * skipped loudly. Credits are written to public/syria/data/syria-photo-credits.json
 * so the page can attribute every photograph it shows.
 *
 * Development work by David Lane
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'DevConnectLabs-SyriaAtlas/1.0 (https://devconnectlabs.example; dev@devconnectlabs.example)';
const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, 'public/syria/assets');
const MANIFEST_PATH = path.join(ROOT, 'data/syria-photo-manifest.json');
const CREDITS_PATH = path.join(ROOT, 'public/syria/data/syria-photo-credits.json');
const THUMB_WIDTH = 1000;

const ALLOWED_LICENSE = /^(cc0|cc[- ]?by([- ]?sa)?([- ]?\d(\.\d)?)?|public domain|pd\b|no restrictions)/i;

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
  if (!res.ok) throw new Error(`Commons API ${res.status} for ${url.search}`);
  return res.json();
}

function readMeta(page) {
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  return {
    title: page.title,
    thumbUrl: info.thumburl || info.url,
    width: info.width,
    height: info.height,
    mime: info.mime,
    artist: stripHtml(meta.Artist?.value) || 'Unknown',
    credit: stripHtml(meta.Credit?.value),
    license: stripHtml(meta.LicenseShortName?.value) || 'Unknown',
    licenseUrl: stripHtml(meta.LicenseUrl?.value),
    descriptionUrl: info.descriptionurl,
    caption: stripHtml(meta.ImageDescription?.value).slice(0, 240)
  };
}

async function search(query, limit = 6) {
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

async function fileInfo(title) {
  const data = await api({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH)
  });
  const page = (data.query?.pages || [])[0];
  if (!page || page.missing) throw new Error(`Not found on Commons: ${title}`);
  return readMeta(page);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Commons throttles bulk pulls hard; back off on 429/503 rather than dropping the file. */
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
    if (res.status !== 429 && res.status !== 503) throw new Error(`Download ${res.status} for ${url}`);
    await sleep(wait);
    wait *= 2;
  }
  throw new Error(`Download rate-limited after 5 attempts: ${url}`);
}

async function runSearch(queries) {
  for (const query of queries) {
    console.log(`\n=== ${query}`);
    const results = await search(query);
    if (!results.length) console.log('  (no results)');
    for (const r of results) {
      const ok = ALLOWED_LICENSE.test(r.license) ? ' ' : '✗';
      console.log(`  ${ok} ${r.title}`);
      console.log(`      ${r.license} | ${r.artist.slice(0, 70)} | ${r.width}x${r.height}`);
    }
  }
}

async function runFetch(only, { force = false } = {}) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const wanted = only ? new Set(only.split(',').map((s) => s.trim())) : null;
  const credits = {};
  const problems = [];
  let existingCredits = {};
  try {
    existingCredits = JSON.parse(await readFile(CREDITS_PATH, 'utf8')).credits || {};
  } catch (_) {
    /* first run */
  }

  for (const entry of manifest.photos) {
    if (wanted && !wanted.has(entry.id)) continue;
    if (!force && existingCredits[entry.id] && existsSync(path.join(ASSET_ROOT, `${entry.section}/${entry.id}.jpg`))) {
      console.log(`· ${entry.id.padEnd(26)} cached`);
      continue;
    }
    try {
      const meta = await fileInfo(entry.file);
      if (!ALLOWED_LICENSE.test(meta.license)) {
        problems.push(`${entry.id}: license "${meta.license}" not accepted (${entry.file})`);
        continue;
      }
      const rel = `${entry.section}/${entry.id}.jpg`;
      const bytes = await download(meta.thumbUrl, path.join(ASSET_ROOT, rel));
      credits[entry.id] = {
        path: `/syria/assets/${rel}`,
        section: entry.section,
        title: meta.title,
        artist: meta.artist,
        license: meta.license,
        licenseUrl: meta.licenseUrl,
        source: meta.descriptionUrl
      };
      console.log(`✓ ${entry.id.padEnd(26)} ${(bytes / 1024).toFixed(0)}kB  ${meta.license}`);
      await sleep(700);
    } catch (error) {
      problems.push(`${entry.id}: ${error.message}`);
    }
  }

  if (Object.keys(credits).length) {
    const merged = { ...existingCredits, ...credits };
    const ordered = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
    await writeFile(
      CREDITS_PATH,
      `${JSON.stringify(
        {
          source: 'Wikimedia Commons',
          note: 'Every photograph on the Syria atlas is public domain or Creative Commons; the page credits each one.',
          generatedAt: new Date().toISOString(),
          credits: ordered
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    console.log(`\nCredits written: ${CREDITS_PATH}`);
  }

  if (problems.length) {
    console.log('\nProblems:');
    for (const p of problems) console.log(`  ! ${p}`);
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
if (args[0] === '--search') {
  await runSearch(args.slice(1));
} else if (args[0] === '--fetch') {
  const onlyIndex = args.indexOf('--only');
  await runFetch(onlyIndex > -1 ? args[onlyIndex + 1] : null, { force: args.includes('--force') });
} else {
  console.log('Usage: --search "query" [...] | --fetch [--only id,id] [--force]');
}
