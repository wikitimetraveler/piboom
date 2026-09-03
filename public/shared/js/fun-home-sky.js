/**
 * Fun Home tonight-sky — bright-star catalog, alt/az projection, low-precision
 * planet positions, and a soft Milky Way band for the home hero.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  /** Default: Hampton Falls, NH — Jonathan Homer Lane country. */
  const DEFAULT_OBSERVER = {
    lat: 42.898,
    lon: -70.864,
    label: 'Hampton Falls, NH',
  };

  /**
   * Bright-star subset (mag ≲ 2.0 + a few anchors). RA/Dec J2000 degrees.
   * Names are common English / Bayer where familiar.
   */
  const BRIGHT_STARS = [
    { n: 'Sirius', ra: 101.287, dec: -16.716, mag: -1.46 },
    { n: 'Canopus', ra: 95.988, dec: -52.696, mag: -0.74 },
    { n: 'Arcturus', ra: 213.915, dec: 19.182, mag: -0.05 },
    { n: 'Vega', ra: 279.235, dec: 38.784, mag: 0.03 },
    { n: 'Capella', ra: 79.172, dec: 45.998, mag: 0.08 },
    { n: 'Rigel', ra: 78.634, dec: -8.202, mag: 0.13 },
    { n: 'Procyon', ra: 114.826, dec: 5.225, mag: 0.34 },
    { n: 'Betelgeuse', ra: 88.793, dec: 7.407, mag: 0.42 },
    { n: 'Achernar', ra: 24.429, dec: -57.237, mag: 0.46 },
    { n: 'Hadar', ra: 210.956, dec: -60.373, mag: 0.61 },
    { n: 'Altair', ra: 297.696, dec: 8.868, mag: 0.76 },
    { n: 'Acrux', ra: 186.65, dec: -63.099, mag: 0.77 },
    { n: 'Aldebaran', ra: 68.98, dec: 16.509, mag: 0.86 },
    { n: 'Antares', ra: 247.352, dec: -26.432, mag: 0.96 },
    { n: 'Spica', ra: 201.298, dec: -11.161, mag: 0.97 },
    { n: 'Pollux', ra: 116.329, dec: 28.026, mag: 1.14 },
    { n: 'Fomalhaut', ra: 344.413, dec: -29.622, mag: 1.16 },
    { n: 'Deneb', ra: 310.358, dec: 45.28, mag: 1.25 },
    { n: 'Mimosa', ra: 191.93, dec: -59.689, mag: 1.25 },
    { n: 'Regulus', ra: 152.093, dec: 11.967, mag: 1.35 },
    { n: 'Adhara', ra: 111.024, dec: -28.972, mag: 1.5 },
    { n: 'Castor', ra: 113.65, dec: 31.888, mag: 1.58 },
    { n: 'Shaula', ra: 263.402, dec: -37.104, mag: 1.62 },
    { n: 'Bellatrix', ra: 81.283, dec: 6.35, mag: 1.64 },
    { n: 'El Nath', ra: 81.573, dec: 28.608, mag: 1.65 },
    { n: 'Miaplacidus', ra: 138.3, dec: -69.717, mag: 1.67 },
    { n: 'Alnilam', ra: 84.053, dec: -1.202, mag: 1.69 },
    { n: 'Alnair', ra: 332.058, dec: -46.961, mag: 1.74 },
    { n: 'Alioth', ra: 193.507, dec: 55.96, mag: 1.76 },
    { n: 'Alnitak', ra: 85.19, dec: -1.943, mag: 1.77 },
    { n: 'Dubhe', ra: 165.46, dec: 61.751, mag: 1.79 },
    { n: 'Mirfak', ra: 51.081, dec: 49.861, mag: 1.79 },
    { n: 'Wezen', ra: 107.097, dec: -26.393, mag: 1.83 },
    { n: 'Sadr', ra: 305.557, dec: 40.257, mag: 1.0 },
    { n: 'Alkaid', ra: 206.885, dec: 49.313, mag: 1.85 },
    { n: 'Menkalinan', ra: 89.882, dec: 44.948, mag: 1.9 },
    { n: 'Polaris', ra: 37.954, dec: 89.264, mag: 1.98 },
    { n: 'Mirzam', ra: 95.078, dec: -17.956, mag: 1.98 },
    { n: 'Alphard', ra: 141.897, dec: -8.659, mag: 1.99 },
    { n: 'Merak', ra: 165.932, dec: 56.383, mag: 2.34 },
    { n: 'Phecda', ra: 178.458, dec: 53.695, mag: 2.41 },
    { n: 'Megrez', ra: 183.857, dec: 57.033, mag: 3.31 },
    { n: 'Schedar', ra: 10.127, dec: 56.537, mag: 2.24 },
    { n: 'Navi', ra: 10.126, dec: 60.716, mag: 2.15 },
    { n: 'Ruchbah', ra: 21.454, dec: 60.235, mag: 2.68 },
    { n: 'Hamal', ra: 31.793, dec: 23.462, mag: 2.01 },
    { n: 'Algieba', ra: 154.993, dec: 19.842, mag: 2.01 },
    { n: 'Diphda', ra: 10.897, dec: -17.987, mag: 2.04 },
    { n: 'Nunki', ra: 283.816, dec: -26.297, mag: 2.05 },
    { n: 'Menkent', ra: 211.671, dec: -36.37, mag: 2.06 },
    { n: 'Alpheratz', ra: 2.097, dec: 29.091, mag: 2.07 },
    { n: 'Mirach', ra: 17.433, dec: 35.621, mag: 2.07 },
    { n: 'Kochab', ra: 222.676, dec: 74.155, mag: 2.07 },
    { n: 'Saiph', ra: 86.939, dec: -9.67, mag: 2.07 },
    { n: 'Rasalhague', ra: 263.734, dec: 12.56, mag: 2.08 },
    { n: 'Algol', ra: 47.042, dec: 40.956, mag: 2.09 },
    { n: 'Almach', ra: 30.975, dec: 42.33, mag: 2.1 },
    { n: 'Denebola', ra: 177.265, dec: 14.572, mag: 2.14 },
    { n: 'Cih', ra: 14.177, dec: 60.717, mag: 2.15 },
    { n: 'Naos', ra: 120.896, dec: -40.003, mag: 2.21 },
    { n: 'Eltanin', ra: 269.152, dec: 51.489, mag: 2.24 },
    { n: 'Alphecca', ra: 233.672, dec: 26.715, mag: 2.22 },
    { n: 'Mizar', ra: 200.981, dec: 54.925, mag: 2.23 },
    { n: 'Sargas', ra: 264.33, dec: -42.998, mag: 1.86 },
    { n: 'Avior', ra: 139.273, dec: -59.509, mag: 1.86 },
    { n: 'Aspidiske', ra: 139.011, dec: -59.275, mag: 2.21 },
  ];

  /** Famous asterism line pairs (both star names must be in catalog). */
  const SKY_ASTERISMS = [
    {
      id: 'orion',
      label: 'Orion',
      pairs: [
        ['Betelgeuse', 'Bellatrix'],
        ['Betelgeuse', 'Alnitak'],
        ['Bellatrix', 'Saiph'],
        ['Alnitak', 'Alnilam'],
        ['Alnilam', 'Rigel'],
        ['Rigel', 'Saiph'],
      ],
    },
    {
      id: 'dipper',
      label: 'Big Dipper',
      pairs: [
        ['Dubhe', 'Merak'],
        ['Merak', 'Phecda'],
        ['Phecda', 'Megrez'],
        ['Megrez', 'Alioth'],
        ['Alioth', 'Mizar'],
        ['Mizar', 'Alkaid'],
        ['Dubhe', 'Megrez'],
      ],
    },
    {
      id: 'cassiopeia',
      label: 'Cassiopeia',
      pairs: [
        ['Cih', 'Schedar'],
        ['Schedar', 'Navi'],
        ['Navi', 'Ruchbah'],
      ],
    },
    {
      id: 'summer-tri',
      label: 'Summer Triangle',
      pairs: [
        ['Vega', 'Deneb'],
        ['Deneb', 'Altair'],
        ['Altair', 'Vega'],
      ],
    },
    {
      id: 'scorpius',
      label: 'Scorpius',
      pairs: [
        ['Antares', 'Shaula'],
        ['Antares', 'Sargas'],
        ['Shaula', 'Sargas'],
      ],
    },
  ];

  function moonPhaseLabel(date) {
    const sunLon = sunEclipticLon(date);
    const moon = moonEcliptic(date);
    let phase = (moon.lon - sunLon) / 360;
    if (phase < 0) phase += 1;
    if (phase < 0.03 || phase > 0.97) return 'New Moon';
    if (phase < 0.22) return 'Waxing crescent';
    if (phase < 0.28) return 'First quarter';
    if (phase < 0.47) return 'Waxing gibbous';
    if (phase < 0.53) return 'Full Moon';
    if (phase < 0.72) return 'Waning gibbous';
    if (phase < 0.78) return 'Last quarter';
    return 'Waning crescent';
  }

  function buildStarMap(stars) {
    const map = Object.create(null);
    for (let i = 0; i < stars.length; i += 1) {
      map[stars[i].name] = stars[i];
    }
    return map;
  }

  /** Project asterism line segments from a projectSky() result. */
  function projectAsterisms(sky) {
    const map = buildStarMap(sky.stars || []);
    const lines = [];
    for (let a = 0; a < SKY_ASTERISMS.length; a += 1) {
      const asterism = SKY_ASTERISMS[a];
      for (let p = 0; p < asterism.pairs.length; p += 1) {
        const pair = asterism.pairs[p];
        const aStar = map[pair[0]];
        const bStar = map[pair[1]];
        if (!aStar || !bStar) continue;
        lines.push({
          id: asterism.id,
          label: asterism.label,
          x1: aStar.x,
          y1: aStar.y,
          x2: bStar.x,
          y2: bStar.y,
        });
      }
    }
    return lines;
  }

  function formatSkyCaption(sky) {
    const label = sky.observer.label || 'observer';
    const when = sky.date;
    const hh = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let timeWord = 'now';
    if (sky.scrubbed) timeWord = hh + ' local';
    else if (sky.usedEveningFallback) timeWord = 'tonight ' + hh;
    const phase = moonPhaseLabel(sky.date);
    const up = (sky.planets || []).map((p) => p.name);
    const planets = up.length ? up.join(' · ') : 'no naked-eye planets up';
    return `Sky · ${label} · ${timeWord} · ${phase} · ${planets}`;
  }

  /** Map scrubber index 19–28 → local hour (24+ wraps to 0–4). */
  function scrubIndexToHour(index) {
    const i = Number(index);
    if (!Number.isFinite(i)) return 21;
    if (i >= 24) return i - 24;
    return i;
  }

  /** Build a local Date at hour:minute on the same calendar day as base. */
  function buildLocalSkyDate(base, hourLocal, minuteLocal) {
    const d = base instanceof Date ? new Date(base.getTime()) : new Date();
    d.setHours(hourLocal, minuteLocal || 0, 0, 0);
    return d;
  }

  function pad2Url(n) {
    return String(n).padStart(2, '0');
  }

  /** Deep link into /planetarium/ for a date + observer (+ optional body/select). */
  function buildPlanetariumUrl(opts, origin) {
    const o = opts || {};
    const date = o.date instanceof Date ? o.date : new Date();
    const observer = o.observer || DEFAULT_OBSERVER;
    const base = (origin || '') + '/planetarium/';
    const params = new URLSearchParams();
    params.set(
      'date',
      date.getFullYear() + '-' + pad2Url(date.getMonth() + 1) + '-' + pad2Url(date.getDate())
    );
    params.set('time', pad2Url(date.getHours()) + ':' + pad2Url(date.getMinutes()));
    if (Number.isFinite(observer.lat) && Number.isFinite(observer.lon)) {
      params.set('lat', String(Number(observer.lat.toFixed(4))));
      params.set('lon', String(Number(observer.lon.toFixed(4))));
    }
    if (observer.label) params.set('label', String(observer.label).slice(0, 80));
    if (o.facing && o.facing !== 'south') params.set('face', o.facing);
    if (o.body) params.set('body', String(o.body));
    if (o.select) params.set('select', String(o.select));
    return base + '?' + params.toString();
  }

  /** Illuminated fraction 0 (new) → 1 (full) for moon disc art. */
  function moonPhaseFraction(date) {
    const sunLon = sunEclipticLon(date);
    const moon = moonEcliptic(date);
    let phase = (moon.lon - sunLon) / 360;
    if (phase < 0) phase += 1;
    return phase;
  }

  /** Horizon arc + cardinal labels in hero projection space. */
  function projectHorizon(opts) {
    const projOpts = opts || {};
    const fovAz = projOpts.fovAz || 160;
    const minAlt = projOpts.minAlt || 4;
    const centerAz = Number.isFinite(projOpts.centerAz) ? projOpts.centerAz : 180;
    const points = [];
    const startAz = centerAz - fovAz / 2;
    const endAz = centerAz + fovAz / 2;
    for (let az = startAz; az <= endAz; az += 3) {
      const xy = projectAltAz(minAlt, norm360(az), projOpts);
      if (xy) points.push({ x: xy.x, y: xy.y, az: norm360(az) });
    }
    const cardinals = [];
    const dirs = [
      { az: 0, label: 'N' },
      { az: 90, label: 'E' },
      { az: 180, label: 'S' },
      { az: 270, label: 'W' },
    ];
    for (let i = 0; i < dirs.length; i += 1) {
      const d = dirs[i];
      let delta = d.az - centerAz;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      if (Math.abs(delta) > fovAz / 2 + 2) continue;
      const xy = projectAltAz(minAlt + 1.5, d.az, projOpts);
      if (xy) cardinals.push({ x: xy.x, y: xy.y, label: d.label, az: d.az });
    }
    return { points, cardinals };
  }

  const OBSERVER_STORAGE_KEY = 'funHomeObserver';

  /** Browser geolocation with Hampton Falls fallback (cached per session). */
  function resolveObserver(onReady) {
    const fallback = () => onReady({ ...DEFAULT_OBSERVER });
    if (typeof onReady !== 'function') return DEFAULT_OBSERVER;
    try {
      const raw = root.sessionStorage && root.sessionStorage.getItem(OBSERVER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) {
          onReady(parsed);
          return;
        }
      }
    } catch (_) {
      /* ignore bad cache */
    }
    if (!root.navigator || !root.navigator.geolocation) {
      fallback();
      return;
    }
    root.navigator.geolocation.getCurrentPosition(
      (pos) => {
        const obs = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: 'your location',
        };
        try {
          if (root.sessionStorage) {
            root.sessionStorage.setItem(OBSERVER_STORAGE_KEY, JSON.stringify(obs));
          }
        } catch (_) {
          /* ignore quota */
        }
        onReady(obs);
      },
      fallback,
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 900000 }
    );
  }

  /** Mean J2000 orbital elements for naked-eye planets (simplified). */
  const PLANET_ORBITS = {
    mercury: { a: 0.3871, e: 0.2056, I: 7.005, L: 252.25, lp: 77.456, n: 4.0923 },
    venus: { a: 0.7233, e: 0.0068, I: 3.3947, L: 181.98, lp: 131.6, n: 1.6021 },
    mars: { a: 1.5237, e: 0.0934, I: 1.85, L: 355.43, lp: 336.06, n: 0.524 },
    jupiter: { a: 5.2026, e: 0.0485, I: 1.303, L: 34.35, lp: 14.33, n: 0.08309 },
    saturn: { a: 9.5549, e: 0.0555, I: 2.489, L: 50.08, lp: 93.06, n: 0.03346 },
  };

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function norm360(d) {
    let x = d % 360;
    if (x < 0) x += 360;
    return x;
  }

  function julianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  /** Days since J2000.0 noon TT (close enough for hero art). */
  function daysSinceJ2000(date) {
    return julianDay(date) - 2451545.0;
  }

  function gmstDegrees(date) {
    const d = daysSinceJ2000(date);
    return norm360(280.46061837 + 360.98564736629 * d);
  }

  function localSiderealDegrees(date, lonDeg) {
    return norm360(gmstDegrees(date) + lonDeg);
  }

  /**
   * Equatorial RA/Dec (degrees) → altitude / azimuth (degrees).
   * Azimuth: 0° north, 90° east (astronomy convention).
   */
  function equatorialToAltAz(raDeg, decDeg, latDeg, lstDeg) {
    const ha = (lstDeg - raDeg) * DEG;
    const dec = decDeg * DEG;
    const lat = latDeg * DEG;
    const sinAlt =
      Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const alt = Math.asin(clamp(sinAlt, -1, 1));
    const cosAlt = Math.cos(alt);
    let az = 0;
    if (cosAlt > 1e-8) {
      const sinAz = (-Math.cos(dec) * Math.sin(ha)) / cosAlt;
      const cosAz =
        (Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.cos(ha) * Math.sin(lat)) /
        cosAlt;
      az = Math.atan2(sinAz, cosAz);
    }
    return { alt: alt * RAD, az: norm360(az * RAD) };
  }

  /**
   * Project alt/az into hero percent coords.
   * Looking south (az 180° center): left = east, right = west of south.
   * Top of hero ≈ zenith; bottom of star mask ≈ horizon.
   */
  function projectAltAz(alt, az, opts) {
    const fovAz = (opts && opts.fovAz) || 160;
    const minAlt = (opts && opts.minAlt) || 2;
    const maxAlt = (opts && opts.maxAlt) || 88;
    const centerAz = Number.isFinite(opts && opts.centerAz) ? opts.centerAz : 180;
    const yScale = (opts && opts.yScale) || 78;
    const yMax = (opts && opts.yMax) || 82;
    if (alt < minAlt || alt > maxAlt) return null;
    let dAz = az - centerAz;
    while (dAz > 180) dAz -= 360;
    while (dAz < -180) dAz += 360;
    if (Math.abs(dAz) > fovAz / 2) return null;
    const x = 50 + (dAz / (fovAz / 2)) * 48;
    const y = ((maxAlt - alt) / (maxAlt - minAlt)) * yScale;
    if (x < 0 || x > 100 || y < 0 || y > yMax) return null;
    return { x, y };
  }

  /** Sun ecliptic longitude (degrees), low precision. */
  function sunEclipticLon(date) {
    const d = daysSinceJ2000(date);
    const L = norm360(280.46 + 0.9856474 * d);
    const g = (357.528 + 0.9856003 * d) * DEG;
    return norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  }

  function obliquity(date) {
    const T = daysSinceJ2000(date) / 36525;
    return 23.439291 - 0.0130042 * T;
  }

  function eclipticToEquatorial(lonDeg, latDeg, date) {
    const eps = obliquity(date) * DEG;
    const lon = lonDeg * DEG;
    const lat = latDeg * DEG;
    const ra = Math.atan2(
      Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps),
      Math.cos(lon)
    );
    const dec = Math.asin(
      clamp(
        Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon),
        -1,
        1
      )
    );
    return { ra: norm360(ra * RAD), dec: dec * RAD };
  }

  function sunEquatorial(date) {
    return eclipticToEquatorial(sunEclipticLon(date), 0, date);
  }

  /** Subsolar lat/lon (degrees) for Earth terminator / local solar time. */
  function subsolarPoint(date) {
    const when = date instanceof Date ? date : new Date();
    const sun = sunEquatorial(when);
    const gmst = gmstDegrees(when);
    let lon = sun.ra - gmst;
    lon = ((lon + 540) % 360) - 180;
    return { lat: sun.dec, lon: lon };
  }

  /**
   * Body-frame sun direction matching webgpu-globe lonLatFromNormal
   * (x=cos lat cos lon, y=sin lat, z=cos lat sin lon).
   */
  function sunDirBody(date) {
    const ss = subsolarPoint(date);
    const lat = (ss.lat * Math.PI) / 180;
    const lon = (ss.lon * Math.PI) / 180;
    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.sin(lon);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    return { x: x / len, y: y / len, z: z / len, lat: ss.lat, lon: ss.lon };
  }

  /** Approximate Moon ecliptic lon (degrees). */
  function moonEcliptic(date) {
    const d = daysSinceJ2000(date);
    const L = norm360(218.316 + 13.176396 * d);
    const M = (134.963 + 13.064993 * d) * DEG;
    const F = (93.272 + 13.22935 * d) * DEG;
    const lon = norm360(L + 6.289 * Math.sin(M));
    const lat = 5.128 * Math.sin(F);
    return { lon, lat };
  }

  function planetHeliocentric(date, key) {
    const el = PLANET_ORBITS[key];
    if (!el) return null;
    const d = daysSinceJ2000(date);
    const M = norm360(el.L - el.lp + el.n * d) * DEG;
    const E = M + el.e * Math.sin(M) * (1 + el.e * Math.cos(M));
    const xv = el.a * (Math.cos(E) - el.e);
    const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    const lon = v + el.lp * DEG;
    const xh = r * (Math.cos(lon));
    const yh = r * (Math.sin(lon));
    return { x: xh, y: yh, z: 0 };
  }

  function earthHeliocentric(date) {
    const lon = sunEclipticLon(date) * DEG + Math.PI;
    return { x: Math.cos(lon), y: Math.sin(lon), z: 0 };
  }

  function planetEquatorial(date, key) {
    const p = planetHeliocentric(date, key);
    const e = earthHeliocentric(date);
    if (!p) return null;
    const x = p.x - e.x;
    const y = p.y - e.y;
    const z = p.z - e.z;
    const lon = Math.atan2(y, x) * RAD;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD;
    return eclipticToEquatorial(norm360(lon), lat, date);
  }

  /**
   * If the Sun is up, snap to tonight 21:00 local so the hero always has a night sky.
   */
  function resolveSkyDate(date, observer) {
    const now = date instanceof Date ? new Date(date.getTime()) : new Date();
    const obs = observer || DEFAULT_OBSERVER;
    const sun = sunEquatorial(now);
    const lst = localSiderealDegrees(now, obs.lon);
    const sunAlt = equatorialToAltAz(sun.ra, sun.dec, obs.lat, lst).alt;
    if (sunAlt < -6) return now;
    const evening = new Date(now);
    evening.setHours(21, 0, 0, 0);
    if (evening.getTime() <= now.getTime()) evening.setDate(evening.getDate() + 1);
    return evening;
  }

  function magSize(mag) {
    if (mag <= 0) return 4.2;
    if (mag <= 0.5) return 3.4;
    if (mag <= 1.2) return 2.8;
    if (mag <= 1.8) return 2.2;
    return 1.7;
  }

  /**
   * Galactic plane samples → equatorial (approx IAU).
   * NGP RA 192.86°, Dec 27.13°; ascending node.
   */
  function galacticToEquatorial(lDeg, bDeg) {
    const lNCP = 122.932 * DEG;
    const aNGP = 192.85948 * DEG;
    const dNGP = 27.12825 * DEG;
    const l = lDeg * DEG;
    const b = bDeg * DEG;
    const sinD =
      Math.sin(b) * Math.sin(dNGP) + Math.cos(b) * Math.cos(dNGP) * Math.sin(l - lNCP);
    const dec = Math.asin(clamp(sinD, -1, 1));
    const y = Math.cos(b) * Math.cos(l - lNCP);
    const x =
      Math.sin(b) * Math.cos(dNGP) - Math.cos(b) * Math.sin(dNGP) * Math.sin(l - lNCP);
    const ra = Math.atan2(y, x) + aNGP;
    return { ra: norm360(ra * RAD), dec: dec * RAD };
  }

  function milkyWayBand(date, observer, opts) {
    const obs = observer || DEFAULT_OBSERVER;
    const lst = localSiderealDegrees(date, obs.lon);
    const points = [];
    for (let l = 0; l < 360; l += 8) {
      const eq = galacticToEquatorial(l, 0);
      const aa = equatorialToAltAz(eq.ra, eq.dec, obs.lat, lst);
      const xy = projectAltAz(aa.alt, aa.az, opts);
      if (xy) points.push(xy);
    }
    return points;
  }

  function projectSky(date, observer, opts) {
    const obs = observer || DEFAULT_OBSERVER;
    const input = date instanceof Date ? date : new Date();
    const projOpts = opts || {};
    const forceTime = !!projOpts.forceTime;
    const skyDate = forceTime
      ? input instanceof Date
        ? new Date(input.getTime())
        : new Date()
      : resolveSkyDate(input, obs);
    const lst = localSiderealDegrees(skyDate, obs.lon);

    const stars = [];
    for (let i = 0; i < BRIGHT_STARS.length; i += 1) {
      const s = BRIGHT_STARS[i];
      const aa = equatorialToAltAz(s.ra, s.dec, obs.lat, lst);
      const xy = projectAltAz(aa.alt, aa.az, projOpts);
      if (!xy) continue;
      stars.push({
        name: s.n,
        mag: s.mag,
        size: magSize(s.mag),
        bright: s.mag <= 1.0,
        flare: s.mag <= 0.5,
        x: xy.x,
        y: xy.y,
        alt: aa.alt,
        az: aa.az,
        ra: s.ra,
        dec: s.dec,
      });
    }

    const planets = [];
    const moonEc = moonEcliptic(skyDate);
    const moonEq = eclipticToEquatorial(moonEc.lon, moonEc.lat, skyDate);
    const bodies = [
      { id: 'moon', name: 'Moon', eq: moonEq, mag: -10 },
      { id: 'mercury', name: 'Mercury', eq: planetEquatorial(skyDate, 'mercury'), mag: 0.5 },
      { id: 'venus', name: 'Venus', eq: planetEquatorial(skyDate, 'venus'), mag: -3.5 },
      { id: 'mars', name: 'Mars', eq: planetEquatorial(skyDate, 'mars'), mag: 0.8 },
      { id: 'jupiter', name: 'Jupiter', eq: planetEquatorial(skyDate, 'jupiter'), mag: -2 },
      { id: 'saturn', name: 'Saturn', eq: planetEquatorial(skyDate, 'saturn'), mag: 0.6 },
    ];
    for (let i = 0; i < bodies.length; i += 1) {
      const b = bodies[i];
      if (!b.eq) continue;
      const aa = equatorialToAltAz(b.eq.ra, b.eq.dec, obs.lat, lst);
      const xy = projectAltAz(aa.alt, aa.az, projOpts);
      if (!xy) continue;
      planets.push({
        id: b.id,
        name: b.name,
        mag: b.mag,
        x: xy.x,
        y: xy.y,
        alt: aa.alt,
        az: aa.az,
      });
    }

    const sun = sunEquatorial(skyDate);
    const sunAa = equatorialToAltAz(sun.ra, sun.dec, obs.lat, lst);

    return {
      date: skyDate,
      observer: obs,
      stars,
      planets,
      milkyWay: milkyWayBand(skyDate, obs, projOpts),
      sunAlt: sunAa.alt,
      usedEveningFallback: !forceTime && skyDate.getTime() !== input.getTime(),
      scrubbed: forceTime,
    };
  }

  root.FunHomeSky = {
    DEFAULT_OBSERVER,
    BRIGHT_STARS,
    SKY_ASTERISMS,
    julianDay,
    daysSinceJ2000,
    gmstDegrees,
    localSiderealDegrees,
    equatorialToAltAz,
    projectAltAz,
    sunEquatorial,
    sunEclipticLon,
    subsolarPoint,
    sunDirBody,
    planetEquatorial,
    resolveSkyDate,
    projectSky,
    projectAsterisms,
    moonPhaseLabel,
    moonPhaseFraction,
    projectHorizon,
    resolveObserver,
    formatSkyCaption,
    scrubIndexToHour,
    buildLocalSkyDate,
    buildPlanetariumUrl,
    OBSERVER_STORAGE_KEY,
    galacticToEquatorial,
    milkyWayBand,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
