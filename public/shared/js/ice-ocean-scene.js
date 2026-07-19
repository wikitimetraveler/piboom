/**
 * Raymarched arctic ocean + ice floes + duotone post-process.
 * Full-screen WebGL2 shader — no meshes, no video. See ice-ocean-raymarch.glsl.
 */
(function () {
  'use strict';

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

  const prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let gl;
  let program;
  let rafId = 0;
  let running = false;
  let startTime = 0;
  let night = 0;
  let pixelScale = 1;
  let frameSamples = [];
  let resizeHandler;
  let visHandler;
  let themeObserver;
  let uniforms = {};

  function isDarkTheme() {
    return document.body.classList.contains('dark-mode')
      || document.body.classList.contains('portfolio-dark');
  }

  function nightValue() {
    return isDarkTheme() ? 1 : 0;
  }

  function showStaticGradient() {
    const canvas = document.getElementById('iceCanvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dark = isDarkTheme();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      if (dark) {
        g.addColorStop(0, '#0a1420');
        g.addColorStop(0.35, '#0e2038');
        g.addColorStop(1, '#061018');
      } else {
        g.addColorStop(0, '#3d7aa8');
        g.addColorStop(0.45, '#5098be');
        g.addColorStop(1, '#2a6890');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    draw();
    const onResize = draw;
    window.addEventListener('resize', onResize);
    const obs = new MutationObserver(draw);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.ICE_OCEAN_SCENE = {
      dispose() {
        window.removeEventListener('resize', onResize);
        obs.disconnect();
      },
      setNight: draw,
      resize: draw,
    };
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

  function fetchFragmentShader() {
    return fetch(SHADER_URL).then((r) => {
      if (!r.ok) throw new Error('Shader fetch failed');
      return r.text();
    });
  }

  function resize() {
    const canvas = document.getElementById('iceCanvas');
    if (!canvas || !gl) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const w = Math.max(1, Math.floor(wrap.clientWidth * pixelScale));
    const h = Math.max(1, Math.floor(wrap.clientHeight * pixelScale));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = wrap.clientWidth + 'px';
    canvas.style.height = wrap.clientHeight + 'px';
    gl.viewport(0, 0, w, h);
  }

  function adaptQuality(frameMs) {
    frameSamples.push(frameMs);
    if (frameSamples.length < 45) return;
    const avg = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length;
    frameSamples = [];
    const prev = pixelScale;
    if (avg > 20 && pixelScale > 0.45) pixelScale *= 0.88;
    else if (avg < 11 && pixelScale < 1.25) pixelScale *= 1.06;
    pixelScale = Math.min(1.25, Math.max(0.45, pixelScale));
    if (Math.abs(prev - pixelScale) > 0.02) resize();
  }

  function render(now) {
    if (!running || !gl || !program) return;

    const t0 = performance.now();
    if (!startTime) startTime = now;
    const elapsed = (now - startTime) * 0.001;

    gl.useProgram(program);
    gl.uniform1f(uniforms.uTime, elapsed);
    gl.uniform1f(uniforms.uNight, night);
    gl.uniform2f(uniforms.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(uniforms.uFocal, 1.35, 1.35);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    adaptQuality(performance.now() - t0);
    rafId = requestAnimationFrame(render);
  }

  function start() {
    if (!gl || prefersReduced) return;
    running = true;
    rafId = requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function setNight(n) {
    night = typeof n === 'number' ? n : nightValue();
    if (!gl && window.ICE_OCEAN_SCENE && window.ICE_OCEAN_SCENE.resize) {
      window.ICE_OCEAN_SCENE.resize();
    }
  }

  function dispose() {
    stop();
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    if (visHandler) document.removeEventListener('visibilitychange', visHandler);
    if (themeObserver) themeObserver.disconnect();
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      gl = null;
    }
    program = null;
  }

  function boot() {
    const canvas = document.getElementById('iceCanvas');
    if (!canvas) return;

    if (prefersReduced) {
      showStaticGradient();
      return;
    }

    fetchFragmentShader()
      .then((fragSrc) => {
        gl = canvas.getContext('webgl2', {
          alpha: true,
          antialias: false,
          powerPreference: 'high-performance',
        });
        if (!gl) {
          showStaticGradient();
          return;
        }

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

        night = nightValue();
        pixelScale = Math.min(window.devicePixelRatio || 1, 1.15);
        resize();

        resizeHandler = resize;
        window.addEventListener('resize', resizeHandler);

        visHandler = () => {
          if (document.hidden) stop();
          else start();
        };
        document.addEventListener('visibilitychange', visHandler);

        themeObserver = new MutationObserver(() => {
          setNight(nightValue());
          resize();
        });
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        start();
        window.ICE_OCEAN_SCENE = { dispose, setNight, resize };
      })
      .catch(() => {
        showStaticGradient();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
