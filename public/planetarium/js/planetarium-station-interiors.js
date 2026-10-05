/**
 * Authentic 1:1 ISS interior walk sets (1 unit = 1 meter).
 * NASA dimensions + named hardware; NASA PD stills as BackSide hull maps.
 * Development work by David Lane
 */
import * as THREE from 'three';

const ISPR = { h: 2.0, w: 1.05, d: 0.86 };

function makeMat(params) {
  return new THREE.MeshStandardMaterial(params);
}

function addMesh(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x || 0, y || 0, z || 0);
  parent.add(mesh);
  return mesh;
}

function tagHardware(mesh, hw) {
  if (!hw) return mesh;
  mesh.userData.hardwareId = hw.id;
  mesh.userData.hardware = hw;
  mesh.userData.skipPick = false;
  return mesh;
}

function loadTexture(loader, url, onReady) {
  if (!url) return null;
  const tex = loader.load(
    url,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      onReady?.(t);
    },
    undefined,
    () => onReady?.(null)
  );
  return tex;
}

function buildIspr(mats, hw, x, y, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (rotY) g.rotation.y = rotY;
  const body = addMesh(g, new THREE.BoxGeometry(ISPR.w, ISPR.h, ISPR.d), mats.rack.clone(), 0, 0, 0);
  tagHardware(body, hw);
  const face = addMesh(
    g,
    new THREE.BoxGeometry(ISPR.w * 0.92, ISPR.h * 0.55, 0.04),
    mats.panel.clone(),
    0,
    0.15,
    ISPR.d / 2 + 0.02
  );
  tagHardware(face, hw);
  const screen = addMesh(
    g,
    new THREE.BoxGeometry(ISPR.w * 0.55, 0.28, 0.03),
    mats.screen.clone(),
    0,
    0.55,
    ISPR.d / 2 + 0.04
  );
  tagHardware(screen, hw);
  return g;
}

function buildHatch(mats, hw, x, y, z, axis) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.06, 10, 28),
    mats.hatch.clone()
  );
  if (axis === 'x') ring.rotation.y = Math.PI / 2;
  else if (axis === 'y') ring.rotation.x = Math.PI / 2;
  // axis z = default torus in XY plane (port/starboard faces)
  tagHardware(ring, hw);
  g.add(ring);
  const door = addMesh(g, new THREE.CircleGeometry(0.55, 24), mats.door.clone(), 0, 0, 0);
  if (axis === 'x') door.rotation.y = Math.PI / 2;
  else if (axis === 'y') door.rotation.x = Math.PI / 2;
  tagHardware(door, hw);
  return g;
}

function buildCrewQuarter(mats, hw, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const box = addMesh(g, new THREE.BoxGeometry(0.95, 1.95, 0.95), mats.cq.clone(), 0, 0, 0);
  tagHardware(box, hw);
  const door = addMesh(g, new THREE.BoxGeometry(0.55, 1.4, 0.04), mats.door.clone(), 0, -0.1, 0.48);
  tagHardware(door, hw);
  return g;
}

function buildKayuta(mats, hw, x, y, z, dims) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const w = dims?.width || 0.73;
  const d = dims?.depth || 0.85;
  const h = dims?.height || 1.89;
  const box = addMesh(g, new THREE.BoxGeometry(w, h, d), mats.rosInterior.clone(), 0, h / 2 - 0.95, 0);
  tagHardware(box, hw);
  return g;
}

function hullMaterial(mats, map) {
  const mat = mats.hull.clone();
  if (map) {
    mat.map = map;
    mat.color.set('#ffffff');
  }
  mat.side = THREE.BackSide;
  mat.needsUpdate = true;
  return mat;
}

