import { useEffect, useRef, useState } from 'react';
import { boundsCenter, boundsOf, boundsSpanM, loadGoogleMaps, type GMaps } from '../lib/googleMaps';
import { TIER_META, tierOf } from '../lib/trails';
import type { TrailsPayload } from '../lib/types';
import type { Box } from './GoogleMapView';
import type { OverlayPin, OverlayTrack } from './TerrainScene';

interface Props {
  frame: Box;
  groundFt: (lat: number, lng: number) => number;
  trails: TrailsPayload | null;
  resortId?: string;
  tracks?: OverlayTrack[];
  pins?: OverlayPin[];
  onPin?: (id: string) => void;
  fitKey?: string;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const STALL_MS = 20_000;

function setPath(el: GMaps, pts: { lat: number; lng: number }[]) {
  if ('path' in el) el.path = pts;
  else el.coordinates = pts;
}

export default function GoogleEarthView({ frame, groundFt, trails, resortId, tracks, pins, onPin, fitKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [lib, setLib] = useState<{ maps: GMaps; m3d: GMaps; Pin: GMaps } | null>(null);
  const [map, setMap] = useState<GMaps | null>(null);
  const [steady, setSteady] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState('');
  const pinRef = useRef(onPin);
  pinRef.current = onPin;
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    let live = true;
    let el: GMaps = null;
    const stall = window.setTimeout(() => live && setStalled(true), STALL_MS);
    (async () => {
      const maps = await loadGoogleMaps();
      const [m3d, marker] = await Promise.all([maps.importLibrary('maps3d'), maps.importLibrary('marker')]);
      if (!live || !host.current) return;
      if (!m3d?.Map3DElement) throw new Error('Photorealistic 3D maps are not available for this key.');
      el = new m3d.Map3DElement({
        center: { ...boundsCenter(frame), altitude: groundFt(boundsCenter(frame).lat, boundsCenter(frame).lng) * 0.3048 },
        range: Math.max(1800, boundsSpanM(frame) * 1.1),
        tilt: 64,
        heading: 25,
      });
      el.mode = m3d.MapMode?.HYBRID ?? 'HYBRID';
      el.classList.add('ski-earth__map');
      el.addEventListener('gmp-steadychange', (ev: GMaps) => {
        if (ev?.isSteady === false) return;
        window.clearTimeout(stall);
        setSteady(true);
        setStalled(false);
      });
      el.addEventListener('gmp-error', () => setError('Google Earth view hit an error loading 3D tiles.'));
      host.current.append(el);
      setLib({ maps, m3d, Pin: marker.PinElement });
      setMap(el);
    })().catch((e: Error) => live && setError(e.message || 'Google Earth view could not load.'));
    return () => {
      live = false;
      window.clearTimeout(stall);
      el?.remove();
    };
    // Created once per mount; camera moves happen in the fit effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map || !lib) return;
    const { m3d } = lib;
    const added: GMaps[] = [];
    for (const run of trails?.runs || []) {
      if (resortId && run.resort !== resortId) continue;
      const meta = TIER_META[tierOf(run.difficulty)];
      for (const path of run.paths) {
        if (path.length < 2) continue;
        const line = new m3d.Polyline3DElement({
          altitudeMode: 'CLAMP_TO_GROUND',
          strokeColor: hex(meta.line),
          strokeWidth: 4,
          outerColor: hex(meta.casing),
          outerWidth: 0.5,
        });
        setPath(line, path.map(([lat, lng]) => ({ lat, lng })));
        map.append(line);
        added.push(line);
      }
    }
    for (const lift of trails?.lifts || []) {
      if (resortId && lift.resort !== resortId) continue;
      if (lift.coords.length < 2) continue;
      const line = new m3d.Polyline3DElement({
        altitudeMode: 'RELATIVE_TO_GROUND',
        strokeColor: '#ffd166',
        strokeWidth: 3,
      });
      setPath(line, lift.coords.map(([lat, lng]) => ({ lat, lng, altitude: 12 })));
      map.append(line);
      added.push(line);
    }
    return () => {
      for (const a of added) a.remove();
    };
  }, [map, lib, trails, resortId]);

