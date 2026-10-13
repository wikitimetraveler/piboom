import { useEffect, useMemo, useState } from 'react';
import type { TripDay } from './logTypes';
import { loadDemGrid, loadTrailsFor } from './terrainData';
import type { DemGrid, DestinationBrief, TrailsPayload } from './types';

/** Mountains a trip day touched, with the trip's own resort first when nothing is logged yet. */
export function useTripAreas(day: TripDay | null, resort: DestinationBrief | undefined, picked: string | null) {
  const areas = useMemo(() => {
    const list = [...(day?.areas || [])];
    if (resort?.dem && !list.includes(resort.dem)) list.unshift(resort.dem);
    return list;
  }, [day?.areas, resort?.dem]);
  const demId = picked && areas.includes(picked) ? picked : (day?.areas[0] ?? resort?.dem ?? null);
  return { areas, demId };
}

export function useMountain(demId: string | null) {
  const [dem, setDem] = useState<DemGrid | null>(null);
  const [trails, setTrails] = useState<TrailsPayload | null>(null);
  useEffect(() => {
    if (!demId) return;
    let alive = true;
    setDem(null);
    setTrails(null);
    loadDemGrid(demId).then((d) => alive && setDem(d)).catch(() => undefined);
    loadTrailsFor(demId).then((t) => alive && setTrails(t)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [demId]);
  return { dem, trails };
}
