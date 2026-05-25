/**
 * Development work by David Lane
 */
import {
  escapeXml,
  getLoanRiskStyleId,
  resolveDisasterCoords,
  buildRadiusRingCoords,
  buildAudioStreamUrl,
  generateCinematicDisasterKml,
  buildExportFilename,
  canExportCinematicKml,
} from '../../lib/disaster-kml-export.js';

describe('disaster-kml-export', () => {
  const sampleDisaster = {
    title: 'Wildfire DR-4721',
    source: 'firms',
    event_type: 'fire',
    state_abbr: 'CA',
    county_name: 'Los Angeles',
    lat: 34.05,
    lng: -118.25,
  };

  const sampleLoan = {
    loan_number: 'LN3000001',
    borrower_name: 'Test Borrower',
    property_address: '1250 N Spring St',
    city: 'Los Angeles',
    state: 'CA',
    county: 'Los Angeles',
    zip_code: '90012',
    latitude: 34.06,
    longitude: -118.24,
    loan_amount: 450000,
    milestone: 'Processing',
    disaster_risk_score: 4,
    last_risk_analysis: '2026-01-01T00:00:00.000Z',
  };

  const sampleCamera = {
    title: 'Griffith cam',
    source: 'alertcalifornia',
    lat: 34.12,
    lng: -118.3,
    county_name: 'Los Angeles',
    state_abbr: 'CA',
    distance_miles: 8.2,
    camera_url: 'https://example.com/cam',
    image_url: 'https://example.com/snap.jpg',
  };

  test('escapeXml encodes special characters', () => {
    expect(escapeXml('A & B <tag>')).toBe('A &amp; B &lt;tag&gt;');
  });

  test('getLoanRiskStyleId maps scores to styles', () => {
    expect(getLoanRiskStyleId({ disaster_risk_score: 1 })).toBe('lowRisk');
    expect(getLoanRiskStyleId({ disaster_risk_score: 4 })).toBe('mediumRisk');
    expect(getLoanRiskStyleId({ disaster_risk_score: 8 })).toBe('highRisk');
    expect(getLoanRiskStyleId({ disaster_risk_score: 0 })).toBe('notAnalyzed');
  });

  test('resolveDisasterCoords reads lat/lng aliases', () => {
    expect(resolveDisasterCoords({ latitude: 33.1, longitude: -117.2 })).toEqual({
      lat: 33.1,
      lng: -117.2,
    });
    expect(resolveDisasterCoords({ lat: 40, lng: -120 })).toEqual({ lat: 40, lng: -120 });
  });

  test('buildRadiusRingCoords returns closed ring coordinates', () => {
    const ring = buildRadiusRingCoords(34, -118, 10, 8);
    const parts = ring.split(' ');
    expect(parts.length).toBeGreaterThan(8);
    expect(parts[0]).toMatch(/^-?\d+\.\d+,-?\d+\.\d+,0$/);
  });

  test('buildAudioStreamUrl builds encoded stream path', () => {
    expect(buildAudioStreamUrl('http://localhost:3000', 'disasters/fire.mp3')).toBe(
      'http://localhost:3000/api/audio/stream/disasters%2Ffire.mp3'
    );
  });

  test('canExportCinematicKml requires disaster and data', () => {
    expect(canExportCinematicKml({ disaster: null, loans: [sampleLoan], cameras: [] })).toBe(false);
    expect(canExportCinematicKml({ disaster: sampleDisaster, loans: [], cameras: [] })).toBe(false);
    expect(canExportCinematicKml({
      disaster: sampleDisaster,
      loans: [sampleLoan],
      cameras: [],
    })).toBe(true);
    expect(canExportCinematicKml({
      disaster: sampleDisaster,
      loans: [],
      cameras: [sampleCamera],
    })).toBe(true);
  });

  test('generateCinematicDisasterKml includes folders, tour, and audio cue', () => {
    const kml = generateCinematicDisasterKml({
      disaster: sampleDisaster,
      loans: [sampleLoan],
      cameras: [sampleCamera],
      meta: { radiusMiles: 50, mode: 'distance' },
      baseUrl: 'http://localhost:3000',
    });

    expect(kml).toContain('xmlns:gx="http://www.google.com/kml/ext/2.2"');
    expect(kml).toContain('<Folder>');
    expect(kml).toContain('Selected disaster');
    expect(kml).toContain('Affected Encompass loans (1)');
    expect(kml).toContain('Nearby hazard webcams (1)');
    expect(kml).toContain('LN3000001');
    expect(kml).toContain('Griffith cam');
    expect(kml).toContain('Search radius (50 mi)');
    expect(kml).toContain('<gx:Tour');
    expect(kml).toContain('<gx:SoundCue>');
    expect(kml).toContain('disasters%2Ffire.mp3');
    expect(kml).toContain('<gx:FlyTo>');
  });

  test('generateCinematicDisasterKml omits audio when includeAudio is false', () => {
    const kml = generateCinematicDisasterKml({
      disaster: sampleDisaster,
      loans: [sampleLoan],
      cameras: [],
      baseUrl: 'http://localhost:3000',
      includeAudio: false,
    });
    expect(kml).not.toContain('<gx:SoundCue>');
  });

  test('buildExportFilename slugifies disaster title', () => {
    expect(buildExportFilename(sampleDisaster)).toMatch(/^wildfire-dr-4721-\d{4}-\d{2}-\d{2}-cinematic\.kml$/);
  });
});
