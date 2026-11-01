/**
 * Star Wars hangar — one WebGL context, procedural ships, camera beats.
 * Development work by David Lane.
 */
import * as THREE from 'three';
import { buildShipInteriors, coatHulls, createDetailKit } from './planetarium-starwars-detail.js';

const SHIP_ORDER = ['lambda', 'x-wing', 'tie', 'y-wing', 'falcon', 'star-destroyer', 'death-star'];
const CAMERAS = ['approach', 'orbit', 'pullback'];
const FRAME = {
  lambda: 5.6,
  'x-wing': 6.1,
  tie: 5.5,
  'y-wing': 6.5,
  falcon: 6.8,
  'star-destroyer': 12.2,
  'death-star': 9.8,
};
const HERO_MS = 2800;

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function ease(t) {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

function makeMat(params) {
  return new THREE.MeshStandardMaterial(params);
}

function addMesh(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x || 0, y || 0, z || 0);
  parent.add(mesh);
  return mesh;
}

function glowMat(hex, intensity) {
  return makeMat({
    color: 0x3a2418,
    emissive: hex,
    emissiveIntensity: intensity,
    roughness: 0.42,
    metalness: 0.18,
  });
}

function pointAlong(mesh, x, y, z) {
  mesh.lookAt(x, y, z);
  return mesh;
}

function buildLambda(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.BoxGeometry(0.46, 0.32, 2.15), mats.imperial, 0, 0, 0);
  const nose = addMesh(g, new THREE.ConeGeometry(0.24, 0.72, 14), mats.imperial, 0, 0.02, 1.38);
  nose.rotation.x = Math.PI / 2;
  addMesh(g, new THREE.SphereGeometry(0.16, 14, 10), mats.glass, 0, 0.18, 0.42);
  addMesh(g, new THREE.BoxGeometry(0.06, 0.42, 0.55), mats.imperialDark, 0, -0.32, -0.35);
  const left = new THREE.Group();
  left.position.set(-0.2, 0.1, -0.05);
  addMesh(left, new THREE.BoxGeometry(1.85, 0.045, 1.15), mats.imperial, -0.92, 0, 0);
  addMesh(left, new THREE.BoxGeometry(1.85, 0.02, 0.06), mats.imperialDark, -0.92, 0.03, 0.5);
  const right = new THREE.Group();
  right.position.set(0.2, 0.1, -0.05);
  addMesh(right, new THREE.BoxGeometry(1.85, 0.045, 1.15), mats.imperial, 0.92, 0, 0);
  addMesh(right, new THREE.BoxGeometry(1.85, 0.02, 0.06), mats.imperialDark, 0.92, 0.03, 0.5);
  g.add(left, right);
  const nozzle = addMesh(g, new THREE.ConeGeometry(0.1, 0.22, 8), glowMat(0xff7a2f, 0.35), 0, -0.02, -1.18);
  nozzle.rotation.x = -Math.PI / 2;
  g.userData.pose = (t) => {
    const angle = 1.18 + (0.36 - 1.18) * ease(t);
    left.rotation.z = -angle;
    right.rotation.z = angle;
    nozzle.material.emissiveIntensity = 0.25 + t * 1.3;
  };
  return g;
}

