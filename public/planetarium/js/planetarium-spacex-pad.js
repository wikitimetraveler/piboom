/**
 * SpaceX launch pad — Three.js lift-off mockup.
 * One WebGL context, procedural vehicles, ignition plume, camera crane.
 * Development work by David Lane
 */
import * as THREE from 'three';

const LOOP = 12;
const VEHICLE_ORDER = ['falcon-9', 'falcon-heavy', 'starship', 'falcon-1'];
const TITLES = {
  'falcon-1': 'Falcon 1',
  'falcon-9': 'Falcon 9',
  'falcon-heavy': 'Falcon Heavy',
  starship: 'Starship',
};

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function makeMat(params) {
  return new THREE.MeshStandardMaterial(params);
}

function addMesh(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x || 0, y || 0, z || 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function buildFalconCore(mats, opts) {
  const g = new THREE.Group();
  const h = opts.height || 6.4;
  const r = opts.radius || 0.3;
  addMesh(g, new THREE.CylinderGeometry(r, r, h, 20), mats.white, 0, h / 2, 0);
  addMesh(g, new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.55, 20), mats.black, 0, h * 0.72, 0);
  if (!opts.noFairing) {
    addMesh(g, new THREE.ConeGeometry(r, 0.85, 18), mats.white, 0, h + 0.4, 0);
  } else {
    addMesh(g, new THREE.CylinderGeometry(r * 0.7, r, 0.35, 16), mats.black, 0, h + 0.15, 0);
  }
  const legs = opts.legs !== false;
  if (legs) {
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const leg = addMesh(g, new THREE.BoxGeometry(0.06, 0.9, 0.04), mats.black, Math.cos(a) * (r + 0.18), 0.35, Math.sin(a) * (r + 0.18));
      leg.rotation.z = Math.cos(a) * 0.45;
      leg.rotation.x = -Math.sin(a) * 0.45;
    }
  }
  if (opts.fins) {
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      const fin = addMesh(g, new THREE.BoxGeometry(0.42, 0.18, 0.04), mats.black, Math.cos(a) * (r + 0.18), h * 0.78, Math.sin(a) * (r + 0.18));
      fin.rotation.y = a;
    }
  }
  const ring = opts.engines || 9;
  for (let i = 0; i < ring; i += 1) {
    const a = (i / ring) * Math.PI * 2;
    const rad = ring === 1 ? 0 : r * 0.55;
    addMesh(g, new THREE.ConeGeometry(0.07, 0.22, 8), mats.engine, Math.cos(a) * rad, -0.08, Math.sin(a) * rad);
  }
  if (ring > 1) addMesh(g, new THREE.ConeGeometry(0.07, 0.22, 8), mats.engine, 0, -0.08, 0);
  return g;
}

function buildStarship(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(0.52, 0.54, 5.4, 24), mats.steel, 0, 2.7, 0);
  addMesh(g, new THREE.CylinderGeometry(0.5, 0.52, 3.4, 24), mats.steel, 0, 6.9, 0);
  addMesh(g, new THREE.ConeGeometry(0.5, 1.15, 20), mats.steel, 0, 9.18, 0);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const flap = addMesh(
      g,
      new THREE.BoxGeometry(i < 2 ? 0.7 : 0.45, 1.1, 0.05),
      mats.steelDark,
      Math.cos(a) * 0.62,
      i < 2 ? 7.4 : 3.2,
      Math.sin(a) * 0.62
    );
    flap.rotation.y = a;
  }
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    addMesh(g, new THREE.ConeGeometry(0.08, 0.28, 7), mats.engine, Math.cos(a) * 0.32, -0.12, Math.sin(a) * 0.32);
  }
  return g;
}

function buildFalcon1(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(0.2, 0.22, 1.7, 16), mats.black, 0, 0.85, 0);
  addMesh(g, new THREE.CylinderGeometry(0.2, 0.2, 1.9, 16), mats.white, 0, 2.6, 0);
  addMesh(g, new THREE.ConeGeometry(0.2, 0.7, 14), mats.white, 0, 3.9, 0);
  addMesh(g, new THREE.ConeGeometry(0.1, 0.28, 8), mats.engine, 0, -0.1, 0);
  return g;
}

