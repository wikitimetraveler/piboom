/**
 * Star Wars hangar reel — shuttle first, then the main ships.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const TOUR = path.join(process.cwd(), 'data', 'planetarium', 'star-wars-tour.json');
const PAGE = path.join(process.cwd(), 'public', 'planetarium', 'star-wars.html');
const SCENE = path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-starwars-scene.js');
const PLAYER = path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-starwars.js');

const SHIP_ORDER = [
  'lambda',
  'x-wing',
  'tie',
  'y-wing',
  'falcon',
  'star-destroyer',
  'death-star',
];

describe('star wars hangar tour', () => {
  const tour = JSON.parse(fs.readFileSync(TOUR, 'utf8'));

  test('lists seven ships, shuttle first', () => {
    expect(tour.ships.map((ship) => ship.id)).toEqual(SHIP_ORDER);
    expect(tour.ships[0].name).toMatch(/shuttle/i);
    expect(tour.beats[0].ship).toBe('lambda');
    expect(tour.beats[0].camera).toBe('approach');
    const firsts = [];
    tour.beats.forEach((beat) => {
      if (!firsts.includes(beat.ship)) firsts.push(beat.ship);
    });
    expect(firsts).toEqual(SHIP_ORDER);
  });

  test('every beat names a ship and a camera, and every ship can be walked inside', () => {
    const ids = new Set(tour.ships.map((ship) => ship.id));
    tour.beats.forEach((beat) => {
      expect(ids.has(beat.ship)).toBe(true);
      expect(['approach', 'orbit', 'pullback', 'walk']).toContain(beat.camera);
      expect(String(beat.text || '').trim().length).toBeGreaterThan(20);
      expect(beat.who).toBe('zigzag');
      if (beat.camera === 'walk') expect(String(beat.room || '').length).toBeGreaterThan(1);
    });
    SHIP_ORDER.forEach((id) => {
      expect(tour.beats.some((beat) => beat.ship === id && beat.camera === 'walk')).toBe(true);
    });
    expect(tour.beats.filter((beat) => beat.ship === 'falcon' && beat.camera === 'walk').length).toBeGreaterThanOrEqual(4);
    expect(tour.beats.find((beat) => beat.ship === 'star-destroyer').camera).toBe('pullback');
    expect(tour.beats.find((beat) => beat.ship === 'death-star').camera).toBe('pullback');
    expect(tour.disclaimer).toMatch(/not an official film/i);
  });
});

describe('star wars hangar page', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  const scene = fs.readFileSync(SCENE, 'utf8');
  const player = fs.readFileSync(PLAYER, 'utf8');

  test('stage, tour controls, and shuttle-first copy are on the page', () => {
    expect(page).toContain('id="swStage"');
    expect(page).toContain('id="swTourPlay"');
    expect(page).toContain('id="swTourPause"');
    expect(page).toContain('id="swTourNext"');
    expect(page).toContain('id="swTourBeats"');
    expect(page).toContain('id="swFallback"');
    expect(page).toContain('id="swLookInside"');
    expect(page).toContain('star-wars-cantina.html');
    expect(page).toContain('Lambda shuttle');
    expect(page).toContain('planetarium-starwars-scene.js');
    expect(page).toContain('planetarium-starwars.js');
  });

  test('scene builds each ship once and can tear down', () => {
    expect(scene).toContain('prefers-reduced-motion');
    expect(scene).toContain('showShip');
    expect(scene).toContain('buildShipInteriors');
    expect(scene).toContain("cameraMode === 'walk'");
    expect(scene).toContain('setKeepAlive');
    expect(scene).toContain('dispose');
    expect(scene).toContain('setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))');
    SHIP_ORDER.forEach((id) => {
      expect(scene).toContain("'" + id + "'");
    });
  });

  test('player speaks Zigzag and honors ship deep links', () => {
    expect(player).toContain('/data/planetarium/star-wars-tour.json');
    expect(player).toContain('speakNarrationAwaitEnd');
    expect(player).toContain("params.get('ship')");
    expect(player).toContain('showShip');
    expect(player).toContain('beat.room');
    expect(player).toContain('swLookInside');
  });

  test('planetarium, SpaceX, and ISS link to the hangar', () => {
    const index = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'index.html'), 'utf8');
    const spacex = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'spacex.html'), 'utf8');
    const station = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'station.html'), 'utf8');
    expect(index).toContain('/planetarium/star-wars.html');
    expect(spacex).toContain('/planetarium/star-wars.html');
    expect(station).toContain('/planetarium/star-wars.html');
  });
});

describe('star wars cantina', () => {
  const tour = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'planetarium', 'star-wars-cantina.json'), 'utf8'));
  const page = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'star-wars-cantina.html'), 'utf8');
  const scene = fs.readFileSync(path.join(process.cwd(), 'public', 'planetarium', 'js', 'planetarium-starwars-cantina.js'), 'utf8');
  const figures = ['luke', 'leia', 'han', 'chewbacca', 'obi-wan', 'vader', 'yoda', 'c3po', 'r2d2', 'lando', 'boba', 'band'];

  test('walks the main figures in the bar', () => {
    figures.forEach((id) => {
      expect(tour.figures.some((fig) => fig.id === id)).toBe(true);
      expect(tour.beats.some((beat) => beat.figure === id)).toBe(true);
    });
    expect(tour.disclaimer).toMatch(/not an official film/i);
    tour.beats.forEach((beat) => {
      expect(String(beat.text || '').length).toBeGreaterThan(20);
    });
  });

  test('page and scene can show and pick a figure', () => {
    expect(page).toContain('id="ctStage"');
    expect(page).toContain('id="ctTourPlay"');
    expect(page).toContain('planetarium-starwars-cantina.js');
    expect(scene).toContain('showFigure');
    expect(scene).toContain('speakNarrationAwaitEnd');
    expect(scene).toContain('prefers-reduced-motion');
    expect(scene).toContain('setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))');
    figures.forEach((id) => {
      expect(scene).toContain(id === 'obi-wan' ? "'obi-wan'" : id);
    });
  });
});
