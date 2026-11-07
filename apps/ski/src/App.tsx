import { useCallback, useEffect, useMemo, useState } from 'react';
import Greeter from './components/Greeter';
import GuideChat from './components/GuideChat';
import SkiSwitch from './components/SkiSwitch';
import { camsResortFromPath, pageFromPath, type SkiPage } from './lib/page';
import type { BriefPayload, DemGrid, OnTheWayStop, TrailsPayload } from './lib/types';
import { runTitle } from './lib/trails';
import CrewLog from './pages/CrewLog';
import DriveDesk from './pages/DriveDesk';
import SkiAreas, { type AreaView } from './pages/SkiAreas';
import SkiCams from './pages/SkiCams';

interface TerrainInfo {
  avgSlopeDeg?: number;
  maxSlopeDeg?: number;
}

const SELECTED_RESORT_KEY = 'ski.selectedId';
const AREA_VIEW_KEY = 'ski.areaView';

function initialSelectedId(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('resort') || '';
  if (fromQuery) return fromQuery;
  const fromCams = camsResortFromPath();
  if (fromCams) return fromCams;
  return '';
}

function initialAreaView(): AreaView {
  const initialResort = initialSelectedId();
  return initialResort ? 'resort' : 'state';
}

const EMPTY_BRIEF: BriefPayload = {
  home: { id: 'fountain-valley', name: 'Fountain Valley', lat: 33.7095, lng: -117.9537, elevFt: 40 },
  disclaimer: 'Desk aid only — not official Caltrans chain control or resort status.',
  fetchedAt: '',
  destinations: [],
};

