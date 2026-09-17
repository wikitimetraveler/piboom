/**
 * Rose parlor — English / Vietnamese UI + speech helpers.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'astroLang';
  const LANGS = ['en', 'vi'];
  const VOICES = {
    en: { voice: 'en-US-Neural2-F', lang: 'en-US', speakingRate: 0.94, preferFemale: true },
    vi: { voice: 'vi-VN-Neural2-A', lang: 'vi-VN', speakingRate: 0.95, preferFemale: true },
  };

  const UI = {
    en: {
      switchTo: 'Tiếng Việt',
      switchAria: 'Switch page to Vietnamese',
      heroKicker: 'Twelve sign cards · parlor reading',
      heroLead: 'Playful tropical cards — not the night sky.',
      roseAlt: 'Rose, the parlor reader',
      roseDockCopy: 'She reads the gold wheel like a deck.',
      meetRose: 'Meet Rose',
      roseSpeaks: 'Rose speaks',
      roseSpeaking: 'Rose speaking…',
      stop: 'Stop',
      stopTitle: 'Stop Rose speaking',
      stageKicker: 'Wheel · detail',
      stageTitle: 'Sign and card',
      hide: 'Hide',
      show: 'Show',
      dobLabel: 'Date of birth',
      findSign: 'Find my sign',
      askReading: 'Ask Rose for a reading',
      filterAria: 'Filter signs by element',
      filterAll: 'All signs',
      filterFire: 'Fire',
      filterEarth: 'Earth',
      filterAir: 'Air',
      filterWater: 'Water',
      galleryHeading: 'Flip the deck',
      galleryLead: 'All twelve sign cards — tap to flip and ask Rose.',
      tarotHeading: 'Tarot cards',
      tarotLead: 'Full seventy-eight-card parlor deck — Rose reads and teaches how to use them.',
      tarotFilterAria: 'Tarot suit filter',
      tarotAll: 'All',
      tarotMajor: 'Major',
      tarotWands: 'Wands',
      tarotCups: 'Cups',
      tarotSwords: 'Swords',
      tarotPentacles: 'Pentacles',
      tarotCredit: 'Card art: Pamela Colman Smith / Rider–Waite–Smith (public domain), via Wikimedia Commons.',
      noteBefore: 'Playful tropical astrology, not the night sky. For stars in their true places, open the',
      planetariumLink: 'Planetarium',
      noteAfter: '.',
      spreadAria: 'Rose three-card reading',
      spreadKicker: 'Rose · three-card draw',
      spreadTitle: 'Situation · Cross · Path',
      spreadLead: 'Your birthday draw — tap a card to flip it.',
      sunSignLabel: 'Sun',
      roleSituation: 'Situation',
      roleCross: 'Cross',
      rolePath: 'Path',
      askSpread: 'Ask Rose about this spread',
      askRose: 'Ask Rose',
      flipBack: 'Flip back',
      flipCard: 'Flip the card',
      giftLabel: 'Gift.',
      watchLabel: 'Watch.',
      invalidDate: 'That date is not on the tropical wheel.',
      element_fire: 'fire',
      element_earth: 'earth',
      element_air: 'air',
      element_water: 'water',
      modality_cardinal: 'cardinal',
      modality_fixed: 'fixed',
      modality_mutable: 'mutable',
      chatWelcome:
        "I'm Rose. I read the twelve signs and a full seventy-eight-card tarot — ask how to shuffle, or flip a card. Playful parlor guidance — not the night sky.",
      chatHint: 'Try: "Read The Tower" · "How do I use the deck?" · "Read Cancer for me" · Use Stop / Mute in the chat header to cut her off.',
      chatPlaceholder: 'Ask Rose about a sign or tarot card…',
      greetingFallback: "I'm Rose. Give me a birthday, or let me deal the cards.",
    },
    vi: {
      switchTo: 'English',
      switchAria: 'Chuyển trang sang tiếng Anh',
      heroKicker: 'Mười hai cung · đọc bài phòng khách',
      heroLead: 'Bài nhiệt đới vui vẻ — không phải bầu trời đêm.',
      roseAlt: 'Rose, người đọc bài phòng khách',
      roseDockCopy: 'Cô ấy đọc bánh xe vàng như một bộ bài.',
      meetRose: 'Gặp Rose',
      roseSpeaks: 'Rose nói',
      roseSpeaking: 'Rose đang nói…',
      stop: 'Dừng',
      stopTitle: 'Dừng Rose nói',
      stageKicker: 'Bánh xe · chi tiết',
      stageTitle: 'Cung và thẻ',
      hide: 'Ẩn',
      show: 'Hiện',
      dobLabel: 'Ngày sinh',
      findSign: 'Tìm cung của tôi',
      askReading: 'Nhờ Rose đọc bài',
      filterAria: 'Lọc cung theo nguyên tố',
      filterAll: 'Tất cả cung',
      filterFire: 'Lửa',
      filterEarth: 'Đất',
      filterAir: 'Khí',
      filterWater: 'Nước',
      galleryHeading: 'Lật bộ bài',
      galleryLead: 'Cả mười hai thẻ cung — chạm để lật và hỏi Rose.',
      tarotHeading: 'Bài Tarot',
      tarotLead: 'Bộ bảy mươi tám lá — Rose đọc và dạy cách dùng.',
      tarotFilterAria: 'Lọc chất bài Tarot',
      tarotAll: 'Tất cả',
      tarotMajor: 'Lớn',
      tarotWands: 'Gậy',
      tarotCups: 'Cốc',
      tarotSwords: 'Kiếm',
      tarotPentacles: 'Tiền',
      tarotCredit: 'Hình bài: Pamela Colman Smith / Rider–Waite–Smith (công cộng), qua Wikimedia Commons.',
      noteBefore: 'Chiêm tinh nhiệt đới vui vẻ, không phải bầu trời thật. Để xem sao đúng chỗ, mở',
      planetariumLink: 'Đài thiên văn',
      noteAfter: '.',
      spreadAria: 'Trải ba lá của Rose',
      spreadKicker: 'Rose · trải ba lá',
      spreadTitle: 'Tình huống · Giao cắt · Đường đi',
      spreadLead: 'Trải bài theo ngày sinh — chạm để lật.',
      sunSignLabel: 'Mặt trời',
      roleSituation: 'Tình huống',
      roleCross: 'Giao cắt',
      rolePath: 'Đường đi',
      askSpread: 'Hỏi Rose về trải bài này',
      askRose: 'Hỏi Rose',
      flipBack: 'Lật lại',
      flipCard: 'Lật thẻ',
      giftLabel: 'Quà.',
      watchLabel: 'Cẩn thận.',
      invalidDate: 'Ngày đó không có trên bánh xe nhiệt đới.',
      element_fire: 'lửa',
      element_earth: 'đất',
      element_air: 'khí',
      element_water: 'nước',
      modality_cardinal: 'chủ đạo',
      modality_fixed: 'cố định',
      modality_mutable: 'biến đổi',
      chatWelcome:
        'Tôi là Rose. Tôi đọc mười hai cung và bộ tarot bảy mươi tám lá — hỏi cách xáo bài, hoặc lật một lá. Chỉ là hướng dẫn vui — không phải bầu trời đêm.',
      chatHint: 'Thử: "Đọc The Tower" · "Dùng bộ bài thế nào?" · "Đọc Cự Giải giúp tôi" · Dùng Dừng / Tắt tiếng để ngắt cô ấy.',
      chatPlaceholder: 'Hỏi Rose về cung hoặc lá tarot…',
      greetingFallback: 'Tôi là Rose. Cho tôi ngày sinh, hoặc để tôi trải bài.',
    },
  };

  const state = {
    lang: 'en',
    listeners: [],
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
    return 'en';
  }

  function lang() {
    return state.lang;
  }

  function t(key) {
    const table = UI[state.lang] || UI.en;
    return table[key] ?? UI.en[key] ?? '';
  }

  function copyBundle() {
    return window.AstrologyCopyVi || null;
  }

  function signCopy(id) {
    if (state.lang !== 'vi') return null;
    return copyBundle()?.signs?.[id] || null;
  }

  function cardCopy(id) {
    if (state.lang !== 'vi') return null;
    return copyBundle()?.cards?.[id] || null;
  }

  function applyDocumentLang() {
    document.documentElement.setAttribute('lang', state.lang === 'vi' ? 'vi' : 'en');
  }

  function applyStaticStrings() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = t(key);
      if (!value) return;
      if (key === 'heroKicker') {
        el.innerHTML = `<i class="bi bi-moon-stars" aria-hidden="true"></i> ${value}`;
        return;
      }
      el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const value = t(el.getAttribute('data-i18n-alt'));
      if (value) el.setAttribute('alt', value);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const value = t(el.getAttribute('data-i18n-title'));
      if (value) el.setAttribute('title', value);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const value = t(el.getAttribute('data-i18n-aria'));
      if (value) el.setAttribute('aria-label', value);
    });
    updateToggleLabel();
  }

  function updateToggleLabel() {
    const label = document.getElementById('astroLangToggleLabel');
    if (label) label.textContent = t('switchTo');
    const btn = document.getElementById('astroLangToggle');
    if (btn) btn.setAttribute('aria-label', t('switchAria'));
  }

  function onChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
  }

  function emit() {
    state.listeners.forEach((fn) => {
      try {
        fn(state.lang);
      } catch (err) {
        console.warn('Astrology language listener failed', err);
      }
    });
  }

  function setLang(next) {
    const value = LANGS.includes(next) ? next : 'en';
    if (value === state.lang) {
      applyStaticStrings();
      return;
    }
    state.lang = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      /* ignore */
    }
    applyDocumentLang();
    applyStaticStrings();
    emit();
  }

  function toggle() {
    setLang(state.lang === 'en' ? 'vi' : 'en');
  }

  function voiceProfile(forcedLang) {
    return VOICES[forcedLang || state.lang] || VOICES.en;
  }

  function unlockAudio() {
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();
  }

  async function speak(text, options = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const profile = voiceProfile(options.lang);
    const speakOpts = {
      voice: profile.voice,
      lang: profile.lang,
      speakingRate: options.speakingRate ?? profile.speakingRate,
      volume: options.volume ?? 0.9,
      preferFemale: profile.preferFemale !== false,
      isCancelled: options.isCancelled,
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
      console.warn('Astrology narration failed', err);
    }
  }

  function bindToggle() {
    document.getElementById('astroLangToggle')?.addEventListener('click', () => {
      unlockAudio();
      toggle();
    });
  }

  function init() {
    state.lang = readInitialLang();
    applyDocumentLang();
    applyStaticStrings();
    bindToggle();
  }

  window.AstrologyI18N = {
    lang,
    setLang,
    toggle,
    onChange,
    t,
    UI,
    LANGS,
    signCopy,
    cardCopy,
    voiceProfile,
    speak,
    unlockAudio,
    applyStaticStrings,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
