/**
 * WebGPU hero — client card as blacklight albedo
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const POSTER_URL = '/mountain-high/assets/hero-card.png';

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const src = url || POSTER_URL;
      const sameOrigin =
        src.startsWith('/') ||
        src.startsWith(window.location.origin) ||
        !/^https?:\/\//i.test(src);
      if (!sameOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load hero card'));
      img.src = src;
    });
  }

  function showCardLayers(opts) {
    const card = opts.cardEl;
    const fallback = opts.fallback;
    if (card) card.hidden = false;
    if (fallback) fallback.hidden = true;
  }

  function showStaticFallback(opts) {
    const card = opts.cardEl;
    const canvas = opts.canvas;
    const fallback = opts.fallback;
    if (card) card.hidden = false;
    if (canvas) canvas.style.opacity = '0';
    if (fallback) fallback.hidden = false;
  }

  async function mount(opts) {
    const canvas = opts.canvas;
    const fallback = opts.fallback;
    const cardEl = opts.cardEl || document.getElementById('mhmHeroCard');
    const status = opts.status;
    const devMode = Boolean(opts.devMode);
    const posterUrl = opts.posterUrl || POSTER_URL;

    function setStatus(text) {
      if (!status || !devMode) return;
      status.textContent = text;
      status.hidden = !text;
    }

    showCardLayers({ cardEl, fallback });

    if (!root.WebGpuBlacklightPoster || !canvas) {
      showStaticFallback({ cardEl, canvas, fallback });
      setStatus('WebGPU unavailable — static card.');
      return null;
    }

    const view = await root.WebGpuBlacklightPoster.mount({
      canvas,
      seedKey: 'Mountain High|Medicinals',
    });

    if (!view) {
      showStaticFallback({ cardEl, canvas, fallback });
      setStatus('WebGPU unavailable in this browser — same requirement as the home globe.');
      return null;
    }

    let posterReady = false;
    try {
      const img = await loadImage(posterUrl);
      view.setPosterImage(img);
      posterReady = true;
      if (cardEl) cardEl.hidden = true;
      canvas.style.opacity = '1';
      if (fallback) fallback.hidden = true;
      setStatus('WebGPU compute live — their card is the albedo. Mic optional.');
    } catch (err) {
      showStaticFallback({ cardEl, canvas, fallback });
      setStatus((err && err.message) || 'Static card — GPU texture missed.');
    }

    if (!posterReady) {
      return { view: null, toggleMic: null, posterReady: false };
    }

    let audioCtx = null;
    let analyser = null;
    let micStream = null;
    let raf = 0;
    let idle = 0;

    let lastIdleBands = { bass: 0.02, mids: 0.025, highs: 0.015 };

    function idleBands() {
      const t = performance.now() / 1000;
      lastIdleBands = {
        bass: 0.02 + 0.02 * Math.sin(t * 0.7),
        mids: 0.025 + 0.025 * Math.sin(t * 1.15 + 1),
        highs: 0.015 + 0.015 * Math.sin(t * 1.8 + 2),
      };
      view.setBands(lastIdleBands);
      idle = requestAnimationFrame(idleBands);
    }

    function tickMic() {
      if (!analyser) return;
      raf = requestAnimationFrame(tickMic);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const raw = root.WebGpuBlacklightPoster.fftBands(data);
      const boosted = root.WebGpuBlacklightPoster.boostBands(raw, {
        gain: 9.5,
        curve: 0.52,
        floor: 0.14,
      });
      const lifted = {
        bass: Math.min(1, boosted.bass * 1.4),
        mids: Math.min(1, boosted.mids * 1.35),
        highs: Math.min(1, boosted.highs * 1.35),
      };
      view.setBands(root.WebGpuBlacklightPoster.mergeBands(lifted, lastIdleBands));
    }

    async function toggleMic() {
      if (micStream) {
        cancelAnimationFrame(raf);
        micStream.getTracks().forEach((t) => t.stop());
        micStream = null;
        if (audioCtx) audioCtx.close();
        audioCtx = null;
        analyser = null;
        idleBands();
        setStatus('Mic off — leaves and GPU still moving.');
        return false;
      }
      cancelAnimationFrame(idle);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      micStream = stream;
      setStatus('Listening — bass / mids / highs wash the card.');
      tickMic();
      return true;
    }

    idleBands();
    root.MhmHero = { view, toggleMic, posterReady: true };
    return { view, toggleMic, posterReady: true };
  }

  root.MhmHeroGpu = { mount, POSTER_URL };
})(typeof globalThis !== 'undefined' ? globalThis : window);
