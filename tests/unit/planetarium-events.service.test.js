/**
 * Development work by David Lane
 */
import {
  filterSkyEvents,
  upcomingMeteorPeaks,
  searchCatalogIndex,
} from '../../services/planetarium-events.service.js';

describe('planetarium-events.service', () => {
  test('filterSkyEvents returns upcoming items from anchor date', () => {
    const events = filterSkyEvents({ from: '2026-09-01', to: '2027-01-01', limit: 5 });
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.title.includes('Saturn'))).toBe(true);
  });

  test('upcomingMeteorPeaks includes Orionids after September', () => {
    const peaks = upcomingMeteorPeaks(new Date('2026-09-01T12:00:00Z'), 120);
    expect(peaks.some((p) => p.id === 'orionids')).toBe(true);
  });

  test('searchCatalogIndex finds Messier and star IDs', () => {
    expect(searchCatalogIndex('m31')[0].name).toMatch(/Andromeda/i);
    expect(searchCatalogIndex('vega')[0].name).toBe('Vega');
    expect(searchCatalogIndex('hip27989')[0].name).toBe('Betelgeuse');
  });
});
