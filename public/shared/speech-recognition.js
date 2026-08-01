/**
 * Shared Web Speech recognition helpers.
 * Used by AIChatWidget, VoiceWidget, and music/finance pages — one support check for all.
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  function getSpeechRecognitionCtor() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }

  function isSpeechRecognitionSupported() {
    return Boolean(getSpeechRecognitionCtor());
  }

  /**
   * @param {object} [opts]
   * @param {string} [opts.lang='en-US']
   * @param {boolean} [opts.continuous=false]
   * @param {boolean} [opts.interimResults=false]
   * @param {number} [opts.maxAlternatives]
   * @param {(transcript: string, event: SpeechRecognitionEvent) => void} [opts.onResult]
   * @param {() => void} [opts.onStart]
   * @param {() => void} [opts.onEnd]
   * @param {(error: string) => void} [opts.onError]
   */
  function createSpeechBridge(opts = {}) {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = opts.continuous === true;
    recognition.interimResults = opts.interimResults === true;
    recognition.lang = opts.lang || 'en-US';
    if (Number.isFinite(opts.maxAlternatives) && opts.maxAlternatives > 0) {
      recognition.maxAlternatives = opts.maxAlternatives;
    }

    let listening = false;
    let onResult = typeof opts.onResult === 'function' ? opts.onResult : null;

    recognition.onstart = () => {
      listening = true;
      opts.onStart?.();
    };
    recognition.onend = () => {
      listening = false;
      opts.onEnd?.();
    };
    recognition.onerror = (event) => {
      listening = false;
      opts.onError?.(event?.error || 'error');
      opts.onEnd?.();
    };
    recognition.onresult = (event) => {
      if (!onResult) return;
      if (opts.interimResults) {
        onResult(
          Array.from(event.results)
            .map((r) => r[0]?.transcript || '')
            .join('')
            .trim(),
          event
        );
        return;
      }
      const result = event.results?.[event.results.length - 1];
      if (!result?.isFinal && recognition.continuous) return;
      const transcript = result?.[0]?.transcript?.trim();
      if (transcript) onResult(transcript, event);
    };

    return {
      recognition,
      get isListening() {
        return listening;
      },
      setLang(lang) {
        if (lang) recognition.lang = lang;
      },
      setResultHandler(fn) {
        onResult = typeof fn === 'function' ? fn : null;
      },
      start(callback) {
        if (typeof callback === 'function') onResult = callback;
        try {
          recognition.start();
        } catch (_) {
          /* already started */
        }
      },
      stop() {
        try {
          recognition.stop();
        } catch (_) {
          /* ignore */
        }
      }
    };
  }

  const api = {
    getSpeechRecognitionCtor,
    isSpeechRecognitionSupported,
    createSpeechBridge
  };

  global.DcSpeechRecognition = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
