import type { PolicyKind } from './types';

export type PrefillPayload = {
  kind?: PolicyKind;
  eventName?: string;
  disasterType?: string;
  state?: string;
  county?: string;
  countyFips?: string;
  incidentBegin?: string;
  governorDate?: string;
  femaNumber?: string;
  femaEmDate?: string;
  femaDrDate?: string;
  announcement?: string;
  autoAddCounty?: boolean;
  autoAddAllCounties?: boolean;
  from?: string;
};

export type BriefingItem = {
  source?: string;
  eventType?: string;
  title?: string;
  location?: string;
  state?: string;
  severity?: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
  disasterNumber?: string | null;
  magnitude?: number | null;
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

export function mapDisasterType(eventType: string | null | undefined, source?: string | null): string {
  const t = String(eventType || '').toLowerCase();
  const src = String(source || '').toLowerCase();
  if (/hurricane|tropical|typhoon|cyclone/.test(t)) return 'Hurricane';
  if (/flood|flash flood|coastal flood/.test(t)) return 'Flood';
  if (/fire|wildfire|firms/.test(t) || src === 'firms') return 'Wildfire';
  if (/earthquake|quake/.test(t) || src === 'usgs') return 'Earthquake';
  if (/tornado/.test(t)) return 'Tornado';
  if (/freeze|winter|ice|snow|blizzard/.test(t)) return 'Winter Storm';
  if (/wind|high wind/.test(t)) return 'High Wind';
  if (t) return t.replace(/\b\w/g, (c) => c.toUpperCase());
  return 'Natural Disaster';
}

export function inferKind(source: string | null | undefined): PolicyKind {
  return String(source || '').toLowerCase() === 'fema' ? 'declared' : 'pending';
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
    governorDate: toDateInput(q.get('governorDate') || q.get('governorDeclarationDate')),
    femaNumber: q.get('femaNumber') || undefined,
    femaEmDate: toDateInput(q.get('femaEmDate')),
    femaDrDate: toDateInput(q.get('femaDrDate')),
    announcement: q.get('announcement') || undefined,
    autoAddCounty: q.get('autoAddCounty') === '1' || q.get('autoAddCounty') === 'true',
    autoAddAllCounties:
      q.get('autoAddAllCounties') === '1' || q.get('autoAddAllCounties') === 'true',
    from: q.get('from') || undefined,
  };

  const hasAny = Object.entries(payload).some(
    ([k, v]) => k !== 'from' && k !== 'autoAddCounty' && v != null && v !== ''
  );
  return hasAny ? payload : null;
}

export function briefingItemToPrefill(item: BriefingItem): PrefillPayload {
  const source = item.source || '';
  const location = String(item.location || '');
  const stateMatch = location.match(/\b([A-Z]{2})\b/);
  const countyPart = location.includes(',')
    ? location.split(',')[0].trim().replace(/\s+County$/i, '')
    : '';

  let femaEmDate = '';
  let femaDrDate = '';
  const num = item.disasterNumber ? String(item.disasterNumber) : '';
  const begin = toDateInput(item.startedAt);
  if (num && /^EM/i.test(num)) femaEmDate = begin;
  if (num && /^DR/i.test(num)) femaDrDate = begin;

  return {
    kind: inferKind(source),
    eventName: item.title || 'Disaster event',
    disasterType: mapDisasterType(item.eventType, source),
    state: (item.state || stateMatch?.[1] || '').toUpperCase() || undefined,
    county: countyPart || undefined,
    incidentBegin: begin || undefined,
    femaNumber: num || undefined,
    femaEmDate: femaEmDate || undefined,
    femaDrDate: femaDrDate || undefined,
    autoAddCounty: true,
    from: 'briefing',
  };
}

export function normalizeCountyKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/[^a-z0-9]/g, '');
}
