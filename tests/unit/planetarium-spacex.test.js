/**
 * SpaceX planetarium catalog and filters.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import {
  filterLaunches,
  getSpacexPage,
  isUpcoming,
  loadCatalog,
  parseSpacexQuery,
  summarizeCatalog,
} from '../../services/planetarium-spacex.service.js';
import { classifyRocket } from '../../scripts/tools/fetch-spacex-catalog.mjs';

const PAGE = path.join(process.cwd(), 'public', 'planetarium', 'spacex.html');
const CSS = path.join(process.cwd(), 'public', 'shared', 'css', 'planetarium-spacex.css');
const JS = path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-spacex.js');

const NOW = new Date('2026-09-12T19:00:00Z');

describe('classifyRocket', () => {
  test('maps launch titles to vehicle families', () => {
    expect(classifyRocket('Falcon 1 | FalconSAT-2')).toEqual({
      id: 'falcon-1',
      name: 'Falcon 1',
      variant: 'Falcon 1',
    });
    expect(classifyRocket('Falcon 9 Block 5 | Starlink Group 6-1').id).toBe('falcon-9');
    expect(classifyRocket('Falcon Heavy | USSF-44').id).toBe('falcon-heavy');
    expect(classifyRocket('Starship | Flight 14').id).toBe('starship');
    expect(classifyRocket('Super Heavy Prototype | Booster 7').id).toBe('starship');
  });
});

describe('spacex catalog snapshot', () => {
  const catalog = loadCatalog();

  test('lists the four SpaceX orbital vehicle families', () => {
    expect(catalog.rockets.map((r) => r.id)).toEqual([
      'falcon-1',
      'falcon-9',
      'falcon-heavy',
      'starship',
    ]);
    expect(catalog.source).toMatch(/Launch Library 2/i);
  });

  test('records maiden flights and launch dates', () => {
    const byId = Object.fromEntries(catalog.rockets.map((r) => [r.id, r]));
    expect(byId['falcon-1'].maidenFlight).toBe('2006-03-24');
    expect(byId['falcon-9'].maidenFlight).toBe('2010-06-04');
    expect(byId['falcon-heavy'].maidenFlight).toBe('2018-02-06');
    expect(byId['starship'].maidenFlight).toBe('2019-07-26');
    expect(catalog.launches[0]).toEqual(
      expect.objectContaining({
        mission: 'FalconSAT-2',
        rocketId: 'falcon-1',
        net: '2006-03-24T22:30:00Z',
      })
    );
    expect(catalog.launches.length).toBeGreaterThan(800);
    expect(byId['falcon-1'].launchCount).toBe(5);
  });

  test('launches are chronological', () => {
    const nets = catalog.launches.map((row) => row.net);
    expect(nets).toEqual([...nets].sort());
  });
});

describe('spacex filters', () => {
  const sample = [
    {
      mission: 'FalconSAT-2',
      rocket: 'Falcon 1',
      rocketId: 'falcon-1',
      variant: 'Falcon 1',
      net: '2006-03-24T22:30:00Z',
      status: 'Failure',
      pad: 'Omelek Island',
      location: 'Kwajalein',
      orbit: '',
      missionType: 'Technology',
    },
    {
      mission: 'Starlink Group 6-1',
      rocket: 'Falcon 9',
      rocketId: 'falcon-9',
      variant: 'Falcon 9 Block 5',
      net: '2023-01-01T00:00:00Z',
      status: 'Success',
      pad: 'SLC-40',
      location: 'Cape Canaveral',
      orbit: 'LEO',
      missionType: 'Communications',
    },
    {
      mission: 'Flight 14',
      rocket: 'Starship',
      rocketId: 'starship',
      variant: 'Starship',
      net: '2026-09-18T12:15:00Z',
      status: 'TBC',
      pad: 'Pad 2',
      location: 'Starbase',
      orbit: '',
      missionType: 'Test Flight',
    },
  ];

  test('parseSpacexQuery normalizes when and rocket', () => {
    expect(parseSpacexQuery({ rocket: 'falcon-9', when: 'UPCOMING', q: ' crew ' })).toEqual({
      rocket: 'falcon-9',
      q: 'crew',
      when: 'upcoming',
      year: '',
      status: '',
    });
    expect(parseSpacexQuery({ when: 'nope' }).when).toBe('all');
  });

  test('filters by rocket, search, year, and upcoming', () => {
    expect(filterLaunches(sample, { rocket: 'falcon-9' })).toHaveLength(1);
    expect(filterLaunches(sample, { q: 'starlink' })[0].mission).toMatch(/Starlink/);
    expect(filterLaunches(sample, { year: '2006' })).toHaveLength(1);
    const upcoming = filterLaunches(sample, { when: 'upcoming' }, NOW);
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].mission).toBe('Flight 14');
    expect(filterLaunches(sample, { when: 'past' }, NOW)).toHaveLength(2);
  });

  test('isUpcoming compares net to now', () => {
    expect(isUpcoming(sample[1], NOW)).toBe(false);
    expect(isUpcoming(sample[2], NOW)).toBe(true);
  });

  test('summarizeCatalog counts next launch', () => {
    const summary = summarizeCatalog({ rockets: [{ id: 'falcon-9' }], launches: sample }, NOW);
    expect(summary.rocketCount).toBe(1);
    expect(summary.pastCount).toBe(2);
    expect(summary.upcomingCount).toBe(1);
    expect(summary.successCount).toBe(1);
    expect(summary.nextLaunch.mission).toBe('Flight 14');
  });

  test('getSpacexPage filters the snapshot', () => {
    const page = getSpacexPage({ rocket: 'falcon-1' }, NOW);
    expect(page.success).toBeUndefined();
    expect(page.rockets).toHaveLength(4);
    expect(page.launches.every((row) => row.rocketId === 'falcon-1')).toBe(true);
    expect(page.launches).toHaveLength(5);
    expect(page.summary.launchCount).toBeGreaterThan(800);
  });
});

describe('spacex page shell', () => {
  test('HTML, CSS, and client script exist with core hooks', () => {
    const html = fs.readFileSync(PAGE, 'utf8');
    const css = fs.readFileSync(CSS, 'utf8');
    const js = fs.readFileSync(JS, 'utf8');
    expect(html).toContain('id="sxRocketGrid"');
    expect(html).toContain('id="sxLaunchTable"');
    expect(html).toContain('id="sxSearch"');
    expect(html).toContain('id="sxPadStage"');
    expect(html).toContain('id="sxHangar"');
    expect(html).toContain('id="sxHangarPlay"');
    expect(html).toContain('/planetarium/js/planetarium-spacex.js');
    expect(html).toContain('/planetarium/js/planetarium-spacex-pad.js');
    expect(html).toContain('/planetarium/js/planetarium-spacex-hangar.js');
    expect(html).toContain('id="planAskCarl"');
    expect(html).toContain('id="sxCarl"');
    expect(html).toContain('/planetarium/js/planetarium-guide.js');
    expect(html).toContain('/shared/speech-recognition.js');
    expect(html).toContain('/shared/js/vendor/three.module.js');
    expect(html).toContain('alienigena-portrait.webp');
    expect(html).toContain('elon-hangar.png');
    expect(css).toContain('.sx-vehicle');
    expect(css).toContain('.sx-pad');
    expect(js).toContain('filterLaunches');
    expect(js).toContain('/api/planetarium/spacex');
    expect(js).toContain('ROCKET_SHOTS');
    expect(js).toContain('ROCKET_FACTS');
    expect(js).toContain('youtube.com/watch?v=');
    expect(js).toContain('dLQ2tZEH6G0');
    expect(js).toContain('1B6oiLNyKKI');
    expect(js).toContain('wbSwFU6tY1c');
    expect(js).toContain('hI9HQfCAw64');
    expect(js).toContain('is-flipped');
    expect(js).toContain('Ask Carl');
    expect(js).toContain('getCarlContext');
    expect(js).toContain('cueRocket');
    expect(css).toContain('.sx-hangar');
    expect(css).toContain('.sx-face--back');
    expect(css).toContain('.sx-card__yt');
  });

  test('launch photos and 3D pad module ship with the page', () => {
    const pad = fs.readFileSync(
      path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-spacex-pad.js'),
      'utf8'
    );
    expect(pad).toContain('createSpacexPad');
    expect(pad).toContain('setVehicle');
    expect(pad).toContain('dispose');
    expect(pad).toContain('prefers-reduced-motion');
    [
      'falcon-1-liftoff.png',
      'falcon-9-liftoff.png',
      'falcon-heavy-liftoff.png',
      'starship-liftoff.png',
      'pad-night.png',
      'elon-hangar.png',
    ].forEach((name) => {
      const file = path.join(process.cwd(), 'public', 'planetarium', 'assets', 'spacex', name);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(10000);
    });
    const zigzag = path.join(process.cwd(), 'public', 'planetarium', 'assets', 'alienigena-portrait.webp');
    expect(fs.existsSync(zigzag)).toBe(true);
    expect(fs.statSync(zigzag).size).toBeGreaterThan(5000);
  });

  test('hangar chat script covers Zigzag, Elon, and all four vehicles', () => {
    const chat = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'planetarium', 'spacex-hangar-chat.json'), 'utf8')
    );
    const hangar = fs.readFileSync(
      path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-spacex-hangar.js'),
      'utf8'
    );
    const guide = fs.readFileSync(
      path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-guide.js'),
      'utf8'
    );
    expect(hangar).toContain('/data/planetarium/spacex-hangar-chat.json');
    expect(hangar).toContain('speakNarrationAwaitEnd');
    expect(guide).toContain('WELCOME_SPACEX');
    expect(guide).toContain('planetarium-carl-spacex');
    expect(chat.beats.some((beat) => beat.who === 'zigzag')).toBe(true);
    expect(chat.beats.some((beat) => beat.who === 'elon')).toBe(true);
    expect([...new Set(chat.beats.map((beat) => beat.rocket).filter(Boolean))].sort()).toEqual([
      'falcon-1',
      'falcon-9',
      'falcon-heavy',
      'starship',
    ]);
  });
});
