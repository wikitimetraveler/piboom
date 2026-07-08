/**
 * Newport Pier HyperFrame reel — local narration + HyperFrames CLI render (no HeyGen).
 */
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import VoiceService from './voice.service.js';
import { loadNewportPierCatalog } from './newport-pier.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const VIDEO_PROJECT_DIR = path.join(ROOT, 'video/newport-pier');
export const RENDERS_DIR = path.join(VIDEO_PROJECT_DIR, 'renders');
export const NARRATION_DIR = path.join(VIDEO_PROJECT_DIR, 'assets/narration');
export const REEL_PUBLIC_PATH = path.join(ROOT, 'public/nature/assets/newport-pier/newport-pier-reel.mp4');
export const REEL_OUTPUT_URL = '/nature/assets/newport-pier/newport-pier-reel.mp4';
export const HYPERFRAMES_VERSION = '0.6.89';
export const DEFAULT_TTS_VOICE = 'en-US-Standard-D';

/** @type {{ status: string, phase?: string, message?: string, log?: string[], error?: string, code?: string, videoUrl?: string, startedAt?: string, finishedAt?: string }} */
let reelJob = { status: 'idle' };

/**
 * Build per-scene narration scripts (scene0 … sceneN) aligned with HyperFrame s0–s8.
 * @param {import('./newport-pier.service.js').loadNewportPierCatalog extends () => Promise<infer C> ? C : never} catalog
 */
export function buildReelNarrationScenes(catalog) {
  const stops = catalog?.stops || [];
  const fishCount = (catalog?.fish || []).length;
  const speciesLine = fishCount
    ? `${fishCount} species cataloged along Newport Pier — from surf perch to pelagics and bottom sharks.`
    : 'Nine species cataloged along Newport Pier — from surf perch to pelagics and bottom sharks.';

  return [
    {
      id: 'scene0',
      text:
        'Welcome to Newport Beach Pier — a classic Southern California rail where surf perch, mackerel, halibut, and more meet the sand. Let\'s walk the pier stop by stop.'
    },
    ...stops.map((stop, i) => ({
      id: `scene${i + 1}`,
      text: (stop.heygenScript || `${stop.label}.`).trim()
    })),
    {
      id: `scene${stops.length + 1}`,
      text: speciesLine
    },
    {
      id: `scene${stops.length + 2}`,
      text:
        'Open the pier guide at DevConnect Labs — freeze your walk, explore every species, and add optional avatar narration when you choose.'
    }
  ];
}

export async function latestRenderMp4(dir = RENDERS_DIR) {
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

/**
 * @param {object} catalog
 * @param {{ voice?: string, outDir?: string, synthesize?: (text: string, voice: string) => Promise<string|null> }} [opts]
 */
export async function writeReelNarration(catalog, opts = {}) {
  const scenes = buildReelNarrationScenes(catalog);
  const outDir = opts.outDir || NARRATION_DIR;
  const voice = opts.voice || DEFAULT_TTS_VOICE;
  await mkdir(outDir, { recursive: true });

  let synthesize = opts.synthesize;
  if (!synthesize) {
    const voiceService = new VoiceService();
    await voiceService.init();
    synthesize = (text, v) => voiceService.speakWithGoogle(text, v);
  }

  const files = [];
  for (const scene of scenes) {
    const audio = await synthesize(scene.text, voice);
    if (!audio) {
      const err = new Error(`TTS failed for ${scene.id}`);
      err.code = 'TTS_FAILED';
      throw err;
    }
    const file = path.join(outDir, `${scene.id}.mp3`);
    await writeFile(file, Buffer.from(audio, 'base64'));
    files.push(file);
  }
  return { sceneCount: scenes.length, files };
}

export function runHyperframesRender(cwd = VIDEO_PROJECT_DIR) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`, 'render'],
      { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      const err = new Error(stderr.trim() || stdout.trim() || `hyperframes render exited ${code}`);
      err.code = 'RENDER_FAILED';
      reject(err);
    });
  });
}

export async function copyLatestReelToPublic(dest = REEL_PUBLIC_PATH) {
  const src = await latestRenderMp4();
  if (!src) {
    const err = new Error(`No MP4 in ${RENDERS_DIR} — HyperFrames render produced no output`);
    err.code = 'NO_RENDER_OUTPUT';
    throw err;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
  return { src, dest, basename: path.basename(src) };
}

function pushLog(message) {
  reelJob.log = [...(reelJob.log || []), message].slice(-30);
}

/**
 * Full local pipeline: optional Google TTS narration → hyperframes render → copy to public.
 * @param {{ skipNarration?: boolean, onProgress?: (patch: object) => void }} [opts]
 */
export async function runReelRenderPipeline(opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const catalog = await loadNewportPierCatalog();
  let narrationSkipped = false;

  if (!opts.skipNarration) {
    onProgress({ phase: 'narration', message: 'Generating local narration (Google TTS)…' });
    try {
      const result = await writeReelNarration(catalog);
      onProgress({
        phase: 'narration',
        message: `Narration complete (${result.sceneCount} scenes).`
      });
    } catch (e) {
      narrationSkipped = true;
      onProgress({
        phase: 'narration',
        message: 'Narration skipped — render continues without new audio (set GOOGLE_APPLICATION_CREDENTIALS for TTS).'
      });
    }
  } else {
    narrationSkipped = true;
    onProgress({ phase: 'narration', message: 'Narration skipped by request.' });
  }

  onProgress({
    phase: 'render',
    message: 'Running HyperFrames CLI render (may take several minutes; needs ffmpeg).'
  });
  await runHyperframesRender();

  onProgress({ phase: 'copy', message: 'Publishing reel to public assets…' });
  const copied = await copyLatestReelToPublic();

  return {
    videoUrl: REEL_OUTPUT_URL,
    outputPath: copied.dest,
    renderSource: copied.src,
    narrationSkipped,
    publishedAt: new Date().toISOString()
  };
}

export function getReelRenderStatus() {
  return { ...reelJob };
}

/**
 * Start async reel render (dev/on-demand). Returns immediately; poll getReelRenderStatus().
 * @param {{ skipNarration?: boolean }} [opts]
 */
export function startReelRenderAsync(opts = {}) {
  if (reelJob.status === 'running') {
    const err = new Error('A HyperFrame reel render is already in progress');
    err.code = 'RENDER_IN_PROGRESS';
    throw err;
  }

  reelJob = {
    status: 'running',
    phase: 'starting',
    message: 'Queued local HyperFrame render…',
    log: [],
    startedAt: new Date().toISOString()
  };

  runReelRenderPipeline({
    skipNarration: !!opts.skipNarration,
    onProgress: (patch) => {
      reelJob = { ...reelJob, status: 'running', ...patch };
      if (patch.message) pushLog(patch.message);
    }
  })
    .then((result) => {
      reelJob = {
        status: 'complete',
        phase: 'complete',
        message: `Published ${REEL_OUTPUT_URL}`,
        videoUrl: result.videoUrl,
        narrationSkipped: result.narrationSkipped,
        finishedAt: new Date().toISOString(),
        log: reelJob.log
      };
    })
    .catch((e) => {
      reelJob = {
        status: 'failed',
        phase: 'failed',
        error: e.message,
        code: e.code || 'RENDER_FAILED',
        finishedAt: new Date().toISOString(),
        log: reelJob.log
      };
    });

  return { status: 'running', message: reelJob.message };
}

/** Reset job state (tests). */
export function resetReelRenderJob() {
  reelJob = { status: 'idle' };
}
