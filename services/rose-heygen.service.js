/**
 * HeyGen script builders for Rose — astrology parlor intro (en / vi).
 * Development work by David Lane
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO_PATH = path.join(ROOT, 'data/rose-heygen-demo.json');

export const ROSE_LANGS = ['en', 'vi'];

export const ROSE_DEMO_SHORT_SCRIPT = [
  "I'm Rose.",
  'This gold wheel is my deck — twelve signs, four elements, and a full seventy-eight-card tarot.',
  'I teach how to shuffle, draw, and read — give me a birthday, or flip a card.',
  'Playful tropical astrology, not the night sky — Carl keeps the dome.',
].join(' ');

export const ROSE_DEMO_SHORT_SCRIPT_VI = [
  'Tôi là Rose.',
  'Bánh xe vàng này là bộ bài của tôi — mười hai cung, bốn nguyên tố, và bảy mươi tám lá tarot.',
  'Tôi dạy cách xáo, rút, và đọc — cho tôi ngày sinh, hoặc lật một lá.',
  'Chiêm tinh nhiệt đới vui vẻ, không phải bầu trời đêm — Carl giữ mái vòm.',
].join(' ');

export const ROSE_TITLE = {
  en: 'Meet Rose',
  vi: 'Gặp Rose',
};

export const ROSE_VOICE_LANGUAGE = {
  en: 'English',
  vi: 'Vietnamese',
};

export const ROSE_VIDEO_LOCAL = {
  en: '/entertainment/assets/video/astrology-rose-intro.mp4',
  vi: '/entertainment/assets/video/astrology-rose-intro-vi.mp4',
};

export const ROSE_CTA = {
  en: 'Ask Rose for a reading',
  vi: 'Nhờ Rose đọc bài',
};

export const ROSE_PORTRAIT = 'public/entertainment/assets/rose-guide-portrait.png';
/** Google Cloud TTS voice for parlor fallback (warm female). */
export const ROSE_GOOGLE_VOICE = {
  en: 'en-US-Neural2-F',
  vi: 'vi-VN-Neural2-A',
};

/** @deprecated use ROSE_TITLE.en — kept for older imports */
export const ROSE_TITLE_VI = ROSE_TITLE.vi;
/** @deprecated use ROSE_GOOGLE_VOICE.en */
export const ROSE_GOOGLE_VOICE_EN = ROSE_GOOGLE_VOICE.en;
/** @deprecated use ROSE_GOOGLE_VOICE.vi */
export const ROSE_GOOGLE_VOICE_VI = ROSE_GOOGLE_VOICE.vi;

function normalizeLang(lang) {
  const code = String(lang || 'en').toLowerCase().slice(0, 2);
  return ROSE_LANGS.includes(code) ? code : 'en';
}

