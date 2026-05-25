/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Join data/lane-pdf-image-manifest.json with laneData.json sourceRefs (pdfPageNumber)
 * to produce data/lane-pdf-photo-candidates.json for review.
 *
 * Usage: node scripts/build-lane-pdf-photo-candidates.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LANE_DATA = path.join(ROOT, 'data', 'laneData.json');
const MANIFEST = path.join(ROOT, 'data', 'lane-pdf-image-manifest.json');
const OUT = path.join(ROOT, 'data', 'lane-pdf-photo-candidates.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function main() {
  if (!fs.existsSync(LANE_DATA)) {
    console.error('Missing', LANE_DATA);
    process.exit(1);
  }
  if (!fs.existsSync(MANIFEST)) {
    console.error('Missing', MANIFEST, '— run scripts/extract_lane_pdf_images.py first');
    process.exit(1);
  }

  const lane = loadJson(LANE_DATA);
  const nodes = Array.isArray(lane.nodes) ? lane.nodes : [];
  const pageToIds = new Map();

  for (const node of nodes) {
    const refs = node.sourceRefs;
    if (!Array.isArray(refs)) continue;
    const id = node.id;
    if (id == null) continue;
    for (const ref of refs) {
      const p = ref && ref.pdfPageNumber;
      if (p == null || !Number.isFinite(Number(p))) continue;
      const page = Number(p);
      if (!pageToIds.has(page)) pageToIds.set(page, new Set());
      pageToIds.get(page).add(Number(id));
    }
  }

  const manifest = loadJson(MANIFEST);
  const images = Array.isArray(manifest.images) ? manifest.images : [];

  const merged = [];
  for (const img of images) {
    const pdfPage = img.pdfPage;
    if (pdfPage == null) continue;
    const ids = pageToIds.has(pdfPage) ? Array.from(pageToIds.get(pdfPage)).sort((a, b) => a - b) : [];
    merged.push({
      ...img,
      candidatePersonIds: ids,
      ambiguous: ids.length > 1,
      candidateCount: ids.length
    });
  }

  const outDoc = {
    generatedAt: new Date().toISOString(),
    sourceManifest: 'data/lane-pdf-image-manifest.json',
    sourceLaneData: 'data/laneData.json',
    joinRule: 'candidatePersonIds = all node ids with any sourceRefs.pdfPageNumber === pdfPage (1-based)',
    stats: {
      manifestImages: images.length,
      okImages: images.filter((i) => i.status === 'ok' || !i.status).length,
      skippedImages: images.filter((i) => i.status === 'skipped').length,
      imagesWithAtLeastOneCandidate: merged.filter((m) => m.candidatePersonIds.length > 0).length
    },
    images: merged
  };

  fs.writeFileSync(OUT, JSON.stringify(outDoc, null, 2), 'utf-8');
  console.log(JSON.stringify({ ok: true, out: OUT, stats: outDoc.stats }, null, 2));
}

main();
