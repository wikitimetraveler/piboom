import type { ReactNode } from 'react';
import type { DayStats, Segment, TripDay } from '../../lib/logTypes';
import { fmtClock, fmtDay, fmtDuration, todayLocal } from '../../lib/logFormat';
import { TIERS, TIER_META, fmtDeg, fmtFt, liftTitle, runTitle } from '../../lib/trails';
import RunSymbol from '../RunSymbol';

interface Props {
  day: TripDay | null;
  date: string;
  onDate: (date: string) => void;
  focus: number | 'crew';
  onFocus: (id: number | 'crew') => void;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  children?: ReactNode;
}

function StatGrid({ stats }: { stats: DayStats }) {
  return (
    <div className="log-stats">
      <div>
        <strong>{stats.runs}</strong>
        <span>runs</span>
      </div>
      <div>
        <strong>{fmtFt(stats.verticalFt)}</strong>
        <span>vertical</span>
      </div>
      <div>
        <strong>{stats.distanceMi} mi</strong>
        <span>on runs</span>
      </div>
      <div>
        <strong>{stats.topSpeedMph ? `${stats.topSpeedMph} mph` : '—'}</strong>
        <span>top speed</span>
      </div>
      <div>
        <strong>{stats.liftRides}</strong>
        <span>lift rides</span>
      </div>
      <div>
        <strong>{stats.steepestRun ? fmtDeg(stats.steepestRun.maxPitchDeg) : '—'}</strong>
        <span>{stats.steepestRun ? `steepest · ${stats.steepestRun.name}` : 'steepest pitch'}</span>
      </div>
      <div className="log-mix" aria-label="Runs by difficulty">
        {TIERS.map((t) =>
          stats.byDifficulty[t] ? (
            <span key={t} title={TIER_META[t].label}>
              <RunSymbol tier={t} size={12} /> {stats.byDifficulty[t]}
            </span>
          ) : null
        )}
        {stats.byDifficulty.unrated ? <span title="Unrated or off-piste">· {stats.byDifficulty.unrated} other</span> : null}
      </div>
    </div>
  );
}

function SegmentRow({ s, color, who }: { s: Segment; color?: string; who?: string }) {
  if (s.kind === 'lift') {
    return (
      <li className="log-seg-row log-seg-row--lift">
        <span className="log-seg-row__time">{fmtClock(s.startTs)}</span>
        <span className="log-seg-row__icon" aria-hidden>
          ↑
        </span>
        <span className="log-seg-row__main">
          {s.lift ? liftTitle(s.lift) : 'Lift or hike'}
          <small>
            {fmtFt(s.verticalFt)} up · {fmtDuration(s.durationS)}
            {who ? ` · ${who}` : ''}
          </small>
        </span>
      </li>
    );
  }
  const names = s.runs.length > 1 ? s.runs.map((r) => runTitle(r)).join(' → ') : s.run ? runTitle(s.run) : s.offPiste ? 'Off-piste' : 'Unnamed run';
  return (
    <li className="log-seg-row" style={color ? { borderLeftColor: color } : undefined}>
      <span className="log-seg-row__time">{fmtClock(s.startTs)}</span>
      <span className="log-seg-row__icon">{s.run ? <RunSymbol tier={s.run.tier} /> : '◇'}</span>
      <span className="log-seg-row__main">
        {names}
        <small>
          {fmtFt(s.verticalFt)}
          {s.run?.maxPitchDeg ? ` · max ${fmtDeg(s.run.maxPitchDeg)}` : ''}
          {s.topSpeedMph ? ` · ${Math.round(s.topSpeedMph)} mph` : ''}
          {s.source === 'checkin' ? ' · check-in' : ''}
          {who ? ` · ${who}` : ''}
        </small>
      </span>
    </li>
  );
}

export default function TodayPanel({ day, date, onDate, focus, onFocus, loading, error, onRefresh, children }: Props) {
  const days = Array.from(new Set([todayLocal(), ...(day?.days || [])])).sort().reverse();
  const member = focus === 'crew' ? null : day?.members.find((m) => m.id === focus) || null;
  const stats = member ? member.stats : day?.crew;
  const byId = new Map((day?.members || []).map((m) => [m.id, m]));
  const segments = member
    ? member.segments
    : (day?.members || []).flatMap((m) => m.segments).sort((a, b) => a.startTs - b.startTs);

  return (
    <div className="log-today">
      <div className="log-today__bar">
        <select value={date} onChange={(e) => onDate(e.target.value)} aria-label="Day">
          {days.map((d) => (
            <option key={d} value={d}>
              {d === todayLocal() ? `Today · ${fmtDay(d)}` : fmtDay(d)}
            </option>
          ))}
        </select>
        <button type="button" className="log-ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="log-chips" role="tablist" aria-label="Whose day">
        <button type="button" className={focus === 'crew' ? 'is-on' : ''} onClick={() => onFocus('crew')}>
          Whole crew
        </button>
        {(day?.members || []).map((m) => (
          <button
            type="button"
            key={m.id}
            className={focus === m.id ? 'is-on' : ''}
            style={{ '--chip': m.color } as React.CSSProperties}
            onClick={() => onFocus(m.id)}
          >
            {m.name}
            {m.id === day?.me ? ' (you)' : ''}
          </button>
        ))}
      </div>

      {error ? <p className="log-error">{error}</p> : null}
      {stats ? <StatGrid stats={stats} /> : null}

      {focus === 'crew' && day?.leaderboard.length ? (
        <ol className="log-board" aria-label="Leaderboard">
          {day.leaderboard.map((l, i) => (
            <li key={l.id}>
              <span className="log-board__rank">{i + 1}</span>
              <span className="log-board__dot" style={{ background: l.color }} />
              <span className="log-board__name">{l.name}</span>
              <span>
                {l.runs} run{l.runs === 1 ? '' : 's'} · {fmtFt(l.verticalFt)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {children}

      <h3 className="log-h">Run by run</h3>
      {segments.length ? (
        <ol className="log-timeline">
          {segments.map((s, i) => {
            const m = byId.get(s.memberId);
            return <SegmentRow key={`${s.memberId}-${s.startTs}-${i}`} s={s} color={m?.color} who={member ? undefined : m?.name} />;
          })}
        </ol>
      ) : (
        <p className="log-note">
          Nothing logged {date === todayLocal() ? 'yet today' : 'this day'}. Track your runs, check in at the top of a run, or import a
          track.
        </p>
      )}
    </div>
  );
}
