import type { DemGrid, LatLng, SkiLift, SkiRun } from './types';
import { demHeightFt } from './terrainData';

export type TerrainOverlayMode = 'natural' | 'slope' | 'aspect';

export interface SunState {
  hour: number;
  azimuthDeg: number;
  altitudeDeg: number;
  /** Normalized [x, y, z] light direction in TerrainScene world coordinates (+x East, +y Up, -z North). */
  lightVec: [number, number, number];
  timeLabel: string;
  sunnyAspects: string[];
  shadedAspects: string[];
  summary: string;
}

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const ASPECT_DEG: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

export function formatHourLabel(hour: number): string {
  const whole = Math.floor(hour);
  const mins = Math.round((hour - whole) * 60);
  const h =mins === 60 ? whole + 1 : whole;
  const m = mins === 60 ? 0 : mins;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * Computes mid-winter / spring solar position for California mountains (~35.5° N)
 * and maps it into TerrainScene world space (+X = East, +Y = Up, -Z = North).
 */
export function computeSunState(hour: number, latDeg = 35.5): SunState {
  const clamped = Math.max(6.5, Math.min(17.5, hour));
  const rad = Math.PI / 180;
  // Mid-February solar declination (~ -11 deg) gives crisp winter mountain shadows.
  const decl = -11 * rad;
  const lat = latDeg * rad;
  const hourAngle = (clamped - 12) * 15 * rad;

  const sinAlt =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const altRad = Math.max(0.08, Math.asin(Math.max(-1, Math.min(1, sinAlt))));
  const altitudeDeg = Math.round((altRad / rad) * 10) / 10;

  // Solar azimuth measured clockwise from North (morning = ESE, noon = S, afternoon = WSW)
  const cosAz =
    (Math.sin(decl) - Math.sin(altRad) * Math.sin(lat)) /
    Math.max(1e-5, Math.cos(altRad) * Math.cos(lat));
  let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (hourAngle > 0) azRad = 2 * Math.PI - azRad;
  const azimuthDeg = Math.round(((azRad / rad) + 360) % 360);

  // Convert compass azimuth (0 = N = -Z, 90 = E = +X, 180 = S = +Z) + altitude into unit 3D vector
  const horiz = Math.cos(altRad);
  const lx = Math.sin(azRad) * horiz;
  const ly = Math.sin(altRad);
  const lz = -Math.cos(azRad) * horiz;
  const len = Math.hypot(lx, ly, lz) || 1;

  const sunnyAspects: string[] = [];
  const shadedAspects: string[] = [];
  for (const dir of COMPASS_8) {
    const diff = angleDiffDeg(ASPECT_DEG[dir], azimuthDeg);
    if (diff <= 68) sunnyAspects.push(dir);
    else if (diff >= 115) shadedAspects.push(dir);
  }

  const timeLabel = formatHourLabel(clamped);
  const phase =
    clamped < 9.5
      ? 'Morning sun warming'
      : clamped < 13.5
        ? 'Midday sun on'
        : clamped < 15.8
          ? 'Afternoon sun softening'
          : 'Alpenglow on';
  const summary = `${timeLabel} · ${phase} ${sunnyAspects.slice(0, 3).join('/')} · Cold shade on ${shadedAspects.slice(0, 3).join('/')}`;

  return {
    hour: clamped,
    azimuthDeg,
    altitudeDeg,
    lightVec: [lx / len, ly / len, lz / len],
    timeLabel,
    sunnyAspects,
    shadedAspects,
    summary,
  };
}

export interface RunSamplePoint {
  lat: number;
  lng: number;
  elevFt: number;
  distanceFt: number;
  totalFt: number;
  pitchDeg: number;
  bearingDeg: number;
  lookAtLat: number;
  lookAtLng: number;
  lookAtElevFt: number;
}

function haversineFt(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 20_902_231 * Math.asin(Math.sqrt(h));
}

/**
 * Stitches a run's coordinate paths into a continuous top-to-bottom polyline and samples
 * position, elevation, pitch, and forward look-ahead point at normalized progress t in [0, 1].
 */
export function sampleRunAtProgress(
  run: SkiRun,
  dem: DemGrid | null,
  tInput: number
): RunSamplePoint | null {
  const pts: LatLng[] = [];
  for (const seg of run.paths || []) {
    for (const pt of seg) {
      const prev = pts[pts.length - 1];
      if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) pts.push(pt);
    }
  }
  if (pts.length < 2) return null;

  const elevAt = (lat: number, lng: number, frac: number): number => {
    if (run.profile && run.profile.length >= 2) {
      const totalD = run.profile[run.profile.length - 1][0] || 1;
      const targetD = frac * totalD;
      for (let i = 0; i < run.profile.length - 1; i++) {
        const [d0, z0] = run.profile[i];
        const [d1, z1] = run.profile[i + 1];
        if (targetD <= d1 || i === run.profile.length - 2) {
          const u = d1 > d0 ? Math.max(0, Math.min(1, (targetD - d0) / (d1 - d0))) : 0;
          return z0 + u * (z1 - z0);
        }
      }
    }
    if (dem) return demHeightFt(dem, lat, lng);
    const top = run.topFt ?? 8000;
    const bot = run.bottomFt ?? 7000;
    return top - frac * (top - bot);
  };

  // Ensure path is oriented top-to-bottom
  const firstElev = dem ? demHeightFt(dem, pts[0][0], pts[0][1]) : (run.topFt ?? 8000);
  const lastElev = dem
    ? demHeightFt(dem, pts[pts.length - 1][0], pts[pts.length - 1][1])
    : (run.bottomFt ?? 7000);
  const ordered = firstElev >= lastElev ? pts : [...pts].reverse();

  const cumDist: number[] = [0];
  for (let i = 1; i < ordered.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineFt(ordered[i - 1], ordered[i]));
  }
  const totalFt = Math.max(1, cumDist[cumDist.length - 1]);
  const t = Math.max(0, Math.min(1, tInput));
  const targetDist = t * totalFt;

  const coordAtDist = (d: number): { lat: number; lng: number; segIdx: number } => {
    const clampedD = Math.max(0, Math.min(totalFt, d));
    for (let i = 0; i < cumDist.length - 1; i++) {
      if (clampedD <= cumDist[i + 1] || i === cumDist.length - 2) {
        const span = Math.max(1e-4, cumDist[i + 1] - cumDist[i]);
        const u = Math.max(0, Math.min(1, (clampedD - cumDist[i]) / span));
        return {
          lat: ordered[i][0] + u * (ordered[i + 1][0] - ordered[i][0]),
          lng: ordered[i][1] + u * (ordered[i + 1][1] - ordered[i][1]),
          segIdx: i,
        };
      }
    }
    const last = ordered[ordered.length - 1];
    return { lat: last[0], lng: last[1], segIdx: Math.max(0, ordered.length - 2) };
  };

  const here = coordAtDist(targetDist);
  const aheadDist = Math.min(totalFt, targetDist + Math.max(95, totalFt * 0.08));
  const ahead = coordAtDist(aheadDist > targetDist + 5 ? aheadDist : Math.max(0, targetDist - 60));
  const elevFt = elevAt(here.lat, here.lng, t);
  const aheadFrac = Math.min(1, aheadDist / totalFt);
  const lookAtElevFt = elevAt(ahead.lat, ahead.lng, aheadFrac);

  // Local pitch from window around targetDist
  const d0 = Math.max(0, targetDist - 45);
  const d1 = Math.min(totalFt, targetDist + 45);
  const p0 = coordAtDist(d0);
  const p1 = coordAtDist(d1);
  const z0 = elevAt(p0.lat, p0.lng, d0 / totalFt);
  const z1 = elevAt(p1.lat, p1.lng, d1 / totalFt);
  const horizRun = Math.max(10, d1 - d0);
  const pitchDeg = (Math.atan(Math.abs(z0 - z1) / horizRun) * 180) / Math.PI;

  const cosLat = Math.cos((here.lat * Math.PI) / 180);
  const dy = (ahead.lat - here.lat) * 111_320;
  const dx = (ahead.lng - here.lng) * 111_320 * cosLat;
  const bearingDeg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;

  return {
    lat: here.lat,
    lng: here.lng,
    elevFt,
    distanceFt: targetDist,
    totalFt: run.lengthFt || totalFt,
    pitchDeg: Math.round(pitchDeg * 10) / 10,
    bearingDeg,
    lookAtLat: ahead.lat,
    lookAtLng: ahead.lng,
    lookAtElevFt,
  };
}

