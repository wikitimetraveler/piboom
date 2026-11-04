import type { DemGrid, DestinationBrief, LatLng, SkiRun, TrailsPayload } from './types';
import type { DayStats, LogPhoto, MemberDay, Segment, TripDay, TripPass } from './logTypes';
import { demHeightFt } from './terrainData';
import { runTitle, tierOf, type Tier } from './trails';

export const DEMO_TRIP_CODE = 'DEMO88';

export function isDemoPass(pass: TripPass | null | undefined): boolean {
  return Boolean(pass && (pass.code === DEMO_TRIP_CODE || pass.token === 'demo-local-token'));
}

export function createDemoPass(resortId: string, resortName?: string): TripPass {
  return {
    code: DEMO_TRIP_CODE,
    token: 'demo-local-token',
    tripName: `${resortName || 'Mountain'} Powder Crew (Demo)`,
    resortId: resortId || 'mammoth',
    memberId: 1,
    memberName: 'Maya',
    color: '#7ec8e3',
    isOwner: true,
  };
}

function makeSvgPhotoDataUri(title: string, subtitle: string, accent: string, elevLabel: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#071320"/>
        <stop offset="65%" stop-color="#142d42"/>
        <stop offset="100%" stop-color="#1e3c52"/>
      </linearGradient>
      <linearGradient id="snow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f2f8fc"/>
        <stop offset="100%" stop-color="#9ab8ce"/>
      </linearGradient>
    </defs>
    <rect width="640" height="420" fill="url(#sky)"/>
    <circle cx="510" cy="88" r="38" fill="#ffd166" opacity="0.88"/>
    <polygon points="0,330 160,150 320,280 470,120 640,295 640,420 0,420" fill="#182b3a"/>
    <polygon points="80,350 250,165 410,305 540,155 640,275 640,420 0,420" fill="url(#snow)" opacity="0.92"/>
    <path d="M 250 165 Q 290 255 210 385" stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="10 8"/>
    <rect x="24" y="316" width="592" height="80" rx="14" fill="#071018" opacity="0.84" stroke="${accent}" stroke-width="2"/>
    <text x="44" y="350" fill="#ffffff" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${title.replace(/[<>&"]/g, '')}</text>
    <text x="44" y="378" fill="#9eb4c7" font-family="system-ui, sans-serif" font-size="16">${subtitle.replace(/[<>&"]/g, '')} · ${elevLabel.replace(/[<>&"]/g, '')}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function orientTopToBottom(run: SkiRun, dem: DemGrid | null): LatLng[] {
  const flat = run.paths.flat();
  if (flat.length < 2) return flat;
  const first = flat[0];
  const last = flat[flat.length - 1];
  const z0 = dem ? demHeightFt(dem, first[0], first[1]) : (run.topFt ?? 9000);
  const z1 = dem ? demHeightFt(dem, last[0], last[1]) : (run.bottomFt ?? 7500);
  return z0 >= z1 ? flat : [...flat].reverse();
}

function densifyPath(coords: LatLng[], targetPoints = 24): LatLng[] {
  if (coords.length < 2) return coords;
  const out: LatLng[] = [];
  for (let i = 0; i < targetPoints; i++) {
    const f = (i / (targetPoints - 1)) * (coords.length - 1);
    const idx = Math.min(coords.length - 2, Math.floor(f));
    const u = f - idx;
    out.push([
      coords[idx][0] + u * (coords[idx + 1][0] - coords[idx][0]),
      coords[idx][1] + u * (coords[idx + 1][1] - coords[idx][1]),
    ]);
  }
  return out;
}

export function buildDemoCrewDay(
  resortId: string,
  date: string,
  trails: TrailsPayload | null,
  dem: DemGrid | null,
  dest?: DestinationBrief
): TripDay {
  const resortRuns = (trails?.runs || [])
    .filter((r) => !resortId || r.resort === resortId)
    .filter((r) => r.paths.flat().length >= 2)
    .sort((a, b) => (b.verticalFt ?? 0) - (a.verticalFt ?? 0));

  const pool = resortRuns.length >= 4 ? resortRuns.slice(0, 12) : (trails?.runs || []).slice(0, 8);
  const resortLifts = (trails?.lifts || []).filter((l) => !resortId || l.resort === resortId);

  const riders = [
    { id: 1, name: 'Maya', color: '#7ec8e3', speedBase: 36, runIndices: [0, 1, 2, 3, 0] },
    { id: 2, name: 'Brooks', color: '#5dbe8a', speedBase: 41, runIndices: [1, 2, 4, 0, 2] },
    { id: 3, name: 'Kai', color: '#ffd166', speedBase: 33, runIndices: [2, 0, 3, 1] },
    { id: 4, name: 'Elena', color: '#ff7a59', speedBase: 39, runIndices: [0, 3, 1, 4, 2] },
  ];

  const baseEpoch = Date.parse(`${date}T09:00:00-08:00`) || Date.now() - 4 * 3600_000;
  const demId = dem?.id || dest?.dem || 'mammoth';

  const members: MemberDay[] = [];
  const photos: LogPhoto[] = [];

  for (let rIdx = 0; rIdx < riders.length; rIdx++) {
    const rider = riders[rIdx];
    const segments: Segment[] = [];
    const track: [number, number, number][] = [];
    const byDifficulty: Record<Tier, number> = {
      green: 0,
      blue: 0,
      black: 0,
      double: 0,
      unrated: 0,
    };
    let cursorTs = baseEpoch + rIdx * 4 * 60_000;
    let totalVert = 0;
    let totalDistM = 0;
    let maxSpeed = 0;
    let longestRun: DayStats['longestRun'] = null;
    let steepestRun: DayStats['steepestRun'] = null;
    let liftRides = 0;

    for (let lap = 0; lap < rider.runIndices.length; lap++) {
      const chosenRun = pool[rider.runIndices[lap] % Math.max(1, pool.length)];
      if (!chosenRun) continue;
      const lift = resortLifts[lap % Math.max(1, resortLifts.length)] || null;

      const runPts = densifyPath(orientTopToBottom(chosenRun, dem), 28);
      if (runPts.length < 2) continue;

      if (lift && lift.coords.length >= 2) {
        const liftStart = cursorTs;
        const liftDurS = 380;
        const liftPts = densifyPath(lift.coords, 12);
        for (let i = 0; i < liftPts.length; i++) {
          const ts = Math.round(liftStart + (i / (liftPts.length - 1)) * liftDurS * 1000);
          track.push([liftPts[i][0], liftPts[i][1], ts]);
        }
        segments.push({
          kind: 'lift',
          source: 'gps',
          memberId: rider.id,
          demId,
          startTs: liftStart,
          endTs: liftStart + liftDurS * 1000,
          durationS: liftDurS,
          verticalFt: Math.round(lift.riseFt ?? chosenRun.verticalFt ?? 950),
          distanceM: Math.round((lift.lengthFt ?? 3200) * 0.3048),
          topSpeedMph: 11,
          matchedShare: 1,
          path: liftPts,
          run: null,
          runs: [],
          lift: { id: lift.id, name: lift.name, type: lift.type, resort: lift.resort },
          offPiste: false,
          resort: resortId,
        });
        liftRides += 1;
        cursorTs += (liftDurS + 45) * 1000;
      }

      const runStart = cursorTs;
      const runDurS = 240 + (lap % 3) * 45;
      for (let i = 0; i < runPts.length; i++) {
        const ts = Math.round(runStart + (i / (runPts.length - 1)) * runDurS * 1000);
        track.push([runPts[i][0], runPts[i][1], ts]);
      }

      const vert = Math.round(chosenRun.verticalFt ?? 880);
      const distM = Math.round((chosenRun.lengthFt ?? 4200) * 0.3048);
      const lapSpeed = Math.round((rider.speedBase + ((lap * 3 + rIdx * 2) % 9)) * 10) / 10;
      const tier = tierOf(chosenRun.difficulty);
      byDifficulty[tier] = (byDifficulty[tier] || 0) + 1;
      totalVert += vert;
      totalDistM += distM;
      if (lapSpeed > maxSpeed) maxSpeed = lapSpeed;

      const rName = runTitle(chosenRun);
      if (!longestRun || vert > longestRun.verticalFt) {
        longestRun = { name: rName, verticalFt: vert, runId: chosenRun.id };
      }
      const maxP = chosenRun.maxPitchDeg ?? chosenRun.avgPitchDeg ?? 22;
      if (!steepestRun || maxP > steepestRun.maxPitchDeg) {
        steepestRun = { name: rName, maxPitchDeg: maxP, runId: chosenRun.id, tier };
      }

      const runRef = {
        id: chosenRun.id,
        name: chosenRun.name,
        difficulty: chosenRun.difficulty,
        tier,
        resort: chosenRun.resort,
        verticalFt: vert,
        avgPitchDeg: chosenRun.avgPitchDeg ?? null,
        maxPitchDeg: chosenRun.maxPitchDeg ?? null,
        aspect: chosenRun.aspect ?? null,
      };

      segments.push({
        kind: 'run',
        source: 'gps',
        memberId: rider.id,
        demId,
        startTs: runStart,
        endTs: runStart + runDurS * 1000,
        durationS: runDurS,
        verticalFt: vert,
        distanceM: distM,
        topSpeedMph: lapSpeed,
        matchedShare: 0.96,
        path: runPts,
        run: runRef,
        runs: [runRef],
        lift: null,
        offPiste: false,
        resort: resortId,
      });

      if (lap === 1 && rIdx < 3) {
        const midPt = runPts[Math.floor(runPts.length * 0.45)];
        const midTs = Math.round(runStart + runDurS * 450);
        const photoId = `demo-photo-${rider.id}-${lap}`;
        photos.push({
          id: photoId,
          memberId: rider.id,
          ts: midTs,
          lat: midPt[0],
          lng: midPt[1],
          placeSource: 'track',
          demId,
          runId: chosenRun.id,
          runName: rName,
          caption: `${rider.name} on ${rName}`,
          width: 640,
          height: 420,
        });
      }

      cursorTs += (runDurS + 90) * 1000;
    }

    const lastPt = track[track.length - 1];
    members.push({
      id: rider.id,
      name: rider.name,
      color: rider.color,
      stats: {
        runs: segments.filter((s) => s.kind === 'run').length,
        verticalFt: totalVert,
        distanceMi: Math.round((totalDistM / 1609.34) * 10) / 10,
        topSpeedMph: maxSpeed || null,
        liftRides,
        byDifficulty,
        longestRun,
        steepestRun,
        firstTs: track[0]?.[2] ?? null,
        lastTs: lastPt?.[2] ?? null,
      },
      segments,
      track,
      lastFix: lastPt ? { ts: lastPt[2], lat: lastPt[0], lng: lastPt[1] } : null,
    });
  }

  const leaderboard = members
    .map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      runs: m.stats.runs,
      verticalFt: m.stats.verticalFt,
    }))
    .sort((a, b) => b.verticalFt - a.verticalFt);

  const crewByDiff: Record<Tier, number> = { green: 0, blue: 0, black: 0, double: 0, unrated: 0 };
  for (const m of members) {
    for (const k of Object.keys(crewByDiff) as Tier[]) {
      crewByDiff[k] += m.stats.byDifficulty[k] || 0;
    }
  }

  const allFirst = members.map((m) => m.stats.firstTs).filter((x): x is number => x != null);
  const allLast = members.map((m) => m.stats.lastTs).filter((x): x is number => x != null);

  return {
    date,
    trip: {
      code: DEMO_TRIP_CODE,
      name: `${dest?.name || 'Mountain'} Powder Crew (Demo)`,
      resortId,
      startDate: date,
      keep: true,
    },
    areas: [demId],
    members,
    leaderboard,
    crew: {
      runs: members.reduce((s, m) => s + m.stats.runs, 0),
      verticalFt: members.reduce((s, m) => s + m.stats.verticalFt, 0),
      distanceMi: Math.round(members.reduce((s, m) => s + m.stats.distanceMi, 0) * 10) / 10,
      topSpeedMph: Math.max(0, ...members.map((m) => m.stats.topSpeedMph ?? 0)) || null,
      liftRides: members.reduce((s, m) => s + m.stats.liftRides, 0),
      byDifficulty: crewByDiff,
      longestRun: members[0]?.stats.longestRun ?? null,
      steepestRun: members[0]?.stats.steepestRun ?? null,
      firstTs: allFirst.length ? Math.min(...allFirst) : null,
      lastTs: allLast.length ? Math.max(...allLast) : null,
    },
    photos,
    days: [date],
    me: 1,
  };
}

export function demoPhotoDataUri(photo: LogPhoto, memberName: string, color: string): string {
  return makeSvgPhotoDataUri(
    photo.runName || 'Summit Drop',
    `Captured by ${memberName}`,
    color,
    'Crew Log Demo'
  );
}

export interface RiderLiveState {
  memberId: number;
  name: string;
  color: string;
  lat: number;
  lng: number;
  lookLat: number;
  lookLng: number;
  elevFt: number;
  speedMph: number;
  activityLabel: string;
}

export function sampleRidersAtTimestamp(
  day: TripDay | null,
  playheadTs: number,
  dem: DemGrid | null
): RiderLiveState[] {
  if (!day) return [];
  const out: RiderLiveState[] = [];

  for (const m of day.members) {
    const pts = m.track;
    if (pts.length < 2) continue;
    const clampedTs = Math.max(pts[0][2], Math.min(pts[pts.length - 1][2], playheadTs));
    let idx = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if (clampedTs <= pts[i + 1][2] || i === pts.length - 2) {
        idx = i;
        break;
      }
    }
    const p0 = pts[idx];
    const p1 = pts[idx + 1] || p0;
    const dtS = Math.max(1, (p1[2] - p0[2]) / 1000);
    const u = p1[2] > p0[2] ? Math.max(0, Math.min(1, (clampedTs - p0[2]) / (p1[2] - p0[2]))) : 0;
    const lat = p0[0] + u * (p1[0] - p0[0]);
    const lng = p0[1] + u * (p1[1] - p0[1]);
    const pAhead = pts[Math.min(pts.length - 1, idx + 2)] || p1;

    const cosLat = Math.cos((lat * Math.PI) / 180);
    const distM = Math.hypot((p1[0] - p0[0]) * 111_320, (p1[1] - p0[1]) * 111_320 * cosLat);
    const rawMph = (distM / dtS) * 2.23694;

    const seg = m.segments.find((s) => clampedTs >= s.startTs && clampedTs <= s.endTs);
    let activityLabel = 'At base lodge';
    let speedMph = Math.min(48, Math.round(rawMph));
    if (seg) {
      if (seg.kind === 'run') {
        activityLabel = seg.run?.name || 'Skiing run';
        speedMph = Math.max(18, Math.min(49, Math.round((seg.topSpeedMph ?? 34) * (0.78 + 0.22 * Math.sin(idx)))));
      } else {
        activityLabel = `Riding ${seg.lift?.name || 'Chairlift'}`;
        speedMph = 11;
      }
    }

    const elevFt = dem ? Math.round(demHeightFt(dem, lat, lng)) : 8200;
    out.push({
      memberId: m.id,
      name: m.name,
      color: m.color,
      lat,
      lng,
      lookLat: pAhead[0],
      lookLng: pAhead[1],
      elevFt,
      speedMph,
      activityLabel,
    });
  }

  return out;
}
