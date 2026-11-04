import { useEffect, useMemo, useRef, useState } from 'react';
import TerrainScene, { type OverlayPin, type OverlayTrack, type SceneControls } from '../TerrainScene';
import { sampleRidersAtTimestamp } from '../../lib/demoCrewDay';
import { exportKml, photoUrl, shareUrl } from '../../lib/logApi';
import type { TripDay, TripPass } from '../../lib/logTypes';
import { fmtClock, fmtDay, initials, todayLocal } from '../../lib/logFormat';
import { areaName } from '../../lib/terrainData';
import { fmtFt } from '../../lib/trails';
import type { DestinationBrief } from '../../lib/types';
import { useMountain, useTripAreas } from '../../lib/useMountain';
import PhotoStrip from './PhotoStrip';
import { StatGrid } from './TodayPanel';

interface Props {
  pass: TripPass;
  day: TripDay | null;
  date: string;
  onDate: (date: string) => void;
  destinations: DestinationBrief[];
  loading: boolean;
  onGoSki: () => void;
  onChanged: () => void;
  onLoadDemo?: () => void;
}

const REEL_MS = 20_000;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function RecapPanel({
  pass,
  day,
  date,
  onDate,
  destinations,
  loading,
  onGoSki,
  onChanged,
  onLoadDemo,
}: Props) {
  const resort = destinations.find((d) => d.id === pass.resortId);
  const [area, setArea] = useState<string | null>(null);
  const { areas, demId } = useTripAreas(day, resort, area);
  const { dem, trails } = useMountain(demId);
  const controls = useRef<SceneControls | null>(null);
  const raf = useRef(0);
  const [reduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(1);
  const [chaseMemberId, setChaseMemberId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const days = Array.from(new Set([todayLocal(), ...(day?.days || [])])).sort().reverse();
  const crew = day?.crew;
  const hasDay = Boolean(crew && (crew.runs || crew.liftRides || day?.photos.length));

  const tracks = useMemo<OverlayTrack[]>(
    () =>
      (day?.members || [])
        .filter((m) => m.track.length > 1)
        .map((m) => ({
          id: `m${m.id}`,
          color: m.color,
          points: m.track.map(([lat, lng]) => [lat, lng] as [number, number]),
        })),
    [day]
  );

  const span = useMemo(() => {
    const times = (day?.members || []).flatMap((m) => m.track.map((p) => p[2])).filter(Boolean);
    if (crew?.firstTs) times.push(crew.firstTs);
    if (crew?.lastTs) times.push(crew.lastTs);
    return times.length ? { from: Math.min(...times), to: Math.max(...times) } : null;
  }, [day, crew]);

  const playheadTs = span ? span.from + t * (span.to - span.from) : Infinity;
  const liveRiders = useMemo(
    () => sampleRidersAtTimestamp(day, playheadTs, dem),
    [day, playheadTs, dem]
  );
  const shownPhotos = (day?.photos || []).filter((p) => p.lat != null && p.lng != null && p.ts <= playheadTs);
  const shownKey = shownPhotos.map((p) => p.id).join(',');
  const riderPinKey = liveRiders
    .map((r) => `${r.memberId}:${r.lat.toFixed(4)},${r.lng.toFixed(4)}`)
    .join('|');

  const pins = useMemo<OverlayPin[]>(
    () => {
      const photoPins: OverlayPin[] = shownPhotos.map((p) => {
        const by = day?.members.find((m) => m.id === p.memberId);
        return {
          id: p.id,
          kind: 'photo',
          lat: p.lat as number,
          lng: p.lng as number,
          color: by?.color || '#ffffff',
          label: p.caption || `Photo by ${by?.name || 'the crew'}`,
          imageUrl: photoUrl(pass.code, p.id, true),
        };
      });
      const crewPins: OverlayPin[] = liveRiders.map((r) => ({
        id: `live-rider-${r.memberId}`,
        kind: 'crew',
        lat: r.lat,
        lng: r.lng,
        color: r.color,
        label: initials(r.name),
      }));
      return [...photoPins, ...crewPins];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shownKey, riderPinKey, day, pass.code]
  );

  const chasedRider = useMemo(
    () => (chaseMemberId != null ? liveRiders.find((r) => r.memberId === chaseMemberId) || null : null),
    [chaseMemberId, liveRiders]
  );

  useEffect(() => {
    if (!chasedRider) return;
    controls.current?. orbit(false);
    controls.current?.setPovPose?.({
      lat: chasedRider.lat,
      lng: chasedRider.lng,
      lookAtLat: chasedRider.lookLat,
      lookAtLng: chasedRider.lookLng,
      liftM: 28,
      lookLiftM: 4,
    });
  }, [chasedRider]);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    controls.current?.orbit(false);
    setPlaying(false);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    stop();
    setT(1);
    controls.current?.setProgress(1);
  }, [date, demId]);

  const play = () => {
    const c = controls.current;
    if (!c) return;
    const startAt = t >= 1 ? 0 : t;
    const began = performance.now() - startAt * REEL_MS;
    if (chaseMemberId == null) {
      c.frameTracks();
      c.orbit(true);
    }
    setPlaying(true);
    let lastPct = -1;
    const step = (now: number) => {
      const next = Math.min(1, (now - began) / REEL_MS);
      c.setProgress(next);
      const pct = Math.round(next * 200);
      if (pct !== lastPct) {
        lastPct = pct;
        setT(next);
      }
      if (next < 1) raf.current = requestAnimationFrame(step);
      else stop();
    };
    raf.current = requestAnimationFrame(step);
  };

  const scrub = (value: number) => {
    if (playing) stop();
    setT(value);
    controls.current?.setProgress(value);
  };

  const place = demId ? areaName(demId) : resort?.name || 'the mountain';
  const summary = crew
    ? `${pass.tripName} · ${fmtDay(date)} at ${place}: crew logged ${crew.runs} run${crew.runs === 1 ? '' : 's'}, ${fmtFt(crew.verticalFt)} vertical${crew.topSpeedMph ? `, top speed ${crew.topSpeedMph} mph` : ''}.`
    : '';

  async function share() {
    const url = shareUrl(pass.code);
    try {
      if (navigator.share) await navigator.share({ title: pass.tripName, text: summary, url });
      else {
        await navigator.clipboard.writeText(`${summary}\n${url}`);
        setNote('Recap copied — paste it into the group chat.');
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  async function kml() {
    setBusy(true);
    setNote('');
    try {
      const how = await exportKml(pass, date);
      if (how === 'downloaded') setNote('KML saved — open it in Google Earth.');
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="log-recap">
      <div className="log-today__bar">
        <select value={date} onChange={(e) => onDate(e.target.value)} aria-label="Recap day">
          {days.map((d) => (
            <option key={d} value={d}>
              {d === todayLocal() ? `Today · ${fmtDay(d)}` : fmtDay(d)}
            </option>
          ))}
        </select>
      </div>

      {loading && !day ? <p className="log-note">Loading the day…</p> : null}

      {!loading && !hasDay ? (
        <div className="log-recap__empty">
          <p>No runs logged on this day yet.</p>
          <div className="log-recap__empty-actions">
            <button type="button" className="log-ghost" onClick={onGoSki}>
              Go to Ski
            </button>
            {onLoadDemo ? (
              <button type="button" className="log-demo-btn" onClick={onLoadDemo}>
                <i className="bi bi-play-circle-fill" aria-hidden="true" /> Load 4-Rider Demo Day
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasDay && crew ? (
        <>
          <header className="log-recap__head">
            <h2>
              {fmtDay(date)} · {place}
            </h2>
            <p>
              {day!.members.length} rider{day!.members.length === 1 ? '' : 's'}
              {crew.firstTs ? ` · first chair ${fmtClock(crew.firstTs)}` : ''}
              {crew.lastTs ? ` · last run ${fmtClock(crew.lastTs)}` : ''}
            </p>
          </header>

          {areas.length > 1 ? (
            <div className="log-chips" role="group" aria-label="Mountain">
              {areas.map((a) => (
                <button key={a} type="button" className={a === demId ? 'is-on' : ''} onClick={() => setArea(a)}>
                  {areaName(a)}
                </button>
              ))}
            </div>
          ) : null}

          {liveRiders.length > 0 ? (
            <div className="log-chase-bar" role="group" aria-label="3D Camera View">
              <span>Camera:</span>
              <button
                type="button"
                className={chaseMemberId == null ? 'is-on' : ''}
                onClick={() => {
                  setChaseMemberId(null);
                  controls.current?.frameTracks();
                }}
              >
                Mountain Orbit
              </button>
              {liveRiders.map((r) => (
                <button
                  key={r.memberId}
                  type="button"
                  className={chaseMemberId === r.memberId ? 'is-on' : ''}
                  style={{ '--chip': r.color } as React.CSSProperties}
                  onClick={() => setChaseMemberId(chaseMemberId === r.memberId ? null : r.memberId)}
                >
                  Chase {r.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="log-recap__stage">
            {demId ? (
              <TerrainScene
                dem={dem}
                trails={trails}
                destinations={destinations}
                resortId={resort?.dem === demId ? resort.id : undefined}
                selectedRunId={null}
                previewRunId={null}
                matchIds={null}
                onSelectRun={() => undefined}
                tracks={tracks}
                pins={pins}
                controlsRef={controls}
                compact
              />
            ) : (
              <p className="log-note">Pick a resort for this trip to see the mountain.</p>
            )}
          </div>

          {tracks.length ? (
            <div className="log-recap__reel">
              {reduced ? (
                <p className="log-note">Motion is reduced on this device, so the whole day is drawn at once.</p>
              ) : (
                <button type="button" className="log-recap__play" onClick={playing ? stop : play} disabled={!dem}>
                  <i
                    className={`bi ${playing ? 'bi-pause-fill' : t >= 1 ? 'bi-arrow-counterclockwise' : 'bi-play-fill'}`}
                    aria-hidden="true"
                  />
                  {playing ? 'Pause' : t >= 1 ? 'Replay the day' : 'Play'}
                </button>
              )}
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(t * 1000)}
                onChange={(e) => scrub(Number(e.target.value) / 1000)}
                aria-label="Day timeline"
                disabled={!dem}
              />
              <span className="log-recap__clock">{span ? fmtClock(Math.min(playheadTs, span.to)) : ''}</span>
            </div>
          ) : (
            <p className="log-note">Check-ins only today, so there are no GPS tracks to fly along.</p>
          )}

          {liveRiders.length > 0 ? (
            <div className="log-telemetry-strip" aria-label="Live rider telemetry">
              {liveRiders.map((r) => (
                <button
                  key={r.memberId}
                  type="button"
                  className={`log-telemetry-card${chaseMemberId === r.memberId ? ' is-chased' : ''}`}
                  onClick={() => setChaseMemberId(chaseMemberId === r.memberId ? null : r.memberId)}
                  title="Click to lock 3D chase cam on this rider"
                >
                  <div className="log-telemetry-card__top">
                    <span className="log-board__dot" style={{ background: r.color }} />
                    <strong>{r.name}</strong>
                    <span className="log-telemetry-card__speed">{r.speedMph} mph</span>
                  </div>
                  <div className="log-telemetry-card__sub">
                    <span>{r.activityLabel}</span>
                    <small>{r.elevFt.toLocaleString()} ft</small>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <StatGrid stats={crew} />
          {crew.longestRun ? (
            <p className="log-recap__fact">
              Longest run: <strong>{crew.longestRun.name}</strong> · {fmtFt(crew.longestRun.verticalFt)}
            </p>
          ) : null}

          {day!.leaderboard.length > 1 ? (
            <ol className="log-board" aria-label="Leaderboard">
              {day!.leaderboard.map((l, i) => (
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

          <PhotoStrip pass={pass} day={day} focus="crew" onChanged={onChanged} />

          <div className="log-map__actions">
            <button type="button" className="log-ghost" onClick={share}>
              <i className="bi bi-share" aria-hidden="true" /> Share recap
            </button>
            <button type="button" className="log-ghost" onClick={kml} disabled={busy}>
              <i className="bi bi-globe2" aria-hidden="true" /> {busy ? 'Building KML…' : 'Google Earth (KML)'}
            </button>
          </div>
          {note ? <p className="log-note">{note}</p> : null}
        </>
      ) : null}
    </div>
  );
}