/**
 * Finds the upper station of a lift and returns all runs in the resort that can be entered
 * from that lift's top station (or within a short ridge traverse).
 */
export function findRunsOffLift(
  lift: SkiLift,
  runs: SkiRun[],
  dem: DemGrid | null
): { topCoord: LatLng; topElevFt: number; reachableRuns: SkiRun[] } {
  if (!lift.coords.length) {
    return { topCoord: [0, 0], topElevFt: 0, reachableRuns: [] };
  }
  const first = lift.coords[0];
  const last = lift.coords[lift.coords.length - 1];
  const eFirst = dem ? demHeightFt(dem, first[0], first[1]) : (lift.bottomFt ?? 0);
  const eLast = dem ? demHeightFt(dem, last[0], last[1]) : (lift.topFt ?? 10000);
  const topCoord = eLast >= eFirst ? last : first;
  const topElevFt = Math.max(eFirst, eLast, lift.topFt ?? 0);

  const REACH_FT = 1350; // ~410m unload & ridge traverse radius
  const scored: { run: SkiRun; distFt: number }[] = [];

  for (const run of runs) {
    if (lift.resort && run.resort && lift.resort !== run.resort) continue;
    const pts = run.paths.flat();
    if (pts.length < 2) continue;
    // Check distance from lift top to the highest points of the run
    const startA = pts[0];
    const startB = pts[pts.length - 1];
    const dA = haversineFt(topCoord, startA);
    const dB = haversineFt(topCoord, startB);
    const minStartDist = Math.min(dA, dB);
    // Also check if the run passes right by the unload station
    let minAnyDist = minStartDist;
    for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 8))) {
      const d = haversineFt(topCoord, pts[i]);
      if (d < minAnyDist) minAnyDist = d;
    }
    if (minAnyDist <= REACH_FT) {
      scored.push({ run, distFt: minAnyDist });
    }
  }

  scored.sort((a, b) => (b.run.verticalFt ?? 0) - (a.run.verticalFt ?? 0) || a.distFt - b.distFt);
  return {
    topCoord,
    topElevFt,
    reachableRuns: scored.map((s) => s.run),
  };
}

