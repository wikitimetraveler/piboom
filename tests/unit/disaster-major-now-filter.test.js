/**
 * Development work by David Lane
 */
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filterPath = path.resolve(__dirname, '../../public/finance/js/disaster-major-now-filter.js');

function loadModule() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(filterPath, 'utf8'), sandbox);
  return sandbox.DisasterMajorNowFilter;
}

describe('DisasterMajorNowFilter', () => {
  const F = loadModule();
  const nowMs = Date.parse('2026-08-26T22:00:00.000Z');

  function gridRow(overrides = {}) {
    return {
      riskScore: 8,
      startTime: nowMs - (12 * 60 * 60 * 1000),
      isCamera: false,
      disasterObj: {
        source: 'usgs',
        event_type: 'earthquake',
        start_time: '2026-08-26T10:00:00.000Z',
        title: 'M5.2 quake'
      },
      ...overrides
    };
  }

  test('exports High/Critical floors matching the intensity legend', () => {
    expect(F.HIGH_INTENSITY_MIN).toBe(6);
    expect(F.CRITICAL_INTENSITY_MIN).toBe(10);
    expect(F.HOURS_2D).toBe(48);
    expect(F.HOURS_3D).toBe(72);
    expect(F.DEFAULT_HOURS).toBe(72);
  });

  test('rowPasses keeps High intensity events from the last 2–3 days', () => {
    expect(F.rowPasses(gridRow(), { hours: 72, nowMs })).toBe(true);
    expect(F.rowPasses(gridRow({ riskScore: 6 }), { hours: 48, nowMs })).toBe(true);
    expect(F.rowPasses(gridRow({ riskScore: 10 }), { hours: 72, nowMs })).toBe(true);
  });

  test('rowPasses drops moderate/low scores and stale events', () => {
    expect(F.rowPasses(gridRow({ riskScore: 5.9 }), { hours: 72, nowMs })).toBe(false);
    const fourDaysAgo = nowMs - (96 * 60 * 60 * 1000);
    expect(F.rowPasses(gridRow({ startTime: fourDaysAgo }), { hours: 72, nowMs })).toBe(false);
    const fiftyHoursAgo = nowMs - (50 * 60 * 60 * 1000);
    expect(F.rowPasses(gridRow({ startTime: fiftyHoursAgo }), { hours: 48, nowMs })).toBe(false);
    expect(F.rowPasses(gridRow({ startTime: fiftyHoursAgo }), { hours: 72, nowMs })).toBe(true);
  });

  test('rowPasses excludes cameras and rows without a start time', () => {
    expect(F.rowPasses(gridRow({ isCamera: true }), { hours: 72, nowMs })).toBe(false);
    expect(F.rowPasses(gridRow({ startTime: null, disasterObj: { start_time: null } }), { hours: 72, nowMs })).toBe(false);
    expect(F.rowPasses(null, { hours: 72, nowMs })).toBe(false);
  });

  test('filterRows and disasterObjsFromPassingRows return only matching events', () => {
    const keep = gridRow({ riskScore: 12 });
    const drop = gridRow({ riskScore: 2, disasterObj: { title: 'minor' } });
    const filtered = F.filterRows([keep, drop], { hours: 72, nowMs });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].riskScore).toBe(12);
    const objs = F.disasterObjsFromPassingRows([keep, drop], { hours: 72, nowMs });
    expect(objs).toHaveLength(1);
    expect(objs[0].title).toBe('M5.2 quake');
  });

  test('statusMessage describes empty vs matching views', () => {
    expect(F.statusMessage(0, 0, 72)).toMatch(/Load events/);
    expect(F.statusMessage(0, 40, 48)).toMatch(/no High or Critical/);
    expect(F.statusMessage(3, 40, 72)).toBe('Major now: 3 High/Critical events from the last 3 days (40 loaded).');
    expect(F.statusMessage(1, 8, 48)).toBe('Major now: 1 High/Critical event from the last 2 days (8 loaded).');
  });

  test('normalizeHours only allows 2-day or 3-day windows', () => {
    expect(F.normalizeHours(48)).toBe(48);
    expect(F.normalizeHours(72)).toBe(72);
    expect(F.normalizeHours(24)).toBe(72);
    expect(F.normalizeHours('nope')).toBe(72);
  });
});
