/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getLearnHints, saveLearnHints } = await import(
  '../../services/unit-tests-learn-hints.service.js'
);

describe('unit-tests-learn-hints.service', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('getLearnHints returns empty object when no row', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    await expect(getLearnHints('client-a')).resolves.toEqual({});
  });

  test('saveLearnHints upserts hints document', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const hints = { version: 1, hints: { 'CX.TYPE': { source: 'test' } } };
    const saved = await saveLearnHints('client-a', hints);
    expect(saved).toEqual(hints);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO unit_test_learn_hints'),
      ['client-a', JSON.stringify(hints)],
    );
  });
});
