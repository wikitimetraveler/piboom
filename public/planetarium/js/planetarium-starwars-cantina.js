/**
 * Cantina — 3D bar with the main figures. Stylized costumes, original set.
 * Development work by David Lane.
 */
import * as THREE from 'three';

const SCRIPT_URL = '/data/planetarium/star-wars-cantina.json';
let clothWeave = null;

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function mat(color, roughness, metalness, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color,
    roughness: roughness == null ? 0.6 : roughness,
    metalness: metalness == null ? 0.15 : metalness,
    envMapIntensity: 0.85,
  }, extra || {}));
}

function add(parent, geo, material, x, y, z) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function canvasTex(size, paint, colorSpace) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace == null ? THREE.SRGBColorSpace : colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function woodTex() {
  const map = canvasTex(1024, (ctx, n) => {
    ctx.fillStyle = '#5a3a24';
    ctx.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 1) {
      const band = 28 + ((y * 17) % 46);
      const wobble = Math.sin(y * 0.08) * 6;
      ctx.strokeStyle = `rgba(${40 + (y % 5) * 8},${22 + (y % 3) * 4},${12},0.35)`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= n; x += 32) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + y) * 1.4 + wobble * 0.05);
      }
      ctx.stroke();
      if (y % band === 0) {
        ctx.fillStyle = y % (band * 2) === 0 ? 'rgba(20,10,6,0.35)' : 'rgba(120,78,46,0.18)';
        ctx.fillRect(0, y, n, 3 + (y % 4));
      }
    }
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(Math.random() * n, Math.random() * n, 1, 4 + Math.random() * 14);
    }
  });
  map.repeat.set(3, 3);
  const rough = canvasTex(512, (ctx, n) => {
    const img = ctx.createImageData(n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const g = 150 + ((i / 4) % 17) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, THREE.NoColorSpace);
  rough.repeat.set(3, 3);
  return { map, rough };
}

function plasterTex() {
  const map = canvasTex(1024, (ctx, n) => {
    ctx.fillStyle = '#6d5c4c';
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 14000; i += 1) {
      const g = 70 + Math.random() * 50;
      ctx.fillStyle = `rgba(${g},${g - 12},${g - 24},0.35)`;
      ctx.fillRect(Math.random() * n, Math.random() * n, 2, 2);
    }
    ctx.strokeStyle = 'rgba(40,28,18,0.45)';
    ctx.lineWidth = 2;
    for (let x = 80; x < n; x += 340) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 6, n);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,18,10,0.25)';
    ctx.beginPath();
    ctx.ellipse(180, 420, 90, 40, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(700, 220, 120, 36, -0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  map.repeat.set(2, 1.4);
  return map;
}

function weaveTex() {
  const map = canvasTex(256, (ctx, n) => {
    ctx.fillStyle = '#c8c2b8';
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < n; i += 4) {
      ctx.fillStyle = i % 8 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, i, n, 1);
      ctx.fillRect(i, 0, 1, n);
    }
  });
  map.repeat.set(4, 4);
  return map;
}

