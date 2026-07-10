/**
 * Finance Wall of Fire — Three.js auth gate scene.
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
  let resizeHandler = null;
  let visHandler = null;
  let wallMesh = null;
  let emberPoints = null;
  let sparkPoints = null;
  let running = false;
  let reducedMotion = false;

  const FIRE_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const FIRE_FRAG = /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uResolution;

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
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = m * p;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      float t = uTime;

      // Vertical wall: denser fire in a central band, rising turbulence
      float wallMask = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
      wallMask *= smoothstep(0.0, 0.08, uv.y) * smoothstep(1.05, 0.55, uv.y);

      vec2 q = vec2(uv.x * 3.2, uv.y * 2.4 - t * 1.15);
      float n1 = fbm(q * 2.4 + vec2(0.0, t * 0.4));
      float n2 = fbm(q * 4.8 - vec2(t * 0.25, t * 0.9));
      float flame = n1 * 0.65 + n2 * 0.45;
      flame *= wallMask;
      flame = pow(clamp(flame, 0.0, 1.0), 1.35);

      // Shape tongues of fire
      float tongue = smoothstep(0.15, 0.75, flame * (1.1 - uv.y * 0.55));
      float core = smoothstep(0.45, 0.95, flame);

      vec3 colDeep = vec3(0.35, 0.02, 0.0);
      vec3 colMid = vec3(0.95, 0.28, 0.02);
      vec3 colHot = vec3(1.0, 0.72, 0.18);
      vec3 colWhite = vec3(1.0, 0.95, 0.75);

      vec3 col = mix(colDeep, colMid, tongue);
      col = mix(col, colHot, core * 0.85);
      col = mix(col, colWhite, pow(core, 2.4) * 0.55);

      // Ember glow near base
      float baseGlow = exp(-pow((uv.y - 0.08) / 0.22, 2.0)) * wallMask;
      col += vec3(1.0, 0.35, 0.05) * baseGlow * 0.55;

      // Soft vignette / heat haze alpha
      float alpha = clamp(tongue * 1.35 + baseGlow * 0.4, 0.0, 1.0);
      alpha *= 0.92;

      // Subtle horizontal shimmer
      float shimmer = 0.92 + 0.08 * sin(uv.y * 40.0 + t * 8.0 + n1 * 6.0);
      col *= shimmer;

      gl_FragColor = vec4(col, alpha);
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

    const title = homeMode ? 'Wall of Fire' : 'Encompass Firewall';
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
      '<div class="finance-fire-gate__card">' +
      '<div class="finance-fire-gate__ember" aria-hidden="true">🔥</div>' +
      '<p class="finance-fire-gate__kicker">Wall of Fire</p>' +
      '<h2 class="finance-fire-gate__title" id="financeFireGateTitle">' + title + '</h2>' +
      '<p class="finance-fire-gate__copy">' + copy + '</p>' +
      '<button type="button" class="finance-fire-gate__btn finance-fire-gate__btn--primary" id="financeAuthLoginBtn">Log In to Pass Through</button>' +
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

    return overlay;
  }

  function applyHomeMode(overlay, homeMode) {
    overlay.dataset.homeMode = homeMode ? '1' : '0';
    const titleEl = overlay.querySelector('#financeFireGateTitle');
    const copyEl = overlay.querySelector('.finance-fire-gate__copy');
    if (titleEl) titleEl.textContent = homeMode ? 'Wall of Fire' : 'Encompass Firewall';
    if (copyEl) {
      copyEl.textContent = homeMode
        ? 'Encompass and Worksheets tools burn behind this wall until you log in. Public demos stay open beyond the flames.'
        : 'Worksheets and Encompass tools stay behind the wall of fire until you log in.';
    }
  }

  function makeEmberGeometry(THREE, count, spreadX, height, speedScale) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spreadX;
      positions[i * 3 + 1] = Math.random() * height - height * 0.35;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      velocities[i] = (0.35 + Math.random() * 0.9) * speedScale;
      sizes[i] = 0.02 + Math.random() * 0.06;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(velocities, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.userData = { height: height, spreadX: spreadX };
    return geo;
  }

  function buildScene(canvas) {
    const THREE = global.THREE;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
    camera.position.set(0, 0.15, 4.2);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x0a0402, 1);

    // Ambient heat glow
    const amb = new THREE.AmbientLight(0xff6a20, 0.35);
    scene.add(amb);
    const point = new THREE.PointLight(0xff9020, 2.2, 12);
    point.position.set(0, -0.4, 2.2);
    scene.add(point);

    // Fire wall plane
    const wallGeo = new THREE.PlaneGeometry(6.5, 4.2, 1, 1);
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: FIRE_VERT,
      fragmentShader: FIRE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(0, 0.1, 0);
    scene.add(wallMesh);

    // Secondary softer wall for depth
    const backMat = wallMat.clone();
    backMat.uniforms = {
      uTime: wallMat.uniforms.uTime,
      uResolution: wallMat.uniforms.uResolution,
    };
    const backWall = new THREE.Mesh(wallGeo.clone(), backMat);
    backWall.position.set(0, 0.05, -0.35);
    backWall.scale.set(1.08, 1.05, 1);
    scene.add(backWall);

    // Ember particles
    const emberGeo = makeEmberGeometry(THREE, 420, 5.5, 3.8, 1);
    const emberMat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    emberPoints = new THREE.Points(emberGeo, emberMat);
    scene.add(emberPoints);

    const sparkGeo = makeEmberGeometry(THREE, 180, 4.2, 3.2, 1.4);
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffe8a0,
      size: 0.028,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkPoints);

    // Floor glow disc
    const discGeo = new THREE.CircleGeometry(2.8, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xff4a00,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, -1.55, 0.4);
    scene.add(disc);
  }

  function advanceParticles(points, dt) {
    if (!points) return;
    const pos = points.geometry.attributes.position;
    const speed = points.geometry.attributes.aSpeed;
    const height = points.geometry.userData.height || 3.5;
    const spreadX = points.geometry.userData.spreadX || 5;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + speed.getX(i) * dt;
      let x = pos.getX(i) + Math.sin(startTime * 2 + i) * 0.002;
      if (y > height * 0.55) {
        y = -height * 0.4 + Math.random() * 0.2;
        x = (Math.random() - 0.5) * spreadX;
      }
      pos.setX(i, x);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  function onResize() {
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (wallMesh && wallMesh.material && wallMesh.material.uniforms) {
      wallMesh.material.uniforms.uResolution.value.set(w, h);
    }
  }

  function tick(now) {
    if (!running || !renderer || !scene || !camera) return;
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;

    const t = (now - startTime) * 0.001;
    if (wallMesh && wallMesh.material && wallMesh.material.uniforms) {
      wallMesh.material.uniforms.uTime.value = t;
    }

    const dt = Math.min(0.05, 0.016);
    advanceParticles(emberPoints, dt);
    advanceParticles(sparkPoints, dt * 1.15);

    if (camera) {
      camera.position.x = Math.sin(t * 0.35) * 0.12;
      camera.position.y = 0.15 + Math.sin(t * 0.22) * 0.04;
      camera.lookAt(0, 0.05, 0);
    }

    renderer.render(scene, camera);
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
    if (renderer) {
      try {
        renderer.dispose();
      } catch (_) {}
      renderer = null;
    }
    scene = null;
    camera = null;
    wallMesh = null;
    emberPoints = null;
    sparkPoints = null;
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

    reducedMotion = prefersReducedMotion();
    if (reducedMotion) {
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
    disposeScene();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
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
