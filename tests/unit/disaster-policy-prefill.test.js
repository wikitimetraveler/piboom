/**
 * Mirrors apps/disaster-policy/src/prefill.ts URL + briefing mapping (kept in sync for CI).
 */
function toDateInput(value) {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const s = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  return d.toISOString().slice(0, 10);
}

function parsePrefillFromSearch(search) {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (![...q.keys()].length) return null;
  const kindRaw = q.get('kind');
  const kind = kindRaw === 'declared' || kindRaw === 'pending' ? kindRaw : undefined;
  const payload = {
    kind,
    eventName: q.get('eventName') || undefined,
    disasterType: q.get('disasterType') || undefined,
    state: (q.get('state') || '').toUpperCase() || undefined,
    county: q.get('county') || undefined,
    countyFips: q.get('countyFips') || undefined,
    incidentBegin: toDateInput(q.get('incidentBegin')),
    femaNumber: q.get('femaNumber') || undefined,
    autoAddCounty: q.get('autoAddCounty') === '1' || q.get('autoAddCounty') === 'true',
    from: q.get('from') || undefined,
  };
  const hasAny = Object.entries(payload).some(
    ([k, v]) => k !== 'from' && k !== 'autoAddCounty' && v != null && v !== ''
  );
  return hasAny ? payload : null;
}

describe('disaster-policy prefill URL', () => {
  test('parses Unified Disasters handoff query', () => {
    const p = parsePrefillFromSearch(
      '?from=unified&kind=pending&eventName=Flood%20Warning&disasterType=Flood&state=fl&county=Brevard&countyFips=12009&incidentBegin=2026-11-19&autoAddCounty=1'
    );
    expect(p).toMatchObject({
      from: 'unified',
      kind: 'pending',
      eventName: 'Flood Warning',
      disasterType: 'Flood',
      state: 'FL',
      county: 'Brevard',
      countyFips: '12009',
      incidentBegin: '2026-11-19',
      autoAddCounty: true,
    });
  });

  test('returns null for empty search', () => {
    expect(parsePrefillFromSearch('')).toBeNull();
    expect(parsePrefillFromSearch('?')).toBeNull();
  });
});
