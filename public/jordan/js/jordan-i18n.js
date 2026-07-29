/**
 * Jordan page — language state (English / Arabic) and bilingual speech helpers.
 * Every other Jordan script reads language through this module.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'jordanLang';
  const LANGS = ['en', 'ar'];

  /** Guide voice per language. Arabic falls back to browser ar-* voices on mobile. */
  const VOICES = {
    en: { voice: 'en-US-Neural2-D', lang: 'en-US', speakingRate: 0.98, pitch: -1 },
    ar: { voice: 'ar-XA-Wavenet-B', lang: 'ar-XA', speakingRate: 0.95, pitch: -1 }
  };

  const state = {
    lang: 'en',
    ui: { en: {}, ar: {} },
    listeners: []
  };

  function readInitialLang() {
    try {
      const param = new URLSearchParams(window.location.search).get('lang');
      if (LANGS.includes(param)) return param;
    } catch (_) {
      /* ignore */
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.includes(saved)) return saved;
    } catch (_) {
      /* ignore */
    }
    return (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  function lang() {
    return state.lang;
  }

  function isRtl() {
    return state.lang === 'ar';
  }

  /** Resolve a value that may be a plain string or an { en, ar } pair. */
  function pick(value, forcedLang) {
    if (value == null) return '';
    const key = forcedLang || state.lang;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map((v) => pick(v, key)).join(', ');
    return String(value[key] ?? value.en ?? value.ar ?? '');
  }

  function t(key) {
    const table = state.ui[state.lang] || {};
    const fallback = state.ui.en || {};
    return table[key] ?? fallback[key] ?? '';
  }

  function setUiStrings(uiByLang) {
    if (!uiByLang) return;
    LANGS.forEach((code) => {
      if (uiByLang[code]) state.ui[code] = uiByLang[code];
    });
    applyStaticStrings();
  }

  /** Replace text for every [data-i18n] node using the loaded UI table. */
  function applyStaticStrings() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = t(el.getAttribute('data-i18n'));
      if (value) el.textContent = value;
    });
  }

  function applyDocumentDirection() {
    const dir = isRtl() ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', state.lang === 'ar' ? 'ar' : 'en');
    document.body.setAttribute('dir', dir);
  }

  function onChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
  }

  function emit() {
    state.listeners.forEach((fn) => {
      try {
        fn(state.lang);
      } catch (err) {
        console.warn('Jordan language listener failed', err);
      }
    });
  }

  function setLang(next) {
    const value = LANGS.includes(next) ? next : 'en';
    if (value === state.lang) return;
    state.lang = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      /* ignore */
    }
    stop();
    applyDocumentDirection();
    applyStaticStrings();
    updateToggleLabel();
    emit();
  }

  function toggle() {
    setLang(state.lang === 'en' ? 'ar' : 'en');
  }

  function updateToggleLabel() {
    const label = document.getElementById('jdLangToggleLabel');
    if (label) label.textContent = t('switchTo') || (state.lang === 'en' ? 'عربي' : 'English');
    const btn = document.getElementById('jdLangToggle');
    if (btn) {
      btn.setAttribute(
        'aria-label',
        state.lang === 'en' ? 'Switch page to Arabic' : 'تبديل الصفحة إلى الإنجليزية'
      );
    }
  }

  function voiceProfile(forcedLang) {
    return VOICES[forcedLang || state.lang] || VOICES.en;
  }

  function stop() {
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.getElementById('jdGuide')?.classList.remove('is-speaking');
    document.querySelectorAll('.jd-phrase.is-speaking').forEach((el) => {
      el.classList.remove('is-speaking');
    });
  }

  function unlockAudio() {
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
  }

  /**
   * Speak text to completion in the given (or current) language.
   * @param {string} text
   * @param {{lang?: string, isCancelled?: () => boolean, volume?: number}} [options]
   */
  async function speak(text, options = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const profile = voiceProfile(options.lang);
    const speakOpts = {
      voice: profile.voice,
      lang: profile.lang,
      speakingRate: options.speakingRate ?? profile.speakingRate,
      pitch: options.pitch ?? profile.pitch,
      volume: options.volume ?? 0.9,
      isCancelled: options.isCancelled
    };

    try {
      if (typeof window.speakNarrationAwaitEnd === 'function') {
        await window.speakNarrationAwaitEnd(clean, speakOpts);
        return;
      }
      if (typeof window.speakWithGoogle === 'function') {
        await window.speakWithGoogle(clean, profile.voice, speakOpts);
      }
    } catch (err) {
      console.warn('Jordan narration failed', err);
    }
  }

  /** Speak with the guide portrait pulsing while audio plays. */
  async function speakAsGuide(text, options = {}) {
    const guide = document.getElementById('jdGuide');
    guide?.classList.add('is-speaking');
    try {
      await speak(text, options);
    } finally {
      guide?.classList.remove('is-speaking');
    }
  }

  function bindToggle() {
    document.getElementById('jdLangToggle')?.addEventListener('click', () => {
      unlockAudio();
      toggle();
    });
    document.getElementById('jdStopAudio')?.addEventListener('click', stop);
  }

  function init() {
    state.lang = readInitialLang();
    applyDocumentDirection();
    updateToggleLabel();
    bindToggle();
  }

  window.JordanI18N = {
    lang,
    isRtl,
    setLang,
    toggle,
    onChange,
    pick,
    t,
    setUiStrings,
    applyStaticStrings,
    voiceProfile,
    speak,
    speakAsGuide,
    stop,
    unlockAudio,
    LANGS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
