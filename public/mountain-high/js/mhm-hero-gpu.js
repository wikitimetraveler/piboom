/**
 * WebGPU hero — client card as blacklight albedo
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load hero card'));
      img.src = url;
    });
  }

  async function mount(opts) {
    const canvas = opts.canvas;
    const fallback = opts.fallback;
    const status = opts.status;
    const devMode = Boolean(opts.devMode);
    function setStatus(text) {
      if (!status || !devMode) return;
      status.textContent = text;
      status.hidden = !text;
    }

    if (!root.WebGpuBlacklightPoster || !canvas) {
      if (fallback) fallback.hidden = false;
      setStatus('WebGPU unavailable — static card.');
      return null;
    }

    const view = await root.WebGpuBlacklightPoster.mount({
      canvas,
      seedKey: 'Mountain High|Medicinals',
    });

    if (!view) {
      if (fallback) fallback.hidden = false;
      setStatus('WebGPU unavailable in this browser — same requirement as the home globe.');
      return null;
    }

    try {
      const img = await loadImage(opts.posterUrl || '/mountain-high/assets/hero-card.png');
      view.setPosterImage(img);
      setStatus('WebGPU compute live — their card is the albedo. Mic optional.');
    } catch (_) {
      view.generateProcedural({ artist: 'Mountain High', album: 'Medicinals' });
      setStatus('GPU procedural live — card image missed. Try a refresh.');
    }

    let audioCtx = null;
    let analyser = null;
    let micStream = null;
    let raf = 0;
    let idle = 0;

    function idleBands() {
      const t = performance.now() / 1000;
      view.setBands({
        bass: 0.1 + 0.08 * Math.sin(t * 0.7),
        mids: 0.12 + 0.1 * Math.sin(t * 1.15 + 1),
        highs: 0.08 + 0.08 * Math.sin(t * 1.8 + 2),
      });
      idle = requestAnimationFrame(idleBands);
    }

    function tickMic() {
      if (!analyser) return;
      raf = requestAnimationFrame(tickMic);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const raw = root.WebGpuBlacklightPoster.fftBands(data);
      view.setBands(root.WebGpuBlacklightPoster.boostBands(raw));
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
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      micStream = stream;
      setStatus('Listening — bass / mids / highs wash the card.');
      tickMic();
      return true;
    }

    idleBands();
    root.MhmHero = { view, toggleMic };
    return { view, toggleMic };
  }

  root.MhmHeroGpu = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
