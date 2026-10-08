import type { ReactNode } from 'react';
import type { MemberDay, TripPass } from '../../lib/logTypes';
import { fmtAgo } from '../../lib/logFormat';
import { fmtFt } from '../../lib/trails';
import type { TrackerState } from '../../lib/tracker';
import CheckIn from './CheckIn';

interface Props {
  pass: TripPass;
  tracker: TrackerState;
  mine: MemberDay | null;
  onToggleTrack: () => void;
  onLogged: () => void;
  children?: ReactNode;
}

export default function SkiPanel({ pass, tracker, mine, onToggleTrack, onLogged, children }: Props) {
  const fix = tracker.lastFix;
  const last = mine?.segments[mine.segments.length - 1];
  return (
    <div className="log-ski">
      <div className="log-tally" aria-live="polite">
        <div>
          <strong>{mine?.stats.runs ?? 0}</strong>
          <span>runs</span>
        </div>
        <div>
          <strong>{fmtFt(mine?.stats.verticalFt ?? 0)}</strong>
          <span>vertical</span>
        </div>
        <div>
          <strong>{mine?.stats.topSpeedMph ? `${Math.round(mine.stats.topSpeedMph)}` : '—'}</strong>
          <span>top mph</span>
        </div>
      </div>
      {last ? (
        <p className="log-last">
          Last: {last.kind === 'lift' ? `rode ${last.lift?.name || 'a lift'}` : last.run?.name || (last.offPiste ? 'off-piste' : 'an unnamed run')}
        </p>
      ) : null}

      <button
        type="button"
        className={`log-big ${tracker.tracking ? 'log-big--stop' : 'log-big--track'}`}
        onClick={onToggleTrack}
        aria-pressed={tracker.tracking}
      >
        <strong>{tracker.tracking ? 'Stop tracking' : 'Track my runs'}</strong>
        <span>
          {tracker.tracking
            ? tracker.awake
              ? 'Screen stays on while tracking — keep this page open.'
              : 'Keep this page open and the screen on.'
            : 'Live GPS. Uses battery fast — check-ins are the all-day option.'}
        </span>
      </button>

      {tracker.tracking || tracker.queued ? (
        <p className="log-gps">
          {fix ? `GPS ±${fix.acc ?? '?'} m · ${fmtAgo(fix.ts)}` : 'Waiting for GPS…'}
          {tracker.queued ? ` · ${tracker.queued} points waiting to upload` : ' · all uploaded'}
        </p>
      ) : null}
      {tracker.error ? <p className="log-error">{tracker.error}</p> : null}

      <CheckIn pass={pass} recentFix={fix} onLogged={onLogged} />
      {children}
    </div>
  );
}
