/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Merge likely-blank + ambiguous (multi-candidate) plate IDs into
 * data/lane-pdf-gallery-hidden.json.
 * Protects curated book-illustration plates and person portraits.
 *
 * Usage: node scripts/tools/merge-lane-pdf-blank-hides.mjs
 * Optional: LANE_PDF_BLANK_STDDEV_MAX / LANE_PDF_BLANK_MEAN_MIN (defaults match scan)
 * Optional: --no-ambiguous to skip multi-candidate suppression
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const BLANK = path.join(ROOT, 'data', 'lane-pdf-blank-plate-candidates.json');
const CANDIDATES = path.join(ROOT, 'data', 'lane-pdf-photo-candidates.json');
const BOOK = path.join(ROOT, 'data', 'lane-pdf-book-illustrations.json');
const PORTRAITS = path.join(ROOT, 'data', 'lane-pdf-person-portraits.json');
const OUT = path.join(ROOT, 'data', 'lane-pdf-gallery-hidden.json');

/** Always keep (historians composite / frontispiece crop source). */
const ALWAYS_KEEP = new Set(['p4-i0']);

function load(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function protectedPlateIds() {
  const keep = new Set(ALWAYS_KEEP);
  try {
    const book = load(BOOK);
    for (const ill of book.illustrations || []) {
      for (const id of ill.plateImageIds || []) {
        if (id) keep.add(String(id).trim());
      }
    }
  } catch {
    /* optional */
  }
  try {
    const portraits = load(PORTRAITS);
    for (const p of portraits.portraits || []) {
      if (p?.imageId) keep.add(String(p.imageId).trim());
    }
  } catch {
    /* optional */
  }
  return keep;
}

function isExtractedOk(img) {
  if (!img || img.status === 'skipped') return false;
  if (img.status === 'ok') return true;
  return Boolean(img.publicUrl && (img.fileName || /\.jpg$/i.test(String(img.publicUrl))));
}

function main() {
  const includeAmbiguous = !process.argv.includes('--no-ambiguous');
  if (!fs.existsSync(BLANK)) {
    console.error('Missing', BLANK, '— run npm run scan:lane-pdf-blanks first');
    process.exit(1);
  }

  const blankDoc = load(BLANK);
  const stdMax = Number(process.env.LANE_PDF_BLANK_STDDEV_MAX || blankDoc.blankStdDevMax || 2.6);
  const meanMin = Number(process.env.LANE_PDF_BLANK_MEAN_MIN || blankDoc.blankMeanMin || 232);
  const keep = protectedPlateIds();

  let prev = { version: 2, hiddenImageIds: [] };
  if (fs.existsSync(OUT)) prev = load(OUT);

  const fromScan = (blankDoc.images || [])
    .filter((row) => {
      if (!row?.imageId) return false;
      if (row.isLikelyBlank === true) return true;
      if (row.stdLuma == null || row.meanLuma == null) return false;
      return row.stdLuma <= stdMax && row.meanLuma >= meanMin;
    })
    .map((row) => String(row.imageId).trim())
    .filter((id) => id && !keep.has(id));

  let fromAmbiguous = [];
  if (includeAmbiguous && fs.existsSync(CANDIDATES)) {
    const candDoc = load(CANDIDATES);
    fromAmbiguous = (candDoc.images || [])
      .filter((img) => {
        if (!isExtractedOk(img) || !img.imageId) return false;
        const n = Array.isArray(img.candidatePersonIds) ? img.candidatePersonIds.length : 0;
        return img.ambiguous === true || n > 1;
      })
      .map((img) => String(img.imageId).trim())
      .filter((id) => id && !keep.has(id));
  }

  const merged = [
    ...new Set([...(prev.hiddenImageIds || []).map(String), ...fromScan, ...fromAmbiguous])
  ]
    .filter((id) => /^p\d+-i\d+$/.test(id) && !keep.has(id))
    .sort((a, b) => {
      const pa = Number(a.match(/^p(\d+)/)?.[1] || 0);
      const pb = Number(b.match(/^p(\d+)/)?.[1] || 0);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });

  const out = {
    version: 4,
    notes:
      'Blank / near-blank + ambiguous (multi-person page match) suppressions. ' +
      'Curated book-illustration and person-portrait plate IDs are never denylisted. ' +
      `Blank thresholds: stdLuma<=${stdMax} AND meanLuma>=${meanMin}. ` +
      'Ambiguous = candidatePersonIds.length > 1 in lane-pdf-photo-candidates.json.',
    protectedSkipped: [...keep].sort(),
    hiddenImageIds: merged
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf-8');
  const prevSet = new Set((prev.hiddenImageIds || []).map(String));
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: OUT,
        hiddenCount: merged.length,
        addedFromBlankScan: fromScan.filter((id) => !prevSet.has(id)).length,
        addedFromAmbiguous: fromAmbiguous.filter((id) => !prevSet.has(id)).length,
        protectedCount: keep.size,
        includeAmbiguous
      },
      null,
      2
    )
  );
}

main();
