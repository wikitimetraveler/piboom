import type {
  CountyOption,
  ImpactResult,
  PolicyArea,
  PolicyEvent,
  PolicyKind,
  PolicyStatus,
  ZipOption,
} from './types';

const API = '/api/disaster-policy';
const GEO = '/finance/assets/geo';

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { success?: boolean }).success === false) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

function send(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

/** The API stores state, county FIPS/name and ZIP; pick-list labels stay client-side. */
function areaBody(a: PolicyArea) {
  return {
    state: a.state,
    countyCode: a.countyCode,
    countyName: a.countyName,
    zipCode: a.zipCode || null,
    inspectionRequiredAppraisalsOnOrBefore: a.inspectionRequiredAppraisalsOnOrBefore || null,
  };
}

export async function listEvents(params?: { kind?: PolicyKind; status?: PolicyStatus }) {
  const q = new URLSearchParams();
  if (params?.kind) q.set('kind', params.kind);
  if (params?.status) q.set('status', params.status);
  const suffix = q.toString() ? `?${q}` : '';
  const data = await json<{ events: PolicyEvent[] }>(await fetch(`${API}/events${suffix}`));
  return data.events;
}

export async function createEvent(body: Record<string, unknown>, areas: PolicyArea[]) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events`, send('POST', { ...body, areas: areas.map(areaBody) }))
  );
  return data.event;
}

export async function updateEvent(id: string, body: Record<string, unknown>) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}`, send('PATCH', body))
  );
  return data.event;
}

export async function deleteEvent(id: string) {
  return json<{ id: string; deleted: boolean }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
}

export async function appendAreas(id: string, areas: PolicyArea[]) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(
      `${API}/events/${encodeURIComponent(id)}/areas`,
      send('POST', { areas: areas.map(areaBody) })
    )
  );
  return data.event;
}

/** Set (or clear with null) the Incident Period End Date / inspection cutoff on some areas. */
export async function updateAreas(
  id: string,
  patch: {
    areaIds: string[];
    incidentEndDate?: string | null;
    inspectionRequiredAppraisalsOnOrBefore?: string | null;
  }
) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}/areas`, send('PATCH', patch))
  );
  return data.event;
}

export async function deleteArea(eventId: string, areaId: string) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(
      `${API}/events/${encodeURIComponent(eventId)}/areas/${encodeURIComponent(areaId)}`,
      { method: 'DELETE' }
    )
  );
  return data.event;
}

export async function setStatus(id: string, status: PolicyStatus) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}/status`, send('PATCH', { status }))
  );
  return data.event;
}

export async function fetchImpactedLoans(id: string) {
  return json<ImpactResult>(await fetch(`${API}/events/${encodeURIComponent(id)}/impacted-loans`));
}

/** Impacted-loan report for an area list that has not been saved yet. */
export async function previewImpact(areas: PolicyArea[]) {
  return json<ImpactResult>(
    await fetch(`${API}/impact-preview`, send('POST', { areas: areas.map(areaBody) }))
  );
}

export async function fetchFemaCounties(disasterNumber: string) {
  return json<{
    disasterNumber: string;
    counties: Array<{ countyFips: string; countyName: string; state: string }>;
    count: number;
  }>(await fetch(`${API}/fema/${encodeURIComponent(disasterNumber)}/counties`));
}

const countyCache = new Map<string, Promise<CountyOption[]>>();
const zipCache = new Map<string, Promise<Record<string, ZipOption[]>>>();

/** Drop a failed load so the next attempt refetches instead of replaying the rejection. */
function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let hit = cache.get(key);
  if (!hit) {
    hit = load().catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, hit);
  }
  return hit;
}

/** Counties and county equivalents for a state (Census Bureau, via `npm run build:us-geo`). */
export function loadCountiesForState(state: string): Promise<CountyOption[]> {
  const st = state.toUpperCase();
  return cached(countyCache, st, async () => {
    const res = await fetch(`${GEO}/counties/${st}.geojson`);
    if (!res.ok) throw new Error(`No county list for ${st}`);
    const fc = (await res.json()) as {
      features?: Array<{ properties?: { county_fips?: string; name?: string; state_abbr?: string } }>;
    };
    return (fc.features || [])
      .map((f) => ({
        county_fips: String(f.properties?.county_fips || '').padStart(5, '0'),
        name: String(f.properties?.name || ''),
        state_abbr: String(f.properties?.state_abbr || st),
      }))
      .filter((c) => c.county_fips && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** ZIP Codes by county FIPS for a state (Census ZCTA + GeoNames, via `npm run build:us-zips`). */
export function loadZipsForState(state: string): Promise<Record<string, ZipOption[]>> {
  const st = state.toUpperCase();
  return cached(zipCache, st, async () => {
    const res = await fetch(`${GEO}/zips/${st}.json`);
    if (!res.ok) throw new Error(`No ZIP Code list for ${st}`);
    const body = (await res.json()) as { counties?: Record<string, Array<[string, string]>> };
    return Object.fromEntries(
      Object.entries(body.counties || {}).map(([fips, rows]) => [
        fips,
        rows.map(([zip, city]) => ({ zip, city })),
      ])
    );
  });
}
