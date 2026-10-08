/**
 * Mesozoic sky — full-viewport WebGL2 fragment atmosphere.
 * Era palettes, sun, drifting cloud bands, parallax ridges, Cretaceous volcano
 * plume, rising embers, ambient meteors, and a 66 Ma impact beat.
 * Falls back to a CSS gradient when WebGL2 is unavailable.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const C = window.DinosaursCatalog;

  const VERT_SRC = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec3 uHaze;
uniform vec3 uCloud;
uniform vec3 uRidge;
uniform float uEmber;
uniform float uVolcano;
uniform float uMeteor;
uniform float uImpact;
uniform float uMotes;

out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  float horizon = 0.36 - uScroll * 0.05;

  float shimmer = sin(uv.y * 90.0 + t * 2.6) * 0.0018
    * smoothstep(horizon + 0.22, horizon, uv.y) * (0.3 + uEmber);
  vec2 p = vec2((uv.x - 0.5) * aspect + shimmer, uv.y);

  float h = clamp((uv.y - horizon) / (1.0 - horizon), 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
  col = mix(col, uHaze, smoothstep(horizon, horizon - 0.3, uv.y));

  // Stars fade in near the zenith at dusk.
  vec2 sc = floor(frag / 2.0);
  float star = step(0.9965, hash(sc)) * smoothstep(0.55, 1.0, uv.y);
  star *= 0.55 + 0.45 * sin(t * 2.0 + hash(sc + 3.0) * 40.0);
  col += vec3(1.0, 0.95, 0.85) * star * 0.7;

  // Sun disc, corona, and horizon streak.
  vec2 sunPos = vec2(aspect * 0.2, horizon + 0.085);
  float sd = length(p - sunPos);
  col += uSun * (exp(-sd * 7.0) * 0.6 + exp(-sd * 2.2) * 0.22);
  col += uSun * exp(-abs(p.y - sunPos.y) * 70.0) * exp(-abs(p.x - sunPos.x) * 1.4) * 0.28;
  col = mix(col, uSun * 1.25 + 0.1, smoothstep(0.058, 0.052, sd));

  // Cloud bands lit from the sun side.
  vec2 cp = vec2(p.x * 1.3 + t * 0.014, (uv.y - horizon) * 5.5);
  float cloud = fbm(cp * vec2(1.4, 1.0) + vec2(0.0, t * 0.008));
  cloud = smoothstep(0.48, 0.86, cloud)
    * smoothstep(horizon + 0.01, horizon + 0.1, uv.y)
    * smoothstep(1.0, 0.5, uv.y);
  float lit = exp(-length(p - sunPos) * 2.4);
  vec3 cloudCol = mix(uCloud * 0.55, uSun * 1.1, lit * 0.85);
  col = mix(col, cloudCol, cloud * 0.78);

  // Ambient meteor streaks (Cretaceous foreshadowing).
  if (uMeteor > 0.01) {
    float period = 9.0;
    float cycle = floor(t / period);
    float phase = fract(t / period);
    float seed = hash(vec2(cycle, 7.0));
    if (phase < 0.14) {
      float k = phase / 0.14;
      vec2 a = vec2((seed - 0.7) * aspect, 0.98 - seed * 0.1);
      vec2 dir = normalize(vec2(1.0, -0.42));
      vec2 head = a + dir * k * 0.9;
      float d = sdSegment(p, head, head - dir * 0.16);
      float tail = clamp(1.0 - length(p - head) / 0.16, 0.0, 1.0);
      col += vec3(1.0, 0.85, 0.6) * exp(-d * 380.0) * tail * uMeteor * (1.0 - k);
    }
  }

  // Ridges back to front, with the volcano rising from the middle layer.
  float vx = -0.34 * aspect;
  float craterTop = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    float base = horizon - 0.01 - k * 0.07 - uScroll * (0.02 + k * 0.04);
    float amp = 0.08 + k * 0.035;
    float freq = 2.4 - k * 0.55;
    float rh = base + (fbm(vec2(p.x * freq + k * 7.3, k * 3.1)) - 0.5) * amp * 1.7 + amp * 0.35;

    if (i == 1) {
      craterTop = base + 0.24;
      float cone = base + 0.27 - abs(p.x - vx) * 0.85;
      cone = min(cone, craterTop + (noise(vec2(p.x * 60.0, 1.0)) - 0.5) * 0.006);
      rh = mix(rh, max(rh, cone), uVolcano);
    }

    float mask = smoothstep(rh + 0.0025, rh - 0.0025, uv.y);
    vec3 rc = mix(uHaze, uRidge, 0.42 + k * 0.29);
    float rim = smoothstep(0.014, 0.0, rh - uv.y) * mask;
    rc += uSun * rim * (0.22 - k * 0.05) * (0.4 + lit);
    col = mix(col, rc, mask);

    if (i == 1 && uVolcano > 0.01) {
      // Lava rivulets down the cone.
      float inCone = mask * smoothstep(craterTop + 0.01, craterTop - 0.03, uv.y)
        * smoothstep(base - 0.05, base + 0.05, uv.y);
      float flowA = abs(p.x - vx - (craterTop - uv.y) * 0.32 - sin(uv.y * 70.0) * 0.004);
      float flowB = abs(p.x - vx + (craterTop - uv.y) * 0.45 + sin(uv.y * 55.0 + 1.3) * 0.005);
      float lava = (smoothstep(0.006, 0.0, flowA) + smoothstep(0.005, 0.0, flowB) * 0.8) * inCone;
      float pulse = 0.75 + 0.25 * sin(t * 2.2 - uv.y * 30.0);
      col += vec3(1.0, 0.38, 0.08) * lava * pulse * uVolcano * 1.4;

      // Crater glow.
      vec2 cg = (p - vec2(vx, craterTop)) * vec2(1.0, 2.2);
      col += vec3(1.0, 0.42, 0.1) * exp(-length(cg) * 16.0) * (0.85 + 0.15 * sin(t * 3.0)) * uVolcano;

      // Ash plume bending with the wind.
      vec2 q = p - vec2(vx, craterTop);
      if (q.y > 0.0) {
        float bend = q.y * q.y * 0.9;
        float n = fbm(vec2((q.x - bend) * 5.0, q.y * 3.2 - t * 0.22));
        float w = 0.025 + q.y * 0.32;
        float plume = smoothstep(w, w * 0.25, abs(q.x - bend + (n - 0.5) * 0.1))
          * smoothstep(0.8, 0.0, q.y) * n * 1.5;
        vec3 pc = mix(vec3(0.07, 0.05, 0.05), vec3(0.95, 0.32, 0.08), exp(-q.y * 8.0) * 0.85);
        col = mix(col, pc, clamp(plume, 0.0, 0.92) * uVolcano);
      }
    }

    if (i == 0) {
      col = mix(col, uHaze, exp(-abs(uv.y - horizon) * 16.0) * 0.28);
    }
  }

  // Rising embers / pollen motes.
  float emb = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float scale = 13.0 + fi * 9.0;
    vec2 ep = vec2(p.x, uv.y - t * (0.025 + 0.018 * fi)) * scale;
    vec2 id = floor(ep);
    vec2 f = fract(ep) - 0.5;
    float r = hash(id + fi * 17.0);
    if (r > 0.82) {
      vec2 off = vec2(hash(id + 3.0) - 0.5, hash(id + 7.0) - 0.5) * 0.6;
      off.x += sin(t * 1.4 + r * 30.0) * 0.18;
      float d = length(f - off);
      emb += smoothstep(0.09, 0.0, d) * (0.5 + 0.5 * sin(t * 4.0 + r * 50.0)) * (1.0 - fi * 0.25);
    }
  }
  vec3 emberCol = mix(uSun, vec3(1.0, 0.42, 0.12), clamp(uEmber, 0.0, 1.0));
  col += emberCol * emb * (0.18 + 0.82 * uEmber) * uMotes;

  // 66 Ma impact: fireball descent, then a shock dome on the horizon.
  if (uImpact >= 0.0) {
    float k = clamp(uImpact / 1.5, 0.0, 1.0);
    vec2 a = vec2(-0.6 * aspect, 1.08);
    vec2 b = vec2(0.3 * aspect, horizon + 0.01);
    vec2 head = mix(a, b, k * k);
    if (k < 1.0) {
      vec2 dir = normalize(b - a);
      float d = sdSegment(p, head, head - dir * 0.4);
      float tail = clamp(1.0 - length(p - head) / 0.4, 0.0, 1.0);
      col += vec3(1.0, 0.8, 0.5) * exp(-d * 90.0) * tail * 2.2;
      col += vec3(1.0, 0.55, 0.25) * exp(-length(p - head) * 9.0) * 0.9;
    }
    float e = uImpact - 1.5;
    if (e > 0.0) {
      float radius = e * 0.28;
      float ring = exp(-abs(length((p - b) * vec2(1.0, 1.7)) - radius) * 14.0) * exp(-e * 0.45);
      col += vec3(1.0, 0.72, 0.38) * ring * 2.0;
      col = mix(col, vec3(0.95, 0.38, 0.16), exp(-e * 0.35) * smoothstep(0.0, 0.25, e) * 0.55);
    }
  }

  col += (hash(frag + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;

  const PALETTE_KEYS = ['zenith', 'horizon', 'sun', 'haze', 'cloud', 'ridge'];
  const UNIFORM_FOR = {
    zenith: 'uZenith',
    horizon: 'uHorizon',
    sun: 'uSun',
    haze: 'uHaze',
    cloud: 'uCloud',
    ridge: 'uRidge',
  };

  const prefersReduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let canvas = null;
  let gl = null;
  let program = null;
  let uniforms = {};
  let raf = 0;
  let running = false;
  let booted = false;
  let live = false;
  let startTime = 0;
  let lastNow = 0;
  let pixelScale = 0.7;
  let frameSamples = [];
  let scroll = 0;
  let impactStart = -1;
  let eraId = 'cretaceous';
  let motes = 1;

  const current = { ember: 1, volcano: 1, meteor: 1 };
  const target = { ember: 1, volcano: 1, meteor: 1 };
  PALETTE_KEYS.forEach((key) => {
    current[key] = [0, 0, 0];
    target[key] = [0, 0, 0];
  });

  function paletteFor(id) {
    const era = C && C.eraById(id);
    if (!era) return null;
    const out = {
      ember: era.ember,
      volcano: era.id === 'cretaceous' ? 1 : 0,
      meteor: era.id === 'cretaceous' ? 1 : 0,
    };
    PALETTE_KEYS.forEach((key) => {
      out[key] = C.hexToRgb01(era.sky[key]);
    });
    return out;
  }

  function cssFallback(id) {
    const era = C && C.eraById(id);
    if (!canvas || !era) return;
    const s = era.sky;
    canvas.style.background = [
      `radial-gradient(circle at 70% 58%, ${s.sun} 0 3%, transparent 14%)`,
      `radial-gradient(ellipse 70% 30% at 70% 60%, ${s.horizon}, transparent 70%)`,
      `linear-gradient(180deg, ${s.zenith} 0%, ${s.cloud} 42%, ${s.horizon} 62%, ${s.ridge} 64%, ${s.haze} 100%)`,
    ].join(', ');
  }

  function compile(type, src) {
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

  function link() {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'Program link failed');
    }
    return p;
  }

  function resize() {
    if (!gl || !canvas) return;
    const w = Math.max(1, Math.floor(window.innerWidth * pixelScale));
    const h = Math.max(1, Math.floor(window.innerHeight * pixelScale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    if (!running) draw(lastNow || performance.now());
  }

  function adaptQuality(frameMs) {
    frameSamples.push(frameMs);
    if (frameSamples.length < 40) return;
    const avg = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length;
    frameSamples = [];
    const prev = pixelScale;
    if (avg > 22 && pixelScale > 0.35) pixelScale *= 0.85;
    else if (avg < 10 && pixelScale < 0.9) pixelScale *= 1.06;
    pixelScale = Math.min(0.9, Math.max(0.35, pixelScale));
    if (Math.abs(prev - pixelScale) > 0.02) resize();
  }

  function blend(dt) {
    const k = dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.4);
    PALETTE_KEYS.forEach((key) => {
      for (let i = 0; i < 3; i += 1) {
        current[key][i] += (target[key][i] - current[key][i]) * k;
      }
    });
    ['ember', 'volcano', 'meteor'].forEach((key) => {
      current[key] += (target[key] - current[key]) * k;
    });
  }

  function draw(now) {
    if (!gl || !program) return;
    const elapsed = prefersReduced ? 12 : (now - startTime) * 0.001;
    gl.useProgram(program);
    gl.uniform2f(uniforms.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(uniforms.uTime, elapsed);
    gl.uniform1f(uniforms.uScroll, scroll);
    PALETTE_KEYS.forEach((key) => {
      gl.uniform3fv(uniforms[UNIFORM_FOR[key]], current[key]);
    });
    gl.uniform1f(uniforms.uEmber, current.ember);
    gl.uniform1f(uniforms.uVolcano, current.volcano);
    gl.uniform1f(uniforms.uMeteor, prefersReduced ? 0 : current.meteor);
    const impact = impactStart < 0 ? -1 : (now - impactStart) * 0.001;
    if (impact > 14) impactStart = -1;
    gl.uniform1f(uniforms.uImpact, impactStart < 0 ? -1 : impact);
    gl.uniform1f(uniforms.uMotes, motes);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const t0 = performance.now();
    const dt = lastNow ? Math.min(0.1, (now - lastNow) * 0.001) : 0.016;
    lastNow = now;
    blend(dt);
    draw(now);
    adaptQuality(performance.now() - t0);
  }

  function start() {
    if (!gl || prefersReduced || running) return;
    running = true;
    lastNow = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function boot() {
    if (booted) return;
    booted = true;
    canvas = document.getElementById('dinoSky');
    if (!canvas || !C) return;
    cssFallback(eraId);

    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: 'high-performance',
      });
      if (!gl) return;
      program = link();
    } catch (err) {
      console.warn('Dinosaur sky: WebGL2 unavailable, using CSS sky', err);
      gl = null;
      program = null;
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    [
      'uRes', 'uTime', 'uScroll', 'uZenith', 'uHorizon', 'uSun', 'uHaze', 'uCloud', 'uRidge',
      'uEmber', 'uVolcano', 'uMeteor', 'uImpact', 'uMotes',
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    const initial = paletteFor(eraId);
    if (initial) {
      Object.assign(target, initial);
      PALETTE_KEYS.forEach((key) => { current[key] = initial[key].slice(); });
      current.ember = initial.ember;
      current.volcano = initial.volcano;
      current.meteor = initial.meteor;
    }

    live = true;
    canvas.style.background = 'none';
    pixelScale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
    startTime = performance.now();
    resize();

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', () => {
      scroll = Math.min(2, window.scrollY / Math.max(1, window.innerHeight));
      if (!running) draw(performance.now());
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      stop();
      live = false;
      cssFallback(eraId);
    });

    if (prefersReduced) draw(performance.now());
    else start();
  }

  function setEra(id, opts) {
    const palette = paletteFor(id);
    if (!palette) return;
    eraId = id;
    if (!booted) boot();
    if (!live) {
      cssFallback(id);
      return;
    }
    Object.assign(target, palette);
    PALETTE_KEYS.forEach((key) => { target[key] = palette[key].slice(); });
    if ((opts && opts.instant) || prefersReduced) {
      blend(0);
      draw(performance.now());
    }
  }

  function impact() {
    if (!live || prefersReduced) return false;
    impactStart = performance.now();
    return true;
  }

  function setMotes(level) {
    motes = Math.max(0, Math.min(1, Number(level)));
    if (live && !running) draw(performance.now());
  }

  window.DinosaursSky = {
    boot,
    setEra,
    impact,
    setMotes,
    isLive: () => live,
  };
})();
