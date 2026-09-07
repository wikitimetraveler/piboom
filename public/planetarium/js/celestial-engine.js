/**
 * CelestialEngine — astronomy-engine wrapper for the planetarium dome.
 * Expects globalThis.Astronomy (browser UMD or Jest require).
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  const DEFAULT_OBSERVER = {
    lat: 42.898,
    lon: -70.864,
    label: 'Hampton Falls, NH',
  };

  function getAstronomy() {
    const A = root.Astronomy;
    if (!A) throw new Error('Astronomy Engine not loaded — include astronomy.browser.min.js first');
    return A;
  }

  function bodyTable() {
    const Astronomy = getAstronomy();
    return [
      { id: 'moon', name: 'Moon', body: Astronomy.Body.Moon },
      { id: 'mercury', name: 'Mercury', body: Astronomy.Body.Mercury },
      { id: 'venus', name: 'Venus', body: Astronomy.Body.Venus },
      { id: 'mars', name: 'Mars', body: Astronomy.Body.Mars },
      { id: 'jupiter', name: 'Jupiter', body: Astronomy.Body.Jupiter },
      { id: 'saturn', name: 'Saturn', body: Astronomy.Body.Saturn },
      { id: 'uranus', name: 'Uranus', body: Astronomy.Body.Uranus },
      { id: 'neptune', name: 'Neptune', body: Astronomy.Body.Neptune },
    ];
  }

  function asDate(date) {
    if (date instanceof Date) return date;
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  function makeObserver(observer) {
    const Astronomy = getAstronomy();
    const lat = Number(observer && observer.lat);
    const lon = Number(observer && observer.lon);
    const elev = Number((observer && (observer.elev || observer.elevation)) || 0) || 0;
    return new Astronomy.Observer(
      Number.isFinite(lat) ? lat : DEFAULT_OBSERVER.lat,
      Number.isFinite(lon) ? lon : DEFAULT_OBSERVER.lon,
      elev
    );
  }

  function norm360(d) {
    let x = d % 360;
    if (x < 0) x += 360;
    return x;
  }

  function raDegToHours(raDeg) {
    return norm360(Number(raDeg)) / 15;
  }

  /** Shortest signed azimuth delta in (−180, 180]. */
  function shortestAzDelta(fromDeg, toDeg) {
    let d = ((Number(toDeg) - Number(fromDeg)) % 360 + 540) % 360 - 180;
    return d;
  }

  /** GSAP-friendly target so interpolating from→to takes the short arc. */
  function unwrapAzTarget(fromDeg, toDeg) {
    return Number(fromDeg) + shortestAzDelta(fromDeg, toDeg);
  }

  /**
   * Alt/az (deg, az 0° N / 90° E) → ENU sky vector.
   * x = east, y = up, z = −north (Three.js inner-sphere convention).
   */
  function altAzToVec3(alt, az, out) {
    const a = Number(alt) * DEG;
    const z = Number(az) * DEG;
    const c = Math.cos(a);
    const x = Math.sin(z) * c;
    const y = Math.sin(a);
    const zz = -Math.cos(z) * c;
    if (out) {
      out.x = x;
      out.y = y;
      out.z = zz;
      return out;
    }
    return { x, y, z: zz };
  }

  /**
   * Equidistant fisheye: NDC-style p (aspect-corrected, |p|≤1 at rim) → look direction.
   * Matches the dome fragment shader (ang = r * fov/2).
   */
  function fisheyeScreenToDir(px, py, fovDeg, altDeg, azDeg) {
    const pLen = Math.hypot(px, py);
    const r = Math.min(pLen, 1);
    const ang = r * (Number(fovDeg) * DEG * 0.5);
    const basis = lookBasis(altDeg, azDeg);
    const invR = pLen > 1e-5 ? 1 / pLen : 0;
    const s = Math.sin(ang) * invR;
    const c = Math.cos(ang);
    return {
      x: basis.forward.x * c + (basis.right.x * px + basis.up.x * py) * s,
      y: basis.forward.y * c + (basis.right.y * px + basis.up.y * py) * s,
      z: basis.forward.z * c + (basis.right.z * px + basis.up.z * py) * s,
    };
  }

  function lookBasis(altDeg, azDeg) {
    const forward = altAzToVec3(altDeg, azDeg);
    const len = Math.hypot(forward.x, forward.y, forward.z) || 1;
    forward.x /= len;
    forward.y /= len;
    forward.z /= len;
    const z = Number(azDeg) * DEG;
    let right = { x: Math.cos(z), y: 0, z: Math.sin(z) };
    if (Math.abs(forward.y) < 0.995) {
      // right = normalize(forward × worldUp)
      const rx = forward.y * 0 - forward.z * 1;
      const ry = forward.z * 0 - forward.x * 0;
      const rz = forward.x * 1 - forward.y * 0;
      const rl = Math.hypot(rx, ry, rz);
      if (rl > 1e-8) {
        right = { x: rx / rl, y: ry / rl, z: rz / rl };
      }
    }
    // up = right × forward
    const up = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x,
    };
    const ul = Math.hypot(up.x, up.y, up.z) || 1;
    up.x /= ul;
    up.y /= ul;
    up.z /= ul;
    return { forward, right, up };
  }

  /**
   * Clip a great-circle chord between two ENU unit vectors at altitude floorDeg.
   * Returns null if both below, or {a,b} ENU endpoints (possibly moved to the horizon).
   */
  function clipHorizonSegment(ax, ay, az, bx, by, bz, floorDeg) {
    const floorSin = Math.sin(Number(floorDeg) * DEG);
    const aOk = ay >= floorSin;
    const bOk = by >= floorSin;
    if (!aOk && !bOk) return null;
    if (aOk && bOk) {
      return {
        a: { x: ax, y: ay, z: az },
        b: { x: bx, y: by, z: bz },
      };
    }
    // Linear interpolate in ENU (chord approx) to y = floorSin
    const dy = by - ay;
    if (Math.abs(dy) < 1e-12) return null;
    const t = (floorSin - ay) / dy;
    if (t < 0 || t > 1) return null;
    const hx = ax + (bx - ax) * t;
    const hy = floorSin;
    const hz = az + (bz - az) * t;
    const hl = Math.hypot(hx, hy, hz) || 1;
    const h = { x: hx / hl, y: hy / hl, z: hz / hl };
    if (aOk) return { a: { x: ax, y: ay, z: az }, b: h };
    return { a: h, b: { x: bx, y: by, z: bz } };
  }

  /** J2000 RA/Dec degrees → unit EQJ cartesian (astronomy convention). */
  function eqjUnitFromRaDec(raDeg, decDeg) {
    const ra = Number(raDeg) * DEG;
    const dec = Number(decDeg) * DEG;
    const c = Math.cos(dec);
    return {
      x: c * Math.cos(ra),
      y: c * Math.sin(ra),
      z: Math.sin(dec),
    };
  }

  /**
   * Rotation matrix EQJ → ENU (Three.js sky: east, up, −north).
   * Same rot[i][j] layout as astronomy-engine (out_j = Σ_i rot[i][j] * in_i).
   */
  function eqjToEnuMatrix(date, observer) {
    const Astronomy = getAstronomy();
    const obs = makeObserver(observer);
    const time = asDate(date);
    const R = Astronomy.Rotation_EQJ_HOR(time, obs);
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let i = 0; i < 3; i += 1) {
      // HOR: x=north, y=west, z=zenith → ENU: (−west, zenith, −north)
      C[i][0] = -R.rot[i][1];
      C[i][1] = R.rot[i][2];
      C[i][2] = -R.rot[i][0];
    }
    return { rot: C, date: time, observer: obs };
  }

  /** Apply rot[i][j] matrix to a vector. */
  function rotateVec(rot, vx, vy, vz) {
    return {
      x: rot[0][0] * vx + rot[1][0] * vy + rot[2][0] * vz,
      y: rot[0][1] * vx + rot[1][1] * vy + rot[2][1] * vz,
      z: rot[0][2] * vx + rot[1][2] * vy + rot[2][2] * vz,
    };
  }

  /**
   * Hipparcos / catalog J2000 RA/Dec → alt/az with precession+nutation (EQJ→HOR).
   * No atmospheric refraction (stars; planets keep Horizon 'normal').
   */
  function j2000ToAltAz(raDeg, decDeg, date, observer) {
    const Astronomy = getAstronomy();
    const obs = makeObserver(observer);
    const time = asDate(date);
    const eqj = eqjUnitFromRaDec(raDeg, decDeg);
    const vec = new Astronomy.Vector(eqj.x, eqj.y, eqj.z, time);
    const horVec = Astronomy.RotateVector(Astronomy.Rotation_EQJ_HOR(time, obs), vec);
    const sph = Astronomy.HorizonFromVector(horVec, null);
    return { alt: sph.lat, az: norm360(sph.lon) };
  }

  /**
   * Legacy path: feed RA/Dec straight into Horizon (treats as of-date).
   * Prefer j2000ToAltAz for Hipparcos catalog stars.
   */
  function equatorialToAltAz(raDeg, decDeg, date, observer) {
    return j2000ToAltAz(raDeg, decDeg, date, observer);
  }

  /** Naive of-date Horizon without EQJ precession (for tests comparing frames). */
  function equatorialToAltAzNaive(raDeg, decDeg, date, observer) {
    const Astronomy = getAstronomy();
    const obs = makeObserver(observer);
    const time = asDate(date);
    const hor = Astronomy.Horizon(time, obs, raDegToHours(raDeg), Number(decDeg), 'normal');
    return { alt: hor.altitude, az: norm360(hor.azimuth) };
  }

  /**
   * ENU → galactic latitude (degrees). Uses inverse EQJ→ENU and Rotation_EQJ_GAL.
   * Returns { b, l } galactic coords for a sky ENU direction.
   */
  function enuToGalactic(enuX, enuY, enuZ, eqjEnuRot) {
    const Astronomy = getAstronomy();
    // Invert C: EQJ = C^{-1} * ENU. C is a rotation → transpose.
    const C = eqjEnuRot.rot;
    const eqj = {
      x: C[0][0] * enuX + C[0][1] * enuY + C[0][2] * enuZ,
      y: C[1][0] * enuX + C[1][1] * enuY + C[1][2] * enuZ,
      z: C[2][0] * enuX + C[2][1] * enuY + C[2][2] * enuZ,
    };
    const galRot = Astronomy.Rotation_EQJ_GAL();
    const gal = rotateVec(galRot.rot, eqj.x, eqj.y, eqj.z);
    const xy = Math.hypot(gal.x, gal.y);
    const b = Math.atan2(gal.z, xy) * RAD;
    let l = Math.atan2(gal.y, gal.x) * RAD;
    if (l < 0) l += 360;
    return { l, b };
  }

  /**
   * Flat 9 floats column-major for Three.js Matrix3 / GLSL mat3:
   * maps ENU → GAL (Milky Way band uses galactic latitude = asin(g.z)).
   *
   * Astronomy convention: out_j = Σ_i rot[i][j] * in_i
   * EQJ_i = Σ_k C[i][k] * ENU_k
   * GAL_j = Σ_i G[i][j] * EQJ_i
   * ⇒ astr_M[k][j] = Σ_i G[i][j] * C[i][k]
   * GLSL (standard): gal = M_std * enu with M_std[j][k] = astr_M[k][j]
   */
  function enuToGalMatrixFlat(date, observer) {
    const Astronomy = getAstronomy();
    const C = eqjToEnuMatrix(date, observer).rot;
    const G = Astronomy.Rotation_EQJ_GAL().rot;
    const astrM = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let k = 0; k < 3; k += 1) {
      for (let j = 0; j < 3; j += 1) {
        astrM[k][j] = G[0][j] * C[0][k] + G[1][j] * C[1][k] + G[2][j] * C[2][k];
      }
    }
    // Column-major of M_std where M_std[j][k] = astrM[k][j]
    return [
      astrM[0][0], astrM[0][1], astrM[0][2],
      astrM[1][0], astrM[1][1], astrM[1][2],
      astrM[2][0], astrM[2][1], astrM[2][2],
    ];
  }

  function twilightLabel(sunAlt) {
    if (sunAlt < -18) return '';
    if (sunAlt < -12) return 'Astronomical twilight';
    if (sunAlt < -6) return 'Nautical twilight';
    if (sunAlt < 0) return 'Civil twilight';
    return 'Daylight — stars faint';
  }

  function moonPhaseFraction(date) {
    const Astronomy = getAstronomy();
    const ill = Astronomy.Illumination(Astronomy.Body.Moon, asDate(date));
    return Number(ill.phase_fraction);
  }

  function moonPhaseLabel(date) {
    const frac = moonPhaseFraction(date);
    if (frac < 0.03 || frac > 0.97) return 'New Moon';
    if (frac < 0.22) return 'Waxing crescent';
    if (frac < 0.28) return 'First quarter';
    if (frac < 0.47) return 'Waxing gibbous';
    if (frac < 0.53) return 'Full Moon';
    if (frac < 0.72) return 'Waning gibbous';
    if (frac < 0.78) return 'Last quarter';
    return 'Waning crescent';
  }

  function bodyAltAz(bodyId, date, observer) {
    const Astronomy = getAstronomy();
    const bodies = bodyTable();
    let row = null;
    const key = String(bodyId || '').toLowerCase();
    for (let i = 0; i < bodies.length; i += 1) {
      if (bodies[i].id === key) {
        row = bodies[i];
        break;
      }
    }
    if (!row) return null;
    const obs = makeObserver(observer);
    const time = asDate(date);
    const eq = Astronomy.Equator(row.body, time, obs, true, true);
    const hor = Astronomy.Horizon(time, obs, eq.ra, eq.dec, 'normal');
    let mag = null;
    let phaseFraction = null;
    try {
      const ill = Astronomy.Illumination(row.body, time);
      mag = Number.isFinite(ill.mag) ? ill.mag : null;
      if (row.id === 'moon') phaseFraction = Number(ill.phase_fraction);
    } catch (_) {
      /* optional */
    }
    return {
      id: row.id,
      name: row.name,
      alt: hor.altitude,
      az: norm360(hor.azimuth),
      ra: eq.ra * 15,
      dec: eq.dec,
      mag,
      phaseFraction,
    };
  }

  function sunAltAz(date, observer) {
    const Astronomy = getAstronomy();
    const obs = makeObserver(observer);
    const time = asDate(date);
    const eq = Astronomy.Equator(Astronomy.Body.Sun, time, obs, true, true);
    const hor = Astronomy.Horizon(time, obs, eq.ra, eq.dec, 'normal');
    return { alt: hor.altitude, az: norm360(hor.azimuth), ra: eq.ra * 15, dec: eq.dec };
  }

  function listBodiesAltAz(date, observer, opts) {
    const aboveOnly = opts && opts.aboveHorizonOnly;
    const bodies = bodyTable();
    const out = [];
    for (let i = 0; i < bodies.length; i += 1) {
      const pos = bodyAltAz(bodies[i].id, date, observer);
      if (!pos) continue;
      if (aboveOnly && pos.alt < 0) continue;
      out.push(pos);
    }
    return out.sort((a, b) => b.alt - a.alt);
  }

  function observerHorizon(date, lat, lon) {
    const observer = { lat: Number(lat), lon: Number(lon) };
    const sun = sunAltAz(date, observer);
    return {
      date: asDate(date),
      observer,
      sunAlt: sun.alt,
      sunAz: sun.az,
      twilight: twilightLabel(sun.alt),
      moonPhase: moonPhaseLabel(date),
      moonPhaseFraction: moonPhaseFraction(date),
    };
  }

  function formatSkyCaption(parts) {
    const observer = parts && parts.observer;
    const date = asDate(parts && parts.date);
    const planets = (parts && parts.planets) || [];
    const label = (observer && observer.label) || 'observer';
    const hh = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const phase = (parts && parts.moonPhase) || moonPhaseLabel(date);
    const up = planets.filter((p) => p.alt >= 0).map((p) => p.name);
    const planetBit = up.length ? up.join(', ') : 'no naked-eye planets up';
    return 'Sky · ' + label + ' · ' + hh + ' · ' + phase + ' · ' + planetBit;
  }

  function skySnapshot(state, opts) {
    const date = asDate(state.date);
    const observer = state.observer || DEFAULT_OBSERVER;
    const sun = sunAltAz(date, observer);
    const planets = listBodiesAltAz(date, observer, { aboveHorizonOnly: false });
    const up = planets.filter((p) => p.alt >= 0);
    const phase = moonPhaseLabel(date);
    const frac = moonPhaseFraction(date);
    const caption = formatSkyCaption({ observer, date, planets: up, moonPhase: phase });
    return {
      date,
      observer,
      sunAlt: sun.alt,
      sunAz: sun.az,
      twilight: twilightLabel(sun.alt),
      moonPhase: phase,
      moonPhaseFraction: frac,
      planets: up,
      allBodies: planets,
      caption,
      facing: state.facing || 'south',
      selection: state.selection || null,
      cameraAz: Number.isFinite(state.cameraAz) ? state.cameraAz : null,
      asterisms: (opts && opts.constellationLabels) || [],
      engine: 'astronomy-engine',
    };
  }

  const CelestialEngine = {
    DEFAULT_OBSERVER,
    get BODY_IDS() {
      return bodyTable().map((b) => ({ id: b.id, name: b.name }));
    },
    twilightLabel,
    moonPhaseFraction,
    moonPhaseLabel,
    equatorialToAltAz,
    equatorialToAltAzNaive,
    j2000ToAltAz,
    eqjToEnuMatrix,
    eqjUnitFromRaDec,
    rotateVec,
    enuToGalactic,
    enuToGalMatrixFlat,
    altAzToVec3,
    lookBasis,
    fisheyeScreenToDir,
    shortestAzDelta,
    unwrapAzTarget,
    clipHorizonSegment,
    bodyAltAz,
    sunAltAz,
    listBodiesAltAz,
    observerHorizon,
    formatSkyCaption,
    skySnapshot,
  };

  root.CelestialEngine = CelestialEngine;
})(typeof globalThis !== 'undefined' ? globalThis : window);
