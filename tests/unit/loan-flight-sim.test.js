/**
 * Loan file flight simulator: instrument config on CalculationsEngine + page wiring.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import '../../public/shared/calcEngineLibrary.js';
import '../../public/shared/calculationEngine.js';

const { CalculationsEngine, createLoanFlightSimConfig, calcMath } = globalThis;
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function makeFields(overrides = {}) {
  const values = {
    lfsPrice: '495000',
    lfsLoanAmount: '445500',
    lfsRate: '7.25',
    lfsTerm: '360',
    lfsEscrow: '976',
    lfsDebts: '2732',
    lfsIncome: '163000',
    lfsAssets: '34700',
    lfsLtv: '',
    lfsPi: '',
    lfsHousing: '',
    lfsTotalPayment: '',
    lfsMonthlyIncome: '',
    lfsFrontDti: '',
    lfsBackDti: '',
    lfsReserves: '',
    lfsRisk: '',
    ...overrides
  };
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, { id, value, addEventListener: () => {} }])
  );
}

function run(fields) {
  const originalDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => fields[id] || null };
  try {
    const engine = new CalculationsEngine(createLoanFlightSimConfig(), {
      math: calcMath,
      debounceMs: 0,
      listenToChange: false
    });
    engine.recalculateAll();
    return fields;
  } finally {
    globalThis.document = originalDocument;
  }
}

describe('createLoanFlightSimConfig', () => {
  test('every calculation exists on calcMath', () => {
    for (const group of createLoanFlightSimConfig().groups) {
      expect(typeof calcMath[group.calculation]).toBe('function');
    }
  });

  test('groups are ordered so each input is a base field or an earlier result', () => {
    const base = new Set(['lfsPrice', 'lfsLoanAmount', 'lfsRate', 'lfsTerm', 'lfsEscrow', 'lfsDebts', 'lfsIncome', 'lfsAssets']);
    for (const group of createLoanFlightSimConfig().groups) {
      for (const id of group.inputIds) expect(base.has(id)).toBe(true);
      base.add(group.resultId);
    }
  });

  test('instruments cascade from the loan file', () => {
    const f = run(makeFields());
    expect(f.lfsLtv.value).toBe('90');
    expect(f.lfsPi.value).toBe('3039.1');
    expect(f.lfsHousing.value).toBe('4015.1');
    expect(f.lfsFrontDti.value).toBe('29.56');
    expect(f.lfsBackDti.value).toBe('49.67');
    expect(f.lfsReserves.value).toBe('8.64');
    expect(f.lfsRisk.value).toBe('medium');
  });

  test('a co-borrower fix drops DTI under the 45% ceiling', () => {
    const f = run(makeFields({ lfsIncome: String(163000 + 57000) }));
    expect(Number(f.lfsBackDti.value)).toBeLessThanOrEqual(45);
    expect(f.lfsRisk.value).toBe('low');
  });

  test('a 15-year term raises the payment and DTI', () => {
    const f = run(makeFields({ lfsTerm: '180' }));
    expect(Number(f.lfsBackDti.value)).toBeGreaterThan(49.67);
  });
});

describe('loan flight sim page', () => {
  const html = read('public/finance/loan-flight-sim.html');
  const js = read('public/finance/js/loan-flight-sim.js');

  test('loads the shared calculation engine before the sim', () => {
    const lib = html.indexOf('/shared/calcEngineLibrary.js');
    const engine = html.indexOf('/shared/calculationEngine.js');
    const sim = html.indexOf('/finance/js/loan-flight-sim.js');
    expect(lib).toBeGreaterThan(-1);
    expect(engine).toBeGreaterThan(lib);
    expect(sim).toBeGreaterThan(engine);
  });

  test('has an instrument element for every engine field', () => {
    for (const group of createLoanFlightSimConfig().groups) {
      for (const id of [...group.inputIds, group.resultId]) {
        expect(html).toContain(`id="${id}"`);
      }
    }
  });

  test('labels the loan as synthetic and sends no PII to the GSE check', () => {
    expect(html).toContain('Synthetic loan');
    expect(js).toContain('createLoanFlightSimConfig');
    expect(js).toContain('/api/gse/analyze-scenario');
    expect(js).toMatch(/addBusinessDays\(\[l\.appDate, 3, false\]\)/);
    expect(js).toMatch(/addBusinessDays\(\[l\.closingDate, -3, true\]\)/);
    expect(js).not.toMatch(/\b(ssn|taxId|email|phone|fullName)\s*:/);
  });

  test('is linked from the Worksheets menu', () => {
    expect(read('public/shared/menu-config.js')).toContain('/finance/loan-flight-sim.html');
  });
});
