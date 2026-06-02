/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getFieldCoverageImpact, getCoverageGaps } = await import(
  '../../services/unit-tests-file.service.js'
);

describe('unit-tests-file coverage', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('getFieldCoverageImpact aggregates coFields from matching files', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 1,
          original_name: 'test-a.xlsx',
          field_ids: ['CX.TYPE', '353'],
          row_count: 10,
        },
        {
          id: 2,
          original_name: 'test-b.xlsx',
          field_ids: ['CX.TYPE', 'CX.SUNRISE'],
          row_count: 5,
        },
      ],
    });

    const impact = await getFieldCoverageImpact('CX.TYPE');
    expect(impact.files).toHaveLength(2);
    expect(impact.coFields).toEqual(expect.arrayContaining(['353', 'CX.SUNRISE']));
    expect(impact.coFields).not.toContain('CX.TYPE');
  });

  test('getCoverageGaps returns missing manifest field IDs', async () => {
    queryMock.mockResolvedValue({
      rows: [{ fid: '353' }, { fid: 'CX.TYPE' }],
    });

    const gaps = await getCoverageGaps(['353', 'CX.TYPE', 'CX.MISSING']);
    expect(gaps.covered).toEqual(['353', 'CX.TYPE']);
    expect(gaps.missing).toEqual(['CX.MISSING']);
  });
});
