#version 300 es
precision highp float;

uniform float uTime;
uniform float uNight;
uniform vec2 uResolution;
uniform vec2 uFocal;

in vec2 vUv;
out vec4 fragColor;

#define MAX_STEPS 72
#define MAX_DIST 48.0
#define SURF_EPS 0.0012

// ── Hash / noise ──────────────────────────────────────────────
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

// ── Ocean surface height (moving sine stack + noise) ──────────
float waveHeight(vec2 xz) {
  float t = uTime;
  vec2 p = xz;
  float h = 0.0;
  h += sin(p.x * 0.72 + t * 1.05) * 0.18;
  h += sin(p.y * 0.58 + t * 0.88) * 0.14;
  h += sin(dot(p, vec2(0.81, 0.61)) * 1.15 + t * 1.2) * 0.1;
  h += sin(p.x * 1.4 - p.y * 0.9 + t * 0.65) * 0.06;
  h += (fbm(p * 0.55 + t * 0.08) - 0.5) * 0.12;
  return h;
}

vec3 waveNormal(vec2 xz) {
  float e = 0.04;
  float h = waveHeight(xz);
  float hx = waveHeight(xz + vec2(e, 0.0));
  float hz = waveHeight(xz + vec2(0.0, e));
  return normalize(vec3(h - hx, e * 2.0, h - hz));
}

// ── Ice floe SDF (rounded box on wave surface) ────────────────
float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float iceFloe(vec3 p, vec2 center, float scale, float angle, float phase) {
  float wh = waveHeight(center);
  vec3 q = p - vec3(center.x, wh + 0.04, center.y);
  q.xz = rot2(angle + uTime * 0.04 + phase) * q.xz;
  q.y += sin(uTime * 0.5 + phase) * 0.02;
  float d = sdRoundBox(q, vec3(scale * 0.9, 0.06, scale * 0.55), scale * 0.12);
  return d;
}

float iceScene(vec3 p) {
  float d = 1e5;
  d = min(d, iceFloe(p, vec2(-2.2, -4.5), 0.55, 0.3, 0.0));
  d = min(d, iceFloe(p, vec2(1.8, -6.2), 0.7, -0.5, 1.2));
  d = min(d, iceFloe(p, vec2(-0.4, -8.5), 0.45, 1.1, 2.4));
  d = min(d, iceFloe(p, vec2(3.1, -5.0), 0.5, 0.8, 3.6));
  d = min(d, iceFloe(p, vec2(-3.5, -7.8), 0.38, -1.2, 4.8));
  d = min(d, iceFloe(p, vec2(0.9, -10.5), 0.62, 0.2, 5.5));
  return d;
}

// Water: distance to y = waveHeight(xz)
float waterDist(vec3 p) {
  return p.y - waveHeight(p.xz);
}

float mapScene(vec3 p) {
  float w = waterDist(p);
  float ice = iceScene(p);
  return min(w, ice);
}

// Material id: 0 sky, 1 water, 2 ice
vec2 mapSceneMat(vec3 p, vec3 rd) {
  float w = waterDist(p);
  if (rd.y > 0.05) {
    return vec2(w, 1.0);
  }
  float ice = iceScene(p);
  if (ice < w) return vec2(ice, 2.0);
  return vec2(w, 1.0);
}

// ── Raymarch ─────────────────────────────────────────────────
vec2 raymarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  float mat = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 hit = mapSceneMat(p, rd);
    if (hit.x < SURF_EPS) {
      mat = hit.y;
      break;
    }
    t += hit.x * 0.72;
    if (t > MAX_DIST) break;
  }
  return vec2(t, mat);
}

// Blinking star field — dense layers, full dome + horizon band
float skyStars(vec3 rd) {
  if (rd.y <= 0.005) return 0.0;

  float lon = atan(rd.z, rd.x);
  float lat = asin(clamp(rd.y, 0.0, 1.0));
  vec2 dome = floor(vec2(lon, lat) * vec2(72.0, 52.0));
  float s0 = step(0.978, hash21(dome));
  vec2 dome2 = floor(vec2(lon, lat) * vec2(48.0, 36.0) + 11.7);
  float s1 = step(0.972, hash21(dome2));

  vec2 band = floor(rd.xz / (rd.y + 0.35) * 130.0);
  float s2 = step(0.982, hash21(band));
  vec2 band2 = floor(rd.xz / (rd.y + 0.1) * 88.0);
  float s3 = step(0.976, hash21(band2 + 5.3));

  float star = max(max(s0, s1 * 0.85), max(s2, s3 * 0.75));
  float twinkle = 0.55 + 0.45 * sin(uTime * 2.1 + hash21(dome) * 28.0);
  twinkle *= 0.7 + 0.3 * sin(uTime * 3.3 + hash21(band) * 19.0);
  return star * twinkle;
}

