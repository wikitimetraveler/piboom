/**
 * Development work by David Lane
 */
import {
  ENDPOINTS,
  parseLatitude,
  parseLongitude,
  parseZipCode,
  summarizeObservations,
  getAirNowStatus,
} from '../../services/airnow.service.js';

describe('airnow.service', () => {
  test('ENDPOINTS match AirNow lat/long and zip paths', () => {
    expect(ENDPOINTS.forecastLatLong).toBe('aq/forecast/latLong/');
    expect(ENDPOINTS.observationLatLongCurrent).toBe('aq/observation/latLong/current/');
    expect(ENDPOINTS.observationZipCurrent).toBe('aq/observation/zipCode/current/');
    expect(ENDPOINTS.observationLatLongHistorical).toBe('aq/observation/latLong/historical/');
    expect(ENDPOINTS.observationZipHistorical).toBe('aq/observation/zipCode/historical/');
  });

  test('parseLatitude and parseLongitude validate ranges', () => {
    expect(parseLatitude(42.898)).toBeCloseTo(42.898, 3);
    expect(parseLongitude(-70.864)).toBeCloseTo(-70.864, 3);
    expect(() => parseLatitude(100)).toThrow(/latitude/i);
    expect(() => parseLongitude(-200)).toThrow(/longitude/i);
  });

  test('parseZipCode accepts 5-digit zip', () => {
    expect(parseZipCode('03844')).toBe('03844');
    expect(parseZipCode('90210-1234')).toBe('90210');
    expect(() => parseZipCode('abc')).toThrow(/zip/i);
  });

  test('summarizeObservations picks highest AQI pollutant', () => {
    const summary = summarizeObservations([
      { ParameterName: 'PM2.5', AQI: 42, Category: { Name: 'Good' }, ReportingArea: 'Portsmouth' },
      { ParameterName: 'O3', AQI: 88, Category: { Name: 'Moderate' }, ReportingArea: 'Portsmouth' },
    ]);
    expect(summary.aqi).toBe(88);
    expect(summary.category).toBe('Moderate');
    expect(summary.parameter).toBe('O3');
    expect(summary.pollutants).toHaveLength(2);
  });

  test('summarizeObservations supports camelCase new API rows', () => {
    const summary = summarizeObservations([
      { parameterName: 'PM2.5', nowcastAQI: 55, category: { name: 'Moderate' }, reportingArea: 'Boston' },
    ]);
    expect(summary.aqi).toBe(55);
    expect(summary.category).toBe('Moderate');
  });

  test('getAirNowStatus reports configured flag', () => {
    const prev = process.env.AIRNOW_API_KEY;
    delete process.env.AIRNOW_API_KEY;
    expect(getAirNowStatus().configured).toBe(false);
    process.env.AIRNOW_API_KEY = prev;
  });
});
