/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Extract four diamond-layout portrait crops from the Lane Genealogies PDF plate p4-i0.jpg
 * (high-res page scan). Regions are hand-tuned against 1747×2620 — edit CROPS if the source changes.
 *
 * Usage: node scripts/tools/extract-lane-frontispiece-portraits.mjs
 *
 * Output: public/family/assets/lane-historians/portrait-*.jpg
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'family', 'assets', 'lane-historians');
const SOURCE = path.join(ROOT, 'public', 'family', 'assets', 'lane-pdf', 'p4-i0.jpg');

/** Regions in pixels on full p4-i0 scan (width 1747, height 2620). */
const CROPS = [
  { file: 'portrait-john-wm-lane.jpg', label: 'Rev. John Wm. Lane', left: 200, top: 320, width: 395, height: 480 },
  { file: 'portrait-jas-h-fitts.jpg', label: 'Rev. Jas. H. Fitts', left: 105, top: 920, width: 360, height: 430 },
  { file: 'portrait-geo-w-lane.jpg', label: 'Geo. W. Lane', left: 500, top: 915, width: 368, height: 430 },
  { file: 'portrait-dr-edwd-b-lane.jpg', label: 'Dr. Edward B. Lane', left: 195, top: 1670, width: 395, height: 470 }
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Missing source plate:', SOURCE);
    process.exit(1);
  }
  const sharp = (await import('sharp')).default;
  const meta = await sharp(SOURCE).metadata();
  console.log('Source:', SOURCE, `${meta.width}×${meta.height}`);

  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  for (const c of CROPS) {
    const outPath = path.join(OUT_DIR, c.file);
    await sharp(SOURCE)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .jpeg({ quality: 88 })
      .toFile(outPath);
    console.log('Wrote', path.relative(ROOT, outPath), `(${c.label})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
