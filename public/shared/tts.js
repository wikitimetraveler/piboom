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

  function doUnlock() {
    if (audioUnlocked) return true;
    try {
      const unlockAudio = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA='
      );
      unlockAudio.volume = 0;
      unlockAudio.play().then(() => {
        unlockAudio.pause();
        unlockAudio.currentTime = 0;
      }).catch(() => {});
      audioUnlocked = true;
      return true;
    } catch (e) {
      return false;
    }
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
      // Mobile: prefer browser TTS - audio.play() often blocked without user gesture
      if (isMobile()) {
        return speakWithBrowser(text, options);
      }

      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          pitch: options.pitch || 0,
          speakingRate: options.speakingRate || 1.0
        })
      });

      const data = await response.json();

      if (data.success && data.audio) {
        const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
        const audioUrl = URL.createObjectURL(audioBlob);

        currentAudio = new Audio(audioUrl);
        currentAudio.volume = options.volume || 0.8;

        currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
        };

        try {
          await currentAudio.play();
          audioUnlocked = true;
          return true;
        } catch (playError) {
          console.warn('Audio play blocked; user interaction required.', playError);
          return speakWithBrowser(text, options);
        }
      }

      return speakWithBrowser(text, options);
    } catch (error) {
      console.error('Speech error:', error);
      return speakWithBrowser(text, options);
    }
  }

  function stopSpeech() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

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
      const deep = voices.find(v => /male|daniel|david|alex/i.test(v.name));
      if (deep) utterance.voice = deep;
      // Don't set voice if empty (iOS) - use default
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error('Browser speech error:', error);
      return false;
    }
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
        const deep = voices.find(v => /male|daniel|david|alex/i.test(v.name));
        if (deep) utterance.voice = deep;
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
        currentAudio.pause();
        currentAudio = null;
      }
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice,
          pitch: options.pitch || 0,
          speakingRate: options.speakingRate != null ? options.speakingRate : 1.0
        })
      });
      const data = await response.json();
      if (!data.success || !data.audio) {
        await speakBrowserChunkAwaitEnd(text, options);
        return;
      }
      const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      await new Promise((resolve) => {
        if (typeof options.isCancelled === 'function' && options.isCancelled()) {
          URL.revokeObjectURL(audioUrl);
          resolve();
          return;
        }
        const audio = new Audio(audioUrl);
        currentAudio = audio;
        audio.volume = typeof options.volume === 'number' ? options.volume : 0.85;
        const done = () => {
          URL.revokeObjectURL(audioUrl);
          if (currentAudio === audio) currentAudio = null;
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(() => {
          if (currentAudio === audio) currentAudio = null;
          URL.revokeObjectURL(audioUrl);
          speakBrowserChunkAwaitEnd(text, options).then(resolve);
        });
      });
      audioUnlocked = true;
    } catch (_) {
      await speakBrowserChunkAwaitEnd(text, options);
    }
  }

  /**
   * Speak text to completion for HyperFrames / guided narration.
   * Uses same stack as Listen: desktop Google synth + fallback; mobile browser utterance.
   * @param {string} text
   * @param {object} [options]
   * @param {() => boolean} [options.isCancelled] - abort between chunks / before play
   * @param {string} [options.voice]
   * @param {number} [options.speakingRate] - overrides localStorage laneTtsSpeakingRate
   */
  async function speakNarrationAwaitEnd(text, options = {}) {
    const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false;
    const voice = options.voice || 'en-US-Standard-D';
    const vol = typeof options.volume === 'number' ? options.volume : 0.85;
    const rate = getNarrationSpeakingRate(options);
    const baseOpts = {
      speakingRate: rate,
      volume: vol,
      pitch: options.pitch,
      voice,
      isCancelled
    };

    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    const chunks = splitNarrationChunks(t, NARRATION_CHUNK_MAX);
    for (let i = 0; i < chunks.length; i++) {
      if (isCancelled()) return;
      const piece = chunks[i];
      if (isMobile()) {
        await speakBrowserChunkAwaitEnd(piece, baseOpts);
      } else {
        await synthChunkAwaitEnd(piece, voice, baseOpts);
      }
    }
  }

  if (!window.speakWithGoogle) window.speakWithGoogle = speakWithGoogle;
  if (!window.stopSpeech) window.stopSpeech = stopSpeech;
  if (!window.ensureAudioUnlock) window.ensureAudioUnlock = ensureAudioUnlock;
  if (!window.primeSpeechSynthesis) window.primeSpeechSynthesis = primeSpeechSynthesis;
  if (!window.speakNarrationAwaitEnd) window.speakNarrationAwaitEnd = speakNarrationAwaitEnd;
})();