function buildXwing(mats) {
  const g = new THREE.Group();
  const body = addMesh(g, new THREE.CylinderGeometry(0.15, 0.18, 2.05, 12), mats.rebel, 0, 0, 0);
  body.rotation.x = Math.PI / 2;
  const nose = addMesh(g, new THREE.ConeGeometry(0.15, 0.55, 12), mats.rebel, 0, 0, 1.28);
  nose.rotation.x = Math.PI / 2;
  addMesh(g, new THREE.SphereGeometry(0.16, 12, 10), mats.glass, 0, 0.12, 0.35);
  addMesh(g, new THREE.BoxGeometry(0.08, 0.06, 0.7), mats.stripe, 0, 0.16, -0.15);
  const closed = [0.16, -0.16, Math.PI - 0.16, Math.PI + 0.16];
  const open = [0.72, -0.72, Math.PI - 0.72, Math.PI + 0.72];
  const foils = closed.map((shut, i) => {
    const pivot = new THREE.Group();
    addMesh(pivot, new THREE.BoxGeometry(1.4, 0.04, 0.26), mats.rebel, 0.92, 0, 0);
    addMesh(pivot, new THREE.BoxGeometry(0.9, 0.02, 0.05), mats.stripe, 0.7, 0.035, 0.08);
    addMesh(pivot, new THREE.CylinderGeometry(0.08, 0.09, 0.48, 10), mats.imperialDark, 1.52, 0, -0.02);
    const cannon = addMesh(pivot, new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), mats.cannon, 0.62, 0.05, 0.16);
    cannon.rotation.x = Math.PI / 2;
    const flame = addMesh(pivot, new THREE.ConeGeometry(0.06, 0.16, 8), glowMat(0xff7a2f, 0.2), 1.52, 0, -0.28);
    flame.rotation.x = -Math.PI / 2;
    pivot.userData.shut = shut;
    pivot.userData.attack = open[i];
    pivot.userData.flame = flame;
    g.add(pivot);
    return pivot;
  });
  g.userData.pose = (t) => {
    const u = ease(t);
    foils.forEach((foil) => {
      foil.rotation.z = foil.userData.shut + (foil.userData.attack - foil.userData.shut) * u;
      foil.userData.flame.material.emissiveIntensity = 0.15 + u * 1.5;
    });
  };
  return g;
}

function hexPanelGeo() {
  const shape = new THREE.Shape();
  const r = 1.12;
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  const inner = 0.36;
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = Math.cos(a) * inner;
    const y = Math.sin(a) * inner;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
}

function addHexSpokes(parent, mats) {
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    const bar = addMesh(parent, new THREE.BoxGeometry(0.055, 0.72, 0.03), mats.panel, 0, 0, 0);
    bar.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.03);
    bar.rotation.z = a - Math.PI / 2;
  }
}

function buildTie(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.SphereGeometry(0.42, 22, 16), mats.imperialDark, 0, 0, 0);
  const viewport = addMesh(g, new THREE.SphereGeometry(0.16, 12, 10), mats.glass.clone(), 0, 0.04, 0.32);
  const geo = hexPanelGeo();
  [-1, 1].forEach((side) => {
    const wing = new THREE.Group();
    wing.add(new THREE.Mesh(geo, mats.tieWing));
    addHexSpokes(wing, mats);
    wing.position.x = side * 1.42;
    wing.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(wing);
    addMesh(g, new THREE.BoxGeometry(0.72, 0.05, 0.05), mats.panel, side * 0.78, 0, 0);
  });
  g.userData.pose = (t) => {
    viewport.material.emissiveIntensity = 0.15 + Math.sin(t * Math.PI) * 0.25;
  };
  return g;
}

function buildYwing(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.BoxGeometry(0.36, 0.32, 0.7), mats.ywing, 0, 0.05, 0.85);
  addMesh(g, new THREE.SphereGeometry(0.16, 12, 8), mats.glass, 0, 0.22, 1.05);
  addMesh(g, new THREE.BoxGeometry(0.12, 0.1, 0.85), mats.imperialDark, 0, 0, 0.15);
  const nozzles = [];
  [-0.55, 0.55].forEach((x) => {
    const nacelle = addMesh(g, new THREE.CylinderGeometry(0.16, 0.18, 1.85, 12), mats.ywing, x, 0, -0.15);
    nacelle.rotation.x = Math.PI / 2;
    addMesh(g, new THREE.BoxGeometry(0.08, 0.08, 0.55), mats.imperialDark, x * 0.55, 0.02, 0.15);
    const nozzle = addMesh(g, new THREE.ConeGeometry(0.14, 0.28, 10), glowMat(0xff7a2f, 0.3), x, 0, -1.15);
    nozzle.rotation.x = -Math.PI / 2;
    nozzles.push(nozzle);
  });
  g.userData.pose = (t) => {
    nozzles.forEach((nozzle) => {
      nozzle.material.emissiveIntensity = 0.25 + ease(t) * 1.6;
    });
  };
  return g;
}

