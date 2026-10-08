import { useEffect, useRef, useState } from 'react';
import { boundsOf, loadGoogleMaps, type GMaps } from '../lib/googleMaps';
import { TIER_META, tierOf, runTitle, liftTitle } from '../lib/trails';
import type { TrailsPayload } from '../lib/types';
import type { OverlayPin, OverlayTrack } from './TerrainScene';

export interface Box {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface Props {
  frame: Box;
  trails: TrailsPayload | null;
  resortId?: string;
  selectedRunId?: string | null;
  tracks?: OverlayTrack[];
  pins?: OverlayPin[];
  onPin?: (id: string) => void;
  onSelectRun?: (id: string | null) => void;
  fitKey?: string;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export default function GoogleMapView({ frame, trails, resortId, selectedRunId, tracks, pins, onPin, onSelectRun, fitKey }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GMaps | null>(null);
  const [lib, setLib] = useState<{ maps: GMaps; Marker: GMaps } | null>(null);
  const [error, setError] = useState('');
  const pinRef = useRef(onPin);
  pinRef.current = onPin;
  const selectRef = useRef(onSelectRun);
  selectRef.current = onSelectRun;

  useEffect(() => {
    let live = true;
    (async () => {
      const maps = await loadGoogleMaps();
      const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
        maps.importLibrary('maps'),
        maps.importLibrary('marker'),
      ]);
      if (!live || !host.current) return;
      const m = new Map(host.current, {
        mapId: 'DEMO_MAP_ID',
        mapTypeId: 'hybrid',
        center: { lat: (frame.south + frame.north) / 2, lng: (frame.west + frame.east) / 2 },
        zoom: 14,
        gestureHandling: 'greedy',
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: { mapTypeIds: ['hybrid', 'terrain', 'roadmap'] },
        clickableIcons: false,
      });
      setLib({ maps, Marker: AdvancedMarkerElement });
      setMap(m);
    })().catch((e: Error) => live && setError(e.message || 'Google Maps could not load.'));
    return () => {
      live = false;
    };
    // The map is created once per mount; framing updates happen in the fit effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map || !lib) return;
    const { maps } = lib;
    const lines: GMaps[] = [];
    const info = new maps.InfoWindow();
    const add = (opts: Record<string, unknown>) => {
      const l = new maps.Polyline({ map, clickable: false, ...opts });
      lines.push(l);
      return l;
    };
    for (const run of trails?.runs || []) {
      const meta = TIER_META[tierOf(run.difficulty)];
      const sel = run.id === selectedRunId;
      const dim = resortId && run.resort !== resortId ? 0.35 : 1;
      for (const path of run.paths) {
        if (path.length < 2) continue;
        const p = path.map(([lat, lng]) => ({ lat, lng }));
        add({ path: p, strokeColor: sel ? '#7ec8e3' : hex(meta.casing), strokeOpacity: 0.85 * dim, strokeWeight: sel ? 9 : 5, zIndex: 1 });
        const core = add({
          path: p,
          strokeColor: hex(meta.line),
          strokeOpacity: dim,
          strokeWeight: sel ? 5 : 2.5,
          zIndex: sel ? 6 : 2,
          clickable: true,
        });
        core.addListener('click', (ev: GMaps) => {
          if (selectRef.current) selectRef.current(run.id);
          info.setContent(`<strong>${escapeHtml(runTitle(run))}</strong><br>${escapeHtml(meta.label)}`);
          info.setPosition(ev.latLng);
          info.open({ map });
        });
      }
    }
    for (const lift of trails?.lifts || []) {
      if (lift.coords.length < 2) continue;
      const l = add({
        path: lift.coords.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#ffd166',
        strokeOpacity: resortId && lift.resort !== resortId ? 0.35 : 0.95,
        strokeWeight: 2,
        zIndex: 3,
        clickable: true,
      });
      l.addListener('click', (ev: GMaps) => {
        info.setContent(`<strong>${escapeHtml(liftTitle(lift))}</strong>`);
        info.setPosition(ev.latLng);
        info.open({ map });
      });
    }
    return () => {
      info.close();
      for (const l of lines) l.setMap(null);
    };
  }, [map, lib, trails, resortId, selectedRunId]);

  useEffect(() => {
    if (!map || !lib) return;
    const { maps, Marker } = lib;
    const lines: GMaps[] = [];
    const markers: GMaps[] = [];
    for (const t of tracks || []) {
      if (t.points.length < 2) continue;
      const path = t.points.map(([lat, lng]) => ({ lat, lng }));
      lines.push(new maps.Polyline({ map, path, strokeColor: '#ffffff', strokeOpacity: 0.75, strokeWeight: (t.width ?? 4) + 3, zIndex: 8, clickable: false }));
      lines.push(new maps.Polyline({ map, path, strokeColor: t.color, strokeOpacity: 1, strokeWeight: t.width ?? 4, zIndex: 9, clickable: false }));
    }
    for (const p of pins || []) {
      const el = document.createElement('div');
      el.className = `ski-gm-mark ski-gm-mark--${p.kind}${p.stale ? ' is-stale' : ''}`;
      el.style.setProperty('--mark', p.color);
      if (p.imageUrl) {
        const img = document.createElement('img');
        img.src = p.imageUrl;
        img.alt = p.label;
        el.append(img);
      } else {
        el.textContent = p.label;
      }
      const marker = new Marker({ map, position: { lat: p.lat, lng: p.lng }, content: el, title: p.label, zIndex: p.kind === 'crew' ? 20 : 15 });
      if (p.kind === 'photo') marker.addListener('click', () => pinRef.current?.(p.id));
      markers.push(marker);
    }
    return () => {
      for (const l of lines) l.setMap(null);
      for (const m of markers) m.map = null;
    };
  }, [map, lib, tracks, pins]);

  useEffect(() => {
    if (!map || !lib) return;
    const pts = [
      ...(tracks || []).flatMap((t) => t.points.map(([lat, lng]) => ({ lat, lng }))),
      ...(pins || []).map((p) => ({ lat: p.lat, lng: p.lng })),
    ];
    const box = boundsOf(pts) || frame;
    map.fitBounds({ south: box.south, north: box.north, west: box.west, east: box.east }, 40);
    // Refit only when the caller says the subject changed, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, lib, fitKey]);

  return (
    <div className="ski-gmap">
      <div ref={host} className="ski-gmap__canvas" role="application" aria-label="Google map of the ski area" />
      {!map && !error ? <p className="ski-gmap__status">Loading Google Maps…</p> : null}
      {error ? <p className="ski-gmap__status ski-gmap__status--error">{error}</p> : null}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
