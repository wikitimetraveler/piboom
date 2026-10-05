/**
 * ISS station — Three.js schematic + authentic 1:1 walk interiors.
 * Orbit/explode: schematic. Walk: NASA-dimension rooms with look-around.
 * Development work by David Lane
 */
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/DRACOLoader.js';
import { createInteriorManager } from './planetarium-station-interiors.js?v=4';

const EARTH_TEX = '/shared/textures/earth/blue-marble.jpg';
const DEG = Math.PI / 180;
const WALK_ROOMS = new Set(['destiny', 'harmony', 'columbus', 'kibo', 'kibo-ef', 'ida2', 'ida3', 'cupola', 'zvezda']);
const PHOTO_URL = '/planetarium/assets/station/iss-photoreal.glb';

/** Index 0 = nadir, 1–6 = side windows (matches interior walk set). */
const SHUTTER_COUNT = 7;
const SHUTTER_OPEN_ANGLE = 1.95;
const SHUTTER_STAGGER = 0.07;
const SHUTTER_SWING = 0.68;
const STREAK_LEAD = 0.4;
const STREAK_TRAVEL = 0.28;
const STREAK_LANES = [
  { side: -2.0, up: 0.5, delay: 0 },
  { side: -1.2, up: -0.7, delay: 0.05 },
  { side: 0.9, up: -0.3, delay: 0.1 },
  { side: 1.6, up: 0.8, delay: 0.03 },
  { side: 2.3, up: -0.9, delay: 0.12 },
];
const SUN_CYCLE_S = 40;
const SUN_SWING = 0.5;

/** Keep in sync with --st-partner-* in planetarium-station.css. */
const OWNER_TINT = {
  NASA: '#6c9cff',
  Roscosmos: '#ff6f61',
  ESA: '#4fd1c5',
  JAXA: '#ff9ec4',
  CSA: '#ffd278',
};

function easeInOutCubic(u) {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function partnerMatches(mod, owner) {
  if (!owner) return false;
  return String(mod?.partner || '')
    .split('/')
    .some((p) => p.trim() === owner);
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function addMesh(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x || 0, y || 0, z || 0);
  parent.add(mesh);
  return mesh;
}

function makeMat(params) {
  return new THREE.MeshStandardMaterial(params);
}

function shapeGeometry(mod) {
  const L = mod.layout || {};
  const sx = Number(L.sx) || 1;
  const sy = Number(L.sy) || 1;
  const sz = Number(L.sz) || 1;
  const shape = L.shape || 'box';
  if (shape === 'sphere') return new THREE.SphereGeometry(Math.max(sx, sy, sz) / 2, 20, 16);
  if (shape === 'cupola') return new THREE.CylinderGeometry(sx * 0.5, sx * 0.4, sy, 6);
  if (shape === 'dock') {
    const g = new THREE.CylinderGeometry(sx * 0.4, sx * 0.46, 0.22, 16);
    if (L.axis === 'x') g.rotateZ(-Math.PI / 2);
    return g;
  }
  if (shape === 'node') return new THREE.BoxGeometry(sx, sy, sz);
  if (shape === 'cylinder-x') {
    const g = new THREE.CylinderGeometry(sy * 0.5, sy * 0.5, sx, 20);
    g.rotateZ(Math.PI / 2);
    return g;
  }
  if (shape === 'cylinder-z') {
    const g = new THREE.CylinderGeometry(sy * 0.5, sy * 0.5, sz, 20);
    g.rotateX(Math.PI / 2);
    return g;
  }
  if (shape === 'cylinder-y') return new THREE.CylinderGeometry(sx * 0.48, sx * 0.48, sy, 18);
  if (shape === 'array') return new THREE.BoxGeometry(sx, sy, sz);
  if (shape === 'arm') return new THREE.BoxGeometry(sx, sy, sz);
  return new THREE.BoxGeometry(sx, sy, sz);
}

/**
 * Hex Cupola skin: six trapezoid side panes + nadir disc, each with an MDPS
 * cover hinged at its outer edge. Plates run ~12% oversize so the swing
 * reads at the default orbit distance.
 */
function addCupolaShutters(group, mod, mats) {
  const sx = Number(mod.layout?.sx) || 1;
  const h = Number(mod.layout?.sy) || 0.72;
  const rTop = sx * 0.5;
  const rBot = sx * 0.4;
  const apothem = Math.cos(Math.PI / 6);
  const rMid = ((rTop + rBot) / 2) * apothem;
  const tilt = Math.atan(((rTop - rBot) * apothem) / h);
  const paneW = 0.3;
  const paneH = 0.46;
  const plateW = paneW * 1.12;
  const plateH = paneH * 1.12;
  const glass = mats.glass.clone();
  glass.color.set('#1d3a58');
  glass.opacity = 0.82;
  glass.metalness = 0.55;
  glass.roughness = 0.12;
  glass.emissive.set('#16324a');
  glass.emissiveIntensity = 0.35;
  const plateMat = mats.shutter.clone();
  const pivots = new Array(SHUTTER_COUNT);

  const nadirR = rBot * apothem * 0.72;
  const nadirPane = addMesh(group, new THREE.CircleGeometry(nadirR, 28), glass, 0, -h / 2 - 0.003, 0);
  nadirPane.rotation.x = Math.PI / 2;
  const nadirPlateR = nadirR * 1.12;
  const nadirPivot = new THREE.Group();
  nadirPivot.position.set(nadirPlateR, -h / 2 - 0.012, 0);
  nadirPivot.userData.shutterAxis = 'z';
  group.add(nadirPivot);
  const nadirPlate = addMesh(nadirPivot, new THREE.CircleGeometry(nadirPlateR, 28), plateMat, -nadirPlateR, 0, 0);
  nadirPlate.rotation.x = Math.PI / 2;
  pivots[0] = nadirPivot;

  for (let i = 1; i < SHUTTER_COUNT; i += 1) {
    const face = new THREE.Group();
    face.rotation.y = Math.PI / 2 - (i - 1) * (Math.PI / 3);
    group.add(face);
    const panel = new THREE.Group();
    panel.position.z = rMid;
    panel.rotation.x = tilt;
    face.add(panel);
    addMesh(panel, new THREE.PlaneGeometry(paneW, paneH), glass, 0, 0, 0.004);
    const pivot = new THREE.Group();
    pivot.position.set(0, plateH / 2, 0.014);
    pivot.userData.shutterAxis = 'x';
    panel.add(pivot);
    addMesh(pivot, new THREE.PlaneGeometry(plateW, plateH), plateMat, 0, -plateH / 2, 0);
    pivots[i] = pivot;
  }
  group.userData.shutterPivots = pivots;
}

function addInterior(group, mod, mats) {
  if (!mod.interior) return;
  if (mod.id === 'cupola') {
    addCupolaShutters(group, mod, mats);
    return;
  }
  if (mod.layout?.shape === 'dock') return;
  const along = (mod.layout?.shape || '').includes('z') ? 'z' : 'x';
  const rackMat = mats.rack.clone();
  for (let i = -1; i <= 1; i += 1) {
    const rack = addMesh(
      group,
      new THREE.BoxGeometry(0.22, 0.55, 0.42),
      rackMat,
      along === 'x' ? i * 0.55 : 0.42,
      -0.12,
      along === 'z' ? i * 0.5 : 0.38
    );
    rack.userData.skipPick = true;
  }
}

function addJointedCanadarm(group, mat) {
  const gold = mat.clone();
  const shoulder = new THREE.Group();
  shoulder.name = 'ssrms-shoulder';
  group.add(shoulder);
  const boom1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.35, 8), gold);
  boom1.rotation.z = Math.PI / 2;
  boom1.position.x = 0.68;
  boom1.userData.skipPick = true;
  shoulder.add(boom1);
  const elbow = new THREE.Group();
  elbow.position.x = 1.35;
  elbow.name = 'ssrms-elbow';
  shoulder.add(elbow);
  const boom2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 8), gold);
  boom2.rotation.z = Math.PI / 2;
  boom2.position.x = 0.62;
  boom2.userData.skipPick = true;
  elbow.add(boom2);
  const wrist = new THREE.Group();
  wrist.position.x = 1.25;
  wrist.name = 'ssrms-wrist';
  elbow.add(wrist);
  const boom3 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.7, 8), gold);
  boom3.rotation.z = Math.PI / 2;
  boom3.position.x = 0.35;
  boom3.userData.skipPick = true;
  wrist.add(boom3);
  const lee = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22), gold);
  lee.position.x = 0.78;
  lee.userData.skipPick = true;
  wrist.add(lee);
  group.userData.armJoints = { shoulder, elbow, wrist };
}