function buildDestiny(room, mats, map) {
  const g = new THREE.Group();
  const L = room.lengthM;
  const R = room.diameterM / 2;
  const hull = addMesh(g, new THREE.CylinderGeometry(R, R, L, 32, 1, true), hullMaterial(mats, map), 0, 0, 0);
  hull.rotation.z = Math.PI / 2;
  hull.userData.skipPick = true;

  const faces = ['deck', 'overhead', 'port', 'starboard'];
  const faceHardware = Object.fromEntries(faces.map((f) => [f, room.hardware.filter((h) => h.face === f)]));
  faces.forEach((face) => {
    const list = faceHardware[face] || [];
    list.forEach((hw, i) => {
      const along = -L / 2 + 1.1 + i * (ISPR.w + 0.12);
      let x = along;
      let y = 0;
      let z = 0;
      let rot = 0;
      if (face === 'deck') {
        y = -R + ISPR.h / 2 + 0.05;
        z = 0;
        rot = 0;
      } else if (face === 'overhead') {
        y = R - ISPR.h / 2 - 0.05;
        rot = Math.PI;
      } else if (face === 'port') {
        z = -R + ISPR.d / 2 + 0.08;
        rot = Math.PI / 2;
      } else {
        z = R - ISPR.d / 2 - 0.08;
        rot = -Math.PI / 2;
      }
      g.add(buildIspr(mats, hw, x, y, z, rot));
    });
  });

  const worf = room.hardware.find((h) => h.id === 'destiny-worf');
  if (worf) {
    const win = addMesh(g, new THREE.CircleGeometry(0.32, 24), mats.glass.clone(), 0, -R + 0.08, 0);
    win.rotation.x = Math.PI / 2;
    tagHardware(win, worf);
  }
  const aft = room.hardware.find((h) => h.id === 'destiny-hatch-aft');
  const fwd = room.hardware.find((h) => h.id === 'destiny-hatch-fwd');
  if (aft) g.add(buildHatch(mats, aft, -L / 2 + 0.05, 0, 0, 'x'));
  if (fwd) g.add(buildHatch(mats, fwd, L / 2 - 0.05, 0, 0, 'x'));
  return g;
}

function buildHarmony(room, mats, map) {
  const g = new THREE.Group();
  const L = room.lengthM;
  const R = room.diameterM / 2;
  const hull = addMesh(g, new THREE.BoxGeometry(L, R * 1.7, R * 1.7), hullMaterial(mats, map), 0, 0, 0);
  hull.userData.skipPick = true;
  const cqs = room.hardware.filter((h) => h.role.includes('sleep'));
  const spots = [
    [0.8, -0.2, 1.35],
    [0.8, 0.85, -0.2],
    [-1.1, -0.2, -1.2],
    [1.6, -0.2, -1.1],
  ];
  cqs.forEach((hw, i) => {
    const s = spots[i] || spots[0];
    g.add(buildCrewQuarter(mats, hw, s[0], s[1], s[2]));
  });
  room.hardware
    .filter((h) => h.role.includes('CBM') || h.role.includes('docking') || h.role.includes('berthing') || h.role.includes('PMA'))
    .forEach((hw) => {
      const face = hw.face;
      if (face === 'aft') g.add(buildHatch(mats, hw, -L / 2 + 0.08, 0, 0, 'x'));
      if (face === 'forward') g.add(buildHatch(mats, hw, L / 2 - 0.08, 0, 0, 'x'));
      if (face === 'port') g.add(buildHatch(mats, hw, 0, 0, -R + 0.1, 'z'));
      if (face === 'starboard') g.add(buildHatch(mats, hw, 0, 0, R - 0.1, 'z'));
      if (face === 'zenith') g.add(buildHatch(mats, hw, 0, R - 0.15, 0, 'y'));
      if (face === 'nadir') g.add(buildHatch(mats, hw, 0, -R + 0.15, 0, 'y'));
    });
  return g;
}

function buildColumbus(room, mats, map) {
  const g = new THREE.Group();
  const L = room.lengthM;
  const R = room.diameterM / 2;
  const hull = addMesh(g, new THREE.CylinderGeometry(R, R, L, 32, 1, true), hullMaterial(mats, map), 0, 0, 0);
  hull.rotation.x = Math.PI / 2;
  hull.userData.skipPick = true;
  const wall = room.hardware.filter((h) => h.face === 'port' || h.face === 'starboard');
  wall.forEach((hw, i) => {
    const along = -L / 2 + 1.2 + (i % 4) * 1.25;
    const port = hw.face === 'port';
    g.add(buildIspr(mats, hw, port ? -R + ISPR.d / 2 + 0.1 : R - ISPR.d / 2 - 0.1, 0, along, port ? Math.PI / 2 : -Math.PI / 2));
  });
  room.hardware
    .filter((h) => h.face === 'overhead')
    .forEach((hw, i) => {
      g.add(buildIspr(mats, hw, 0, R - ISPR.h / 2 - 0.08, -1 + i * 1.3, Math.PI));
    });
  const hatch = room.hardware.find((h) => h.id === 'columbus-hatch');
  if (hatch) g.add(buildHatch(mats, hatch, 0, 0, -L / 2 + 0.08, 'z'));
  return g;
}

