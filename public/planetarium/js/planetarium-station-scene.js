/**
 * ISS station — Three.js schematic + authentic 1:1 walk interiors.
 * Orbit/explode: schematic. Walk: NASA-dimension rooms with look-around.
 * Development work by David Lane
 */
import * as THREE from 'three';
import { createInteriorManager } from './planetarium-station-interiors.js';

const EARTH_TEX = '/shared/textures/earth/blue-marble.jpg';
const DEG = Math.PI / 180;
const WALK_ROOMS = new Set(['destiny', 'harmony', 'columbus', 'kibo', 'cupola', 'zvezda']);

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
  if (shape === 'cupola') return new THREE.CylinderGeometry(sx * 0.42, sx * 0.48, sy, 10);
  if (shape === 'dock') return new THREE.CylinderGeometry(sx * 0.28, sx * 0.38, Math.max(sx, 0.45), 12);
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

function addInterior(group, mod, mats) {
  if (!mod.interior) return;
  if (mod.id === 'cupola') {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const pane = addMesh(
        group,
        new THREE.BoxGeometry(0.28, 0.22, 0.03),
        mats.glass,
        Math.cos(a) * 0.38,
        -0.08,
        Math.sin(a) * 0.38
      );
      pane.lookAt(0, -0.08, 0);
    }
    addMesh(group, new THREE.CircleGeometry(0.28, 16), mats.glass, 0, -0.38, 0).rotation.x = -Math.PI / 2;
    return;
  }
  const along = (mod.layout?.shape || '').includes('z') ? 'z' : 'x';
  for (let i = -1; i <= 1; i += 1) {
    const rack = addMesh(
      group,
      new THREE.BoxGeometry(0.22, 0.55, 0.42),
      mats.rack,
      along === 'x' ? i * 0.55 : 0.42,
      -0.12,
      along === 'z' ? i * 0.5 : 0.38
    );
    rack.userData.skipPick = true;
  }
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
    mat.emissiveIntensity = 0.35;
  }

  const mesh = new THREE.Mesh(shapeGeometry(mod), mat);
  mesh.userData.moduleId = mod.id;
  g.add(mesh);
  if (mod.interior) addInterior(g, mod, mats);
  if (kind === 'array') g.userData.spin = true;
  return { group: g, mesh, mod };
}