function limb(parent, material, w, h, d, x, y, z) {
  return add(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

function human(opts) {
  const g = new THREE.Group();
  const s = opts.scale || 1;
  const cloth = mat(opts.cloth, 0.86, 0.02, { map: opts.weave || clothWeave });
  const skin = mat(opts.skin || 0xc4956a, 0.55, 0.0);
  const dark = mat(opts.trim || 0x1a1c20, 0.5, 0.2);
  limb(g, dark, 0.14 * s, 0.72 * s, 0.14 * s, -0.12 * s, 0.36 * s, 0);
  limb(g, dark, 0.14 * s, 0.72 * s, 0.14 * s, 0.12 * s, 0.36 * s, 0);
  limb(g, cloth, 0.46 * s, 0.58 * s, 0.26 * s, 0, 0.95 * s, 0);
  limb(g, cloth, 0.12 * s, 0.52 * s, 0.12 * s, -0.32 * s, 0.95 * s, 0);
  limb(g, cloth, 0.12 * s, 0.52 * s, 0.12 * s, 0.32 * s, 0.95 * s, 0);
  add(g, new THREE.SphereGeometry(0.15 * s, 16, 12), skin, 0, 1.42 * s, 0);
  if (opts.belt) limb(g, mat(opts.belt, 0.45, 0.3), 0.48 * s, 0.08 * s, 0.28 * s, 0, 0.72 * s, 0);
  if (opts.buns) {
    add(g, new THREE.SphereGeometry(0.08 * s, 10, 8), dark, -0.16 * s, 1.5 * s, 0);
    add(g, new THREE.SphereGeometry(0.08 * s, 10, 8), dark, 0.16 * s, 1.5 * s, 0);
  }
  if (opts.hood) {
    const hood = add(g, new THREE.ConeGeometry(0.2 * s, 0.28 * s, 10), cloth, 0, 1.62 * s, -0.02);
    hood.rotation.x = 0.2;
  }
  if (opts.cape) {
    const cape = add(g, new THREE.BoxGeometry(0.5 * s, 0.9 * s, 0.04), cloth, 0, 0.95 * s, -0.16 * s);
    cape.material = mat(opts.cape, 0.84, 0.04, { map: opts.weave || clothWeave });
  }
  if (opts.holster) limb(g, dark, 0.08, 0.22, 0.06, 0.22 * s, 0.62 * s, 0.12);
  g.position.set(opts.x, opts.y || 0, opts.z);
  g.rotation.y = opts.yaw || 0;
  g.userData.figure = opts.id;
  return g;
}

function chewie(x, z) {
  const g = human({
    id: 'chewbacca',
    x,
    z,
    yaw: 0.25,
    scale: 1.28,
    cloth: 0x6a4630,
    skin: 0x6a4630,
    trim: 0x3a2618,
    belt: 0xc2b48a,
  });
  return g;
}

function vader(x, z) {
  const g = human({
    id: 'vader',
    x,
    z,
    yaw: Math.PI,
    scale: 1.18,
    cloth: 0x121418,
    skin: 0x1a1c22,
    trim: 0x0c0e12,
    cape: 0x0a0c10,
  });
  const helm = mat(0x1a1c22, 0.35, 0.7);
  add(g, new THREE.BoxGeometry(0.28, 0.22, 0.28), helm, 0, 1.7, 0.02);
  add(g, new THREE.BoxGeometry(0.22, 0.06, 0.08), mat(0x111111, 0.4, 0.5), 0, 1.64, 0.16);
  const chest = add(g, new THREE.BoxGeometry(0.16, 0.1, 0.04), mat(0x222222, 0.4, 0.4, {
    emissive: 0xff3b3b, emissiveIntensity: 0.8,
  }), 0, 1.15, 0.14);
  chest.userData.pulse = true;
  return g;
}

function yoda(x, z) {
  const g = human({
    id: 'yoda',
    x,
    z,
    y: 0.55,
    yaw: 0.5,
    scale: 0.48,
    cloth: 0x6a5a32,
    skin: 0x7d9a62,
    trim: 0x4a3a22,
  });
  add(g, new THREE.SphereGeometry(0.045, 8, 6), mat(0x7d9a62, 0.6, 0), -0.07, 0.78, 0);
  add(g, new THREE.SphereGeometry(0.045, 8, 6), mat(0x7d9a62, 0.6, 0), 0.07, 0.78, 0);
  return g;
}

function protocol(x, z) {
  const g = new THREE.Group();
  const gold = mat(0xd4b15a, 0.22, 0.92);
  const dark = mat(0x3a3018, 0.4, 0.6);
  limb(g, gold, 0.12, 0.7, 0.12, -0.1, 0.38, 0);
  limb(g, gold, 0.12, 0.7, 0.12, 0.1, 0.38, 0);
  limb(g, gold, 0.4, 0.55, 0.22, 0, 0.95, 0);
  limb(g, gold, 0.08, 0.5, 0.08, -0.28, 0.95, 0.04);
  limb(g, gold, 0.08, 0.5, 0.08, 0.28, 0.95, 0.04);
  add(g, new THREE.SphereGeometry(0.13, 14, 10), gold, 0, 1.4, 0);
  add(g, new THREE.BoxGeometry(0.16, 0.04, 0.04), dark, 0, 1.36, 0.12);
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI;
  g.userData.figure = 'c3po';
  return g;
}

function astromech(x, z) {
  const g = new THREE.Group();
  const white = mat(0xe7e4dc, 0.4, 0.35);
  const blue = mat(0x2a5fbf, 0.35, 0.4);
  add(g, new THREE.CylinderGeometry(0.28, 0.3, 0.7, 16), white, 0, 0.45, 0);
  add(g, new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, 0.8, 0);
  add(g, new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8), blue, 0.18, 0.55, 0.18);
  add(g, new THREE.BoxGeometry(0.12, 0.08, 0.04), mat(0x111111, 0.3, 0.5, {
    emissive: 0x66ccff, emissiveIntensity: 0.9,
  }), 0, 0.9, 0.2);
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI;
  g.userData.figure = 'r2d2';
  return g;
}

function fett(x, z) {
  const g = human({
    id: 'boba',
    x,
    z,
    yaw: -0.8,
    scale: 1.05,
    cloth: 0x6a6e62,
    skin: 0x2a2e28,
    trim: 0x8a3030,
    belt: 0x8a3030,
  });
  const helm = mat(0x5c6a58, 0.38, 0.55);
  add(g, new THREE.BoxGeometry(0.26, 0.2, 0.26), helm, 0, 1.52, 0);
  add(g, new THREE.BoxGeometry(0.18, 0.05, 0.04), mat(0x111111, 0.3, 0.4), 0, 1.48, 0.14);
  add(g, new THREE.BoxGeometry(0.22, 0.32, 0.12), mat(0x4a4038, 0.5, 0.3), 0, 1.15, -0.16);
  return g;
}

function bandMember(x, z, color, height) {
  const g = new THREE.Group();
  const cloth = mat(color, 0.84, 0.04, { map: clothWeave });
  add(g, new THREE.CylinderGeometry(0.18, 0.22, height, 10), cloth, 0, height / 2, 0);
  add(g, new THREE.SphereGeometry(0.16, 12, 10), cloth, 0, height + 0.12, 0);
  add(g, new THREE.BoxGeometry(0.35, 0.08, 0.12), mat(0x222222, 0.4, 0.3), 0, height * 0.6, 0.18);
  g.position.set(x, 0.4, z);
  g.userData.bob = 0.4 + Math.random() * 0.6;
  return g;
}

function buildRoom(scene, textures) {
  const wood = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.wood.map,
    roughnessMap: textures.wood.rough,
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.55,
  });
  const plaster = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: textures.plaster, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.35,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xfff2d0,
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.55,
    envMapIntensity: 1.2,
  });
  const floor = add(scene, new THREE.BoxGeometry(14, 0.2, 12), wood, 0, -0.1, 0);
  floor.receiveShadow = false;
  add(scene, new THREE.BoxGeometry(14, 0.15, 12), plaster, 0, 3.3, 0);
  add(scene, new THREE.BoxGeometry(0.2, 3.4, 12), plaster, -7, 1.6, 0);
  add(scene, new THREE.BoxGeometry(0.2, 3.4, 12), plaster, 7, 1.6, 0);
  add(scene, new THREE.BoxGeometry(14, 3.4, 0.2), plaster, 0, 1.6, -6);
  add(scene, new THREE.BoxGeometry(5, 3.4, 0.2), plaster, -4.2, 1.6, 6);
  add(scene, new THREE.BoxGeometry(5, 3.4, 0.2), plaster, 4.2, 1.6, 6);
  add(scene, new THREE.BoxGeometry(6.4, 0.35, 1.1), wood, -0.4, 1.05, -4.7);
  add(scene, new THREE.BoxGeometry(6.2, 1.05, 0.7), mat(0x1c1612, 0.6, 0.15), -0.4, 0.5, -5.15);
  const bottleColors = [0x8a1e16, 0xc4a15a, 0x1e4a32, 0x6a2030, 0xd8c49a];
  for (let i = 0; i < 11; i += 1) {
    const bottle = add(scene, new THREE.CylinderGeometry(0.045, 0.055, 0.26 + (i % 3) * 0.04, 12), glass.clone(), -2.8 + i * 0.48, 1.36, -4.52);
    bottle.material.color.setHex(bottleColors[i % bottleColors.length]);
    bottle.material.opacity = 0.62;
  }
  add(scene, new THREE.BoxGeometry(3.2, 0.4, 2.2), wood, 5.3, 0.55, -0.6);
  add(scene, new THREE.BoxGeometry(3.4, 1.6, 0.12), mat(0x14110e, 0.7, 0.1), 6.7, 1.5, -0.6);
  add(scene, new THREE.CylinderGeometry(0.7, 0.7, 0.08, 16), wood, -4.3, 0.78, 1.2);
  add(scene, new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16), wood, 0.2, 0.78, 1.7);
  add(scene, new THREE.CylinderGeometry(0.45, 0.45, 0.7, 10), wood, 2.5, 0.35, -3.6);
}

