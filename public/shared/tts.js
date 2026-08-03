/**
 * Development work by David Lane
 */
/**
 * Shared Text-to-Speech helper
 *
 * Provides a Google TTS-first helper with safe browser fallback.
 * Mobile/iOS: call ensureAudioUnlock() and primeSpeechSynthesis() during user
 * gesture (e.g. mic click) before async speech to avoid "user gesture required" blocks.
 * Safe to include on any page; will not override existing helpers.
 */

(() => {
  if (window.__ttsHelperInitialized) return;
  window.__ttsHelperInitialized = true;

  let currentAudio = null;
  let audioUnlocked = false;
  let speechPrimed = false;
  /** One element for unlock + Google TTS — a fresh `new Audio()` after fetch is often blocked. */
  let sharedAudio = null;
  let currentObjectUrl = null;
  let unlockGeneration = 0;
  const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';

  function getSharedAudio() {
    if (!sharedAudio) {
      sharedAudio = new Audio();
      try {
        sharedAudio.setAttribute('playsinline', 'true');
        sharedAudio.preload = 'auto';
      } catch (_) {
        /* ignore */
      }
    }
    return sharedAudio;
  }

  function revokeCurrentObjectUrl() {
    if (!currentObjectUrl) return;
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch (_) {
      /* ignore */
    }
    currentObjectUrl = null;
  }

  function doUnlock() {
    try {
      const audio = getSharedAudio();
      // Already unlocked and not mid-silent-prime — keep the element warm.
      if (audioUnlocked && audio.src && !String(audio.src).includes('data:audio')) {
        return true;
      }
      if (audioUnlocked && currentAudio === audio && !audio.paused) {
        return true;
      }
      const gen = ++unlockGeneration;
      // volume=0 does NOT unlock unmuted playback in Chrome. Mute, play, then unmute.
      audio.muted = true;
      audio.volume = 1;
      audio.src = SILENT_WAV;
      const playResult = audio.play();
      if (playResult && typeof playResult.then === 'function') {
        playResult
          .then(() => {
            if (gen !== unlockGeneration) return;
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch (_) {
              /* ignore */
            }
            audio.muted = false;
            audioUnlocked = true;
          })
          .catch(() => {
            audio.muted = false;
          });
      } else {
        audio.muted = false;
      }
      audioUnlocked = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Play a synthesized MP3 on the same element unlocked during the user gesture.
   * A fresh `new Audio()` after fetch is often blocked; English then falls back to
   * speechSynthesis, but Arabic usually has no system voice — phrases go silent.
   * @returns {Promise<boolean>} true if playback completed (or was cancelled cleanly)
   */
  function playSynthesizedBlob(audioBlob, options = {}) {
    const audioUrl = URL.createObjectURL(audioBlob);
    revokeCurrentObjectUrl();
    currentObjectUrl = audioUrl;
    const audio = getSharedAudio();
    try {
      audio.pause();
    } catch (_) {
      /* ignore */
    }
    return new Promise((resolve) => {
      if (typeof options.isCancelled === 'function' && options.isCancelled()) {
        revokeCurrentObjectUrl();
        resolve(false);
        return;
      }
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        revokeCurrentObjectUrl();
        if (currentAudio === audio) currentAudio = null;
        resolve(ok);
      };
      currentAudio = audio;
      audio.muted = false;
      audio.volume = typeof options.volume === 'number' ? options.volume : 0.85;
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.src = audioUrl;
      const tryPlay = () =>
        audio.play().then(() => {
          audioUnlocked = true;
          if (audio.ended) finish(true);
        });
      tryPlay().catch(() => {
        // One retry: some browsers need a second play() after src swap.
        tryPlay().catch(() => finish(false));
      });
    });
  }

  function initAudioUnlock() {
    const unlock = async () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      doUnlock();
    };

    document.addEventListener('click', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioUnlock);
  } else {
    initAudioUnlock();
  }

  /** Call during user gesture (mic click, etc.) to unlock audio on mobile before async speak */
  function ensureAudioUnlock() {
    return doUnlock();
  }

  /** Call during user gesture to prime speechSynthesis on iOS (required for async speak) */
  function primeSpeechSynthesis() {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.getVoices(); // Wake up iOS - voices empty until first call
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate = 1;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      speechPrimed = true;
    } catch (e) {
      console.warn('Speech prime skipped:', e);
    }
  }

  async function speakWithGoogle(text, voice = 'en-US-Standard-D', options = {}) {
    try {
      // Always Google Cloud TTS first (every surface, every language). Browser speech is
      // last-resort only — mobile system voices are unreliable (matron EN, missing AR, etc.).
      if (currentAudio) {
        try {
          currentAudio.pause();
        } catch (_) {
          /* ignore */
        }
        currentAudio = null;
      }
      unlockGeneration += 1;

      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          pitch: Number.isFinite(Number(options.pitch)) ? Number(options.pitch) : 0,
          speakingRate: options.speakingRate || 1.0,
          gender: options.gender || (options.preferFemale || options.youngFemale ? 'female' : undefined),
          preferFemale: options.preferFemale === true || options.youngFemale === true,
          youngFemale: options.youngFemale === true
        })
      });

      const data = await response.json();

      if (data.success && data.audio) {
        const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
        const played = await playSynthesizedBlob(audioBlob, {
          volume: options.volume || 0.8,
          isCancelled: options.isCancelled
        });
        if (played) return true;
        console.warn('Audio play blocked; user interaction required.');
        return speakWithBrowser(text, options);
      }

      return speakWithBrowser(text, options);
    } catch (error) {
      console.error('Speech error:', error);
      return speakWithBrowser(text, options);
    }
  }

  function stopSpeech() {
    unlockGeneration += 1;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_) {
        /* ignore */
      }
      currentAudio = null;
    }
    if (sharedAudio && sharedAudio !== currentAudio) {
      try {
        sharedAudio.pause();
        sharedAudio.currentTime = 0;
      } catch (_) {
        /* ignore */
      }
    }
    revokeCurrentObjectUrl();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function base64ToBlob(base64, contentType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let i = 0; i < byteCharacters.length; i += 512) {
      const slice = byteCharacters.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);

      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }

      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
  }

  function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth < 768);
  }

  function speakWithBrowser(text, options = {}) {
    if (!('speechSynthesis' in window)) return false;

    try {
      window.speechSynthesis.cancel();
      try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch (_) {}
      const utterance = new SpeechSynthesisUtterance(text);
      // Mobile/iOS: use rate=1, pitch=1 for reliability (some iOS versions buggy with other values)
      const mobile = isMobile();
      utterance.rate = mobile ? 1.0 : (options.speakingRate || 1.0);
      utterance.pitch = mobile ? 1.0 : (typeof options.pitch === 'number' ? options.pitch : 1.0);
      utterance.volume = typeof options.volume === 'number' ? options.volume : 0.8;
      const voices = window.speechSynthesis.getVoices();
      const preferFemale = options.preferFemale === true || options.gender === 'female';
      const picked = preferFemale
        ? pickFemaleBrowserVoice(voices, options.lang)
        : pickMaleBrowserVoice(voices, options.lang);
      if (picked) utterance.voice = picked;
      applyBrowserLanguage(utterance, voices, options);
      // Young Pip only: push browser pitch near max (2) — avoid matron Zira/Susan
      if (options.youngFemale) {
        utterance.pitch = mobile ? 1.8 : Math.min(2, Math.max(1.6, 1 + (Number(options.pitch) || 6) / 12));
        utterance.rate = mobile ? 1.05 : Math.min(1.25, Number(options.speakingRate) || 1.12);
      } else if (preferFemale && typeof options.pitch === 'number') {
        utterance.pitch = mobile ? 1.1 : Math.min(2, Math.max(0.8, 1 + options.pitch / 10));
      }
      // Don't set voice if empty (iOS) - use default
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error('Browser speech error:', error);
      return false;
    }
  }

  function voiceLabel(v) {
    return `${v?.name || ''} ${v?.voiceURI || ''}`;
  }

  function isFemaleBrowserVoice(v) {
    return /female|samantha|karen|jenny|aria|sara|natasha|siri|zira|susan|victoria|hazel|moira|fiona|hoda|salma|laila|ghizlane/i.test(
      voiceLabel(v)
    );
  }

  function isMaleBrowserVoice(v) {
    return /\b(male|david|daniel|alex|mark|george|fred|tom|bruce|aaron|guy|james|john|ryan|matthew|sam|rami|maged|naeem|khaled|naayf)\b/i.test(
      voiceLabel(v)
    );
  }

  /**
   * Force a non-English utterance onto a matching system voice.
   * Without this the default (usually English) voice reads foreign script as noise.
   * Prefer male/female to match the requested gender — first ar-* voice is often female.
   */
  function applyBrowserLanguage(utterance, voices, options = {}) {
    const code = typeof options === 'string' ? options : String(options.lang || '').trim();
    if (!code) return;
    utterance.lang = code;
    const prefix = code.slice(0, 2).toLowerCase();
    if (prefix === 'en') return;
    const preferFemale =
      typeof options === 'object' &&
      (options.preferFemale === true || String(options.gender || '').toLowerCase() === 'female');
    const candidates = (voices || []).filter((v) => String(v.lang || '').toLowerCase().startsWith(prefix));
    if (!candidates.length) return;
    const match = preferFemale
      ? candidates.find((v) => isFemaleBrowserVoice(v) && !isMaleBrowserVoice(v)) ||
        candidates.find((v) => !isMaleBrowserVoice(v)) ||
        candidates[0]
      : candidates.find((v) => isMaleBrowserVoice(v) && !isFemaleBrowserVoice(v)) ||
        candidates.find((v) => !isFemaleBrowserVoice(v)) ||
        candidates[0];
    if (match) utterance.voice = match;
  }

  function pickFemaleBrowserVoice(voices, langCode) {
    const list = Array.isArray(voices) ? voices : [];
    const matronHit = (v) =>
      /susan|victoria|zira|hazel|moira|fiona|grandma|grandmother|mature|elder|catherine|martha/i.test(voiceLabel(v));
    const youngHit = (v) =>
      /jenny|aria|samantha|nova|karen|allison|emily|ava|google us english female|microsoft jenny|microsoft aria/i.test(
        voiceLabel(v)
      );
    const femaleHit = (v) => isFemaleBrowserVoice(v);
    const maleHit = (v) => isMaleBrowserVoice(v);
    const prefix = String(langCode || 'en').slice(0, 2).toLowerCase();
    const langOk = (v) => String(v.lang || '').toLowerCase().startsWith(prefix);
    // Prefer young/playful — never lead with Zira/Susan (matron). Stay in-language for non-English.
    const inLang =
      list.find((v) => langOk(v) && youngHit(v) && !matronHit(v)) ||
      list.find((v) => langOk(v) && femaleHit(v) && !matronHit(v)) ||
      list.find((v) => langOk(v) && !maleHit(v) && !matronHit(v)) ||
      list.find((v) => langOk(v)) ||
      null;
    if (inLang || prefix !== 'en') return inLang;
    return (
      list.find((v) => /en(-|_)?us/i.test(v.lang) && youngHit(v) && !matronHit(v)) ||
      list.find((v) => /^en/i.test(v.lang) && youngHit(v) && !matronHit(v)) ||
      list.find((v) => /en(-|_)?us/i.test(v.lang) && femaleHit(v) && !matronHit(v)) ||
      list.find((v) => /^en/i.test(v.lang) && femaleHit(v) && !matronHit(v)) ||
      list.find((v) => /en(-|_)?us/i.test(v.lang) && !maleHit(v) && !matronHit(v)) ||
      list.find((v) => /^en/i.test(v.lang) && !maleHit(v)) ||
      null
    );
  }

  /** Male guide voices (Rami, etc.) — prefer explicit male labels, then avoid known female names. */
  function pickMaleBrowserVoice(voices, langCode) {
    const list = Array.isArray(voices) ? voices : [];
    const prefix = String(langCode || 'en').slice(0, 2).toLowerCase();
    const langOk = (v) => String(v.lang || '').toLowerCase().startsWith(prefix);
    // Stay in the requested language first — never read Arabic with an English voice.
    const inLang =
      list.find((v) => langOk(v) && isMaleBrowserVoice(v) && !isFemaleBrowserVoice(v)) ||
      list.find((v) => langOk(v) && !isFemaleBrowserVoice(v)) ||
      list.find((v) => langOk(v)) ||
      null;
    if (inLang || prefix !== 'en') return inLang;
    return (
      list.find((v) => /en(-|_)?us/i.test(v.lang) && isMaleBrowserVoice(v) && !isFemaleBrowserVoice(v)) ||
      list.find((v) => /^en/i.test(v.lang) && isMaleBrowserVoice(v) && !isFemaleBrowserVoice(v)) ||
      list.find((v) => /en(-|_)?us/i.test(v.lang) && !isFemaleBrowserVoice(v)) ||
      list.find((v) => isMaleBrowserVoice(v) && !isFemaleBrowserVoice(v)) ||
      null
    );
  }

  const NARRATION_CHUNK_MAX = 3200;

  function splitNarrationChunks(text, maxLen) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    if (t.length <= maxLen) return [t];
    const parts = [];
    let rest = t;
    while (rest.length) {
      if (rest.length <= maxLen) {
        parts.push(rest.trim());
        break;
      }
      let cut = rest.lastIndexOf('. ', maxLen);
      if (cut < maxLen * 0.45) cut = rest.lastIndexOf('\n', maxLen);
      if (cut < maxLen * 0.45) cut = rest.lastIndexOf(' ', maxLen);
      if (cut <= 0) cut = maxLen;
      const piece = rest.slice(0, cut).trim();
      if (piece) parts.push(piece);
      rest = rest.slice(cut).trim();
    }
    return parts.filter(Boolean);
  }

  function getNarrationSpeakingRate(options) {
    if (options && options.speakingRate != null) return options.speakingRate;
    try {
      const raw = parseFloat(localStorage.getItem('laneTtsSpeakingRate') || '0.92', 10);
      return Number.isFinite(raw) ? raw : 0.92;
    } catch (_) {
      return 0.92;
    }
  }

  function speakBrowserChunkAwaitEnd(text, options) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch (_) {}
        const utterance = new SpeechSynthesisUtterance(text);
        const mobile = isMobile();
        utterance.rate = mobile ? 1.0 : (options.speakingRate || 1.0);
        utterance.pitch = mobile ? 1.0 : (typeof options.pitch === 'number' ? options.pitch : 1.0);
        utterance.volume = typeof options.volume === 'number' ? options.volume : 0.85;
        const voices = window.speechSynthesis.getVoices();
        const preferFemale = options.preferFemale === true || options.gender === 'female';
        const picked = preferFemale
          ? pickFemaleBrowserVoice(voices, options.lang)
          : pickMaleBrowserVoice(voices, options.lang);
        if (picked) utterance.voice = picked;
        applyBrowserLanguage(utterance, voices, options);
        if (options.youngFemale) {
          utterance.pitch = mobile ? 1.8 : Math.min(2, Math.max(1.6, 1 + (Number(options.pitch) || 6) / 12));
          utterance.rate = mobile ? 1.05 : Math.min(1.25, Number(options.speakingRate) || 1.12);
        } else if (preferFemale && typeof options.pitch === 'number') {
          utterance.pitch = mobile ? 1.1 : Math.min(2, Math.max(0.8, 1 + options.pitch / 10));
        }
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } catch (_) {
        resolve();
      }
    });
  }

  async function synthChunkAwaitEnd(text, voice, options) {
    try {
      if (currentAudio) {
        try {
          currentAudio.pause();
        } catch (_) {
          /* ignore */
        }
        currentAudio = null;
      }
      unlockGeneration += 1;
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          pitch: Number.isFinite(Number(options.pitch)) ? Number(options.pitch) : 0,
          speakingRate: options.speakingRate != null ? options.speakingRate : 1.0,
          gender: options.gender || (options.preferFemale ? 'female' : undefined)
        })
      });
      const data = await response.json();
      if (!data.success || !data.audio) {
        // Keep requested gender — never force female (that broke male guides like Rami).
        await speakBrowserChunkAwaitEnd(text, options);
        return;
      }
      const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
      const played = await playSynthesizedBlob(audioBlob, {
        volume: typeof options.volume === 'number' ? options.volume : 0.85,
        isCancelled: options.isCancelled
      });
      if (!played) {
        await speakBrowserChunkAwaitEnd(text, options);
        return;
      }
      audioUnlocked = true;
    } catch (_) {
      await speakBrowserChunkAwaitEnd(text, options);
    }
  }

  /**
   * Speak text to completion for HyperFrames / guided narration.
   * Always Google Cloud TTS first (desktop and mobile). Browser speech is last-resort
   * fallback only when synthesize fails or audio.play is blocked.
   * @param {string} text
   * @param {object} [options]
   * @param {() => boolean} [options.isCancelled] - abort between chunks / before play
   * @param {string} [options.voice]
   * @param {number} [options.speakingRate] - overrides localStorage laneTtsSpeakingRate
   */
  async function speakNarrationAwaitEnd(text, options = {}) {
    const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
    const youngFemale = options.youngFemale === true;
    const preferFemale = youngFemale || options.preferFemale === true || options.gender === 'female';
    const preferMale = options.gender === 'male' || (!preferFemale && options.preferMale === true);
    const voice =
      options.voice || (youngFemale ? 'en-US-Neural2-H' : preferFemale ? 'en-US-Standard-F' : 'en-US-Standard-D');
    const vol = typeof options.volume === 'number' ? options.volume : 0.85;
    const rate = getNarrationSpeakingRate(options);
    const baseOpts = {
      speakingRate: rate,
      volume: vol,
      pitch: options.pitch != null ? options.pitch : youngFemale ? 6.5 : undefined,
      voice,
      lang: options.lang,
      preferFemale,
      youngFemale,
      gender: options.gender || (preferFemale ? 'female' : preferMale ? 'male' : undefined),
      isCancelled
    };

    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    const chunks = splitNarrationChunks(t, NARRATION_CHUNK_MAX);
    for (let i = 0; i < chunks.length; i++) {
      if (isCancelled()) return;
      await synthChunkAwaitEnd(chunks[i], voice, baseOpts);
    }
  }

  if (!window.speakWithGoogle) window.speakWithGoogle = speakWithGoogle;
  if (!window.stopSpeech) window.stopSpeech = stopSpeech;
  if (!window.ensureAudioUnlock) window.ensureAudioUnlock = ensureAudioUnlock;
  if (!window.primeSpeechSynthesis) window.primeSpeechSynthesis = primeSpeechSynthesis;
  if (!window.speakNarrationAwaitEnd) window.speakNarrationAwaitEnd = speakNarrationAwaitEnd;
})();
