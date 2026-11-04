import { useEffect, useRef, useState } from 'react';
import type { DemGrid, SkiLift, SkiRun } from '../lib/types';
import {
  findRunsOffLift,
  sampleRunAtProgress,
  summarizeLapChain,
  type RunSamplePoint,
} from '../lib/mountainAnalysis';
import { coverPhrase, fmtDeg, fmtFt, liftTitle, pitchColor, runTitle, TIER_META, tierOf } from '../lib/trails';
import RunSymbol from './RunSymbol';

interface Props {
  run: SkiRun | null;
  onClear: () => void;
  dem?: DemGrid | null;
  allRuns?: SkiRun[];
  allLifts?: SkiLift[];
  selectedLiftId?: string | null;
  onSelectLift?: (id: string | null) => void;
  onSelectRun?: (id: string) => void;
  lapRunIds?: string[];
  onLapRunIdsChange?: (ids: string[]) => void;
  onPovSampleChange?: (
    sample: (RunSamplePoint & { followCam?: boolean }) | null
  ) => void;
}

const W = 320;
const H = 126;
const PAD = { l: 8, r: 8, t: 16, b: 18 };
const FLY_MS = 11_000;

function Profile({
  profile,
  progress,
  onScrub,
}: {
  profile: [number, number][];
  progress: number | null;
  onScrub?: (t: number | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
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

  const zAtProgress = (t: number): { d: number; z: number; pitch: number } => {
    const targetD = Math.max(0, Math.min(1, t)) * len;
    for (let i = 0; i < profile.length - 1; i++) {
      const [d0, z0] = profile[i];
      const [d1, z1] = profile[i + 1];
      if (targetD <= d1 || i === profile.length - 2) {
        const segLen = Math.max(1, d1 - d0);
        const u = Math.max(0, Math.min(1, (targetD - d0) / segLen));
        const pitch = (Math.atan(Math.abs(z0 - z1) / segLen) * 180) / Math.PI;
        return { d: targetD, z: z0 + u * (z1 - z0), pitch };
      }
    }
    const last = profile[profile.length - 1];
    return { d: last[0], z: last[1], pitch: 0 };
  };

  const marker = progress != null ? zAtProgress(progress) : null;

  const handlePointer = (clientX: number) => {
    if (!onScrub || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const frac = (clientX - rect.left) / Math.max(1, rect.width);
    onScrub(Math.max(0, Math.min(1, frac)));
  };

  return (
    <svg
      ref={svgRef}
      className="ski-run-profile"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Elevation profile, top to bottom — hover or drag to scrub 3D position"
      onPointerMove={(e) => handlePointer(e.clientX)}
      onPointerDown={(e) => handlePointer(e.clientX)}
    >
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
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        );
      })}
      {marker ? (
        <g className="ski-run-profile__cursor">
          <line
            x1={x(marker.d)}
            y1={PAD.t - 4}
            x2={x(marker.d)}
            y2={H - PAD.b}
            stroke="#7ec8e3"
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
          <circle
            cx={x(marker.d)}
            cy={y(marker.z)}
            r="4.5"
            fill={pitchColor(marker.pitch)}
            stroke="#ffffff"
            strokeWidth="1.6"
          />
          <text
            x={Math.min(W - 62, Math.max(8, x(marker.d) - 26))}
            y={Math.max(11, y(marker.z) - 8)}
            className="ski-run-profile__readout"
          >
            {Math.round(marker.z).toLocaleString()} ft · {marker.pitch.toFixed(0)}°
          </text>
        </g>
      ) : null}
      <text x={PAD.l} y={11} className="ski-run-profile__label">
        {Math.round(top).toLocaleString()} ft
      </text>
      <text x={W - PAD.r} y={H - 4} textAnchor="end" className="ski-run-profile__label">
        {Math.round(bottom).toLocaleString()} ft · {Math.round(len).toLocaleString()} ft run
      </text>
    </svg>
  );
}

