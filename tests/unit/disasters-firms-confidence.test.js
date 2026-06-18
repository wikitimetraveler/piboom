import { normalizeFirmsConfidence } from '../../services/disasters.service.js';

describe('normalizeFirmsConfidence', () => {
  test('maps VIIRS single-letter codes', () => {
    expect(normalizeFirmsConfidence('n')).toBe('nominal');
    expect(normalizeFirmsConfidence('h')).toBe('high');
    expect(normalizeFirmsConfidence('l')).toBe('low');
    expect(normalizeFirmsConfidence('N')).toBe('nominal');
  });

  test('passes through full words', () => {
    expect(normalizeFirmsConfidence('nominal')).toBe('nominal');
    expect(normalizeFirmsConfidence('high')).toBe('high');
  });
});
