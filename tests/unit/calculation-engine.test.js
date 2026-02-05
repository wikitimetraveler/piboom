import '../../public/shared/calculationEngine.js';

const { createAssetQualifierConfig } = globalThis;

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
