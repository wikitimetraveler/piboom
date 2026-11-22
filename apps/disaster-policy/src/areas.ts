import type { PolicyArea } from './types';

export function areaKey(a: PolicyArea): string {
  return `${a.state}:${a.countyCode}:${a.zipCode || ''}`;
}

export function areaLabel(a: PolicyArea): string {
  if (!a.zipCode) return `${a.countyName}, ${a.state}`;
  return a.zipCity ? `${a.zipCode} · ${a.zipCity}, ${a.state}` : `${a.zipCode}, ${a.state}`;
}

export function countAreas(areas: PolicyArea[]) {
  const zips = areas.filter((a) => a.zipCode).length;
  return { counties: areas.length - zips, zips };
}

export function areaCountText(areas: PolicyArea[]): string {
  const { counties, zips } = countAreas(areas);
  const parts = [];
  if (counties) parts.push(`${counties} ${counties === 1 ? 'county' : 'counties'}`);
  if (zips) parts.push(`${zips} ZIP ${zips === 1 ? 'Code' : 'Codes'}`);
  return parts.join(' · ') || 'No areas';
}

export function sortAreas(areas: PolicyArea[]): PolicyArea[] {
  return [...areas].sort(
    (a, b) =>
      a.state.localeCompare(b.state) ||
      a.countyName.localeCompare(b.countyName) ||
      (a.zipCode || '').localeCompare(b.zipCode || '')
  );
}

/** True when the list already takes in this area: the same ZIP, or the whole county it sits in. */
export function isCovered(listed: PolicyArea[], area: PolicyArea): boolean {
  return listed.some(
    (a) =>
      a.state === area.state &&
      ((!a.zipCode && a.countyCode === area.countyCode) ||
        Boolean(area.zipCode && a.zipCode === area.zipCode))
  );
}

/**
 * Add areas to a list without overlap: anything already covered is skipped, and adding a whole
 * county absorbs that county's individual ZIPs.
 */
export function mergeAreas(current: PolicyArea[], incoming: PolicyArea[]) {
  let next = [...current];
  let added = 0;
  let covered = 0;
  for (const area of incoming) {
    if (isCovered(next, area)) {
      covered += 1;
      continue;
    }
    if (!area.zipCode) {
      next = next.filter(
        (a) => !(a.zipCode && a.state === area.state && a.countyCode === area.countyCode)
      );
    }
    next.push(area);
    added += 1;
  }
  return { areas: next, added, covered };
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An area leaves its incident period on its Incident Period End Date. */
export function areaEnded(a: PolicyArea, today = todayIso()): boolean {
  return Boolean(a.incidentEndDate && a.incidentEndDate <= today);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
