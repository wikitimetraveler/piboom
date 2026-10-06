import type { SkiRun } from '../lib/types';
import { fmtDeg, fmtFt, pitchColor, runTitle, TIER_META, tierOf } from '../lib/trails';
import RunSymbol from './RunSymbol';

interface Props {
  run: SkiRun | null;
  onClear: () => void;
}

const W = 320;
const H = 120;
const PAD = { l: 8, r: 8, t: 14, b: 18 };

function Profile({ profile }: { profile: [number, number][] }) {
  const len = profile[profile.length - 1][0] || 1;
  const zs = profile.map((p) => p[1]);
  const top = Math.max(...zs);
  const bottom = Math.min(...zs);
  const span = Math.max(40, top - bottom);
  const x = (d: number) => PAD.l + (d / len) * (W - PAD.l - PAD.r);
  const y = (z: number) => PAD.t + ((top - z) / span) * (H - PAD.t - PAD.b);
  const area =
    `M${x(0)},${H - PAD.b} ` +
    profile.map(([d, z]) => `L${x(d).toFixed(1)},${y(z).toFixed(1)}`).join(' ') +
    ` L${x(len)},${H - PAD.b} Z`;
  return (
    <svg className="ski-run-profile" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Elevation profile, top to bottom">
      <defs>
        <linearGradient id="skiProfileFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ec8e3" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7ec8e3" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#skiProfileFill)" />
      {profile.slice(1).map(([d, z], i) => {
        const [d0, z0] = profile[i];
        const run = Math.max(1, d - d0);
        const pitch = (Math.atan(Math.abs(z0 - z) / run) * 180) / Math.PI;
        return (
          <line
            key={i}
            x1={x(d0)}
            y1={y(z0)}
            x2={x(d)}
            y2={y(z)}
            stroke={pitchColor(pitch)}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        );
      })}
      <text x={PAD.l} y={10} className="ski-run-profile__label">
        {Math.round(top).toLocaleString()} ft
      </text>
      <text x={W - PAD.r} y={H - 4} textAnchor="end" className="ski-run-profile__label">
        {Math.round(bottom).toLocaleString()} ft · {Math.round(len).toLocaleString()} ft run
      </text>
    </svg>
  );
}

export default function RunDetail({ run, onClear }: Props) {
  if (!run) {
    return (
      <div className="ski-profile ski-run-detail">
        <h3>Pick a run</h3>
        <p className="ski-disclaimer">
          Click a line on the 3D map or a row in the finder. Pitch and facing come off the elevation model; open/closed
          and grooming today come from the resort.
        </p>
      </div>
    );
  }
  const tier = tierOf(run.difficulty);
  return (
    <div className="ski-profile ski-run-detail">
      <header className="ski-run-detail__head">
        <RunSymbol tier={tier} size={16} />
        <h3>{runTitle(run)}</h3>
        <button type="button" className="ski-run-detail__clear" onClick={onClear} aria-label="Clear selected run">
          ×
        </button>
      </header>
      <p className="ski-run-detail__tier">{TIER_META[tier].label}{run.grooming ? ` · ${run.grooming}` : ''}</p>
      <dl>
        <dt>Vertical</dt>
        <dd>{fmtFt(run.verticalFt)}</dd>
        <dt>Length</dt>
        <dd>{fmtFt(run.lengthFt)}</dd>
        <dt>Avg pitch</dt>
        <dd>{fmtDeg(run.avgPitchDeg)}</dd>
        <dt>Steepest pitch</dt>
        <dd>{fmtDeg(run.maxPitchDeg)}</dd>
        <dt>Faces</dt>
        <dd>{run.aspect ? `${run.aspect} (${run.aspectDeg}°)` : '—'}</dd>
        <dt>Top → bottom</dt>
        <dd>
          {fmtFt(run.topFt)} → {fmtFt(run.bottomFt)}
        </dd>
      </dl>
      {run.profile && run.profile.length > 1 ? <Profile profile={run.profile} /> : null}
      <p className="ski-run-profile__key">
        <i style={{ background: pitchColor(5) }} />&lt;12°
        <i style={{ background: pitchColor(15) }} />12–20°
        <i style={{ background: pitchColor(24) }} />20–28°
        <i style={{ background: pitchColor(32) }} />28°+
      </p>
    </div>
  );
}
