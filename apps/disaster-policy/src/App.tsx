import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteEvent, listEvents, setStatus } from './api';
import { areaCountText, formatDate } from './areas';
import ConfirmDialog, { type DeskConfirm } from './components/ConfirmDialog';
import DeclareWizard from './components/DeclareWizard';
import EventManager, { holdSummary } from './components/EventManager';
import { parsePrefillFromSearch, type PrefillPayload } from './prefill';
import type { PolicyEvent, PolicyKind, PolicyStatus } from './types';

type WizardSession = {
  /** Bumped to remount the wizard with a clean slate. */
  key: number;
  editingId: string | null;
  prefill: PrefillPayload | null;
};

export default function App() {
  const [events, setEvents] = useState<PolicyEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind?: 'ok' | 'err' }>({ text: '' });
  const [listKind, setListKind] = useState<'' | PolicyKind>('');
  const [listStatus, setListStatus] = useState<'' | PolicyStatus>('');
  const [wizard, setWizard] = useState<WizardSession>(() => ({
    key: 0,
    editingId: null,
    prefill: parsePrefillFromSearch(window.location.search),
  }));
  const [managedId, setManagedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DeskConfirm | null>(null);

  const flash = useCallback((text: string, kind?: 'ok' | 'err') => setStatusMsg({ text, kind }), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  const refresh = useCallback(async () => {
    try {
      setEvents(await listEvents());
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Policy events failed to load', 'err');
    } finally {
      setLoaded(true);
    }
  }, [flash]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The hand-off query has been read into the wizard; drop it so a reload starts clean.
  useEffect(() => {
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const shown = useMemo(
    () => events.filter((e) => (!listKind || e.kind === listKind) && (!listStatus || e.status === listStatus)),
    [events, listKind, listStatus]
  );
  const editing = events.find((e) => e.id === wizard.editingId) || null;
  const managed = events.find((e) => e.id === managedId) || null;

  function resetWizard(editingId: string | null = null) {
    setWizard((w) => ({ key: w.key + 1, editingId, prefill: null }));
  }

  function replaceEvent(event: PolicyEvent) {
    setEvents((list) => list.map((e) => (e.id === event.id ? event : e)));
  }

  function askEnd(event: PolicyEvent) {
    setConfirm({
      tone: 'end',
      kicker: 'Release holds',
      title: 'End this event?',
      eventName: event.eventName,
      body: 'Holds stop applying to every loan in its areas. The event stays on the register as Ended.',
      confirmLabel: 'End event',
      run: async () => {
        try {
          replaceEvent(await setStatus(event.id, 'ended'));
          flash(`“${event.eventName}” ended. Its holds are released.`, 'ok');
        } catch (e) {
          flash(e instanceof Error ? e.message : 'The event could not be ended', 'err');
        }
      },
    });
  }

  function askDelete(event: PolicyEvent) {
    setConfirm({
      tone: 'delete',
      kicker: 'Permanent removal',
      title: 'Delete this event?',
      eventName: event.eventName,
      body: 'The event and its areas are removed from the Disaster Database. This cannot be undone.',
      confirmLabel: 'Delete event',
      run: async () => {
        try {
          await deleteEvent(event.id);
          setEvents((list) => list.filter((e) => e.id !== event.id));
          if (managedId === event.id) setManagedId(null);
          if (wizard.editingId === event.id) resetWizard();
          flash(`“${event.eventName}” deleted.`, 'ok');
        } catch (e) {
          flash(e instanceof Error ? e.message : 'The event could not be deleted', 'err');
        }
      },
    });
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
          Declare a <strong>Declared Disaster</strong> or a <strong>Pending Natural Disaster</strong> hold, then
          keep its areas, incident period end dates and impacted-loan reports current.
        </p>
      </header>

      <div className={`dp-status ${statusMsg.kind || ''}`} role="status" aria-live="polite">
        {statusMsg.text}
      </div>

      <DeclareWizard
        key={wizard.key}
        editing={editing}
        prefill={wizard.prefill}
        flash={flash}
        onCancelEdit={() => resetWizard()}
        onSaveFailed={() => void refresh()}
        onSaved={(event, message) => {
          flash(message, 'ok');
          resetWizard();
          setManagedId(event.id);
          void refresh();
        }}
      />

      <section className="dp-panel" aria-labelledby="dp-register-title">
        <div className="dp-section-head">
          <h2 id="dp-register-title" className="mb-0">
            Policy register
          </h2>
          <div className="dp-toolbar">
            <label className="dp-filter">
              <span className="visually-hidden">Filter by kind</span>
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
              <span className="visually-hidden">Filter by status</span>
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
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table dp-table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">Areas</th>
                <th scope="col">Began</th>
                <th scope="col">Holds</th>
                <th scope="col" className="text-end">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    {!loaded
                      ? 'Loading policy events…'
                      : events.length
                        ? 'No events match these filters.'
                        : 'No policy events yet. Declare one above, or send a hazard over from Unified Disasters.'}
                  </td>
                </tr>
              ) : (
                shown.map((ev) => (
                  <tr
                    key={ev.id}
                    className={
                      wizard.editingId === ev.id ? 'table-warning' : managedId === ev.id ? 'table-active' : undefined
                    }
                  >
                    <td>
                      <strong>{ev.eventName}</strong>
                      <div className="dp-muted">
                        {[ev.disasterType, ev.femaDeclarationNumber && `FEMA ${ev.femaDeclarationNumber}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </td>
                    <td>
                      <span className={`dp-badge ${ev.kind}`}>{ev.kind}</span>
                    </td>
                    <td>
                      <span className={`dp-badge ${ev.status}`}>{ev.status}</span>
                    </td>
                    <td>{areaCountText(ev.areas)}</td>
                    <td>{formatDate(ev.incidentBeginDate)}</td>
                    <td className="small">{holdSummary(ev)}</td>
                    <td className="text-end">
                      <div className="dp-row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setManagedId(ev.id)}
                        >
                          Areas &amp; report
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => resetWizard(ev.id)}
                        >
                          {ev.status === 'draft' ? 'Continue draft' : 'Edit'}
                        </button>
                        {ev.status === 'active' && (
                          <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => askEnd(ev)}>
                            End
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => askDelete(ev)}>
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

      {managed && (
        <EventManager
          event={managed}
          flash={flash}
          askConfirm={setConfirm}
          onChanged={replaceEvent}
          onEdit={() => resetWizard(managed.id)}
          onClose={() => setManagedId(null)}
        />
      )}

      {confirm && <ConfirmDialog confirm={confirm} onClose={closeConfirm} />}
    </main>
  );
}
