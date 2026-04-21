import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('processor-assignment-config.service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('normalizeProcessorAssignmentEnv defaults unknown to correspondent', async () => {
    const { normalizeProcessorAssignmentEnv } = await import(
      '../../services/processor-assignment-config.service.js'
    );
    expect(normalizeProcessorAssignmentEnv('retail')).toBe('retail');
    expect(normalizeProcessorAssignmentEnv('correspondent')).toBe('correspondent');
    expect(normalizeProcessorAssignmentEnv('')).toBe('correspondent');
    expect(normalizeProcessorAssignmentEnv('bogus')).toBe('correspondent');
  });

  it('pickAllowedConfigPayload keeps only known keys', async () => {
    const { pickAllowedConfigPayload } = await import(
      '../../services/processor-assignment-config.service.js'
    );
    expect(
      pickAllowedConfigPayload({
        processorsJson: '[]',
        rulesJson: '{}',
        allowIneligibleOverride: 'true',
        evil: 'x',
      }),
    ).toEqual({ processorsJson: '[]', rulesJson: '{}', allowIneligibleOverride: 'true' });
  });

  it('getProcessorAssignmentToolConfig returns null when no row', async () => {
    await jest.unstable_mockModule('../../services/database.service.js', () => ({
      getPool: () => ({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      }),
    }));
    const { getProcessorAssignmentToolConfig } = await import(
      '../../services/processor-assignment-config.service.js'
    );
    const r = await getProcessorAssignmentToolConfig('correspondent');
    expect(r.config).toBeNull();
    expect(r.updatedAt).toBeNull();
  });

  it('saveProcessorAssignmentToolConfig rejects invalid processorsJson', async () => {
    await jest.unstable_mockModule('../../services/database.service.js', () => ({
      getPool: () => ({
        query: jest.fn().mockResolvedValue({ rows: [] }),
      }),
    }));
    const { saveProcessorAssignmentToolConfig } = await import(
      '../../services/processor-assignment-config.service.js'
    );
    await expect(
      saveProcessorAssignmentToolConfig('correspondent', { processorsJson: 'not json' }),
    ).rejects.toThrow(/valid JSON/);
  });

  it('saveProcessorAssignmentToolConfig upserts merged payload', async () => {
    let n = 0;
    const query = jest.fn().mockImplementation(() => {
      n += 1;
      if (n === 1) {
        return Promise.resolve({ rows: [{ payload: { rulesJson: '[]' } }] });
      }
      return Promise.resolve({
        rows: [
          {
            payload: { rulesJson: '[]', processorsJson: '[{"userId":"a","maxPoints":1}]' },
            updated_at: new Date('2020-01-01'),
          },
        ],
      });
    });
    await jest.unstable_mockModule('../../services/database.service.js', () => ({
      getPool: () => ({ query }),
    }));
    const { saveProcessorAssignmentToolConfig } = await import(
      '../../services/processor-assignment-config.service.js'
    );
    const r = await saveProcessorAssignmentToolConfig('correspondent', {
      processorsJson: '[{"userId":"a","maxPoints":1}]',
    });
    expect(r.config.processorsJson).toBe('[{"userId":"a","maxPoints":1}]');
    expect(r.updatedAt).toMatch(/2020/);
  });
});
