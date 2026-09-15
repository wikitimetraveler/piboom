/**
 * HeyGen script builders for Rose — astrology parlor intro.
 * Development work by David Lane
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO_PATH = path.join(ROOT, 'data/rose-heygen-demo.json');

export const ROSE_DEMO_SHORT_SCRIPT = [
  "I'm Rose.",
  'This gold wheel is my deck — twelve signs, four elements, and twenty-two Major Arcana.',
  'Give me a birthday, or let me deal Sun, Cross, and Path.',
  'Playful tropical astrology, not the night sky — Carl keeps the dome.',
].join(' ');

export const ROSE_TITLE = 'Meet Rose';
export const ROSE_VOICE_LANGUAGE = 'English';
export const ROSE_VIDEO_LOCAL = '/entertainment/assets/video/astrology-rose-intro.mp4';
export const ROSE_PORTRAIT = 'public/entertainment/assets/rose-guide-portrait.png';
/** Google Cloud TTS voice for parlor fallback (warm female). */
export const ROSE_GOOGLE_VOICE = 'en-US-Neural2-F';

export function getRoseDemoShort() {
  return {
    lang: 'en',
    title: ROSE_TITLE,
    script: ROSE_DEMO_SHORT_SCRIPT,
    voiceLanguage: ROSE_VOICE_LANGUAGE,
    localPath: ROSE_VIDEO_LOCAL,
    aspectRatio: '16:9',
    motionPrompt: 'intimate nod, candlelit tarot reader speaking to camera, low expressiveness',
    expressiveness: 'low',
  };
}

export function loadRoseDemoCatalog() {
  if (!existsSync(DEMO_PATH)) return null;
  try {
    return JSON.parse(readFileSync(DEMO_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Disaster-style demo/briefing payload for Rose: spoken script + HeyGen ids for the parlor UI.
 */
export function getRoseDemoPayload() {
  const catalog = loadRoseDemoCatalog() || {};
  const short = getRoseDemoShort();
  const spokenScript = String(catalog.heygenScriptShort || short.script).trim();
  const videoLocal = catalog.heygenVideoLocalShort || short.localPath;
  const localAbs = path.join(ROOT, 'public', String(videoLocal).replace(/^\//, ''));
  return {
    id: catalog.id || 'astrology-rose-intro',
    spokenTitle: catalog.title || ROSE_TITLE,
    spokenScript,
    title: catalog.title || ROSE_TITLE,
    script: spokenScript,
    ctaLabel: catalog.ctaLabel || 'Ask Rose for a reading',
    ctaHref: catalog.ctaHref || '/entertainment/astrology.html?reading=1',
    heygenAvatarId: catalog.heygenAvatarId || catalog.avatar?.lookId || null,
    heygenVoiceId: catalog.heygenVoiceId || null,
    heygenVoiceName: catalog.heygenVoiceName || 'Rose',
    heygenVideoIdShort: catalog.heygenVideoIdShort || null,
    heygenVideoUrlShort: catalog.heygenVideoUrlShort || null,
    heygenVideoLocalShort: videoLocal,
    videoReady: Boolean(catalog.heygenVideoUrlShort) || existsSync(localAbs),
    googleVoice: ROSE_GOOGLE_VOICE,
    avatar: catalog.avatar || {
      name: 'Rose',
      portrait: '/entertainment/assets/rose-guide-portrait-256.png',
      source: '/entertainment/assets/rose-guide-portrait.png',
    },
    brand: catalog.brand || {
      attribution: 'Avatar narration powered by HeyGen',
      developmentBy: 'David E Lane',
    },
    generatedAt: catalog.generatedAt || null,
  };
}

/** Prefer a warm, intimate English female voice for Rose. */
export function pickRoseVoice(voices = []) {
  const scored = voices.map((v) => {
    const name = String(v.name || v.voice_name || '').toLowerCase();
    const gender = String(v.gender || v.sex || '').toLowerCase();
    const lang = String(v.language || v.locale || '').toLowerCase();
    const isFemale =
      gender.includes('female') || gender === 'woman' || gender === 'f' || /\bfemale\b/.test(name);
    let score = 0;
    if (!isFemale) score -= 100;
    else score += 12;
    if (lang.includes('english') || lang.startsWith('en')) score += 8;
    else score -= 20;
    if (/warm|soft|intimate|calm|gentle|husky|story|shanon/.test(name)) score += 6;
    if (/italian|spanish|french|german|japanese|chinese|korean|portuguese|hindi|arabic/.test(`${name} ${lang}`)) {
      score -= 25;
    }
    return {
      voiceId: v.voice_id || v.id,
      voiceName: v.name || v.voice_name || v.voice_id || v.id,
      score,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

export default {
  getRoseDemoShort,
  getRoseDemoPayload,
  loadRoseDemoCatalog,
  pickRoseVoice,
  ROSE_DEMO_SHORT_SCRIPT,
  ROSE_TITLE,
  ROSE_VIDEO_LOCAL,
  ROSE_GOOGLE_VOICE,
};
