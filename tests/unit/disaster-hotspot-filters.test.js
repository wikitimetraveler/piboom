/**
 * Development work by David Lane
 */
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filterPath = path.resolve(__dirname, '../../public/finance/js/disaster-hotspot-filters.js');

function loadModule() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(filterPath, 'utf8'), sandbox);
  return sandbox.DisasterHotspotFilters;
}

describe('DisasterHotspotFilters', () => {
  const F = loadModule();

  function hotspot(overrides = {}) {
    return {
      county: 'Hillsborough',
      state: 'FL',
      peakRisk: 8,
      femaCount: 0,
      sources: ['nws'],
      dominantType: 'severe',
      lenderGuidance: {
        filterCategory: 'advisory',
        collateralNeed: 'Standard appraisal',
        insuranceNeed: 'Hazard binder',
        closingGate: 'Normal closing',
      },
      ...overrides,
    };
  }

  test('exports High floor matching Critical & High (6+) toolbar', () => {
    expect(F.HIGH_INTENSITY_MIN).toBe(6);
    expect(F.CATEGORIES.CRITICAL_HIGH).toBe('critical_high');
    expect(F.CATEGORIES.FEMA).toBe('fema');
    expect(F.CATEGORIES.HOLD).toBe('hold');
  });

  test('all keeps every hotspot', () => {
    const rows = [hotspot({ peakRisk: 2 }), hotspot({ peakRisk: 11, femaCount: 1, sources: ['fema'] })];
    expect(F.filterHotspots(rows, { category: 'all' })).toHaveLength(2);
  });

  test('critical_high keeps High and Critical intensity only', () => {
    const rows = [
      hotspot({ county: 'Low', peakRisk: 5.9 }),
      hotspot({ county: 'High', peakRisk: 6 }),
      hotspot({ county: 'Critical', peakRisk: 10 }),
    ];
    const out = F.filterHotspots(rows, { category: 'critical_high' });
    expect(out.map((h) => h.county)).toEqual(['High', 'Critical']);
  });

  test('fema keeps FEMA declared counties by count or source', () => {
    const rows = [
      hotspot({ county: 'None', femaCount: 0, sources: ['usgs'] }),
      hotspot({ county: 'ByCount', femaCount: 2, sources: ['firms'] }),
      hotspot({ county: 'BySource', femaCount: 0, sources: ['fema', 'nws'] }),
    ];
    const out = F.filterHotspots(rows, { category: 'fema' });
    expect(out.map((h) => h.county)).toEqual(['ByCount', 'BySource']);
  });

  test('hold keeps Closing Hold / Re-Inspect guidance categories', () => {
    const rows = [
      hotspot({
        county: 'Advisory',
        lenderGuidance: { filterCategory: 'advisory' },
      }),
      hotspot({
        county: 'FemaHold',
        lenderGuidance: { filterCategory: 'fema_hold' },
      }),
      hotspot({
        county: 'Perimeter',
        lenderGuidance: { filterCategory: 'perimeter_watch' },
      }),
      hotspot({
        county: 'Insurance',
        lenderGuidance: { filterCategory: 'insurance_verify' },
      }),
    ];
    const out = F.filterHotspots(rows, { category: 'hold' });
    expect(out.map((h) => h.county)).toEqual(['FemaHold', 'Perimeter']);
  });

  test('search narrows across county, hazard, and lender guidance text', () => {
    const rows = [
      hotspot({ county: 'Los Angeles', dominantType: 'wildfire' }),
      hotspot({
        county: 'Harris',
        state: 'TX',
        lenderGuidance: {
          filterCategory: 'fema_hold',
          collateralNeed: 'Post-Disaster Inspection',
          insuranceNeed: 'HOI',
          closingGate: 'Hold CTC',
        },
      }),
    ];
    expect(F.filterHotspots(rows, { category: 'all', query: 'angeles' })).toHaveLength(1);
    expect(F.filterHotspots(rows, { category: 'all', query: 'hold ctc' })[0].county).toBe('Harris');
  });

  test('normalizeCategory falls back to all for unknown values', () => {
    expect(F.normalizeCategory('')).toBe('all');
    expect(F.normalizeCategory('nope')).toBe('all');
    expect(F.normalizeCategory('FEMA')).toBe('fema');
  });
});
