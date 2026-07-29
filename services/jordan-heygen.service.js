/**
 * Development work by David Lane
 */
/**
 * HeyGen script builders for the Jordan atlas — Rami guide popup, bilingual (en / ar).
 * Scripts stay in sync with public/jordan/js/jordan-i18n.js voices and
 * data/jordan-heygen-demo.json. Arabic copy is Jordanian-leaning Modern Standard.
 */

export const RAMI_LANGS = ['en', 'ar'];

/** ~25s guide popup — the clip the page plays before the highlight reel. */
export const RAMI_DEMO_SHORT_SCRIPT = {
  en: [
    "Ahlan wa sahlan — I'm Rami, your guide to Jordan.",
    "In a few minutes we'll go from the plaster faces of Ain Ghazal to Petra's water channels,",
    'then to a tray of mansaf and a dabke line that never really ends.',
    'Press play on the highlight reel, or just ask me a question.'
  ].join(' '),
  ar: [
    'أهلاً وسهلاً — أنا رامي، دليلك إلى الأردن.',
    'في دقائق ننتقل من وجوه الجصّ في عين غزال إلى قنوات الماء في البتراء،',
    'ثم إلى صينية منسف وصفّ دبكة لا ينتهي.',
    'شغّل الجولة المصوّرة، أو اسألني مباشرة.'
  ].join(' ')
};

/** ~45s full intro — manual paste / longer render, not used by the popup. */
export const RAMI_INTRO_SCRIPT = {
  en: [
    'Welcome to Jordan at DevConnect Labs.',
    "I'm Rami. This page reads one country through four lenses: time, place, food, and sound.",
    'The timeline runs from Ain Ghazal to the Hashemite Kingdom.',
    'The map pins the sites those eras left behind — Petra, Jerash, Umm ar-Rasas, Wadi Rum.',
    'The kitchen explains why mansaf is a treaty and not just a dish.',
    'And the music section tracks dabke, the rababa, and the Bedouin line into modern Amman.',
    'Every panel speaks — in English or in Arabic. Pick your language and start anywhere.'
  ].join(' '),
  ar: [
    'أهلاً بكم في صفحة الأردن من DevConnect Labs.',
    'أنا رامي. هذه الصفحة تقرأ بلداً واحداً بأربع عدسات: الزمن، المكان، الطعام، والصوت.',
    'الخط الزمني يمتد من عين غزال إلى المملكة الهاشمية.',
    'والخريطة تُثبّت المواقع التي تركتها تلك العصور — البتراء، جرش، أم الرصاص، وادي رم.',
    'والمطبخ يشرح لماذا المنسف معاهدة وليس مجرد طبق.',
    'وقسم الموسيقى يتابع الدبكة والربابة والخط البدوي حتى عمّان الحديثة.',
    'كل لوحة هنا تتكلّم — بالعربية أو بالإنجليزية. اختر لغتك وابدأ من أي مكان.'
  ].join(' ')
};

export const RAMI_TITLE = {
  en: 'Jordan — Meet Rami',
  ar: 'الأردن — تعرّف على رامي'
};

/** HeyGen voice language label (v3 `language` field) per page language. */
export const RAMI_VOICE_LANGUAGE = {
  en: 'English',
  ar: 'Arabic'
};

/** Local MP4 slot per language — the page HEADs these before offering the player. */
export const RAMI_VIDEO_LOCAL = {
  en: '/jordan/assets/video/jordan-rami-intro.mp4',
  ar: '/jordan/assets/video/jordan-rami-intro-ar.mp4'
};

function normalizeLang(lang) {
  const code = String(lang || 'en').slice(0, 2).toLowerCase();
  return RAMI_LANGS.includes(code) ? code : 'en';
}

export function getRamiDemoShort(lang = 'en') {
  const code = normalizeLang(lang);
  return {
    lang: code,
    title: RAMI_TITLE[code],
    script: RAMI_DEMO_SHORT_SCRIPT[code],
    voiceLanguage: RAMI_VOICE_LANGUAGE[code],
    localPath: RAMI_VIDEO_LOCAL[code],
    aspectRatio: '16:9'
  };
}

export function getRamiIntro(lang = 'en') {
  const code = normalizeLang(lang);
  return {
    lang: code,
    title: RAMI_TITLE[code],
    script: RAMI_INTRO_SCRIPT[code],
    voiceLanguage: RAMI_VOICE_LANGUAGE[code],
    aspectRatio: '16:9'
  };
}

/**
 * Score HeyGen voices for Rami: right language first, then a warm male guide read.
 * @param {Array<object>} voices - from listVoices()
 * @param {string} lang - 'en' | 'ar'
 * @returns {{ voiceId: string, voiceName: string, score: number } | null}
 */
export function pickRamiVoice(voices, lang = 'en') {
  const code = normalizeLang(lang);
  const wantedLanguage = RAMI_VOICE_LANGUAGE[code].toLowerCase();

  const scored = (voices || [])
    .map((v) => {
      const name = String(v.name || v.voice_name || '').trim();
      const gender = String(v.gender || '').toLowerCase();
      const language = `${v.language || ''} ${v.locale || ''}`.toLowerCase();
      if (!language.includes(wantedLanguage)) return null;

      let score = 10;
      // Rami is always a male guide — never select a female HeyGen voice.
      if (gender.includes('female') && !gender.includes('male')) return null;
      if (gender.includes('male')) score += 8;
      // HeyGen's Arabic catalog includes a voice named Rami — the guide's own name wins.
      if (/\brami\b/i.test(name)) score += 6;
      if (/warm|calm|natural|friendly|conversational|storyteller|narrator|documentary/i.test(name)) {
        score += 4;
      }
      if (/child|kid|teen|robot|whisper|angry|shout/i.test(name)) score -= 8;
      return {
        voiceId: v.voice_id || v.id,
        voiceName: name || v.voice_id || v.id,
        score
      };
    })
    .filter((v) => v && v.voiceId)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}