function studio(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(10, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x3a2418, side: THREE.BackSide })
  ));
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb060 })
  );
  bulb.position.set(0, 3, -2);
  env.add(bulb);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromScene(env, 0.06).texture;
  pmrem.dispose();
  return map;
}

function createCantina(container) {
  const reduced = prefersReducedMotion();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.setClearColor(0x120c09, 1);
  container.prepend(renderer.domElement);
  renderer.domElement.className = 'sw-stage__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a120e, 0.02);
  scene.environment = studio(renderer);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 40);
  const wood = woodTex();
  const plaster = plasterTex();
  clothWeave = weaveTex();
  buildRoom(scene, { wood, plaster });
  const lamp = mat(0xfff1d4, 0.35, 0.05, { emissive: 0xffb15a, emissiveIntensity: 2.2 });
  add(scene, new THREE.SphereGeometry(0.16, 16, 12), lamp, -0.4, 2.55, -4.15);
  add(scene, new THREE.BoxGeometry(2.4, 0.06, 0.16), lamp, -0.4, 2.72, -4.15);

  scene.add(new THREE.AmbientLight(0xffe2c4, 0.55));
  scene.add(new THREE.HemisphereLight(0xffe0c2, 0x3a2418, 0.85));
  const barLight = new THREE.PointLight(0xffb15a, 18, 10, 2);
  barLight.position.set(-0.4, 2.4, -4.2);
  scene.add(barLight);
  const stageLight = new THREE.SpotLight(0xff6a3a, 8, 14, 0.6, 0.4, 1);
  stageLight.position.set(4.2, 3.1, 1.5);
  stageLight.target.position.set(5.4, 0.8, -0.6);
  scene.add(stageLight);
  scene.add(stageLight.target);
  const doorLight = new THREE.PointLight(0x9ec4ff, 6, 8, 2);
  doorLight.position.set(0, 2.2, 5.4);
  scene.add(doorLight);

  const cast = new THREE.Group();
  const figures = {
    han: human({ id: 'han', x: -1.7, z: -3.45, yaw: 0.15, cloth: 0x1c2430, skin: 0xc49a72, belt: 0x6a5338, holster: true }),
    chewbacca: chewie(-0.45, -3.35),
    luke: human({ id: 'luke', x: -4.6, z: 0.55, yaw: 0.4, cloth: 0xe6dcc8, skin: 0xd0a57c, belt: 0x3a2a18 }),
    'obi-wan': human({ id: 'obi-wan', x: -4.35, z: 1.85, yaw: -0.5, cloth: 0x6a5038, skin: 0xc4a080, hood: true, cape: 0x5a4030 }),
    leia: human({ id: 'leia', x: -0.15, z: 1.85, yaw: 0.2, cloth: 0xf4f1ea, skin: 0xd0a888, buns: true }),
    lando: human({ id: 'lando', x: 1.55, z: 1.35, yaw: -0.6, cloth: 0x141820, skin: 0x8a5a3a, cape: 0x1a140e, belt: 0xd4b15a }),
    yoda: yoda(2.45, -3.55),
    c3po: protocol(-2.15, 3.55),
    r2d2: astromech(-1.35, 3.35),
    boba: fett(4.7, 2.35),
    vader: vader(0.35, 4.85),
  };
  Object.keys(figures).forEach((id) => {
    figures[id].userData.figure = id;
    cast.add(figures[id]);
  });
  const band = new THREE.Group();
  band.add(bandMember(4.7, -0.9, 0x6a3048, 1.1));
  band.add(bandMember(5.35, -0.45, 0x2a4038, 0.85));
  band.add(bandMember(5.9, -0.85, 0x3a3058, 1.25));
  band.add(bandMember(5.2, -1.15, 0x503828, 0.7));
  band.userData.figure = 'band';
  cast.add(band);
  figures.band = band;
  scene.add(cast);

  const anchors = {
    door: { eye: [0.2, 1.6, 4.2], look: [0, 1.3, -1] },
    band: { eye: [2.4, 1.65, 1.1], look: [5.3, 1.3, -0.7] },
    han: { eye: [-0.5, 1.5, -2.5], look: [-1.6, 1.35, -3.45] },
    chewbacca: { eye: [0.7, 1.6, -2.4], look: [-0.4, 1.6, -3.35] },
    luke: { eye: [-2.8, 1.5, 0.2], look: [-4.5, 1.35, 0.6] },
    'obi-wan': { eye: [-2.7, 1.5, 2.4], look: [-4.3, 1.4, 1.8] },
    leia: { eye: [0.7, 1.5, 3.35], look: [-0.15, 1.35, 1.85] },
    lando: { eye: [1.1, 1.5, 2.8], look: [1.55, 1.4, 1.4] },
    yoda: { eye: [1.3, 1.35, -2.7], look: [2.45, 1.15, -3.5] },
    c3po: { eye: [-1.1, 1.5, 2.3], look: [-2.1, 1.35, 3.5] },
    r2d2: { eye: [-0.4, 1.15, 2.5], look: [-1.35, 0.7, 3.35] },
    boba: { eye: [3.1, 1.5, 1.2], look: [4.6, 1.4, 2.3] },
    vader: { eye: [1.6, 1.55, 3.4], look: [0.4, 1.55, 4.8] },
  };

  let figureId = 'door';
  let disposed = false;
  let raf = 0;
  let inView = true;
  let keepAlive = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let snap = true;
  const lookYaw = { v: 0 };
  const lookPitch = { v: 0 };
  const camPos = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function showFigure(id) {
    const next = anchors[id] ? id : 'door';
    figureId = next;
    const eye = anchors[next].eye;
    const look = anchors[next].look;
    goalPos.set(eye[0], eye[1], eye[2]);
    goalLook.set(look[0], look[1], look[2]);
    lookYaw.v = 0;
    lookPitch.v = 0;
    snap = true;
  }

  function paint(now) {
    if (disposed) return;
    if (!reduced) {
      band.children.forEach((member, i) => {
        member.position.y = 0.4 + Math.sin(now * 0.004 + i) * 0.04;
      });
    }
    if (snap || reduced) {
      camPos.copy(goalPos);
      snap = false;
    } else camPos.lerp(goalPos, 0.07);
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
    if (reduced || document.hidden || (!inView && !keepAlive)) {
      paint(performance.now());
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function onPointerDown(ev) {
    if (ev.button !== 0) return;
    dragging = false;
    lastX = ev.clientX;
    lastY = ev.clientY;
    renderer.domElement.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev) {
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    if (!renderer.domElement.hasPointerCapture(ev.pointerId)) return;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true;
    if (!dragging) return;
    lookYaw.v -= dx * 0.005;
    lookPitch.v = Math.max(-0.8, Math.min(0.8, lookPitch.v - dy * 0.004));
    lastX = ev.clientX;
    lastY = ev.clientY;
  }

  function pickFigure(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cast.children, true);
    for (let i = 0; i < hits.length; i += 1) {
      let node = hits[i].object;
      while (node && node !== cast) {
        if (node.userData && node.userData.figure && anchors[node.userData.figure]) return node.userData.figure;
        node = node.parent;
      }
    }
    return '';
  }

  function onPointerUp(ev) {
    const moved = dragging;
    dragging = false;
    if (moved) return;
    const id = pickFigure(ev);
    if (!id) return;
    showFigure(id);
    if (typeof window.__swCantinaPick === 'function') window.__swCantinaPick(id);
  }

  resize();
  showFigure('door');
  play();
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    play();
  }, { threshold: 0.08 });
  io.observe(container);
  function onVis() { play(); }
  document.addEventListener('visibilitychange', onVis);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  const fallback = document.getElementById('ctFallback');
  if (fallback) fallback.hidden = true;

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
    if (scene.environment) scene.environment.dispose();
    const seenGeo = new Set();
    const seenMat = new Set();
    const seenTex = new Set();
    function dropTex(tex) {
      if (tex && !seenTex.has(tex)) {
        seenTex.add(tex);
        tex.dispose();
      }
    }
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
            dropTex(material.map);
            dropTex(material.roughnessMap);
            material.dispose();
          }
        });
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    if (fallback) fallback.hidden = false;
  }

  return { showFigure, setKeepAlive(on) { keepAlive = Boolean(on); play(); }, dispose };
}

