import type { PolicyKind } from './types';

export type PrefillPayload = {
  kind?: PolicyKind;
  eventName?: string;
  disasterType?: string;
  state?: string;
  county?: string;
  countyFips?: string;
  incidentBegin?: string;
  femaNumber?: string;
  femaEmDate?: string;
  femaDrDate?: string;
  announcement?: string;
  autoAddCounty?: boolean;
  autoAddAllCounties?: boolean;
  from?: string;
};

function toDateInput(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const s = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  return d.toISOString().slice(0, 10);
}

export function parsePrefillFromSearch(search: string): PrefillPayload | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (![...q.keys()].length) return null;

  const kindRaw = q.get('kind');
  const kind: PolicyKind | undefined =
    kindRaw === 'declared' || kindRaw === 'pending' ? kindRaw : undefined;

  const payload: PrefillPayload = {
    kind,
    eventName: q.get('eventName') || undefined,
    disasterType: q.get('disasterType') || undefined,
    state: (q.get('state') || '').toUpperCase() || undefined,
    county: q.get('county') || undefined,
    countyFips: q.get('countyFips') || undefined,
    incidentBegin: toDateInput(q.get('incidentBegin')),
    femaNumber: q.get('femaNumber') || undefined,
    femaEmDate: toDateInput(q.get('femaEmDate')),
    femaDrDate: toDateInput(q.get('femaDrDate')),
    announcement: q.get('announcement') || undefined,
    autoAddCounty: q.get('autoAddCounty') === '1' || q.get('autoAddCounty') === 'true',
    autoAddAllCounties:
      q.get('autoAddAllCounties') === '1' || q.get('autoAddAllCounties') === 'true',
    from: q.get('from') || undefined,
  };

  // Only real event details count — flags and unrelated query params do not start a hand-off
  const hasAny = Object.entries(payload).some(
    ([k, v]) => k !== 'from' && typeof v === 'string' && v !== ''
  );
  return hasAny ? payload : null;
}

export function normalizeCountyKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/[^a-z0-9]/g, '');
}
