import type { DestinationBrief } from '../lib/types';
import { formatFt, formatTemp, scoreLabel } from '../lib/goNoGo';

interface Props {
  destinations: DestinationBrief[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function WeatherBoard({ destinations, selectedId, onSelect }: Props) {
  return (
    <section className="ski-board" aria-label="Mountain weather">
      {destinations.map((dest) => (
        <button
          key={dest.id}
          type="button"
          className={`ski-card${dest.id === selectedId ? ' is-selected' : ''}`}
          onClick={() => onSelect(dest.id)}
        >
          <div className="ski-card__top">
            <h2>{dest.name}</h2>
            <span className="ski-card__area">{dest.area}</span>
          </div>
          <div className={`ski-score ${dest.score}`}>{scoreLabel(dest.score)}</div>
          <dl className="ski-metrics">
            <dt>Temp</dt>
            <dd>{formatTemp(dest.weather.tempF)}</dd>
            <dt>Freeze</dt>
            <dd>{formatFt(dest.weather.freezeLevelFt)}</dd>
            <dt>Drive</dt>
            <dd>~{dest.driveMin} min</dd>
            <dt>Chains</dt>
            <dd>{dest.chainsLikely ? 'Likely' : 'Not flagged'}</dd>
          </dl>
          {dest.alerts[0] ? <p className="ski-alert">{dest.alerts[0].event}</p> : null}
          {dest.forecast?.shortForecast ? (
            <p className="ski-alert" style={{ color: 'var(--ski-muted)' }}>
              {dest.forecast.shortForecast}
            </p>
          ) : null}
        </button>
      ))}
    </section>
  );
}
