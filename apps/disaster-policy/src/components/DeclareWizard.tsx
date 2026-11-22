import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  appendAreas,
  createEvent,
  deleteArea,
  fetchFemaCounties,
  loadCountiesForState,
  previewImpact,
  setStatus,
  updateAreas,
  updateEvent,
} from '../api';
import { areaCountText, areaKey, areaLabel, mergeAreas, sortAreas } from '../areas';
import { normalizeCountyKey, type PrefillPayload } from '../prefill';
import type { ImpactResult, PolicyArea, PolicyEvent, PolicyKind } from '../types';
import { DISASTER_TYPES } from '../types';
import AreaPicker from './AreaPicker';
import ImpactReport from './ImpactReport';

const STEPS = ['Event', 'Impacted areas', 'Review list', 'Declare'] as const;

const KINDS: Array<{ id: PolicyKind; title: string; body: string }> = [
  {
    id: 'declared',
    title: 'Declared Disaster',
    body: 'A federally declared disaster with Individual Assistance published by FEMA, or a disaster declared by ACME.',
  },
  {
    id: 'pending',
    title: 'Pending Natural Disaster',
    body: 'A hurricane, tropical storm, fire or similar event that is on its way. Declaring it places a Treasury Hold on loans in the areas you identify.',
  },
];

type Flash = (text: string, kind?: 'ok' | 'err') => void;

type Props = {
  /** Saved event being edited, or null for a new declaration. */
  editing: PolicyEvent | null;
  /** Hand-off from Unified Disasters; ignored when editing. */
  prefill: PrefillPayload | null;
  onSaved: (event: PolicyEvent, message: string) => void;
  /** A save stopped part-way; the parent reloads the event so a retry diffs against what was stored. */
  onSaveFailed: () => void;
  onCancelEdit: () => void;
  flash: Flash;
};

function loggedInUserName(): string | null {
  const getUser = (window as unknown as { getLoggedInUser?: () => { name?: string } | null }).getLoggedInUser;
  return getUser?.()?.name || null;
}

