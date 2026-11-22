import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { appendAreas, deleteArea, fetchImpactedLoans, updateAreas } from '../api';
import {
  areaCountText,
  areaEnded,
  areaKey,
  areaLabel,
  formatDate,
  isCovered,
  mergeAreas,
  sortAreas,
  todayIso,
} from '../areas';
import type { ImpactResult, PolicyArea, PolicyEvent } from '../types';
import AreaPicker from './AreaPicker';
import type { DeskConfirm } from './ConfirmDialog';
import ImpactReport from './ImpactReport';

const REPORT_REFRESH_MS = 5 * 60 * 1000;

type Props = {
  event: PolicyEvent;
  onChanged: (event: PolicyEvent) => void;
  onEdit: () => void;
  onClose: () => void;
  askConfirm: (confirm: DeskConfirm) => void;
  flash: (text: string, kind?: 'ok' | 'err') => void;
};

export function holdSummary(event: PolicyEvent): string {
  if (event.status === 'ended') return 'Released — event ended';
  if (event.status === 'draft') {
    return event.kind === 'pending' ? 'Treasury Hold starts when declared' : 'Not declared yet';
  }
  const holds = [];
  if (event.acmeTreasuryHold) holds.push('Treasury Hold');
  if (event.acmeFundingSuspension) holds.push('Funding Suspension');
  return holds.join(' · ') || 'No hold';
}

