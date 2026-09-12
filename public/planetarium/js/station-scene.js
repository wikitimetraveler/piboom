/**
 * ISS station Three.js scene — procedural module mockups
 * Development work by David Lane
 */
import * as THREE from 'three';

const MODULE_LAYOUT = {
  destiny: { pos: [0, 0, 0], size: [1.15, 0.42, 0.42], kind: 'lab' },
  harmony: { pos: [0.95, 0, 0], size: [0.55, 0.48, 0.48], kind: 'node' },
  columbus: { pos: [0.95, 0, 0.72], size: [0.55, 0.38, 0.38], kind: 'lab' },
  kibo: { pos: [0.95, 0, -0.85], size: [0.85, 0.42, 0.42], kind: 'lab' },
  cupola: { pos: [-0.55, -0.42, 0], size: [0.28, 0.22, 0.28], kind: 'dome' },
  quest: { pos: [-0.15, 0.05, 0.62], size: [0.42, 0.36, 0.36], kind: 'airlock' },
  russian: { pos: [-1.35, 0, 0], size: [1.35, 0.4, 0.4], kind: 'lab' },
  truss: { pos: [0.2, 0.55, 0], size: [3.6, 0.12, 0.14], kind: 'truss' },
};

function hexColor(hex, fallback = 0x8ab4ff) {
  if (typeof hex !== 'string' || !hex.trim()) return fallback;
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
}

