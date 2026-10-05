/**
 * Launch-to-dock: ISS arrival classification, live fetch, snapshot fallback, page wiring.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';
import {
  classifyVehicle,
  getIssArrivals,
  normalizeLaunch,
  resetArrivalsCache,
  selectArrivals,
} from '../../services/planetarium-arrivals.service.js';

const NOW = Date.parse('2026-10-05T00:00:00Z');

function launch(name, net, extra = {}) {
  return {
    id: name,
    name: `Falcon 9 Block 5 | ${name}`,
    net,
    status: { abbrev: 'Go', name: 'Go for Launch' },
    mission: { name, description: 'Resupply   mission to the International Space Station.' },
    launch_service_provider: { name: 'SpaceX' },
    pad: { name: 'SLC-40', location: { name: 'Cape Canaveral, FL, USA' } },
    rocket: { configuration: { full_name: 'Falcon 9 Block 5' } },
    ...extra,
  };
}

describe('classifyVehicle', () => {
  it('maps crewed and cargo Dragon to the IDAs', () => {
    expect(classifyVehicle('Crew-13')).toMatchObject({ vehicle: 'Crew Dragon', port: 'ida2', kind: 'docking' });
    expect(classifyVehicle('Axiom Mission 5 (Ax-5)')).toMatchObject({ vehicle: 'Crew Dragon', port: 'ida2' });
    expect(classifyVehicle('Dragon CRS-2 SpX-35')).toMatchObject({ vehicle: 'Cargo Dragon', port: 'ida3' });
  });

  it('maps Russian vehicles to probe-and-drogue ports', () => {
    expect(classifyVehicle('Progress MS-36 (97P)')).toMatchObject({ port: 'zvezda', mechanism: 'probe-and-drogue' });
    expect(classifyVehicle('Soyuz MS-29')).toMatchObject({ port: 'rassvet', mechanism: 'probe-and-drogue' });
  });

  it('treats Cygnus and HTV-X as Canadarm2 berthing', () => {
    expect(classifyVehicle('Cygnus CRS-2 NG-25')).toMatchObject({ kind: 'berthing', port: 'unity' });
    expect(classifyVehicle('HTV-X2')).toMatchObject({ kind: 'berthing', port: 'harmony' });
  });

  it('ignores non-ISS and Tiangong flights', () => {
    expect(classifyVehicle('Starlink Group 15-25')).toBeNull();
    expect(classifyVehicle('Shenzhou 24')).toBeNull();
    expect(classifyVehicle('')).toBeNull();
  });
});

describe('normalizeLaunch / selectArrivals', () => {
  it('normalizes the fields the card needs', () => {
    const row = normalizeLaunch(launch('Dragon CRS-2 SpX-35', '2026-10-13T10:33:44Z'));
    expect(row).toMatchObject({
      name: 'Dragon CRS-2 SpX-35',
      rocket: 'Falcon 9 Block 5',
      provider: 'SpaceX',
      padLocation: 'Cape Canaveral, FL, USA',
      portLabel: 'IDA-3 on Harmony zenith',
      description: 'Resupply mission to the International Space Station.',
    });
  });

  it('keeps ISS arrivals only, soonest first, and drops launches long past', () => {
    const rows = selectArrivals(
      [
        launch('Starlink Group 1', '2026-10-06T00:00:00Z'),
        launch('Cygnus CRS-2 NG-25', '2026-11-30T00:00:00Z'),
        launch('Dragon CRS-2 SpX-35', '2026-10-13T10:33:44Z'),
        launch('Progress MS-35', '2026-09-01T00:00:00Z'),
      ],
      NOW
    );
    expect(rows.map((r) => r.vehicle)).toEqual(['Cargo Dragon', 'Cygnus']);
  });
});

describe('getIssArrivals', () => {
  beforeEach(() => resetArrivalsCache());

  it('returns live rows and caches them', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: [launch('Dragon CRS-2 SpX-35', '2026-10-13T10:33:44Z')] }),
    }));
    const first = await getIssArrivals(fetchImpl, NOW);
    const second = await getIssArrivals(fetchImpl, NOW + 1000);
    expect(first.source).toBe('live');
    expect(first.arrivals).toHaveLength(1);
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to the bundled snapshot when Launch Library fails', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const out = await getIssArrivals(fetchImpl, NOW);
    expect(out.source).toBe('snapshot');
    expect(out.note).toMatch(/429/);
    expect(Array.isArray(out.arrivals)).toBe(true);
    expect(out.arrivals.length).toBeGreaterThan(0);
  });
});

describe('station page wiring', () => {
  const read = (...p) => fs.readFileSync(path.join(process.cwd(), ...p), 'utf8');

  it('mounts the arrivals panel and the scene replay', () => {
    const page = read('public', 'planetarium', 'station.html');
    const scene = read('public', 'planetarium', 'js', 'planetarium-station-scene.js');
    const js = read('public', 'planetarium', 'js', 'planetarium-station-arrivals.js');
    const controller = read('controllers', 'planetarium.controller.js');
    expect(page).toContain('id="stArrivalList"');
    expect(page).toContain('planetarium-station-arrivals.js');
    expect(scene).toContain('startArrival');
    expect(scene).toContain('ARRIVAL_STEPS');
    expect(scene).toContain('Canadarm2 grapple');
    expect(js).toContain('/api/planetarium/iss-arrivals');
    expect(controller).toContain("'/iss-arrivals'");
  });
});
