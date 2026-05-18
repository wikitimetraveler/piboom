import '../../public/shared/calculationEngine.js';

const { createAssetQualifierConfig } = globalThis;
const { CalculationsEngine } = globalThis;

describe('calculationEngine asset qualifier config', () => {
  test('builds expected asset qualifier groups', () => {
    const config = createAssetQualifierConfig({ prefix: 'aq' });
    expect(config.groups).toHaveLength(10);

    const groupByResult = Object.fromEntries(
      config.groups.map((group) => [group.resultId, group]),
    );

    expect(groupByResult.aq_cat1_eligible.calculation).toBe('multiplyRounded');
    expect(groupByResult.aq_cat2_eligible.calculation).toBe('multiplyRounded');
    expect(groupByResult.aq_ret_factor.calculation).toBe('ageBasedRetFactor');
    expect(groupByResult.aq_ret_eligible.calculation).toBe('multiplyRounded');
    expect(groupByResult.aq_total_eligible_assets.calculation).toBe('sumRounded');
    expect(groupByResult.aq_required_reserves.calculation).toBe('multiplyRounded');
    expect(groupByResult.aq_min_assets_result.calculation).toBe('minAssetsPass');
    expect(groupByResult.aq_net_eligible_assets.calculation).toBe('subtractRounded');
    expect(groupByResult.aq_supportable_payment.calculation).toBe('supportablePaymentRounded');
    expect(groupByResult.aq_messages.calculation).toBe('messagesC31C32');
  });

  test('respects custom IDs', () => {
    const config = createAssetQualifierConfig({
      prefix: 'custom',
      customIds: {
        liquidAssets: 'liquid_assets_custom',
        messages: 'messages_custom',
      },
    });

    const groupByResult = Object.fromEntries(
      config.groups.map((group) => [group.resultId, group]),
    );

    expect(groupByResult.custom_cat1_eligible.inputIds).toContain('liquid_assets_custom');
    expect(groupByResult.messages_custom.calculation).toBe('messagesC31C32');
  });
});

describe('CalculationsEngine DAG-lite propagation', () => {
  test('recomputes a shared downstream node when reached from sibling branches', () => {
    const originalDocument = globalThis.document;
    const fields = {
      x: { id: 'x', value: '1', addEventListener: () => {} },
      r1: { id: 'r1', value: '', addEventListener: () => {} },
      r2: { id: 'r2', value: '', addEventListener: () => {} },
      r3: { id: 'r3', value: '', addEventListener: () => {} },
      r4: { id: 'r4', value: '', addEventListener: () => {} },
    };

    globalThis.document = {
      getElementById(id) {
        return fields[id] || null;
      },
    };

    const math = {
      copyValue(values = []) {
        return Number(values[0] || 0);
      },
      sumRounded(values = []) {
        return values.reduce((sum, value) => sum + Number(value || 0), 0);
      },
    };

    const config = {
      groups: [
        { inputIds: ['x'], resultId: 'r1', calculation: 'copyValue' },
        { inputIds: ['r1'], resultId: 'r2', calculation: 'copyValue' },
        { inputIds: ['r1'], resultId: 'r3', calculation: 'copyValue' },
        { inputIds: ['r2', 'r3'], resultId: 'r4', calculation: 'sumRounded' },
      ],
    };

    try {
      const engine = new CalculationsEngine(config, {
        math,
        debounceMs: 0,
        listenToChange: false,
        enableDagLite: true,
      });

      engine.recalculateAll();
      expect(fields.r4.value).toBe('2');

      fields.x.value = '2';
      engine.updateResult('copyValue', 'r1');

      expect(fields.r4.value).toBe('4');
    } finally {
      globalThis.document = originalDocument;
    }
  });
});

describe('CalculationsEngine strict parsing and invalid boundary handling', () => {
  test('maps null helper outputs to empty string at result boundary', () => {
    const originalDocument = globalThis.document;
    const fields = {
      a: { id: 'a', value: '10', addEventListener: () => {} },
      out: { id: 'out', value: 'keep', addEventListener: () => {} },
    };

    globalThis.document = {
      getElementById(id) {
        return fields[id] || null;
      },
    };

    const math = {
      alwaysNull() {
        return null;
      },
    };

    const config = {
      groups: [{ inputIds: ['a'], resultId: 'out', calculation: 'alwaysNull' }],
    };

    try {
      const engine = new CalculationsEngine(config, {
        math,
        debounceMs: 0,
        listenToChange: false,
      });
      engine.recalculateAll();
      expect(fields.out.value).toBe('');
    } finally {
      globalThis.document = originalDocument;
    }
  });

  test('passes strictNumericParsing flag through ctx.meta', () => {
    const originalDocument = globalThis.document;
    const fields = {
      a: { id: 'a', value: '10', addEventListener: () => {} },
      out: { id: 'out', value: '', addEventListener: () => {} },
    };

    globalThis.document = {
      getElementById(id) {
        return fields[id] || null;
      },
    };

    const math = {
      strictFlagEcho(_values = [], ctx = {}) {
        return ctx?.meta?.strictNumericParsing ? 'strict' : 'compat';
      },
    };

    const config = {
      groups: [{ inputIds: ['a'], resultId: 'out', calculation: 'strictFlagEcho' }],
    };

    try {
      const compatEngine = new CalculationsEngine(config, {
        math,
        debounceMs: 0,
        listenToChange: false,
      });
      compatEngine.recalculateAll();
      expect(fields.out.value).toBe('compat');

      const strictEngine = new CalculationsEngine(config, {
        math,
        debounceMs: 0,
        listenToChange: false,
        strictNumericParsing: true,
      });
      strictEngine.recalculateAll();
      expect(fields.out.value).toBe('strict');
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