function addExposedFacility(group, mats) {
  const palletMat = mats.jaxa.clone();
  palletMat.color.set('#d7dbe2');
  const maxi = addMesh(group, new THREE.BoxGeometry(0.34, 0.28, 0.34), palletMat, -0.28, 0.22, 0.15);
  maxi.name = 'MAXI';
  maxi.userData.skipPick = true;
  const caletMat = palletMat.clone();
  caletMat.color.set('#b9c3d0');
  const calet = addMesh(group, new THREE.BoxGeometry(0.38, 0.32, 0.3), caletMat, 0.32, 0.24, -0.1);
  calet.name = 'CALET';
  calet.userData.skipPick = true;
  const armMat = mats.arm.clone();
  const base = new THREE.Group();
  base.name = 'JEMRMS';
  base.position.set(0, 0.16, -0.55);
  group.add(base);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), armMat);
  shoulder.userData.skipPick = true;
  base.add(shoulder);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.72), armMat);
  boom.position.set(0.22, 0.22, 0.08);
  boom.rotation.z = -0.5;
  boom.rotation.y = 0.35;
  boom.userData.skipPick = true;
  boom.name = 'jemrms-upper';
  base.add(boom);
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.58), armMat);
  forearm.position.set(0.52, 0.48, 0.32);
  forearm.rotation.z = -1.05;
  forearm.rotation.y = 0.2;
  forearm.userData.skipPick = true;
  forearm.name = 'jemrms-forearm';
  base.add(forearm);
}

/**
 * IDA soft-capture ring + guide petals. Stowed (hidden) on orbit; extends only
 * while docking is on or this IDA is selected.
 */
function addSoftCapture(group, mod, baseMat) {
  const sx = Number(mod.layout?.sx) || 0.6;
  const mat = baseMat.clone();
  mat.color.set('#7fb2e0');
  mat.emissive = new THREE.Color('#123a5c');
  mat.emissiveIntensity = 0.5;
  mat.userData = {
    baseColor: mat.color.clone(),
    baseEmissive: mat.emissive.clone(),
    baseEmissiveIntensity: mat.emissiveIntensity,
  };
  const rig = new THREE.Group();
  rig.name = mod.id + '-soft-capture';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(sx * 0.44, 0.05, 8, 28), mat);
  ring.rotation.x = Math.PI / 2;
  ring.userData.skipPick = true;
  rig.add(ring);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.03), mat);
    petal.position.set(Math.cos(a) * sx * 0.36, 0.14, Math.sin(a) * sx * 0.36);
    petal.rotation.y = -a + Math.PI / 2;
    petal.rotation.x = -0.35;
    petal.userData.skipPick = true;
    rig.add(petal);
  }
  const holder = new THREE.Group();
  if (mod.layout?.axis === 'x') holder.rotation.z = -Math.PI / 2;
  holder.add(rig);
  group.add(holder);
  rig.visible = false;
  group.userData.softCapture = { rig, t: 0 };
}

const ARRIVAL_AXIS = {
  ida2: [1, 0, 0],
  ida3: [0, 1, 0],
  zvezda: [-1, 0, 0],
  rassvet: [0, -1, 0],
  poisk: [0, 1, 0],
  prichal: [0, -1, 0],
  unity: [0, -1, 0],
  harmony: [0, -1, 0],
};

const ARRIVAL_VIEW = new THREE.Vector3(0.75, 0.55, 0.95);

const ARRIVAL_STEPS = {
  docking: [
    { id: 'approach', label: 'Approach', hint: 'the ship flies itself in', s: 4.2 },
    { id: 'soft', label: 'Soft capture', hint: 'a gentle grab', s: 1.8 },
    { id: 'hard', label: 'Hard capture', hint: 'the bolts lock', s: 1.8 },
    { id: 'hatch', label: 'Hatch open', hint: 'crew float through', s: 1.6 },
  ],
  berthing: [
    { id: 'approach', label: 'Approach', hint: 'parks below the station', s: 4.2 },
    { id: 'grapple', label: 'Canadarm2 grapple', hint: 'the arm catches it', s: 1.8 },
    { id: 'berth', label: 'Berth', hint: 'the bolts lock', s: 2.2 },
    { id: 'hatch', label: 'Hatch open', hint: 'cargo comes aboard', s: 1.6 },
  ],
};

