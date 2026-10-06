/**
 * Small schematic ISS orbiting the homepage Earth globe.
 * A meteor pass closes the Cupola hatches, then opens them again.
 * Development work by David Lane
 */
(function () {
  const floatEl = document.getElementById('funIssFloat');
  const canvas = document.getElementById('funIssCanvas');
  const THREE = window.THREE;
  if (!floatEl || !canvas || !THREE) return;

  const reduced = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SHUTTERS = 7;
  const OPEN = 1.7;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (err) {
    floatEl.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1.6, 0.1, 40);
  camera.position.set(7.2, 4.4, 8.4);
  camera.lookAt(0, 0.15, 0);

  scene.add(new THREE.AmbientLight(0xc5d4ea, 0.55));
  const key = new THREE.DirectionalLight(0xfff4e0, 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8eb6ff, 0.8);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  const station = new THREE.Group();
  scene.add(station);

  function box(parent, w, h, d, color, x, y, z, basic) {
    const mat = basic
      ? new THREE.MeshBasicMaterial({ color: color })
      : new THREE.MeshStandardMaterial({ color: color, roughness: 0.42, metalness: 0.28 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function tube(parent, len, rad, color, x, y, z, axis) {
    const geo = new THREE.CylinderGeometry(rad, rad, len, 12);
    if (axis === 'x') geo.rotateZ(Math.PI / 2);
    if (axis === 'z') geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.22 })
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  tube(station, 3.4, 0.34, '#f2eee6', 0.2, 0, 0, 'x');
  tube(station, 1.5, 0.38, '#9aa3ad', -2.15, 0, 0, 'x');
  tube(station, 1.15, 0.32, '#d9e4f0', 1.7, 0, 1.15, 'z');
  tube(station, 1.2, 0.32, '#f4f1ea', 1.7, 0, -1.25, 'z');
  box(station, 2.4, 0.16, 0.28, '#5c6570', 0.3, 0.62, 0);
  box(station, 0.28, 0.16, 6.4, '#555d68', 0.3, 0.62, 0);

  [[-2.15, 1.15], [-3.15, 1.15], [2.15, 1.15], [3.15, 1.15]].forEach(function (spot) {
    const wing = new THREE.Group();
    wing.position.set(0.3, 0.66, spot[0]);
    box(wing, 2.5, 0.035, spot[1], '#2f6fbe', 0, 0, 0, true);
    for (let i = 0; i < 5; i += 1) {
      const rib = box(wing, 0.03, 0.05, spot[1] * 0.92, '#f0d48a', (i / 4 - 0.5) * 2.2, 0.03, 0, true);
      rib.material.color.set('#f0d48a');
    }
    station.add(wing);
  });

  const cupola = new THREE.Group();
  cupola.position.set(0.15, -0.62, -0.15);
  tube(cupola, 0.42, 0.34, '#d5dbe3', 0, 0, 0, 'y');
  const glass = new THREE.MeshStandardMaterial({
    color: '#1d3a58',
    emissive: new THREE.Color('#16324a'),
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.85,
    roughness: 0.15,
    metalness: 0.4,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#8d939b',
    roughness: 0.7,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const pivots = [];
  const nadir = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), glass);
  nadir.rotation.x = Math.PI / 2;
  nadir.position.y = -0.22;
  cupola.add(nadir);
  const nadirPivot = new THREE.Group();
  nadirPivot.position.set(0.22, -0.23, 0);
  nadirPivot.userData.axis = 'z';
  cupola.add(nadirPivot);
  const nadirPlate = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), plateMat);
  nadirPlate.rotation.x = Math.PI / 2;
  nadirPlate.position.x = -0.22;
  nadirPivot.add(nadirPlate);
  pivots.push(nadirPivot);
  for (let i = 0; i < 6; i += 1) {
    const face = new THREE.Group();
    face.rotation.y = (i * Math.PI) / 3;
    cupola.add(face);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), glass);
    pane.position.set(0, 0, 0.3);
    face.add(pane);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.16, 0.32);
    pivot.userData.axis = 'x';
    face.add(pivot);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), plateMat);
    plate.position.y = -0.16;
    pivot.add(plate);
    pivots.push(pivot);
  }
  station.add(cupola);

  const shutters = Array.from({ length: SHUTTERS }, function () {
    return { value: 0, from: 0, to: 0, t: 0, delay: 0 };
  });

  function applyShutters() {
    let avg = 0;
    pivots.forEach(function (pivot, i) {
      const swing = OPEN * (1 - shutters[i].value);
      if (pivot.userData.axis === 'z') pivot.rotation.z = swing;
      else pivot.rotation.x = -swing;
      avg += shutters[i].value;
    });
    glass.emissiveIntensity = 0.15 + 0.5 * (1 - avg / SHUTTERS);
  }

  function setShutters(closed, instant) {
    shutters.forEach(function (s, i) {
      s.from = s.value;
      s.to = closed ? 1 : 0;
      s.t = 0;
      s.delay = instant ? 0 : i * 0.05;
      if (instant) s.value = s.to;
    });
    applyShutters();
  }

  const meteors = [];
  for (let i = 0; i < 8; i += 1) {
    const len = i % 3 === 0 ? 1.8 : 1.1;
    const geo = new THREE.CylinderGeometry(0.02, 0.05, len, 5);
    geo.translate(0, len * 0.5, 0);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffe2a0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })));
    group.visible = false;
    scene.add(group);
    meteors.push({
      group: group,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      ttl: 0.7,
      active: false,
    });
  }

  let phase = 'idle';
  let phaseT = 0;
  let nextShower = reduced ? Infinity : 6;
  let angle = -2.15;
  let lastW = 0;
  let inView = true;
  let raf = 0;
  const clock = new THREE.Clock();
  const up = new THREE.Vector3(0, 1, 0);
  const tail = new THREE.Vector3();

  function resize() {
    const w = Math.max(1, floatEl.clientWidth);
    const h = Math.max(1, floatEl.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function placeFloat() {
    const earth = document.getElementById('heroNasaPane');
    const stage = floatEl.parentElement;
    if (!earth || !stage || earth.hidden) {
      floatEl.hidden = true;
      return;
    }
    floatEl.hidden = false;
    const near = earth.classList.contains('is-enlarged');
    floatEl.classList.toggle('is-near-earth', near);
    const er = earth.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const cx = er.left + er.width / 2 - sr.left;
    const cy = er.top + er.height / 2 - sr.top;
    const rx = er.width * (near ? 0.58 : 0.72);
    const ry = er.height * (near ? 0.46 : 0.62);
    const x = cx + Math.cos(angle) * rx - floatEl.offsetWidth / 2;
    const y = cy + Math.sin(angle) * ry - floatEl.offsetHeight / 2;
    floatEl.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    const w = floatEl.clientWidth;
    if (w && w !== lastW) {
      lastW = w;
      resize();
    }
  }

  function launchMeteor(i) {
    const m = meteors[i];
    if (!m || m.active) return;
    const dir = new THREE.Vector3(0.85, -0.2, -0.48).normalize();
    m.pos.set(-2.4 + (Math.random() - 0.5) * 1.2, 1.1 + (Math.random() - 0.5) * 0.8, 0.4);
    m.vel.copy(dir).multiplyScalar(4.2 + Math.random());
    m.life = 0;
    m.ttl = 0.72;
    m.active = true;
    m.group.visible = true;
  }

  function updateMeteors(dt) {
    let hit = false;
    meteors.forEach(function (m) {
      if (!m.active) return;
      m.life += dt;
      m.pos.addScaledVector(m.vel, dt);
      m.group.position.copy(m.pos);
      tail.copy(m.vel).negate().normalize();
      m.group.quaternion.setFromUnitVectors(up, tail);
      if (m.pos.length() < 1.3) hit = true;
      if (m.life > m.ttl) {
        m.active = false;
        m.group.visible = false;
      }
    });
    return hit;
  }

  function updateShutters(dt) {
    let moved = false;
    shutters.forEach(function (s) {
      if (s.value === s.to) return;
      s.t += dt;
      const u = Math.max(0, Math.min(1, (s.t - s.delay) / 0.42));
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      s.value = u >= 1 ? s.to : s.from + (s.to - s.from) * e;
      moved = true;
    });
    if (moved) applyShutters();
  }

  function allAt(target) {
    return shutters.every(function (s) { return s.value === target && s.to === target; });
  }

  function tick() {
    raf = window.requestAnimationFrame(tick);
    if (!inView || document.hidden) return;
    const dt = Math.min(0.05, clock.getDelta());
    if (!reduced && phase === 'idle') {
      angle += dt * 0.35;
      station.rotation.y += dt * 0.25;
      nextShower -= dt;
      if (nextShower <= 0) {
        phase = 'shower';
        phaseT = 0;
      }
    }
    if (phase === 'shower') {
      phaseT += dt;
      if (phaseT > 0.05 && phaseT < 0.55 && Math.floor(phaseT / 0.07) !== Math.floor((phaseT - dt) / 0.07)) {
        launchMeteor(Math.floor(phaseT / 0.07) % meteors.length);
      }
      const hit = updateMeteors(dt);
      if ((hit || phaseT > 0.42) && shutters[0].to !== 1) setShutters(true, false);
      if (allAt(1) && phaseT > 0.7) {
        phase = 'sealed';
        phaseT = 0;
      }
    } else if (phase === 'sealed') {
      phaseT += dt;
      updateMeteors(dt);
      if (phaseT > 1.1) {
        setShutters(false, reduced);
        phase = 'reopen';
        phaseT = 0;
      }
    } else if (phase === 'reopen') {
      if (allAt(0)) {
        phase = 'idle';
        nextShower = 14;
      }
    }
    updateShutters(dt);
    placeFloat();
    renderer.render(scene, camera);
  }

  applyShutters();
  resize();
  placeFloat();
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      resize();
      placeFloat();
    }).observe(floatEl.parentElement || floatEl);
  }
  window.addEventListener('resize', function () {
    resize();
    placeFloat();
  });
  const hero = document.querySelector('.fun-hero');
  if (hero && window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries.some(function (entry) { return entry.isIntersecting; });
    }, { threshold: 0.15 }).observe(hero);
  }
  clock.getDelta();
  tick();
})();
