/**
 * Lane family pages — full read-aloud using /shared/tts.js (Google TTS + browser fallback).
 * Requires: <script src="/shared/tts.js"></script> before this file.
 */
(function () {
  const STORAGE_RATE = 'laneTtsSpeakingRate';
  const CHUNK_MAX = 3200;
  let runId = 0;
  let currentAudio = null;

  function normalizeText(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function splitForTts(text, maxLen) {
    const t = text.trim();
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

  function getReadRoot() {
    return (
      document.querySelector('[data-lane-tts-main]') ||
      document.querySelector('main') ||
      document.querySelector('.container.mt-4') ||
      document.body
    );
  }

  function extractReadableText() {
    const root = getReadRoot();
    const clone = root.cloneNode(true);
    const removeSel = [
      'script',
      'style',
      'noscript',
      'iframe',
      '.lane-tts-bar',
      '[data-lane-tts-ignore]',
      'modern-navbar',
      '.particles',
      '.modal',
      '.dropdown-menu'
    ];
    removeSel.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });
    const text = clone.innerText || clone.textContent || '';
    return normalizeText(text);
  }

  function base64ToBlob(base64, contentType) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let i = 0; i < byteCharacters.length; i += 512) {
      const slice = byteCharacters.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);
      for (let j = 0; j < slice.length; j++) byteNumbers[j] = slice.charCodeAt(j);
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
  }

  function playMp3FromBase64(audioBase64, volume) {
    return new Promise((resolve, reject) => {
      try {
        const blob = base64ToBlob(audioBase64, 'audio/mp3');
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.volume = typeof volume === 'number' ? volume : 0.85;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          reject(new Error('audio'));
        };
        audio.play().catch((e) => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          reject(e);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function speakBrowserAsync(text, options) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = options.speakingRate != null ? options.speakingRate : 1.0;
        u.pitch = 1;
        u.volume = options.volume != null ? options.volume : 0.85;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch (_) {
        resolve();
      }
    });
  }

  async function synthesizeChunk(text, voice, options) {
    const mobile =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && window.innerWidth < 768);
    if (mobile) {
      await speakBrowserAsync(text, options);
      return;
    }

    try {
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: voice || 'en-US-Standard-D',
          pitch: options.pitch || 0,
          speakingRate: options.speakingRate != null ? options.speakingRate : 1.0
        })
      });
      const data = await response.json();
      if (data.success && data.audio) {
        await playMp3FromBase64(data.audio, options.volume);
        return;
      }
    } catch (e) {
      console.warn('Lane TTS synthesize fallback:', e);
    }

    await speakBrowserAsync(text, options);
  }

  function stopLanePlayback() {
    runId += 1;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_) {}
      currentAudio = null;
    }
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function mountBar() {
    if (document.getElementById('laneTtsBar')) return;

    const bar = document.createElement('div');
    bar.id = 'laneTtsBar';
    bar.className = 'lane-tts-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Read aloud');
    const savedRate = parseFloat(localStorage.getItem(STORAGE_RATE) || '0.92', 10);
    const rateVal = Number.isFinite(savedRate) ? savedRate : 0.92;

    bar.innerHTML = `
      <span class="lane-tts-label">Listen</span>
      <button type="button" class="lane-tts-btn-primary" id="laneTtsRead" aria-label="Read this page aloud">
        Read page
      </button>
      <button type="button" id="laneTtsStop" aria-label="Stop speaking" disabled>Stop</button>
      <span class="lane-tts-rate">
        <span class="lane-tts-label">Speed</span>
        <input type="range" id="laneTtsRate" min="0.75" max="1.1" step="0.01" value="${rateVal}" aria-label="Speech speed" />
      </span>
      <span class="lane-tts-status" id="laneTtsStatus" aria-live="polite"></span>
      <p class="lane-tts-hint">Uses server voice when available; otherwise your browser. Press Escape to stop.</p>
    `;

    document.body.appendChild(bar);
    document.body.classList.add('lane-tts-page');

    const readBtn = bar.querySelector('#laneTtsRead');
    const stopBtn = bar.querySelector('#laneTtsStop');
    const statusEl = bar.querySelector('#laneTtsStatus');
    const rateInput = bar.querySelector('#laneTtsRate');

    let busy = false;

    function setStatus(msg) {
      statusEl.textContent = msg || '';
    }

    async function doRead(expectedRun) {
      const myRun = expectedRun !== undefined ? expectedRun : runId;
      if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
      if (typeof window.primeSpeechSynthesis === 'function') window.primeSpeechSynthesis();

      const text = extractReadableText();
      if (!text) {
        setStatus('No text found to read.');
        return;
      }

      const rate = parseFloat(rateInput.value, 10) || 0.92;
      localStorage.setItem(STORAGE_RATE, String(rate));
      const chunks = splitForTts(text, CHUNK_MAX);
      busy = true;
      readBtn.disabled = true;
      stopBtn.disabled = false;
      setStatus(`Reading… (${chunks.length} part${chunks.length === 1 ? '' : 's'})`);

      for (let i = 0; i < chunks.length; i++) {
        if (myRun !== runId) break;
        setStatus(`Part ${i + 1} of ${chunks.length}`);
        try {
          await synthesizeChunk(chunks[i], 'en-US-Standard-D', {
            speakingRate: rate,
            volume: 0.85
          });
        } catch (e) {
          console.warn('Lane TTS chunk error', e);
          await speakBrowserAsync(chunks[i], { speakingRate: rate });
        }
      }

      busy = false;
      readBtn.disabled = false;
      stopBtn.disabled = true;
      if (myRun === runId) setStatus('Finished.');
      else setStatus('Stopped.');
    }

    readBtn.addEventListener('click', () => {
      stopLanePlayback();
      busy = false;
      const session = runId;
      doRead(session);
    });

    stopBtn.addEventListener('click', () => {
      stopLanePlayback();
      busy = false;
      readBtn.disabled = false;
      stopBtn.disabled = true;
      setStatus('Stopped.');
    });

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          stopLanePlayback();
          busy = false;
          readBtn.disabled = false;
          stopBtn.disabled = true;
          setStatus('Stopped.');
        }
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBar);
  } else {
    mountBar();
  }
})();