function buildKibo(room, mats, map) {
  const g = new THREE.Group();
  const L = room.lengthM;
  const R = room.diameterM / 2;
  const hull = addMesh(g, new THREE.CylinderGeometry(R, R, L, 32, 1, true), hullMaterial(mats, map), 0, 0, 0);
  hull.rotation.x = Math.PI / 2;
  hull.userData.skipPick = true;
  const racks = room.hardware.filter((h) => /ISPR|Saibo|Ryutai/.test(h.name) || /rack/i.test(h.role));
  racks.forEach((hw, i) => {
    const along = -L / 2 + 1.4 + i * 1.15;
    const port = i % 2 === 0;
    g.add(buildIspr(mats, hw, port ? -R + ISPR.d / 2 + 0.1 : R - ISPR.d / 2 - 0.1, 0, along, port ? Math.PI / 2 : -Math.PI / 2));
  });
  const airlock = room.hardware.find((h) => h.id === 'kibo-airlock');
  if (airlock) {
    const al = addMesh(g, new THREE.CylinderGeometry(0.7, 0.7, 1.2, 16), mats.hatch.clone(), 0, 0, L / 2 - 0.7);
    al.rotation.x = Math.PI / 2;
    tagHardware(al, airlock);
  }
  const hatch = room.hardware.find((h) => h.id === 'kibo-hatch');
  if (hatch) g.add(buildHatch(mats, hatch, 0, 0, -L / 2 + 0.08, 'z'));
  return g;
}

function buildCupola(room, mats, map) {
  const g = new THREE.Group();
  const D = room.diameterM;
  const H = room.lengthM;
  const shell = addMesh(
    g,
    new THREE.CylinderGeometry(D * 0.32, D * 0.48, H, 12, 1, true),
    hullMaterial(mats, map),
    0,
    H / 2 - 0.15,
    0
  );
  shell.userData.skipPick = true;

  const shutterHw = room.hardware.find((h) => h.id === 'cupola-shutters');
  const plateMat = mats.shutter.clone();
  const nadir = room.hardware.find((h) => h.id === 'cupola-win-nadir');
  if (nadir) {
    const pane = addMesh(g, new THREE.CircleGeometry(0.4, 28), mats.glassClear.clone(), 0, 0.12, 0);
    pane.rotation.x = -Math.PI / 2;
    tagHardware(pane, nadir);
    pane.userData.shutterIndex = 0;
    const pivot = new THREE.Group();
    pivot.position.set(0.44, 0.09, 0);
    pivot.userData.shutterPivot = 0;
    pivot.userData.shutterAxis = 'z';
    g.add(pivot);
    const plate = addMesh(pivot, new THREE.CircleGeometry(0.44, 28), plateMat, -0.44, 0, 0);
    plate.rotation.x = -Math.PI / 2;
    tagHardware(plate, shutterHw || nadir);
    plate.userData.shutterIndex = 0;
  }
  const sides = room.hardware.filter((h) => h.id.startsWith('cupola-win-') && h.id !== 'cupola-win-nadir');
  sides.forEach((hw, i) => {
    const a = (i / 6) * Math.PI * 2;
    const pane = addMesh(
      g,
      new THREE.PlaneGeometry(0.55, 0.42),
      mats.glassClear.clone(),
      Math.cos(a) * 0.95,
      0.55,
      Math.sin(a) * 0.95
    );
    pane.lookAt(0, 0.55, 0);
    tagHardware(pane, hw);
    pane.userData.shutterIndex = i + 1;
    const plateH = 0.47;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 0.975, 0.55 + plateH / 2, Math.sin(a) * 0.975);
    pivot.rotation.order = 'YXZ';
    pivot.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    pivot.userData.shutterPivot = i + 1;
    pivot.userData.shutterAxis = 'x';
    g.add(pivot);
    const plate = addMesh(pivot, new THREE.PlaneGeometry(0.6, plateH), plateMat, 0, -plateH / 2, 0);
    tagHardware(plate, shutterHw || hw);
    plate.userData.shutterIndex = i + 1;
  });
  const robot = room.hardware.find((h) => h.id === 'cupola-robot');
  if (robot) {
    const stand = addMesh(g, new THREE.BoxGeometry(0.55, 0.9, 0.4), mats.rack.clone(), 0.55, 0.55, 0.2);
    tagHardware(stand, robot);
    const screen = addMesh(g, new THREE.BoxGeometry(0.4, 0.28, 0.04), mats.screen.clone(), 0.55, 0.85, 0.42);
    tagHardware(screen, robot);
  }
  const hatch = room.hardware.find((h) => h.id === 'cupola-hatch');
  if (hatch) g.add(buildHatch(mats, hatch, 0, H - 0.1, 0, 'y'));
  return g;
}

