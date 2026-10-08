import {
  buildAreaIndex,
  buildDayKml,
  buildTripDay,
  kmlColor,
  cleanPoints,
  dayBounds,
  dayStats,
  daysCovered,
  demIdForPoint,
  dropCoveredPoints,
  parseTrackFile,
  photoRun,
  placePhoto,
  generateTripCode,
  getAreaIndex,
  hashToken,
  localDay,
  mergeCheckins,
  normalizeTripCode,
  sanitizeDisplayName,
  segmentTrack,
  snapCandidates,
  turningPoints,
} from '../../services/ski-log.service.js';
import { interpolateDem } from '../../services/ski-dem.service.js';
import { haversineM } from '../../services/ski-trails.service.js';

const T0 = Date.UTC(2026, 0, 17, 17, 0, 0);

/** Walk a polyline at a steady speed, one fix every `stepS` seconds. */
function walk(coords, { startTs, mps, stepS = 5 }) {
  const out = [];
  let ts = startTs;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const legM = haversineM(a, b);
    const steps = Math.max(1, Math.ceil(legM / (mps * stepS)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ ts, lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, acc: 6 });
      ts += stepS * 1000;
    }
  }
  const end = coords[coords.length - 1];
  out.push({ ts, lat: end[0], lng: end[1], acc: 6 });
  return out;
}

function topDown(index, run) {
  const path = [...run.paths[0]];
  const z = ([lat, lng]) => interpolateDem(index.dem, lat, lng);
  return z(path[0]) >= z(path[path.length - 1]) ? path : path.reverse();
}

