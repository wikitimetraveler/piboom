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
  fetchOpenMeteo,
  fetchGoogleWeather,
  buildGoogleWeather,
  parseOpenMeteoHourly,
  buildDestinationBrief,
} from '../../services/ski-topo.service.js';

describe('ski-topo.service', () => {
  test('catalog has Fountain Valley home and seven resorts', async () => {
    const catalog = await loadDestinations();
    expect(catalog.home.name).toBe('Fountain Valley');
    expect(catalog.destinations.map((d) => d.id)).toEqual([
      'mountain-high',
      'mt-baldy',
      'snow-valley',
      'snow-summit',
      'bear-mountain',
      'mammoth',
      'june',
    ]);
    expect(catalog.destinations.every((d) => d.baseFt && d.summitFt)).toBe(true);
    expect(catalog.destinations.every((d) => Number.isFinite(d.summitLat) && Number.isFinite(d.summitLng))).toBe(true);
  });

  test('every destination points at a known route and a baked DEM', async () => {
    const catalog = await loadDestinations();
    const routes = JSON.parse(
      await readFile(path.join(process.cwd(), 'data', 'ski', 'routes.json'), 'utf8')
    );
    const { SKI_DEM_SPECS, pointInDemBounds } = await import('../../services/ski-dem.service.js');
    for (const d of catalog.destinations) {
      expect(routes[d.route]).toBeDefined();
      expect(SKI_DEM_SPECS.some((s) => s.id === d.dem)).toBe(true);
      const dem = SKI_DEM_SPECS.find((s) => s.id === d.dem);
      expect(pointInDemBounds(dem, d.summitLat, d.summitLng)).toBe(true);
    }
    const sierra = routes['eastern-sierra'].waypoints.map((w) => w.id);
    expect(sierra[0]).toBe('fountain-valley');
    expect(sierra).toEqual(expect.arrayContaining(['bishop', 'mammoth-lakes', 'june-lake']));
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
        freezeLevelFt: 9000,
        resortBaseFt: 6600,
        precipIn: 0,
        alerts: [],
        summitGustMph: 45,
      })
    ).toBe('caution');
    expect(
      scoreGoNoGo({
        alerts: [{ event: 'Blizzard Warning', severity: 'Extreme' }],
        resortBaseFt: 6600,
        summitGustMph: 80,
      })
    ).toBe('no-go');
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
    expect(scenic.every((s) => ['viewpoint', 'town', 'food', 'lake', 'hike', 'history'].includes(s.kind))).toBe(true);
    expect(scenic.some((s) => s.id === 'heaps-peak' && s.kind === 'hike')).toBe(true);
    expect(scenic.some((s) => s.id === 'big-bear-alpine-zoo' && s.kind === 'history')).toBe(true);
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
    expect(brief.destinations).toHaveLength(7);
    expect(brief.destinations[0].weather.tempF).toBe(28);
    expect(brief.destinations[0].score).toBe('go');
    expect(brief.disclaimer).toMatch(/not official/i);
  });

  test('Open-Meteo lengths: feet stay feet (inch precip units), meters convert', async () => {
    const reply = (body) => async () => ({ ok: true, json: async () => body });
    const imperial = await fetchOpenMeteo(
      34.2,
      -117,
      reply({
        current_units: { snow_depth: 'ft' },
        hourly_units: { freezing_level_height: 'ft' },
        current: { temperature_2m: 30, snow_depth: 1.5 },
        hourly: { freezing_level_height: [4000] },
      })
    );
    expect(imperial.freezeLevelFt).toBe(4000);
    expect(imperial.snowDepthIn).toBe(18);
    expect(chainsLikely({ freezeLevelFt: imperial.freezeLevelFt })).toBe(true);

    const metric = await fetchOpenMeteo(
      34.2,
      -117,
      reply({
        current_units: { snow_depth: 'm' },
        hourly_units: { freezing_level_height: 'm' },
        current: { temperature_2m: 30, snow_depth: 0.5 },
        hourly: { freezing_level_height: [2000] },
      })
    );
    expect(metric.freezeLevelFt).toBe(6562);
    expect(metric.snowDepthIn).toBeCloseTo(19.7, 1);
  });

  test('fetchGoogleWeather parses imperial hours and stays quiet without a key', async () => {
    expect(await fetchGoogleWeather(34.2, -117, async () => { throw new Error('should not fetch'); }, '')).toBeNull();
    const fetchFn = async (url) => {
      const href = String(url);
      if (href.includes('currentConditions')) {
        return {
          ok: true,
          json: async () => ({
            temperature: { degrees: 21 },
            wind: { speed: { value: 10 }, gust: { value: 48 } },
            precipitation: { probability: { percent: 60 }, snowQpf: { quantity: 0.3 } },
            visibility: { distance: 2 },
            weatherCondition: { description: { text: 'Snow' } },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          forecastHours: [
            {
              interval: { startTime: '2026-01-01T18:00:00Z' },
              temperature: { degrees: 18 },
              wind: { speed: { value: 30 }, gust: { value: 50 } },
              precipitation: { probability: { percent: 80 }, snowQpf: { quantity: 0.4 } },
              visibility: { distance: 1 },
              weatherCondition: { description: { text: 'Heavy snow' } },
            },
          ],
        }),
      };
    };
    const wx = await fetchGoogleWeather(34.2, -117, fetchFn, 'test-key');
    expect(wx.current.gustMph).toBe(48);
    expect(wx.current.snowIn).toBe(0.3);
    expect(wx.current.condition).toBe('Snow');
    expect(wx.hours[0].windMph).toBe(30);
    expect(wx.hours[0].time).toBe('2026-01-01T18:00:00Z');
    const brief = buildGoogleWeather(wx, {
      current: { ...wx.current, gustMph: 20 },
      hours: wx.hours,
    });
    expect(brief.windHold).toBe(true);
    expect(brief.summitGustMph).toBe(50);
    expect(buildGoogleWeather(null, null)).toBeNull();
  });

  test('Open-Meteo hourly parses into the Google Weather pack shape', () => {
    const pack = parseOpenMeteoHourly({
      current: { time: '2026-01-01T18:15', temperature_2m: 22, snowfall: 0.4, wind_speed_10m: 18, wind_gusts_10m: 41, weather_code: 73 },
      hourly: {
        time: ['2026-01-01T18:00', '2026-01-01T19:00'],
        temperature_2m: [22, 21],
        snowfall: [0.4, null],
        precipitation_probability: [80, 60],
        wind_speed_10m: [18, 20],
        wind_gusts_10m: [41, 52],
        weather_code: [73, 2],
      },
    });
    expect(pack.source).toBe('open-meteo');
    expect(pack.current.condition).toBe('Snow');
    expect(pack.hours).toHaveLength(2);
    expect(pack.hours[0].time).toBe('2026-01-01T18:00:00Z');
    expect(pack.hours[1].snowIn).toBe(0);
    expect(pack.hours[1].condition).toBe('Partly cloudy');
    const brief = buildGoogleWeather(pack, pack);
    expect(brief.source).toBe('open-meteo');
    expect(brief.summitGustMph).toBe(52);
    expect(brief.windHold).toBe(true);
    expect(parseOpenMeteoHourly(null)).toBeNull();
  });

  test('summit forecast falls back to Open-Meteo only when Google Weather is empty', async () => {
    const dest = (await loadDestinations()).destinations[0];
    const calls = [];
    const openMeteoHourly = {
      ok: true,
      json: async () => ({
        current: { temperature_2m: 25, wind_gusts_10m: 30 },
        hourly: { time: ['2026-01-01T18:00'], temperature_2m: [25], wind_gusts_10m: [30], snowfall: [1] },
      }),
    };
    const offline = async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.includes('open-meteo.com') && href.includes('forecast_hours')) return openMeteoHourly;
      if (href.includes('open-meteo.com')) return { ok: true, json: async () => ({ current: {}, hourly: {} }) };
      return { ok: false, json: async () => ({}) };
    };
    const fallback = await buildDestinationBrief(dest, { lat: 33.7, lng: -117.9 }, offline);
    expect(fallback.googleWeather.source).toBe('open-meteo');
    expect(fallback.googleWeather.hours[0].snowIn).toBe(1);
    expect(calls.filter((u) => u.includes('forecast_hours'))).toHaveLength(2);

    const googleFirst = await fetchGoogleWeather(34.2, -117, async (url) => ({
      ok: true,
      json: async () => (String(url).includes('currentConditions')
        ? { temperature: { degrees: 20 } }
        : { forecastHours: [{ temperature: { degrees: 19 } }] }),
    }), 'test-key');
    expect(googleFirst.source).toBe('google');
  });

  test('seed file exists and is scenic-only', async () => {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'data/ski/on-the-way.json'), 'utf8'));
    expect(raw.stops.length).toBeGreaterThanOrEqual(4);
    expect(raw.stops.every((s) => s.source === 'seed')).toBe(true);
  });
});