export interface LapChainSummary {
  runs: SkiRun[];
  totalVerticalFt: number;
  totalLengthFt: number;
  maxPitchDeg: number;
  avgPitchDeg: number;
  combinedProfile: [number, number][];
}

export function summarizeLapChain(runs: SkiRun[]): LapChainSummary {
  let totalVerticalFt = 0;
  let totalLengthFt = 0;
  let maxPitchDeg = 0;
  let weightedPitch = 0;
  let pitchWeight = 0;
  const combinedProfile: [number, number][] = [];
  let cursorD = 0;

  for (const r of runs) {
    const vert = r.verticalFt ?? 0;
    const len = r.lengthFt ?? 800;
    totalVerticalFt += vert;
    totalLengthFt += len;
    if ((r.maxPitchDeg ?? 0) > maxPitchDeg) maxPitchDeg = r.maxPitchDeg ?? 0;
    if (r.avgPitchDeg != null) {
      weightedPitch += r.avgPitchDeg * len;
      pitchWeight += len;
    }
    if (r.profile && r.profile.length >= 2) {
      const p0 = r.profile[0][0] || 0;
      for (const [d, z] of r.profile) {
        combinedProfile.push([cursorD + (d - p0), z]);
      }
      cursorD += (r.profile[r.profile.length - 1][0] - p0) || len;
    } else {
      const top = r.topFt ?? 8200;
      const bot = r.bottomFt ?? top - vert;
      combinedProfile.push([cursorD, top]);
      cursorD += len;
      combinedProfile.push([cursorD, bot]);
    }
  }

  return {
    runs,
    totalVerticalFt: Math.round(totalVerticalFt),
    totalLengthFt: Math.round(totalLengthFt),
    maxPitchDeg: Math.round(maxPitchDeg * 10) / 10,
    avgPitchDeg: pitchWeight > 0 ? Math.round((weightedPitch / pitchWeight) * 10) / 10 : 0,
    combinedProfile,
  };
}
