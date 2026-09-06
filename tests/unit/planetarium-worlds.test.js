/**
 * Planetarium world dossiers — shape and completeness.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const WORLDS_DIR = path.join(process.cwd(), 'data', 'planetarium', 'worlds');
const REQUIRED_IDS = [
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('planetarium world dossiers', () => {
  const index = readJson(path.join(WORLDS_DIR, 'index.json'));

  test('index lists all ten bodies in solar-system order', () => {
    expect(index.bodies).toEqual(REQUIRED_IDS);
    expect(index.title).toMatch(/world/i);
  });

  test.each(REQUIRED_IDS)('%s dossier has required research shape', (id) => {
    const d = readJson(path.join(WORLDS_DIR, `${id}.json`));
    expect(d.id).toBe(id);
    expect(d.name).toBeTruthy();
    expect(d.kicker).toBeTruthy();
    expect(d.lede).toBeTruthy();
    expect(d.credit).toBeTruthy();
    expect(d.texture).toMatch(/^\//);
    expect(d.physical).toEqual(
      expect.objectContaining({
        radiusKm: expect.any(Number),
        dayHours: expect.any(Number),
        yearDays: expect.any(Number),
        moons: expect.any(Number),
        tiltDeg: expect.any(Number),
      })
    );
    expect(d.landmark).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        lat: expect.any(Number),
        lon: expect.any(Number),
        zoom: expect.any(Number),
        blurb: expect.any(String),
      })
    );
    expect(Array.isArray(d.missions)).toBe(true);
    expect(d.missions.length).toBeGreaterThan(0);
    expect(d.missions[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        year: expect.any(Number),
        note: expect.any(String),
      })
    );
    expect(Array.isArray(d.researchNotes)).toBe(true);
    expect(d.researchNotes.length).toBeGreaterThanOrEqual(2);
    expect(d.carlFocus).toBeTruthy();
  });

  test('moon dossier links Lane Museum', () => {
    const moon = readJson(path.join(WORLDS_DIR, 'moon.json'));
    expect(moon.landmark.href).toContain('lane-museum');
    expect(moon.landmark.label).toMatch(/Lane/i);
  });
});
