/**
 * Finance Wall of Fire — realistic Three.js flame wall.
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  const THREE_CDN = 'https://unpkg.com/three@0.161.0/build/three.min.js';
  const OVERLAY_ID = 'financeAuthOverlay';

  let renderer = null;
  let scene = null;
  let camera = null;
  let rafId = 0;
  let startTime = 0;
  let lastFrame = 0;
  let resizeHandler = null;
  let visHandler = null;
  let flameLayers = [];
  let emberSystems = [];
  let heatLight = null;
  let coalMesh = null;
  let smokeMesh = null;
  let running = false;

  let burnAudio = null;
  let songPlaying = false;
  const SONG_MUTE_KEY = 'financeFireGateMuteSong';
  /** Real MP3: Loyalty Freak Music — I'M ON FIRE (CC0). Not The Trammps' Disco Inferno. */
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
      audio.volume = 0.72;
      audio.preload = 'auto';
      burnAudio = audio;
      songPlaying = true;

      audio.onerror = () => {
        console.warn(
          'Wall of Fire song missing at public/shared/audio/im-on-fire.mp3'
        );
        songPlaying = false;
        burnAudio = null;
        const copy = document.querySelector('.finance-fire-gate__copy');
        if (copy && !copy.dataset.songHint) {
          copy.dataset.songHint = '1';
          copy.textContent +=
            ' (Song file missing — add public/shared/audio/im-on-fire.mp3.)';
        }
      };

      await audio.play();
    } catch (err) {
      // Autoplay blocked — first tap on the wall will retry via unlock handler
      songPlaying = false;
      console.warn('Wall of Fire song autoplay waiting for tap:', err && err.message);
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

  const FLAME_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Narrow flame column — teardrop alpha kills the rectangular plane edges
  const FLAME_COLUMN_VERT = /* glsl */ `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uSeed;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float sway = sin(uv.y * 7.5 + uTime * (2.4 + uSeed) + uSeed * 12.0) * 0.14 * uv.y;
      sway += sin(uv.y * 13.0 - uTime * 3.1 + uSeed * 5.0) * 0.05 * uv.y;
      pos.x += sway;
      pos.z += cos(uv.y * 5.0 + uTime * 1.8 + uSeed) * 0.04 * uv.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const FLAME_COLUMN_FRAG = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uSeed;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.05 + vec2(1.7, 9.2);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float x = (uv.x - 0.5) * 2.0;
      float y = uv.y;

      float width = mix(0.92, 0.05, pow(y, 0.78));
      float edge = abs(x) / max(width, 0.04);
      float body = 1.0 - smoothstep(0.42, 1.0, edge);
      body *= smoothstep(0.0, 0.07, y) * smoothstep(1.02, 0.22, y);
      body *= 0.45 + 0.55 * (1.0 - y);

      float rise = uTime * (1.35 + fract(uSeed * 0.31) * 0.8) + uSeed * 4.0;
      float n = fbm(vec2(x * 1.6 + uSeed, y * 4.2 - rise));
      float n2 = fbm(vec2(x * 3.0 + uSeed * 2.0, y * 7.0 - rise * 1.6));
      body *= 0.42 + 0.85 * n;
      body += n2 * 0.18 * (1.0 - y);
      body = clamp(body, 0.0, 1.2);

      if (body < 0.06) discard;

      float core = smoothstep(0.28, 0.82, body);
      float tip = smoothstep(0.5, 1.0, body) * pow(1.0 - y, 1.1);

      vec3 col = mix(vec3(0.42, 0.02, 0.0), vec3(1.0, 0.3, 0.02), core);
      col = mix(col, vec3(1.0, 0.76, 0.14), pow(core, 1.4) * 0.9);
      col = mix(col, vec3(1.0, 0.96, 0.82), pow(tip, 1.5) * 0.8);

      float base = exp(-pow(y / 0.14, 2.0)) * smoothstep(0.15, 0.75, 1.0 - abs(x));
      col += vec3(1.0, 0.35, 0.04) * base * 0.55;

      float flicker = 0.86 + 0.14 * sin(uTime * 11.0 + uSeed * 20.0 + n * 6.0);
      col *= flicker * uIntensity;

      float alpha = body * (0.82 + tip * 0.35) * uIntensity;
      alpha = pow(clamp(alpha, 0.0, 1.0), 1.15);
      if (alpha < 0.04) discard;

      gl_FragColor = vec4(col, alpha);
    }
  `;

  const SMOKE_FRAG = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.03;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float t = uTime * 0.35;
      float n = fbm(vec2(uv.x * 2.5, uv.y * 1.6 - t));
      float plume = smoothstep(0.35, 0.9, n) * smoothstep(0.12, 0.6, uv.y) * smoothstep(1.1, 0.5, uv.y);
      float side = smoothstep(0.05, 0.25, uv.x) * smoothstep(0.95, 0.75, uv.x);
      float a = plume * side * 0.18;
      if (a < 0.01) discard;
      vec3 col = vec3(0.08, 0.06, 0.05);
      gl_FragColor = vec4(col, a);
    }
  `;

  const EMBER_VERT = /* glsl */ `
    attribute float aSpeed;
    attribute float aSize;
    attribute float aSeed;
    uniform float uTime;
    varying float vLife;
    varying float vSeed;
    void main() {
      vSeed = aSeed;
      vec3 p = position;
      float life = fract(aSeed + uTime * aSpeed * 0.12);
      vLife = life;
      p.y += life * 3.6;
      p.x += sin(uTime * (1.2 + aSeed) + aSeed * 40.0) * 0.18 * life;
      p.z += cos(uTime * (0.9 + aSeed * 0.5) + aSeed * 20.0) * 0.12 * life;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float fade = 1.0 - life;
      gl_PointSize = aSize * (280.0 / max(-mv.z, 0.5)) * (0.55 + fade * 0.9);
      gl_Position = projectionMatrix * mv;
    }
  `;

  const EMBER_FRAG = /* glsl */ `
    precision highp float;
    varying float vLife;
    varying float vSeed;
    void main() {
      vec2 p = gl_PointCoord;
      p.y = 1.0 - p.y;
      float x = (p.x - 0.5) * 2.0;
      float y = p.y;
      float width = mix(1.0, 0.08, pow(y, 0.65));
      float edge = abs(x) / max(width, 0.05);
      if (edge > 1.0 || y < 0.0 || y > 1.0) discard;
      float soft = (1.0 - smoothstep(0.35, 1.0, edge)) * smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.55, y);
      soft = pow(soft, 1.15);
      if (soft < 0.02) discard;
      float lifeFade = pow(1.0 - vLife, 0.85);
      vec3 hot = mix(vec3(1.0, 0.92, 0.55), vec3(1.0, 0.28, 0.02), vLife);
      hot = mix(hot, vec3(1.0, 0.98, 0.85), soft * (1.0 - vLife) * 0.45);
      float spark = mix(0.65, 1.0, step(0.72, fract(vSeed * 17.3)));
      gl_FragColor = vec4(hot * spark, soft * lifeFade * 0.9);
    }
  `;

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (global.THREE) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Three.js')));
        if (global.THREE) resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Three.js'));
      document.head.appendChild(script);
    });
  }

  function ensureStyles() {
    if (document.querySelector('link[data-finance-fire-gate]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/shared/css/finance-fire-gate.css';
    link.setAttribute('data-finance-fire-gate', '1');
    document.head.appendChild(link);
  }

  function createOverlayShell(options) {
    const opts = options || {};
    const homeMode = !!opts.homeMode;
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      applyHomeMode(overlay, homeMode);
      return overlay;
    }

    const copy = homeMode
      ? 'Encompass and Worksheets tools burn behind this wall until you log in. Public demos stay open beyond the flames.'
      : 'Worksheets and Encompass tools stay behind the wall of fire until you log in.';
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
      '<h2 class="finance-fire-gate__skyline" id="financeFireGateTitle">Burn Baby Burn</h2>' +
      '<div class="finance-fire-gate__card">' +
      '<div class="finance-fire-gate__ember" aria-hidden="true">🔥</div>' +
      '<p class="finance-fire-gate__copy">' + copy + '</p>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--primary" id="financeAuthLoginBtn">Log In to Pass Through</button>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--ghost" id="financeAuthMuteBtn" aria-pressed="false">Mute song</button>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--ghost" id="' + secondaryId + '">' + secondaryLabel + '</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

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

    // Autoplay often needs a gesture — first tap starts the jam if blocked
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
    if (titleEl) titleEl.textContent = 'Burn Baby Burn';
    if (copyEl) {
      copyEl.textContent = homeMode
        ? 'Encompass and Worksheets tools burn behind this wall until you log in. Public demos stay open beyond the flames.'
        : 'Worksheets and Encompass tools stay behind the wall of fire until you log in.';
    }
  }

  function makeEmberSystem(THREE, count, spreadX, z, sizeScale, speedScale) {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spreadX;
      positions[i * 3 + 1] = -1.6 + Math.random() * 0.6;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
      speeds[i] = (0.55 + Math.random() * 1.4) * speedScale;
      sizes[i] = (0.035 + Math.random() * 0.09) * sizeScale;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      alphaTest: 0.03,
    });
    return new THREE.Points(geo, mat);
  }

  function makeFlameColumn(THREE, colIndex, colCount, layerIndex, intensity, z, xJitter) {
    const seed = colIndex * 0.73 + layerIndex * 2.17 + 0.41;
    const t = colCount > 1 ? colIndex / (colCount - 1) : 0.5;
    const x = (t - 0.5) * 6.4 + xJitter;
    const width = 0.28 + Math.sin(seed * 4.1) * 0.07;
    const height = 3.6 + Math.sin(seed * 2.8) * 0.55 + layerIndex * 0.12;
    const geo = new THREE.PlaneGeometry(width, height, 1, 24);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLAME_COLUMN_VERT,
      fragmentShader: FLAME_COLUMN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uSeed: { value: seed },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, -1.55 + height * 0.5, z);
    mesh.rotation.z = Math.sin(seed * 3.3) * 0.04;
    mesh.userData.layerIndex = layerIndex;
    return mesh;
  }

  function buildFlameWall(THREE) {
    const layers = [
      { cols: 18, z: 0.12, intensity: 1.0, jitter: 0.0 },
      { cols: 15, z: -0.28, intensity: 0.82, jitter: 0.11 },
      { cols: 12, z: 0.38, intensity: 0.68, jitter: -0.08 },
    ];
    const meshes = [];
    layers.forEach((layer, layerIndex) => {
      for (let i = 0; i < layer.cols; i++) {
        const jitter = layer.jitter + (Math.sin(i * 1.9 + layerIndex) * 0.07);
        meshes.push(
          makeFlameColumn(THREE, i, layer.cols, layerIndex, layer.intensity, layer.z, jitter)
        );
      }
    });
    return meshes;
  }

  function buildScene(canvas) {
    const THREE = global.THREE;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090201, 0.045);

    camera = new THREE.PerspectiveCamera(50, w / Math.max(h, 1), 0.1, 100);
    camera.position.set(0, 0.2, 4.0);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x070201, 1);
    if (renderer.outputColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;
    }

    scene.add(new THREE.AmbientLight(0xff4a10, 0.55));
    heatLight = new THREE.PointLight(0xff7a20, 3.4, 16, 2);
    heatLight.position.set(0, -0.6, 2.0);
    scene.add(heatLight);

    const fill = new THREE.PointLight(0xff2200, 1.6, 14, 2);
    fill.position.set(0, -1.2, 1.2);
    scene.add(fill);

    flameLayers = buildFlameWall(THREE);
    flameLayers.forEach((m) => scene.add(m));

    // Rising smoke plume behind flames
    const smokeGeo = new THREE.PlaneGeometry(7.2, 5.0, 1, 1);
    const smokeMat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
    smokeMesh.position.set(0, 0.35, -0.7);
    scene.add(smokeMesh);

    // Glowing coal bed
    const coalGeo = new THREE.CircleGeometry(3.2, 64);
    const coalMat = new THREE.MeshBasicMaterial({
      color: 0xff3a00,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    coalMesh = new THREE.Mesh(coalGeo, coalMat);
    coalMesh.rotation.x = -Math.PI / 2;
    coalMesh.position.set(0, -1.7, 0.35);
    scene.add(coalMesh);

    const coalInner = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffcc66,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coalInner.rotation.x = -Math.PI / 2;
    coalInner.position.set(0, -1.68, 0.35);
    scene.add(coalInner);

    emberSystems = [
      makeEmberSystem(THREE, 700, 5.8, 0.15, 1.0, 1.0),
      makeEmberSystem(THREE, 320, 4.6, -0.25, 0.7, 1.35),
      makeEmberSystem(THREE, 180, 3.8, 0.45, 1.35, 0.75),
    ];
    emberSystems.forEach((p) => scene.add(p));
  }

  function onResize() {
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function tick(now) {
    if (!running || !renderer || !scene || !camera) return;
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;

    const t = (now - startTime) * 0.001;
    const dt = Math.min(0.05, ((now - lastFrame) || 16) * 0.001);
    lastFrame = now;

    flameLayers.forEach((mesh, i) => {
      if (mesh.material && mesh.material.uniforms) {
        mesh.material.uniforms.uTime.value = t + (mesh.userData.layerIndex || 0) * 0.45;
      }
      const seed = mesh.material?.uniforms?.uSeed?.value || i;
      mesh.rotation.z = Math.sin(t * 0.4 + seed) * 0.018;
    });

    if (smokeMesh && smokeMesh.material && smokeMesh.material.uniforms) {
      smokeMesh.material.uniforms.uTime.value = t;
    }

    emberSystems.forEach((points) => {
      if (points.material && points.material.uniforms) {
        points.material.uniforms.uTime.value = t;
      }
    });

    if (heatLight) {
      heatLight.intensity = 2.8 + Math.sin(t * 7.5) * 0.7 + Math.sin(t * 13.0) * 0.35;
      heatLight.position.x = Math.sin(t * 1.1) * 0.25;
    }

    if (coalMesh) {
      coalMesh.material.opacity = 0.22 + Math.sin(t * 5.5) * 0.06;
      coalMesh.scale.setScalar(1 + Math.sin(t * 2.2) * 0.03);
    }

    camera.position.x = Math.sin(t * 0.28) * 0.14;
    camera.position.y = 0.18 + Math.sin(t * 0.19) * 0.05;
    camera.position.z = 4.0 + Math.sin(t * 0.15) * 0.08;
    camera.lookAt(0, 0.1, 0);

    renderer.render(scene, camera);
  }

  function showFallback(overlay) {
    const canvas = overlay.querySelector('#financeFireCanvas');
    const fallback = overlay.querySelector('#financeFireFallback');
    if (canvas) canvas.hidden = true;
    if (fallback) fallback.hidden = false;
  }

  function disposeObject(obj) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
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
    flameLayers.forEach(disposeObject);
    emberSystems.forEach(disposeObject);
    disposeObject(smokeMesh);
    disposeObject(coalMesh);
    flameLayers = [];
    emberSystems = [];
    smokeMesh = null;
    coalMesh = null;
    heatLight = null;
    if (renderer) {
      try {
        renderer.dispose();
      } catch (_) {}
      renderer = null;
    }
    scene = null;
    camera = null;
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

    // Kick off Burn Baby Burn as soon as the wall appears
    playBurnSong();

    if (prefersReducedMotion()) {
      showFallback(overlay);
      return overlay;
    }

    const canvas = overlay.querySelector('#financeFireCanvas');
    try {
      await loadScript(THREE_CDN);
      if (!global.THREE || !canvas) {
        showFallback(overlay);
        return overlay;
      }
      disposeScene();
      buildScene(canvas);
      startTime = performance.now();
      lastFrame = startTime;
      running = true;
      resizeHandler = onResize;
      window.addEventListener('resize', resizeHandler);
      visHandler = () => {
        if (!document.hidden && running && !rafId) {
          rafId = requestAnimationFrame(tick);
        }
      };
      document.addEventListener('visibilitychange', visHandler);
      rafId = requestAnimationFrame(tick);
      const fallback = overlay.querySelector('#financeFireFallback');
      if (fallback) fallback.hidden = true;
      if (canvas) canvas.hidden = false;
    } catch (err) {
      console.warn('Finance fire gate: WebGL unavailable, using fallback', err);
      showFallback(overlay);
    }
    return overlay;
  }

  function unmount() {
    stopBurnSong();
    disposeScene();
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
    } else if (renderer && scene && camera && !prefersReducedMotion()) {
      running = true;
      startTime = performance.now();
      lastFrame = startTime;
      rafId = requestAnimationFrame(tick);
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
