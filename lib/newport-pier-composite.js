/**
 * FFmpeg composite — pier walk + avatar PiP baked into one MP4.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  loadNewportPierCatalog,
  NEWPORT_PIER_DATA_PATH,
  validateClipUrl
} from '../services/newport-pier.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

export function publicPathFromUrl(webPath) {
  const s = String(webPath || '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) {
    return path.join(REPO_ROOT, 'public', s.replace(/^\//, '').replace(/\//g, path.sep));
  }
  return path.resolve(s);
}

function clipForStop(stop, clipUrl) {
  const url = clipUrl || stop.heygenVideoAlphaUrl || stop.heygenVideoUrl || null;
  if (!url) return null;
  return validateClipUrl(url);
}

export async function compositeStopVideo({
  stopId,
  clipUrl,
  avatarImageUrl,
  durationSec = 12
}) {
  const catalog = await loadNewportPierCatalog();
  const stop = catalog.stops?.find((s) => s.id === stopId);
  if (!stop) {
    const err = new Error(`Unknown stop: ${stopId}`);
    err.code = 'STOP_NOT_FOUND';
    throw err;
  }

  const walkPath = publicPathFromUrl(catalog.video?.src);
  if (!walkPath) {
    const err = new Error('Pier walk video is not configured');
    err.code = 'NO_WALK_VIDEO';
    throw err;
  }

  const avatarClip = clipForStop(stop, clipUrl);
  const imageUrl = avatarImageUrl ? validateClipUrl(avatarImageUrl) : null;
  if (!avatarClip && !imageUrl) {
    const err = new Error(
      'Need a HeyGen clip URL or avatar image URL to embed on the pier video'
    );
    err.code = 'NO_AVATAR_SOURCE';
    throw err;
  }

  const outDir = publicPathFromUrl('/nature/assets/newport-pier/composites');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${stopId}.mp4`);
  const outUrl = `/nature/assets/newport-pier/composites/${stopId}.mp4`;
  const start = Number(stop.timeSec) || 0;
  const dur = Math.max(3, Math.min(Number(durationSec) || 12, 120));

  let filter;
  let inputs;
  if (avatarClip) {
    const isAlpha = /\.webm(\?|$)/i.test(avatarClip);
    filter = isAlpha
      ? '[1:v]scale=280:-1,format=yuva420p[av];[0:v][av]overlay=main_w-overlay_w-24:main_h-overlay_h-24:shortest=1'
      : '[1:v]scale=280:-1[av];[0:v][av]overlay=main_w-overlay_w-24:main_h-overlay_h-24:shortest=1';
    inputs = ['-ss', String(start), '-i', walkPath, '-i', avatarClip];
  } else {
    filter =
      '[1:v]scale=200:200,format=rgba[av];[0:v][av]overlay=main_w-overlay_w-24:main_h-overlay_h-24';
    inputs = ['-ss', String(start), '-i', walkPath, '-loop', '1', '-i', imageUrl];
  }

  const args = [
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-t',
    String(dur),
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
    outPath
  ];

  const r = spawnSync('ffmpeg', args, { stdio: 'pipe', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    const detail = (r.stderr || r.stdout || Buffer.alloc(0)).toString().slice(-600);
    const err = new Error(`ffmpeg composite failed: ${detail}`);
    err.code = 'COMPOSITE_FAILED';
    throw err;
  }

  stop.compositeVideoUrl = outUrl;
  await writeFile(NEWPORT_PIER_DATA_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  return {
    stop,
    videoUrl: outUrl,
    outputPath: outPath,
    durationSec: dur
  };
}
