/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

// Fixtures must stay inside the crawler's maxAgeHours window, so timestamps are relative to now.
const hoursAgoIso = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
const hoursAgoGdelt = (hours) => hoursAgoIso(hours).replace(/[-:T]/g, '').slice(0, 14);

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Flood Warning for Example County</title>
    <link href="https://www.weather.gov/example"/>
    <updated>${hoursAgoIso(2)}</updated>
    <summary>River flooding expected overnight.</summary>
  </entry>
  <entry>
    <title>Local sports roundup</title>
    <updated>${hoursAgoIso(3)}</updated>
    <summary>High school baseball finals.</summary>
  </entry>
</feed>`;

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { crawlDisasterWeb } = await import('../../services/disaster-web-crawler.service.js');

describe('disaster-web-crawler.service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('crawlDisasterWeb filters keyword-gated feeds and dedupes', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('active.atom')) {
        return {
          ok: true,
          headers: { get: () => 'application/atom+xml' },
          url,
          text: async () => SAMPLE_ATOM,
        };
      }
      if (String(url).includes('all_day.atom')) {
        return {
          ok: true,
          headers: { get: () => 'application/atom+xml' },
          url,
          text: async () => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>M 3.1 - Nevada</title><updated>${hoursAgoIso(4)}</updated><link href="https://earthquake.usgs.gov/earthquakes/eventpage/nv001"/></entry></feed>`,
        };
      }
      if (String(url).includes('significant_month.atom')) {
        return {
          ok: true,
          headers: { get: () => 'application/atom+xml' },
          url,
          text: async () => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>`,
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const data = await crawlDisasterWeb({ maxAgeHours: 72, feedIds: ['nws-active-atom', 'usgs-quakes-day-atom'] });
    expect(data.summary.totalItems).toBeGreaterThanOrEqual(2);
    const titles = data.items.map((i) => i.title);
    expect(titles.some((t) => /Flood Warning/i.test(t))).toBe(true);
    expect(titles.some((t) => /sports/i.test(t))).toBe(false);
    expect(data.items.every((i) => i.url || i.title)).toBe(true);
  });

  test('crawlDisasterWeb parses GDELT articles when enabled', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (String(url).includes('gdeltproject.org')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          url,
          text: async () =>
            JSON.stringify({
              articles: [
                {
                  title: 'Flooding forces evacuations in Mississippi county',
                  url: 'https://example.com/flood-story',
                  seendate: hoursAgoGdelt(6),
                  domain: 'example.com',
                  sourcecountry: 'United States',
                  language: 'English',
                },
              ],
            }),
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const data = await crawlDisasterWeb({
      maxAgeHours: 72,
      feedIds: ['gdelt-doc-us-disasters'],
      includeGdelt: true,
    });
    expect(data.summary.bySource.gdelt).toBe(1);
    expect(data.items[0].title).toMatch(/Flooding forces evacuations/i);
    expect(data.items[0].publisher).toBe('example.com');
  });
});
