/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const {
  collectLiveDisasterAwareness,
  renderDailyBriefingMarkdown,
  buildDailyBriefingSpokenScript,
} = await import('../../services/disaster-daily-briefing.service.js');

describe('disaster-daily-briefing.service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('collectLiveDisasterAwareness merges live source payloads', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('api.weather.gov')) {
        return {
          ok: true,
          headers: { get: () => 'application/geo+json' },
          json: async () => ({
            features: [
              {
                properties: {
                  event: 'Flood Warning',
                  headline: 'Flood Warning for Example County',
                  areaDesc: 'Example County, TX',
                  severity: 'Severe',
                  effective: '2026-06-18T12:00:00+00:00',
                },
              },
              {
                properties: {
                  event: 'Hurricane Warning',
                  headline: 'Hurricane Warning for Coastal County',
                  areaDesc: 'Coastal County, FL',
                  severity: 'Extreme',
                  effective: '2026-06-18T10:00:00+00:00',
                },
              },
            ],
          }),
        };
      }
      if (String(url).includes('earthquake.usgs.gov')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            features: [
              {
                properties: { mag: 4.2, title: 'M 4.2 - Nevada', place: '35 km E of Reno, NV', time: Date.now() },
                geometry: { coordinates: [-119.5, 39.5] },
              },
            ],
          }),
        };
      }
      if (String(url).includes('fema.gov')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            DisasterDeclarationsSummaries: [
              {
                declarationTitle: 'TX Severe Storms',
                incidentType: 'Severe Storm',
                state: 'TX',
                county: 'Travis',
                incidentBeginDate: '2026-06-10',
              },
            ],
          }),
        };
      }
      if (String(url).includes('firms.modaps.eosdis.nasa.gov')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ features: [] }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const data = await collectLiveDisasterAwareness({ includeFirms: true, days: 7 });
    expect(data.summary.bySource.nws).toBe(2);
    expect(data.summary.bySource.nhc).toBe(1);
    expect(data.summary.bySource.usgs).toBe(1);
    expect(data.summary.bySource.fema).toBe(1);
    expect(data.highlights.length).toBeGreaterThan(0);
    expect(data.highlights[0].title).toMatch(/Hurricane|Flood|M 4.2|TX Severe/);
  });

  test('renderDailyBriefingMarkdown includes executive summary and highlights', () => {
    const md = renderDailyBriefingMarkdown({
      generatedAt: '2026-06-18T15:00:00.000Z',
      windowDays: 7,
      summary: {
        totalEvents: 2,
        bySource: { nws: 1, usgs: 1 },
        topStates: [{ state: 'TX', count: 1 }],
        failures: [],
        sourceStatus: [],
      },
      highlights: [
        {
          title: 'Flood Warning',
          source: 'nws',
          location: 'Example, TX',
          severity: 'Severe',
          startedAt: '2026-06-18T12:00:00.000Z',
        },
      ],
      sources: {
        nws: [
          {
            title: 'Flood Warning',
            source: 'nws',
            location: 'Example, TX',
            severity: 'Severe',
            startedAt: '2026-06-18T12:00:00.000Z',
          },
        ],
        usgs: [],
      },
    });

    expect(md).toMatch(/US Disaster Daily Briefing/);
    expect(md).toMatch(/Executive summary/);
    expect(md).toMatch(/Flood Warning/);
    expect(md).toMatch(/NWS/);
  });

  test('buildDailyBriefingSpokenScript produces plain speech without markdown', () => {
    const script = buildDailyBriefingSpokenScript({
      generatedAt: '2026-06-18T15:00:00.000Z',
      windowDays: 7,
      summary: {
        totalEvents: 98,
        bySource: { nws: 95, nhc: 0, usgs: 2, fema: 1, firms: 0 },
        topStates: [],
        failures: [{ source: 'firms', error: 'HTTP 400' }],
        sourceStatus: [],
      },
      highlights: [
        {
          source: 'nws',
          eventType: 'flash flood warning',
          title: 'Flash Flood Warning issued June 19 at 12:29AM CDT until June 19 at 3:30AM CDT by NWS Mobile AL',
          location: 'Washington, AL',
        },
        {
          source: 'usgs',
          eventType: 'earthquake',
          title: 'M 4.4 - 26 km NNE of Mont-Joli, Canada',
          location: '26 km NNE of Mont-Joli, Canada',
          magnitude: 4.4,
        },
        {
          source: 'fema',
          title: 'UPRIVER FIRE',
          location: 'WA',
          state: 'WA',
        },
      ],
      sources: {
        nws: [{ eventType: 'flash flood warning' }, { eventType: 'extreme heat warning' }],
        usgs: [{ magnitude: 4.4, location: '26 km NNE of Mont-Joli, Canada' }],
        fema: [],
        nhc: [],
        firms: [],
      },
    });

    expect(script).toMatch(/United States disaster daily briefing/);
    expect(script).not.toMatch(/\*\*|##/);
    expect(script).toMatch(/no active hurricane/i);
    expect(script).toMatch(/Flash Flood Warning/);
    expect(script).not.toMatch(/issued June 19 at/);
    expect(script).toMatch(/magnitude four point four/i);
    expect(script).toMatch(/FIRMS feed was unavailable/i);
    expect(script).toMatch(/End of briefing/);
  });
});
