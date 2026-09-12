/**
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

describe('ISS station tour page', () => {
  test('catalog has eight modules, about, agencies, and guide null', async () => {
    const catalog = JSON.parse(
      await readFile(path.join(root, 'data/planetarium/iss-station.json'), 'utf8')
    );
    expect(catalog.id).toBe('iss-station');
    expect(catalog.guide).toBeNull();
    expect(catalog.about?.body).toMatch(/International Space Station/i);
    expect((catalog.agencies || []).map((a) => a.id)).toEqual([
      'nasa',
      'roscosmos',
      'esa',
      'jaxa',
      'csa',
    ]);
    const ids = (catalog.modules || []).map((m) => m.id);
    expect(ids).toEqual([
      'destiny',
      'columbus',
      'kibo',
      'harmony',
      'cupola',
      'quest',
      'russian',
      'truss',
    ]);
    for (const mod of catalog.modules) {
      expect(mod.name).toBeTruthy();
      expect(mod.summary).toBeTruthy();
      expect(mod.detail).toBeTruthy();
      expect(mod.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  test('station page mounts About, Who, Schedule, and loads scene focus', async () => {
    const html = await readFile(path.join(root, 'public/planetarium/station.html'), 'utf8');
    const page = await readFile(path.join(root, 'public/planetarium/js/station-page.js'), 'utf8');
    const scene = await readFile(path.join(root, 'public/planetarium/js/station-scene.js'), 'utf8');
    expect(html).toContain('id="psAbout"');
    expect(html).toContain('id="psWho"');
    expect(html).toContain('id="psSchedule"');
    expect(html).toContain('id="psModuleRail"');
    expect(html).toContain('station-page.js');
    expect(html).toContain('/planetarium/station.html');
    expect(page).toContain("from './station-scene.js'");
    expect(page).toContain('/api/planetarium/iss-crew');
    expect(page).toContain('/api/planetarium/iss-passes');
    expect(page).toContain('/planetarium/?at=');
    expect(page).toContain('createStationScene');
    expect(scene).toContain('export function createStationScene');
    expect(scene).toContain('function focus(');
    expect(scene).toContain('prefers-reduced-motion');
  });

  test('home and menus link to Station', async () => {
    const home = await readFile(path.join(root, 'public/index.html'), 'utf8');
    const menu = await readFile(path.join(root, 'public/shared/menu-config.js'), 'utf8');
    const search = await readFile(path.join(root, 'public/shared/tool-search-index.js'), 'utf8');
    const theater = await readFile(path.join(root, 'public/planetarium/index.html'), 'utf8');
    expect(home).toContain('/planetarium/station.html');
    expect(home).toContain('Enter Station');
    expect(menu).toContain("/planetarium/station.html");
    expect(menu).toContain('ISS Station');
    expect(search).toContain('/planetarium/station.html');
    expect(theater).toContain('/planetarium/station.html');
  });
});
