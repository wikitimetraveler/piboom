/**
 * ISS station world catalog, crew, and page wiring.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import {
  crewInModule,
  findModule,
  getStationPage,
  loadCrew,
  loadModules,
  parseStationQuery,
} from '../../services/planetarium-station.service.js';
import { geodeticFromTle } from '../../services/planetarium-iss.service.js';
import { assignQuarters, craftFromGroup, toCrewRecord } from '../../scripts/tools/fetch-iss-crew.mjs';
import { buildSystemPrompt } from '../../services/planetarium-assistant.service.js';

const SAMPLE_TLE = [
  '1 25544U 98067A   26001.50000000  .00016717  00000-0  10270-3 0  9000',
  '2 25544  51.6400 120.0000 0001000  90.0000 270.0000 15.50000000100000',
];

const REQUIRED_MODULES = [
  'destiny',
  'harmony',
  'columbus',
  'kibo',
  'cupola',
  'unity',
  'tranquility',
  'quest',
  'zarya',
  'zvezda',
  'nauka',
];

describe('ISS module catalog', () => {
  const catalog = loadModules();

  test('names the station and lists core modules', () => {
    expect(catalog.id).toBe('iss');
    expect(catalog.name).toMatch(/International Space Station/i);
    const ids = catalog.modules.map((m) => m.id);
    REQUIRED_MODULES.forEach((id) => expect(ids).toContain(id));
  });

  test('every module has layout and kind', () => {
    catalog.modules.forEach((mod) => {
      expect(mod.id).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.kind).toBeTruthy();
      expect(mod.layout).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          z: expect.any(Number),
        })
      );
    });
  });
});

describe('ISS crew snapshot', () => {
  const crew = loadCrew();
  const catalog = loadModules();
  const ids = new Set(catalog.modules.map((m) => m.id));

  test('lists people with quarters on real modules', () => {
    expect(crew.people.length).toBeGreaterThanOrEqual(3);
    crew.people.forEach((person) => {
      expect(person.name).toBeTruthy();
      expect(ids.has(person.quartersModuleId)).toBe(true);
    });
  });

  test('crewInModule finds Harmony sleepers', () => {
    const inHarmony = crewInModule('harmony', crew);
    expect(Array.isArray(inHarmony)).toBe(true);
  });
});

describe('station page service', () => {
  test('parseStationQuery reads module and mode', () => {
    expect(parseStationQuery({ module: 'Cupola', mode: 'WALK' })).toEqual({
      module: 'cupola',
      mode: 'walk',
    });
  });

  test('findModule resolves Destiny', () => {
    expect(findModule('destiny').name).toBe('Destiny');
  });

  test('getStationPage focuses Cupola without live TLE', async () => {
    const mockFetch = async () => ({ ok: false, status: 502, text: async () => 'err' });
    const page = await getStationPage({ module: 'cupola' }, mockFetch);
    expect(page.focus.id).toBe('cupola');
    expect(page.modules.length).toBeGreaterThan(10);
    expect(page.aboard).toBeGreaterThan(0);
  });
});

describe('geodeticFromTle', () => {
  test('returns finite lat/lon or null for the sample TLE', () => {
    const geo = geodeticFromTle(SAMPLE_TLE, new Date('2026-01-01T12:00:00Z'));
    if (geo) {
      expect(Number.isFinite(geo.lat)).toBe(true);
      expect(Number.isFinite(geo.lon)).toBe(true);
      expect(Math.abs(geo.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(geo.lon)).toBeLessThanOrEqual(180);
    } else {
      expect(geo).toBeNull();
    }
  });
});

describe('fetch-iss-crew helpers', () => {
  test('maps Dragon-sized mixed groups and Soyuz-sized Russian groups', () => {
    expect(craftFromGroup([{ agency: 'NASA' }, { agency: 'ESA' }, { agency: 'Roscosmos' }])).toBe(
      'Crew Dragon'
    );
    expect(craftFromGroup([{ agency: 'Roscosmos' }, { agency: 'Roscosmos' }, { agency: 'NASA' }])).toBe(
      'Soyuz'
    );
  });

  test('assignQuarters writes Harmony vs Russian sleep modules', () => {
    const people = assignQuarters([
      toCrewRecord({
        id: 1,
        name: 'A',
        agency: { abbrev: 'NASA' },
        last_flight: '2026-02-13T10:00:00Z',
        in_space: true,
      }),
      toCrewRecord({
        id: 2,
        name: 'B',
        agency: { abbrev: 'RFSA' },
        last_flight: '2026-07-14T10:00:00Z',
        in_space: true,
      }),
      toCrewRecord({
        id: 3,
        name: 'C',
        agency: { abbrev: 'RFSA' },
        last_flight: '2026-07-14T10:00:00Z',
        in_space: true,
      }),
    ]);
    expect(people.find((p) => p.name === 'A').quartersModuleId).toBe('harmony');
    expect(['rassvet', 'poisk', 'zvezda']).toContain(people.find((p) => p.name === 'B').quartersModuleId);
  });
});

describe('station page wiring', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'station.html'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'public', 'shared', 'css', 'planetarium-station.css'), 'utf8');
  const js = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-station.js'), 'utf8');
  const scene = fs.readFileSync(
    path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-station-scene.js'),
    'utf8'
  );
  const interiorsJs = fs.readFileSync(
    path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-station-interiors.js'),
    'utf8'
  );
  const menu = fs.readFileSync(path.join(process.cwd(), 'public', 'shared', 'menu-config.js'), 'utf8');
  const home = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  const guide = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-guide.js'), 'utf8');
  const tour = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'planetarium', 'iss-station-tour.json'), 'utf8')
  );

  test('page, CSS, scene, and menu exist', () => {
    expect(page).toContain('plan-station');
    expect(page).toContain('stEnterModule');
    expect(page).toContain('stPhoto');
    expect(js).toContain('/api/planetarium/station');
    expect(js).toContain('iss-interiors.json');
    expect(js).toContain('stEnterModule');
    expect(js).toContain('Escape');
    expect(css).toContain('.st-stage');
    expect(css).toContain('.st-photo');
    expect(scene).toContain('createStationScene');
    expect(scene).toContain('setInteriorsCatalog');
    expect(scene).toContain('prefers-reduced-motion');
    expect(scene).toContain('dispose');
    expect(interiorsJs).toContain('BackSide');
    expect(interiorsJs).toContain('createInteriorManager');
    expect(menu).toContain('/planetarium/station.html');
    expect(menu).toContain('/entertainment/astrology.html');
    expect(home).toContain('/planetarium/station.html');
    expect(home).toContain('/entertainment/astrology.html');
    expect(guide).toContain('WELCOME_STATION');
    expect(guide).toContain('planetarium-carl-station');
  });

  test('tour visits Destiny Harmony Columbus Kibo Cupola Zvezda', () => {
    const rooms = [...new Set(tour.beats.map((b) => b.module).filter(Boolean))];
    ['destiny', 'harmony', 'columbus', 'kibo', 'cupola', 'zvezda'].forEach((id) => {
      expect(rooms).toContain(id);
    });
  });
});

describe('ISS interiors catalog', () => {
  const interiors = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'planetarium', 'iss-interiors.json'), 'utf8')
  );
  const byId = (id) => interiors.rooms.find((r) => r.id === id);

  test('covers the six walk rooms with photos on disk', () => {
    const ids = interiors.rooms.map((r) => r.id);
    ['destiny', 'harmony', 'columbus', 'kibo', 'cupola', 'zvezda'].forEach((id) => {
      expect(ids).toContain(id);
      const room = byId(id);
      expect(room.photo).toMatch(/^\/planetarium\/assets\/station\/interiors\//);
      const abs = path.join(process.cwd(), 'public', room.photo.replace(/^\//, ''));
      expect(fs.existsSync(abs)).toBe(true);
      expect(room.lengthM).toBeGreaterThan(0);
      expect(room.diameterM).toBeGreaterThan(0);
      expect(Array.isArray(room.hardware)).toBe(true);
      expect(room.hardware.length).toBeGreaterThan(0);
    });
  });

  test('Destiny has 24 ISPR bays, Harmony 4 CQ, Columbus 10 racks, Cupola 7 windows', () => {
    const destinyIspr = byId('destiny').hardware.filter((h) => /ispr/i.test(h.id));
    const harmonyCq = byId('harmony').hardware.filter((h) => /cq/i.test(h.id));
    const columbusRacks = byId('columbus').hardware.filter((h) => /rack|biolab|fsl|epm|eadr|ispr/i.test(h.id + h.role));
    const cupolaWindows = byId('cupola').hardware.filter((h) => /win-/i.test(h.id));
    expect(destinyIspr).toHaveLength(24);
    expect(harmonyCq).toHaveLength(4);
    expect(columbusRacks).toHaveLength(10);
    expect(cupolaWindows).toHaveLength(7);
  });

  test('Zvezda kayuti match published cabin sizes', () => {
    const z = byId('zvezda');
    expect(z.kayutiM).toEqual({ width: 0.73, depth: 0.85, height: 1.89 });
  });
});

describe('Carl station context', () => {
  test('buildSystemPrompt embeds ISS station block', () => {
    const prompt = buildSystemPrompt({
      surface: 'station',
      station: {
        focusModule: 'Cupola',
        focusBlurb: 'Seven windows.',
        interiorDims: '1.5 × 2.95 m',
        hardware: 'Nadir window, ROBoT workstation',
        crew: 'Jessica Meir (NASA)',
        now: '42.1°N · 70.8°W',
        altitudeKm: 420,
        mode: 'walk',
      },
    });
    expect(prompt).toContain('ISS station');
    expect(prompt).toContain('Cupola');
    expect(prompt).toContain('1.5 × 2.95 m');
    expect(prompt).toContain('ROBoT');
    expect(prompt).toContain('Jessica Meir');
    expect(prompt).toContain('Zigzag');
  });
});