vec3 starColor(vec3 rd) {
  float s = skyStars(rd);
  vec3 cool = vec3(0.92, 0.98, 0.72);
  vec3 bright = vec3(0.98, 0.99, 0.94);
  return mix(cool, bright, hash21(floor(vec2(atan(rd.z, rd.x), rd.y) * 40.0))) * s;
}

// ── Sky (base gradient — stars added after duotone) ───────────
vec3 skyColor(vec3 rd) {
  float t = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 dayTop = vec3(0.28, 0.52, 0.68);
  vec3 dayHor = vec3(0.38, 0.62, 0.78);
  vec3 nightTop = vec3(0.02, 0.04, 0.09);
  vec3 nightHor = vec3(0.06, 0.1, 0.18);
  return mix(mix(nightHor, nightTop, t), mix(dayHor, dayTop, t), 1.0 - uNight);
}

// ── Shade water / ice hit ─────────────────────────────────────
vec3 shadeHit(vec3 ro, vec3 rd, float t, float matId) {
  vec3 p = ro + rd * t;
  vec3 n;

  if (matId < 1.5) {
    n = waveNormal(p.xz);
  } else {
    float e = 0.02;
    float dx = mapScene(p + vec3(e, 0.0, 0.0)) - mapScene(p - vec3(e, 0.0, 0.0));
    float dy = mapScene(p + vec3(0.0, e, 0.0)) - mapScene(p - vec3(0.0, e, 0.0));
    float dz = mapScene(p + vec3(0.0, 0.0, e)) - mapScene(p - vec3(0.0, 0.0, e));
    n = normalize(vec3(dx, dy, dz));
  }

  vec3 lightDir = normalize(vec3(0.35, 0.85, 0.25));
  float diff = max(dot(n, lightDir), 0.0);
  float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 64.0);
  float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

  vec3 deepWater = vec3(0.04, 0.18, 0.32);
  vec3 shallow = vec3(0.15, 0.48, 0.68);
  vec3 foam = vec3(0.82, 0.92, 0.98);
  vec3 iceCol = vec3(0.78, 0.9, 0.97);
  vec3 iceSpec = vec3(0.95, 0.98, 1.0);

  vec3 col;
  if (matId < 1.5) {
    float crest = smoothstep(-0.02, 0.14, waveHeight(p.xz) - waveHeight(p.xz + vec2(0.03)));
    col = mix(deepWater, shallow, diff * 0.65 + 0.2);
    col = mix(col, foam, crest * 0.35);
    col += vec3(0.5, 0.7, 0.9) * spec * 0.45;
    col += shallow * fresnel * 0.25;
    float dist = length(p.xz) * 0.04;
    col = mix(col, vec3(0.02, 0.1, 0.2), clamp(dist, 0.0, 0.65));
  } else {
    col = iceCol * (0.55 + diff * 0.45);
    col += iceSpec * spec * 0.85;
    col += vec3(0.6, 0.8, 0.95) * fresnel * 0.3;
    float frost = smoothstep(0.3, 0.9, fbm(p.xz * 3.0 + uTime * 0.05));
    col = mix(col, vec3(0.95, 0.98, 1.0), frost * 0.15);
  }

  float fog = 1.0 - exp(-t * 0.045);
  vec3 fogCol = mix(vec3(0.5, 0.72, 0.85), vec3(0.04, 0.07, 0.12), uNight);
  col = mix(col, fogCol, fog * 0.7);
  return col;
}

// ── Duotone post-process (last thing that touches the pixel) ──
vec3 duotone(vec3 col) {
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  luma = smoothstep(0.02, 0.98, luma);

  vec3 dayLo = vec3(0.04, 0.16, 0.28);
  vec3 dayHi = vec3(0.35, 0.72, 0.92);
  vec3 nightLo = vec3(0.01, 0.02, 0.05);
  vec3 nightHi = vec3(0.82, 0.88, 0.96);

  vec3 lo = mix(dayLo, nightLo, uNight);
  vec3 hi = mix(dayHi, nightHi, uNight);
  return mix(lo, hi, luma);
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv * 2.0 - 1.0);
  p.x *= uResolution.x / uResolution.y;

  float camBob = sin(uTime * 0.08) * 0.06;
  vec3 ro = vec3(sin(uTime * 0.05) * 0.15, 1.05 + camBob, 3.2);
  vec3 ta = vec3(0.0, 0.15, -5.5);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = cross(ww, uu);
  vec3 rd = normalize(p.x * uu + p.y * vv + uFocal.x * ww);

  vec3 col = skyColor(rd);
  vec2 hit = raymarch(ro, rd);
  bool isSky = hit.x >= MAX_DIST;
  if (!isSky) {
    col = shadeHit(ro, rd, hit.x, hit.y);
  }

  col = duotone(col);

  if (uNight > 0.5 && isSky) {
    col += starColor(rd) * 1.35;
  }

  col = pow(col, vec3(0.92));
  fragColor = vec4(col, 1.0);
}
