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

describe('Unified Disasters Reload Grid (clearDisastersGridFiltersAndData + applyFiltersNow)', () => {
  const corePath = path.resolve(__dirname, '../../public/finance/js/disasters-unified/core.js');
  const ingestPath = path.resolve(__dirname, '../../public/finance/js/disasters-unified/ingest.js');
  const gridPath = path.resolve(__dirname, '../../public/finance/js/disasters-unified/grid.js');

  test('applyFiltersNow wipes all form filters, grid column/quick filters, current rows, and reloads fresh USA scope', () => {
    const jqValues = {
      '#stateInput': 'CA',
      '#countyInput': 'Los Angeles',
      '#disastersQuickFilter': 'wildfire',
      '#sourceInput': ['fema'],
      '#eventInput': ['wildfire'],
    };
    let sourceOptionsSelected = false;
    let eventOptionsSelected = true;

    const $ = (sel) => ({
      val(v) {
        if (arguments.length === 0) return jqValues[sel] ?? '';
        jqValues[sel] = v;
        if (sel === '#sourceInput option' && v) sourceOptionsSelected = true;
        return this;
      },
      prop(name, val) {
        if (sel === '#sourceInput option' && name === 'selected') {
          sourceOptionsSelected = val;
          if (val) jqValues['#sourceInput'] = ['fema', 'firms', 'usgs', 'nws', 'nhc', 'floodzones'];
        }
        if (sel === '#eventInput option' && name === 'selected') {
          eventOptionsSelected = val;
        }
        return this;
      },
      toggleClass() { return this; },
      length: 1,
    });

    const elements = {
      duHotspotSearchInput: { value: 'palisades' },
      duShowNwsInGrid: { checked: true },
      duMajorNow3d: { checked: false },
      duTimeAll: { checked: false },
      duFirmsConfHigh: { checked: false },
      duGeoActiveCrumb: { textContent: 'Los Angeles, CA', hidden: true },
      duHotspotFilterBadge: {
        hidden: false,
        textContent: 'Los Angeles, CA',
        removeAttribute() {},
        setAttribute() {},
      },
      duNwsGridFilterStrip: { hidden: false },
      duMajorNowFilterStrip: { hidden: false },
    };

    const gridCalls = {
      filterModel: { state: { filter: 'CA' } },
      quickFilterText: 'wildfire',
      rowData: [{ title: 'Old row' }],
      deselected: false,
      filterChanged: false,
    };

    const mockGridApi = {
      setFilterModel(m) { gridCalls.filterModel = m; },
      setGridOption(k, v) {
        if (k === 'filterModel') gridCalls.filterModel = v;
        if (k === 'quickFilterText') gridCalls.quickFilterText = v;
        if (k === 'rowData') gridCalls.rowData = v;
      },
      deselectAll() { gridCalls.deselected = true; },
      onFilterChanged() { gridCalls.filterChanged = true; },
      sizeColumnsToFit() {},
    };

    const sandbox = {
      window: {
        location: { href: 'http://localhost:3000/finance/disasters-unified.html?state=CA&county=Los+Angeles' },
        history: { replaceState() {} },
        requestAnimationFrame: (fn) => fn(),
        setTimeout: () => 1,
        clearTimeout: () => {},
        cameraDataStore: {},
      },
      document: {
        getElementById: (id) => elements[id] || null,
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      $,
      URL,
      URLSearchParams,
      console,
      setTimeout: () => 1,
      clearTimeout: () => {},
    };
    sandbox.globalThis = sandbox;
    sandbox.window.document = sandbox.document;

    vm.runInNewContext(fs.readFileSync(corePath, 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(ingestPath, 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(gridPath, 'utf8'), sandbox);

    sandbox.disastersGridApi = mockGridApi;
    sandbox.activeHotspotKey = 'Los Angeles|CA';
    sandbox.activeHotspot = { county: 'Los Angeles', state: 'CA' };
    sandbox.nwsGridFilterActive = true;
    sandbox.nwsGridFilterContext = { state: 'CA' };
    sandbox.majorNowFilterActive = true;
    sandbox.timeRangeFilterHours = 24;
    sandbox.firmsConfidenceFilter = 'all';
    sandbox.selectedDisasterObj = { id: 1, title: 'Palisades Fire' };
    sandbox.lastGridRows = [{ id: 1 }];
    sandbox.lastLoadedDisasterRows = [{ id: 1 }];
    sandbox.duStateDisasterRows = [{ id: 1 }];
    sandbox.duSelectedGeoState = 'CA';
    sandbox.duSelectedGeoCounty = 'Los Angeles';
    sandbox.duGeoLoadScope = 'county';

    let loadDisastersCalled = false;
    sandbox.loadDisasters = () => {
      loadDisastersCalled = true;
    };

    sandbox.applyFiltersNow();

    expect(jqValues['#stateInput']).toBe('');
    expect(jqValues['#countyInput']).toBe('');
    expect(jqValues['#disastersQuickFilter']).toBe('');
    expect(sourceOptionsSelected).toBe(true);
    expect(eventOptionsSelected).toBe(false);
    expect(jqValues['#eventInput']).toEqual([]);

    expect(gridCalls.filterModel).toBeNull();
    expect(gridCalls.quickFilterText).toBe('');
    expect(gridCalls.rowData).toEqual([]);
    expect(gridCalls.deselected).toBe(true);
    expect(gridCalls.filterChanged).toBe(true);

    expect(sandbox.activeHotspotKey).toBeNull();
    expect(sandbox.activeHotspot).toBeNull();
    expect(sandbox.nwsGridFilterActive).toBe(false);
    expect(sandbox.nwsGridFilterContext).toBeNull();
    expect(sandbox.majorNowFilterActive).toBe(false);
    expect(sandbox.timeRangeFilterHours).toBeNull();
    expect(sandbox.firmsConfidenceFilter).toBe('high');
    expect(sandbox.selectedDisasterObj).toBeNull();
    expect(sandbox.lastGridRows).toEqual([]);
    expect(sandbox.lastLoadedDisasterRows).toEqual([]);
    expect(sandbox.duStateDisasterRows).toEqual([]);
    expect(sandbox.duGeoLoadScope).toBe('usa');
    expect(sandbox.duSelectedGeoState).toBeNull();
    expect(sandbox.duSelectedGeoCounty).toBeNull();
    expect(elements.duHotspotSearchInput.value).toBe('');
    expect(elements.duShowNwsInGrid.checked).toBe(false);
    expect(elements.duGeoActiveCrumb.textContent).toBe('United States');
    expect(loadDisastersCalled).toBe(true);
  });
});