export default function DeclareWizard({ editing, prefill, onSaved, onSaveFailed, onCancelEdit, flash }: Props) {
  const uid = useId();
  const seed = editing ? null : prefill;
  const isDraft = !editing || editing.status === 'draft';

  const [step, setStep] = useState(editing?.status === 'draft' ? 2 : 0);
  const [kind, setKind] = useState<PolicyKind>(editing?.kind ?? seed?.kind ?? 'declared');
  const [eventName, setEventName] = useState(editing?.eventName ?? seed?.eventName ?? '');
  const [disasterType, setDisasterType] = useState(editing?.disasterType ?? seed?.disasterType ?? '');
  const [femaNumber, setFemaNumber] = useState(editing?.femaDeclarationNumber ?? seed?.femaNumber ?? '');
  const [femaEmDate, setFemaEmDate] = useState(editing?.femaEmergencyDeclarationDate ?? seed?.femaEmDate ?? '');
  const [femaDrDate, setFemaDrDate] = useState(editing?.femaMajorDisasterDeclarationDate ?? seed?.femaDrDate ?? '');
  const [presidentialDate, setPresidentialDate] = useState(editing?.presidentialDeclarationDate ?? '');
  const [acmeDate, setAcmeDate] = useState(editing?.acmeEmergencyDeclarationDate ?? '');
  const [announcement, setAnnouncement] = useState(editing?.acmeDisasterAnnouncement ?? seed?.announcement ?? '');
  const [areas, setAreas] = useState<PolicyArea[]>(() => sortAreas(editing?.areas ?? []));
  const [reviewed, setReviewed] = useState(Boolean(editing && editing.status !== 'draft'));
  const [beginDate, setBeginDate] = useState(editing?.incidentBeginDate ?? seed?.incidentBegin ?? '');
  const savedCutoff = editing?.areas[0]?.inspectionRequiredAppraisalsOnOrBefore ?? '';
  const [cutoff, setCutoff] = useState(savedCutoff);
  const [treasuryHold, setTreasuryHold] = useState(Boolean(editing?.acmeTreasuryHold));
  const [fundingSuspension, setFundingSuspension] = useState(Boolean(editing?.acmeFundingSuspension));
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [impactFor, setImpactFor] = useState('');
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState('');

  const panelRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const hasReferences = Boolean(femaNumber || femaEmDate || femaDrDate || presidentialDate || acmeDate);
  const signature = useMemo(() => areas.map(areaKey).sort().join('|'), [areas]);
  const nameOk = Boolean(eventName.trim());
  const dateLabel = kind === 'pending' ? 'Pending Disaster Hold start date' : 'Incident Period begin date';
  const declareLabel = !isDraft
    ? 'Save changes'
    : kind === 'pending'
      ? 'Declare Pending Disaster Hold'
      : 'Declare Disaster';
  const canSaveDraft = kind === 'pending' && isDraft;

  /** Any change to the list sends it back through review. */
  function changeAreas(update: (current: PolicyArea[]) => PolicyArea[]) {
    setAreas(update);
    setReviewed(false);
  }

  function addAreas(incoming: PolicyArea[], source: string) {
    const { added, covered } = mergeAreas(areas, incoming);
    if (added) changeAreas((current) => sortAreas(mergeAreas(current, incoming).areas));
    const skipped = covered ? ` ${covered} already covered by the list.` : '';
    flash(
      added ? `Added ${added} ${added === 1 ? 'area' : 'areas'} from ${source}.${skipped}` : `Nothing new to add from ${source}.${skipped}`,
      added ? 'ok' : undefined
    );
  }

  async function addFemaCounties(disasterNumber: string) {
    const num = disasterNumber.trim();
    if (!num) return;
    setBusy(true);
    try {
      const data = await fetchFemaCounties(num);
      if (!data.counties.length) {
        flash(`No counties are on file for FEMA ${num}. Pull FEMA sources on Unified Disasters first.`, 'err');
        return;
      }
      addAreas(
        data.counties.map((c) => ({ countyCode: c.countyFips, countyName: c.countyName, state: c.state })),
        `FEMA ${data.disasterNumber}`
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : 'FEMA county lookup failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  // Unified Disasters hand-off: put the selected county (or the FEMA declaration's counties) on the list.
  useEffect(() => {
    if (!seed) return;
    if (seed.autoAddAllCounties && seed.femaNumber) {
      void addFemaCounties(seed.femaNumber);
      return;
    }
    if (!seed.autoAddCounty || !seed.state || !(seed.countyFips || seed.county)) return;
    let cancelled = false;
    loadCountiesForState(seed.state)
      .then((rows) => {
        if (cancelled) return;
        const fips = seed.countyFips ? String(seed.countyFips).padStart(5, '0') : '';
        const name = normalizeCountyKey(seed.county || '');
        const match =
          rows.find((c) => c.county_fips === fips) ||
          rows.find((c) => name && normalizeCountyKey(c.name) === name);
        if (!match) return;
        changeAreas((current) =>
          mergeAreas(current, [
            { countyCode: match.county_fips, countyName: match.name, state: match.state_abbr },
          ]).areas
        );
      })
      .catch(() => {
        /* The picker reports county-list failures when the user reaches step 2. */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the hand-off this wizard was mounted with
  }, []);

  // Opening a saved event or arriving from a hand-off should land the user on the wizard.
  useEffect(() => {
    if (editing || seed) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount; the parent remounts per event
  }, []);

  // The review and declare steps show which loans the area list touches.
  useEffect(() => {
    if (step < 2 || !signature || signature === impactFor) return undefined;
    let cancelled = false;
    setImpactLoading(true);
    setImpactError('');
    previewImpact(areas)
      .then((result) => {
        if (cancelled) return;
        setImpact(result);
        setImpactFor(signature);
      })
      .catch((e) => {
        if (cancelled) return;
        setImpact(null);
        setImpactError(e instanceof Error ? e.message : 'Request failed');
      })
      .finally(() => {
        if (!cancelled) setImpactLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `areas` is captured by `signature`
  }, [step, signature, impactFor]);

  function canEnter(target: number): boolean {
    if (target >= 1 && !nameOk) return false;
    if (target >= 2 && !areas.length) return false;
    if (target >= 3 && !reviewed) return false;
    return true;
  }

  function goTo(target: number) {
    if (target > step && !canEnter(target)) {
      setShowErrors(true);
      if (!nameOk) flash('Give the event a name first.', 'err');
      else if (!areas.length) flash('Add at least one county or ZIP Code.', 'err');
      else flash('Confirm the preliminary list before declaring.', 'err');
      return;
    }
    setShowErrors(false);
    setStep(target);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }

  function eventBody(resultingStatus: PolicyEvent['status']) {
    return {
      kind,
      eventName: eventName.trim(),
      disasterType: disasterType.trim() || null,
      femaDeclarationNumber: femaNumber.trim() || null,
      femaEmergencyDeclarationDate: femaEmDate || null,
      femaMajorDisasterDeclarationDate: femaDrDate || null,
      presidentialDeclarationDate: presidentialDate || null,
      acmeEmergencyDeclarationDate: acmeDate || null,
      acmeDisasterAnnouncement: announcement.trim() || null,
      // A Pending hold is a Treasury Hold: on from the moment it is declared.
      acmeTreasuryHold:
        kind === 'pending'
          ? resultingStatus === 'active' || Boolean(editing?.acmeTreasuryHold && resultingStatus === 'ended')
          : treasuryHold,
      acmeFundingSuspension: fundingSuspension,
      incidentBeginDate: beginDate || null,
    };
  }

  async function save(mode: 'draft' | 'declare') {
    if (!nameOk || !areas.length) {
      setShowErrors(true);
      flash(!nameOk ? 'Give the event a name first.' : 'Add at least one county or ZIP Code.', 'err');
      return;
    }
    if (mode === 'declare' && !beginDate) {
      setShowErrors(true);
      flash(`Enter the ${dateLabel}.`, 'err');
      document.getElementById(`${uid}-begin`)?.focus();
      return;
    }
    const declaring = mode === 'declare' && isDraft;
    const withCutoff = (list: PolicyArea[]) =>
      list.map((a) => ({ ...a, inspectionRequiredAppraisalsOnOrBefore: cutoff || null }));

    setBusy(true);
    try {
      let event: PolicyEvent;
      if (!editing) {
        const status = mode === 'draft' ? 'draft' : 'active';
        event = await createEvent(
          { ...eventBody(status), status, createdBy: loggedInUserName() },
          withCutoff(areas)
        );
      } else {
        const resultingStatus = declaring ? 'active' : editing.status;
        event = await updateEvent(editing.id, eventBody(resultingStatus));
        // Bring the stored area list in line with the reviewed one: add first so the event never empties.
        const stored = new Set(editing.areas.map(areaKey));
        const wanted = new Set(areas.map(areaKey));
        const extras = areas.filter((a) => !stored.has(areaKey(a)));
        if (extras.length) event = await appendAreas(editing.id, withCutoff(extras));
        for (const gone of editing.areas.filter((a) => !wanted.has(areaKey(a)))) {
          if (gone.id) event = await deleteArea(editing.id, gone.id);
        }
        if (cutoff !== savedCutoff) {
          event = await updateAreas(editing.id, {
            areaIds: event.areas.map((a) => a.id as string),
            inspectionRequiredAppraisalsOnOrBefore: cutoff || null,
          });
        }
        if (declaring) event = await setStatus(editing.id, 'active');
      }

      const message =
        mode === 'draft'
          ? `Draft saved: “${event.eventName}”. Nothing is on hold until you declare it.`
          : declaring && kind === 'pending'
            ? `Pending Disaster Hold declared: “${event.eventName}”. Treasury Hold is on for ${areaCountText(event.areas)}.`
            : declaring
              ? `Disaster declared: “${event.eventName}” (${areaCountText(event.areas)}).`
              : `Saved changes to “${event.eventName}”.`;
      onSaved(event, message);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Save failed', 'err');
      if (editing) onSaveFailed();
    } finally {
      setBusy(false);
    }
  }

  const title = !editing
    ? 'New declaration'
    : editing.status === 'draft'
      ? `Continue draft — ${editing.eventName}`
      : `Edit — ${editing.eventName}`;

  return (
    <section className="dp-panel dp-wizard" ref={panelRef} aria-labelledby={`${uid}-title`}>
      <div className="dp-section-head">
        <h2 id={`${uid}-title`} className="mb-0">
          {title}
        </h2>
        {editing && (
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onCancelEdit}>
            {editing.status === 'draft' ? 'Close draft' : 'Cancel edit'}
          </button>
        )}
      </div>

      {seed && (
        <p className="dp-handoff" role="status">
          <i className="bi-box-arrow-in-right me-1" aria-hidden="true" />
          Started from {seed.from === 'hurricane-tracker' ? 'Hurricane Tracker' : 'Unified Disasters'}. The event
          details came from the hazard feed — check each step before you declare.
        </p>
      )}

      <ol className="dp-steps" aria-label="Declaration steps">
        {STEPS.map((label, i) => {
          const state = i === step ? 'is-current' : i < step ? 'is-done' : '';
          return (
            <li key={label} className={state}>
              <button
                type="button"
                aria-current={i === step ? 'step' : undefined}
                disabled={busy || (i > step && !canEnter(i))}
                onClick={() => goTo(i)}
              >
                <span className="dp-step-num" aria-hidden="true">
                  {i < step ? <i className="bi-check-lg" /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <h3 className="dp-h3 dp-step-title" tabIndex={-1} ref={headingRef}>
        {step === 0 && 'What are you declaring?'}
        {step === 1 && 'Which areas are impacted?'}
        {step === 2 && 'Review the preliminary list'}
        {step === 3 && (isDraft ? 'Set the date and declare' : 'Dates and holds')}
      </h3>

      {step === 0 && (
        <>
          <fieldset className="dp-fieldset" disabled={!isDraft}>
            <legend className="visually-hidden">Disaster kind</legend>
            <div className="dp-kind-grid">
              {KINDS.map((k) => (
                <label key={k.id} className={`dp-kind${kind === k.id ? ' is-on' : ''}`}>
                  <input
                    type="radio"
                    name={`${uid}-kind`}
                    checked={kind === k.id}
                    onChange={() => setKind(k.id)}
                  />
                  <span>
                    <strong>{k.title}</strong>
                    <span className="dp-kind-body">{k.body}</span>
                  </span>
                </label>
              ))}
            </div>
            {!isDraft && (
              <p className="dp-muted mt-2 mb-0">The kind is fixed once an event has been declared.</p>
            )}
          </fieldset>

          <div className="row g-2">
            <div className="col-md-7">
              <label className="form-label" htmlFor={`${uid}-name`}>
                Event name
              </label>
              <input
                id={`${uid}-name`}
                className={`form-control form-control-sm${showErrors && !nameOk ? ' is-invalid' : ''}`}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Hurricane Helene — FL/GA"
                autoComplete="off"
                aria-describedby={showErrors && !nameOk ? `${uid}-name-err` : undefined}
              />
              {showErrors && !nameOk && (
                <div id={`${uid}-name-err`} className="invalid-feedback">
                  Enter a name for this event.
                </div>
              )}
            </div>
            <div className="col-md-5">
              <label className="form-label" htmlFor={`${uid}-type`}>
                Disaster type
              </label>
              <input
                id={`${uid}-type`}
                className="form-control form-control-sm"
                list={`${uid}-types`}
                value={disasterType}
                onChange={(e) => setDisasterType(e.target.value)}
                placeholder="Hurricane, Wildfire, Flood…"
                autoComplete="off"
              />
              <datalist id={`${uid}-types`}>
                {DISASTER_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor={`${uid}-announcement`}>
                ACME Disaster Announcement <span className="dp-optional">optional</span>
              </label>
              <input
                id={`${uid}-announcement`}
                className="form-control form-control-sm"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Announcement number or title"
                autoComplete="off"
              />
            </div>
          </div>

          <details className="dp-details mt-3" open={kind === 'declared' || hasReferences}>
            <summary>
              FEMA and ACME declaration references <span className="dp-optional">optional</span>
            </summary>
            <div className="row g-2 mt-1">
              <div className="col-md-4">
                <label className="form-label" htmlFor={`${uid}-fema`}>
                  FEMA declaration number
                </label>
                <input
                  id={`${uid}-fema`}
                  className="form-control form-control-sm"
                  value={femaNumber}
                  onChange={(e) => setFemaNumber(e.target.value)}
                  placeholder="DR-4828 or EM-3609"
                  autoComplete="off"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor={`${uid}-em`}>
                  FEMA emergency declaration date
                </label>
                <input
                  id={`${uid}-em`}
                  type="date"
                  className="form-control form-control-sm"
                  value={femaEmDate}
                  onChange={(e) => setFemaEmDate(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor={`${uid}-dr`}>
                  FEMA major disaster declaration date
                </label>
                <input
                  id={`${uid}-dr`}
                  type="date"
                  className="form-control form-control-sm"
                  value={femaDrDate}
                  onChange={(e) => setFemaDrDate(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor={`${uid}-pres`}>
                  Presidential declaration date
                </label>
                <input
                  id={`${uid}-pres`}
                  type="date"
                  className="form-control form-control-sm"
                  value={presidentialDate}
                  onChange={(e) => setPresidentialDate(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor={`${uid}-acme`}>
                  ACME emergency declaration date
                </label>
                <input
                  id={`${uid}-acme`}
                  type="date"
                  className="form-control form-control-sm"
                  value={acmeDate}
                  onChange={(e) => setAcmeDate(e.target.value)}
                />
              </div>
            </div>
          </details>
        </>
      )}

      {step === 1 && (
        <div className="dp-area-grid">
          <div>
            <p className="dp-step-lede">
              Pick whole counties, individual ZIP Codes, or both. Choosing a whole county covers every ZIP Code
              in it.
            </p>
            {femaNumber.trim() && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary mb-2"
                disabled={busy}
                onClick={() => addFemaCounties(femaNumber)}
              >
                Add every county in FEMA {femaNumber.trim()}
              </button>
            )}
            <AreaPicker
              listed={areas}
              initialState={areas[0]?.state || seed?.state}
              onAdd={(incoming) => addAreas(incoming, 'the pick list')}
              onError={(message) => flash(message, 'err')}
            />
          </div>
          <div className="dp-area-list" aria-live="polite">
            <div className="dp-area-list-head">
              <h4 className="dp-h4 mb-0">Impacted areas</h4>
              <span className="dp-muted">{areaCountText(areas)}</span>
            </div>
            {areas.length === 0 ? (
              <p className={`dp-list-note${showErrors ? ' is-error' : ''}`}>
                Nothing on the list yet. Tick counties or ZIP Codes on the left, then add them.
              </p>
            ) : (
              <>
                <ul className="dp-area-rows">
                  {areas.map((a) => (
                    <li key={areaKey(a)}>
                      <span className={`dp-area-type ${a.zipCode ? 'zip' : 'county'}`}>
                        {a.zipCode ? 'ZIP' : 'County'}
                      </span>
                      <span className="dp-area-name">
                        {areaLabel(a)}
                        {a.zipCode ? <span className="dp-muted"> ({a.countyName})</span> : null}
                      </span>
                      <button
                        type="button"
                        className="dp-area-remove"
                        aria-label={`Remove ${areaLabel(a)}`}
                        onClick={() => changeAreas((cur) => cur.filter((x) => areaKey(x) !== areaKey(a)))}
                      >
                        <i className="bi-x-lg" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-sm btn-link dp-clear-all"
                  onClick={() => changeAreas(() => [])}
                >
                  Remove all
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <p className="dp-step-lede">
            These are the areas that will be written to the Disaster Database for <strong>{eventName.trim()}</strong>
            : {areaCountText(areas)} in {[...new Set(areas.map((a) => a.state))].join(', ')}. Go back to change the
            list, or confirm it to continue.
          </p>
          <div className="table-responsive dp-review-scroll">
            <table className="table dp-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">State</th>
                  <th scope="col">County</th>
                  <th scope="col">County FIPS</th>
                  <th scope="col">ZIP Code</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={areaKey(a)}>
                    <td>
                      <span className={`dp-area-type ${a.zipCode ? 'zip' : 'county'}`}>
                        {a.zipCode ? 'ZIP' : 'County'}
                      </span>
                    </td>
                    <td>{a.state}</td>
                    <td>{a.countyName}</td>
                    <td>{a.countyCode}</td>
                    <td>{a.zipCode ? `${a.zipCode}${a.zipCity ? ` · ${a.zipCity}` : ''}` : 'All in county'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ImpactReport
            preview
            impact={impactFor === signature ? impact : null}
            loading={impactLoading}
            error={impactError}
            eventName={eventName}
          />
        </>
      )}

      {step === 3 && (
        <>
          <dl className="dp-recap">
            <div>
              <dt>Kind</dt>
              <dd>{KINDS.find((k) => k.id === kind)?.title}</dd>
            </div>
            <div>
              <dt>Event</dt>
              <dd>{eventName.trim()}</dd>
            </div>
            <div>
              <dt>Areas</dt>
              <dd>{areaCountText(areas)}</dd>
            </div>
            <div>
              <dt>Impacted loans</dt>
              <dd>
                {impactFor === signature && impact
                  ? impact.report.totals.count.toLocaleString()
                  : impactError
                    ? 'Report unavailable'
                    : 'Counting…'}
              </dd>
            </div>
          </dl>

          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label" htmlFor={`${uid}-begin`}>
                {dateLabel}
              </label>
              <input
                id={`${uid}-begin`}
                type="date"
                className={`form-control form-control-sm${showErrors && !beginDate ? ' is-invalid' : ''}`}
                value={beginDate}
                onChange={(e) => setBeginDate(e.target.value)}
                aria-describedby={showErrors && !beginDate ? `${uid}-begin-err` : undefined}
              />
              {showErrors && !beginDate && (
                <div id={`${uid}-begin-err`} className="invalid-feedback">
                  Required to declare.
                </div>
              )}
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor={`${uid}-cutoff`}>
                Inspection required for appraisals dated on or before{' '}
                <span className="dp-optional">optional</span>
              </label>
              <input
                id={`${uid}-cutoff`}
                type="date"
                className="form-control form-control-sm"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="dp-fieldset mt-3 mb-0">
            <legend className="dp-legend">Holds</legend>
            {kind === 'pending' ? (
              <p className="dp-hold-auto">
                <i className="bi-lock-fill me-1" aria-hidden="true" />
                <strong>Treasury Hold</strong> applies automatically to every loan in these areas, at any
                milestone, from the moment the hold is declared. Loans that enter these areas later are held
                too.
              </p>
            ) : (
              <div className="form-check">
                <input
                  id={`${uid}-treasury`}
                  type="checkbox"
                  className="form-check-input"
                  checked={treasuryHold}
                  onChange={(e) => setTreasuryHold(e.target.checked)}
                />
                <label className="form-check-label" htmlFor={`${uid}-treasury`}>
                  ACME Treasury Hold on loans in these areas
                </label>
              </div>
            )}
            <div className="form-check">
              <input
                id={`${uid}-funding`}
                type="checkbox"
                className="form-check-input"
                checked={fundingSuspension}
                onChange={(e) => setFundingSuspension(e.target.checked)}
              />
              <label className="form-check-label" htmlFor={`${uid}-funding`}>
                ACME Funding Suspension for these areas
              </label>
            </div>
          </fieldset>
        </>
      )}

      <div className="dp-actions">
        {step > 0 && (
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => goTo(step - 1)}>
            {step === 2 ? 'Back to edit areas' : 'Back'}
          </button>
        )}
        <span className="dp-actions-spacer" />
        {canSaveDraft && step >= 2 && (
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => save('draft')}>
            Save draft
          </button>
        )}
        {step === 0 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => goTo(1)}>
            Next: impacted areas
          </button>
        )}
        {step === 1 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => goTo(2)}>
            Next: review list
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => {
              setReviewed(true);
              setShowErrors(false);
              setStep(3);
              window.requestAnimationFrame(() => headingRef.current?.focus());
            }}
          >
            Confirm list and continue
          </button>
        )}
        {step === 3 && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save('declare')}>
            {busy ? 'Saving…' : declareLabel}
          </button>
        )}
      </div>
    </section>
  );
}