function makeMetal(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.38,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

export function createStationScene(container, options = {}) {
  if (!container) throw new Error('container is required');

  const modulesMeta = Array.isArray(options.modules) ? options.modules : [];
  const reducedMotion =
    options.reducedMotion === true ||
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const width = () => Math.max(1, container.clientWidth || 640);
  const height = () => Math.max(1, container.clientHeight || 400);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03060e, 0.045);

  const camera = new THREE.PerspectiveCamera(42, width() / height(), 0.1, 80);
  camera.position.set(3.4, 1.6, 3.8);
  camera.lookAt(0, 0.1, 0);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (_) {
    return { ok: false, focus() {}, dispose() {}, getActiveModuleId: () => null };
  }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setSize(width(), height(), false);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'ps-stage__canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Interactive International Space Station model');

  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x1a2230, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(4, 6, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6a90ff, 0.35);
  fill.position.set(-3, 1, -2);
  scene.add(fill);

  const materials = [];
  function trackMat(mat) {
    materials.push(mat);
    return mat;
  }

  const earthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x163a78,
      emissive: 0x0a1e40,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.85,
    })
  );
  const earth = new THREE.Mesh(new THREE.SphereGeometry(8.5, 48, 32), earthMat);
  earth.position.set(0, -9.2, -2);
  scene.add(earth);

  const station = new THREE.Group();
  scene.add(station);

  const moduleGroups = new Map();

  function addBox(group, w, h, d, color, pos, rot) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = trackMat(makeMetal(color));
    const mesh = new THREE.Mesh(geo, mat);
    if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    group.add(mesh);
    return mesh;
  }

  function addCylinder(group, rTop, rBot, h, color, pos, rot) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, 20);
    const mat = trackMat(makeMetal(color, { metalness: 0.45, roughness: 0.42 }));
    const mesh = new THREE.Mesh(geo, mat);
    if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    group.add(mesh);
    return mesh;
  }

  function buildModule(meta) {
    const layout = MODULE_LAYOUT[meta.id];
    if (!layout) return null;
    const group = new THREE.Group();
    group.name = meta.id;
    group.userData.moduleId = meta.id;
    group.position.set(layout.pos[0], layout.pos[1], layout.pos[2]);
    const color = hexColor(meta.color);
    const [sx, sy, sz] = layout.size;

    if (layout.kind === 'dome') {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(sx * 0.55, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
        trackMat(
          makeMetal(color, {
            metalness: 0.2,
            roughness: 0.25,
            emissive: color,
            emissiveIntensity: 0.12,
            transparent: true,
            opacity: 0.88,
          })
        )
      );
      dome.rotation.x = Math.PI;
      group.add(dome);
      addCylinder(group, sx * 0.42, sx * 0.42, 0.08, 0x7a8798, [0, 0.02, 0], null);
    } else if (layout.kind === 'truss') {
      addBox(group, sx, sy, sz, 0xa8b0bc, [0, 0, 0], null);
      const panelMat = trackMat(
        makeMetal(0x2a4a9a, { metalness: 0.25, roughness: 0.45, emissive: 0x142860, emissiveIntensity: 0.25 })
      );
      [-1.35, 1.35].forEach((x) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.02, 1.55), panelMat);
        panel.position.set(x, 0.02, 0);
        group.add(panel);
      });
      [-1.35, 1.35].forEach((x) => {
        addBox(group, 0.08, 0.08, 1.1, 0x8a93a0, [x, 0, 0], null);
      });
    } else if (layout.kind === 'node') {
      addBox(group, sx, sy, sz, color, [0, 0, 0], null);
      addCylinder(group, 0.16, 0.16, 0.2, 0x9aa8b8, [sx * 0.45, 0, 0], [0, 0, Math.PI / 2]);
    } else if (layout.kind === 'airlock') {
      addBox(group, sx, sy, sz, color, [0, 0, 0], null);
      addCylinder(group, 0.14, 0.14, 0.22, 0x7f8a98, [0, 0, sz * 0.45], [Math.PI / 2, 0, 0]);
    } else {
      addCylinder(group, sy * 0.55, sy * 0.55, sx, color, [0, 0, 0], [0, 0, Math.PI / 2]);
      addBox(group, sx * 0.35, sy * 0.15, sz * 0.7, 0x6f7c8c, [0, sy * 0.35, 0], null);
    }

    group.userData.baseScale = 1;
    station.add(group);
    moduleGroups.set(meta.id, group);
    return group;
  }

  modulesMeta.forEach((m) => buildModule(m));
  if (!moduleGroups.size) {
    Object.keys(MODULE_LAYOUT).forEach((id) =>
      buildModule({ id, color: '#8ab4ff', name: id })
    );
  }

  let activeId = modulesMeta[0]?.id || 'destiny';
  let targetCam = camera.position.clone();
  let targetLook = new THREE.Vector3(0, 0.1, 0);
  let lookAt = targetLook.clone();
  let raf = 0;
  let running = true;
  let visible = true;
  let pointerDown = false;
  let didDrag = false;
  let lastX = 0;
  let orbitYaw = 0.55;
  let orbitPitch = 0.28;
  let orbitRadius = 5.2;
  const focusWorld = new THREE.Vector3();

  function applyIsolation(id) {
    moduleGroups.forEach((group, mid) => {
      const on = !id || mid === id;
      group.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (mat.userData._emi == null) {
            mat.userData._emi = mat.emissiveIntensity || 0;
          }
          mat.transparent = true;
          mat.opacity = on ? 1 : 0.18;
          mat.emissiveIntensity = on ? mat.userData._emi : 0;
        });
      });
      group.scale.setScalar(on ? 1.04 : 0.98);
    });
  }

  function updateFocusPoint(id) {
    const group = moduleGroups.get(id);
    if (group) {
      group.getWorldPosition(focusWorld);
      targetLook.copy(focusWorld);
    } else {
      targetLook.set(0, 0.1, 0);
    }
  }

  function cameraFor(id) {
    const layout = MODULE_LAYOUT[id];
    const boost = layout?.kind === 'truss' ? 1.35 : 1;
    orbitRadius = 3.2 * boost;
    orbitYaw = 0.65;
    orbitPitch = 0.32;
    updateFocusPoint(id);
    syncOrbitCam(true);
  }

  function syncOrbitCam(immediate) {
    updateFocusPoint(activeId);
    const x = Math.cos(orbitPitch) * Math.sin(orbitYaw) * orbitRadius;
    const y = Math.sin(orbitPitch) * orbitRadius + 0.35;
    const z = Math.cos(orbitPitch) * Math.cos(orbitYaw) * orbitRadius;
    targetCam.set(targetLook.x + x, targetLook.y + y, targetLook.z + z);
    if (immediate || reducedMotion) {
      camera.position.copy(targetCam);
      lookAt.copy(targetLook);
      camera.lookAt(lookAt);
    }
  }

  function focus(moduleId) {
    if (!moduleId || !moduleGroups.has(moduleId)) return activeId;
    activeId = moduleId;
    applyIsolation(moduleId);
    cameraFor(moduleId);
    options.onFocus?.(moduleId);
    return activeId;
  }

  function getActiveModuleId() {
    return activeId;
  }

  function onPointerDown(ev) {
    pointerDown = true;
    didDrag = false;
    lastX = ev.clientX;
    renderer.domElement.setPointerCapture?.(ev.pointerId);
  }
  function onPointerUp(ev) {
    pointerDown = false;
    try {
      renderer.domElement.releasePointerCapture?.(ev.pointerId);
    } catch (_) {
      /* ignore */
    }
  }
  function onPointerMove(ev) {
    if (!pointerDown || reducedMotion) return;
    const dx = ev.clientX - lastX;
    lastX = ev.clientX;
    if (Math.abs(dx) > 2) didDrag = true;
    orbitYaw += dx * 0.005;
    syncOrbitCam(false);
  }
  function onClick(ev) {
    if (didDrag) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(station.children, true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.moduleId) obj = obj.parent;
    if (obj?.userData.moduleId) focus(obj.userData.moduleId);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onClick);

  function onResize() {
    const w = width();
    const h = height();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  const ro =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => onResize())
      : null;
  ro?.observe(container);
  globalThis.addEventListener?.('resize', onResize);

  function onVisibility() {
    running = !document.hidden;
  }
  document.addEventListener('visibilitychange', onVisibility);

  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            visible = entries.some((e) => e.isIntersecting);
          },
          { threshold: 0.05 }
        )
      : null;
  io?.observe(container);

  let t0 = performance.now();
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!running || !visible) return;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    if (!reducedMotion) {
      station.rotation.y += dt * 0.08;
      syncOrbitCam(false);
      camera.position.lerp(targetCam, 1 - Math.pow(0.001, dt));
      lookAt.lerp(targetLook, 1 - Math.pow(0.001, dt));
      camera.lookAt(lookAt);
    }
    renderer.render(scene, camera);
  }

  applyIsolation(activeId);
  cameraFor(activeId);
  raf = requestAnimationFrame(tick);

  function dispose() {
    cancelAnimationFrame(raf);
    ro?.disconnect();
    io?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    globalThis.removeEventListener?.('resize', onResize);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerUp);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('click', onClick);
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose?.());
      }
    });
    materials.forEach((m) => m.dispose?.());
    renderer.dispose();
    renderer.domElement.remove();
  }

  return {
    ok: true,
    focus,
    dispose,
    getActiveModuleId,
    canvas: renderer.domElement,
  };
}

export default { createStationScene };