function buildZvezda(room, mats, map) {
  const g = new THREE.Group();
  const living = addMesh(
    g,
    new THREE.CylinderGeometry(2.05, 2.05, 2.9, 28, 1, true),
    hullMaterial(mats, map),
    -2.2,
    0,
    0
  );
  living.rotation.z = Math.PI / 2;
  living.userData.skipPick = true;
  const work = addMesh(
    g,
    new THREE.CylinderGeometry(1.45, 1.45, 4.2, 28, 1, true),
    mats.rosHull.clone(),
    1.6,
    0,
    0
  );
  work.material.side = THREE.BackSide;
  work.rotation.z = Math.PI / 2;
  work.userData.skipPick = true;

  const kayuti = room.hardware.filter((h) => /Kayuta/i.test(h.name));
  kayuti.forEach((hw, i) => {
    g.add(buildKayuta(mats, hw, -2.2, -0.2, i === 0 ? -1.35 : 1.35, room.kayutiM));
  });
  const table = room.hardware.find((h) => h.id === 'zvezda-galley');
  if (table) {
    const t = addMesh(g, new THREE.BoxGeometry(0.9, 0.08, 0.55), mats.rosInterior.clone(), -2.0, -0.55, 0);
    tagHardware(t, table);
  }
  const treadmill = room.hardware.find((h) => h.id === 'zvezda-treadmill');
  if (treadmill) {
    const tm = addMesh(g, new THREE.BoxGeometry(1.6, 0.12, 0.55), mats.rack.clone(), 1.4, -1.1, 0);
    tagHardware(tm, treadmill);
  }
  ;['zvezda-elektron', 'zvezda-vozdukh'].forEach((id, i) => {
    const hw = room.hardware.find((h) => h.id === id);
    if (!hw) return;
    const box = addMesh(g, new THREE.BoxGeometry(0.7, 0.9, 0.45), mats.rosInterior.clone(), 0.6 + i * 0.9, 0.7, -1.0);
    tagHardware(box, hw);
  });
  const win = room.hardware.find((h) => h.id === 'zvezda-window-obs');
  if (win) {
    const pane = addMesh(g, new THREE.CircleGeometry(0.2, 20), mats.glass.clone(), 1.2, -1.15, 0);
    pane.rotation.x = Math.PI / 2;
    tagHardware(pane, win);
  }
  const fwd = room.hardware.find((h) => h.id === 'zvezda-hatch-fwd');
  if (fwd) g.add(buildHatch(mats, fwd, 3.6, 0, 0, 'x'));
  return g;
}

