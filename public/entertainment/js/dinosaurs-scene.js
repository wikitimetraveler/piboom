/**
 * Dinosaurs stage — procedural low-poly dinosaurs in Three.js (global r160).
 * Ellipsoid-chain rigs (neck / head + jaw / tail / legs), era flora, ember motes,
 * soft key shadow, roar + drag-to-turn, and amber-card thumbnail renders.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const reducedMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TAU = Math.PI * 2;

  /* ---------- small math ---------- */

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smoothstep(a, b, x) {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function hashStr(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function vnoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function groundHeight(x, z) {
    const r = Math.hypot(x, z);
    const hill = smoothstep(3.8, 11, r) * (vnoise(x * 0.22 + 4, z * 0.22) * 2.6 + 0.3);
    const bump = (vnoise(x * 1.2 + 10, z * 1.2) - 0.5) * 0.07;
    return hill + bump;
  }

  /* ---------- colour helpers (sRGB hex) ---------- */

  function hexRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbCss(rgb) {
    return `rgb(${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`;
  }

  function shade(hex, amt) {
    const rgb = hexRgb(hex);
    const target = amt < 0 ? 0 : 255;
    const k = Math.abs(amt);
    return rgbCss(rgb.map((v) => v + (target - v) * k));
  }

  function mixHex(a, b, k) {
    const ra = hexRgb(a);
    const rb = hexRgb(b);
    return rgbCss(ra.map((v, i) => v + (rb[i] - v) * k));
  }

  /* ---------- textures ---------- */

  function skinTexture(THREE, sp) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    const { skin, belly, accent } = sp.palette;

    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, shade(skin, -0.38));
    g.addColorStop(0.42, skin);
    g.addColorStop(0.66, mixHex(skin, belly, 0.55));
    g.addColorStop(1, belly);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);

    const rand = rng(hashStr(sp.id));
    const form = sp.body.form;
    ctx.fillStyle = accent;

    if (sp.diet === 'carnivore') {
      ctx.globalAlpha = 0.5;
      const n = 16;
      for (let i = 0; i < n; i += 1) {
        const x = (i / n) * 256 + rand() * 6;
        const len = 42 + rand() * 18;
        const wob = (rand() - 0.5) * 16;
        ctx.beginPath();
        ctx.moveTo(x - 5, 0);
        ctx.quadraticCurveTo(x + wob, len * 0.55, x + wob * 0.4, len);
        ctx.quadraticCurveTo(x + wob + 4, len * 0.5, x + 5, 0);
        ctx.fill();
      }
    } else if (form === 'ankylosaur') {
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 150; i += 1) {
        ctx.beginPath();
        ctx.ellipse(rand() * 256, rand() * 80, 2 + rand() * 6, 2 + rand() * 4, rand() * Math.PI, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.globalAlpha = 0.42;
      for (let i = 0; i < 70; i += 1) {
        ctx.beginPath();
        ctx.ellipse(rand() * 256, 6 + rand() * 62, 2 + rand() * 5, 1.5 + rand() * 3.5, rand() * Math.PI, 0, TAU);
        ctx.fill();
      }
    }

    for (let i = 0; i < 1600; i += 1) {
      ctx.globalAlpha = 0.08 + rand() * 0.1;
      ctx.fillStyle = rand() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(rand() * 256, rand() * 128, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function dotTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function groundAlphaTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.55, '#fff');
    g.addColorStop(0.92, '#000');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function disposeObject(obj) {
    const geos = new Set();
    const mats = new Set();
    const texs = new Set();
    obj.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          mats.add(m);
          ['map', 'alphaMap', 'emissiveMap'].forEach((k) => {
            if (m[k]) texs.add(m[k]);
          });
        });
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());
  }

  /* ---------- dinosaur builder ---------- */

  const NECK_SHAPE = {
    theropod: [0.8, -0.3],
    prosauropod: [0.62, -0.14],
    sauropod: [1.2, -0.07],
    stegosaur: [-0.22, -0.02],
    ceratopsian: [-0.12, -0.04],
    ankylosaur: [-0.15, 0],
  };
  const HEAD_TILT = {
    theropod: -0.06,
    prosauropod: -0.12,
    sauropod: -0.3,
    stegosaur: -0.3,
    ceratopsian: -0.38,
    ankylosaur: -0.2,
  };
  const TAIL_SHAPE = {
    theropod: [0.1, -0.012],
    prosauropod: [0.12, -0.01],
    sauropod: [0.2, -0.015],
    stegosaur: [0.1, -0.03],
    ceratopsian: [0.3, 0.02],
    ankylosaur: [0.08, -0.01],
  };

  function buildDinosaur(THREE, sp) {
    const b = sp.body;
    const form = b.form;
    const biped = form === 'theropod' || form === 'prosauropod';
    const carnivore = sp.diet === 'carnivore';
    const [TL, TH, TW] = b.torso;
    const [neckSegs, neckLen, lift] = b.neck;
    const [S, F] = b.head;
    const [tailSegs, tailLen] = b.tail;
    const [hindLen, foreLen] = b.legs;
    const UP = new THREE.Vector3(0, 1, 0);

    const geo = {
      hi: new THREE.SphereGeometry(1, 18, 12),
      lo: new THREE.SphereGeometry(1, 12, 9),
      cone: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
      dodec: new THREE.DodecahedronGeometry(1, 0),
      halfDisc: new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, 0, Math.PI),
    };

    const mats = {
      skin: new THREE.MeshStandardMaterial({ map: skinTexture(THREE, sp), roughness: 0.8, metalness: 0, flatShading: true }),
      belly: new THREE.MeshStandardMaterial({ color: sp.palette.belly, roughness: 0.85, flatShading: true }),
      accent: new THREE.MeshStandardMaterial({
        color: sp.palette.accent,
        roughness: 0.55,
        flatShading: true,
        emissive: sp.palette.accent,
        emissiveIntensity: 0.08,
      }),
      bone: new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.4, flatShading: true }),
      beak: new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.45, flatShading: true }),
      eye: new THREE.MeshStandardMaterial({
        color: carnivore ? 0xffb300 : 0x7a4a18,
        roughness: 0.1,
        emissive: carnivore ? 0x8a3a00 : 0x1a0a00,
        emissiveIntensity: 0.7,
      }),
      pupil: new THREE.MeshStandardMaterial({ color: 0x050302, roughness: 0.08 }),
      mouth: new THREE.MeshStandardMaterial({ color: 0x5a1414, roughness: 0.7, flatShading: true }),
    };

    const rootGroup = new THREE.Group();

    function part(material, g, sx, sy, sz, x, y, z, parent) {
      const m = new THREE.Mesh(g, material);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    }

    function orient(mesh, x, y, z) {
      mesh.quaternion.setFromUnitVectors(UP, new THREE.Vector3(x, y, z).normalize());
    }

    const hipY = hindLen + TH * 0.12;
    const span = TL * 0.62;
    let pitch;
    if (form === 'theropod') pitch = -0.04;
    else if (form === 'prosauropod') pitch = 0.16;
    else pitch = Math.atan2(foreLen + TH * 0.12 - hipY, span);

    const body = new THREE.Group();
    body.position.y = hipY;
    body.rotation.z = pitch;
    rootGroup.add(body);

    const torso = new THREE.Group();
    body.add(torso);
    const cx = TL * 0.28;
    part(mats.skin, geo.hi, TL * 0.62, TH * 0.5, TW * 0.5, cx, 0, 0, torso);
    part(mats.skin, geo.hi, TL * 0.3, TH * 0.5, TW * 0.52, 0, TH * 0.02, 0, torso);
    part(mats.skin, geo.hi, TL * 0.28, TH * 0.46, TW * 0.48, TL * 0.66, -TH * 0.04, 0, torso);

    /* neck */
    const neckBase = new THREE.Group();
    neckBase.position.set(TL * 0.82, TH * 0.08, 0);
    body.add(neckBase);
    const shape = NECK_SHAPE[form];
    const neckAngle = form === 'sauropod' ? lift * 1.3 : shape[0];
    const neckCurve = shape[1];
    const r0 = Math.min(TH, TW) * 0.36;
    const r1 = Math.max(S * 0.38, r0 * 0.35);
    const segL = neckLen / neckSegs;
    const neck = [];
    let parent = neckBase;
    let acc = pitch;
    for (let i = 0; i < neckSegs; i += 1) {
      const g = new THREE.Group();
      if (i > 0) g.position.x = segL;
      g.rotation.z = i === 0 ? neckAngle : neckCurve;
      g.userData.base = g.rotation.z;
      parent.add(g);
      const k = neckSegs > 1 ? i / (neckSegs - 1) : 0;
      const r = r0 + (r1 - r0) * k;
      part(mats.skin, geo.lo, segL * 0.75, r, r * 0.92, segL * 0.5, 0, 0, g);
      neck.push(g);
      parent = g;
      acc += g.rotation.z;
    }
    const headMount = new THREE.Group();
    headMount.position.x = segL * 0.95;
    headMount.rotation.z = -acc + HEAD_TILT[form];
    parent.add(headMount);

    /* head */
    const head = new THREE.Group();
    headMount.add(head);
    const wide = form === 'ankylosaur' ? 1.45 : form === 'ceratopsian' ? 1.15 : 1;
    part(mats.skin, geo.hi, S * 0.55, S * 0.42, S * 0.38 * wide, S * 0.28, S * 0.06, 0, head);
    const snoutX = S * (0.55 + 0.3 * F);
    part(mats.skin, geo.hi, S * 0.5 * F, S * 0.27, S * 0.26 * wide, snoutX, -S * 0.02, 0, head);
    part(mats.mouth, geo.lo, S * 0.42 * F, S * 0.1, S * 0.2 * wide, snoutX - S * 0.05, -S * 0.17, 0, head);
    part(mats.skin, geo.lo, S * 0.2, S * 0.06, S * 0.1, S * 0.44, S * 0.3, S * 0.24 * wide, head);
    part(mats.skin, geo.lo, S * 0.2, S * 0.06, S * 0.1, S * 0.44, S * 0.3, -S * 0.24 * wide, head);

    const jaw = new THREE.Group();
    jaw.position.set(S * 0.12, -S * 0.17, 0);
    head.add(jaw);
    part(mats.belly, geo.hi, S * 0.55 * F, S * 0.11, S * 0.24 * wide, S * 0.5 * F, -S * 0.03, 0, jaw);

    const tipX = snoutX + S * 0.45 * F;
    const mouthPoint = new THREE.Object3D();
    mouthPoint.position.set(tipX, -S * 0.14, 0);
    head.add(mouthPoint);

    if (carnivore) {
      const n = 7;
      for (let i = 0; i < n; i += 1) {
        const x = S * 0.42 + (tipX - S * 0.55) * (i / (n - 1));
        [-1, 1].forEach((side) => {
          const z = side * S * 0.17 * wide * (1 - (i / n) * 0.3);
          const t = part(mats.bone, geo.cone, S * 0.03, S * 0.1, S * 0.03, x, -S * 0.22, z, head);
          t.rotation.x = Math.PI;
          t.castShadow = false;
          const lt = part(mats.bone, geo.cone, S * 0.025, S * 0.08, S * 0.025, x - S * 0.14, S * 0.04, z * 0.95, jaw);
          lt.castShadow = false;
        });
      }
    }

    const eyes = [];
    [-1, 1].forEach((side) => {
      const eg = new THREE.Group();
      eg.position.set(S * 0.42, S * 0.2, side * S * 0.3 * wide);
      head.add(eg);
      part(mats.eye, geo.lo, S * 0.085, S * 0.085, S * 0.085, 0, 0, 0, eg);
      part(mats.pupil, geo.lo, S * 0.025, S * (carnivore ? 0.07 : 0.045), S * 0.03, S * 0.02, 0, side * S * 0.07, eg);
      eyes.push(eg);
    });

    if (b.browHorns) {
      [-1, 1].forEach((side) => {
        const h = part(mats.accent, geo.cone, S * 0.06, S * 0.18, S * 0.06, S * 0.5, S * 0.34, side * S * 0.16, head);
        h.rotation.z = -0.3;
      });
    }

    if (form === 'sauropod') {
      part(mats.skin, geo.hi, S * 0.32, S * 0.3, S * 0.26, S * 0.36, S * 0.3, 0, head);
    }

    if (form === 'ceratopsian') {
      const beak = part(mats.beak, geo.cone, S * 0.12, S * 0.32, S * 0.1, tipX - S * 0.14, -S * 0.08, 0, head);
      beak.rotation.z = -Math.PI / 2 - 0.35;
      const nasal = part(mats.bone, geo.cone, S * 0.08, S * 0.3, S * 0.08, snoutX + S * 0.1, S * 0.18, 0, head);
      nasal.rotation.z = -0.35;
      [-1, 1].forEach((side) => {
        const h = part(mats.bone, geo.cone, S * 0.085, S * 1.0, S * 0.085, S * 0.42, S * 0.36, side * S * 0.2, head);
        h.rotation.z = -1.0;
        h.rotation.x = side * 0.15;
      });
      const frill = new THREE.Group();
      frill.position.set(-S * 0.05, S * 0.3, 0);
      frill.rotation.z = Math.PI / 2 + 0.5;
      head.add(frill);
      part(mats.accent, geo.halfDisc, S * 1.05, S * 0.05, S * 1.0, 0, 0, 0, frill);
      for (let i = 0; i <= 10; i += 1) {
        const a = -Math.PI / 2 + Math.PI * (i / 10);
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const sp2 = part(mats.bone, geo.cone, S * 0.05, S * 0.16, S * 0.05, dir.x * S * 1.0, 0, dir.z * S * 1.0, frill);
        sp2.quaternion.setFromUnitVectors(UP, dir);
        sp2.castShadow = false;
      }
    }

    if (form === 'ankylosaur') {
      [-1, 1].forEach((side) => {
        [0, 1].forEach((j) => {
          const h = part(mats.accent, geo.cone, S * 0.07, S * 0.22, S * 0.07, S * (0.05 + j * 0.3), S * (0.22 - j * 0.12), side * S * 0.42, head);
          orient(h, -0.5, 0.3, side * 0.8);
        });
      });
    }

    /* tail */
    const tailBase = new THREE.Group();
    tailBase.position.set(-TL * 0.3, TH * 0.06, 0);
    body.add(tailBase);
    const [tA, tC] = TAIL_SHAPE[form];
    const tSeg = tailLen / tailSegs;
    const tr0 = Math.min(TH, TW) * 0.42;
    const tail = [];
    parent = tailBase;
    for (let i = 0; i < tailSegs; i += 1) {
      const g = new THREE.Group();
      if (i > 0) g.position.x = -tSeg;
      g.rotation.z = i === 0 ? tA - pitch * 0.9 : tC;
      g.userData.base = g.rotation.z;
      parent.add(g);
      const k = tailSegs > 1 ? i / (tailSegs - 1) : 0;
      const r = tr0 * (1 - k * 0.86);
      g.userData.radius = r;
      part(mats.skin, geo.lo, tSeg * 0.75, r, r * 0.92, -tSeg * 0.5, 0, 0, g);
      tail.push(g);
      parent = g;
    }
    const tailTip = new THREE.Group();
    tailTip.position.x = -tSeg;
    parent.add(tailTip);

    if (b.club) {
      [-1, 1].forEach((side) => {
        part(mats.accent, geo.dodec, tSeg * 0.45, TH * 0.13, TW * 0.15, -tSeg * 0.15, 0, side * TW * 0.09, tailTip);
      });
    }

    if (b.spikes) {
      const dirs = [[-0.35, 0.55, 0.75], [-0.6, 0.45, 0.6]];
      dirs.forEach((d, j) => {
        [-1, 1].forEach((side) => {
          const s = part(mats.bone, geo.cone, TH * 0.04, TH * 0.4, TH * 0.04, tSeg * (0.3 + j * 0.5), TH * 0.03, side * TH * 0.03, tailTip);
          orient(s, d[0], d[1], d[2] * side);
        });
      });
    }

    /* stegosaur plates */
    if (b.plates) {
      const plate = new THREE.Shape();
      plate.moveTo(-0.5, 0);
      plate.quadraticCurveTo(-0.6, 0.55, 0, 1);
      plate.quadraticCurveTo(0.6, 0.55, 0.5, 0);
      plate.lineTo(-0.5, 0);
      const plateGeo = new THREE.ExtrudeGeometry(plate, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 1,
        curveSegments: 5,
      });
      plateGeo.translate(0, -0.15, -0.025);
      const n = b.plates;
      for (let j = 0; j < n; j += 1) {
        const t = j / (n - 1);
        const x = TL * 0.95 - t * TL * 1.25;
        const dx = (x - cx) / (TL * 0.62);
        const y = TH * 0.5 * Math.sqrt(Math.max(0, 1 - dx * dx));
        const size = TH * (0.3 + 0.58 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.08)));
        const side = j % 2 ? 1 : -1;
        const p = part(mats.accent, plateGeo, size * 0.85, size, 1, x, y, side * TW * 0.05, torso);
        p.rotation.x = side * 0.14;
        p.rotation.z = -dx * 0.55;
      }
      for (let i = 0; i < Math.min(3, tail.length); i += 1) {
        const s = TH * (0.42 - i * 0.1);
        const side = i % 2 ? 1 : -1;
        const p = part(mats.accent, plateGeo, s * 0.85, s, 1, -tSeg * 0.5, tail[i].userData.radius * 0.8, side * TW * 0.04, tail[i]);
        p.rotation.x = side * 0.14;
      }
    }

    /* ankylosaur armour */
    if (b.armour) {
      const a = TL * 0.62;
      const bb = TH * 0.5;
      const c = TW * 0.5;
      for (let ix = 0; ix < 8; ix += 1) {
        const u = -0.8 + ix * (1.6 / 7);
        const f = Math.sqrt(1 - u * u);
        for (let iy = -3; iy <= 3; iy += 1) {
          const th = iy * 0.38;
          const s = TH * 0.075 * (1 - Math.abs(iy) * 0.08);
          const n = part(mats.accent, geo.dodec, s * 1.2, s * 0.6, s * 1.2, cx + a * u, bb * f * Math.cos(th), c * f * Math.sin(th), torso);
          n.rotation.x = th;
          n.castShadow = false;
        }
        if (ix % 2 === 0) {
          [-1, 1].forEach((side) => {
            const th = side * 1.5;
            const s = part(mats.bone, geo.cone, TH * 0.05, TH * 0.22, TH * 0.05, cx + a * u, bb * f * Math.cos(th), c * f * Math.sin(th), torso);
            orient(s, -0.2, 0.1, side);
          });
        }
      }
    }

    /* legs */
    function makeLeg(drop, thick, style, x, y, z) {
      const angles = style === 'digi' ? [0.5, -1.15, 0.85] : [0.1, -0.2, 0.1];
      const props = style === 'digi' ? [0.42, 0.4, 0.26] : [0.52, 0.44, 0.06];
      let unit = 0;
      let sum = 0;
      for (let i = 0; i < 3; i += 1) {
        sum += angles[i];
        unit += props[i] * Math.cos(sum);
      }
      const L = props.map((p) => (p * drop) / unit);

      const hip = new THREE.Group();
      hip.position.set(x, y, z);
      hip.rotation.z = -pitch;
      body.add(hip);

      const thigh = new THREE.Group();
      thigh.rotation.z = angles[0];
      hip.add(thigh);
      part(mats.skin, geo.lo, thick, L[0] * 0.62, thick * 0.85, 0, -L[0] * 0.45, 0, thigh);

      const knee = new THREE.Group();
      knee.position.y = -L[0];
      knee.rotation.z = angles[1];
      thigh.add(knee);
      part(mats.skin, geo.lo, thick * 0.6, L[1] * 0.58, thick * 0.55, 0, -L[1] * 0.5, 0, knee);

      const ankle = new THREE.Group();
      ankle.position.y = -L[1];
      ankle.rotation.z = angles[2];
      knee.add(ankle);
      part(mats.skin, geo.lo, thick * 0.42, L[2] * 0.6 + thick * 0.1, thick * 0.42, 0, -L[2] * 0.5, 0, ankle);

      const foot = new THREE.Group();
      foot.position.y = -L[2];
      foot.rotation.z = -(angles[0] + angles[1] + angles[2]);
      ankle.add(foot);

      if (style === 'digi') {
        [-1, 0, 1].forEach((t) => {
          const toe = new THREE.Group();
          toe.rotation.y = t * 0.35;
          foot.add(toe);
          part(mats.skin, geo.lo, thick * 0.45, thick * 0.13, thick * 0.14, thick * 0.38, -thick * 0.08, 0, toe);
          const claw = part(mats.bone, geo.cone, thick * 0.07, thick * 0.22, thick * 0.07, thick * 0.78, -thick * 0.1, 0, toe);
          claw.rotation.z = -Math.PI / 2 - 0.3;
          claw.castShadow = false;
        });
      } else {
        part(mats.skin, geo.lo, thick * 0.62, thick * 0.22, thick * 0.6, thick * 0.08, -thick * 0.08, 0, foot);
        [-1, 0, 1].forEach((t) => {
          const nail = part(mats.bone, geo.lo, thick * 0.12, thick * 0.08, thick * 0.1, thick * 0.55, -thick * 0.12, t * thick * 0.32, foot);
          nail.castShadow = false;
        });
      }
      return hip;
    }

    function makeArm(len, thick, x, y, z) {
      const sh = new THREE.Group();
      sh.position.set(x, y, z);
      sh.rotation.z = -pitch;
      body.add(sh);
      const upper = new THREE.Group();
      upper.rotation.z = -0.4;
      sh.add(upper);
      part(mats.skin, geo.lo, thick, len * 0.32, thick * 0.9, 0, -len * 0.25, 0, upper);
      const fore = new THREE.Group();
      fore.position.y = -len * 0.5;
      fore.rotation.z = 1.25;
      upper.add(fore);
      part(mats.skin, geo.lo, thick * 0.75, len * 0.3, thick * 0.7, 0, -len * 0.24, 0, fore);
      const hand = new THREE.Group();
      hand.position.y = -len * 0.48;
      fore.add(hand);
      [-1, 1].forEach((t) => {
        const c = part(mats.bone, geo.cone, thick * 0.22, thick * 0.9, thick * 0.22, 0, 0, t * thick * 0.3, hand);
        c.rotation.z = Math.PI - 0.6;
        c.castShadow = false;
      });
    }

    const hindStyle = biped ? 'digi' : 'column';
    const hindThick = biped ? TW * (b.tinyArms ? 0.4 : 0.34) : TW * 0.26;
    const hindJointY = -TH * 0.1;
    const hindDrop = hipY + hindJointY * Math.cos(pitch);
    [-1, 1].forEach((side) => makeLeg(hindDrop, hindThick, hindStyle, 0, hindJointY, side * TW * 0.36));

    if (biped) {
      const armThick = Math.max(0.03, foreLen * 0.12);
      [-1, 1].forEach((side) => makeArm(foreLen, armThick, TL * 0.68, -TH * 0.18, side * TW * 0.32));
    } else {
      const foreJointY = -TH * 0.15;
      const foreDrop = hipY + span * Math.sin(pitch) + foreJointY * Math.cos(pitch);
      [-1, 1].forEach((side) => makeLeg(foreDrop, TW * 0.22, 'column', span, foreJointY, side * TW * 0.32));
    }

    return {
      root: rootGroup,
      body,
      torso,
      neck,
      head,
      jaw,
      tail,
      eyes,
      mouthPoint,
      carnivore,
      roarLift: carnivore ? 0.38 : 0.22,
      baseBodyY: hipY,
    };
  }

  function animateRig(rig, t, roar, look) {
    const breathe = Math.sin(t * 1.7);
    rig.torso.scale.set(1, 1 + breathe * 0.022, 1 + breathe * 0.03);
    rig.body.position.y = rig.baseBodyY + Math.sin(t * 0.85) * rig.baseBodyY * 0.006 - roar * rig.baseBodyY * 0.02;

    const tl = rig.tail.length;
    rig.tail.forEach((g, i) => {
      const k = (i + 1) / tl;
      g.rotation.y = Math.sin(t * 1.1 - i * 0.45) * 0.07 * k * (1 + roar * 1.6);
      g.rotation.z = g.userData.base + Math.sin(t * 0.9 - i * 0.3) * 0.02 * k - roar * 0.015;
    });

    const nl = rig.neck.length;
    rig.neck.forEach((g, i) => {
      g.rotation.z = g.userData.base + Math.sin(t * 0.8 + i * 0.3) * 0.018 + (roar * rig.roarLift) / nl;
      g.rotation.y = (look.x * 0.18) / nl;
    });

    rig.head.rotation.y = look.x * 0.32 + Math.sin(t * 0.37) * 0.12 * (1 - roar);
    rig.head.rotation.z = look.y * 0.14 + roar * 0.3;
    rig.jaw.rotation.z = -(0.04 + 0.03 * Math.max(0, Math.sin(t * 0.6))) - roar * (rig.carnivore ? 0.62 : 0.42);

    const phase = t % 4.7;
    const blink = phase < 0.14 ? Math.sin((phase / 0.14) * Math.PI) : 0;
    rig.eyes.forEach((e) => { e.scale.y = 1 - blink * 0.9; });
  }

  function normalizeRig(THREE, rig, fitW, fitH) {
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = Math.min(fitW / size.x, fitH / size.y);
    const norm = new THREE.Group();
    norm.scale.setScalar(s);
    rig.root.position.set(-center.x, -box.min.y, -center.z);
    norm.add(rig.root);
    return { group: norm, height: size.y * s, length: size.x * s };
  }

  /* ---------- flora ---------- */

  const FLORA_TINT = {
    arid: { leafDark: '#3b4a2a', leafLight: '#7a8a42', rock: '#8a4a2e', trunk: '#5a3a24' },
    fern: { leafDark: '#24502a', leafLight: '#5f9a3e', rock: '#5a5a4a', trunk: '#4a3322' },
    volcanic: { leafDark: '#2c3a24', leafLight: '#4f7034', rock: '#2a2422', trunk: '#2a1d16' },
  };

  function buildFlora(THREE, era) {
    const group = new THREE.Group();
    const rand = rng(hashStr(era.id) + 11);
    const tint = FLORA_TINT[era.flora] || FLORA_TINT.fern;
    const geo = {
      cone: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
      cyl: new THREE.CylinderGeometry(0.5, 0.7, 1, 6).translate(0, 0.5, 0),
      leaf: new THREE.SphereGeometry(1, 8, 4),
      rockA: new THREE.DodecahedronGeometry(1, 0),
      rockB: new THREE.IcosahedronGeometry(1, 0),
      blob: new THREE.SphereGeometry(1, 10, 7),
    };
    const flat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, flatShading: true }, extra || {}));
    const mats = {
      trunk: flat(tint.trunk),
      leafDark: flat(tint.leafDark),
      leafLight: flat(tint.leafLight, { side: THREE.DoubleSide }),
      rock: flat(tint.rock),
      blossomA: flat('#f6d6e4', { emissive: '#f6d6e4', emissiveIntensity: 0.15 }),
      blossomB: flat('#fff6e8', { emissive: '#fff6e8', emissiveIntensity: 0.15 }),
      lava: new THREE.MeshBasicMaterial({ color: 0xff6a1a }),
    };

    function place(item, rMin, rMax, opts) {
      const o = opts || {};
      for (let tries = 0; tries < 40; tries += 1) {
        const a = -0.35 + rand() * (Math.PI + 0.7);
        const r = rMin + rand() * (rMax - rMin);
        const x = Math.cos(a) * r;
        const z = -Math.sin(a) * r;
        const maxZ = o.maxZ === undefined ? 1 : o.maxZ;
        if (z > maxZ) continue;
        if (z > 1 && Math.abs(x) < 3.2) continue;
        if (COMPANION_SLOTS.some((s) => Math.hypot(x - s.x, z - s.z) < s.r)) continue;
        item.position.set(x, groundHeight(x, z) - (o.sink || 0), z);
        item.rotation.y = rand() * TAU;
        item.userData.delay = rand() * 0.55;
        group.add(item);
        return item;
      }
      return null;
    }

    function conifer(h) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(geo.cyl, mats.trunk);
      trunk.scale.set(h * 0.07, h * 0.45, h * 0.07);
      g.add(trunk);
      for (let i = 0; i < 4; i += 1) {
        const tier = new THREE.Mesh(geo.cone, mats.leafDark);
        const s = h * 0.24 * (1 - i * 0.2);
        tier.scale.set(s, h * 0.34, s);
        tier.position.y = h * (0.26 + i * 0.17);
        g.add(tier);
      }
      return g;
    }

    function frondRing(count, len, width, lift, mat, y) {
      const g = new THREE.Group();
      g.position.y = y || 0;
      for (let i = 0; i < count; i += 1) {
        const arm = new THREE.Group();
        arm.rotation.y = (i / count) * TAU + rand() * 0.3;
        arm.rotation.z = lift + (rand() - 0.5) * 0.25;
        const leaf = new THREE.Mesh(geo.leaf, mat);
        leaf.scale.set(len * 0.5, len * 0.03, width);
        leaf.position.x = len * 0.48;
        arm.add(leaf);
        g.add(arm);
      }
      return g;
    }

    function treeFern(h) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(geo.cyl, mats.trunk);
      trunk.scale.set(h * 0.07, h, h * 0.07);
      trunk.rotation.z = (rand() - 0.5) * 0.12;
      g.add(trunk);
      g.add(frondRing(9, h * 0.62, h * 0.07, -0.35, mats.leafLight, h));
      return g;
    }

    function cycad(s) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(geo.cyl, mats.trunk);
      trunk.scale.set(s * 0.32, s * 0.55, s * 0.32);
      g.add(trunk);
      g.add(frondRing(11, s * 0.95, s * 0.08, 0.55, mats.leafLight, s * 0.52));
      return g;
    }

    function fernClump(s) {
      return frondRing(7 + Math.floor(rand() * 4), s, s * 0.11, 0.75, mats.leafLight, 0);
    }

    function horsetail(s) {
      const g = new THREE.Group();
      for (let i = 0; i < 9; i += 1) {
        const stem = new THREE.Mesh(geo.cyl, mats.leafDark);
        const h = s * (0.6 + rand() * 0.7);
        stem.scale.set(s * 0.035, h, s * 0.035);
        stem.position.set((rand() - 0.5) * s * 0.4, 0, (rand() - 0.5) * s * 0.4);
        stem.rotation.set((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
        g.add(stem);
      }
      return g;
    }

    function rock(s) {
      const m = new THREE.Mesh(rand() > 0.5 ? geo.rockA : geo.rockB, mats.rock);
      m.scale.set(s * (0.8 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (0.8 + rand() * 0.5));
      m.rotation.set(rand() * TAU, rand() * TAU, rand() * TAU);
      m.position.y = s * 0.15;
      const g = new THREE.Group();
      g.add(m);
      return g;
    }

    function shrub(s) {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i += 1) {
        const blob = new THREE.Mesh(geo.blob, mats.leafDark);
        blob.scale.set(s * (0.45 + rand() * 0.2), s * (0.35 + rand() * 0.15), s * (0.45 + rand() * 0.2));
        blob.position.set((rand() - 0.5) * s * 0.5, s * 0.3, (rand() - 0.5) * s * 0.5);
        g.add(blob);
      }
      for (let i = 0; i < 9; i += 1) {
        const bl = new THREE.Mesh(geo.blob, rand() > 0.5 ? mats.blossomA : mats.blossomB);
        bl.scale.setScalar(s * 0.07);
        const a = rand() * TAU;
        bl.position.set(Math.cos(a) * s * 0.45, s * (0.35 + rand() * 0.3), Math.sin(a) * s * 0.45);
        g.add(bl);
      }
      return g;
    }

    function charredTree(h) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(geo.cyl, mats.trunk);
      trunk.scale.set(h * 0.05, h, h * 0.05);
      g.add(trunk);
      for (let i = 0; i < 3; i += 1) {
        const br = new THREE.Mesh(geo.cyl, mats.trunk);
        br.scale.set(h * 0.025, h * 0.35, h * 0.025);
        br.position.y = h * (0.55 + i * 0.12);
        br.rotation.set(0, rand() * TAU, 0.7 + rand() * 0.4);
        g.add(br);
      }
      return g;
    }

    function lavaCrack(len) {
      const g = new THREE.Group();
      let x = 0;
      let z = 0;
      let a = rand() * TAU;
      for (let i = 0; i < 7; i += 1) {
        const segLen = len / 7;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.02, 0.05 + rand() * 0.04), mats.lava);
        seg.position.set(x + Math.cos(a) * segLen * 0.5, 0.03, z + Math.sin(a) * segLen * 0.5);
        seg.rotation.y = -a;
        g.add(seg);
        x += Math.cos(a) * segLen;
        z += Math.sin(a) * segLen;
        a += (rand() - 0.5) * 0.9;
      }
      return g;
    }

    const n = (base) => base;
    if (era.flora === 'arid') {
      for (let i = 0; i < n(7); i += 1) place(conifer(2.2 + rand() * 1.6), 5, 9, { maxZ: -2 });
      for (let i = 0; i < n(11); i += 1) place(rock(0.25 + rand() * 0.55), 2.9, 8, { maxZ: 5 });
      for (let i = 0; i < n(7); i += 1) place(horsetail(0.8 + rand() * 0.5), 3, 7, { maxZ: 4 });
    } else if (era.flora === 'fern') {
      for (let i = 0; i < n(6); i += 1) place(treeFern(1.8 + rand() * 1.2), 4.6, 8, { maxZ: -1.5 });
      for (let i = 0; i < n(5); i += 1) place(conifer(3.2 + rand() * 1.8), 7, 10, { maxZ: -3 });
      for (let i = 0; i < n(16); i += 1) place(fernClump(0.6 + rand() * 0.5), 2.8, 7.5, { maxZ: 5 });
      for (let i = 0; i < n(5); i += 1) place(cycad(0.7 + rand() * 0.4), 3.2, 6.5, { maxZ: 2 });
      for (let i = 0; i < n(5); i += 1) place(rock(0.2 + rand() * 0.35), 3, 7, { maxZ: 4 });
    } else {
      for (let i = 0; i < n(12); i += 1) place(rock(0.25 + rand() * 0.75), 2.9, 8.5, { maxZ: 5 });
      for (let i = 0; i < n(5); i += 1) place(cycad(0.7 + rand() * 0.35), 3.2, 6.5, { maxZ: 2 });
      for (let i = 0; i < n(4); i += 1) place(shrub(0.6 + rand() * 0.4), 3.2, 6.5, { maxZ: 3 });
      for (let i = 0; i < n(4); i += 1) place(charredTree(2 + rand() * 1.4), 5, 9, { maxZ: -2 });
      for (let i = 0; i < n(4); i += 1) place(lavaCrack(1.6 + rand() * 1.4), 3.2, 7, { maxZ: 0 });
    }

    group.traverse((o) => {
      if (o.isMesh) o.receiveShadow = false;
    });
    return group;
  }

  /* ---------- stage ---------- */

  const ERA_LIGHT = {
    triassic: { hemi: 1.15, key: 3.0, rim: 2.0, exposure: 1.08, fog: 0.045, lava: 0, mote: { color: '#ffd29a', size: 0.05, opacity: 0.45, rise: 0.12, count: 180 } },
    jurassic: { hemi: 1.3, key: 2.6, rim: 1.6, exposure: 1.12, fog: 0.055, lava: 0, mote: { color: '#eaffb0', size: 0.055, opacity: 0.7, rise: 0.06, count: 200 } },
    cretaceous: { hemi: 0.95, key: 2.4, rim: 3.4, exposure: 1.1, fog: 0.05, lava: 14, mote: { color: '#ff7a2a', size: 0.06, opacity: 0.95, rise: 0.45, count: 320 } },
  };

  const FIT_W = 4.4;
  const FIT_H = 3.1;
  const VIEW_W = 5.8;
  const VIEW_H = 4.3;
  const COMPANION_SLOTS = [
    { x: -3.9, z: -4.6, yaw: -0.55, r: 2.4 },
    { x: 4.1, z: -6.0, yaw: Math.PI + 0.45, r: 2.8 },
  ];

  function contactShadow(THREE, length) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length * 0.95, length * 0.42), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.renderOrder = -1;
    return mesh;
  }
  const MOTE_MAX = 320;
  const BURST_MAX = 260;

  function createStage(mount, opts) {
    const THREE = root.THREE;
    const C = root.DinosaursCatalog;
    const options = opts || {};
    if (!THREE || !mount || !C) return null;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
      return null;
    }
    if (!renderer.getContext()) return null;

    const narrow = root.matchMedia && root.matchMedia('(max-width: 991.98px)').matches;
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, narrow ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.05);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    const pmrem = new THREE.PMREMGenerator(renderer);
    let envTex = null;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-5, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -3, near: 1, far: 25 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 2.2);
    rim.position.set(6, 4, -7);
    scene.add(rim);
    const lava = new THREE.PointLight(0xff5a1a, 0, 9, 2);
    lava.position.set(-3.2, 0.6, -4.5);
    scene.add(lava);

    /* ground */
    const groundGeo = new THREE.PlaneGeometry(24, 24, 72, 72);
    groundGeo.rotateX(-Math.PI / 2);
    const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i += 1) {
      gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)));
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(gp.count * 3), 3));
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        flatShading: true,
        alphaMap: groundAlphaTexture(THREE),
        transparent: true,
      })
    );
    ground.receiveShadow = true;
    scene.add(ground);

    function paintGround(era) {
      const a = new THREE.Color(era.ground);
      const b = new THREE.Color(era.groundDeep);
      const col = groundGeo.attributes.color;
      const tmp = new THREE.Color();
      for (let i = 0; i < gp.count; i += 1) {
        const x = gp.getX(i);
        const z = gp.getZ(i);
        const k = clamp01(vnoise(x * 0.5 + 3, z * 0.5) * 0.9 + gp.getY(i) * 0.12);
        tmp.copy(a).lerp(b, k);
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      col.needsUpdate = true;
    }

    /* motes + bursts */
    const dotTex = dotTexture(THREE);
    const motePos = new Float32Array(MOTE_MAX * 3);
    const moteSpeed = new Float32Array(MOTE_MAX);
    const moteRand = rng(77);
    for (let i = 0; i < MOTE_MAX; i += 1) {
      const a = moteRand() * TAU;
      const r = 1.5 + moteRand() * 7.5;
      motePos[i * 3] = Math.cos(a) * r;
      motePos[i * 3 + 1] = moteRand() * 5;
      motePos[i * 3 + 2] = Math.sin(a) * r - 1.5;
      moteSpeed[i] = 0.5 + moteRand();
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      size: 0.06,
      map: dotTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    motes.frustumCulled = false;
    scene.add(motes);
    let moteRise = 0.2;

    const bPos = new Float32Array(BURST_MAX * 3).fill(-999);
    const bCol = new Float32Array(BURST_MAX * 3);
    const bBase = new Float32Array(BURST_MAX * 3);
    const bVel = new Float32Array(BURST_MAX * 3);
    const bLife = new Float32Array(BURST_MAX);
    const bMax = new Float32Array(BURST_MAX).fill(1);
    const bGrav = new Float32Array(BURST_MAX);
    let bCursor = 0;
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    burstGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    const burst = new THREE.Points(
      burstGeo,
      new THREE.PointsMaterial({
        size: 0.09,
        map: dotTex,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    burst.frustumCulled = false;
    scene.add(burst);

    function emit(origin, vel, spread, color, life, gravity) {
      const i = bCursor;
      bCursor = (bCursor + 1) % BURST_MAX;
      const c = new THREE.Color(color);
      bPos[i * 3] = origin.x;
      bPos[i * 3 + 1] = origin.y;
      bPos[i * 3 + 2] = origin.z;
      bVel[i * 3] = vel.x + (Math.random() - 0.5) * spread;
      bVel[i * 3 + 1] = vel.y + (Math.random() - 0.5) * spread;
      bVel[i * 3 + 2] = vel.z + (Math.random() - 0.5) * spread;
      bBase[i * 3] = c.r;
      bBase[i * 3 + 1] = c.g;
      bBase[i * 3 + 2] = c.b;
      bLife[i] = life * (0.6 + Math.random() * 0.4);
      bMax[i] = bLife[i];
      bGrav[i] = gravity;
    }

    function dustRing(radius, count, color) {
      const v = new THREE.Vector3();
      const o = new THREE.Vector3();
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * TAU;
        const r = radius * (0.7 + Math.random() * 0.5);
        o.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
        v.set(Math.cos(a) * 1.6, 0.5 + Math.random() * 0.6, Math.sin(a) * 1.6);
        emit(o, v, 0.5, color, 1.3, 1.1);
      }
    }

    function updateBursts(dt) {
      for (let i = 0; i < BURST_MAX; i += 1) {
        if (bLife[i] <= 0) continue;
        bLife[i] -= dt;
        if (bLife[i] <= 0) {
          bPos[i * 3 + 1] = -999;
          bCol[i * 3] = bCol[i * 3 + 1] = bCol[i * 3 + 2] = 0;
          continue;
        }
        bVel[i * 3 + 1] -= bGrav[i] * dt;
        const drag = 1 - 1.4 * dt;
        bVel[i * 3] *= drag;
        bVel[i * 3 + 1] *= drag;
        bVel[i * 3 + 2] *= drag;
        bPos[i * 3] += bVel[i * 3] * dt;
        bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt;
        bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
        const k = bLife[i] / bMax[i];
        bCol[i * 3] = bBase[i * 3] * k;
        bCol[i * 3 + 1] = bBase[i * 3 + 1] * k;
        bCol[i * 3 + 2] = bBase[i * 3 + 2] * k;
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstGeo.attributes.color.needsUpdate = true;
    }

    function updateMotes(dt, t) {
      const count = moteGeo.drawRange.count === Infinity ? MOTE_MAX : moteGeo.drawRange.count;
      for (let i = 0; i < count; i += 1) {
        motePos[i * 3 + 1] += moteRise * moteSpeed[i] * dt;
        motePos[i * 3] += Math.sin(t * 0.7 + i) * 0.003;
        if (motePos[i * 3 + 1] > 5.5) motePos[i * 3 + 1] = 0;
      }
      moteGeo.attributes.position.needsUpdate = true;
    }

    /* environment */
    function buildEnv(era) {
      const env = new THREE.Scene();
      const s = era.sky;
      env.background = new THREE.Color(s.zenith);
      const add = (color, mult, pos, scale) => {
        const c = new THREE.Color(color).multiplyScalar(mult);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
        m.position.set(pos[0], pos[1], pos[2]);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      add(s.zenith, 1, [0, 9, 0], 16);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        add(s.horizon, 1.2, [Math.cos(a) * 8, 1.5, Math.sin(a) * 8], 7);
      }
      add(s.sun, 4, [6, 3, -6], 3);
      add(era.ground, 0.6, [0, -8, 0], 16);
      const tex = pmrem.fromScene(env, 0.04).texture;
      env.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      return tex;
    }

    /* state */
    let eraId = null;
    let flora = null;
    let floraT0 = 0;
    let current = null;
    const leaving = [];
    let companions = [];
    let yaw = -0.45;
    let yawTarget = -0.45;
    let spin = !reducedMotion;
    let resumeSpinAt = 0;
    let roarAt = -1;
    let shake = 0;
    let impactAt = -1;
    let impactHit = false;
    let keyBoost = 0;
    let camDist = 10;
    let lookY = 1.4;
    const look = { x: 0, y: 0, tx: 0, ty: 0 };
    const par = { x: 0, y: 0 };
    let time = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let visible = true;
    let inView = true;
    let disposed = false;
    const tmpV = new THREE.Vector3();
    const tmpD = new THREE.Vector3();

    function now() {
      return performance.now();
    }

    function setEra(id) {
      const era = C.eraById(id);
      if (!era || id === eraId) return;
      eraId = id;
      const L = ERA_LIGHT[id];
      const s = era.sky;

      scene.fog.color.set(era.fog);
      scene.fog.density = L.fog;
      hemi.color.set(mixHex(s.horizon, '#ffffff', 0.4));
      hemi.groundColor.set(era.groundDeep);
      hemi.intensity = L.hemi;
      key.color.set(s.sun);
      key.userData.base = L.key;
      rim.color.set(era.rim);
      rim.intensity = L.rim;
      lava.userData.base = L.lava;
      renderer.toneMappingExposure = L.exposure;

      if (envTex) envTex.dispose();
      envTex = buildEnv(era);
      scene.environment = envTex;

      paintGround(era);

      if (flora) {
        scene.remove(flora);
        disposeObject(flora);
      }
      flora = buildFlora(THREE, era);
      scene.add(flora);
      floraT0 = reducedMotion ? -10 : time;

      moteMat.color.set(L.mote.color);
      moteMat.size = L.mote.size;
      moteMat.opacity = L.mote.opacity;
      moteGeo.setDrawRange(0, L.mote.count);
      moteRise = L.mote.rise;

      requestRender();
    }

    function frameCamera() {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const tanH = Math.tan((camera.fov * Math.PI) / 360);
      camDist = Math.max(VIEW_H / 2 / tanH, VIEW_W / 2 / (tanH * camera.aspect));
    }

    function setSpecies(sp, o) {
      if (!sp || (current && current.id === sp.id)) return;
      const instant = reducedMotion || (o && o.instant);
      const rig = buildDinosaur(THREE, sp);
      const norm = normalizeRig(THREE, rig, FIT_W, FIT_H);
      const holder = new THREE.Group();
      holder.add(norm.group);
      holder.rotation.y = yaw;
      holder.traverse((m) => {
        if (m.isMesh) m.receiveShadow = false;
      });
      scene.add(holder);

      if (current) {
        if (instant) {
          scene.remove(current.holder);
          disposeObject(current.holder);
        } else {
          leaving.push({ holder: current.holder, t0: time });
        }
      }
      current = { id: sp.id, sp, rig, holder, height: norm.height, length: norm.length, t0: instant ? -10 : time };
      lookY = Math.min(1.6, norm.height * 0.45);
      if (!instant) {
        holder.scale.setScalar(0.001);
        const era = C.eraById(sp.era);
        dustRing(norm.length * 0.45, 70, era ? era.ground : '#c89a6a');
      }
      animateRig(rig, time, 0, look);
      syncCompanions(sp, instant);
      requestRender();
    }

    function syncCompanions(hero, instant) {
      const mates = C.speciesForEra(hero.era).filter((s) => s.id !== hero.id).slice(0, COMPANION_SLOTS.length);
      const heroLength = current ? current.length : FIT_W;

      companions.forEach((c) => {
        if (instant) {
          scene.remove(c.holder);
          disposeObject(c.holder);
        } else {
          leaving.push({ holder: c.holder, t0: time, baseY: c.holder.position.y });
        }
      });

      companions = mates.map((sp, i) => {
        const slot = COMPANION_SLOTS[i];
        const rig = buildDinosaur(THREE, sp);
        const len = Math.max(1.6, Math.min(6.5, heroLength * (sp.lengthM / hero.lengthM)));
        const norm = normalizeRig(THREE, rig, len, 3.9);
        const holder = new THREE.Group();
        holder.add(contactShadow(THREE, norm.length));
        holder.add(norm.group);
        holder.position.set(slot.x, groundHeight(slot.x, slot.z) - 0.05, slot.z);
        holder.rotation.y = slot.yaw;
        holder.traverse((m) => {
          if (m.isMesh) {
            m.receiveShadow = false;
            m.castShadow = false;
          }
        });
        scene.add(holder);
        animateRig(rig, i * 2.3, 0, { x: 0, y: 0 });
        return { sp, rig, holder, slot, phase: i * 2.3 + 0.7, t0: instant ? -10 : time + 0.25 + i * 0.2 };
      });
    }

    function roarEnvelope(t) {
      if (t < 0) return 0;
      if (t < 0.18) return t / 0.18;
      if (t < 1.1) return 1;
      if (t < 1.6) return 1 - (t - 1.1) / 0.5;
      return 0;
    }

    function roar() {
      if (!current) return;
      roarAt = time;
      if (!reducedMotion) shake = Math.max(shake, 0.04 + Math.min(0.08, current.sp.lengthM / 160));
      if (reducedMotion) {
        animateRig(current.rig, 0, 1, look);
        renderOnce();
        setTimeout(() => {
          roarAt = -1;
          if (current) animateRig(current.rig, 0, 0, look);
          renderOnce();
        }, 1200);
      }
    }

    function impact() {
      if (reducedMotion) return;
      impactAt = time;
      impactHit = false;
    }

    function turn(delta) {
      yawTarget += delta;
      resumeSpinAt = time + 3;
      if (reducedMotion) {
        yaw = yawTarget;
        if (current) current.holder.rotation.y = yaw;
        renderOnce();
      }
    }

    function setSpin(on) {
      spin = !!on && !reducedMotion;
    }

    function update(dt) {
      time += dt;

      if (spin && time > resumeSpinAt && !drag) yawTarget += dt * 0.2;
      yaw += (yawTarget - yaw) * (1 - Math.exp(-dt * 6));

      for (let i = leaving.length - 1; i >= 0; i -= 1) {
        const l = leaving[i];
        const k = clamp01((time - l.t0) / 0.35);
        const s = 1 - k * k * k;
        l.holder.scale.setScalar(Math.max(0.001, s));
        l.holder.position.y = (l.baseY || 0) - k * 0.4;
        if (k >= 1) {
          scene.remove(l.holder);
          disposeObject(l.holder);
          leaving.splice(i, 1);
        }
      }

      let roarK = 0;
      if (current) {
        const k = clamp01((time - current.t0) / 0.75);
        current.holder.scale.setScalar(Math.max(0.001, easeOutBack(k)));
        current.holder.rotation.y = yaw;
        if (roarAt >= 0) {
          const rt = time - roarAt;
          roarK = roarEnvelope(rt);
          if (rt > 1.6) roarAt = -1;
          if (rt > 0.15 && rt < 1.0) {
            current.rig.mouthPoint.getWorldPosition(tmpV);
            tmpD.set(1, 0.15, 0).transformDirection(current.rig.head.matrixWorld).multiplyScalar(2.4);
            const hot = eraId === 'cretaceous';
            for (let i = 0; i < 3; i += 1) {
              emit(tmpV, tmpD, 0.9, hot ? '#ff9a4a' : '#f2dcae', 0.9, -0.2);
            }
          }
        }
        look.x += (look.tx - look.x) * (1 - Math.exp(-dt * 3));
        look.y += (look.ty - look.y) * (1 - Math.exp(-dt * 3));
        animateRig(current.rig, time, roarK, look);
      }

      companions.forEach((c) => {
        const k = clamp01((time - c.t0) / 0.8);
        c.holder.scale.setScalar(Math.max(0.001, k >= 1 ? 1 : easeOutBack(k)));
        c.holder.rotation.y = c.slot.yaw + Math.sin(time * 0.13 + c.phase) * 0.16;
        const glance = { x: Math.sin(time * 0.21 + c.phase) * 0.7, y: Math.sin(time * 0.17 + c.phase) * 0.2 };
        animateRig(c.rig, time + c.phase, roarK * 0.45, glance);
      });

      if (flora) {
        const ft = time - floraT0;
        flora.children.forEach((item) => {
          const k = clamp01((ft - (item.userData.delay || 0)) / 0.6);
          item.scale.setScalar(Math.max(0.001, k >= 1 ? 1 : easeOutBack(k)));
        });
      }

      if (impactAt >= 0) {
        const e = time - impactAt;
        if (!impactHit && e > 1.5) {
          impactHit = true;
          shake = 0.32;
          keyBoost = 3.5;
          dustRing(3.5, 120, '#ffb070');
          for (let i = 0; i < 60; i += 1) {
            tmpV.set((Math.random() - 0.5) * 10, 0.2, -4 - Math.random() * 4);
            tmpD.set((Math.random() - 0.5) * 2, 2 + Math.random() * 2.5, 1.5);
            emit(tmpV, tmpD, 1, '#ff7a2a', 2.4, 0.6);
          }
          roar();
        }
        if (e > 6) impactAt = -1;
      }

      keyBoost *= Math.exp(-dt * 1.6);
      key.intensity = (key.userData.base || 2.6) * (1 + keyBoost);
      const lavaBase = lava.userData.base || 0;
      lava.intensity = lavaBase * (0.8 + 0.2 * Math.sin(time * 5.3) * Math.sin(time * 2.1));

      updateMotes(dt, time);
      updateBursts(dt);

      par.x += (look.tx - par.x) * (1 - Math.exp(-dt * 2));
      par.y += (look.ty - par.y) * (1 - Math.exp(-dt * 2));
      shake *= Math.exp(-dt * 3.2);
      const punch = 1 - roarK * 0.06;
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;
      camera.position.set(par.x * 0.7 + sx, lookY + camDist * 0.17 + par.y * 0.25 + sy, camDist * punch);
      camera.lookAt(sx * 0.4, lookY, 0);
    }

    function render() {
      renderer.render(scene, camera);
    }

    function renderOnce() {
      if (disposed) return;
      camera.position.set(0, lookY + camDist * 0.17, camDist);
      camera.lookAt(0, lookY, 0);
      if (current) current.holder.scale.setScalar(1);
      companions.forEach((c) => c.holder.scale.setScalar(1));
      if (flora) flora.children.forEach((item) => item.scale.setScalar(1));
      render();
    }

    function requestRender() {
      if (reducedMotion || !running) renderOnce();
    }

    function tick(t) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      update(dt);
      render();
    }

    function syncRunning() {
      const should = !disposed && !reducedMotion && visible && inView;
      if (should && !running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    /* input */
    let drag = null;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      drag = { x: e.clientX, lastX: e.clientX, moved: false };
      if (mount.setPointerCapture && e.pointerId !== undefined) {
        try { mount.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      }
    }
    function onMove(e) {
      const r = mount.getBoundingClientRect();
      look.tx = clamp01((e.clientX - r.left) / r.width) * 2 - 1;
      look.ty = -(clamp01((e.clientY - r.top) / r.height) * 2 - 1);
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) > 6) drag.moved = true;
      if (drag.moved) {
        mount.classList.add('is-dragging');
        yawTarget += (e.clientX - drag.lastX) * 0.012;
        resumeSpinAt = time + 2.5;
        if (reducedMotion) {
          yaw = yawTarget;
          if (current) current.holder.rotation.y = yaw;
          renderOnce();
        }
      }
      drag.lastX = e.clientX;
    }
    function onUp() {
      if (drag && !drag.moved && typeof options.onTap === 'function') options.onTap();
      drag = null;
      mount.classList.remove('is-dragging');
    }
    function onLeave() {
      look.tx = 0;
      look.ty = 0;
    }
    mount.addEventListener('pointerdown', onDown);
    mount.addEventListener('pointermove', onMove);
    mount.addEventListener('pointerup', onUp);
    mount.addEventListener('pointercancel', onUp);
    mount.addEventListener('pointerleave', onLeave);

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { frameCamera(); requestRender(); }) : null;
    if (ro) ro.observe(mount);
    const onResize = () => { frameCamera(); requestRender(); };
    root.addEventListener('resize', onResize, { passive: true });

    const onVis = () => {
      visible = !document.hidden;
      syncRunning();
    };
    document.addEventListener('visibilitychange', onVis);
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((entries) => {
        inView = entries.some((en) => en.isIntersecting);
        syncRunning();
      }, { threshold: 0.02 });
      io.observe(mount);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      mount.removeEventListener('pointerdown', onDown);
      mount.removeEventListener('pointermove', onMove);
      mount.removeEventListener('pointerup', onUp);
      mount.removeEventListener('pointercancel', onUp);
      mount.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      disposeObject(scene);
      if (envTex) envTex.dispose();
      pmrem.dispose();
      dotTex.dispose();
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    root.addEventListener('pagehide', dispose, { once: true });

    frameCamera();
    syncRunning();

    return {
      setEra,
      setSpecies,
      roar,
      impact,
      turn,
      setSpin,
      dispose,
      isLive: () => !disposed,
      reducedMotion,
    };
  }

  /* ---------- amber-card thumbnails ---------- */

  function renderThumbnails(list, done) {
    const THREE = root.THREE;
    if (!THREE || !Array.isArray(list) || !list.length) {
      done({});
      return;
    }
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (err) {
      done({});
      return;
    }
    const W = 420;
    const H = 300;
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x5a2a10, 1.7));
    const key = new THREE.DirectionalLight(0xffe2b0, 3);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const rimL = new THREE.DirectionalLight(0xff9a40, 2.6);
    rimL.position.set(4, 3, -4);
    scene.add(rimL);
    const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 60);

    const out = {};
    let i = 0;
    function step() {
      if (i >= list.length) {
        r.dispose();
        if (typeof r.forceContextLoss === 'function') r.forceContextLoss();
        done(out);
        return;
      }
      const sp = list[i];
      i += 1;
      try {
        const rig = buildDinosaur(THREE, sp);
        animateRig(rig, 0.6, 0.35, { x: 0, y: 0 });
        const norm = normalizeRig(THREE, rig, 4.4, 3.1);
        const holder = new THREE.Group();
        holder.add(norm.group);
        holder.rotation.y = -0.5;
        scene.add(holder);
        const tanH = Math.tan((cam.fov * Math.PI) / 360);
        const dist = Math.max(3.6 / 2 / tanH, 5 / 2 / (tanH * cam.aspect));
        const ly = norm.height * 0.5;
        cam.position.set(0, ly + dist * 0.12, dist);
        cam.lookAt(0, ly, 0);
        r.render(scene, cam);
        out[sp.id] = r.domElement.toDataURL('image/png');
        scene.remove(holder);
        disposeObject(holder);
      } catch (err) {
        console.warn('Dinosaur thumbnail failed', sp.id, err);
      }
      setTimeout(step, 0);
    }
    step();
  }

  root.DinosaursScene = {
    createStage,
    renderThumbnails,
    buildDinosaur,
    groundHeight,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
