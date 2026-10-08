import type { DemGrid, TrailsPayload } from './types';

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

export function loadTrailsFor(demId: string): Promise<TrailsPayload> {
  let p = trailCache.get(demId);
  if (!p) {
    p = apiOrBaked<TrailsPayload>(`/api/ski/trails/${demId}`, `/data/ski/${demId}-trails.json`);
    p.catch(() => trailCache.delete(demId));
    trailCache.set(demId, p);
  }
  return p;
}