function buildVehicle(vehicle, kind) {
  const g = new THREE.Group();
  g.name = 'arrival-vehicle';
  const name = String(vehicle || '').toLowerCase();
  const russian = /soyuz|progress/.test(name);
  const hull = makeMat({
    color: russian ? '#a7b07a' : '#eef1f4',
    metalness: 0.3,
    roughness: 0.45,
    emissive: '#000000',
  });
  const dark = makeMat({ color: '#2a3140', metalness: 0.4, roughness: 0.5 });
  const panel = makeMat({ color: '#1a2744', metalness: 0.2, roughness: 0.5, emissive: '#0b1c3a', emissiveIntensity: 0.4 });
  if (kind === 'berthing') {
    const body = addMesh(g, new THREE.CylinderGeometry(0.34, 0.34, 0.9, 18), hull, 0, -0.45, 0);
    body.userData.skipPick = true;
    const cbm = addMesh(g, new THREE.CylinderGeometry(0.26, 0.3, 0.1, 16), dark, 0, 0.05, 0);
    cbm.userData.skipPick = true;
    for (const side of [-1, 1]) {
      const wing = addMesh(g, new THREE.CylinderGeometry(0.36, 0.36, 0.02, 20), panel, side * 0.8, -0.6, 0);
      wing.rotation.z = Math.PI / 2;
      wing.userData.skipPick = true;
    }
  } else {
    const body = addMesh(g, new THREE.CylinderGeometry(0.3, 0.36, 0.55, 18), hull, 0, -0.4, 0);
    body.userData.skipPick = true;
    const nose = addMesh(g, new THREE.CylinderGeometry(0.14, 0.3, 0.2, 18), hull, 0, -0.03, 0);
    nose.userData.skipPick = true;
    const adapter = addMesh(g, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), dark, 0, 0.1, 0);
    adapter.userData.skipPick = true;
    if (russian) {
      for (const side of [-1, 1]) {
        const wing = addMesh(g, new THREE.BoxGeometry(0.7, 0.02, 0.22), panel, side * 0.62, -0.55, 0);
        wing.userData.skipPick = true;
      }
    }
  }
  g.userData.hull = hull;
  return g;
}

function buildModule(mod, mats) {
  const g = new THREE.Group();
  g.name = mod.id;
  g.userData.moduleId = mod.id;
  g.userData.rest = {
    x: Number(mod.layout?.x) || 0,
    y: Number(mod.layout?.y) || 0,
    z: Number(mod.layout?.z) || 0,
  };
  g.userData.explode = {
    x: Number(mod.explodeOffset?.x) || 0,
    y: Number(mod.explodeOffset?.y) || 0,
    z: Number(mod.explodeOffset?.z) || 0,
  };
  g.position.set(g.userData.rest.x, g.userData.rest.y, g.userData.rest.z);

  const color = new THREE.Color(mod.layout?.color || '#d8d4cc');
  const kind = mod.kind;
  let mat = mats.us;
  if (mod.partner === 'Roscosmos') mat = mats.ros;
  else if (mod.partner === 'ESA') mat = mats.esa;
  else if (mod.partner === 'JAXA') mat = mats.jaxa;
  else if (mod.partner === 'CSA') mat = mats.arm;
  if (kind === 'array') mat = mats.array;
  if (kind === 'truss') mat = mats.truss;
  mat = mat.clone();
  mat.color.copy(color);
  if (kind === 'array') {
    mat.emissive = new THREE.Color('#0b1c3a');
    mat.emissiveIntensity = 0.42;
  }
  mat.userData = mat.userData || {};
  mat.userData.baseEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
  mat.userData.baseEmissiveIntensity = mat.emissiveIntensity || 0;
  mat.userData.baseColor = mat.color.clone();

  const mesh = new THREE.Mesh(shapeGeometry(mod), mat);
  mesh.userData.moduleId = mod.id;
  g.add(mesh);
  if (WALK_ROOMS.has(mod.id)) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
    const rim = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x7ec8ff,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
    );
    rim.userData.skipPick = true;
    rim.userData.walkRim = true;
    g.add(rim);
  }
  if (mod.interior) addInterior(g, mod, mats);
  if (mod.id === 'canadarm2') {
    mesh.visible = false;
    addJointedCanadarm(g, mats.arm);
  }
  if (mod.id === 'kibo-ef') addExposedFacility(g, mats);
  if (mod.layout?.shape === 'dock') addSoftCapture(g, mod, mat);
  if (kind === 'array') g.userData.solarArray = true;
  const parts = new Set();
  g.traverse((obj) => {
    if (obj.isMesh && obj.material) parts.add(obj.material);
  });
  return { group: g, mesh, mod, parts: [...parts] };
}