function buildKiboEf(room, mats) {
  const g = new THREE.Group();
  const deck = addMesh(g, new THREE.BoxGeometry(4.2, 0.12, 5.2), mats.panel.clone(), 0, -0.4, 0);
  deck.userData.skipPick = true;
  const maxi = room.hardware.find((h) => h.id === 'jem-ef-maxi');
  if (maxi) {
    const box = addMesh(g, new THREE.BoxGeometry(0.7, 0.55, 0.7), mats.rack.clone(), -1.1, 0.05, 0.8);
    tagHardware(box, maxi);
  }
  const calet = room.hardware.find((h) => h.id === 'jem-ef-calet');
  if (calet) {
    const box = addMesh(g, new THREE.BoxGeometry(0.8, 0.7, 0.6), mats.hatch.clone(), 1.15, 0.1, 0.4);
    tagHardware(box, calet);
  }
  const arm = room.hardware.find((h) => h.id === 'jemrms');
  if (arm) {
    const base = addMesh(g, new THREE.CylinderGeometry(0.12, 0.16, 0.35, 10), mats.rack.clone(), 0, 0.1, -1.6);
    tagHardware(base, arm);
    const boom = addMesh(g, new THREE.BoxGeometry(0.12, 0.12, 1.6), mats.hatch.clone(), 0.5, 0.7, -1.1);
    boom.rotation.y = 0.5;
    boom.rotation.z = -0.4;
    boom.userData.skipPick = true;
  }
  const air = room.hardware.find((h) => h.id === 'jem-ef-airlock');
  if (air) {
    const hatch = addMesh(g, new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), mats.door.clone(), 0, 0.2, -2.4);
    hatch.rotation.x = Math.PI / 2;
    tagHardware(hatch, air);
  }
  return g;
}

function buildDockingTunnel(room, mats) {
  const g = new THREE.Group();
  const shell = addMesh(g, new THREE.CylinderGeometry(0.8, 0.8, 1.6, 20, 1, true), hullMaterial(mats, null), 0, 0, 0);
  shell.rotation.x = Math.PI / 2;
  shell.userData.skipPick = true;
  const ringHw = room.hardware.find((h) => /ring/.test(h.id));
  if (ringHw) {
    const ring = addMesh(g, new THREE.TorusGeometry(0.72, 0.06, 8, 20), mats.hatch.clone(), 0, 0, 0.7);
    tagHardware(ring, ringHw);
  }
  const petals = room.hardware.find((h) => /petals/.test(h.id));
  if (petals) {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      const petal = addMesh(
        g,
        new THREE.BoxGeometry(0.18, 0.34, 0.08),
        mats.panel.clone(),
        Math.cos(a) * 0.78,
        Math.sin(a) * 0.78,
        0.85
      );
      if (i === 0) tagHardware(petal, petals);
      else petal.userData.skipPick = true;
    }
  }
  const hatch = room.hardware.find((h) => /hatch/.test(h.id));
  if (hatch) g.add(buildHatch(mats, hatch, 0, 0, -0.78, 'z'));
  return g;
}

const BUILDERS = {
  destiny: buildDestiny,
  harmony: buildHarmony,
  columbus: buildColumbus,
  kibo: buildKibo,
  'kibo-ef': buildKiboEf,
  ida2: buildDockingTunnel,
  ida3: buildDockingTunnel,
  cupola: buildCupola,
  zvezda: buildZvezda,
};

