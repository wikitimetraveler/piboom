import { useMemo, useState } from 'react';
import type { OnTheWayStop } from '../lib/types';
import { mapsDirUrl } from '../lib/goNoGo';

const CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'thrift', label: 'Thrift' },
  { id: 'scenic', label: 'Scenic' },
];

const SCENIC = new Set(['viewpoint', 'town', 'food', 'lake']);
const HIDDEN = new Set(['smoke', 'dispensary']);

interface Props {
  stops: OnTheWayStop[];
}

export default function OnTheWay({ stops }: Props) {
  const [kind, setKind] = useState('all');
  const shown = useMemo(() => {
    const visible = stops.filter((s) => !HIDDEN.has(s.kind));
    if (kind === 'all') return visible;
    if (kind === 'scenic') return visible.filter((s) => SCENIC.has(s.kind));
    return visible.filter((s) => s.kind === kind);
  }, [kind, stops]);

  return (
    <section aria-label="On the way">
      <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.15rem' }}>On the way</h2>
      <div className="ski-chips" role="tablist">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={kind === chip.id ? 'is-on' : ''}
            onClick={() => setKind(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="ski-empty">No stops in this filter yet.</p>
      ) : (
        <div className="ski-stops">
          {shown.map((stop) => {
            const dest = stop.lat != null && stop.lng != null ? `${stop.lat},${stop.lng}` : stop.name;
            return (
              <article key={stop.id} className="ski-stop">
                <h3>{stop.name}</h3>
                <p>{stop.note || stop.town}</p>
                <div className="ski-stop__meta">
                  {stop.kind} · {stop.town || stop.route} · {stop.source || 'seed'} ·{' '}
                  <a href={mapsDirUrl(dest)} target="_blank" rel="noreferrer">
                    dir
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
