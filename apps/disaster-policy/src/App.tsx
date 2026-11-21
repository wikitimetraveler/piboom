import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appendAreas,
  createEvent,
  deleteArea,
  deleteEvent,
  fetchFemaCounties,
  fetchImpactedLoans,
  listEvents,
  loadCountiesForState,
  setStatus,
  updateEvent,
} from './api';
import {
  briefingItemToPrefill,
  normalizeCountyKey,
  parsePrefillFromSearch,
  type BriefingItem,
  type PrefillPayload,
} from './prefill';
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

type BriefingSummary = {
  totalEvents?: number;
  bySource?: Record<string, number>;
  failures?: Array<{ source: string; error?: string }>;
};

type PrefillNotice = {
  from: string;
  sourceLabel: string;
};

type DeskConfirm = {
  tone: 'end' | 'delete';
  title: string;
  kicker: string;
  eventName: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

function prefillSourceLabel(from?: string): string {
  if (from === 'unified') return 'Unified Disasters';
  if (from === 'briefing') return 'Live briefing';
  return from ? String(from) : 'feed';
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
  const [acmeDate, setAcmeDate] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [fundingSuspension, setFundingSuspension] = useState(false);
  const [treasuryHold, setTreasuryHold] = useState(false);

  const [state, setState] = useState('CA');
  const [counties, setCounties] = useState<CountyOption[]>([]);
  const [selectedFips, setSelectedFips] = useState<Set<string>>(new Set());
  const [areas, setAreas] = useState<PolicyArea[]>([]);
  const [countyFilter, setCountyFilter] = useState('');
  const pendingCountyRef = useRef<{ fips?: string; name?: string; autoAdd?: boolean } | null>(null);
  const pendingAllCountiesRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listKind, setListKind] = useState<'' | PolicyKind>('');
  const [listStatus, setListStatus] = useState<'' | PolicyStatus>('');
  const [loans, setLoans] = useState<ImpactedLoan[]>([]);
  const [matchCounts, setMatchCounts] = useState<{ byFips: number; byName: number } | null>(null);

  const [briefingBusy, setBriefingBusy] = useState(false);
  const [briefingError, setBriefingError] = useState('');
  const [briefingGeneratedAt, setBriefingGeneratedAt] = useState('');
  const [briefingSummary, setBriefingSummary] = useState<BriefingSummary | null>(null);
  const [briefingHighlights, setBriefingHighlights] = useState<BriefingItem[]>([]);
  const [briefingFema, setBriefingFema] = useState<BriefingItem[]>([]);
  const [prefillNotice, setPrefillNotice] = useState<PrefillNotice | null>(null);
  const [deskConfirm, setDeskConfirm] = useState<DeskConfirm | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);
  const eventNameRef = useRef<HTMLInputElement | null>(null);

  const flash = (text: string, kind?: 'ok' | 'err') => setStatusMsg({ text, kind });

  const applyPrefill = useCallback((payload: PrefillPayload, note?: string) => {
    if (payload.kind) setKind(payload.kind);
    if (payload.eventName) setEventName(payload.eventName);
    if (payload.disasterType) setDisasterType(payload.disasterType);
    if (payload.incidentBegin) setIncidentBegin(payload.incidentBegin);
    if (payload.femaNumber) setFemaNumber(payload.femaNumber);
    if (payload.governorDate) setGovernorDate(payload.governorDate);
    if (payload.femaEmDate) setFemaEmDate(payload.femaEmDate);
    if (payload.femaDrDate) setFemaDrDate(payload.femaDrDate);
    if (payload.announcement) setAnnouncement(payload.announcement);
    if (payload.state && US_STATES.includes(payload.state as (typeof US_STATES)[number])) {
      setState(payload.state);
    }
    if (payload.county) setCountyFilter(payload.county);
    pendingCountyRef.current = {
      fips: payload.countyFips || undefined,
      name: payload.county || undefined,
      autoAdd: payload.autoAddCounty !== false && !payload.autoAddAllCounties,
    };
    if (payload.autoAddAllCounties && payload.femaNumber) {
      pendingAllCountiesRef.current = payload.femaNumber;
    }

    const hasAdvanced =
      Boolean(payload.femaEmDate) ||
      Boolean(payload.femaDrDate) ||
      Boolean(payload.announcement) ||
      Boolean(payload.femaNumber);
    if (hasAdvanced) setAdvancedOpen(true);

    setPrefillNotice({
      from: payload.from || 'feed',
      sourceLabel: prefillSourceLabel(payload.from),
    });
    flash(note || `Prefill loaded${payload.from ? ` from ${payload.from}` : ''}. Review and declare.`, 'ok');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => eventNameRef.current?.focus(), 280);
  }, []);

  const refresh = useCallback(async () => {
    const list = await listEvents({
      kind: listKind || undefined,
      status: listStatus || undefined,
    });
    setEvents(list);
  }, [listKind, listStatus]);

  useEffect(() => {
    refresh().catch((e) => flash(e.message || 'Failed to load events', 'err'));
  }, [refresh]);

  function clearForm(keepKind = false) {
    setEditingId(null);
    if (!keepKind) setKind('declared');
    setEventName('');
    setDisasterType('Hurricane');
    setFemaNumber('');
    setIncidentBegin(todayIso());
    setInspectionCutoff('');
    setGovernorDate('');
    setFemaEmDate('');
    setFemaDrDate('');
    setPresidentialDate('');
    setAcmeDate('');
    setAnnouncement('');
    setFundingSuspension(false);
    setTreasuryHold(false);
    setAreas([]);
    setSelectedFips(new Set());
    setCountyFilter('');
    setPrefillNotice(null);
    setAdvancedOpen(false);
  }

  function loadEventIntoForm(ev: PolicyEvent) {
    setEditingId(ev.id);
    setSelectedId(ev.id);
    setKind(ev.kind);
    setEventName(ev.eventName || '');
    setDisasterType(ev.disasterType || 'Hurricane');
    setFemaNumber(ev.femaDeclarationNumber || '');
    setIncidentBegin(ev.incidentBeginDate || todayIso());
    setGovernorDate(ev.governorDeclarationDate || '');
    setFemaEmDate(ev.femaEmergencyDeclarationDate || '');
    setFemaDrDate(ev.femaMajorDisasterDeclarationDate || '');
    setPresidentialDate(ev.presidentialDeclarationDate || '');
    setAcmeDate(ev.acmeEmergencyDeclarationDate || '');
    setAnnouncement(ev.acmeDisasterAnnouncement || '');
    setTreasuryHold(Boolean(ev.acmeTreasuryHold));
    setFundingSuspension(Boolean(ev.acmeFundingSuspension));
    setAreas(
      (ev.areas || []).map((a) => ({
        id: a.id,
        countyCode: a.countyCode,
        countyName: a.countyName,
        state: a.state,
        zipCode: a.zipCode,
        incidentBeginDate: a.incidentBeginDate,
        incidentEndDate: a.incidentEndDate,
        inspectionRequiredAppraisalsOnOrBefore: a.inspectionRequiredAppraisalsOnOrBefore,
      }))
    );
    if (ev.areas[0]?.state) setState(ev.areas[0].state);
    setAdvancedOpen(true);
    setPrefillNotice(null);
    flash(`Editing “${ev.eventName}”. Save changes or cancel.`, 'ok');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => eventNameRef.current?.focus(), 200);
  }

  useEffect(() => {
    const payload = parsePrefillFromSearch(window.location.search);
    if (!payload) return;
    applyPrefill(payload, `Prefill from Unified Disasters — review counties, then Save draft / Declare.`);
    // Drop query so refresh does not re-apply; keep history entry clean.
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.pathname);
  }, [applyPrefill]);

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

  useEffect(() => {
    const pending = pendingCountyRef.current;
    if (!pending || !counties.length) return;
    const byFips = pending.fips
      ? counties.find((c) => c.county_fips === String(pending.fips).padStart(5, '0'))
      : null;
    const byName = pending.name
      ? counties.find((c) => normalizeCountyKey(c.name) === normalizeCountyKey(pending.name || ''))
      : null;
    const match = byFips || byName;
    if (!match) return;

    setSelectedFips(new Set([match.county_fips]));
    setCountyFilter(match.name);
    if (pending.autoAdd) {
      setAreas((prev) => {
        const key = `${match.state_abbr}:${match.county_fips}`;
        if (prev.some((a) => `${a.state}:${a.countyCode}` === key)) return prev;
        return [
          ...prev,
          {
            countyCode: match.county_fips,
            countyName: match.name,
            state: match.state_abbr,
            incidentBeginDate: incidentBegin || null,
            inspectionRequiredAppraisalsOnOrBefore: inspectionCutoff || null,
          },
        ];
      });
    }
    pendingCountyRef.current = null;
  }, [counties, incidentBegin, inspectionCutoff]);

  useEffect(() => {
    const num = pendingAllCountiesRef.current;
    if (!num) return;
    pendingAllCountiesRef.current = null;
    addAllFemaCounties(num).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when prefill sets FEMA all-counties
  }, [femaNumber]);

  const loadBriefing = useCallback(async () => {
    setBriefingBusy(true);
    setBriefingError('');
    try {
      const res = await fetch('/api/disasters/daily-briefing?days=7&includeFirms=true');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const body = data.data || {};
      setBriefingGeneratedAt(body.generatedAt || '');
      setBriefingSummary(body.summary || null);
      setBriefingHighlights(Array.isArray(body.highlights) ? body.highlights : []);
      setBriefingFema(Array.isArray(body.sources?.fema) ? body.sources.fema.slice(0, 15) : []);
    } catch (e) {
      setBriefingError(e instanceof Error ? e.message : 'Briefing failed');
    } finally {
      setBriefingBusy(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing().catch(() => {});
  }, [loadBriefing]);

  useEffect(() => {
    if (!deskConfirm) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setDeskConfirm(null);
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [deskConfirm]);

  const filteredCounties = useMemo(() => {
    const q = countyFilter.trim().toLowerCase();
    if (!q) return counties;
    return counties.filter(
      (c) => c.name.toLowerCase().includes(q) || c.county_fips.includes(q)
    );
  }, [counties, countyFilter]);

  const briefingRows = briefingFema.length ? briefingFema : briefingHighlights;

  const reviewChecks = useMemo(() => {
    return [
      {
        id: 'governor',
        label: 'Governor declaration date (step 1)',
        ok: Boolean(governorDate),
      },
      { id: 'name', label: 'Event name', ok: Boolean(eventName.trim()) },
      { id: 'begin', label: 'Incident begin date', ok: Boolean(incidentBegin) },
      { id: 'counties', label: 'At least one county in draft list', ok: areas.length > 0 },
      {
        id: 'holds',
        label: kind === 'pending' ? 'Pending hold flags (look once)' : 'Hold flags (look once)',
        ok: true,
        soft: true,
      },
    ];
  }, [areas.length, eventName, governorDate, incidentBegin, kind]);

  const readyToDeclare = reviewChecks.filter((c) => !c.soft).every((c) => c.ok);

  /** Latest governor declaration per state, newest date first. */
  const governorByState = useMemo(() => {
    const latest = new Map<
      string,
      { state: string; date: string; eventId: string; eventName: string; kind: PolicyKind; status: PolicyStatus }
    >();
    for (const ev of events) {
      const date = String(ev.governorDeclarationDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const states = [...new Set((ev.areas || []).map((a) => String(a.state || '').toUpperCase()).filter(Boolean))];
      for (const st of states) {
        const prev = latest.get(st);
        if (!prev || date > prev.date) {
          latest.set(st, {
            state: st,
            date,
            eventId: ev.id,
            eventName: ev.eventName,
            kind: ev.kind,
            status: ev.status,
          });
        }
      }
    }
    return [...latest.values()].sort((a, b) => b.date.localeCompare(a.date) || a.state.localeCompare(b.state));
  }, [events]);

  function toggleFips(fips: string) {
    setSelectedFips((prev) => {
      const next = new Set(prev);
      if (next.has(fips)) next.delete(fips);
      else next.add(fips);
      return next;
    });
  }

  function mergeAreas(nextAreas: PolicyArea[]) {
    setAreas((prev) => {
      const existing = new Set(prev.map((a) => `${a.state}:${a.countyCode}`));
      const extras = nextAreas.filter((a) => !existing.has(`${a.state}:${a.countyCode}`));
      return extras.length ? [...prev, ...extras] : prev;
    });
  }

  function addSelectedCounties() {
    const picked = counties.filter((c) => selectedFips.has(c.county_fips));
    if (!picked.length) {
      flash('Select one or more counties first.', 'err');
      return;
    }
    mergeAreas(
      picked.map((c) => ({
        countyCode: c.county_fips,
        countyName: c.name,
        state: c.state_abbr,
        incidentBeginDate: incidentBegin || null,
        inspectionRequiredAppraisalsOnOrBefore: inspectionCutoff || null,
      }))
    );
    setSelectedFips(new Set());
    flash(`Added counties from ${state}.`, 'ok');
  }

  async function addAllFemaCounties(disasterNumber = femaNumber) {
    const num = String(disasterNumber || '').trim();
    if (!num) {
      flash('Enter a FEMA declaration number first.', 'err');
      return;
    }
    setBusy(true);
    try {
      const data = await fetchFemaCounties(num);
      if (!data.counties.length) {
        flash(`No FEMA counties found in DB for ${num}. Pull FEMA sources on Unified Disasters first.`, 'err');
        return;
      }
      mergeAreas(
        data.counties.map((c) => ({
          countyCode: c.countyFips,
          countyName: c.countyName,
          state: c.state,
          incidentBeginDate: incidentBegin || null,
          inspectionRequiredAppraisalsOnOrBefore: inspectionCutoff || null,
        }))
      );
      const states = [...new Set(data.counties.map((c) => c.state))];
      if (states.length === 1) setState(states[0]);
      flash(`Added ${data.counties.length} counties for ${data.disasterNumber}.`, 'ok');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'FEMA county load failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  function removeArea(key: string) {
    const area = areas.find((a) => `${a.state}:${a.countyCode}` === key);
    if (editingId && area?.id) {
      setBusy(true);
      deleteArea(editingId, area.id)
        .then((ev) => {
          setAreas(ev.areas);
          flash(`Removed ${area.countyName}, ${area.state}.`, 'ok');
          return refresh();
        })
        .catch((e) => flash(e instanceof Error ? e.message : 'Remove county failed', 'err'))
        .finally(() => setBusy(false));
      return;
    }
    setAreas((prev) => prev.filter((a) => `${a.state}:${a.countyCode}` !== key));
  }

  function dismissPrefill() {
    setPrefillNotice(null);
  }

  function eventPayload(status: PolicyStatus) {
    return {
      kind,
      status,
      eventName: eventName.trim(),
      disasterType,
      femaDeclarationNumber: femaNumber || null,
      femaEmergencyDeclarationDate: femaEmDate || null,
      femaMajorDisasterDeclarationDate: femaDrDate || null,
      presidentialDeclarationDate: presidentialDate || null,
      governorDeclarationDate: governorDate || null,
      acmeEmergencyDeclarationDate: acmeDate || null,
      acmeDisasterAnnouncement: announcement || null,
      acmeTreasuryHold: kind === 'pending' ? status === 'active' || treasuryHold : treasuryHold,
      acmeFundingSuspension: fundingSuspension,
      incidentBeginDate: incidentBegin || null,
    };
  }

  async function submit(asDraft: boolean) {
    if (!governorDate) {
      flash('Governor declaration date is required — it is step 1 of every declaration.', 'err');
      document.getElementById('dpGovernor')?.focus();
      return;
    }
    if (!eventName.trim()) {
      flash('Event name is required.', 'err');
      eventNameRef.current?.focus();
      return;
    }
    if (!areas.length) {
      flash('Add at least one county.', 'err');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const existing = events.find((e) => e.id === editingId);
        let event = await updateEvent(editingId, {
          ...eventPayload(existing?.status || (kind === 'pending' && asDraft ? 'draft' : 'active')),
        });
        const known = new Set((existing?.areas || []).map((a) => `${a.state}:${a.countyCode}`));
        const extras = areas.filter((a) => !known.has(`${a.state}:${a.countyCode}`) && !a.id);
        if (extras.length) {
          event = await appendAreas(editingId, extras);
        }
        flash(`Updated “${event.eventName}”.`, 'ok');
        setAreas(event.areas);
        await refresh();
        setSelectedId(event.id);
        const impact = await fetchImpactedLoans(event.id);
        setLoans(impact.loans);
        setMatchCounts(impact.matchCounts || null);
        return;
      }

      const status: PolicyStatus =
        kind === 'pending' ? (asDraft ? 'draft' : 'active') : 'active';
      const event = await createEvent({
        ...eventPayload(status),
        areas,
      });
      flash(
        status === 'draft'
          ? `Saved draft “${event.eventName}”.`
          : `Declared ${event.kind} “${event.eventName}”.`,
        'ok'
      );
      clearForm(true);
      await refresh();
      setSelectedId(event.id);
      const impact = await fetchImpactedLoans(event.id);
      setLoans(impact.loans);
      setMatchCounts(impact.matchCounts || null);
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
      flash('Pending hold activated — ACME Treasury Hold on.', 'ok');
      await refresh();
      const impact = await fetchImpactedLoans(id);
      setLoans(impact.loans);
      setMatchCounts(impact.matchCounts || null);
      setSelectedId(id);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Activate failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  function askEnd(id: string) {
    const ev = events.find((e) => e.id === id);
    setDeskConfirm({
      tone: 'end',
      kicker: 'Credit administration',
      title: 'End policy event',
      eventName: ev?.eventName || 'This event',
      body: 'Holds stop applying to impacted loans. The event stays on file with status Ended.',
      confirmLabel: 'End event',
      run: () => endEvent(id),
    });
  }

  function askDelete(id: string) {
    const ev = events.find((e) => e.id === id);
    setDeskConfirm({
      tone: 'delete',
      kicker: 'Permanent removal',
      title: 'Delete policy event',
      eventName: ev?.eventName || 'This event',
      body: 'This removes the event and its counties from the desk. The action cannot be undone.',
      confirmLabel: 'Delete event',
      run: () => destroyEvent(id),
    });
  }

  async function endEvent(id: string) {
    setBusy(true);
    try {
      await setStatus(id, 'ended');
      flash('Event ended.', 'ok');
      if (editingId === id) clearForm();
      await refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'End failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function destroyEvent(id: string) {
    setBusy(true);
    try {
      await deleteEvent(id);
      flash('Event deleted.', 'ok');
      if (editingId === id) clearForm();
      if (selectedId === id) {
        setSelectedId(null);
        setLoans([]);
        setMatchCounts(null);
      }
      await refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Delete failed', 'err');
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
      setMatchCounts(impact.matchCounts || null);
      const mc = impact.matchCounts;
      flash(
        mc
          ? `Impacted loans: ${impact.count} (FIPS ${mc.byFips} · name ${mc.byName})`
          : `Impacted loans: ${impact.count}`,
        'ok'
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Impact query failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dp-shell">
      <nav className="dp-sibling-nav mb-2" aria-label="Disaster desk pages">
        <a className="btn btn-outline-secondary btn-sm" href="/finance/disasters-unified.html">
          <i className="bi-arrow-left" aria-hidden="true" /> Unified Disasters
        </a>
        <a className="btn btn-outline-secondary btn-sm" href="/finance/disasters-hurricanes.html">
          <i className="bi-hurricane" aria-hidden="true" /> Hurricanes
        </a>
        <a className="btn btn-outline-secondary btn-sm" href="/finance/disasters-webcams.html">
          <i className="bi-camera-video" aria-hidden="true" /> Webcams
        </a>
        <a className="btn btn-outline-secondary btn-sm" href="/finance/disasters-encompass-map.html">
          <i className="bi-geo-alt" aria-hidden="true" /> Proximity map
        </a>
        <a
          className="btn btn-outline-secondary btn-sm"
          href="/disaster-impact-graph.html"
          title="Persisted graph — as-of reseed, not live /near"
        >
          <i className="bi-diagram-3" aria-hidden="true" /> Impact Graph
        </a>
        <a className="btn btn-outline-secondary btn-sm" href="/finance/pipeline-risk-dashboard.html">
          <i className="bi-bar-chart" aria-hidden="true" /> Pipeline
        </a>
      </nav>

      <header className="dp-hero">
        <h1>
          <i className="bi-clipboard2-check me-2" aria-hidden="true" />
          Disaster Policy Desk
        </h1>
        <p>
          Credit Administration declare flow for <strong>Declared</strong> and{' '}
          <strong>Pending</strong> disasters — retires the Excel file-drop. Step 1 is always the{' '}
          <strong>governor declaration</strong>; hazard feeds stay on Unified Disasters.
        </p>
      </header>

      <div className={`dp-status ${statusMsg.kind || ''}`} role="status" aria-live="polite">
        {statusMsg.text}
      </div>

      <section className="dp-panel dp-briefing" aria-label="Live disaster briefing">
        <div className="dp-section-head">
          <div>
            <h2 className="mb-0">
              <i className="bi-broadcast me-2" aria-hidden="true" />
              Live briefing
            </h2>
            <p className="dp-section-lede mb-0">
              FEMA first, then cross-source highlights. <strong>Use</strong> fills the form — you still
              confirm counties and Declare.
              {briefingGeneratedAt ? (
                <span className="dp-muted"> · Updated {new Date(briefingGeneratedAt).toLocaleString()}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={briefingBusy}
            onClick={() => loadBriefing()}
          >
            {briefingBusy ? 'Loading…' : 'Refresh feeds'}
          </button>
        </div>

        {briefingSummary && !briefingError && (
          <div className="dp-briefing-stats" aria-label="Briefing summary">
            <span>
              <strong>{briefingSummary.totalEvents ?? 0}</strong> events
            </span>
            {briefingSummary.bySource
              ? Object.entries(briefingSummary.bySource).map(([k, v]) => (
                  <span key={k} className="dp-stat-chip">
                    {k.toUpperCase()} {v}
                  </span>
                ))
              : null}
          </div>
        )}

        {briefingError && (
          <div className="dp-state dp-state-err" role="alert">
            <i className="bi-exclamation-triangle me-1" aria-hidden="true" />
            {briefingError}
            <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => loadBriefing()}>
              Retry
            </button>
          </div>
        )}

        {!briefingError && briefingBusy && briefingRows.length === 0 && (
          <div className="dp-state dp-state-loading" aria-busy="true">
            Loading live feeds…
          </div>
        )}

        {!briefingError && !briefingBusy && briefingRows.length === 0 && (
          <div className="dp-state">No briefing items in the last 7 days. Refresh or pick a row on Unified Disasters.</div>
        )}

        {!briefingError && briefingRows.length > 0 && (
          <div className="dp-briefing-list" role="list">
            {briefingRows.map((item, idx) => (
              <button
                type="button"
                className="dp-briefing-item"
                role="listitem"
                key={`${item.source}-${item.title}-${idx}`}
                onClick={() =>
                  applyPrefill(
                    briefingItemToPrefill(item),
                    `Prefill from ${String(item.source || 'feed').toUpperCase()} — review and declare.`
                  )
                }
              >
                <span className="dp-briefing-source">{String(item.source || '?').toUpperCase()}</span>
                <span className="dp-briefing-body">
                  <strong>{item.title || 'Event'}</strong>
                  <span className="dp-muted">
                    {[
                      item.location,
                      item.disasterNumber,
                      item.startedAt ? new Date(item.startedAt).toLocaleDateString() : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="dp-briefing-cta" aria-hidden="true">
                  Use →
                </span>
              </button>
            ))}
          </div>
        )}

        {briefingFema.length > 0 && briefingHighlights.length > 0 && (
          <details className="dp-details mt-2">
            <summary>
              Also show top cross-source highlights ({briefingHighlights.length})
            </summary>
            <div className="dp-briefing-list mt-2" role="list">
              {briefingHighlights.map((item, idx) => (
                <button
                  type="button"
                  className="dp-briefing-item"
                  role="listitem"
                  key={`hl-${item.source}-${idx}`}
                  onClick={() =>
                    applyPrefill(
                      briefingItemToPrefill(item),
                      `Prefill from highlight (${String(item.source || '').toUpperCase()}).`
                    )
                  }
                >
                  <span className="dp-briefing-source">{String(item.source || '?').toUpperCase()}</span>
                  <span className="dp-briefing-body">
                    <strong>{item.title || 'Event'}</strong>
                    <span className="dp-muted">{item.location || ''}</span>
                  </span>
                  <span className="dp-briefing-cta" aria-hidden="true">
                    Use →
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="dp-panel" ref={formRef} aria-labelledby="dp-form-heading">
        <div className="dp-section-head">
          <div>
            <h2 id="dp-form-heading" className="mb-0">
              <i className={`bi ${editingId ? 'bi-pencil' : 'bi-plus-square'} me-2`} aria-hidden="true" />
              {editingId ? 'Edit policy event' : 'New Declared / Pending event'}
            </h2>
            <p className="dp-section-lede mb-0">
              {editingId
                ? 'Update ACME holds, dates, and counties. Removing the last county is blocked.'
                : 'Step 1 is always the governor declaration date — capture it before FEMA or ACME dates.'}
            </p>
          </div>
          {editingId ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => clearForm()}>
              Cancel edit
            </button>
          ) : null}
        </div>
        {editingId ? (
          <div className="dp-edit-banner" role="status">
            Editing saved event <code className="dp-code">{editingId.slice(0, 8)}…</code>
          </div>
        ) : null}

        {prefillNotice && (
          <div className="dp-prefill-banner" role="status" aria-live="polite">
            <div className="dp-prefill-banner-main">
              <strong>
                <i className="bi-magic me-1" aria-hidden="true" />
                Prefill from {prefillNotice.sourceLabel}
              </strong>
              <p className="mb-0">
                Fields below were filled from the feed. Confirm counties and holds before you Declare — nothing is
                live until you save.
              </p>
              <ul className="dp-review-list" aria-label="Review before declare">
                {reviewChecks.map((c) => (
                  <li key={c.id} className={c.ok ? 'is-ok' : 'is-miss'}>
                    <i
                      className={c.ok ? 'bi-check-circle-fill' : 'bi-circle'}
                      aria-hidden="true"
                    />
                    <span>
                      {c.label}
                      {!c.ok && !c.soft ? ' — still needed' : ''}
                      {c.soft && c.ok ? ' — look once' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={dismissPrefill}>
              Dismiss
            </button>
          </div>
        )}

        <fieldset className="dp-fieldset dp-gov-step">
          <legend className="dp-legend">1 · Governor declaration</legend>
          <p className="dp-gov-lede mb-2">
            First step in every declaration workflow. Capture the state governor&apos;s State of Emergency /
            disaster declaration date before FEMA or ACME fields.
          </p>
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label" htmlFor="dpGovernor">
                Governor decl. date <span className="text-danger">*</span>
              </label>
              <input
                id="dpGovernor"
                type="date"
                className="form-control form-control-sm"
                value={governorDate}
                onChange={(e) => setGovernorDate(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="col-md-8">
              <p className="dp-muted small mb-0">
                Use the date the governor publicly announced SoE / disaster for the affected state(s). One
                date per event; multi-state storms can use the earliest announcement.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="dp-fieldset">
          <legend className="dp-legend">2 · Event essentials</legend>
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label" htmlFor="dpKind">
                Kind
              </label>
              <select
                id="dpKind"
                className="form-select form-select-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as PolicyKind)}
              >
                <option value="declared">Declared Disaster</option>
                <option value="pending">Pending Natural Disaster</option>
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label" htmlFor="dpEventName">
                Event name
              </label>
              <input
                id="dpEventName"
                ref={eventNameRef}
                className="form-control form-control-sm"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Hurricane Helene — FL/GA"
                autoComplete="off"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="dpDisasterType">
                Disaster type
              </label>
              <input
                id="dpDisasterType"
                className="form-control form-control-sm"
                value={disasterType}
                onChange={(e) => setDisasterType(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="dpIncidentBegin">
                Incident begin date
              </label>
              <input
                id="dpIncidentBegin"
                type="date"
                className="form-control form-control-sm"
                value={incidentBegin}
                onChange={(e) => setIncidentBegin(e.target.value)}
              />
            </div>
            <div className="col-md-5">
              <label className="form-label" htmlFor="dpInspection">
                Inspection required for appraisals dated on or before
              </label>
              <input
                id="dpInspection"
                type="date"
                className="form-control form-control-sm"
                value={inspectionCutoff}
                onChange={(e) => setInspectionCutoff(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="dpFemaNumber">
                FEMA declaration number
              </label>
              <input
                id="dpFemaNumber"
                className="form-control form-control-sm"
                value={femaNumber}
                onChange={(e) => setFemaNumber(e.target.value)}
                placeholder="DR-xxxx / EM-xxxx"
                autoComplete="off"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="dp-fieldset">
          <legend className="dp-legend">3 · Counties in scope</legend>
          <div className="row g-2 align-items-end">
            <div className="col-sm-3 col-md-2">
              <label className="form-label" htmlFor="dpState">
                State
              </label>
              <select
                id="dpState"
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
            <div className="col-sm-5 col-md-4">
              <label className="form-label" htmlFor="dpCountyFilter">
                Filter counties
              </label>
              <input
                id="dpCountyFilter"
                className="form-control form-control-sm"
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value)}
                placeholder="Name or FIPS"
                autoComplete="off"
              />
            </div>
            <div className="col-sm-4 col-md-6 d-flex flex-wrap align-items-center gap-2 pb-1">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={addSelectedCounties}>
                Add selected counties
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                disabled={busy || !femaNumber.trim()}
                onClick={() => addAllFemaCounties()}
                title="Load every county in the DB for this FEMA DR/EM number"
              >
                Add all counties for FEMA #
              </button>
              <span className="dp-muted">
                {selectedFips.size} selected · {areas.length} in draft list
              </span>
            </div>
          </div>

          <div className="dp-county-list mt-2" role="group" aria-label="Counties">
            {filteredCounties.length === 0 ? (
              <div className="dp-muted py-2">
                {counties.length === 0 ? 'Loading counties…' : 'No counties match this filter.'}
              </div>
            ) : (
              filteredCounties.map((c) => (
                <label key={c.county_fips} className="dp-county-row">
                  <input
                    type="checkbox"
                    checked={selectedFips.has(c.county_fips)}
                    onChange={() => toggleFips(c.county_fips)}
                  />
                  <span>
                    {c.name} <span className="dp-fips">({c.county_fips})</span>
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
        </fieldset>

        <details
          className="dp-details dp-advanced"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>
            4 · Later declaration dates &amp; announcement
            <span className="dp-muted ms-2">FEMA EM/DR · Presidential · ACME</span>
          </summary>
          <div className="row g-2 mt-1">
            <div className="col-md-3">
              <label className="form-label" htmlFor="dpFemaEm">
                FEMA emergency decl. date
              </label>
              <input
                id="dpFemaEm"
                type="date"
                className="form-control form-control-sm"
                value={femaEmDate}
                onChange={(e) => setFemaEmDate(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="dpFemaDr">
                FEMA major disaster decl. date
              </label>
              <input
                id="dpFemaDr"
                type="date"
                className="form-control form-control-sm"
                value={femaDrDate}
                onChange={(e) => setFemaDrDate(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="dpPresidential">
                Presidential decl. date
              </label>
              <input
                id="dpPresidential"
                type="date"
                className="form-control form-control-sm"
                value={presidentialDate}
                onChange={(e) => setPresidentialDate(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="dpAcmeDate">
                ACME emergency decl. date
              </label>
              <input
                id="dpAcmeDate"
                type="date"
                className="form-control form-control-sm"
                value={acmeDate}
                onChange={(e) => setAcmeDate(e.target.value)}
              />
            </div>
            <div className="col-md-9">
              <label className="form-label" htmlFor="dpAnnouncement">
                ACME announcement
              </label>
              <input
                id="dpAnnouncement"
                className="form-control form-control-sm"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </details>

        <fieldset className="dp-fieldset">
          <legend className="dp-legend">4 · Hold flags</legend>
          <div className="dp-hold-row">
            <div className="form-check">
              <input
                id="dpTreasury"
                type="checkbox"
                className="form-check-input"
                checked={treasuryHold || kind === 'pending'}
                onChange={(e) => setTreasuryHold(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="dpTreasury">
                ACME Treasury Hold
                {kind === 'pending' ? (
                  <span className="dp-muted"> — on when you Declare Pending</span>
                ) : null}
              </label>
            </div>
            <div className="form-check">
              <input
                id="dpFund"
                type="checkbox"
                className="form-check-input"
                checked={fundingSuspension}
                onChange={(e) => setFundingSuspension(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="dpFund">
                ACME Funding Suspension
              </label>
            </div>
          </div>
        </fieldset>

        <div className="dp-actions">
          {editingId ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => submit(false)}>
                Save changes
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => clearForm()}>
                Cancel
              </button>
            </>
          ) : (
            <>
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
                disabled={busy || (!readyToDeclare && Boolean(prefillNotice))}
                title={
                  !readyToDeclare && prefillNotice
                    ? 'Finish the review checklist before declaring'
                    : undefined
                }
                onClick={() => submit(false)}
              >
                {kind === 'pending' ? 'Declare Pending Hold' : 'Declare Disaster'}
              </button>
            </>
          )}
          {prefillNotice && !readyToDeclare && !editingId && (
            <span className="dp-muted">Complete the checklist above before Declare.</span>
          )}
        </div>
      </section>

      <section className="dp-panel" aria-labelledby="dp-gov-board-heading">
        <div className="dp-section-head">
          <div>
            <h2 id="dp-gov-board-heading" className="mb-0">
              <i className="bi-building me-2" aria-hidden="true" />
              Latest governor declarations by state
            </h2>
            <p className="dp-section-lede mb-0">
              One row per state — newest governor declaration date first. Capture dates in step 1 above.
            </p>
          </div>
        </div>
        {governorByState.length === 0 ? (
          <p className="dp-muted mb-0">
            No governor declaration dates saved yet. Enter the governor decl. date as step 1 when you declare.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table dp-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">Governor decl. date</th>
                  <th scope="col">Event</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {governorByState.map((row) => (
                  <tr key={row.state}>
                    <td>
                      <strong className="dp-gov-state">{row.state}</strong>
                    </td>
                    <td>{row.date}</td>
                    <td>
                      <strong>{row.eventName}</strong>
                      <div className="dp-muted">
                        <span className={`dp-badge ${row.kind}`}>{row.kind}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`dp-badge ${row.status}`}>{row.status}</span>
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          const ev = events.find((e) => e.id === row.eventId);
                          if (ev) loadEventIntoForm(ev);
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dp-panel">
        <div className="dp-section-head dp-section-head-wrap">
          <div>
            <h2 className="mb-0">
              <i className="bi-journal-text me-2" aria-hidden="true" />
              Policy register
            </h2>
            <p className="dp-section-lede mb-0">Full CRUD — edit, activate, end, or delete ACME policy events.</p>
          </div>
          <div className="dp-toolbar">
            <label className="dp-filter">
              <span className="visually-hidden">Filter kind</span>
              <select
                className="form-select form-select-sm"
                value={listKind}
                onChange={(e) => setListKind(e.target.value as '' | PolicyKind)}
              >
                <option value="">All kinds</option>
                <option value="declared">Declared</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            <label className="dp-filter">
              <span className="visually-hidden">Filter status</span>
              <select
                className="form-select form-select-sm"
                value={listStatus}
                onChange={(e) => setListStatus(e.target.value as '' | PolicyStatus)}
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </label>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => refresh()}>
              Refresh
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => clearForm()}>
              New event
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table dp-table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Governor</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">Areas</th>
                <th scope="col">Holds</th>
                <th scope="col" className="text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    No policy events yet. Create one above or prefill from the live briefing.
                  </td>
                </tr>
              ) : (
                [...events]
                  .sort((a, b) => {
                    const gd = String(b.governorDeclarationDate || '').localeCompare(
                      String(a.governorDeclarationDate || '')
                    );
                    if (gd) return gd;
                    return String(b.incidentBeginDate || '').localeCompare(String(a.incidentBeginDate || ''));
                  })
                  .map((ev) => (
                  <tr
                    key={ev.id}
                    className={
                      editingId === ev.id
                        ? 'table-warning'
                        : selectedId === ev.id
                          ? 'table-active'
                          : undefined
                    }
                  >
                    <td>
                      <strong>{ev.eventName}</strong>
                      <div className="dp-muted">
                        {ev.incidentBeginDate || '—'} · {ev.femaDeclarationNumber || 'no FEMA #'}
                      </div>
                    </td>
                    <td>
                      {ev.governorDeclarationDate ? (
                        <strong>{String(ev.governorDeclarationDate).slice(0, 10)}</strong>
                      ) : (
                        <span className="text-danger small">Missing</span>
                      )}
                    </td>
                    <td>
                      <span className={`dp-badge ${ev.kind}`}>{ev.kind}</span>
                    </td>
                    <td>
                      <span className={`dp-badge ${ev.status}`}>{ev.status}</span>
                    </td>
                    <td>{ev.areas.length}</td>
                    <td className="small">
                      {ev.acmeTreasuryHold ? 'Treasury' : '—'}
                      {ev.acmeFundingSuspension ? ' · Funding' : ''}
                    </td>
                    <td className="text-end">
                      <div className="dp-row-actions">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadEventIntoForm(ev)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => showImpact(ev.id)}>
                          Loans
                        </button>
                        {ev.kind === 'pending' && ev.status === 'draft' && (
                          <button type="button" className="btn btn-sm btn-warning" onClick={() => activate(ev.id)}>
                            Activate
                          </button>
                        )}
                        {ev.status === 'active' && (
                          <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => askEnd(ev.id)}>
                            End
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => askDelete(ev.id)}
                          title="Permanently delete"
                        >
                          Delete
                        </button>
                      </div>
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
          <i className="bi-house-door me-2" aria-hidden="true" />
          Impacted loans {selectedId ? `(${loans.length})` : ''}
        </h2>
        <p className="dp-muted mb-2">
          Matched from the mock pipeline by FIPS first, then county name. Ops triage score is context only — not the
          ACME hold.
          {matchCounts
            ? ` Match mix: FIPS ${matchCounts.byFips} · name ${matchCounts.byName}.`
            : ''}
        </p>
        <div className="table-responsive">
          <table className="table dp-table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Loan</th>
                <th scope="col">Property</th>
                <th scope="col">County</th>
                <th scope="col">Milestone</th>
                <th scope="col">Triage</th>
                <th scope="col">Hold</th>
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
      {deskConfirm ? (
        <div className="dp-dialog-backdrop">
          <div
            className={`dp-dialog dp-dialog--${deskConfirm.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dp-confirm-title"
            aria-describedby="dp-confirm-body"
          >
            <p className="dp-dialog-kicker">{deskConfirm.kicker}</p>
            <h2 id="dp-confirm-title">{deskConfirm.title}</h2>
            <p className="dp-dialog-event">{deskConfirm.eventName}</p>
            <p id="dp-confirm-body" className="dp-dialog-body">
              {deskConfirm.body}
            </p>
            <div className="dp-dialog-actions">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setDeskConfirm(null)}
                autoFocus
              >
                {deskConfirm.tone === 'delete' ? 'Cancel' : 'Keep event'}
              </button>
              <button
                type="button"
                className={`btn ${deskConfirm.tone === 'delete' ? 'btn-danger' : 'btn-dark'}`}
                disabled={busy}
                onClick={() => {
                  const action = deskConfirm;
                  setDeskConfirm(null);
                  void action.run();
                }}
              >
                {deskConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