export function createInteriorMaterials() {
  return {
    hull: makeMat({ color: '#d8dde4', metalness: 0.15, roughness: 0.75 }),
    rosHull: makeMat({ color: '#8a9180', metalness: 0.2, roughness: 0.7 }),
    rosInterior: makeMat({ color: '#9aa08a', metalness: 0.15, roughness: 0.65 }),
    rack: makeMat({ color: '#4a5564', metalness: 0.35, roughness: 0.45 }),
    panel: makeMat({ color: '#6b7585', metalness: 0.25, roughness: 0.5 }),
    screen: makeMat({ color: '#7dffb3', emissive: '#1d6b45', emissiveIntensity: 0.85, roughness: 0.3 }),
    hatch: makeMat({ color: '#c9d0d8', metalness: 0.45, roughness: 0.35 }),
    door: makeMat({ color: '#e8e4dc', metalness: 0.2, roughness: 0.5 }),
    cq: makeMat({ color: '#ece8e0', metalness: 0.12, roughness: 0.55 }),
    shutter: makeMat({ color: '#8d939b', metalness: 0.2, roughness: 0.85, side: THREE.DoubleSide }),
    glass: makeMat({
      color: '#9ad4ff',
      metalness: 0.05,
      roughness: 0.12,
      transparent: true,
      opacity: 0.35,
      emissive: '#16324a',
      emissiveIntensity: 0.15,
    }),
    glassClear: makeMat({
      color: '#cfefff',
      metalness: 0.05,
      roughness: 0.05,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };
}

/**
 * Mount walk-in interiors on a parent group. Returns API for show/hide/pick.
 */
export function createInteriorManager(parent, opts = {}) {
  const loader = new THREE.TextureLoader();
  const mats = createInteriorMaterials();
  const root = new THREE.Group();
  root.name = 'iss-interiors';
  root.visible = false;
  parent.add(root);

  const rooms = new Map();
  let activeId = '';
  let catalog = null;
  let shutterValues = [];
  const SHUTTER_OPEN_ANGLE = 1.7;

  function applyShutters(entry) {
    if (!entry || !entry.shutterPivots) return;
    entry.shutterPivots.forEach((pivot) => {
      const v = Number(shutterValues[pivot.userData.shutterPivot]) || 0;
      const swing = SHUTTER_OPEN_ANGLE * (1 - v);
      if (pivot.userData.shutterAxis === 'z') pivot.rotation.z = swing;
      else pivot.rotation.x = swing;
      pivot.visible = v > 0.02;
    });
  }
  const light = new THREE.PointLight(0xfff4e0, 1.35, 28, 2);
  light.position.set(0, 0.4, 0);
  root.add(light);
  root.add(new THREE.AmbientLight(0x8899aa, 0.55));

  function ensureRoom(id) {
    if (rooms.has(id)) return rooms.get(id);
    const room = (catalog?.rooms || []).find((r) => r.id === id);
    if (!room || !BUILDERS[id]) return null;
    const group = new THREE.Group();
    group.name = 'interior-' + id;
    group.visible = false;
    const entry = { group, room, pickables: [] };
    const mapUrl = room.photo;
    const build = () => {
      const built = BUILDERS[id](room, mats, entry.map || null);
      group.clear();
      group.add(built);
      entry.pickables = [];
      entry.shutterPivots = [];
      group.traverse((obj) => {
        if (obj.isMesh && obj.userData.hardwareId) entry.pickables.push(obj);
        if (Number.isInteger(obj.userData.shutterPivot)) entry.shutterPivots.push(obj);
      });
      applyShutters(entry);
    };
    if (mapUrl) {
      loadTexture(loader, mapUrl, (tex) => {
        entry.map = tex;
        build();
      });
    }
    build();
    root.add(group);
    rooms.set(id, entry);
    return entry;
  }

  return {
    setCatalog(data) {
      catalog = data;
    },
    getRoom(id) {
      return (catalog?.rooms || []).find((r) => r.id === id) || null;
    },
    getCatalog() {
      return catalog;
    },
    show(id) {
      activeId = String(id || '');
      root.visible = Boolean(activeId);
      const active = activeId ? ensureRoom(activeId) : null;
      rooms.forEach((entry, key) => {
        entry.group.visible = key === activeId;
      });
      return active?.room?.camera || { x: 0, y: 0.15, z: 0 };
    },
    hide() {
      activeId = '';
      root.visible = false;
      rooms.forEach((entry) => {
        entry.group.visible = false;
      });
    },
    getPickables() {
      const entry = rooms.get(activeId);
      if (!entry) return [];
      return entry.pickables.filter((obj) => {
        for (let p = obj; p; p = p.parent) if (!p.visible) return false;
        return true;
      });
    },
    /** values[i] in [0,1]: 0 open, 1 closed (index 0 nadir, 1–6 sides). */
    setShutterValues(values) {
      shutterValues = Array.isArray(values) ? values.slice() : [];
      applyShutters(rooms.get('cupola'));
    },
    getActiveId() {
      return activeId;
    },
    dispose() {
      rooms.forEach((entry) => {
        entry.group.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const list = Array.isArray(obj.material) ? obj.material : [obj.material];
            list.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      });
      rooms.clear();
      parent.remove(root);
    },
  };
}

export default { createInteriorManager, createInteriorMaterials };