function buildPlume(mats) {
  const g = new THREE.Group();
  const inner = addMesh(g, new THREE.ConeGeometry(0.18, 1.8, 12, 1, true), mats.flameInner, 0, -1.05, 0);
  inner.rotation.x = Math.PI;
  const outer = addMesh(g, new THREE.ConeGeometry(0.38, 2.5, 12, 1, true), mats.flameOuter, 0, -1.45, 0);
  outer.rotation.x = Math.PI;
  g.scale.set(0.01, 0.01, 0.01);
  g.visible = false;
  g.userData.inner = inner;
  g.userData.outer = outer;
  return g;
}

function buildPad(mats, geos) {
  const g = new THREE.Group();
  addMesh(g, geos.ground, mats.ground, 0, -0.04, 0);
  addMesh(g, geos.deck, mats.pad, 0, 0.02, 0);
  addMesh(g, geos.trench, mats.trench, 0, -0.12, 0);
  const tower = addMesh(g, geos.tower, mats.tower, -3.4, 4.2, -1.6);
  tower.rotation.y = 0.2;
  for (let i = 0; i < 6; i += 1) {
    addMesh(g, geos.rail, mats.black, -3.4, 1.2 + i * 1.15, -1.6);
  }
  return g;
}

function starField() {
  const count = 500;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 40 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.72 + 0.08);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xdde6ff, size: 0.12, transparent: true, opacity: 0.85 });
  return new THREE.Points(geo, mat);
}

function smokeCloud() {
  const count = 180;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = Math.random() * 0.4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xc9d0d8,
    size: 0.55,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.base = pos.slice();
  return pts;
}

function formatClock(t) {
  if (t < 2.6) {
    const left = Math.max(0, 2.6 - t);
    return 'T−' + left.toFixed(1) + 's';
  }
  return 'T+' + (t - 2.6).toFixed(1) + 's';
}

