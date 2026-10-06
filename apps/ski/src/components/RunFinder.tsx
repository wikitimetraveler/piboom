import type { SkiRun } from '../lib/types';
import {
  FACINGS,
  fmtDeg,
  fmtFt,
  runTitle,
  TIER_META,
  TIERS,
  tierOf,
  type RunFilter,
  type SortKey,
  type Tier,
} from '../lib/trails';
import RunSymbol from './RunSymbol';

interface Props {
  runs: SkiRun[];
  total: number;
  filter: RunFilter;
  onFilter: (f: RunFilter) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  selectedRunId: string | null;
  onSelect: (id: string) => void;
  onPreview: (id: string | null) => void;
}

const PITCH_STEPS = [null, 15, 20, 25, 30] as const;

export default function RunFinder(props: Props) {
  const { runs, total, filter, onFilter, sort, onSort, selectedRunId, onSelect, onPreview } = props;

  const toggleTier = (tier: Tier) => {
    const tiers = new Set(filter.tiers);
    if (tiers.has(tier)) tiers.delete(tier);
    else tiers.add(tier);
    onFilter({ ...filter, tiers });
  };

  return (
    <aside className="ski-finder" aria-label="Run finder">
      <header className="ski-finder__head">
        <h3>Run finder</h3>
        <span className="ski-finder__count">
          {runs.length} of {total}
        </span>
      </header>

      <div className="ski-finder__tiers" role="group" aria-label="Difficulty">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={filter.tiers.has(tier) ? 'is-on' : ''}
            aria-pressed={filter.tiers.has(tier)}
            onClick={() => toggleTier(tier)}
            title={TIER_META[tier].label}
          >
            <RunSymbol tier={tier} size={12} />
            <span>{TIER_META[tier].label}</span>
          </button>
        ))}
      </div>

      <div className="ski-finder__row">
        <label>
          <span>Facing</span>
          <select value={filter.facing} onChange={(e) => onFilter({ ...filter, facing: e.target.value })}>
            {FACINGS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Avg pitch</span>
          <select
            value={filter.maxPitch ?? ''}
            onChange={(e) => onFilter({ ...filter, maxPitch: e.target.value ? Number(e.target.value) : null })}
          >
            {PITCH_STEPS.map((p) => (
              <option key={p ?? 'any'} value={p ?? ''}>
                {p == null ? 'Any' : `≤ ${p}°`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
            <option value="vertical">Vertical</option>
            <option value="length">Length</option>
            <option value="pitch">Steepest</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <label className="ski-finder__check">
        <input
          type="checkbox"
          checked={filter.namedOnly}
          onChange={(e) => onFilter({ ...filter, namedOnly: e.target.checked })}
        />
        Named runs only
      </label>

      <ol className="ski-finder__list" onMouseLeave={() => onPreview(null)}>
        {runs.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={r.id === selectedRunId ? 'is-on' : ''}
              onClick={() => onSelect(r.id)}
              onMouseEnter={() => onPreview(r.id)}
              onFocus={() => onPreview(r.id)}
              onBlur={() => onPreview(null)}
            >
              <RunSymbol tier={tierOf(r.difficulty)} size={13} />
              <span className="ski-run__name">
                {runTitle(r)}
                <small>
                  {fmtFt(r.verticalFt)} vert · {fmtFt(r.lengthFt)}
                </small>
              </span>
              <span className="ski-run__pitch">
                {fmtDeg(r.avgPitchDeg)}
                <small>{r.aspect ? `faces ${r.aspect}` : ''}</small>
              </span>
            </button>
          </li>
        ))}
        {!runs.length ? (
          <li className="ski-empty">
            {total ? 'No runs match — loosen a filter.' : 'No mapped runs for this area yet.'}
          </li>
        ) : null}
      </ol>
    </aside>
  );
}
