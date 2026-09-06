/**
 * PlanetariumGL — full-sky Three.js dome (inner sphere, drag/zoom/pick).
 * Falls back gracefully when WebGL is unavailable (ok=false).
 * Development work by David Lane
 */
import * as THREE from 'three';

const SKY_R = 100;
const MIN_FOV = 20;
const MAX_FOV = 110;
const MIN_DOME_FOV = 20;
const MAX_DOME_FOV = 110;
const DEFAULT_FOV = 75;
const HORIZON_ALT = 38;
const HORIZON_FOV = 75;
const DOME_ALT = 89;
const DOME_FOV = 95;
const DEG = Math.PI / 180;

const PLANET_COLORS = {
  moon: 0xf2f0e8,
  mercury: 0xb0a090,
  venus: 0xf5e6c8,
  mars: 0xe07040,
  jupiter: 0xe8c090,
  saturn: 0xf0d8a0,
  uranus: 0xa0d8e0,
  neptune: 0x5080e0,
};

const PLANET_TEX = {
  mercury: '/shared/textures/planets/mercury.jpg',
  venus: '/shared/textures/planets/venus.jpg',
  mars: '/shared/textures/planets/mars.jpg',
  jupiter: '/shared/textures/planets/jupiter.jpg',
  saturn: '/shared/textures/planets/saturn.jpg',
  uranus: '/shared/textures/planets/uranus.jpg',
  neptune: '/shared/textures/planets/neptune.jpg',
  moon: '/shared/textures/moon/moon-color.jpg',
};

/** Alt/az (deg, az 0° N / 90° E) → unit-ish vector on sky sphere. */
function altAzToVec3(alt, az, out) {
  const a = alt * DEG;
  const z = az * DEG;
  const c = Math.cos(a);
  out.set(Math.sin(z) * c, Math.sin(a), -Math.cos(z) * c);
  return out;
}

/** Camera basis: facing azimuth sits at the bottom of a look-up dome. */
function lookBasis(altDeg, azDeg, forward, right, up) {
  altAzToVec3(altDeg, azDeg, forward).normalize();
  const z = azDeg * DEG;
  right.set(Math.cos(z), 0, Math.sin(z));
  if (Math.abs(forward.y) < 0.995) {
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() > 1e-8) right.normalize();
    else right.set(Math.cos(z), 0, Math.sin(z));
  }
  up.crossVectors(right, forward).normalize();
  return { forward, right, up };
}

function bvToColor(bv, target) {
  let t = Number(bv);
  if (!Number.isFinite(t)) t = 0.65;
  t = Math.max(-0.4, Math.min(2.0, t));
  let r;
  let g;
  let b;
  if (t < 0) {
    r = 0.6 + 0.4 * ((t + 0.4) / 0.4);
    g = 0.75 + 0.2 * ((t + 0.4) / 0.4);
    b = 1;
  } else if (t < 0.5) {
    r = 0.85 + 0.15 * (t / 0.5);
    g = 0.9 + 0.08 * (t / 0.5);
    b = 1 - 0.15 * (t / 0.5);
  } else if (t < 1.5) {
    r = 1;
    g = 0.95 - 0.35 * ((t - 0.5) / 1);
    b = 0.85 - 0.55 * ((t - 0.5) / 1);
  } else {
    r = 1;
    g = 0.55 - 0.2 * ((t - 1.5) / 0.5);
    b = 0.3 - 0.15 * ((t - 1.5) / 0.5);
  }
  return target.setRGB(r, Math.max(0.2, g), Math.max(0.15, b));
}

function twilightSkyColor(sunAlt, target) {
  // Planetarium projector mode: keep the dome dark so stars stay readable.
  // Daylight only adds a slight cool wash — never a solid blue fill.
  if (sunAlt > 0) {
    target.setRGB(0.04, 0.055, 0.1);
  } else if (sunAlt > -6) {
    const t = (sunAlt + 6) / 6;
    target.setRGB(0.03 + 0.04 * t, 0.04 + 0.04 * t, 0.08 + 0.05 * t);
  } else if (sunAlt > -12) {
    target.setRGB(0.025, 0.035, 0.07);
  } else if (sunAlt > -18) {
    target.setRGB(0.02, 0.03, 0.06);
  } else {
    target.setRGB(0.015, 0.025, 0.055);
  }
  return target;
}

