import { useMemo, useState } from 'react';
import CaliforniaTable from '../components/CaliforniaTable';
import ResortProfile from '../components/ResortProfile';
import RunDetail from '../components/RunDetail';
import RunFinder from '../components/RunFinder';
import TerrainScene from '../components/TerrainScene';
import type { BriefPayload, DemGrid, DestinationBrief, TrailsPayload } from '../lib/types';
import { formatFt } from '../lib/goNoGo';
import { filterActive, filterRuns, sortRuns, type RunFilter, type SortKey } from '../lib/trails';

interface TerrainInfo {
  avgSlopeDeg?: number;
  maxSlopeDeg?: number;
}

interface Props {
  brief: BriefPayload;
  dest: DestinationBrief | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
  dem: DemGrid | null;
  terrain: TerrainInfo | null;
  trails: TrailsPayload | null;
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
}

type View = 'state' | 'resort';

const EMPTY_FILTER: RunFilter = { tiers: new Set(), facing: '', maxPitch: null, namedOnly: false };

export default function SkiAreas(props: Props) {
  const { brief, dest, selectedId, onSelect, dem, terrain, trails, selectedRunId, onSelectRun } = props;
  const [filter, setFilter] = useState<RunFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<SortKey>('vertical');
  const [previewRunId, setPreviewRunId] = useState<string | null>(null);
  const [view, setView] = useState<View>('state');
  const [returnFrom, setReturnFrom] = useState<string | null>(null);
  const [flyRequest, setFlyRequest] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);

  const resortRuns = useMemo(
    () => (trails && dem && trails.id === dem.id ? trails.runs.filter((r) => r.resort === dest?.id) : []),
    [trails, dem, dest]
  );
  const shown = useMemo(() => sortRuns(filterRuns(resortRuns, filter), sort), [resortRuns, filter, sort]);
  const matchIds = useMemo(
    () => (filterActive(filter) ? new Set(shown.map((r) => r.id)) : null),
    [filter, shown]
  );
  const selectedRun = resortRuns.find((r) => r.id === selectedRunId) || null;

  const pickResort = (id: string) => {
    if (view === 'resort') {
      onSelect(id);
      return;
    }
    if (flying) return;
    setFlyRequest(null);
    queueMicrotask(() => setFlyRequest(id));
  };

  const toCalifornia = () => {
    if (view === 'state') return;
    onSelectRun(null);
    setReturnFrom(dest?.id || null);
    setFlyRequest(null);
    setView('state');
  };

  return (
    <>
      <header className="ski-hero">
        <h1>Ski Areas</h1>
        <p>
          Start on the California table, then fly onto the mountain. Mountain High, Snow Valley, Snow Summit, and Bear
          Mountain carry real OpenStreetMap runs and lifts draped on a USGS 3DEP elevation model, with pitch and facing
          measured run by run.
        </p>
      </header>
      <div className="ski-chips" role="tablist" aria-label="Ski area">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'state'}
          className={view === 'state' ? 'is-on' : ''}
          onClick={toCalifornia}
        >
          California
        </button>
        {brief.destinations.map((d) => {
          const on = view === 'resort' && d.id === selectedId;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? 'is-on' : ''}
              onClick={() => pickResort(d.id)}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      <section className="ski-trail-stage">
        <div className="ski-stage-slot">
          {view === 'state' ? (
            <CaliforniaTable
              destinations={brief.destinations}
              home={brief.home}
              returnFrom={returnFrom}
              flyRequest={flyRequest}
              onFlyStart={(id) => {
                setFlying(true);
                onSelect(id);
              }}
              onArrive={() => {
                setFlying(false);
                setFlyRequest(null);
                setView('resort');
              }}
            />
          ) : (
            <>
              <TerrainScene
                dem={dem}
                trails={trails}
                destinations={brief.destinations}
                resortId={dest?.id}
                selectedRunId={selectedRunId}
                previewRunId={previewRunId}
                matchIds={matchIds}
                onSelectRun={onSelectRun}
              />
              <button type="button" className="ski-to-state" onClick={toCalifornia}>
                <i className="bi bi-arrow-up-left" aria-hidden="true" /> California
              </button>
            </>
          )}
        </div>
        {view === 'state' ? (
          <aside className="ski-table-panel" aria-label="Mountains on the table">
            <h2>Pick a mountain</h2>
            <p>Drive times are from {brief.home.name}.</p>
            <ul>
              {brief.destinations.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => pickResort(d.id)} disabled={flying}>
                    <strong>{d.name}</strong>
                    <span>
                      {d.area} · {formatFt(d.baseFt)} to {formatFt(d.summitFt)} · ~{d.driveMin || d.typicalDriveMin} min
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : (
          <RunFinder
            runs={shown}
            total={resortRuns.length}
            filter={filter}
            onFilter={setFilter}
            sort={sort}
            onSort={setSort}
            selectedRunId={selectedRunId}
            onSelect={(id) => onSelectRun(id === selectedRunId ? null : id)}
            onPreview={setPreviewRunId}
          />
        )}
      </section>

      {view === 'resort' ? (
        <section className="ski-detail-row">
          <RunDetail run={selectedRun} onClear={() => onSelectRun(null)} />
          <div className="ski-side-stack">
            <ResortProfile dest={dest} />
            {terrain ? (
              <div className="ski-profile">
                <h3>Terrain model</h3>
                <dl>
                  <dt>Avg slope</dt>
                  <dd>{terrain.avgSlopeDeg ?? '—'}°</dd>
                  <dt>Max slope</dt>
                  <dd>{terrain.maxSlopeDeg ?? '—'}°</dd>
                  <dt>Base</dt>
                  <dd>{formatFt(dest?.baseFt)}</dd>
                </dl>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      <p className="ski-disclaimer">
        Trail lines are community-mapped (OpenStreetMap) and may lag resort changes. Not a resort trail report — check
        the resort for what is open and groomed today.
      </p>
    </>
  );
}
