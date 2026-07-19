/**
 * Ocean Ice Flower — WebGL2 ice-ocean auth gate (zen).
 * Uses public/shared/shaders/ice-ocean-raymarch.glsl
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  const OVERLAY_ID = 'financeAuthOverlay';
  const SHADER_VERSION = '7';
  const SHADER_URL = '/shared/shaders/ice-ocean-raymarch.glsl?v=' + SHADER_VERSION;

  const VERT_SRC = `#version 300 es
    in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  let gl = null;
  let program = null;
  let rafId = 0;
  let startTime = 0;
  let resizeHandler = null;
  let visHandler = null;
  let themeObserver = null;
  let running = false;
  let pixelScale = 1;
  let uniforms = {};
  let frameSamples = [];
  let lastQualityAdjust = 0;
  let nightUniform = 1;

  function isDarkTheme() {
    const body = document.body;
    if (!body) return true;
    if (body.classList.contains('portfolio-dark') || body.classList.contains('dark-mode')) {
      return true;
    }
    if (body.classList.contains('portfolio-page') || body.classList.contains('ice-landing')) {
      return false;
    }
    try {
      const saved = localStorage.getItem('portfolioTheme') || localStorage.getItem('iceLandingTheme');
      if (saved === 'light') return false;
      if (saved === 'dark') return true;
      if (saved === 'auto' && global.matchMedia) {
        return global.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (_) {}
    return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function nightValue() {
    return isDarkTheme() ? 1 : 0;
  }

  function syncThemeToOverlay() {
    nightUniform = nightValue();
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.toggle('finance-fire-gate--light', nightUniform < 0.5);
    overlay.classList.toggle('finance-fire-gate--dark', nightUniform >= 0.5);
  }

  let burnAudio = null;
  let songPlaying = false;
  const SONG_MUTE_KEY = 'financeFireGateMuteSong';
  /** Ambient bed optional — same CC0 file; quiet for ice theme. */
  const BURN_SONG_URL = '/shared/audio/im-on-fire.mp3';

  function isSongMuted() {
    try {
      return sessionStorage.getItem(SONG_MUTE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setSongMuted(muted) {
    try {
      if (muted) sessionStorage.setItem(SONG_MUTE_KEY, '1');
      else sessionStorage.removeItem(SONG_MUTE_KEY);
    } catch (_) {}
    updateMuteButton();
  }

  function updateMuteButton() {
    const btn = document.getElementById('financeAuthMuteBtn');
    if (!btn) return;
    const muted = isSongMuted();
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.innerHTML = muted
      ? '<i class="bi bi-volume-mute-fill" aria-hidden="true"></i> Unmute song'
      : '<i class="bi bi-music-note-beamed" aria-hidden="true"></i> Mute song';
  }

  function stopBurnSong() {
    songPlaying = false;
    if (burnAudio) {
      try {
        burnAudio.pause();
        burnAudio.currentTime = 0;
        burnAudio.onended = null;
        burnAudio.onerror = null;
      } catch (_) {}
      burnAudio = null;
    }
  }

  async function playBurnSong() {
    if (isSongMuted()) return;
    if (songPlaying && burnAudio && !burnAudio.paused) return;

    stopBurnSong();

    try {
      const audio = new Audio(BURN_SONG_URL);
      audio.loop = true;
      audio.volume = 0.32;
      audio.preload = 'auto';
      burnAudio = audio;
      songPlaying = true;

      audio.onerror = () => {
        songPlaying = false;
        burnAudio = null;
      };

      await audio.play();
    } catch (err) {
      songPlaying = false;
      console.warn('Ocean Ice Flower song autoplay waiting for tap:', err && err.message);
    }
  }

  function toggleBurnSong() {
    if (isSongMuted()) {
      setSongMuted(false);
      playBurnSong();
    } else {
      setSongMuted(true);
      stopBurnSong();
    }
  }

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ensureStyles() {
    if (document.querySelector('link[data-finance-fire-gate]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/shared/css/finance-fire-gate.css';
    link.setAttribute('data-finance-fire-gate', '1');
    document.head.appendChild(link);
  }

  function gateCopy(homeMode) {
    return homeMode
      ? 'Encompass and Worksheets tools stay behind the ice flower until you log in. Public demos remain open beyond the bloom.'
      : 'Worksheets and Encompass tools rest beyond the ice until you log in.';
  }

  function createOverlayShell(options) {
    const opts = options || {};
    const homeMode = !!opts.homeMode;
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      applyHomeMode(overlay, homeMode);
      return overlay;
    }

    const secondaryLabel = homeMode ? 'Continue to Public Portfolio' : 'Back to Home';
    const secondaryId = homeMode ? 'financeAuthDismissBtn' : 'financeAuthHomeBtn';

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'finance-fire-gate';
    overlay.dataset.homeMode = homeMode ? '1' : '0';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'financeFireGateTitle');
    overlay.innerHTML =
      '<canvas class="finance-fire-gate__canvas" id="financeFireCanvas" aria-hidden="true"></canvas>' +
      '<div class="finance-fire-gate__fallback" id="financeFireFallback" hidden aria-hidden="true"></div>' +
      '<div class="finance-fire-gate__veil" aria-hidden="true"></div>' +
      '<div class="finance-fire-gate__bloom" aria-hidden="true"></div>' +
      '<h2 class="finance-fire-gate__skyline" id="financeFireGateTitle">LOS <span class="finance-fire-gate__ai" aria-label="AI">ai</span> Labs</h2>' +
      '<div class="finance-fire-gate__card">' +
      '<div class="finance-fire-gate__ember" aria-hidden="true"><i class="bi bi-snow2"></i></div>' +
      '<p class="finance-fire-gate__copy">' +
      gateCopy(homeMode) +
      '</p>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--primary" id="financeAuthLoginBtn">Enter through the Ice</button>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--ghost" id="financeAuthMuteBtn" aria-pressed="false">Mute song</button>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--ghost" id="' +
      secondaryId +
      '">' +
      secondaryLabel +
      '</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    syncThemeToOverlay();

    overlay.querySelector('#financeAuthLoginBtn')?.addEventListener('click', () => {
      if (typeof global.showLoginPopup === 'function') {
        global.showLoginPopup();
      }
    });
    overlay.querySelector('#financeAuthHomeBtn')?.addEventListener('click', () => {
      global.location.href = '/index.html';
    });
    overlay.querySelector('#financeAuthDismissBtn')?.addEventListener('click', () => {
      try {
        sessionStorage.setItem('financeFireGateDismissed', '1');
      } catch (_) {}
      unmount();
    });
    overlay.querySelector('#financeAuthMuteBtn')?.addEventListener('click', () => {
      toggleBurnSong();
    });
    updateMuteButton();

    const unlockSong = () => {
      if (!isSongMuted()) {
        playBurnSong();
      }
      overlay.removeEventListener('pointerdown', unlockSong);
    };
    overlay.addEventListener('pointerdown', unlockSong);

    return overlay;
  }

  function applyHomeMode(overlay, homeMode) {
    overlay.dataset.homeMode = homeMode ? '1' : '0';
    const titleEl = overlay.querySelector('#financeFireGateTitle');
    const copyEl = overlay.querySelector('.finance-fire-gate__copy');
    if (titleEl) {
      titleEl.innerHTML =
        'LOS <span class="finance-fire-gate__ai" aria-label="AI">ai</span> Labs';
    }
    if (copyEl) copyEl.textContent = gateCopy(homeMode);
  }

  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log || 'Shader compile failed');
    }
    return sh;
  }

  function createProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'Program link failed');
    }
    return p;
  }

  function resizeCanvas(canvas) {
    if (!canvas || !gl) return;
    const w = Math.max(1, Math.floor((canvas.clientWidth || window.innerWidth) * pixelScale));
    const h = Math.max(1, Math.floor((canvas.clientHeight || window.innerHeight) * pixelScale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  function adaptQuality(frameMs) {
    // Canvas resize clears the buffer and looks like a blink — only step down
    // when consistently slow, with a long cooldown so it can't oscillate.
    frameSamples.push(frameMs);
    if (frameSamples.length < 90) return;
    const avg = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length;
    frameSamples = [];
    const now = performance.now();
    if (now - lastQualityAdjust < 8000) return;
    if (avg > 24 && pixelScale > 0.55) {
      pixelScale = Math.max(0.55, pixelScale * 0.85);
      lastQualityAdjust = now;
      if (gl && gl.canvas) resizeCanvas(gl.canvas);
    }
  }

  function render(now) {
    if (!running || !gl || !program) return;
    rafId = requestAnimationFrame(render);
    if (document.hidden) return;

    const t0 = performance.now();
    if (!startTime) startTime = now;
    const elapsed = (now - startTime) * 0.001;

    gl.useProgram(program);
    gl.uniform1f(uniforms.uTime, elapsed);
    gl.uniform1f(uniforms.uNight, nightUniform);
    gl.uniform2f(uniforms.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(uniforms.uFocal, 1.35, 1.35);

    if (nightUniform >= 0.5) {
      gl.clearColor(0.04, 0.08, 0.14, 1);
    } else {
      gl.clearColor(0.32, 0.62, 0.78, 1);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    adaptQuality(performance.now() - t0);
  }

  function showFallback(overlay) {
    const canvas = overlay.querySelector('#financeFireCanvas');
    const fallback = overlay.querySelector('#financeFireFallback');
    if (canvas) canvas.hidden = true;
    if (fallback) fallback.hidden = false;
  }

  function disposeScene() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (visHandler) {
      document.removeEventListener('visibilitychange', visHandler);
      visHandler = null;
    }
    if (gl) {
      try {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (_) {}
      gl = null;
    }
    program = null;
    uniforms = {};
    frameSamples = [];
    lastQualityAdjust = 0;
  }

  function disposeThemeObserver() {
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  }

  async function bootIceOcean(canvas) {
    const fragSrc = await fetch(SHADER_URL).then((r) => {
      if (!r.ok) throw new Error('Shader fetch failed');
      return r.text();
    });

    gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');

    program = createProgram(VERT_SRC, fragSrc);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uniforms = {
      uTime: gl.getUniformLocation(program, 'uTime'),
      uNight: gl.getUniformLocation(program, 'uNight'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uFocal: gl.getUniformLocation(program, 'uFocal'),
    };

    pixelScale = Math.min(window.devicePixelRatio || 1, 1.15);
    resizeCanvas(canvas);
  }

  async function mount(options) {
    const opts = options || {};
    ensureStyles();
    const overlay = createOverlayShell(opts);
    overlay.style.display = 'flex';

    if (opts.hideCard) {
      const card = overlay.querySelector('.finance-fire-gate__card');
      if (card) card.style.display = 'none';
    }

    playBurnSong();
    syncThemeToOverlay();
    if (!themeObserver) {
      themeObserver = new MutationObserver(() => {
        syncThemeToOverlay();
      });
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (prefersReducedMotion()) {
      showFallback(overlay);
      return overlay;
    }

    const canvas = overlay.querySelector('#financeFireCanvas');
    try {
      if (!canvas) {
        showFallback(overlay);
        return overlay;
      }
      disposeScene();
      await bootIceOcean(canvas);
      syncThemeToOverlay();
      startTime = 0;
      running = true;
      resizeHandler = () => resizeCanvas(canvas);
      window.addEventListener('resize', resizeHandler);
      visHandler = () => {
        if (!document.hidden && running && !rafId) {
          rafId = requestAnimationFrame(render);
        }
      };
      document.addEventListener('visibilitychange', visHandler);
      rafId = requestAnimationFrame(render);
      const fallback = overlay.querySelector('#financeFireFallback');
      if (fallback) fallback.hidden = true;
      canvas.hidden = false;
    } catch (err) {
      console.warn('Ocean Ice Flower gate: WebGL unavailable, using fallback', err);
      showFallback(overlay);
    }
    return overlay;
  }

  function unmount() {
    stopBurnSong();
    disposeScene();
    disposeThemeObserver();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }

  function isMounted() {
    return !!document.getElementById(OVERLAY_ID);
  }

  function setVisible(visible) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } else if (gl && program && !prefersReducedMotion()) {
      running = true;
      startTime = 0;
      rafId = requestAnimationFrame(render);
    }
  }

  global.FinanceFireGate = {
    mount: mount,
    unmount: unmount,
    isMounted: isMounted,
    setVisible: setVisible,
    OVERLAY_ID: OVERLAY_ID,
  };
})(typeof window !== 'undefined' ? window : globalThis);