function createApi() {
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let starPoints = null;
  let lineObj = null;
  let milkyWay = null;
  let ground = null;
  let atmos = null;
  let planetGroup = null;
  let markerGroup = null;
  let issMesh = null;
  let raf = 0;
  let dead = false;
  let ok = false;
  let ready = false;
  let lastW = 0;
  let lastH = 0;
  let starsCatalog = [];
  let constellations = [];
  let showLines = true;
  let cameraAz = 180;
  let cameraAlt = 42;
  let fov = 110;
  let domeMode = true;
  let cubeRT = null;
  let cubeCam = null;
  let fisheyeScene = null;
  let fisheyeCamera = null;
  let fisheyeMat = null;
  let cubeDirty = true;
  let reducedMotion = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = false;
  let pinchDist = 0;
  let pinching = false;
  let onSelect = null;
  let onViewChange = null;
  let engine = null;
  let lastSnap = null;
  let pickables = [];
  let textureLoader = null;
  let planetTextures = Object.create(null);
  const tmp = new THREE.Vector3();
  const lookFwd = new THREE.Vector3();
  const lookRight = new THREE.Vector3();
  const lookUpV = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const skyColor = new THREE.Color();

  function resize() {
    if (!renderer || !canvas || !camera) return;
    const stage = canvas.closest('.plan-stage') || canvas.parentElement || canvas;
    const rect = stage.getBoundingClientRect();
    const w = Math.max(2, Math.floor(rect.width));
    const h = Math.max(2, Math.floor(rect.height));
    if (w === lastW && h === lastH && h > 120) return;
    lastW = w;
    lastH = h;
    const fieldApp =
      typeof document !== 'undefined' &&
      (document.body?.classList.contains('plan-field') || window.__PLANETARIUM_FIELD);
    const dprCap = fieldApp ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    markCubeDirty();
  }

  function forceResize() {
    lastW = 0;
    lastH = 0;
    resize();
  }

  function applyCamera() {
    if (!camera) return;
    camera.fov = Math.max(MIN_FOV, Math.min(MAX_FOV, fov));
    camera.position.set(0, 0, 0);
    lookBasis(cameraAlt, cameraAz, lookFwd, lookRight, lookUpV);
    camera.up.copy(lookUpV);
    camera.lookAt(lookFwd.x, lookFwd.y, lookFwd.z);
    camera.updateProjectionMatrix();
  }

  function clampAlt(alt) {
    if (domeMode) return Math.max(12, Math.min(89.5, alt));
    return Math.max(-5, Math.min(89, alt));
  }

  function clampFov(next) {
    if (domeMode) return Math.max(MIN_DOME_FOV, Math.min(MAX_DOME_FOV, next));
    return Math.max(MIN_FOV, Math.min(MAX_FOV, next));
  }

  function notifyView() {
    if (typeof onViewChange === 'function') {
      onViewChange({ az: cameraAz, alt: cameraAlt, fov, domeMode });
    }
  }

  function markCubeDirty() {
    cubeDirty = true;
  }

  function syncFisheyeUniforms() {
    if (!fisheyeMat) return;
    const aspect = lastW && lastH ? lastW / lastH : 1;
    fisheyeMat.uniforms.uFov.value = fov * DEG;
    fisheyeMat.uniforms.uAz.value = cameraAz * DEG;
    fisheyeMat.uniforms.uAlt.value = cameraAlt * DEG;
    fisheyeMat.uniforms.uAspect.value = aspect;
  }

  function setupFisheye() {
    try {
      cubeRT = new THREE.WebGLCubeRenderTarget(768, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      });
      cubeCam = new THREE.CubeCamera(0.4, 400, cubeRT);
      cubeCam.position.set(0, 0, 0);
      fisheyeMat = new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tCube: { value: cubeRT.texture },
          uFov: { value: DOME_FOV * DEG },
          uAz: { value: Math.PI },
          uAlt: { value: DOME_ALT * DEG },
          uAspect: { value: 1 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform samplerCube tCube;
          uniform float uFov;
          uniform float uAz;
          uniform float uAlt;
          uniform float uAspect;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            if (uAspect > 1.0) p.x *= uAspect;
            else p.y /= max(uAspect, 0.0001);
            float r = length(p);
            if (r > 1.035) {
              gl_FragColor = vec4(0.01, 0.012, 0.02, 1.0);
              return;
            }
            float ca = cos(uAlt);
            float sa = sin(uAlt);
            vec3 forward = vec3(sin(uAz) * ca, sa, -cos(uAz) * ca);
            vec3 right;
            if (abs(forward.y) > 0.995) {
              right = vec3(cos(uAz), 0.0, sin(uAz));
            } else {
              right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
            }
            vec3 up = normalize(cross(right, forward));
            float ang = min(r, 1.0) * (uFov * 0.5);
            float invR = r > 1e-5 ? 1.0 / r : 0.0;
            vec3 dir = normalize(forward * cos(ang) + (right * p.x + up * p.y) * (sin(ang) * invR));
            vec4 sky = textureCube(tCube, dir);
            float rim = smoothstep(0.97, 1.03, r);
            gl_FragColor = mix(sky, vec4(0.012, 0.016, 0.03, 1.0), rim);
          }
        `,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fisheyeMat);
      fisheyeScene = new THREE.Scene();
      fisheyeScene.add(quad);
      fisheyeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    } catch (_) {
      cubeRT = null;
      cubeCam = null;
      fisheyeScene = null;
      fisheyeMat = null;
    }
  }

  function captureCube() {
    if (!cubeCam || !renderer || !scene) return;
    const starSize = starPoints && starPoints.material ? starPoints.material.size : 0;
    const bright = starPoints && starPoints.userData && starPoints.userData.brightPoints;
    const brightSize = bright && bright.material ? bright.material.size : 0;
    if (starPoints && starPoints.material) starPoints.material.size = 11;
    if (bright && bright.material) bright.material.size = 20;
    cubeCam.update(renderer, scene);
    if (starPoints && starPoints.material && starSize) starPoints.material.size = starSize;
    if (bright && bright.material && brightSize) bright.material.size = brightSize;
    cubeDirty = false;
  }

  /** Soft circular glow — PointsMaterial is square without a map. */
  function makeStarTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  function buildStars(list) {
    starsCatalog = list || [];
    if (starPoints) {
      const bright = starPoints.userData && starPoints.userData.brightPoints;
      if (bright) {
        starPoints.remove(bright);
        bright.geometry.dispose();
        bright.material.dispose();
      }
      scene.remove(starPoints);
      starPoints.geometry.dispose();
      if (starPoints.material.map) starPoints.material.map.dispose();
      starPoints.material.dispose();
      starPoints = null;
    }
    const n = starsCatalog.length;
    if (!n) return;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const brightIdx = [];
    for (let i = 0; i < n; i += 1) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -SKY_R;
      positions[i * 3 + 2] = 0;
      bvToColor(starsCatalog[i].bv, tmpColor);
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
      if (Number(starsCatalog[i].mag) <= 2.0) brightIdx.push(i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMap = makeStarTexture();
    // sizeAttenuation:false → size is screen pixels (visible at any sky radius)
    const mat = new THREE.PointsMaterial({
      size: 5,
      map: starMap,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
    });
    starPoints = new THREE.Points(geo, mat);
    starPoints.frustumCulled = false;
    starPoints.renderOrder = 2;
    scene.add(starPoints);

    if (brightIdx.length) {
      const bPos = new Float32Array(brightIdx.length * 3);
      const bCol = new Float32Array(brightIdx.length * 3);
      for (let j = 0; j < brightIdx.length; j += 1) {
        const i = brightIdx[j];
        bPos[j * 3 + 1] = -SKY_R;
        bCol[j * 3] = colors[i * 3];
        bCol[j * 3 + 1] = colors[i * 3 + 1];
        bCol[j * 3 + 2] = colors[i * 3 + 2];
      }
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
      bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
      const bMat = new THREE.PointsMaterial({
        size: 10,
        map: starMap,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: false,
      });
      const brightPoints = new THREE.Points(bGeo, bMat);
      brightPoints.name = 'brightStars';
      brightPoints.frustumCulled = false;
      brightPoints.renderOrder = 3;
      scene.add(brightPoints);
      starPoints.userData.brightPoints = brightPoints;
      starPoints.userData.brightIdx = brightIdx;
    }
  }

  function buildConstellationLines(data) {
    constellations = (data && data.constellations) || [];
    if (lineObj) {
      scene.remove(lineObj);
      lineObj.geometry.dispose();
      lineObj.material.dispose();
      lineObj = null;
    }
    const segs = [];
    for (let c = 0; c < constellations.length; c += 1) {
      const lines = constellations[c].lines || [];
      for (let i = 0; i < lines.length; i += 1) {
        segs.push({
          id: constellations[c].id,
          name: constellations[c].name,
          a: lines[i][0],
          b: lines[i][1],
        });
      }
    }
    const positions = new Float32Array(segs.length * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x7aa0d8,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    lineObj = new THREE.LineSegments(geo, mat);
    lineObj.userData.segs = segs;
    lineObj.visible = showLines;
    lineObj.frustumCulled = false;
    scene.add(lineObj);
  }

  function updateEquatorialLayer(date, observer) {
    if (!engine || !starPoints) return;
    const pos = starPoints.geometry.attributes.position.array;
    for (let i = 0; i < starsCatalog.length; i += 1) {
      const s = starsCatalog[i];
      const aa = engine.equatorialToAltAz(s.ra, s.dec, date, observer);
      if (aa.alt < -8) {
        pos[i * 3] = 0;
        pos[i * 3 + 1] = -SKY_R * 2;
        pos[i * 3 + 2] = 0;
      } else {
        altAzToVec3(aa.alt, aa.az, tmp).multiplyScalar(SKY_R);
        pos[i * 3] = tmp.x;
        pos[i * 3 + 1] = tmp.y;
        pos[i * 3 + 2] = tmp.z;
      }
    }
    starPoints.geometry.attributes.position.needsUpdate = true;
    ready = true;

    const brightPoints = starPoints.userData && starPoints.userData.brightPoints;
    const brightIdx = starPoints.userData && starPoints.userData.brightIdx;
    if (brightPoints && brightIdx && brightIdx.length) {
      const bp = brightPoints.geometry.attributes.position.array;
      for (let j = 0; j < brightIdx.length; j += 1) {
        const i = brightIdx[j];
        bp[j * 3] = pos[i * 3];
        bp[j * 3 + 1] = pos[i * 3 + 1];
        bp[j * 3 + 2] = pos[i * 3 + 2];
      }
      brightPoints.geometry.attributes.position.needsUpdate = true;
    }

    if (lineObj && lineObj.userData.segs) {
      const segs = lineObj.userData.segs;
      const lp = lineObj.geometry.attributes.position.array;
      for (let i = 0; i < segs.length; i += 1) {
        const seg = segs[i];
        const a = engine.equatorialToAltAz(seg.a[0], seg.a[1], date, observer);
        const b = engine.equatorialToAltAz(seg.b[0], seg.b[1], date, observer);
        const base = i * 6;
        if (a.alt < -8 || b.alt < -8) {
          lp[base] = 0;
          lp[base + 1] = -SKY_R * 2;
          lp[base + 2] = 0;
          lp[base + 3] = 0;
          lp[base + 4] = -SKY_R * 2;
          lp[base + 5] = 0;
        } else {
          altAzToVec3(a.alt, a.az, tmp).multiplyScalar(SKY_R * 0.98);
          lp[base] = tmp.x;
          lp[base + 1] = tmp.y;
          lp[base + 2] = tmp.z;
          altAzToVec3(b.alt, b.az, tmp).multiplyScalar(SKY_R * 0.98);
          lp[base + 3] = tmp.x;
          lp[base + 4] = tmp.y;
          lp[base + 5] = tmp.z;
        }
      }
      lineObj.geometry.attributes.position.needsUpdate = true;
    }
  }

  function ensurePlanetMesh(id) {
    let mesh = planetGroup.getObjectByName('planet-' + id);
    if (mesh) return mesh;
    const geo = new THREE.SphereGeometry(1, 24, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: PLANET_COLORS[id] || 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'planet-' + id;
    mesh.userData.skyType = 'planet';
    mesh.userData.skyId = id;
    planetGroup.add(mesh);

    if (id === 'saturn') {
      const ringGeo = new THREE.RingGeometry(1.4, 2.2, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xe8d8b0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.6;
      mesh.add(ring);
    }

    if (textureLoader && PLANET_TEX[id] && !planetTextures[id]) {
      textureLoader.load(
        PLANET_TEX[id],
        (tex) => {
          planetTextures[id] = tex;
          tex.colorSpace = THREE.SRGBColorSpace;
          mesh.material.map = tex;
          mesh.material.color.set(0xffffff);
          mesh.material.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    }
    return mesh;
  }

  function updatePlanets(bodies, selection) {
    pickables = [];
    const seen = Object.create(null);
    (bodies || []).forEach((p) => {
      if (p.alt < -1) return;
      const mesh = ensurePlanetMesh(p.id);
      seen[p.id] = true;
      altAzToVec3(p.alt, p.az, tmp).multiplyScalar(SKY_R * 0.92);
      mesh.position.copy(tmp);
      const ang = p.id === 'moon' ? 2.4 : p.id === 'jupiter' || p.id === 'saturn' ? 1.6 : 1.1;
      mesh.scale.setScalar(ang);
      mesh.userData.name = p.name;
      mesh.userData.alt = p.alt;
      mesh.userData.az = p.az;
      mesh.userData.ra = p.ra;
      mesh.userData.dec = p.dec;
      mesh.visible = true;
      if (p.id === 'moon' && Number.isFinite(p.phaseFraction) && mesh.material) {
        const lit = 0.35 + 0.65 * p.phaseFraction;
        mesh.material.opacity = Math.min(1, lit);
      }
      const sel =
        selection &&
        selection.type === 'planet' &&
        String(selection.id).toLowerCase() === p.id;
      mesh.scale.multiplyScalar(sel ? 1.35 : 1);
      pickables.push(mesh);
    });
    planetGroup.children.forEach((ch) => {
      if (ch.name.startsWith('planet-') && !seen[ch.userData.skyId]) ch.visible = false;
    });
  }

  function updateMarkers(markers) {
    while (markerGroup.children.length) {
      const ch = markerGroup.children[0];
      markerGroup.remove(ch);
      ch.geometry?.dispose?.();
      ch.material?.dispose?.();
    }
    (markers || []).forEach((m) => {
      if (!Number.isFinite(m.alt) || !Number.isFinite(m.az) || m.alt < 0) return;
      const geo = new THREE.RingGeometry(1.2, 1.8, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: m.color || 0xffd280,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      altAzToVec3(m.alt, m.az, tmp).multiplyScalar(SKY_R * 0.9);
      ring.position.copy(tmp);
      ring.lookAt(0, 0, 0);
      ring.userData.skyType = m.type || 'catalog';
      ring.userData.skyId = m.id;
      ring.userData.name = m.name;
      ring.userData.alt = m.alt;
      ring.userData.az = m.az;
      ring.userData.ra = m.ra;
      ring.userData.dec = m.dec;
      markerGroup.add(ring);
      pickables.push(ring);
    });
  }

  function updateIss(pos) {
    if (!issMesh) {
      const geo = new THREE.SphereGeometry(0.7, 12, 10);
      const mat = new THREE.MeshBasicMaterial({ color: 0x7cffb2 });
      issMesh = new THREE.Mesh(geo, mat);
      issMesh.name = 'iss';
      issMesh.userData.skyType = 'iss';
      issMesh.userData.skyId = 'iss';
      issMesh.userData.name = 'ISS';
      scene.add(issMesh);
    }
    if (!pos || !Number.isFinite(pos.alt) || pos.alt < 0) {
      issMesh.visible = false;
      return;
    }
    altAzToVec3(pos.alt, pos.az, tmp).multiplyScalar(SKY_R * 0.88);
    issMesh.position.copy(tmp);
    issMesh.visible = true;
    issMesh.userData.alt = pos.alt;
    issMesh.userData.az = pos.az;
    pickables.push(issMesh);
  }

  function updateAtmosphere(sunAlt) {
    twilightSkyColor(sunAlt, skyColor);
    if (atmos && atmos.material) {
      atmos.material.color.copy(skyColor);
      // Keep atmosphere subtle — never a solid wash that hides stars
      atmos.material.opacity = sunAlt > 0 ? 0.35 : sunAlt > -6 ? 0.4 : 0.5;
    }
    if (renderer) renderer.setClearColor(skyColor, 1);
    if (starPoints && starPoints.material) {
      // Stars stay bright in projector mode even during local daylight
      const op = sunAlt > 0 ? 0.75 : sunAlt > -6 ? 0.85 : 1;
      starPoints.material.opacity = op;
      const bright = starPoints.userData && starPoints.userData.brightPoints;
      if (bright && bright.material) bright.material.opacity = op;
    }
    if (milkyWay && milkyWay.material && milkyWay.material.uniforms) {
      milkyWay.material.uniforms.uOpacity.value = sunAlt > 0 ? 0.08 : sunAlt > -6 ? 0.12 : 0.22;
    }
  }

  function tick() {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    applyCamera();
    renderer.render(scene, camera);
  }

  function pickRay(clientX, clientY, raycaster) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x, y }, camera);
    return true;
  }

  function pick(clientX, clientY) {
    if (!renderer || !camera) return null;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 1.8 };
    if (!pickRay(clientX, clientY, raycaster)) return null;

    const hits = raycaster.intersectObjects(pickables, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.skyType && obj.parent) obj = obj.parent;
      if (obj && obj.userData.skyType) {
        return {
          type: obj.userData.skyType,
          id: obj.userData.skyId,
          name: obj.userData.name || obj.userData.skyId,
          alt: obj.userData.alt,
          az: obj.userData.az,
          ra: obj.userData.ra,
          dec: obj.userData.dec,
        };
      }
    }

    if (starPoints && engine && lastSnap) {
      const starHits = raycaster.intersectObject(starPoints);
      if (starHits.length) {
        const idx = starHits[0].index;
        const s = starsCatalog[idx];
        if (s) {
          const aa = engine.equatorialToAltAz(s.ra, s.dec, lastSnap.date, lastSnap.observer);
          return {
            type: 'star',
            id: s.n || 'HIP' + s.hip,
            name: s.n || 'HIP ' + s.hip,
            alt: aa.alt,
            az: aa.az,
            ra: s.ra,
            dec: s.dec,
          };
        }
      }
    }
    return null;
  }

  function onPointerDown(e) {
    if (pinching) return;
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging || pinching) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    const sens = (domeMode ? fov / 140 : fov / 70);
    cameraAz = ((cameraAz - dx * 0.18 * sens) % 360 + 360) % 360;
    cameraAlt = clampAlt(cameraAlt + dy * 0.15 * sens);
    notifyView();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    if (!moved) {
      const hit = pick(e.clientX, e.clientY);
      if (hit && typeof onSelect === 'function') onSelect(hit);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const step = domeMode ? 5 : 4;
    fov = clampFov(fov + (e.deltaY > 0 ? step : -step));
    notifyView();
  }

  function touchDistance(touches) {
    if (!touches || touches.length < 2) return 0;
    const a = touches[0];
    const b = touches[1];
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(e) {
    if (e.touches.length >= 2) {
      pinching = true;
      dragging = false;
      pinchDist = touchDistance(e.touches);
      e.preventDefault();
    }
  }

  function onTouchMove(e) {
    if (!pinching || e.touches.length < 2) return;
    e.preventDefault();
    const dist = touchDistance(e.touches);
    if (!pinchDist) {
      pinchDist = dist;
      return;
    }
    const delta = dist - pinchDist;
    if (Math.abs(delta) > 2) {
      const step = domeMode ? 0.08 : 0.07;
      fov = clampFov(fov - delta * step);
      pinchDist = dist;
      notifyView();
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      pinching = false;
      pinchDist = 0;
    }
  }

  async function loadCatalogs() {
    const [starsRes, linesRes] = await Promise.all([
      fetch('/data/planetarium/bright-stars.json', { cache: 'force-cache' }),
      fetch('/data/planetarium/constellation-lines.json', { cache: 'force-cache' }),
    ]);
    const starsJson = await starsRes.json();
    const linesJson = await linesRes.json();
    buildStars(starsJson.stars || []);
    buildConstellationLines(linesJson);
    return {
      constellationLabels: (linesJson.constellations || []).map((c) => c.name),
    };
  }

  async function mount(opts) {
    opts = opts || {};
    canvas = typeof opts.canvas === 'string' ? document.getElementById(opts.canvas) : opts.canvas;
    if (!canvas || typeof canvas.getContext !== 'function') {
      ok = false;
      return { ok: false };
    }
    engine = opts.engine || rootEngine();
    onSelect = opts.onSelect || null;
    onViewChange = opts.onViewChange || null;
    reducedMotion =
      !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (_) {
      ok = false;
      return { ok: false };
    }
    if (!renderer || !renderer.getContext()) {
      ok = false;
      return { ok: false };
    }

    renderer.setClearColor(0x070c18, 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.5, 400);
    camera.position.set(0, 0, 0);
    textureLoader = new THREE.TextureLoader();

    const atmosGeo = new THREE.SphereGeometry(SKY_R * 1.05, 32, 16);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x0a1020,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    atmos = new THREE.Mesh(atmosGeo, atmosMat);
    atmos.renderOrder = 0;
    scene.add(atmos);

    const mwGeo = new THREE.SphereGeometry(SKY_R * 1.02, 48, 24);
    const mwMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uOpacity: { value: 0.22 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vDir;
        void main() {
          float band = exp(-pow(vDir.y * 2.2 + 0.15, 2.0)) * 0.55;
          float dust = fract(sin(dot(vDir.xz, vec2(12.9898, 78.233))) * 43758.5453);
          float a = band * (0.35 + dust * 0.4) * uOpacity;
          gl_FragColor = vec4(0.55, 0.6, 0.85, a);
        }
      `,
    });
    milkyWay = new THREE.Mesh(mwGeo, mwMat);
    scene.add(milkyWay);

    // Horizon ring
    const ringPts = [];
    for (let i = 0; i <= 64; i += 1) {
      const az = (i / 64) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.sin(az) * SKY_R * 0.97, 0.05, -Math.cos(az) * SKY_R * 0.97));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringMat = new THREE.LineBasicMaterial({ color: 0x6a7a98, transparent: true, opacity: 0.55 });
    scene.add(new THREE.Line(ringGeo, ringMat));

    const groundGeo = new THREE.SphereGeometry(SKY_R * 0.99, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x07090f,
      side: THREE.BackSide,
      depthWrite: false,
    });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.renderOrder = 1;
    scene.add(ground);

    planetGroup = new THREE.Group();
    scene.add(planetGroup);
    markerGroup = new THREE.Group();
    scene.add(markerGroup);

    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('resize', resize);
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => resize());
      ro.observe(canvas.closest('.plan-stage') || canvas.parentElement || canvas);
      canvas._planRo = ro;
    }

    const meta = await loadCatalogs().catch(() => ({ constellationLabels: [] }));
    ok = true;
    dead = false;
    lastW = 0;
    lastH = 0;
    resize();
    applyCamera();
    if (engine && typeof engine.skySnapshot === 'function') {
      try {
        render(engine.skySnapshot({ date: new Date(), observer: engine.DEFAULT_OBSERVER }));
      } catch (_) {
        /* first paint from Planetarium.refresh */
      }
    }
    requestAnimationFrame(() => {
      lastW = 0;
      lastH = 0;
      resize();
    });
    tick();
    canvas.setAttribute('aria-hidden', 'false');
    return { ok: true, constellationLabels: meta.constellationLabels || [] };
  }

  function rootEngine() {
    return typeof globalThis !== 'undefined' ? globalThis.CelestialEngine : null;
  }

  function render(snap, extras) {
    if (!ok || !snap) return;
    lastSnap = snap;
    extras = extras || {};
    updateEquatorialLayer(snap.date, snap.observer);
    updatePlanets(snap.allBodies || snap.planets || [], snap.selection);
    updateMarkers(extras.markers || []);
    updateIss(extras.iss || null);
    updateAtmosphere(snap.sunAlt);
    if (milkyWay && milkyWay.material && milkyWay.material.uniforms) {
      milkyWay.material.uniforms.uOpacity.value = snap.sunAlt > -6 ? 0.05 : reducedMotion ? 0.18 : 0.22;
    }
    if (lineObj) lineObj.visible = showLines;
    markCubeDirty();
  }

  function setView(az, alt, animate) {
    const targetAz = ((Number(az) % 360) + 360) % 360;
    const targetAlt = Number.isFinite(Number(alt)) ? clampAlt(Number(alt)) : cameraAlt;
    if (!animate || reducedMotion || typeof window.gsap === 'undefined') {
      cameraAz = targetAz;
      cameraAlt = targetAlt;
      notifyView();
      return;
    }
    const state = { az: cameraAz, alt: cameraAlt };
    window.gsap.to(state, {
      az: targetAz,
      alt: targetAlt,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        cameraAz = ((state.az % 360) + 360) % 360;
        cameraAlt = state.alt;
        notifyView();
      },
    });
  }

  function setFov(next) {
    fov = clampFov(Number(next) || fov);
    notifyView();
  }

  function setDomeMode(on, opts) {
    const next = !!on;
    const options = opts || {};
    domeMode = next;
    if (next) {
      if (options.reset !== false) {
        cameraAlt = DOME_ALT;
        fov = DOME_FOV;
      } else {
        cameraAlt = clampAlt(cameraAlt);
        fov = clampFov(fov);
      }
    } else {
      cameraAlt = Number.isFinite(options.alt) ? options.alt : HORIZON_ALT;
      fov = HORIZON_FOV;
    }
    markCubeDirty();
    notifyView();
  }

  function lookUp(opts) {
    const options = opts || {};
    domeMode = true;
    const targetAz = Number.isFinite(options.az) ? ((options.az % 360) + 360) % 360 : cameraAz;
    const animate = options.animate !== false && !reducedMotion && typeof window.gsap !== 'undefined';
    if (!animate) {
      cameraAz = targetAz;
      cameraAlt = DOME_ALT;
      fov = DOME_FOV;
      notifyView();
      return;
    }
    const state = { az: cameraAz, alt: cameraAlt, fov };
    window.gsap.to(state, {
      az: targetAz,
      alt: DOME_ALT,
      fov: DOME_FOV,
      duration: options.intro ? 1.35 : 0.7,
      ease: 'power2.inOut',
      onUpdate: () => {
        cameraAz = ((state.az % 360) + 360) % 360;
        cameraAlt = state.alt;
        fov = state.fov;
        notifyView();
      },
    });
  }

  function setConstellationLines(on) {
    showLines = !!on;
    if (lineObj) lineObj.visible = showLines;
  }

  function getView() {
    return { az: cameraAz, alt: cameraAlt, fov, showLines, domeMode };
  }

  function dispose() {
    dead = true;
    ok = false;
    cancelAnimationFrame(raf);
    if (canvas) {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    }
    window.removeEventListener('resize', resize);
    if (canvas && canvas._planRo) {
      canvas._planRo.disconnect();
      canvas._planRo = null;
    }
    if (cubeRT) {
      cubeRT.dispose();
      cubeRT = null;
    }
    cubeCam = null;
    if (fisheyeMat) {
      fisheyeMat.dispose();
      fisheyeMat = null;
    }
    fisheyeScene = null;
    fisheyeCamera = null;
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
  }

  return {
    get ok() {
      return ok;
    },
    get ready() {
      return !!(ok && ready);
    },
    mount,
    render,
    setView,
    setFov,
    setDomeMode,
    lookUp,
    forceResize,
    setConstellationLines,
    getView,
    dispose,
    MIN_FOV,
    MAX_FOV,
    DOME_ALT,
    DOME_FOV,
    HORIZON_ALT,
  };
}

const PlanetariumGL = createApi();

if (typeof globalThis !== 'undefined') {
  globalThis.PlanetariumGL = PlanetariumGL;
}

export default PlanetariumGL;