  useEffect(() => {
    if (!map || !lib) return;
    const { m3d, Pin } = lib;
    const added: GMaps[] = [];
    for (const t of tracks || []) {
      if (t.points.length < 2) continue;
      const line = new m3d.Polyline3DElement({
        altitudeMode: 'CLAMP_TO_GROUND',
        strokeColor: t.color,
        strokeWidth: (t.width ?? 4) + 2,
        outerColor: '#ffffff',
        outerWidth: 0.35,
        drawsOccludedSegments: true,
      });
      setPath(line, t.points.map(([lat, lng]) => ({ lat, lng })));
      map.append(line);
      added.push(line);
    }
    for (const p of pins || []) {
      const interactive = p.kind === 'photo' && m3d.Marker3DInteractiveElement;
      const Ctor = interactive ? m3d.Marker3DInteractiveElement : m3d.Marker3DElement;
      if (!Ctor) continue;
      const marker = new Ctor({
        position: { lat: p.lat, lng: p.lng, altitude: p.kind === 'crew' ? 25 : 15 },
        altitudeMode: 'RELATIVE_TO_GROUND',
        extruded: true,
        label: p.kind === 'crew' ? p.label : undefined,
      });
      if (p.kind === 'photo' && p.imageUrl) {
        const tpl = document.createElement('template');
        const img = document.createElement('img');
        img.src = p.imageUrl;
        img.width = 44;
        img.height = 44;
        img.alt = p.label;
        tpl.content.append(img);
        marker.append(tpl);
      } else if (Pin) {
        try {
          marker.append(new Pin({ background: p.color, borderColor: '#ffffff', glyphColor: '#ffffff', glyph: p.label }));
        } catch {
          /* default pin */
        }
      }
      if (interactive) marker.addEventListener('gmp-click', () => pinRef.current?.(p.id));
      map.append(marker);
      added.push(marker);
    }
    return () => {
      for (const a of added) a.remove();
    };
  }, [map, lib, tracks, pins]);

  useEffect(() => {
    if (!map) return;
    const pts = (tracks || []).flatMap((t) => t.points.map(([lat, lng]) => ({ lat, lng })));
    const box = boundsOf(pts) || frame;
    const camera = {
      center: { ...boundsCenter(box), altitude: groundFt(boundsCenter(box).lat, boundsCenter(box).lng) * 0.3048 },
      range: Math.max(1500, boundsSpanM(box) * 1.4),
      tilt: 64,
      heading: 25,
    };
    if (!reduced && typeof map.flyCameraTo === 'function') map.flyCameraTo({ endCamera: camera, durationMillis: 2500 });
    else Object.assign(map, camera);
    // Refit only when the caller says the subject changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  function flyAround() {
    if (!map || typeof map.flyCameraAround !== 'function') return;
    map.flyCameraAround({
      camera: { center: map.center, range: map.range, tilt: map.tilt, heading: map.heading },
      durationMillis: 30_000,
      rounds: 1,
      repeatCount: 1,
    });
  }

  return (
    <div className="ski-earth">
      <div ref={host} className="ski-earth__host" role="application" aria-label="Google Earth photorealistic 3D view" />
      {!steady && !error ? (
        <p className="ski-gmap__status">
          {stalled
            ? 'Photorealistic 3D is taking a while. If it never appears, the Map Tiles API may be off for this key — try Google Maps or Topo 3D.'
            : 'Loading Google Earth 3D…'}
        </p>
      ) : null}
      {error ? <p className="ski-gmap__status ski-gmap__status--error">{error}</p> : null}
      {map && !reduced ? (
        <button type="button" className="ski-earth__orbit" onClick={flyAround}>
          <i className="bi bi-arrow-repeat" aria-hidden="true" /> Fly around
        </button>
      ) : null}
    </div>
  );
}
