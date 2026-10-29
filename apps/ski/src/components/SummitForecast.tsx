import type { GoogleWeatherBrief } from '../lib/types';

interface Props {
  weather: GoogleWeatherBrief | null | undefined;
}

const W = 360;
const H = 132;
const PAD = { l: 28, r: 8, t: 16, b: 22 };

export default function SummitForecast({ weather }: Props) {
  const hours = weather?.hours || [];
  if (!hours.length) {
    return (
      <div className="ski-profile">
        <h3>Summit forecast</h3>
        <p className="ski-disclaimer">
          Hourly summit wind and snow are unavailable right now. Neither Google Weather nor Open-Meteo answered.
        </p>
      </div>
    );
  }
  const snow = hours.map((h) => Math.max(0, h.snowIn || 0));
  const wind = hours.map((h) => Math.max(0, h.gustMph ?? h.windMph ?? 0));
  const maxSnow = Math.max(0.1, ...snow);
  const maxWind = Math.max(10, ...wind);
  const n = hours.length;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const slot = innerW / n;
  const x = (i: number) => PAD.l + slot * i + slot / 2;
  const yWind = (mph: number) => PAD.t + innerH - (mph / maxWind) * innerH;
  const line = wind.map((mph, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yWind(mph).toFixed(1)}`).join(' ');
  const totalSnow = snow.reduce((sum, v) => sum + v, 0);
  const labelAt = (i: number) => {
    const t = hours[i].time;
    if (!t) return '';
    const date = new Date(t);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getHours()}`;
  };

  return (
    <div className="ski-profile">
      <h3>Summit forecast</h3>
      <svg className="ski-summit" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Next ${n} hours at the summit. Snow ${totalSnow.toFixed(1)} inches. Peak gust ${Math.round(maxWind)} miles per hour.`}>
        {snow.map((inches, i) => {
          const barH = (inches / maxSnow) * innerH;
          return (
            <rect
              key={hours[i].time || i}
              x={PAD.l + slot * i + slot * 0.2}
              y={PAD.t + innerH - barH}
              width={Math.max(1, slot * 0.6)}
              height={barH}
              fill="#9fd4ea"
              opacity={inches > 0 ? 0.85 : 0.2}
            />
          );
        })}
        <path d={line} fill="none" stroke="#ffd166" strokeWidth="1.6" />
        {hours.map((hour, i) =>
          i % 6 === 0 ? (
            <text key={hour.time || `t-${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="ski-run-profile__label">
              {labelAt(i)}
            </text>
          ) : null
        )}
      </svg>
      <p className="ski-run-profile__key">
        <i style={{ background: '#9fd4ea', height: 8 }} />Snow
        <i style={{ background: '#ffd166', height: 2 }} />Gusts
        {weather?.windHold ? <span>Lift wind holds possible</span> : null}
      </p>
      <p className="ski-disclaimer">Source: {weather?.source === 'open-meteo' ? 'Open-Meteo' : 'Google Weather'}</p>
    </div>
  );
}
