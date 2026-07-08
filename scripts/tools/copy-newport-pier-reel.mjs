/**
 * Copy latest HyperFrame render to public/nature/assets/newport-pier/newport-pier-reel.mp4
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RENDERS = path.join(ROOT, 'video/newport-pier/renders');
const OUT_DIR = path.join(ROOT, 'public/nature/assets/newport-pier');
const OUT_FILE = path.join(OUT_DIR, 'newport-pier-reel.mp4');

async function latestMp4(dir) {
  let files = [];
  try {
    files = await readdir(dir);
  } catch {
    return null;
  }
  const mp4s = files.filter((f) => f.toLowerCase().endsWith('.mp4'));
  if (!mp4s.length) return null;
  const ranked = await Promise.all(
    mp4s.map(async (name) => {
      const full = path.join(dir, name);
      const s = await stat(full);
      return { full, mtime: s.mtimeMs };
    })
  );
  ranked.sort((a, b) => b.mtime - a.mtime);
  return ranked[0].full;
}

const src = await latestMp4(RENDERS);
if (!src) {
  console.error(`No MP4 in ${RENDERS} — run: npm run render:newport-pier-reel`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
await copyFile(src, OUT_FILE);
console.log(`Copied ${path.basename(src)} → ${OUT_FILE}`);
