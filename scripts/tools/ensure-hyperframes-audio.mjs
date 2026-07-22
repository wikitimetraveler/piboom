/**
 * Fail if a HyperFrames project is missing real narration audio.
 *
 * Usage (from a video/* project dir, or pass --cwd):
 *   node scripts/tools/ensure-hyperframes-audio.mjs
 *   node scripts/tools/ensure-hyperframes-audio.mjs --cwd video/ice-rag
 *   node scripts/tools/ensure-hyperframes-audio.mjs --mp4 public/shared/assets/video/ice-rag-reel.mp4
 *
 * Checks:
 * 1) Every <audio src> in index.html exists under the project
 * 2) Each MP3 has duration >= minSeconds
 * 3) Each MP3 is not near-silent (ffprobe/ffmpeg volumedetect)
 * 4) Optional: published MP4 has an audio stream with audible level
 */
import { readFile, access } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const args = process.argv.slice(2);
function flagValue(name, fallback = null) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}

const cwd = path.resolve(flagValue('--cwd', process.cwd()));
const mp4Arg = flagValue('--mp4', null);
const minSeconds = Number(flagValue('--min-seconds', '1.5'));
const maxSilentMean = Number(flagValue('--max-silent-mean', '-45')); // dB; quieter fails

function run(bin, binArgs) {
  return execFileSync(bin, binArgs, { encoding: 'utf8' }).trim();
}

function probeDuration(filePath) {
  const out = run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath
  ]);
  const n = Number(out);
  if (!Number.isFinite(n)) throw new Error(`Could not read duration: ${filePath}`);
  return n;
}

function probeMeanVolume(filePath) {
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', filePath, '-af', 'volumedetect', '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'],
    { encoding: 'utf8' }
  );
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  const m = output.match(/mean_volume:\s*([-\d.]+)\s*dB/i);
  if (!m) throw new Error(`Could not measure volume: ${filePath}`);
  return Number(m[1]);
}

function hasAudioStream(filePath) {
  const out = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a',
    '-show_entries',
    'stream=codec_type',
    '-of',
    'csv=p=0',
    filePath
  ]);
  return /audio/i.test(out);
}

async function collectAudioSrcs(indexPath) {
  const html = await readFile(indexPath, 'utf8');
  const srcs = [];
  const re = /<audio\b[^>]*\bsrc=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html))) {
    srcs.push(match[1]);
  }
  return [...new Set(srcs)];
}

async function ensureProjectAudio(projectDir) {
  const indexPath = path.join(projectDir, 'index.html');
  await access(indexPath);
  const srcs = await collectAudioSrcs(indexPath);
  if (!srcs.length) {
    throw new Error(`${indexPath}: no <audio src> tags — HyperFrames reels must have narration`);
  }

  const problems = [];
  for (const src of srcs) {
    const filePath = path.resolve(projectDir, src);
    try {
      await access(filePath);
    } catch {
      problems.push(`missing: ${src}`);
      continue;
    }
    try {
      const duration = probeDuration(filePath);
      if (duration < minSeconds) {
        problems.push(`${src}: duration ${duration.toFixed(2)}s < ${minSeconds}s`);
      }
      const mean = probeMeanVolume(filePath);
      if (!(mean > maxSilentMean)) {
        problems.push(`${src}: near-silent mean_volume ${mean} dB (need > ${maxSilentMean} dB)`);
      } else {
        console.log(`OK  ${src}  ${duration.toFixed(2)}s  mean ${mean} dB`);
      }
    } catch (err) {
      problems.push(`${src}: ${err.message}`);
    }
  }

  if (problems.length) {
    throw new Error(`HyperFrames audio preflight failed for ${projectDir}:\n- ${problems.join('\n- ')}`);
  }
  console.log(`Audio preflight passed (${srcs.length} clips) in ${path.relative(ROOT, projectDir) || '.'}`);
}

async function ensurePublishedMp4(mp4Path) {
  const abs = path.isAbsolute(mp4Path)
    ? mp4Path
    : path.resolve(process.cwd(), mp4Path);
  await access(abs);
  if (!hasAudioStream(abs)) {
    throw new Error(`Published MP4 has no audio stream: ${abs}`);
  }
  const mean = probeMeanVolume(abs);
  if (!(mean > maxSilentMean)) {
    throw new Error(`Published MP4 near-silent (${mean} dB): ${abs}`);
  }
  console.log(`OK  published ${path.relative(ROOT, abs)}  mean ${mean} dB`);
}

try {
  await ensureProjectAudio(cwd);
  if (mp4Arg) await ensurePublishedMp4(mp4Arg);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
