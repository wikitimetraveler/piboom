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
    mat.emissiveIntensity = 0.42;
  }
  mat.userData = mat.userData || {};
  mat.userData.baseEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
  mat.userData.baseEmissiveIntensity = mat.emissiveIntensity || 0;

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

  function enterWalkRoom(id) {
    station.visible = false;
    stars.visible = false;
    softShadow.visible = false;
    scene.fog.density = 0.004;
    const cam = interiors.show(id);
    walkPos.set(cam.x || 0, cam.y || 0.15, cam.z || 0);
    look.yaw = 0;
    look.pitch = id === 'cupola' ? -0.55 : 0;
    camera.fov = 70;
    camera.near = 0.05;
    camera.far = 80;
    camera.updateProjectionMatrix();
    earth.position.set(0, id === 'cupola' ? -6.5 : -12, 0);
    atmo.position.copy(earth.position);
    if (reduced) {
      camera.position.copy(walkPos);
    }
  }

  function leaveWalkRoom() {
    interiors.hide();
    station.visible = true;
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
      row.group.traverse((obj) => {
        if (obj.userData?.walkRim && obj.material) {
          obj.material.opacity = on ? 0.72 : walkable ? 0.38 : 0.2;
          obj.material.color.setHex(on ? 0xffd278 : 0x7ec8ff);
        }
      });
      if (on) {
        mat.emissive.setHex(0x6a4814);
        mat.emissiveIntensity = 0.68;
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
      return { type: 'hardware', id: hit?.object.userData.hardwareId || '', hw: hit?.object.userData.hardware || null };
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
    setHighlight(selectedId || hoverId);
    if (!reduced && mode !== 'walk' && !dockIn) {
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
    emitHover(pick.type === 'module' ? pick.id : '');
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
