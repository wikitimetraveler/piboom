import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createEvent,
  fetchImpactedLoans,
  listEvents,
  loadCountiesForState,
  setStatus,
} from './api';
import type {
  CountyOption,
  ImpactedLoan,
  PolicyArea,
  PolicyEvent,
  PolicyKind,
  PolicyStatus,
} from './types';
import { US_STATES } from './types';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [events, setEvents] = useState<PolicyEvent[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind?: 'ok' | 'err' }>({
    text: '',
  });
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<PolicyKind>('declared');
  const [eventName, setEventName] = useState('');
  const [disasterType, setDisasterType] = useState('Hurricane');
  const [femaNumber, setFemaNumber] = useState('');
  const [incidentBegin, setIncidentBegin] = useState(todayIso());
  const [inspectionCutoff, setInspectionCutoff] = useState('');
  const [governorDate, setGovernorDate] = useState('');
  const [femaEmDate, setFemaEmDate] = useState('');
  const [femaDrDate, setFemaDrDate] = useState('');
  const [presidentialDate, setPresidentialDate] = useState('');
  const [amerihomeDate, setAmerihomeDate] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [fundingSuspension, setFundingSuspension] = useState(false);
  const [treasuryHold, setTreasuryHold] = useState(false);

  const [state, setState] = useState('CA');
  const [counties, setCounties] = useState<CountyOption[]>([]);
  const [selectedFips, setSelectedFips] = useState<Set<string>>(new Set());
  const [areas, setAreas] = useState<PolicyArea[]>([]);
  const [countyFilter, setCountyFilter] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loans, setLoans] = useState<ImpactedLoan[]>([]);

  const flash = (text: string, kind?: 'ok' | 'err') => setStatusMsg({ text, kind });

  const refresh = useCallback(async () => {
    const list = await listEvents();
    setEvents(list);
  }, []);

  useEffect(() => {
    refresh().catch((e) => flash(e.message || 'Failed to load events', 'err'));
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setCounties([]);
    setSelectedFips(new Set());
    loadCountiesForState(state)
      .then((rows) => {
        if (!cancelled) setCounties(rows);
      })
      .catch((e) => {
        if (!cancelled) flash(e.message || 'County load failed', 'err');
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const filteredCounties = useMemo(() => {
    const q = countyFilter.trim().toLowerCase();
    if (!q) return counties;
    return counties.filter(
      (c) => c.name.toLowerCase().includes(q) || c.county_fips.includes(q)
    );
  }, [counties, countyFilter]);

  function toggleFips(fips: string) {
    setSelectedFips((prev) => {
      const next = new Set(prev);
      if (next.has(fips)) next.delete(fips);
      else next.add(fips);
      return next;
    });
  }

  function addSelectedCounties() {
    const picked = counties.filter((c) => selectedFips.has(c.county_fips));
    if (!picked.length) {
      flash('Select one or more counties first.', 'err');
      return;
    }
    setAreas((prev) => {
      const existing = new Set(prev.map((a) => `${a.state}:${a.countyCode}`));
      const extras: PolicyArea[] = [];
      for (const c of picked) {
        const key = `${c.state_abbr}:${c.county_fips}`;
        if (existing.has(key)) continue;
        extras.push({
          countyCode: c.county_fips,
          countyName: c.name,
          state: c.state_abbr,
          incidentBeginDate: incidentBegin || null,
          inspectionRequiredAppraisalsOnOrBefore: inspectionCutoff || null,
        });
      }
      return [...prev, ...extras];
    });
    setSelectedFips(new Set());
    flash(`Added counties from ${state}.`, 'ok');
  }

  function removeArea(key: string) {
    setAreas((prev) => prev.filter((a) => `${a.state}:${a.countyCode}` !== key));
  }

  async function submit(asDraft: boolean) {
    if (!eventName.trim()) {
      flash('Event name is required.', 'err');
      return;
    }
    if (!areas.length) {
      flash('Add at least one county.', 'err');
      return;
    }
    setBusy(true);
    try {
      const status: PolicyStatus =
        kind === 'pending' ? (asDraft ? 'draft' : 'active') : 'active';
      const event = await createEvent({
        kind,
        status,
        eventName: eventName.trim(),
        disasterType,
        femaDeclarationNumber: femaNumber || null,
        femaEmergencyDeclarationDate: femaEmDate || null,
        femaMajorDisasterDeclarationDate: femaDrDate || null,
        presidentialDeclarationDate: presidentialDate || null,
        governorDeclarationDate: governorDate || null,
        amerihomeEmergencyDeclarationDate: amerihomeDate || null,
        amerihomeDisasterAnnouncement: announcement || null,
        amerihomeTreasuryHold: kind === 'pending' ? !asDraft || treasuryHold : treasuryHold,
        amerihomeFundingSuspension: fundingSuspension,
        incidentBeginDate: incidentBegin || null,
        areas,
      });
      flash(
        status === 'draft'
          ? `Saved draft “${event.eventName}”.`
          : `Declared ${event.kind} “${event.eventName}”.`,
        'ok'
      );
      setEventName('');
      setAreas([]);
      await refresh();
      setSelectedId(event.id);
      const impact = await fetchImpactedLoans(event.id);
      setLoans(impact.loans);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Save failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    setBusy(true);
    try {
      await setStatus(id, 'active');
      flash('Pending hold activated — Treasury Hold on.', 'ok');
      await refresh();
      const impact = await fetchImpactedLoans(id);
      setLoans(impact.loans);
      setSelectedId(id);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Activate failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function showImpact(id: string) {
    setBusy(true);
    try {
      const impact = await fetchImpactedLoans(id);
      setSelectedId(id);
      setLoans(impact.loans);
      flash(`Impacted loans: ${impact.count}`, 'ok');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Impact query failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dp-shell">
      <p className="mb-2">
        <a className="dp-back" href="/finance/disasters-unified.html">
          <i className="bi-arrow-left" /> Unified Disasters
        </a>
        {' · '}
        <a className="dp-back" href="/finance/disasters-hurricanes.html">
          Hurricane Tracker
        </a>
      </p>

      <header className="dp-hero">
        <h1>
          <i className="bi-clipboard2-check me-2" />
          Disaster Policy Desk
        </h1>
        <p>
          Credit Administration declare flow for <strong>Declared</strong> and{' '}
          <strong>Pending</strong> disasters — retires the Excel file-drop. Hazard feeds stay on
          Unified Disasters; this desk stores policy fields and hold flags.
        </p>
      </header>

      <div className={`dp-status ${statusMsg.kind || ''}`} role="status">
        {statusMsg.text}
      </div>

      <section className="dp-panel">
        <h2>
          <i className="bi-pencil-square me-2" />
          New declaration
        </h2>

        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <label className="form-label small text-muted">Kind</label>
            <select
              className="form-select form-select-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as PolicyKind)}
            >
              <option value="declared">Declared Disaster</option>
              <option value="pending">Pending Natural Disaster</option>
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label small text-muted">Event Name</label>
            <input
              className="form-control form-control-sm"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Hurricane Helene — FL/GA"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small text-muted">Disaster Type</label>
            <input
              className="form-control form-control-sm"
              value={disasterType}
              onChange={(e) => setDisasterType(e.target.value)}
            />
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <label className="form-label small text-muted">Incident Begin Date</label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={incidentBegin}
              onChange={(e) => setIncidentBegin(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">
              Inspection Required for Appraisals Dated on or Before
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={inspectionCutoff}
              onChange={(e) => setInspectionCutoff(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">FEMA Declaration Number</label>
            <input
              className="form-control form-control-sm"
              value={femaNumber}
              onChange={(e) => setFemaNumber(e.target.value)}
              placeholder="DR-xxxx / EM-xxxx"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">AmeriHome Announcement</label>
            <input
              className="form-control form-control-sm"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
            />
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-3">
            <label className="form-label small text-muted">FEMA Emergency Decl. Date</label>
            <input type="date" className="form-control form-control-sm" value={femaEmDate} onChange={(e) => setFemaEmDate(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">FEMA Major Disaster Decl. Date</label>
            <input type="date" className="form-control form-control-sm" value={femaDrDate} onChange={(e) => setFemaDrDate(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Presidential Decl. Date</label>
            <input type="date" className="form-control form-control-sm" value={presidentialDate} onChange={(e) => setPresidentialDate(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Governor Decl. Date</label>
            <input type="date" className="form-control form-control-sm" value={governorDate} onChange={(e) => setGovernorDate(e.target.value)} />
          </div>
        </div>

        <div className="row g-2 mb-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label small text-muted">AmeriHome Emergency Decl. Date</label>
            <input type="date" className="form-control form-control-sm" value={amerihomeDate} onChange={(e) => setAmerihomeDate(e.target.value)} />
          </div>
          <div className="col-md-3 form-check ms-2 mt-4">
            <input
              id="dpTreasury"
              type="checkbox"
              className="form-check-input"
              checked={treasuryHold || (kind === 'pending')}
              onChange={(e) => setTreasuryHold(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="dpTreasury">
              AmeriHome Treasury Hold
            </label>
          </div>
          <div className="col-md-3 form-check mt-4">
            <input
              id="dpFund"
              type="checkbox"
              className="form-check-input"
              checked={fundingSuspension}
              onChange={(e) => setFundingSuspension(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="dpFund">
              AmeriHome Funding Suspension
            </label>
          </div>
        </div>

        <hr className="my-3" />

        <div className="row g-2">
          <div className="col-md-2">
            <label className="form-label small text-muted">State</label>
            <select
              className="form-select form-select-sm"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              {US_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small text-muted">Filter counties</label>
            <input
              className="form-control form-control-sm"
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              placeholder="Name or FIPS"
            />
          </div>
          <div className="col-md-6 d-flex align-items-end gap-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={addSelectedCounties}>
              Add selected counties
            </button>
            <span className="dp-muted">{selectedFips.size} selected · {areas.length} in draft list</span>
          </div>
        </div>

        <div className="dp-county-list mt-2" role="group" aria-label="Counties">
          {filteredCounties.length === 0 ? (
            <div className="dp-muted py-2">Loading counties…</div>
          ) : (
            filteredCounties.map((c) => (
              <label key={c.county_fips}>
                <input
                  type="checkbox"
                  checked={selectedFips.has(c.county_fips)}
                  onChange={() => toggleFips(c.county_fips)}
                />
                <span>
                  {c.name} <span className="text-muted">({c.county_fips})</span>
                </span>
              </label>
            ))
          )}
        </div>

        {areas.length > 0 && (
          <div className="dp-chips" aria-label="Selected areas">
            {areas.map((a) => {
              const key = `${a.state}:${a.countyCode}`;
              return (
                <span className="dp-chip" key={key}>
                  {a.countyName}, {a.state}
                  <button type="button" aria-label={`Remove ${a.countyName}`} onClick={() => removeArea(key)}>
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="d-flex flex-wrap gap-2 mt-3">
          {kind === 'pending' && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={busy}
              onClick={() => submit(true)}
            >
              Save draft
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => submit(false)}
          >
            {kind === 'pending' ? 'Declare Pending Hold' : 'Declare Disaster'}
          </button>
        </div>
      </section>

      <section className="dp-panel">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="mb-0">
            <i className="bi-journal-text me-2" />
            Policy events
          </h2>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => refresh()}>
            Refresh
          </button>
        </div>
        <div className="table-responsive">
          <table className="table dp-table align-middle mb-0">
            <thead>
              <tr>
                <th>Event</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Areas</th>
                <th>Holds</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No policy events yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className={selectedId === ev.id ? 'table-active' : undefined}>
                    <td>
                      <strong>{ev.eventName}</strong>
                      <div className="dp-muted">{ev.incidentBeginDate || '—'} · {ev.femaDeclarationNumber || 'no FEMA #'}</div>
                    </td>
                    <td>
                      <span className={`dp-badge ${ev.kind}`}>{ev.kind}</span>
                    </td>
                    <td>
                      <span className={`dp-badge ${ev.status}`}>{ev.status}</span>
                    </td>
                    <td>{ev.areas.length}</td>
                    <td className="small">
                      {ev.amerihomeTreasuryHold ? 'Treasury' : '—'}
                      {ev.amerihomeFundingSuspension ? ' · Funding' : ''}
                    </td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => showImpact(ev.id)}>
                        Loans
                      </button>
                      {ev.kind === 'pending' && ev.status === 'draft' && (
                        <button type="button" className="btn btn-sm btn-warning" onClick={() => activate(ev.id)}>
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dp-panel">
        <h2>
          <i className="bi-house-door me-2" />
          Impacted loans {selectedId ? `(${loans.length})` : ''}
        </h2>
        <p className="dp-muted mb-2">
          Matched from the mock pipeline by state + county. Ops triage score is shown for context — it is not the policy hold.
        </p>
        <div className="table-responsive">
          <table className="table dp-table align-middle mb-0">
            <thead>
              <tr>
                <th>Loan</th>
                <th>Property</th>
                <th>County</th>
                <th>Milestone</th>
                <th>Triage</th>
                <th>Hold</th>
              </tr>
            </thead>
            <tbody>
              {!selectedId ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">
                    Select an event and click Loans.
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-3">
                    No matching loans in pipeline for these counties.
                  </td>
                </tr>
              ) : (
                loans.map((ln) => (
                  <tr key={ln.id}>
                    <td>{ln.loanNumber}</td>
                    <td>
                      {ln.propertyAddress}
                      <div className="dp-muted">
                        {ln.city}, {ln.state} {ln.zipCode}
                      </div>
                    </td>
                    <td>
                      {ln.county}, {ln.state}
                    </td>
                    <td>{ln.milestone}</td>
                    <td>{Number(ln.disasterRiskScore || 0).toFixed(1)}</td>
                    <td className="small">
                      {ln.treasuryHold ? 'Treasury' : '—'}
                      {ln.fundingSuspension ? ' · Funding' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