function bootTour(sceneApi) {
  const els = {
    root: document.getElementById('ctTour'),
    line: document.getElementById('ctTourLine'),
    play: document.getElementById('ctTourPlay'),
    pause: document.getElementById('ctTourPause'),
    prev: document.getElementById('ctTourPrev'),
    next: document.getElementById('ctTourNext'),
    beats: document.getElementById('ctTourBeats'),
    chips: document.getElementById('ctChips'),
    status: document.getElementById('ctTourStatus'),
    hudTitle: document.getElementById('ctHudTitle'),
    hudCamera: document.getElementById('ctHudCamera'),
    fallbackTitle: document.getElementById('ctFallbackTitle'),
    fallbackLine: document.getElementById('ctFallbackLine'),
    zigzag: document.getElementById('ctWhoZigzag'),
  };
  let script = { beats: [], figures: [] };
  let index = 0;
  let playing = false;
  let runId = 0;

  function beats() { return script.beats || []; }
  function figureName(id) {
    const row = (script.figures || []).find((fig) => fig.id === id);
    return row && row.name ? row.name : id;
  }
  function voice() {
    return (script.voices && script.voices.zigzag) || { voice: 'en-US-Neural2-I', pitch: 2.4, speakingRate: 0.96 };
  }
  function show(beat) {
    if (!beat) return;
    if (sceneApi) sceneApi.showFigure(beat.figure);
    const name = figureName(beat.figure);
    if (els.line) els.line.textContent = beat.text || '';
    if (els.hudTitle) els.hudTitle.textContent = name;
    if (els.hudCamera) els.hudCamera.textContent = beat.label || 'Cantina';
    if (els.fallbackTitle) els.fallbackTitle.textContent = name;
    if (els.fallbackLine) els.fallbackLine.textContent = beat.text || '';
    if (els.status) els.status.textContent = 'Beat ' + (index + 1) + ' of ' + beats().length + ' · ' + name;
    if (els.play) els.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (els.pause) els.pause.disabled = !playing;
    if (els.prev) els.prev.disabled = index <= 0;
    if (els.next) els.next.disabled = index >= beats().length - 1;
    if (els.zigzag) els.zigzag.classList.toggle('is-speaking', playing);
    renderLists();
  }
  function renderLists() {
    if (els.beats) {
      els.beats.replaceChildren();
      beats().forEach((beat, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = beat.label || figureName(beat.figure);
        if (i === index) {
          btn.classList.add('is-on');
          btn.setAttribute('aria-current', 'true');
        }
        btn.addEventListener('click', () => go(i, playing));
        li.appendChild(btn);
        els.beats.appendChild(li);
      });
    }
    if (els.chips) {
      els.chips.replaceChildren();
      beats().forEach((beat, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pw-btn' + (i === index ? ' is-on' : '');
        btn.textContent = beat.label || figureName(beat.figure);
        btn.addEventListener('click', () => go(i, false));
        els.chips.appendChild(btn);
      });
    }
  }
  async function speak(beat, cancelled) {
    const text = String((beat && beat.text) || '').trim();
    if (!text || typeof window.speakNarrationAwaitEnd !== 'function') return;
    const v = voice();
    await window.speakNarrationAwaitEnd(text, {
      voice: v.voice, pitch: v.pitch, speakingRate: v.speakingRate, gender: 'male', isCancelled: cancelled,
    });
  }
  async function playFrom(start) {
    const list = beats();
    if (!list.length) return;
    index = Math.max(0, Math.min(start, list.length - 1));
    playing = true;
    if (sceneApi) sceneApi.setKeepAlive(true);
    const myId = ++runId;
    if (typeof window.ensureAudioUnlock === 'function') window.ensureAudioUnlock();
    for (let i = index; i < list.length; i += 1) {
      if (runId !== myId || !playing) return;
      index = i;
      show(list[i]);
      await speak(list[i], () => runId !== myId || !playing);
      if (runId !== myId || !playing) return;
    }
    playing = false;
    if (sceneApi) sceneApi.setKeepAlive(false);
    show(list[index]);
  }
  function go(i, keepPlaying) {
    const list = beats();
    const target = Math.max(0, Math.min(i, list.length - 1));
    if (keepPlaying) {
      playFrom(target);
      return;
    }
    playing = false;
    runId += 1;
    if (typeof window.stopSpeech === 'function') window.stopSpeech();
    index = target;
    show(list[index]);
  }
  window.__swCantinaPick = (id) => {
    const found = beats().findIndex((beat) => beat.figure === id);
    if (found >= 0) go(found, false);
  };
  async function load() {
    try {
      const res = await fetch(SCRIPT_URL, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json && Array.isArray(json.beats) && json.beats.length) script = json;
    } catch (err) {
      console.warn(err);
    }
  }
  load().then(() => {
    const params = new URLSearchParams(location.search);
    const who = params.get('who');
    const found = who ? beats().findIndex((beat) => beat.figure === who) : 0;
    index = found >= 0 ? found : 0;
    show(beats()[index]);
    if (els.play) els.play.addEventListener('click', () => playFrom(index >= beats().length - 1 ? 0 : index));
    if (els.pause) els.pause.addEventListener('click', () => go(index, false));
    if (els.next) els.next.addEventListener('click', () => go(Math.min(index + 1, beats().length - 1), playing));
    if (els.prev) els.prev.addEventListener('click', () => go(Math.max(index - 1, 0), playing));
  });
}

function boot() {
  const stage = document.getElementById('ctStage');
  if (!stage || window.PlanetariumCantina) return;
  let api = null;
  try {
    api = createCantina(stage);
  } catch (err) {
    console.warn('Cantina WebGL failed', err);
    const fallback = document.getElementById('ctFallback');
    if (fallback) fallback.hidden = false;
    api = { showFigure() {}, setKeepAlive() {}, dispose() {} };
  }
  window.PlanetariumCantina = api;
  bootTour(api);
  window.addEventListener('pagehide', () => api.dispose(), { once: true });
}

boot();
