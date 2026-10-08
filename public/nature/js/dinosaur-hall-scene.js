/**
 * Dinosaur Hall — procedural Three.js Mesozoic diorama.
 * Named bones, skeleton view, walk/bone-tour simulations, era restage.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const HUMAN_HEIGHT_M = 1.75;
  const BONE_HIGHLIGHT = 0xf0c14a;

  let renderer;
  let scene;
  let camera;
  let raf = 0;
  let running = false;
  let reduced = false;
  let mount;
  let canvas;
  let raycaster;
  let pointer = { x: 0, y: 0 };
  let faunaGroup;
  let ground;
  let water;
  let ambient;
  let keyLight;
  let fillLight;
  let fog;
  let humanSilhouette;
  let speciesIndex = new Map();
  let activeEra = 'jurassic';
  let selectedId = null;
  let camTween = null;
  let homeCam = { x: 0, y: 4.5, z: 18 };
  let idleT = 0;
  let onSelectCb = null;
  let onBoneCb = null;
  let speciesData = [];
  let erasData = [];
  let disposed = false;
  let skeletonMode = false;
  let simMode = null; // null | 'walk' | 'bones'
  let simBoneIndex = 0;
  let simBoneTimer = 0;
  let highlightedBone = null;
  const textureCache = new Map();
  let scenery = [];

  const LOOKS = {
    coelophysis: { dorsal: '#7a4e32', ventral: '#e6d2b4', mark: '#3a2416', style: 'stripe', bulk: 0.82, slender: 0.78, snout: 1.35, arms: 0.22, tail: 8, skull: 0.9 },
    herrerasaurus: { dorsal: '#8a3c28', ventral: '#e4c6a6', mark: '#3a1c12', style: 'mottle', bulk: 0.95, slender: 0.88, snout: 1.15, arms: 0.24, tail: 7, skull: 1.05 },
    plateosaurus: { dorsal: '#5e6a3c', ventral: '#d2c4a0', mark: '#2c3420', style: 'scale', bulk: 1.05 },
    apatosaurus: { dorsal: '#4a5844', ventral: '#cfc6ae', mark: '#242c22', style: 'wrinkle', bulk: 1.2, neckLift: 0.35, tailSegs: 8, fore: 0.78, hind: 0.95 },
    stegosaurus: { dorsal: '#8a6232', ventral: '#ead4a8', mark: '#5a3418', style: 'scale', plate: '#9a5828' },
    allosaurus: { dorsal: '#7a5340', ventral: '#e6ccae', mark: '#3a2418', style: 'mottle', bulk: 1.12, slender: 1, snout: 1.22, arms: 0.34, tail: 7, skull: 1.18 },
    brachiosaurus: { dorsal: '#6a5844', ventral: '#ddd0b4', mark: '#3a3024', style: 'wrinkle', bulk: 1.05, neckLift: 1.15, tailSegs: 6, fore: 1.2, hind: 0.82, highBrowser: true },
    diplodocus: { dorsal: '#566848', ventral: '#d4ccb0', mark: '#2a3424', style: 'stripe', bulk: 0.82, neckLift: 0.22, tailSegs: 11, fore: 0.7, hind: 0.88 },
    tyrannosaurus: { dorsal: '#6a4330', ventral: '#e6d4b6', mark: '#2a1a12', style: 'mottle', bulk: 1.5, slender: 1.05, snout: 1.02, arms: 0.1, tail: 6, skull: 1.48, smallArms: true, neck: 1.25 },
    triceratops: { dorsal: '#5a6840', ventral: '#ddd4b8', mark: '#2a3418', style: 'scale', horn: '#c4a878' },
    parasaurolophus: { dorsal: '#3e6a48', ventral: '#f0e6c8', mark: '#1c3824', style: 'band' },
    velociraptor: { dorsal: '#4a3024', ventral: '#dcc6a4', mark: '#16100c', style: 'feather', bulk: 0.62, slender: 0.7, snout: 1.28, arms: 0.36, tail: 8, skull: 0.85, feathered: true, sickle: true },
    ankylosaurus: { dorsal: '#7a6848', ventral: '#d0c0a0', mark: '#3a3020', style: 'armor' },
    pteranodon: { dorsal: '#e4e0d8', ventral: '#f7f4ee', mark: '#2a3038', style: 'wing', wing: '#3a4550' },
    mosasaurus: { dorsal: '#234852', ventral: '#d5e0d8', mark: '#102428', style: 'marine' }
  };

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function makeMat(THREE, params) {
    return new THREE.MeshStandardMaterial(params);
  }

  function paintSkin(ctx, w, h, look) {
    const dorsal = look.dorsal || '#6b7a4a';
    const ventral = look.ventral || '#d9cbb0';
    const mark = look.mark || '#2a2418';
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, dorsal);
    grd.addColorStop(0.55, dorsal);
    grd.addColorStop(1, ventral);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    const style = look.style || 'scale';
    if (style === 'stripe') {
      ctx.fillStyle = mark;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 5; i += 1) ctx.fillRect(18 + i * 48, 0, 14, h);
      ctx.globalAlpha = 1;
    } else if (style === 'band') {
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = i % 2 ? mark : ventral;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(0, i * (h / 8), w, h / 16);
      }
      ctx.globalAlpha = 1;
    } else if (style === 'marine') {
      ctx.fillStyle = mark;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 40; i += 1) {
        ctx.beginPath();
        ctx.ellipse((i * 53) % w, (i * 37) % (h * 0.45), 8, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const scute = style === 'armor' ? 14 : style === 'wrinkle' ? 0 : 6;
    if (style === 'wrinkle') {
      ctx.strokeStyle = mark;
      ctx.globalAlpha = 0.28;
      for (let y = 4; y < h; y += 5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 1.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      for (let y = 2; y < h; y += scute + 2) {
        const off = Math.floor(y / (scute + 2)) % 2 ? scute * 0.5 : 0;
        for (let x = -scute; x < w; x += scute + 2) {
          ctx.fillStyle = (x + y) % (scute * 3) < scute ? mark : 'rgba(0,0,0,0.18)';
          ctx.globalAlpha = style === 'armor' ? 0.45 : 0.22;
          ctx.beginPath();
          ctx.ellipse(x + off, y, scute * 0.48, scute * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function skinTextures(THREE, look) {
    const key = `${look.dorsal}|${look.ventral}|${look.mark}|${look.style}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const w = 256;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    paintSkin(canvas.getContext('2d'), w, h, look);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(look.style === 'wrinkle' ? 2 : 1.4, 1.4);
    if ('colorSpace' in map && THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = w;
    bumpCanvas.height = h;
    const bctx = bumpCanvas.getContext('2d');
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, w, h);
    bctx.drawImage(canvas, 0, 0);
    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.copy(map.repeat);
    const pair = { map, bump };
    textureCache.set(key, pair);
    return pair;
  }

  function featherTexture(THREE) {
    if (textureCache.has('feather')) return textureCache.get('feather');
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 64);
    ctx.fillStyle = '#5a3828';
    ctx.beginPath();
    ctx.moveTo(4, 32);
    ctx.quadraticCurveTo(70, 2, 124, 10);
    ctx.lineTo(124, 54);
    ctx.quadraticCurveTo(70, 62, 4, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,8,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(8, 32);
      ctx.lineTo(120, 6 + i * 6);
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in map && THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
    textureCache.set('feather', map);
    return map;
  }

  function addBone(THREE, parent, geo, mat, boneName, x, y, z, opts) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(x || 0, y || 0, z || 0);
    if (opts?.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    if (opts?.scale) mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    mesh.castShadow = !opts?.noShadow && !opts?.soft;
    mesh.receiveShadow = !opts?.soft;
    mesh.userData.boneName = boneName || '';
    mesh.userData.softTissue = Boolean(opts?.soft);
    mesh.userData.baseColor = mesh.material.color.getHex();
    mesh.userData.baseEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0;
    mesh.userData.mapKept = mesh.material.map || null;
    mesh.userData.bumpKept = mesh.material.bumpMap || null;
    parent.add(mesh);
    return mesh;
  }

  function addSoft(THREE, parent, geo, mat, x, y, z, opts) {
    return addBone(THREE, parent, geo, mat, '', x, y, z, Object.assign({ soft: true, noShadow: true }, opts || {}));
  }

  function capsule(THREE, radius, length) {
    return new THREE.CapsuleGeometry(Math.max(0.012, radius), Math.max(0.04, length), 5, 10);
  }

  function collectBones(group) {
    const names = [];
    group.traverse((obj) => {
      const name = obj.userData && obj.userData.boneName;
      if (obj.isMesh && name && !obj.userData.softTissue && !names.includes(name)) names.push(name);
    });
    group.userData.bones = names;
  }

  function addEye(THREE, parent, mats, x, y, z) {
    addSoft(THREE, parent, new THREE.SphereGeometry(0.026, 8, 8), mats.eye, x, y, z);
    addSoft(THREE, parent, new THREE.SphereGeometry(0.012, 6, 6), mats.pupil, x + 0.018, y + 0.004, z);
  }

  function addLeg(THREE, root, mat, clawMat, side, x, y, z, o) {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    hip.userData.gait = o.gait || 0;
    root.add(hip);
    const thick = o.thick || 0.055;
    addBone(THREE, hip, capsule(THREE, thick, o.femur), mat, `${side} femur`, 0, -o.femur * 0.5, 0);
    const knee = new THREE.Group();
    knee.position.set(0, -o.femur, 0.02);
    hip.add(knee);
    addBone(THREE, knee, capsule(THREE, thick * 0.72, o.tibia), mat, `${side} tibia`, 0, -o.tibia * 0.5, 0);
    const meta = addBone(THREE, knee, capsule(THREE, thick * 0.4, o.tibia * 0.45), mat, `${side} metatarsus`, 0.05, -o.tibia - 0.02, 0.02);
    meta.rotation.z = 1.15;
    const toes = o.sickle ? [-0.045, 0.0, 0.045] : [-0.04, 0, 0.04];
    toes.forEach((zz, i) => {
      const toe = addBone(THREE, knee, capsule(THREE, 0.014, 0.09), mat, `${side} pes`, 0.1, -o.tibia + 0.02, zz);
      toe.rotation.z = Math.PI / 2;
      const big = o.sickle && i === 1;
      const claw = addBone(
        THREE,
        knee,
        new THREE.ConeGeometry(big ? 0.022 : 0.014, big ? 0.09 : 0.045, 5),
        clawMat,
        'ungual',
        big ? 0.12 : 0.16,
        big ? -o.tibia + 0.08 : -o.tibia + 0.02,
        zz
      );
      claw.rotation.z = big ? -2.2 : -Math.PI / 2;
    });
    if (!root.userData.legBones) root.userData.legBones = [];
    root.userData.legBones.push(hip);
    return hip;
  }

  function addArm(THREE, root, mat, clawMat, side, x, y, z, len, thick) {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, y, z);
    shoulder.rotation.z = len < 0.16 ? 0.9 : 0.55;
    root.add(shoulder);
    addBone(THREE, shoulder, capsule(THREE, thick, len), mat, `${side} humerus`, len * 0.45, 0, 0, { rot: [0, 0, Math.PI / 2] });
    const hand = addBone(THREE, shoulder, capsule(THREE, thick * 0.55, len * 0.55), mat, `${side} manus`, len * 0.95, -0.04, 0, { rot: [0, 0, 1.1] });
    addBone(THREE, shoulder, new THREE.ConeGeometry(thick * 0.45, 0.06, 5), clawMat, 'manual ungual', len * 1.15, -0.08, 0, { rot: [0, 0, -0.8] });
    return hand;
  }

  function scaleGroupToLength(group, lengthM) {
    const target = Math.max(0.4, lengthM * 0.22);
    group.scale.setScalar(target);
    return group;
  }

  function buildTheropod(THREE, mats, look) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.legBones = [];
    const skin = mats.body;
    const dark = mats.accent;
    const leg = mats.leg;
    const bulk = look.bulk || 1;
    const slender = look.slender || 1;
    const bodyR = 0.2 * bulk * slender;
    const torso = addBone(THREE, g, capsule(THREE, bodyR, 0.58 * bulk), skin, 'dorsal vertebrae', 0.02, 0.78 + bodyR, 0);
    torso.rotation.z = Math.PI / 2;
    const chest = addBone(THREE, g, new THREE.SphereGeometry(bodyR * 1.05, 14, 12), skin, 'ribs', 0.22, 0.8 + bodyR * 0.2, 0);
    chest.scale.set(1.15, 0.95, 0.85);
    const belly = addBone(THREE, g, new THREE.SphereGeometry(bodyR * 0.72, 12, 10), mats.belly, 'gastralia', 0.08, 0.62 + bodyR * 0.15, 0);
    belly.scale.set(1.35, 0.62, 0.9);
    const neckN = look.neck > 1.1 ? 4 : 3;
    for (let i = 0; i < neckN; i += 1) {
      const t = i / neckN;
      const neck = addBone(
        THREE,
        g,
        capsule(THREE, bodyR * (0.42 - t * 0.08), 0.14),
        skin,
        'cervical vertebrae',
        0.42 + t * 0.22,
        0.95 + bodyR * 0.35 + t * 0.08 * (look.neck || 1),
        0
      );
      neck.rotation.z = -0.55;
    }
    const skullR = 0.11 * (look.skull || 1);
    const skull = addBone(THREE, g, new THREE.SphereGeometry(skullR, 14, 12), skin, 'skull', 0.72, 1.12 + (look.skull || 1) * 0.04, 0);
    skull.scale.set(1.25, 0.82, 0.78);
    const snout = addBone(THREE, g, new THREE.SphereGeometry(skullR * 0.72, 12, 10), skin, 'premaxilla', 0.86 + (look.snout || 1) * 0.06, 1.08, 0);
    snout.scale.set(look.snout || 1.2, 0.62, 0.58);
    const jaw = addBone(THREE, g, new THREE.SphereGeometry(skullR * 0.55, 10, 8), dark, 'mandible', 0.84, 1.0, 0);
    jaw.scale.set(1.7, 0.42, 0.5);
    for (let i = 0; i < 5; i += 1) {
      const tooth = addBone(THREE, g, new THREE.ConeGeometry(0.01, 0.035, 5), mats.tooth, 'tooth', 0.8 + i * 0.035, 1.04, 0.02);
      tooth.rotation.z = Math.PI;
    }
    addEye(THREE, g, mats, 0.8, 1.16 + skullR * 0.15, skullR * 0.55);
    addEye(THREE, g, mats, 0.8, 1.16 + skullR * 0.15, -skullR * 0.55);
    addSoft(THREE, g, new THREE.SphereGeometry(0.012, 6, 6), mats.pupil, 0.96, 1.1, 0.02);
    const tailN = look.tail || 7;
    for (let i = 0; i < tailN; i += 1) {
      const taper = 1 - i / tailN;
      const seg = addBone(
        THREE,
        g,
        capsule(THREE, Math.max(0.016, bodyR * 0.38 * taper), 0.15),
        skin,
        'caudal vertebrae',
        -0.38 - i * 0.15,
        0.74 - i * 0.025,
        0
      );
      seg.rotation.z = Math.PI / 2 + 0.06;
    }
    addBone(THREE, g, new THREE.BoxGeometry(0.2 * bulk, 0.08, 0.26 * bulk), dark, 'pelvis', -0.12, 0.7, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.14, 0.05, 0.2), dark, 'scapula', 0.24, 0.98, 0);
    const femur = 0.36 * bulk;
    const tibia = 0.34 * (look.slender || 1);
    const hipY = femur + tibia * 0.92;
    addLeg(THREE, g, leg, mats.claw, 'right', -0.02, hipY, 0.1 * bulk, { femur, tibia, thick: 0.05 * bulk, gait: 0, sickle: look.sickle });
    addLeg(THREE, g, leg, mats.claw, 'left', -0.02, hipY, -0.1 * bulk, { femur, tibia, thick: 0.05 * bulk, gait: 1, sickle: look.sickle });
    const armLen = look.arms || 0.24;
    addArm(THREE, g, dark, mats.claw, 'right', 0.28, 0.92, 0.14 * bulk, armLen, look.smallArms ? 0.02 : 0.035);
    addArm(THREE, g, dark, mats.claw, 'left', 0.28, 0.92, -0.14 * bulk, armLen, look.smallArms ? 0.02 : 0.035);
    if (look.feathered) addFeatherCoat(THREE, g, mats.feather);
    return g;
  }

  function addFeatherCoat(THREE, g, mat) {
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 6; i += 1) {
        const feather = addSoft(THREE, g, new THREE.PlaneGeometry(0.32, 0.07), mat, 0.34 + i * 0.01, 0.88 - i * 0.035, 0.16 * side);
        feather.rotation.y = side * 0.35;
        feather.rotation.z = -0.35 - i * 0.12;
      }
    });
    for (let i = 0; i < 7; i += 1) {
      const fan = addSoft(THREE, g, new THREE.PlaneGeometry(0.16, 0.05), mat, -0.48 - i * 0.14, 0.8 - i * 0.02, 0);
      fan.rotation.y = Math.PI / 2;
      fan.rotation.x = 0.4;
    }
    for (let i = 0; i < 5; i += 1) {
      addSoft(THREE, g, new THREE.ConeGeometry(0.03, 0.1, 4), mat, 0.1 - i * 0.12, 1.02, 0, { rot: [0, 0, 0.2] });
    }
  }

  function buildSauropod(THREE, mats, look) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.legBones = [];
    const bulk = look.bulk || 1;
    const bodyR = 0.32 * bulk;
    const torso = addBone(THREE, g, capsule(THREE, bodyR, 0.85), mats.body, 'dorsal vertebrae', -0.05, 0.95 + (look.hind || 0.9) * 0.15, 0);
    torso.rotation.z = Math.PI / 2;
    const belly = addBone(THREE, g, new THREE.SphereGeometry(bodyR * 0.75, 12, 10), mats.belly, 'ribs', 0.05, 0.78, 0);
    belly.scale.set(1.4, 0.55, 1);
    const neckN = look.highBrowser ? 7 : 6;
    let headX = 0.6;
    let headY = 1.3;
    for (let i = 0; i < neckN; i += 1) {
      const t = i / (neckN - 1);
      const lift = look.neckLift || 0.4;
      const x = 0.5 + t * (look.highBrowser ? 0.85 : 1.15);
      const y = 1.15 + Math.sin(t * Math.PI * 0.9) * lift + t * (look.highBrowser ? 0.85 : 0.15);
      const r = Math.max(0.045, 0.13 * bulk * (1 - t * 0.62));
      const seg = addBone(THREE, g, capsule(THREE, r, 0.2), mats.body, 'cervical vertebrae', x, y, 0);
      seg.rotation.z = -0.35 - t * (look.highBrowser ? 0.7 : 0.25);
      headX = x + 0.12;
      headY = y + 0.08;
    }
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.09, 12, 10), mats.body, 'skull', headX, headY, 0);
    skull.scale.set(1.35, 0.75, 0.7);
    addBone(THREE, g, new THREE.SphereGeometry(0.045, 8, 8), mats.accent, 'mandible', headX + 0.06, headY - 0.04, 0, { scale: [1.4, 0.5, 0.6] });
    addEye(THREE, g, mats, headX + 0.02, headY + 0.03, 0.045);
    addEye(THREE, g, mats, headX + 0.02, headY + 0.03, -0.045);
    const tailN = look.tailSegs || 8;
    for (let i = 0; i < tailN; i += 1) {
      const taper = 1 - i / tailN;
      const seg = addBone(
        THREE,
        g,
        capsule(THREE, Math.max(0.015, 0.1 * bulk * taper), 0.18),
        mats.body,
        'caudal vertebrae',
        -0.7 - i * 0.17,
        0.92 - i * 0.015,
        0
      );
      seg.rotation.z = Math.PI / 2 - 0.04;
    }
    addBone(THREE, g, new THREE.BoxGeometry(0.36, 0.12, 0.4), mats.accent, 'pelvis', -0.28, 0.82, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.3, 0.1, 0.36), mats.accent, 'scapula', 0.32, 1.05, 0);
    const hind = look.hind || 0.9;
    const fore = look.fore || 0.8;
    addPillar(THREE, g, mats.leg, mats.claw, 'right femur', 'right tibia',  -0.22, 0.16 * bulk, hind, 0.07 * bulk, 0);
    addPillar(THREE, g, mats.leg, mats.claw, 'left femur', 'left tibia', -0.22, -0.16 * bulk, hind, 0.07 * bulk, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'right humerus', 'right radius', 0.32, 0.14 * bulk, fore, 0.06 * bulk, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'left humerus', 'left radius', 0.32, -0.14 * bulk, fore, 0.06 * bulk, 0);
    return g;
  }

  function addPillar(THREE, root, mat, clawMat, upperName, lowerName, x, z, height, thick, gait) {
    const hip = new THREE.Group();
    hip.position.set(x, height, z);
    hip.userData.gait = gait;
    root.add(hip);
    addBone(THREE, hip, capsule(THREE, thick, height * 0.48), mat, upperName, 0, -height * 0.24, 0);
    addBone(THREE, hip, capsule(THREE, thick * 0.85, height * 0.42), mat, lowerName, 0, -height * 0.7, 0);
    const foot = addBone(THREE, hip, new THREE.SphereGeometry(thick * 1.15, 8, 6), mat, 'pes', 0.02, -height + thick * 0.3, 0);
    foot.scale.set(1.3, 0.45, 1.1);
    addBone(THREE, hip, new THREE.ConeGeometry(0.015, 0.04, 4), clawMat, 'ungual', 0.08, -height + 0.04, 0, { rot: [0, 0, -Math.PI / 2] });
    if (!root.userData.legBones) root.userData.legBones = [];
    root.userData.legBones.push(hip);
  }

  function buildProsauropod(THREE, mats) {
    const g = buildTheropod(THREE, mats, {
      bulk: 1.15,
      slender: 1.05,
      snout: 0.85,
      arms: 0.42,
      tail: 7,
      skull: 0.72,
      neck: 1.45
    });
    return g;
  }

  function plateGeometry(THREE, h) {
    const shape = new THREE.Shape();
    shape.moveTo(0, h * 0.55);
    shape.lineTo(h * 0.28, 0.02);
    shape.lineTo(0, -h * 0.2);
    shape.lineTo(-h * 0.28, 0.02);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  }

  function buildStegosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.legBones = [];
    const torso = addBone(THREE, g, capsule(THREE, 0.26, 0.85), mats.body, 'dorsal vertebrae', 0, 0.72, 0);
    torso.rotation.z = Math.PI / 2;
    const belly = addBone(THREE, g, new THREE.SphereGeometry(0.18, 10, 8), mats.belly, 'ribs', 0.05, 0.55, 0);
    belly.scale.set(1.5, 0.5, 0.95);
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.1, 12, 10), mats.body, 'skull', 0.72, 0.58, 0);
    skull.scale.set(1.4, 0.7, 0.65);
    addBone(THREE, g, new THREE.SphereGeometry(0.05, 8, 8), mats.accent, 'mandible', 0.84, 0.52, 0, { scale: [1.5, 0.45, 0.55] });
    addEye(THREE, g, mats, 0.78, 0.64, 0.05);
    addEye(THREE, g, mats, 0.78, 0.64, -0.05);
    for (let i = 0; i < 6; i += 1) {
      const seg = addBone(THREE, g, capsule(THREE, Math.max(0.02, 0.07 * (1 - i / 6)), 0.14), mats.body, 'caudal vertebrae', -0.55 - i * 0.14, 0.66, 0);
      seg.rotation.z = Math.PI / 2;
    }
    const heights = [0.28, 0.4, 0.5, 0.42, 0.3, 0.22];
    heights.forEach((h, i) => {
      const plate = addBone(THREE, g, plateGeometry(THREE, h), mats.plate, 'dermal plate', 0.32 - i * 0.16, 0.95, i % 2 === 0 ? 0.06 : -0.06);
      plate.rotation.y = i % 2 === 0 ? 0.15 : -0.15;
    });
    [-0.1, 0.1, -0.16, 0.16].forEach((z, i) => {
      const spike = addBone(THREE, g, new THREE.ConeGeometry(0.035, 0.26, 7), mats.plate, 'thagomizer spike', -1.22, 0.62, z);
      spike.rotation.z = Math.PI / 2;
      spike.rotation.y = z > 0 ? -0.5 : 0.5;
      spike.position.x -= i > 1 ? 0.08 : 0;
    });
    addPillar(THREE, g, mats.leg, mats.claw, 'right femur', 'right tibia', -0.18, 0.16, 0.62, 0.06, 0);
    addPillar(THREE, g, mats.leg, mats.claw, 'left femur', 'left tibia', -0.18, -0.16, 0.62, 0.06, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'right humerus', 'right radius', 0.28, 0.14, 0.5, 0.05, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'left humerus', 'left radius', 0.28, -0.14, 0.5, 0.05, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.28, 0.08, 0.32), mats.accent, 'pelvis', -0.2, 0.58, 0);
    return g;
  }

  function frillGeometry(THREE) {
    const shape = new THREE.Shape();
    shape.moveTo(0.05, -0.05);
    shape.lineTo(0.42, 0.12);
    shape.quadraticCurveTo(0.15, 0.62, -0.22, 0.48);
    shape.quadraticCurveTo(-0.28, 0.18, 0.05, -0.05);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
  }

  function buildCeratopsian(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.legBones = [];
    const torso = addBone(THREE, g, capsule(THREE, 0.3, 0.7), mats.body, 'dorsal vertebrae', -0.05, 0.78, 0);
    torso.rotation.z = Math.PI / 2;
    const belly = addBone(THREE, g, new THREE.SphereGeometry(0.2, 10, 8), mats.belly, 'ribs', 0.02, 0.58, 0);
    belly.scale.set(1.3, 0.55, 1);
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.2, 14, 12), mats.body, 'skull', 0.55, 0.82, 0);
    skull.scale.set(1.35, 0.85, 1.05);
    const beak = addSoft(THREE, g, new THREE.ConeGeometry(0.07, 0.16, 7), mats.claw, 0.82, 0.74, 0, { rot: [0, 0, -Math.PI / 2] });
    beak.scale.set(1, 0.7, 0.8);
    addBone(THREE, g, frillGeometry(THREE), mats.plate, 'parietal frill', 0.28, 1.05, 0);
    const nasal = addBone(THREE, g, new THREE.ConeGeometry(0.035, 0.22, 8), mats.horn, 'nasal horn', 0.78, 0.95, 0);
    nasal.rotation.z = -1.15;
    const browR = addBone(THREE, g, new THREE.ConeGeometry(0.03, 0.28, 8), mats.horn, 'right brow horn', 0.62, 1.02, 0.1);
    browR.rotation.z = -1.05;
    const browL = addBone(THREE, g, new THREE.ConeGeometry(0.03, 0.28, 8), mats.horn, 'left brow horn', 0.62, 1.02, -0.1);
    browL.rotation.z = -1.05;
    addEye(THREE, g, mats, 0.7, 0.88, 0.12);
    addEye(THREE, g, mats, 0.7, 0.88, -0.12);
    for (let i = 0; i < 4; i += 1) {
      const seg = addBone(THREE, g, capsule(THREE, 0.06 * (1 - i / 5), 0.12), mats.body, 'caudal vertebrae', -0.5 - i * 0.12, 0.7, 0);
      seg.rotation.z = Math.PI / 2;
    }
    addPillar(THREE, g, mats.leg, mats.claw, 'right femur', 'right tibia', -0.12, 0.18, 0.7, 0.07, 0);
    addPillar(THREE, g, mats.leg, mats.claw, 'left femur', 'left tibia', -0.12, -0.18, 0.7, 0.07, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'right humerus', 'right radius', 0.28, 0.16, 0.62, 0.06, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'left humerus', 'left radius', 0.28, -0.16, 0.62, 0.06, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.3, 0.1, 0.36), mats.accent, 'pelvis', -0.15, 0.62, 0);
    return g;
  }

  function buildHadrosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.legBones = [];
    const torso = addBone(THREE, g, capsule(THREE, 0.24, 0.7), mats.body, 'dorsal vertebrae', 0, 0.95, 0);
    torso.rotation.z = Math.PI / 2;
    const belly = addBone(THREE, g, new THREE.SphereGeometry(0.16, 10, 8), mats.belly, 'ribs', 0.05, 0.78, 0);
    belly.scale.set(1.4, 0.55, 0.9);
    for (let i = 0; i < 3; i += 1) {
      const neck = addBone(THREE, g, capsule(THREE, 0.07 - i * 0.01, 0.12), mats.body, 'cervical vertebrae', 0.42 + i * 0.1, 1.05 + i * 0.04, 0);
      neck.rotation.z = -0.4;
    }
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.12, 12, 10), mats.body, 'skull', 0.72, 1.16, 0);
    skull.scale.set(1.45, 0.75, 0.7);
    const bill = addSoft(THREE, g, new THREE.SphereGeometry(0.06, 8, 8), mats.horn, 0.9, 1.08, 0, { scale: [1.8, 0.45, 0.7] });
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const ang = -0.4 + t * 2.4;
      const seg = addBone(
        THREE,
        g,
        new THREE.CylinderGeometry(0.035, 0.045, 0.14, 8),
        mats.accent,
        'cranial crest',
        0.62 - Math.sin(ang) * 0.08,
        1.28 + Math.cos(ang) * 0.22,
        0
      );
      seg.rotation.z = ang;
    }
    addEye(THREE, g, mats, 0.8, 1.2, 0.06);
    addEye(THREE, g, mats, 0.8, 1.2, -0.06);
    for (let i = 0; i < 6; i += 1) {
      const seg = addBone(THREE, g, capsule(THREE, Math.max(0.02, 0.08 * (1 - i / 6)), 0.14), mats.body, 'caudal vertebrae', -0.48 - i * 0.14, 0.85 - i * 0.03, 0);
      seg.rotation.z = Math.PI / 2 + 0.08;
    }
    addLeg(THREE, g, mats.leg, mats.claw, 'right', 0.02, 0.78, 0.12, { femur: 0.4, tibia: 0.36, thick: 0.055, gait: 0 });
    addLeg(THREE, g, mats.leg, mats.claw, 'left', 0.02, 0.78, -0.12, { femur: 0.4, tibia: 0.36, thick: 0.055, gait: 1 });
    addArm(THREE, g, mats.accent, mats.claw, 'right', 0.3, 0.9, 0.16, 0.22, 0.03);
    addArm(THREE, g, mats.accent, mats.claw, 'left', 0.3, 0.9, -0.16, 0.22, 0.03);
    addBone(THREE, g, new THREE.BoxGeometry(0.26, 0.08, 0.3), mats.accent, 'pelvis', -0.12, 0.72, 0);
    return g;
  }

  function buildAnkylosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.legBones = [];
    const body = addBone(THREE, g, new THREE.SphereGeometry(0.38, 16, 12), mats.body, 'dorsal vertebrae', 0, 0.48, 0);
    body.scale.set(1.55, 0.72, 1.15);
    const belly = addBone(THREE, g, new THREE.SphereGeometry(0.22, 10, 8), mats.belly, 'ribs', 0.02, 0.32, 0);
    belly.scale.set(1.4, 0.4, 1);
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.14, 12, 10), mats.body, 'skull', 0.62, 0.42, 0);
    skull.scale.set(1.2, 0.75, 1.15);
    addEye(THREE, g, mats, 0.72, 0.46, 0.08);
    addEye(THREE, g, mats, 0.72, 0.46, -0.08);
    for (let row = 0; row < 3; row += 1) {
      for (let i = 0; i < 4; i += 1) {
        const scute = addBone(THREE, g, new THREE.SphereGeometry(0.07, 7, 6), mats.plate, 'osteoderm', 0.28 - i * 0.2, 0.72, (row - 1) * 0.22);
        scute.scale.set(1.1, 0.45, 0.9);
      }
    }
    for (let i = 0; i < 3; i += 1) {
      const seg = addBone(THREE, g, capsule(THREE, 0.07, 0.14), mats.body, 'caudal vertebrae', -0.62 - i * 0.16, 0.4, 0);
      seg.rotation.z = Math.PI / 2;
    }
    const club = addBone(THREE, g, new THREE.SphereGeometry(0.14, 10, 8), mats.accent, 'tail club', -1.12, 0.38, 0);
    club.scale.set(1.35, 0.85, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'right femur', 'right tibia', -0.08, 0.22, 0.38, 0.055, 0);
    addPillar(THREE, g, mats.leg, mats.claw, 'left femur', 'left tibia', -0.08, -0.22, 0.38, 0.055, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'right humerus', 'right radius', 0.28, 0.2, 0.36, 0.05, 1);
    addPillar(THREE, g, mats.leg, mats.claw, 'left humerus', 'left radius', 0.28, -0.2, 0.36, 0.05, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.28, 0.08, 0.34), mats.accent, 'pelvis', -0.15, 0.36, 0);
    return g;
  }

  function buildPterosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    g.userData.wingBones = [];
    const torso = addBone(THREE, g, capsule(THREE, 0.08, 0.28), mats.body, 'dorsal vertebrae', 0, 1.55, 0);
    torso.rotation.z = Math.PI / 2;
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.07, 10, 8), mats.body, 'skull', 0.28, 1.62, 0);
    skull.scale.set(1.8, 0.55, 0.5);
    const beak = addSoft(THREE, g, new THREE.ConeGeometry(0.025, 0.28, 6), mats.claw, 0.52, 1.6, 0, { rot: [0, 0, -Math.PI / 2] });
    beak.scale.set(1, 0.7, 0.45);
    const crest = addBone(THREE, g, new THREE.BoxGeometry(0.04, 0.28, 0.1), mats.accent, 'cranial crest', 0.02, 1.82, 0);
    crest.rotation.z = 0.4;
    addEye(THREE, g, mats, 0.32, 1.66, 0.035);
    addEye(THREE, g, mats, 0.32, 1.66, -0.035);
    [-1, 1].forEach((side, idx) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.05, 1.58, 0.06 * side);
      g.add(pivot);
      addBone(THREE, pivot, capsule(THREE, 0.02, 0.22), mats.leg, side < 0 ? 'right humerus' : 'left humerus', 0.1, 0.02 * side, 0.12 * side, { rot: [0, 0, Math.PI / 2] });
      const finger = addBone(THREE, pivot, capsule(THREE, 0.012, 0.85), mats.accent, side < 0 ? 'right wing finger' : 'left wing finger', 0.15, 0, 0.55 * side);
      finger.rotation.z = Math.PI / 2;
      finger.rotation.y = side * 0.15;
      const membrane = addSoft(THREE, pivot, new THREE.PlaneGeometry(0.95, 0.42), mats.wing, 0.15, -0.02, 0.28 * side);
      membrane.rotation.x = side * 0.15;
      g.userData.wingBones.push(pivot);
      void idx;
    });
    addBone(THREE, g, capsule(THREE, 0.025, 0.16), mats.leg, 'right femur', -0.08, 1.4, 0.05);
    addBone(THREE, g, capsule(THREE, 0.025, 0.16), mats.leg, 'left femur', -0.08, 1.4, -0.05);
    addBone(THREE, g, new THREE.BoxGeometry(0.12, 0.05, 0.1), mats.accent, 'pelvis', -0.12, 1.48, 0);
    return g;
  }

  function buildMosasaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    const mid = addBone(THREE, g, capsule(THREE, 0.22, 0.7), mats.body, 'dorsal vertebrae', 0.1, 0.32, 0);
    mid.rotation.z = Math.PI / 2;
    const belly = addBone(THREE, g, new THREE.SphereGeometry(0.14, 10, 8), mats.belly, 'ribs', 0.15, 0.22, 0);
    belly.scale.set(1.6, 0.45, 0.8);
    for (let i = 0; i < 3; i += 1) {
      const neck = addBone(THREE, g, capsule(THREE, 0.12 - i * 0.02, 0.16), mats.body, 'cervical vertebrae', 0.55 + i * 0.16, 0.34, 0);
      neck.rotation.z = Math.PI / 2;
    }
    const skull = addBone(THREE, g, new THREE.SphereGeometry(0.12, 12, 10), mats.body, 'skull', 1.05, 0.36, 0);
    skull.scale.set(1.7, 0.65, 0.55);
    const jaw = addBone(THREE, g, new THREE.SphereGeometry(0.07, 8, 8), mats.accent, 'mandible', 1.12, 0.28, 0);
    jaw.scale.set(1.8, 0.35, 0.45);
    for (let i = 0; i < 4; i += 1) {
      const tooth = addBone(THREE, g, new THREE.ConeGeometry(0.012, 0.04, 4), mats.tooth, 1.0 + i * 0.06, 0.32, 0.03);
      tooth.rotation.z = Math.PI;
    }
    addEye(THREE, g, mats, 1.02, 0.4, 0.06);
    addEye(THREE, g, mats, 1.02, 0.4, -0.06);
    [-1, 1].forEach((side) => {
      const paddle = addBone(THREE, g, new THREE.SphereGeometry(0.12, 10, 8), mats.accent, side < 0 ? 'right paddle' : 'left paddle', 0.25, 0.24, 0.2 * side);
      paddle.scale.set(1.8, 0.22, 0.7);
      paddle.rotation.z = side * 0.2;
    });
    for (let i = 0; i < 5; i += 1) {
      const seg = addBone(THREE, g, capsule(THREE, Math.max(0.03, 0.1 * (1 - i / 5)), 0.16), mats.body, 'caudal vertebrae', -0.45 - i * 0.16, 0.32, 0);
      seg.rotation.z = Math.PI / 2;
    }
    const upper = addSoft(THREE, g, new THREE.SphereGeometry(0.16, 8, 6), mats.wing, -1.15, 0.48, 0, { scale: [0.7, 1.1, 0.15] });
    const lower = addSoft(THREE, g, new THREE.SphereGeometry(0.2, 8, 6), mats.wing, -1.22, 0.22, 0, { scale: [0.85, 1.2, 0.12] });
    upper.rotation.z = 0.5;
    lower.rotation.z = -0.4;
    addBone(THREE, g, new THREE.BoxGeometry(0.16, 0.06, 0.18), mats.accent, 'pelvis', -0.15, 0.26, 0);
    return g;
  }

  function buildHuman(THREE, mats) {
    const g = new THREE.Group();
    addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.35, 3, 6), mats.human, 'torso', 0, 0.95, 0);
    addBone(THREE, g, new THREE.SphereGeometry(0.09, 8, 8), mats.human, 'head', 0, 1.25, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.05, 0.4, 2, 6), mats.human, 'right leg', 0, 0.45, 0.06);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.05, 0.4, 2, 6), mats.human, 'left leg', 0, 0.45, -0.06);
    g.userData.isHuman = true;
    return g;
  }

  function matsFor(THREE, sp) {
    const look = LOOKS[sp?.id] || {
      dorsal: sp?.isDinosaur === false ? '#4a6a7a' : '#6b7a4a',
      ventral: '#d9cbb0',
      mark: '#2a2418',
      style: 'scale'
    };
    const tex = skinTextures(THREE, look);
    const dorsal = new THREE.Color(look.dorsal);
    const legColor = dorsal.clone().multiplyScalar(0.72);
    return {
      body: makeMat(THREE, {
        color: 0xffffff,
        map: tex.map,
        bumpMap: tex.bump,
        bumpScale: look.style === 'armor' ? 0.08 : 0.035,
        roughness: 0.72,
        metalness: 0.02
      }),
      belly: makeMat(THREE, {
        color: look.ventral,
        roughness: 0.8,
        metalness: 0.01
      }),
      accent: makeMat(THREE, {
        color: look.mark,
        roughness: 0.66,
        metalness: 0.04
      }),
      leg: makeMat(THREE, { color: legColor, map: tex.map, bumpMap: tex.bump, bumpScale: 0.03, roughness: 0.8, metalness: 0.02 }),
      plate: makeMat(THREE, {
        color: look.plate || look.mark,
        roughness: 0.55,
        metalness: 0.06,
        side: THREE.DoubleSide
      }),
      horn: makeMat(THREE, { color: look.horn || '#c8b48a', roughness: 0.42, metalness: 0.08 }),
      claw: makeMat(THREE, { color: '#2a241c', roughness: 0.45, metalness: 0.12 }),
      tooth: makeMat(THREE, { color: '#f4f0e4', roughness: 0.35, metalness: 0.05 }),
      eye: makeMat(THREE, { color: '#f3e2a0', roughness: 0.25, metalness: 0.05 }),
      pupil: makeMat(THREE, { color: '#140c08', roughness: 0.2, metalness: 0.15 }),
      feather: makeMat(THREE, {
        color: look.dorsal,
        map: featherTexture(THREE),
        transparent: true,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0
      }),
      wing: makeMat(THREE, {
        color: look.wing || look.dorsal,
        roughness: 0.55,
        metalness: 0.04,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide
      }),
      human: makeMat(THREE, { color: 0x2a3038, roughness: 0.9, metalness: 0 })
    };
  }

  function applySkeletonLook(creature, on) {
    if (!creature) return;
    creature.traverse((obj) => {
      if (!obj.isMesh || !obj.material || obj.userData.isHuman) return;
      if (obj.userData.softTissue) {
        obj.visible = !on;
        return;
      }
      if (on) {
        obj.material.map = null;
        obj.material.bumpMap = null;
        obj.material.color.setHex(0xe4d5bf);
        obj.material.emissive?.setHex(0x2a2418);
        obj.material.roughness = 0.48;
        obj.material.metalness = 0.08;
        obj.material.transparent = false;
        obj.material.opacity = 1;
        obj.material.needsUpdate = true;
      } else {
        obj.material.map = obj.userData.mapKept || null;
        obj.material.bumpMap = obj.userData.bumpKept || null;
        obj.material.color.setHex(obj.userData.baseColor || 0xffffff);
        obj.material.emissive?.setHex(0x000000);
        obj.material.roughness = 0.72;
        obj.material.metalness = 0.02;
        obj.material.needsUpdate = true;
      }
    });
  }

  function clearBoneHighlight(creature) {
    if (!creature) return;
    creature.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      if (skeletonMode) {
        obj.material.emissive?.setHex(0x222018);
      } else {
        obj.material.emissive?.setHex(0x000000);
        if (obj.userData.baseColor != null) obj.material.color.setHex(obj.userData.baseColor);
      }
    });
    highlightedBone = null;
  }

  function highlightBone(speciesId, boneName) {
    const creature = speciesIndex.get(speciesId);
    if (!creature || !boneName) return false;
    clearBoneHighlight(creature);
    let found = false;
    creature.traverse((obj) => {
      if (!obj.isMesh || obj.userData.boneName !== boneName) return;
      found = true;
      obj.material.emissive?.setHex(BONE_HIGHLIGHT);
      obj.material.emissiveIntensity = 0.65;
    });
    if (found) {
      highlightedBone = boneName;
      if (onBoneCb) onBoneCb(boneName, speciesId);
      const status = document.getElementById('dhStageStatus');
      if (status) status.textContent = `Bone: ${boneName}`;
    }
    return found;
  }

  function listBones(speciesId) {
    const creature = speciesIndex.get(speciesId);
    return creature?.userData?.bones ? [...creature.userData.bones] : [];
  }

  function buildCreature(THREE, sp) {
    const mats = matsFor(THREE, sp);
    const look = LOOKS[sp.id] || {};
    let g;
    if (sp.id === 'plateosaurus') {
      g = buildProsauropod(THREE, mats);
    } else {
      switch (sp.bodyPlan) {
        case 'sauropod':
          g = buildSauropod(THREE, mats, look);
          break;
        case 'stegosaur':
          g = buildStegosaur(THREE, mats);
          break;
        case 'ceratopsian':
          g = buildCeratopsian(THREE, mats);
          break;
        case 'hadrosaur':
          g = buildHadrosaur(THREE, mats);
          break;
        case 'ankylosaur':
          g = buildAnkylosaur(THREE, mats);
          break;
        case 'pterosaur':
          g = buildPterosaur(THREE, mats);
          break;
        case 'mosasaur':
          g = buildMosasaur(THREE, mats);
          break;
        case 'theropod':
        default:
          g = buildTheropod(THREE, mats, look);
          break;
      }
    }
    collectBones(g);
    scaleGroupToLength(g, sp.lengthM || 5);
    g.userData.speciesId = sp.id;
    g.userData.era = sp.era;
    g.userData.bodyPlan = sp.bodyPlan;
    g.userData.isDinosaur = sp.isDinosaur !== false;
    g.userData.lengthM = sp.lengthM;
    g.userData.baseRotY = 0;
    g.traverse((obj) => {
      if (obj.isMesh) obj.userData.speciesId = sp.id;
    });
    if (skeletonMode) applySkeletonLook(g, true);
    return g;
  }

  function layoutPositions(list) {
    const n = list.length;
    const radius = 5.5;
    return list.map((sp, i) => {
      const a = (i / Math.max(n, 1)) * Math.PI * 1.4 - Math.PI * 0.7;
      const r = radius + (i % 3) * 1.2;
      let y = 0;
      if (sp.bodyPlan === 'pterosaur') y = 1.2 + (i % 2) * 0.4;
      if (sp.bodyPlan === 'mosasaur') y = -0.15;
      return { x: Math.sin(a) * r, y, z: Math.cos(a) * r - 2 };
    });
  }

  function clearFauna() {
    if (!faunaGroup) return;
    while (faunaGroup.children.length) {
      const child = faunaGroup.children[0];
      faunaGroup.remove(child);
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    speciesIndex.clear();
  }

  function restage(eraId) {
    if (!scene || typeof window.THREE === 'undefined') return;
    const THREE = window.THREE;
    activeEra = eraId || activeEra;
    const era = erasData.find((e) => e.id === activeEra) || erasData[1] || erasData[0];
    const pal = era?.palette || {};

    if (fog) {
      fog.color.set(pal.fog || '#6a8f5a');
      fog.near = 12;
      fog.far = 42;
    }
    if (scene) scene.background = new THREE.Color(pal.sky || '#a8c878');
    if (ground?.material) ground.material.color.set(pal.ground || '#4a6b3c');
    if (water?.material) water.material.color.set(pal.water || '#3a7a7e');
    if (keyLight) {
      keyLight.color.set(activeEra === 'cretaceous' ? 0xffc070 : 0xffe8c8);
      keyLight.intensity = activeEra === 'triassic' ? 1.05 : 1.2;
    }
    if (fillLight) {
      fillLight.color.set(activeEra === 'triassic' ? 0xc45a3a : 0x4a8a6a);
      fillLight.intensity = 0.35;
    }

    clearFauna();
    const visible = speciesData.filter((sp) => sp.era === activeEra);
    const positions = layoutPositions(visible);
    visible.forEach((sp, i) => {
      const creature = buildCreature(THREE, sp);
      const pos = positions[i] || { x: i * 2, y: 0, z: 0 };
      creature.position.set(pos.x, pos.y, pos.z);
      creature.userData.baseY = pos.y;
      creature.userData.baseRotY = Math.atan2(-pos.x, -pos.z + 2) + Math.PI;
      creature.rotation.y = creature.userData.baseRotY;
      faunaGroup.add(creature);
      speciesIndex.set(sp.id, creature);
    });

    if (humanSilhouette && faunaGroup) {
      faunaGroup.add(humanSilhouette);
      humanSilhouette.position.set(0.8, 0, 6.5);
      humanSilhouette.visible = true;
    }

    if (selectedId && !speciesIndex.has(selectedId)) {
      selectedId = null;
    }
  }

  function disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    raf = 0;
    running = false;
    simMode = null;
    if (camTween && typeof camTween.kill === 'function') camTween.kill();
    camTween = null;
    clearFauna();
    scenery.forEach((obj) => disposeObject3D(obj));
    scenery = [];
    textureCache.forEach((entry) => {
      if (entry?.map?.dispose) entry.map.dispose();
      else if (entry?.dispose) entry.dispose();
      if (entry?.bump?.dispose) entry.bump.dispose();
    });
    textureCache.clear();
    disposeObject3D(ground);
    disposeObject3D(water);
    disposeObject3D(humanSilhouette);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }
    scene = null;
    camera = null;
    faunaGroup = null;
    ground = null;
    water = null;
    humanSilhouette = null;
  }

  function resize() {
    if (!renderer || !camera || !mount) return;
    const w = Math.max(120, mount.clientWidth || window.innerWidth);
    const h = Math.max(120, mount.clientHeight || 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setRunning(on) {
    if (on === running || disposed) return;
    running = on;
    if (on) raf = requestAnimationFrame(tick);
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function updateSimulations(dt) {
    if (!selectedId || reduced) return;
    const creature = speciesIndex.get(selectedId);
    if (!creature) return;

    if (simMode === 'walk') {
      const t = idleT * 4;
      const legs = creature.userData.legBones || [];
      legs.forEach((leg) => {
        if (!leg) return;
        const phase = leg.userData.gait ? t + Math.PI : t;
        leg.rotation.x = Math.sin(phase) * 0.38;
      });
      const wings = creature.userData.wingBones || [];
      wings.forEach((wing, i) => {
        if (!wing) return;
        wing.rotation.z = Math.sin(idleT * 5 + i) * 0.25;
      });
      creature.position.y = (creature.userData.baseY || 0) + Math.abs(Math.sin(t)) * 0.08;
      creature.rotation.y = (creature.userData.baseRotY || 0) + Math.sin(idleT * 0.6) * 0.08;
    }

    if (simMode === 'bones') {
      simBoneTimer += dt;
      if (simBoneTimer > 1.4) {
        simBoneTimer = 0;
        const bones = creature.userData.bones || [];
        if (bones.length) {
          simBoneIndex = (simBoneIndex + 1) % bones.length;
          highlightBone(selectedId, bones[simBoneIndex]);
        }
      }
    }
  }

  function tick(t) {
    if (!running || !renderer || !scene || !camera || disposed) return;
    raf = requestAnimationFrame(tick);
    const now = t * 0.001;
    const dt = Math.min(0.05, now - (idleT || now));
    idleT = now;
    if (!reduced && !camTween && !selectedId) {
      camera.position.x = homeCam.x + Math.sin(idleT * 0.12) * 0.35;
      camera.position.y = homeCam.y + Math.sin(idleT * 0.1) * 0.12;
      camera.lookAt(0, 1.2, 0);
    }
    if (faunaGroup && !reduced) {
      faunaGroup.children.forEach((child, i) => {
        if (child.userData.isHuman) return;
        if (child.userData.speciesId === selectedId && simMode) return;
        if (child.userData.bodyPlan === 'pterosaur') {
          child.position.y = (child.userData.baseY || 0) + Math.sin(idleT * 1.2 + i) * 0.08;
        } else {
          child.rotation.y = (child.userData.baseRotY || child.rotation.y) + Math.sin(idleT * 0.4 + i) * 0.0008;
        }
      });
    }
    updateSimulations(dt);
    renderer.render(scene, camera);
  }

  function showFallback(reason) {
    const fallback = document.getElementById('dhFallback');
    const status = document.getElementById('dhStageStatus');
    if (fallback) {
      fallback.hidden = false;
      fallback.setAttribute('aria-hidden', 'false');
    }
    if (canvas) canvas.style.display = 'none';
    if (status) status.textContent = reason || 'Static diorama (WebGL unavailable)';
  }

  function easeCameraTo(target, done) {
    if (!camera || !target) {
      if (done) done();
      return;
    }
    const look = { x: target.x, y: target.y + 1.0, z: target.z };
    // Gentle nudge — keep most of the diorama in frame (no hard snap)
    const dest = {
      x: target.x * 0.35 + homeCam.x * 0.65,
      y: Math.max(3.2, homeCam.y - 0.4),
      z: Math.max(12, homeCam.z - 2.5)
    };
    if (camTween && typeof camTween.kill === 'function') camTween.kill();
    if (reduced || typeof window.gsap === 'undefined') {
      camera.position.set(dest.x, dest.y, dest.z);
      camera.lookAt(look.x, look.y, look.z);
      if (done) done();
      return;
    }
    const state = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    camTween = window.gsap.to(state, {
      duration: 0.85,
      ease: 'power2.out',
      x: dest.x,
      y: dest.y,
      z: dest.z,
      onUpdate() {
        camera.position.set(state.x, state.y, state.z);
        camera.lookAt(look.x, look.y, look.z);
      },
      onComplete() {
        camTween = null;
        if (done) done();
      }
    });
  }

  function resetCamera(animate) {
    const dest = { ...homeCam };
    if (camTween && typeof camTween.kill === 'function') camTween.kill();
    selectedId = null;
    simMode = null;
    const btn = document.getElementById('dhResetCam');
    if (btn) btn.hidden = true;
    if (!camera) return;
    if (!animate || reduced || typeof window.gsap === 'undefined') {
      camera.position.set(dest.x, dest.y, dest.z);
      camera.lookAt(0, 1.2, 0);
      return;
    }
    const state = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    camTween = window.gsap.to(state, {
      duration: 0.9,
      ease: 'power2.inOut',
      x: dest.x,
      y: dest.y,
      z: dest.z,
      onUpdate() {
        camera.position.set(state.x, state.y, state.z);
        camera.lookAt(0, 1.2, 0);
      },
      onComplete() {
        camTween = null;
      }
    });
  }

  function spotlight(speciesId, opts) {
    const creature = speciesIndex.get(speciesId);
    const status = document.getElementById('dhStageStatus');
    const btn = document.getElementById('dhResetCam');
    if (!creature) {
      if (status) status.textContent = 'That animal is in another era — switch eras to see it.';
      return false;
    }
    selectedId = speciesId;
    if (btn) btn.hidden = false;
    if (status) {
      const sp = speciesData.find((s) => s.id === speciesId);
      status.textContent = sp ? `Spotlight: ${sp.commonName}` : 'Spotlight';
    }
    easeCameraTo(creature.position, opts?.done);
    if (onSelectCb && !opts?.silent) onSelectCb(speciesId);
    return true;
  }

  function setSkeletonMode(on) {
    skeletonMode = Boolean(on);
    speciesIndex.forEach((creature) => applySkeletonLook(creature, skeletonMode));
    const status = document.getElementById('dhStageStatus');
    if (status) status.textContent = skeletonMode ? 'Skeleton view — named bones' : 'Flesh view';
  }

  function startSimulation(mode) {
    if (!selectedId) return false;
    simMode = mode || 'walk';
    simBoneIndex = 0;
    simBoneTimer = 0;
    if (simMode === 'bones') {
      setSkeletonMode(true);
      const bones = listBones(selectedId);
      if (bones[0]) highlightBone(selectedId, bones[0]);
    }
    const status = document.getElementById('dhStageStatus');
    if (status) {
      status.textContent =
        simMode === 'bones' ? 'Simulation: bone tour' : 'Simulation: locomotion';
    }
    return true;
  }

  function stopSimulation() {
    simMode = null;
    if (selectedId) {
      const creature = speciesIndex.get(selectedId);
      if (creature) {
        clearBoneHighlight(creature);
        const legs = creature.userData.legBones || [];
        legs.forEach((leg) => {
          if (leg) leg.rotation.x = 0;
        });
        creature.position.y = creature.userData.baseY || 0;
        creature.rotation.y = creature.userData.baseRotY || creature.rotation.y;
      }
    }
  }

  function pickAt(clientX, clientY) {
    if (!renderer || !camera || !faunaGroup) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(faunaGroup.children, true);
    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i].object;
      const id = hit?.userData?.speciesId;
      if (!id) continue;
      const bone = hit.userData.boneName;
      spotlight(id);
      if (bone) highlightBone(id, bone);
      return;
    }
  }

  function addFerns(THREE) {
    const frond = makeMat(THREE, { color: 0x2f6b34, roughness: 0.82, side: THREE.DoubleSide });
    const stemMat = makeMat(THREE, { color: 0x3d5a30, roughness: 0.9 });
    for (let i = 0; i < 16; i += 1) {
      const fern = new THREE.Group();
      const h = 0.45 + (i % 5) * 0.16;
      const stem = new THREE.Mesh(new THREE.ConeGeometry(0.05 + (i % 3) * 0.02, h, 5), stemMat);
      stem.position.y = h * 0.5;
      stem.castShadow = true;
      fern.add(stem);
      for (let f = 0; f < 5; f += 1) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), frond);
        leaf.position.set(0, h * 0.62, 0);
        leaf.rotation.y = f * 1.25 + i;
        leaf.rotation.z = 0.7;
        fern.add(leaf);
      }
      const ang = (i / 16) * Math.PI * 2;
      const rad = 8.5 + (i % 4) * 1.6;
      fern.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad - 0.5);
      scene.add(fern);
      scenery.push(fern);
    }
  }

  function initScene() {
    const THREE = window.THREE;
    mount = document.getElementById('dhStage');
    canvas = document.getElementById('dhCanvas');
    if (!mount || !canvas || typeof THREE === 'undefined') {
      showFallback('Static diorama (Three.js unavailable)');
      return false;
    }

    reduced = prefersReducedMotion();
    disposed = false;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (_) {
      showFallback('Static diorama (WebGL unavailable)');
      return false;
    }

    renderer.setClearColor(0x000000, 0);
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
    }
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    fog = new THREE.Fog(0xa8c878, 12, 42);
    scene.fog = fog;
    scene.background = new THREE.Color(0xa8c878);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(homeCam.x, homeCam.y, homeCam.z);
    camera.lookAt(0, 1.2, 0);

    ambient = new THREE.AmbientLight(0xf6efe2, 0.38);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xffe6c4, 0x3d5a32, 0.55);
    scene.add(hemi);
    scenery.push(hemi);
    keyLight = new THREE.DirectionalLight(0xffe8c8, 1.35);
    keyLight.position.set(8, 14, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0008;
    scene.add(keyLight);
    fillLight = new THREE.DirectionalLight(0x4a8a6a, 0.28);
    fillLight.position.set(-6, 4, -3);
    scene.add(fillLight);
    const rim = new THREE.DirectionalLight(0xffc090, 0.35);
    rim.position.set(-4, 6, 8);
    scene.add(rim);
    scenery.push(rim);

    const groundTex = skinTextures(THREE, { dorsal: '#5a7344', ventral: '#6d5a3a', mark: '#2e3a24', style: 'scale' });
    ground = new THREE.Mesh(
      new THREE.CircleGeometry(22, 64),
      makeMat(THREE, { color: 0xffffff, map: groundTex.map, bumpMap: groundTex.bump, bumpScale: 0.04, roughness: 0.94, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
    addFerns(THREE);

    water = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      makeMat(THREE, {
        color: 0x3a7a7e,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.85
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-6, 0.02, -4);
    water.receiveShadow = true;
    scene.add(water);

    faunaGroup = new THREE.Group();
    scene.add(faunaGroup);

    humanSilhouette = buildHuman(THREE, matsFor(THREE, true));
    humanSilhouette.scale.setScalar(HUMAN_HEIGHT_M * 0.55);
    humanSilhouette.userData.isHuman = true;

    raycaster = new THREE.Raycaster();
    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(mount);
    window.addEventListener('resize', resize, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        setRunning(vis && !disposed);
      },
      { threshold: 0.05 }
    );
    io.observe(mount);

    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      pickAt(ev.clientX, ev.clientY);
    });

    document.getElementById('dhResetCam')?.addEventListener('click', () => resetCamera(true));

    if (reduced) {
      const status = document.getElementById('dhStageStatus');
      if (status) status.textContent = 'Diorama ready (reduced motion)';
    }

    setRunning(true);
    return true;
  }

  window.DinosaurHallScene = {
    init(opts) {
      speciesData = opts?.species || [];
      erasData = opts?.eras || [];
      onSelectCb = typeof opts?.onSelect === 'function' ? opts.onSelect : null;
      onBoneCb = typeof opts?.onBone === 'function' ? opts.onBone : null;
      const ok = initScene();
      if (ok) {
        restage(opts?.era || 'jurassic');
        const status = document.getElementById('dhStageStatus');
        if (status && !reduced) status.textContent = 'Click a creature · use era chips to restage';
      }
      return ok;
    },
    setEra(eraId) {
      restage(eraId);
      resetCamera(false);
      const status = document.getElementById('dhStageStatus');
      const era = erasData.find((e) => e.id === eraId);
      if (status && era) status.textContent = `${era.label} diorama · ${era.years}`;
    },
    spotlight,
    resetCamera,
    dispose,
    setSkeletonMode,
    startSimulation,
    stopSimulation,
    highlightBone,
    listBones,
    getSkeletonMode() {
      return skeletonMode;
    },
    getSimMode() {
      return simMode;
    },
    getHighlightedBone() {
      return highlightedBone;
    },
    getActiveEra() {
      return activeEra;
    },
    getSelectedId() {
      return selectedId;
    }
  };
})();