export function getRoseDemoShort(lang = 'en') {
  const code = normalizeLang(lang);
  const script = code === 'vi' ? ROSE_DEMO_SHORT_SCRIPT_VI : ROSE_DEMO_SHORT_SCRIPT;
  return {
    lang: code,
    title: ROSE_TITLE[code],
    script,
    voiceLanguage: ROSE_VOICE_LANGUAGE[code],
    localPath: ROSE_VIDEO_LOCAL[code],
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
 * @param {{lang?: string}} [opts]
 */
export function getRoseDemoPayload(opts = {}) {
  const lang = normalizeLang(opts.lang);
  const catalog = loadRoseDemoCatalog() || {};
  const short = getRoseDemoShort(lang);
  const spokenScriptEn = String(catalog.heygenScriptShort || ROSE_DEMO_SHORT_SCRIPT).trim();
  const spokenScriptVi = String(catalog.heygenScriptShortVi || ROSE_DEMO_SHORT_SCRIPT_VI).trim();
  const spokenScript = lang === 'vi' ? spokenScriptVi : spokenScriptEn;

  const videoLocal =
    lang === 'vi'
      ? catalog.heygenVideoLocalShortVi || ROSE_VIDEO_LOCAL.vi
      : catalog.heygenVideoLocalShort || ROSE_VIDEO_LOCAL.en;
  const videoUrl =
    lang === 'vi' ? catalog.heygenVideoUrlShortVi || null : catalog.heygenVideoUrlShort || null;
  const videoId =
    lang === 'vi' ? catalog.heygenVideoIdShortVi || null : catalog.heygenVideoIdShort || null;
  const localAbs = path.join(ROOT, 'public', String(videoLocal).replace(/^\//, ''));
  const localReady = Boolean(videoLocal) && existsSync(localAbs);
  const videoReady = Boolean(videoUrl) || localReady;

  const voiceId =
    lang === 'vi'
      ? catalog.heygenVoiceIdVi || catalog.heygenVoiceId || null
      : catalog.heygenVoiceId || null;
  const voiceName =
    lang === 'vi'
      ? catalog.heygenVoiceNameVi || catalog.heygenVoiceName || 'Rose'
      : catalog.heygenVoiceName || 'Rose';

  const title =
    lang === 'vi' ? catalog.titleVi || ROSE_TITLE.vi : catalog.title || ROSE_TITLE.en;
  const ctaLabel =
    lang === 'vi' ? catalog.ctaLabelVi || ROSE_CTA.vi : catalog.ctaLabel || ROSE_CTA.en;

  return {
    id: catalog.id || 'astrology-rose-intro',
    lang,
    spokenTitle: title,
    spokenScript,
    spokenScriptEn,
    spokenScriptVi,
    title,
    script: spokenScript,
    ctaLabel,
    ctaHref: catalog.ctaHref || '/entertainment/astrology.html?reading=1',
    heygenAvatarId: catalog.heygenAvatarId || catalog.avatar?.lookId || null,
    heygenVoiceId: voiceId,
    heygenVoiceName: voiceName,
    heygenVideoIdShort: videoId,
    heygenVideoUrlShort: videoUrl,
    heygenVideoLocalShort: videoLocal,
    /** Never play another language's intro MP4. */
    allowIntroVideo: videoReady,
    videoReady,
    googleVoice: ROSE_GOOGLE_VOICE[lang],
    avatar: catalog.avatar || {
      name: 'Rose',
      portrait: '/entertainment/assets/rose-guide-portrait-256.png',
      source: '/entertainment/assets/rose-guide-portrait.png',
    },
    brand: catalog.brand || {
      attribution: 'Avatar narration powered by HeyGen',
      developmentBy: 'David E Lane',
    },
    generatedAt:
      lang === 'vi' ? catalog.generatedAtVi || null : catalog.generatedAt || null,
  };
}

/**
 * Prefer a warm intimate female voice in the requested language.
 * Rose is always female — never return a male voice.
 * @param {Array<object>} voices
 * @param {string} [lang='en']
 */
export function pickRoseVoice(voices = [], lang = 'en') {
  const code = normalizeLang(lang);
  const wanted = ROSE_VOICE_LANGUAGE[code].toLowerCase();

  const scored = (voices || [])
    .map((v) => {
      const name = String(v.name || v.voice_name || '').toLowerCase();
      const gender = String(v.gender || v.sex || '').toLowerCase();
      const voiceLang = `${v.language || ''} ${v.locale || ''}`.toLowerCase();
      const isFemale =
        gender === 'f' ||
        gender === 'female' ||
        gender === 'woman' ||
        /\bfemale\b/.test(gender) ||
        /\bfemale\b/.test(name);
      if (!isFemale) return null;

      const langOk =
        voiceLang.includes(wanted) ||
        (code === 'en' && (voiceLang.includes('english') || voiceLang.startsWith('en'))) ||
        (code === 'vi' && (voiceLang.includes('vietnam') || voiceLang.includes('vi-vn') || /\bvi\b/.test(voiceLang)));
      if (!langOk) return null;

      let score = 12;
      if (/warm|soft|intimate|calm|gentle|husky|story|shanon|friendly|natural|huyen|ngan/.test(name)) {
        score += 6;
      }
      if (/child|kid|teen|robot|whisper|angry|shout/.test(name)) score -= 8;
      return {
        voiceId: v.voice_id || v.id,
        voiceName: v.name || v.voice_name || v.voice_id || v.id,
        score,
      };
    })
    .filter((v) => v && v.voiceId)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

export default {
  getRoseDemoShort,
  getRoseDemoPayload,
  loadRoseDemoCatalog,
  pickRoseVoice,
  ROSE_LANGS,
  ROSE_DEMO_SHORT_SCRIPT,
  ROSE_DEMO_SHORT_SCRIPT_VI,
  ROSE_TITLE,
  ROSE_TITLE_VI,
  ROSE_VIDEO_LOCAL,
  ROSE_VOICE_LANGUAGE,
  ROSE_GOOGLE_VOICE,
  ROSE_GOOGLE_VOICE_EN,
  ROSE_GOOGLE_VOICE_VI,
};
