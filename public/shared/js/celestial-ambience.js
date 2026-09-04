/**
 * Celestial ambience — generative Web Audio bed for home + planetarium.
 * Soft drones, slow pads, and star chimes. No external audio files.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'celestialAmbienceMuted';
  const MASTER_GAIN = 0.36;
  const BUTTON_SELECTOR = '[data-celestial-ambience]';

  let ctx = null;
  let master = null;
  let nodes = [];
  let timers = [];
  let playing = false;
  let unlocked = false;
  let duckLevel = 1;

  function prefersReducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clampDuck(level) {
    const n = Number(level);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
  }

  function effectiveGain() {
    return MASTER_GAIN * clampDuck(duckLevel);
  }

  function isMuted() {
    try {
      return root.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setMuted(on) {
    try {
      root.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function track(node) {
    nodes.push(node);
    return node;
  }

  function softNoiseBuffer(ac, seconds) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  function startDrone(ac, dest, freq, type, gainVal, lfoHz) {
    const osc = track(ac.createOscillator());
    const g = track(ac.createGain());
    const lfo = track(ac.createOscillator());
    const lfoG = track(ac.createGain());
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.value = gainVal;
    lfo.frequency.value = lfoHz;
    lfoG.gain.value = gainVal * 0.35;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    osc.connect(g);
    g.connect(dest);
    osc.start();
    lfo.start();
    return { osc, g };
  }

  function startPad(ac, dest, freqs, baseGain) {
    const merger = track(ac.createGain());
    merger.gain.value = baseGain;
    merger.connect(dest);
    freqs.forEach((f, i) => {
      startDrone(ac, merger, f, i % 2 ? 'triangle' : 'sine', 0.22, 0.03 + i * 0.011);
      startDrone(ac, merger, f * 1.005, 'sine', 0.12, 0.02 + i * 0.008);
    });
    return merger;
  }

  function startShimmer(ac, dest) {
    const src = track(ac.createBufferSource());
    src.buffer = softNoiseBuffer(ac, 4);
    src.loop = true;
    const bp = track(ac.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g = track(ac.createGain());
    g.gain.value = 0.045;
    const lfo = track(ac.createOscillator());
    const lfoG = track(ac.createGain());
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 900;
    lfo.connect(lfoG);
    lfoG.connect(bp.frequency);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start();
    lfo.start();
  }

  function scheduleChimes(ac, dest) {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
    const tick = () => {
      if (!playing || !ctx) return;
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() > 0.55 ? 2 : 1);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
      osc.type = 'sine';
      osc.frequency.value = f;
      const t0 = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.045 + Math.random() * 0.03, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8 + Math.random() * 1.5);
      osc.connect(g);
      if (pan) {
        pan.pan.value = Math.random() * 1.6 - 0.8;
        g.connect(pan);
        pan.connect(dest);
      } else {
        g.connect(dest);
      }
      osc.start(t0);
      osc.stop(t0 + 4.5);
      const next = 1800 + Math.random() * 5200;
      timers.push(root.setTimeout(tick, next));
    };
    timers.push(root.setTimeout(tick, 1200 + Math.random() * 1800));
  }

  function buildGraph() {
    const ac = ensureCtx();
    if (!ac || !master) return;
    startPad(ac, master, [55, 82.5, 110, 164.8, 220], 0.55);
    startDrone(ac, master, 41.2, 'sine', 0.18, 0.018);
    startDrone(ac, master, 329.63, 'sine', 0.04, 0.05);
    startShimmer(ac, master);
    if (!prefersReducedMotion()) scheduleChimes(ac, master);
  }

  function clearGraph() {
    timers.forEach((id) => root.clearTimeout(id));
    timers = [];
    nodes.forEach((n) => {
      try {
        if (typeof n.stop === 'function') n.stop();
      } catch (_) {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch (_) {
        /* ignore */
      }
    });
    nodes = [];
  }

  function syncButtons() {
    const on = playing && !isMuted();
    document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const compact = btn.getAttribute('data-ambience-compact') === '1';
      if (compact) {
        btn.innerHTML = on
          ? '<i class="bi bi-soundwave" aria-hidden="true"></i><span> Ambient</span>'
          : '<i class="bi bi-volume-mute" aria-hidden="true"></i><span> Ambient</span>';
      } else {
        btn.innerHTML = on
          ? '<i class="bi bi-soundwave" aria-hidden="true"></i> Ambient on'
          : '<i class="bi bi-volume-mute" aria-hidden="true"></i> Ambient off';
      }
      btn.title = on ? 'Mute celestial ambience' : 'Play celestial ambience';
    });
  }

  async function start() {
    if (isMuted() || prefersReducedMotion()) {
      playing = false;
      syncButtons();
      return false;
    }
    const ac = ensureCtx();
    if (!ac || !master) return false;
    try {
      if (ac.state === 'suspended') await ac.resume();
    } catch (_) {
      return false;
    }
    if (!playing) {
      clearGraph();
      buildGraph();
      playing = true;
    }
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(Math.max(effectiveGain(), 0.0001), t + 2.4);
    unlocked = true;
    syncButtons();
    return true;
  }

  function setDuck(level) {
    duckLevel = clampDuck(level);
    if (!ctx || !master || !playing || isMuted()) return duckLevel;
    const t = ctx.currentTime;
    const target = Math.max(effectiveGain(), 0.0001);
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(target, t + 0.55);
    return duckLevel;
  }

  function stop(fade) {
    if (!ctx || !master) {
      playing = false;
      syncButtons();
      return;
    }
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + (fade ? 1.2 : 0.05));
    root.setTimeout(
      () => {
        clearGraph();
        playing = false;
        syncButtons();
      },
      fade ? 1300 : 60
    );
  }

  async function toggle() {
    if (playing && !isMuted()) {
      setMuted(true);
      stop(true);
      return;
    }
    setMuted(false);
    await start();
  }

  function unlockFromGesture() {
    if (unlocked || isMuted() || prefersReducedMotion()) return;
    start().catch(() => {});
  }

  function init() {
    document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => {
      if (btn._celestialBound) return;
      btn._celestialBound = true;
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        toggle().catch(() => {});
      });
    });
    syncButtons();

    if (prefersReducedMotion()) {
      setMuted(true);
      syncButtons();
      return;
    }

    start().then((ok) => {
      if (ok) return;
      const once = () => {
        unlockFromGesture();
        document.removeEventListener('pointerdown', once, true);
        document.removeEventListener('keydown', once, true);
      };
      document.addEventListener('pointerdown', once, true);
      document.addEventListener('keydown', once, true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!ctx || !master || !playing) return;
      if (document.hidden) {
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      } else if (!isMuted()) {
        master.gain.setTargetAtTime(Math.max(effectiveGain(), 0.0001), ctx.currentTime, 0.8);
      }
    });
  }

  root.CelestialAmbience = {
    MASTER_GAIN,
    start,
    stop,
    toggle,
    setDuck,
    getDuck: () => clampDuck(duckLevel),
    effectiveGain,
    isMuted,
    isPlaying: () => playing,
    init,
  };
  root.PlanetariumAmbience = root.CelestialAmbience;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
