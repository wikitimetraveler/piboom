/**
 * HeyGen script builders for the Syria atlas — Niqula guide popup, bilingual (en / ar).
 * Scripts stay in sync with public/syria/js/syria-i18n.js voices and
 * data/syria-heygen-demo.json. Arabic copy is Syrian-leaning Modern Standard.
 * Development work by David Lane
 */

export const NIQULA_LANGS = ['en', 'ar'];

/** ~25s guide popup — the clip the page plays before the highlight reel. */
export const NIQULA_DEMO_SHORT_SCRIPT = {
  en: [
    "Ahlan wa sahlan — I'm Niqula, your guide to Syria.",
    "In a few minutes we'll go from Ugarit's alphabet to Zenobia's Palmyra,",
    'then to a plate of kibbeh and the qudud of Aleppo.',
    'Press play on the highlight reel, or just ask me a question.'
  ].join(' '),
  ar: [
    'أهلاً وسهلاً — أنا نقولا، دليلك إلى سوريا.',
    'في دقائق ننتقل من أبجدية أوغاريت إلى تدمر زنوبيا،',
    'ثم إلى طبق كبّة وقدود حلب.',
    'شغّل الجولة المصوّرة، أو اسألني مباشرة.'
  ].join(' ')
};

/** ~45s full intro — manual paste / longer render, not used by the popup. */
export const NIQULA_INTRO_SCRIPT = {
  en: [
    'Welcome to Syria at DevConnect Labs.',
    "I'm Niqula. This page reads one country through four lenses: time, place, food, and sound.",
    'The timeline runs from the first Euphrates villages to the republic.',
    "The map pins the sites those eras left behind — Damascus, Aleppo, Palmyra, Ugarit.",
    'The kitchen explains why Aleppo counts its kibbeh in dozens of shapes.',
    'And the music section tracks the oud, the qudud, and a wedding dabke in the Jazira.',
    'Every panel speaks — in English or in Arabic. Pick your language and start anywhere.'
  ].join(' '),
  ar: [
    'أهلاً بكم في صفحة سوريا من DevConnect Labs.',
    'أنا نقولا. هذه الصفحة تقرأ بلداً واحداً بأربع عدسات: الزمن، المكان، الطعام، والصوت.',
    'الخط الزمني يمتد من أولى قرى الفرات إلى الجمهورية.',
    'والخريطة تُثبّت المواقع التي تركتها تلك العصور — دمشق، حلب، تدمر، أوغاريت.',
    'والمطبخ يشرح لماذا تعدّ حلب كبّتها بعشرات الأشكال.',
    'وقسم الموسيقى يتابع العود والقدود ودبكة العرس في الجزيرة.',
    'كل لوحة هنا تتكلّم — بالعربية أو بالإنجليزية. اختر لغتك وابدأ من أي مكان.'
  ].join(' ')
};

export const NIQULA_TITLE = {
  en: 'Syria — Meet Niqula',
  ar: 'سوريا — تعرّف على نقولا'
};

/** HeyGen voice language label (v3 `language` field) per page language. */
export const NIQULA_VOICE_LANGUAGE = {
  en: 'English',
  ar: 'Arabic'
};

/** Local MP4 slot per language — the page HEADs these before offering the player. */
export const NIQULA_VIDEO_LOCAL = {
  en: '/syria/assets/video/syria-niqula-intro.mp4',
  ar: '/syria/assets/video/syria-niqula-intro-ar.mp4'
};

function normalizeLang(lang) {
  const code = String(lang || 'en').slice(0, 2).toLowerCase();
  return NIQULA_LANGS.includes(code) ? code : 'en';
}

export function getNiqulaDemoShort(lang = 'en') {
  const code = normalizeLang(lang);
  return {
    lang: code,
    title: NIQULA_TITLE[code],
    script: NIQULA_DEMO_SHORT_SCRIPT[code],
    voiceLanguage: NIQULA_VOICE_LANGUAGE[code],
    localPath: NIQULA_VIDEO_LOCAL[code],
    aspectRatio: '16:9'
  };
}

export function getNiqulaIntro(lang = 'en') {
  const code = normalizeLang(lang);
  return {
    lang: code,
    title: NIQULA_TITLE[code],
    script: NIQULA_INTRO_SCRIPT[code],
    voiceLanguage: NIQULA_VOICE_LANGUAGE[code],
    aspectRatio: '16:9'
  };
}

/**
 * Score HeyGen voices for Niqula: right language first, then a warm male guide read.
 * @param {Array<object>} voices - from listVoices()
 * @param {string} lang - 'en' | 'ar'
 * @returns {{ voiceId: string, voiceName: string, score: number } | null}
 */
export function pickNiqulaVoice(voices, lang = 'en') {
  const code = normalizeLang(lang);
  const wantedLanguage = NIQULA_VOICE_LANGUAGE[code].toLowerCase();

  const scored = (voices || [])
    .map((v) => {
      const name = String(v.name || v.voice_name || '').trim();
      const gender = String(v.gender || '').toLowerCase().trim();
      const language = `${v.language || ''} ${v.locale || ''}`.toLowerCase();
      if (!language.includes(wantedLanguage)) return null;

      const isFemale =
        gender === 'f' || gender === 'female' || gender === 'woman' || /\bfemale\b/.test(gender);
      const isMale =
        !isFemale && (gender === 'm' || gender === 'male' || gender === 'man' || /\bmale\b/.test(gender));
      if (isFemale) return null;

      let score = 10;
      if (isMale) score += 8;
      if (/niqula|nicholas|nick|arabic|levant|warm|narrator|guide|story/i.test(name)) score += 4;
      if (/idris|omar|karim|hassan|male/i.test(name)) score += 2;
      return { voiceId: v.voice_id || v.id, voiceName: name || v.voice_id || v.id, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

export default {
  NIQULA_LANGS,
  NIQULA_DEMO_SHORT_SCRIPT,
  NIQULA_INTRO_SCRIPT,
  NIQULA_TITLE,
  NIQULA_VOICE_LANGUAGE,
  NIQULA_VIDEO_LOCAL,
  getNiqulaDemoShort,
  getNiqulaIntro,
  pickNiqulaVoice
};