export function createStationScene(container, opts = {}) {
  const stillEl = opts.stillEl || null;
  const reduced = prefersReducedMotion();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  if (stillEl) stillEl.hidden = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070c, 0.018);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const orbit = { theta: 0.72, phi: 0.55, radius: 18 };
  const look = { yaw: 0, pitch: 0 };
  let walkPos = new THREE.Vector3(0, 0.15, 0);

  const key = new THREE.DirectionalLight(0xfff2dc, 2.1);
  key.position.set(8, 10, 6);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x6a7a99, 0.55));
  const rim = new THREE.DirectionalLight(0x88b7ff, 0.55);
  rim.position.set(-10, 4, -8);
  scene.add(rim);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x1d5c9c, roughness: 0.85, metalness: 0.05 })
  );
  earth.position.set(0, -9.2, 0);
  scene.add(earth);
  const loader = new THREE.TextureLoader();
  loader.load(
    EARTH_TEX,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      earth.material.map = tex;
      earth.material.color.set('#ffffff');
      earth.material.needsUpdate = true;
    },
    undefined,
    () => {}
  );

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(5.38, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  atmo.position.copy(earth.position);
  scene.add(atmo);

  const station = new THREE.Group();
  station.position.y = 0.4;
  scene.add(station);

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
  };

  const built = [];
  const pickables = [];
  let explodeT = 0;
  let targetExplode = 0;
  let mode = 'orbit';
  let selectedId = '';
  let hoverId = '';
  let onSelect = () => {};
  let onHardware = () => {};
  let raf = 0;
  let inView = true;
  let disposed = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd278 })
  );
  highlight.visible = false;
  station.add(highlight);

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
    }
    built.forEach((row) => {
      row.mesh.material.emissive = row.mesh.material.emissive || new THREE.Color(0x000000);
      const on = row.mod.id === id;
      row.mesh.material.emissive.set(on ? 0x3a2a10 : 0x000000);
      row.mesh.material.emissiveIntensity = on ? 0.35 : 0;
    });
  }

  function syncWalkRoom() {
    if (mode === 'walk' && WALK_ROOMS.has(selectedId)) {
      station.visible = false;
      scene.fog.density = 0.004;
      const cam = interiors.show(selectedId);
      walkPos.set(cam.x || 0, cam.y || 0.15, cam.z || 0);
      look.yaw = selectedId === 'cupola' ? 0 : 0;
      look.pitch = selectedId === 'cupola' ? -0.55 : 0;
      camera.fov = 70;
      camera.near = 0.05;
      camera.far = 80;
      camera.updateProjectionMatrix();
      earth.position.set(0, selectedId === 'cupola' ? -6.5 : -12, 0);
      atmo.position.copy(earth.position);
    } else {
      interiors.hide();
      station.visible = true;
      scene.fog.density = 0.018;
      camera.fov = 38;
      camera.near = 0.1;
      camera.far = 120;
      camera.updateProjectionMatrix();
      earth.position.set(0, -9.2, 0);
      atmo.position.copy(earth.position);
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
      return { type: 'hardware', id: hit?.object.userData.hardwareId || '', hw: hit?.object.userData.hardware || null };
    }
    const hits = raycaster.intersectObjects(pickables, false);
    const hit = hits.find((h) => h.object.userData.moduleId && !h.object.userData.skipPick);
    return { type: 'module', id: hit?.object.userData.moduleId || '' };
  }

  function placeCamera(dt) {
    if (mode === 'walk' && WALK_ROOMS.has(selectedId)) {
      camera.position.lerp(walkPos, Math.min(1, dt * 4));
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
    if (!inView || document.hidden) return;
    const dt = Math.min(0.05, clock.getDelta());
    targetExplode = mode === 'explode' ? 1 : 0;
    explodeT += (targetExplode - explodeT) * Math.min(1, dt * 3.2);
    applyPositions();
    setHighlight(selectedId || hoverId);
    if (!reduced && mode !== 'walk') {
      orbit.theta += dt * 0.08;
      built.forEach((item) => {
        if (item.group.userData.spin) item.group.rotation.y += dt * 0.12;
      });
      earth.rotation.y += dt * 0.02;
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
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.max(-0.2, Math.min(1.15, orbit.phi - dy * 0.004));
      }
    }
    const pick = pickModule(ev);
    hoverId = pick.type === 'module' ? pick.id : '';
    renderer.domElement.style.cursor = pick.id || pick.hw ? 'pointer' : dragging ? 'grabbing' : 'grab';
  }
  function onPointerUp(ev) {
    const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
    dragging = false;
    if (moved < 6) {
      const pick = pickModule(ev);
      if (pick.type === 'hardware' && pick.hw) {
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
      applyPositions();
    },
    setInteriorsCatalog(data) {
      interiors.setCatalog(data);
    },
    setNow(geo) {
      if (!geo || !Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lon))) return;
      earth.rotation.x = Number(geo.lat) * DEG;
      earth.rotation.y = -Number(geo.lon) * DEG;
    },
    selectModule(id) {
      selectedId = String(id || '');
      setHighlight(selectedId);
      syncWalkRoom();
    },
    setMode(next) {
      mode = next === 'explode' || next === 'walk' ? next : 'orbit';
      if (mode === 'walk' && !WALK_ROOMS.has(selectedId)) {
        const first = [...WALK_ROOMS][0];
        selectedId = first;
        onSelect(first);
      }
      if (mode !== 'walk') orbit.radius = mode === 'explode' ? 22 : 18;
      syncWalkRoom();
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
    dispose,
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
