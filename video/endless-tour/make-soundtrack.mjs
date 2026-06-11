/**
 * Extract a ~92s ambient bed from an Internet Archive audience recording (Cornell 5/8/77).
 * Grateful Dead taper policy: non-commercial fan recordings only.
 *
 * Usage: node make-soundtrack.mjs
 * Requires ffmpeg on PATH.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const OUT_DIR = path.resolve('assets');
const OUT = path.join(OUT_DIR, 'soundtrack-bed.mp3');

/** First track of audience recording — instrumental tuning / crowd before vocals */
const IA_URL =
  'https://archive.org/download/gd1977-05-08.152379.aud.petrunis.flac2448/gd1977-05-08s1t01.mp3';

await mkdir(OUT_DIR, { recursive: true });

console.log('Downloading excerpt from Internet Archive (audience recording)...');
const r = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-ss',
    '120',
    '-t',
    '95',
    '-i',
    IA_URL,
    '-af',
    'volume=0.35,highpass=f=80,lowpass=f=8000',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-b:a',
    '128k',
    OUT
  ],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
);

if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status || 1);
}
console.log(`Wrote ${OUT}`);
