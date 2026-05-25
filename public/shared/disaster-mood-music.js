/**
 * Development work by David Lane
 */
/**
 * Ambient mood music for disaster AI chat panels.
 * Plays local MP3s from music/disasters/ via /api/audio/stream/.
 */
import { MUTE_STORAGE_KEY, resolveTrack } from '../../lib/disaster-mood-music.js';

const DEFAULT_VOLUME = 0.35;

let currentAudio = null;
let currentTrackPath = null;

function streamUrl(relativePath) {
  return `/api/audio/stream/${encodeURIComponent(relativePath)}`;
}

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted) {
  try {
    if (muted) {
      localStorage.setItem(MUTE_STORAGE_KEY, '1');
      stop();
    } else {
      localStorage.removeItem(MUTE_STORAGE_KEY);
    }
  } catch (_) {}
}

export function toggleMuted() {
  const next = !isMuted();
  setMuted(next);
  return next;
}

export function stop() {
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.onerror = null;
  } catch (_) {}
  currentAudio = null;
  currentTrackPath = null;
}

/**
 * @param {object|null|undefined} disaster
 * @param {{ loop?: boolean, volume?: number }} [options]
 */
export async function playForDisaster(disaster, options = {}) {
  if (isMuted()) return false;

  const { relativePath } = resolveTrack(disaster);
  const loop = options.loop !== false;
  const volume = typeof options.volume === 'number' ? options.volume : DEFAULT_VOLUME;
  const url = streamUrl(relativePath);

  if (currentAudio && currentTrackPath === relativePath && !currentAudio.paused) {
    return true;
  }

  stop();

  const audio = new Audio(url);
  audio.loop = loop;
  audio.volume = volume;
  currentAudio = audio;
  currentTrackPath = relativePath;

  try {
    await audio.play();
    return true;
  } catch (err) {
    console.warn('Disaster mood music could not play:', relativePath, err.message);
    stop();
    return false;
  }
}

export { resolveTrack, MUTE_STORAGE_KEY };

if (typeof window !== 'undefined') {
  window.DisasterMoodMusic = {
    resolveTrack,
    playForDisaster,
    stop,
    isMuted,
    setMuted,
    toggleMuted,
    MUTE_STORAGE_KEY,
  };
}
