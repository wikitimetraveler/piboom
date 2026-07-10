/**
 * @jest-environment node
 */
import {
  getFinanceHeygenDemoShort,
  listFinanceHeygenDemoKeys,
  CALC_ENGINE_DEMO_SHORT_SCRIPT,
  UNIT_TESTS_DEMO_SHORT_SCRIPT,
  SVEN_UX_DEMO_SHORT_SCRIPT
} from '../../services/finance-heygen.service.js';

describe('finance-heygen.service', () => {
  test('listFinanceHeygenDemoKeys returns booth demos', () => {
    expect(listFinanceHeygenDemoKeys()).toEqual(['calc-engine', 'unit-tests', 'sven-ux']);
  });

  test('getFinanceHeygenDemoShort returns title, script, aspect ratio', () => {
    const calc = getFinanceHeygenDemoShort('calc-engine');
    expect(calc.title).toMatch(/Calculations Engine/i);
    expect(calc.script).toBe(CALC_ENGINE_DEMO_SHORT_SCRIPT);
    expect(calc.aspectRatio).toBe('16:9');

    const unit = getFinanceHeygenDemoShort('unit-tests');
    expect(unit.script).toBe(UNIT_TESTS_DEMO_SHORT_SCRIPT);
    expect(unit.script).toMatch(/Unit Test tool/i);

    const sven = getFinanceHeygenDemoShort('sven-ux');
    expect(sven.script).toBe(SVEN_UX_DEMO_SHORT_SCRIPT);
    expect(sven.script).toMatch(/mr-2/);
  });

  test('getFinanceHeygenDemoShort rejects unknown key', () => {
    expect(() => getFinanceHeygenDemoShort('unknown')).toThrow(/Unknown finance HeyGen demo/);
  });
});
