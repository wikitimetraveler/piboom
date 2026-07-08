/**
 * Ingest Newport Pier walk video: MOV/MP4 → web MP4 + poster JPGs per stop.
 *
 * Usage:
 *   node scripts/tools/ingest-newport-pier-video.mjs --input "C:/path/IMG_0847.MOV"
 *   node scripts/tools/ingest-newport-pier-video.mjs --input walk.mp4 --posters-only
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'public/nature/assets/newport-pier');
const DATA_PATH = path.join(ROOT, 'data/newport-pier-fish.json');

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    throw new Error(`${cmd} failed (${r.status})`);
  }
}

async function loadCatalog() {
  return JSON.parse(await readFile(DATA_PATH, 'utf8'));
}

async function main() {
  const input = arg('--input');
  if (!input) {
    console.error('Usage: node scripts/tools/ingest-newport-pier-video.mjs --input <path> [--posters-only]');
    process.exit(1);
  }
  const inputPath = path.resolve(input);
  await mkdir(OUT_DIR, { recursive: true });
  const catalog = await loadCatalog();
  const outMp4 = path.join(OUT_DIR, 'walk.mp4');

  if (!hasFlag('--posters-only')) {
    console.log('Encoding web MP4 (720p, H.264, faststart)…');
    run('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=-2:720',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outMp4
    ]);
    console.log(`Wrote ${outMp4}`);
  }

  const videoSrc = hasFlag('--posters-only') ? outMp4 : outMp4;
  for (const stop of catalog.stops || []) {
    const posterFile = path.join(OUT_DIR, `stop-${stop.id}.jpg`);
    const t = Number(stop.timeSec) || 0;
    console.log(`Poster ${stop.id} @ ${t}s`);
    run('ffmpeg', [
      '-y',
      '-ss',
      String(t),
      '-i',
      videoSrc,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-q:v',
      '2',
      posterFile
    ]);
    stop.posterUrl = `/nature/assets/newport-pier/stop-${stop.id}.jpg`;
  }

  catalog.video = catalog.video || {};
  catalog.video.src = '/nature/assets/newport-pier/walk.mp4';
  if (catalog.stops?.[0]?.posterUrl) {
    catalog.video.poster = catalog.stops[0].posterUrl;
  }

  await writeFile(DATA_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Updated ${DATA_PATH}`);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
