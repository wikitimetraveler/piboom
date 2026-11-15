/**
 * Development work by David Lane
 */
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filterPath = path.resolve(__dirname, '../../public/finance/js/disaster-firms-confidence-filter.js');

function loadModule() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(filterPath, 'utf8'), sandbox);
  return sandbox.DisasterFirmsConfidenceFilter;
}

describe('DisasterFirmsConfidenceFilter', () => {
  const F = loadModule();

  function firmsRow(confidence, extras = {}) {
    return {
      source: 'firms',
      event_type: 'wildfire',
      severity: `${confidence} (340K)`,
      raw: { firms_confidence: confidence, confidence },
      ...extras,
    };
  }

  test('defaults and mode labels', () => {
    expect(F.DEFAULT_MODE).toBe('high');
    expect(F.normalizeMode('NOMINAL')).toBe('nominal');
    expect(F.normalizeMode('weird')).toBe('high');
    expect(F.modeLabel('all')).toBe('All');
    expect(F.modeLabel('nominal')).toBe('Nominal+');
  });

  test('resolveConfidence reads raw.firms_confidence then severity', () => {
    expect(F.resolveConfidence(firmsRow('high'))).toBe('high');
    expect(F.resolveConfidence({
      source: 'firms',
      severity: 'nominal (330K) FRP 4MW',
      raw: {},
    })).toBe('nominal');
    expect(F.resolveConfidence({
      disasterObj: firmsRow('low'),
    })).toBe('low');
  });

  test('High mode keeps only high FIRMS; non-FIRMS always pass', () => {
    const usgs = { source: 'usgs', event_type: 'earthquake' };
    expect(F.rowPasses(usgs, { mode: 'high' })).toBe(true);
    expect(F.rowPasses(firmsRow('high'), { mode: 'high' })).toBe(true);
    expect(F.rowPasses(firmsRow('nominal'), { mode: 'high' })).toBe(false);
    expect(F.rowPasses(firmsRow('low'), { mode: 'high' })).toBe(false);
  });

  test('Nominal+ keeps high and nominal; All keeps everything', () => {
    expect(F.rowPasses(firmsRow('high'), { mode: 'nominal' })).toBe(true);
    expect(F.rowPasses(firmsRow('nominal'), { mode: 'nominal' })).toBe(true);
    expect(F.rowPasses(firmsRow('low'), { mode: 'nominal' })).toBe(false);
    expect(F.rowPasses(firmsRow('low'), { mode: 'all' })).toBe(true);
  });

  test('filterRows returns only matching FIRMS confidence', () => {
    const rows = [
      firmsRow('high'),
      firmsRow('nominal'),
      { source: 'fema', event_type: 'flood' },
    ];
    expect(F.filterRows(rows, { mode: 'high' })).toHaveLength(2);
    expect(F.filterRows(rows, { mode: 'nominal' })).toHaveLength(3);
    expect(F.filterRows(rows, { mode: 'all' })).toHaveLength(3);
  });

  test('unknown confidence fails High, passes Nominal+; letter/numeric codes normalize', () => {
    const unknown = { source: 'firms', severity: '', raw: {} };
    expect(F.rowPasses(unknown, { mode: 'high' })).toBe(false);
    expect(F.rowPasses(unknown, { mode: 'nominal' })).toBe(true);
    expect(F.normalizeConfidence('h')).toBe('high');
    expect(F.normalizeConfidence('n')).toBe('nominal');
    expect(F.normalizeConfidence('85')).toBe('high');
    expect(F.normalizeConfidence('55')).toBe('nominal');
  });
});
