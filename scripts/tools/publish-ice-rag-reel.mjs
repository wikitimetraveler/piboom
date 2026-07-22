/**
 * Narrate → ensure audio → render → publish ice-rag HyperFrames reel.
 * Always refuses to publish without audible narration.
 *
 *   node scripts/tools/publish-ice-rag-reel.mjs
 *   node scripts/tools/publish-ice-rag-reel.mjs --skip-narration   # reuse existing MP3s
 */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROJECT = path.join(ROOT, 'video/ice-rag');
const RENDERS = path.join(PROJECT, 'renders');
const PUBLIC_MP4 = path.join(ROOT, 'public/shared/assets/video/ice-rag-reel.mp4');
const skipNarration = process.argv.includes('--skip-narration');

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function latestMp4() {
  const names = (await readdir(RENDERS).catch(() => [])).filter((n) => n.endsWith('.mp4'));
  if (!names.length) return null;
  const withTime = await Promise.all(
    names.map(async (name) => {
      const full = path.join(RENDERS, name);
      const { mtimeMs } = await import('node:fs/promises').then((fs) => fs.stat(full));
      return { full, mtimeMs };
    })
  );
  withTime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return withTime[0].full;
}

if (!skipNarration) {
  console.log('→ narration (Google TTS)');
  await run('npm', ['run', 'narration'], PROJECT);
} else {
  console.log('→ skipping narration (reusing MP3s)');
}

console.log('→ ensure-audio (project clips)');
await run('npm', ['run', 'ensure-audio'], PROJECT);

console.log('→ hyperframes render');
await run('npm', ['run', 'render:raw'], PROJECT);

const src = await latestMp4();
if (!src) throw new Error('No MP4 in video/ice-rag/renders after render');
await mkdir(path.dirname(PUBLIC_MP4), { recursive: true });
await copyFile(src, PUBLIC_MP4);
console.log(`→ published ${path.relative(ROOT, PUBLIC_MP4)}`);

console.log('→ ensure-audio (published MP4)');
await run(
  'node',
  [
    path.join(ROOT, 'scripts/tools/ensure-hyperframes-audio.mjs'),
    '--cwd',
    PROJECT,
    '--mp4',
    PUBLIC_MP4
  ],
  ROOT
);

console.log('Done — reel has audible narration.');
