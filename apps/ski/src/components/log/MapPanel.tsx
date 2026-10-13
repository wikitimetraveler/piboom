import { useMemo, useState } from 'react';
import GoogleEarthView from '../GoogleEarthView';
import GoogleMapView from '../GoogleMapView';
import MapModeSwitch, { useMapMode } from '../MapModeSwitch';
import TerrainScene, { type OverlayPin, type OverlayTrack } from '../TerrainScene';
import { exportKml, photoUrl } from '../../lib/logApi';
import type { CrewPosition, LogPhoto, TripDay, TripPass } from '../../lib/logTypes';
import { fmtAgo, initials, todayLocal } from '../../lib/logFormat';
import { areaName, demHeightFt } from '../../lib/terrainData';
import type { DestinationBrief } from '../../lib/types';
import { useMountain, useTripAreas } from '../../lib/useMountain';
import PhotoLightbox from './PhotoLightbox';

interface Props {
  pass: TripPass;
  day: TripDay | null;
  date: string;
  focus: number | 'crew';
  onFocus: (f: number | 'crew') => void;
  destinations: DestinationBrief[];
  live?: CrewPosition[];
  onChanged: () => void;
}

const STALE_MS = 15 * 60 * 1000;

export default function MapPanel({ pass, day, date, focus, onFocus, destinations, live, onChanged }: Props) {
  const [mode, setMode] = useMapMode();
  const resort = destinations.find((d) => d.id === pass.resortId);
  const [area, setArea] = useState<string | null>(null);
  const { areas, demId } = useTripAreas(day, resort, area);
  const { dem, trails } = useMountain(demId);
  const [open, setOpen] = useState<LogPhoto | null>(null);
  const [kmlNote, setKmlNote] = useState('');
  const [busy, setBusy] = useState(false);

  const riders = useMemo(
    () => (day?.members || []).filter((m) => focus === 'crew' || m.id === focus),
    [day, focus]
  );

  const tracks = useMemo<OverlayTrack[]>(
    () =>
      riders
        .filter((m) => m.track.length > 1)
        .map((m) => ({ id: `m${m.id}`, color: m.color, points: m.track.map(([lat, lng]) => [lat, lng] as [number, number]) })),
    [riders]
  );

  const isToday = date === todayLocal();
  const pins = useMemo<OverlayPin[]>(() => {
    const out: OverlayPin[] = [];
    for (const p of day?.photos || []) {
      if (p.lat == null || p.lng == null) continue;
      if (focus !== 'crew' && p.memberId !== focus) continue;
      const by = day?.members.find((m) => m.id === p.memberId);
      out.push({
        id: p.id,
        kind: 'photo',
        lat: p.lat,
        lng: p.lng,
        color: by?.color || '#ffffff',
        label: p.caption || `Photo by ${by?.name || 'the crew'}`,
        imageUrl: photoUrl(pass.code, p.id, true),
      });
    }
    if (isToday) {
      const now = Date.now();
      const liveBy = new Map((live || []).map((c) => [c.memberId, c]));
      for (const m of riders) {
        const l = liveBy.get(m.id);
        const fix = l && (!m.lastFix || l.ts >= m.lastFix.ts) ? l : m.lastFix;
        if (!fix) continue;
        out.push({
          id: `crew-${m.id}`,
          kind: 'crew',
          lat: fix.lat,
          lng: fix.lng,
          color: m.color,
          label: initials(m.name),
          stale: now - fix.ts > STALE_MS,
        });
      }
    }
    return out;
  }, [day, focus, riders, live, isToday, pass.code]);

  const fitKey = `${date}|${focus}|${demId}`;
  const frame = dem || null;
  const groundFt = (lat: number, lng: number) => (dem ? demHeightFt(dem, lat, lng) : resort?.baseFt ?? 7000);

  async function kml() {
    setBusy(true);
    setKmlNote('');
    try {
      const how = await exportKml(pass, date);
      setKmlNote(how === 'downloaded' ? 'KML saved — open it in Google Earth (app or earth.google.com → Projects → Import).' : '');
    } catch (e) {
      setKmlNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onPin = (id: string) => {
    const p = day?.photos.find((x) => x.id === id);
    if (p) setOpen(p);
  };

  const liveCount = (live || []).filter((c) => Date.now() - c.ts < STALE_MS).length;

  return (
    <div className="log-map">
      <MapModeSwitch mode={mode} onMode={setMode} />
      {day && day.members.length > 1 ? (
        <div className="log-chips" role="group" aria-label="Whose tracks">
          <button type="button" className={focus === 'crew' ? 'is-on' : ''} onClick={() => onFocus('crew')}>
            Crew
          </button>
          {day.members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={focus === m.id ? 'is-on' : ''}
              style={{ '--chip': m.color } as React.CSSProperties}
              onClick={() => onFocus(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      ) : null}
      {areas.length > 1 ? (
        <div className="log-chips" role="group" aria-label="Mountain">
          {areas.map((a) => (
            <button key={a} type="button" className={a === demId ? 'is-on' : ''} onClick={() => setArea(a)}>
              {areaName(a)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="log-map__stage">
        {!demId ? (
          <p className="log-note">Pick a resort for this trip to see the mountain.</p>
        ) : mode === 'topo' ? (
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
            compact
          />
        ) : !frame ? (
          <p className="log-note">Loading the mountain…</p>
        ) : mode === 'maps' ? (
          <GoogleMapView frame={frame} trails={trails} tracks={tracks} pins={pins} onPin={onPin} fitKey={fitKey} />
        ) : (
          <GoogleEarthView
            frame={frame}
            groundFt={groundFt}
            trails={trails}
            resortId={resort?.dem === demId ? resort.id : undefined}
            tracks={tracks}
            pins={pins}
            onPin={onPin}
            fitKey={fitKey}
          />
        )}
      </div>

      <p className="log-map__foot">
        {tracks.length ? `${tracks.length} track${tracks.length === 1 ? '' : 's'}` : 'No tracks yet'}
        {pins.some((p) => p.kind === 'photo') ? ` · ${pins.filter((p) => p.kind === 'photo').length} photos` : ''}
        {isToday && liveCount ? ` · ${liveCount} live` : ''}
        {isToday && !liveCount && riders.some((m) => m.lastFix)
          ? ` · last seen ${fmtAgo(Math.max(...riders.map((m) => m.lastFix?.ts || 0)))}`
          : ''}
      </p>
      <div className="log-map__actions">
        <button type="button" className="log-ghost" onClick={kml} disabled={busy || !day}>
          <i className="bi bi-globe2" aria-hidden="true" /> {busy ? 'Building KML…' : 'Open in Google Earth (KML)'}
        </button>
      </div>
      {kmlNote ? <p className="log-note">{kmlNote}</p> : null}
      {open ? <PhotoLightbox pass={pass} day={day} photo={open} onClose={() => setOpen(null)} onChanged={onChanged} /> : null}
    </div>
  );
}