export default function App() {
  const [page, setPage] = useState<SkiPage>(() => pageFromPath());
  const [brief, setBrief] = useState<BriefPayload>(EMPTY_BRIEF);
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId);
  const [areaView, setAreaView] = useState<AreaView>(initialAreaView);
  const [stops, setStops] = useState<OnTheWayStop[]>([]);
  const [dem, setDem] = useState<DemGrid | null>(null);
  const [terrain, setTerrain] = useState<TerrainInfo | null>(null);
  const [trails, setTrails] = useState<TrailsPayload | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading weather…');

  const updateAreaView = useCallback((nextView: AreaView) => {
    setAreaView(nextView);
    try {
      localStorage.setItem(AREA_VIEW_KEY, nextView);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const selectResort = useCallback((id: string) => {
    if (!id) return;
    setSelectedId(id);
    setAreaView('resort');
    try {
      localStorage.setItem(SELECTED_RESORT_KEY, id);
      localStorage.setItem(AREA_VIEW_KEY, 'resort');
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const dest = useMemo(
    () => (selectedId ? brief.destinations.find((d) => d.id === selectedId) : undefined),
    [brief, selectedId]
  );
  const demId = dest?.dem;
  const activeDem = dem && dem.id === demId ? dem : null;
  const activeTerrain = dem && dem.id === demId ? terrain : null;
  const activeTrails = trails && trails.id === demId ? trails : null;
  const selectedRun = activeTrails?.runs.find((r) => r.id === selectedRunId);

  useEffect(() => {
    setSelectedRunId(null);
  }, [selectedId]);

  useEffect(() => {
    const onPop = () => {
      setPage(pageFromPath());
      const camResort = camsResortFromPath();
      if (camResort) selectResort(camResort);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [selectResort]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/ski/brief');
        if (!res.ok) throw new Error('brief');
        const data = (await res.json()) as BriefPayload;
        if (!Array.isArray(data.destinations)) throw new Error('brief-shape');
        if (!live) return;
        setBrief(data);
        setSelectedId((prev) =>
          prev && data.destinations.length && !data.destinations.some((d) => d.id === prev)
            ? ''
            : prev
        );
        setStatus('');
      } catch {
        try {
          const raw = await fetch('/data/ski/destinations.json').then((r) => r.json());
          if (!live) return;
          setBrief({
            home: raw.home,
            disclaimer: raw.disclaimer,
            fetchedAt: '',
            destinations: (raw.destinations || []).map((d: Record<string, unknown>) => ({
              ...d,
              verticalFt: Number(d.summitFt) - Number(d.baseFt),
              driveMin: d.typicalDriveMin,
              driveSource: 'typical',
              weather: {},
              alerts: [],
              score: 'caution',
              chainsLikely: false,
            })),
          } as BriefPayload);
          setStatus('Live weather API is down — showing catalog drive times. Restart the Node server to mount /api/ski.');
        } catch {
          if (live) setStatus('Weather brief unavailable — typical drive times still work.');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!dest || page !== 'drive') {
      if (!dest) setStops([]);
      return;
    }
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/ski/stops?route=${encodeURIComponent(dest.route)}`);
        if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
          const data = await res.json();
          if (live && Array.isArray(data.stops)) {
            setStops(data.stops);
            return;
          }
        }
      } catch {
        /* fall through to seed */
      }
      const seed = await fetch('/data/ski/on-the-way.json').then((r) => r.json());
      const list = Array.isArray(seed.stops) ? seed.stops : [];
      if (live) {
        setStops(list.filter((s: OnTheWayStop) => s.route === dest.route || s.route === 'both'));
      }
    })().catch(() => {
      if (live) setStops([]);
    });
    return () => {
      live = false;
    };
  }, [dest, page]);

  useEffect(() => {
    if (!demId || page !== 'areas' || areaView !== 'resort') return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/ski/trails/${demId}`);
        if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
          const data = (await res.json()) as TrailsPayload;
          if (live && Array.isArray(data.runs)) {
            setTrails(data);
            return;
          }
        }
      } catch {
        /* fall through to baked trails */
      }
      const data = (await fetch(`/data/ski/${demId}-trails.json`).then((r) => r.json())) as TrailsPayload;
      if (live) setTrails(data);
    })().catch(() => {
      if (live) {
        setTrails({
          id: demId,
          name: '',
          source: 'unbaked',
          attribution: '© OpenStreetMap contributors (ODbL)',
          resorts: [],
          runs: [],
          lifts: [],
        });
      }
    });
    return () => {
      live = false;
    };
  }, [demId, page, areaView]);

  useEffect(() => {
    if (!demId || page !== 'areas' || areaView !== 'resort') return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/ski/dem/${demId}`);
        if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
          const data = await res.json();
          if (!live) return;
          setDem(data);
          setTerrain(data.terrain || null);
          return;
        }
      } catch {
        /* fall through to baked DEM */
      }
      const data = await fetch(`/data/ski/${demId}-dem.json`).then((r) => r.json());
      if (!live) return;
      setDem(data);
      setTerrain(null);
    })().catch(() => {
      if (live) {
        setDem(null);
        setTerrain(null);
      }
    });
    return () => {
      live = false;
    };
  }, [demId, page, areaView]);

  return (
    <main className="ski-app">
      <SkiSwitch page={page} selectedId={dest?.id || selectedId} />
      {page === 'log' ? null : <Greeter />}
      {status && page !== 'log' ? <p className="ski-disclaimer">{status}</p> : null}
      {page === 'log' ? (
        <CrewLog
          destinations={brief.destinations}
          selectedId={dest?.id || ''}
          onSelect={selectResort}
        />
      ) : page === 'cams' ? (
        <SkiCams destinations={brief.destinations} selectedId={dest?.id || selectedId} onSelect={selectResort} />
      ) : page === 'drive' ? (
        <DriveDesk
          brief={brief}
          dest={dest}
          selectedId={dest?.id || ''}
          onSelect={selectResort}
          stops={stops}
        />
      ) : (
        <SkiAreas
          brief={brief}
          dest={dest}
          selectedId={dest?.id || ''}
          onSelect={selectResort}
          view={areaView}
          onViewChange={updateAreaView}
          dem={activeDem}
          terrain={activeTerrain}
          trails={activeTrails}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
        />
      )}
      <GuideChat
        page={page}
        selectedId={dest?.id || ''}
        route={dest?.route || ''}
        selectedRun={selectedRun ? runTitle(selectedRun) : ''}
      />
    </main>
  );
}