export function createStationScene(container, opts = {}) {
  const stillEl = opts.stillEl || null;
  const reduced = prefersReducedMotion();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  container.appendChild(renderer.domElement);
  if (stillEl) stillEl.hidden = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.FogExp2(0x05070c, 0.016);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const orbit = { theta: 0.72, phi: 0.55, radius: 18 };
  const look = { yaw: 0, pitch: 0 };
  let walkPos = new THREE.Vector3(0, 0.15, 0);

  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x1a1520, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2dc, 2.35);
  key.position.set(8, 10, 6);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x6a7a99, 0.42));
  const rim = new THREE.DirectionalLight(0x88b7ff, 0.72);
  rim.position.set(-10, 4, -8);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe0c0, 0.35);
  fill.position.set(-4, -2, 10);
  scene.add(fill);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const r = 35 + Math.random() * 55;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xdce8ff, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.85 })
  );
  scene.add(stars);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 64, 48),
    new THREE.MeshStandardMaterial({
      color: 0x1d5c9c,
      roughness: 0.72,
      metalness: 0.08,
      emissive: 0x041018,
      emissiveIntensity: 0.12,
    })
  );
  earth.position.set(0, -9.2, 0);
  scene.add(earth);
  const loader = new THREE.TextureLoader();
  loader.load(
    EARTH_TEX,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
      earth.material.map = tex;
      earth.material.color.set('#ffffff');
      earth.material.needsUpdate = true;
    },
    undefined,
    () => {}
  );

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(5.42, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.16, side: THREE.BackSide })
  );
  atmo.position.copy(earth.position);
  scene.add(atmo);

  const softShadow = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  softShadow.rotation.x = -Math.PI / 2;
  softShadow.position.set(0, -1.35, 0);
  scene.add(softShadow);

  const station = new THREE.Group();
  station.position.y = 0.4;
  scene.add(station);
  const photoRoot = new THREE.Group();
  photoRoot.name = 'iss-photoreal';
  photoRoot.visible = false;
  photoRoot.position.y = 0.4;
  scene.add(photoRoot);
  let photorealOn = false;
  let photoPromise = null;
  let passMesh = null;
  let passT = 1;
  let passFrom = new THREE.Vector3();
  let passTo = new THREE.Vector3();
  let onPassThrough = () => {};

  const interiors = createInteriorManager(scene);

  const mats = {
    us: makeMat({ color: '#e8e4dc', metalness: 0.25, roughness: 0.42 }),
    ros: makeMat({ color: '#8b95a0', metalness: 0.35, roughness: 0.38 }),
    esa: makeMat({ color: '#d9e4f0', metalness: 0.22, roughness: 0.4 }),
    jaxa: makeMat({ color: '#f2f0ea', metalness: 0.2, roughness: 0.44 }),
    truss: makeMat({ color: '#5f6570', metalness: 0.55, roughness: 0.32 }),
    array: makeMat({ color: '#1a2744', metalness: 0.15, roughness: 0.5 }),
    arm: makeMat({ color: '#c9a227', metalness: 0.4, roughness: 0.35 }),
    glass: makeMat({
      color: '#9ad4ff',
      metalness: 0.1,
      roughness: 0.15,
      transparent: true,
      opacity: 0.45,
      emissive: '#16324a',
      emissiveIntensity: 0.2,
    }),
    rack: makeMat({ color: '#4a5160', metalness: 0.3, roughness: 0.5 }),
    screen: makeMat({ color: '#7dffb3', emissive: '#1d6b45', emissiveIntensity: 0.8, roughness: 0.3 }),
    shutter: makeMat({ color: '#8d939b', metalness: 0.2, roughness: 0.85, side: THREE.DoubleSide }),
  };

  const sunRadius = Math.hypot(key.position.x, key.position.z);
  const sunBase = Math.atan2(key.position.z, key.position.x);
  let sunClock = 0;
  const sunDir = new THREE.Vector3();

  function placeSun() {
    const phi = sunBase + Math.sin(sunClock * ((Math.PI * 2) / SUN_CYCLE_S)) * SUN_SWING;
    key.position.set(Math.cos(phi) * sunRadius, key.position.y, Math.sin(phi) * sunRadius);
  }

  function arrayTiltTarget() {
    sunDir.copy(key.position).normalize();
    const beta = Math.atan2(sunDir.z, sunDir.y) * 0.5;
    return Math.max(-0.45, Math.min(0.45, beta));
  }

  const shutters = Array.from({ length: SHUTTER_COUNT }, () => ({
    closed: false,
    value: 0,
    from: 0,
    to: 0,
    t: 0,
    delay: 0,
  }));
  let onShutters = () => {};

  const streakPositions = new Float32Array(STREAK_LANES.length * 6);
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streaks = new THREE.LineSegments(
    streakGeo,
    new THREE.LineBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.9, depthWrite: false })
  );
  streaks.visible = false;
  streaks.frustumCulled = false;
  scene.add(streaks);
  const streakDir = new THREE.Vector3(1, -0.18, 0.42).normalize();
  const streakSide = new THREE.Vector3().crossVectors(streakDir, new THREE.Vector3(0, 1, 0)).normalize();
  const streakUp = new THREE.Vector3().crossVectors(streakSide, streakDir).normalize();
  const streakCenter = new THREE.Vector3();
  const streakHead = new THREE.Vector3();
  let streakT = -1;

  let ownerId = '';
  let ownerShown = '';
  let ownerFade = 0;
  let ownerPrepared = false;
  const ownerTint = new THREE.Color();

  const built = [];
  const pickables = [];
  let explodeT = 0;
  let targetExplode = 0;
  let mode = 'orbit';
  let selectedId = '';
  let hoverId = '';
  let onSelect = () => {};
  let onHardware = () => {};
  let onHover = () => {};
  let raf = 0;
  let inView = true;
  let keepAlive = false;
  let disposed = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let dockIn = null;
  let dockingOn = false;
  let arrival = null;
  let onArrival = () => {};
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const highlight = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.035, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd278, transparent: true, opacity: 0.95 })
  );
  highlight.rotation.x = Math.PI / 2;
  highlight.visible = false;
  station.add(highlight);

  function emitHover(id) {
    const next = String(id || '');
    if (next === hoverId) return;
    hoverId = next;
    onHover(hoverId);
  }

  function cupolaItem() {
    return built.find((row) => row.mod.id === 'cupola') || null;
  }

  function shutterState() {
    return shutters.map((s) => s.closed);
  }

  function emitShutters(changedIndex) {
    onShutters({ states: shutterState(), changedIndex: Number.isInteger(changedIndex) ? changedIndex : -1 });
  }

  function shuttersBusy() {
    return streakT >= 0 || shutters.some((s) => s.value !== s.to);
  }

  function applyShutterPose() {
    const values = shutters.map((s) => s.value);
    const pivots = cupolaItem()?.group.userData.shutterPivots || [];
    pivots.forEach((pivot, i) => {
      if (!pivot) return;
      const swing = SHUTTER_OPEN_ANGLE * (1 - values[i]);
      if (pivot.userData.shutterAxis === 'z') pivot.rotation.z = swing;
      else pivot.rotation.x = -swing;
    });
    interiors.setShutterValues(values);
  }

  function startStreaks() {
    const item = cupolaItem();
    if (!item) return;
    item.group.getWorldPosition(streakCenter);
    streakT = 0;
    streaks.visible = true;
  }

  function updateStreaks(dt) {
    if (streakT < 0) return;
    streakT += dt;
    STREAK_LANES.forEach((lane, i) => {
      const u = (streakT - lane.delay) / STREAK_TRAVEL;
      const live = u >= 0 && u <= 1;
      streakHead
        .copy(streakCenter)
        .addScaledVector(streakSide, lane.side)
        .addScaledVector(streakUp, lane.up)
        .addScaledVector(streakDir, -7 + 14 * Math.max(0, Math.min(1, u)));
      streakPositions[i * 6] = streakHead.x;
      streakPositions[i * 6 + 1] = streakHead.y;
      streakPositions[i * 6 + 2] = streakHead.z;
      const tailLen = live ? 1.1 : 0;
      streakPositions[i * 6 + 3] = streakHead.x - streakDir.x * tailLen;
      streakPositions[i * 6 + 4] = streakHead.y - streakDir.y * tailLen;
      streakPositions[i * 6 + 5] = streakHead.z - streakDir.z * tailLen;
    });
    streakGeo.attributes.position.needsUpdate = true;
    if (streakT > STREAK_LEAD + 0.05) {
      streakT = -1;
      streaks.visible = false;
    }
  }

  function retargetShutter(s, closed, delay, animate) {
    s.closed = closed;
    s.from = s.value;
    s.to = closed ? 1 : 0;
    s.t = 0;
    s.delay = delay;
    if (!animate) s.value = s.to;
  }

  function setShutters(closed, opts = {}) {
    const want = Boolean(closed);
    const animate = !opts.instant && !reduced;
    const withStreaks = animate && want && shutters.some((s) => !s.closed);
    shutters.forEach((s, i) => {
      retargetShutter(s, want, (withStreaks ? STREAK_LEAD : 0) + i * SHUTTER_STAGGER, animate);
    });
    if (withStreaks) startStreaks();
    applyShutterPose();
    emitShutters();
  }

  function toggleShutter(index) {
    const s = shutters[index];
    if (!s) return;
    retargetShutter(s, !s.closed, 0, !reduced);
    applyShutterPose();
    emitShutters(index);
  }

  function updateShutters(dt) {
    let moved = false;
    shutters.forEach((s) => {
      if (s.value === s.to) return;
      s.t += dt;
      const u = Math.max(0, Math.min(1, (s.t - s.delay) / SHUTTER_SWING));
      s.value = u >= 1 ? s.to : s.from + (s.to - s.from) * easeInOutCubic(u);
      moved = true;
    });
    if (moved) applyShutterPose();
  }

  function prepareOwnerMaterials(rows) {
    rows.forEach((row) => {
      row.parts.forEach((m) => {
        if (m.userData.ownerReady) return;
        m.userData.ownerReady = true;
        m.userData.baseOpacity = m.opacity;
        m.userData.baseDepthWrite = m.depthWrite;
        m.userData.baseTransparent = m.transparent;
        m.transparent = true;
        m.needsUpdate = true;
      });
    });
  }

  function updateOwnerFade(dt) {
    const target = ownerId ? 1 : 0;
    if (ownerId) ownerShown = ownerId;
    if (reduced) ownerFade = target;
    else ownerFade += (target - ownerFade) * Math.min(1, dt * 6);
    if (Math.abs(target - ownerFade) < 0.002) ownerFade = target;
    if (!ownerId && ownerFade === 0) ownerShown = '';
    if (ownerShown) ownerTint.set(OWNER_TINT[ownerShown] || '#ffffff');
  }

  function enterWalkRoom(id) {
    station.visible = false;
    stars.visible = false;
    softShadow.visible = false;
    scene.fog.density = 0.004;
    const cam = interiors.show(id);
    walkPos.set(cam.x || 0, cam.y || 0.15, cam.z || 0);
    look.yaw = 0;
    look.pitch = id === 'cupola' || id === 'kibo-ef' ? -0.5 : 0;
    camera.fov = 70;
    camera.near = 0.05;
    camera.far = 80;
    camera.updateProjectionMatrix();
    if (photoRoot) photoRoot.visible = false;
    earth.position.set(0, id === 'cupola' || id === 'kibo-ef' ? -6.5 : -12, 0);
    atmo.position.copy(earth.position);
    if (reduced) {
      camera.position.copy(walkPos);
    }
  }

  function leaveWalkRoom() {
    interiors.hide();
    station.visible = !photorealOn;
    if (photoRoot) photoRoot.visible = photorealOn;
    stars.visible = true;
    softShadow.visible = true;
    scene.fog.density = 0.016;
    camera.fov = 38;
    camera.near = 0.1;
    camera.far = 120;
    camera.updateProjectionMatrix();
    earth.position.set(0, -9.2, 0);
    atmo.position.copy(earth.position);
  }

  function startDockIn(id) {
    const item = built.find((row) => row.mod.id === id);
    if (!item || reduced) {
      dockIn = null;
      enterWalkRoom(id);
      return;
    }
    const target = item.group.position.clone();
    target.y += 0.35;
    dockIn = {
      id,
      t: 0,
      duration: 0.6,
      from: camera.position.clone(),
      to: target,
      lookFrom: new THREE.Vector3(0, 0.2, 0),
      lookTo: item.group.position.clone(),
    };
  }

  function portFace(item, axis) {
    const geo = item.mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const key = axis.x ? 'x' : axis.y ? 'y' : 'z';
    return axis[key] > 0 ? bb.max[key] : -bb.min[key];
  }

  function clearArrival() {
    if (!arrival) return;
    station.remove(arrival.vehicle);
    arrival.vehicle.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose();
    });
    arrival = null;
  }

  function emitArrival() {
    if (!arrival) return;
    const step = arrival.steps[arrival.index];
    onArrival({
      port: arrival.port,
      step: step.id,
      label: step.label,
      hint: step.hint,
      index: arrival.index,
      total: arrival.steps.length,
      done: arrival.done,
    });
  }

  function arrivalGap(step, u) {
    const e = easeInOutCubic(u);
    if (arrival.kind === 'berthing') {
      if (step === 'approach') return 7 + (1.6 - 7) * e;
      if (step === 'grapple') return 1.6;
      if (step === 'berth') return 1.6 * (1 - e);
      return 0;
    }
    if (step === 'approach') return 7 + (0.7 - 7) * e;
    if (step === 'soft') return 0.7 + (0.32 - 0.7) * e;
    if (step === 'hard') return 0.32 * (1 - e);
    return 0;
  }

  function placeArrival(u) {
    const step = arrival.steps[arrival.index].id;
    const gap = arrivalGap(step, u);
    arrival.vehicle.position
      .copy(arrival.item.group.position)
      .addScaledVector(arrival.axis, arrival.face + arrival.front + gap);
    const hull = arrival.vehicle.userData.hull;
    if (hull) {
      const glow = step === 'hatch' && !arrival.done ? Math.sin(u * Math.PI) : 0;
      hull.emissive.setRGB(glow * 0.35, glow * 0.3, glow * 0.12);
    }
  }

  function updateArrival(dt) {
    if (!arrival) return;
    if (arrival.done) {
      placeArrival(1);
      return;
    }
    const step = arrival.steps[arrival.index];
    arrival.t += reduced ? step.s : dt;
    const u = Math.min(1, arrival.t / step.s);
    placeArrival(u);
    if (u < 1) return;
    if (arrival.index < arrival.steps.length - 1) {
      arrival.index += 1;
      arrival.t = 0;
    } else {
      arrival.done = true;
    }
    emitArrival();
  }

  function startArrival(opts = {}) {
    const port = String(opts.port || '');
    const kind = opts.kind === 'berthing' ? 'berthing' : 'docking';
    const item = built.find((row) => row.mod.id === port);
    const axisArr = ARRIVAL_AXIS[port];
    if (!item || !axisArr) return false;
    clearArrival();
    const axis = new THREE.Vector3(axisArr[0], axisArr[1], axisArr[2]);
    const vehicle = buildVehicle(opts.vehicle, kind);
    vehicle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().negate());
    station.add(vehicle);
    arrival = {
      port,
      kind,
      item,
      axis,
      vehicle,
      face: portFace(item, axis),
      front: kind === 'berthing' ? 0.1 : 0.14,
      steps: ARRIVAL_STEPS[kind],
      index: 0,
      t: 0,
      done: false,
      framed: true,
      look: new THREE.Vector3(0, 0.2, 0),
    };
    placeArrival(0);
    emitArrival();
    return true;
  }

  function ringWanted(item) {
    if (arrival && arrival.item === item) {
      if (arrival.done || arrival.kind !== 'docking') return 0;
      const step = arrival.steps[arrival.index].id;
      return step === 'approach' || step === 'soft' ? 1 : 0;
    }
    return dockingOn || selectedId === item.mod.id ? 1 : 0;
  }

  function applyPositions() {
    built.forEach((item) => {
      const rest = item.group.userData.rest;
      const ex = item.group.userData.explode;
      item.group.position.set(
        rest.x + ex.x * explodeT,
        rest.y + ex.y * explodeT,
        rest.z + ex.z * explodeT
      );
    });
  }

  function setHighlight(id) {
    if (mode === 'walk') {
      highlight.visible = false;
      return;
    }
    const item = built.find((row) => row.mod.id === id);
    highlight.visible = Boolean(item);
    if (item) {
      highlight.position.copy(item.group.position);
      highlight.position.y += 1.05;
      const pulse = 0.9 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
      highlight.scale.setScalar(reduced ? 1 : pulse);
    }
    built.forEach((row) => {
      const mat = row.mesh.material;
      if (!mat) return;
      if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
      const walkable = WALK_ROOMS.has(row.mod.id);
      const on = row.mod.id === id;
      const base = mat.userData?.baseEmissive;
      const baseI = mat.userData?.baseEmissiveIntensity || 0;
      const owned = partnerMatches(row.mod, ownerShown);
      const dimK = ownerShown && !owned ? ownerFade : 0;
      const tintK = owned ? ownerFade : 0;
      row.group.traverse((obj) => {
        if (obj.userData?.walkRim && obj.material) {
          obj.material.opacity = (on ? 0.72 : walkable ? 0.38 : 0.2) * (1 - 0.85 * dimK);
          obj.material.color.setHex(on ? 0xffd278 : 0x7ec8ff);
        }
      });
      if (ownerPrepared) {
        row.parts.forEach((m) => {
          m.opacity = m.userData.baseOpacity * (1 - 0.78 * dimK);
          m.depthWrite = dimK > 0.01 ? false : m.userData.baseDepthWrite;
        });
      }
      if (mat.userData?.baseColor) {
        mat.color.copy(mat.userData.baseColor);
        if (tintK > 0) mat.color.lerp(ownerTint, 0.55 * tintK);
      }
      if (on) {
        mat.emissive.setHex(0x6a4814);
        mat.emissiveIntensity = 0.68;
      } else if (tintK > 0) {
        mat.emissive.copy(ownerTint);
        mat.emissiveIntensity = 0.38 * tintK;
      } else if (walkable) {
        mat.emissive.setHex(0x1a4558);
        mat.emissiveIntensity = 0.26;
      } else if (base) {
        mat.emissive.copy(base);
        mat.emissiveIntensity = baseI;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  }

  function syncWalkRoom() {
    if (mode === 'walk' && WALK_ROOMS.has(selectedId)) {
      if (!station.visible) {
        dockIn = null;
        enterWalkRoom(selectedId);
      } else {
        startDockIn(selectedId);
      }
    } else {
      dockIn = null;
      leaveWalkRoom();
    }
  }

  function pickModule(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (mode === 'walk') {
      const hits = raycaster.intersectObjects(interiors.getPickables(), false);
      const hit = hits.find((h) => h.object.userData.hardwareId);
      const shutterIndex = hit?.object.userData.shutterIndex;
      return {
        type: 'hardware',
        id: hit?.object.userData.hardwareId || '',
        hw: hit?.object.userData.hardware || null,
        shutterIndex: Number.isInteger(shutterIndex) ? shutterIndex : -1,
      };
    }
    const hits = raycaster.intersectObjects(pickables, false);
    const hit = hits.find((h) => h.object.userData.moduleId && !h.object.userData.skipPick);
    return { type: 'module', id: hit?.object.userData.moduleId || '' };
  }

  function placeCamera(dt) {
    if (dockIn) {
      dockIn.t += dt;
      const u = Math.min(1, dockIn.t / dockIn.duration);
      const ease = 1 - Math.pow(1 - u, 3);
      camera.position.lerpVectors(dockIn.from, dockIn.to, ease);
      const lookAt = dockIn.lookFrom.clone().lerp(dockIn.lookTo, ease);
      camera.lookAt(lookAt);
      if (u >= 1) {
        const id = dockIn.id;
        dockIn = null;
        enterWalkRoom(id);
      }
      return;
    }
    if (arrival && arrival.framed && mode !== 'walk') {
      const target = arrival.item.group.position.clone().add(station.position);
      const dir = arrival.axis.clone().multiplyScalar(0.8).add(ARRIVAL_VIEW).normalize();
      const want = target.clone().addScaledVector(dir, 8.5);
      const k = reduced ? 1 : Math.min(1, dt * 2.2);
      camera.position.lerp(want, k);
      arrival.look.lerp(target, k);
      camera.lookAt(arrival.look);
      return;
    }
    if (mode === 'walk' && WALK_ROOMS.has(selectedId)) {
      const blend = reduced ? 1 : Math.min(1, dt * 4);
      camera.position.lerp(walkPos, blend);
      const dir = new THREE.Vector3(
        Math.sin(look.yaw) * Math.cos(look.pitch),
        Math.sin(look.pitch),
        Math.cos(look.yaw) * Math.cos(look.pitch)
      );
      camera.lookAt(camera.position.clone().add(dir));
      return;
    }
    const x = Math.sin(orbit.theta) * Math.cos(orbit.phi) * orbit.radius;
    const y = Math.sin(orbit.phi) * orbit.radius;
    const z = Math.cos(orbit.theta) * Math.cos(orbit.phi) * orbit.radius;
    camera.position.set(x, y + 1.2, z);
    camera.lookAt(0, 0.2, 0);
  }

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if ((!inView && !keepAlive) || document.hidden) return;
    const dt = Math.min(0.05, clock.getDelta());
    targetExplode = mode === 'explode' ? 1 : 0;
    if (reduced) explodeT = targetExplode;
    else explodeT += (targetExplode - explodeT) * Math.min(1, dt * 3.2);
    applyPositions();
    updateStreaks(dt);
    updateShutters(dt);
    updateOwnerFade(dt);
    setHighlight(selectedId || hoverId);
    updateArrival(dt);
    if (!reduced && mode !== 'walk' && !dockIn && !(arrival && !arrival.done)) {
      if (!shuttersBusy()) {
        orbit.theta += dt * 0.08;
        sunClock += dt;
        placeSun();
      }
      earth.rotation.y += dt * 0.02;
    }
    const tilt = arrayTiltTarget();
    const armPhase = clock.elapsedTime;
    built.forEach((item) => {
      if (item.group.userData.solarArray) {
        const r = item.group.rotation;
        r.x = reduced ? tilt : r.x + (tilt - r.x) * Math.min(1, dt * 1.5);
      }
      const capture = item.group.userData.softCapture;
      if (capture) {
        const want = ringWanted(item);
        capture.t = reduced ? want : capture.t + (want - capture.t) * Math.min(1, dt * 2.6);
        if (Math.abs(capture.t - want) < 0.002) capture.t = want;
        capture.rig.visible = capture.t > 0.01;
        capture.rig.position.y = 0.02 + capture.t * 0.36;
      }
      const joints = item.group.userData.armJoints;
      if (!joints) return;
      if (reduced) {
        joints.shoulder.rotation.y = 0.35;
        joints.elbow.rotation.z = -0.7;
        joints.wrist.rotation.y = 0.2;
        return;
      }
      joints.shoulder.rotation.y = Math.sin(armPhase * 0.18) * 0.45;
      joints.elbow.rotation.z = -0.65 + Math.sin(armPhase * 0.22) * 0.28;
      joints.wrist.rotation.y = Math.sin(armPhase * 0.31) * 0.4;
    });
    if (passMesh && passT < 1) {
      passT = reduced ? 1 : Math.min(1, passT + dt / 1.4);
      const u = passT * passT * (3 - 2 * passT);
      passMesh.position.lerpVectors(passFrom, passTo, u);
      if (passT >= 1) onPassThrough();
    }
    placeCamera(dt);
    renderer.render(scene, camera);
  }

  function play() {
    if (disposed || raf) return;
    clock.getDelta();
    tick();
  }

  function onPointerDown(ev) {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    downX = ev.clientX;
    downY = ev.clientY;
  }
  function onPointerMove(ev) {
    if (dragging) {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (mode === 'walk') {
        look.yaw -= dx * 0.005;
        look.pitch = Math.max(-1.2, Math.min(1.2, look.pitch - dy * 0.004));
      } else {
        if (arrival && Math.abs(dx) + Math.abs(dy) > 2) arrival.framed = false;
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(-0.2, Math.min(1.15, orbit.phi - dy * 0.004));
      }
    }
    queueHover(ev);
  }

  let hoverQueued = false;
  let hoverEv = null;
  function queueHover(ev) {
    hoverEv = ev;
    if (hoverQueued) return;
    hoverQueued = true;
    window.requestAnimationFrame(() => {
      hoverQueued = false;
      const cur = hoverEv;
      hoverEv = null;
      if (!cur || disposed) return;
      const pick = pickModule(cur);
      emitHover(pick.type === 'module' ? pick.id : '');
      renderer.domElement.style.cursor = pick.id || pick.hw ? 'pointer' : dragging ? 'grabbing' : 'grab';
    });
  }

  function nudgeLook(dYaw, dPitch) {
    look.yaw += Number(dYaw) || 0;
    look.pitch = Math.max(-1.2, Math.min(1.2, look.pitch + (Number(dPitch) || 0)));
  }
  function onPointerUp(ev) {
    const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
    dragging = false;
    if (moved < 6) {
      const pick = pickModule(ev);
      if (pick.type === 'hardware' && pick.hw) {
        if (pick.shutterIndex >= 0) toggleShutter(pick.shutterIndex);
        onHardware(pick.hw);
      } else if (pick.type === 'module' && pick.id) {
        selectedId = pick.id;
        onSelect(pick.id);
      }
    }
  }
  function onWheel(ev) {
    if (mode === 'walk') return;
    ev.preventDefault();
    if (arrival) arrival.framed = false;
    orbit.radius = Math.max(8, Math.min(32, orbit.radius + ev.deltaY * 0.012));
  }

  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView || keepAlive) play();
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
    clearArrival();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('wheel', onWheel);
    interiors.dispose();
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
            if (m.map) m.map.dispose();
            m.dispose();
          }
        });
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    if (stillEl) stillEl.hidden = false;
  }

  resize();
  play();

  return {
    setModules(list) {
      built.splice(0).forEach((item) => station.remove(item.group));
      pickables.length = 0;
      (list || []).forEach((mod) => {
        const item = buildModule(mod, mats);
        station.add(item.group);
        built.push(item);
        pickables.push(item.mesh);
      });
      if (ownerPrepared) prepareOwnerMaterials(built);
      applyPositions();
      applyShutterPose();
    },
    setShutters,
    toggleShutter,
    getShutters: shutterState,
    onShutters(fn) {
      onShutters = typeof fn === 'function' ? fn : () => {};
    },
    setOwner(partner) {
      const next = OWNER_TINT[partner] ? partner : '';
      if (next && !ownerPrepared) {
        prepareOwnerMaterials(built);
        ownerPrepared = true;
      }
      ownerId = next;
      if (next) ownerShown = next;
    },
    getOwner() {
      return ownerId;
    },
    setInteriorsCatalog(data) {
      interiors.setCatalog(data);
    },
    setPhotoreal(on) {
      photorealOn = Boolean(on);
      if (!photorealOn) {
        photoRoot.visible = false;
        if (mode !== 'walk') station.visible = true;
        return Promise.resolve(false);
      }
      const show = () => {
        if (mode !== 'walk') {
          station.visible = false;
          photoRoot.visible = true;
        }
      };
      if (photoRoot.children.length) {
        show();
        return Promise.resolve(true);
      }
      if (!photoPromise) {
        photoPromise = new Promise((resolve, reject) => {
          const loader = new GLTFLoader();
          const draco = new DRACOLoader();
          draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
          loader.setDRACOLoader(draco);
          loader.load(
            PHOTO_URL,
            (gltf) => {
              const model = gltf.scene;
              model.traverse((obj) => {
                if (!obj.isMesh || !obj.material) return;
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((mat) => {
                  if (typeof mat.metalness === 'number') mat.metalness = Math.min(mat.metalness, 0.35);
                  if (typeof mat.roughness === 'number') mat.roughness = Math.max(mat.roughness, 0.42);
                  mat.envMapIntensity = 0.35;
                  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                  mat.needsUpdate = true;
                });
              });
              photoRoot.add(model);
              model.position.set(0, 0, 0);
              model.rotation.set(0, 0, 0);
              model.scale.set(1, 1, 1);
              model.updateMatrixWorld(true);
              const box = new THREE.Box3().setFromObject(model);
              const size = new THREE.Vector3();
              box.getSize(size);
              if (size.x <= size.y && size.x <= size.z) model.rotation.z = Math.PI / 2;
              else if (size.z <= size.x && size.z <= size.y) model.rotation.x = Math.PI / 2;
              model.updateMatrixWorld(true);
              const turned = new THREE.Box3().setFromObject(model);
              const turnedSize = new THREE.Vector3();
              turned.getSize(turnedSize);
              const span = Math.max(turnedSize.x, turnedSize.y, turnedSize.z) || 1;
              model.scale.setScalar(12 / span);
              model.updateMatrixWorld(true);
              const placed = new THREE.Box3().setFromObject(model);
              const placedCenter = new THREE.Vector3();
              placed.getCenter(placedCenter);
              model.position.set(
                photoRoot.position.x - placedCenter.x,
                photoRoot.position.y - placedCenter.y,
                photoRoot.position.z - placedCenter.z
              );
              resolve(true);
            },
            undefined,
            reject
          );
        });
      }
      return photoPromise.then((ok) => {
        if (photorealOn) show();
        return ok;
      }).catch((err) => {
        photorealOn = false;
        photoPromise = null;
        photoRoot.visible = false;
        if (mode !== 'walk') station.visible = true;
        throw err;
      });
    },
    getPhotoreal() {
      return photorealOn;
    },
    setDocking(on) {
      dockingOn = Boolean(on);
    },
    getDocking() {
      return dockingOn;
    },
    startArrival,
    clearArrival,
    onArrival(fn) {
      onArrival = typeof fn === 'function' ? fn : () => {};
    },
    startPassThrough() {
      const from = built.find((row) => row.mod.id === 'kibo');
      const to = built.find((row) => row.mod.id === 'kibo-ef');
      if (!from || !to) return false;
      if (!passMesh) {
        passMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, 0.2, 0.26),
          mats.jaxa.clone()
        );
        passMesh.name = 'efu-payload';
        scene.add(passMesh);
      }
      passFrom.copy(from.group.position);
      passTo.copy(to.group.position);
      passTo.y += 0.4;
      passMesh.position.copy(passFrom);
      passMesh.visible = true;
      passT = reduced ? 1 : 0;
      if (reduced) {
        passMesh.position.copy(passTo);
        onPassThrough();
      }
      return true;
    },
    onPassThrough(fn) {
      onPassThrough = typeof fn === 'function' ? fn : () => {};
    },
    setNow(geo) {
      if (!geo || !Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lon))) return;
      earth.rotation.x = Number(geo.lat) * DEG;
      earth.rotation.y = -Number(geo.lon) * DEG;
    },
    selectModule(id) {
      selectedId = String(id || '');
      setHighlight(selectedId);
      if (mode === 'walk') syncWalkRoom();
    },
    setMode(next) {
      const wanted = next === 'explode' || next === 'walk' ? next : 'orbit';
      if (wanted === 'walk' && !WALK_ROOMS.has(selectedId)) {
        mode = 'orbit';
        dockIn = null;
        leaveWalkRoom();
        return;
      }
      mode = wanted;
      if (mode !== 'walk') orbit.radius = mode === 'explode' ? 22 : 18;
      syncWalkRoom();
    },
    setKeepAlive(on) {
      keepAlive = Boolean(on);
      if (keepAlive || inView) play();
    },
    getSelected() {
      return selectedId;
    },
    getMode() {
      return mode;
    },
    canWalk(id) {
      return WALK_ROOMS.has(String(id || selectedId));
    },
    onSelect(fn) {
      onSelect = typeof fn === 'function' ? fn : () => {};
    },
    onHardware(fn) {
      onHardware = typeof fn === 'function' ? fn : () => {};
    },
    onHover(fn) {
      onHover = typeof fn === 'function' ? fn : () => {};
    },
    nudgeLook,
    dispose,
    resize,
    canvas: renderer.domElement,
  };
}

function boot() {
  const stage = document.getElementById('stStage');
  if (!stage || window.PlanetariumStationScene) return;
  let sceneApi = null;
  try {
    sceneApi = createStationScene(stage, {
      stillEl: document.getElementById('stStill'),
    });
    if (sceneApi.canvas) {
      sceneApi.canvas.setAttribute('role', 'img');
      sceneApi.canvas.setAttribute('aria-label', 'Interactive International Space Station schematic');
    }
  } catch (err) {
    console.warn('ISS station WebGL failed', err);
    const still = document.getElementById('stStill');
    if (still) still.hidden = false;
    return;
  }
  window.PlanetariumStationScene = sceneApi;
  window.addEventListener('pagehide', () => sceneApi && sceneApi.dispose(), { once: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
