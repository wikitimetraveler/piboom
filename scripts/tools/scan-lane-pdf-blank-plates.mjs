/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Rank plate JPEGs by "blankness" using luminance variance (sharp).
 * Writes data/lane-pdf-blank-plate-candidates.json for human review.
 * Does NOT modify lane-pdf-gallery-hidden.json — editors merge IDs after review.
 *
 * Usage: npm run scan:lane-pdf-blanks
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const MANIFEST = path.join(ROOT, 'data', 'lane-pdf-image-manifest.json');
const OUT = path.join(ROOT, 'data', 'lane-pdf-blank-plate-candidates.json');
const ASSETS = path.join(ROOT, 'public', 'family', 'assets', 'lane-pdf');

/** Near-white paper with almost no ink: low std + high mean (halftone portraits stay higher-variance). */
const DEFAULT_BLANK_STDDEV_MAX = 2.6;
const DEFAULT_BLANK_MEAN_MIN = 232;

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch (e) {
    console.error('sharp is required: npm install sharp --save-dev');
    throw e;
  }
}

function stdDevUint8(buf) {
  const n = buf.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += buf[i];
  const mean = sum / n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = buf[i] - mean;
    v += d * d;
  }
  return Math.sqrt(v / n);
}

async function metricsForFile(sharp, absPath) {
  const { data, info } = await sharp(absPath)
    .resize({ width: 320, height: 320, fit: 'inside' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stdLuma = stdDevUint8(data);
  const meanLuma = data.length ? data.reduce((a, b) => a + b, 0) / data.length : 0;
  return {
    width: info.width,
    height: info.height,
    meanLuma: Math.round(meanLuma * 100) / 100,
    stdLuma: Math.round(stdLuma * 100) / 100
  };
}

async function main() {
  const blankStdMax = Number(process.env.LANE_PDF_BLANK_STDDEV_MAX || DEFAULT_BLANK_STDDEV_MAX);
  const blankMeanMin = Number(process.env.LANE_PDF_BLANK_MEAN_MIN || DEFAULT_BLANK_MEAN_MIN);
  const sharp = await loadSharp();
  if (!fs.existsSync(MANIFEST)) {
    console.error('Missing manifest:', MANIFEST);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  const rows = [];

  for (const img of images) {
    if (!img || img.status !== 'ok' || !img.imageId) continue;
    const fileName = img.fileName || `${img.imageId}.jpg`;
    const abs = path.join(ASSETS, fileName);
    if (!fs.existsSync(abs)) {
      rows.push({
        imageId: img.imageId,
        pdfPage: img.pdfPage,
        fileName,
        error: 'file_missing',
        stdLuma: null
      });
      continue;
    }
    try {
      const m = await metricsForFile(sharp, abs);
      rows.push({
        imageId: img.imageId,
        pdfPage: img.pdfPage,
        imageIndex: img.imageIndex,
        fileName,
        publicUrl: img.publicUrl,
        ...m,
        isLikelyBlank: m.stdLuma <= blankStdMax && m.meanLuma >= blankMeanMin
      });
    } catch (e) {
      rows.push({
        imageId: img.imageId,
        pdfPage: img.pdfPage,
        fileName,
        error: String(e?.message || e),
        stdLuma: null
      });
    }
  }

  rows.sort((a, b) => (a.stdLuma ?? 999) - (b.stdLuma ?? 999));
  const doc = {
    generatedAt: new Date().toISOString(),
    sourceManifest: 'data/lane-pdf-image-manifest.json',
    blankStdDevMax: blankStdMax,
    blankMeanMin,
    notes:
      'isLikelyBlank = stdLuma<=blankStdDevMax AND meanLuma>=blankMeanMin (near-white, very flat). Tune env LANE_PDF_BLANK_STDDEV_MAX / LANE_PDF_BLANK_MEAN_MIN. Review before merging into lane-pdf-gallery-hidden.json.',
    candidateCount: rows.filter((r) => r.isLikelyBlank).length,
    images: rows
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2), 'utf-8');
  console.log('Wrote', OUT, 'rows=', rows.length, 'likelyBlank=', doc.candidateCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
