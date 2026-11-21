import type { CountyOption, ImpactedLoan, PolicyEvent, PolicyKind, PolicyStatus } from './types';

const API = '/api/disaster-policy';

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { success?: boolean }).success === false) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function listEvents(params?: { kind?: PolicyKind; status?: PolicyStatus }) {
  const q = new URLSearchParams();
  if (params?.kind) q.set('kind', params.kind);
  if (params?.status) q.set('status', params.status);
  const suffix = q.toString() ? `?${q}` : '';
  const data = await json<{ events: PolicyEvent[] }>(await fetch(`${API}/events${suffix}`));
  return data.events;
}

export async function createEvent(body: Record<string, unknown>) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return data.event;
}

export async function updateEvent(id: string, body: Record<string, unknown>) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return data.event;
}

export async function deleteEvent(id: string) {
  const data = await json<{ id: string; deleted: boolean }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
  return data;
}

export async function appendAreas(id: string, areas: unknown[]) {
  const data = await json<{ event: PolicyEvent }>(
    await fetch(`${API}/events/${encodeURIComponent(id)}/areas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areas }),
    })
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
    await fetch(`${API}/events/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  );
  return data.event;
}

export async function fetchImpactedLoans(id: string) {
  const data = await json<{
    loans: ImpactedLoan[];
    count: number;
    matchCounts?: { byFips: number; byName: number };
  }>(await fetch(`${API}/events/${encodeURIComponent(id)}/impacted-loans`));
  return data;
}

export async function fetchFemaCounties(disasterNumber: string) {
  const data = await json<{
    disasterNumber: string;
    counties: Array<{ countyFips: string; countyName: string; state: string }>;
    count: number;
  }>(await fetch(`${API}/fema/${encodeURIComponent(disasterNumber)}/counties`));
  return data;
}

export async function loadCountiesForState(state: string): Promise<CountyOption[]> {
  const st = state.toUpperCase();
  const res = await fetch(`/finance/assets/geo/counties/${st}.geojson`);
  if (!res.ok) throw new Error(`No county geo for ${st}`);
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
}
