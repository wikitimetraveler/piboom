#!/usr/bin/env node
/**
 * Fetch Wikimedia Commons museum-mount photos for Dinosaur Hall species cards.
 * Writes thumbs to public/nature/assets/dinosaur/ and updates dinosaur-content.json.
 *
 *   node scripts/tools/fetch-dinosaur-photos.mjs
 *
 * Development work by David Lane
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'DevConnectLabs-DinosaurHall/1.0 (https://devconnectlabs.example; nature@devconnectlabs.example)';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public/nature/assets/dinosaur');
const CONTENT = path.join(ROOT, 'public/nature/data/dinosaur-content.json');
const CREDITS = path.join(ROOT, 'public/nature/data/dinosaur-photo-credits.json');

/** Preferred Commons File: titles (museum mounts / fossils). */
const FILES = {
  coelophysis: 'File:Coelophysis bauri mount.jpg',
  plateosaurus: 'File:Plateosaurus skeletal mount 02.jpg',
  herrerasaurus: 'File:FMNH Herrerasaurus skeleton.jpg',
  apatosaurus: 'File:Apatosaurus louisae - CM.jpg',
  stegosaurus: 'File:Stegosaurus skeleton at National Museum of Scotland.jpg',
  allosaurus: 'File:Allosaurus fragilis moulage MNHN paleontologie 1.JPG',
  brachiosaurus: 'File:World\'s tallest mounted dinosaur skeleton Brachiosaurus brancai.jpg',
  diplodocus: 'File:Diplodocus carnegii Natural History Museum London.jpg',
  tyrannosaurus: 'File:Tyrannosaurus rex (Senckenberg).jpg',
  triceratops: 'File:Triceratops from Boston Museum of Science.jpg',
  parasaurolophus: 'File:Parasaurolophus walkeri ROM.jpg',
  velociraptor: 'File:Velociraptor mongoliensis.jpg',
  ankylosaurus: 'File:Ankylosaurus magniventris NHM.jpg',
  pteranodon: 'File:Pteranodon longiceps YPM 1177.jpg',
  mosasaurus: 'File:Mosasaurus hoffmanni Maastricht.jpg'
};

const SEARCH = {
  coelophysis: 'Coelophysis bauri mount skeleton',
  plateosaurus: 'Plateosaurus skeletal mount',
  herrerasaurus: 'Herrerasaurus skeleton FMNH',
  apatosaurus: 'Apatosaurus louisae Carnegie',
  stegosaurus: 'Stegosaurus skeleton museum',
  allosaurus: 'Allosaurus fragilis skeleton mount',
  brachiosaurus: 'Brachiosaurus brancai mounted skeleton',
  diplodocus: 'Diplodocus carnegii mount museum',
  tyrannosaurus: 'Tyrannosaurus rex skeleton mount museum',
  triceratops: 'Triceratops skeleton museum mount',
  parasaurolophus: 'Parasaurolophus walkeri skeleton',
  velociraptor: 'Velociraptor mongoliensis fossil skeleton',
  ankylosaurus: 'Ankylosaurus skeleton mount',
  pteranodon: 'Pteranodon longiceps fossil mount',
  mosasaurus: 'Mosasaurus hoffmanni fossil skeleton'
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
  if (info.mime && !String(info.mime).startsWith('image/')) return null;
  const meta = info.extmetadata || {};
  return {
    title: page.title,
    thumbUrl: info.thumburl || info.url,
    artist: stripHtml(meta.Artist?.value) || 'Unknown',
    license: stripHtml(meta.LicenseShortName?.value) || 'Unknown',
    descriptionUrl: info.descriptionurl
  };
}

async function resolveTitle(title) {
  const data = await api({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800'
  });
  const page = data.query?.pages?.[0];
  if (!page || page.missing) return null;
  return readMeta(page);
}

async function searchFallback(query) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query} -Everest -Himalayas -map -svg -diagram`,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '800'
  });
  for (const page of data.query?.pages || []) {
    if (/everest|himalaya|\.svg|map of|diagram/i.test(page.title || '')) continue;
    const meta = readMeta(page);
    if (meta?.thumbUrl) return meta;
  }
  return null;
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
    if (res.status !== 429 && res.status !== 503) {
      throw new Error(`Download ${res.status} for ${url}`);
    }
    await sleep(wait);
    wait *= 2;
  }
  throw new Error(`Download rate-limited: ${url}`);
}

const content = JSON.parse(await readFile(CONTENT, 'utf8'));
const credits = {};
await mkdir(OUT_DIR, { recursive: true });

for (const sp of content.species) {
  let meta = await resolveTitle(FILES[sp.id]);
  if (!meta) {
    console.log('search', sp.id);
    meta = await searchFallback(SEARCH[sp.id] || sp.commonName);
  }
  if (!meta) {
    console.warn('MISS', sp.id);
    continue;
  }
  const extMatch = meta.thumbUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  let ext = (extMatch?.[1] || 'jpg').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp'].includes(ext)) ext = 'jpg';
  const localRel = `/nature/assets/dinosaur/${sp.id}.${ext}`;
  const localFs = path.join(ROOT, 'public', localRel.replace(/^\//, '').replace(/\//g, path.sep));
  const bytes = await download(meta.thumbUrl, localFs);
  sp.image = localRel;
  sp.imageCredit = `${meta.artist} · ${meta.license} · Wikimedia Commons`;
  credits[sp.id] = { ...meta, local: localRel, bytes };
  console.log('OK', sp.id, bytes, meta.title);
  await sleep(400);
}

await writeFile(CONTENT, `${JSON.stringify(content, null, 2)}\n`);
await writeFile(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
console.log(`done ${Object.keys(credits).length}/${content.species.length}`);
