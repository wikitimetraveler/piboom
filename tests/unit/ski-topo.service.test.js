/**
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  scoreGoNoGo,
  chainsLikely,
  filterStops,
  mergeStops,
  loadDestinations,
  loadOnTheWaySeed,
  getBrief,
} from '../../services/ski-topo.service.js';

describe('ski-topo.service', () => {
  test('catalog has Fountain Valley home and four resorts', async () => {
    const catalog = await loadDestinations();
    expect(catalog.home.name).toBe('Fountain Valley');
    expect(catalog.destinations.map((d) => d.id)).toEqual([
      'mountain-high',
      'snow-valley',
      'snow-summit',
      'bear-mountain',
    ]);
    expect(catalog.destinations.every((d) => d.baseFt && d.summitFt)).toBe(true);
  });

  test('scoreGoNoGo: blizzard warning is no-go; missing weather is caution; clear is go', () => {
    expect(
      scoreGoNoGo({
        alerts: [{ event: 'Blizzard Warning', severity: 'Extreme' }],
        resortBaseFt: 6600,
      })
    ).toBe('no-go');
    expect(scoreGoNoGo({})).toBe('caution');
    expect(
      scoreGoNoGo({
        freezeLevelFt: 9000,
        resortBaseFt: 6600,
        precipIn: 0,
        alerts: [],
      })
    ).toBe('go');
    expect(
      scoreGoNoGo({
        freezeLevelFt: 4000,
        resortBaseFt: 6600,
        precipIn: 0.2,
        alerts: [{ event: 'Winter Weather Advisory' }],
      })
    ).toBe('caution');
  });

  test('chainsLikely when freeze is at chain elevation or winter alert', () => {
    expect(chainsLikely({ freezeLevelFt: 4000 })).toBe(true);
    expect(chainsLikely({ alerts: [{ event: 'Winter Storm Warning' }] })).toBe(true);
    expect(chainsLikely({ freezeLevelFt: 8000, alerts: [] })).toBe(false);
  });

  test('filterStops by route and kind; scenic groups viewpoints', async () => {
    const seed = await loadOnTheWaySeed();
    const wright = filterStops(seed, { route: 'wrightwood' });
    expect(wright.every((s) => s.route === 'wrightwood' || s.route === 'both')).toBe(true);
    expect(wright.some((s) => s.id === 'mormon-rocks')).toBe(true);
    expect(wright.some((s) => s.id === 'oak-glen')).toBe(false);

    const thrift = filterStops(
      [...seed, { id: 'x', name: 'Test Thrift', route: 'wrightwood', kind: 'thrift' }],
      { route: 'wrightwood', kind: 'thrift' }
    );
    expect(thrift).toHaveLength(1);
    expect(thrift[0].kind).toBe('thrift');

    const scenic = filterStops(seed, { route: 'big-bear', kind: 'scenic' });
    expect(scenic.every((s) => ['viewpoint', 'town', 'food', 'lake'].includes(s.kind))).toBe(true);
  });

  test('mergeStops prefers seed then live and dedupes by name', () => {
    const merged = mergeStops(
      [{ id: 'a', name: 'Pine Thrift', town: 'Wrightwood', kind: 'thrift', source: 'seed' }],
      [
        { id: 'b', name: 'Pine Thrift', town: 'Wrightwood', kind: 'thrift', source: 'live' },
        { id: 'c', name: 'Cajon Smoke', town: 'Cajon', kind: 'smoke', source: 'live' },
      ]
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('seed');
    expect(merged[1].name).toBe('Cajon Smoke');
  });

  test('getBrief uses mocked Open-Meteo and NWS — no live network', async () => {
    const fetchFn = async (url) => {
      const href = String(url);
      if (href.includes('open-meteo.com')) {
        return {
          ok: true,
          json: async () => ({
            current: { temperature_2m: 28, precipitation: 0, snowfall: 0, snow_depth: 12 },
            hourly: { freezing_level_height: [2400] },
          }),
        };
      }
      if (href.includes('api.weather.gov/alerts')) {
        return { ok: true, json: async () => ({ features: [] }) };
      }
      if (href.includes('api.weather.gov/points')) {
        return { ok: true, json: async () => ({ properties: { forecast: 'https://api.weather.gov/mock-forecast' } }) };
      }
      if (href.includes('mock-forecast')) {
        return {
          ok: true,
          json: async () => ({
            properties: { periods: [{ name: 'Today', shortForecast: 'Sunny', temperature: 32, temperatureUnit: 'F' }] },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    };
    const brief = await getBrief({ fetchFn });
    expect(brief.home.name).toBe('Fountain Valley');
    expect(brief.destinations).toHaveLength(4);
    expect(brief.destinations[0].weather.tempF).toBe(28);
    expect(brief.destinations[0].score).toBe('go');
    expect(brief.disclaimer).toMatch(/not official/i);
  });

  test('seed file exists and is scenic-only', async () => {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'data/ski/on-the-way.json'), 'utf8'));
    expect(raw.stops.length).toBeGreaterThanOrEqual(4);
    expect(raw.stops.every((s) => s.source === 'seed')).toBe(true);
  });
});
