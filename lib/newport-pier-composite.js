/**
 * FFmpeg composite — pier walk + avatar PiP baked into one MP4.
 */
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  loadNewportPierCatalog,
  NEWPORT_PIER_DATA_PATH,
  clipFieldsFromUrl,
  mergeStopSave,
  validateClipUrl
} from '../services/newport-pier.service.js';
import { getHeygenRegistryEntry } from '../services/heygen-library.service.js';
import { getVideoStatus, heygenConfigured } from '../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
export const CLIPS_WEB_DIR = '/nature/assets/newport-pier/clips';

export function publicPathFromUrl(webPath) {
  const s = String(webPath || '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) {
    return path.join(REPO_ROOT, 'public', s.replace(/^\//, '').replace(/\//g, path.sep));
  }
  return path.resolve(s);
}

export function extFromUrl(url) {
  const base = String(url).split('?')[0].toLowerCase();
  if (base.endsWith('.webm')) return '.webm';
  if (base.endsWith('.mp4')) return '.mp4';
  if (base.endsWith('.jpg') || base.endsWith('.jpeg')) return '.jpg';
  if (base.endsWith('.png')) return '.png';
  return '.bin';
}

export function localClipWebPath(stopId, ext = '.webm') {
  return `${CLIPS_WEB_DIR}/${stopId}${ext}`;
}

export async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function downloadMedia(url, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent': 'DevConnectLabs/1.0 (ffmpeg composite)',
      Accept: '*/*'
    },
    redirect: 'follow'
  });
  if (!res.ok) {
    const err = new Error(
      `Could not download clip (${res.status}). HeyGen links expire — re-generate the clip or use a cached copy under ${CLIPS_WEB_DIR}/.`
    );
    err.code = 'CLIP_DOWNLOAD_FAILED';
    err.status = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Download remote media or resolve site/local paths for ffmpeg (avoids Windows shell & in signed URLs). */
export async function resolveMediaInput(urlOrPath, { fetchImpl = globalThis.fetch } = {}) {
  const s = String(urlOrPath || '').trim();
  if (!s) return { path: null, cleanupDir: null };
  if (/^https?:\/\//i.test(s)) {
    const cleanupDir = await mkdtemp(path.join(tmpdir(), 'np-composite-'));
    const local = path.join(cleanupDir, `input${extFromUrl(s)}`);
    await writeFile(local, await downloadMedia(s, fetchImpl));
    return { path: local, cleanupDir };
  }
  const localPath = s.startsWith('/') ? publicPathFromUrl(s) : path.resolve(s);
  if (!(await fileExists(localPath))) {
    const err = new Error(`Media file not found: ${s}`);
    err.code = 'CLIP_NOT_FOUND';
    throw err;
  }
  return { path: localPath, cleanupDir: null };
}

export async function refreshHeygenClipUrl(stopId, videoId) {
  if (!heygenConfigured()) return null;
  let vid = videoId;
  if (!vid) {
    const entry = await getHeygenRegistryEntry(`nature-pier-${stopId}`);
    vid = entry?.videoId;
  }
  if (!vid) return null;
  const data = await getVideoStatus(vid);
  if (data?.status === 'completed' && data?.video_url) {
    return { videoUrl: data.video_url, videoId: vid };
  }
  return null;
}

/** Prefer cached local clip, then fresh HeyGen URL, then stored URL. */
export async function resolveClipSource({ stopId, clipUrl, videoId }) {
  const ext = extFromUrl(clipUrl || '.webm');
  const cachedWeb = localClipWebPath(stopId, ext);
  const cachedFs = publicPathFromUrl(cachedWeb);
  if (await fileExists(cachedFs)) {
    return { url: cachedWeb, source: 'cached-local' };
  }
  if (clipUrl?.startsWith('/')) {
    const siteFs = publicPathFromUrl(clipUrl);
    if (await fileExists(siteFs)) {
      return { url: clipUrl, source: 'site-path' };
    }
  }
  const refreshed = await refreshHeygenClipUrl(stopId, videoId);
  if (refreshed?.videoUrl) {
    return { url: refreshed.videoUrl, source: 'heygen-refresh', videoId: refreshed.videoId };
  }
  if (clipUrl) return { url: clipUrl, source: 'stored-url' };
  return { url: null, source: 'none' };
}

export async function cacheClipForStop({ stopId, clipUrl, videoId, fetchImpl = globalThis.fetch }) {
  const resolved = await resolveClipSource({ stopId, clipUrl, videoId });
  let sourceUrl = resolved.url;
  if (!sourceUrl) {
    const err = new Error('No clip URL available to cache');
    err.code = 'NO_AVATAR_SOURCE';
    throw err;
  }
  if (resolved.source === 'cached-local' || resolved.source === 'site-path') {
    return { localClipUrl: sourceUrl, stop: null, cached: false };
  }
  const ext = extFromUrl(sourceUrl);
  const localWeb = localClipWebPath(stopId, ext);
  const localFs = publicPathFromUrl(localWeb);
  await mkdir(path.dirname(localFs), { recursive: true });
  const buf = await downloadMedia(sourceUrl, fetchImpl);
  await writeFile(localFs, buf);

  const catalog = await loadNewportPierCatalog();
  const fields = clipFieldsFromUrl(localWeb);
  const result = mergeStopSave(catalog, {
    stopId,
    heygenVideoUrl: fields.heygenVideoUrl,
    heygenVideoAlphaUrl: fields.heygenVideoAlphaUrl
  });
  await writeFile(NEWPORT_PIER_DATA_PATH, `${JSON.stringify(result.catalog, null, 2)}\n`, 'utf8');
  return { localClipUrl: localWeb, stop: result.stop, cached: true };
}

function clipForStop(stop, clipUrl) {
  const url = clipUrl || stop.heygenVideoAlphaUrl || stop.heygenVideoUrl || null;
  if (!url) return null;
  return validateClipUrl(url);
}

function runFfmpeg(args) {
  const r = spawnSync('ffmpeg', args, { stdio: 'pipe', shell: false, windowsHide: true });
  if (r.status !== 0) {
    const detail = (r.stderr || r.stdout || Buffer.alloc(0)).toString().slice(-600);
    const err = new Error(`ffmpeg composite failed: ${detail}`);
    err.code = 'COMPOSITE_FAILED';
    throw err;
  }
}

export async function compositeStopVideo({
  stopId,
  clipUrl,
  avatarImageUrl,
  videoId,
  durationSec = 12,
  fetchImpl = globalThis.fetch
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

  const storedClip = clipForStop(stop, clipUrl);
  const imageUrl = avatarImageUrl ? validateClipUrl(avatarImageUrl) : null;
  if (!storedClip && !imageUrl) {
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

  const cleanups = [];
  try {
    let filter;
    let inputs;
    if (storedClip) {
      const { url: avatarClip } = await resolveClipSource({
        stopId,
        clipUrl: storedClip,
        videoId
      });
      if (!avatarClip) {
        const err = new Error('No clip available for this stop');
        err.code = 'NO_AVATAR_SOURCE';
        throw err;
      }
      let clipPath;
      let cleanupDir = null;
      try {
        const resolved = await resolveMediaInput(avatarClip, { fetchImpl });
        clipPath = resolved.path;
        cleanupDir = resolved.cleanupDir;
      } catch (e) {
        if (e.code === 'CLIP_DOWNLOAD_FAILED' && heygenConfigured()) {
          const refreshed = await refreshHeygenClipUrl(stopId, videoId);
          if (refreshed?.videoUrl) {
            const retry = await resolveMediaInput(refreshed.videoUrl, { fetchImpl });
            clipPath = retry.path;
            cleanupDir = retry.cleanupDir;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
      if (cleanupDir) cleanups.push(cleanupDir);
      if (/^https?:\/\//i.test(avatarClip)) {
        try {
          await cacheClipForStop({ stopId, clipUrl: avatarClip, videoId, fetchImpl });
        } catch {
          /* bake can still succeed without persisting cache */
        }
      }
      const isAlpha = /\.webm(\?|$)/i.test(avatarClip);
      filter = isAlpha
        ? '[1:v]scale=280:-1,format=yuva420p[av];[0:v][av]overlay=main_w-overlay_w-24:main_h-overlay_h-24:shortest=1'
        : '[1:v]scale=280:-1[av];[0:v][av]overlay=main_w-overlay_w-24:main_h-overlay_h-24:shortest=1';
      inputs = ['-ss', String(start), '-i', walkPath, '-i', clipPath];
    } else {
      const { path: imgPath, cleanupDir } = await resolveMediaInput(imageUrl, { fetchImpl });
      if (cleanupDir) cleanups.push(cleanupDir);
      filter =
        '[1:v]scale=200:200,format=rgba[av];[0:v][av]overlay=main_w-overlay_w-24:main_h-overlay_h-24';
      inputs = ['-ss', String(start), '-i', walkPath, '-loop', '1', '-i', imgPath];
    }

    runFfmpeg([
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
    ]);
  } finally {
    await Promise.all(cleanups.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
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