describe('ski-log trip identity', () => {
  test('trip codes use an unambiguous alphabet and round-trip through normalize', () => {
    const code = generateTripCode(Buffer.from([0, 1, 2, 3, 4, 31]));
    expect(code).toBe('ABC-DE9');
    expect(normalizeTripCode('abc de9')).toBe('ABC-DE9');
    expect(normalizeTripCode('ABC-DE0')).toBeNull();
    expect(normalizeTripCode('ABCD')).toBeNull();
    for (let i = 0; i < 50; i++) expect(normalizeTripCode(generateTripCode())).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  });

  test('names are trimmed, stripped of markup, and capped', () => {
    expect(sanitizeDisplayName('  Levi   <b>Lane</b> ')).toBe('Levi bLane/b');
    expect(sanitizeDisplayName('   ')).toBeNull();
    expect(sanitizeDisplayName('x'.repeat(40))).toHaveLength(24);
  });

  test('tokens are stored only as a sha256 hash', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('ski-log days', () => {
  test('day bounds follow Pacific time across standard and daylight time', () => {
    const winter = dayBounds('2026-01-17');
    expect(new Date(winter.start).toISOString()).toBe('2026-01-17T08:00:00.000Z');
    expect(winter.end - winter.start).toBe(24 * 3600 * 1000);
    const summer = dayBounds('2026-07-04');
    expect(new Date(summer.start).toISOString()).toBe('2026-07-04T07:00:00.000Z');
    expect(localDay(Date.UTC(2026, 0, 18, 6, 0))).toBe('2026-01-17');
  });
});

describe('ski-log GPS cleanup', () => {
  test('drops bad fixes, poor accuracy, duplicates, and teleports, then sorts', () => {
    const pts = cleanPoints([
      { ts: T0 + 10_000, lat: 37.64, lng: -119.03, acc: 5 },
      { ts: T0, lat: 37.64, lng: -119.03, acc: 5 },
      { ts: T0, lat: 37.64, lng: -119.03, acc: 5 },
      { ts: T0 + 5_000, lat: 37.64, lng: -119.03, acc: 120 },
      { ts: T0 + 20_000, lat: 37.7, lng: -119.03, acc: 5 },
      { ts: T0 + 30_000, lat: 'x', lng: -119.03 },
      { ts: T0 + 40_000, lat: 37.6401, lng: -119.0301, acc: null, speed: 8 },
    ]);
    expect(pts.map((p) => p.ts)).toEqual([T0, T0 + 10_000, T0 + 40_000]);
    expect(pts[2].speed).toBe(8);
  });
});

describe('ski-log matching on Mammoth', () => {
  const index = getAreaIndex('mammoth');
  const lift = index.lifts.filter((l) => l.riseFt > 900 && l.name).sort((a, b) => b.riseFt - a.riseFt)[0];
  const run = index.runs
    .filter((r) => r.name && r.paths.length === 1 && r.verticalFt > 700)
    .sort((a, b) => b.verticalFt - a.verticalFt)[0];

  test('fixtures exist in the baked Mammoth data', () => {
    expect(lift).toBeTruthy();
    expect(run).toBeTruthy();
    expect(demIdForPoint(lift.coords[0][0], lift.coords[0][1])).toBe('mammoth');
  });

  test('a lift ride then a run split into one lift segment and one named run', () => {
    const up = walk(lift.coords, { startTs: T0, mps: 4.5 });
    const down = walk(topDown(index, run), { startTs: up[up.length - 1].ts + 180_000, mps: 9 });
    const segs = segmentTrack(cleanPoints([...up, ...down]), index);
    const kinds = segs.map((s) => s.kind);
    expect(kinds).toEqual(['lift', 'run']);
    expect(segs[0].lift.id).toBe(lift.id);
    expect(segs[1].run.id).toBe(run.id);
    expect(segs[1].offPiste).toBe(false);
    expect(segs[1].verticalFt).toBeGreaterThan(run.verticalFt * 0.7);
    expect(segs[1].topSpeedMph).toBeGreaterThan(15);
    expect(segs[1].topSpeedMph).toBeLessThan(25);
    expect(segs[1].path.length).toBeLessThanOrEqual(80);
  });

  test('a descent away from every mapped run is logged as off-piste', () => {
    const empty = buildAreaIndex({ demId: 'mammoth', dem: index.dem, runs: [], lifts: [] });
    const segs = segmentTrack(walk(topDown(index, run), { startTs: T0, mps: 8 }), empty);
    expect(segs.map((s) => s.kind)).toEqual(['run']);
    expect(segs[0].offPiste).toBe(true);
    expect(segs[0].run).toBeNull();
  });

  test('check-in candidates put the run under the tap first', () => {
    const [lat, lng] = run.paths[0][Math.floor(run.paths[0].length / 2)];
    const cands = snapCandidates(index, lat, lng);
    expect(cands[0].id).toBe(run.id);
    expect(cands[0].distanceM).toBeLessThan(5);
    expect(cands.length).toBeLessThanOrEqual(3);
  });

  test('a check-in is dropped when GPS already logged that run nearby in time', () => {
    const down = walk(topDown(index, run), { startTs: T0, mps: 9 });
    const segs = segmentTrack(down, index);
    const merged = mergeCheckins(
      segs,
      [
        { runId: run.id, demId: 'mammoth', ts: T0 + 60_000 },
        { runId: run.id, demId: 'mammoth', ts: T0 + 3 * 3600_000 },
      ],
      () => index
    );
    const checkinRuns = merged.filter((s) => s.source === 'checkin');
    expect(checkinRuns).toHaveLength(1);
    expect(checkinRuns[0].run.id).toBe(run.id);
  });
});

describe('ski-log segmentation without trail data', () => {
  test('turning points flip on an 80 ft reversal and ignore small wiggles', () => {
    const zs = [8000, 8100, 8300, 8600, 8570, 8590, 8400, 8100, 7900, 7950, 8200];
    expect(turningPoints(zs)).toEqual([0, 3, 8, 10]);
  });

  test('phone altitude is used when the point is outside every DEM', () => {
    const index = buildAreaIndex({ demId: 'test', dem: null });
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push({ ts: T0 + i * 5000, lat: 40 + i * 0.0002, lng: -105, alt: 3000 - i * 10 });
    const segs = segmentTrack(pts, index);
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe('run');
    expect(segs[0].offPiste).toBe(true);
  });
});

describe('ski-log track import', () => {
  const slopesGpx = `<?xml version="1.0"?>
<gpx version="1.1" creator="Slopes" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Mammoth</name><trkseg>
    <trkpt lat="37.6500" lon="-119.0300"><ele>3000.5</ele><time>2026-01-17T17:00:00Z</time></trkpt>
    <trkpt lon="-119.0301" lat="37.6501"><ele>2998</ele><time>2026-01-17T17:00:05Z</time></trkpt>
    <trkpt lat="37.6502" lon="-119.0302"><time>2026-01-17T17:00:10Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

  test('reads Slopes/Strava GPX with either attribute order', () => {
    const pts = parseTrackFile(slopesGpx);
    expect(pts).toHaveLength(3);
    expect(pts[1]).toMatchObject({ lat: 37.6501, lng: -119.0301, alt: 2998, ts: Date.parse('2026-01-17T17:00:05Z') });
    expect(pts[2].alt).toBeNull();
  });

  test('reads Apple Health workout-route GPX speed and accuracy extensions', () => {
    const gpx = `<gpx version="1.1" creator="Apple Health Export"><trk><trkseg>
      <trkpt lon="-119.03" lat="37.65"><ele>3001</ele><time>2026-01-17T17:00:00Z</time>
        <extensions><speed>7.4</speed><course>180</course><hAcc>4.2</hAcc><vAcc>3</vAcc></extensions></trkpt>
    </trkseg></trk></gpx>`;
    const [p] = parseTrackFile(gpx);
    expect(p.speed).toBe(7.4);
    expect(p.acc).toBe(4.2);
  });

  test('reads Garmin TCX', () => {
    const tcx = `<TrainingCenterDatabase><Activities><Activity><Lap><Track>
      <Trackpoint><Time>2026-01-17T17:00:00Z</Time><Position><LatitudeDegrees>37.65</LatitudeDegrees>
      <LongitudeDegrees>-119.03</LongitudeDegrees></Position><AltitudeMeters>3000</AltitudeMeters></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expect(parseTrackFile(tcx)[0]).toMatchObject({ lat: 37.65, lng: -119.03, alt: 3000 });
  });

  test('explains what went wrong with unusable files', () => {
    expect(() => parseTrackFile('hello')).toThrow(/GPX or TCX/);
    expect(() => parseTrackFile('<gpx></gpx>')).toThrow(/No track points/);
    expect(() => parseTrackFile('<gpx><trkpt lat="1" lon="2"></trkpt></gpx>')).toThrow(/timestamps/);
  });

  test('imported points that overlap live tracking are dropped', () => {
    const imported = [0, 10, 20, 100, 200].map((s) => ({ ts: T0 + s * 1000 }));
    const kept = dropCoveredPoints(imported, [T0 + 5_000, T0 + 15_000], 30_000);
    expect(kept.map((p) => (p.ts - T0) / 1000)).toEqual([100, 200]);
    expect(dropCoveredPoints(imported, [])).toHaveLength(5);
    expect(daysCovered([{ ts: T0 }, { ts: T0 + 86_400_000 }])).toEqual(['2026-01-17', '2026-01-18']);
  });
});

describe('ski-log photo placement', () => {
  const track = [
    { ts: T0, lat: 37.64, lng: -119.03 },
    { ts: T0 + 60_000, lat: 37.65, lng: -119.04 },
  ];

  test('photo GPS wins when present', () => {
    expect(placePhoto({ ts: T0, exifLat: 37.6, exifLng: -119.0 }, track)).toEqual({ lat: 37.6, lng: -119.0, source: 'exif' });
  });

  test('otherwise the rider track at the photo time, interpolated', () => {
    const pin = placePhoto({ ts: T0 + 30_000 }, track);
    expect(pin.source).toBe('track');
    expect(pin.lat).toBeCloseTo(37.645, 5);
  });

  test('then the phone fix if the photo was just taken, else unpinned', () => {
    const later = T0 + 3 * 3600_000;
    expect(placePhoto({ ts: later, deviceLat: 37.7, deviceLng: -119.1, deviceTs: later + 20_000 }, track).source).toBe('device');
    expect(placePhoto({ ts: later, deviceLat: 37.7, deviceLng: -119.1, deviceTs: later + 600_000 }, track).source).toBeNull();
    expect(placePhoto({ ts: later, exifLat: 0, exifLng: 0 }, []).source).toBeNull();
  });

  test('a pinned photo is labeled with the run under it; an unpinned one lands on the run the rider picked', () => {
    const index = getAreaIndex('mammoth');
    const run = index.runs.find((r) => r.name && r.paths[0].length > 4);
    const [lat, lng] = run.paths[0][2];
    expect(photoRun({ lat, lng }).runId).toBe(run.id);
    const picked = photoRun({ lat: null, lng: null, runId: run.id });
    expect(picked).toMatchObject({ runId: run.id, demId: 'mammoth', placed: true });
    expect(photoRun({ lat: null, lng: null }).runId).toBeNull();
  });
});

describe('ski-log day stats', () => {
  test('totals runs, vertical, difficulty mix, and picks longest and steepest', () => {
    const seg = (over) => ({ kind: 'run', verticalFt: 0, distanceM: 0, topSpeedMph: null, offPiste: false, run: null, ...over });
    const s = dayStats([
      { kind: 'lift', startTs: T0, endTs: T0 + 1, verticalFt: 1200, distanceM: 2000 },
      seg({ startTs: T0 + 2, endTs: T0 + 3, verticalFt: 1100, distanceM: 2400, topSpeedMph: 31.2, run: { id: 'a', name: 'Cornice', tier: 'black', maxPitchDeg: 38 } }),
      seg({ startTs: T0 + 4, endTs: T0 + 5, verticalFt: 1400, distanceM: 3200, topSpeedMph: 28, run: { id: 'b', name: 'Road Runner', tier: 'blue', maxPitchDeg: 22 } }),
      seg({ startTs: T0 + 6, endTs: T0 + 7, verticalFt: 300, distanceM: 500, offPiste: true }),
    ]);
    expect(s.runs).toBe(3);
    expect(s.liftRides).toBe(1);
    expect(s.verticalFt).toBe(2800);
    expect(s.distanceMi).toBe(3.8);
    expect(s.topSpeedMph).toBe(31.2);
    expect(s.byDifficulty).toEqual({ green: 0, blue: 1, black: 1, double: 0, unrated: 1 });
    expect(s.longestRun.name).toBe('Road Runner');
    expect(s.steepestRun.name).toBe('Cornice');
  });

  test('trip day ranks the crew by vertical', () => {
    const index = getAreaIndex('mammoth');
    const run = index.runs.filter((r) => r.name && r.paths.length === 1 && r.verticalFt > 700)[0];
    const day = buildTripDay({
      trip: { code: 'ABC-DEF', name: 'Mammoth weekend', resortId: 'mammoth' },
      members: [
        { id: 1, name: 'Levi', color: '#7ec8e3' },
        { id: 2, name: 'Sam', color: '#f2a65a' },
      ],
      points: [],
      checkins: [{ memberId: 2, runId: run.id, demId: 'mammoth', ts: T0 }],
      date: '2026-01-17',
    });
    expect(day.leaderboard[0].name).toBe('Sam');
    expect(day.members[1].stats.runs).toBe(1);
    expect(day.crew.runs).toBe(1);
    expect(day.areas).toContain('mammoth');
  });
});

describe('ski-log Google Earth export', () => {
  test('KML colors flip to aabbggrr', () => {
    expect(kmlColor('#7ec8e3')).toBe('ffe3c87e');
    expect(kmlColor('f2a65a', '80')).toBe('805aa6f2');
    expect(kmlColor('nope')).toBe('ffffffff');
  });

  test('a day exports rider folders, run placemarks, and escaped photo pins', () => {
    const index = getAreaIndex('mammoth');
    const run = index.runs.find((r) => r.name && r.paths.length === 1 && r.verticalFt > 700);
    const day = buildTripDay({
      trip: { code: 'ABC-DEF', name: 'Mammoth <weekend> & co', resortId: 'mammoth' },
      members: [
        { id: 1, name: 'Levi', color: '#7ec8e3' },
        { id: 2, name: 'Sam', color: '#f2a65a' },
      ],
      points: walk(topDown(index, run), { startTs: T0, mps: 9 }).map((p) => ({ ...p, memberId: 1 })),
      photos: [{ id: 'abc', memberId: 1, ts: T0 + 60_000, lat: 37.63, lng: -119.03, caption: 'Pow & sun', runName: run.name }],
      date: '2026-01-17',
    });
    const kml = buildDayKml(day, { photoUrl: (id) => `https://example.test/p/${id}.jpg` });
    expect(kml.startsWith('<?xml')).toBe(true);
    expect(kml).toContain('<name>Mammoth &lt;weekend&gt; &amp; co — 2026-01-17</name>');
    expect(kml).toContain('<Folder><name>Levi</name>');
    expect(kml).not.toContain('<Folder><name>Sam</name>');
    expect(kml).toContain(`<name>${run.name.replace(/&/g, '&amp;')}</name>`);
    expect(kml).toContain('<color>ffe3c87e</color>');
    expect(kml).toContain('<img src="https://example.test/p/abc.jpg"');
    expect(kml).toContain('<name>Pow &amp; sun</name>');
    expect(kml).toMatch(/<coordinates>-119\.\d+,37\.\d+,0 /);
    expect((kml.match(/<Placemark>/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
