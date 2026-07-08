/**
 * Post-process a green-screen HeyGen MP4 into a transparent WebM for PiP overlays.
 *
 * Usage:
 *   node scripts/tools/postprocess-heygen-pip.mjs --input clip.mp4
 *   node scripts/tools/postprocess-heygen-pip.mjs --input clip.mp4 --output clip-pip.webm --circle
 *   node scripts/tools/postprocess-heygen-pip.mjs --input clip.mp4 --key 0x00FF00
 *
 * Requires ffmpeg on PATH. Output is VP9 + alpha (yuva420p) for browser PiP.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
}

async function main() {
  const input = arg('--input');
  if (!input) {
    console.error(
      'Usage: node scripts/tools/postprocess-heygen-pip.mjs --input <greenscreen.mp4> [--output out.webm] [--key 0x00FF00] [--circle]'
    );
    process.exit(1);
  }

  const inputPath = path.resolve(input);
  const base = inputPath.replace(/\.[^.]+$/, '');
  const outputPath = path.resolve(arg('--output', `${base}-pip.webm`));
  const key = arg('--key', '0x00FF00');
  const circle = hasFlag('--circle');

  await mkdir(path.dirname(outputPath), { recursive: true });

  let vf = `chromakey=${key}:0.14:0.06,format=yuva420p`;
  if (circle) {
    vf += `,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-(W/2),Y-(H/2)),min(W,H)/2-2),alpha(X,Y),0)'`;
  }

  console.log(`Chromakey ${key}${circle ? ' + circle mask' : ''} → ${outputPath}`);
  run('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-vf',
    vf,
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '32',
    '-an',
    outputPath
  ]);
  console.log('Done. Use the .webm URL in Newport Pier HeyGen studio (Save URL).');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
