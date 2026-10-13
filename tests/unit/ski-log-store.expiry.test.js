/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const queryMock = jest.fn();

await jest.unstable_mockModule('../../services/database.service.js', () => ({
  getPool: () => ({ query: queryMock }),
}));
await jest.unstable_mockModule('../../services/ski-log-media.service.js', () => ({
  MAX_PHOTO_BYTES: 1,
  processPhotoBuffer: jest.fn(),
}));

const store = await import('../../services/ski-log-store.service.js');
const { TRIP_TTL_DAYS } = await import('../../services/ski-log.service.js');

const sqlCalls = () => queryMock.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim());

queryMock.mockImplementation(async (sql) => {
  if (sql.includes('information_schema.columns')) return { rowCount: 0, rows: [] };
  if (sql.startsWith('DELETE FROM ski_trips')) return { rows: [{ code: 'POW-4K7' }] };
  if (sql.startsWith('UPDATE ski_trips SET keep = $2')) {
    return { rows: [{ id: 1, code: 'POW-4K7', name: 'Pow', resort_id: 'mt-baldy', start_date: '2026-01-02', keep: true }] };
  }
  return { rows: [], rowCount: 0 };
});

describe('Crew log trip expiry', () => {
  test('first migration adds keep and keeps every trip that already exists', async () => {
    await store.initSkiLogSchema();
    const calls = sqlCalls();
    expect(calls.some((s) => s.includes('ADD COLUMN IF NOT EXISTS keep BOOLEAN NOT NULL DEFAULT false'))).toBe(true);
    expect(calls).toContain('UPDATE ski_trips SET keep = true');
  });

  test('purge deletes only unkept trips idle past the cutoff and returns their codes', async () => {
    queryMock.mockClear();
    const now = Date.UTC(2026, 9, 12);
    const codes = await store.purgeExpiredTrips({ now });
    expect(codes).toEqual(['POW-4K7']);
    const [sql, params] = queryMock.mock.calls.find(([s]) => s.startsWith('DELETE FROM ski_trips'));
    expect(sql).toMatch(/WHERE NOT t\.keep/);
    for (const table of ['ski_trip_members', 'ski_log_points', 'ski_log_checkins', 'ski_log_photos']) {
      expect(sql).toContain(table);
    }
    const cutoffMs = now - TRIP_TTL_DAYS * 86_400_000;
    expect(params).toEqual([new Date(cutoffMs), cutoffMs]);
  });

  test('defaults to 30 days', () => {
    expect(TRIP_TTL_DAYS).toBe(30);
  });

  test('throttled purge runs at most once per six hours and never throws', async () => {
    const t0 = Date.UTC(2027, 0, 1);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await expect(store.maybePurgeExpiredTrips(t0)).resolves.toEqual(['POW-4K7']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('POW-4K7'));
    log.mockRestore();
    expect(store.maybePurgeExpiredTrips(t0 + 60_000)).toBeNull();
    queryMock.mockRejectedValueOnce(new Error('db down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(store.maybePurgeExpiredTrips(t0 + 7 * 3_600_000)).resolves.toEqual([]);
    warn.mockRestore();
  });

  test('createTrip stores the keep flag and setTripKeep maps the row', async () => {
    queryMock.mockClear();
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ id: 9, code: 'SKI-2AB', name: 'Mine', resort_id: 'mt-baldy', start_date: '2026-01-02', keep: true }],
    }));
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ id: 3, trip_id: 9, display_name: 'Dave', color: '#7ec8e3', is_owner: true }],
    }));
    const made = await store.createTrip({ name: 'Mine', resortId: 'mt-baldy', startDate: '2026-01-02', displayName: 'Dave', keep: true });
    expect(queryMock.mock.calls[0][1][4]).toBe(true);
    expect(made.trip.keep).toBe(true);

    const kept = await store.setTripKeep('POW-4K7', true);
    expect(kept).toMatchObject({ code: 'POW-4K7', keep: true });
  });
});