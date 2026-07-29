import {
  normalizeFirmsConfidence,
  parseFirmsDetectionProps,
  passesFirmsConfidenceGate,
  passesFirmsThermalGate,
  isLikelyActualFirmsFire,
  getFirmsQualityThresholds,
  clusterFirmsDetectionsByDistance,
  aggregateFirmsClusterEvents,
  calculateDistance,
  hasFiniteCoords,
  shouldIncludeDisasterRecord,
  getUsgsQualityThresholds,
  passesUsgsQuakeGate,
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

describe('hasFiniteCoords / shouldIncludeDisasterRecord (allow 0°)', () => {
  test('allows 0° coordinates (equator / prime meridian)', () => {
    expect(hasFiniteCoords(0, 0)).toBe(true);
    expect(hasFiniteCoords('0', '-0')).toBe(true);
    expect(hasFiniteCoords(0, -118)).toBe(true);
  });

  test('rejects missing / non-finite coordinates', () => {
    expect(hasFiniteCoords(null, -118)).toBe(false);
    expect(hasFiniteCoords(34, undefined)).toBe(false);
    expect(hasFiniteCoords('', -118)).toBe(false);
    expect(hasFiniteCoords(NaN, -118)).toBe(false);
  });

  test('(a) lat/lng 0 still included when other gates pass', () => {
    expect(shouldIncludeDisasterRecord({ county_fips: null, lat: 0, lng: 0 })).toBe(true);
    expect(shouldIncludeDisasterRecord({ county_fips: '00000', lat: 0, lng: -118 })).toBe(true);
    // Falsy-check regression: 0 must not be treated as missing
    expect(Boolean(0 && 0)).toBe(false);
    expect(shouldIncludeDisasterRecord({ lat: 0, lng: 0 })).toBe(true);
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
    expect(forward.rootByIndex.every((r) => r === forward.rootByIndex[0])).toBe(true);
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

describe('aggregateFirmsClusterEvents', () => {
  const thresholds = getFirmsQualityThresholds();

  function makeFire(lat, lng, overrides = {}) {
    const detection = parseFirmsDetectionProps({
      confidence: 'high',
      bright_ti4: 335,
      frp: 5,
      ...overrides.props,
    });
    return {
      lat,
      lng,
      detection,
      start: overrides.start || '2026-07-28T12:00:00.000Z',
      props: { id: overrides.id || `${lat},${lng}`, ...(overrides.props || {}) },
      coords: [lng, lat],
    };
  }

  test('(b) 5-pixel cluster → 1 upsert payload', () => {
    // Five detections within cluster radius → one component → one aggregate event
    const fires = [
      makeFire(34.0, -118.0, { id: 'a' }),
      makeFire(34.0 + (1 / 111), -118.0, { id: 'b' }),
      makeFire(34.0 + (2 / 111), -118.0, { id: 'c' }),
      makeFire(34.0 + (3 / 111), -118.0, { id: 'd' }),
      makeFire(34.0 + (4 / 111), -118.0, { id: 'e', props: { bright_ti4: 360, frp: 12 } }),
    ];
    const clusterResult = clusterFirmsDetectionsByDistance(fires, thresholds.clusterRadiusKm);
    expect(clusterResult.componentCount).toBe(1);

    const events = aggregateFirmsClusterEvents(fires, clusterResult, thresholds);
    expect(events).toHaveLength(1);
    expect(events[0].memberCount).toBe(5);
    expect(events[0].detection.frp).toBe(12);
    expect(events[0].detection.brightness).toBe(360);
    expect(String(events[0].props.id)).toMatch(/^firms-cluster:/);
    expect(shouldIncludeDisasterRecord({
      county_fips: '00000',
      lat: events[0].lat,
      lng: events[0].lng,
    })).toBe(true);
  });

  test('weak solo detections do not emit an event', () => {
    const fires = [makeFire(34.0, -118.0, { props: { bright_ti4: 335, frp: 2 } })];
    // bright 335 >= minBrightness 330 and frp 2 < minFrp 4 → thermal passes via brightness
    // but cluster size 1 and not strongSolo (need 350K or FRP 8) → not likely
    const detection = parseFirmsDetectionProps({ confidence: 'high', bright_ti4: 335, frp: 2 });
    expect(passesFirmsThermalGate(detection, thresholds)).toBe(true);
    expect(isLikelyActualFirmsFire(detection, 1, thresholds)).toBe(false);

    const clusterResult = clusterFirmsDetectionsByDistance(fires, thresholds.clusterRadiusKm);
    const events = aggregateFirmsClusterEvents(fires, clusterResult, thresholds);
    expect(events).toHaveLength(0);
  });
});

describe('USGS quake gate', () => {
  test('(c) USGS M1.2 dropped, M3.1 kept', () => {
    const thresholds = { minMag: 2.5, minSig: null };
    expect(passesUsgsQuakeGate({ mag: 1.2 }, thresholds)).toBe(false);
    expect(passesUsgsQuakeGate({ mag: 3.1 }, thresholds)).toBe(true);
    expect(passesUsgsQuakeGate({ mag: 2.5 }, thresholds)).toBe(true);
  });

  test('optional significance keeps low-mag high-sig quakes', () => {
    const thresholds = { minMag: 2.5, minSig: 100 };
    expect(passesUsgsQuakeGate({ mag: 1.8, sig: 150 }, thresholds)).toBe(true);
    expect(passesUsgsQuakeGate({ mag: 1.8, sig: 50 }, thresholds)).toBe(false);
  });

  test('getUsgsQualityThresholds defaults minMag to 2.5', () => {
    const prevMag = process.env.USGS_MIN_MAG;
    const prevSig = process.env.USGS_MIN_SIG;
    delete process.env.USGS_MIN_MAG;
    delete process.env.USGS_MIN_SIG;
    try {
      const t = getUsgsQualityThresholds();
      expect(t.minMag).toBe(2.5);
      expect(t.minSig).toBeNull();
    } finally {
      if (prevMag !== undefined) process.env.USGS_MIN_MAG = prevMag;
      else delete process.env.USGS_MIN_MAG;
      if (prevSig !== undefined) process.env.USGS_MIN_SIG = prevSig;
      else delete process.env.USGS_MIN_SIG;
    }
  });
});
