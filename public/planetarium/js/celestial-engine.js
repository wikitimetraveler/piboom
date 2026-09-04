/**
 * CelestialEngine — astronomy-engine wrapper for the planetarium dome.
 * Expects globalThis.Astronomy (browser UMD or Jest require).
 * Development work by David Lane
 */
(function (root) {
  'use strict';

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

  /** Equatorial J2000 RA/Dec (degrees) → alt/az (degrees). Az 0° N, 90° E. */
  function equatorialToAltAz(raDeg, decDeg, date, observer) {
    const Astronomy = getAstronomy();
    const obs = makeObserver(observer);
    const time = asDate(date);
    const hor = Astronomy.Horizon(time, obs, raDegToHours(raDeg), Number(decDeg), 'normal');
    return { alt: hor.altitude, az: norm360(hor.azimuth) };
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
    bodyAltAz,
    sunAltAz,
    listBodiesAltAz,
    observerHorizon,
    formatSkyCaption,
    skySnapshot,
  };

  root.CelestialEngine = CelestialEngine;
})(typeof globalThis !== 'undefined' ? globalThis : window);
