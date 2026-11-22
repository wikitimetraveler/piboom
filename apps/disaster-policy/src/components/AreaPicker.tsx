import { useEffect, useId, useMemo, useState } from 'react';
import { loadCountiesForState, loadZipsForState } from '../api';
import type { CountyOption, PolicyArea, ZipOption } from '../types';
import { US_STATES } from '../types';

type Mode = 'county' | 'zip';

type Props = {
  /** Areas already on the list — shown ticked so they cannot be added twice. */
  listed: PolicyArea[];
  onAdd: (areas: PolicyArea[]) => void;
  onError: (message: string) => void;
  initialState?: string;
};

/** BRD pick lists: State → Counties, or State → County → ZIP Codes. */
export default function AreaPicker({ listed, onAdd, onError, initialState }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>('county');
  const [state, setState] = useState(initialState || 'CA');
  const [counties, setCounties] = useState<CountyOption[] | null>(null);
  const [countyFips, setCountyFips] = useState('');
  const [zipsByCounty, setZipsByCounty] = useState<Record<string, ZipOption[]> | null>(null);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setCounties(null);
    setCountyFips('');
    setPicked(new Set());
    loadCountiesForState(state)
      .then((rows) => {
        if (!cancelled) setCounties(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setCounties([]);
        onError(e instanceof Error ? e.message : 'County list failed to load');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the state changes
  }, [state]);

  useEffect(() => {
    if (mode !== 'zip') return undefined;
    let cancelled = false;
    setZipsByCounty(null);
    loadZipsForState(state)
      .then((rows) => {
        if (!cancelled) setZipsByCounty(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setZipsByCounty({});
        onError(e instanceof Error ? e.message : 'ZIP Code list failed to load');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when state or mode changes
  }, [state, mode]);

  const listedCounties = useMemo(
    () => new Set(listed.filter((a) => !a.zipCode).map((a) => `${a.state}:${a.countyCode}`)),
    [listed]
  );
  const listedZips = useMemo(
    () => new Set(listed.filter((a) => a.zipCode).map((a) => `${a.state}:${a.zipCode}`)),
    [listed]
  );

  const county = counties?.find((c) => c.county_fips === countyFips) || null;
  const q = filter.trim().toLowerCase();

  const countyRows = useMemo(
    () =>
      (counties || []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.county_fips.includes(q)),
    [counties, q]
  );
  const zipRows = useMemo(
    () =>
      ((countyFips && zipsByCounty?.[countyFips]) || []).filter(
        (z) => !q || z.zip.includes(q) || z.city.toLowerCase().includes(q)
      ),
    [zipsByCounty, countyFips, q]
  );

  const countyTaken = (c: CountyOption) => listedCounties.has(`${c.state_abbr}:${c.county_fips}`);
  const zipTaken = (z: ZipOption) =>
    listedZips.has(`${state}:${z.zip}`) || listedCounties.has(`${state}:${countyFips}`);

  const selectable =
    mode === 'county'
      ? countyRows.filter((c) => !countyTaken(c)).map((c) => c.county_fips)
      : zipRows.filter((z) => !zipTaken(z)).map((z) => z.zip);

  function switchMode(next: Mode) {
    setMode(next);
    setFilter('');
    setPicked(new Set());
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPicked() {
    if (mode === 'county') {
      onAdd(
        (counties || [])
          .filter((c) => picked.has(c.county_fips))
          .map((c) => ({ countyCode: c.county_fips, countyName: c.name, state: c.state_abbr }))
      );
    } else if (county) {
      onAdd(
        (zipsByCounty?.[county.county_fips] || [])
          .filter((z) => picked.has(z.zip))
          .map((z) => ({
            countyCode: county.county_fips,
            countyName: county.name,
            state: county.state_abbr,
            zipCode: z.zip,
            zipCity: z.city,
          }))
      );
    }
    setPicked(new Set());
  }

  const noun = mode === 'county' ? (picked.size === 1 ? 'county' : 'counties') : picked.size === 1 ? 'ZIP Code' : 'ZIP Codes';

  let listBody;
  if (mode === 'county') {
    if (counties === null) listBody = <p className="dp-list-note">Loading counties…</p>;
    else if (!countyRows.length) listBody = <p className="dp-list-note">No counties match “{filter}”.</p>;
    else
      listBody = countyRows.map((c) => {
        const taken = countyTaken(c);
        return (
          <label key={c.county_fips} className={`dp-pick-row${taken ? ' is-taken' : ''}`}>
            <input
              type="checkbox"
              checked={taken || picked.has(c.county_fips)}
              disabled={taken}
              onChange={() => toggle(c.county_fips)}
            />
            <span className="dp-pick-name">{c.name}</span>
            <span className="dp-pick-meta">{taken ? 'On the list' : `FIPS ${c.county_fips}`}</span>
          </label>
        );
      });
  } else if (!countyFips) {
    listBody = <p className="dp-list-note">Choose a county to see its ZIP Codes.</p>;
  } else if (zipsByCounty === null) {
    listBody = <p className="dp-list-note">Loading ZIP Codes…</p>;
  } else if (!zipRows.length) {
    listBody = (
      <p className="dp-list-note">
        {q ? `No ZIP Codes match “${filter}”.` : `No ZIP Codes on file for ${county?.name}.`}
      </p>
    );
  } else {
    listBody = zipRows.map((z) => {
      const taken = zipTaken(z);
      return (
        <label key={z.zip} className={`dp-pick-row${taken ? ' is-taken' : ''}`}>
          <input
            type="checkbox"
            checked={taken || picked.has(z.zip)}
            disabled={taken}
            onChange={() => toggle(z.zip)}
          />
          <span className="dp-pick-name">
            {z.zip}
            {z.city ? <span className="dp-pick-city"> · {z.city}</span> : null}
          </span>
          <span className="dp-pick-meta">{taken ? 'On the list' : ''}</span>
        </label>
      );
    });
  }

  return (
    <div className="dp-picker">
      <div className="dp-seg" role="group" aria-label="Area type">
        <button
          type="button"
          className={mode === 'county' ? 'is-on' : ''}
          aria-pressed={mode === 'county'}
          onClick={() => switchMode('county')}
        >
          Counties
        </button>
        <button
          type="button"
          className={mode === 'zip' ? 'is-on' : ''}
          aria-pressed={mode === 'zip'}
          onClick={() => switchMode('zip')}
        >
          ZIP Codes
        </button>
      </div>

      <div className="row g-2 mt-1">
        <div className="col-sm-3">
          <label className="form-label" htmlFor={`${uid}-state`}>
            State
          </label>
          <select
            id={`${uid}-state`}
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
        {mode === 'zip' && (
          <div className="col-sm-4">
            <label className="form-label" htmlFor={`${uid}-county`}>
              County
            </label>
            <select
              id={`${uid}-county`}
              className="form-select form-select-sm"
              value={countyFips}
              onChange={(e) => {
                setCountyFips(e.target.value);
                setPicked(new Set());
              }}
            >
              <option value="">Choose a county…</option>
              {(counties || []).map((c) => (
                <option key={c.county_fips} value={c.county_fips}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={mode === 'zip' ? 'col-sm-5' : 'col-sm-9'}>
          <label className="form-label" htmlFor={`${uid}-filter`}>
            {mode === 'county' ? 'Filter counties' : 'Filter ZIP Codes'}
          </label>
          <input
            id={`${uid}-filter`}
            className="form-control form-control-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={mode === 'county' ? 'Name or FIPS code' : 'ZIP Code or city'}
            autoComplete="off"
          />
        </div>
      </div>

      <div
        className="dp-pick-list mt-2"
        role="group"
        aria-label={mode === 'county' ? `Counties in ${state}` : `ZIP Codes in ${county?.name || state}`}
      >
        {listBody}
      </div>

      <div className="dp-picker-actions">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={!picked.size}
          onClick={addPicked}
        >
          {picked.size ? `Add ${picked.size} ${noun}` : mode === 'county' ? 'Add counties' : 'Add ZIP Codes'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={!selectable.length}
          onClick={() => setPicked(new Set(selectable))}
        >
          Select all {selectable.length || ''} shown
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={!picked.size}
          onClick={() => setPicked(new Set())}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