function buildFalcon(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(1.48, 1.48, 0.22, 36), mats.falcon, 0, 0, 0);
  addMesh(g, new THREE.BoxGeometry(0.46, 0.14, 1.05), mats.falconDark, -0.4, 0, 1.2);
  addMesh(g, new THREE.BoxGeometry(0.46, 0.14, 1.05), mats.falconDark, 0.4, 0, 1.2);
  const pit = new THREE.Group();
  const tube = addMesh(pit, new THREE.CylinderGeometry(0.14, 0.16, 0.62, 10), mats.falconDark, 0, 0, 0);
  tube.rotation.z = Math.PI / 2;
  addMesh(pit, new THREE.SphereGeometry(0.15, 12, 8), mats.glass, 0.28, 0.06, 0.08);
  pit.position.set(0.95, 0.18, 0.28);
  g.add(pit);
  const dish = new THREE.Group();
  addMesh(dish, new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), mats.imperialDark, 0, 0.16, 0);
  addMesh(dish, new THREE.CylinderGeometry(0.22, 0.18, 0.04, 16), mats.panel, 0, 0.32, 0);
  dish.position.set(-0.28, 0.12, -0.2);
  g.add(dish);
  addMesh(g, new THREE.SphereGeometry(0.1, 10, 8), mats.imperialDark, 0.15, 0.16, -0.15);
  const bay = addMesh(g, new THREE.BoxGeometry(0.7, 0.08, 0.12), glowMat(0x7eb6ff, 0.45), 0, 0, -1.42);
  g.userData.pose = (t) => {
    dish.rotation.y = ease(t) * Math.PI * 1.4;
    bay.material.emissiveIntensity = 0.35 + t * 1.1;
  };
  return g;
}

function buildDestroyer(mats) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 3.15);
  shape.lineTo(-1.28, -2.45);
  shape.lineTo(1.28, -2.45);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.06,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.12, 0);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mats.imperial));
  addMesh(g, new THREE.BoxGeometry(0.32, 0.38, 0.48), mats.imperialDark, 0, 0.42, -1.45);
  addMesh(g, new THREE.BoxGeometry(0.18, 0.2, 0.24), mats.panel, 0, 0.68, -1.38);
  const engines = [-0.62, 0, 0.62].map((x) => (
    addMesh(g, new THREE.BoxGeometry(0.32, 0.1, 0.08), glowMat(0x9ec4ff, 0.2), x, 0.1, -2.5)
  ));
  g.userData.pose = (t) => {
    const glow = 0.15 + ease(t) * 1.8;
    engines.forEach((engine) => {
      engine.material.emissiveIntensity = glow;
    });
  };
  return g;
}

function buildDeathStar(mats) {
  const g = new THREE.Group();
  addMesh(g, new THREE.SphereGeometry(1.92, 42, 28), mats.death, 0, 0, 0);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.95, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x12151c,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    })
  );
  g.add(shell);
  const trench = addMesh(g, new THREE.TorusGeometry(1.96, 0.055, 8, 64), mats.trench, 0, 0, 0);
  trench.rotation.x = Math.PI / 2;
  const dish = new THREE.Group();
  addMesh(dish, new THREE.TorusGeometry(0.46, 0.06, 8, 28), mats.imperialDark, 0, 0, 0);
  addMesh(dish, new THREE.CircleGeometry(0.4, 24), mats.trench, 0, 0, 0.02);
  const core = addMesh(dish, new THREE.SphereGeometry(0.12, 14, 10), glowMat(0xff3b2a, 0.4), 0, 0, 0.1);
  const dir = new THREE.Vector3(0.55, 0.7, 0.46).normalize();
  dish.position.copy(dir).multiplyScalar(1.94);
  dish.lookAt(0, 0, 0);
  g.add(dish);
  g.userData.pose = (t) => {
    core.material.emissiveIntensity = 0.35 + ease(t) * 2.4;
    pointAlong(core, dir.x * 6, dir.y * 6, dir.z * 6);
  };
  return g;
}