export function createSpacexPad(container, opts) {
  if (!container || typeof WebGLRenderingContext === 'undefined') return null;
  const reduced = prefersReducedMotion();
  const clockEl = opts && opts.clockEl;
  const titleEl = opts && opts.titleEl;
  const stillEl = opts && opts.stillEl;
  const phaseEl = opts && opts.phaseEl;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.42;
  renderer.setClearColor(0x05070f, 1);
  container.prepend(renderer.domElement);
  renderer.domElement.className = 'sx-pad__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  if (stillEl) stillEl.hidden = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x081018, 0.028);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);

  const mats = {
    white: makeMat({ color: 0xf3f5f8, roughness: 0.32, metalness: 0.18 }),
    black: makeMat({ color: 0x1b1e24, roughness: 0.45, metalness: 0.25 }),
    steel: makeMat({ color: 0xc5ccd3, roughness: 0.22, metalness: 0.88 }),
    steelDark: makeMat({ color: 0x8b939c, roughness: 0.28, metalness: 0.8 }),
    engine: makeMat({ color: 0x4a2a12, emissive: 0xff6a18, emissiveIntensity: 0.15, roughness: 0.4 }),
    pad: makeMat({ color: 0x4a515c, roughness: 0.85, metalness: 0.05 }),
    ground: makeMat({ color: 0x141820, roughness: 1, metalness: 0 }),
    trench: makeMat({ color: 0x2a241c, roughness: 0.9, metalness: 0.05 }),
    tower: makeMat({ color: 0x6a7380, roughness: 0.4, metalness: 0.45 }),
    flameInner: new THREE.MeshBasicMaterial({
      color: 0xfff1b0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    flameOuter: new THREE.MeshBasicMaterial({
      color: 0xff7a28,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  const geos = {
    ground: new THREE.CircleGeometry(48, 48),
    deck: new THREE.CylinderGeometry(5.2, 5.4, 0.12, 40),
    trench: new THREE.BoxGeometry(2.2, 0.3, 8),
    tower: new THREE.BoxGeometry(0.55, 8.4, 0.55),
    rail: new THREE.BoxGeometry(1.6, 0.08, 0.08),
  };
  geos.ground.rotateX(-Math.PI / 2);

  scene.add(new THREE.HemisphereLight(0xb7c8ea, 0x24180e, 0.82));
  const moon = new THREE.DirectionalLight(0xe8eef8, 1.05);
  moon.position.set(-10, 16, 10);
  scene.add(moon);
  const floodA = new THREE.PointLight(0xffe6b0, 2.2, 32, 2);
  floodA.position.set(6, 5.5, 7);
  scene.add(floodA);
  const floodB = new THREE.PointLight(0x9ec4ff, 1.15, 28, 2);
  floodB.position.set(-7, 6.5, 5);
  scene.add(floodB);
  const engineLight = new THREE.PointLight(0xff8a30, 0, 18, 2);
  engineLight.position.set(0, 0.4, 0);
  scene.add(engineLight);

  const stars = starField();
  scene.add(stars);
  scene.add(buildPad(mats, geos));
  const horizon = new THREE.Mesh(
    new THREE.RingGeometry(18, 42, 64),
    new THREE.MeshBasicMaterial({
      color: 0x243656,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = 0.01;
  scene.add(horizon);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 40),
    new THREE.MeshBasicMaterial({
      color: 0xff8a3d,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.08;
  scene.add(glow);
  const smoke = smokeCloud();
  scene.add(smoke);

  const vehicles = {
    'falcon-1': buildFalcon1(mats),
    'falcon-9': buildFalconCore(mats, { height: 6.5, radius: 0.3, fins: true }),
    'falcon-heavy': (function () {
      const wrap = new THREE.Group();
      const center = buildFalconCore(mats, { height: 6.5, radius: 0.28, fins: true });
      const left = buildFalconCore(mats, { height: 5.9, radius: 0.28, noFairing: true, fins: false });
      const right = buildFalconCore(mats, { height: 5.9, radius: 0.28, noFairing: true, fins: false });
      left.position.x = -0.62;
      right.position.x = 0.62;
      wrap.add(center, left, right);
      return wrap;
    })(),
    starship: buildStarship(mats),
  };
  const rocketRoot = new THREE.Group();
  Object.keys(vehicles).forEach((id) => {
    vehicles[id].visible = false;
    rocketRoot.add(vehicles[id]);
  });
  scene.add(rocketRoot);
  const plume = buildPlume(mats);
  rocketRoot.add(plume);

  let vehicleId = 'falcon-9';
  let locked = '';
  let start = performance.now();
  let raf = 0;
  let disposed = false;
  let inView = true;
  let prevElapsed = 0;
  vehicles[vehicleId].visible = true;

  function showVehicle(id) {
    const next = VEHICLE_ORDER.includes(id) ? id : 'falcon-9';
    if (next === vehicleId && vehicles[next].visible) {
      if (titleEl) titleEl.textContent = TITLES[next];
      return;
    }
    Object.keys(vehicles).forEach((key) => {
      vehicles[key].visible = key === next;
    });
    vehicleId = next;
    if (titleEl) titleEl.textContent = TITLES[next];
  }

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function sampleLift(t) {
    if (t < 2.6) return { lift: 0, ignite: Math.max(0, (t - 1.8) / 0.8), phase: 'hold' };
    if (t < 3.15) return { lift: 0, ignite: 1, phase: 'ignition' };
    const u = Math.min(1, (t - 3.15) / 7.2);
    const ease = u * u * (3 - 2 * u);
    return { lift: ease * 7.8, ignite: 1, phase: 'liftoff' };
  }

  function paint(now) {
    if (disposed) return;
    const elapsed = ((now - start) / 1000) % LOOP;
    const { lift, ignite, phase } = sampleLift(reduced ? 6.5 : elapsed);
    rocketRoot.position.y = lift;
    engineLight.position.y = 0.35 + lift;
    engineLight.intensity = ignite * (vehicleId === 'falcon-heavy' || vehicleId === 'starship' ? 18 : 11);
    glow.material.opacity = 0.08 + ignite * 0.22;
    const plumeScale = ignite < 0.02 ? 0.01 : 0.85 + ignite * (vehicleId === 'starship' || vehicleId === 'falcon-heavy' ? 0.7 : 0.35);
    plume.visible = ignite > 0.02;
    plume.scale.set(plumeScale, 0.9 + ignite * 0.55, plumeScale);
    plume.rotation.y += 0.08;
    smoke.material.opacity = ignite * 0.45;
    const base = smoke.userData.base;
    const pos = smoke.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = base[i] * (1 + ignite * 1.8);
      pos[i + 1] = base[i + 1] + ignite * 1.4 + Math.sin(now * 0.002 + i) * 0.05;
      pos[i + 2] = base[i + 2] * (1 + ignite * 1.8);
    }
    smoke.geometry.attributes.position.needsUpdate = true;
    const az = reduced ? 0.72 : 0.72 + elapsed * 0.065;
    const camR = 12.8;
    const targetY = 3.1 + lift * 0.62;
    camera.position.set(Math.sin(az) * camR, 4.6 + lift * 0.38, Math.cos(az) * camR + 1.4);
    camera.lookAt(0, targetY, 0);
    stars.rotation.y += 0.0004;
    if (clockEl) clockEl.textContent = formatClock(reduced ? 6.5 : elapsed);
    if (phaseEl) phaseEl.textContent = phase === 'hold' ? 'Hold-down' : phase === 'ignition' ? 'Ignition' : 'Liftoff';
    if (!locked && !reduced && elapsed < prevElapsed) {
      const idx = (VEHICLE_ORDER.indexOf(vehicleId) + 1) % VEHICLE_ORDER.length;
      showVehicle(VEHICLE_ORDER[idx]);
    }
    prevElapsed = elapsed;
    renderer.render(scene, camera);
  }

  function tick(now) {
    raf = 0;
    if (disposed) return;
    if (document.hidden || !inView) return;
    paint(now);
    if (!reduced) raf = requestAnimationFrame(tick);
  }

  function play() {
    if (disposed) return;
    if (raf) cancelAnimationFrame(raf);
    if (!document.hidden && inView) {
      if (reduced) paint(start + 6500);
      else raf = requestAnimationFrame(tick);
    }
  }

  resize();
  showVehicle(vehicleId);
  play();

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) play();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0.12 }
  );
  io.observe(container);

  function onVis() {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else play();
  }
  document.addEventListener('visibilitychange', onVis);

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    const seenGeo = new Set();
    const seenMat = new Set();
    scene.traverse((obj) => {
      if (obj.geometry && !seenGeo.has(obj.geometry)) {
        seenGeo.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        list.forEach((m) => {
          if (!seenMat.has(m)) {
            seenMat.add(m);
            m.dispose();
          }
        });
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    if (stillEl) stillEl.hidden = false;
  }

  return {
    setVehicle(id) {
      locked = id && VEHICLE_ORDER.includes(id) ? id : '';
      showVehicle(locked || vehicleId);
      start = performance.now();
      play();
    },
    replay() {
      start = performance.now();
      play();
    },
    dispose,
    canvas: renderer.domElement,
  };
}

function boot() {
  const stage = document.getElementById('sxPadStage');
  if (!stage || window.PlanetariumSpacexPad) return;
  let pad = null;
  try {
    pad = createSpacexPad(stage, {
      clockEl: document.getElementById('sxPadClock'),
      titleEl: document.getElementById('sxPadTitle'),
      stillEl: document.getElementById('sxPadStill'),
      phaseEl: document.getElementById('sxPadPhase'),
    });
  } catch (err) {
    console.warn('SpaceX pad WebGL failed', err);
    const still = document.getElementById('sxPadStill');
    if (still) still.hidden = false;
    return;
  }
  window.PlanetariumSpacexPad = pad;
  const replay = document.getElementById('sxPadReplay');
  if (replay && pad) replay.addEventListener('click', () => pad.replay());
  const rocket = new URLSearchParams(location.search).get('rocket');
  if (rocket) pad.setVehicle(rocket);
  window.addEventListener('pagehide', () => pad && pad.dispose(), { once: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
