/**
 * Oman page — language state (English / Arabic) and bilingual speech helpers.
 * Every other Oman script reads language through this module.
 * Development work by David Lane
 */
(function () {
  'use strict';

  /** Shared across Jordan / Syria / Holy Land / Oman so a choice sticks on every atlas page. */
  const STORAGE_KEY = 'meAtlasLang';
  const LEGACY_STORAGE_KEY = 'omanLang';
  const NARRATE_KEY = 'omanStoryNarrate';
  const LANGS = ['en', 'ar'];

  /** Guide voice per language — always male (Salim). Arabic falls back to browser ar-* males on mobile. */
  const VOICES = {
    en: { voice: 'en-US-Neural2-D', lang: 'en-US', speakingRate: 0.98, pitch: -1, gender: 'male' },
    ar: { voice: 'ar-XA-Wavenet-B', lang: 'ar-XA', speakingRate: 0.95, pitch: -1, gender: 'male' }
  };

  const state = {
    lang: 'en',
    ui: { en: {}, ar: {} },
    listeners: []
  };

  function narrateEls() {
    const list = Array.from(document.querySelectorAll('[data-om-narrate]'));
    const legacy = document.getElementById('omStoryNarrate');
    if (legacy && !list.includes(legacy)) list.push(legacy);
    return list;
  }

  function narrateEl() {
    return document.getElementById('omNarrate') || narrateEls()[0] || null;
  }

  /** Atlas, cards, phrases, guide replies, and the story reel — default ON. */
  function narrationEnabled() {
    const el = narrateEl();
    return !el || el.checked;
  }

  function syncNarrateChecks(checked) {
    narrateEls().forEach((el) => {
      el.checked = checked;
    });
  }

  function applyNarrationUi() {
    document.documentElement.classList.toggle('om-narration-off', !narrationEnabled());
  }

  function loadNarratePref() {
    let on = true;
    try {
      on = localStorage.getItem(NARRATE_KEY) !== '0';
    } catch (_) {
      on = true;
    }
    syncNarrateChecks(on);
    applyNarrationUi();
  }

  function persistNarratePref(event) {
    const source = event?.target;
    const on = source && 'checked' in source ? !!source.checked : narrationEnabled();
    syncNarrateChecks(on);
    try {
      localStorage.setItem(NARRATE_KEY, on ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
    applyNarrationUi();
    if (!on) stop();
  }

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
    // Default English on first visit — Arabic only via ?lang=ar or the language toggle.
    return 'en';
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
        console.warn('Oman language listener failed', err);
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
    const label = document.getElementById('omLangToggleLabel');
    if (label) label.textContent = t('switchTo') || (state.lang === 'en' ? 'عربي' : 'English');
    const btn = document.getElementById('omLangToggle');
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
    if (typeof window.OmanContent?.stopListenSpeech === 'function') {
      window.OmanContent.stopListenSpeech();
    } else if (typeof window.stopSpeech === 'function') {
      window.stopSpeech();
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (typeof window.OmanContent?.stopMusic === 'function') window.OmanContent.stopMusic();
    document.getElementById('omGuide')?.classList.remove('is-speaking');
    document.querySelectorAll('.om-phrase.is-speaking').forEach((el) => {
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
    if (!narrationEnabled() && options.force !== true) return;
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const profile = voiceProfile(options.lang);
    const speakOpts = {
      voice: profile.voice,
      lang: profile.lang,
      speakingRate: options.speakingRate ?? profile.speakingRate,
      pitch: options.pitch ?? profile.pitch,
      volume: options.volume ?? 0.9,
      gender: options.gender || profile.gender || 'male',
      preferFemale: false,
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
      console.warn('Oman narration failed', err);
    }
  }

  /** Speak with the guide portrait pulsing while audio plays. */
  async function speakAsGuide(text, options = {}) {
    const guide = document.getElementById('omGuide');
    guide?.classList.add('is-speaking');
    try {
      await speak(text, options);
    } finally {
      guide?.classList.remove('is-speaking');
    }
  }

  function bindToggle() {
    document.getElementById('omLangToggle')?.addEventListener('click', () => {
      unlockAudio();
      toggle();
    });
    document.getElementById('omStopAudio')?.addEventListener('click', stop);
    narrateEls().forEach((el) => {
      el.addEventListener('change', persistNarratePref);
    });
  }

  function init() {
    state.lang = readInitialLang();
    applyDocumentDirection();
    updateToggleLabel();
    loadNarratePref();
    bindToggle();
  }

  window.OmanI18N = {
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
    narrationEnabled,
    LANGS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
