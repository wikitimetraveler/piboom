/**
 * WebGPU NASA Blue Marble globe — compute raymarch samples day + night
 * textures, paints FIRMS fire points, blits to a dedicated canvas.
 * Three.js crystal orb stays on #heroCanvas; this mounts on #heroNasaCanvas.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const MAX_FIRMS = 200;
  const TEX_DAY = '/shared/textures/earth/blue-marble.jpg';
  const TEX_NIGHT = '/shared/textures/earth/earth-lights.jpg';
  const TEX_MOON = '/shared/textures/moon/moon-color.jpg';

  /** Shared art-direction sun — light from stage-left (+ slight up). */
  const DEFAULT_SUN_DIR = { x: 0.85, y: 0.28, z: 0.42 };

  const EARTH_RADIUS_KM = 6371;

  /**
   * Compressed family-portrait scale (not true AU / linear radius).
   * visualScale = clamp((R / R_earth)^0.32, 0.42, 2.15)
   */
  function visualScale(radiusKm) {
    const r = Number(radiusKm);
    if (!Number.isFinite(r) || r <= 0) return 1;
    const s = Math.pow(r / EARTH_RADIUS_KM, 0.32);
    return Math.min(2.15, Math.max(0.42, s));
  }

  const BODIES = {
    mercury: {
      id: 'mercury',
      label: 'Mercury',
      credit: 'NASA / JPL · Mariner 10',
      day: '/shared/textures/planets/mercury.jpg',
      bodyType: 2,
      canvasId: 'heroMercuryCanvas',
      paneId: 'heroMercuryPane',
      radiusKm: 2440,
      tiltDeg: 0.03,
      spinRate: 0.06,
      rings: null,
    },
    venus: {
      id: 'venus',
      label: 'Venus',
      credit: 'NASA / JPL · Magellan',
      day: '/shared/textures/planets/venus.jpg',
      bodyType: 3,
      canvasId: 'heroVenusCanvas',
      paneId: 'heroVenusPane',
      radiusKm: 6052,
      tiltDeg: 177.4,
      spinRate: -0.04,
      rings: null,
    },
    earth: {
      id: 'earth',
      label: 'Earth',
      credit: 'NASA Visible Earth · Blue Marble',
      day: TEX_DAY,
      night: TEX_NIGHT,
      bodyType: 0,
      canvasId: 'heroNasaCanvas',
      paneId: 'heroNasaPane',
      radiusKm: 6371,
      tiltDeg: 23.4,
      spinRate: 0.18,
      rings: null,
    },
    moon: {
      id: 'moon',
      label: 'Moon',
      credit: 'Lane crater · Jonathan Homer Lane',
      day: TEX_MOON,
      night: TEX_MOON,
      bodyType: 1,
      canvasId: 'heroMoonCanvas',
      paneId: 'heroMoonPane',
      href: '/family/lane-museum.html?lunar=1',
      radiusKm: 1737,
      tiltDeg: 6.7,
      spinRate: 0.05,
      rings: null,
    },
    mars: {
      id: 'mars',
      label: 'Mars',
      credit: 'NASA / JPL · Viking',
      day: '/shared/textures/planets/mars.jpg',
      bodyType: 4,
      canvasId: 'heroMarsCanvas',
      paneId: 'heroMarsPane',
      radiusKm: 3390,
      tiltDeg: 25.2,
      spinRate: 0.17,
      rings: null,
    },
    jupiter: {
      id: 'jupiter',
      label: 'Jupiter',
      credit: 'NASA / JPL · Voyager',
      day: '/shared/textures/planets/jupiter.jpg',
      bodyType: 5,
      canvasId: 'heroJupiterCanvas',
      paneId: 'heroJupiterPane',
      radiusKm: 69911,
      tiltDeg: 3.1,
      spinRate: 0.42,
      rings: null,
    },
    saturn: {
      id: 'saturn',
      label: 'Saturn',
      credit: 'NASA / JPL · Voyager',
      day: '/shared/textures/planets/saturn.jpg',
      bodyType: 6,
      canvasId: 'heroSaturnCanvas',
      paneId: 'heroSaturnPane',
      radiusKm: 58232,
      tiltDeg: 26.7,
      spinRate: 0.38,
      rings: { inner: 1.11, outer: 2.27, alpha: 0.88, cassini: 1.95 },
    },
    uranus: {
      id: 'uranus',
      label: 'Uranus',
      credit: 'NASA / JPL · Voyager',
      day: '/shared/textures/planets/uranus.jpg',
      bodyType: 7,
      canvasId: 'heroUranusCanvas',
      paneId: 'heroUranusPane',
      radiusKm: 25362,
      tiltDeg: 97.8,
      spinRate: -0.22,
      rings: { inner: 1.55, outer: 2.05, alpha: 0.2, cassini: 0 },
    },
    neptune: {
      id: 'neptune',
      label: 'Neptune',
      credit: 'NASA / JPL · Voyager',
      day: '/shared/textures/planets/neptune.jpg',
      bodyType: 8,
      canvasId: 'heroNeptuneCanvas',
      paneId: 'heroNeptunePane',
      radiusKm: 24622,
      tiltDeg: 28.3,
      spinRate: 0.28,
      rings: { inner: 1.6, outer: 2.15, alpha: 0.09, cassini: 0 },
    },
    pluto: {
      id: 'pluto',
      label: 'Pluto',
      credit: 'NASA / JPL · Pluto',
      day: '/shared/textures/planets/pluto.jpg',
      bodyType: 9,
      canvasId: 'heroPlutoCanvas',
      paneId: 'heroPlutoPane',
      radiusKm: 1188,
      tiltDeg: 119.6,
      spinRate: -0.08,
      rings: null,
    },
  };

  const HERO_BODIES = [
    'mercury',
    'venus',
    'earth',
    'moon',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ];

  function resolveBody(id) {
    return BODIES[id] || BODIES.earth;
  }

  /** Lunar far-side crater named for Jonathan Homer Lane (IAU 1970). */
  const LANE_CRATER = {
    name: 'Lane',
    lat: -9.5,
    lon: 132.36,
    diameterKm: 53.76,
    href: '/family/lane-museum.html?lunar=1',
  };

  const LAVA_SEEDS = [
    { lat: 19.4, lon: -155.3, weight: 2.6 },
    { lat: 64.65, lon: -17.5, weight: 2.1 },
    { lat: 37.75, lon: 15.0, weight: 1.9 },
    { lat: 1.52, lon: 29.25, weight: 1.8 },
    { lat: -7.54, lon: 110.44, weight: 1.7 },
    { lat: 55.42, lon: 160.47, weight: 1.6 },
  ];

  const COMPUTE_WGSL = `
struct Uniforms {
  time: f32,
  night: f32,
  width: f32,
  height: f32,
  lookX: f32,
  lookY: f32,
  reduced: f32,
  hasTex: f32,
  fireCount: f32,
  bodyType: f32,
  zoom: f32,
  pinOn: f32,
  pinLat: f32,
  pinLon: f32,
  sunX: f32,
  sunY: f32,
  sunZ: f32,
  tilt: f32,
  spinRate: f32,
  ringInner: f32,
  ringOuter: f32,
  ringAlpha: f32,
  cassini: f32,
  camPull: f32,
  _p0: f32,
  _p1: f32,
  _p2: f32,
  _p3: f32,
  _p4: f32,
  _p5: f32,
  _p6: f32,
  _p7: f32,
};

struct Fire {
  lat: f32,
  lon: f32,
  weight: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var dayTex: texture_2d<f32>;
@group(0) @binding(2) var nightTex: texture_2d<f32>;
@group(0) @binding(3) var earthSamp: sampler;
@group(0) @binding(4) var<storage, read> fires: array<Fire>;
@group(0) @binding(5) var outTex: texture_storage_2d<rgba8unorm, write>;

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(234.34, 435.345));
  q = q + dot(q, q + 34.23);
  return fract(q.x * q.y);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var v = 0.0;
  var a = 0.5;
  for (var i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07;
    a = a * 0.5;
  }
  return v;
}

fn rotY(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

fn rotX(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

fn hitSphere(ro: vec3f, rd: vec3f, r: f32) -> f32 {
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let h = b * b - c;
  if (h < 0.0) { return -1.0; }
  return -b - sqrt(h);
}

fn lonLatFromNormal(n: vec3f) -> vec2f {
  let lon = atan2(n.z, n.x);
  let lat = asin(clamp(n.y, -1.0, 1.0));
  return vec2f(lon, lat);
}

fn equirectUv(lonLat: vec2f) -> vec2f {
  let u = fract(lonLat.x / (2.0 * 3.14159265) + 0.5);
  let v = 0.5 + lonLat.y / 3.14159265;
  return vec2f(u, clamp(v, 0.0, 1.0));
}

fn toBody(p: vec3f, spin: f32, tilt: f32) -> vec3f {
  return rotY(rotX(p, -tilt), spin);
}

fn proceduralAlbedo(lonLat: vec2f, dark: f32) -> vec3f {
  let sph = lonLat * vec2f(1.7, 2.3);
  let landN = fbm(sph + vec2f(1.7, 0.4));
  let land = smoothstep(0.46, 0.58, landN);
  let coast = smoothstep(0.42, 0.52, landN) * (1.0 - land);
  let oceanZen = vec3f(0.22, 0.52, 0.62);
  let oceanDark = vec3f(0.05, 0.16, 0.26);
  let landZen = vec3f(0.55, 0.72, 0.62);
  let landDark = vec3f(0.18, 0.38, 0.42);
  var albedo = mix(mix(oceanZen, oceanDark, dark), mix(landZen, landDark, dark), land);
  albedo = mix(albedo, vec3f(0.78, 0.88, 0.86), coast * 0.45);
  return albedo;
}

fn proceduralPlanet(lonLat: vec2f, bodyType: f32) -> vec3f {
  let sph = lonLat * vec2f(1.8, 2.4);
  let n = fbm(sph + vec2f(bodyType, 0.3));
  let band = 0.5 + 0.5 * sin(lonLat.y * (6.0 + bodyType) + n * 2.0);
  if (bodyType < 2.5) { return vec3f(0.42, 0.4, 0.38) * (0.55 + 0.45 * n); }
  if (bodyType < 3.5) { return mix(vec3f(0.72, 0.52, 0.22), vec3f(0.55, 0.38, 0.16), n); }
  if (bodyType < 4.5) { return mix(vec3f(0.62, 0.28, 0.14), vec3f(0.82, 0.48, 0.22), n); }
  if (bodyType < 5.5) { return mix(vec3f(0.72, 0.55, 0.32), vec3f(0.42, 0.28, 0.18), band); }
  if (bodyType < 6.5) { return mix(vec3f(0.78, 0.68, 0.42), vec3f(0.48, 0.4, 0.28), band); }
  if (bodyType < 7.5) { return mix(vec3f(0.55, 0.78, 0.82), vec3f(0.28, 0.55, 0.62), n); }
  if (bodyType < 8.5) { return mix(vec3f(0.22, 0.38, 0.78), vec3f(0.12, 0.22, 0.55), band); }
  return mix(vec3f(0.72, 0.62, 0.52), vec3f(0.28, 0.24, 0.3), n);
}

fn proceduralMoon(lonLat: vec2f) -> vec3f {
  let sph = lonLat * vec2f(2.4, 3.1);
  let craters = fbm(sph + vec2f(0.4, 1.1));
  let maria = smoothstep(0.42, 0.58, fbm(sph * 0.55 + 2.0));
  let highland = vec3f(0.72, 0.71, 0.68);
  let basin = vec3f(0.28, 0.28, 0.3);
  var albedo = mix(highland, basin, maria);
  albedo = albedo * (0.55 + 0.45 * craters);
  let rim = smoothstep(0.62, 0.72, craters) * (1.0 - smoothstep(0.72, 0.82, craters));
  albedo = albedo + vec3f(0.12, 0.11, 0.1) * rim;
  return albedo;
}

fn fireGlow(lonLat: vec2f) -> f32 {
  let n = i32(u.fireCount);
  var g = 0.0;
  let latDeg = lonLat.y * (180.0 / 3.14159265);
  let lonDeg = lonLat.x * (180.0 / 3.14159265);
  for (var i = 0; i < 200; i++) {
    if (i >= n) { break; }
    let f = fires[i];
    let dLat = latDeg - f.lat;
    var dLon = lonDeg - f.lon;
    if (dLon > 180.0) { dLon = dLon - 360.0; }
    if (dLon < -180.0) { dLon = dLon + 360.0; }
    let d = length(vec2f(dLat, dLon * cos(lonLat.y)));
    let r = 1.2 + f.weight * 0.9;
    g = g + exp(-(d * d) / (r * r)) * f.weight;
  }
  return g;
}

fn shadeRing(ro: vec3f, rd: vec3f, tSphere: f32, spin: f32, tilt: f32, lightDir: vec3f) -> vec4f {
  if (u.ringOuter <= u.ringInner || u.ringAlpha <= 0.001) {
    return vec4f(0.0);
  }
  let roB = toBody(ro, spin, tilt);
  let rdB = toBody(rd, spin, tilt);
  if (abs(rdB.y) < 1e-5) { return vec4f(0.0); }
  let t = -roB.y / rdB.y;
  if (t < 0.001) { return vec4f(0.0); }
  if (tSphere > 0.0 && t > tSphere) { return vec4f(0.0); }
  let hitB = roB + rdB * t;
  let rho = length(vec2f(hitB.x, hitB.z));
  if (rho < u.ringInner || rho > u.ringOuter) { return vec4f(0.0); }
  var dens = 1.0;
  if (u.cassini > 0.5) {
    let gap = abs(rho - u.cassini);
    dens = dens * mix(0.08, 1.0, smoothstep(0.04, 0.12, gap));
  }
  let edge = smoothstep(u.ringInner, u.ringInner + 0.06, rho)
    * (1.0 - smoothstep(u.ringOuter - 0.08, u.ringOuter, rho));
  dens = dens * edge;
  let band = 0.55 + 0.45 * sin(rho * 28.0 + hitB.x * 3.0);
  var albedo = mix(vec3f(0.72, 0.66, 0.52), vec3f(0.92, 0.88, 0.78), band);
  if (u.bodyType > 6.5) {
    albedo = mix(vec3f(0.62, 0.78, 0.82), vec3f(0.78, 0.88, 0.9), band);
  }
  let nFace = select(-1.0, 1.0, rdB.y < 0.0);
  let nW = normalize(rotX(vec3f(0.0, nFace, 0.0), tilt));
  let ndl = 0.35 + 0.65 * max(dot(nW, lightDir), 0.0);
  albedo = albedo * ndl;
  let a = clamp(u.ringAlpha * dens * (0.55 + 0.45 * band), 0.0, 0.95);
  return vec4f(albedo, a);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(u.width);
  let h = u32(u.height);
  if (id.x >= w || id.y >= h) { return; }

  let uv = (vec2f(f32(id.x), f32(id.y)) + 0.5) / vec2f(u.width, u.height);
  var p = uv * 2.0 - 1.0;
  p.x = p.x * (u.width / max(u.height, 1.0));

  let isEarth = u.bodyType < 0.5;
  let isMoon = u.bodyType > 0.5 && u.bodyType < 1.5;
  let tilt = u.tilt;
  var spin = select(
    u.time * u.spinRate,
    select(0.35, 0.55, isMoon) * sign(u.spinRate + 0.0001),
    u.reduced > 0.5
  );
  var lookY = u.lookY;
  if (u.pinOn > 0.5) {
    let pinLonR = u.pinLon * (3.14159265 / 180.0);
    let pinLatR = u.pinLat * (3.14159265 / 180.0);
    spin = pinLonR - 1.5707963;
    lookY = lookY + pinLatR * 0.9;
  }
  let zoomAmt = clamp((max(u.zoom, 1.0) - 1.0) / 1.4, 0.0, 1.0);
  let pull = max(u.camPull, 0.0);
  let camZ = mix(2.65 + pull, 1.28 + pull * 0.35, zoomAmt);
  let ro = rotY(rotX(vec3f(0.0, 0.12, camZ), lookY), u.lookX);
  let ta = vec3f(0.0, 0.0, 0.0);
  let ww = normalize(ta - ro);
  let uu = normalize(cross(ww, vec3f(0.0, 1.0, 0.0)));
  let vv = cross(uu, ww);
  let rd = normalize(p.x * uu + p.y * vv + 1.85 * ww);
  let lightDir = normalize(vec3f(u.sunX, u.sunY, u.sunZ));

  let tHit = hitSphere(ro, rd, 1.0);
  var col = vec3f(0.0);
  var alpha = 0.0;
  let dark = u.night;

  if (tHit > 0.0) {
    let hit = ro + rd * tHit;
    let n = normalize(hit);
    let local = toBody(hit, spin, tilt);
    let nLocal = normalize(local);
    let lonLat = lonLatFromNormal(nLocal);
    let euv = equirectUv(lonLat);

    var albedo = select(
      select(proceduralAlbedo(lonLat, dark), proceduralMoon(lonLat), isMoon),
      proceduralPlanet(lonLat, u.bodyType),
      !isEarth && !isMoon
    );
    if (u.hasTex > 0.5) {
      let day = textureSampleLevel(dayTex, earthSamp, euv, 0.0).rgb;
      albedo = day;
      if (isEarth) {
        let lights = textureSampleLevel(nightTex, earthSamp, euv, 0.0).rgb;
        let ndl = max(dot(n, lightDir), 0.0);
        let nightSide = pow(1.0 - ndl, 1.6);
        albedo = albedo * (0.22 + 0.88 * ndl);
        albedo = albedo + lights * nightSide * (0.55 + 0.85 * dark);
      } else {
        let ndl = max(dot(n, lightDir), 0.0);
        albedo = albedo * (0.18 + 0.92 * ndl);
      }
    } else if (isMoon) {
      let ndl = max(dot(n, lightDir), 0.0);
      albedo = albedo * (0.18 + 0.92 * ndl);
    } else {
      let ndl = max(dot(n, lightDir), 0.0);
      let nightSide = pow(1.0 - ndl, 1.6);
      let city = step(0.86, hash21(floor(lonLat * vec2f(48.0, 48.0)))) * step(0.5, albedo.g);
      let neon = mix(vec3f(0.55, 0.85, 0.90), vec3f(0.92, 0.32, 0.72), dark);
      albedo = albedo * (0.22 + 0.88 * ndl);
      albedo = albedo + neon * city * nightSide * (0.55 + 0.75 * dark);
    }

    if (isEarth) {
      let fire = fireGlow(lonLat);
      let hot = mix(vec3f(1.0, 0.42, 0.06), vec3f(1.0, 0.12, 0.02), clamp(fire * 0.35, 0.0, 1.0));
      albedo = albedo + hot * fire * 0.95;
    }

    if (isMoon) {
      let dLat = lonLat.y * (180.0 / 3.14159265) - u.pinLat;
      var dLon = lonLat.x * (180.0 / 3.14159265) - u.pinLon;
      if (dLon > 180.0) { dLon = dLon - 360.0; }
      if (dLon < -180.0) { dLon = dLon + 360.0; }
      let d = length(vec2f(dLat, dLon * cos(lonLat.y)));
      let ring = exp(-(d * d) / 6.5);
      let core = exp(-(d * d) / 0.55);
      albedo = albedo + vec3f(0.98, 0.74, 0.18) * (ring * 1.15 + core * 1.35);
    }

    let fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
    let rim = select(
      mix(vec3f(0.55, 0.82, 0.88), vec3f(0.72, 0.28, 0.62), dark),
      mix(vec3f(0.7, 0.72, 0.78), vec3f(0.45, 0.48, 0.55), dark),
      isMoon
    );
    albedo = albedo + rim * fres * (0.28 + 0.2 * dark);

    col = saturate(albedo);
    alpha = 1.0;
  } else {
    let atmo = hitSphere(ro, rd, select(1.12, 1.06, isMoon));
    if (atmo > 0.0) {
      let rim = select(
        mix(vec3f(0.48, 0.78, 0.86), vec3f(0.62, 0.22, 0.55), dark),
        vec3f(0.55, 0.56, 0.6),
        isMoon
      );
      col = rim;
      alpha = select(0.16, 0.08, isMoon);
    }
  }

  let ringCol = shadeRing(ro, rd, tHit, spin, tilt, lightDir);
  if (ringCol.a > 0.001) {
    if (alpha < 0.001) {
      col = ringCol.rgb;
      alpha = ringCol.a;
    } else {
      let ra = ringCol.a;
      col = mix(col, ringCol.rgb, ra * 0.85);
      alpha = max(alpha, ra);
    }
  }

  textureStore(outTex, vec2i(i32(id.x), i32(id.y)), vec4f(col * alpha, alpha));
}
`;

  /** Lon/lat degrees → equirect UV in [0,1]. Matches blit Y-flip (North at high V). */
  function latLonToUv(latDeg, lonDeg) {
    const lat = Number(latDeg);
    const lon = Number(lonDeg);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { u: 0.5, v: 0.5 };
    const u = ((lon + 180) / 360 + 1) % 1;
    const v = 0.5 + lat / 180;
    return {
      u: u < 0 ? u + 1 : u,
      v: Math.min(1, Math.max(0, v)),
    };
  }

  /** Cap/normalize FIRMS-like rows into GPU fire structs. No network. */
  function capFirmsPoints(rows, maxCount) {
    const cap = Math.max(1, Math.min(MAX_FIRMS, Math.floor(maxCount || MAX_FIRMS)));
    const list = Array.isArray(rows) ? rows : [];
    const out = [];
    for (let i = 0; i < list.length && out.length < cap; i += 1) {
      const r = list[i] || {};
      const lat = Number(r.lat ?? r.latitude);
      const lon = Number(r.lng ?? r.lon ?? r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const raw = r.raw || {};
      const frp = Number(raw.frp ?? r.frp) || 0;
      const bright = Number(raw.brightness ?? r.brightness) || 0;
      const weight = Math.min(3, 0.35 + frp / 40 + bright / 400);
      out.push({ lat, lon, weight });
    }
    return out;
  }

  function createPlaceholderTex(device) {
    const tex = device.createTexture({
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.writeTexture(
      { texture: tex },
      new Uint8Array([40, 80, 120, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
    return tex;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('texture load failed: ' + url));
      img.src = url;
    });
  }

  function imageToTexture(device, img) {
    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    const tex = device.createTexture({
      size: { width: w, height: h },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: img },
      { texture: tex },
      { width: w, height: h }
    );
    return tex;
  }

  async function loadBodyTextures(device, bodyId) {
    const spec = resolveBody(bodyId);
    const dayUrl = spec.day;
    const nightUrl = spec.night || spec.day;
    try {
      const [dayImg, nightImg] = await Promise.all([loadImage(dayUrl), loadImage(nightUrl)]);
      return {
        day: imageToTexture(device, dayImg),
        night: imageToTexture(device, nightImg),
        hasTex: true,
        bodyType: spec.bodyType,
      };
    } catch (_) {
      return {
        day: createPlaceholderTex(device),
        night: createPlaceholderTex(device),
        hasTex: false,
        bodyType: spec.bodyType,
      };
    }
  }

  async function fetchFirmsPoints() {
    try {
      const res = await fetch('/api/disasters?source=firms&limit=200&usOnly=false');
      if (!res.ok) return [];
      const data = await res.json();
      const rows = data.disasters || data.rows || data.data || [];
      return capFirmsPoints(rows, MAX_FIRMS);
    } catch (_) {
      return [];
    }
  }

  function writeFires(device, buffer, points) {
    const floats = new Float32Array(MAX_FIRMS * 4);
    const n = Math.min(MAX_FIRMS, points.length);
    for (let i = 0; i < n; i += 1) {
      const o = i * 4;
      floats[o] = points[i].lat;
      floats[o + 1] = points[i].lon;
      floats[o + 2] = points[i].weight;
      floats[o + 3] = 0;
    }
    device.queue.writeBuffer(buffer, 0, floats);
    return n;
  }

  /** Shared clock + look so NASA WebGPU and Three.js crystal spin in the same space. */
  function ensureHeroSync() {
    if (!root.FunHomeHeroSync) {
      root.FunHomeHeroSync = {
        t0: performance.now(),
        spinRate: 0.18,
        lookX: 0,
        lookY: 0,
        targetX: 0,
        targetY: 0,
        sunDir: { ...DEFAULT_SUN_DIR },
      };
    } else if (!root.FunHomeHeroSync.sunDir) {
      root.FunHomeHeroSync.sunDir = { ...DEFAULT_SUN_DIR };
    }
    return root.FunHomeHeroSync;
  }

  async function mount(opts) {
    const Runtime = root.WebGpuRuntime;
    const canvas = opts && opts.canvas;
    if (!Runtime || !canvas) return null;

    const gpu = await Runtime.requestGpu();
    if (gpu.backend !== 'webgpu' || !gpu.device) return null;

    const ctx = canvas.getContext('webgpu');
    if (!ctx) return null;

    const device = gpu.device;
    const format = gpu.format;
    const spec = resolveBody(opts && opts.body);
    const body = spec.id;
    const rings = spec.rings || null;
    const tiltRad = ((Number(spec.tiltDeg) || 0) * Math.PI) / 180;
    const bodySpin = Number.isFinite(spec.spinRate) ? spec.spinRate : 0.11;
    const camPull = rings ? Math.max(0.9, (rings.outer - 1) * 1.35) : 0;
    let destroyed = false;
    let raf = 0;
    let inView = true;
    let tex = null;
    let texW = 0;
    let texH = 0;
    let lookX = 0;
    let lookY = 0;
    let fireCount = 0;
    let zoom = 1;
    let targetZoom = 1;
    let pinOn = 0;
    let pinLat = body === 'moon' ? LANE_CRATER.lat : 0;
    let pinLon = body === 'moon' ? LANE_CRATER.lon : 0;
    const sync = ensureHeroSync();
    const localLook = { lookX: 0, lookY: 0, targetX: 0, targetY: 0 };

    const uniformData = new Float32Array(32);
    const uniformBuf = device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const fireBuf = device.createBuffer({
      size: MAX_FIRMS * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    let computePipe;
    let blit;
    try {
      computePipe = Runtime.createComputePipeline(device, COMPUTE_WGSL, 'main');
      blit = Runtime.createBlitPipeline(device, format);
    } catch (_) {
      return null;
    }

    const earth = await loadBodyTextures(device, body);
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    if (body === 'earth') {
      const firms = await fetchFirmsPoints();
      fireCount = writeFires(device, fireBuf, firms.concat(LAVA_SEEDS));
    } else if (body === 'moon') {
      fireCount = writeFires(device, fireBuf, [
        { lat: LANE_CRATER.lat, lon: LANE_CRATER.lon, weight: 2.8 },
      ]);
    } else {
      fireCount = 0;
    }
    const firmsTimer =
      body === 'earth' && typeof setInterval === 'function'
        ? setInterval(() => {
            fetchFirmsPoints().then((pts) => {
              if (!destroyed) fireCount = writeFires(device, fireBuf, pts.concat(LAVA_SEEDS));
            });
          }, 120000)
        : null;

    const stage = canvas.parentElement || canvas;
    const hero = canvas.closest('.fun-hero') || stage;

    function nightValue() {
      if (opts && typeof opts.getNight === 'function') return opts.getNight() ? 1 : 0;
      if (typeof document === 'undefined') return 0;
      return document.body.getAttribute('data-theme') === 'dark' ? 1 : 0;
    }

    function sizeCanvas() {
      const dpr = Runtime.pixelRatio(
        typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches
          ? 1.5
          : 2
      );
      const pane = canvas.parentElement || stage;
      const cw = Math.max(1, pane.clientWidth || canvas.clientWidth || 420);
      const ch = Math.max(1, pane.clientHeight || canvas.clientHeight || cw);
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      try {
        ctx.configure({ device, format, alphaMode: 'premultiplied' });
      } catch (_) {
        return false;
      }
      if (!tex || texW !== canvas.width || texH !== canvas.height) {
        if (tex) tex.destroy();
        tex = Runtime.createStorageTexture(device, canvas.width, canvas.height);
        texW = canvas.width;
        texH = canvas.height;
      }
      return true;
    }

    if (!sizeCanvas()) {
      if (earth.day) earth.day.destroy();
      if (earth.night) earth.night.destroy();
      return null;
    }

    function frame() {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      if (Runtime.shouldPause() || !inView) return;
      const reduced = Runtime.prefersReducedMotion() || (opts && opts.prefersReducedMotion);
      zoom += (targetZoom - zoom) * 0.08;
      if (pinOn) {
        localLook.lookX += (localLook.targetX - localLook.lookX) * 0.06;
        localLook.lookY += (localLook.targetY - localLook.lookY) * 0.06;
        lookX = localLook.lookX;
        lookY = localLook.lookY;
      } else {
        sync.lookX += (sync.targetX - sync.lookX) * 0.06;
        sync.lookY += (sync.targetY - sync.lookY) * 0.06;
        lookX = sync.lookX;
        lookY = sync.lookY;
      }
      const t = reduced ? 0 : (performance.now() - sync.t0) / 1000;
      const sun = sync.sunDir || DEFAULT_SUN_DIR;
      uniformData[0] = t;
      uniformData[1] = nightValue();
      uniformData[2] = texW;
      uniformData[3] = texH;
      uniformData[4] = lookX;
      uniformData[5] = lookY;
      uniformData[6] = reduced ? 1 : 0;
      uniformData[7] = earth.hasTex ? 1 : 0;
      uniformData[8] = fireCount;
      uniformData[9] = earth.bodyType || 0;
      uniformData[10] = zoom;
      uniformData[11] = pinOn;
      uniformData[12] = pinLat;
      uniformData[13] = pinLon;
      uniformData[14] = sun.x;
      uniformData[15] = sun.y;
      uniformData[16] = sun.z;
      uniformData[17] = tiltRad;
      uniformData[18] = bodySpin;
      uniformData[19] = rings ? rings.inner : 0;
      uniformData[20] = rings ? rings.outer : 0;
      uniformData[21] = rings ? rings.alpha : 0;
      uniformData[22] = rings && rings.cassini ? rings.cassini : 0;
      uniformData[23] = camPull;
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const computeBg = device.createBindGroup({
        layout: computePipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: earth.day.createView() },
          { binding: 2, resource: earth.night.createView() },
          { binding: 3, resource: sampler },
          { binding: 4, resource: { buffer: fireBuf } },
          { binding: 5, resource: tex.createView() },
        ],
      });
      const blitBg = device.createBindGroup({
        layout: blit.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: tex.createView() },
          { binding: 1, resource: blit.sampler },
        ],
      });

      const encoder = device.createCommandEncoder();
      const cpass = encoder.beginComputePass();
      cpass.setPipeline(computePipe);
      cpass.setBindGroup(0, computeBg);
      Runtime.dispatch2d(cpass, texW, texH, 8, 8);
      cpass.end();

      const view = ctx.getCurrentTexture().createView();
      const rpass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      rpass.setPipeline(blit.pipeline);
      rpass.setBindGroup(0, blitBg);
      rpass.draw(3);
      rpass.end();
      device.queue.submit([encoder.finish()]);
    }

    const offVis = Runtime.onVisibility(function () {});
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(
        (entries) => {
          inView = entries.some((en) => en.isIntersecting);
        },
        { threshold: 0.05 }
      );
      io.observe(stage);
    }

    const onPointer = (e) => {
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 0.35;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 0.22;
      sync.targetX = nx;
      sync.targetY = ny;
      localLook.targetX = nx * 0.45;
      localLook.targetY = ny * 0.45;
    };
    hero.addEventListener('pointermove', onPointer);

    const onResize = () => {
      sizeCanvas();
    };
    window.addEventListener('resize', onResize);

    function dispose() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      offVis();
      if (io) io.disconnect();
      if (firmsTimer) clearInterval(firmsTimer);
      hero.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      if (tex) tex.destroy();
      if (earth.day) earth.day.destroy();
      if (earth.night) earth.night.destroy();
      uniformBuf.destroy();
      fireBuf.destroy();
      document.body.classList.remove('fun-home--webgpu');
    }

    window.addEventListener('pagehide', dispose, { once: true });
    document.body.classList.add('fun-home--webgpu');
    raf = requestAnimationFrame(frame);

    return {
      dispose,
      resize: sizeCanvas,
      hasTex: earth.hasTex,
      setNight: () => {},
      lookAt(lat, lon, nextZoom) {
        pinLat = Number(lat);
        pinLon = Number(lon);
        pinOn = 1;
        targetZoom = Math.max(1, Number(nextZoom) || 2.2);
      },
      clearLook() {
        pinOn = 0;
        targetZoom = 1;
      },
    };
  }

  root.WebGpuGlobe = {
    mount,
    latLonToUv,
    capFirmsPoints,
    ensureHeroSync,
    resolveBody,
    visualScale,
    BODIES,
    HERO_BODIES,
    LANE_CRATER,
    LAVA_SEEDS,
    DEFAULT_SUN_DIR,
    EARTH_RADIUS_KM,
    MAX_FIRMS,
    TEX_DAY,
    TEX_NIGHT,
    TEX_MOON,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
