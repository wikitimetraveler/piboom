/**
 * Development work by David Lane
 */
import {
  normalizeCountyName,
  filterLoansByDistance
} from '../../services/loan-pipeline.service.js';

describe('loan-pipeline.service geo filters', () => {
  test('normalizeCountyName strips (County) suffix', () => {
    expect(normalizeCountyName('Harris (County)')).toBe('Harris');
    expect(normalizeCountyName('  Los Angeles  ')).toBe('Los Angeles');
    expect(normalizeCountyName('')).toBe('');
  });

  test('filterLoansByDistance keeps loans within radius and drops missing coords', () => {
    const centerLat = 29.76;
    const centerLng = -95.37;
    const loans = [
      { id: 1, latitude: '29.80', longitude: '-95.40' },
      { id: 2, latitude: '30.50', longitude: '-95.50' },
      { id: 3, latitude: null, longitude: '-95.40' },
      { id: 4, latitude: '29.77', longitude: '-95.38' }
    ];

    const within25 = filterLoansByDistance(loans, centerLat, centerLng, 25);
    const ids = within25.map((l) => l.id);
    expect(ids).toContain(1);
    expect(ids).toContain(4);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(2);
  });

  test('filterLoansByDistance returns empty when all loans are far away', () => {
    const loans = [
      { id: 1, latitude: '40.0', longitude: '-74.0' }
    ];
    const result = filterLoansByDistance(loans, 29.76, -95.37, 10);
    expect(result).toHaveLength(0);
  });
});
