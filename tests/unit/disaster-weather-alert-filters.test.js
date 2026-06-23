/**
 * Development work by David Lane
 */
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dlfPath = path.resolve(__dirname, '../../public/finance/js/disaster-loan-filters.js');
const dwafPath = path.resolve(__dirname, '../../public/finance/js/disaster-weather-alert-filters.js');

function loadModules() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(dlfPath, 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(dwafPath, 'utf8'), sandbox);
  return {
    DLF: sandbox.DisasterLoanFilters,
    DWAF: sandbox.DisasterWeatherAlertFilters
  };
}

describe('DisasterWeatherAlertFilters', () => {
  const { DWAF } = loadModules();

  const nwsRow = {
    source: 'nws',
    source_id: 'alert-1',
    start_time: '2026-06-20T12:00:00.000Z',
    state_abbr: 'CA',
    county_name: 'Sonoma',
    title: 'Flash Flood Warning',
    event_type: 'flood',
    severity: 'Extreme'
  };

  const femaRow = {
    source: 'fema',
    state_abbr: 'CA',
    county_name: 'Sonoma',
    title: 'DR-1234'
  };

  test('isNwsAlert recognizes nws and noaa sources', () => {
    expect(DWAF.isNwsAlert(nwsRow)).toBe(true);
    expect(DWAF.isNwsAlert({ source: 'noaa' })).toBe(true);
    expect(DWAF.isNwsAlert(femaRow)).toBe(false);
  });

  test('fetchWeatherAlertsFromLocalRows filters by state and county', () => {
    const other = { ...nwsRow, source_id: 'alert-2', county_name: 'Napa' };
    const { alerts, meta } = DWAF.fetchWeatherAlertsFromLocalRows(
      [nwsRow, other, femaRow],
      { state: 'CA', county: 'Sonoma', excludeKey: '' }
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].source_id).toBe('alert-1');
    expect(meta.mode).toBe('county');
  });

  test('rowPassesNwsGridFilter requires nws source and admin match', () => {
    const gridRow = {
      source: 'nws',
      state: 'CA',
      county: 'Sonoma County',
      disasterObj: nwsRow
    };
    expect(DWAF.rowPassesNwsGridFilter(gridRow, { state: 'CA', county: 'Sonoma' })).toBe(true);
    expect(DWAF.rowPassesNwsGridFilter(gridRow, { state: 'TX', county: 'Sonoma' })).toBe(false);
    expect(DWAF.rowPassesNwsGridFilter({ source: 'fema', state: 'CA', county: 'Sonoma' }, { state: 'CA' })).toBe(false);
  });

  test('excludeAlertByKey removes selected alert', () => {
    const key = DWAF.alertMatchKey(nwsRow);
    const { alerts } = DWAF.fetchWeatherAlertsFromLocalRows(
      [nwsRow, { ...nwsRow, source_id: 'alert-2', county_name: 'Sonoma' }],
      { state: 'CA', county: 'Sonoma', excludeKey: key }
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].source_id).toBe('alert-2');
  });
});
