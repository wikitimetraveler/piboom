import {
  normalizeFirmsConfidence,
  parseFirmsDetectionProps,
  passesFirmsConfidenceGate,
  passesFirmsThermalGate,
  isLikelyActualFirmsFire,
  getFirmsQualityThresholds,
  clusterFirmsDetectionsByDistance,
  calculateDistance,
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

describe('calculateDistance coordinate guards', () => {
  test('allows 0° coordinates (equator / prime meridian)', () => {
    const d = calculateDistance(0, 0, 0, 1);
    expect(d).not.toBeNull();
    expect(d).toBeGreaterThan(100);
  });

  test('rejects non-finite coordinates', () => {
    expect(calculateDistance(null, -118, 34, -118)).toBeNull();
    expect(calculateDistance(34, NaN, 34, -118)).toBeNull();
  });
});

describe('clusterFirmsDetectionsByDistance (union-find)', () => {
  test('chains collinear points within radius into one component (order-independent)', () => {
    // Spacing 4 km < default 5 km radius; A—B—C should be one cluster
    const chain = [
      { lat: 34.0, lng: -118.0 },
      { lat: 34.0 + (4 / 111), lng: -118.0 },
      { lat: 34.0 + (8 / 111), lng: -118.0 },
    ];
    const forward = clusterFirmsDetectionsByDistance(chain, 5);
    const reverse = clusterFirmsDetectionsByDistance([...chain].reverse(), 5);

    expect(forward.componentCount).toBe(1);
    expect(reverse.componentCount).toBe(1);
    expect(forward.clusterSizeByIndex).toEqual([3, 3, 3]);
    expect(reverse.clusterSizeByIndex).toEqual([3, 3, 3]);
  });

  test('keeps far points in separate components', () => {
    const fires = [
      { lat: 34.0, lng: -118.0 },
      { lat: 35.0, lng: -118.0 },
    ];
    const { componentCount, clusterSizeByIndex } = clusterFirmsDetectionsByDistance(fires, 5);
    expect(componentCount).toBe(2);
    expect(clusterSizeByIndex).toEqual([1, 1]);
  });
});
