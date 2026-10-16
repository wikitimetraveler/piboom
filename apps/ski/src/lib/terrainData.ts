import type { DemGrid, LatLng, SkiLift, SkiRun, TrailsPayload } from './types';

const AREA_NAMES: Record<string, string> = {
  'mt-baldy': 'Mt. Baldy',
  wrightwood: 'Wrightwood',
  'big-bear': 'Big Bear',
  'snow-valley': 'Snow Valley',
  mammoth: 'Mammoth',
  june: 'June',
};

export function areaName(demId: string): string {
  return AREA_NAMES[demId] || demId;
}

const demCache = new Map<string, Promise<DemGrid>>();
const trailCache = new Map<string, Promise<TrailsPayload>>();

async function apiOrBaked<T>(api: string, baked: string): Promise<T> {
  try {
    const res = await fetch(api);
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      if (data && !data.error) return data as T;
    }
  } catch {
    /* fall through to baked file */
  }
  const res = await fetch(baked);
  if (!res.ok) throw new Error(`Could not load ${baked}`);
  return (await res.json()) as T;
}

export function loadDemGrid(demId: string): Promise<DemGrid> {
  let p = demCache.get(demId);
  if (!p) {
    p = apiOrBaked<DemGrid>(`/api/ski/dem/${demId}`, `/data/ski/${demId}-dem.json`);
    p.catch(() => demCache.delete(demId));
    demCache.set(demId, p);
  }
  return p;
}

/** Nearest-sample DEM height in feet (good enough to aim a camera). */
export function demHeightFt(dem: DemGrid, lat: number, lng: number): number {
  const fx = Math.min(1, Math.max(0, (lng - dem.west) / (dem.east - dem.west)));
  const fy = Math.min(1, Math.max(0, (dem.north - lat) / (dem.north - dem.south)));
  const c = Math.round(fx * (dem.cols - 1));
  const r = Math.round(fy * (dem.rows - 1));
  return dem.heights[(dem.rows - 1 - r) * dem.cols + c] ?? 0;
}

export interface BaseView {
  lat: number;
  lng: number;
  /** Compass bearing from the base up toward the top of the lifts. */
  heading: number;
  /** Straight-line meters from the base to the top station. */
  reachM: number;
}

const LIFT_LINK_M = 1500;

/** Lift ends of the largest group of lifts whose stations sit within LIFT_LINK_M of each other. */
function mainLiftEnds(lifts: SkiLift[]): LatLng[] {
  const pairs: LatLng[][] = lifts.filter((l) => l.coords.length >= 2).map((l) => [l.coords[0], l.coords[l.coords.length - 1]]);
  if (!pairs.length) return [];
  const kx = 111_320 * Math.cos(pairs[0][0][0] * (Math.PI / 180));
  const near = (a: LatLng, b: LatLng) => Math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * kx) <= LIFT_LINK_M;
  const group = pairs.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])));
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      if (pairs[i].some((a) => pairs[j].some((b) => near(a, b)))) group[root(i)] = root(j);
    }
  }
  const sizes = new Map<number, number>();
  for (let i = 0; i < pairs.length; i++) sizes.set(root(i), (sizes.get(root(i)) || 0) + 1);
  const biggest = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return pairs.filter((_, i) => root(i) === biggest).flat();
}

/**
 * The resort's lowest lift station — where the lodge and parking lots sit — and the bearing from it up the
 * mountain. Lift ends are measured on the DEM because OSM does not promise which end of a lift way is the bottom,
 * and stray lifts away from the main cluster are ignored (OSM tags e.g. Big Bear's Alpine Slide as Snow Summit).
 */
export function resortBaseView(dem: DemGrid, lifts: SkiLift[], runs: SkiRun[]): BaseView | null {
  let ends = mainLiftEnds(lifts);
  if (!ends.length) ends = runs.flatMap((r) => r.paths.filter((p) => p.length >= 2).flatMap((p) => [p[0], p[p.length - 1]]));
  if (!ends.length) return null;
  let low = ends[0];
  let high = ends[0];
  let lowFt = Infinity;
  let highFt = -Infinity;
  for (const pt of ends) {
    const ft = demHeightFt(dem, pt[0], pt[1]);
    if (ft < lowFt) [low, lowFt] = [pt, ft];
    if (ft > highFt) [high, highFt] = [pt, ft];
  }
  const cosLat = Math.cos(low[0] * (Math.PI / 180));
  const dy = (high[0] - low[0]) * 111_320;
  const dx = (high[1] - low[1]) * 111_320 * cosLat;
  const heading = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return { lat: low[0], lng: low[1], heading, reachM: Math.hypot(dx, dy) };
}

export function loadTrailsFor(demId: string): Promise<TrailsPayload> {
  let p = trailCache.get(demId);
  if (!p) {
    p = apiOrBaked<TrailsPayload>(`/api/ski/trails/${demId}`, `/data/ski/${demId}-trails.json`);
    p.catch(() => trailCache.delete(demId));
    trailCache.set(demId, p);
  }
  return p;
}