export default function RunDetail(props: Props) {
  const {
    run,
    onClear,
    dem = null,
    allRuns = [],
    allLifts = [],
    selectedLiftId = null,
    onSelectLift,
    onSelectRun,
    lapRunIds = [],
    onLapRunIdsChange,
    onPovSampleChange,
  } = props;

  const [progress, setProgress] = useState<number | null>(null);
  const [flying, setFlying] = useState(false);
  const [followCam, setFollowCam] = useState(true);
  const rafRef = useRef(0);

  const selectedLift = allLifts.find((l) => l.id === selectedLiftId) || null;
  const liftReach = selectedLift ? findRunsOffLift(selectedLift, allRuns, dem) : null;
  const lapRuns = lapRunIds
    .map((id) => allRuns.find((r) => r.id === id))
    .filter((r): r is SkiRun => Boolean(r));
  const lapSummary = lapRuns.length ? summarizeLapChain(lapRuns) : null;

  const stopFly = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    setFlying(false);
  };

  useEffect(() => {
    stopFly();
    setProgress(null);
    onPovSampleChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const updateProgress = (nextT: number | null, cam = followCam && flying) => {
    setProgress(nextT);
    if (nextT == null || !run) {
      onPovSampleChange?.(null);
      return;
    }
    const sample = sampleRunAtProgress(run, dem, nextT);
    if (sample) {
      onPovSampleChange?.({ ...sample, followCam: cam });
    }
  };

  const toggleFly = () => {
    if (!run) return;
    if (flying) {
      stopFly();
      return;
    }
    const startT = progress != null && progress < 0.96 ? progress : 0;
    const t0 = performance.now() - startT * FLY_MS;
    setFlying(true);
    const step = (now: number) => {
      const next = Math.min(1, (now - t0) / FLY_MS);
      setProgress(next);
      const sample = sampleRunAtProgress(run, dem, next);
      if (sample) {
        onPovSampleChange?.({ ...sample, followCam });
      }
      if (next < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setFlying(false);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const toggleInLap = (runId: string) => {
    if (!onLapRunIdsChange) return;
    if (lapRunIds.includes(runId)) {
      onLapRunIdsChange(lapRunIds.filter((id) => id !== runId));
    } else {
      onLapRunIdsChange([...lapRunIds, runId]);
    }
  };

  const liveSample = run && progress != null ? sampleRunAtProgress(run, dem, progress) : null;

  return (
    <div className="ski-profile ski-run-detail">
      {run ? (
        <>
          <header className="ski-run-detail__head">
            <RunSymbol tier={tierOf(run.difficulty)} size={16} />
            <h3>{runTitle(run)}</h3>
            <button type="button" className="ski-run-detail__clear" onClick={onClear} aria-label="Clear selected run">
              ×
            </button>
          </header>
          <p className="ski-run-detail__tier">
            {TIER_META[tierOf(run.difficulty)].label}
            {run.grooming ? ` · ${run.grooming}` : ''}
          </p>

          <div className="ski-pov-bar" role="group" aria-label="3D Run Fly-Through">
            <button type="button" className={`ski-pov-btn${flying ? ' is-on' : ''}`} onClick={toggleFly}>
              <i className={`bi ${flying ? 'bi-pause-fill' : 'bi-camera-reels-fill'}`} aria-hidden="true" />{' '}
              {flying ? 'Pause Descent' : progress && progress > 0 && progress < 1 ? 'Resume POV Fly-Down' : 'Fly Down Run (3D POV)'}
            </button>
            <label className="ski-pov-cam-toggle" title="Lock 3D camera behind the skier during descent">
              <input
                type="checkbox"
                checked={followCam}
                onChange={(e) => setFollowCam(e.target.checked)}
              />
              Chase cam
            </label>
            {onLapRunIdsChange ? (
              <button
                type="button"
                className={`ski-lap-add${lapRunIds.includes(run.id) ? ' is-on' : ''}`}
                onClick={() => toggleInLap(run.id)}
              >
                {lapRunIds.includes(run.id) ? '✓ In Lap Chain' : '+ Add to Lap'}
              </button>
            ) : null}
          </div>

          <div className="ski-pov-scrubber">
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((progress ?? 0) * 1000)}
              aria-label="Scrub along run from top to bottom"
              onChange={(e) => {
                if (flying) stopFly();
                const val = Number(e.target.value) / 1000;
                updateProgress(val, followCam);
              }}
            />
            {liveSample ? (
              <span className="ski-pov-telemetry">
                {Math.round(liveSample.elevFt).toLocaleString()} ft ·{' '}
                <strong>{liveSample.pitchDeg.toFixed(1)}° pitch</strong> ·{' '}
                {Math.round(liveSample.totalFt - liveSample.distanceFt).toLocaleString()} ft to bottom
              </span>
            ) : (
              <span className="ski-pov-telemetry">Drag slider or chart to scrub the 3D line</span>
            )}
          </div>

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
            <dt>Tree cover</dt>
            <dd>
              {run.treeCoverPct == null
                ? '—'
                : `${run.treeCoverPct}%${coverPhrase(run.coverLabel) ? ` · ${coverPhrase(run.coverLabel)}` : ''}`}
            </dd>
            <dt>Top → bottom</dt>
            <dd>
              {fmtFt(run.topFt)} → {fmtFt(run.bottomFt)}
            </dd>
          </dl>
          {run.profile && run.profile.length > 1 ? (
            <Profile
              profile={run.profile}
              progress={progress}
              onScrub={(t) => {
                if (flying) stopFly();
                updateProgress(t, false);
              }}
            />
          ) : null}
          <p className="ski-run-profile__key">
            <i style={{ background: pitchColor(5) }} />&lt;12°
            <i style={{ background: pitchColor(15) }} />12–20°
            <i style={{ background: pitchColor(24) }} />20–28°
            <i style={{ background: pitchColor(32) }} />28°+
          </p>
        </>
      ) : (
        <>
          <h3>Pick a run or chairlift</h3>
          <p className="ski-disclaimer">
            Click any trail on the 3D map to inspect its elevation profile and fly down the fall line in 3D POV — or
            choose a chairlift below to see every run reachable from its top station.
          </p>
        </>
      )}

      {allLifts.length > 0 ? (
        <div className="ski-lift-builder">
          <div className="ski-lift-builder__head">
            <h4>Lift-to-Run Explorer &amp; Lap Builder</h4>
            <select
              value={selectedLiftId || ''}
              aria-label="Inspect lift unload station"
              onChange={(e) => onSelectLift?.(e.target.value || null)}
            >
              <option value="">Select a chairlift ({allLifts.length})…</option>
              {allLifts.map((l) => (
                <option key={l.id} value={l.id}>
                  {liftTitle(l)} ({fmtFt(l.riseFt)} rise)
                </option>
              ))}
            </select>
          </div>

          {selectedLift && liftReach ? (
            <div className="ski-lift-reach">
              <p className="ski-lift-reach__meta">
                <strong>{liftTitle(selectedLift)}</strong> unloads near{' '}
                <strong>{fmtFt(liftReach.topElevFt)}</strong> ·{' '}
                {liftReach.reachableRuns.length} reachable run{liftReach.reachableRuns.length === 1 ? '' : 's'}:
              </p>
              {liftReach.reachableRuns.length ? (
                <div className="ski-lift-reach__chips">
                  {liftReach.reachableRuns.slice(0, 12).map((r) => {
                    const inLap = lapRunIds.includes(r.id);
                    return (
                      <div key={r.id} className="ski-lift-reach__item">
                        <button
                          type="button"
                          className={r.id === run?.id ? 'is-on' : ''}
                          onClick={() => onSelectRun?.(r.id)}
                        >
                          <RunSymbol tier={tierOf(r.difficulty)} size={11} />
                          <span>{runTitle(r)}</span>
                          <small>{fmtFt(r.verticalFt)}</small>
                        </button>
                        {onLapRunIdsChange ? (
                          <button
                            type="button"
                            className={`ski-lift-reach__add${inLap ? ' is-on' : ''}`}
                            onClick={() => toggleInLap(r.id)}
                            title={inLap ? 'Remove from lap chain' : 'Add to lap chain'}
                          >
                            {inLap ? '✓' : '+'}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="ski-disclaimer">No mapped runs start near this unload station.</p>
              )}
            </div>
          ) : null}

          {lapSummary ? (
            <div className="ski-lap-card">
              <div className="ski-lap-card__head">
                <strong>
                  Custom Lap Chain ({lapSummary.runs.length} leg{lapSummary.runs.length === 1 ? '' : 's'})
                </strong>
                <button type="button" onClick={() => onLapRunIdsChange?.([])}>
                  Clear lap
                </button>
              </div>
              <p className="ski-lap-card__route">
                {lapSummary.runs.map((r) => runTitle(r)).join(' → ')}
              </p>
              <div className="ski-lap-card__stats">
                <span><strong>{fmtFt(lapSummary.totalVerticalFt)}</strong> total vert</span>
                <span><strong>{(lapSummary.totalLengthFt / 5280).toFixed(1)} mi</strong> length</span>
                <span><strong>{fmtDeg(lapSummary.avgPitchDeg)}</strong> avg · <strong>{fmtDeg(lapSummary.maxPitchDeg)}</strong> max</span>
              </div>
              {lapSummary.combinedProfile.length > 1 ? (
                <Profile profile={lapSummary.combinedProfile} progress={null} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
