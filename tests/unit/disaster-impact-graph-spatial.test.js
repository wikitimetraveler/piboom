/**
 * Development work by David Lane
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const poolQuery = jest.fn();
const isPostgisAvailable = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: poolQuery }),
  isPostgisAvailable
}));

await jest.unstable_mockModule('../../services/disasters.service.js', () => ({
  DISASTER_ROLLING_WINDOW_DAYS: 90
}));

await jest.unstable_mockModule('../../services/disaster-spatial.service.js', () => ({
  milesToMeters: (m) => m * 1609.34
}));

const { seedNearSpatialEdges } = await import('../../services/disaster-impact-graph.service.js');

describe('seedNearSpatialEdges', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    isPostgisAvailable.mockReset();
  });

  test('skips without error when PostGIS unavailable', async () => {
    isPostgisAvailable.mockResolvedValue(false);

    const result = await seedNearSpatialEdges({
      disasterNodeByKey: new Map([['d1', 1]]),
      loanNodeByLoanNumber: new Map([['LN1', 2]])
    });

    expect(result).toEqual({
      skipped: true,
      reason: 'postgis unavailable',
      edges: 0
    });
    expect(poolQuery).not.toHaveBeenCalled();
  });

  test('queries spatial join when PostGIS available', async () => {
    isPostgisAvailable.mockResolvedValue(true);
    poolQuery.mockResolvedValue({ rows: [] });

    await seedNearSpatialEdges({
      disasterNodeByKey: new Map(),
      loanNodeByLoanNumber: new Map(),
      radiusMiles: 25
    });

    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('ST_DWithin'),
      [1609.34 * 25, 25, 2000]
    );
    expect(poolQuery.mock.calls[0][0]).toContain('PARTITION BY d.id');
    expect(poolQuery.mock.calls[0][0]).toContain('ROW_NUMBER()');
  });
});