function starField() {
  const count = 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 28 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xd5dbe8, size: 0.06, sizeAttenuation: true })
  );
}

function createStarWarsHangar(container) {
  const reduced = prefersReducedMotion();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x07080d, 1);
  container.prepend(renderer.domElement);
  renderer.domElement.className = 'sw-stage__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07080d, 0.032);
  const kit = createDetailKit(renderer);
  scene.environment = kit.envMap;
  renderer.toneMappingExposure = 1.28;
  scene.add(starField());
  const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 180);

  const mats = {
    imperial: makeMat({ color: 0xb7bcc6, roughness: 0.38, metalness: 0.62 }),
    imperialDark: makeMat({ color: 0x2a2e36, roughness: 0.46, metalness: 0.4 }),
    rebel: makeMat({ color: 0xd5d8df, roughness: 0.4, metalness: 0.28 }),
    stripe: makeMat({ color: 0xc23b2e, roughness: 0.45, metalness: 0.12 }),
    cannon: makeMat({ color: 0x8d939c, roughness: 0.3, metalness: 0.7 }),
    panel: makeMat({ color: 0x8e949e, roughness: 0.42, metalness: 0.55 }),
    tieWing: makeMat({ color: 0x6a7382, roughness: 0.42, metalness: 0.48 }),
    glass: makeMat({
      color: 0x8ecbff,
      emissive: 0x123044,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
    ywing: makeMat({ color: 0xc2b48a, roughness: 0.55, metalness: 0.22 }),
    falcon: makeMat({ color: 0xb7aea2, roughness: 0.62, metalness: 0.25 }),
    falconDark: makeMat({ color: 0x6e675e, roughness: 0.58, metalness: 0.3 }),
    death: makeMat({ color: 0x7a808a, roughness: 0.72, metalness: 0.35 }),
    trench: makeMat({ color: 0x141820, roughness: 0.9, metalness: 0.08 }),
    floor: makeMat({ color: 0x12151c, roughness: 0.92, metalness: 0.08 }),
  };

  const floor = addMesh(scene, new THREE.CircleGeometry(22, 48), mats.floor, 0, -2.7, 0);
  floor.rotation.x = -Math.PI / 2;
  const bay = new THREE.GridHelper(16, 16, 0x2a3344, 0x1a2030);
  bay.position.y = -2.68;
  scene.add(bay);

  scene.add(new THREE.HemisphereLight(0xd5e2f4, 0x2a241c, 0.95));
  const key = new THREE.DirectionalLight(0xf7f9ff, 2.15);
  key.position.set(-6, 10, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9eb6d8, 0.55);
  fill.position.set(8, 3, -4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc48a, 0.9);
  rim.position.set(6, 4, -8);
  scene.add(rim);
  const warm = new THREE.PointLight(0xff8a3d, 6, 24, 2);
  warm.position.set(0, 1.2, -2.2);
  scene.add(warm);
  const bayWash = new THREE.PointLight(0xfff1d4, 10, 30, 2);
  bayWash.position.set(0, 6.2, 1);
  scene.add(bayWash);
  [-8, 0, 8].forEach((z) => {
    addMesh(scene, new THREE.BoxGeometry(10, 0.08, 0.22), kit.mats.lamp, 0, 5.4, z);
  });
  const shell = kit.mats.wall;
  addMesh(scene, new THREE.BoxGeometry(40, 14, 0.4), shell, 0, 3.5, -22);
  addMesh(scene, new THREE.BoxGeometry(0.4, 14, 40), shell, -22, 3.5, 0);
  addMesh(scene, new THREE.BoxGeometry(0.4, 14, 40), shell, 22, 3.5, 0);

  const builders = {
    lambda: buildLambda,
    'x-wing': buildXwing,
    tie: buildTie,
    'y-wing': buildYwing,
    falcon: buildFalcon,
    'star-destroyer': buildDestroyer,
    'death-star': buildDeathStar,
  };
  const ships = {};
  const root = new THREE.Group();
  SHIP_ORDER.forEach((id) => {
    ships[id] = builders[id](mats);
    ships[id].visible = false;
    if (typeof ships[id].userData.pose === 'function') ships[id].userData.pose(reduced ? 1 : 0);
    root.add(ships[id]);
  });
  coatHulls(root, mats, kit);
  scene.add(root);
  const interiors = buildShipInteriors(kit);
  const interiorRoot = new THREE.Group();
  interiorRoot.name = 'interiors';
  interiorRoot.visible = false;
  SHIP_ORDER.forEach((id) => {
    interiors[id].visible = false;
    interiorRoot.add(interiors[id]);
  });
  scene.add(interiorRoot);

  let shipId = 'lambda';
  let mode = 'approach';
  let roomId = '';
  let walking = false;
  let walkSnap = true;
  let heroStart = performance.now();
  let origin = heroStart;
  let raf = 0;
  let disposed = false;
  let inView = true;
  let keepAlive = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const lookYaw = { v: 0 };
  const lookPitch = { v: 0 };
  const camPos = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  ships[shipId].visible = true;

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function heroAmount(now) {
    if (reduced) return 1;
    return Math.min(1, (now - heroStart) / HERO_MS);
  }

  function paintWalk() {
    if (walkSnap || reduced) {
      camPos.copy(goalPos);
      walkSnap = false;
    } else {
      camPos.lerp(goalPos, 0.08);
    }
    camera.position.copy(camPos);
    ahead.copy(goalLook).sub(camPos);
    if (ahead.lengthSq() < 0.0001) ahead.set(0, 0, -1);
    ahead.normalize();
    ahead.applyAxisAngle(up, lookYaw.v);
    right.crossVectors(ahead, up);
    if (right.lengthSq() > 0.0001) {
      right.normalize();
      ahead.applyAxisAngle(right, lookPitch.v);
    }
    lookAt.copy(camPos).add(ahead);
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  }

  function paint(now) {
    if (disposed) return;
    if (walking) {
      paintWalk();
      return;
    }
    const t = heroAmount(now);
    const ship = ships[shipId];
    if (ship && typeof ship.userData.pose === 'function') ship.userData.pose(t);
    SHIP_ORDER.forEach((id) => {
      ships[id].position.y = id === shipId && !reduced ? Math.sin(now * 0.0011) * 0.05 : 0;
    });
    const radius = FRAME[shipId] || 6;
    const idle = reduced ? 0 : (now - origin) * 0.00012;
    let dist = radius;
    let y = radius * 0.24;
    let az = 0.6;
    if (mode === 'approach') {
      dist = radius * (1.48 - 0.52 * ease(t));
      y = radius * 0.22;
      az = 0.62 + idle;
    } else     if (mode === 'pullback') {
      dist = radius * (0.78 + 0.55 * ease(t));
      y = radius * (shipId === 'star-destroyer' ? 0.92 : 0.42);
      az = (shipId === 'star-destroyer' ? 1.05 : 0.55) + idle * 0.25;
    } else {
      dist = radius * 1.12;
      y = radius * 0.28;
      az = reduced ? 0.8 : (now - origin) * 0.00038;
    }
    camera.position.set(Math.sin(az) * dist, y, Math.cos(az) * dist);
    camera.lookAt(0, 0.05, 0);
    warm.intensity = 0.6 + t * 1.6;
    renderer.render(scene, camera);
  }

  function tick(now) {
    raf = 0;
    if (disposed) return;
    if (document.hidden || (!inView && !keepAlive)) return;
    paint(now);
    if (!reduced) raf = requestAnimationFrame(tick);
  }

  function play() {
    if (disposed) return;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (document.hidden || (!inView && !keepAlive)) {
      paint(performance.now());
      return;
    }
    if (reduced) {
      paint(performance.now());
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  resize();
  play();

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      play();
    },
    { threshold: 0.08 }
  );
  io.observe(container);

  function onVis() {
    play();
  }
  document.addEventListener('visibilitychange', onVis);

  function onPointerDown(ev) {
    if (!walking || ev.button !== 0) return;
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    renderer.domElement.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev) {
    if (!dragging || !walking) return;
    lookYaw.v -= (ev.clientX - lastX) * 0.005;
    lookPitch.v = Math.max(-0.9, Math.min(0.9, lookPitch.v - (ev.clientY - lastY) * 0.004));
    lastX = ev.clientX;
    lastY = ev.clientY;
  }

  function onPointerUp() {
    dragging = false;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (kit.envMap) kit.envMap.dispose();
    const seenGeo = new Set();
    const seenMat = new Set();
    scene.traverse((obj) => {
      if (obj.geometry && !seenGeo.has(obj.geometry)) {
        seenGeo.add(obj.geometry);
        obj.geometry.dispose();
      }
      if (obj.material) {
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        list.forEach((material) => {
          if (!seenMat.has(material)) {
            seenMat.add(material);
            material.dispose();
          }
        });
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    const fallback = document.getElementById('swFallback');
    if (fallback) fallback.hidden = false;
  }

  const fallback = document.getElementById('swFallback');
  if (fallback) fallback.hidden = true;

  return {
    showShip(id, cameraMode, room) {
      const next = SHIP_ORDER.includes(id) ? id : 'lambda';
      shipId = next;
      mode = cameraMode === 'walk' || CAMERAS.includes(cameraMode) ? cameraMode : 'orbit';
      walking = mode === 'walk';
      roomId = room || '';
      root.visible = !walking;
      interiorRoot.visible = walking;
      SHIP_ORDER.forEach((key) => {
        ships[key].visible = !walking && key === next;
        interiors[key].visible = walking && key === next;
      });
      if (walking) {
        const rooms = interiors[next].userData.rooms || [];
        const picked = rooms.find((node) => node.name === roomId) || rooms[0];
        if (picked) {
          goalPos.copy(picked.position);
          goalLook.copy(picked.userData.look);
        }
        lookYaw.v = 0;
        lookPitch.v = 0;
        walkSnap = true;
        camera.fov = 64;
        camera.near = 0.05;
        scene.fog.density = 0.015;
      } else {
        camera.fov = 36;
        camera.near = 0.08;
        scene.fog.density = 0.032;
        heroStart = performance.now();
      }
      camera.updateProjectionMatrix();
      play();
    },
    setKeepAlive(on) {
      keepAlive = Boolean(on);
      play();
    },
    dispose,
  };
}

function boot() {
  const stage = document.getElementById('swStage');
  if (!stage || window.PlanetariumStarWarsScene) return;
  try {
    window.PlanetariumStarWarsScene = createStarWarsHangar(stage);
  } catch (err) {
    console.warn('Star Wars hangar WebGL failed', err);
    const fallback = document.getElementById('swFallback');
    if (fallback) fallback.hidden = false;
    window.PlanetariumStarWarsScene = {
      showShip() {},
      setKeepAlive() {},
      dispose() {},
    };
  }
  window.addEventListener('pagehide', () => {
    if (window.PlanetariumStarWarsScene) window.PlanetariumStarWarsScene.dispose();
  }, { once: true });
}

boot();
