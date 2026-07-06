import {
  normalizeFirmsConfidence,
  parseFirmsDetectionProps,
  passesFirmsConfidenceGate,
  passesFirmsThermalGate,
  isLikelyActualFirmsFire,
  getFirmsQualityThresholds,
} from '../../services/disasters.service.js';

describe('FIRMS quality gate (combined pull)', () => {
  const thresholds = getFirmsQualityThresholds();

  test('normalizeFirmsConfidence maps numeric and letter codes', () => {
    expect(normalizeFirmsConfidence('85')).toBe('high');
    expect(normalizeFirmsConfidence('55')).toBe('nominal');
    expect(normalizeFirmsConfidence('h')).toBe('high');
    expect(normalizeFirmsConfidence('n')).toBe('nominal');
  });

  test('passesFirmsThermalGate accepts brightness or FRP', () => {
    expect(passesFirmsThermalGate({ brightness: 340, frp: null }, thresholds)).toBe(true);
    expect(passesFirmsThermalGate({ brightness: 200, frp: 5 }, thresholds)).toBe(true);
    expect(passesFirmsThermalGate({ brightness: 200, frp: 1 }, thresholds)).toBe(false);
  });

  test('isLikelyActualFirmsFire requires cluster or strong solo signal', () => {
    const weakSolo = parseFirmsDetectionProps({ confidence: 'high', bright_ti4: 335, frp: 2 });
    expect(isLikelyActualFirmsFire(weakSolo, 1, thresholds)).toBe(false);

    const strongSolo = parseFirmsDetectionProps({ confidence: 'high', bright_ti4: 360, frp: 2 });
    expect(isLikelyActualFirmsFire(strongSolo, 1, thresholds)).toBe(true);

    const clustered = parseFirmsDetectionProps({ confidence: 'high', bright_ti4: 335, frp: 5 });
    expect(isLikelyActualFirmsFire(clustered, 2, thresholds)).toBe(true);
  });

  test('low confidence detections fail gate', () => {
    const low = parseFirmsDetectionProps({ confidence: 'low', bright_ti4: 400, frp: 10 });
    expect(passesFirmsConfidenceGate(low.confidence, thresholds)).toBe(false);
  });
});