/** After a disaster is declared: append areas, close incident periods by area, pull the report. */
export default function EventManager({ event, onChanged, onEdit, onClose, askConfirm, flash }: Props) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [endDate, setEndDate] = useState('');
  const [appending, setAppending] = useState(false);
  const [toAppend, setToAppend] = useState<PolicyArea[]>([]);

  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState('');
  const panelRef = useRef<HTMLElement | null>(null);

  const areas = useMemo(() => sortAreas(event.areas), [event.areas]);
  const today = todayIso();
  const selectedIds = areas.filter((a) => a.id && selected.has(a.id)).map((a) => a.id as string);
  const allSelected = areas.length > 0 && selectedIds.length === areas.length;
  const dateLabel = event.kind === 'pending' ? 'Hold start date' : 'Incident Period begin date';

  const latestRequest = useRef(0);
  const loadReport = useCallback(async () => {
    // Only the newest request may write state — an older one can finish after the event changed.
    const request = (latestRequest.current += 1);
    setImpactLoading(true);
    setImpactError('');
    try {
      const result = await fetchImpactedLoans(event.id);
      if (request === latestRequest.current) setImpact(result);
    } catch (e) {
      if (request === latestRequest.current) {
        setImpactError(e instanceof Error ? e.message : 'Request failed');
      }
    } finally {
      if (request === latestRequest.current) setImpactLoading(false);
    }
  }, [event.id]);

  // Reload when the event's stored state changes, and on a timer so an open report stays current.
  useEffect(() => {
    void loadReport();
    const timer = window.setInterval(() => void loadReport(), REPORT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadReport, event.updatedAt, event.status]);

  useEffect(() => {
    setSelected(new Set());
    setEndDate('');
    setAppending(false);
    setToAppend([]);
    setImpact(null);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [event.id]);

  async function run(action: () => Promise<PolicyEvent>, done: string) {
    setBusy(true);
    try {
      onChanged(await action());
      flash(done, 'ok');
      return true;
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Update failed', 'err');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function applyEndDate(value: string | null) {
    const n = selectedIds.length;
    const noun = n === 1 ? 'area' : 'areas';
    const ok = await run(
      () => updateAreas(event.id, { areaIds: selectedIds, incidentEndDate: value }),
      value
        ? `Incident Period End Date ${formatDate(value)} set on ${n} ${noun}.`
        : `Incident Period End Date cleared on ${n} ${noun}.`
    );
    if (ok) setSelected(new Set());
  }

  async function commitAppend() {
    const n = toAppend.length;
    const ok = await run(
      () => appendAreas(event.id, toAppend),
      `Appended ${areaCountText(toAppend)} to “${event.eventName}”.`
    );
    if (ok && n) {
      setToAppend([]);
      setAppending(false);
    }
  }

  function askRemove(area: PolicyArea) {
    askConfirm({
      tone: 'delete',
      kicker: 'Remove area',
      title: `Remove ${areaLabel(area)}?`,
      eventName: event.eventName,
      body:
        event.status === 'active'
          ? 'Loans in this area stop being treated as impacted, and any hold on them is released. To close the incident period and keep the record, set an Incident Period End Date instead.'
          : 'The area is taken off this event.',
      confirmLabel: 'Remove area',
      run: async () => {
        await run(() => deleteArea(event.id, area.id as string), `Removed ${areaLabel(area)}.`);
      },
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="dp-panel dp-manager" ref={panelRef} aria-labelledby={`${uid}-title`}>
      <div className="dp-section-head">
        <div>
          <h2 id={`${uid}-title`} className="mb-0">
            {event.eventName}
          </h2>
          <p className="dp-section-lede mb-0">
            <span className={`dp-badge ${event.kind}`}>{event.kind}</span>{' '}
            <span className={`dp-badge ${event.status}`}>{event.status}</span>
          </p>
        </div>
        <div className="dp-toolbar">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onEdit}>
            {event.status === 'draft' ? 'Continue draft' : 'Edit event'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <dl className="dp-recap">
        <div>
          <dt>{dateLabel}</dt>
          <dd>{formatDate(event.incidentBeginDate)}</dd>
        </div>
        <div>
          <dt>Holds</dt>
          <dd>{holdSummary(event)}</dd>
        </div>
        <div>
          <dt>Areas</dt>
          <dd>{areaCountText(event.areas)}</dd>
        </div>
        {event.femaDeclarationNumber && (
          <div>
            <dt>FEMA declaration</dt>
            <dd>{event.femaDeclarationNumber}</dd>
          </div>
        )}
        {event.createdBy && (
          <div>
            <dt>Entered by</dt>
            <dd>{event.createdBy}</dd>
          </div>
        )}
      </dl>

      <div className="dp-subhead">
        <h3 className="dp-h3 mb-0">Impacted areas</h3>
        {event.status !== 'ended' && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            aria-expanded={appending}
            onClick={() => setAppending((open) => !open)}
          >
            {appending ? 'Close pick list' : 'Append counties or ZIP Codes'}
          </button>
        )}
      </div>

      {appending && (
        <div className="dp-append">
          <AreaPicker
            listed={[...event.areas, ...toAppend]}
            initialState={event.areas[0]?.state}
            onAdd={(incoming) => {
              const fresh = incoming.filter((a) => !isCovered(event.areas, a));
              setToAppend((waiting) => sortAreas(mergeAreas(waiting, fresh).areas));
            }}
            onError={(message) => flash(message, 'err')}
          />
          <div className="dp-append-list" aria-live="polite">
            {toAppend.length === 0 ? (
              <p className="dp-list-note">Areas you add from the pick list wait here until you append them.</p>
            ) : (
              <>
                <div className="dp-chips">
                  {toAppend.map((a) => (
                    <span className="dp-chip" key={areaKey(a)}>
                      {areaLabel(a)}
                      <button
                        type="button"
                        aria-label={`Drop ${areaLabel(a)}`}
                        onClick={() => setToAppend((cur) => cur.filter((x) => areaKey(x) !== areaKey(a)))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <button type="button" className="btn btn-sm btn-primary mt-2" disabled={busy} onClick={commitAppend}>
                  Append {areaCountText(toAppend)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="dp-end-bar">
        <label className="form-label mb-0" htmlFor={`${uid}-end`}>
          Incident Period End Date
        </label>
        <input
          id={`${uid}-end`}
          type="date"
          className="form-control form-control-sm"
          value={endDate}
          min={event.incidentBeginDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy || !endDate || !selectedIds.length}
          onClick={() => applyEndDate(endDate)}
        >
          Set on {selectedIds.length || 'selected'} {selectedIds.length === 1 ? 'area' : 'areas'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={busy || !areas.some((a) => a.id && selected.has(a.id) && a.incidentEndDate)}
          onClick={() => applyEndDate(null)}
        >
          Clear end date
        </button>
        {!selectedIds.length && <span className="dp-muted">Tick the areas whose incident period has ended.</span>}
      </div>

      <div className="table-responsive dp-review-scroll">
        <table className="table dp-table align-middle mb-0">
          <thead>
            <tr>
              <th scope="col" className="dp-check-col">
                <input
                  type="checkbox"
                  className="form-check-input"
                  aria-label="Select all areas"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(areas.map((a) => a.id as string)))
                  }
                />
              </th>
              <th scope="col">Type</th>
              <th scope="col">Area</th>
              <th scope="col">County FIPS</th>
              <th scope="col">Incident period</th>
              <th scope="col" className="text-end">
                <span className="visually-hidden">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => {
              const id = a.id as string;
              const ended = areaEnded(a, today);
              return (
                <tr key={id} className={selected.has(id) ? 'table-active' : undefined}>
                  <td className="dp-check-col">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      aria-label={`Select ${areaLabel(a)}`}
                      checked={selected.has(id)}
                      onChange={() => toggle(id)}
                    />
                  </td>
                  <td>
                    <span className={`dp-area-type ${a.zipCode ? 'zip' : 'county'}`}>
                      {a.zipCode ? 'ZIP' : 'County'}
                    </span>
                  </td>
                  <td>
                    {a.zipCode ? `ZIP ${a.zipCode}` : a.countyName}
                    <span className="dp-muted"> {a.zipCode ? `${a.countyName}, ${a.state}` : a.state}</span>
                  </td>
                  <td>{a.countyCode}</td>
                  <td>
                    {!a.incidentEndDate ? (
                      <span className="dp-period open">Open</span>
                    ) : ended ? (
                      <span className="dp-period ended">Ended {formatDate(a.incidentEndDate)}</span>
                    ) : (
                      <span className="dp-period open">Ends {formatDate(a.incidentEndDate)}</span>
                    )}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy || areas.length <= 1}
                      title={areas.length <= 1 ? 'An event needs at least one area' : undefined}
                      onClick={() => askRemove(a)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ImpactReport
        impact={impact}
        loading={impactLoading}
        error={impactError}
        preview={event.status === 'draft'}
        eventName={event.eventName}
        onRefresh={loadReport}
      />
    </section>
  );
}
